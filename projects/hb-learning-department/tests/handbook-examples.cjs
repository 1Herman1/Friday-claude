/* Verify the book's complete examples through the real, disposable learning API. */
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.HB_PLAYWRIGHT_MODULE || 'playwright-core');
const root=path.resolve(__dirname,'..');
const book=path.resolve(root,'../../docs/training/hb-learning-department/handbook');
const scratch=path.join(os.homedir(),'.hermes/cache/scratch');
fs.mkdirSync(scratch,{recursive:true});
const temp=fs.mkdtempSync(path.join(scratch,'hb-book-example-'));
const processServer=spawn(process.env.HB_PYTHON||'python3',[path.join(root,'app.py'),'--port','0','--data-dir',temp],{cwd:root,env:{...process.env,HB_MENTOR:'off',HB_API_KEY:'',HB_API_URL:'',HB_MODEL:''}});
let browser;
const code=(text,lang)=>{const match=text.match(new RegExp('```'+lang+'\\n([\\s\\S]*?)\\n```'));assert(match,'Missing complete '+lang+' example');return match[1];};
(async()=>{
 const base=await new Promise((resolve,reject)=>{let text='';const timeout=setTimeout(()=>reject(Error('Server startup timeout')),15000);processServer.stdout.on('data',chunk=>{text+=chunk;const match=text.match(/http:\/\/127\.0\.0\.1:\d+/);if(match){clearTimeout(timeout);resolve(match[0]);}});processServer.once('exit',code=>reject(Error('Server exit '+code)));});
 const token=JSON.parse(fs.readFileSync(path.join(temp,'access/test.json'),'utf8')).token;
 const api=async(route,body)=>{const res=await fetch(base+route,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});const result=await res.json();assert.equal(res.status,200,JSON.stringify(result));return result;};
 await api('/api/project',{name:'Book examples — disposable verification'});
 browser=await chromium.launch({headless:true,...(process.env.HB_CHROME_PATH?{executablePath:process.env.HB_CHROME_PATH}:{})});
 const page=await browser.newPage();
 const checks=[];
 for(const [slug,file,title] of [['hero','chapter-22.md','Рабочее место без лишнего'],['ceramics','answers-parent.md','Первый предмет, сделанный своими руками']]){
  const text=fs.readFileSync(path.join(book,'revision-v2',file),'utf8');
  const html=code(text,'html'),css=code(text,'css');
  await api('/api/file',{path:'examples/'+slug+'.html',content:html});
  await api('/api/file',{path:'examples/'+slug+'.css',content:css});
  assert.equal((await api('/api/file?path=examples/'+slug+'.html')).content,html);
  const preview=await api('/api/preview?path=examples/'+slug+'.html&css=examples/'+slug+'.css');
  assert.match(preview.html,/script-src 'none'/);
  for(const width of [800,360]){
   await page.setViewportSize({width,height:800});
   await page.setContent(preview.html);
   assert.equal(await page.locator('h1').innerText(),title);
   const columns=await page.locator('.hero').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(/\s+/).length);
   assert.equal(columns,width===360?1:2);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
   await page.locator('button').focus();assert(await page.locator('button').evaluate(el=>el===document.activeElement));
   await page.locator('.hero').screenshot({path:path.join(book,'diagrams',slug+'-'+(width===360?'narrow':'wide')+'.png')});
  }
  if(slug==='hero') {
   const revised=css.replace('h1 { font-size: 30px; }','h1 { font-size: 28px; line-height: 1.2; }');
   assert.notEqual(revised,css);
   await api('/api/file',{path:'examples/hero.css',content:revised});
   const updated=await api('/api/preview?path=examples/hero.html&css=examples/hero.css');
   await page.setViewportSize({width:360,height:800});await page.setContent(updated.html);
   assert.equal(await page.locator('h1').evaluate(el=>getComputedStyle(el).fontSize),'28px');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
   checks.push('hero revised: actual CSS edit saved through API, 28px narrow headline applied, no horizontal overflow');
  }
  checks.push(slug+': exact book HTML/CSS saved via app, sanitized preview, desktop/mobile grid, no overflow, focusable CTA');
 }
 const report={status:'passed',checks,live_model_tested:false,fixture:'Disposable student; no real employee state; screenshots are the real sanitized preview, not a completed integration'};
 fs.writeFileSync(path.join(root,'reports/handbook-examples.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();processServer.kill('SIGTERM');fs.rmSync(temp,{recursive:true,force:true});});
