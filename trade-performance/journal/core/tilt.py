#!/usr/bin/env python3
"""Ф2: детектор тильта (без LLM, только факты из сделок и исполнений).

Триггеры на сделку (код правила из rules → trade_rule_violations с comment 'auto: …'):
  no_reentry_5m          вход < 5 мин после закрытия убыточной сделки
  no_size_up_after_loss  объём ($) > 1.5× предыдущей сделки, если она была убыточной (в пределах 24 ч)
  no_averaging           добор в ту же сторону по худшей цене (усреднение против себя), > 1 мин после первого входа
  max_trades_day         6-я и далее сделка за день (МСК)
  stop_not_liq           сделка закрыта ликвидацией
Плюс состояние (risk_events kind=tilt_*): tilt_loss_streak — вход после ≥3 убытков подряд в тот же день.

  tilt.py                 пересчитать всё, напечатать сводку (сколько стоил каждый триггер)
  tilt.py --alert 48      то же + напечатать алерты по НОВЫМ срабатываниям у сделок, открытых за 48 ч (для cron → Т6)
  tilt.py --dry-run       ничего не писать
Ручные отметки (из веба/Telegram) не трогаются; auto-отметки не удаляются, только добавляются/обновляются.
"""
import argparse
import json
import os
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import psycopg

ROOT = Path(__file__).resolve().parents[2]
MSK = ZoneInfo("Europe/Moscow")
ORG = "(SELECT id FROM organizations WHERE slug = 'german')"
REENTRY_MIN, SIZE_UP_X, MAX_DAY, STREAK = 5, 1.5, 5, 3
MAJORS = {"BTC", "ETH"}
TITLE = {"no_reentry_5m": "вход <5 мин после убытка", "no_size_up_after_loss": "объём вырос после убытка",
         "no_averaging": "усреднение против себя", "max_trades_day": f">{MAX_DAY} сделок за день",
         "stop_not_liq": "ликвидация вместо стопа", "tilt_loss_streak": f"вход после {STREAK}+ убытков подряд"}


