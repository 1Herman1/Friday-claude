"""Synthetic fixtures only: these are not measured trading results."""
import copy
import importlib
import importlib.util
import sys
from datetime import datetime, timezone
from decimal import Decimal, Subnormal, localcontext
from typing import Any, Dict, Tuple
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
NOW = datetime(2026, 11, 14, tzinfo=timezone.utc)


def gate():
    assert importlib.util.find_spec("quant_gate.gate") is not None, "quant gate is not implemented"
    return importlib.import_module("quant_gate.gate")


def test_missing_policy_is_hold_not_permission():
    decision = gate().evaluate({}, {}, now=NOW)
    assert decision.action == "HOLD"
    assert decision.reasons
    assert decision.to_dict()["action"] == "HOLD"


def fixture() -> Tuple[Dict[str, Any], Dict[str, Any]]:
    policy = {
        "strategy_version": "SYNTHETIC-v1", "mode": "strategy",
        "min_trades": {"backtest_oos": 100, "forward": 30},
        "min_net_expectancy_r": "0", "required_sources": ["candles", "fills"],
        "min_source_coverage": "0.99",
    }
    evidence: Dict[str, Any] = {"training": {"start": "2026-01-01T00:00:00+00:00",
                              "end": "2026-02-01T00:00:00+00:00"}}
    for name, kind, start, end, count in [
        ("backtest_oos", "backtest", "02", "03", 100),
        ("forward", "forward", "03", "04", 30),
    ]:
        evidence[name] = {
            "kind": kind, "strategy_version": "SYNTHETIC-v1", "out_of_sample": True,
            "start": "2026-%s-01T00:00:00+00:00" % start,
            "end": "2026-%s-01T00:00:00+00:00" % end,
            "trades": count, "gross_expectancy_r": "0.5",
            "costs_r": {"fees": "0.1", "slippage": "0.1", "funding": "0.05", "api": "0.05"},
            "sources": {s: {"expected": 100, "observed": 100} for s in ("candles", "fills")},
        }
    return evidence, policy


def run(evidence=None, policy=None):
    e, p = fixture()
    return gate().evaluate(e if evidence is None else evidence,
                           p if policy is None else policy, now=NOW)


def codes(decision):
    return {r.code for r in decision.reasons}


def test_complete_separate_evidence_approves_deterministically_without_mutation():
    e, p = fixture()
    original = copy.deepcopy((e, p))
    d = run(e, p)
    assert d.action == "APPROVE"
    assert d == run(e, p)
    assert (e, p) == original
    assert "QUANT_ELIGIBLE" in codes(d)


@pytest.mark.parametrize("stage", ["backtest_oos", "forward"])
@pytest.mark.parametrize("gross", ["0.3", "0.29", "-1"])
def test_expectancy_must_be_strictly_positive_after_all_costs(stage, gross):
    e, p = fixture()
    e[stage]["gross_expectancy_r"] = gross
    d = run(e, p)
    assert d.action == "REJECT"
    assert "NET_EXPECTANCY" in codes(d)


@pytest.mark.parametrize("field", ["gross_expectancy_r", "costs_r", "trades", "sources", "start", "kind"])
def test_missing_stage_metrics_fail_closed(field):
    e, p = fixture()
    del e["forward"][field]
    assert run(e, p).action == "HOLD"


@pytest.mark.parametrize("bad", [None, "NaN", "Infinity", "-Infinity", 0.5, True, "nonsense"])
def test_nonfinite_or_inexact_expectancy_is_hold(bad):
    e, p = fixture()
    e["forward"]["gross_expectancy_r"] = bad
    assert run(e, p).action == "HOLD"


@pytest.mark.parametrize("cost", ["fees", "slippage", "funding", "api"])
def test_each_cost_is_required_even_if_zero(cost):
    e, p = fixture()
    del e["forward"]["costs_r"][cost]
    assert run(e, p).action == "HOLD"


def test_negative_cost_cannot_manufacture_profit():
    e, p = fixture()
    e["forward"]["costs_r"]["api"] = "-1"
    assert run(e, p).action == "HOLD"


@pytest.mark.parametrize("stage", ["backtest_oos", "forward"])
def test_sample_adequacy_is_separate_and_cannot_be_pooled(stage):
    e, p = fixture()
    e[stage]["trades"] = p["min_trades"][stage] - 1
    other = "forward" if stage == "backtest_oos" else "backtest_oos"
    e[other]["trades"] = 100000
    assert run(e, p).action == "HOLD"
    assert "INSUFFICIENT_SAMPLE" in codes(run(e, p))


