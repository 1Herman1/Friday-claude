#!/usr/bin/env python3
"""Агент-разборщик: проходит по сделкам и для каждой делает
  1) скрин графика (свечи MEXC + точки входа/выхода) из веб-карточки → attachments(kind=CHART);
  2) рыночный контекст по публичному API MEXC (что было до входа, во время и после выхода);
  3) риск по правилу Германа (входная маржа ~$20, плечо 10 → стоп ≈ −10% = вся маржа; ликвидация без доливки
     маржи — в рамках риска; доливка позиции/маржи — превышение риска), сегмент берётся из core/risk_audit.py;
  4) разбор Opus (смотрит скрин через Read): комментарий, вероятные причины входа и выхода, ошибки, правило.
Пишет ai_reviews(kind=trade, status=done) + llm_calls. Скрипт идемпотентен: сделки с готовым agent-разбором пропускает.

  agent_pass.py --all [--workers 3] [--limit N]       все закрытые сделки без agent-разбора
  agent_pass.py --trade <uuid|#N> [--force]           одна сделка (кнопка «Разобрать агентом» в карточке)
  agent_pass.py --trade '#121' --dry-run               промпт без вызова Opus и без записи
"""
import argparse
import hashlib
import json
import os
import subprocess
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from pathlib import Path

import psycopg

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import ai_review as ar  # noqa: E402

JOURNAL = HERE.parent
ATT_DIR = JOURNAL / "data" / "attachments"
SHOT = JOURNAL / "tools" / "shot" / "chart_shot.mjs"
PROMPT_VERSION = "agent-v1"
ORG = ar.ORG
LOG = JOURNAL / "data" / "logs" / "agent_pass.log"

RISK_RULE = """Правило риска трейдера (его слова): вход фиксированной маржой (последние месяцы ≈ $20 при плече 10 → позиция ≈ $200).
Эта маржа — сумма, которую он готов потерять. Стоп ≈ −10% цены = потеря всей входной маржи; ликвидация без добавления маржи =
стоп в рамках риска (это ПО стратегии). Добавление маржи (вручную или автодобавление) или доливка/усреднение позиции =
превышение риска и уход от стратегии. Случайные сделки: всё с ETH и быстрые отработки (≤2 ч) с результатом в пределах ~25% риска."""

DEEP_TASK = """Ты агент-разборщик. Сначала открой скрин графика (инструмент Read, путь ниже): свечи MEXC, точки входа/выхода, линии цены.
Сопоставь скрин с исполнениями и рыночным контекстом. Формат ответа (Markdown, до ~260 слов, без воды):
**Итог:** одна строка — что произошло и почему такой результат.
**Вероятная причина входа:** 1–3 пункта — что было на графике перед входом (памп на X% за N ч, снятие хая/лоя, импульс, откат к уровню…). Если трейдер записал причину — сверь с графиком; если не записал — помечай «гипотеза».
**Выход:** как закрыта (тейк/ручной/стоп/ликвидация/частями) и что цена сделала после выхода — выход был ранний, поздний или по делу.
**Риск по правилу:** входная маржа, плечо, доливки/маржа → по стратегии или превышение, и сколько это стоило.
**Хорошо:** 1–2 пункта (или «—»).
**Ошибки:** 1–3 пункта с цифрами и временем.
**Правило на следующий раз:** одно конкретное действие.
В конце отдельной строкой JSON без обёртки:
{"tags": [...], "entry_reason_guess": "кратко", "exit_type": "take|manual|stop|liquidation|partial", "setup": "pump_short|smc|breakout|random|other", "in_rules": true|false, "tilt_risk": 0-3}"""


def log(msg):
    LOG.parent.mkdir(parents=True, exist_ok=True)
    with LOG.open("a") as f:
        f.write(f"{datetime.now():%Y-%m-%d %H:%M:%S} {msg}\n")


def klines(sym, interval, start, end):
    s = sym if sym.endswith("_USDT") else f"{sym}_USDT"
    url = f"https://contract.mexc.com/api/v1/contract/kline/{s}?interval={interval}&start={int(start)}&end={int(end)}"
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            d = json.loads(urllib.request.urlopen(req, timeout=20).read()).get("data") or {}
            return [dict(t=t, o=d["open"][i], h=d["high"][i], l=d["low"][i], c=d["close"][i], v=d.get("amount", d["vol"])[i])
                    for i, t in enumerate(d.get("time") or [])]
        except Exception:
            time.sleep(1 + attempt)
    return []


