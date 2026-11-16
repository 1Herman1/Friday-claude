import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd(),'../../prop-agents');
const file = async p => JSON.parse(await readFile(resolve(root,p),'utf8'));
const t=performance.now();
const response=await fetch('http://127.0.0.1:3100/api/strategy-observatory');
assert.equal(response.status,200);
const data=await response.json();
assert.equal(data.schema_version,1);assert.equal(data.read_only,true);assert.equal(data.execution_enabled,false);
assert.deepEqual(data.strategies.map(p=>p.id),['funding','smc','pump','donchian','tsmom']);
const [funding,smc,pump,donchian,tsmom]=data.strategies;
const latest=await file('engine/funding_monitor/out/latest.json');
const fundingRun=funding.facts.find(f=>f.label==='Завершённый run').value;
assert.equal(fundingRun,latest.run_id,'collector changed during assertion: rerun verification');
assert.equal(funding.total_rows,latest.pairs.length);
assert.equal(funding.facts.find(f=>f.label==='Наблюдений').value,String(latest.observations.length));
const preview=await file('clusters/smc-btc/preview-v03/20261111-btc-all/report.json');
const legacy=await file('clusters/smc-btc/out/setups_live.json');
const audit=await file('engine/smc_audit/results/legacy_summary.json');
assert.equal(smc.total_rows,preview.candidates.length+legacy.length);
assert.equal(smc.rows.filter(r=>r.version==='v0.3 PREVIEW').length,preview.candidates.length);
assert.equal(smc.candidates.filter(c=>c.state==='AUDITED_LEGACY').length,audit.length);
assert.equal(preview.counts.production_eligible,0);
assert.equal(smc.facts.find(f=>f.label==='production_eligible').value,'0');
const snapshot=await file('engine/scanner/artifacts/live/snapshot.json');
const screen=snapshot.markets.filter(m=>m.flags.some(f=>['pump_24h_threshold','dump_24h_threshold'].includes(f)));
assert.equal(pump.facts.find(f=>f.label==='±20% threshold строк').value,String(screen.length));
assert.equal(pump.mode,'SAVED_SIGNALS','DB reader must work for this acceptance check');
// Independent DB count is supplied by the coordinator's read-only source query.
const expectedPumpCount = Number(process.argv[2]);
assert.ok(Number.isSafeInteger(expectedPumpCount) && expectedPumpCount >= 0,'Usage: node verify-real.mjs <independently-queried-pump-count>');
assert.equal(pump.total_rows,expectedPumpCount);
assert.equal(pump.rows.length,pump.total_rows);
assert.ok(pump.rows.every(r=>!('trade_net' in r)&&!('trade_id' in r)));
const results=await file('reports/backtests/2026-10-14/results.json');
assert.equal(donchian.total_rows,Object.keys(results.S1.splits).length);
assert.equal(tsmom.total_rows,Object.keys(results.S4.splits).length+Object.keys(results.S4L.splits).length);
for(const [panel,code] of [[donchian,'S1'],[tsmom,'S4'],[tsmom,'S4L']]) {
 const row=panel.rows.find(r=>r.variant===code&&r.period==='2021-01 — 2026-09');
 assert.equal(row.Sharpe,String(results[code].splits['Весь период'].Sharpe));
 assert.equal(panel.curve,undefined);
}
for(const p of data.strategies) {
 for(const key of ['id','code','title','subtitle','mode','state','updated_at','last_attempt_at','market','version','facts','stages','blockers','columns','rows','total_rows','candidates','events','notes','sources']) assert.ok(key in p,`${p.id}: missing ${key}`);
 for(const row of p.rows) for(const v of Object.values(row)) assert.ok(v===null||typeof v==='string');
 for(const fact of p.facts) assert.ok(fact.value===null||typeof fact.value==='string');
 assert.ok(p.stages.some(s=>s.id==='execution'&&s.state==='not_connected'));
}
console.log(JSON.stringify({verified:true,elapsed_ms:Math.round(performance.now()-t),counts:{funding_observations:latest.observations.length,funding_pairs:latest.pairs.length,smc_preview:preview.candidates.length,smc_legacy:legacy.length,smc_audit:audit.length,pump_saved:pump.total_rows,bingx_proxy:screen.length,donchian:donchian.total_rows,tsmom:tsmom.total_rows}},null,2));
