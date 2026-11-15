"""Public GET only, indicative funding discovery. Never executes trades."""
from decimal import Decimal, InvalidOperation
from pathlib import Path
from datetime import datetime, timezone
import argparse, json, time, urllib.request, hashlib, os

ENDPOINTS={
 'BingX':[('bingx_contracts','https://open-api.bingx.com/openApi/swap/v2/quote/contracts'),('bingx_funding','https://open-api.bingx.com/openApi/swap/v2/quote/premiumIndex')],
 'Bitget':[('bitget_contracts','https://api.bitget.com/api/v2/mix/market/contracts?productType=USDT-FUTURES'),('bitget_funding','https://api.bitget.com/api/v2/mix/market/current-fund-rate?productType=USDT-FUTURES')],
 'Gate':[('gate_contracts','https://api.gateio.ws/api/v4/futures/usdt/contracts')],
 'Binance':[('binance_contracts','https://fapi.binance.com/fapi/v1/exchangeInfo'),('binance_funding','https://fapi.binance.com/fapi/v1/premiumIndex'),('binance_intervals','https://fapi.binance.com/fapi/v1/fundingInfo')],
 'OKX':[('okx_contracts','https://www.okx.com/api/v5/public/instruments?instType=SWAP'),('okx_funding','https://www.okx.com/api/v5/public/funding-rate?instId=ANY')],
}

def now(): return datetime.now(timezone.utc).isoformat()

def normalize(venue, raw, at):
    def rows(key):
        v=raw.get(key,[])
        if isinstance(v,dict):
            if 'code' in v and str(v['code']) not in ('0','00000'): raise ValueError(str(v)[:300])
            v=v.get('data',v.get('symbols',[]))
        if not isinstance(v,list): raise ValueError('Expected list: '+key)
        return v
    observations=[]
    prefix=venue.lower()
    contracts=rows(prefix+'_contracts')
    funding=rows(prefix+'_funding') if venue!='Gate' else contracts
    bysymbol={r.get('symbol',r.get('instId',r.get('name'))):r for r in funding}
    intervals={r['symbol']:r.get('fundingIntervalHours') for r in rows('binance_intervals')} if venue=='Binance' else {}
    active=0
    for c in contracts:
        symbol=c.get('symbol',c.get('instId',c.get('name','')))
        if venue=='BingX':
            if c.get('status')!=1 or c.get('currency')!='USDT' or not symbol.endswith('-USDT') or str(c.get('apiStateOpen')).lower()!='true': continue
            base=c.get('asset'); multiplier=None
        elif venue=='Bitget':
            if c.get('symbolStatus')!='normal' or c.get('symbolType')!='perpetual' or c.get('quoteCoin')!='USDT' or 'USDT' not in c.get('supportMarginCoins',[]): continue
            base=c.get('baseCoin'); multiplier=None
        elif venue=='Gate':
            if not symbol.endswith('_USDT') or c.get('type')!='direct' or c.get('status')!='trading' or c.get('in_delisting') or c.get('is_pre_market'): continue
            base=symbol[:-5]; multiplier=c.get('quanto_multiplier')
        elif venue=='Binance':
            if c.get('status')!='TRADING' or c.get('contractType')!='PERPETUAL' or c.get('quoteAsset')!='USDT' or c.get('marginAsset')!='USDT': continue
            base=c.get('baseAsset'); multiplier=None
        else:
            if c.get('state')!='live' or c.get('ctType')!='linear' or c.get('settleCcy')!='USDT' or not symbol.endswith('-USDT-SWAP'): continue
            base=symbol[:-10]; multiplier=c.get('ctVal')
        active+=1
        if not base: continue
        f=bysymbol.get(symbol,{})
        if venue=='BingX': rate=f.get('lastFundingRate'); interval=f.get('fundingIntervalHours'); nxt=f.get('nextFundingTime')
        elif venue=='Bitget': rate=f.get('fundingRate'); interval=f.get('fundingRateInterval',c.get('fundInterval')); nxt=f.get('nextUpdate')
        elif venue=='Gate':
            rate=f.get('funding_rate'); seconds=number(f.get('funding_interval')); interval=seconds/3600 if seconds is not None else None
            seconds=number(f.get('funding_next_apply')); nxt=seconds*1000 if seconds is not None else None
        elif venue=='Binance': rate=f.get('lastFundingRate'); interval=intervals.get(symbol); nxt=f.get('nextFundingTime')
        else:
            rate=f.get('fundingRate'); start,end=number(f.get('fundingTime')),number(f.get('nextFundingTime'))
            interval=(end-start)/3600000 if start is not None and end is not None and end>start else None
            nxt=f.get('fundingTime')
        url=ENDPOINTS[venue][-1][1] if venue!='Binance' else ENDPOINTS[venue][1][1]
        o=observation(venue,symbol,base,rate,interval,nxt,at,url)
        o['contract_multiplier']=multiplier
        o['source_timestamp_ms']=f.get('ts',f.get('time',f.get('updateTime')))
        o['funding_record_present']=bool(f)
        observations.append(o)
    return observations,dict(metadata_records=len(contracts),active_usdt_perpetual=active,funding_records=len(funding),matched_funding=sum(o['funding_record_present'] for o in observations),missing_intervals=sum(o['interval_hours'] is None for o in observations))


