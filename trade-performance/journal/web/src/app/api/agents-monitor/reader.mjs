import { constants } from 'node:fs';
import { open, realpath, readdir } from 'node:fs/promises';
import path from 'node:path';
import { normalizeFunding, normalizeProgress } from './adapter.ts';

async function bounded(root, relative, limit = 8 * 1024 * 1024) {
 let handle;
 try {
  const file = path.join(await realpath(root), relative);
  const actual = await realpath(file);
  if (actual !== file) return { state: 'unreadable', data: null };
  handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  const stat = await handle.stat();
  if (!stat.isFile() || stat.size > limit) return { state: 'unreadable', data: null };
  const buffer = Buffer.alloc(limit + 1);
  let total = 0;
  while (total < buffer.length) {
   const {bytesRead} = await handle.read(buffer, total, buffer.length - total, null);
   if (!bytesRead) break;
   total += bytesRead;
  }
  if (total > limit) return {state:'unreadable',data:null};
  return {state:'available',data:buffer.subarray(0,total).toString('utf8')};
 } catch(error) { return {state:error?.code === 'ENOENT' ? 'missing' : 'unreadable',data:null}; }
 finally { await handle?.close(); }
}
function json(result) {try{return result.data === null ? null : JSON.parse(result.data);}catch{return null;}}
export async function readMonitor(root) {
 const [raw, quant, progress] = await Promise.all([bounded(root,'funding_monitor/out/latest.json'),bounded(root,'quant_gate/README.md',65536),bounded(root,'funding_monitor/out/progress.json',524288)]);
 const funding=normalizeFunding(json(raw));
 funding.progress=normalizeProgress(json(progress));
 if(raw.state==='unreadable')funding.state='unreadable';
 else if(raw.state==='available'&&json(raw)===null)funding.state='invalid';
 let dirs=[];
 try {dirs=(await readdir(path.join(root,'scanner/artifacts'))).filter(v=>/^\d{8}T\d{6}Z$/.test(v)).sort().reverse().slice(0,20);}catch{}
 const candidates=await Promise.all(['live',...dirs].map(dir=>bounded(root,`scanner/artifacts/${dir}/snapshot.json`)));
 const snapshots=candidates.map(json).filter(d=>d && d.schema_version===1 && typeof d.generated_at==='string' && Number.isFinite(Date.parse(d.generated_at)) && Array.isArray(d.markets)).sort((a,b)=>Date.parse(b.generated_at)-Date.parse(a.generated_at));
 const saved=snapshots[0];
 return {served_at:new Date().toISOString(),funding,scanner:saved?{state:'saved',generated_at:saved.generated_at,market_count:saved.markets.length}:{state:'missing',generated_at:null,market_count:null},quant:{state:quant.state,standalone:!!quant.data?.includes('standalone'),not_wired:!!quant.data?.includes('NOT wired')},socratic:{state:'not_connected'}};
}
