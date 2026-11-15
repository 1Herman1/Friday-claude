export type Observation = {asset_id:string;symbol:string;venue:string;market_type:string;funding_rate:string|null;interval_hours:string|null;next_funding_ms:number|null;observed_at:string|null;volume_quote_24h:string|null;liquidity_class:string;source_url:string|null};
export type Pair = {asset_id:string;long_venue:string;short_venue:string;long_rate:string|null;short_rate:string|null;indicative_diff_per_hour:string|null;status:'HOLD';reasons:string[]};
export type Event = {at:string|null;stage:string;status:string;message:string};
export type Funding = {state:string;status:string;started_at:string|null;completed_at:string|null;sources:{venue:string;status:string;records:number|null;error:string|null}[];observations:Observation[];pairs:Pair[];events:Event[];progress?:{running:boolean;updated_at:string|null;current_venue:string;sources:Funding['sources'];events:Event[]}|null};
const obj = (v:unknown): Record<string,unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string,unknown> : {};
const list = (v:unknown):unknown[] => Array.isArray(v) ? v.slice(0,20000) : [];
export const safeText = (v:unknown) => typeof v === 'string' ? v.slice(0,500).replace(/(?:https?:\/\/\S+|\/(?:Users|home|private|etc)\/\S+|(?:token|password|secret|api[_-]?key|authorization)\s*[:=]\s*\S+)/gi,'[скрыто]') : '';
const name = (v:unknown) => safeText(v).slice(0,100);
const decimal = (v:unknown): string|null => typeof v === 'string' && /^-?\d+(?:\.\d+)?$/.test(v) && v.length <= 100 ? v : null;
const time = (v:unknown):string|null => typeof v === 'string' && Number.isFinite(Date.parse(v)) ? v : null;
export function normalizeFunding(input:unknown):Funding {
 const d=obj(input); const valid=d.schema_version===1 && ['ok','partial','error'].includes(String(d.status));
 if (!valid) return {state:input===null?'missing':'invalid',status:'unknown',started_at:null,completed_at:null,sources:[],observations:[],pairs:[],events:[]};
 return {state:'available',status:String(d.status),started_at:time(d.started_at),completed_at:time(d.completed_at),sources:list(d.sources).map(v=>{const r=obj(v);return {venue:name(r.venue),status:name(r.status),records:typeof r.records==='number'&&Number.isSafeInteger(r.records)?r.records:null,error:r.error?'Источник сообщил ошибку':null};}), observations:list(d.observations).map(v=>{const r=obj(v);return {asset_id:name(r.asset_id),symbol:name(r.symbol),venue:name(r.venue),market_type:name(r.market_type),funding_rate:decimal(r.funding_rate),interval_hours:decimal(r.interval_hours),next_funding_ms:typeof r.next_funding_ms==='number'&&Number.isSafeInteger(r.next_funding_ms)?r.next_funding_ms:null,observed_at:time(r.observed_at),volume_quote_24h:decimal(r.volume_quote_24h),liquidity_class:'UNKNOWN',source_url:null};}).filter(r=>r.symbol&&r.venue&&r.market_type==='USDT_PERPETUAL'),pairs:list(d.pairs).map(v=>{const r=obj(v);return {asset_id:name(r.asset_id),long_venue:name(r.long_venue),short_venue:name(r.short_venue),long_rate:decimal(r.long_rate),short_rate:decimal(r.short_rate),indicative_diff_per_hour:decimal(r.indicative_diff_per_hour),status:'HOLD',reasons:list(r.reasons).map(safeText)};}),events:list(d.events).slice(-150).map(v=>{const r=obj(v);return {at:time(r.at),stage:name(r.stage),status:name(r.status),message:safeText(r.message)};})};
}
export function normalizeProgress(input:unknown):Funding['progress'] {
 const d=obj(input);if(typeof d.running!=='boolean')return null;
 const parsed=normalizeFunding({schema_version:1,status:'ok',sources:d.sources,events:d.events});
 return {running:d.running,updated_at:time(d.updated_at),current_venue:name(d.current_venue),sources:parsed.sources,events:parsed.events};
}
export function activeProgress(progress:Funding['progress'], now:number):boolean {
 if(!progress?.running||!progress.updated_at)return false;
 const delta=now-Date.parse(progress.updated_at);return Number.isFinite(delta)&&delta>=-5000&&delta<=90000;
}
export function percent(value:string|null):string {
 if(value===null||!decimal(value))return '—';
 const negative=value.startsWith('-');const [whole,fraction='']=value.replace('-','').split('.');
 const digits=(whole+fraction.padEnd(2,'0'));const cut=whole.length+2;
 const integer=digits.slice(0,cut).replace(/^0+(?=\d)/,'');const rest=digits.slice(cut).replace(/0+$/,'');
 return `${negative?'-':''}${integer}${rest?'.'+rest:''}%`;
}
export function highFunding(value:string|null):boolean {if(!value||!decimal(value))return false;const [a,b='']=value.replace('-','').split('.');return BigInt(a)>BigInt(0)||BigInt((b+'00').slice(0,2))>=BigInt(1);}
export function stageState(events:Event[], stage:string, now:number):string {
 const e=[...events].reverse().find(e=>e.stage===stage);if(!e)return 'idle';
 if(!e.at||now-Date.parse(e.at)>90000||Date.parse(e.at)>now+5000)return 'idle';
 if(['running','started','start'].includes(e.status))return 'running';
 if(['ok','success','completed','done'].includes(e.status))return 'success';
 if(e.status==='partial')return 'partial';
 if(['error','failed'].includes(e.status))return 'error';return 'idle';
}
