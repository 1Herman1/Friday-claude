"""One-shot public market-data collection; never loads keys or sends orders."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from decimal import Decimal as D
import html
import json
from pathlib import Path
import time
import urllib.request

ROOT = Path(__file__).resolve().parent
BING = "https://open-api.bingx.com"
BIT = "https://api.bitget.com"


def fetch_public(url):
    from probe import loads
    if not url.startswith((BING + "/openApi/swap/v2/quote/", BIT + "/api/v3/market/")):
        raise ValueError("non-public URL forbidden")
    start = time.time_ns() // 1000000
    r = {"url": url, "started_ms": start, "raw": None, "error": None}
    try:
        request = urllib.request.Request(url, headers={"User-Agent": "readonly-feasibility-probe/1"})
        with urllib.request.urlopen(request, timeout=20) as response:
            r["http_status"] = response.status
            r["server_date"] = response.headers.get("Date")
            r["raw"] = loads(response.read().decode())
        if str(r["raw"].get("code")) not in ("0", "00000"):
            r["error"] = "API error: " + str(r["raw"].get("msg"))
    except Exception as exc:
        r["error"] = type(exc).__name__ + ": " + str(exc)
    r["received_ms"] = time.time_ns() // 1000000
    r["rtt_ms"] = r["received_ms"] - start
    return r


def run_probe(fetch, quantities, fees, now_ms=None):
    from probe import book, compare, funding
    requests, errors = {}, []
    def collect(tasks):
        with ThreadPoolExecutor(max_workers=4) as pool:
            results = list(pool.map(fetch, [url for key, url in tasks]))
        for (key, url), result in zip(tasks, results):
            requests[key] = result
            if result.get("error"):
                errors.append({"request": key, "error": result["error"]})
    collect([("bingx_contracts", BING + "/openApi/swap/v2/quote/contracts")] + [
        (base + "_bitget_contract", BIT + "/api/v3/market/instruments?category=USDT-FUTURES&symbol=" + base + "USDT") for base in quantities])
    collect([(base + "_" + venue + "_funding", url) for base in quantities for venue, url in [
        ("bingx", BING + "/openApi/swap/v2/quote/premiumIndex?symbol=" + base + "-USDT"),
        ("bitget", BIT + "/api/v3/market/current-fund-rate?category=USDT-FUTURES&symbol=" + base + "USDT")]])
    # Books last, in parallel: metadata/funding latency must not age them.
    for index, base in enumerate(quantities):
        if index:
            # BingX depth is 1 request/s/IP. Pair venues concurrently, symbols sequentially.
            time.sleep(1.05)
        collect([(base + "_" + venue + "_book", url) for venue, url in [
            ("bingx", BING + "/openApi/swap/v2/quote/depth?symbol=" + base + "-USDT&limit=20"),
            ("bitget", BIT + "/api/v3/market/orderbook?category=USDT-FUTURES&symbol=" + base + "USDT&limit=50")]])
    now = now_ms if now_ms is not None else time.time_ns() // 1000000
    instruments = []
    for base, quantity in quantities.items():
        item = {"instrument": base + "/USDT:USDT PERPETUAL", "quantity_base": quantity,
                "identity_verified": False, "identity_errors": [], "books": {}, "funding": {}, "comparisons": []}
        try:
            bc, gc = requests["bingx_contracts"], requests[base + "_bitget_contract"]
            if bc.get("error") or gc.get("error"):
                raise ValueError("contract metadata unavailable")
            b = next(x for x in bc["raw"]["data"] if x["symbol"] == base + "-USDT")
            g = next(x for x in gc["raw"]["data"] if x["symbol"] == base + "USDT")
            if not (b["asset"] == base and b["currency"] == "USDT" and int(b["status"]) == 1
                    and g["baseCoin"] == base and g["quoteCoin"] == "USDT"
                    and g["category"] == "USDT-FUTURES" and g["type"] == "perpetual" and g["status"] == "online"):
                raise ValueError("instrument identity/status mismatch")
            item["identity_verified"] = True
            item["metadata"] = {"bingx": b, "bitget": g}
            item["identity_note"] = "BingX swap USDT perpetual namespace + asset/currency; Bitget explicit perpetual type/category. Not spot."
            bstep, gstep = D(1).scaleb(-int(b["quantityPrecision"])), D(g["quantityMultiplier"])
            item["lot_constraints_satisfied"] = (quantity % bstep == 0 and quantity % gstep == 0
                and quantity >= D(str(b["tradeMinQuantity"])) and quantity >= D(g["minOrderQty"]))
        except Exception as exc:
            item["identity_errors"].append(str(exc))
        for venue in ("bingx", "bitget"):
            br = requests[base + "_" + venue + "_book"]
            if not br.get("error"):
                try:
                    item["books"][venue] = book(venue, br["raw"])
                    item["books"][venue].update(received_ms=br["received_ms"], rtt_ms=br.get("rtt_ms"))
                except Exception as exc:
                    errors.append({"request": base + "_" + venue + "_book", "error": str(exc)})
            fr = requests[base + "_" + venue + "_funding"]
            if not fr.get("error"):
                try:
                    d = fr["raw"]["data"]
                    if venue == "bitget":
                        d = d[0]
                        rate, interval, next_ts = D(d["fundingRate"]), d.get("fundingRateInterval"), d.get("nextUpdate")
                        field = "fundingRate"
                    else:
                        rate, interval, next_ts = D(d["lastFundingRate"]), d.get("fundingIntervalHours"), d.get("nextFundingTime")
                        field = "lastFundingRate"
                    f = funding(rate, interval)
                    f.update(next_time_ms=int(next_ts) if next_ts else None,
                             next_time_semantics=("funding_rate_next_update_not_guaranteed_settlement" if venue == "bitget" else "next_funding_settlement"),
                             source_field=field, received_ms=fr["received_ms"], source_update_ms=d.get("updateTime"),
                             source_age_ms=now-int(d["updateTime"]) if d.get("updateTime") else None,
                             interval_source_field="fundingRateInterval" if venue == "bitget" else "fundingIntervalHours",
                             warning="Rate semantics/timing may differ; not added to entry spread or promised payment.")
                    item["funding"][venue] = f
                except Exception as exc:
                    errors.append({"request": base + "_" + venue + "_funding", "error": str(exc)})
        if item["identity_verified"] and len(item["books"]) == 2:
            for buy, sell in (("bingx", "bitget"), ("bitget", "bingx")):
                c = compare(item["books"][buy], item["books"][sell], quantity, now, fees.get(buy), fees.get(sell))
                c.update(buy_venue=buy, sell_venue=sell)
                if not item["lot_constraints_satisfied"]:
                    c["blockers"].append("LOT_CONSTRAINTS")
                fb, fs = item["funding"].get(buy, {}), item["funding"].get(sell, {})
                c["indicative_funding_short_minus_long_per_hour"] = (
                    fs["rate_per_hour"]-fb["rate_per_hour"]
                    if fb.get("rate_per_hour") is not None and fs.get("rate_per_hour") is not None else None)
                c["blockers"].append("FUNDING_NOT_LOCKED_OR_TIME_ALIGNED")
                item["comparisons"].append(c)
        instruments.append(item)
    return {"schema_version": 1, "status": "HOLD", "read_only": True,
            "generated_at_utc": datetime.fromtimestamp(now/1000, timezone.utc).isoformat(),
            "evaluated_at_ms": now, "fee_rates_explicit_user_input": fees,
            "policy": {"max_book_age_ms": 5000, "max_book_skew_ms": 1000, "future_clock_tolerance_ms": 1000, "execution_enabled": False},
            "warning": "Индикативный снимок, НЕ исполнимый сигнал прибыли. Закрытие, basis, margin, liquidation, leg risk не оценены. Комиссии неизвестны => HOLD.",
            "instruments": instruments, "errors": errors, "requests": requests}


def write_outputs(report):
    text = json.dumps(report, ensure_ascii=False, indent=2, default=str)
    (ROOT / "report.json").write_text(text + "\n", encoding="utf-8")
    rows = []
    for item in report["instruments"]:
        for c in item["comparisons"]:
            cells = (item["instrument"], c["buy_venue"]+" → "+c["sell_venue"], c.get("buy_vwap"),
                     c.get("sell_vwap"), c.get("depth_spread_bps"), ", ".join(c["blockers"]))
            rows.append("<tr>" + "".join("<td>"+html.escape(str(v))+"</td>" for v in cells) + "</tr>")
    page = '<!doctype html><html lang="ru"><meta charset="utf-8"><title>Арбитраж — READ ONLY</title><style>body{font:15px system-ui;margin:32px;background:#121826;color:#eee}td,th{padding:10px;border:1px solid #596273}table{border-collapse:collapse}pre{white-space:pre-wrap}strong{color:#ffcc66}</style><h1>Арбитраж: индикативный снимок</h1><p><strong>HOLD — не сигнал для торговли и не доказательство прибыли.</strong></p><p>' + html.escape(report["generated_at_utc"]) + '</p><p>Покупка по ask, продажа по bid, VWAP по глубине. Две ноги требуют заранее размещённой маржи на обеих биржах, а не последовательного перевода. Возможны неполное исполнение и незахеджированная нога. Закрытие позиций, ликвидация, funding и basis не гарантированы.</p><table><tr><th>Контракт</th><th>Покупка → продажа</th><th>Ask VWAP</th><th>Bid VWAP</th><th>Спред bps</th><th>Блокировки</th></tr>' + ''.join(rows) + '</table><h2>Ошибки запросов</h2><pre>' + html.escape(json.dumps(report["errors"], ensure_ascii=False, indent=2)) + '</pre><details><summary>Полные данные и timestamps</summary><pre>' + html.escape(text) + '</pre></details></html>'
    (ROOT / "report.html").write_text(page, encoding="utf-8")


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--bingx-fee", type=D, default=None, help="Explicit account taker fee fraction; omitted = unknown/HOLD")
    p.add_argument("--bitget-fee", type=D, default=None, help="Explicit account taker fee fraction; omitted = unknown/HOLD")
    p.add_argument("--btc-qty", type=D, default=D("0.01"))
    p.add_argument("--eth-qty", type=D, default=D("0.1"))
    a = p.parse_args()
    fees = {"bingx": a.bingx_fee, "bitget": a.bitget_fee}
    if any(f is not None and (not f.is_finite() or f < 0 or f >= 1) for f in fees.values()):
        p.error("fees must be finite fractions >= 0 and < 1")
    quantities = {"BTC": a.btc_qty, "ETH": a.eth_qty}
    if any(not q.is_finite() or q <= 0 for q in quantities.values()):
        p.error("quantity must be positive and finite")
    report = run_probe(fetch_public, quantities, fees)
    write_outputs(report)
    print(json.dumps({"status": report["status"], "instruments": len(report["instruments"]),
                      "comparisons": sum(len(i["comparisons"]) for i in report["instruments"]),
                      "request_errors": len(report["errors"]), "report": str(ROOT / "report.json")}, ensure_ascii=False))


if __name__ == "__main__":
    main()
