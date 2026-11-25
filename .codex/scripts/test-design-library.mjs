#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const cli = fileURLToPath(new URL('./design-library.mjs', import.meta.url));
const root = fileURLToPath(new URL('../../docs/core/design-library/', import.meta.url));
const expectedCounts = { palettes: 64, typography: 39, heroes: 11, diagrams: 27 };
function run(...args) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
}

test('summary reports all pinned family counts', () => {
  const result = run('summary');
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout).counts, expectedCounts);
});

const pinned = {
  "palettes": {
    "sourcePath": "skills/taste-skill/library/palettes.json",
    "sha256": "96d594648249b2dff17addcd0e2965b0eee0cf2815ae68542add82a87d856d6d",
    "ids": [
      "white-link-blue",
      "cool-white-slate",
      "rose-grey-green",
      "paper-grey-brass",
      "stone-blueprint",
      "white-navy-tab",
      "three-stones",
      "putty-black-teal",
      "moss-sand",
      "green-mat-chocolate",
      "lunar-grey-bronze",
      "blue-black-cornflower",
      "green-black-bone",
      "black-crimson",
      "forest-pale-lime",
      "charcoal-room-sage",
      "warm-black-gold",
      "graphite-safety-orange",
      "soot-pale-lime",
      "plum-black-pink",
      "white-signal-red",
      "white-mint-tiles",
      "cool-grey-cobalt",
      "offwhite-bottle-yellow",
      "teal-on-paper",
      "navy-pink",
      "blush-aubergine",
      "cobalt-on-sand",
      "oxblood-grey",
      "olive-on-bone",
      "burgundy-bubblegum",
      "bottle-green-gold",
      "cobalt-field",
      "mustard-field",
      "carmine-field",
      "pink-field-lime",
      "sky-field-navy",
      "orange-field-black",
      "tobacco-olive",
      "poster-chapters",
      "blue-red-black",
      "charcoal-primaries",
      "ultramarine-yellow",
      "candy-chapters",
      "orange-sky-lime",
      "post-red-mustard",
      "mint-orange-grey",
      "report-blocks",
      "card-pastels",
      "mint-pink-accounts",
      "swap-pastels",
      "blush-sage-slate",
      "candy-on-black",
      "sky-sand",
      "studio-grey",
      "walnut-tan",
      "warm-paper-walnut",
      "flour-terracotta",
      "linen-harbour",
      "limewash-ochre",
      "clay-pine",
      "chalk-tomato",
      "plaster-rose",
      "steel-orange"
    ]
  },
  "typography": {
    "sourcePath": "skills/taste-skill/library/type.json",
    "sha256": "144be2adc366028ec2d380782e9150436f6bf5f1e4177159674c84435250d830",
    "ids": [
      "geist",
      "host",
      "instrument",
      "mona",
      "hanken",
      "schibsted",
      "onest",
      "funnel",
      "manrope",
      "plex",
      "sora",
      "archivo",
      "anybody",
      "bricolage",
      "red-hat",
      "gabarito",
      "chivo",
      "outfit",
      "epilogue",
      "familjen",
      "urbanist",
      "reddit",
      "suse",
      "albert",
      "figtree",
      "work-sans",
      "rethink",
      "instrument-sans",
      "instrument-serif",
      "fraunces",
      "newsreader",
      "source-serif",
      "garamond",
      "literata",
      "lora",
      "besley",
      "vollkorn",
      "zilla",
      "nunito"
    ]
  },
  "heroes": {
    "sourcePath": "skills/taste-skill/assets/layout/heroes.json",
    "sha256": "ec31203b4857901641dc2c8229ab52bb3dcebd7cadeb9619939a49e76061523e",
    "ids": [
      "place",
      "split",
      "photo",
      "product",
      "editorial",
      "collage",
      "word",
      "film",
      "statement",
      "triptych",
      "centred"
    ]
  },
  "diagrams": {
    "sourcePath": "skills/taste-skill/assets/diagrams/presets.json",
    "sha256": "76ef630a24fd63143d6e70329ab1698606357c0999446b1868bff08e929a30aa",
    "ids": [
      "hub-tools",
      "hub-branches",
      "hub-web",
      "ring-apps",
      "tree-orders",
      "lanes-agent",
      "lanes-media",
      "lanes-deploy",
      "fanin-warehouse",
      "bowtie-events",
      "ring-regions",
      "sync-crm",
      "timeline-onboarding",
      "grid-documents",
      "free-approval",
      "lanes-render",
      "hub-stack",
      "bowtie-model",
      "fanin-telemetry",
      "tree-release",
      "ring-edge",
      "lanes-matchmaking",
      "hub-stores",
      "ring-servers",
      "sync-saves",
      "timeline-season",
      "grid-assets"
    ]
  }
};
test('manifest pins every raw byte, source path, ID and full MIT notice', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  assert.equal(manifest.source.commit, 'd1a2bb41d927083ac7118f60cfc9cdf711810ea0');
  assert.equal(manifest.source.repository, 'https://github.com/Leonxlnx/taste-skill.git');
  assert.deepEqual(Object.keys(manifest.families).sort(), Object.keys(pinned).sort());
  for (const [family, expected] of Object.entries(pinned)) {
    const entry = manifest.families[family];
    const bytes = fs.readFileSync(path.join(root, entry.rawPath));
    assert.equal(entry.sourcePath, expected.sourcePath);
    assert.equal(entry.sha256, expected.sha256);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected.sha256);
    const data = JSON.parse(bytes);
    const records = family === 'heroes' ? data.heroes : family === 'diagrams' ? data.presets : data;
    const ids = Array.isArray(records) ? records.map(record => record.id) : Object.keys(records);
    assert.deepEqual(ids, expected.ids);
    assert.deepEqual(entry.ids, expected.ids);
    assert.equal(entry.count, expectedCounts[family]);
    if (process.env.TASTE_SOURCE) {
      assert.deepEqual(bytes, fs.readFileSync(path.join(process.env.TASTE_SOURCE, expected.sourcePath)));
    }
  }
  const license = fs.readFileSync(path.join(root, 'LICENSE'));
  assert.equal(manifest.license.sourcePath, 'LICENSE');
  assert.equal(manifest.license.sha256, createHash('sha256').update(license).digest('hex'));
  assert.match(license.toString(), /Copyright \(c\) 2026 Leonxlnx/);
  assert.match(license.toString(), /Permission is hereby granted/);
  assert.match(license.toString(), /SOFTWARE IS PROVIDED "AS IS"/);
  if (process.env.TASTE_SOURCE) assert.deepEqual(license, fs.readFileSync(path.join(process.env.TASTE_SOURCE, 'LICENSE')));
});



