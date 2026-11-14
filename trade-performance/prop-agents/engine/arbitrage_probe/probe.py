"""Public-data-only snapshot. No private endpoints, credentials or orders."""
from decimal import Decimal as D
import json
from runner import run_probe


def loads(text):
    return json.loads(text, parse_float=D)


def book(venue, raw):
    if str(raw.get("code")) not in ("0", "00000"):
        raise ValueError("API error: " + str(raw))
    data = raw["data"]
    if venue == "bitget":
        asks, bids, ts = data["a"], data["b"], data["ts"]
    else:
        # Coin arrays explicitly denote base-asset quantity; never assume contracts.
        asks, bids, ts = data["asksCoin"], data["bidsCoin"], data["T"]
    asks = [[D(str(p)), D(str(q))] for p, q in asks]
    bids = [[D(str(p)), D(str(q))] for p, q in bids]
    if any(not p.is_finite() or not q.is_finite() or p <= 0 or q < 0 for p, q in asks+bids):
        raise ValueError("invalid depth")
    asks.sort(key=lambda x: x[0])
    bids.sort(key=lambda x: x[0], reverse=True)
    return {"asks": asks, "bids": bids, "ts": int(ts), "quantity_unit": "base_coin"}


def funding(rate, interval_hours):
    if not rate.is_finite():
        raise ValueError("invalid funding rate")
    interval = D(str(interval_hours)) if interval_hours is not None else None
    known = interval is not None and interval.is_finite() and interval > 0
    return {"raw_rate": rate, "interval_hours": interval if known else None,
            "rate_per_hour": rate / interval if known else None,
            "semantics": "indicative_rate_not_guaranteed_cashflow"}


def vwap(levels, quantity):
    if not quantity.is_finite() or quantity <= 0:
        raise ValueError("invalid quantity")
    left, total = quantity, D(0)
    for price, size in levels:
        price, size = D(str(price)), D(str(size))
        if not price.is_finite() or not size.is_finite() or price <= 0 or size < 0:
            raise ValueError("invalid depth")
        take = min(left, size)
        total += take * price
        left -= take
        if not left:
            return total / quantity
    raise ValueError("insufficient depth")


def compare(buy, sell, quantity, now_ms, buy_fee=None, sell_fee=None,
            max_age_ms=5000, max_skew_ms=1000):
    blockers = ["NOT_EXECUTABLE_SNAPSHOT", "EXIT_COSTS_AND_BASIS_UNKNOWN"]
    ages = [now_ms - b["ts"] for b in (buy, sell)]
    skew = abs(buy["ts"] - sell["ts"])
    if max(ages) > max_age_ms:
        blockers.append("STALE_BOOK")
    if min(ages) < -1000:
        blockers.append("FUTURE_TIMESTAMP_OR_CLOCK_ERROR")
    if skew > max_skew_ms:
        blockers.append("BOOK_SKEW")
    result = {"status": "HOLD", "blockers": blockers,
              "quantity_base": quantity, "age_ms": ages, "skew_ms": skew,
              "buy_vwap": None, "sell_vwap": None,
              "entry_fee_quote": None, "entry_after_fees_quote": None}
    if buy_fee is None or sell_fee is None:
        blockers.append("FEES_UNKNOWN")
    for book in (buy, sell):
        if not book["asks"] or not book["bids"]:
            blockers.append("EMPTY_BOOK")
            return result
        if D(str(book["bids"][0][0])) >= D(str(book["asks"][0][0])):
            blockers.append("CROSSED_OR_LOCKED_BOOK")
            return result
    try:
        ask, bid = vwap(buy["asks"], quantity), vwap(sell["bids"], quantity)
    except ValueError as exc:
        blockers.append(str(exc))
        return result
    top_ask, top_bid = D(str(buy["asks"][0][0])), D(str(sell["bids"][0][0]))
    result.update(buy_vwap=ask, sell_vwap=bid, gross_entry_quote=(bid-ask)*quantity,
                  top_spread_bps=(top_bid/top_ask-1)*10000,
                  depth_spread_bps=(bid/ask-1)*10000)
    if buy_fee is not None and sell_fee is not None:
        if any(not f.is_finite() or f < 0 or f >= 1 for f in (buy_fee, sell_fee)):
            raise ValueError("invalid fee")
        result["entry_fee_quote"] = quantity*(ask*buy_fee+bid*sell_fee)
        result["entry_after_fees_quote"] = result["gross_entry_quote"]-result["entry_fee_quote"]
    return result
