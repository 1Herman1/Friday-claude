import {test} from 'node:test';
import assert from 'node:assert/strict';
import {payload,freeze,authorize,mediaURL,fixedSession,CREATE,STATUS,loadAssets,validateSchema} from './serum-actual-generation.mjs';
const urls=()=>freeze.assets.map((a,i)=>'https://tempfile.redpandaai.co/actual/'+i+'.'+a.path.split('.').at(-1));
test('fixed 21:9 silent720p10sec8 real refs and all byte pins',()=>{const p=validateSchema();assert.equal(p.input.aspect_ratio,'21:9');assert.equal(p.input.generate_audio,false);assert.equal(p.input.resolution,'720p');assert.equal(p.input.duration,10);assert.equal(p.input.reference_image_urls.length,7);assert.equal(p.input.reference_video_urls.length,1);assert.equal(loadAssets().length,8);assert.equal(freeze.poseVerdict,'KNOWN_AMBIGUITY_OWNER_INFORMED_PROCEED_NOT_PASS');});
test('hostile URLs and ref substitution rejected',()=>{for(const u of ['https://evil.example/x.png','https://tempfile.redpandaai.co/a/../b.png','https://tempfile.redpandaai.co@evil.example/x.png','http://tempfile.redpandaai.co/x.png'])assert.throws(()=>mediaURL(u,'png'));assert.throws(()=>payload(urls().slice(1)));});
test('old run, old branch, missing exactSHA and rerun all fail closed',()=>{const e={GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_RUN_ATTEMPT:'1',RUNNER_TEMP:'/tmp',GITHUB_RUN_ID:'123',SERUM_ACTUAL_APPROVED_RUN_ID:'123',GITHUB_SHA:'a'.repeat(40),SERUM_ACTUAL_APPROVED_SHA:'a'.repeat(40),GITHUB_REF:'refs/heads/ci/serum-actual-one',SERUM_ACTUAL_ARMED:'confirm-serum-actual-one-82',SERUM_ACTUAL_CONFIRMATION:'confirm-serum-actual-one-82'};authorize(e);for(const [k,v] of [['GITHUB_RUN_ATTEMPT','2'],['GITHUB_REF','refs/heads/ci/serum-seedance-mini-singlejob'],['SERUM_ACTUAL_APPROVED_RUN_ID','999'],['SERUM_ACTUAL_APPROVED_SHA','b'.repeat(40)]])assert.throws(()=>authorize({...e,[k]:v}));});
test('create timeout cannot repeat; recovery transport GET only',async()=>{let calls=0;const request=async()=>{calls++;throw Error('timeout')};const s=fixedSession(request,'mock-key-12345');const p=payload(urls());const opts={method:'POST',body:JSON.stringify(p)};await assert.rejects(s.call(CREATE,opts,p));await assert.rejects(s.call(CREATE,opts,p));assert.equal(calls,1);const ro=fixedSession(request,'mock-key-12345','a'.repeat(32));await assert.rejects(ro.call(CREATE,opts,p));assert.equal(calls,1);await assert.rejects(ro.call(STATUS+'a'.repeat(32)));assert.equal(calls,2);});

import * as m from './serum-actual-generation.mjs';
import {readFileSync} from 'node:fs';
const key='mock-no-secret',id='a'.repeat(32);
const reply=x=>new Response(JSON.stringify(x),{status:200});
const pages=()=>Array.from({length:8},(_,i)=>JSON.parse(readFileSync(new URL('../../../docs/projects/perfect-skin/media-review/serum-actual-generation/evidence/price-page-'+(i+1)+'.json',import.meta.url))));
test('full fixed submit verifies eight actual assets/CDN bytes, creates once, receipts without polling', async()=>{
 const assets=m.loadAssets();
 const pack=Object.fromEntries(m.freeze.assets.map((a,i)=>[a.path,assets[i].toString('base64')]));m.verifyAssets(pack);
 const doc=readFileSync(new URL('../../../docs/projects/perfect-skin/media-review/serum-actual-generation/evidence/bytedance-seedance-2-mini.md',import.meta.url));
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
 assert.equal(uploads,8);assert.equal(creates,1);assert.equal(receipt,true);assert.equal(calls.filter(([u])=>u.startsWith(m.STATUS)).length,0);
 // A corrupted local asset blocks ALL network, not merely the create call.
 const wrong=[...assets];wrong[0]=Buffer.from('wrong');let touched=false;
 await assert.rejects(m.submit({request:async()=>{touched=true;},key,assets:wrong,onSubmitted:async()=>{}}));assert.equal(touched,false);
});
