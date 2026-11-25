import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import os from 'node:os';

const root = resolve(import.meta.dirname, '../..');
test('motion pilot refuses ambient Node types outside its explicit dependency prefix', () => {
  assert.ok(process.env.MOTION_DEPS, 'Set isolated MOTION_DEPS for dependency isolation regression');
  const real = resolve(process.env.MOTION_DEPS);
  const scratch = join(os.homedir(), '.hermes/cache/scratch');
  const fake = mkdtempSync(join(scratch, 'motion-no-types-'));
  try {
    writeFileSync(join(fake, 'package.json'), '{}');
    writeFileSync(join(fake, 'package-lock.json'), readFileSync(join(real, 'package-lock.json')));
    mkdirSync(join(fake, 'node_modules'));
    for (const name of ['animejs', 'typescript', 'esbuild', 'playwright-core']) {
      symlinkSync(join(real, 'node_modules', name), join(fake, 'node_modules', name));
    }
    const run = spawnSync(process.execPath, [join(root, '.codex/scripts/test-motion-template.mjs'), '--integration'], {
      cwd: root, encoding: 'utf8', timeout: 20000,
      env: { ...process.env, MOTION_DEPS: fake, MOTION_BROWSER: '/missing-browser-not-to-be-launched' },
    });
    assert.equal(run.status, 1, run.error?.message);
    assert.match(run.stderr, /isolated @types\/node dependency is required in MOTION_DEPS/);
    assert.doesNotMatch(run.stdout, /PASS strict TypeScript/);
  } finally {
    rmSync(fake, { recursive: true, force: true });
  }
});
