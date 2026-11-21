import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, realpath, rm, writeFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import * as pilot from './serum3-pilot.mjs';
import {
  MODEL, ANCHOR, DESCRIPTION, DOC, PRICE, TOKEN, UPLOAD, CREATE, CREDIT, STATUS,
  payload, runPilot, taskId, checkVideoUrl, checkFrames, boundedRequest, isPublicIPv4,
} from './serum3-pilot.mjs';

const first = 'https://tempfile.redpandaai.co/abc/first.png';
const tail = 'https://tempfile.redpandaai.co/abc/tail.png';
const video = 'https://tempfile.aiquickdraw.com/p/video.mp4';
const id = 'a'.repeat(32);
const key = 'mock-key-marker';
const record = { anchor: ANCHOR, modelDescription: DESCRIPTION, interfaceType: 'video',
  provider: 'Kling', creditPrice: '126', creditUnit: 'per video', usdPrice: '0.63', discountPrice: false };
const schema = [
  'paths:', '  /api/v1/jobs/createTask:', '    post:', '      requestBody:',
  '        content:', '          application/json:', '            schema:', '              properties:',
  '                model:', '                  type: string', '                  enum:',
  '                    - ' + MODEL, '                input:', '                  type: object',
  '                  required:', '                    - prompt', '                    - image_url',
  '                  properties:', '                    prompt:', '                      type: string',
  '                    image_url:', '                      type: string',
  '                    tail_image_url:', '                      type: string',
  '                    duration:', '                      type: string',
  '                      enum:', "                        - '5'", "                        - '10'",
].join('\n');
const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000780000004380802000000', 'hex');
const mp4 = Buffer.from('00000018667479706d7034320000000069736f6d6d703432', 'hex');

