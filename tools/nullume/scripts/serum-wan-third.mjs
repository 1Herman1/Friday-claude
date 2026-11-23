// Fixed-case Nullume/KIE adapter. No arbitrary model, prompt, URL, or authenticated endpoint input.
import assert from 'node:assert/strict';
import {createHash,createDecipheriv} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {open,mkdir,writeFile,appendFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {httpsOnce,boundedRequest,isPublicIPv4,validateWanMedia} from './serum-wan-transport.mjs';
export {isPublicIPv4};
const ROOT=fileURLToPath(new URL('../../../docs/projects/perfect-skin/media-review/serum-wan-third/',import.meta.url));
export const MODEL='wan/2-7-videoedit';
export const FREEZE_SHA='9632976e7b7127aebebee3f236199a6a8d0350c1ae144acdad8d99ca956f1ecd';
const BUNDLE_SHA='eca879eafd7b6c766df4ae7b54b7cb290c001d43d882f8fa7a9feb900468663c';
export const TOKEN='confirm-wan-third-one-32';
export const PRICE='https://api.kie.ai/client/v1/model-pricing/page';
export const DOC='https://docs.kie.ai/market/wan/2-7-videoedit.md';
export const UPLOAD='https://kieai.redpandaai.co/api/file-stream-upload';
export const CREATE='https://api.kie.ai/api/v1/jobs/createTask';
export const CREDIT='https://api.kie.ai/api/v1/chat/credit';
export const STATUS='https://api.kie.ai/api/v1/jobs/recordInfo?taskId=';
const sha=b=>createHash('sha256').update(b).digest('hex');
const raw=readFileSync(join(ROOT,'freeze.json'));assert.equal(sha(raw),FREEZE_SHA);
export const freeze=JSON.parse(raw);
const fail=()=>{throw new Error('Fixed-case validation or provider operation failed; no POST retry.');};
const check=(v)=>{if(!v)fail();};
export function taskId(v){check(typeof v==='string'&&/^(?:[a-f0-9]{32}|task_[A-Za-z0-9_-]{1,120})$(?![\s\S])/.test(v));return v;}
export function mediaURL(v,ext,host='tempfile.redpandaai.co'){
 check(typeof v==='string'&&v.length<=2048&&v.startsWith('https://'+host+'/'));
 const p=v.slice(('https://'+host+'/').length);
 check(p.endsWith('.'+ext)&&p.split('/').every(s=>/^[A-Za-z0-9_-][A-Za-z0-9_.-]*$(?![\s\S])/.test(s)));
 return v;
}
export function payload(urls){
 check(Array.isArray(urls)&&urls.length===2&&new Set(urls).size===2);
 urls.forEach((u,i)=>mediaURL(u,freeze.assets[i].path.split('.').at(-1)));
 return {model:MODEL,input:{...freeze.settings,video_url:urls[0],reference_image:urls[1]}};
}
export function validateSchema(){
 const b=readFileSync(join(ROOT,'evidence/request-schema.json'));check(sha(b)===freeze.schema_sha256);
 const s=JSON.parse(b),p=payload(freeze.assets.map((a,i)=>'https://tempfile.redpandaai.co/dry/'+i+'.'+a.path.split('.').at(-1)));
 check(s.properties.model.enum.length===1&&s.properties.model.enum[0]===MODEL);
 for(const [k,v] of Object.entries(p.input)){
  const f=s.properties.input.properties[k];check(f&&f.type===(Array.isArray(v)?'array':Number.isInteger(v)?'integer':typeof v));
  check(!f.enum||f.enum.includes(v));check(!f.maxItems||v.length<=f.maxItems);check(!f.maxLength||v.length<=f.maxLength);
 }
 return p;
}
export function verifyAssets(pack){
 check(pack&&Object.keys(pack).length===2);
 return freeze.assets.map(a=>{check(Object.hasOwn(pack,a.path)&&typeof pack[a.path]==='string');const b=Buffer.from(pack[a.path],'base64');check(b.length===a.size&&sha(b)===a.sha256);return b;});
}
export function decryptAssets(key){
 check(typeof key==='string'&&/^[a-f0-9]{64}$/.test(key));
 const b=readFileSync(join(ROOT,'authorized-assets.aesgcm'));check(sha(b)===BUNDLE_SHA);
 const c=createDecipheriv('aes-256-gcm',Buffer.from(key,'hex'),b.subarray(0,12));c.setAuthTag(b.subarray(12,28));
 return verifyAssets(JSON.parse(Buffer.concat([c.update(b.subarray(28)),c.final()]).toString()));
}
export function exactPrice(pages){
 let total,seen=0;const matches=[];
 for(const p of pages){const n=Number(p?.data?.total),r=p?.data?.records;total??=n;
  check(p?.code===200&&Number.isSafeInteger(n)&&n>0&&n<=2000&&n===total&&Array.isArray(r)&&r.length===Math.min(100,total-seen));seen+=r.length;
  matches.push(...r.filter(r=>r.anchor==='https://kie.ai/wan-2-7-video?model=wan%2F2-7-videoedit'&&r.modelDescription==='wan 2.7 video, videoedit, 720p'));
 }
 check(seen===total&&matches.length===1);const r=matches[0];
 check(r.provider==='Wan'&&r.interfaceType==='video'&&r.creditPrice==='16'&&r.creditUnit==='per second'&&r.usdPrice==='0.08'&&r.discountPrice===false);
 check(freeze.duration===2&&16*freeze.duration===32&&freeze.quotedCredits===32&&freeze.providerBillingCap===false);return {total,quotedCredits:32,providerBillingCap:false};
}
async function json(request,url,init){const r=await boundedRequest(request,url,init);try{return JSON.parse(r.bytes.toString());}catch{fail();}}
export async function publicMetadata(request=httpsOnce){
 validateSchema();
 // Fail closed on any live documentation byte drift; no invented schema parser.
 const archived=readFileSync(join(ROOT,'evidence/wan-2-7-videoedit.md'));
 const current=await boundedRequest(request,DOC);check(sha(current.bytes)===sha(archived));
 const pages=[];let n=0,total;
 for(let pageNum=1;pageNum<=20;pageNum++){
  const p=await json(request,PRICE,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({pageNum,pageSize:100,modelDescription:'',interfaceType:''})});
  pages.push(p);check(Array.isArray(p?.data?.records));n+=p.data.records.length;total??=Number(p.data.total);check(Number.isSafeInteger(total)&&total>0&&total<=2000);if(n>=total)break;
 }
 return exactPrice(pages);
}
export function authorize(env,recovery=false){
 check(env.GITHUB_ACTIONS==='true'&&env.GITHUB_EVENT_NAME==='workflow_dispatch'&&env.GITHUB_RUN_ATTEMPT==='1'&&env.RUNNER_TEMP&&/^\d{1,20}$/.test(env.GITHUB_RUN_ID??'')&&env.WAN_THIRD_APPROVED_RUN_ID===env.GITHUB_RUN_ID&&env.WAN_THIRD_APPROVED_SHA===env.GITHUB_SHA&&/^[a-f0-9]{40}$/.test(env.GITHUB_SHA??''));
 check(env.GITHUB_REPOSITORY==='1Herman1/Friday-claude');
 check(env.GITHUB_REF==='refs/heads/ci/serum-wan27-third-only');
 if(recovery){taskId(env.WAN_THIRD_TASK_ID);check(env.WAN_THIRD_TASK_ID===env.WAN_THIRD_APPROVED_TASK_ID&&/^\d{1,20}$/.test(env.WAN_THIRD_SOURCE_RUN_ID??'')&&env.WAN_THIRD_SOURCE_RUN_ID===env.WAN_THIRD_APPROVED_SOURCE_RUN_ID);}
 else check(env.WAN_THIRD_ARMED===TOKEN&&env.WAN_THIRD_CONFIRMATION===TOKEN);
}
export function fixedSession(request,key,existingTask){
 check(typeof key==='string'&&/^[A-Za-z0-9_.~-]{8,512}$(?![\s\S])/.test(key));
 let submitted=false;const readOnly=existingTask!==undefined;let active=readOnly?taskId(existingTask):undefined;
 return {
  async call(url,init={},expected){
   const method=init.method??'GET';
   const create=!readOnly&&!submitted&&url===CREATE&&method==='POST'&&expected&&init.body===JSON.stringify(expected);
   if(create){
    const i=expected.input;check(i&&JSON.stringify(expected)===JSON.stringify(payload([i.video_url,i.reference_image])));
   }
   const allowed=create||(!readOnly&&url===UPLOAD&&method==='POST'&&init.body instanceof FormData)||(!readOnly&&url===CREDIT&&method==='GET')||(active&&url===STATUS+active&&method==='GET');
   check(allowed);if(create)submitted=true;
   const headers={...init.headers,authorization:'Bearer '+key};
   const r=await json(request,url,{...init,headers});
   check(r?.code===200);if(create){active=taskId(r.data?.taskId);check(!active.includes(key));}
   return r;
  }
 };
}
export async function writeReceipt(dir,id,env){
 taskId(id);check(/^\d{1,20}$/.test(env.GITHUB_RUN_ID??'')&&/^[a-f0-9]{40}$/.test(env.GITHUB_SHA??''));
 const receipt={taskId:id,sourceRunId:env.GITHUB_RUN_ID,sourceSha:env.GITHUB_SHA,model:MODEL,duration:2,resolution:'720p',quotedCredits:32,providerBillingCap:false,assetsFreezeSha256:FREEZE_SHA,state:'submitted'};
 const h=await open(join(dir,'task-receipt.json'),'wx',0o600);try{await h.writeFile(JSON.stringify(receipt)+'\n');await h.sync();}finally{await h.close();}const d=await open(dir,'r');try{await d.sync();}finally{await d.close();}return receipt;
}
export async function submit({request=httpsOnce,key,assets,onSubmitted}){
 check(assets.length===2);assets.forEach((b,i)=>check(b.length===freeze.assets[i].size&&sha(b)===freeze.assets[i].sha256));
 for(let i=0;i<2;i++)await validateWanMedia(assets[i],i===0?'source':'reference');
 await publicMetadata(request);const s=fixedSession(request,key);
 const credits=await s.call(CREDIT);check(typeof credits.data==='number'&&Number.isFinite(credits.data)&&credits.data>=32);
 const urls=[];
 for(let i=0;i<2;i++){
  const a=freeze.assets[i],name=a.path.split('/').at(-1),body=new FormData();
  body.append('file',new Blob([assets[i]],{type:a.mime}),name);body.append('uploadPath','serum-wan-third/'+FREEZE_SHA);body.append('fileName',name);
  const r=await s.call(UPLOAD,{method:'POST',body});check(r.success===true);const u=mediaURL(r.data?.downloadUrl,name.split('.').at(-1));check(!u.includes(key));
  // Download is unauthenticated, fixed CDN and hash verified. Never send the KIE bearer to a CDN.
  const uploaded=await boundedRequest(request,u,{},a.size,60000);check(uploaded.bytes.length===a.size&&sha(uploaded.bytes)===a.sha256);urls.push(u);
 }
 const p=payload(urls);await publicMetadata(request);
 const r=await s.call(CREATE,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(p)},p);
 const id=taskId(r.data.taskId);await onSubmitted(id);return id;
}
export async function recover({request=httpsOnce,key,id,pause=delay}){
 taskId(id);check(!id.includes(key));const s=fixedSession(request,key,id);
 for(let i=0;i<65;i++){
  let r;for(let j=0;j<3;j++){try{r=await s.call(STATUS+id);break;}catch{if(j===2)fail();await pause(1000);}}
  const d=r.data;check(d?.taskId===id&&d.model===MODEL);
  if(d.state==='success'){
   check(typeof d.resultJson==='string');const result=JSON.parse(d.resultJson);check(Array.isArray(result.resultUrls)&&result.resultUrls.length===1);
   const u=mediaURL(result.resultUrls[0],'mp4','tempfile.aiquickdraw.com');check(!u.includes(key));
   let video;for(let j=0;j<3;j++){try{video=await boundedRequest(request,u,{},64*1024*1024,30000);break;}catch{if(j===2)fail();await pause(1000);}}
   check(video.headers.get('content-type')?.split(';')[0]==='video/mp4'&&video.bytes.length>=16&&video.bytes.toString('ascii',4,8)==='ftyp');
   const c=d.creditsConsumed;check(c===undefined||(Number.isFinite(c)&&c>=0));
   return {video:video.bytes,summary:{taskId:id,model:MODEL,quotedCredits:32,providerBillingCap:false,...(c===undefined?{}:{creditsConsumed:c,billingViolation:c>32})}};
  }
  check(['waiting','queuing','generating'].includes(d.state));if(i<64)await pause(10000);
 }
 fail();
}
async function main(){
 const [mode,...extra]=process.argv.slice(2);check(extra.length===0);
 if(mode==='dry-run'){
  validateSchema();exactPrice(Array.from({length:8},(_,i)=>JSON.parse(readFileSync(join(ROOT,'evidence/price-page-'+(i+1)+'.json')))));
  check(sha(readFileSync(join(ROOT,'authorized-assets.aesgcm')))===BUNDLE_SHA);
  if(process.env.WAN_THIRD_LOCAL_DRY_ASSETS){
   check(process.env.GITHUB_ACTIONS!=='true');const pack={};for(const a of freeze.assets)pack[a.path]=readFileSync(join(process.env.WAN_THIRD_LOCAL_DRY_ASSETS,a.path)).toString('base64');
   const assets=verifyAssets(pack);for(let i=0;i<2;i++)await validateWanMedia(assets[i],i===0?'source':'reference');
  }
  console.log('PASS credential-free dry-run; quote 32 credits / USD0.16; providerBillingCap=false.');return;
 }
 check(['generate-one','recover-existing-task'].includes(mode));authorize(process.env,mode==='recover-existing-task');
 const dir=join(process.env.RUNNER_TEMP,'serum-wan-third-result');
 if(mode==='generate-one'){
  await mkdir(dir,{mode:0o700}); // Exclusive same-job duplicate-process guard, before reading either secret.
  const assets=decryptAssets(process.env.WAN_THIRD_ASSET_KEY);delete process.env.WAN_THIRD_ASSET_KEY;
  const key=process.env.KIE_API_KEY;delete process.env.KIE_API_KEY;
  for(let i=0;i<2;i++)await validateWanMedia(assets[i],i===0?'source':'reference');
  await submit({key,assets,onSubmitted:async id=>{
   try{await writeReceipt(dir,id,process.env);}
   finally{
    // If local receipt persistence fails, retain the validated ID in Actions control-plane output/summary.
    // The workflow still refuses polling unless the independent receipt artifact upload succeeds.
    if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,'task_id='+id+'\n');
    if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,'Task `'+id+'`; quoted32 credits / USD0.16, NOT a provider cap.\n');
   }
  }});return;
 }
 await mkdir(dir,{recursive:true,mode:0o700});const key=process.env.KIE_API_KEY;delete process.env.KIE_API_KEY;
 const r=await recover({key,id:process.env.WAN_THIRD_TASK_ID});
 await writeFile(join(dir,'unverified.mp4'),r.video,{flag:'wx',mode:0o600});
 await writeFile(join(dir,'result.json'),JSON.stringify({...r.summary,mediaValidated:false})+'\n',{mode:0o600});
 await validateWanMedia(r.video,'result');
 await writeFile(join(dir,'result.json'),JSON.stringify({...r.summary,mediaValidated:true})+'\n',{mode:0o600});
 if(r.summary.billingViolation)fail();
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('Serum motion adapter stopped; provider submission may have occurred. Inspect receipt; never repeat create.');process.exitCode=1;});