def atomic(path,payload):
    path=Path(path); path.parent.mkdir(parents=True,exist_ok=True)
    tmp=path.with_suffix(path.suffix+'.tmp')
    with tmp.open('w') as f:
        json.dump(payload,f,ensure_ascii=False,indent=2); f.flush(); os.fsync(f.fileno())
    tmp.replace(path)


def public_get(url):
    # Explicit empty ProxyHandler avoids reading proxy environment settings.
    opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
    with opener.open(urllib.request.Request(url,headers={'User-Agent':'FundingMonitor/1.0','Accept':'application/json'},method='GET'),timeout=12) as response:
        return response.read(16000000)


def collect(out,venues=None,fetch=public_get):
    out=Path(out); out.mkdir(parents=True,exist_ok=True)
    started=now(); run_id=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S.%fZ')
    rawdir=out/'raw'/run_id; rawdir.mkdir(parents=True)
    events=[]; sources=[]; observations=[]
    progress=dict(schema_version=1,run_id=run_id,running=True,started_at=started,updated_at=started,current_venue=None,sources=sources,events=events)
    previous=None
    if (out/'latest.json').exists():
        try: previous=json.loads((out/'latest.json').read_text()).get('completed_at')
        except (OSError,ValueError): pass
    progress['previous_snapshot_at']=previous
    def event(stage,status,message):
        e=dict(at=now(),stage=stage,status=status,message=message); events.append(e)
        progress['updated_at']=e['at']; atomic(out/'progress.json',progress)
        with (out/'events.jsonl').open('a') as f: f.write(json.dumps(e)+'\n')
        print(json.dumps(e),flush=True)
    event('collection','running','Public GET collection started')
    manifest=dict(run_id=run_id,started_at=started,requests=[],venues=venues or list(ENDPOINTS))
    for venue in manifest['venues']:
        progress['current_venue']=venue
        src=dict(venue=venue,status='running',records=0,error=None); sources.append(src)
        event(venue,'running','Fetching public bulk contract/funding data')
        raw={}; errors=[]
        for key,url in ENDPOINTS[venue]:
            event(venue,'request',url)
            req=dict(key=key,url=url,requested_at=now(),venue=venue)
            try:
                body=fetch(url); (rawdir/(key+'.json')).write_bytes(body)
                req.update(sha256=hashlib.sha256(body).hexdigest(),bytes=len(body),received_at=now(),file=key+'.json')
                raw[key]=json.loads(body,parse_float=str)
                if isinstance(raw[key],dict) and 'code' in raw[key] and str(raw[key]['code']) not in ('0','00000'): raise ValueError(str(raw[key])[:300])
                event(venue,'received',key+' bytes='+str(len(body)))
            except Exception as exc:
                req['error']=type(exc).__name__+': '+str(exc); errors.append(key+': '+req['error'])
                event(venue,'error',errors[-1])
            manifest['requests'].append(req); atomic(rawdir/'manifest.json',manifest)
            time.sleep(0.25)
        try:
            obs,stats=normalize(venue,raw,now()); observations.extend(obs); src.update(stats)
            src['records']=len(obs)
            if not obs: errors.append('No verified active USDT perpetual observations')
            elif not stats['matched_funding']: errors.append('No matched funding records')
        except Exception as exc: errors.append(type(exc).__name__+': '+str(exc))
        src['status']='partial' if errors and src['records'] else 'error' if errors else 'ok'
        src['error']='; '.join(errors) if errors else None
        src['observed_at']=now()
        manifest.setdefault('observed_at',{})[venue]=src['observed_at']
        # Preserve precise normalization timestamp for deterministic replay.
        for o in observations:
            if o['venue']==venue: o['observed_at']=src['observed_at']
        event(venue,src['status'],str(src['records'])+' observations'+('; '+src['error'] if src['error'] else ''))
    observations.sort(key=lambda o:(o['funding_rate'] is not None,abs(Decimal(o['funding_rate'] or '0'))),reverse=True)
    good=sum(s['status']=='ok' for s in sources)
    status='ok' if good==len(sources) else 'partial' if observations else 'error'
    event('collection',status,'Collection complete: '+str(len(observations))+' observations')
    completed=now()
    result=dict(schema_version=1,run_id=run_id,started_at=started,completed_at=completed,status=status,sources=sources,observations=observations,pairs=make_pairs(observations),events=events)
    manifest['completed_at']=completed; atomic(rawdir/'manifest.json',manifest)
    atomic(out/'latest.json',result)
    progress.update(running=False,completed_at=completed,current_venue=None,status=status); atomic(out/'progress.json',progress)
    return result


