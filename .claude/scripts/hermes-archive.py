#!/usr/bin/env python3
"""Архиватор Hermes-сессий (Telegram) → docs/archive/sessions/.

Аналог archive-session.sh для Claude Code, но источник — база Hermes (~/.hermes/state.db).
Собирает сухой остаток без LLM: реплики Германа, итоговые ответы ассистента (обрезанные),
изменённые файлы, коммиты. Инкрементально: последний обработанный id сообщения хранится
в .claude/.archive-state/hermes.json (вне git). Секреты маскируются — архив уходит в git.

Один файл на день и топик: docs/archive/sessions/YYYY-MM-DD--hermes-<чат>-<топик>.md, status: raw.
Суждение (свод в CONTEXT.md) добавляет агент archivarius.

Запуск: python3 .claude/scripts/hermes-archive.py   (печатает сводку; ничего — если нового нет)
"""
import json
import os
import re
import sqlite3
import sys
from datetime import datetime

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB = os.path.expanduser(os.environ.get("HERMES_HOME", "~/.hermes")) + "/state.db"
OUT = os.path.join(REPO, "docs", "archive", "sessions")
STATE = os.path.join(REPO, ".claude", ".archive-state", "hermes.json")
TOPICS = os.path.join(REPO, "docs", "hermes", "topics.json")

REPLY_LIMIT = 700  # символов итогового ответа в сырой записи

SECRET_RE = re.compile(
    r"(sk-[A-Za-z0-9_\-]{16,}|sk-ant-[A-Za-z0-9_\-]{16,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}"
    r"|xox[abpr]-[A-Za-z0-9\-]{10,}|AKIA[0-9A-Z]{16}|\b\d{8,10}:[A-Za-z0-9_\-]{30,}\b"
    r"|-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----"
    r"|(?i:(?:api[_-]?key|token|secret|password|passwd)\s*[:=]\s*)\S{8,})"
)


def mask(s):
    return SECRET_RE.sub("[СКРЫТО]", s or "")


def slug(s):
    s = re.sub(r"[^\w\-]+", "-", (s or "").lower(), flags=re.U).strip("-")
    return s[:40] or "chat"


def load_json(path, default):
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return default


def main():
    if not os.path.exists(DB):
        return
    topics = load_json(TOPICS, {})
    state = load_json(STATE, {"last_id": 0})
    con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    con.row_factory = sqlite3.Row
    rows = con.execute(
        """select m.id, m.role, m.content, m.tool_calls, m.tool_name, m.finish_reason, m.timestamp,
                  s.id sid, s.chat_id, s.thread_id, s.display_name, s.title
           from messages m join sessions s on s.id = m.session_id
           where m.id > ? and s.source = 'telegram'
           order by m.id""",
        (state["last_id"],),
    ).fetchall()
    if not rows:
        return

    groups = {}  # (date, chat, thread) -> list of entries
    last_id = state["last_id"]
    for r in rows:
        last_id = max(last_id, r["id"])
        day = datetime.fromtimestamp(r["timestamp"]).strftime("%Y-%m-%d")
        key = (day, r["chat_id"] or "", r["thread_id"] or "")
        g = groups.setdefault(key, {"name": r["display_name"], "title": r["title"], "items": [],
                                    "files": set(), "commits": [], "sessions": set()})
        g["sessions"].add(r["sid"])
        t = datetime.fromtimestamp(r["timestamp"]).strftime("%H:%M")
        if r["role"] == "user" and r["content"]:
            text = re.sub(r"^\[[^\]]{1,60}\]\s*", "", r["content"].strip())
            if text.startswith("[OUT-OF-BAND"):
                text = re.sub(r"\[/?OUT-OF-BAND[^\]]*\]", "", text).strip()
            g["items"].append(("Просил", t, mask(text)))
        elif r["role"] == "assistant":
            for tc in json.loads(r["tool_calls"] or "[]"):
                fn = (tc.get("function") or {})
                name = fn.get("name", "")
                try:
                    args = json.loads(fn.get("arguments") or "{}")
                except Exception:
                    args = {}
                if name in ("write_file", "patch", "mcp__write_file", "mcp__patch") and args.get("path"):
                    g["files"].add(args["path"].replace(os.path.expanduser("~"), "~"))
                if name.endswith("terminal") and "git commit" in (args.get("command") or ""):
                    m = re.search(r"-q?m\s+\"([^\"]+)\"", args["command"])
                    if m:
                        g["commits"].append(m.group(1))
            if r["content"] and r["finish_reason"] in ("stop", "end_turn", None) and not r["tool_calls"]:
                text = r["content"].strip()
                if len(text) > REPLY_LIMIT:
                    text = text[:REPLY_LIMIT].rsplit(" ", 1)[0] + " …"
                g["items"].append(("Ответ", t, mask(text)))

    os.makedirs(OUT, exist_ok=True)
    written = []
    for (day, chat, thread), g in sorted(groups.items()):
        if not g["items"] and not g["files"]:
            continue
        tkey = f"{chat}:{thread}" if thread else chat
        tname = topics.get(tkey, {}).get("name") or g["title"] or (f"topic {thread}" if thread else "")
        chat_name = topics.get(chat, {}).get("name") or g["name"] or chat
        cslug = topics.get(chat, {}).get("slug") or slug(chat_name)
        fname = f"{day}--hermes-{cslug}" + (f"-t{thread}" if thread else "") + ".md"
        path = os.path.join(OUT, fname)
        body = []
        if not os.path.exists(path):
            body.append("---\n")
            body.append(f"session: hermes:{tkey}\ndate: {day}\nsource: hermes-telegram\n")
            body.append(f"chat: {chat_name}\ntopic: {tname}\nstatus: raw\n---\n\n")
            body.append(f"# Hermes · {chat_name}" + (f" / {tname}" if tname else "") + f" · {day}\n")
        else:
            txt = open(path).read()
            if "status: digested" in txt:  # новое поверх свёрнутого — снова в очередь архивариусу
                with open(path, "w") as f:
                    f.write(txt.replace("status: digested", "status: raw", 1))
        first_t = g["items"][0][1] if g["items"] else ""
        body.append(f"\n## Фрагмент ({first_t})\n")
        for kind, t, text in g["items"]:
            text = text.replace("\n", "\n  ")
            body.append(f"\n**{kind}** {t}:\n  {text}\n")
        if g["files"]:
            body.append("\n### Изменённые файлы\n" + "".join(f"- `{p}`\n" for p in sorted(g["files"])))
        if g["commits"]:
            body.append("\n### Коммиты\n" + "".join(f"- {c}\n" for c in g["commits"]))
        with open(path, "a") as f:
            f.write("".join(body))
        written.append(fname)

    os.makedirs(os.path.dirname(STATE), exist_ok=True)
    with open(STATE, "w") as f:
        json.dump({"last_id": last_id, "updated": datetime.now().isoformat(timespec="seconds")}, f)
    if written:
        print("hermes-archive: " + ", ".join(written))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # архиватор не должен шуметь в чат при сбое — пишем в stderr
        print(f"hermes-archive error: {e}", file=sys.stderr)
        sys.exit(0)
