#!/usr/bin/env python3
"""Разбирает сырые ответы XMLRiver (Яндекс) в две UTF-8 таблицы.

Нужен, когда сборщик GEO-рантайма собрал и оплатил выдачу, но отказался
записать итоговую таблицу (ложное срабатывание проверки кодировки). Сырые
ответы лежат в артефакте прогона: пары `<id>.request.json` + `<id>.xml`.

Запуск:
    python tools/seo/parse_xmlriver_serp.py <папка-с-raw> <куда-папка> [--failed <файл>]

Пишет:
    serp.csv  — query, position, url, domain, title, snippet
    ai.csv    — query, ai_text, cited_urls (ответ Нейро/Алисы над выдачей)
    --failed  — запросы, на которые XMLRiver вернул ошибку (для досбора)
"""
import base64
import csv
import glob
import html
import json
import os
import re
import sys
from urllib.parse import urlparse
from xml.etree import ElementTree


def domain_of(url: str) -> str:
    host = urlparse(url).netloc.lower()
    return host[4:] if host.startswith("www.") else host


def ai_text_and_links(encoded: str) -> tuple[str, list[str]]:
    raw = base64.b64decode(encoded).decode("utf-8", errors="replace")
    links = re.findall(r'href="(https?://[^"]+)"', raw)
    text = html.unescape(re.sub(r"<[^>]+>", " ", raw))
    return re.sub(r"\s+", " ", text).strip(), list(dict.fromkeys(links))


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__)
        return 2
    src, out = sys.argv[1], sys.argv[2]
    failed_path = sys.argv[sys.argv.index("--failed") + 1] if "--failed" in sys.argv else None
    os.makedirs(out, exist_ok=True)

    serp_rows, ai_rows, failed = [], [], []
    for req_path in sorted(glob.glob(os.path.join(src, "**", "*.request.json"), recursive=True)):
        query = json.load(open(req_path, encoding="utf-8"))["query"]
        xml_path = req_path.replace(".request.json", ".xml")
        if not os.path.exists(xml_path):
            failed.append(query)
            continue
        root = ElementTree.parse(xml_path).getroot()
        error = root.find(".//error")
        if error is not None:
            if error.get("code") != "15":  # 15 — у Яндекса нет результатов, повтор бесполезен
                failed.append(query)
            continue
        for position, doc in enumerate(root.iter("doc"), start=1):
            url = doc.findtext("url", "")
            serp_rows.append({
                "query": query,
                "position": position,
                "url": url,
                "domain": domain_of(url),
                "title": doc.findtext("title", ""),
                "snippet": " ".join(p.text or "" for p in doc.iter("passage")),
            })
        for item in root.iter("item"):
            content = item.findtext("content")
            if content:
                text, links = ai_text_and_links(content)
                ai_rows.append({"query": query, "ai_text": text, "cited_urls": " ".join(links)})

    with open(os.path.join(out, "serp.csv"), "w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=["query", "position", "url", "domain", "title", "snippet"])
        writer.writeheader()
        writer.writerows(serp_rows)
    with open(os.path.join(out, "ai.csv"), "w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=["query", "ai_text", "cited_urls"])
        writer.writeheader()
        writer.writerows(ai_rows)
    if failed_path:
        with open(failed_path, "w", encoding="utf-8") as fh:
            fh.write("\n".join(failed) + ("\n" if failed else ""))

    queries = len({r["query"] for r in serp_rows})
    print(f"Выдача: {queries} запросов, {len(serp_rows)} строк. ИИ-ответов: {len(ai_rows)}. Ошибок к досбору: {len(failed)}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
