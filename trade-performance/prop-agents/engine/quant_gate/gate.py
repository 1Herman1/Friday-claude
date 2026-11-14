"""Standalone deterministic eligibility check; never an execution/risk permit."""
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import (Context, Decimal, DivisionByZero, InvalidOperation,
                     Overflow, ROUND_HALF_EVEN, localcontext)
from typing import Tuple

APPROVE, REJECT, HOLD = "APPROVE", "REJECT", "HOLD"


@dataclass(frozen=True)
class Reason:
    code: str
    field: str
    message: str


@dataclass(frozen=True)
class Decision:
    action: str
    reasons: Tuple[Reason, ...]

    def to_dict(self):
        return {"action": self.action, "reasons": [
            {"code": r.code, "field": r.field, "message": r.message}
            for r in self.reasons]}


class Invalid(ValueError):
    def __init__(self, field, message):
        super().__init__(message)
        self.field = field


def _mapping(value, field):
    if not isinstance(value, Mapping):
        raise Invalid(field, "Expected an explicit mapping")
    return value


def _get(mapping, key, field):
    if key not in mapping or mapping[key] is None:
        raise Invalid(field + "." + key, "Required value is missing")
    return mapping[key]


def _decimal(value, field, *, nonnegative=False):
    if isinstance(value, bool) or not isinstance(value, (str, int, Decimal)):
        raise Invalid(field, "Use Decimal, integer or decimal string; floats are not accepted")
    try:
        result = Decimal(value)
    except (InvalidOperation, ValueError):
        raise Invalid(field, "Invalid decimal")
    if not result.is_finite():
        raise Invalid(field, "Expected a finite decimal")
    if (len(result.as_tuple().digits) > 38
            or int(result.as_tuple().exponent) < -18 or result.adjusted() > 37):
        raise Invalid(field, "Expected a finite decimal within 38 digits / 18 places")
    if nonnegative and result < 0:
        raise Invalid(field, "Expected a nonnegative cost/threshold")
    return result


def _integer(value, field, *, minimum=0):
    if type(value) is not int or value < minimum:
        raise Invalid(field, "Expected integer >= %s" % minimum)
    return value


def _time(value, field):
    try:
        result = datetime.fromisoformat(value) if isinstance(value, str) else value
        if not isinstance(result, datetime) or result.utcoffset() is None:
            raise ValueError()
    except (ValueError, TypeError):
        raise Invalid(field, "Expected timezone-aware datetime or ISO-8601 timestamp")
    return result.astimezone(timezone.utc)


def _costs(mapping, names, field):
    mapping = _mapping(mapping, field)
    if set(mapping) != set(names):
        raise Invalid(field, "All named cost components must be explicit; extra components are not ignored")
    return sum((_decimal(mapping[n], field + "." + n, nonnegative=True) for n in names), Decimal(0))


