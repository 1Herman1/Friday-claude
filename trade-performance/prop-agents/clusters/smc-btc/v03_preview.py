"""Изолированный SMC v0.3 PREVIEW. Нет торговли, отправки и production-state."""
import argparse
import json
import math
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path
from collections import Counter
from datetime import timedelta

import pandas as pd

VERSION = 'smc-v0.3-preview-1'
STEP = pd.Timedelta(minutes=15)
BLOCKERS = ['UNAPPROVED_CONTEXT', 'UNAPPROVED_WINDOW', 'STOP_TICK_ROUNDING_UNAPPROVED',
            'SPOT_NOT_BINGX_FUTURES', 'PREVIEW_NOT_POSITION_ENGINE']


def closed_candles(data, as_of, min_bars=768):
    """UTC open-time index; reject malformed/gapped data, discard open candles."""
    if data.index.tz is None or str(data.index.tz) != 'UTC':
        raise ValueError('UTC_REQUIRED')
    if data.index.has_duplicates or not data.index.is_monotonic_increasing:
        raise ValueError('UNSORTED_OR_DUPLICATE')
    if any(t.value % STEP.value for t in data.index):
        raise ValueError('UNALIGNED_15M')
    data = data.loc[data.index + STEP <= as_of, list('ohlc')].astype(float).copy()
    if not all(math.isfinite(float(x)) and x > 0 for x in data.to_numpy().ravel()):
        raise ValueError('INVALID_PRICE')
    if ((data.h < data[['o', 'c', 'l']].max(axis=1)) |
            (data.l > data[['o', 'c', 'h']].min(axis=1))).any():
        raise ValueError('INVALID_OHLC')
    if len(data) > 1 and not (data.index[1:] - data.index[:-1] == STEP).all():
        raise ValueError('GAP_IN_15M')
    if len(data) < min_bars:
        raise ValueError('INSUFFICIENT_WARMUP')
    return data


def complete_bars(data, rule):
    step = pd.Timedelta(rule)
    grouped = data.resample(rule, label='left', closed='left')
    result = grouped.agg({'o':'first', 'h':'max', 'l':'min', 'c':'last'})
    return result[grouped.c.count() == int(step / STEP)].dropna()


def evaluate_setup(data, sweep_open, level) -> dict:
    """Проверить один sweep после закрытия 1h; вход только на следующих 15m."""
    sweep_close = sweep_open + pd.Timedelta(hours=1)
    hour = data[(data.index >= sweep_open) & (data.index < sweep_close)]
    short = level['side'] == 'hi'
    sign = 1 if short else -1
    price = level['price'] * sign
    high = data.h if short else -data.l
    low = data.l if short else -data.h
    close = data.c * sign
    result: dict = dict(reason='INCOMPLETE_SWEEP', preview_eligible=False, production_eligible=False,
                  warnings=list(BLOCKERS), side='short' if short else 'long',
                  sweep_open=sweep_open.isoformat(), sweep_close=sweep_close.isoformat(),
                  level=dict(level), entry=None, entry_time=None, sl=None, tp1=None, tp2=None)
    if len(hour) != 4:
        return result
    start = data.index.get_loc(sweep_open)
    end = start + 4
    extreme = float(high.iloc[start:end].max())
    result['sweep_extreme'] = extreme * sign
    if not (extreme > price and close.iloc[end - 1] < price):
        result['reason'] = 'NOT_SWEEP'
        return result
    fvgs = []
    lower = sweep_open - pd.Timedelta(hours=12)
    for i in range(max(2, data.index.searchsorted(lower)), end):
        if low.iloc[i] > high.iloc[i - 2]:
            fvgs.append((float(high.iloc[i - 2]), i))
    deadline = sweep_close + pd.Timedelta(hours=8)
    for i in range(end, len(data)):
        if data.index[i] >= deadline:
            break
        extreme = max(extreme, float(high.iloc[i]))
        result['sweep_extreme'] = extreme * sign
        if close.iloc[i] > price:
            result.update(reason='BODY_BACK_BEYOND_LEVEL', decision_time=(data.index[i] + STEP).isoformat())
            return result
        if low.iloc[i] > high.iloc[i - 2]:
            fvgs.append((float(high.iloc[i - 2]), i))
        live = [(boundary, formed) for boundary, formed in fvgs if formed < i]
        if live and close.iloc[i] < live[-1][0] <= close.iloc[i - 1]:
            entry = float(close.iloc[i])
            stop = math.nextafter(extreme, math.inf)
            risk = stop - entry
            result.update(reason='IFVG_CLOSE', preview_eligible=True, entry=entry * sign,
                          entry_time=(data.index[i] + STEP).isoformat(),
                          decision_time=(data.index[i] + STEP).isoformat(), sl=stop * sign,
                          sweep_extreme=extreme * sign, tp1=(entry - 2 * risk) * sign,
                          fvg_boundary=live[-1][0] * sign,
                          fvg_bottom=min(live[-1][0] * sign, float(low.iloc[live[-1][1]]) * sign),
                          fvg_top=max(live[-1][0] * sign, float(low.iloc[live[-1][1]]) * sign),
                          fvg_formed_close=(data.index[live[-1][1]] + STEP).isoformat())
            return result
    expired = len(data) and data.index[-1] + STEP >= deadline
    result.update(reason='NO_IFVG_BEFORE_DEADLINE' if expired else 'PENDING_IFVG',
                  decision_time=deadline.isoformat() if expired else None)
    return result