def pct(a, b):
    return (b - a) / a * 100 if a else 0


def market_ctx(sym, side, opened, closed, entry, exit_):
    o, c = opened.timestamp(), (closed or datetime.now(timezone.utc)).timestamp()
    dur = c - o
    iv, step = ("Min15", 900) if dur < 8 * 3600 else ("Min60", 3600) if dur < 4 * 86400 else ("Hour4", 14400)
    before = klines(sym, "Min60", o - 72 * 3600, o)
    during = klines(sym, iv, o - step, c + step)
    after = klines(sym, "Min60", c, c + 24 * 3600)
    L = []
    if before:
        p0 = before[-1]["c"]
        def chg(h):
            xs = [k for k in before if k["t"] >= o - h * 3600]
            return pct(xs[0]["o"], p0) if xs else 0
        hi72, lo72 = max(k["h"] for k in before), min(k["l"] for k in before)
        hi24 = max(k["h"] for k in before if k["t"] >= o - 86400)
        vol_last, vol_avg = sum(k["v"] for k in before[-6:]) / 6, sum(k["v"] for k in before) / len(before)
        L.append(f"До входа: изменение цены 4ч {chg(4):+.1f}%, 24ч {chg(24):+.1f}%, 72ч {chg(72):+.1f}%. "
                 f"Вход {ar.f(entry, 6)}: от хая 24ч {pct(hi24, entry):+.1f}%, от хая 72ч {pct(hi72, entry):+.1f}%, от лоя 72ч {pct(lo72, entry):+.1f}%. "
                 f"Оборот последних 6ч / средний за 72ч = {vol_last / vol_avg if vol_avg else 0:.1f}x.")
        L.append("Часовые свечи за 24ч до входа (МСК время, O/H/L/C):")
        for k in [k for k in before if k["t"] >= o - 86400]:
            L.append(f"  {datetime.fromtimestamp(k['t'], ar.MSK):%d.%m %H:%M} {k['o']:.6g}/{k['h']:.6g}/{k['l']:.6g}/{k['c']:.6g}")
    if during and entry:
        hi, lo = max(k["h"] for k in during), min(k["l"] for k in during)
        mfe, mae = (pct(entry, hi), -pct(entry, lo)) if side == "LONG" else (-pct(entry, lo), pct(entry, hi))
        L.append(f"Во время сделки ({iv}): макс. ход в плюс (MFE) {mfe:+.1f}%, против (MAE) {mae:+.1f}% от входа.")
    if after and exit_:
        hi, lo = max(k["h"] for k in after), min(k["l"] for k in after)
        last = after[-1]["c"]
        L.append(f"24ч после выхода {ar.f(exit_, 6)}: хай {pct(exit_, hi):+.1f}%, лой {pct(exit_, lo):+.1f}%, через 24ч {pct(exit_, last):+.1f}%.")
    return "\n".join(L) or "свечи MEXC недоступны"


def risk_ctx(cur, tid):
    cur.execute("""SELECT t.leverage, t.margin_used, t.planned_risk_quote, t.liquidation_price,
                          (SELECT array_agg(g.name) FROM trade_tags tt JOIN tags g ON g.id = tt.tag_id WHERE tt.trade_id = t.id)
                   FROM trades t WHERE t.id = %s""", (tid,))
    lev, marg, risk0, liq_px, tags = cur.fetchone()
    tags = tags or []
    seg = next((x for x in tags if x.startswith("риск:")), "сегмент не определён")
    return (f"Плечо {ar.f(lev, 0)}, входная маржа ≈ ${ar.f(risk0)}, вся маржа позиции ≈ ${ar.f(marg)}, "
            f"цена ликвидации {ar.f(liq_px, 6)}. Сегмент (автоаудит): {seg}." + (" Помечена как случайная." if "случайная" in tags else "")
            + f" Все теги: {', '.join(tags) or '—'}")


