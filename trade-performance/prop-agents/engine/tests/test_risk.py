import os
import sys
from datetime import datetime, timedelta

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import risk  # noqa: E402
from risk import APPROVE, REDUCE, REJECT, Account, Position, Signal, evaluate  # noqa: E402

NOW = datetime(2026, 10, 11, 12, 0)


def profile(**kw):
    p = dict(name="p", automation_allowed=True, daily_loss_pct=3.0, daily_loss_method="balance",
             max_drawdown_pct=6.0, drawdown_type="static", max_leverage=10, instruments=None)
    p.update(kw)
    return risk._freeze(p)


def limits(kill_switch=False, kill_switch_file=None, **kw):
    s = dict(risk_pct=0.5, min_rr=2.0, max_leverage=10, daily_loss_pct=50.0, max_drawdown_pct=50.0,
             drawdown_type="static", max_positions=3, max_same_side=2, max_trades_per_day=4,
             loss_streak=3, pause_minutes=240, whitelist=["TEST"])
    s.update(kw)
    return risk._freeze(dict(kill_switch=kill_switch, kill_switch_file=kill_switch_file, strategies={"s": s},
                             instruments={"TEST": {"lot_step": 1, "min_qty": 1}}))


def sig(side="long", entry=100.0, sl=99.0, tp=(102.0,), symbol="TEST", venue="p"):
    return Signal(side=side, entry=entry, sl=sl, tp=tp, symbol=symbol, venue=venue, strategy="s")


def acc(equity=10000.0, **kw):
    a = dict(equity=equity, initial_balance=10000.0, day_start_balance=equity, day_start_equity=equity)
    a.update(kw)
    return Account(**a)


def run(s=None, a=None, p=None, lim=None, now=NOW):
    return evaluate(s or sig(), a or acc(), p or profile(), lim or limits(), now=now)


# --- базовый случай и размер ---

def test_approve_size_from_risk():
    d = run()
    assert d.action == APPROVE
    assert d.qty == 50 and d.risk == 50 and d.leverage == 0.5


def test_short_approve():
    d = run(sig(side="short", entry=100, sl=101, tp=98))
    assert d.action == APPROVE and d.qty == 50


def test_detector_format_tp_float():
    assert run(sig(tp=102.0)).action == APPROVE


def test_lot_step_rounds_down():
    lim = risk._freeze(dict(strategies=limits()["strategies"], instruments={"TEST": {"lot_step": 0.001, "min_qty": 0.001}}))
    d = run(sig(entry=60000, sl=59700, tp=60600), lim=lim)
    assert d.qty == 0.166  # 50 / 300 = 0.1666…


def test_below_min_qty_reject():
    d = run(a=acc(equity=100))  # риск 0.5$ / 1 = 0.5 < 1
    assert d.action == REJECT and "мин" in d.reasons[0]


# --- стоп и R:R ---

@pytest.mark.parametrize("s", [
    sig(sl=None), sig(sl=0), sig(sl=101), sig(sl=100),
    sig(side="short", sl=99, tp=98), sig(side="short", sl=100, tp=98),
])
def test_stop_missing_or_wrong_side(s):
    assert run(s).action == REJECT


def test_tp_wrong_side_reject():
    assert run(sig(tp=99.5)).action == REJECT


def test_no_tp_reject():
    assert run(sig(tp=())).action == REJECT


def test_rr_below_min_reject():
    d = run(sig(tp=101.9))
    assert d.action == REJECT and "R:R" in d.reasons[0]


def test_rr_exactly_min_approve():
    assert run(sig(tp=102.0)).action == APPROVE


def test_bad_side_reject():
    assert run(sig(side="buy")).action == REJECT


# --- плечо ---

def test_leverage_reduce():
    d = run(sig(entry=100, sl=99.9, tp=100.2), p=profile(max_leverage=3))  # хочет 500 → 5x
    assert d.action == REDUCE and d.qty == 300 and d.leverage == 3


def test_leverage_strategy_stricter_than_profile():
    d = run(sig(entry=100, sl=99.9, tp=100.2), p=profile(max_leverage=None), lim=limits(max_leverage=2))
    assert d.action == REDUCE and d.qty == 200


# --- дневной лимит ---

def test_daily_exactly_at_limit_approve():
    # пол 9700; equity 10000 − открытый риск 250 − 9700 = 50 = риск сделки
    d = run(a=acc(day_start_balance=10000, open_positions=[Position("TEST", "short", 250)]))
    assert d.action == APPROVE and d.qty == 50


def test_daily_reduce():
    d = run(a=acc(open_positions=[Position("TEST", "short", 260)]))
    assert d.action == REDUCE and d.qty == 40 and d.risk == 40


def test_daily_exhausted_reject():
    d = run(a=acc(open_positions=[Position("TEST", "short", 300)]))
    assert d.action == REJECT and "дневной" in d.reasons[0]


def test_daily_reduce_below_min_qty_reject():
    d = run(a=acc(open_positions=[Position("TEST", "short", 299.5)]))  # запас 0.5 → qty 0
    assert d.action == REJECT