def liquidity_levels(data, variant):
    """Полные сессии и подтверждённые 4h swings; known/expire в UTC."""
    zone = 'America/New_York' if variant == 'ny' else 'UTC'
    out = []

    def session(begin, end, kind, lifetime=24):
        begin, end = begin.tz_convert('UTC'), end.tz_convert('UTC')
        frame = data[(data.index >= begin) & (data.index < end)]
        if len(frame) == int((end - begin) / STEP):
            for side, price in [('hi', frame.h.max()), ('lo', frame.l.min())]:
                out.append(dict(price=float(price), side=side, kind=kind, known=end,
                                expire=end + pd.Timedelta(hours=lifetime)))

    days = sorted(set(data.index.tz_convert(zone).date))
    for day in days:
        midnight = pd.Timestamp(str(day), tz=zone)
        following = pd.Timestamp(str(day + timedelta(days=1)), tz=zone)
        if variant == 'ny':
            session(pd.Timestamp(str(day - timedelta(days=1)) + ' 20:00', tz=zone), midnight, 'asia')
            session(pd.Timestamp(str(day) + ' 02:00', tz=zone), pd.Timestamp(str(day) + ' 05:00', tz=zone), 'london')
        else:
            session(midnight, midnight + pd.Timedelta(hours=7), 'asia')
            session(midnight + pd.Timedelta(hours=7), midnight + pd.Timedelta(hours=12), 'london')
        session(midnight, following, 'pd')
        if variant != 'ny' and day.weekday() == 0:
            session(midnight - pd.Timedelta(days=7), midnight, 'pw', 168)
    htf = complete_bars(data, '4h')
    for i in range(1, len(htf) - 1):
        known = htf.index[i + 1] + pd.Timedelta(hours=4)
        for side, column, compare in [('hi', 'h', max), ('lo', 'l', min)]:
            values = htf[column]
            p = float(values.iloc[i])
            if p != compare(float(values.iloc[i - 1]), p, float(values.iloc[i + 1])):
                continue
            if p == values.iloc[i - 1] or p == values.iloc[i + 1]:
                continue
            out.append(dict(price=p, side=side, kind='swing', known=known,
                            expire=known + pd.Timedelta(days=20)))
    return out