def shoot(jobs):
    if not jobs:
        return
    jf = JOURNAL / "data" / "logs" / f"shot_jobs_{os.getpid()}.json"
    jf.write_text(json.dumps(jobs))
    p = subprocess.run(["node", str(SHOT), str(jf)], cwd=str(SHOT.parent), capture_output=True, text=True, timeout=60 * len(jobs) + 60)
    log(f"shots: {p.stdout.strip()} {p.stderr.strip()[-300:]}")
    jf.unlink(missing_ok=True)


def save_chart(cur, tid, png):
    buf = png.read_bytes()
    sha = hashlib.sha256(buf).hexdigest()
    key = f"{sha[:2]}/{sha}.png"
    (ATT_DIR / sha[:2]).mkdir(parents=True, exist_ok=True)
    (ATT_DIR / key).write_bytes(buf)
    # один авто-скрин на сделку: прошлые CHART этой сделки скрываем
    cur.execute("UPDATE attachments SET deleted_at = now() WHERE trade_id = %s AND kind = 'CHART' AND deleted_at IS NULL AND sha256 <> %s", (tid, sha))
    cur.execute("SELECT 1 FROM attachments WHERE trade_id = %s AND sha256 = %s AND deleted_at IS NULL", (tid, sha))
    if not cur.fetchone():
        cur.execute(f"""INSERT INTO attachments (id, organization_id, kind, storage_key, mime, size_bytes, sha256, trade_id)
                        VALUES (gen_random_uuid(), {ORG}, 'CHART', %s || '#' || gen_random_uuid(), 'image/png', %s, %s, %s)""",
                    (key, len(buf), sha, tid))
    return ATT_DIR / key


def call_opus(prompt, img_dir):
    tok = Path.home() / ".claude" / "hermes-oauth-token"
    e = dict(os.environ)
    if tok.exists():
        e["CLAUDE_CODE_OAUTH_TOKEN"] = tok.read_text().strip()
    t0 = time.time()
    p = subprocess.run(["claude", "-p", "--model", ar.MODEL, "--output-format", "json", "--tools", "Read", "--allowedTools", "Read",
                        "--add-dir", str(img_dir), "--append-system-prompt", ar.SYSTEM],
                       input=prompt, capture_output=True, text=True, env=e, timeout=900, cwd=str(img_dir))
    ms = int((time.time() - t0) * 1000)
    try:
        d = json.loads(p.stdout)
    except Exception:
        return {"ok": False, "error": (p.stderr or p.stdout)[-800:], "ms": ms}
    u = d.get("usage") or {}
    return {"ok": not d.get("is_error"), "text": d.get("result") or "", "error": d.get("result") if d.get("is_error") else None,
            "ms": ms, "model": next(iter(d.get("modelUsage") or {}), ar.MODEL), "in": u.get("input_tokens"), "out": u.get("output_tokens"),
            "cache": (u.get("cache_read_input_tokens") or 0) + (u.get("cache_creation_input_tokens") or 0), "cost": d.get("total_cost_usd")}


