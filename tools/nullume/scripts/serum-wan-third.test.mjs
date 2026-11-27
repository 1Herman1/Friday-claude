import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as m from './serum-wan-third.mjs';
import {readFileSync} from 'node:fs';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('receipt is sanitized, fsynced and exclusive, bound to exact source context',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'serum-motion-test-'));try{
 const e={GITHUB_RUN_ID:'42',GITHUB_SHA:'a'.repeat(40)};await m.writeReceipt(dir,'a'.repeat(32),e);
 const r=JSON.parse(await readFile(join(dir,'task-receipt.json'),'utf8'));assert.equal(r.assetsFreezeSha256,m.FREEZE_SHA);assert.equal(r.providerBillingCap,false);assert.equal(r.model,m.MODEL);assert.ok(!JSON.stringify(r).includes('Bearer'));
 await assert.rejects(m.writeReceipt(dir,'a'.repeat(32),e));
 }finally{await rm(dir,{recursive:true});}
});
test('full fixed submit verifies two actual assets/CDN bytes, creates once, receipts without polling', {skip:!process.env.WAN_THIRD_LOCAL_DRY_ASSETS},async()=>{
 const assets=m.freeze.assets.map(a=>readFileSync(join(process.env.WAN_THIRD_LOCAL_DRY_ASSETS,a.path)));
 const pack=Object.fromEntries(m.freeze.assets.map((a,i)=>[a.path,assets[i].toString('base64')]));m.verifyAssets(pack);
 const doc=readFileSync(new URL('../../../docs/projects/perfect-skin/media-review/serum-wan-third/evidence/wan-2-7-videoedit.md',import.meta.url));
 let uploads=0,creates=0,receipt=false;const calls=[];
 const request=async(u,o={})=>{
  calls.push([u,o.method??'GET']);
  if(u===m.DOC)return new Response(doc);
  if(u===m.PRICE)return reply(pages()[JSON.parse(o.body).pageNum-1]);
  if(u===m.CREDIT)return reply({code:200,data:1000});
  if(u===m.UPLOAD){const i=uploads++;assert.equal(o.body.get('file').size,assets[i].length);assert.equal(o.body.get('fileName'),m.freeze.assets[i].path.split('/').at(-1));return reply({code:200,success:true,data:{downloadUrl:urls()[i]}});}
  if(urls().includes(u)){assert.equal(o.headers,undefined);return new Response(assets[urls().indexOf(u)]);}
  if(u===m.CREATE){creates++;assert.deepEqual(JSON.parse(o.body),m.payload(urls()));return reply({code:200,data:{taskId:id}});}
  assert.fail('Unexpected endpoint');
 };
 assert.equal(await m.submit({request,key,assets,onSubmitted:async v=>{assert.equal(v,id);receipt=true;}}),id);
 assert.equal(uploads,2);assert.equal(creates,1);assert.equal(receipt,true);assert.equal(calls.filter(([u])=>u.startsWith(m.STATUS)).length,0);
 // A corrupted local asset blocks ALL network, not merely the create call.
 const wrong=[...assets];wrong[0]=Buffer.from('wrong');let touched=false;
 await assert.rejects(m.submit({request:async()=>{touched=true;},key,assets:wrong,onSubmitted:async()=>{}}));assert.equal(touched,false);
});
import {boundedRequest,validateWanMedia,validateWanProbe} from './serum-wan-transport.mjs';
test('strict media policy rejects duration, streams, alpha, geometry and frame drift',()=>{
 const v={streams:[{codec_type:'video',codec_name:'h264',width:432,height:736,avg_frame_rate:'24/1',r_frame_rate:'24/1',nb_read_frames:'48',duration:'2.000000',pix_fmt:'yuv420p'}],format:{duration:'2.000000'}};
 validateWanProbe(v,'source');
 for(const delta of [{width:960},{avg_frame_rate:'30/1'},{nb_read_frames:'49'},{duration:'2.1'}])assert.throws(()=>validateWanProbe({...v,streams:[{...v.streams[0],...delta}]},'source'));
 assert.throws(()=>validateWanProbe({...v,streams:[...v.streams,{codec_type:'audio'}]},'source'));
 const image={streams:[{codec_type:'video',codec_name:'png',width:432,height:736,nb_read_frames:'1',pix_fmt:'rgb24'}],format:{}};validateWanProbe(image,'reference');
 assert.throws(()=>validateWanProbe({...image,streams:[{...image.streams[0],pix_fmt:'rgba'}]},'reference'));
 assert.throws(()=>validateWanProbe({...v,streams:[{...v.streams[0],width:960,height:960}]},'result'));
});

