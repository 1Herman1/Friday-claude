"""Offline audit only. Does not import live detector or perform network requests.
Legacy instrumentation preserves decisions; exported R is NOT validated strategy PnL.
"""
import argparse
import sys
sys.dont_write_bytecode = True
from collections import Counter, defaultdict, deque
import hashlib
import importlib.util
import inspect
import json
from pathlib import Path
import textwrap

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
CACHE = ROOT / 'engine/backtest/cache'


def load_file(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec and spec.loader
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def load_legacy():
    m = load_file(ROOT/'engine/backtest/smc_v02.py', 'legacy_smc_v02')
    m.C = str(CACHE)
    return m


def iso(ns):
    return pd.Timestamp(int(ns), tz='UTC').isoformat()


def causal_target(lt, high, low, targets, side, entry_close, tp1, sign, inclusive=True):
    eligible = []
    for p, kind, s, known, expire in targets:
        if s != side or not known <= entry_close < expire or p * sign >= tp1:
            continue
        a = np.searchsorted(lt, known)
        b = np.searchsorted(lt, entry_close)
        touched = ((low[a:b] <= p).any() if side == 'lo' else (high[a:b] >= p).any()) if inclusive else ((low[a:b] < p).any() if side == 'lo' else (high[a:b] > p).any())
        if not touched:
            eligible.append(p * sign)
    return max(eligible) * sign if eligible else None


def finalize_legacy(record, env):
    e, R, s = env['entry'], env['R'], env['sgn']
    legs = env['audit_legs']
    exits = [dict(fraction=q, price=p*s, mode=mode) for q,p,mode in legs]
    taker_notional = abs(e) + sum(q*abs(p) for q,p,mode in legs if mode=='taker')
    maker_notional = sum(q*abs(p) for q,p,mode in legs if mode=='maker')
    fee = .0005*taker_notional + .0002*maker_notional
    slip = .0002*taker_notional
    gross = sum(q*(e-p) for q,p,mode in legs)/R
    net = float((env['res']-env['cost_in'])/R)
    selected_fvg = next((pair for pair in reversed(env['fv']) if pair[1] < env['ei']))
    record.update(reason='LEGACY_TAKEN', entry_bar_open=iso(env['lt'][env['ei']]),
                  entry_close=iso(env['te']), entry=e*s, stop=env['ext']*s,
                  stop_is_strictly_beyond_extreme=False,
                  tp1=env['tp1']*s, tp2=env['tp2']*s if env['tp2'] is not None else None,
                  exit_bar_open=iso(env['lt'][env['exit_i']]),
                  exit_known_by=iso(env['lt'][env['exit_i']]+env['ltf_ns']),
                  legacy_r_net=net, legacy_gross_R=float(gross),
                  cost_fee_R=float(fee/R), cost_slippage_proxy_R=float(slip/R),
                  cost_total_R=float((fee+slip)/R), legacy_cost_r=float(2*.0007*abs(e)/R),
                  cost_model='V02_ASSUMPTIONS_NOT_VENUE_VERIFIED', funding_R=None,
                  fill_legs=exits, synthetic_fill_model=True,
                  no_fresh_ifvg_cross=bool(env['Cc'][env['ei']-1] < env['live'][-1]),
                  fvg_previously_closed_beyond=bool((env['Cc'][selected_fvg[1]+1:env['ei']] < selected_fvg[0]).any()),
                  fvg_formed_close=iso(env['lt'][selected_fvg[1]]+env['ltf_ns']),
                  forced_exit_at_dataset_end=bool(env['tend']>len(env['lt']) and env['exit_i']==len(env['lt'])-1),
                  production_eligible=False)
    causal = causal_target(env['lt'],env['lh'],env['ll'],env['audit_targets'],env['side'],env['te'],env['tp1'],s)
    record['causal_tp2_same_level_universe'] = causal
    record['target_differs_from_causal_ltf'] = record['tp2'] != causal
    strict = causal_target(env['lt'],env['lh'],env['ll'],env['audit_targets'],env['side'],env['te'],env['tp1'],s,inclusive=False)
    record['causal_tp2_strict_original_touch_rule']=strict
    record['target_aggregation_lookahead_difference']=record['tp2'] != strict
    record['target_equality_touch_difference']=causal != strict
    assert abs(gross - (fee+slip)/R - net) < 1e-8
    assert abs(sum(q for q,p,mode in legs)-1) < 1e-10


def closed_trade_dd(returns, risk=.005):
    equity = np.r_[1., np.cumprod(1.+risk*np.asarray(returns,dtype=float))]
    return float((equity/np.maximum.accumulate(equity)-1.).min())


def preview_adapter(system):
    """Read-only research adapter. Never represents an approved new version.
    1h uses the existing preview unchanged. 15m explicitly maps inherited v02
    timeframes/lookback/deadline/age; warmup remains eight calendar days.
    """
    m=load_file(ROOT/'clusters/smc-btc/v03_preview.py','audit_preview_'+system)
    if system=='1h':
        return m
    if system!='15m':
        raise ValueError('UNKNOWN_SYSTEM')
    m.STEP=pd.Timedelta(minutes=5)
    edits={
        'closed_candles': [('min_bars=768','min_bars=2304')],
        'evaluate_setup': [('pd.Timedelta(hours=1)','pd.Timedelta(minutes=15)'),
            ('len(hour) != 4','len(hour) != 3'),('end = start + 4','end = start + 3'),
            ('pd.Timedelta(hours=12)','pd.Timedelta(hours=3)'),
            ('pd.Timedelta(hours=8)','pd.Timedelta(hours=2)')],
        'liquidity_levels': [("complete_bars(data, '4h')","complete_bars(data, '1h')"),
            ('pd.Timedelta(hours=4)','pd.Timedelta(hours=1)'),('pd.Timedelta(days=20)','pd.Timedelta(days=5)')],
        'imbalance_targets': [("complete_bars(data, '4h')","complete_bars(data, '1h')"),
            ('pd.Timedelta(hours=4)','pd.Timedelta(hours=1)')],
        'replay': [("complete_bars(data, '1h')","complete_bars(data, '15min')"),
            ("complete_bars(data, '4h')","complete_bars(data, '1h')"),
            ('768 * STEP','2304 * STEP'),('pd.Timedelta(hours=1)','pd.Timedelta(minutes=15)')],
    }
    for name,replacements in edits.items():
        source=textwrap.dedent(inspect.getsource(getattr(m,name)))
        for old,new in replacements:
            if old not in source:
                raise RuntimeError('PREVIEW_SOURCE_CHANGED: '+name+':'+old)
            source=source.replace(old,new)
        exec(compile(source,str(HERE/('adapter_'+name+'.py')),'exec'),m.__dict__)
    return m


def instrumented_run(m, sym, system, variant):
    """Guarded source instrumentation; fail closed if original source changes.
    Only adds observations; original DataFrame output is independently compared.
    """
    source = textwrap.dedent(inspect.getsource(m.run))
    def replace(old,new):
        nonlocal source
        if source.count(old) != 1:
            raise RuntimeError('LEGACY_SOURCE_CHANGED: '+old[:80])
        source = source.replace(old,new)
    replace('    P = SYS[system]', '    audit_records=[]; audit_lookup=defaultdict(deque)\n    P = SYS[system]')
    replace('    for p, kind, side, k, e in levels + fvgs:',
            '    audit_targets = levels + fvgs\n    for p, kind, side, k, e in audit_targets:')
    replace("        if kind == 'fvg' or j < 0 or wid[j] < 0: continue", """        if kind != 'fvg' and j >= 0:
            valid_sweep = (above and sc[j] < p) or ((not above) and sc[j] > p)
            reason = 'OUTSIDE_LEGACY_WINDOW' if wid[j]<0 else ('AWAIT_SETUP' if valid_sweep else 'NOT_SWEEP')
            record=dict(symbol=sym, system=system, variant=variant, level_kind=kind,
                        level_price=float(p), level_known=iso(k), level_expire=iso(e),
                        side='short' if above else 'long', sweep_open=iso(st[j]),
                        sweep_close=iso(st[j]+sig_ns), reason=reason, production_eligible=False)
            audit_records.append(record)
            if wid[j]>=0 and valid_sweep:
                audit_lookup[(st[j], 'short' if above else 'long',p,kind,j)].append(record)
        if kind == 'fvg' or j < 0 or wid[j] < 0: continue""")
    replace('        if w in used_w or t0 < busy_until: continue', """        record=audit_lookup[(t0,dirn,L,kind,j)].popleft()
        if w in used_w or t0 < busy_until:
            record['reason']='WINDOW_ALREADY_USED' if w in used_w else 'POSITION_BUSY_AT_SWEEP_OPEN'
            continue""")
    replace('        entry = None', "        entry = None\n        audit_cancelled=False")
    replace('            if Cc[i] > lev: break', "            if Cc[i] > lev:\n                audit_cancelled=True\n                break  #")
    replace('        if entry is None: continue', """        if entry is None:
            record['reason']='BODY_BACK_BEYOND_LEVEL' if audit_cancelled else ('RIGHT_CENSORED_NO_ENTRY' if b>len(lt) else 'NO_IFVG_BEFORE_DEADLINE')
            continue""")
    replace('        if R <= 0: continue', "        if R <= 0:\n            record['reason']='NONPOSITIVE_RISK'\n            continue")
    replace('        stop, half, res, exit_i = ext, False, 0.0, None',
            '        stop, half, res, exit_i = ext, False, 0.0, None\n        audit_legs=[]')
    replace('                px = stop', "                px = stop\n                audit_legs.append((0.5 if half else 1.0,px,'taker'))")
    replace('                    res += entry - tp1 - COST_MAKER * abs(tp1); exit_i = k; break',
            "                    audit_legs.append((1.,tp1,'maker'))\n                    res += entry - tp1 - COST_MAKER * abs(tp1); exit_i = k; break")
    replace('                res += 0.5 * (entry - tp1)', "                record['tp1_then_be_ohlc_ambiguous']=bool(H[k]>=entry)\n                audit_legs.append((.5,tp1,'maker'))\n                res += 0.5 * (entry - tp1)")
    replace('                    res += 0.5 * (entry - tp2)', "                    audit_legs.append((.5,tp2,'maker'))\n                    res += 0.5 * (entry - tp2)")
    replace('\n                res += 0.5 * (entry - tp2)', "\n                audit_legs.append((.5,tp2,'maker'))\n                res += 0.5 * (entry - tp2)")
    replace('            res += q * (entry - px)', "            audit_legs.append((q,px,'taker'))\n            res += q * (entry - px)")
    replace('        used_w.add(w); busy_until', "        finalize_legacy(record,locals())\n        used_w.add(w); busy_until")
    replace('    return pd.DataFrame(trades)', '    return pd.DataFrame(trades), audit_records')
    env = dict(m.__dict__)
    env.update(defaultdict=defaultdict,deque=deque,iso=iso,finalize_legacy=finalize_legacy)
    exec(compile(source, str(HERE/'instrumented_legacy_in_memory.py'), 'exec'),env)
    return env['run'](sym,system,variant)


def jsonable(value):
    if isinstance(value,(np.integer,np.floating,np.bool_)):
        return value.item()
    if isinstance(value,pd.Timestamp):
        return value.isoformat()
    raise TypeError(type(value).__name__)


def save_json(path,value):
    path.write_text(json.dumps(value,ensure_ascii=False,indent=2,default=jsonable,allow_nan=False)+'\n')


def export_records(output,name,records):
    keys=[r['key'] for r in records]
    assert len(keys)==len(set(keys))
    (output/(name+'.jsonl')).write_text(''.join(json.dumps(r,ensure_ascii=False,default=jsonable,allow_nan=False)+'\n' for r in records))
    flat=[{k:json.dumps(v,ensure_ascii=False,default=jsonable) if isinstance(v,(list,dict)) else v for k,v in r.items()} for r in records]
    pd.DataFrame(flat).to_csv(output/(name+'.csv'),index=False)


def hash_file(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def validate(data,step):
    if data.index.has_duplicates or not data.index.is_monotonic_increasing:
        raise ValueError('UNSORTED_OR_DUPLICATE')
    if data.index.tz is None or str(data.index.tz)!='UTC':
        raise ValueError('UTC_REQUIRED')
    if any(t.value%step.value for t in data.index):
        raise ValueError('UNALIGNED_CANDLE')
    if len(data)>1 and not ((data.index[1:]-data.index[:-1])==step).all():
        raise ValueError('GAP_IN_SAVED_CANDLES')
    if not np.isfinite(data.to_numpy()).all() or (data<=0).any().any():
        raise ValueError('NONFINITE_OR_NONPOSITIVE')
    if ((data.h<data[['o','l','c']].max(axis=1)) | (data.l>data[['o','h','c']].min(axis=1))).any():
        raise ValueError('INVALID_OHLC')
    return dict(count=len(data),first_open=data.index[0].isoformat(),last_open=data.index[-1].isoformat(),
                last_close=(data.index[-1]+step).isoformat(),validation='PASS')


def inventory(output):
    summary_path=CACHE/'smc02_summary.json'
    saved=json.loads(summary_path.read_text()) if summary_path.exists() else {}
    rows=[]
    for path in sorted(CACHE.glob('smc02_*.csv')):
        sym,system,variant=path.stem[len('smc02_'):].split('_')
        frame=pd.read_csv(path)
        old=saved.get(' '.join([sym,system,variant]),{}).get('всё',{})
        rows.append(dict(path=str(path.relative_to(ROOT)),count=len(frame),sha256=hash_file(path),
                         rows_match_summary=old.get('n')==len(frame),
                         rounded_net_matches_summary=round(float(frame.r_net.mean()),3)==old.get('avgR')))
    source_path=ROOT/'clusters/smc-btc/preview-v03/20261111-btc-all/candles.json'
    source=json.loads(source_path.read_text())
    frame=pd.DataFrame(source['candles']).set_index('t')
    frame.index=pd.to_datetime(frame.index,utc=True)
    info=validate(frame[list('ohlc')],pd.Timedelta(minutes=15))
    info.update(path=str(source_path.relative_to(ROOT)),sha256=hash_file(source_path),
                venue=source['venue'],fetched_at_utc=source.get('fetched_at_utc'),provenance=source.get('provenance'))
    protected=['engine/backtest/smc_v02.py','clusters/smc-btc/v03_preview.py',
               'clusters/smc-btc/CARD-v0.3.md','clusters/smc-btc/smc_detector.py',
               'clusters/smc-btc/config.json','engine/risk.py','engine/limits.yaml']
    data=dict(saved_csvs=rows,summary=dict(exists=summary_path.exists(),sha256=hash_file(summary_path) if summary_path.exists() else None),
              spot=info,protected_files={p:hash_file(ROOT/p) for p in protected if (ROOT/p).exists()},
              missing=['Saved 5m MEXC spot candles for the November preview','BingX futures candle fixture and tick/fee contract','Original Binance ZIP responses and retrieval-time manifest are not present in cache provenance'])
    save_json(output/'inventory.json',data)
    return data


def audit_legacy(output):
    m=load_legacy()
    summaries=[]
    for sym,system in [('BTCUSDT','15m'),('BTCUSDT','1h'),('ETHUSDT','1h')]:
        path=CACHE/(sym+'_'+m.SYS[system]['ltf']+'_202101_202609.pkl')
        raw=pd.read_pickle(path)
        frame=raw.set_index('t')[list('ohlc')]
        step=pd.Timedelta(m.SYS[system]['ltf'].replace('m','min'))
        provenance=validate(frame,step)
        if not (raw.tc.to_numpy()==(raw.t+step).to_numpy()).all():
            raise ValueError('SAVED_CLOSE_TIME_MISMATCH')
        provenance.update(path=str(path.relative_to(ROOT)),sha256=hash_file(path),
                          venue='BINANCE_UM_AS_LABELLED_BY_LOCAL_LOADER',retrieved_at=None,
                          provenance='SAVED_LOCAL_CACHE_NO_RAW_RESPONSE_ATTESTATION')
        m.load=lambda *args: frame
        for variant in ['ny','crypto','all']:
            print('REPLAY legacy',sym,system,variant,flush=True)
            original=m.run(sym,system,variant)
            traced,records=instrumented_run(m,sym,system,variant)
            pd.testing.assert_frame_equal(original,traced)
            saved_path=CACHE/f'smc02_{sym}_{system}_{variant}.csv'
            saved=pd.read_csv(saved_path)
            # Saved CSV has a derived gross column not returned by run().
            saved.t=pd.to_datetime(saved.t,utc=True)
            pd.testing.assert_frame_equal(original.reset_index(drop=True),saved[original.columns].reset_index(drop=True),check_dtype=False,rtol=1e-10,atol=1e-10)
            for i,r in enumerate(records):
                r['key']='|'.join(['v02-audit',sym,system,variant,str(i)])
                r['cost_model_status']='LEGACY_HYPOTHETICAL' if r['reason']=='LEGACY_TAKEN' else 'NOT_APPLICABLE_NO_FILL'
                if r['reason']!='LEGACY_TAKEN':
                    r.update(cost_total_R=None,cost_fee_R=None,cost_slippage_proxy_R=None)
            taken=sorted((r for r in records if r['reason']=='LEGACY_TAKEN'),key=lambda r:r['entry_close'])
            assert len(taken)==len(original)
            np.testing.assert_allclose([r['legacy_gross_R'] for r in taken],saved.r_gross,rtol=1e-10,atol=1e-10)
            assert not any(r['reason']=='AWAIT_SETUP' for r in records)
            name=f'legacy_{sym}_{system}_{variant}'
            export_records(output,name,records)
            pd.DataFrame(taken).to_csv(output/(name+'_trades.csv'),index=False)
            med=lambda key:float(np.median([r[key] for r in taken]))
            stats=dict(name=name,candles=provenance,first_breaches=len(records),taken=len(taken),
                by_reason=dict(Counter(r['reason'] for r in records)),
                reproduced_original_exactly=True,reproduced_saved_csv=True,
                first_entry_close=taken[0]['entry_close'],last_entry_close=taken[-1]['entry_close'],
                no_explicit_warmup=True,legacy_mean_R=float(original.r_net.mean()),
                median_exact_cost_R=med('cost_total_R'),median_old_cost_r=med('legacy_cost_r'),
                closed_trade_dd_including_initial_equity=closed_trade_dd(original.r_net),
                not_equity_maxdd=True,
                flags={key:sum(bool(r.get(key,False)) for r in taken) for key in [
                    'no_fresh_ifvg_cross','fvg_previously_closed_beyond','target_differs_from_causal_ltf',
                    'target_aggregation_lookahead_difference','target_equality_touch_difference',
                    'tp1_then_be_ohlc_ambiguous','forced_exit_at_dataset_end']})
            summaries.append(stats)
            save_json(output/'legacy_summary.json',summaries)
    return summaries


def annotate_preview(data,m,report,system,venue):
    # Existing preview has venue hardcoded; audit explicitly overrides metadata,
    # not the detector eligibility. No production execution is enabled.
    report['venue']=venue
    report['version']='AUDIT_PROVISIONAL_'+system+'_SWEEP_NOT_RELEASE'
    report['timeframe_interpretation']=dict(sweep=system,entry='5m' if system=='15m' else '15m',
                                          context='1h' if system=='15m' else '4h',context_filter='UNAPPROVED_CONTEXT')
    report['candles']['evaluation_from']=(data.index[0]+pd.Timedelta(days=8)).isoformat()
    report['candles']['complete_sweep_bars']=report['candles'].pop('complete_1h')
    report['candles']['complete_context_bars']=report['candles'].pop('complete_4h')
    if venue!='MEXC_SPOT':
        report['deployment_blockers']=[('VENUE_NOT_BINGX_FUTURES' if x=='SPOT_NOT_BINGX_FUTURES' else x) for x in report['deployment_blockers']]
    report['profitability_status']='NOT_SIMULATED_NO_PROFITABILITY_CONCLUSION'
    for r in report['candidates']:
        r['key']='|'.join(['AUDIT_PROVISIONAL',venue,system,r['key']])
        r['version']=report['version']
        r['venue']=venue
        r['warnings']=list(report['deployment_blockers'])
        r['system']=system
        r['decision']='PREVIEW_SETUP_ONLY_BLOCKED' if r['preview_eligible'] else 'SKIPPED_OR_PENDING'
        r['production_eligible']=False
        r['cost_total_R']=None
        r['funding_R']=None
        r['no_execution_reason']='UNAPPROVED_CONTEXT_WINDOW_STOP_TICK_AND_EXECUTION'
        if r['preview_eligible']:
            e,sl,tp1=r['entry'],r['sl'],r['tp1']
            risk=abs(sl-e)
            assert risk>0 and abs(abs(tp1-e)/risk-2)<1e-8
            assert sl>r['sweep_extreme'] if r['side']=='short' else sl<r['sweep_extreme']
            et=pd.Timestamp(r['entry_time'])
            assert et>pd.Timestamp(r['sweep_close'])
            formed=pd.Timestamp(r['fvg_formed_close'])
            sign=1 if r['side']=='short' else -1
            closes=data.c*sign
            boundary=r['fvg_boundary']*sign
            past=closes[(data.index+m.STEP>formed)&(data.index+m.STEP<et)]
            r['fvg_previously_closed_beyond']=bool((past<boundary).any())
            # Sensitivity figures only, not actual fees or fills.
            r['assumed_entry_plus_stop_cost_R']=(.0007*abs(e)+.0007*abs(sl))/risk
            r['assumed_entry_plus_full_tp1_cost_R']=(.0007*abs(e)+.0002*abs(tp1))/risk
            r['cost_assumption']='V02_PROXY_ONLY_NOT_CURRENT_VENUE_TARIFF'
    return report


def run_preview(output,days=20,verify=True):
    results=[]
    source_path=ROOT/'clusters/smc-btc/preview-v03/20261111-btc-all/candles.json'
    source=json.loads(source_path.read_text())
    spot=pd.DataFrame(source['candles']).set_index('t')
    spot.index=pd.to_datetime(spot.index,utc=True)
    spot=spot[list('ohlc')]
    future_path=CACHE/'BTCUSDT_5m_202101_202609.pkl'
    futures=pd.read_pickle(future_path).set_index('t')[list('ohlc')]
    futures=futures[futures.index>=futures.index[-1]+pd.Timedelta(minutes=5)-pd.Timedelta(days=days)]
    validate(futures,pd.Timedelta(minutes=5))
    variants=[('saved_spot','1h',spot,'MEXC_SPOT',source_path),
              ('saved_futures','15m',futures,'BINANCE_UM_LOCAL_CACHE',future_path),
              ('saved_futures','1h',futures.resample('15min').agg({'o':'first','h':'max','l':'min','c':'last'}),'BINANCE_UM_LOCAL_CACHE',future_path)]
    for label,system,data,venue,path in variants:
        m=preview_adapter(system)
        validate(data,m.STEP)
        for variant in ['all','crypto','ny']:
            print('REPLAY preview',label,system,variant,flush=True)
            cutoff=data.index[-1]+m.STEP
            report=m.replay(data,'BTCUSDT',variant,cutoff)
            old_saved_match=None
            if label=='saved_spot':
                old=json.loads((path.parent.parent/('20261111-btc-'+variant)/'report.json').read_text())
                assert report['candidates']==old['candidates']
                old_saved_match=True
            if verify:
                # Every terminal decision, sweep close, plus inside unfinished HTF.
                cuts={pd.Timestamp(r[k]) for r in report['candidates'] for k in ['decision_time','sweep_close'] if r.get(k)}
                warmup=data.index[0]+pd.Timedelta(days=8)+m.STEP
                cuts.update([warmup,data.index[len(data)*3//4]+m.STEP,data.index[-2]+m.STEP])
                cuts=sorted(c for c in cuts if warmup<=c<=cutoff)
                report['prefix_verification']=m.verify_prefixes(data,'BTCUSDT',variant,cuts)
            report=annotate_preview(data,m,report,system,venue)
            report['source']=dict(path=str(path.relative_to(ROOT)),sha256=hash_file(path),
                                  saved_only=True,no_network=True,retrieval_time=source.get('fetched_at_utc') if label=='saved_spot' else None)
            report['reproduced_saved_candidates_exactly']=old_saved_match
            name=f'preview_{label}_{system}_{variant}'
            export_records(output,name,report['candidates'])
            save_json(output/(name+'.json'),report)
            rows=report['candidates']
            stats=dict(name=name,timeframes=report['timeframe_interpretation'],candles=report['candles'],
                       counts=report['counts'],prefix_checks=len(report.get('prefix_verification',{}).get('checks',[])),
                       prefix_passed=report.get('prefix_verification',{}).get('passed'),
                       reused_previously_inverted_gap=sum(r.get('fvg_previously_closed_beyond',False) for r in rows),
                       realized_cost_R=None,realized_profitability=None)
            results.append(stats)
            save_json(output/'preview_summary.json',results)
    return results


def main(argv=None):
    parser=argparse.ArgumentParser(description='Saved-candle SMC audit: never orders, never live state')
    parser.add_argument('--phase',choices=['inventory','legacy','preview','all'],default='all')
    parser.add_argument('--output-dir',type=Path,default=HERE/'results')
    parser.add_argument('--days',type=int,default=20)
    args=parser.parse_args(argv)
    output=args.output_dir.resolve()
    if HERE not in output.parents:
        raise ValueError('OUTPUT_MUST_BE_INSIDE_AUDIT')
    if output.exists() and any(p.is_symlink() for p in output.rglob('*')):
        raise ValueError('SYMLINK_OUTPUT_FORBIDDEN')
    output.mkdir(parents=True,exist_ok=True)
    initial=inventory(output)
    result={}
    if args.phase in ('legacy','all'):
        result['legacy']=audit_legacy(output)
    if args.phase in ('preview','all'):
        result['preview']=run_preview(output,args.days)
    for path,digest in initial['protected_files'].items():
        assert hash_file(ROOT/path)==digest,'PROTECTED_FILE_CHANGED '+path
    save_json(output/('completed_'+args.phase+'.json'),dict(phase=args.phase,protected_files_unchanged=True,
               artifacts=list(result),live_switch=False,network_orders=False))
    print(json.dumps(dict(phase=args.phase,output=str(output),protected_files_unchanged=True),ensure_ascii=False))
    return result


if __name__=='__main__':
    main()
