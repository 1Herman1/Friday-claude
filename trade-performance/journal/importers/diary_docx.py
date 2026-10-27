"""Импорт рукописного дневника (DOCX) в сделки.

Каждая запись «N/ДД.ММ ±» → заметка-разбор (по полочкам) на все сделки этой монеты из записи,
скрины из записи → attachments SCREENSHOT (+ note_id), пустые entry_reason/emotion_* заполняются.

  python diary_docx.py <file.docx> [--dry-run]
Повторный запуск идемпотентен (заметка ищется по parsed->>'diary_entry', скрины по sha256).
"""
import hashlib, json, os, re, sys, zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from xml.etree import ElementTree as ET

import psycopg

ROOT = Path(__file__).resolve().parents[1]
ATT = ROOT / "data" / "attachments"
MSK = timezone(timedelta(hours=3))
W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
ALIAS = {"SNAPX": "XNAP", "GRIFFIAN": "GRIFFAIN", "JELLY": "JELLYJELLY", "ARC": "ARCSOL"}
HDR = re.compile(r"^\s*(\d+(?:\s*[-–]\s*\d+)?)\s*/\s*(\d{1,2}\.\d{2})\s*(.*)$")
# полки: ключ → регэксп заголовка раздела в тексте Германа
SHELVES = [
    ("time", "Время и таймфреймы", r"^Временной диапазон"),
    ("reasons", "Причины входа", r"^Причины входа|^Вход в шорт|^Вход в лонг"),
    ("outcome", "План и исход", r"^Исход сделки"),
    ("state", "Состояние", r"^Мо[её] состояние"),
    ("strengths", "Сильные стороны", r"^Сильные стороны"),
    ("mistakes", "Ошибки и вопросы", r"^Ошибки|^Анализ Post Factum"),
    ("rules", "Итог и правило на будущее", r"^Итоги?\s+правило|^Вывод|^Post factum"),
]


def env():
    for ln in (ROOT.parent / ".env").read_text().splitlines():
        if "=" in ln and not ln.lstrip().startswith("#"):
            k, v = ln.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"'))


def parse(path):
    z = zipfile.ZipFile(path)
    rels = {r.get("Id"): r.get("Target") for r in ET.fromstring(z.read("word/_rels/document.xml.rels"))}
    body = ET.fromstring(z.read("word/document.xml")).find(W + "body")
    out, cur = [], None
    for p in body.iter(W + "p"):
        t = "".join(x.text or "" for x in p.iter(W + "t"))
        imgs = [rels.get(b.get(R + "embed")) for b in p.iter(A + "blip")]
        m = HDR.match(t)
        if m and len(t) < 40:
            cur = {"hdr": t.strip(), "no": m.group(1).replace(" ", ""), "dm": m.group(2), "mark": m.group(3).strip(), "lines": [], "imgs": []}
            out.append(cur)
            continue
        if cur is None:
            continue
        if t.strip():
            cur["lines"].append(t.rstrip())
        cur["imgs"] += [(i, "word/" + i) for i in imgs if i]
    for e in out:
        txt = "\n".join(e["lines"])
        a = re.search(r"Актив:\s*([^|\n]+)", txt)
        d = re.search(r"Дата:\s*(\d{2})\.(\d{2})\.(\d{4})", txt)
        e["asset"] = ALIAS.get(a.group(1).strip().upper(), a.group(1).strip().upper()) if a else None
        e["date"] = datetime(int(d.group(3)), int(d.group(2)), int(d.group(1)), tzinfo=MSK) if d else None
        side = re.search(r"Направление:\s*(\w+)", txt)
        e["side"] = side.group(1).upper() if side else None
        e["shelves"] = shelve(e["lines"])
        e["imgs"] = [z.read(p) for _, p in e["imgs"]]
    return out


def shelve(lines):
    res, key = {"head": []}, "head"
    for ln in lines:
        s = ln.strip().lstrip("·•\t ")
        for k, _, rx in SHELVES:
            if re.match(rx, s, re.I):
                key = k
                break
        res.setdefault(key, []).append(ln.strip())
    return {k: "\n".join(v).strip() for k, v in res.items() if "\n".join(v).strip()}


def to_md(e):
    parts = [f"**Дневник №{e['no']}** · {e['hdr']}"]
    head = e["shelves"].get("head")
    if head:
        parts.append(head)
    for k, title, rx in SHELVES:
        if e["shelves"].get(k):
            first, _, rest = e["shelves"][k].partition("\n")
            f0 = first.strip().lstrip("·•\t ")
            # строка-заголовок раздела убирается, если в ней нет содержания
            body = rest.strip() if re.match(rx, f0, re.I) and len(f0.rstrip(": ")) <= 40 and rest.strip() else e["shelves"][k]
            parts.append(f"### {title}\n{body}")
    return "\n\n".join(parts)


