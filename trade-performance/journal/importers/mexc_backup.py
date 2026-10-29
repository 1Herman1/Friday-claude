"""Полный бэкап аккаунта MEXC Futures (только чтение) → journal/data/backup/mexc_<дата>/*.json

Сохраняет всё, что отдаёт приватный API: история позиций, сделки (order_deals) окнами по 7 дней за 365 дней,
история ордеров, фандинг, открытые позиции, активы, стоп-ордера, лог переводов. Каждый эндпоинт — отдельный файл,
ошибка одного не останавливает остальные.
"""
import json, sys, time
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import mexc_api_sync as m  # noqa: E402

OUT = m.ROOT / "journal" / "data" / "backup" / f"mexc_{datetime.now():%Y%m%d_%H%M}"
DAY = 86400_000


def paged(path, params, key=None, size=100, max_pages=200):
    out = []
    for page in range(1, max_pages + 1):
        d = m.private(path, {**params, "page_num": page, "page_size": size})
        rows = d.get(key, []) if key else d
        out += rows or []
        if key and page >= d.get("totalPage", page):
            break
        if not key and len(rows or []) < size:
            break
        time.sleep(0.25)
    return out


def windows(path, days=365, step=7, size=100):
    end = int(time.time() * 1000)
    out = []
    for a in range(end - days * DAY, end, step * DAY):
        out += paged(path, {"start_time": a, "end_time": min(a + step * DAY, end)}, size=size)
    return out


JOBS = {
    "history_positions": lambda: paged("/api/v1/private/position/list/history_positions", {}),
    "order_deals": lambda: windows("/api/v1/private/order/list/order_deals"),
    "history_orders": lambda: windows("/api/v1/private/order/list/history_orders"),
    "funding_records": lambda: paged("/api/v1/private/position/funding_records", {}, key="resultList"),
    "open_positions": lambda: m.private("/api/v1/private/position/open_positions", {}),
    "open_orders": lambda: m.private("/api/v1/private/order/list/open_orders", {}),
    "stop_orders": lambda: paged("/api/v1/private/stoporder/list/orders", {}),
    "assets": lambda: m.private("/api/v1/private/account/assets", {}),
    "transfer_record": lambda: paged("/api/v1/private/account/transfer_record", {}, key="resultList"),
}


def main():
    m.load_env()
    OUT.mkdir(parents=True, exist_ok=True)
    rep = {}
    for name, fn in JOBS.items():
        try:
            data = fn()
            (OUT / f"{name}.json").write_text(json.dumps(data, ensure_ascii=False, indent=1))
            rep[name] = len(data) if isinstance(data, list) else "ok"
        except Exception as e:  # noqa: BLE001
            rep[name] = f"ERR {str(e)[:120]}"
    (OUT / "_report.json").write_text(json.dumps(rep, ensure_ascii=False, indent=1))
    print(json.dumps({"dir": str(OUT), **rep}, ensure_ascii=False))


if __name__ == "__main__":
    main()