def review_one(tid, png, dry=False):
    with psycopg.connect(os.environ["DATABASE_URL"]) as conn, conn.cursor() as cur:
        job = ar.build_trade(cur, str(tid))
        cur.execute("""SELECT i.base_asset, t.side::text, t.opened_at, t.closed_at, t.entry_avg, t.exit_avg
                       FROM trades t JOIN instruments i ON i.id = t.instrument_id WHERE t.id = %s""", (tid,))
        sym, side, op, cl, ea, xa = cur.fetchone()
        img = save_chart(cur, tid, png) if png and png.exists() and not dry else png
        prompt = (job["ctx"] + "\n\n## Рынок (MEXC, публичные свечи)\n" + market_ctx(sym, side, op, cl, float(ea or 0), float(xa or 0))
                  + "\n\n## Риск\n" + RISK_RULE + "\n" + risk_ctx(cur, tid)
                  + (f"\n\n## Скрин графика\nФайл: {img} — открой его инструментом Read." if img else "\n\n## Скрин графика\nнет")
                  + "\n\n## Задача\n" + DEEP_TASK)
        if dry:
            return {"title": job["title"], "prompt": prompt}
        started = datetime.now(timezone.utc)
        r = call_opus(prompt, ATT_DIR)
        body, fnd = ar.split_json(r.get("text", "")) if r["ok"] else (None, None)
        fnd = dict(fnd or {}, agent=PROMPT_VERSION)
        cur.execute("DELETE FROM ai_reviews WHERE trade_id = %s AND status = 'running'", (tid,))
        cur.execute(f"""INSERT INTO ai_reviews (id, organization_id, user_id, trade_id, kind, status, content_md, findings)
                        VALUES (gen_random_uuid(), {ORG}, (SELECT id FROM users WHERE telegram_user_id = 7098788894), %s, 'trade', %s, %s, %s)
                        RETURNING id""", (tid, "done" if r["ok"] else "failed", body, json.dumps(fnd, ensure_ascii=False)))
        rid = cur.fetchone()[0]
        cur.execute(f"""INSERT INTO llm_calls (id, organization_id, ai_review_id, role, provider, model, billing, prompt_version, prompt_hash,
                          prompt, response, input_tokens, output_tokens, cache_tokens, cost_usd, latency_ms, status, error, started_at)
                        VALUES (gen_random_uuid(), {ORG}, %s, 'post_trade_review', 'anthropic', %s, 'SUBSCRIPTION', %s, %s, %s, %s, %s, %s, %s, %s, %s,
                                %s, %s, %s)""",
                    (rid, r.get("model", ar.MODEL), PROMPT_VERSION, hashlib.sha256(prompt.encode()).hexdigest()[:16], ar.SYSTEM + "\n\n" + prompt,
                     r.get("text"), r.get("in"), r.get("out"), r.get("cache"), r.get("cost"), r["ms"], "ok" if r["ok"] else "error",
                     r.get("error"), started))
        conn.commit()
        log(f"{job['title']} {'ok' if r['ok'] else 'FAIL ' + str(r.get('error'))[:200]} {r['ms']}ms")
        return {"title": job["title"], "ok": r["ok"], "ms": r["ms"], "findings": fnd}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--trade")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--limit", type=int, default=0)
    a = ap.parse_args()
    ar.env()
    with psycopg.connect(os.environ["DATABASE_URL"]) as conn, conn.cursor() as cur:
        base = """WITH o AS (SELECT id, row_number() OVER (ORDER BY opened_at) AS n FROM trades WHERE deleted_at IS NULL)
                  SELECT t.id, o.n FROM trades t JOIN o ON o.id = t.id WHERE t.status = 'CLOSED' """
        if a.trade:
            if a.trade.startswith("#"):
                cur.execute(base + "AND o.n = %s", (int(a.trade[1:]),))
            else:
                cur.execute(base + "AND t.id = %s", (a.trade,))
        else:
            cur.execute(base + ("" if a.force else """AND NOT EXISTS (SELECT 1 FROM ai_reviews r WHERE r.trade_id = t.id AND r.status = 'done'
                                                          AND r.findings->>'agent' IS NOT NULL)""") + " ORDER BY o.n")
        todo = cur.fetchall()
    if a.limit:
        todo = todo[:a.limit]
    if not todo:
        print(json.dumps({"todo": 0}))
        return
    shots_dir = JOURNAL / "data" / "logs" / "shots"
    shots_dir.mkdir(parents=True, exist_ok=True)
    pngs = {tid: shots_dir / f"{tid}.png" for tid, _ in todo}
    shoot([{"id": str(tid), "out": str(p)} for tid, p in pngs.items()])
    if a.dry_run:
        r = review_one(todo[0][0], pngs[todo[0][0]], dry=True)
        print(r["prompt"])
        print(f"\n[dry-run] {len(todo)} сделок в очереди, скринов {sum(p.exists() for p in pngs.values())}")
        return
    done, fail = 0, []
    with ThreadPoolExecutor(max_workers=max(1, a.workers)) as ex:
        futs = {ex.submit(review_one, tid, pngs[tid]): n for tid, n in todo}
        for fu in as_completed(futs):
            try:
                r = fu.result()
                done += r["ok"]
                if not r["ok"]:
                    fail.append(futs[fu])
            except Exception as e:
                fail.append(futs[fu])
                log(f"#{futs[fu]} EXC {e}")
    for p in pngs.values():
        p.unlink(missing_ok=True)
    print(json.dumps({"todo": len(todo), "done": done, "failed": sorted(fail)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
