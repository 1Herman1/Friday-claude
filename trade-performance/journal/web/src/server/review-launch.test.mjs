import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(){const exports={};const s=fs.readFileSync(new URL('./review-launch.ts',import.meta.url),'utf8');vm.runInNewContext(ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports});return exports;}
test('BingX single-position launch binds the exact running row and captures its chart',()=>{
 const args=Array.from(load().reviewLaunchArgs('/repo','bingx','trade-id','review-id'));
 assert.equal(args[0],'/repo/journal/review/bingx_review.py');
 assert.equal(args[args.indexOf('--trade')+1],'trade-id');
 assert.equal(args[args.indexOf('--running-review-id')+1],'review-id');
 assert.ok(args.includes('--capture'));assert.ok(args.includes('--force'));
 assert.equal(args[args.indexOf('--out')+1],'/repo/journal/data/reports/review-jobs/review-id');
});
test('historical MEXC keeps its existing worker',()=>{
 assert.equal(load().reviewLaunchArgs('/repo','mexc','t','r')[0],'/repo/journal/review/agent_pass.py');
});
test('unknown venue is not silently reviewed using MEXC context',()=>{
 assert.throws(()=>load().reviewLaunchArgs('/repo','unknown','t','r'), /Unsupported venue/);
});
