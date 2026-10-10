"""Risk Gate prop-agents: решает, можно ли открыть сделку и каким объёмом.

Чистый модуль: без сети и БД. Профили пропов и лимиты стратегий читаются из YAML
только на чтение (MappingProxyType). Меняет их только Герман — правкой файлов.
"""
import math
import os
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from types import MappingProxyType
from typing import Any, List, Mapping, Optional, Sequence, Union

import yaml

ENGINE_DIR = os.path.dirname(os.path.abspath(__file__))
PROFILES_DIR = os.path.join(ENGINE_DIR, "profiles")
LIMITS_PATH = os.path.join(ENGINE_DIR, "limits.yaml")

APPROVE, REDUCE, REJECT = "APPROVE", "REDUCE", "REJECT"
EPS = 1e-9


def _freeze(x: Any) -> Any:
    if isinstance(x, dict):
        return MappingProxyType({k: _freeze(v) for k, v in x.items()})
    if isinstance(x, list):
        return tuple(_freeze(v) for v in x)
    return x


def load_profile(name: str, profiles_dir: str = PROFILES_DIR) -> Mapping[str, Any]:
    with open(os.path.join(profiles_dir, name + ".yaml"), encoding="utf-8") as f:
        return _freeze(yaml.safe_load(f))


def load_limits(path: str = LIMITS_PATH) -> Mapping[str, Any]:
    with open(path, encoding="utf-8") as f:
        return _freeze(yaml.safe_load(f))


@dataclass(frozen=True)
class Signal:
    side: str                                  # long / short
    entry: float
    sl: Optional[float]
    tp: Union[float, Sequence[float]]          # число (как в smc_detector) или список
    symbol: str
    venue: str                                 # имя профиля площадки
    strategy: str                              # ключ в limits.yaml → strategies


@dataclass(frozen=True)
class Position:
    symbol: str
    side: str
    risk: float                                # $ потерь, если сработает стоп


@dataclass(frozen=True)
class Account:
    equity: float
    initial_balance: float
    day_start_balance: float
    day_start_equity: float
    peak_equity: Optional[float] = None        # для трейлинг-просадки; None = max(initial, equity)
    open_positions: Sequence[Position] = ()
    trades_today: int = 0
    loss_streak: int = 0
    last_loss_time: Optional[datetime] = None


@dataclass(frozen=True)
class Decision:
    action: str
    qty: float = 0.0
    leverage: float = 0.0
    risk: float = 0.0                          # $ потерь по стопу при этом qty
    reasons: List[str] = field(default_factory=list)


def _reject(*reasons: str) -> Decision:
    return Decision(REJECT, reasons=list(reasons))


def _floor_step(x: float, step: float) -> float:
    return round(math.floor(x / step + EPS) * step, 10)


def _min_set(*vals: Optional[float]) -> Optional[float]:
    known = [v for v in vals if v is not None]
    return min(known) if known else None


def _daily_floor(acc: Account, pct: float, method: Optional[str]) -> float:
    # method из профиля; null → max (строже: выше база → выше пол)
    if method == "balance":
        base = acc.day_start_balance
    elif method == "equity":
        base = acc.day_start_equity
    else:
        base = max(acc.day_start_balance, acc.day_start_equity)
    return base - base * pct / 100


def _dd_floor(acc: Account, pct: float, kind: Optional[str]) -> float:
    # static: от начального баланса; trailing: от пика equity на ту же сумму. null → trailing (строже)
    amount = acc.initial_balance * pct / 100
    if kind == "static":
        return acc.initial_balance - amount
    peak = acc.peak_equity if acc.peak_equity is not None else max(acc.initial_balance, acc.equity)
    return peak - amount


