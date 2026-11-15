import { NextResponse } from 'next/server';
import path from 'node:path';
import { readMonitor } from './reader.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export async function GET() {
 try {
  const engine = path.resolve(process.cwd(), '../../prop-agents/engine');
  return NextResponse.json(await readMonitor(engine), {headers:{'Cache-Control':'no-store, max-age=0','X-Content-Type-Options':'nosniff'}});
 } catch {
  return NextResponse.json({error:'Не удалось прочитать состояние мониторинга'}, {status:503,headers:{'Cache-Control':'no-store'}});
 }
}
