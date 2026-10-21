#!/usr/bin/env python3
"""J4: ИИ-разбор сделки / недели на Claude Opus (через Claude Code по подписке Max).

  ai_review.py trade <#N | uuid | last> [--dry-run]
  ai_review.py week  [--from YYYY-MM-DD --to YYYY-MM-DD] [--dry-run]   (по умолч. последние 7 дней)

Пишет ai_reviews (kind=trade|weekly) + llm_calls (provider=anthropic, billing=SUBSCRIPTION, полный промпт/ответ),
печатает разбор в Markdown (его Hermes отправляет в топик Т6). Для SaaS заменить call_opus() на Anthropic API.
--dry-run: собирает контекст и печатает промпт, Opus не вызывает, в БД не пишет.
"""
import argparse
import hashlib
import json
import os
import subprocess
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import psycopg

ROOT = Path(__file__).resolve().parents[2]
MSK = ZoneInfo("Europe/Moscow")
ORG = "(SELECT id FROM organizations WHERE slug = 'german')"
PROMPT_VERSION = "j4-v1"
MODEL = "opus"

SYSTEM = """Ты — жёсткий, но доброжелательный наставник трейдера. Пишешь по-русски, кратко, без воды и без морали.
Трейдер — Герман: торгует фьючерсы MEXC, основные сетапы — шорт пампов альткоинов и BTC по SMC (15m).
Опирайся ТОЛЬКО на данные ниже. Не выдумывай цены, уровни и события, которых нет в данных. Если данных не хватает — так и скажи, что нужно записать.
Ты не даёшь торговых сигналов и не предсказываешь рынок — ты разбираешь поведение и исполнение."""

TRADE_TASK = """Сделай разбор этой сделки. Формат (Markdown, до ~180 слов):
**Итог:** одна строка — что произошло и почему результат такой.
**Что сделано хорошо:** 1–2 пункта (если нечего — «—»).
**Ошибки:** 1–3 пункта, каждый с привязкой к фактам (цифры, время, нарушенное правило).
**Паттерн:** повторяется ли это в истории похожих сделок (используй блок «похожие сделки»).
**Правило на следующий раз:** одно конкретное действие.
В конце отдельной строкой JSON без обёртки: {"tags": [...], "rules_broken": [...коды правил...], "tilt_risk": 0-3}"""

WEEK_TASK = """Сделай недельный разбор. Формат (Markdown, до ~300 слов):
**Неделя в цифрах:** 1–2 строки.
**Главная проблема недели:** одна, с номерами сделок.
**Паттерны:** 2–4 пункта (время, монеты, сторона, длительность, усреднение, ликвидации, тильт-серии), каждый с номерами сделок.
**Что работает:** 1–2 пункта.
**Фокус на следующую неделю:** 1–3 конкретных правила/лимита.
В конце отдельной строкой JSON без обёртки: {"findings": [{"type": "pattern|mistake|strength", "text": "...", "trades": [номера]}], "tilt_days": ["YYYY-MM-DD"]}"""


def env():
    for line in (ROOT / ".env").read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def f(x, d=2):
    return "—" if x is None else f"{float(x):.{d}f}"


def t_msk(ts):
    return ts.astimezone(MSK).strftime("%d.%m %H:%M") if ts else "—"


NUM = "WITH o AS (SELECT id, row_number() OVER (ORDER BY opened_at) AS n FROM trades WHERE deleted_at IS NULL) "
COLS = """o.n, t.id, i.base_asset, t.side, t.status, t.opened_at, t.closed_at, t.entry_avg, t.exit_avg, t.max_qty,
  t.gross_pnl, t.fees, t.funding, t.net_pnl, t.stop_is_liquidation, t.planned_stop, t.r_multiple, t.leverage,
  t.entry_reason, t.emotion_before, t.emotion_after, t.followed_plan, t.confidence, p.name, t.executor"""
FROM = " FROM trades t JOIN o ON o.id = t.id JOIN instruments i ON i.id = t.instrument_id LEFT JOIN playbooks p ON p.id = t.playbook_id "