def evaluate(signal: Signal, account: Account, profile: Mapping[str, Any],
             limits: Mapping[str, Any], now: Optional[datetime] = None) -> Decision:
    now = now or datetime.utcnow()

    ks_file = limits.get("kill_switch_file")
    if ks_file and not os.path.isabs(ks_file):
        ks_file = os.path.join(ENGINE_DIR, ks_file)
    if limits.get("kill_switch") or (ks_file and os.path.exists(ks_file)):
        return _reject("kill-switch включён")

    strat = (limits.get("strategies") or {}).get(signal.strategy)
    if strat is None:
        return _reject("нет лимитов для стратегии %s" % signal.strategy)
    if signal.venue != profile.get("name"):
        return _reject("площадка сигнала %s ≠ профиль %s" % (signal.venue, profile.get("name")))
    if profile.get("automation_allowed") is not True:
        return _reject("автоматизация на %s не разрешена или не подтверждена" % profile.get("name"))

    if signal.symbol not in (strat.get("whitelist") or ()):
        return _reject("%s не в whitelist стратегии" % signal.symbol)
    prof_instr = profile.get("instruments")
    if prof_instr is not None and signal.symbol not in prof_instr:
        return _reject("%s не торгуется на %s" % (signal.symbol, profile.get("name")))
    spec = (limits.get("instruments") or {}).get(signal.symbol)
    if spec is None:
        return _reject("нет спецификации инструмента %s (lot_step, min_qty)" % signal.symbol)

    side, entry, sl = signal.side, signal.entry, signal.sl
    if side not in ("long", "short"):
        return _reject("неизвестная сторона %r" % side)
    if sl is None or sl <= 0:
        return _reject("нет стопа")
    if (side == "long" and sl >= entry) or (side == "short" and sl <= entry):
        return _reject("стоп не с той стороны входа")

    tps = [signal.tp] if isinstance(signal.tp, (int, float)) else list(signal.tp or [])
    if not tps:
        return _reject("нет тейка")
    if any((side == "long" and t <= entry) or (side == "short" and t >= entry) for t in tps):
        return _reject("тейк не с той стороны входа")
    dist = abs(entry - sl)
    rr = abs(tps[0] - entry) / dist
    if rr < strat["min_rr"] - EPS:
        return _reject("R:R %.2f < %.2f" % (rr, strat["min_rr"]))

    opens = list(account.open_positions)
    if len(opens) >= strat["max_positions"]:
        return _reject("открыто позиций %d, максимум %d" % (len(opens), strat["max_positions"]))
    same = sum(1 for p in opens if p.side == side)
    if same >= strat["max_same_side"]:
        return _reject("в сторону %s уже %d, максимум %d" % (side, same, strat["max_same_side"]))
    if account.trades_today >= strat["max_trades_per_day"]:
        return _reject("сделок сегодня %d, максимум %d" % (account.trades_today, strat["max_trades_per_day"]))
    if (account.loss_streak >= strat["loss_streak"] and account.last_loss_time is not None
            and now - account.last_loss_time < timedelta(minutes=strat["pause_minutes"])):
        return _reject("пауза после %d убытков подряд до %s" % (
            account.loss_streak, account.last_loss_time + timedelta(minutes=strat["pause_minutes"])))

    step, min_qty = spec["lot_step"], spec["min_qty"]
    eq = account.equity
    reasons = []
    action = APPROVE

    qty = _floor_step(eq * strat["risk_pct"] / 100 / dist, step)
    if qty < min_qty - EPS:
        return _reject("объём %.10g меньше мин. %.10g" % (qty, min_qty))

    max_lev = _min_set(profile.get("max_leverage"), strat.get("max_leverage"))
    if max_lev is not None and qty * entry / eq > max_lev + EPS:
        qty = _floor_step(eq * max_lev / entry, step)
        action = REDUCE
        reasons.append("урезано до плеча %gx" % max_lev)

    daily_pct = _min_set(profile.get("daily_loss_pct"), strat.get("daily_loss_pct"))
    dd_pct = _min_set(profile.get("max_drawdown_pct"), strat.get("max_drawdown_pct"))
    floors = []
    if daily_pct is not None:
        floors.append(("дневной лимит", _daily_floor(account, daily_pct, profile.get("daily_loss_method"))))
    if profile.get("max_drawdown_pct") is not None:
        floors.append(("макс. просадка пропа",
                       _dd_floor(account, profile["max_drawdown_pct"], profile.get("drawdown_type"))))
    if strat.get("max_drawdown_pct") is not None:
        floors.append(("макс. просадка стратегии",
                       _dd_floor(account, strat["max_drawdown_pct"], strat.get("drawdown_type", "static"))))
    if dd_pct is None and daily_pct is None:
        reasons.append("лимиты потерь не заданы")

    open_risk = sum(p.risk for p in opens)
    for name, floor in floors:
        room = eq - open_risk - floor
        if room <= EPS:
            return _reject("%s исчерпан: equity %.2f, риск открытых %.2f, пол %.2f" % (name, eq, open_risk, floor))
        if qty * dist > room + EPS:
            qty = _floor_step(room / dist, step)
            action = REDUCE
            reasons.append("урезано под %s: запас %.2f" % (name, room))

    if qty < min_qty - EPS:
        return _reject(*(reasons + ["после урезания объём %.10g меньше мин. %.10g" % (qty, min_qty)]))

    risk = round(qty * dist, 10)
    reasons.append("R:R %.2f, риск %.2f (%.3f%% equity)" % (rr, risk, risk / eq * 100))
    return Decision(action, qty=qty, leverage=round(qty * entry / eq, 4), risk=risk, reasons=reasons)