def env():
    for line in (ROOT / ".env").read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def detect(cur):
    cur.execute("""WITH o AS (SELECT id, row_number() OVER (ORDER BY opened_at) AS n FROM trades WHERE deleted_at IS NULL)
      SELECT t.id, o.n, i.base_asset, t.side, t.status, t.opened_at, t.closed_at, t.net_pnl, t.max_qty * t.entry_avg,
             t.stop_is_liquidation OR EXISTS (SELECT 1 FROM executions e WHERE e.trade_id = t.id AND e.is_liquidation)
      FROM trades t JOIN o ON o.id = t.id JOIN instruments i ON i.id = t.instrument_id
      WHERE t.deleted_at IS NULL ORDER BY t.opened_at""")
    trades = cur.fetchall()
    cur.execute("SELECT trade_id, side, price, executed_at FROM executions WHERE trade_id IS NOT NULL ORDER BY executed_at")
    ex = defaultdict(list)
    for tid, side, price, at in cur.fetchall():
        ex[tid].append((side, float(price), at))

    hits = []  # (trade_id, n, code, detail)
    per_day = defaultdict(int)
    for k, (tid, n, sym, side, st, op, cl, net, notional, liq) in enumerate(trades):
        day = op.astimezone(MSK).date()
        per_day[day] += 1
        if per_day[day] > MAX_DAY:
            hits.append((tid, n, "max_trades_day", f"{per_day[day]}-я сделка за {day:%d.%m}"))
        if liq and st == "CLOSED":
            hits.append((tid, n, "stop_not_liq", "закрыта ликвидацией"))
        # предыдущие закрытые к моменту входа
        before = [x for x in trades[:k] if x[6] and x[6] <= op]
        if before:
            last = max(before, key=lambda x: x[6])
            if last[7] is not None and last[7] < 0:
                gap = (op - last[6]).total_seconds() / 60
                if gap < REENTRY_MIN:
                    hits.append((tid, n, "no_reentry_5m", f"через {gap:.1f} мин после #{last[1]} {last[2]} ({float(last[7]):+.2f})"))
                # BTC/ETH и альты торгуются разным объёмом — сравниваем только внутри своей группы
                same_cls = (sym in MAJORS) == (last[2] in MAJORS)
                if same_cls and notional and last[8] and (op - last[6]) < timedelta(hours=24) and float(notional) > SIZE_UP_X * float(last[8]):
                    hits.append((tid, n, "no_size_up_after_loss", f"${float(notional):.0f} против ${float(last[8]):.0f} в #{last[1]}"))
            # серия убытков подряд в тот же день
            streak = 0
            for x in sorted(before, key=lambda x: x[6], reverse=True):
                if x[7] is not None and x[7] < 0 and x[6].astimezone(MSK).date() == day:
                    streak += 1
                else:
                    break
            if streak >= STREAK:
                hits.append((tid, n, "tilt_loss_streak", f"после {streak} убытков подряд"))
        # усреднение: вход-исполнения в сторону сделки по худшей цене
        open_side = "SELL" if side == "SHORT" else "BUY"
        ins = [e for e in ex.get(tid, []) if e[0] == open_side and (cl is None or e[2] < cl)]
        if len(ins) >= 2:
            p0, t0 = ins[0][1], ins[0][2]
            worse = [e for e in ins[1:] if (e[2] - t0) > timedelta(minutes=1) and
                     ((side == "SHORT" and e[1] > p0 * 1.001) or (side == "LONG" and e[1] < p0 * 0.999))]
            if worse:
                w = worse[-1]
                hits.append((tid, n, "no_averaging", f"{len(worse)} доб., до {w[1]:g} от {p0:g} ({(w[1] / p0 - 1) * 100:+.1f}%)"))
    return trades, hits


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--alert", type=float, metavar="HOURS")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    env()
    with psycopg.connect(os.environ["DATABASE_URL"]) as conn, conn.cursor() as cur:
        trades, hits = detect(cur)
        cur.execute(f"SELECT code, id FROM rules WHERE organization_id = {ORG} AND deleted_at IS NULL")
        rule = dict(cur.fetchall())
        info = {t[0]: t for t in trades}
        new = []
        for tid, n, code, detail in hits:
            # risk_event — журнал срабатываний и признак «уже видели»: если Герман снял auto-галочку в карточке,
            # повторно её не ставим (решение человека важнее детектора)
            cur.execute("SELECT 1 FROM risk_events WHERE trade_id = %s AND kind = %s", (tid, "tilt_" + code))
            is_new = False
            if not cur.fetchone():
                if code in rule:
                    cur.execute("""INSERT INTO trade_rule_violations (trade_id, rule_id, comment) VALUES (%s, %s, %s)
                                   ON CONFLICT (trade_id, rule_id) DO NOTHING""", (tid, rule[code], "auto: " + detail))
                cur.execute(f"""INSERT INTO risk_events (id, organization_id, scope, account_id, trade_id, kind, severity, action_taken, message, data, occurred_at)
                                SELECT gen_random_uuid(), {ORG}, 'ACCOUNT', t.account_id, t.id, %s,
                                       %s::"Severity", 'notified', %s, %s, t.opened_at FROM trades t WHERE t.id = %s""",
                            ("tilt_" + code, "CRITICAL" if code in ("stop_not_liq", "tilt_loss_streak") else "WARN",
                             f"#{n}: {TITLE[code]} — {detail}", json.dumps({"code": code, "detail": detail}, ensure_ascii=False), tid))
                is_new = True
            if is_new:
                new.append((tid, n, code, detail))

        # чек-лист → сделка: ближайшая сделка той же монеты/стороны в течение 60 мин после прохождения
        cur.execute(f"""UPDATE checklist_runs c SET trade_id = m.tid FROM (
              SELECT DISTINCT ON (c.id) c.id AS cid, t.id AS tid FROM checklist_runs c
              JOIN trades t ON t.organization_id = c.organization_id AND t.deleted_at IS NULL
              JOIN instruments i ON i.id = t.instrument_id
              WHERE c.trade_id IS NULL AND (c.base_asset IS NULL OR i.base_asset = c.base_asset)
                AND (c.side IS NULL OR t.side = c.side)
                AND t.opened_at BETWEEN c.created_at - interval '5 minutes' AND c.created_at + interval '60 minutes'
              ORDER BY c.id, t.opened_at) m WHERE c.id = m.cid""")

        # сводка: сколько стоил каждый триггер
        by = defaultdict(lambda: [0, 0.0, set()])
        flagged = set()
        for tid, n, code, _ in hits:
            t = info[tid]
            if tid in by[code][2]:
                continue
            by[code][2].add(tid)
            by[code][0] += 1
            by[code][1] += float(t[7] or 0) if t[4] == "CLOSED" else 0
            flagged.add(tid)
        closed = [t for t in trades if t[4] == "CLOSED"]
        clean = [t for t in closed if t[0] not in flagged]
        summary = {
            "trades": len(closed), "flagged": len([t for t in closed if t[0] in flagged]),
            "net_flagged": round(sum(float(t[7] or 0) for t in closed if t[0] in flagged), 2),
            "net_clean": round(sum(float(t[7] or 0) for t in clean), 2),
            "by_rule": {c: {"n": v[0], "net": round(v[1], 2)} for c, v in sorted(by.items(), key=lambda kv: kv[1][1])},
            "new": len(new),
        }
        if a.dry_run:
            conn.rollback()
        else:
            conn.commit()

        if a.alert is not None:
            edge = datetime.now(timezone.utc) - timedelta(hours=a.alert)
            fresh = defaultdict(list)
            for tid, n, code, detail in new:
                if info[tid][5] >= edge:
                    fresh[tid].append(f"{TITLE[code]} ({detail})")
            for tid, items in fresh.items():
                t = info[tid]
                print(f"🧯 Тильт-сигнал: #{t[1]} {t[2]} {'шорт' if t[3] == 'SHORT' else 'лонг'} "
                      f"{t[5].astimezone(MSK):%d.%m %H:%M} — " + "; ".join(items))
            if fresh:
                print("Пауза 30 минут. Перед следующим входом пройди чек-лист.")
        else:
            print(json.dumps(summary, ensure_ascii=False))


if __name__ == "__main__":
    main()