def trade_line(r):
    n, _id, sym, side, st, op, cl, ea, xa, q, g, fee, fu, net, liq, ps, rm, lev, why, eb, ea2, fp, conf, pb, ex = r
    dur = f"{(cl - op).total_seconds() / 3600:.1f}ч" if cl else "открыта"
    s = (f"#{n} {sym} {side} {t_msk(op)}→{t_msk(cl)} ({dur}) вход {f(ea, 6)} выход {f(xa, 6)} объём {f(q, 4)} "
         f"gross {f(g)} комиссии {f(fee)} фандинг {f(fu)} NET {f(net)}")
    if liq:
        s += " ЛИКВИДАЦИЯ"
    extra = [f"стоп {f(ps, 6)}" if ps else "", f"R {f(rm)}" if rm is not None else "", f"плечо {f(lev, 0)}" if lev else "",
             f"стратегия {pb}" if pb else "", f"эмоция до: {eb}" if eb else "", f"после: {ea2}" if ea2 else "",
             f"по плану: {'да' if fp else 'нет'}" if fp is not None else "", f"уверенность {conf}/5" if conf else "",
             f"причина: {why}" if why else "", "агент" if ex != "HUMAN" else ""]
    extra = [x for x in extra if x]
    return s + (" | " + "; ".join(extra) if extra else "")


def notes_for(cur, where, args):
    cur.execute(f"""SELECT n.created_at, coalesce(n.transcript, n.text), n.kind FROM notes n
                    WHERE n.deleted_at IS NULL AND {where} ORDER BY n.created_at""", args)
    return [f"- {t_msk(c)} ({k.lower()}): {t}" for c, t, k in cur.fetchall() if t]


def violations_for(cur, ids):
    cur.execute("""SELECT v.trade_id, r.code, r.text FROM trade_rule_violations v JOIN rules r ON r.id = v.rule_id
                   WHERE v.trade_id = ANY(%s)""", (ids,))
    out = {}
    for tid, code, text in cur.fetchall():
        out.setdefault(str(tid), []).append(f"{code} ({text})")
    return out


def rules_block(cur):
    cur.execute(f"SELECT code, kind, text FROM rules WHERE organization_id = {ORG} AND deleted_at IS NULL AND active ORDER BY kind, sort_order")
    return "\n".join(f"- [{k}] {c}: {t}" for c, k, t in cur.fetchall())


def build_trade(cur, spec):
    if spec == "last":
        cur.execute(NUM + "SELECT " + COLS + FROM + "WHERE t.deleted_at IS NULL AND t.status = 'CLOSED' ORDER BY t.closed_at DESC LIMIT 1")
    elif spec.startswith("#"):
        cur.execute(NUM + "SELECT " + COLS + FROM + "WHERE o.n = %s", (int(spec[1:]),))
    else:
        cur.execute(NUM + "SELECT " + COLS + FROM + "WHERE t.id = %s", (spec,))
    r = cur.fetchone()
    if not r:
        sys.exit(json.dumps({"error": f"сделка {spec} не найдена"}, ensure_ascii=False))
    tid, sym, side = r[1], r[2], r[3]
    cur.execute("""SELECT executed_at, side, price, qty, fee_quote, realized_pnl, is_liquidation FROM executions
                   WHERE trade_id = %s ORDER BY executed_at""", (tid,))
    ex = [f"- {t_msk(a)} {s} {f(p, 6)} × {f(q, 4)} fee {f(fe, 4)} pnl {f(pn)}{' LIQ' if lq else ''}" for a, s, p, q, fe, pn, lq in cur.fetchall()]
    day = r[5].astimezone(MSK).date()
    notes = notes_for(cur, "(n.trade_id = %s OR (n.trade_id IS NULL AND n.day_date = %s))", (tid, day))
    viol = violations_for(cur, [tid]).get(str(tid), [])
    # похожие: та же монета или та же сторона, последние 15 до этой
    cur.execute(NUM + "SELECT " + COLS + FROM + """WHERE t.deleted_at IS NULL AND t.status = 'CLOSED' AND t.id <> %s
                  AND t.opened_at < %s AND (i.base_asset = %s OR t.side = %s) ORDER BY (i.base_asset = %s) DESC, t.opened_at DESC LIMIT 15""",
                (tid, r[5], sym, side, sym))
    sim = cur.fetchall()
    # день сделки: что было до неё
    cur.execute(NUM + "SELECT " + COLS + FROM + """WHERE t.deleted_at IS NULL AND t.id <> %s
                  AND t.opened_at >= %s AND t.opened_at < %s ORDER BY t.opened_at""",
                (tid, r[5] - timedelta(hours=24), r[5]))
    before = cur.fetchall()
    ctx = f"""## Сделка
{trade_line(r)}
Нарушенные правила (отметил трейдер): {', '.join(viol) or 'не отмечены'}

## Исполнения
{chr(10).join(ex) or '—'}

## Заметки трейдера (к сделке и за день)
{chr(10).join(notes) or '—'}

## Сделки за 24ч до входа
{chr(10).join(trade_line(x) for x in before) or '—'}

## Похожие сделки в прошлом (та же монета, затем та же сторона)
{chr(10).join(trade_line(x) for x in sim) or '—'}

## Правила трейдера
{rules_block(cur)}"""
    return {"kind": "trade", "trade_id": str(tid), "title": f"#{r[0]} {sym} {side}", "ctx": ctx, "task": TRADE_TASK,
            "from": None, "to": None}


