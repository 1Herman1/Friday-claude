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
const ROOT=fileURLToPath(new URL('../../../docs/projects/perfect-skin/media-review/serum-reference-matched-new-generation/',import.meta.url));
export const MODEL='bytedance/seedance-2-mini';
export const FREEZE_SHA='1fc4f58c0bbabc0c0965493e28bb84fbac977ab68a65d593b8f2e2321a7c861e';
const BUNDLE_SHA='1ce3d0b9784e5c8848a2aa48441b083af5768b91e013e702d626d6e6e2d8e282';
export const TOKEN='confirm-serum-reference-matched-new-80';
export const PRICE='https://api.kie.ai/client/v1/model-pricing/page';
export const DOC='https://docs.kie.ai/market/bytedance/seedance-2-mini.md';
export const UPLOAD='https://kieai.redpandaai.co/api/file-stream-upload';
export const CREATE='https://api.kie.ai/api/v1/jobs/createTask';
export const CREDIT='https://api.kie.ai/api/v1/chat/credit';
export const STATUS='https://api.kie.ai/api/v1/jobs/recordInfo?taskId=';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
async function validateAsset(b,i){if(i<6)return validateDecodedMedia(b,'image'); const d=mkdtempSync(join(tmpdir(),'approved-ref-'));try{const p=join(d,'ref.mp4');writeFileSync(p,b);const q=spawnSync('ffprobe',['-v','error','-count_frames','-show_streams','-show_format','-of','json',p],{encoding:'utf8'});check(q.status===0);const f=JSON.parse(q.stdout),v=f.streams.find(x=>x.codec_type==='video');check(f.streams.length===1&&v.width===1280&&v.height===720&&v.avg_frame_rate==='60/1'&&v.nb_read_frames==='360'&&Number(f.format.duration)===6);check(spawnSync('ffmpeg',['-v','error','-i',p,'-f','null','-']).status===0);}finally{rmSync(d,{recursive:true});}}
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
 check(Array.isArray(urls)&&urls.length===7&&new Set(urls).size===7);
 urls.forEach((u,i)=>mediaURL(u,freeze.assets[i].path.split('.').at(-1)));
 return {model:MODEL,input:{prompt:freeze.prompt,reference_image_urls:urls.slice(0,6),reference_video_urls:[urls[6]],generate_audio:false,resolution:'720p',aspect_ratio:'16:9',duration:10}};
}
export function validateSchema(){
 const b=readFileSync(join(ROOT,'evidence/seedance-mini-request-schema.json'));check(sha(b)===freeze.schema_sha256);
 const s=JSON.parse(b),p=payload(freeze.assets.map((a,i)=>'https://tempfile.redpandaai.co/dry/'+i+'.'+a.path.split('.').at(-1)));
 check(s.properties.model.enum.length===1&&s.properties.model.enum[0]===MODEL);
 for(const [k,v] of Object.entries(p.input)){
  const f=s.properties.input.properties[k];check(f&&f.type===(Array.isArray(v)?'array':Number.isInteger(v)?'integer':typeof v));
  check(!f.enum||f.enum.includes(v));check(!f.maxItems||v.length<=f.maxItems);check(!f.maxLength||v.length<=f.maxLength);
 }
 return p;
}
export function verifyAssets(pack){
 check(pack&&Object.keys(pack).length===7);
 return freeze.assets.map(a=>{check(Object.hasOwn(pack,a.path)&&typeof pack[a.path]==='string');const b=Buffer.from(pack[a.path],'base64');check(b.length===a.size&&sha(b)===a.sha256);return b;});
}
export function loadAssets(){return freeze.assets.map(a=>{const b=readFileSync(join(ROOT,a.path));check(b.length===a.size&&sha(b)===a.sha256);return b;});}
export function exactPrice(pages){
 let total,seen=0;const matches=[];
 for(const p of pages){const n=Number(p?.data?.total),r=p?.data?.records;total??=n;
  check(p?.code===200&&Number.isSafeInteger(n)&&n>0&&n<=2000&&n===total&&Array.isArray(r)&&r.length===Math.min(100,total-seen));seen+=r.length;
  matches.push(...r.filter(r=>r.anchor==='https://kie.ai/seedance-2-0-mini'&&r.modelDescription==='bytedance/seedance-2-mini, 720P with video'));
 }
 check(seen===total&&matches.length===1);const r=matches[0];
 check(r.provider==='ByteDance'&&r.interfaceType==='video'&&r.creditPrice==='5'&&r.creditUnit==='per second'&&r.usdPrice==='0.025'&&r.discountPrice===false);
 check(freeze.referenceDurationSeconds===6&&80===freeze.quotedCredits&&freeze.ownerMaximumCredits===82);return {total,quotedCredits:80,providerBillingCap:false};
}
async function json(request,url,init){const r=await boundedRequest(request,url,init);try{return JSON.parse(r.bytes.toString());}catch{fail();}}
export async function publicMetadata(request=httpsOnce){
 validateSchema();
 // Fail closed on any live documentation byte drift; no invented schema parser.
 const archived=readFileSync(join(ROOT,'evidence/bytedance-seedance-2-mini.md'));
 const current=await boundedRequest(request,DOC);check(sha(current.bytes)===sha(archived));
 const pages=[];let n=0,total;
 for(let pageNum=1;pageNum<=20;pageNum++){
  const p=await json(request,PRICE,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({pageNum,pageSize:100,modelDescription:'',interfaceType:''})});
  pages.push(p);check(Array.isArray(p?.data?.records));n+=p.data.records.length;total??=Number(p.data.total);check(Number.isSafeInteger(total)&&total>0&&total<=2000);if(n>=total)break;
 }
 return exactPrice(pages);
}
export function authorize(env,recovery=false){
 check(!['46022482918','46022462559','45652032122','45633570452','45619944053','45569301373','45493711451'].includes(env.GITHUB_RUN_ID)&&!['4c8ead7e634bfcc80004369076c2e9e67cccebc7','e0f5f7888b79cceb882445dbca98b0b8a1e43b0b','2ea1b2b12838d0f3cca264c88716544ab6f3e4b8','3b8086c4297fdb9e0fb5cf4b6aa360ea2f0c6898'].includes(env.GITHUB_SHA));
 check(freeze.requestId==='serum-reference-matched-20261127-attempt1');
 if(recovery)check(!['45d44c00eaa6c25b47d81d41d37aa409','e264570bf33288a4286b3a339502ce12','542235a8f513f7367a181930182bebdc'].includes(env.SERUM_ACTUAL_TASK_ID));
 check(env.GITHUB_ACTIONS==='true'&&env.GITHUB_EVENT_NAME==='workflow_dispatch'&&env.GITHUB_RUN_ATTEMPT==='1'&&env.RUNNER_TEMP&&/^\d{1,20}$/.test(env.GITHUB_RUN_ID??'')&&env.SERUM_ACTUAL_APPROVED_RUN_ID===env.GITHUB_RUN_ID&&env.SERUM_ACTUAL_APPROVED_SHA===env.GITHUB_SHA&&/^[a-f0-9]{40}$/.test(env.GITHUB_SHA??''));
 check(env.GITHUB_REF==='refs/heads/ci/serum-actual-one');
 if(recovery){taskId(env.SERUM_ACTUAL_TASK_ID);check(env.SERUM_ACTUAL_TASK_ID===env.SERUM_ACTUAL_APPROVED_TASK_ID&&/^\d{1,20}$/.test(env.SERUM_ACTUAL_SOURCE_RUN_ID??'')&&env.SERUM_ACTUAL_SOURCE_RUN_ID===env.SERUM_ACTUAL_APPROVED_SOURCE_RUN_ID);}
 else check(env.SERUM_ACTUAL_ARMED===TOKEN&&env.SERUM_ACTUAL_CONFIRMATION===TOKEN);
}
export function fixedSession(request,key,existingTask){
 check(typeof key==='string'&&/^[A-Za-z0-9_.~-]{8,512}$(?![\s\S])/.test(key));
 let submitted=false;const readOnly=existingTask!==undefined;let active=readOnly?taskId(existingTask):undefined;
 return {
  async call(url,init={},expected){
   const method=init.method??'GET';
   const create=!readOnly&&!submitted&&url===CREATE&&method==='POST'&&expected&&init.body===JSON.stringify(expected);
   if(create){
    const i=expected.input;check(i&&JSON.stringify(expected)===JSON.stringify(payload([...(i.reference_image_urls??[]),...(i.reference_video_urls??[])])));
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
 const receipt={taskId:id,sourceRunId:env.GITHUB_RUN_ID,sourceSha:env.GITHUB_SHA,model:MODEL,duration:10,resolution:'720p',quotedCredits:80,providerBillingCap:false,assetsFreezeSha256:FREEZE_SHA,state:'submitted'};
 const h=await open(join(dir,'task-receipt.json'),'wx',0o600);try{await h.writeFile(JSON.stringify(receipt)+'\n');await h.sync();}finally{await h.close();}return receipt;
}
export async function submit({request=httpsOnce,key,assets,onSubmitted}){
 check(assets.length===7);assets.forEach((b,i)=>check(b.length===freeze.assets[i].size&&sha(b)===freeze.assets[i].sha256));
 await publicMetadata(request);const s=fixedSession(request,key);
 const credits=await s.call(CREDIT);check(typeof credits.data==='number'&&Number.isFinite(credits.data)&&credits.data>=80);console.log('Authenticated balance credits:',credits.data);
 const urls=[];
 for(let i=0;i<7;i++){
  const a=freeze.assets[i],name=a.path.split('/').at(-1),body=new FormData();
  body.append('file',new Blob([assets[i]],{type:a.mime}),name);body.append('uploadPath','serum-actual/'+FREEZE_SHA);body.append('fileName',name);
  const r=await s.call(UPLOAD,{method:'POST',body});check(r.success===true);const u=mediaURL(r.data?.downloadUrl,name.split('.').at(-1));check(!u.includes(key));
  // Download is unauthenticated, fixed CDN and hash verified. Never send the KIE bearer to a CDN.
  const uploaded=await boundedRequest(request,u,{},a.size,60000);check(uploaded.bytes.length===a.size&&sha(uploaded.bytes)===a.sha256);urls.push(u);
 }
 const p=payload(urls);await publicMetadata(request);
 console.log('ONE_CREATE_START quote80 maximum82; no retry');
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
   return {video:video.bytes,summary:{providerOutputURL:u,taskId:id,model:MODEL,quotedCredits:80,providerBillingCap:false,...(c===undefined?{}:{creditsConsumed:c,billingViolation:c>82})}};
  }
  check(['waiting','queuing','generating'].includes(d.state));if(i<64)await pause(10000);
 }
 fail();
}
async function main(){
 const [mode,...extra]=process.argv.slice(2);check(extra.length===0);
 if(mode==='dry-run'){
  validateSchema();exactPrice(Array.from({length:8},(_,i)=>JSON.parse(readFileSync(join(ROOT,'evidence/price-page-'+(i+1)+'.json')))));
  loadAssets();
  if(process.env.SERUM_ACTUAL_LOCAL_DRY_ASSETS){
   check(process.env.GITHUB_ACTIONS!=='true');const pack={};for(const a of freeze.assets)pack[a.path]=readFileSync(join(process.env.SERUM_ACTUAL_LOCAL_DRY_ASSETS,a.path)).toString('base64');
   const assets=verifyAssets(pack);for(let i=0;i<7;i++)await validateAsset(assets[i],i);
  }
  console.log('PASS credential-free dry-run; quote 80 credits / USD0.40; providerBillingCap=false.');return;
 }
 check(['generate-one','recover-existing-task'].includes(mode));authorize(process.env,mode==='recover-existing-task');
 const dir=join(process.env.RUNNER_TEMP,'serum-actual-result');
 if(mode==='generate-one'){
  await mkdir(dir,{mode:0o700}); // Exclusive same-job duplicate-process guard, before reading either secret.
  const assets=loadAssets();
  const key=process.env.KIE_API_KEY;delete process.env.KIE_API_KEY;
  for(let i=0;i<7;i++)await validateAsset(assets[i],i);
  await submit({key,assets,onSubmitted:async id=>{
   try{await writeReceipt(dir,id,process.env);}
   finally{
    // If local receipt persistence fails, retain the validated ID in Actions control-plane output/summary.
    // The workflow still refuses polling unless the independent receipt artifact upload succeeds.
    if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,'task_id='+id+'\n');
    if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,'Task `'+id+'`; quoted80 credits / USD0.40, NOT a provider cap.\n');
   }
  }});return;
 }
 await mkdir(dir,{recursive:true,mode:0o700});const key=process.env.KIE_API_KEY;delete process.env.KIE_API_KEY;
 const r=await recover({key,id:process.env.SERUM_ACTUAL_TASK_ID});
 await writeFile(join(dir,'unverified.mp4'),r.video,{flag:'wx',mode:0o600});
 await writeFile(join(dir,'result.json'),JSON.stringify({...r.summary,mediaValidated:false})+'\n',{mode:0o600});
 await validateDecodedMedia(r.video,'video');
 await writeFile(join(dir,'result.json'),JSON.stringify({...r.summary,mediaValidated:true})+'\n',{mode:0o600});
 if(r.summary.billingViolation)fail();
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('Serum motion adapter stopped; provider submission may have occurred. Inspect receipt; never repeat create.');process.exitCode=1;});
