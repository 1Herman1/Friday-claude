import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readMonitor } from './reader.mjs';
test('reader exposes in-progress work without replacing last completed market snapshot', async()=>{
 const root=await mkdtemp(path.join(process.env.TMPDIR||tmpdir(),'monitor-progress-'));
 try {
  await mkdir(path.join(root,'funding_monitor/out'),{recursive:true});
  await writeFile(path.join(root,'funding_monitor/out/latest.json'),JSON.stringify({schema_version:1,status:'ok',completed_at:'2026-11-15T15:20:00Z',observations:[],events:[]}));
  await writeFile(path.join(root,'funding_monitor/out/progress.json'),JSON.stringify({running:true,updated_at:'2026-11-15T15:21:00Z',current_venue:'Gate',sources:[{venue:'Gate',status:'running',records:0}],events:[{at:'2026-11-15T15:21:00Z',stage:'Gate',status:'request',message:'Public GET started'}]}));
  const result=await readMonitor(root);
  assert.equal(result.funding.completed_at,'2026-11-15T15:20:00Z');
  assert.equal(result.funding.progress.running,true);
  assert.equal(result.funding.progress.current_venue,'Gate');
  assert.equal(result.funding.progress.events[0].status,'request');
 } finally {await rm(root,{recursive:true,force:true});}
});
test('read-only whitelist reports absent files, reads real contract, rejects symlinks',async()=>{
 const root=await mkdtemp(path.join(process.env.TMPDIR||tmpdir(),'monitor-test-'));
 try {
  assert.equal((await readMonitor(root)).funding.state,'missing');
  await mkdir(path.join(root,'funding_monitor/out'),{recursive:true});
  await writeFile(path.join(root,'funding_monitor/out/latest.json'),JSON.stringify({schema_version:1,status:'partial',observations:[{symbol:'BTC',asset_id:'BTC',venue:'TEST',market_type:'USDT_PERPETUAL',funding_rate:'0.01000000000000000001',interval_hours:null}],events:[]}));
  const result=await readMonitor(root);assert.equal(result.funding.observations[0].funding_rate,'0.01000000000000000001');assert.equal(result.funding.observations[0].interval_hours,null);
  await rm(path.join(root,'funding_monitor/out/latest.json'));
  await symlink('/etc/hosts',path.join(root,'funding_monitor/out/latest.json'));
  assert.equal((await readMonitor(root)).funding.state,'unreadable');
 }finally{await rm(root,{recursive:true,force:true});}
});
