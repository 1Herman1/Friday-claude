// Fixed-case Nullume/KIE adapter. No arbitrary model, prompt, URL, or authenticated endpoint input.
import assert from 'node:assert/strict';
import {createHash,createDecipheriv} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {open,mkdir,writeFile,appendFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {httpsOnce,boundedRequest,isPublicIPv4,validateDecodedMedia} from './serum-motion-transport.mjs';
export {isPublicIPv4};
const ROOT=fileURLToPath(new URL('../../../docs/projects/perfect-skin/media-review/serum-kling-omni-transform-right/',import.meta.url));
export const MODEL='kling-3.0-omni/transformation';
export const FREEZE_SHA='ffe0140c7fcffa1e05881493878b6424435859a42d43278fad34743f7d7cf739';
const BUNDLE_SHA='1ce3d0b9784e5c8848a2aa48441b083af5768b91e013e702d626d6e6e2d8e282';
export const TOKEN='confirm-serum-kling-omni-transform-right-227';
export const PRICE='https://api.kie.ai/client/v1/model-pricing/page';
export const DOC='https://docs.kie.ai/market/kling/v3-omni-transformation.md';
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
 check(Array.isArray(urls)&&urls.length===1);mediaURL(urls[0],'mp4');
 return {model:MODEL,input:{prompt:freeze.prompt,video_urls:urls,resolution:'720p',aspect_ratio:'auto',audio:false}};
}
export function validateSchema(){
 const d=readFileSync(join(ROOT,'evidence/kling-transformation.md'));check(sha(d)===freeze.schema_sha256);
 const text=d.toString();for(const x of [MODEL,'Video Input Only','video_urls','3072','24 and 60 fps','auto'])check(text.includes(x));
 check(freeze.prompt.length>0&&freeze.prompt.length<=3072&&freeze.assets.length===1&&freeze.assets[0].sha256==='c4751b55fa9596191696fa43ad56298919d72e2454ad20ecd5eb5c9022f0e327');
 return payload(['https://tempfile.redpandaai.co/dry/source.mp4']);
}
export function loadAssets(){return freeze.assets.map(a=>{const b=readFileSync(join(ROOT,a.path));check(b.length===a.size&&sha(b)===a.sha256);return b;});}
export function exactPrice(pages){
 let total,seen=0;const matches=[];
 for(const p of pages){const n=Number(p?.data?.total),r=p?.data?.records;total??=n;
 check(p?.code===200&&Number.isSafeInteger(n)&&n>0&&n<=2000&&n===total&&Array.isArray(r)&&r.length===Math.min(100,total-seen));seen+=r.length;
 matches.push(...r.filter(r=>r.anchor==='https://kie.ai/kling-o3?model=kling-3.0-omni%2Ftransformation'&&r.modelDescription==='kling 3.0 omni, transformation, 720p'));
 }
 check(seen===total&&matches.length===1);const r=matches[0];
 check(r.provider==='Kling'&&r.interfaceType==='video'&&r.creditPrice==='22.7'&&r.creditUnit==='per second'&&r.usdPrice==='0.1135'&&r.discountPrice===false);
 check(freeze.sourceDurationSeconds===10&&freeze.quotedCredits===227&&freeze.ownerMaximumCredits===227);return {total,quotedCredits:227,rateRow:r,providerBillingCap:false};
}
async function json(request,url,init){const r=await boundedRequest(request,url,init);try{return JSON.parse(r.bytes.toString());}catch{fail();}}
export async function publicMetadata(request=httpsOnce,key){
 validateSchema();const current=await boundedRequest(request,DOC);check(sha(current.bytes)===freeze.schema_sha256);
 const pages=[];let n=0,total;
 for(let pageNum=1;pageNum<=20;pageNum++){
 const headers={'content-type':'application/json',...(key?{authorization:'Bearer '+key}:{})};
 const p=await json(request,PRICE,{method:'POST',headers,body:JSON.stringify({pageNum,pageSize:100,modelDescription:'',interfaceType:''})});
 pages.push(p);check(Array.isArray(p?.data?.records));n+=p.data.records.length;total??=Number(p.data.total);check(Number.isSafeInteger(total)&&total>0&&total<=2000);if(n>=total)break;
 }
 const q=exactPrice(pages);console.log('FRESH_QUOTE',JSON.stringify({...q,authenticated:Boolean(key)}));return q;
}
export function authorize(env,recovery=false){
 check(!['45569301373','45493711451','46042223366'].includes(env.GITHUB_RUN_ID)&&env.GITHUB_SHA!=='2ea1b2b12838d0f3cca264c88716544ab6f3e4b8');
 check(freeze.requestId==='serum-kling-omni-transform-right-one-227');
 if(recovery)check(!['542235a8f513f7367a181930182bebdc','953fc98328962b1de6c830cf3c51ca97'].includes(env.SERUM_OMNI_TASK_ID));
 check(env.GITHUB_ACTIONS==='true'&&env.GITHUB_EVENT_NAME==='workflow_dispatch'&&env.GITHUB_RUN_ATTEMPT==='1'&&env.RUNNER_TEMP&&/^\d{1,20}$/.test(env.GITHUB_RUN_ID??'')&&env.SERUM_OMNI_APPROVED_RUN_ID===env.GITHUB_RUN_ID&&env.SERUM_OMNI_APPROVED_SHA===env.GITHUB_SHA&&/^[a-f0-9]{40}$/.test(env.GITHUB_SHA??''));
 check(env.GITHUB_REF==='refs/heads/ci/serum-actual-one');
 if(recovery){taskId(env.SERUM_OMNI_TASK_ID);check(env.SERUM_OMNI_TASK_ID===env.SERUM_OMNI_APPROVED_TASK_ID&&/^\d{1,20}$/.test(env.SERUM_OMNI_SOURCE_RUN_ID??'')&&env.SERUM_OMNI_SOURCE_RUN_ID===env.SERUM_OMNI_APPROVED_SOURCE_RUN_ID);}
 else check(env.SERUM_OMNI_ARMED===TOKEN&&env.SERUM_OMNI_CONFIRMATION===TOKEN);
}
export function fixedSession(request,key,existingTask){
 check(typeof key==='string'&&/^[A-Za-z0-9_.~-]{8,512}$(?![\s\S])/.test(key));
 let submitted=false;const readOnly=existingTask!==undefined;let active=readOnly?taskId(existingTask):undefined;
 return {
  async call(url,init={},expected){
   const method=init.method??'GET';
   const create=!readOnly&&!submitted&&url===CREATE&&method==='POST'&&expected&&init.body===JSON.stringify(expected);
   if(create){
    const i=expected.input;check(i&&JSON.stringify(expected)===JSON.stringify(payload(i.video_urls)));
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
export function validateReceipt(receipt,env){
 check(receipt.taskId===env.SERUM_OMNI_TASK_ID&&receipt.sourceRunId===env.SERUM_OMNI_SOURCE_RUN_ID&&receipt.sourceSha===env.SERUM_OMNI_SOURCE_SHA&&receipt.model===MODEL&&receipt.assetsFreezeSha256===FREEZE_SHA&&receipt.quotedCredits===227);return receipt;
}
export async function writeReceipt(dir,id,env){
 taskId(id);check(/^\d{1,20}$/.test(env.GITHUB_RUN_ID??'')&&/^[a-f0-9]{40}$/.test(env.GITHUB_SHA??''));
 const receipt={taskId:id,sourceRunId:env.GITHUB_RUN_ID,sourceSha:env.GITHUB_SHA,model:MODEL,duration:10,resolution:'720p',quotedCredits:227,providerBillingCap:false,assetsFreezeSha256:FREEZE_SHA,state:'submitted'};
 const h=await open(join(dir,'task-receipt.json'),'wx',0o600);try{await h.writeFile(JSON.stringify(receipt)+'\n');await h.sync();}finally{await h.close();}return receipt;
}
export async function submit({request=httpsOnce,key,assets,onSubmitted}){
 check(assets.length===1);assets.forEach((b,i)=>check(b.length===freeze.assets[i].size&&sha(b)===freeze.assets[i].sha256));
 await publicMetadata(request,key);const s=fixedSession(request,key);
 const credits=await s.call(CREDIT);check(typeof credits.data==='number'&&Number.isFinite(credits.data)&&credits.data>=227);console.log('Authenticated balance credits:',credits.data);
 const urls=[];
 for(let i=0;i<1;i++){
  const a=freeze.assets[i],name=a.path.split('/').at(-1),body=new FormData();
  body.append('file',new Blob([assets[i]],{type:a.mime}),name);body.append('uploadPath','serum-actual/'+FREEZE_SHA);body.append('fileName',name);
  const r=await s.call(UPLOAD,{method:'POST',body});check(r.success===true);const u=mediaURL(r.data?.downloadUrl,name.split('.').at(-1));check(!u.includes(key));
  // Download is unauthenticated, fixed CDN and hash verified. Never send the KIE bearer to a CDN.
  const uploaded=await boundedRequest(request,u,{},a.size,60000);check(uploaded.bytes.length===a.size&&sha(uploaded.bytes)===a.sha256);urls.push(u);
 }
 const p=payload(urls);const quote=await publicMetadata(request,key);await writeFile(join(process.env.RUNNER_TEMP,'serum-omni-result','precreate-quote-and-payload.json'),JSON.stringify({quote,payload:p,sourceSha:process.env.GITHUB_SHA,sourceRunId:process.env.GITHUB_RUN_ID,freezeSha:FREEZE_SHA})+'\n',{flag:'wx'});
 console.log('ONE_CREATE_START quote227 maximum227; no retry');
 const r=await s.call(CREATE,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(p)},p);
 const id=taskId(r.data.taskId);console.log('PROVIDER_TASK_RECEIPT',id);await onSubmitted(id);return id;
}
export async function recover({request=httpsOnce,key,id,pause=delay}){
 taskId(id);check(!id.includes(key));const s=fixedSession(request,key,id);
 for(let i=0;i<65;i++){
  let r;for(let j=0;j<3;j++){try{r=await s.call(STATUS+id);break;}catch{if(j===2)fail();await pause(1000);}}
  const d=r.data;console.log('PROVIDER_STATE',d?.state);check(d?.taskId===id&&d.model===MODEL);
  if(d.state==='success'){
   check(typeof d.resultJson==='string');const result=JSON.parse(d.resultJson);check(Array.isArray(result.resultUrls)&&result.resultUrls.length===1);
   const u=mediaURL(result.resultUrls[0],'mp4','tempfile.aiquickdraw.com');check(!u.includes(key));
   const video=await boundedRequest(request,u,{},64*1024*1024,60000);
   check(video.headers.get('content-type')?.split(';')[0]==='video/mp4'&&video.bytes.length>=16&&video.bytes.toString('ascii',4,8)==='ftyp');
   const c=d.creditsConsumed;check(c===undefined||(Number.isFinite(c)&&c>=0));
   return {video:video.bytes,summary:{providerOutputURL:u,taskId:id,model:MODEL,quotedCredits:227,providerBillingCap:false,...(c===undefined?{}:{creditsConsumed:c,billingViolation:c>227})}};
  }
  await writeFile(join(process.env.RUNNER_TEMP,'serum-omni-result','provider-state.json'),JSON.stringify({taskId:id,model:d.model,state:d.state,creditsConsumed:d.creditsConsumed,failCode:d.failCode,failMsg:d.failMsg})+'\n');
  check(['waiting','queuing','generating'].includes(d.state));if(i<64)await pause(10000);
 }
 fail();
}
async function main(){
 const [mode,...extra]=process.argv.slice(2);check(extra.length===0);
 if(mode==='dry-run'){
  validateSchema();exactPrice(Array.from({length:8},(_,i)=>JSON.parse(readFileSync(join(ROOT,'evidence/price-'+(i+1)+'.json')))));
  loadAssets();
  for(const bytes of loadAssets())await validateDecodedMedia(bytes,'video');
  console.log('PASS credential-free dry-run; quote 227 credits / USD1.135; providerBillingCap=false.');return;
 }
 check(['generate-one','recover-existing-task'].includes(mode));authorize(process.env,mode==='recover-existing-task');
 const dir=join(process.env.RUNNER_TEMP,'serum-omni-result');
 if(mode==='generate-one'){
  await mkdir(dir,{mode:0o700}); // Exclusive same-job duplicate-process guard, before reading either secret.
  const assets=loadAssets();
  const key=process.env.KIE_API_KEY;delete process.env.KIE_API_KEY;
  for(let i=0;i<1;i++)await validateDecodedMedia(assets[i],'video');
  await submit({key,assets,onSubmitted:async id=>{
   try{await writeReceipt(dir,id,process.env);}
   finally{
    // If local receipt persistence fails, retain the validated ID in Actions control-plane output/summary.
    // The workflow still refuses polling unless the independent receipt artifact upload succeeds.
    if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,'task_id='+id+'\n');
    if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,'Task `'+id+'`; quoted227 credits / USD1.135, NOT a provider cap.\n');
   }
  }});return;
 }
 await mkdir(dir,{recursive:true,mode:0o700});const key=process.env.KIE_API_KEY;delete process.env.KIE_API_KEY;
 const receipt=JSON.parse(readFileSync(join(dir,'task-receipt.json')));
 validateReceipt(receipt,process.env);
 const r=await recover({key,id:receipt.taskId});
 await writeFile(join(dir,'unverified.mp4'),r.video,{flag:'wx',mode:0o600});
 await writeFile(join(dir,'result.json'),JSON.stringify({...r.summary,mediaValidated:false})+'\n',{mode:0o600});
 await validateDecodedMedia(r.video,'video');
 await writeFile(join(dir,'result.json'),JSON.stringify({...r.summary,mediaValidated:true})+'\n',{mode:0o600});
 if(r.summary.billingViolation)fail();
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('Serum motion adapter stopped; provider submission may have occurred. Inspect receipt; never repeat create.');process.exitCode=1;});