def match(c, e):
    """все сделки монеты, открытые в окне записи (дата записи … +5 дней, до следующей записи по этой монете)"""
    if not e["asset"] or not e["date"]:
        return []
    return c.execute("""
        WITH o AS (SELECT id, row_number() OVER (ORDER BY opened_at) n FROM trades WHERE deleted_at IS NULL)
        SELECT t.id, o.n FROM trades t JOIN o ON o.id = t.id JOIN instruments i ON i.id = t.instrument_id
        WHERE i.base_asset = %s AND t.opened_at >= %s AND t.opened_at < %s ORDER BY t.opened_at""",
        (e["asset"], e["date"] - timedelta(hours=3), e["window_end"])).fetchall()


def last_entry(e):
    """последнее время входа из строки «Время входа» (дата берётся из скобок «(ДД.ММ)»)"""
    ln = next((x for x in reversed(e["lines"]) if "Время входа" in x), "")
    dates = [tuple(map(int, d)) for d in re.findall(r"\((\d{1,2})[.:](\d{2})\)", ln)]
    times = re.findall(r"(\d{1,2}):(\d{2})(?!\))", ln)
    if not times or not e["date"]:
        return None
    dd, mm = max(dates, key=lambda x: (x[1], x[0])) if dates else (e["date"].day, e["date"].month)
    h, mi = map(int, times[-1])
    return datetime(e["date"].year, mm, dd, h, mi, tzinfo=MSK) + timedelta(minutes=30)


def main():
    env()
    path, dry = sys.argv[1], "--dry-run" in sys.argv
    ents = parse(path)
    # окно записи заканчивается следующей записью по той же монете
    for i, e in enumerate(ents):
        nxt = [x["date"] for x in ents[i + 1:] if x["asset"] == e["asset"] and x["date"] and e["date"] and x["date"] > e["date"]]
        e["window_end"] = (min(nxt) if nxt else e["date"] + timedelta(days=5)) if e["date"] else None
    rep = []
    with psycopg.connect(os.environ["DATABASE_URL"]) as c:
        org, uid = c.execute("SELECT t.organization_id, n.user_id FROM trades t, notes n ORDER BY n.created_at LIMIT 1").fetchone()
        for e in ents:
            le = last_entry(e)
            full = e["window_end"]
            if le and le < full:
                e["window_end"] = le
            tr = match(c, e)
            if not tr:  # время в записи скопировано с другой сделки → берём сутки записи
                e["window_end"] = min(full, e["date"] + timedelta(days=1))
                tr = match(c, e)
            rep.append({"entry": e["no"], "asset": e["asset"], "trades": [f"#{n}" for _, n in tr], "shots": len(e["imgs"])})
            if dry or not tr:
                continue
            md = to_md(e)
            for tid, n in tr:
                row = c.execute("SELECT id FROM notes WHERE trade_id=%s AND parsed->>'diary_entry'=%s AND deleted_at IS NULL", (tid, e["no"])).fetchone()
                parsed = json.dumps({"diary_entry": e["no"], "source": "diary_docx", "shelves": e["shelves"], "trades": rep[-1]["trades"]}, ensure_ascii=False)
                if row:
                    nid = row[0]
                    c.execute("UPDATE notes SET text=%s, parsed=%s, updated_at=now() WHERE id=%s", (md, parsed, nid))
                else:
                    nid = c.execute("""INSERT INTO notes (id, organization_id, user_id, trade_id, day_date, kind, channel, text, parsed, parse_status, created_at, updated_at)
                        VALUES (gen_random_uuid(), %s, %s, %s, %s, 'TEXT', 'SYSTEM', %s, %s, 'diary', %s, now()) RETURNING id""",
                        (org, uid, tid, e["date"].date(), md, parsed, e["date"])).fetchone()[0]
                sh = e["shelves"]
                c.execute("""UPDATE trades SET entry_reason = COALESCE(NULLIF(entry_reason,''), %s),
                    emotion_before = COALESCE(NULLIF(emotion_before,''), %s) WHERE id=%s""",
                    (sh.get("reasons"), sh.get("state", "")[:2000] or None, tid))
                for b in e["imgs"]:
                    sha = hashlib.sha256(b).hexdigest()
                    key = f"{sha[:2]}/{sha}.png"
                    (ATT / sha[:2]).mkdir(parents=True, exist_ok=True)
                    (ATT / key).write_bytes(b)
                    if not c.execute("SELECT 1 FROM attachments WHERE sha256=%s AND trade_id=%s AND deleted_at IS NULL", (sha, tid)).fetchone():
                        c.execute("""INSERT INTO attachments (id, organization_id, kind, storage_key, mime, size_bytes, sha256, trade_id, note_id, uploaded_by_id, created_at)
                            VALUES (gen_random_uuid(), %s, 'SCREENSHOT', %s || '#' || gen_random_uuid(), 'image/png', %s, %s, %s, %s, %s, %s)""",
                            (org, key, len(b), sha, tid, nid, uid, e["date"]))
        if not dry:
            c.commit()
    print(json.dumps(rep, ensure_ascii=False))


if __name__ == "__main__":
    main()
