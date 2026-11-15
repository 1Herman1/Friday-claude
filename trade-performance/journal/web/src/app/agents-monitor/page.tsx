'use client';

import { useEffect, useMemo, useState } from 'react';
import { activeProgress, highFunding, percent, stageState, type Funding, type Observation } from '../api/agents-monitor/adapter';
import styles from './monitor.module.css';

type Monitor = {served_at:string;funding:Funding;scanner:{state:string;generated_at:string|null;market_count:number|null};quant:{state:string;standalone:boolean;not_wired:boolean};socratic:{state:string}};
type Notice = {at:string;message:string;error?:boolean};
const key = (r:Observation) => `${r.venue}:${r.symbol}`;
const stamp = (v:string|number|null) => v === null ? '—' : new Date(v).toLocaleString('ru-RU',{hour12:false});
const age = (v:string|null,now:number) => !v||!now ? null : Math.floor((now-Date.parse(v))/1000);
const ageLabel = (v:number|null) => v===null?'нет времени':v<0?'время в будущем':`${v} с назад`;
function absKey(v:string|null) {if(v===null)return '';const [a,b='']=v.replace('-','').split('.');return a.padStart(100,'0')+b.padEnd(100,'0');}
function Badge({children,tone='muted'}:{children:React.ReactNode;tone?:string}) {return <span className={`${styles.badge} ${styles[tone]||''}`}>{children}</span>;}
export default function AgentsMonitor() {
 const [data,setData]=useState<Monitor|null>(null);
 const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [paused,setPaused]=useState(false);
 const [now,setNow]=useState(0);const [lastRead,setLastRead]=useState<string|null>(null);const [changes,setChanges]=useState<Notice[]>([]);
 const [symbol,setSymbol]=useState('');const [venue,setVenue]=useState('ALL');const [onlyHigh,setOnlyHigh]=useState(false);const [selected,setSelected]=useState('');const [retry,setRetry]=useState(0);
 useEffect(()=>{setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{
  if(paused)return;
  let stopped=false;let inFlight=false;let previous='';let failed=false;let controller:AbortController|null=null;
  const poll=async()=>{
   if(inFlight)return;inFlight=true;setBusy(true);controller=new AbortController();const timeout=setTimeout(()=>controller?.abort(),8000);
   try {
    const response=await fetch('/api/agents-monitor',{cache:'no-store',signal:controller.signal});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const next:Monitor=await response.json();if(!next.funding||!Array.isArray(next.funding.observations))throw new Error('Некорректный ответ API');
    if(stopped)return;
    const signature=JSON.stringify(next.funding);const at=new Date().toISOString();
    if(failed||previous!==signature)setChanges(list=>[{at,message:failed?'Связь с API восстановлена':previous?'Изменение состояния коллектора':'Прочитано текущее состояние файлов'},...list].slice(0,40));
    failed=false;previous=signature;setData(next);setLastRead(at);setError('');
   } catch(e) {if(!stopped){const message=e instanceof Error&&e.name==='AbortError'?'API не ответил за 8 с':e instanceof Error?e.message:'Ошибка чтения API';setError(message);if(!failed)setChanges(list=>[{at:new Date().toISOString(),message:`API недоступен: ${message}`,error:true},...list].slice(0,40));failed=true;}}
   finally{clearTimeout(timeout);inFlight=false;if(!stopped)setBusy(false);}
  };
  void poll();const timer=setInterval(()=>void poll(),5000);
  return()=>{stopped=true;clearInterval(timer);controller?.abort();};
 },[paused,retry]);
 const funding=data?.funding;
 const venues=useMemo(()=>Array.from(new Set(funding?.observations.map(r=>r.venue)||[])).sort(),[funding]);
 const rows=useMemo(()=>(funding?.observations||[]).filter(r=>(venue==='ALL'||r.venue===venue)&&r.symbol.toUpperCase().includes(symbol.trim().toUpperCase())&&(!onlyHigh||highFunding(r.funding_rate))).sort((a,b)=>absKey(b.funding_rate).localeCompare(absKey(a.funding_rate))),[funding,venue,symbol,onlyHigh]);
 const candidate=rows.find(r=>key(r)===selected)||rows[0];
 const pairs=candidate?funding?.pairs.filter(p=>p.asset_id===candidate.asset_id)||[]:[];
 const observed=funding?.completed_at||funding?.events.filter(e=>e.at).at(-1)?.at||funding?.started_at||null;
 const seconds=age(observed,now);const stale=seconds===null||seconds>90||seconds< -5;
 const processEvents=funding?.progress?.events.length?funding.progress.events:funding?.events||[];
 const stages=Array.from(new Set(processEvents.map(e=>e.stage)));
 const hasRunning=activeProgress(funding?.progress,now);
 const sourceRows=hasRunning&&funding?.progress?.sources.length?funding.progress.sources:funding?.sources||[];
 const collectorState=error?'API OFFLINE':hasRunning?'RUNNING':funding?.state!=='available'?'НЕТ ДАННЫХ':stale?'УСТАРЕЛО':funding.status==='ok'?'SUCCESS':funding.status==='partial'?'PARTIAL':'ERROR';
 const collectorTone=error?'danger':hasRunning?'orange':collectorState==='SUCCESS'?'green':'muted';
 const log=[...processEvents.map(e=>({at:e.at,message:`${e.stage} / ${e.status} · ${e.message}`,error:['error','failed'].includes(e.status)})),...changes].sort((a,b)=>Date.parse(b.at||'')-Date.parse(a.at||'')).slice(0,100);
 return <div className={styles.console}>
  <header className={styles.topbar}>
   <div><div className={styles.eyebrow}>AGENT SYSTEM / OBSERVABILITY</div><h1>Монитор процессов<span className={styles.cursor}>_</span></h1></div>
   <div className={styles.headerActions}><Badge tone={collectorTone}>{collectorState}</Badge><span className={styles.local}>LOCAL · READ ONLY</span><button onClick={()=>setPaused(v=>!v)}>{paused?'▶ Возобновить':'Ⅱ Пауза экрана'}</button></div>
  </header>
  <div className={styles.statusline}><span className={styles.signal}>●</span><span>{paused?'Автообновление экрана приостановлено':error?'Нет связи с API':busy?'Чтение файлов…':'Опрос API каждые 5 с'}</span><span>Данные: {ageLabel(seconds)}</span><span className={styles.push}>Последнее чтение: {stamp(lastRead)}</span></div>
  {error&&<div className={styles.error} role="alert">{error}. {data?'Показаны последние успешно прочитанные данные, не текущий процесс.':'Состояние процесса неизвестно.'}<button onClick={()=>{setPaused(false);setRetry(v=>v+1);}}>Повторить</button></div>}
  <div className={styles.workspace}>
   <aside className={styles.rail} aria-label="Роли системы">
    <div className={styles.sectionLabel}>01 / РОЛИ И СОСТОЯНИЯ</div>
    <div className={styles.activeRole}><span className={styles.roleCode}>MKT</span><strong>Сбор рынка</strong><Badge tone={collectorTone}>{collectorState}</Badge><p>Публичные perpetual / funding. Только чтение.</p></div>
    <div className={styles.role}><span className={styles.roleCode}>ARB</span><strong>Funding-связки</strong><Badge>READ ONLY · HOLD</Badge><p>{funding?.pairs.length??'—'} кандидатов по тикеру. Идентичность и ликвидность не подтверждены.</p></div>
    <div className={styles.role}><span className={styles.roleCode}>QNT</span><strong>Квант-гейт</strong><Badge>STANDALONE · NOT WIRED</Badge></div>
    <div className={styles.role}><span className={styles.roleCode}>RSK</span><strong>Риск-менеджер · код</strong><Badge>NOT WIRED TO EXECUTION</Badge></div>
    {[['NWS','Новости'],['MGR','Управляющий LLM'],['EXE','Исполнение']].map(([code,title])=><div className={styles.role} key={code}><span className={styles.roleCode}>{code}</span><strong>{title}</strong><Badge>NOT CONNECTED</Badge></div>)}
    <div className={styles.railBottom}><div className={styles.sectionLabel}>КОНТРОЛЬ ДОПУСКА</div><strong className={styles.hold}>HOLD</strong><p>Funding — наблюдение, не торговый сигнал. Разрешение на ордер отсутствует.</p><div className={styles.sectionLabel}>COINGLASS</div><Badge>OPTIONAL · NOT CONNECTED</Badge><p>Платный API не подключён.</p></div>
   </aside>
   <section className={styles.center}>
    <div className={styles.panelHeader}><h2>Рынок / Funding</h2><span>{funding?.observations.length??'—'} наблюдений</span><span className={styles.push}>USDT PERPETUAL</span></div>
    <div className={styles.sourceStrip}>{sourceRows.length?sourceRows.map(s=><div key={s.venue}><strong>{s.venue}</strong><Badge tone={['error','failed'].includes(s.status)?'danger':['ok','success'].includes(s.status)?'green':s.status==='running'?'orange':'muted'}>{s.status}</Badge><span>{s.records===null?'—':s.records} записей</span>{s.error&&<span className={styles.failure}>ошибка источника</span>}</div>):<span>Источники ещё не зарегистрированы</span>}</div>
    <div className={styles.filters}><label><span>Символ</span><input aria-label="Фильтр символа" placeholder="RARE, SOPH, WAVES…" value={symbol} onChange={e=>setSymbol(e.target.value)}/></label><label><span>Площадка</span><select aria-label="Фильтр площадки" value={venue} onChange={e=>setVenue(e.target.value)}><option value="ALL">Все площадки</option>{venues.map(v=><option key={v}>{v}</option>)}</select></label><label className={styles.check}><input type="checkbox" checked={onlyHigh} onChange={e=>setOnlyHigh(e.target.checked)}/><span>|funding| ≥ 1%<small>за одно начисление</small></span></label></div>
    <div className={styles.tableWrap}><table><thead><tr><th>ИНСТРУМЕНТ / БИРЖА</th><th>FUNDING ↓ |%|</th><th>ИНТЕРВАЛ</th><th>ВОЗРАСТ</th></tr></thead><tbody>{rows.slice(0,250).map(r=><tr key={key(r)} className={candidate&&key(candidate)===key(r)?styles.selected:''} onClick={()=>setSelected(key(r))}><td><button className={styles.rowButton} onClick={()=>setSelected(key(r))}>{r.symbol}</button><small>{r.venue}</small></td><td className={r.funding_rate?.startsWith('-')?styles.negative:styles.positive}>{percent(r.funding_rate)}{highFunding(r.funding_rate)&&<small className={styles.extreme}>HIGH FUNDING</small>}</td><td>{r.interval_hours===null?'неизвестен':`${r.interval_hours} ч`}</td><td>{ageLabel(age(r.observed_at,now))}</td></tr>)}</tbody></table>
    {!rows.length&&<div className={styles.empty}><span className={styles.emptyGlyph}>[ — ]</span><h3>{funding?.state==='available'?'Наблюдений по фильтру нет':'Ожидание коллектора'}</h3><p>{funding?.state==='available'?'Измените фильтры или дождитесь новых записей.':funding?.state==='invalid'?'Файл коллектора не соответствует контракту.':funding?.state==='unreadable'?'Состояние недоступно для безопасного чтения.':'Файл состояния ещё не создан. Демо-данные не подставляются.'}</p><span>Опрос страницы не запускает движок.</span></div>}</div>
    <div className={styles.tableFooter}>Показано {Math.min(rows.length,250)} из {rows.length} · порядок по |funding|<span>Не доходность · без комиссий и исполнения</span></div>
    <p className={styles.dim}>Каталоги бирж включают также RWA и индексы. Тип базового актива и низкая ликвидность ещё не подтверждены.</p>
    <div className={styles.stages}><div className={styles.sectionLabel}>02 / ЭТАПЫ ПО СОБЫТИЯМ КОЛЛЕКТОРА</div>{stages.length?stages.map(s=>{const state=error?'unknown':hasRunning&&(s===funding?.progress?.current_venue||s==='collection')?'running':stageState(processEvents,s,now);return <div className={styles.stage} key={s}><span>{s}</span><Badge tone={state==='running'?'orange':state==='success'?'green':state==='error'?'danger':'muted'}>{state.toUpperCase()}</Badge><small>{stamp([...processEvents].reverse().find(e=>e.stage===s)?.at||null)}</small></div>}):<p className={styles.dim}>IDLE — коллектор пока не записал события. Наличие страницы не подтверждает работающий процесс.</p>}</div>
   </section>
   <aside className={styles.inspector} aria-label="Доказательства выбранного кандидата">
    <div className={styles.sectionLabel}>03 / ИНСПЕКТОР КАНДИДАТА</div>
    <div className={styles.candidateTitle}><h2>{candidate?.symbol||'Нет выбора'}</h2><Badge tone="orange">HOLD</Badge></div><p className={styles.dim}>{candidate?`${candidate.venue} · ${candidate.market_type}`:'Выберите строку рынка для проверки фактов.'}</p>
    <dl className={styles.evidence}><dt>Funding / начисление</dt><dd>{percent(candidate?.funding_rate??null)}</dd><dt>Исходная доля</dt><dd>{candidate?.funding_rate??'неизвестно'}</dd><dt>Интервал начисления</dt><dd>{candidate?.interval_hours===null||!candidate?'неизвестен':`${candidate.interval_hours} ч`}</dd><dt>Следующее начисление</dt><dd>{stamp(candidate?.next_funding_ms??null)}</dd><dt>Наблюдение</dt><dd>{stamp(candidate?.observed_at??null)}</dd><dt>Объём 24 ч, quote</dt><dd>{candidate?.volume_quote_24h??'неизвестно'}</dd><dt>Ликвидность</dt><dd>UNKNOWN</dd></dl>
    <div className={styles.holdBox}><div className={styles.sectionLabel}>ПОЧЕМУ НЕ СДЕЛКА</div><ul><li>Нет исполнимого стакана, комиссий и подтверждённой глубины.</li>{candidate?.interval_hours===null&&<li>Неизвестный интервал: нормализация в час запрещена.</li>}<li>Новости, управляющий LLM и исполнение не подключены.</li></ul></div>
    {pairs.slice(0,3).map((p,i)=><div className={styles.pair} key={i}><strong>LONG {p.long_venue} / SHORT {p.short_venue}</strong><span>Индикативная разница / ч: {percent(p.indicative_diff_per_hour)}</span><Badge>HOLD</Badge><ul>{p.reasons.map((r,j)=><li key={j}>{r}</li>)}</ul></div>)}
    <div className={styles.module}><div className={styles.sectionLabel}>QUANT / SOCRATIC</div><p>Quant: {data?.quant.state==='available'&&data.quant.not_wired?'standalone · NOT WIRED':'статус интеграции не подтверждён'}</p><p>Socratic: NOT CONNECTED</p><small>Документ модуля ≠ выполненный gate. APPROVE не заявлен.</small></div>
    <div className={styles.saved}><div className={styles.sectionLabel}>SCANNER / СОХРАНЁННЫЙ СНИМОК</div><p>{data?.scanner.state==='saved'?`${data.scanner.market_count} рынков · SAVED`:'Снимок не найден'}</p><time>{stamp(data?.scanner.generated_at??null)}</time><small>Архивный контекст, не live-поток.</small></div>
   </aside>
  </div>
  <section className={styles.log}><div className={styles.panelHeader}><h2>Журнал событий</h2><span>COLLECTOR + UI</span><span className={styles.push}>Время в часовом поясе браузера</span></div><div className={styles.logBody} aria-label="Журнал событий">{log.length?log.map((e,i)=><div className={styles.logRow} key={`${e.at}-${i}`}><time>{stamp(e.at)}</time><span className={e.error?styles.failure:styles.logMarker}>{e.error?'ERR':'LOG'}</span><span>{e.message}</span></div>):<p className={styles.dim}>Событий пока нет. Ожидаем первое чтение API.</p>}</div></section>
  <footer className={styles.footer}><span>Наблюдение ≠ управление процессом</span><span>Пауза останавливает только обновление экрана · ордера не отправляются</span></footer>
 </div>;
}
