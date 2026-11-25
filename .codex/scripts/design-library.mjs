#!/usr/bin/env node
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../docs/core/design-library/', import.meta.url));
const families = ['palettes', 'typography', 'heroes', 'diagrams'];
function readBytes(relative) {
  try {
    return fs.readFileSync(`${root}/${relative}`);
  } catch (error) {
    fail('READ_ERROR', `Cannot read ${relative}: ${error.code}`);
  }
}
function parseJSON(bytes, label) {
  try {
    return JSON.parse(bytes);
  } catch {
    fail('PARSE_ERROR', `Invalid JSON in ${label}`);
  }
}
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = value => typeof value === 'string' && value.length > 0;
const pins = {
  "palettes": {
    "sourcePath": "skills/taste-skill/library/palettes.json",
    "sha256": "96d594648249b2dff17addcd0e2965b0eee0cf2815ae68542add82a87d856d6d",
    "count": 64
  },
  "typography": {
    "sourcePath": "skills/taste-skill/library/type.json",
    "sha256": "144be2adc366028ec2d380782e9150436f6bf5f1e4177159674c84435250d830",
    "count": 39
  },
  "heroes": {
    "sourcePath": "skills/taste-skill/assets/layout/heroes.json",
    "sha256": "ec31203b4857901641dc2c8229ab52bb3dcebd7cadeb9619939a49e76061523e",
    "count": 11
  },
  "diagrams": {
    "sourcePath": "skills/taste-skill/assets/diagrams/presets.json",
    "sha256": "76ef630a24fd63143d6e70329ab1698606357c0999446b1868bff08e929a30aa",
    "count": 27
  }
};
function loadManifest() {
  const manifest = parseJSON(readBytes('manifest.json'), 'manifest.json');
  if (!isObject(manifest) || manifest.schemaVersion !== 1 ||
      manifest.source?.commit !== 'd1a2bb41d927083ac7118f60cfc9cdf711810ea0' ||
      manifest.source?.repository !== 'https://github.com/Leonxlnx/taste-skill.git' ||
      !isObject(manifest.families) ||
      Object.keys(manifest.families).sort().join() !== [...families].sort().join()) {
    fail('SCHEMA_ERROR', 'Invalid pinned manifest');
  }
  for (const family of families) {
    const entry = manifest.families[family];
    const pin = pins[family];
    if (!isObject(entry) || entry.rawPath !== `raw/${family}.json` ||
        entry.sourcePath !== pin.sourcePath || entry.sha256 !== pin.sha256 ||
        entry.count !== pin.count || !Array.isArray(entry.ids) ||
        entry.ids.length !== pin.count || !entry.ids.every(isText) ||
        new Set(entry.ids).size !== pin.count) {
      fail('SCHEMA_ERROR', `Invalid manifest entry: ${family}`);
    }
  }
  return manifest;
}
function records(family) {
  const bytes = readBytes(`raw/${family}.json`);
  const data = parseJSON(bytes, family);
  const nested = family === 'heroes' || family === 'diagrams';
  if (nested && !isObject(data)) fail('SCHEMA_ERROR', `Expected object root in ${family}`);
  const entries = family === 'heroes' ? data.heroes : family === 'diagrams' ? data.presets : data;
  const dictionary = family === 'diagrams';
  if (dictionary ? !isObject(entries) : !Array.isArray(entries)) {
    fail('SCHEMA_ERROR', `Invalid collection in ${family}`);
  }
  const pairs = dictionary ? Object.entries(entries) : entries.map(record => [record?.id, record]);
  const ids = new Set();
  if (!pairs.length) fail('SCHEMA_ERROR', `Empty collection in ${family}`);
  for (const [id, record] of pairs) {
    let valid = isText(id) && isObject(record) && !ids.has(id);
    if (valid && family === 'palettes') {
      valid = isText(record.name) && isText(record.note) && Array.isArray(record.trades) && isText(record.bg);
    } else if (valid && family === 'typography') {
      valid = isObject(record.display) && isText(record.display.family) && isObject(record.text) && isText(record.text.family) && isText(record.suits);
    } else if (valid && family === 'heroes') {
      valid = isText(record.name) && isText(record.job) && isObject(record.types) && Array.isArray(record.needs) && isObject(record.h1) && isObject(record.grid);
    } else if (valid && family === 'diagrams') {
      valid = isText(record.layout) && isText(record.alt) && Array.isArray(record.types) && record.types.every(isText);
    }
    if (!valid) fail('SCHEMA_ERROR', `Invalid or duplicate record in ${family}: ${id}`);
    ids.add(id);
  }
  const manifest = loadManifest();
  if (pairs.length !== manifest.families[family].count ||
      pairs.some(([id], index) => id !== manifest.families[family].ids[index])) {
    fail('SCHEMA_ERROR', `Manifest ID set mismatch in ${family}`);
  }
  if (createHash('sha256').update(bytes).digest('hex') !== manifest.families[family].sha256) {
    fail('INTEGRITY_ERROR', `Source hash mismatch in ${family}`);
  }
  return pairs;
}
function describe([id, record]) {
  return {
    id,
    name: record.name ?? record.display?.family ?? id,
    notes: record.note ?? record.suits ?? record.job ?? record.alt,
  };
}
function fail(code, message) {
  process.stderr.write(JSON.stringify({ ok: false, error: { code, message } }) + '\n');
  process.exit(1);
}
const args = process.argv.slice(2);
const [command, family, id] = args;
const arities = new Map([['summary', 1], ['list', 2], ['get', 3]]);
if (arities.get(command) !== args.length) {
  fail('USAGE', 'Usage: node .codex/scripts/design-library.mjs summary | list <family> | get <family> <id>');
}
if ((command === 'list' || command === 'get') && !families.includes(family)) {
  fail('UNKNOWN_FAMILY', `Unknown family: ${family}`);
}
let output;
if (command === 'get') {
  const match = records(family).find(([key]) => key === id);
  if (!match) fail('UNKNOWN_ID', `Unknown ID in ${family}: ${id}`);
  output = { family, id, record: match[1] };
} else if (command === 'list') {
  output = { family, records: records(family).map(describe) };
} else {
  output = { counts: Object.fromEntries(families.map(key => [key, records(key).length])) };
}
console.log(JSON.stringify(output, null, 2));
