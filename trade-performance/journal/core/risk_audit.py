#!/usr/bin/env python3
"""Аудит риска по правилу Германа (2026-10-23).

Правило: вход фиксированной маржой (~$20, плечо 10 → позиция ~$200), стоп ≈ −10% цены,
то есть максимум теряется входная маржа. Ликвидация БЕЗ добавления маржи = в рамках риска (по стратегии).
Добавление маржи (ручное/автоматическое) или доливка/усреднение позиции = превышение риска, уход от стратегии.

Классы:
  OK            — по стратегии: одна входная маржа, без доливок и без добавления маржи, убыток ≤ входной маржи
  ADD_POSITION  — вне: доливка/усреднение (позиция росла после входа)
  ADD_MARGIN    — вне: добавление маржи (убыток/ликвидация дальше, чем позволяет входная маржа)
  OVER_RISK     — вне: убыток больше входной маржи по другим причинам (крупный вход, без доливок)
Источники: исполнения (executions); для позиций с 11.08.2026 — история позиций MEXC API
(плечо, цена ликвидации, autoAddIm = автодобавление маржи).

  risk_audit.py [--dry-run] [--json]   (без --dry-run пишет trades.leverage/margin_used/margin_mode/liquidation_price/planned_risk_quote
                                         и тег «риск: …»)
"""
import argparse
import json
import sys
from collections import defaultdict
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "importers"))
import psycopg  # noqa: E402

TAGS = {"OK": "риск: по стратегии", "ADD_POSITION": "риск: доливка/усреднение",
        "ADD_MARGIN": "риск: добавлена маржа", "OVER_RISK": "риск: больше входной маржи"}
RANDOM_TAG, NOT_RANDOM_TAG = "случайная", "не случайная"   # «не случайная» вручную = не трогать
RANDOM_SYMBOLS = {"ETH"}            # по словам Германа: все сделки с эфиром — случайные
RANDOM_MAX_MIN = 120               # быстрая отработка: ≤ 2 ч
RANDOM_MAX_SHARE = Decimal("0.25")  # и |net| ≤ 25% входной маржи (минимальный плюс/минус)
TOL = Decimal("1.15")   # допуск на комиссии/фандинг/проскальзывание
DEFAULT_LEV = Decimal(10)


def dburl():
    for line in (ROOT.parent / ".env").read_text().splitlines():
        if line.startswith("DATABASE_URL="):
            return line.split("=", 1)[1].strip().strip('"')


