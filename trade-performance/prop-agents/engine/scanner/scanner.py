"""Isolated public market scanner. No exchange credentials or trading methods."""
from decimal import Decimal, InvalidOperation
import json
import subprocess
import time
from urllib.parse import urlencode
from typing import Any


class PublicClient:
    BASE = 'https://open-api.bingx.com/openApi/swap/v2/quote/'
    ALLOWED = {'contracts': {'symbol'}, 'ticker': {'symbol'}, 'premiumIndex': {'symbol'},
               'openInterest': {'symbol'}, 'trades': {'symbol', 'limit'}}

    def __init__(self, retries=1):
        self.retries = retries
        self.last_call = {}
        self.audit = []

    def get(self, endpoint, params=None):
        params = params or {}
        if endpoint not in self.ALLOWED or set(params) - self.ALLOWED[endpoint]:
            raise ValueError('Only allowlisted public GET endpoints/parameters are permitted')
        url = self.BASE + endpoint + ('?' + urlencode(params) if params else '')
        for attempt in range(self.retries + 1):
            # Endpoint quotas are independent; never burst the documented 1/s endpoints.
            time.sleep(max(0, 1.05 - (time.monotonic() - self.last_call.get(endpoint, 0))))
            self.last_call[endpoint] = time.monotonic()
            started = time.monotonic()
            try:
                response = subprocess.run(['curl', '--disable', '--silent', '--show-error', '--fail',
                                           '--connect-timeout', '8', '--max-time', '25',
                                           '--proto', '=https', '--request', 'GET', url],
                                          capture_output=True, text=True, timeout=27)
                if response.returncode:
                    raise RuntimeError('curl exit %s: %s' % (response.returncode, response.stderr.strip()))
                payload = json.loads(response.stdout, parse_float=str)
                if payload.get('code') != 0 or 'data' not in payload:
                    raise RuntimeError('API error: %s' % response.stdout[:250])
                self.audit.append(dict(endpoint=endpoint, params=params, attempt=attempt + 1,
                                       ok=True, elapsed_seconds=round(time.monotonic()-started, 3)))
                return payload['data']
            except (RuntimeError, ValueError, subprocess.TimeoutExpired) as error:
                self.audit.append(dict(endpoint=endpoint, params=params, attempt=attempt + 1,
                                       ok=False, error=str(error), elapsed_seconds=round(time.monotonic()-started, 3)))
                if attempt == self.retries:
                    raise RuntimeError(str(error)) from error
                time.sleep(0.5)



def number(value):
    try:
        result = Decimal(str(value))
        return result if result.is_finite() else None
    except InvalidOperation:
        return None