@pytest.mark.parametrize("field", ["min_trades", "required_sources", "min_source_coverage", "min_net_expectancy_r"])
def test_policy_never_supplies_default_thresholds(field):
    e, p = fixture()
    del p[field]
    assert run(e, p).action == "HOLD"


@pytest.mark.parametrize("value", [0, -1, True, 100.0, "100", None])
def test_sample_policy_must_be_explicit_positive_integer(value):
    e, p = fixture()
    p["min_trades"]["forward"] = value
    assert run(e, p).action == "HOLD"


@pytest.mark.parametrize("stage", ["backtest_oos", "forward"])
@pytest.mark.parametrize("source", ["candles", "fills"])
def test_incomplete_source_coverage_cannot_approve(stage, source):
    e, p = fixture()
    e[stage]["sources"][source]["observed"] = 98
    assert run(e, p).action == "HOLD"
    assert "SOURCE_COVERAGE" in codes(run(e, p))


@pytest.mark.parametrize("bad", [0, -1, True, "100"])
def test_source_denominator_is_not_guessed(bad):
    e, p = fixture()
    e["forward"]["sources"]["fills"]["expected"] = bad
    assert run(e, p).action == "HOLD"


def test_coverage_boundary_is_inclusive():
    e, p = fixture()
    e["forward"]["sources"]["fills"]["observed"] = 99
    assert run(e, p).action == "APPROVE"


@pytest.mark.parametrize("stage", ["backtest_oos", "forward"])
def test_backtest_and_forward_must_have_correct_kind(stage):
    e, p = fixture()
    e[stage]["kind"] = "forward" if stage == "backtest_oos" else "backtest"
    assert run(e, p).action == "REJECT"
    assert "EVIDENCE_KIND" in codes(run(e, p))


@pytest.mark.parametrize("stage", ["backtest_oos", "forward"])
def test_in_sample_or_changed_version_evidence_is_rejected(stage):
    e, p = fixture()
    e[stage]["out_of_sample"] = False
    assert run(e, p).action == "REJECT"
    e, p = fixture()
    e[stage]["strategy_version"] = "OTHER"
    assert run(e, p).action == "REJECT"


@pytest.mark.parametrize("section", ["training", "backtest_oos"])
def test_adjacent_stages_cannot_overlap(section):
    e, p = fixture()
    e[section]["end"] = "2026-03-02T00:00:00+00:00"
    assert run(e, p).action == "REJECT"
    assert "SPLIT_OVERLAP" in codes(run(e, p))


@pytest.mark.parametrize("section", ["training", "backtest_oos", "forward"])
def test_missing_or_naive_split_times_hold(section):
    e, p = fixture()
    del e[section]["end"]
    assert run(e, p).action == "HOLD"
    e, p = fixture()
    e[section]["start"] = "2026-01-01T00:00:00"
    assert run(e, p).action == "HOLD"


def test_future_forward_metrics_rejected():
    e, p = fixture()
    e["forward"]["end"] = "2026-12-01T00:00:00+00:00"
    assert run(e, p).action == "REJECT"


def test_llm_text_cannot_override_a_failed_gate():
    e, p = fixture()
    e["forward"]["gross_expectancy_r"] = "0"
    e["llm_override"] = {"action": "APPROVE", "confidence": 1}
    assert run(e, p).action == "REJECT"


def arb_fixture():
    e, p = fixture()
    p.update(mode="arbitrage", max_quote_age_seconds="2", max_slippage_bps="5",
             required_legs={
                 "buy": {"venue": "SYNTHETIC-A", "symbol": "TEST", "side": "buy", "quantity": "2"},
                 "sell": {"venue": "SYNTHETIC-B", "symbol": "TEST", "side": "sell", "quantity": "2"},
             })
    e["arbitrage"] = {
        "gross_edge_bps": "20",
        "costs_bps": {"fees": "4", "funding": "1", "transfer": "1", "api": "0"},
        "legs": {
            name: {"venue": spec["venue"], "symbol": spec["symbol"], "side": spec["side"],
                   "quote_at": "2026-11-13T23:59:58+00:00", "slippage_bps": "3",
                   "available_depth_qty": "2", "depth_limit_bps": "5"}
            for name, spec in p["required_legs"].items()
        },
    }
    return e, p


def test_arbitrage_checks_all_legs_at_exact_depth_and_age_boundary():
    assert run(*arb_fixture()).action == "APPROVE"


