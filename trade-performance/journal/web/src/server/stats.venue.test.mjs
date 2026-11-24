import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=fs.readFileSync(new URL('./stats.ts',import.meta.url),'utf8');
function load(q){const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>n==='./db'?{q}:{}});return exports;}
test('venue filter is parameterized and open trades are not mixed with closed statistics',async()=>{
 const calls=[];const api=load(async(sql,p)=>{calls.push({sql,p});return []});
 await api.trades({venue:'bingx'});
 assert.match(calls[0].sql,/slug = \$1/);
 assert.equal(calls[0].p[0],'bingx');
 assert.match(calls[0].sql,/t.status = 'CLOSED'/);
 await api.openTrades({venue:'bingx'});
 assert.match(calls[1].sql,/t.status = 'OPEN'/);
 assert.equal(calls[1].p[0],'bingx');
});
