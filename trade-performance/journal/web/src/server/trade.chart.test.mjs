import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the real server module without importing server-only or opening a DB pool.
const source = fs.readFileSync(new URL('./trade.ts', import.meta.url), 'utf8');
function load(fetch, q = async () => []) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require: (name) => name === './db' ? { q } : {}, fetch, URLSearchParams, AbortSignal, Date });
  return exports;
}
const from = new Date('2026-11-20T10:00:00Z');
const to = new Date('2026-11-20T11:00:00Z');
const row = (time, extra = {}) => ({ time, open: '100', high: '110', low: '90', close: '105', ...extra });
const reply = (data) => ({ ok: true, json: async () => data });
const mexc = { data: { time: [1795168800], open: [100], high: [110], low: [90], close: [105] } };

test('invalid BingX payloads fall back to MEXC without claiming BingX provenance', async () => {
  for (const payload of [
    { code: 109400, data: [row(1795168800000)] },
    { code: 0, data: [] },
    { code: 0, data: [row(1795168800000, { open: 'garbage' })] },
    { code: 0, data: [row(1795168800000, { low: '120' })] },
    { code: 0, data: [row(1795168800000, { close: null })] },
    { code: 0, data: [row(1795168800)] },
  ]) {
    const api = load(async (url) => reply(url.includes('bingx.com') ? payload : mexc));
    assert.equal((await api.candles('BTCUSDT', from, to, 'bingx')).source, 'MEXC', JSON.stringify(payload));
  }
});

test('BingX duplicate and out-of-window candles cannot corrupt the chart', async () => {
  const api = load(async () => reply({ code: 0, data: [row(1795168800000), row(1795168800000), row(1000)] }));
  const result = await api.candles('BTCUSDT', from, to, 'bingx');
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].time, 1795168800);
});

test('MEXC remains first for existing callers; exhausted providers return no market data', async () => {
  const calls = [];
  const api = load(async (url) => { calls.push(url); return reply(mexc); });
  assert.equal((await api.candles('MONUSDT', from, to, 'mexc')).source, 'MEXC');
  assert.match(calls[0], /MONAD_USDT/);
  assert.equal(calls.length, 1);
  const empty = load(async () => reply({ code: 109400 }));
  assert.equal((await empty.candles('BTCUSDT', from, to, 'bingx')).source, null);
});

test('HTTP failures fall back and BingX network requests have a bounded timeout', async () => {
  let options;
  const api = load(async (url, opts) => {
    if (url.includes('bingx.com')) { options = opts; return { ok: false, json: async () => ({ code: 0, data: [row(1795168800000)] }) }; }
    return reply(mexc);
  });
  assert.equal((await api.candles('BTCUSDT', from, to, 'bingx')).source, 'MEXC');
  assert.ok(options.signal instanceof AbortSignal);
});

test('trade card queries execution venue and page passes it with truthful fallback and synthetic labels', async () => {
  let sql;
  const api = load(async () => reply({}), async (query) => { sql = query; return []; });
  await api.tradeCard('not-found');
  assert.match(sql, /JOIN accounts a ON a.id = t.account_id/);
  assert.match(sql, /JOIN venues v ON v.id = a.venue_id/);
  assert.match(sql, /v.slug AS venue/);
  const page = fs.readFileSync(new URL('../app/trades/[id]/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /candles\(t.symbol,[^\n]+t.venue\)/);
  assert.doesNotMatch(page, /контракт делистнут/);
  assert.match(page, /резервный источник/);
  assert.match(page, /не рынок/);
});

test('BingX trades request public swap v3 first and parse descending object candles into ascending seconds', async () => {
  const calls = [];
  const api = load(async (url) => {
    calls.push(new URL(url));
    return reply({ code: 0, data: [row(1795169100000), row(1795168800000)] });
  });
  const result = await api.candles('BTCUSDT', from, to, 'BingX');
  assert.equal(result.source, 'BingX');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].origin, 'https://open-api.bingx.com');
  assert.equal(calls[0].pathname, '/openApi/swap/v3/quote/klines');
  assert.equal(calls[0].searchParams.get('symbol'), 'BTC-USDT');
  assert.equal(calls[0].searchParams.get('interval'), '5m');
  assert.ok(Number(calls[0].searchParams.get('startTime')) < from.getTime());
  assert.ok(Number(calls[0].searchParams.get('endTime')) > to.getTime());
  assert.deepEqual(JSON.parse(JSON.stringify(result.data)), [
    { time: 1795168800, open: 100, high: 110, low: 90, close: 105 },
    { time: 1795169100, open: 100, high: 110, low: 90, close: 105 },
  ]);
});