@pytest.mark.parametrize("leg", ["buy", "sell"])
@pytest.mark.parametrize("field, value, expected, code", [
    ("quote_at", "2026-11-13T23:59:57.999999+00:00", "HOLD", "STALE_QUOTE"),
    ("quote_at", "2026-11-14T00:00:00.000001+00:00", "HOLD", "FUTURE_QUOTE"),
    ("available_depth_qty", "1.999999999999999999", "REJECT", "INSUFFICIENT_DEPTH"),
    ("slippage_bps", "5.000000000000000001", "REJECT", "MAX_SLIPPAGE"),
    ("depth_limit_bps", "6", "REJECT", "DEPTH_LIMIT"),
    ("venue", "OTHER", "REJECT", "LEG_MISMATCH"),
])
def test_arbitrage_fails_closed_per_leg(leg, field, value, expected, code):
    e, p = arb_fixture()
    e["arbitrage"]["legs"][leg][field] = value
    d = run(e, p)
    assert d.action == expected
    assert code in codes(d)


@pytest.mark.parametrize("leg", ["buy", "sell"])
@pytest.mark.parametrize("field", ["quote_at", "slippage_bps", "available_depth_qty", "depth_limit_bps", "side"])
def test_arbitrage_missing_quote_metrics_hold(leg, field):
    e, p = arb_fixture()
    del e["arbitrage"]["legs"][leg][field]
    assert run(e, p).action == "HOLD"


@pytest.mark.parametrize("field", ["max_quote_age_seconds", "max_slippage_bps", "required_legs"])
def test_arbitrage_thresholds_are_explicit(field):
    e, p = arb_fixture()
    del p[field]
    assert run(e, p).action == "HOLD"


@pytest.mark.parametrize("edge", ["12", "11", "-1"])
def test_arbitrage_edge_must_pay_all_costs_plus_both_leg_slippages(edge):
    e, p = arb_fixture()
    e["arbitrage"]["gross_edge_bps"] = edge
    assert run(e, p).action == "REJECT"
    assert "NET_ARBITRAGE_EDGE" in codes(run(e, p))


def test_missing_arbitrage_leg_is_not_silently_skipped():
    e, p = arb_fixture()
    del e["arbitrage"]["legs"]["sell"]
    assert run(e, p).action == "HOLD"


def test_strategy_mode_does_not_silently_ignore_arbitrage_payload():
    e, p = arb_fixture()
    p["mode"] = "strategy"
    assert run(e, p).action == "HOLD"


def test_decimal_context_cannot_change_the_result_or_raise():
    expected = run()
    with localcontext() as context:
        context.Emin = 0
        context.traps[Subnormal] = True
        assert run() == expected


@pytest.mark.parametrize("missing", ["training", "backtest_oos", "forward"])
def test_no_stage_is_optional(missing):
    e, p = fixture()
    del e[missing]
    assert run(e, p).action == "HOLD"


@pytest.mark.parametrize("bad", [None, [], "APPROVE", True])
def test_malformed_top_level_input_returns_structured_hold(bad):
    e, p = fixture()
    assert gate().evaluate(bad, p, now=NOW).action == "HOLD"
    assert gate().evaluate(e, bad, now=NOW).action == "HOLD"


@pytest.mark.parametrize("bad", [[], [""], ["fills", "fills"], "fills"])
def test_required_source_list_cannot_be_disabled(bad):
    e, p = fixture()
    p["required_sources"] = bad
    assert run(e, p).action == "HOLD"


@pytest.mark.parametrize("bad", ["0", "-1", "1.01", "NaN"])
def test_coverage_threshold_is_validated(bad):
    e, p = fixture()
    p["min_source_coverage"] = bad
    assert run(e, p).action == "HOLD"


def test_positive_decimal_margin_not_rounded_to_zero():
    e, p = fixture()
    e["forward"]["gross_expectancy_r"] = Decimal("0.300000000000000001")
    assert run(e, p).action == "APPROVE"


def test_multiple_failed_metrics_keep_machine_readable_reasons():
    e, p = fixture()
    e["forward"]["gross_expectancy_r"] = "0"
    e["backtest_oos"]["gross_expectancy_r"] = "0"
    d = run(e, p)
    assert d.action == "REJECT"
    assert {r.field for r in d.reasons if r.code == "NET_EXPECTANCY"} == {"backtest_oos", "forward"}


def test_timezone_offsets_refer_to_instants_not_wall_clock():
    e, p = arb_fixture()
    e["arbitrage"]["legs"]["buy"]["quote_at"] = "2026-11-14T02:59:58+03:00"
    assert run(e, p).action == "APPROVE"


def test_naive_now_does_not_create_implicit_timezone_assumption():
    e, p = fixture()
    assert gate().evaluate(e, p, now=NOW.replace(tzinfo=None)).action == "HOLD"


def test_cost_components_are_not_silently_ignored():
    e, p = fixture()
    e["forward"]["costs_r"]["extra_fee"] = "1"
    assert run(e, p).action == "HOLD"