def test_daily_equity_method_vs_balance():
    a = acc(equity=10000, day_start_balance=10000, day_start_equity=10500)  # пол по equity 10185
    assert run(a=a, p=profile(daily_loss_method="balance")).action == APPROVE
    assert run(a=a, p=profile(daily_loss_method="equity")).action == REJECT
    assert run(a=a, p=profile(daily_loss_method=None)).action == REJECT  # null → max, строже


def test_daily_null_in_profile_uses_strategy():
    a = acc(equity=9820, day_start_balance=10000, day_start_equity=10000)  # стратегия 2% → пол 9800, запас 20
    d = run(a=a, p=profile(daily_loss_pct=None), lim=limits(daily_loss_pct=2.0))
    assert d.action == REDUCE and d.qty == 20


# --- общая просадка ---

def test_static_drawdown_reject():
    a = acc(equity=9400, day_start_balance=9400)
    d = run(a=a)
    assert d.action == REJECT and "просадка" in d.reasons[0]


def test_trailing_drawdown_reduce():
    # пик 11000, трейлинг 6% от начального = 600 → пол 10400; запас 20
    a = acc(equity=10420, peak_equity=11000)
    assert run(a=a, p=profile(drawdown_type="static")).action == APPROVE
    d = run(a=a, p=profile(drawdown_type="trailing"))
    assert d.action == REDUCE and d.qty == 20


def test_trailing_null_type_is_trailing():
    a = acc(equity=10400, peak_equity=11000)
    assert run(a=a, p=profile(drawdown_type=None)).action == REJECT


def test_trailing_boundary():
    a = acc(equity=10450, peak_equity=11000)  # запас 50, хочет 52 → урезать до 50
    d = run(a=a, p=profile(drawdown_type="trailing"))
    assert d.action == REDUCE and d.qty == 50
    a = acc(equity=10452, peak_equity=11000)  # запас 52, хочет 52.26 → 52 ровно на лимите
    assert run(a=a, p=profile(drawdown_type="trailing")).action == APPROVE


# --- позиции, сделки, пауза ---

def test_max_positions_reject():
    a = acc(open_positions=[Position("TEST", "long", 0), Position("TEST", "short", 0), Position("TEST", "short", 0)])
    assert run(a=a).action == REJECT


def test_max_same_side():
    a = acc(open_positions=[Position("TEST", "long", 0), Position("TEST", "long", 0)])
    assert run(a=a).action == REJECT
    assert run(sig(side="short", sl=101, tp=98), a=a).action == APPROVE


def test_max_trades_per_day():
    assert run(a=acc(trades_today=3)).action == APPROVE
    assert run(a=acc(trades_today=4)).action == REJECT


def test_loss_streak_pause():
    assert run(a=acc(loss_streak=3, last_loss_time=NOW - timedelta(hours=1))).action == REJECT
    assert run(a=acc(loss_streak=3, last_loss_time=NOW - timedelta(minutes=240))).action == APPROVE
    assert run(a=acc(loss_streak=2, last_loss_time=NOW - timedelta(minutes=1))).action == APPROVE


# --- whitelist, площадка, kill-switch ---

def test_whitelist_reject():
    assert run(sig(symbol="ETHUSDT")).action == REJECT


def test_profile_instruments_reject():
    assert run(p=profile(instruments=["BTCUSDT"])).action == REJECT


def test_venue_mismatch_reject():
    assert run(sig(venue="other")).action == REJECT


@pytest.mark.parametrize("flag", [False, None])
def test_automation_not_allowed_reject(flag):
    assert run(p=profile(automation_allowed=flag)).action == REJECT


def test_kill_switch_flag():
    d = run(lim=limits(kill_switch=True))
    assert d.action == REJECT and "kill-switch" in d.reasons[0]


def test_kill_switch_file(tmp_path):
    f = tmp_path / "KILL_SWITCH"
    lim = limits(kill_switch_file=str(f))
    assert run(lim=lim).action == APPROVE
    f.write_text("stop")
    assert run(lim=lim).action == REJECT


def test_unknown_strategy_reject():
    s = Signal("long", 100, 99, 102, "TEST", "p", "nope")
    assert run(s).action == REJECT


# --- YAML: загрузка и неизменяемость ---

def test_yaml_profiles_load_and_read_only():
    lim = risk.load_limits()
    with pytest.raises(TypeError):
        lim["kill_switch"] = True
    with pytest.raises(TypeError):
        lim["strategies"]["smc-btc"]["risk_pct"] = 5
    for name in ("demo", "propr", "hyrotrader", "sizeprop", "breakout", "hashhedge"):
        p = risk.load_profile(name)
        assert p["name"] == name
        assert "daily_loss_pct" in p and "max_drawdown_pct" in p
    propr = risk.load_profile("propr")
    assert (propr["target_pct"], propr["daily_loss_pct"], propr["max_drawdown_pct"]) == (10.0, 3.0, 6.0)
    assert risk.load_profile("hashhedge")["automation_allowed"] is False


def test_limits_header_comment():
    with open(risk.LIMITS_PATH, encoding="utf-8") as f:
        assert "меняет только герман" in f.readline().lower()


def test_real_yaml_smc_signal_on_demo():
    s = Signal("long", 60000.0, 59700.0, 60600.0, "BTCUSDT", "demo", "smc-btc")
    d = evaluate(s, acc(), risk.load_profile("demo"), risk.load_limits(), now=NOW)
    assert d.action == APPROVE and d.qty == 0.166
