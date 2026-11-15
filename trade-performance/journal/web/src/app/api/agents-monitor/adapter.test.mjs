import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFunding, percent, highFunding, stageState } from './adapter.ts';
import * as adapter from './adapter.ts';
test('collector heartbeat expires instead of showing a killed process as running',()=>{
 const p={running:true,updated_at:'2026-11-15T12:00:00Z',current_venue:'Gate',sources:[],events:[]};
 assert.equal(typeof adapter.activeProgress,'function');
 assert.equal(adapter.activeProgress(p,Date.parse('2026-11-15T12:00:05Z')),true);
 assert.equal(adapter.activeProgress(p,Date.parse('2026-11-15T12:03:00Z')),false);
 assert.equal(adapter.activeProgress({...p,running:false},Date.parse(p.updated_at)),false);
 assert.equal(adapter.activeProgress(p,Date.parse('2026-11-15T11:59:00Z')),false);
});
test('missing collector is explicit, never synthetic', () => {
  const result = normalizeFunding(null);
  assert.equal(result.state, 'missing');
  assert.deepEqual(result.observations, []);
});
test('finance strings preserve precision; absent intervals never become 8h',()=>{
 const result=normalizeFunding({schema_version:1,status:'partial',observations:[{symbol:'BTC',venue:'A',market_type:'USDT_PERPETUAL',funding_rate:'0.01000000000000000001',interval_hours:null}],pairs:[{status:'APPROVE',reasons:['missing depth']}],events:[]});
 assert.equal(result.observations[0].funding_rate,'0.01000000000000000001');assert.equal(result.observations[0].interval_hours,null);assert.equal(result.pairs[0].status,'HOLD');
 assert.equal(percent('0.01000000000000000001'),'1.000000000000000001%');assert.equal(percent(null),'—');assert.equal(percent('-0.00025'),'-0.025%');
 assert.equal(highFunding('-0.0100'),true);assert.equal(highFunding('0.009999999999999999'),false);assert.equal(highFunding(null),false);
});
test('stage running requires recent real event and no later completion',()=>{
 const now=Date.parse('2026-11-15T12:00:00Z');const event={at:'2026-11-15T11:59:55Z',stage:'fetch',status:'running',message:'fetch'};
 assert.equal(stageState([event],'fetch',now),'running');assert.equal(stageState([event],'fetch',now+100000),'idle');
 assert.equal(stageState([event,{...event,status:'ok'}],'fetch',now),'success');assert.equal(stageState([],'fetch',now),'idle');
 assert.equal(stageState([{...event,status:'partial'}],'fetch',now),'partial');
});
test('invalid schema is explicit and sensitive raw errors are not exposed',()=>{
 assert.equal(normalizeFunding({schema_version:9}).state,'invalid');
 const result=normalizeFunding({schema_version:1,status:'error',sources:[{venue:'A',error:'secret=abc /Users/person/.env'}],events:[{message:'token=abc /Users/person/.env'}]});
 assert.equal(result.sources[0].error,'Источник сообщил ошибку');assert.doesNotMatch(JSON.stringify(result),/abc|\/Users/);
});
