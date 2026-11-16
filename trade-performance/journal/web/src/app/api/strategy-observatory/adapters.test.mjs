import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildObservatory, SOURCE_PATHS, readSource, parseExactJson } from './adapters.ts';

async function fixture(fn) {
 const root = await mkdtemp(join(tmpdir(), 'observatory-'));
 const put = async (key, value) => { const file = join(root,SOURCE_PATHS[key]); await mkdir(join(file,'..'),{recursive:true}); await writeFile(file,typeof value === 'string' ? value : JSON.stringify(value)); };
 try { await fn(root,put); } finally { await rm(root,{recursive:true,force:true}); }
}

test('safe reader rejects malformed, schema-invalid, oversize and symlink sources', async () => fixture(async(root,put)=>{
 await put('funding','{oops'); assert.match((await readSource(root,'funding')).issue,/INVALID_JSON/);
 await put('funding',{}); assert.match((await readSource(root,'funding')).issue,/INVALID_SCHEMA/);
 await put('signal',' '.repeat(50_001)); assert.match((await readSource(root,'signal')).issue,/SIZE_LIMIT/);
 await put('progress',{running:true,updated_at:'2026-11-01T00:00:00Z',events:[]});
 await rm(join(root,SOURCE_PATHS.signal));
 await symlink(join(root,SOURCE_PATHS.progress),join(root,SOURCE_PATHS.signal));
 assert.match((await readSource(root,'signal')).issue,/SYMLINK_BLOCKED/);
}));

test('preserves exact numeric financial lexemes and separates progress from snapshot', async()=>fixture(async(root,put)=>{
 assert.equal(parseExactJson('{"price":0.000000000000000001,"label":"50"}').price,'0.000000000000000001');
 await put('funding',{completed_at:'2026-11-01T00:00:00Z',run_id:'completed',status:'ok',sources:[],observations:[{}],pairs:[{asset_id:'BTC',long_rate:'-0.00010000',short_rate:'0.00020000',indicative_diff_per_hour:'0.00030000'}]});
 await put('progress',{running:true,updated_at:'2026-11-16T20:00:00Z',run_id:'in-progress',events:[]});
 const p=(await buildObservatory(root,new Date('2026-11-16T20:00:00Z'))).strategies[0];
 assert.equal(p.state,'stale'); assert.equal(p.rows[0].long_rate,'-0.00010000');
 assert.equal(p.facts.find(f=>f.label==='Текущий run').value,'in-progress');
 assert.equal(p.facts.find(f=>f.label==='Завершённый run').value,'completed');
 assert.equal(p.stages.find(s=>s.id==='data').state,'running');
 assert.equal(p.stages.find(s=>s.id==='data').at,'2026-11-16T20:00:00Z');
 await put('progress',{running:true,updated_at:'2026-11-16T19:00:00Z',events:[]});
 const stale=(await buildObservatory(root,new Date('2026-11-16T20:00:00Z'))).strategies[0];
 assert.notEqual(stale.stages.find(s=>s.id==='data').state,'running');
}));

test('approved stored pump signals supersede proxy without exposing private trade fields',async()=>fixture(async(root)=>{
 const p=(await buildObservatory(root,new Date('2026-11-16T20:00:00Z'),{pump:{rows:[{id:'s1',base:'BTC',side:'SHORT',mode:'LIVE',status:'LOSS',setup_time:new Date('2026-11-16T13:00:00Z'),entry:'0.00000000100',stop_loss:'0.00000000200',tp:null,simulated_r:'-1.00',rise:'0.71',trade_net:'SECRET_PRIVATE_NET'}],error:null}})).strategies[2];
 assert.equal(p.mode,'SAVED_SIGNALS'); assert.equal(p.total_rows,1);
 assert.equal(p.rows[0].entry,'0.00000000100'); assert.match(p.market,/MEXC/);
 assert.equal(JSON.stringify(p).includes('SECRET_PRIVATE_NET'),false);
 assert.ok(p.blockers.includes('NOT_REAL_ORDER_EVIDENCE'));
}));

test('DB failure exposes saved ±20 proxy and explicit blocker, never user short strategy',async()=>fixture(async(root,put)=>{
 await put('pump',{generated_at:'2026-11-14T00:00:00Z',markets:[{symbol:'<B>TC',last_price:'1.00000000',change_24h_pct:'21.00',flags:['pump_24h_threshold']}]});
 const p=(await buildObservatory(root,new Date('2026-11-16T20:00:00Z'),{pump:{rows:[],error:'READ_ONLY_DB_TIMEOUT_900MS'}})).strategies[2];
 assert.equal(p.mode,'PREVIEW'); assert.equal(p.state,'stale'); assert.equal(p.total_rows,1);
 assert.equal(p.rows[0].symbol,'BTC'); assert.ok(p.blockers.some(b=>b.includes('DB_TIMEOUT')));
 assert.match(p.subtitle,/НЕ стратегия/);
}));

test('SMC source count discrepancy is explicit and historical variants remain separate',async()=>fixture(async(root,put)=>{
 await put('smc',{version:'test-preview',candles:{as_of:'2026-11-16T20:00:00Z'},counts:{total:2,production_eligible:0},candidates:[{symbol:'BTCUSDT',entry:1.00000001,production_eligible:false}]});
 const variant=(sharpe)=>({note:'saved',splits:{'2021–2023':{Sharpe:sharpe},'2024–2026.09':{Sharpe:sharpe},'Весь период':{Sharpe:sharpe}}});
 await put('backtest',{S1:variant('0.81'),S4:variant('0.61'),S4L:variant('0.95')});
 const panels=(await buildObservatory(root,new Date('2026-11-16T20:00:00Z'))).strategies;
 assert.ok(panels[1].blockers.includes('SOURCE_COUNT_MISMATCH'));
 assert.equal(panels[4].rows.length,6);
 assert.equal(panels[4].rows.find(r=>r.variant==='S4')['Sharpe'],'0.61');
 assert.equal(panels[4].rows.find(r=>r.variant==='S4L')['Sharpe'],'0.95');
 assert.equal(panels[4].curve,undefined);
}));

test('historical drilldown names its split and scopes extra costs to the full period',async()=>fixture(async(root,put)=>{
 const saved={note:'saved',splits:{'2021–2023':{Sharpe:'0.63'}},extra:{'Комиссии % за период':'9.7'}};
 await put('backtest',{S1:saved,S4:saved,S4L:saved});
 const p=(await buildObservatory(root,new Date('2026-11-16T20:00:00Z'))).strategies[4];
 const c=p.candidates[0];
 assert.equal(c.facts.find(f=>f.label==='Период split')?.value,'2021–2023');
 assert.equal(c.side,'long-short');
 assert.match(c.summary,/2021–2023/);
 assert.equal(c.facts.some(f=>f.label==='Комиссии % за период'),false);
 assert.equal(c.facts.find(f=>f.label==='Комиссии % за период · весь период')?.note,'2021-01 — 2026-09, не отдельный split');
}));

test('isolated absent sources produce exactly five read-only missing panels', async () => {
 const root = await mkdtemp(join(tmpdir(), 'observatory-'));
 try {
  const result = await buildObservatory(root, new Date('2026-11-16T20:00:00Z'));
  assert.deepEqual(result.strategies.map(p => p.id), ['funding','smc','pump','donchian','tsmom']);
  assert.equal(result.execution_enabled, false);
  assert.equal(result.read_only, true);
  assert.ok(result.strategies.every(p => p.state === 'missing' && p.blockers.length > 0));
 } finally { await rm(root, { recursive:true, force:true }); }
});