def build_week(cur, d_from, d_to):
    a = datetime.combine(d_from, datetime.min.time(), MSK)
    b = datetime.combine(d_to + timedelta(days=1), datetime.min.time(), MSK)
    cur.execute(NUM + "SELECT " + COLS + FROM + """WHERE t.deleted_at IS NULL AND t.status = 'CLOSED'
                  AND t.closed_at >= %s AND t.closed_at < %s ORDER BY t.opened_at""", (a, b))
    rows = cur.fetchall()
    viol = violations_for(cur, [x[1] for x in rows])
    notes = notes_for(cur, "((n.day_date >= %s AND n.day_date <= %s) OR (n.created_at >= %s AND n.created_at < %s))", (d_from, d_to, a, b))
    nets = [float(x[13] or 0) for x in rows]
    wins = sum(1 for x in nets if x > 0)
    gw, gl = sum(x for x in nets if x > 0), -sum(x for x in nets if x < 0)
    cur.execute("SELECT count(*), coalesce(sum(net_pnl),0), coalesce(sum(net_pnl) FILTER (WHERE net_pnl>0),0), "
                "coalesce(-sum(net_pnl) FILTER (WHERE net_pnl<0),0), count(*) FILTER (WHERE net_pnl>0) "
                "FROM trades WHERE deleted_at IS NULL AND status='CLOSED' AND closed_at < %s", (a,))
    hn, hnet, hgw, hgl, hw = cur.fetchone()
    lines = []
    for x in rows:
        v = viol.get(str(x[1]))
        lines.append(trade_line(x) + (f" | нарушения: {', '.join(v)}" if v else ""))
    ctx = f"""## Период {d_from:%d.%m.%Y} – {d_to:%d.%m.%Y} (МСК)
Сделок {len(rows)}, net {sum(nets):.2f}, WR {100 * wins / len(rows) if rows else 0:.0f}%, PF {gw / gl if gl else float('inf'):.2f}, ликвидаций {sum(1 for x in rows if x[14])}
Для сравнения вся история до периода: сделок {hn}, net {float(hnet):.2f}, WR {100 * hw / hn if hn else 0:.0f}%, PF {float(hgw) / float(hgl) if hgl else 0:.2f}

## Сделки периода
{chr(10).join(lines) or '— сделок не было'}

## Заметки трейдера за период
{chr(10).join(notes) or '—'}

## Правила трейдера
{rules_block(cur)}"""
    return {"kind": "weekly", "trade_id": None, "title": f"неделя {d_from:%d.%m}–{d_to:%d.%m}", "ctx": ctx, "task": WEEK_TASK,
            "from": a, "to": b, "n": len(rows)}


def call_opus(prompt):
    tok = Path.home() / ".claude" / "hermes-oauth-token"
    e = dict(os.environ)
    if tok.exists():
        e["CLAUDE_CODE_OAUTH_TOKEN"] = tok.read_text().strip()
    t0 = time.time()
    p = subprocess.run(["claude", "-p", "--model", MODEL, "--output-format", "json", "--tools", "",
                        "--append-system-prompt", SYSTEM],
                       input=prompt, capture_output=True, text=True, env=e, timeout=1500, cwd=str(Path.home()))
    ms = int((time.time() - t0) * 1000)
    try:
        d = json.loads(p.stdout)
    except Exception:
        return {"ok": False, "error": (p.stderr or p.stdout)[-800:], "ms": ms}
    u = d.get("usage") or {}
    return {"ok": not d.get("is_error"), "text": d.get("result") or "", "error": None if not d.get("is_error") else d.get("result"),
            "ms": ms, "model": next(iter(d.get("modelUsage") or {}), MODEL), "in": u.get("input_tokens"),
            "out": u.get("output_tokens"), "cache": (u.get("cache_read_input_tokens") or 0) + (u.get("cache_creation_input_tokens") or 0),
            "cost": d.get("total_cost_usd")}


