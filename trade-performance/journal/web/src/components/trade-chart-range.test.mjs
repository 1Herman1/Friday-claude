import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(){const exports={};const s=fs.readFileSync(new URL('./trade-chart-range.ts',import.meta.url),'utf8');vm.runInNewContext(ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports});return exports;}
test('open position viewport reaches current candle even without recent executions',()=>{
 const r=load().tradeChartRange([{time:0},{time:100},{time:10000}],[{t:100},{t:200}],10,true);
 assert.ok(r.to>=10000);
 assert.ok(r.from<=100);
});
test('closed position retains execution-centered zoom',()=>{
 const r=load().tradeChartRange([{time:0},{time:10000}],[{t:100},{t:200}],10,false);
 assert.equal(r.from,-20);assert.equal(r.to,280);
});
test('missing executions falls back to available candles',()=>{
 const r=load().tradeChartRange([{time:100},{time:200}],[],10,true);
 assert.equal(r.from,100);assert.equal(r.to,200);
});
