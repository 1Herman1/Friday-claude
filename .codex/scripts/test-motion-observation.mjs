import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import { assertGrabObservation } from './lib/motion-observation.mjs';

const observation = () => ({ id: 1, sameEvent: true, trusted: true, target: 'tile',
  before: { x: 150, grabbed: false, inertiaPaused: false },
  after: { x: 150, grabbed: true, inertiaPaused: true } });

test('legitimate pre-event motion is not a grab discontinuity', () => {
  const value = observation();
  value.legacyBefore = { x: 130 };
  assert.doesNotThrow(() => assertGrabObservation(value));
});
test('actual same-event discontinuity fails the unchanged 1px threshold', () => {
  for (const delta of [1, 12]) {
    const value = observation(); value.after.x += delta;
    assert.throws(() => assertGrabObservation(value), /grab must not jump/);
  }
});
for (const [name, mutate] of [
  ['missing completion', o => { o.after = null; }],
  ['different event', o => { o.sameEvent = false; }],
  ['synthetic input', o => { o.trusted = false; }],
  ['missed tile', o => { o.target = 'stage'; }],
  ['no real grab', o => { o.after.grabbed = false; }],
  ['inertia not interrupted', o => { o.after.inertiaPaused = false; }],
]) test(`rejects ${name}`, () => {
  const value = observation(); mutate(value);
  assert.throws(() => assertGrabObservation(value));
});