test('get retrieves every complete record without adding or dropping source fields', () => {
  for (const [family, expected] of Object.entries(pinned)) {
    const raw = JSON.parse(fs.readFileSync(path.join(root, 'raw', family + '.json')));
    const records = family === 'heroes' ? raw.heroes : family === 'diagrams' ? raw.presets : raw;
    for (const id of expected.ids) {
      const result = run('get', family, id);
      assert.equal(result.status, 0, result.stderr);
      const data = JSON.parse(result.stdout);
      assert.equal(data.family, family);
      assert.equal(data.id, id);
      assert.deepEqual(data.record, family === 'diagrams' ? records[id] : records.find(record => record.id === id));
    }
  }
});


function diagnostic(result, code) {
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, '');
  const data = JSON.parse(result.stderr);
  assert.equal(data.ok, false);
  assert.equal(data.error.code, code);
  assert.equal(typeof data.error.message, 'string');
}
test('unknown and traversal families and IDs fail with JSON diagnostics', () => {
  for (const family of ['missing', '../palettes', '/etc/passwd', '__proto__', 'constructor', 'palettes.json']) {
    diagnostic(run('list', family), 'UNKNOWN_FAMILY');
    diagnostic(run('get', family, 'white-link-blue'), 'UNKNOWN_FAMILY');
  }
  for (const id of ['missing', '../white-link-blue', '__proto__', 'constructor']) {
    diagnostic(run('get', 'palettes', id), 'UNKNOWN_ID');
    diagnostic(run('get', 'diagrams', id), 'UNKNOWN_ID');
  }
});


test('arguments require explicit summary/list/get with exact arity; no random fallback', () => {
  for (const args of [[], ['random'], ['pick', 'palettes'], ['summary', 'extra'], ['list'], ['list', 'palettes', 'extra'], ['get', 'palettes'], ['get', 'palettes', 'white-link-blue', 'extra'], ['--help']]) {
    diagnostic(run(...args), 'USAGE');
  }
});


