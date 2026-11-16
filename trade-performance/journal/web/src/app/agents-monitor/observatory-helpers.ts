import type { StrategyMode, StrategyObservatoryResponse } from '../../lib/strategy-observatory-contract';
export function selectStrategy<T extends {id:string}>(panels:T[], id:string|null):T|null { return panels.find(p=>p.id===id)??panels[0]??null; }
export function filterRows(rows:Record<string,string|null>[], query:string) { const q=query.trim().toLocaleLowerCase('ru'); return q?rows.filter(row=>Object.values(row).some(v=>v?.toLocaleLowerCase('ru').includes(q))):rows; }
export function sourceAge(at:string|null, now:number):string { if(!at||!now||!Number.isFinite(Date.parse(at)))return 'время неизвестно'; const seconds=Math.floor((now-Date.parse(at))/1000); if(seconds<0)return 'время в будущем'; if(seconds<60)return `${seconds} с назад`; if(seconds<3600)return `${Math.floor(seconds/60)} мин назад`; if(seconds<86400)return `${Math.floor(seconds/3600)} ч назад`; return `${Math.floor(seconds/86400)} д назад`; }
export function modeLabel(mode:StrategyMode):string { return {LIVE_OBSERVATION:'LIVE · наблюдение',SAVED_SIGNALS:'SAVED · сохранённые сигналы',PREVIEW:'PREVIEW · расчёт',BACKTEST_ONLY:'BACKTEST · история'}[mode]; }
const record=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown):v is string=>typeof v==='string';
const nullable=(v:unknown)=>v===null||text(v);
const list=(v:unknown,check:(item:unknown)=>boolean)=>Array.isArray(v)&&v.every(check);
const fact=(v:unknown)=>record(v)&&text(v.label)&&nullable(v.value)&&(v.note===undefined||text(v.note));
const state=(v:unknown)=>text(v)&&['running','fresh','partial','error','stale','saved','missing','blocked','not_connected','not_wired'].includes(v);
export function isObservatory(value:unknown):value is StrategyObservatoryResponse {
 if(!record(value)||value.schema_version!==1||value.read_only!==true||value.execution_enabled!==false||!text(value.served_at)||!Array.isArray(value.strategies))return false;
 const ids=new Set<string>();
 return value.strategies.every((p:unknown)=>{
  if(!record(p)||!text(p.id)||ids.has(p.id))return false;ids.add(p.id);
  return ['title','code','subtitle','market','version'].every(k=>text(p[k]))&&state(p.state)&&text(p.mode)&&['LIVE_OBSERVATION','SAVED_SIGNALS','PREVIEW','BACKTEST_ONLY'].includes(p.mode)&&nullable(p.updated_at)&&nullable(p.last_attempt_at)&&typeof p.total_rows==='number'&&Number.isInteger(p.total_rows)&&p.total_rows>=0&&list(p.facts,fact)&&list(p.blockers,text)&&list(p.notes,text)&&list(p.sources,text)&&list(p.columns,c=>record(c)&&text(c.key)&&text(c.label))&&list(p.rows,r=>record(r)&&Object.values(r).every(nullable))&&list(p.stages,t=>record(t)&&text(t.id)&&text(t.title)&&text(t.kind)&&['code','LLM','human'].includes(t.kind)&&state(t.state)&&nullable(t.at)&&text(t.detail))&&list(p.candidates,c=>record(c)&&text(c.id)&&text(c.symbol)&&nullable(c.side)&&text(c.state)&&nullable(c.at)&&text(c.summary)&&list(c.facts,fact)&&list(c.blockers,text))&&list(p.events,e=>record(e)&&nullable(e.at)&&text(e.stage)&&text(e.state)&&text(e.message))&&(p.curve===undefined||list(p.curve,c=>record(c)&&text(c.at)&&text(c.value)));
 });
}
