import { constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import { join } from 'node:path';
import type { StrategyPanel, StrategyState, StrategyFact, StrategyCandidate, StrategyObservatoryResponse } from '../../../lib/strategy-observatory-contract';

export const SOURCE_PATHS = {
 funding: 'engine/funding_monitor/out/latest.json',
 progress: 'engine/funding_monitor/out/progress.json',
 smc: 'clusters/smc-btc/preview-v03/20261111-btc-all/report.json',
 legacy: 'clusters/smc-btc/out/setups_live.json',
 signal: 'clusters/smc-btc/out/last_signal.json',
 audit: 'engine/smc_audit/results/legacy_summary.json',
 previewAudit: 'engine/smc_audit/results/preview_summary.json',
 pump: 'engine/scanner/artifacts/live/snapshot.json',
 backtest: 'reports/backtests/2026-10-14/results.json',
} as const;
type SourceKey = keyof typeof SOURCE_PATHS;
type Obj = Record<string, unknown>;
type Source = { data: unknown; state: StrategyState; at: string | null; issue: string | null };
const LIMITS: Record<SourceKey, number> = { funding: 8_000_000, progress: 150_000, smc: 300_000, legacy: 300_000, signal: 50_000, audit: 100_000, previewAudit: 100_000, pump: 2_000_000, backtest: 150_000 };
const obj = (v: unknown): Obj => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Obj : {};
const list = (v: unknown): Obj[] => Array.isArray(v) ? v.map(obj) : [];
const text = (v: unknown): string | null => typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f<>]/g, '').slice(0, 500) : typeof v === 'boolean' ? String(v) : null;
const strings = (v: unknown): string[] => Array.isArray(v) ? v.map(text).filter((s): s is string => s !== null).slice(0, 40) : [];
const fact = (label: string, value: unknown, note?: string): StrategyFact => ({ label, value: text(value), ...(note ? { note } : {}) });
const fields = (v: Obj, keys: readonly string[]): StrategyFact[] => keys.map(k => fact(k, v[k]));
const timestamp = (v: unknown): string | null => typeof v === 'string' && Number.isFinite(Date.parse(v)) ? v : null;

