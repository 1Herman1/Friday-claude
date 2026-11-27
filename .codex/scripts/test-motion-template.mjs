import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import os from 'node:os';
import { installGrabObservation, assertGrabObservation } from './lib/motion-observation.mjs';

const root = resolve(import.meta.dirname, '../..');
const source = readFileSync(join(root, 'docs/core/templates/motion.ts'), 'utf8');
assert.match(source, /export function createDraggable\(/, 'template must export createDraggable (stage04 contract)');
console.log('PASS createDraggable export contract');
if (!process.argv.includes('--integration')) process.exit(0);
// No automatic installs, no browser download, no repo node_modules mutations.
assert.ok(process.env.MOTION_DEPS, 'Set MOTION_DEPS to isolated scratch dependency prefix');
assert.ok(process.env.MOTION_BROWSER, 'Set MOTION_BROWSER to an existing Chromium executable');
const deps = resolve(process.env.MOTION_DEPS);
assert.ok(existsSync(join(deps, 'node_modules/@types/node/index.d.ts')),
  'isolated @types/node dependency is required in MOTION_DEPS; use the pinned pilot lock');
const req = createRequire(join(deps, 'package.json'));
const ts = req('typescript');
const { build } = req('esbuild');
const { chromium } = req('playwright-core');
const scratch = join(os.homedir(), '.hermes/cache/scratch');
mkdirSync(scratch, { recursive: true });
const work = mkdtempSync(join(scratch, 'motion-run-'));
const fixtures = join(root, 'docs/research/design-agent-upgrade/rollout/motion-pilot');
writeFileSync(join(work, 'motion.ts'), source);
writeFileSync(join(work, 'fixture.ts'), readFileSync(join(fixtures, 'fixture.ts'), 'utf8').replace('../../../../core/templates/motion', './motion'));
const versions = Object.fromEntries(['animejs', 'typescript', 'esbuild', 'playwright-core'].map(name => [name, JSON.parse(readFileSync(join(deps, 'node_modules', name, 'package.json'))).version]));
const options = {
  strict: true, noEmit: true, skipLibCheck: false,
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'],
  types: ['node'], typeRoots: [join(deps, 'node_modules/@types')],
  baseUrl: deps, paths: { 'animejs/*': ['node_modules/animejs/dist/modules/*/index.d.ts'] },
};
const program = ts.createProgram([join(work, 'motion.ts'), join(work, 'fixture.ts')], options);
const diagnostics = ts.getPreEmitDiagnostics(program);
assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
  getCanonicalFileName: f => f, getCurrentDirectory: () => work, getNewLine: () => '\n',
}));
console.log('PASS strict TypeScript against real animejs declarations', versions);
const common = { bundle: true, format: 'esm', nodePaths: [join(deps, 'node_modules')], write: false, minify: true };
const ssr = await build({ ...common, entryPoints: [join(work, 'motion.ts')], platform: 'node' });
writeFileSync(join(work, 'ssr.mjs'), ssr.outputFiles[0].contents);
const module = await import(pathToFileURL(join(work, 'ssr.mjs')));
assert.equal(module.prefersReducedMotion(), false);
assert.equal(module.createDraggable('#absent'), null);
module.onReducedMotionChange(() => assert.fail('SSR listener'))();
console.log('PASS real-engine SSR import / guarded creation / subscription');
const bundled = await build({ ...common, entryPoints: [join(work, 'fixture.ts')], platform: 'browser' });
const bundles = {};
for (const [name, text] of Object.entries({
  before: source.split('/** Native engine options;')[0].replace("import { createDraggable as animeDraggable } from 'animejs/draggable'\n", ''),
  after: source,
})) {
  const output = await build({ ...common, stdin: { contents: text, resolveDir: work, loader: 'ts' }, platform: 'browser' });
  bundles[name] = { bytes: output.outputFiles[0].contents.length, gzip: gzipSync(output.outputFiles[0].contents).length };
}
const receipt = {
  node: process.version, platform: process.platform, arch: process.arch, versions,
  templateSha256: createHash('sha256').update(source).digest('hex'),
  lockSha256: createHash('sha256').update(readFileSync(join(deps, 'package-lock.json'))).digest('hex'),
  browserExecutable: process.env.MOTION_BROWSER, bundles, samples: {}, work,
};
writeFileSync(join(work, 'package-lock.json'), readFileSync(join(deps, 'package-lock.json')));
const server = createServer((request, response) => {
  response.setHeader('Content-Type', request.url === '/fixture.js' ? 'text/javascript' : 'text/html');
  response.end(request.url === '/fixture.js' ? bundled.outputFiles[0].contents : readFileSync(join(fixtures, 'fixture.html')));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
const errors = [];
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.MOTION_BROWSER });
  receipt.browserVersion = browser.version();
  const page = await browser.newPage({ viewport: { width: 1200, height: 650 } });
  page.on('pageerror', error => errors.push(String(error)));
  const url = `http://127.0.0.1:${server.address().port}`;
  const sample = async label => {
    const value = await page.evaluate(() => window.pilot.snapshot());
    receipt.samples[label] = value;
    return value;
  };
  const shot = label => page.screenshot({ path: join(work, `${label}.png`) });
  const load = async reducedMotion => {
    await page.emulateMedia({ reducedMotion });
    await page.goto(url);
    await page.waitForFunction(() => window.pilot);
    await page.evaluate(installGrabObservation);
  };
  const latency = Number(process.argv.find(arg => arg.startsWith('--observation-latency='))?.split('=')[1] ?? 0);
  assert.ok(latency === 0 || latency === 80, 'observation latency must be 0 or controlled 80ms');
  const grab = async () => {
    const before = await page.evaluate(() => window.pilot.snapshot());
    const id = await page.evaluate(() => window.motionObservation.arm());
    if (latency && !before.inertiaPaused) await page.waitForTimeout(latency);
    // All observation round trips precede the final aim, in both input modes.
    // No snapshot or arming call may age the coordinates before the real press.
    const box = await page.locator('#tile').boundingBox();
    await Promise.all([
      page.mouse.move(box.x + 23, box.y + 31),
      page.mouse.down(),
    ]);
    const observation = await page.evaluate(() => window.motionObservation.read());
    (receipt.grabs ??= []).push({ legacyBefore: before, observation, latency });
    assert.equal(observation?.id, id, 'receipt must belong to this actual mouse press');
    assertGrabObservation(observation);
    return { box, observation };
  };
  const drag = async () => {
    const { box } = await grab();
    for (let i = 1; i <= 5; i++) {
      await page.mouse.move(box.x + 23 + i * 22, box.y + 31);
      await page.waitForTimeout(18);
    }
  };
  const stable = async (label, milliseconds = 300) => {
    const a = await sample(label + '-before');
    const trace = await page.evaluate(milliseconds => new Promise(resolve => {
      const frames = [];
      const start = performance.now();
      const tick = () => {
        frames.push({ time: performance.now(), x: window.pilot.snapshot().x });
        if (performance.now() - start >= milliseconds) resolve(frames);
        else requestAnimationFrame(tick);
      };
      tick();
    }), milliseconds);
    (receipt.traces ??= {})[label] = trace;
    const b = await sample(label + '-after');
    const positions = [a.x, ...trace.map(frame => frame.x), b.x];
    assert.ok(Math.max(...positions) - Math.min(...positions) < 1, `${label} moved ${b.x - a.x}px`);
    return b;
  };
  await load('no-preference');
  await sample('normal-before'); await shot('before');
  await drag();
  const during = await sample('normal-drag');
  assert.ok(during.x > 100, 'real mouse drag must move DOM');
  await page.mouse.up();
  const release = await sample('normal-release');
  await page.waitForFunction(x => window.pilot.snapshot().x > x + 1, release.x, { timeout: 800 });
  const mid = await sample('normal-mid'); await shot('mid');
  assert.ok(mid.x > release.x + 1, 'normal release must exhibit real temporal inertia');
  const positionBeforeGrab = await sample('interrupt-before');
  const interrupted = await grab();
  const positionAfterGrab = await sample('interrupt-after');
  assert.ok(Math.abs(interrupted.observation.after.x - interrupted.observation.before.x) < 30, 'interrupt must start near current visual position');
  await stable('interrupt-held', 100);
  await page.mouse.up();
  await page.waitForTimeout(1600);
  await stable('normal-settled'); await shot('settled');
  // Duplicate mouseup must not release twice, next gesture must work.
  const count = (await sample('repeat-before')).releases;
  await page.mouse.up();
  assert.equal((await sample('repeat-duplicate')).releases, count);
  await drag(); await page.mouse.up();
  assert.equal((await sample('repeat-next')).releases, count + 1);
  await page.waitForTimeout(1600);
  await stable('repeat-settled'); await shot('repeat-settled');
  await load('reduce');
  await drag();
  await sample('reduced-drag');
  await page.mouse.up();
  await stable('reduced-release', 450); await shot('reduced-settled');
  assert.equal((await sample('reduced-count')).releases, 1);
  // Switch preference during normal inertia; no reload, no teleport.
  await load('no-preference'); await drag(); await page.mouse.up();
  const dynamicRelease = await sample('preference-release');
  await page.waitForFunction(x => window.pilot.snapshot().x > x + 1, dynamicRelease.x, { timeout: 800 });
  await sample('preference-before');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => window.pilot.snapshot().inertiaPaused, null, { timeout: 200 });
  await stable('preference-reduced', 450);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await stable('preference-restored-no-replay');
  await drag(); await page.mouse.up();
  const restored = await sample('restored-release');
  await page.waitForFunction(x => window.pilot.snapshot().x > x + 1, restored.x, { timeout: 800 });
  assert.ok((await sample('restored-mid')).x > restored.x + 1, 'normal inertia returns for new gestures');
  // Preference change while held must not disable direct pointer following.
  await grab(); await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(50);
  const held = await sample('preference-held');
  await page.mouse.move(held.x + 90, held.y + 31);
  await page.waitForFunction(x => window.pilot.snapshot().x > x + 10, held.x, { timeout: 800 });
  assert.ok((await sample('preference-held-moved')).x > held.x + 10);
  await page.mouse.up(); await stable('preference-held-release');
  // Destroy during live drag removes document tracking, ticks and listener.
  await grab();
  const live = await sample('destroy-live-grab');
  await page.mouse.move(live.x + 85, live.y + 31);
  await page.waitForTimeout(40);
  const destroyed = await page.evaluate(() => window.pilot.destroy());
  receipt.samples.destroyed = destroyed;
  assert.equal(destroyed.adds, destroyed.removes, 'destroy must deregister preference listener exactly once');
  assert.equal(destroyed.enabled, false);
  assert.equal(destroyed.releases, live.releases, 'destroy is not a semantic release');
  await page.mouse.move(700, 210); await page.mouse.up();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const cleaned = await stable('destroy-cleanup', 450);
  assert.equal(cleaned.updates, destroyed.updates);
  assert.equal(cleaned.releases, destroyed.releases);
  assert.equal(cleaned.tickerPaused, true);
  await shot('destroyed');
  const touchPrevented = await page.evaluate(() => {
    const event = new Event('touchstart', { bubbles: true, cancelable: true });
    document.querySelector('#tile').dispatchEvent(event);
    return event.defaultPrevented;
  });
  assert.equal(touchPrevented, false, 'destroy must remove engine touch-prevention listeners during a live drag');
  receipt.touchPreventedAfterDestroy = touchPrevented;
  await load('no-preference'); await drag(); await page.mouse.up();
  const moving = await sample('destroy-inertia-before');
  assert.equal(moving.inertiaPaused, false);
  const disposed = await page.evaluate(() => window.pilot.destroy());
  receipt.samples['destroy-inertia-disposed'] = disposed;
  assert.equal(disposed.adds, disposed.removes);
  const afterInertia = await stable('destroy-inertia-cleanup', 450);
  assert.equal(afterInertia.updates, disposed.updates);
  assert.equal(afterInertia.inertiaPaused, true);
  assert.deepEqual(errors, []);
  if (latency) {
    const advanced = receipt.grabs.filter(({ legacyBefore, observation }) => !legacyBefore.inertiaPaused && observation.before.x > legacyBefore.x + 1);
    assert.ok(advanced.length > 0, 'controlled latency must exercise actual pre-event inertia, not settled motion');
    receipt.controlledPreEventAdvances = advanced.map(({ legacyBefore, observation }) => ({ id: observation.id, delta: observation.before.x - legacyBefore.x }));
    console.log('PASS controlled pre-event inertia observation', receipt.controlledPreEventAdvances);
  }
  receipt.result = 'PASS';
  console.log('PASS real headless temporal pilot; normal/reduced/dynamic/interrupt/repeat/destroy', { work, bundles });
} catch (error) {
  receipt.result = 'FAIL'; receipt.error = String(error); throw error;
} finally {
  receipt.errors = errors;
  writeFileSync(join(work, 'receipt.json'), JSON.stringify(receipt, null, 2));
  console.log('Receipt:', join(work, 'receipt.json'));
  try { await browser?.close(); }
  finally { await new Promise(resolve => server.close(resolve)); }
}
