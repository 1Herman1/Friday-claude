import { resolve } from 'node:path';
import { buildObservatory, type StoredSignals } from './adapters';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
let pending: Promise<StoredSignals> | null = null;
async function storedPump(): Promise<StoredSignals> {
 if (!pending) {
  pending = import('../../../server/signals').then(async ({ signalList }) => {
   const rows = await signalList('pump-mexc', false);
   return { pump: { rows: rows.map(row => ({ id:row.id, base:row.base, side:row.side, mode:row.mode, status:row.status, setup_time:row.setup_time, entry:row.entry, stop_loss:row.stop_loss, tp:row.tp, simulated_r:row.simulated_r, rise:row.rise, max_drop:row.max_drop, max_up:row.max_up })), error:null } };
  }).catch(() => ({ pump:{ rows:[],error:'READ_ONLY_DB_UNAVAILABLE' } })).finally(()=>{ pending=null; });
 }
 let timer: ReturnType<typeof setTimeout> | undefined;
 try {
  return await Promise.race([pending,new Promise<StoredSignals>(resolveTimeout=>{ timer=setTimeout(()=>resolveTimeout({pump:{rows:[],error:'READ_ONLY_DB_TIMEOUT_900MS'}}),900); })]);
 } finally { if (timer) clearTimeout(timer); }
}
export async function GET(): Promise<Response> {
 const now = new Date();
 const root = resolve(process.cwd(),'../../prop-agents');
 // A single in-flight SELECT prevents repeated stalled queries on each poll.
 const stored = await storedPump();
 const result = await buildObservatory(root,now,stored);
 return Response.json(result,{ headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'} });
}
