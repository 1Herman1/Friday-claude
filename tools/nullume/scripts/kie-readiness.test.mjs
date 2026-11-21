import test from 'node:test';
import assert from 'node:assert/strict';
import { balanceTransport, checkBalance } from './kie-readiness.mjs';

const creditURL = 'https://api.kie.ai/api/v1/chat/credit';

test('Nullume accepts positive and zero numeric balances, with redirect rejection', async () => {
  for (const value of [123.5, 0]) {
    let calls = 0;
    const result = await checkBalance('test-only-placeholder', async (url, init) => {
      calls++;
      assert.equal(url, creditURL);
      assert.equal(init.redirect, 'error');
      assert.ok(init.signal);
      return new Response(JSON.stringify({code: 200, data: value}));
    });
    assert.equal(calls, 1);
    assert.deepEqual(result, {authenticated: true, balance_credits: value, generation_requests: 0, uploads: 0});
  }
});

test('transport rejects all other hosts, paths and write methods before fetch', async () => {
  const transport = balanceTransport(() => assert.fail('Network must not be reached'));
  for (const [url, init] of [
    ['https://example.com/api/v1/chat/credit', {}],
    ['https://api.kie.ai/api/v1/jobs/createTask', {method: 'POST'}],
    [creditURL, {method: 'POST'}],
    [creditURL + '?key=not-allowed', {}],
    [creditURL, {body: 'not-allowed'}],
  ]) await assert.rejects(transport(url, init), /Read-only request rejected/);
});

test('missing credentials fail before a network call', async () => {
  await assert.rejects(checkBalance('', () => assert.fail('No request')), /Missing credential/);
});

test('invalid provider payloads never become authenticated success', async () => {
  for (const payload of [{code: 401, msg: 'untrusted'}, {code: 200, data: -1},
    {code: 200, data: '123'}, {code: 200, data: null}, {code: 200, data: {}}]) {
    await assert.rejects(checkBalance('test-only-placeholder', async () =>
      new Response(JSON.stringify(payload))), /Invalid balance/);
  }
  await assert.rejects(checkBalance('test-only-placeholder', async () =>
    new Response('private diagnostic', {status: 403})), /Balance request failed/);
});