def load_hist():
    p = ROOT / "data" / "history_positions.json"
    try:
        import mexc_api_sync as m
        m.load_env()
        rows = []
        for page in range(1, 60):
            d = m.private("/api/v1/private/position/list/history_positions", {"page_num": page, "page_size": 100}) or []
            rows += d
            if len(d) < 100:
                break
        if rows:
            p.write_text(json.dumps(rows, ensure_ascii=False))
    except Exception as e:  # оффлайн — берём кэш
        print(f"history_positions: API недоступен ({e}), кэш", file=sys.stderr)
    return json.loads(p.read_text()) if p.exists() else []


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    hist = load_hist()
    hidx = defaultdict(list)
    for h in hist:
        hidx[(h["symbol"].replace("_USDT", ""), "LONG" if h["positionType"] == 1 else "SHORT")].append(h)

    with psycopg.connect(dburl()) as con, con.cursor() as cur:
        cur.execute("""
          WITH o AS (SELECT id, row_number() OVER (ORDER BY opened_at) AS n FROM trades WHERE deleted_at IS NULL)
          SELECT t.id, o.n, i.base_asset, t.side::text, t.opened_at, t.closed_at, t.net_pnl, t.stop_is_liquidation,
                 coalesce(i.contract_size, 1)
          FROM trades t JOIN o ON o.id = t.id JOIN instruments i ON i.id = t.instrument_id
          WHERE t.status = 'CLOSED' ORDER BY o.n""")
        trades = cur.fetchall()
        cur.execute("""SELECT trade_id, side::text, price, qty, executed_at, is_liquidation FROM executions
                       WHERE trade_id IS NOT NULL ORDER BY executed_at""")
        ex = defaultdict(list)
        for tid, side, price, qty, at, liq in cur.fetchall():
            ex[tid].append((side, price, qty, at, liq))

        out = []
        for tid, n, base, side, opened, closed, net, liq, _cs in trades:
            fills = ex.get(tid, [])
            open_side = "BUY" if side == "LONG" else "SELL"
            opens = [f for f in fills if f[0] == open_side]
            if not opens:
                continue
            t0 = opens[0][3]
            first = [f for f in opens if (f[3] - t0).total_seconds() <= 120]      # вход = заливка за первые 2 мин
            later = [f for f in opens if (f[3] - t0).total_seconds() > 120]
            first_notional = sum(f[1] * f[2] for f in first)
            total_notional = sum(f[1] * f[2] for f in opens)
            # доливка = позиция выросла более чем на 10% после входа
            add_pos = sum(f[1] * f[2] for f in later) > first_notional * Decimal("0.1")
            # история позиций MEXC (с 11.08.2026)
            h = None
            for c in hidx.get((base, side), []):
                ct = datetime.fromtimestamp(c["createTime"] / 1000, timezone.utc)
                if abs((ct - opened).total_seconds()) < 180:
                    h = c
                    break
            lev = Decimal(str(h["leverage"])) if h else DEFAULT_LEV
            margin0 = first_notional / lev                       # входная маржа = риск сделки
            margin_all = total_notional / lev
            loss = -net if net is not None and net < 0 else Decimal(0)
            entry_avg = sum(f[1] * f[2] for f in opens) / sum(f[2] for f in opens)
            liq_px = None
            add_margin = False
            reasons = []
            if h:
                liq_px = Decimal(str(h["liquidatePrice"])) if h.get("liquidatePrice") else None
                if h.get("autoAddIm"):
                    reasons.append("включено автодобавление маржи")
                if h["openType"] == 2:
                    reasons.append("кросс-маржа (риск = весь баланс)")
                    add_margin = True
                if liq_px:
                    dist = abs(liq_px - entry_avg) / entry_avg
                    if dist > (Decimal(1) / lev) * Decimal("1.35"):
                        add_margin = True
                        reasons.append(f"ликвидация отодвинута до {dist * 100:.0f}% от входа (при {lev}x норма ≈{100 / lev:.0f}%)")
            if loss > margin_all * TOL:
                add_margin = True
                reasons.append(f"убыток ${loss:.2f} > всей маржи позиций ${margin_all:.2f}")
            if add_pos:
                reasons.append(f"доливка: позиция ${first_notional:.0f} → ${total_notional:.0f}")
            if add_pos:
                cls = "ADD_POSITION"
            elif add_margin:
                cls = "ADD_MARGIN"
            elif loss > margin0 * TOL:
                cls = "OVER_RISK"
                reasons.append(f"убыток ${loss:.2f} > входной маржи ${margin0:.2f}")
            else:
                cls = "OK"
            if add_pos and add_margin:
                reasons.append("плюс добавление маржи")
            mins = (closed - opened).total_seconds() / 60 if closed else 1e9
            rnd = None
            if base in RANDOM_SYMBOLS:
                rnd = f"{base} — случайный инструмент"
            elif mins <= RANDOM_MAX_MIN and abs(net or 0) <= max(margin0 * RANDOM_MAX_SHARE, Decimal(1)) and not liq:
                rnd = f"быстрая отработка {mins:.0f} мин, результат ${float(net or 0):+.2f} (≤25% риска)"
            out.append(dict(id=str(tid), n=n, random=rnd, mins=round(mins), base=base, side=side, opened=opened.isoformat(), net=float(net or 0),
                            liq=liq, lev=float(lev), lev_known=bool(h), margin0=float(margin0), margin_all=float(margin_all),
                            add_pos=add_pos, add_margin=add_margin, cls=cls, reasons=reasons,
                            auto_add_im=bool(h and h.get("autoAddIm")), liq_px=float(liq_px) if liq_px else None))

        if not a.dry_run:
            cur.execute("SELECT id FROM organizations WHERE slug='german'")
            org = cur.fetchone()[0]
            tag_ids = {}
            for name in TAGS.values():
                cur.execute("""INSERT INTO tags (id, organization_id, name) VALUES (gen_random_uuid(), %s, %s)
                               ON CONFLICT (organization_id, name) DO UPDATE SET deleted_at = NULL RETURNING id""", (org, name))
                tag_ids[name] = cur.fetchone()[0]
            for r in out:
                cur.execute("""UPDATE trades SET leverage = %s, margin_used = %s, planned_risk_quote = coalesce(planned_risk_quote, %s),
                               liquidation_price = coalesce(%s, liquidation_price), updated_at = now() WHERE id = %s""",
                            (r["lev"] if r["lev_known"] else None, r["margin_all"], r["margin0"], r["liq_px"], r["id"]))
                # класс риска — один тег; старый тег другого класса снимаем (через UPDATE нельзя — связь без deleted_at)
                cur.execute("DELETE FROM trade_tags WHERE trade_id = %s AND tag_id = ANY(%s) AND tag_id <> %s",
                            (r["id"], list(tag_ids.values()), tag_ids[TAGS[r["cls"]]]))
                cur.execute("INSERT INTO trade_tags (trade_id, tag_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                            (r["id"], tag_ids[TAGS[r["cls"]]]))
            for name in (RANDOM_TAG, NOT_RANDOM_TAG):
                cur.execute("""INSERT INTO tags (id, organization_id, name) VALUES (gen_random_uuid(), %s, %s)
                               ON CONFLICT (organization_id, name) DO UPDATE SET deleted_at = NULL RETURNING id""", (org, name))
                tag_ids[name] = cur.fetchone()[0]
            for r in out:
                cur.execute("SELECT 1 FROM trade_tags WHERE trade_id = %s AND tag_id = %s", (r["id"], tag_ids[NOT_RANDOM_TAG]))
                if cur.fetchone() or not r["random"]:
                    continue   # авто только добавляет; снять — вручную тегом «не случайная»
                cur.execute("INSERT INTO trade_tags (trade_id, tag_id) VALUES (%s, %s) ON CONFLICT DO NOTHING", (r["id"], tag_ids[RANDOM_TAG]))
            con.commit()

    agg = defaultdict(lambda: [0, 0.0, 0, 0])
    for r in out:
        g = agg[r["cls"]]
        if r["random"]:
            gr = agg["RANDOM"]; gr[0] += 1; gr[1] += r["net"]; gr[2] += r["net"] > 0; gr[3] += bool(r["liq"])
        g[0] += 1; g[1] += r["net"]; g[2] += r["net"] > 0; g[3] += bool(r["liq"])
    summary = {k: dict(trades=v[0], net=round(v[1], 2), wins=v[2], liquidations=v[3]) for k, v in agg.items()}
    if a.json:
        print(json.dumps(dict(summary=summary, trades=out), ensure_ascii=False, default=str))
    else:
        print(json.dumps(dict(dry_run=a.dry_run, summary=summary, total=len(out)), ensure_ascii=False))


if __name__ == "__main__":
    main()