def imbalance_targets(data):
    htf = complete_bars(data, '4h')
    out = []
    for i in range(2, len(htf)):
        known = htf.index[i] + pd.Timedelta(hours=4)
        for side, price, exists in [('lo', htf.l.iloc[i], htf.l.iloc[i] > htf.h.iloc[i-2]),
                                    ('hi', htf.h.iloc[i], htf.h.iloc[i] < htf.l.iloc[i-2])]:
            if exists:
                out.append(dict(price=float(price), side=side, kind='fvg', known=known,
                                expire=known + pd.Timedelta(days=30)))
    return out


def in_window(ts, variant):
    if variant == 'all':
        return True
    t = ts.tz_convert('America/New_York') if variant == 'ny' else ts
    windows = [(2,5), (8,11)] if variant == 'ny' else [(7,10), (13,16)]
    return any(a <= t.hour < b for a, b in windows)


def target_at_entry(data, levels, side, entry_time, tp1):
    eligible = []
    for level in levels:
        if level['side'] != side or not level['known'] <= entry_time < level['expire']:
            continue
        p = level['price']
        if not (p < tp1 if side == 'lo' else p > tp1):
            continue
        past = data[(data.index >= level['known']) & (data.index + STEP <= entry_time)]
        touched = (past.l <= p).any() if side == 'lo' else (past.h >= p).any()
        if not touched:
            eligible.append(p)
    return (max(eligible) if side == 'lo' else min(eligible)) if eligible else None


def replay(data, symbol, variant, as_of) -> dict:
    if variant not in ('ny', 'crypto', 'all'):
        raise ValueError('EXPLICIT_VARIANT_REQUIRED')
    data = closed_candles(data, as_of)
    levels = liquidity_levels(data, variant)
    targets = levels + imbalance_targets(data)
    hourly = complete_bars(data, '1h')
    warmup_end = data.index[0] + 768 * STEP
    candidates = []
    for level in levels:
        eligible = hourly[(hourly.index >= level['known']) & (hourly.index < level['expire'])]
        touched = eligible.h > level['price'] if level['side'] == 'hi' else eligible.l < level['price']
        touched = eligible[touched]
        if touched.empty:
            continue
        sweep_open = touched.index[0]
        if sweep_open < warmup_end:
            continue
        public_level = {k: v.isoformat() if isinstance(v, pd.Timestamp) else v for k,v in level.items()}
        window_ok = in_window(sweep_open, variant)
        visible = data if window_ok else data[data.index < sweep_open + pd.Timedelta(hours=1)]
        result = evaluate_setup(visible, sweep_open, public_level)
        if not window_ok:
            result.update(reason='OUTSIDE_PROPOSED_WINDOW', preview_eligible=False,
                          decision_time=(sweep_open + pd.Timedelta(hours=1)).isoformat(),
                          entry=None, entry_time=None, sl=None, tp1=None, tp2=None)
        if result['preview_eligible']:
            entry_time = pd.Timestamp(result['entry_time'])
            result['tp2'] = target_at_entry(data, targets, 'lo' if result['side'] == 'short' else 'hi',
                                            entry_time, result['tp1'])
            result['tp1_fraction'] = .5 if result['tp2'] is not None else 1.
            result['remaining_sl_after_tp1'] = result['entry'] if result['tp2'] is not None else None
        if result.get('decision_time') is None and result['reason'] != 'PENDING_IFVG':
            result['decision_time'] = (sweep_open + pd.Timedelta(hours=1)).isoformat()
        result.update(symbol=symbol, version=VERSION, variant=variant, venue='MEXC_SPOT',
                      context_status='UNAPPROVED_CONTEXT')
        result['key'] = '|'.join([VERSION, 'MEXC_SPOT', symbol, variant, level['kind'], level['side'],
                                  level['known'].isoformat(), format(level['price'], '.17g'), sweep_open.isoformat()])
        candidates.append(result)
    candidates.sort(key=lambda x: (x['sweep_open'], x['key']))
    counts = Counter(c['reason'] for c in candidates)
    accepted = sum(c['preview_eligible'] for c in candidates)
    pending = counts['PENDING_IFVG']
    return dict(version=VERSION, mode='READ_ONLY_PREVIEW', symbol=symbol, venue='MEXC_SPOT',
                variant=variant, parameter_status='PROPOSED_V02_INHERITANCE',
                deployment_blockers=list(BLOCKERS),
                candles=dict(count=len(data), first_open=data.index[0].isoformat(),
                             latest_open=data.index[-1].isoformat(),
                             latest_close=(data.index[-1] + STEP).isoformat(),
                             latest_close_price=float(data.c.iloc[-1]), as_of=as_of.isoformat(),
                             complete_1h=len(hourly), complete_4h=len(complete_bars(data, '4h'))),
                counts=dict(total=len(candidates), preview_eligible=accepted, pending=pending,
                            rejected=len(candidates)-accepted-pending, production_eligible=0,
                            by_reason=dict(counts)), candidates=candidates)


