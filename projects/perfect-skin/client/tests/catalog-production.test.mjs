import {readFile,readdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
import test from 'node:test'
const root=new URL('../',import.meta.url)
const manifest=JSON.parse(await readFile(new URL('catalog-production-assets.json',import.meta.url)))
test('only exact accepted derivatives and video are promoted',async()=>{
 const expected=manifest.assets.map(a=>a.src.split('/').at(-1)).sort()
 const actual=(await readdir(new URL('public/photos/catalog/',root))).sort()
 assert.deepEqual(actual,expected)
 for(const a of manifest.assets)assert.equal(createHash('sha256').update(await readFile(new URL('public'+a.src,root))).digest('hex'),a.sha256)

})
test('production serum replaces CSS roll, has no looping or controls',async()=>{
 const component=await readFile(new URL('src/components/catalog/SerumVideo.tsx',root),'utf8')
 assert.match(component,/IntersectionObserver/);assert.match(component,/visibilitychange/)
 assert.match(component,/prefers-reduced-motion/);assert.match(component,/onError/)
 assert.match(component,/playsInline/);assert.match(component,/muted/);assert.match(component,/autoPlay/)
 assert.doesNotMatch(component,/\bloop[=\s>]|\bcontrols[=\s>]/)
 for(const f of ['CatalogEditorial.tsx','CatalogGrid.tsx'])assert.doesNotMatch(await readFile(new URL('src/components/catalog/'+f,root),'utf8'),/SerumRoll/)
})
test('production dist promotes intended assets but contains no research adapters or flags',async()=>{
 const dist=new URL('dist/',root)
 const catalogue=(await readdir(new URL('photos/catalog/',dist))).sort()
 assert.deepEqual(catalogue,manifest.assets.map(a=>a.src.split('/').at(-1)).sort(),'default dist must exclude old catalogue assets')
 const files=await readdir(dist,{recursive:true})
 assert.ok(!files.some(n=>/media-review|research|withdrawn|24fps|diagnostic60|smooth60/i.test(n)))
 for(const a of manifest.assets)assert.equal(createHash('sha256').update(await readFile(new URL(a.src.slice(1),dist))).digest('hex'),a.sha256)
 for(const name of await readdir(new URL('assets/',dist))){
 if(!name.endsWith('.js'))continue
 const text=await readFile(new URL('assets/'+name,dist),'utf8')
 assert.doesNotMatch(text,/__catalog-review|VITE_SERUM_ROLL_REVIEW|serum-bottle-alpha|diagnostic60|media-review\//)
 }
})

test('RELEASE GATE: true60 corrected approved video is required',async()=>{
 assert.equal(manifest.release_status,'ready-for-independent-review','BLOCKED: 24fps approval withdrawn; clean60 artifact has not been received')
 assert.equal(manifest.video_probe.streams.length,1)
 assert.equal(manifest.video_probe.streams[0].nb_read_frames,'600')
 assert.equal(manifest.video_probe.streams[0].r_frame_rate,'60/1')
 assert.equal(Number(manifest.video_probe.format.duration),10)
 assert.equal(manifest.video_probe.streams.filter(s=>s.codec_type==='audio').length,0)
 assert.equal(manifest.video_probe.streams[0].width,960)
 assert.equal(manifest.video_probe.streams[0].height,960)
 const bytes=await readFile(new URL('public/photos/catalog/serum-approved-60fps.mp4',root))
 assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.assets.find(a=>a.cover_id==='syvorotki-video').sha256)
})