def split_json(text):
    """Последняя строка-JSON → findings; остальное — разбор."""
    lines = text.rstrip().splitlines()
    for i in range(len(lines) - 1, max(-1, len(lines) - 6), -1):
        s = lines[i].strip().strip("`")
        if s.startswith("{") and s.endswith("}"):
            try:
                return "\n".join(lines[:i]).rstrip().rstrip("`").rstrip(), json.loads(s)
            except Exception:
                pass
    return text.strip(), None


def main():
    ap = argparse.ArgumentParser()
    sp = ap.add_subparsers(dest="cmd", required=True)
    a1 = sp.add_parser("trade")
    a1.add_argument("spec")
    a1.add_argument("--dry-run", action="store_true")
    a2 = sp.add_parser("week")
    a2.add_argument("--from", dest="d_from")
    a2.add_argument("--to", dest="d_to")
    a2.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    env()
    with psycopg.connect(os.environ["DATABASE_URL"]) as conn, conn.cursor() as cur:
        if a.cmd == "trade":
            job = build_trade(cur, a.spec)
        else:
            today = datetime.now(MSK).date()
            d_to = datetime.strptime(a.d_to, "%Y-%m-%d").date() if a.d_to else today
            d_from = datetime.strptime(a.d_from, "%Y-%m-%d").date() if a.d_from else d_to - timedelta(days=6)
            job = build_week(cur, d_from, d_to)
        prompt = job["ctx"] + "\n\n## Задача\n" + job["task"]
        if a.dry_run:
            print(prompt)
            print(f"\n[dry-run] {len(prompt)} символов, Opus не вызывался")
            return
        if job["kind"] == "weekly" and not job.get("n"):
            print(json.dumps({"ok": True, "skipped": "за период нет закрытых сделок"}, ensure_ascii=False))
            return
        started = datetime.now(timezone.utc)
        r = call_opus(prompt)
        body, fnd = split_json(r.get("text", "")) if r["ok"] else (None, None)
        cur.execute(f"""INSERT INTO ai_reviews (id, organization_id, user_id, trade_id, kind, period_from, period_to, status, content_md, findings)
                        VALUES (gen_random_uuid(), {ORG}, (SELECT id FROM users WHERE telegram_user_id = 7098788894), %s, %s, %s, %s, %s, %s, %s)
                        RETURNING id""",
                    (job["trade_id"], job["kind"], job["from"], job["to"], "done" if r["ok"] else "failed", body,
                     json.dumps(fnd, ensure_ascii=False) if fnd else None))
        rid = cur.fetchone()[0]
        cur.execute(f"""INSERT INTO llm_calls (id, organization_id, ai_review_id, role, provider, model, billing, prompt_version, prompt_hash,
                          prompt, response, input_tokens, output_tokens, cache_tokens, cost_usd, latency_ms, status, error, started_at)
                        VALUES (gen_random_uuid(), {ORG}, %s, %s, 'anthropic', %s, 'SUBSCRIPTION', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                    (rid, "post_trade_review" if job["kind"] == "trade" else "weekly_review", r.get("model", MODEL), PROMPT_VERSION,
                     hashlib.sha256((SYSTEM + prompt).encode()).hexdigest()[:16], SYSTEM + "\n\n" + prompt, r.get("text"),
                     r.get("in"), r.get("out"), r.get("cache"), r.get("cost"), r["ms"], "ok" if r["ok"] else "error",
                     r.get("error"), started))
        conn.commit()
        if not r["ok"]:
            sys.exit(json.dumps({"ok": False, "review_id": str(rid), "error": r.get("error")}, ensure_ascii=False))
        print(f"🧠 Разбор {job['title']} (Opus)\n\n{body}")


if __name__ == "__main__":
    main()