const root = resolve(import.meta.dirname, '../..');
// Real engine and real mouse in an isolated runner copy, never a mocked engine.
for (const scenario of ['latency', 'dom-jump', 'default-input', 'queued-input']) test(scenario === 'default-input'
  ? 'default input samples geometry after observer arming during live inertia'
  : scenario === 'queued-input'
    ? 'real queued input queues press before move acknowledgement'
    : `real headless controlled latency${scenario === 'dom-jump' ? ' rejects actual DOM jump' : ' accepts pre-event inertia'}`, () => {
  const mutant = scenario === 'dom-jump';
  const defaultInput = scenario === 'default-input';
  const queuedInput = scenario === 'queued-input';
  assert.ok(process.env.MOTION_DEPS && process.env.MOTION_BROWSER, 'existing isolated deps/browser required');
  const scratch = join(os.homedir(), '.hermes/cache/scratch');
  mkdirSync(scratch, { recursive: true });
  const work = mkdtempSync(join(scratch, 'motion-observation-regression-'));
  mkdirSync(join(work, '.codex/scripts/lib'), { recursive: true });
  mkdirSync(join(work, 'docs/core/templates'), { recursive: true });
  mkdirSync(join(work, 'docs/research/design-agent-upgrade/rollout/motion-pilot'), { recursive: true });
  for (const path of ['.codex/scripts/lib/motion-observation.mjs', 'docs/core/templates/motion.ts',
    ...['fixture.ts', 'fixture.html'].map(f => 'docs/research/design-agent-upgrade/rollout/motion-pilot/' + f)]) {
    writeFileSync(join(work, path), readFileSync(join(root, path)));
  }
  let source = readFileSync(join(root, '.codex/scripts/test-motion-template.mjs'), 'utf8');
  if (mutant) {
    const seam = '    await page.evaluate(installGrabObservation);';
    assert.ok(source.includes(seam));
    source = source.replace(seam, `    await page.evaluate(() => document.querySelector('#tile').addEventListener('mousedown', () => {
      document.querySelector('#tile').style.translate = '12px 0px';
    }));\n` + seam);
  }
  if (defaultInput) {
    // Observe real driver call order in a disposable copy, without moving/stopping
    // the engine or manufacturing a mouse event. Existing missed-target receipts
    // prove the failure; this deterministic guard catches its stale-input seam.
    const arm = 'const id = await page.evaluate(() => window.motionObservation.arm());';
    const bounds = "await page.locator('#tile').boundingBox();";
    assert.ok(source.includes(arm) && source.includes(bounds));
    source = source.replace('const grab = async () => {', 'const grab = async () => {\n    let armedBeforeBounds = false;\n    let freshBounds = false;');
    source = source.replace(arm, arm + '\n    armedBeforeBounds = true;');
    source = source.replaceAll(bounds, bounds + '\n    freshBounds = armedBeforeBounds;');
    assert.ok(source.includes('page.mouse.down()'));
    source = source.replace('page.mouse.down()', `(() => {
      if (!before.inertiaPaused) {
        (receipt.freshAimChecks ??= []).push({ freshBounds, live: true });
        assert.ok(freshBounds, 'live input coordinates must be sampled after observer arming');
      }
      return page.mouse.down();
    })()`);
  }
  if (queuedInput) {
    assert.ok(source.includes('page.mouse.move(box.x + 23, box.y + 31)'));
    assert.ok(source.includes('page.mouse.down()'));
    source = source.replace('page.mouse.move(box.x + 23, box.y + 31)', 'delayedGrabMove(box.x + 23, box.y + 31)');
    source = source.replace('page.mouse.down()', 'recordQueuedDown()');
    source = source.replace('const grab = async () => {', `const grab = async () => {
    let nativeMoveResolved = false;
    let callerMoveResolved = false;
    const delayedGrabMove = (...args) => page.mouse.move(...args).then(async value => {
      nativeMoveResolved = true;
      await new Promise(resolve => setTimeout(resolve, 180));
      callerMoveResolved = true;
      return value;
    });
    const recordQueuedDown = () => {
      (receipt.queuedInputChecks ??= []).push({ nativeMoveResolved, callerMoveResolved });
      assert.ok(!nativeMoveResolved && !callerMoveResolved, 'press must be queued before move acknowledgement');
      return page.mouse.down();
    };`);
  }
  writeFileSync(join(work, '.codex/scripts/test-motion-template.mjs'), source);
  const result = spawnSync(process.execPath, [join(work, '.codex/scripts/test-motion-template.mjs'), '--integration', ...(defaultInput || queuedInput ? [] : ['--observation-latency=80'])], { encoding: 'utf8', timeout: 90000 });
  writeFileSync(join(work, 'output.log'), result.stdout + result.stderr);
  console.log('Actual browser regression evidence:', work);
  assert.equal(result.error, undefined);
  assert.equal(result.status, mutant ? 1 : 0, result.stdout + result.stderr);
  const receiptPath = result.stdout.match(/^Receipt: (.+)$/m)?.[1];
  assert.ok(receiptPath, 'real runner must preserve event-scoped receipt');
  const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
  writeFileSync(join(work, 'receipt.json'), JSON.stringify(receipt, null, 2));
  if (mutant) {
    assert.match(result.stderr, /grab must not jump/);
    const event = receipt.grabs.at(-1).observation;
    assert.equal(event.trusted, true);
    assert.equal(event.sameEvent, true);
    assert.equal(event.after.grabbed, true);
    assert.ok(event.after.x - event.before.x >= 12, 'mutant must cause an actual DOM discontinuity');
  } else {
    if (defaultInput) {
      assert.ok(receipt.freshAimChecks?.some(event => event.live && event.freshBounds));
      assert.ok(receipt.grabs.some(({ observation }) => observation.before.inertiaPaused === false),
        'default path must actually interrupt live inertia, not pass after settling');
    } else if (queuedInput) {
      assert.ok(receipt.queuedInputChecks?.length > 0);
      assert.ok(receipt.queuedInputChecks.every(value => !value.nativeMoveResolved && !value.callerMoveResolved));
      assert.ok(receipt.grabs.some(({ observation }) => observation.before.inertiaPaused === false),
        'queued input must interrupt actual live inertia');
    } else {
      assert.match(result.stdout, /PASS controlled pre-event inertia observation/);
      assert.ok(receipt.controlledPreEventAdvances.some(event => event.delta > 1));
    }
    for (const { observation } of receipt.grabs) assertGrabObservation(observation);
  }
});
