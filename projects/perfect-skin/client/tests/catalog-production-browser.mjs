import assert from 'node:assert/strict'
import {chromium} from 'playwright-core'
import {preview} from 'vite'
import {readFile,mkdir,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
const root=fileURLToPath(new URL('../',import.meta.url))
const out=process.env.OUT_DIR || '/Users/germanbryzgalov/.hermes/cache/scratch/ps-catalog-release-evidence'
await mkdir(out,{recursive:true})
const server=await preview({root,preview:{host:'127.0.0.1',port:0,strictPort:false,proxy:{'/api':{target:'http://193.233.102.5',changeOrigin:true}}}})
const base=`http://127.0.0.1:${server.httpServer.address().port}`
const browser=await chromium.launch({headless:true})
const result={base,api:'live read-only HTTP API through local proxy',errors:[],widths:[],assets:[],tests:[]}
const manifest=JSON.parse(await readFile(new URL('catalog-production-assets.json',import.meta.url)))
try{
 for(const a of manifest.assets){const r=await fetch(base+a.src);assert.equal(r.status,200);const mime=r.headers.get('content-type');assert.match(mime,a.src.endsWith('.mp4')?/video\/mp4/:/image\//);assert.equal(createHash('sha256').update(Buffer.from(await r.arrayBuffer())).digest('hex'),a.sha256);result.assets.push({src:a.src,mime,sha256:a.sha256})}
 const api=await fetch('http://193.233.102.5/api/v1/categories/tree'); const categoryPayload=await api.json();await writeFile(out+'/live-categories.json',JSON.stringify(categoryPayload,null,2))
 for(const width of [320,390,768,900,1023,1024,1440]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'})
  const page=await context.newPage(); const documents=[];const media=[]
  page.on('pageerror',e=>result.errors.push(e.message));page.on('request',r=>{if(r.isNavigationRequest()&&r.frame()===page.mainFrame())documents.push(r.url());if(/serum-approved.*mp4/.test(r.url()))media.push(r.url())})
  await page.goto(base);await page.locator('h1').waitFor()
  // Use actual responsive header navigation, including the mobile menu.
  const link=page.locator('header a[href="/catalog"]:visible').first()
  if(await link.count()===0){
    await page.getByRole('button',{name:/меню/i}).first().click()
    await page.locator('[aria-hidden="false"] a[href="/catalog"]').first().click()
  } else await link.click()
  await page.waitForFunction(()=>!document.querySelector('[aria-label="Закрыть меню"]')?.closest('[aria-hidden="false"]'))
  await page.locator('.catalog-index .catalog-tile').first().waitFor()
  await page.waitForTimeout(800)
  for(const tile of await page.locator('.catalog-index .catalog-tile').all())await tile.scrollIntoViewIfNeeded()
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('.catalog-index img')].filter(i=>i.src).map(i=>i.decode()))})
  const tiles=await page.locator('.catalog-index .catalog-tile').evaluateAll(es=>es.map(e=>({href:e.getAttribute('href')||e.querySelector('a')?.getAttribute('href'),bg:getComputedStyle(e).backgroundColor,bounds:e.getBoundingClientRect().toJSON(),heading:e.querySelector('h2').getBoundingClientRect().toJSON(),overflow:getComputedStyle(e).overflow})))
  assert.equal(new Set(tiles.map(t=>t.href)).size,tiles.length)
  assert.ok(tiles.some(t=>t.href==='/catalog/spf'));assert.ok(tiles.some(t=>t.href==='/catalog/uhod-za-telom'))
  if(width>=1024)assert.deepEqual(tiles.slice(0,3).map(t=>t.href),['/catalog/all','/catalog/all?sort=popular','/catalog/kremy-dlya-litsa-i-shei'])
  for(const t of tiles){assert.equal(t.bg,t.href==='/catalog/all?sort=popular'?'rgb(31, 58, 95)':'rgb(255, 255, 255)');assert.equal(t.overflow,'hidden');assert.ok(t.heading.x>=t.bounds.x&&t.heading.right<=t.bounds.right+1&&t.heading.bottom<=t.bounds.bottom+1)}
  assert.equal(media.length,0,'reduced motion must make zero serum video requests')
  assert.equal(await page.locator('video.catalog-serum-video').count(),0)
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
  const serum=page.locator('.catalog-index a[href="/catalog/syvorotki"]');await serum.scrollIntoViewIfNeeded();const before=await serum.locator('h2').boundingBox();await serum.hover();await page.waitForTimeout(350);assert.deepEqual(await serum.locator('h2').boundingBox(),before)
  await page.mouse.move(0,0);await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`${out}/catalog-${width}.png`,fullPage:true})
  await page.goBack();await page.waitForURL(base+'/');await page.goForward();await page.waitForURL('**/catalog');await page.locator('.catalog-index .catalog-tile').first().waitFor();assert.equal(documents.length,1,'home → catalog → back → forward must stay in the same document')
  const drawer=await page.locator('[aria-label="Закрыть меню"]').evaluate(e=>({hidden:e.closest('[aria-hidden]')?.getAttribute('aria-hidden'),box:e.parentElement.parentElement.getBoundingClientRect().toJSON(),css:getComputedStyle(e.parentElement.parentElement).transform,cl:e.parentElement.parentElement.className}))
  assert.ok(drawer.box.x >= width - 1, 'closed mobile drawer must be fully outside viewport; hidden focus must not scroll its clipping parent')
  result.widths.push({width,documents,tiles,videoRequests:media.length,drawer});await context.close();console.log('PASS layout/navigation/reduced',width)
 }
 if(process.env.CATALOG_ONLY !== '1') {
 const context=await browser.newContext({viewport:{width:1440,height:450},recordVideo:{dir:out+'/recordings',size:{width:1440,height:900}}})
 const page=await context.newPage();const requests=[];page.on('pageerror',e=>result.errors.push(e.message));page.on('request',r=>{if(/serum-approved.*mp4/.test(r.url()))requests.push(r.url())})
 await page.goto(base+'/catalog');await page.locator('.catalog-index .catalog-tile').first().waitFor();await page.waitForTimeout(1000)
 assert.equal(requests.length,0,'offscreen serum makes zero video requests')
 const serum=page.locator('.catalog-index a[href="/catalog/syvorotki"]');await serum.scrollIntoViewIfNeeded();await page.mouse.move(0,0)
 const v=page.locator('.catalog-serum-video');await v.waitFor();await page.waitForFunction(()=>document.querySelector('.catalog-serum-video')?.currentTime>0.2)
 assert.equal(await v.evaluate(e=>e.muted&&e.playsInline&&!e.loop&&!e.controls),true)
 const heading=await serum.locator('h2').boundingBox()
 await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(500);assert.equal(await v.evaluate(e=>e.paused),true)
 const paused=await v.evaluate(e=>e.currentTime);await page.waitForTimeout(500);assert.equal(await v.evaluate(e=>e.currentTime),paused)
 await serum.scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('.catalog-serum-video')?.currentTime>=7,null,{timeout:14000})
 const playbackQuality=await v.evaluate(e=>{const q=e.getVideoPlaybackQuality();return {currentTime:e.currentTime,totalVideoFrames:q.totalVideoFrames,droppedVideoFrames:q.droppedVideoFrames,corruptedVideoFrames:q.corruptedVideoFrames,readyState:e.readyState}})
 result.playbackQuality=playbackQuality
 assert.ok(playbackQuality.totalVideoFrames>=350,'true60 browser must actually decode hundreds of frames, not only report 60fps metadata')
 assert.ok(playbackQuality.droppedVideoFrames/Math.max(1,playbackQuality.totalVideoFrames)<0.05,'actual browser dropped-frame ratio must be below 5%')
 await page.waitForFunction(()=>document.querySelector('.catalog-serum-media')?.dataset.finished==='true',null,{timeout:6000});assert.equal(await v.count(),0)
 await page.evaluate(()=>scrollTo(0,0));await serum.scrollIntoViewIfNeeded();await page.waitForTimeout(700);assert.equal(await v.count(),0)
 await page.setViewportSize({width:768,height:900});await page.waitForFunction(()=>!document.querySelector('.catalog-editorial'));await page.locator('.catalog-index a[href="/catalog/syvorotki"]').scrollIntoViewIfNeeded();await page.waitForTimeout(500);assert.equal(await v.count(),0,'completed serum must not replay across responsive remount');await page.setViewportSize({width:1440,height:450});await page.locator('.catalog-editorial').waitFor();await serum.scrollIntoViewIfNeeded()
 assert.deepEqual(await serum.locator('h2').boundingBox(),heading)
 await serum.screenshot({path:out+'/serum-ended.png'})
 result.tests.push('offscreen 0 requests; inline/muted/no-controls/no-loop; scroll pause+resume; ended final poster; no replay on return')
 // Observe two full last→first cycles with image decoding settled, without hovering.
 await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>scrollTo(0,0));await page.mouse.move(0,0);await page.waitForTimeout(1000)
 const sequence=[]
 for(let i=0;i<29;i++){sequence.push(await page.locator('.catalog-crossfade').evaluateAll(es=>es.map(e=>({href:e.querySelector('a').getAttribute('href'),src:e.querySelector('[data-active="true"]')?.getAttribute('src')}))));await page.waitForTimeout(500)}
 for(const href of ['/catalog/all','/catalog/kremy-dlya-litsa-i-shei']){const frames=sequence.map(row=>row.find(t=>t.href===href)?.src).filter(Boolean);const changes=frames.filter((f,i)=>i===0||f!==frames[i-1]);assert.equal(new Set(changes).size,3);assert.ok(changes.length>=7,JSON.stringify(changes));for(let i=3;i<changes.length;i++)assert.equal(changes[i],changes[i-3])}
 assert.deepEqual(await page.locator('.catalog-motion-control').evaluateAll(es=>es.map(e=>getComputedStyle(e).opacity)),['0','0'])
 const all=page.locator('.catalog-crossfade').first();await all.hover();const current=await all.locator('[data-active="true"]').getAttribute('src');await page.waitForTimeout(2400);assert.equal(await all.locator('[data-active="true"]').getAttribute('src'),current)
 result.tests.push('both carousels: 3 unique frames, 2 complete loops, hidden idle controls, hover pauses');result.sequence=sequence
 for(const tile of await page.locator('.catalog-index .catalog-tile').all()){await tile.scrollIntoViewIfNeeded();await page.waitForTimeout(350)}
 await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:out+'/catalog-motion-full.png',fullPage:true});await context.close()
 // Mobile real playback and full catalogue recording; static/save-data lifecycle checks.
 const mobileContext=await browser.newContext({viewport:{width:390,height:844},recordVideo:{dir:out+'/mobile-recordings',size:{width:390,height:844}}})
 const mobile=await mobileContext.newPage();await mobile.goto(base+'/catalog');await mobile.locator('.catalog-index .catalog-tile').first().waitFor();await mobile.waitForTimeout(800)
 await mobile.locator('.catalog-index a[href="/catalog/syvorotki"]').scrollIntoViewIfNeeded();await mobile.waitForFunction(()=>document.querySelector('.catalog-serum-video')?.currentTime>0.3)
 // Browser visibility event fault injection exercises the actual document.hidden handler.
 await mobile.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))});await mobile.waitForTimeout(300);assert.equal(await mobile.locator('.catalog-serum-video').evaluate(e=>e.paused),true)
 await mobile.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'))});await mobile.waitForFunction(()=>document.querySelector('.catalog-serum-media')?.dataset.finished==='true',null,{timeout:16000})
 for(const tile of await mobile.locator('.catalog-index .catalog-tile').all()){await tile.scrollIntoViewIfNeeded();await mobile.waitForTimeout(350)}await mobile.screenshot({path:out+'/mobile-playback-full.png',fullPage:true});await mobileContext.close()
 const saver=await browser.newContext({viewport:{width:390,height:844}});await saver.addInitScript(()=>Object.defineProperty(navigator,'connection',{value:{saveData:true,addEventListener(){},removeEventListener(){}}}));const savePage=await saver.newPage();const saveRequests=[];savePage.on('request',r=>{if(/serum-approved.*mp4/.test(r.url()))saveRequests.push(r.url())});await savePage.goto(base+'/catalog');await savePage.locator('.catalog-index a[href="/catalog/syvorotki"]').scrollIntoViewIfNeeded();await savePage.waitForTimeout(600);assert.equal(saveRequests.length,0);await saver.close();result.tests.push('mobile normal 10s playback recording; simulated document-hidden pauses/resumes; saveData zero video requests')
 // Failed media transport returns exact final poster, never a black/empty tile.
 const failed=await browser.newContext({viewport:{width:390,height:900}});await failed.route('**/serum-approved-60fps.mp4',r=>r.abort());const failure=await failed.newPage();await failure.goto(base+'/catalog');await failure.locator('.catalog-index a[href="/catalog/syvorotki"]').scrollIntoViewIfNeeded();await failure.waitForFunction(()=>document.querySelector('.catalog-serum-media')?.dataset.failed==='true');assert.equal(await failure.locator('.catalog-serum-poster').evaluate(e=>e.complete&&e.naturalWidth>0),true);assert.equal(await failure.locator('.catalog-serum-video').count(),0);await failure.screenshot({path:out+'/load-failure-390.png'});await failed.close();result.tests.push('aborted video transport retains decoded exact final poster')
 } else result.tests.push('CATALOG-ONLY: media integration intentionally blocked until clean60 artifact arrives')
 assert.deepEqual(result.errors,[]);result.pass=true
}catch(e){result.pass=false;result.failure=e.stack;console.error(e);process.exitCode=1}
finally{await writeFile(out+'/browser-result.json',JSON.stringify(result,null,2));await browser.close();await new Promise(r=>server.httpServer.close(r));console.log(JSON.stringify({pass:result.pass,tests:result.tests,out,failure:result.failure},null,2))}