function fixture(t) {
  const scratch = process.env.TMPDIR;
  assert.ok(scratch, 'TMPDIR must point to isolated scratch storage');
  const dir = fs.mkdtempSync(path.join(scratch, 'taste-lookup-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const script = path.join(dir, '.codex/scripts/design-library.mjs');
  const data = path.join(dir, 'docs/core/design-library');
  fs.mkdirSync(path.dirname(script), { recursive: true });
  fs.mkdirSync(data, { recursive: true });
  fs.copyFileSync(cli, script);
  for (const name of ['raw', 'manifest.json', 'LICENSE']) {
    fs.cpSync(path.join(root, name), path.join(data, name), { recursive: true });
  }
  return { data, run: (...args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', cwd: dir }) };
}
test('missing and unreadable-as-file data produce JSON READ_ERROR', (t) => {
  const f = fixture(t);
  const file = path.join(f.data, 'raw/palettes.json');
  fs.unlinkSync(file);
  diagnostic(f.run('list', 'palettes'), 'READ_ERROR');
  fs.mkdirSync(file);
  diagnostic(f.run('summary'), 'READ_ERROR');
});


test('malformed JSON produces a machine-readable PARSE_ERROR', (t) => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.data, 'raw/typography.json'), '{broken');
  diagnostic(f.run('list', 'typography'), 'PARSE_ERROR');
});


test('wrong roots, collections, record fields and duplicate IDs produce SCHEMA_ERROR', (t) => {
  const f = fixture(t);
  const invalid = {
    palettes: [null, {}, [], [{ id: 'x' }], [{ id: 'x', name: 'X', note: 'n' }, { id: 'x', name: 'X', note: 'n' }]],
    typography: [null, {}, [], [{ id: 'x', display: {}, suits: 'n' }]],
    heroes: [null, [], {}, { heroes: {} }, { heroes: [null] }, { heroes: [{ id: 'x', name: 'X', job: 'n' }] }],
    diagrams: [null, [], {}, { presets: [] }, { presets: { x: null } }, { presets: { x: { layout: 'hub', alt: 'n', types: 'software' } } }],
  };
  for (const [family, cases] of Object.entries(invalid)) {
    const file = path.join(f.data, 'raw', family + '.json');
    for (const value of cases) {
      fs.writeFileSync(file, JSON.stringify(value));
      diagnostic(f.run('list', family), 'SCHEMA_ERROR');
    }
  }
});


test('lookup rejects changed complete records or bytes against provenance hashes', (t) => {
  const f = fixture(t);
  for (const family of Object.keys(pinned)) {
    const file = path.join(f.data, 'raw', family + '.json');
    const original = fs.readFileSync(file);
    fs.writeFileSync(file, Buffer.concat([original, Buffer.from('\n')]));
    diagnostic(f.run('list', family), 'INTEGRITY_ERROR');
    fs.writeFileSync(file, original);
  }
});


test('manifest errors fail closed without accepting path traversal or unpinned sources', (t) => {
  const f = fixture(t);
  const file = path.join(f.data, 'manifest.json');
  const original = fs.readFileSync(file);
  fs.unlinkSync(file);
  diagnostic(f.run('summary'), 'READ_ERROR');
  fs.writeFileSync(file, '{broken');
  diagnostic(f.run('summary'), 'PARSE_ERROR');
  for (const value of [null, {}, [], { schemaVersion: 1, families: {} }]) {
    fs.writeFileSync(file, JSON.stringify(value));
    diagnostic(f.run('summary'), 'SCHEMA_ERROR');
  }
  for (const mutate of [
    m => { m.families.palettes.rawPath = '../../outside.json'; },
    m => { m.families.palettes.sha256 = 'invalid'; },
    m => { m.families.palettes.ids = ['invented']; },
    m => { m.families.palettes.count = 63; },
    m => { m.source.commit = '0000000000000000000000000000000000000000'; },
    m => { m.families.unexpected = m.families.palettes; },
  ]) {
    const manifest = JSON.parse(original);
    mutate(manifest);
    fs.writeFileSync(file, JSON.stringify(manifest));
    diagnostic(f.run('summary'), 'SCHEMA_ERROR');
  }
});


test('INDEX enumerates every ID and links to an exact complete record in four counted sections', () => {
  const index = fs.readFileSync(path.join(root, 'INDEX.md'), 'utf8');
  assert.equal((index.match(/^## /gm) ?? []).length, 4);
  for (const [family, expected] of Object.entries(pinned)) {
    assert.ok(index.includes(`## ${family} — ${expectedCounts[family]}`));
    const section = index.split(`## ${family} — ${expectedCounts[family]}`)[1].split('\n## ')[0];
    const rows = section.split('\n').filter(line => line.startsWith('| `'));
    assert.deepEqual(rows.map(line => line.match(/^\| `([^`]+)`/)[1]), expected.ids);
    const full = fs.readFileSync(path.join(root, 'records', family + '.md'), 'utf8');
    const raw = JSON.parse(fs.readFileSync(path.join(root, 'raw', family + '.json')));
    const records = family === 'heroes' ? raw.heroes : family === 'diagrams' ? raw.presets : raw;
    for (const [i, id] of expected.ids.entries()) {
      assert.ok(rows[i].includes(`(records/${family}.md#${id})`));
      const columns = rows[i].split('|');
      assert.ok(columns[2].trim().length && columns[3].trim().length);
      const anchor = `<a id="${id}"></a>`;
      assert.equal(full.split(anchor).length, 2);
      const block = full.split(anchor)[1].match(/```json\n([\s\S]*?)\n```/)[1];
      assert.deepEqual(JSON.parse(block), family === 'diagrams' ? records[id] : records.find(record => record.id === id));
    }
  }
  assert.match(index, /MASTER\.md/);
  assert.match(index, /не.*глобальн/i);
});


test('CLI runs with filesystem writes and child processes forbidden, independent of cwd', (t) => {
  const f = fixture(t);
  function snapshot() {
    return fs.readdirSync(f.data, { recursive: true }).sort().map(name => {
      const file = path.join(f.data, name);
      const stat = fs.statSync(file);
      return [name, stat.mode, stat.mtimeMs, stat.isFile() ? createHash('sha256').update(fs.readFileSync(file)).digest('hex') : null];
    });
  }
  const before = snapshot();
  const isolatedCLI = path.join(f.data, '../../../.codex/scripts/design-library.mjs');
  for (const args of [['summary'], ['list', 'palettes'], ['get', 'diagrams', 'hub-tools']]) {
    const result = spawnSync(process.execPath, ['--permission', '--allow-fs-read=*', isolatedCLI, ...args], { encoding: 'utf8', cwd: process.env.TMPDIR });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, '');
    const repeat = spawnSync(process.execPath, ['--permission', '--allow-fs-read=*', isolatedCLI, ...args], { encoding: 'utf8', cwd: process.env.TMPDIR });
    assert.equal(repeat.status, 0, repeat.stderr);
    assert.equal(result.stdout, repeat.stdout);
  }
  assert.deepEqual(snapshot(), before);
  const implementation = fs.readFileSync(cli, 'utf8');
  assert.deepEqual([...implementation.matchAll(/from '([^']+)'/g)].map(match => match[1]).sort(), ['node:crypto', 'node:fs', 'node:url']);
  assert.doesNotMatch(implementation, /\b(?:fetch|eval|exec|spawn|import)\s*\(|Math\.random/);
});

test('real duplicate IDs, ID drift, and changed nested fields are rejected', (t) => {
  const f = fixture(t);
  const file = path.join(f.data, 'raw/palettes.json');
  const raw = fs.readFileSync(file);
  const duplicate = JSON.parse(raw);
  duplicate[1] = duplicate[0];
  fs.writeFileSync(file, JSON.stringify(duplicate));
  diagnostic(f.run('list', 'palettes'), 'SCHEMA_ERROR');
  const drift = JSON.parse(raw);
  drift[0].id = 'invented';
  fs.writeFileSync(file, JSON.stringify(drift));
  diagnostic(f.run('list', 'palettes'), 'SCHEMA_ERROR');
  const changed = JSON.parse(raw);
  changed[0].fields[0].bg = '#123456';
  fs.writeFileSync(file, JSON.stringify(changed));
  diagnostic(f.run('get', 'palettes', 'white-link-blue'), 'INTEGRITY_ERROR');
});

test('list exposes the exact pinned IDs with useful record descriptors', () => {
  for (const [family, expected] of Object.entries(pinned)) {
    const result = run('list', family);
    assert.equal(result.status, 0, result.stderr);
    const data = JSON.parse(result.stdout);
    assert.equal(data.family, family);
    assert.deepEqual(data.records.map(record => record.id), expected.ids);
    for (const record of data.records) {
      assert.equal(typeof record.name, 'string');
      assert.ok(record.name.length);
      assert.equal(typeof record.notes, 'string');
      assert.ok(record.notes.length);
    }
  }
});

