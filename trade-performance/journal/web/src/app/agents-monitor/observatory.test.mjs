import test from 'node:test';
import assert from 'node:assert/strict';
import { selectStrategy, filterRows, sourceAge, isObservatory, modeLabel } from './observatory-helpers.ts';

test('URL selection is dynamic and invalid identifiers fall back to first available strategy', () => {
 const panels = [{id:'funding'}, {id:'tsmom'}, {id:'future'}];
 assert.equal(selectStrategy(panels,'tsmom')?.id,'tsmom');
 assert.equal(selectStrategy(panels,'future')?.id,'future');
 assert.equal(selectStrategy(panels,'removed')?.id,'funding');
 assert.equal(selectStrategy([], 'funding'),null);
});
test('search includes fields and rows beyond the screen cap without rounding strings', () => {
 const rows=Array.from({length:201},(_,i)=>({symbol:`ASSET${i}`,rate:i===200?'0.000000000000000001':null,venue:'BingX'}));
 assert.deepEqual(filterRows(rows,'asset200'),[rows[200]]);
 assert.equal(filterRows(rows,'  bingx ').length,201);
 assert.equal(filterRows(rows,'0.000000000000000001').length,1);
 assert.equal(filterRows(rows,'').length,201);
});
test('ages distinguish missing, future and historical timestamps', () => {
 const now=Date.parse('2026-11-16T12:00:00Z');
 assert.equal(sourceAge(null,now),'время неизвестно');
 assert.equal(sourceAge('invalid',now),'время неизвестно');
 assert.equal(sourceAge('2026-11-16T12:00:01Z',now),'время в будущем');
 assert.equal(sourceAge('2026-11-16T11:59:45Z',now),'15 с назад');
 assert.equal(sourceAge('2026-11-14T12:00:00Z',now),'2 д назад');
 assert.match(modeLabel('BACKTEST_ONLY'),/BACKTEST/);
 assert.match(modeLabel('SAVED_SIGNALS'),/SAVED/);
 assert.match(modeLabel('PREVIEW'),/PREVIEW/);
 assert.match(modeLabel('LIVE_OBSERVATION'),/наблюдение/);
});
test('contract guard rejects malformed nested evidence instead of crashing the screen', () => {
 const response={schema_version:1,served_at:'2026-11-16',read_only:true,execution_enabled:false,strategies:[]};
 assert.equal(isObservatory(response),true);
 assert.equal(isObservatory({...response,execution_enabled:true}),false);
 const panel={id:'x',title:'X',code:'X',subtitle:'X',mode:'PREVIEW',state:'missing',updated_at:null,last_attempt_at:null,market:'X',version:'1',facts:[],stages:[],blockers:[],columns:[],rows:[],total_rows:0,candidates:[],events:[],notes:[],sources:[]};
 assert.equal(isObservatory({...response,strategies:[panel]}),true);
 assert.equal(isObservatory({...response,strategies:[{...panel,candidates:[null]}]}),false);
 assert.equal(isObservatory({...response,strategies:[{...panel,stages:[{id:'x'}]}]}),false);
 assert.equal(isObservatory({...response,strategies:[panel,panel]}),false);
});