def _arbitrage(evidence, policy, now, rejects, holds):
    max_age = _decimal(_get(policy, "max_quote_age_seconds", "policy"),
                       "policy.max_quote_age_seconds", nonnegative=True)
    max_slip = _decimal(_get(policy, "max_slippage_bps", "policy"),
                        "policy.max_slippage_bps", nonnegative=True)
    required = _mapping(_get(policy, "required_legs", "policy"), "policy.required_legs")
    if len(required) < 2 or any(not isinstance(k, str) or not k.strip() for k in required):
        raise Invalid("policy.required_legs", "At least two named legs required")
    arb = _mapping(_get(evidence, "arbitrage", "evidence"), "arbitrage")
    legs = _mapping(_get(arb, "legs", "arbitrage"), "arbitrage.legs")
    if set(legs) != set(required):
        raise Invalid("arbitrage.legs", "Exact configured leg set required")
    slippage = Decimal(0)
    for name in sorted(required):
        field = "arbitrage.legs." + name
        quote = _mapping(legs[name], field)
        spec = _mapping(required[name], "policy.required_legs." + name)
        for key in ("venue", "symbol", "side"):
            value = _get(spec, key, "policy.required_legs." + name)
            if not isinstance(value, str) or not value.strip():
                raise Invalid("policy.required_legs." + name + "." + key, "Nonempty identifier required")
            if _get(quote, key, field) != value:
                rejects.append(Reason("LEG_MISMATCH", field + "." + key, "Quote does not match configured leg"))
        if spec["side"] not in ("buy", "sell"):
            raise Invalid("policy.required_legs." + name + ".side", "Expected buy or sell")
        quantity = _decimal(_get(spec, "quantity", "policy.required_legs." + name),
                            "policy.required_legs." + name + ".quantity", nonnegative=True)
        if quantity <= 0:
            raise Invalid("policy.required_legs." + name + ".quantity", "Positive intended quantity required")
        stamp = _time(_get(quote, "quote_at", field), field + ".quote_at")
        delta = now - stamp
        # Avoid timedelta.total_seconds(), which rounds through a binary float.
        age = Decimal(delta.days * 86400 + delta.seconds) + Decimal(delta.microseconds) / Decimal(1000000)
        if age < 0:
            holds.append(Reason("FUTURE_QUOTE", field, "Quote timestamp is ahead of evaluation clock"))
        elif age > max_age:
            holds.append(Reason("STALE_QUOTE", field, "Quote older than configured freshness limit"))
        slip = _decimal(_get(quote, "slippage_bps", field), field + ".slippage_bps", nonnegative=True)
        depth = _decimal(_get(quote, "available_depth_qty", field), field + ".available_depth_qty", nonnegative=True)
        depth_limit = _decimal(_get(quote, "depth_limit_bps", field), field + ".depth_limit_bps", nonnegative=True)
        slippage += slip
        if slip > max_slip:
            rejects.append(Reason("MAX_SLIPPAGE", field, "Per-leg slippage exceeds configured cap"))
        if depth_limit > max_slip or slip > depth_limit:
            rejects.append(Reason("DEPTH_LIMIT", field, "Depth/slippage estimate not inside configured price band"))
        if depth < quantity:
            rejects.append(Reason("INSUFFICIENT_DEPTH", field, "Executable depth is below intended quantity"))
    gross = _decimal(_get(arb, "gross_edge_bps", "arbitrage"), "arbitrage.gross_edge_bps")
    costs = _costs(_get(arb, "costs_bps", "arbitrage"), ("fees", "funding", "transfer", "api"), "arbitrage.costs_bps")
    if gross - costs - slippage <= 0:
        rejects.append(Reason("NET_ARBITRAGE_EDGE", "arbitrage", "Edge does not cover all costs and leg slippages"))


