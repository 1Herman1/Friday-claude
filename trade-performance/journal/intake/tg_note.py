"""J3: заметки и разбор сделок из Telegram (топик Т6 «Дневник», thread 2).

Джарвис (Hermes, модель Opus) получает текст или расшифровку голосового, сам разбирает смысл
и вызывает этот CLI. Здесь нет LLM — только запись в БД, поэтому вызов детерминирован и идемпотентен
(ключ — chat_id + message_id сообщения Telegram).

  python tg_note.py recent [-n 5]                       — последние сделки (для привязки)
  python tg_note.py add --text "..." [--voice] [--trade auto|last|#N|<uuid>|day]
        [--reason "..."] [--emotion-before FOMO] [--emotion-after ...] [--confidence 1-10]
        [--followed-plan yes|no] [--stop 0.0291] [--playbook "Шорт пампа"] [--tags "a,b"]
        [--chat -1003927097473 --msg 123]

--trade auto: открытая сейчас сделка, иначе закрытая за последние 6 ч, иначе заметка к дню.
Печатает JSON с результатом (к какой сделке привязано).
"""
import argparse
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parents[2]
ORG = "(SELECT id FROM organizations WHERE slug = 'german')"
USER = "(SELECT id FROM users WHERE telegram_user_id = 7098788894)"
EMOTIONS = ["спокойствие", "уверенность", "сомнение", "страх", "FOMO", "жадность", "месть/тильт", "скука", "усталость", "эйфория"]


def load_env():
    for line in (ROOT / ".env").read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip("'\""))


TRADE_SQL = """
  WITH o AS (SELECT id, row_number() OVER (ORDER BY opened_at) AS n FROM trades WHERE deleted_at IS NULL)
  SELECT t.id, o.n, i.base_asset, t.side, t.status, t.opened_at, t.closed_at, round(t.net_pnl, 2)
  FROM trades t JOIN o ON o.id = t.id JOIN instruments i ON i.id = t.instrument_id
"""


def row(r):
    return dict(id=str(r[0]), n=r[1], symbol=r[2], side=r[3], status=r[4],
                opened=r[5].astimezone().isoformat(timespec="minutes") if r[5] else None,
                closed=r[6].astimezone().isoformat(timespec="minutes") if r[6] else None, net=float(r[7] or 0))


def resolve(cur, spec):
    if spec == "day":
        return None
    if spec in ("auto", "last"):
        cur.execute(TRADE_SQL + " WHERE t.deleted_at IS NULL AND t.status = 'OPEN' ORDER BY t.opened_at DESC LIMIT 1")
        r = cur.fetchone()
        if r:
            return r
        cur.execute(TRADE_SQL + " WHERE t.deleted_at IS NULL AND t.status = 'CLOSED' ORDER BY t.closed_at DESC LIMIT 1")
        r = cur.fetchone()
        if spec == "last" or (r and r[6] > datetime.now(timezone.utc) - timedelta(hours=6)):
            return r
        return None
    if spec.startswith("#"):
        cur.execute(TRADE_SQL + " WHERE o.n = %s", (int(spec[1:]),))
    else:
        cur.execute(TRADE_SQL + " WHERE t.id = %s", (spec,))
    r = cur.fetchone()
    if not r:
        sys.exit(json.dumps({"error": f"сделка {spec} не найдена"}, ensure_ascii=False))
    return r


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    rc = sub.add_parser("recent")
    rc.add_argument("-n", type=int, default=5)
    a_ = sub.add_parser("add")
    a_.add_argument("--text", required=True)
    a_.add_argument("--voice", action="store_true")
    a_.add_argument("--trade", default="auto")
    a_.add_argument("--reason")
    a_.add_argument("--emotion-before", choices=EMOTIONS)
    a_.add_argument("--emotion-after", choices=EMOTIONS)
    a_.add_argument("--confidence", type=int, choices=range(1, 11))
    a_.add_argument("--followed-plan", choices=["yes", "no"])
    a_.add_argument("--stop", type=float)
    a_.add_argument("--playbook")
    a_.add_argument("--tags")
    a_.add_argument("--chat", type=int)
    a_.add_argument("--msg", type=int)
    a_.add_argument("--dry-run", action="store_true", help="всё выполнить и откатить (для тестов)")
    a = ap.parse_args()
    load_env()

    with psycopg.connect(os.environ["DATABASE_URL"]) as conn, conn.cursor() as cur:
        if a.cmd == "recent":
            cur.execute(TRADE_SQL + " WHERE t.deleted_at IS NULL ORDER BY t.opened_at DESC LIMIT %s", (a.n,))
            print(json.dumps([row(r) for r in cur.fetchall()], ensure_ascii=False, indent=1))
            return

        t = resolve(cur, a.trade)
        tid = t[0] if t else None
        day = None if t else datetime.now().date()
        cur.execute(f"""INSERT INTO notes (id, organization_id, user_id, trade_id, day_date, kind, channel, text, transcript,
                        parse_status, telegram_chat_id, telegram_message_id, updated_at)
                        VALUES (gen_random_uuid(), {ORG}, {USER}, %s, %s, %s, 'TELEGRAM', %s, %s, 'confirmed', %s, %s, now())
                        ON CONFLICT (telegram_chat_id, telegram_message_id) DO UPDATE SET text = EXCLUDED.text,
                          transcript = EXCLUDED.transcript, trade_id = EXCLUDED.trade_id, updated_at = now()
                        RETURNING id, (xmax = 0)""",
                    (tid, day, "VOICE" if a.voice else "TEXT", None if a.voice else a.text, a.text if a.voice else None,
                     a.chat, a.msg))
        note_id, new = cur.fetchone()

        updated = []
        if tid:
            sets, vals = [], []
            for col, v in [("entry_reason", a.reason), ("emotion_before", a.emotion_before),
                           ("emotion_after", a.emotion_after), ("confidence", a.confidence),
                           ("followed_plan", None if a.followed_plan is None else a.followed_plan == "yes"),
                           ("planned_stop", a.stop)]:
                if v is not None:
                    sets.append(f"{col} = %s")
                    vals.append(v)
                    updated.append(col)
            if a.playbook:
                cur.execute(f"""INSERT INTO playbooks (id, organization_id, user_id, name) VALUES (gen_random_uuid(), {ORG}, {USER}, %s)
                                ON CONFLICT (organization_id, name) DO UPDATE SET deleted_at = NULL RETURNING id""", (a.playbook,))
                sets.append("playbook_id = %s")
                vals.append(cur.fetchone()[0])
                updated.append("playbook")
            if sets:
                cur.execute(f"UPDATE trades SET {', '.join(sets)}, updated_at = now() WHERE id = %s", (*vals, tid))
            for name in [x.strip() for x in (a.tags or "").split(",") if x.strip()]:
                cur.execute(f"""WITH g AS (INSERT INTO tags (id, organization_id, name) VALUES (gen_random_uuid(), {ORG}, %s)
                                ON CONFLICT (organization_id, name) DO UPDATE SET deleted_at = NULL RETURNING id)
                                INSERT INTO trade_tags (trade_id, tag_id) SELECT %s, id FROM g ON CONFLICT DO NOTHING""",
                            (name, tid))
                updated.append(f"tag:{name}")
        conn.rollback() if a.dry_run else conn.commit()
        print(json.dumps({"dry_run": a.dry_run, "note_id": str(note_id), "new": new, "trade": row(t) if t else None,
                          "day": str(day) if day else None, "updated": updated,
                          "url": f"http://127.0.0.1:3100/trades/{tid}" if tid else None}, ensure_ascii=False))


if __name__ == "__main__":
    main()
