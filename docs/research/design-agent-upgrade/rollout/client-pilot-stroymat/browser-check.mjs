// Private local-file evidence only. Supply existing Playwright and browser paths.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require = createRequire(path.join(process.env.MOTION_DEPS, 'package.json'));
const {chromium} = require('playwright-core');
const out = path.resolve(process.argv[2]);
if (!out.startsWith(path.join(process.env.HOME,'.hermes/cache/scratch/'))) throw Error('Private scratch only');
const browser = await chromium.launch({headless:true, executablePath:process.env.MOTION_BROWSER});
const reports=[];
try {
for (const variant of ['baseline','A','B']) {
 for (const state of [{width:1440,name:'desktop'},{width:390,name:'mobile'},{width:768,name:'tablet'},{width:390,name:'long-ru',stress:true},{width:390,name:'reduced',reduce:true}]) {
  const page=await browser.newPage({viewport:{width:state.width,height:900},reducedMotion:state.reduce?'reduce':'no-preference'});
  const remote=[],errors=[];
  await page.route(/^https?:/,r=>{remote.push(r.request().url());return r.abort();});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.join(out,variant+'.html')).href);
  await page.evaluate(()=>document.fonts.ready);
  await page.evaluate(async()=>{document.querySelectorAll('img').forEach(e=>e.loading='eager');await Promise.all([...document.images].map(e=>e.decode()));});
  await page.waitForTimeout(3300);
  if(state.stress) await page.evaluate(()=>{
   document.querySelectorAll('.item h3').forEach(e=>e.append(' — проверка длинного русского наименования строительного материала'));
   document.querySelectorAll('.specs dd').forEach(e=>e.append(' / проверка длинного значения спецификации без сокращения'));
  });
  const report=await page.evaluate(()=>{
   const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}};
   const vis=e=>getComputedStyle(e).display!=='none'&&e.getClientRects().length>0;
   const hero=document.querySelector('.hero-media');
   const heroBox=hero?box(hero):null;
   const heroRatio=heroBox&&heroBox.height>0?heroBox.width/heroBox.height:null;
   return {
    heroBox,heroRatio,
    heroRatio16_9:Number.isFinite(heroRatio)&&Math.abs(heroRatio-16/9)<.002,
    overflow:document.documentElement.scrollWidth>innerWidth,
    imageBodyOverlap:innerWidth>700 && document.body.dataset.pilot?[...document.querySelectorAll('.item')].filter(e=>{
     const a=e.querySelector('.shot').getBoundingClientRect(),b=e.querySelector('.item-body').getBoundingClientRect();
     return Math.min(a.right,b.right)-Math.max(a.left,b.left)>1 && Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1;
    }).map(e=>e.querySelector('h3').textContent):[],
    clipping:[...document.querySelectorAll('.specs dd,.item h3')].filter(e=>e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+1).map(e=>e.textContent),
    cards:[...document.querySelectorAll('.item')].map(e=>({name:e.querySelector('h3').innerText,specs:[...e.querySelectorAll('.specs div')].map(x=>x.innerText),tags:[...e.querySelectorAll('.tag')].map(x=>x.innerText),box:box(e)})),
    images:[...document.images].map(e=>({ok:e.complete&&e.naturalWidth>0,alt:e.alt})),
    targets:[...document.querySelectorAll('a')].filter(vis).map(e=>({label:e.innerText,href:e.getAttribute('href'),...box(e),min: e.matches('.btn,[href^="tel:"],[href^="mailto:"]')?48:44})),
    fonts:[...document.fonts].map(f=>({family:f.family,weight:f.weight,status:f.status,range:f.unicodeRange})),
    specsNumeric:[...document.querySelectorAll('.specs dd')].every(e=>getComputedStyle(e).fontVariantNumeric==='tabular-nums'),
    headingHierarchy:[...document.querySelectorAll('h1,h2,h3')].map(e=>e.tagName),
    normalMotion:matchMedia('(prefers-reduced-motion:reduce)').matches,
    reveal:[...document.querySelectorAll('.reveal')].every(e=>getComputedStyle(e).opacity==='1'),
   };
  });
  report.smallTargets=report.targets.filter(e=>e.width<e.min||e.height<e.min);
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('DOM.enable');await cdp.send('CSS.enable');
  const {root}=await cdp.send('DOM.getDocument');
  report.renderedFonts=[];
  for (const selector of ['h1','.hero-lead','.specs dd']) {
   const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:root.nodeId,selector});
   const {fonts}=await cdp.send('CSS.getPlatformFontsForNode',{nodeId});
   report.renderedFonts.push({selector,fonts});
  }
  report.cyrillicCoverage=[];
  for(const [family,weight] of [['Manrope','700'],['Golos Text','400'],['Golos Text','500']]) {
   await page.evaluate(({family,weight})=>{const e=document.createElement('span');e.id='font-coverage';e.style.cssText=`position:absolute;top:0;left:0;opacity:0;font-family:'${family}';font-weight:${weight}`;e.textContent='АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя';document.body.append(e);},{family,weight});
   await page.evaluate(()=>document.fonts.ready);
   const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:root.nodeId,selector:'#font-coverage'});
   const {fonts}=await cdp.send('CSS.getPlatformFontsForNode',{nodeId});
   report.cyrillicCoverage.push({family,weight,fonts});
   await page.evaluate(()=>document.querySelector('#font-coverage').remove());
  }
  await page.screenshot({path:path.join(out,`${variant}-${state.name}-top.png`)});
  await page.locator('.item').first().scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(out,`${variant}-${state.name}-firstcards.png`)});
  await page.screenshot({path:path.join(out,`${variant}-${state.name}-full.png`),fullPage:true});
  if(variant!=='baseline') {
   await page.goto(pathToFileURL(path.join(out,variant+'.html')).href);
   await page.evaluate(()=>document.fonts.ready);
   let found=false;
   for(let i=0;i<20;i++) {
    await page.keyboard.press('Tab');
    const active=await page.evaluate(()=>({href:document.activeElement.getAttribute('href'),outline:getComputedStyle(document.activeElement).outlineStyle}));
    if(active.href==='#materials') {
     report.keyFocus=active;await page.keyboard.press('Enter');
     report.materialAnchor=await page.evaluate(()=>location.hash==='#materials');
     found=true;break;
    }
   }
   report.keyPathFound=found;
   await page.locator('.pilot-links a[href="#price"]').focus();await page.keyboard.press('Enter');
   await page.waitForTimeout(800);
   report.priceAnchor=await page.evaluate(()=>({hash:location.hash,top:document.querySelector('#price').getBoundingClientRect().top}));
  }
  reports.push({variant,state:state.name,width:state.width,remote,errors,...report});
  await page.close();
 }
}
} finally {await browser.close();}
fs.writeFileSync(path.join(out,'browser-receipt.json'),JSON.stringify(reports,null,2));
const failures=reports.filter(r=>r.variant!=='baseline'&&(!r.heroRatio16_9||r.overflow||r.imageBodyOverlap.length||r.clipping.length||r.smallTargets.length||r.remote.length||r.errors.length||!r.keyPathFound||!r.materialAnchor||r.priceAnchor.hash!=='#price'||!r.images.every(i=>i.ok)||r.cards.length!==8||!r.specsNumeric||!r.reveal));
console.log(JSON.stringify({states:reports.length,failures:failures.map(r=>({variant:r.variant,state:r.state,overflow:r.overflow,clipping:r.clipping,small:r.smallTargets,errors:r.errors,key:r.keyPathFound,price:r.priceAnchor})),baseline:reports.filter(r=>r.variant==='baseline').map(r=>({state:r.state,overflow:r.overflow,clipping:r.clipping.length,small:r.smallTargets}))},null,2));
if(failures.length) process.exitCode=1;