def build_snapshot(contracts, tickers, funding, oi, timestamp) -> dict:
    universe = {x['symbol']: x for x in contracts if x.get('status') == 1 and x.get('currency') == 'USDT' and x.get('symbol', '').endswith('-USDT')}
    ticker_map = {x['symbol']: x for x in tickers}
    funding_map = {x['symbol']: x for x in funding}
    markets = []
    for symbol in sorted(universe):
        ticker, premium = ticker_map.get(symbol, {}), funding_map.get(symbol, {})
        price, change, volume = (number(ticker.get(k)) for k in ('lastPrice', 'priceChangePercent', 'quoteVolume'))
        rate = number(premium.get('lastFundingRate'))
        interest = number(oi.get(symbol, {}).get('openInterest'))
        flags = []
        if change is not None and abs(change) >= 20:
            flags.append('pump_24h_threshold' if change >= 20 else 'dump_24h_threshold')
        if rate is not None and abs(rate) >= Decimal('0.001'):
            flags.append('funding_absolute_threshold')
        markets.append(dict(symbol=symbol, last_price=str(price) if price is not None else None,
                            change_24h_pct=str(change) if change is not None else None,
                            quote_volume_24h=str(volume) if volume is not None else None,
                            funding_rate=str(rate) if rate is not None else None,
                            funding_interval_hours=premium.get('fundingIntervalHours'),
                            funding_updated_ms=premium.get('updateTime'),
                            next_funding_ms=premium.get('nextFundingTime'),
                            ticker_close_ms=ticker.get('closeTime'),
                            open_interest=str(interest) if interest is not None else None,
                            oi_time_ms=oi.get(symbol, {}).get('time'),
                            oi_unit='exchange_native_unverified', history_status='not_collected',
                            volume_anomaly=None, oi_anomaly=None, buy_flow=None, flags=flags))
    volumes = sorted(v for v in (number(ticker_map[s].get('quoteVolume')) for s in universe if s in ticker_map) if v is not None and v > 0)
    median_volume = (volumes[(len(volumes)-1)//2] + volumes[len(volumes)//2]) / 2 if volumes else None
    for market in markets:
        volume = number(market['quote_volume_24h'])
        ratio = volume / median_volume if volume is not None and median_volume else None
        market['volume_vs_universe_median'] = str(ratio) if ratio is not None else None
        if ratio is not None and ratio >= 10:
            market['flags'].append('high_cross_sectional_turnover')
    return dict(schema_version=1, generated_at=timestamp, read_only=True, markets=markets,
                coverage=dict(universe_count=len(universe), contracts_received=len(contracts),
                              tickers_received=len(tickers), ticker_present=sum(s in ticker_map for s in universe),
                              ticker_missing=sorted(set(universe)-set(ticker_map)),
                              funding_present=sum(x['funding_rate'] is not None for x in markets),
                              oi_present=sum(x['open_interest'] is not None for x in markets)), failures=[])


def collect(client, oi_limit=0, flow_limit=0):
    from datetime import datetime, timezone
    started = datetime.now(timezone.utc).isoformat()
    raw, failures = {}, []

    def fetch(endpoint, params=None, expected: type = list) -> Any:
        try:
            data = client.get(endpoint, params)
            if not isinstance(data, expected) or (isinstance(data, list) and not all(isinstance(x, dict) and (endpoint == 'trades' or isinstance(x.get('symbol'), str)) for x in data)):
                raise RuntimeError('Unexpected response shape for ' + endpoint)
            key = endpoint + (':' + params['symbol'] if params and 'symbol' in params else '')
            raw[key] = {'received_at': datetime.now(timezone.utc).isoformat(), 'data': data}
            return data
        except (RuntimeError, ValueError) as error:
            failures.append(dict(endpoint=endpoint, symbol=(params or {}).get('symbol'), error=str(error)))
            return None

    contracts = fetch('contracts')
    if not contracts:
        return dict(schema_version=1, generated_at=started, read_only=True, status='failed',
                    coverage={'universe_count': None}, markets=[], failures=failures or [{'endpoint': 'contracts', 'error': 'Empty universe'}], request_audit=client.audit), raw
    tickers = fetch('ticker') or []
    funding = fetch('premiumIndex') or []
    snapshot = build_snapshot(contracts, tickers, funding, {}, started)
    if snapshot['coverage']['universe_count'] == 0:
        snapshot.update(status='failed', request_audit=client.audit,
                        failures=failures + [{'endpoint': 'contracts', 'error': 'No usable active USDT contracts'}])
        return snapshot, raw
    ordered = sorted(snapshot['markets'], key=lambda m: abs(number(m['change_24h_pct']) or Decimal(0)), reverse=True)
    oi_targets = ordered if oi_limit < 0 else ordered[:oi_limit]
    flow_targets = ordered if flow_limit < 0 else ordered[:flow_limit]
    for market in oi_targets:
        data = fetch('openInterest', {'symbol': market['symbol']}, dict)
        if data is not None:
            interest = number(data.get('openInterest'))
            if data.get('symbol') != market['symbol'] or interest is None or interest < 0:
                failures.append(dict(endpoint='openInterest', symbol=market['symbol'], error='Invalid symbol/value'))
                continue
            market['open_interest'], market['oi_time_ms'] = str(interest), data.get('time')
    for market in flow_targets:
        data = fetch('trades', {'symbol': market['symbol'], 'limit': 1000})
        if data is not None:
            market['buy_flow'] = trade_flow(data)
    for symbol in snapshot['coverage']['ticker_missing']:
        failures.append(dict(endpoint='ticker', symbol=symbol, error='Contract absent from bulk ticker'))
    coverage = snapshot['coverage']
    coverage.update(oi_attempted=len(oi_targets), oi_present=sum(m['open_interest'] is not None for m in ordered),
                    oi_not_requested_count=len(ordered)-len(oi_targets),
                    buy_flow_attempted=len(flow_targets), buy_flow_present=sum(m['buy_flow'] is not None for m in ordered),
                    buy_flow_not_requested_count=len(ordered)-len(flow_targets),
                    funding_missing=[m['symbol'] for m in ordered if m['funding_rate'] is None],
                    ticker_invalid=[m['symbol'] for m in ordered if m['last_price'] is None or m['change_24h_pct'] is None or m['quote_volume_24h'] is None])
    snapshot.update(failures=failures, request_audit=client.audit,
                    completed_at=datetime.now(timezone.utc).isoformat(),
                    status='partial' if failures or coverage['funding_missing'] or coverage['ticker_invalid'] or coverage['oi_not_requested_count'] or coverage['buy_flow_not_requested_count'] else 'complete',
                    limitations=['No historical baseline: temporal volume and OI anomalies unknown.',
                                 'Cross-sectional volume is NOT a volume spike.',
                                 'Recent taker trades are NOT capital inflow or a market-wide flow measure.',
                                 'OI exchange-native units unverified; no notional conversion.',
                                 'Snapshots are collected sequentially, not atomic.'],
                    thresholds={'price_24h_abs_pct': '20', 'funding_abs_decimal': '0.001', 'cross_sectional_volume_median_multiple': '10'})
    return snapshot, raw


def save_artifacts(snapshot, raw, directory):
    directory.mkdir(parents=True, exist_ok=True)
    paths = {name: directory / filename for name, filename in [('snapshot', 'snapshot.json'), ('report', 'report.html'), ('raw', 'raw.json')]}
    paths['snapshot'].write_text(json.dumps(snapshot, ensure_ascii=False, indent=2), encoding='utf-8')
    paths['raw'].write_text(json.dumps(raw, ensure_ascii=False, indent=2), encoding='utf-8')
    paths['report'].write_text(render_report(snapshot), encoding='utf-8')
    return paths


def main():
    import argparse
    from pathlib import Path
    from datetime import datetime, timezone
    parser = argparse.ArgumentParser(description='Read-only BingX public USDT perpetual scanner. Partial data => exit 2, fatal universe failure => exit 1.')
    parser.add_argument('--out', type=Path, default=None, help='Output directory (must be inside scanner/)')
    parser.add_argument('--oi-limit', type=int, default=0, help='OI symbol count, descending abs price change; -1 = all, 0 = not requested (default)')
    parser.add_argument('--flow-limit', type=int, default=0, help='Recent-trade sample symbol count; -1 = all, 0 = not requested (default)')
    parser.add_argument('--retries', type=int, choices=[0, 1, 2], default=1)
    args = parser.parse_args()
    if args.oi_limit < -1 or args.flow_limit < -1:
        parser.error('limits must be -1 or nonnegative')
    root = Path(__file__).resolve().parent
    out = args.out or root / 'artifacts' / datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    out = out.resolve()
    if out != root and root not in out.parents:
        parser.error('Output must remain inside engine/scanner/')
    snapshot, raw = collect(PublicClient(args.retries), args.oi_limit, args.flow_limit)
    paths = save_artifacts(snapshot, raw, out)
    print(json.dumps({'status': snapshot['status'], 'generated_at': snapshot['generated_at'], 'coverage': snapshot['coverage'], 'failures': snapshot['failures'], 'artifacts': {k: str(v) for k, v in paths.items()}}, indent=2))
    return 1 if snapshot['status'] == 'failed' else 2 if snapshot['status'] == 'partial' else 0


def trade_flow(trades):
    buy = sell = Decimal(0)
    classified = unknown = 0
    times = []
    seen = set()
    for trade in trades:
        identifier = trade.get('fillId', trade.get('id'))
        if identifier is not None:
            if identifier in seen:
                continue
            seen.add(identifier)
        maker = trade.get('isBuyerMaker', trade.get('buyerMaker'))
        quote = number(trade.get('quoteQty'))
        if not isinstance(maker, bool) or quote is None or quote < 0:
            unknown += 1
            continue
        if maker:
            sell += quote
        else:
            buy += quote
        classified += 1
        if isinstance(trade.get('time'), int):
            times.append(trade['time'])
    return dict(taker_buy_quote=str(buy) if classified else None,
                taker_sell_quote=str(sell) if classified else None,
                taker_buy_fraction=str(buy / (buy+sell)) if buy+sell else None,
                classified_trades=classified, unclassified_trades=unknown,
                window_ms=[min(times), max(times)] if times else None,
                scope='recent_trades_sample_not_market_wide_capital_inflow')


def render_report(snapshot):
    from html import escape
    def cell(value):
        return escape('unknown' if value is None else str(value))
    columns = ['symbol', 'last_price', 'change_24h_pct', 'quote_volume_24h',
               'volume_vs_universe_median', 'funding_rate', 'funding_interval_hours', 'open_interest']
    rows = []
    for market in sorted(snapshot['markets'], key=lambda m: abs(number(m.get('change_24h_pct')) or Decimal(0)), reverse=True):
        rows.append('<tr>' + ''.join('<td>'+cell(market.get(key))+'</td>' for key in columns)
                    + '<td>'+cell((market.get('buy_flow') or {}).get('taker_buy_fraction'))+'</td>'
                    + '<td>'+cell(', '.join(market['flags']) or 'none')+'</td></tr>')
    return '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>BingX · Read-only market scanner</title><style>
body{background:#10151e;color:#e8edf5;font:14px system-ui;margin:30px}h1{font-size:26px}pre{white-space:pre-wrap;color:#b9c9df}
.notice{background:#253044;padding:16px;border-left:4px solid #e4ab55;line-height:1.6}input{padding:10px;margin:16px 0;background:#1a2537;color:white;border:1px solid #506079;width:300px}
table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}td,th{padding:9px;border-bottom:1px solid #344052;text-align:right}td:first-child,th:first-child{text-align:left}thead{background:#253044;position:sticky;top:0}tr:hover{background:#1c293a}.wrap{overflow:auto}small{color:#abb9ce}</style>
<h1>BingX · USDT perpetual scanner · READ ONLY</h1><p>Snapshot: '''+cell(snapshot['generated_at'])+'''</p>
<div class="notice">All active USDT-settled perpetuals, including non-crypto underlyings if listed by BingX. Price ±20% / 24h = threshold screen, NOT a buy/sell signal.<br>
Volume × median = cross-sectional turnover, NOT a temporal volume spike. Volume/OI anomaly history: not collected (unknown).<br>
Funding is a decimal per reported interval, not an annual rate. OI units are exchange-native, unverified; no USD conversion.<br>
Buy flow = sampled taker-buy share, NOT net capital inflow, not proof of accumulation. Missing data stays unknown.</div>
<h2>Coverage / gaps</h2><pre>'''+cell(json.dumps(snapshot['coverage'], indent=2))+'''</pre><h2>Failures</h2><pre>'''+cell(json.dumps(snapshot.get('failures', []), indent=2))+'''</pre>
<input id="filter" placeholder="Filter symbol or flag" aria-label="Filter markets"><small>All markets shown; sorted by absolute 24h price change.</small><div class="wrap"><table><thead><tr>'''+''.join('<th>'+cell(k)+'</th>' for k in columns+['sample_buy_fraction', 'flags'])+'''</tr></thead><tbody>'''+''.join(rows)+'''</tbody></table></div><script>document.getElementById('filter').addEventListener('input',e=>{const q=e.target.value.toLowerCase();document.querySelectorAll('tbody tr').forEach(r=>r.hidden=!r.textContent.toLowerCase().includes(q));});</script></html>'''


if __name__ == '__main__':
    raise SystemExit(main())