def _evaluate(evidence, policy, now):
    policy = _mapping(policy, "policy")
    evidence = _mapping(evidence, "evidence")
    now = _time(now, "now")
    version = _get(policy, "strategy_version", "policy")
    if not isinstance(version, str) or not version.strip():
        raise Invalid("policy.strategy_version", "Nonempty strategy version required")
    mode = _get(policy, "mode", "policy")
    if mode not in ("strategy", "arbitrage"):
        raise Invalid("policy.mode", "Unknown mode")
    threshold = _decimal(_get(policy, "min_net_expectancy_r", "policy"),
                         "policy.min_net_expectancy_r", nonnegative=True)
    stages = ("backtest_oos", "forward")
    minimums = _mapping(_get(policy, "min_trades", "policy"), "policy.min_trades")
    minimums = {s: _integer(_get(minimums, s, "policy.min_trades"),
                            "policy.min_trades." + s, minimum=1) for s in stages}
    sources = _get(policy, "required_sources", "policy")
    if (not isinstance(sources, (tuple, list)) or not sources
            or any(not isinstance(s, str) or not s.strip() for s in sources)
            or len(set(sources)) != len(sources)):
        raise Invalid("policy.required_sources", "Nonempty unique source names required")
    coverage = _decimal(_get(policy, "min_source_coverage", "policy"), "policy.min_source_coverage")
    if not 0 < coverage <= 1:
        raise Invalid("policy.min_source_coverage", "Coverage must be in (0, 1]")
    rejects, holds, windows = [], [], {}
    for section in ("training",) + stages:
        data = _mapping(_get(evidence, section, "evidence"), section)
        start = _time(_get(data, "start", section), section + ".start")
        end = _time(_get(data, "end", section), section + ".end")
        windows[section] = (start, end)
        if start >= end or end > now:
            rejects.append(Reason("INVALID_WINDOW", section, "Require start < end <= now"))
    for previous, following in (("training", "backtest_oos"), ("backtest_oos", "forward")):
        if windows[previous][1] > windows[following][0]:
            rejects.append(Reason("SPLIT_OVERLAP", following, "Evidence overlaps " + previous))
    # Parsing both stages independently is deliberate: never pool history and forward.
    for stage in stages:
        data = _mapping(_get(evidence, stage, "evidence"), stage)
        expected_kind = "backtest" if stage == "backtest_oos" else "forward"
        if _get(data, "kind", stage) != expected_kind:
            rejects.append(Reason("EVIDENCE_KIND", stage, "Expected " + expected_kind))
        if _get(data, "out_of_sample", stage) is not True:
            rejects.append(Reason("IN_SAMPLE", stage, "Untouched out-of-sample evidence required"))
        if _get(data, "strategy_version", stage) != version:
            rejects.append(Reason("VERSION_MISMATCH", stage, "Evidence is for a different version"))
        trades = _integer(_get(data, "trades", stage), stage + ".trades")
        if trades < minimums[stage]:
            holds.append(Reason("INSUFFICIENT_SAMPLE", stage, "%s trades < %s" % (trades, minimums[stage])))
        stage_sources = _mapping(_get(data, "sources", stage), stage + ".sources")
        for source in sources:
            field = stage + ".sources." + source
            counts = _mapping(_get(stage_sources, source, stage + ".sources"), field)
            expected = _integer(_get(counts, "expected", field), field + ".expected", minimum=1)
            observed = _integer(_get(counts, "observed", field), field + ".observed")
            if observed > expected:
                raise Invalid(field, "Observed distinct observations cannot exceed expected")
            if Decimal(observed) < coverage * expected:
                holds.append(Reason("SOURCE_COVERAGE", field, "Source coverage below configured minimum"))
        gross = _decimal(_get(data, "gross_expectancy_r", stage), stage + ".gross_expectancy_r")
        costs = _costs(_get(data, "costs_r", stage), ("fees", "slippage", "funding", "api"), stage + ".costs_r")
        if gross - costs <= threshold:
            rejects.append(Reason("NET_EXPECTANCY", stage,
                "Net expectancy %sR must exceed %sR after every cost" % (gross - costs, threshold)))
    if mode == "arbitrage":
        _arbitrage(evidence, policy, now, rejects, holds)
    elif "arbitrage" in evidence or any(k in policy for k in
            ("max_quote_age_seconds", "max_slippage_bps", "required_legs")):
        raise Invalid("policy.mode", "Arbitrage payload/policy cannot be evaluated as a strategy")
    if rejects:
        return Decision(REJECT, tuple(rejects + holds))
    if holds:
        return Decision(HOLD, tuple(holds))
    return Decision(APPROVE, (Reason("QUANT_ELIGIBLE", "evidence",
        "Quant evidence eligible only; authoritative risk.py must still approve/size"),))


def evaluate(evidence, policy, *, now):
    """Pure, no I/O, no LLM override, no default thresholds or implicit clock."""
    try:
        context = Context(prec=80, rounding=ROUND_HALF_EVEN, Emin=-999999,
                          Emax=999999, capitals=1, clamp=0, flags=[],
                          traps=[InvalidOperation, DivisionByZero, Overflow])
        with localcontext(context):
            return _evaluate(evidence, policy, now)
    except Invalid as error:
        return Decision(HOLD, (Reason("INVALID_OR_MISSING", error.field, str(error)),))