def verify_prefixes(data, symbol, variant, cuts):
    full = replay(data, symbol, variant, data.index[-1] + STEP)
    checked = []
    for cut in cuts:
        earlier = replay(data, symbol, variant, cut)
        actual = [r for r in earlier['candidates'] if r.get('decision_time') and pd.Timestamp(r['decision_time']) <= cut]
        expected = [r for r in full['candidates'] if r.get('decision_time') and pd.Timestamp(r['decision_time']) <= cut]
        if actual != expected:
            raise AssertionError('PREFIX_LOOKAHEAD_MISMATCH at ' + cut.isoformat())
        checked.append(dict(cut=cut.isoformat(), terminal_candidates=len(actual)))
    return dict(passed=True, checks=checked)


def fetch_public(symbol, bars, as_of):
    """Только публичные GET MEXC SPOT; никаких ключей и торговых методов."""
    end = int(as_of.floor('15min').timestamp() * 1000)
    step = int(STEP.total_seconds() * 1000)
    start = end - bars * step
    raw = []
    requests = []
    while start < end:
        page_end = min(end - 1, start + 500 * step - 1)
        query = urllib.parse.urlencode(dict(symbol=symbol, interval='15m', limit=500,
                                           startTime=start, endTime=page_end))
        url = 'https://api.mexc.com/api/v3/klines?' + query
        requests.append(url)
        page = None
        for attempt in range(3):
            try:
                request = urllib.request.Request(url, headers={'User-Agent': VERSION})
                with urllib.request.urlopen(request, timeout=25) as response:
                    page = json.load(response)
                break
            except (OSError, ValueError):
                if attempt == 2:
                    raise
                time.sleep(attempt + 1)
        if not isinstance(page, list) or not page:
            raise ValueError('PUBLIC_API_EMPTY_OR_ERROR: ' + str(page)[:200])
        raw.extend(page)
        start = page_end + 1
    records = []
    for row in raw:
        if len(row) < 7:
            raise ValueError('PUBLIC_API_BAD_ROW')
        opened = int(row[0])
        if int(row[6]) not in (opened + step - 1, opened + step):
            raise ValueError('PUBLIC_API_INVALID_CLOSE_TIME')
        records.append(dict(t=pd.Timestamp(opened, unit='ms', tz='UTC').isoformat(),
                            **{col:float(value) for col,value in zip('ohlc', row[1:5])}))
    return dict(venue='MEXC_SPOT', symbol=symbol, provenance='REAL_PUBLIC_EXCHANGE_CANDLES',
                fetched_at_utc=pd.Timestamp.now(tz='UTC').isoformat(),
                requests=requests, raw_klines=raw, candles=records)