const key='test-nonsecret-key',id='a'.repeat(32);
const reply=x=>new Response(JSON.stringify(x),{status:200});
const urls=()=>m.freeze.assets.map((a,i)=>`https://tempfile.redpandaai.co/job/${i}.`+a.path.split('.').at(-1));
const pages=()=>Array.from({length:8},(_,i)=>JSON.parse(readFileSync(new URL('../../../docs/projects/perfect-skin/media-review/serum-wan-third/evidence/price-page-'+(i+1)+'.json',import.meta.url))));
test('archived 710 rows give exactly one 32-credit WAN quote; drift and duplicates blocked',()=>{
 const p=pages();assert.deepEqual(m.exactPrice(p),{total:710,quotedCredits:32,providerBillingCap:false});
 const row=p.flatMap(p=>p.data.records).find(r=>r.modelDescription==='wan 2.7 video, videoedit, 720p');row.creditPrice='17';assert.throws(()=>m.exactPrice(p));
 const d=pages();d[0].data.records[0]={...d.flatMap(p=>p.data.records).find(r=>r.modelDescription==='wan 2.7 video, videoedit, 720p')};assert.throws(()=>m.exactPrice(d));
 assert.throws(()=>m.exactPrice(pages().slice(0,7)));
});
test('fixed paid session cannot accept attacker model or injected callback',async()=>{
 let calls=0;const s=m.fixedSession(async()=>{calls++;return reply({code:200,data:{taskId:id}});},key);
 const p=m.payload(urls());p.model='evil';await assert.rejects(s.call(m.CREATE,{method:'POST',body:JSON.stringify(p)},p));assert.equal(calls,0);
});
test('create is spent before ambiguous transport failure; never retried',async()=>{
 let calls=0;const s=m.fixedSession(async()=>{calls++;throw new Error('raw secret error '+key);},key);const p=m.payload(urls());
 for(let i=0;i<3;i++)await assert.rejects(s.call(m.CREATE,{method:'POST',body:JSON.stringify(p)},p),e=>!e.message.includes(key));assert.equal(calls,1);
});
test('recovery sessions cannot create, upload, credit-check, or query unrelated task',async()=>{
 let calls=0;const s=m.fixedSession(async()=>{calls++;return reply({code:200,data:{}});},key,id);
 for(const [u,init] of [[m.CREATE,{method:'POST'}],[m.UPLOAD,{method:'POST',body:new FormData()}],[m.CREDIT,{}],[m.STATUS+'b'.repeat(32),{}]])await assert.rejects(s.call(u,init));
 assert.equal(calls,0);await s.call(m.STATUS+id);assert.equal(calls,1);
});
test('GET recovery retains overquote output and retries CDN reads without upload/create',async()=>{
 let reads=0,gets=0;const bytes=Buffer.from('0000ftyp'+'0'.repeat(20));
 const r=await m.recover({key,id,pause:async()=>{},request:async(u,o)=>{
  assert.equal(o.method??'GET','GET');
  if(u===m.STATUS+id){gets++;return reply({code:200,data:{taskId:id,model:m.MODEL,state:'success',creditsConsumed:33,resultJson:JSON.stringify({resultUrls:['https://tempfile.aiquickdraw.com/job/result.mp4']})}});}
  assert.equal(u,'https://tempfile.aiquickdraw.com/job/result.mp4');assert.equal(o.headers,undefined);reads++;if(reads<3)throw Error(key);return new Response(bytes,{headers:{'content-type':'video/mp4'}});
 }});assert.equal(gets,1);assert.equal(reads,3);assert.deepEqual(r.video,bytes);assert.equal(r.summary.billingViolation,true);assert.equal(r.summary.quotedCredits,32);
});
test('status transient errors bounded at three GETs and terminal errors never create',async()=>{
 const calls=[];await assert.rejects(m.recover({key,id,pause:async()=>{},request:async(u,o)=>{calls.push([u,o.method??'GET']);throw Error(key);}}));assert.equal(calls.length,3);assert.ok(calls.every(([u,method])=>u===m.STATUS+id&&method==='GET'));
});
test('hostile provider task IDs, model mismatch and output URL rejected',async()=>{
 for(const data of [{taskId:'x\n'+key},{taskId:id,model:'evil',state:'success'},{taskId:id,model:m.MODEL,state:'success',resultJson:JSON.stringify({resultUrls:['https://127.0.0.1/a.mp4']})}]){
 let calls=0;await assert.rejects(m.recover({key,id,pause:async()=>{},request:async()=>{calls++;return reply({code:200,data});}}));assert.equal(calls,1);
 }
 for(const bad of ['../x','a'.repeat(32)+'\n','task_x?x=1'])assert.throws(()=>m.taskId(bad));
});
test('run gate binds attempt, run, source SHA, branch and recovery task',()=>{
 const e={GITHUB_REPOSITORY:'1Herman1/Friday-claude',GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_RUN_ATTEMPT:'1',RUNNER_TEMP:'/runner',GITHUB_RUN_ID:'42',WAN_THIRD_APPROVED_RUN_ID:'42',GITHUB_SHA:'a'.repeat(40),WAN_THIRD_APPROVED_SHA:'a'.repeat(40),GITHUB_REF:'refs/heads/ci/serum-wan27-third-only',WAN_THIRD_ARMED:m.TOKEN,WAN_THIRD_CONFIRMATION:m.TOKEN};m.authorize(e);
 for(const k of ['GITHUB_RUN_ATTEMPT','GITHUB_RUN_ID','GITHUB_REF','GITHUB_SHA','WAN_THIRD_ARMED'])assert.throws(()=>m.authorize({...e,[k]:'wrong'}));
 assert.throws(()=>m.authorize(e,true));
});
test('private bundle tampering and missing asset files rejected without network',()=>{
 assert.throws(()=>m.verifyAssets({}));assert.throws(()=>m.decryptAssets('0'.repeat(64)));m.validateSchema();
});
test('transport rejects redirects, oversize streams and raw error strings',async()=>{
 for(const request of [async()=>new Response('',{status:302,headers:{location:'https://evil.example'}}),async()=>new Response('123456'),async()=>{throw Error(key);}])await assert.rejects(boundedRequest(request,m.CREDIT,{},4),e=>!e.message.includes(key));
 for(const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','::1','192.0.2.1'])assert.equal(m.isPublicIPv4(ip),false);assert.equal(m.isPublicIPv4('8.8.8.8'),true);
});
test('fixed WAN payload uses exactly source video and one reference, no invented masks',()=>{
 const u=urls(), p=m.payload(u);assert.equal(p.model,'wan/2-7-videoedit');assert.equal(p.input.duration,2);assert.equal(p.input.video_url,u[0]);assert.equal(p.input.reference_image,u[1]);assert.equal(p.input.audio_setting,'origin');assert.equal(p.input.prompt_extend,false);assert.equal(p.input.watermark,false);assert.equal('mask' in p.input,false);assert.equal('aspect_ratio' in p.input,false);
 for(const evil of ['http://tempfile.redpandaai.co/a.mp4','https://tempfile.redpandaai.co/../a.mp4','https://tempfile.redpandaai.co/a.mp4?x=1','https://localhost/a.mp4','https://tempfile.redpandaai.co/%61.mp4','https://tempfile.redpandaai.co/a;touch.mp4'])assert.throws(()=>m.payload([evil,u[1]]));
 assert.throws(()=>m.payload([...u,u[1]]));
});