async function withFrames(fn) {
  const dir = await mkdtemp(join(await realpath(tmpdir()), 'serum3-test-'));
  try {
    const tailPng = Buffer.concat([png, Buffer.from([0])]);
    const manifest = { ready: true, first: hash(png), tail: hash(tailPng) };
    await writeFile(join(dir, 'frames.json'), JSON.stringify(manifest));
    await writeFile(join(dir, 'first.png'), png);
    await writeFile(join(dir, 'tail.png'), tailPng);
    await fn(dir, manifest);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function hash(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function mock(options = {}) {
  const calls = [];
  const request = async (url, init) => {
    assert.equal(init.redirect, 'error');
    calls.push(url);
    const auth = new Headers(init.headers).get('authorization');
    assert.equal(auth, [CREDIT, UPLOAD, CREATE, STATUS + id].includes(url) ? 'Bearer ' + (options.key ?? key) : null);
    if (url === DOC) return new Response(options.schema ?? schema);
    if (url === PRICE) {
      const { pageNum, ...query } = JSON.parse(init.body);
      assert.deepEqual(query, { pageSize: 100, modelDescription: '', interfaceType: '' });
      const records = options.records ?? [record];
      return Response.json({ code: 200, data: { records: records.slice(100 * (pageNum - 1), 100 * pageNum), total: records.length } });
    }
    if (url === CREDIT) return Response.json({ code: 200, data: options.balance ?? 500 });
    if (url === UPLOAD) {
      assert.equal(init.method, 'POST');
      const name = init.body.get('file').name;
      return Response.json({ code: 200, success: true, data: {
        downloadUrl: options.upload ?? (name === 'first.png' ? first : tail),
      } });
    }
    if (url === CREATE) {
      assert.equal(init.method, 'POST');
      assert.deepEqual(JSON.parse(init.body), payload(first, tail));
      if (options.createStatus) return Response.json({ msg: 'raw ' + key }, { status: options.createStatus });
      if (options.createError) throw Error('raw ' + key + ' https://example.test/?token=marker');
      return Response.json({ code: 200, data: { taskId: options.id ?? id } });
    }
    if (url === STATUS + id) return Response.json({ code: 200, data: {
      taskId: id, model: MODEL, state: 'success', creditsConsumed: options.charged ?? 126,
      resultJson: options.result ?? JSON.stringify({ resultUrls: [video] }),
    } });
    if (url === video) return new Response(mp4, { headers: { 'content-type': 'video/mp4' } });
    assert.fail('unexpected endpoint');
  };
  return { calls, request };
}

const generate = { mode: 'generate-one', confirmation: TOKEN, attempt: '1', getKey: () => key };

test('public metadata can be checked without frame files or any credential', async () => {
  const { request, calls } = mock();
  assert.equal(typeof pilot.validatePublicMetadata, 'function');
  const result = await pilot.validatePublicMetadata(request);
  assert.deepEqual(result, { model: MODEL, duration: '10', credits: 126, usd: 0.63 });
  assert.deepEqual(calls, [DOC, PRICE]);
});

test('dry run crosses the pricing page boundary without credentials or uploads', () => withFrames(async (dir) => {
  const { request, calls } = mock({ records: [...Array(100).fill({}), record] });
  await runPilot({ dir, mode: 'dry-run', request, getKey: () => assert.fail() });
  assert.deepEqual(calls, [DOC, PRICE, PRICE]);
}));

test('exact price, model anchor, duration and metadata are mandatory', () => withFrames(async (dir) => {
  for (const records of [
    [{ ...record, creditPrice: '84-126' }], [{ ...record, creditPrice: '127' }],
    [{ ...record, creditPrice: 126 }], [{ ...record, discountPrice: true }],
    [{ ...record, anchor: ANCHOR + '&x=1' }], [{ ...record, modelDescription: DESCRIPTION.replace('10.0', '5.0') }],
    [record, { ...record, creditPrice: '127' }], [record, record],
  ]) {
    const { request, calls } = mock({ records });
    await assert.rejects(runPilot({ ...generate, dir, request }), /price/);
    assert.deepEqual(calls, [DOC, PRICE]);
  }
  for (const badSchema of [schema.replace("'10'", "'5'"), schema.replace('tail_image_url', 'other'),
    schema.replace('duration:\n                      type: string', 'duration:\n                      type: integer')]) {
    const { request } = mock({ schema: badSchema });
    await assert.rejects(runPilot({ ...generate, dir, request }), /schema/);
  }
}));

test('frame manifest fails closed on unready, traversal, mismatch and symlink', () => withFrames(async (dir, manifest) => {
  await checkFrames(dir);
  for (const invalid of [{ ...manifest, ready: false }, { ...manifest, first: '../../.env' },
    { ...manifest, first: manifest.tail }, { ...manifest, first: '0'.repeat(64) }]) {
    await writeFile(join(dir, 'frames.json'), JSON.stringify(invalid));
    await assert.rejects(checkFrames(dir), /frame/);
  }
  await writeFile(join(dir, 'frames.json'), JSON.stringify(manifest));
  await rm(join(dir, 'first.png'));
  await symlink('tail.png', join(dir, 'first.png'));
  await assert.rejects(checkFrames(dir), /frame/);
}));

test('generate submits exactly one fixed request and yields sanitized data', () => withFrames(async (dir) => {
  const { request, calls } = mock();
  const result = await runPilot({ ...generate, dir, request });
  assert.equal(result.video.compare(mp4), 0);
  assert.deepEqual(result.summary, { taskId: id, maxCredits: 126, creditsConsumed: 126 });
  assert.deepEqual(calls, [DOC, PRICE, CREDIT, UPLOAD, UPLOAD, CREATE, STATUS + id, video]);
  assert.deepEqual(Object.keys(payload(first, tail).input).sort(), ['duration', 'image_url', 'prompt', 'tail_image_url']);
  assert.equal(payload(first, tail).input.duration, '10');
}));

test('accepts documented provider task IDs without permitting log injection', () => {
  assert.equal(taskId('task_kling_1765187759663'), 'task_kling_1765187759663');
  assert.throws(() => taskId('task_kling_1\n::error::payload'));
});

test('paid authorization binds the reviewed environment to one exact dispatch run', () => {
  const env = { GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'workflow_dispatch',
    GITHUB_RUN_ATTEMPT: '1', SERUM3_CONFIRMATION: TOKEN, RUNNER_TEMP: '/runner/temp',
    GITHUB_RUN_ID: '12345', SERUM3_APPROVED_RUN_ID: '12345' };
  assert.equal(typeof pilot.authorizePaidRun, 'function');
  assert.doesNotThrow(() => pilot.authorizePaidRun(env));
  assert.throws(() => pilot.authorizePaidRun({ ...env, GITHUB_RUN_ID: '12346' }));
  assert.throws(() => pilot.authorizePaidRun({ ...env, SERUM3_APPROVED_RUN_ID: undefined }));
});

test('metadata write failure after paid creation must not prevent polling and download', () => withFrames(async (dir) => {
  const { request } = mock();
  const result = await runPilot({ ...generate, dir, request, onSubmitted: () => { throw Error('private-marker'); } });
  assert.equal(result.video.compare(mp4), 0);
  assert.equal(result.summary.taskId, id);
}));

test('production media decoder rejects incomplete PNG and MP4 headers', async () => {
  assert.equal(typeof pilot.validateDecodedMedia, 'function');
  await assert.rejects(pilot.validateDecodedMedia(png, 'png'), /media/);
  await assert.rejects(pilot.validateDecodedMedia(mp4, 'video'), /media/);
});

test('re-runs and missing confirmation are refused before I/O', async () => {
  for (const overrides of [{ attempt: '2' }, { attempt: undefined }, { confirmation: 'none' }]) {
    await assert.rejects(runPilot({ ...generate, ...overrides, request: () => assert.fail() }), /authorization/);
  }
});

test('malicious provider results stop without leaking errors or retrying', () => withFrames(async (dir) => {
  for (const [options, count] of [
    [{ createError: true }, 1], [{ createStatus: 429 }, 1], [{ createStatus: 421 }, 1], [{ id: 'bad?taskId=injected' }, 1],
    [{ result: JSON.stringify({ resultUrls: [video + '?token=marker'] }) }, 1],
    [{ result: JSON.stringify({ resultUrls: [video, video] }) }, 1],
    [{ charged: 127 }, 1], [{ upload: 'https://127.0.0.1/x.png' }, 0], [{ balance: 125 }, 0],
  ]) {
    const { request, calls } = mock(options);
    await assert.rejects(runPilot({ ...generate, dir, request }), (error) => {
      assert.doesNotMatch(error.message, /raw|mock-key|https:|marker|injected/);
      assert.equal(error.cause, undefined);
      return true;
    });
    assert.equal(calls.filter((url) => url === CREATE).length, count);
    assert.ok(!calls.includes(video));
  }
}));

test('rejects echoed credentials before forwarding media or recording the task', () => withFrames(async (dir) => {
  const hexKey = 'b'.repeat(32);
  for (const [options, suppliedKey] of [
    [{ upload: first.replace('abc', key) }, key],
    [{ id: hexKey }, hexKey],
    [{ result: JSON.stringify({ resultUrls: [video.replace('video', key)] }) }, key],
  ]) {
    const { request, calls } = mock({ ...options, key: suppliedKey });
    await assert.rejects(runPilot({ ...generate, dir, request, getKey: () => suppliedKey }), /response rejected/);
    assert.deepEqual(calls, options.upload ? [DOC, PRICE, CREDIT, UPLOAD] :
      options.id ? [DOC, PRICE, CREDIT, UPLOAD, UPLOAD, CREATE] :
        [DOC, PRICE, CREDIT, UPLOAD, UPLOAD, CREATE, STATUS + id]);
  }
}));

test('rejects wrong CDN hosts, private IPs, userinfo, queries and redirects', async () => {
  for (const url of ['http://tempfile.aiquickdraw.com/p/video.mp4', 'https://127.0.0.1/v.mp4',
    'https://[::1]/p/v.mp4', 'https://tempfile.aiquickdraw.com.evil.test/p/v.mp4',
    'https://tempfile.aiquickdraw.com@evil.test/p/v.mp4', video + '#secret',
    video + '?', video.replace('/p/', ':443/p/'), video.replace('/p/', '/%2e%2e/'),
    video.replace('//', '//user@'), 'https://tempfile.redpandaai.co/p/v.mp4']) {
    assert.throws(() => checkVideoUrl(url));
  }
  for (const ip of ['127.0.0.1', '169.254.169.254', '10.0.0.1', '100.64.0.1', '192.168.0.1', '::1']) {
    assert.equal(isPublicIPv4(ip), false);
  }
  assert.equal(isPublicIPv4('8.8.8.8'), true);
  assert.throws(() => taskId('abc\n::error::secret'));
  await assert.rejects(boundedRequest(async () => new Response(null, {
    status: 307, headers: { location: 'https://evil.test/' },
  }), DOC), /request/);
  await assert.rejects(boundedRequest(async () => new Response('abcd'), DOC, {}, 3), /request/);
});
