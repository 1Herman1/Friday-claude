"""Пересборка сделок из ВСЕХ исполнений счёта (файл + API + ручные), DATA_ARCHITECTURE §5.

Сделка = позиция (инструмент, сторона) от 0 до 0. Ключ — "fifo:<external_id первого исполнения>",
поэтому повторная пересборка обновляет те же строки, а поля человека (эмоции, причина, плейбук,
заметки, теги) не трогаются. Фандинг из ledger_entries привязывается к сделке, открытой в момент
начисления, и входит в net_pnl.
"""
from collections import defaultdict
from decimal import Decimal

EPS = Decimal("1e-9")


def rebuild(cur, account_id):
    cur.execute("""
        SELECT e.id, e.external_id, e.instrument_id, e.side, e.position_side, e.price, e.qty, e.qty_contracts,
               coalesce(e.quote_qty, e.price*e.qty), coalesce(e.fee_quote, 0), coalesce(e.realized_pnl, 0),
               e.is_liquidation, e.executed_at, e.organization_id
        FROM executions e WHERE e.account_id = %s
        ORDER BY e.executed_at,
                 -- открытия раньше закрытий в ту же секунду
                 CASE WHEN (e.side = 'BUY') = (e.position_side = 'long') THEN 0 ELSE 1 END,
                 e.external_id  -- детерминированно: ключ сделки не должен «плавать» между запусками""",
                (account_id,))
    rows = cur.fetchall()
    if not rows:
        return dict(trades=0)
    org = rows[0][13]
    pos, cur_t, trades = defaultdict(Decimal), {}, []
    for (eid, ext, inst, side, pside, price, qty, qc, quote, fee, pnl, liq, ts, _) in rows:
        is_open = (side == "BUY") == (pside == "long")
        key = (inst, pside)
        size = qc if qc is not None else qty
        if is_open:
            if pos[key] <= EPS:
                cur_t[key] = dict(inst=inst, side=pside, f=[], max_pos=Decimal(0))
            pos[key] += size
            t = cur_t[key]
        else:
            t = cur_t.get(key) or cur_t.setdefault(key, dict(inst=inst, side=pside, f=[], max_pos=Decimal(0)))
            pos[key] -= size
        t["f"].append(dict(id=eid, ext=ext, open=is_open, qty=qty, quote=quote, fee=fee, pnl=pnl, liq=liq, ts=ts))
        t["max_pos"] = max(t["max_pos"], pos[key])
        if not is_open and pos[key] <= EPS:
            pos[key] = Decimal(0)
            t["closed"] = True
            trades.append(cur_t.pop(key))
    trades.extend(cur_t.values())

    keep = []
    for t in trades:
        op = [f for f in t["f"] if f["open"]]
        cl = [f for f in t["f"] if not f["open"]]
        oq, cq = sum((f["qty"] for f in op), Decimal(0)), sum((f["qty"] for f in cl), Decimal(0))
        entry = sum((f["quote"] for f in op), Decimal(0)) / oq if oq else None
        exit_ = sum((f["quote"] for f in cl), Decimal(0)) / cq if cq else None
        gross = sum((f["pnl"] for f in cl), Decimal(0))
        fees = sum((f["fee"] for f in t["f"]), Decimal(0))
        opened = op[0]["ts"] if op else t["f"][0]["ts"]
        closed = cl[-1]["ts"] if t.get("closed") else None
        status = "CLOSED" if t.get("closed") else "OPEN"
        ext_pos = "fifo:" + t["f"][0]["ext"]
        cur.execute("""
            INSERT INTO trades (id, organization_id, account_id, instrument_id, executor, origin, status, side,
              opened_at, closed_at, stop_is_liquidation, max_qty, entry_avg, exit_avg, pnl_asset, gross_pnl, fees,
              funding, net_pnl, net_pnl_usd, external_position_id, recomputed_at, updated_at)
            VALUES (gen_random_uuid(), %s,%s,%s,'HUMAN','IMPORT',%s,%s,%s,%s,%s,%s,%s,%s,'USDT',%s,%s,0,%s,%s,%s,now(),now())
            ON CONFLICT (account_id, external_position_id) DO UPDATE SET
              status=EXCLUDED.status, opened_at=EXCLUDED.opened_at, closed_at=EXCLUDED.closed_at,
              stop_is_liquidation=EXCLUDED.stop_is_liquidation, max_qty=EXCLUDED.max_qty,
              entry_avg=EXCLUDED.entry_avg, exit_avg=EXCLUDED.exit_avg, gross_pnl=EXCLUDED.gross_pnl,
              fees=EXCLUDED.fees, deleted_at=NULL, recomputed_at=now(), updated_at=now()
            RETURNING id""",
                    (org, account_id, t["inst"], status, t["side"].upper(), opened, closed,
                     any(f["liq"] for f in cl), oq, entry, exit_, gross, fees, gross - fees, gross - fees, ext_pos))
        tid = cur.fetchone()[0]
        keep.append(tid)
        cur.execute("UPDATE executions SET trade_id=%s WHERE id = ANY(%s)", (tid, [f["id"] for f in t["f"]]))

    # сделки, которых больше нет в сборке: без данных человека — удаляем, с данными — мягко (чтобы не потерять)
    human = """(entry_reason IS NOT NULL OR emotion_before IS NOT NULL OR emotion_after IS NOT NULL
                OR playbook_id IS NOT NULL OR confidence IS NOT NULL OR followed_plan IS NOT NULL
                OR EXISTS (SELECT 1 FROM notes n WHERE n.trade_id = trades.id)
                OR EXISTS (SELECT 1 FROM trade_tags g WHERE g.trade_id = trades.id))"""
    cur.execute(f"""DELETE FROM trades WHERE account_id = %s AND origin = 'IMPORT' AND NOT (id = ANY(%s))
                    AND NOT {human}""", (account_id, keep))
    stale = cur.rowcount
    cur.execute(f"""UPDATE trades SET deleted_at = now() WHERE account_id = %s AND origin = 'IMPORT'
                    AND deleted_at IS NULL AND NOT (id = ANY(%s)) AND {human}""", (account_id, keep))
    stale += cur.rowcount
    # фандинг → сделка, открытая в момент начисления (тот же инструмент и сторона)
    cur.execute("UPDATE ledger_entries SET trade_id = NULL WHERE account_id = %s AND kind = 'FUNDING'", (account_id,))
    cur.execute("""
        UPDATE ledger_entries l SET trade_id = t.id
        FROM trades t
        WHERE l.account_id = %s AND l.kind = 'FUNDING' AND t.account_id = l.account_id
          AND t.instrument_id = l.instrument_id AND t.deleted_at IS NULL
          AND lower(t.side::text) = l.payload_side
          AND l.occurred_at >= t.opened_at AND (t.closed_at IS NULL OR l.occurred_at <= t.closed_at)
    """.replace("l.payload_side", "(SELECT r.payload->>'side' FROM raw_records r WHERE r.id = l.raw_record_id)"),
                (account_id,))
    cur.execute("""
        WITH x AS (SELECT t.id, coalesce((SELECT sum(l.amount) FROM ledger_entries l
                                          WHERE l.trade_id = t.id AND l.kind = 'FUNDING'), 0) AS f
                   FROM trades t WHERE t.account_id = %s AND t.origin = 'IMPORT')  -- ручные сделки не трогаем
        UPDATE trades t SET funding = x.f, net_pnl = t.gross_pnl - t.fees + x.f, net_pnl_usd = t.gross_pnl - t.fees + x.f
        FROM x WHERE x.id = t.id""", (account_id,))
    return dict(trades=len(keep), stale=stale)