def replay(rawdir):
    rawdir=Path(rawdir); manifest=json.loads((rawdir/'manifest.json').read_text()); obs=[]
    for venue in manifest['venues']:
        raw={}
        for req in manifest['requests']:
            if req['venue']!=venue or req.get('error'): continue
            body=(rawdir/req['file']).read_bytes()
            if hashlib.sha256(body).hexdigest()!=req['sha256']: raise ValueError('Raw SHA256 mismatch: '+req['file'])
            raw[req['key']]=json.loads(body,parse_float=str)
        try: rows,_=normalize(venue,raw,manifest['observed_at'][venue]); obs.extend(rows)
        except (ValueError,KeyError): pass
    obs.sort(key=lambda o:(o['funding_rate'] is not None,abs(Decimal(o['funding_rate'] or '0'))),reverse=True)
    return dict(observations=obs,pairs=make_pairs(obs))

def number(value):
    if value is None or isinstance(value,bool): return None
    try:
        d=Decimal(str(value))
        return d if d.is_finite() else None
    except (InvalidOperation,ValueError): return None

def text(value):
    return format(value,'f') if value is not None else None

def observation(venue,symbol,base,rate,interval,next_ms,at,url):
    r,h=number(rate),number(interval)
    h=h if h is not None and h>0 else None
    t=number(next_ms)
    return dict(asset_id=base,symbol=symbol,venue=venue,market_type='USDT_PERPETUAL',funding_rate=text(r),interval_hours=text(h),next_funding_ms=int(t) if t is not None and t>0 else None,observed_at=at,volume_quote_24h=None,liquidity_class='UNKNOWN',source_url=url,rate_per_hour=text(r/h) if r is not None and h is not None else None,identity_status='EXACT_TICKER_ONLY_UNVERIFIED',contract_multiplier=None)


def make_pairs(observations):
    from itertools import combinations
    groups={}
    for o in observations:
        if o['funding_rate'] is not None: groups.setdefault(o['asset_id'],[]).append(o)
    pairs=[]
    for asset, rows in groups.items():
        for a,b in combinations(rows,2):
            if a['venue']==b['venue']: continue
            known_intervals=bool(a['interval_hours'] and b['interval_hours'])
            long,short=sorted([a,b],key=lambda o:Decimal(o['funding_rate'])/Decimal(o['interval_hours']) if known_intervals else Decimal(o['funding_rate']))
            reasons=['LIQUIDITY_UNVERIFIED','ACCOUNT_FEES_UNVERIFIED','EXIT_RISK_UNVERIFIED','TOKEN_IDENTITY_AND_UNITS_UNVERIFIED','INDICATIVE_NOT_LOCKED']
            if a['interval_hours']!=b['interval_hours']: reasons.append('UNEQUAL_INTERVALS')
            if a['next_funding_ms']!=b['next_funding_ms']: reasons.append('UNEQUAL_SETTLEMENT_TIMES')
            if a['next_funding_ms'] is None or b['next_funding_ms'] is None: reasons.append('SETTLEMENT_TIME_UNKNOWN')
            diff=None
            if long['interval_hours'] and short['interval_hours']:
                diff=Decimal(short['funding_rate'])/Decimal(short['interval_hours'])-Decimal(long['funding_rate'])/Decimal(long['interval_hours'])
            else: reasons.append('INTERVAL_UNKNOWN')
            pairs.append(dict(asset_id=asset,long_venue=long['venue'],short_venue=short['venue'],long_rate=long['funding_rate'],short_rate=short['funding_rate'],indicative_diff_per_hour=text(diff),status='HOLD',reasons=reasons))
    return sorted(pairs,key=lambda p: (p['indicative_diff_per_hour'] is not None,Decimal(p['indicative_diff_per_hour'] or '0')),reverse=True)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--once',action='store_true')
    parser.add_argument('--interval',type=float,default=60,help='seconds between completed cycles; minimum 15')
    parser.add_argument('--out',type=Path,default=Path(__file__).resolve().parent/'out')
    parser.add_argument('--replay',type=Path,help='saved raw run directory; no network')
    args=parser.parse_args()
    if args.interval<15: parser.error('--interval must be at least 15 seconds')
    if args.replay:
        result=replay(args.replay)
        print(json.dumps(dict(observations=len(result['observations']),pairs=len(result['pairs']),raw_dir=str(args.replay))))
        return
    try:
        while True:
            result=collect(args.out)
            print(json.dumps(dict(run_id=result['run_id'],status=result['status'],observations=len(result['observations']),pairs=len(result['pairs']))),flush=True)
            if args.once: return
            time.sleep(args.interval)
    except KeyboardInterrupt: return

if __name__=='__main__': main()