// Tokenize JSON strings before numbers: preserve original decimal lexemes, never float money.
export function parseExactJson(raw: string): unknown {
 return JSON.parse(raw.replace(/"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g, token => token[0] === '"' ? token : JSON.stringify(token))) as unknown;
}
function valid(key: SourceKey, data: unknown): boolean {
 const d = obj(data);
 if (key === 'legacy' || key === 'audit' || key === 'previewAudit') return Array.isArray(data) && data.every(v => Object.keys(obj(v)).length > 0);
 if (key === 'funding') return Array.isArray(d.observations) && Array.isArray(d.pairs) && Array.isArray(d.sources) && !!timestamp(d.completed_at);
 if (key === 'progress') return typeof d.running === 'boolean' && Array.isArray(d.events) && !!timestamp(d.updated_at);
 if (key === 'smc') return Array.isArray(d.candidates) && Object.keys(obj(d.counts)).length > 0 && !!timestamp(obj(d.candles).as_of);
 if (key === 'pump') return Array.isArray(d.markets) && !!timestamp(d.generated_at);
 if (key === 'backtest') return ['S1','S4','S4L'].every(k => Object.keys(obj(obj(d[k]).splits)).length > 0);
 return Array.isArray(d.signals) && !!timestamp(d.detected_at);
}
export async function readSource(root: string, key: SourceKey): Promise<Source> {
 let handle: Awaited<ReturnType<typeof open>> | undefined;
 try {
  let current = root;
  if ((await lstat(root)).isSymbolicLink()) throw new Error('SYMLINK_BLOCKED');
  for (const segment of SOURCE_PATHS[key].split('/')) {
   current = join(current, segment);
   if ((await lstat(current)).isSymbolicLink()) throw new Error('SYMLINK_BLOCKED');
  }
  handle = await open(current, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  const stat = await handle.stat();
  if (!stat.isFile()) throw new Error('NOT_REGULAR_FILE');
  if (stat.size > LIMITS[key]) throw new Error('SIZE_LIMIT');
  const buffer = Buffer.alloc(LIMITS[key] + 1);
  let offset = 0;
  while (offset < buffer.length) {
   const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, offset);
   if (!bytesRead) break;
   offset += bytesRead;
  }
  if (offset > LIMITS[key]) throw new Error('SIZE_LIMIT');
  const data = parseExactJson(buffer.subarray(0, offset).toString('utf8'));
  if (!valid(key, data)) throw new Error('INVALID_SCHEMA');
  return { data, state: 'saved', at: stat.mtime.toISOString(), issue: null };
 } catch (error) {
  const code = obj(error).code;
  const known = error instanceof Error && ['SYMLINK_BLOCKED','SIZE_LIMIT','INVALID_SCHEMA','NOT_REGULAR_FILE'].includes(error.message) ? error.message : code === 'ENOENT' ? 'MISSING' : error instanceof SyntaxError ? 'INVALID_JSON' : 'UNREADABLE';
  return { data: null, state: known === 'MISSING' ? 'missing' : 'error', at: null, issue: `${SOURCE_PATHS[key]}: ${known}` };
 } finally { await handle?.close(); }
}
function base(id: string, code: string, title: string, mode: StrategyPanel['mode']): StrategyPanel {
 return { id, code, title, subtitle: '', mode, state: 'missing', updated_at: null, last_attempt_at: null, market: '', version: '', facts: [], stages: [], blockers: ['EXECUTION_NOT_CONNECTED'], columns: [], rows: [], total_rows: 0, candidates: [], events: [], notes: ['Только чтение сохранённых файлов; наличие кода не означает прибыльность, работающий процесс, LLM или сделку.'], sources: [] };
}
function sourceInfo(p: StrategyPanel, entries: [SourceKey, Source][]): void {
 p.sources = entries.map(([key]) => SOURCE_PATHS[key]);
 p.blockers.push(...entries.map(([,s]) => s.issue).filter((s): s is string => s !== null));
}
function ageState(at: string | null, now: Date, threshold: number): StrategyState {
 return at === null ? 'partial' : now.getTime() - Date.parse(at) > threshold || Date.parse(at) > now.getTime() + 60_000 ? 'stale' : 'fresh';
}
function pipeline(p: StrategyPanel, detector: string, context: string): void {
 p.stages = [
  { id:'data', title:'Данные', kind:'code', state:p.state, at:p.updated_at, detail:p.sources.join('; ') },
  { id:'context', title:'Контекст', kind:'code', state:'partial', at:null, detail:context },
  { id:'detector', title:'Детектор / расчёт', kind:'code', state:p.state === 'missing' || p.state === 'error' ? p.state : 'saved', at:p.updated_at, detail:detector },
  { id:'quant', title:'Quant gate', kind:'code', state:'blocked', at:null, detail:'Сохранённые результаты не являются допуском к торговле; форвард и исполнение не подтверждены.' },
  { id:'manager', title:'Управляющий', kind:'LLM', state:'not_connected', at:null, detail:'Подтверждённые LLM-решения не подключены к этой витрине.' },
  { id:'risk', title:'Риск', kind:'code', state:'not_wired', at:null, detail:'API не вызывает risk engine и не изменяет лимиты.' },
  { id:'execution', title:'Исполнение', kind:'code', state:'not_connected', at:null, detail:'Нет заявок, приватной БД, позиций и PnL в этом API.' },
 ];
}
function table(p: StrategyPanel, keys: string[]): void { p.columns = keys.map(key => ({ key, label:key })); }
function candidate(id: string, d: Obj, symbol: string, state: string, at: string | null, keys: string[], blockers: string[]): StrategyCandidate {
 return { id, symbol, side:text(d.side), state, at, summary:state, facts:fields(d, keys), blockers };
}
function events(data: unknown): StrategyPanel['events'] {
 return list(data).slice(-40).map(d => ({ at:timestamp(d.at), stage:text(d.stage) ?? 'source', state:text(d.status) ?? 'unknown', message:text(d.message) ?? 'Нет сообщения' }));
}
export type StoredSignals = { pump?: { rows: Record<string, unknown>[]; error: string | null } };
export async function buildObservatory(root: string, now = new Date(), stored: StoredSignals = {}): Promise<StrategyObservatoryResponse> {
 const keys = Object.keys(SOURCE_PATHS) as SourceKey[];
 const loaded = await Promise.all(keys.map(async key => [key, await readSource(root,key)] as const));
 const src = Object.fromEntries(loaded) as Record<SourceKey, Source>;
 const funding = base('funding','FUNDING','Funding discovery','LIVE_OBSERVATION');
 const f = obj(src.funding.data), progress = obj(src.progress.data);
 funding.subtitle = 'Публичные ставки и ticker-only пары — HOLD, не арбитражная прибыль';
 funding.market = 'USDT perpetual · BingX / Bitget / Gate / Binance / OKX';
 funding.version = 'funding-monitor schema 1';
 funding.updated_at = timestamp(f.completed_at);
 funding.last_attempt_at = timestamp(progress.updated_at);
 funding.state = src.funding.data ? ageState(funding.updated_at,now,180_000) : src.funding.state;
 if (f.status === 'error') funding.state = 'error';
 else if (f.status && f.status !== 'ok' && funding.state === 'fresh') funding.state = 'partial';
 sourceInfo(funding,[['funding',src.funding],['progress',src.progress]]);
 const observations = list(f.observations), pairs = list(f.pairs);
 funding.facts = [fact('Наблюдений',String(observations.length)),fact('Ticker-only пар',String(pairs.length)),fact('Завершённый run',f.run_id),fact('Последнее завершение',f.completed_at),fact('Статус завершённого сбора',f.status),fact('Текущий run',progress.run_id),fact('Sidecar running',progress.running),fact('Sidecar updated_at',progress.updated_at),fact('Текущая биржа',progress.current_venue),fact('Свежесть sidecar',src.progress.data ? ageState(timestamp(progress.updated_at),now,180_000) : src.progress.state)];
 for (const s of list(f.sources)) funding.facts.push(fact(`${text(s.venue)} · ${text(s.status)}`,s.records,'records из последнего завершённого snapshot'));
 funding.blockers.push('LIQUIDITY_UNVERIFIED','ACCOUNT_FEES_UNVERIFIED','EXIT_RISK_UNVERIFIED','TOKEN_IDENTITY_AND_UNITS_UNVERIFIED','INDICATIVE_NOT_LOCKED');
 funding.rows = pairs.slice(0,100).map((p,i) => ({ id:`funding-${i}`,asset:text(p.asset_id),long_venue:text(p.long_venue),short_venue:text(p.short_venue),long_rate:text(p.long_rate),short_rate:text(p.short_rate),indicative_diff_per_hour:text(p.indicative_diff_per_hour),state:'HOLD' }));
 funding.total_rows = pairs.length;
 funding.candidates = pairs.slice(0,100).map((d,i) => candidate(`funding-${i}`,d,text(d.asset_id) ?? 'UNKNOWN','HOLD',funding.updated_at,['long_venue','short_venue','long_rate','short_rate','indicative_diff_per_hour'],strings(d.reasons)));
 funding.events = [...events(f.events),...events(progress.events)].slice(-60);
 funding.notes.push('Показаны первые 100 пар в сохранённом порядке; total_rows — все пары. Разница ставок не net PnL. Интервал не подставляется по умолчанию. Sidecar — сообщение коллектора, не проверка ОС-процесса.');
 table(funding,['asset','long_venue','short_venue','long_rate','short_rate','indicative_diff_per_hour','state']);
 pipeline(funding,'engine/funding_monitor: публичный GET, нормализация интервалов, discovery пар','Ticker-only identity и contract units не сертифицированы.');
 if (progress.running === true && ageState(timestamp(progress.updated_at),now,180_000) === 'fresh') {
  funding.stages[0] = { ...funding.stages[0],state:'running',at:timestamp(progress.updated_at),detail:`Сбор текущего run: ${text(progress.run_id) ?? 'неизвестен'}; биржа: ${text(progress.current_venue) ?? 'не указана'}. Таблица — последний завершённый snapshot ${funding.updated_at ?? 'отсутствует'}; свежесть таблицы: ${funding.state}.` };
 }
 const smc = base('smc','SMC','SMC BTC','PREVIEW');
 const s = obj(src.smc.data), candles = obj(s.candles), counts = obj(s.counts), signal = obj(src.signal.data);
 const preview = list(s.candidates), legacy = list(src.legacy.data), audits = list(src.audit.data), pa = list(src.previewAudit.data);
 smc.subtitle = 'Legacy v0.1 saved/live-path отдельно от v0.3 PREVIEW: 1h sweep → 15m IFVG';
 smc.market = 'v0.3: MEXC_SPOT saved · не BingX Futures';
 smc.version = text(s.version) ?? 'v0.3 preview unavailable; v0.1 legacy';
 smc.updated_at = timestamp(candles.as_of);
 smc.last_attempt_at = timestamp(signal.detected_at);
 smc.state = src.smc.data ? ageState(smc.updated_at,now,86_400_000) : src.smc.state;
 sourceInfo(smc,[['smc',src.smc],['legacy',src.legacy],['signal',src.signal],['audit',src.audit],['previewAudit',src.previewAudit]]);
 smc.blockers.push(...strings(s.deployment_blockers),'PRODUCTION_ELIGIBILITY_ZERO','LEGACY_AUDITED_DEFECTS');
 if (src.smc.data && text(counts.total) !== String(preview.length)) { smc.blockers.push('SOURCE_COUNT_MISMATCH'); smc.state = 'partial'; }
 smc.facts = [...fields(counts,['total','preview_eligible','pending','rejected','production_eligible']),...fields(candles,['first_open','latest_close','as_of']),fact('Legacy сохранённых сетапов',String(legacy.length)),fact('Legacy last_signal обнаружен',signal.detected_at),fact('Legacy last_signal != текущая позиция',obj(list(signal.signals)[0]).status),fact('Аудит legacy вариантов',String(audits.length)),fact('Аудит preview вариантов',String(pa.length))];
 smc.rows = preview.slice(0,100).map((d,i) => ({ id:`smc-preview-${i}`,version:'v0.3 PREVIEW',symbol:text(d.symbol),side:text(d.side),at:text(d.decision_time),state:text(d.reason),entry:text(d.entry),sl:text(d.sl),tp1:text(d.tp1),tp2:text(d.tp2),production_eligible:text(d.production_eligible) }));
 smc.candidates = preview.slice(0,100).map((d,i) => candidate(`smc-preview-${i}`,d,text(d.symbol) ?? 'BTCUSDT',text(d.reason) ?? 'unknown',timestamp(d.decision_time),['entry','sl','tp1','tp2','sweep_extreme','preview_eligible','production_eligible'],strings(d.warnings)));
 for (const [i,d] of legacy.slice(-50).entries()) {
  const id = `smc-legacy-${i}`;
  smc.rows.push({ id,version:'v0.1 LEGACY SAVED',symbol:'BTCUSDT',side:text(d.side),at:text(d.time),state:text(d.status),entry:text(d.entry),sl:text(d.sl),tp1:text(d.tp),tp2:null,production_eligible:null });
  smc.candidates.push(candidate(id,d,'BTCUSDT',`legacy:${text(d.status)}`,timestamp(d.time),['entry','sl','tp','time','status'],['LEGACY_SIMULATED_STATUS_NOT_FILL','NOT_V03']));
 }
 smc.total_rows = preview.length + legacy.length;
 for (const a of audits) smc.candidates.push(candidate(`audit-${text(a.name)}`,a,text(a.name) ?? 'legacy','AUDITED_LEGACY',timestamp(a.last_entry_close),['first_entry_close','last_entry_close','taken','first_breaches','legacy_mean_R','median_exact_cost_R','not_equity_maxdd'],Object.entries(obj(a.flags)).filter(([,v])=> v !== '0').map(([k,v])=>`${k}: ${text(v)}`)));
 smc.notes.push('Audit summary читается целиком только до 100 KB; большие candidate JSONL (включая 156 MB) не читаются. Legacy: stale/previously inverted IFVG, causal target/lookahead и TP1→BE OHLC ambiguity отражены в audit drilldown; дефекты не доказывают отсутствие edge у новой карточки.','v0.3: production_eligible=0; preview не position engine, PnL и cost_R отсутствуют; HTF context, окно и tick rounding не утверждены. Legacy saved win/loss не реальные fills. Last_signal может быть старее setups_live.','Показано до 100 preview + 50 последних legacy строк; audit summaries доступны отдельными кандидатами.');
 smc.events = preview.slice(-15).map(d=>({ at:timestamp(d.decision_time),stage:'v0.3 preview',state:text(d.reason) ?? 'unknown',message:`${text(d.symbol)} ${text(d.side)} · production_eligible=${text(d.production_eligible)}` }));
 table(smc,['version','symbol','side','at','state','entry','sl','tp1','tp2','production_eligible']);
 pipeline(smc,'smc_detector.py v0.1 legacy; v0.3 отдельный read-only preview','1h sweep → 15m IFVG в preview; неподтверждённые context/window/tick — блокеры.');
 const pump = base('pump','PUMP','Pump / dump screen','PREVIEW');
 const pd = obj(src.pump.data), markets = list(pd.markets);
 const screened = markets.filter(m=>strings(m.flags).some(flag=>flag==='pump_24h_threshold'||flag==='dump_24h_threshold'));
 pump.subtitle = 'SAVED BingX ±20% / rolling 24h proxy — НЕ стратегия шорта пампов ≥50%';
 pump.market = 'BingX USDT perpetual saved snapshot'; pump.version = 'scanner saved proxy schema 1';
 pump.updated_at = timestamp(pd.generated_at); pump.last_attempt_at = timestamp(pd.completed_at);
 pump.state = src.pump.data ? ageState(pump.updated_at,now,300_000) : src.pump.state;
 sourceInfo(pump,[['pump',src.pump]]);
 pump.blockers.push('REAL_PUMP_FEED_MISSING','NOT_USER_50PCT_SHORT_STRATEGY','HISTORY_OI_FLOW_NOT_COLLECTED');
 pump.facts = [fact('Всего рынков snapshot',String(markets.length)),fact('±20% threshold строк',String(screened.length)),fact('pump threshold',String(screened.filter(m=>strings(m.flags).includes('pump_24h_threshold')).length)),fact('dump threshold',String(screened.filter(m=>strings(m.flags).includes('dump_24h_threshold')).length)),fact('Source status',pd.status),fact('Source generated_at',pd.generated_at)];
 pump.rows = screened.slice(0,100).map((d,i)=>({ id:`pump-${i}`,symbol:text(d.symbol),last_price:text(d.last_price),change_24h_pct:text(d.change_24h_pct),quote_volume_24h:text(d.quote_volume_24h),state:strings(d.flags).filter(f=>f.includes('24h_threshold')).join(', ') }));
 pump.total_rows = screened.length;
 pump.candidates = screened.slice(0,100).map((d,i)=>candidate(`pump-${i}`,d,text(d.symbol) ?? 'UNKNOWN','SAVED_THRESHOLD_NOT_SIGNAL',pump.updated_at,['last_price','change_24h_pct','quote_volume_24h','funding_rate','funding_interval_hours','history_status','open_interest','volume_anomaly'],['REAL_PUMP_FEED_MISSING','NOT_SHORT_ENTRY']));
 pump.notes.push('Порог берётся из сохранённых pump_24h_threshold/dump_24h_threshold flags; фильтр ±20%, не статистическая аномалия. До 100 строк. Нет стратегии входа/выхода, стопа, liquidation-risk или исполнения.','journal/core/pump_scan.py существует, но пишет БД: не запускается и не импортируется. Сохранённый proxy не заменяет этот feed.');
 table(pump,['symbol','last_price','change_24h_pct','quote_volume_24h','state']);
 pipeline(pump,'engine/scanner/scanner.py: ±20% / 24h threshold screen','Rolling 24h change; нет temporal volume baseline / OI / buy-flow.');
 if (stored.pump?.error) pump.blockers.push('STORED_PUMP_READER_ERROR: '+text(stored.pump.error));
 if (stored.pump && !stored.pump.error && stored.pump.rows.length > 0) {
  const signals = stored.pump.rows.slice(0,200);
  const signalTime = (d: Obj): string | null => d.setup_time instanceof Date ? d.setup_time.toISOString() : timestamp(d.setup_time);
  pump.mode = 'SAVED_SIGNALS';
  pump.subtitle = 'Сохранённые сигналы pump-mexc: mode LIVE не означает реальные заявки';
  pump.market = 'MEXC · исторический pump-mexc source; не BingX live';
  pump.version = 'journal/core/pump_scan.py · persisted signals';
  pump.updated_at = signals.map(signalTime).filter((t): t is string=>t!==null).sort().at(-1) ?? null;
  pump.last_attempt_at = null;
  pump.state = ageState(pump.updated_at,now,3_600_000) === 'fresh' ? 'saved' : 'stale';
  pump.sources.unshift('journal/web/src/server/signals.ts: signalList("pump-mexc", false) SELECT LIMIT 200');
  pump.facts.unshift(fact('Сохранённых сигналов прочитано',String(signals.length)),fact('Последний setup_time',pump.updated_at),fact('Полнота DB выборки',signals.length === 200 ? 'LIMIT 200: общий count неизвестен' : 'Выборка меньше LIMIT 200'));
  pump.blockers = pump.blockers.filter(b=>b !== 'REAL_PUMP_FEED_MISSING' && b !== 'NOT_USER_50PCT_SHORT_STRATEGY');
  pump.blockers.push('NOT_REAL_ORDER_EVIDENCE','LIVE_PUMP_COLLECTOR_NOT_VERIFIED','MEXC_NOT_BINGX');
  const safeKeys = ['entry','stop_loss','tp','simulated_r','rise','max_drop','max_up','mode','status'];
  pump.rows = signals.map((d,i)=>({ id:text(d.id) ?? `pump-saved-${i}`,symbol:text(d.base),side:text(d.side),at:signalTime(d),entry:text(d.entry),sl:text(d.stop_loss),tp:text(d.tp),simulated_r:text(d.simulated_r),rise_24h:text(d.rise),mode:text(d.mode),state:text(d.status) }));
  pump.total_rows = signals.length;
  pump.candidates = signals.map((d,i)=>candidate(text(d.id) ?? `pump-saved-${i}`,d,text(d.base) ?? 'UNKNOWN',`SAVED:${text(d.status)}`,signalTime(d),safeKeys,['SIMULATED_R_NOT_REAL_PNL','MODE_LIVE_NOT_ORDER_EVIDENCE','MEXC_NOT_BINGX']));
  pump.events = signals.slice(0,20).map(d=>({at:signalTime(d),stage:'persisted pump-mexc',state:text(d.status) ?? 'unknown',message:`${text(d.base)} ${text(d.side)} · mode=${text(d.mode)}; не исполненная заявка`}));
  pump.notes.push('Основной источник — сохранённые DB signals, до 200 записей. DB mode/status/simulated_r не фактические заявки и не personal PnL. Private trade_id/trade_n/trade_net отбрасываются. BingX ±20% snapshot остаётся только справочным proxy в facts; не подменяет эти сигналы.');
  table(pump,['symbol','side','at','entry','sl','tp','simulated_r','rise_24h','mode','state']);
  pipeline(pump,'pump_scan.py: только чтение ранее записанных signals через существующий SELECT reader','MEXC saved источник, не утверждение работающего collector/short engine на BingX.');
 }
 const bt = obj(src.backtest.data);
 function historical(id: string, codes: string[], title: string): StrategyPanel {
  const p = base(id,codes.join('/'),title,'BACKTEST_ONLY');
  p.subtitle = 'Сохранённый исторический тест 2026-10-14 — не live PnL и не форвард';
  p.market = 'Binance USDⓈ-M futures · data.binance.vision · 2021-01 — 2026-09';
  p.version = 'backtest 2026-10-14'; p.updated_at = src.backtest.at; p.state = src.backtest.data ? 'saved' : src.backtest.state;
  sourceInfo(p,[['backtest',src.backtest]]);
  p.sources.push('engine/backtest/strategies.py','engine/backtest/run_all.py','reports/backtests/2026-10-14/REPORT.md');
  p.blockers.push('LIVE_EXECUTOR_NOT_WIRED','FORWARD_EVIDENCE_MISSING');
  p.facts = [fact('Исторический период','2021-01 — 2026-09'),fact('Дата отчёта','2026-10-14'),fact('Издержки','taker 0.05% + slippage 0.02% на сторону; maker 0.02%; funding включён'),fact('Исторический проход','Sharpe после издержек ≥0.5 в обоих split; не live approval')];
  for (const code of codes) {
   const d = obj(bt[code]);
   p.facts.push(fact(`${code} правила`,d.note),fact(`${code} исторический verdict`,d.verdict));
   for (const [period,raw] of Object.entries(obj(d.splits))) {
    const metrics = obj(raw), row: Record<string,string|null> = { id:`${code}-${period}`,variant:code,period:period === 'Весь период' ? '2021-01 — 2026-09' : period,side:code === 'S4' ? 'long-short' : 'long-only' };
    for (const key of ['Sharpe','CAGR %','MaxDD %','Худший день %','Доход/год при DD 4% %']) row[key]=text(metrics[key]);
    p.rows.push(row);
    const detail = candidate(`${code}-${period}`,{...metrics,rules:d.note,verdict:d.verdict},code,'HISTORICAL_ONLY',null,[...Object.keys(metrics),'rules','verdict'],['NO_FORWARD','NOT_LIVE_PROFIT']);
    detail.side = row.side;
    detail.summary = `${code} · ${row.period} · исторический тест`;
    detail.facts = [fact('Вариант',code),fact('Период split',row.period),...detail.facts,...Object.entries(obj(d.extra)).map(([key,value])=>fact(`${key} · весь период`,value,'2021-01 — 2026-09, не отдельный split'))];
    p.candidates.push(detail);
   }
   for (const [year,value] of Object.entries(obj(d['yearly %']))) p.facts.push(fact(`${code} ${year} historical return %`,value,year === '2026' ? 'Только январь–сентябрь 2026' : 'Сохранённый отчёт, не live'));
  }
  p.total_rows = p.rows.length;
  p.notes.push('Оценочные splits: 2021–2023 и 2024–2026.09; точные per-bar warmup/evaluation dates в results.json отсутствуют и не выдумываются. Упрощённые реализации по источникам; параметры не подгонялись к этой истории.','Источник агрегатов — results.json/REPORT.md, а не пересчитанный бэктест; equity curve и текущие позиции не синтезируются. Доход/год при DD4% — историческая модель масштабирования, не прогноз.');
  if (id === 'donchian') p.notes.push('S1: корзина из 15 монет выбрана на дату теста — survivorship bias.');
  table(p,['variant','side','period','Sharpe','CAGR %','MaxDD %','Худший день %','Доход/год при DD 4% %']);
  pipeline(p,id === 'donchian' ? 's1_donchian: дневной long/flat ансамбль (20,40,80,160)' : 's4_tsmom: дневные (7,14,28), S4 long-short и S4L long_only=True','Сохранённый Binance futures backtest; не текущие BingX candles.');
  return p;
 }
 return { schema_version:1, served_at:now.toISOString(),read_only:true,execution_enabled:false,strategies:[funding,smc,pump,historical('donchian',['S1'],'Donchian ensemble'),historical('tsmom',['S4','S4L'],'TSMOM variants')] };
}