def main(argv=None):
    parser = argparse.ArgumentParser(description='SMC v0.3 READ-ONLY PREVIEW, не live бот')
    parser.add_argument('--symbol', default='BTCUSDT')
    parser.add_argument('--variant', required=True, choices=['ny', 'crypto', 'all'],
                        help='Явно выбранный эксперимент; production окно не утверждено')
    parser.add_argument('--bars', type=int, default=1920)
    parser.add_argument('--input', type=Path, help='Повтор сохранённого candles.json (без сети)')
    parser.add_argument('--output-dir', type=Path, required=True)
    parser.add_argument('--as-of', help='UTC cutoff; текущая незакрытая 15m не используется')
    parser.add_argument('--verify-prefix', action='store_true')
    args = parser.parse_args(argv)
    here = Path(__file__).resolve().parent
    output = args.output_dir.resolve()
    live = here / 'out'
    if output == live or live in output.parents or output in live.parents:
        raise ValueError('PRODUCTION_OUTPUT_FORBIDDEN')
    for name in ('report.json', 'candles.json'):
        if (output / name).is_symlink():
            raise ValueError('SYMLINK_OUTPUT_FORBIDDEN')
    if not re.fullmatch(r'[A-Z0-9]{5,20}', args.symbol):
        raise ValueError('INVALID_SYMBOL')
    if not 769 <= args.bars <= 10000:
        raise ValueError('BARS_MUST_BE_769_TO_10000')
    as_of = pd.Timestamp(args.as_of) if args.as_of else pd.Timestamp.now(tz='UTC')
    if as_of.tzinfo is None:
        raise ValueError('AS_OF_NEEDS_TIMEZONE')
    as_of = as_of.tz_convert('UTC')
    if args.input:
        source = json.loads(args.input.read_text())
    else:
        source = fetch_public(args.symbol, args.bars, as_of)
    if source.get('venue') != 'MEXC_SPOT' or source.get('symbol') != args.symbol:
        raise ValueError('SOURCE_VENUE_OR_SYMBOL_MISMATCH')
    data = pd.DataFrame(source['candles'])
    data.index = pd.to_datetime(data.pop('t'), utc=True)
    report = replay(data, args.symbol, args.variant, as_of)
    closed = closed_candles(data, as_of)
    if args.verify_prefix:
        # Include every terminal decision and sweep close, plus partial HTF cuts.
        cuts = [closed.index[min(768, len(closed)-1)] + STEP,
                closed.index[len(closed)*3//4] + STEP, closed.index[-2] + STEP]
        cuts += [pd.Timestamp(row[key]) for row in report['candidates']
                 for key in ('decision_time', 'sweep_close') if row.get(key)]
        cuts = sorted(set(cut for cut in cuts if cut >= closed.index[0] + 769 * STEP))
        report['prefix_verification'] = verify_prefixes(closed, args.symbol, args.variant, cuts)
    report['parameters'] = json.loads((here / 'config.v03.preview.json').read_text())
    if (report['parameters'].get('production_enabled') is not False or
            report['parameters'].get('htf_context', {}).get('status') != 'UNAPPROVED_CONTEXT'):
        raise ValueError('PREVIEW_CONFIG_MUST_REMAIN_UNAPPROVED')
    report['source'] = {k:v for k,v in source.items() if k not in ('raw_klines', 'candles')}
    report['generated_at_utc'] = pd.Timestamp.now(tz='UTC').isoformat()
    report['limitations'] = ['Не бэктест доходности; нет позиций, fills, комиссий и отправки.',
                             'Один кандидат на уровень: совпадающие уровни не объединяются.',
                             'Нет HTF context gate: все кандидаты заблокированы для production.']
    output.mkdir(parents=True, exist_ok=True)
    (output / 'candles.json').write_text(json.dumps(source, ensure_ascii=False, indent=2, allow_nan=False) + '\n')
    (output / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False) + '\n')
    print(json.dumps({k:v for k,v in report.items() if k != 'candidates'}, ensure_ascii=False, indent=2))
    return report


if __name__ == '__main__':
    main()
