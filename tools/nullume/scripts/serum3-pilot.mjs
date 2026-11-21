import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { lookup } from 'node:dns';
import { constants } from 'node:fs';
import { appendFile, mkdir, open, realpath, rename, writeFile } from 'node:fs/promises';
import { request as httpsRequest } from 'node:https';
import { BlockList, isIPv4 } from 'node:net';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { KieClient } from '../dist/core/providers/kie/client.js';
import { extractInputSchema } from '../dist/core/providers/kie/schema.js';

export const MODEL = 'kling/v2-5-turbo-image-to-video-pro';
export const ANCHOR = 'https://kie.ai/kling-2-5?model=kling%2Fv2-5-turbo-image-to-video-pro';
export const DESCRIPTION = 'kling 2.5 turbo, image-to-video, Turbo Pro-10.0s';
export const DOC = 'https://docs.kie.ai/market/kling/v25-turbo-image-to-video-pro.md';
export const PRICE = 'https://api.kie.ai/client/v1/model-pricing/page';
export const UPLOAD = 'https://kieai.redpandaai.co/api/file-stream-upload';
export const CREATE = 'https://api.kie.ai/api/v1/jobs/createTask';
export const CREDIT = 'https://api.kie.ai/api/v1/chat/credit';
export const STATUS = 'https://api.kie.ai/api/v1/jobs/recordInfo?taskId=';
export const TOKEN = 'confirm-serum3-one-126';

const FRAMES = fileURLToPath(new URL('../../../docs/projects/perfect-skin/media-review/serum3-pilot', import.meta.url));
const QUOTED_CREDITS = 126;
const JSON_LIMIT = 1024 * 1024;
const VIDEO_LIMIT = 64 * 1024 * 1024;
const PNG_LIMIT = 10_000_000;
const MAX_PRICE_PAGES = 20;
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');

const PROMPT = 'Locked-off camera and a seamless pure white studio. Begin with the supplied completely empty white first frame. Three original serum bottles enter sequentially from the LEFT in this order: 4DHYAL, then BLOCKMELAN, then FLUVIX. Preserve exactly the three bottles shown in the supplied final frame, including packaging, proportions, caps, colors and label lettering. Each bottle rolls naturally with rotation coupled to its translation on the same surface. Gentle physical contact between bottles causes a small, immediate recoil before each settles. End in the supplied stable final arrangement on the right, with the leftmost 40% clean white and title-safe. Hold that final composition steady. No added text, props, hands, duplicate bottles, camera movement or cuts.';

class PilotFailure extends Error {}
function requirePilot(condition, reason) {
  if (!condition) throw new PilotFailure(reason);
}

export function taskId(value) {
  requirePilot(typeof value === 'string' && /^(?:[a-f0-9]{32}|task_[A-Za-z0-9_-]{1,120})$(?![\s\S])/.test(value), 'Invalid provider task ID.');
  return value;
}

function fileUrl(value, hostname, extension) {
  // Match the raw URL to reject normalization, escaped path characters and empty query markers.
  const prefix = 'https://' + hostname + '/';
  requirePilot(typeof value === 'string' && value.length <= 2048 && value.startsWith(prefix),
    'Rejected provider media URL.');
  const path = value.slice(prefix.length);
  requirePilot(path.endsWith('.' + extension) &&
    path.split('/').every((segment) => /^[A-Za-z0-9_-][A-Za-z0-9_.-]*$(?![\s\S])/.test(segment)),
  'Rejected provider media URL.');
  return value;
}

const checkImageUrl = (value) => fileUrl(value, 'tempfile.redpandaai.co', 'png');
export const checkVideoUrl = (value) => fileUrl(value, 'tempfile.aiquickdraw.com', 'mp4');

export function payload(first, tail) {
  requirePilot(first !== tail, 'Frame URLs must differ.');
  return { model: MODEL, input: {
    prompt: PROMPT, image_url: checkImageUrl(first), tail_image_url: checkImageUrl(tail), duration: '10',
  } };
}

const special = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 3],
]) special.addSubnet(network, prefix);

export const isPublicIPv4 = (address) => isIPv4(address) && !special.check(address);

// A fresh HTTPS socket does not replay POSTs or follow redirects. Connect only to
// the public address returned by this lookup, keeping TLS verification on the hostname.
async function httpsOnce(url, init) {
  requirePilot(init.redirect === 'error', 'Request policy rejected.');
  const headers = new Headers(init.headers);
  let body = init.body;
  if (body instanceof FormData) {
    const form = new Request(UPLOAD, { method: 'POST', body });
    headers.set('content-type', form.headers.get('content-type'));
    body = Buffer.from(await form.arrayBuffer());
  }
  if (body !== undefined) headers.set('content-length', String(Buffer.byteLength(body)));
  return new Promise((resolveResponse, reject) => {
    const req = httpsRequest(url, {
      method: init.method ?? 'GET', headers: Object.fromEntries(headers),
      signal: init.signal, agent: false, family: 4, autoSelectFamily: false, rejectUnauthorized: true,
      lookup(host, _options, callback) {
        lookup(host, { family: 4, all: true }, (error, addresses) => {
          if (error || !addresses?.length || !addresses.every(({ address }) => isPublicIPv4(address))) {
            callback(new Error('DNS address rejected.'));
            return;
          }
          callback(null, addresses[0].address, 4);
        });
      },
    }, resolveResponse);
    req.on('error', reject);
    req.end(body);
  });
}

export async function boundedRequest(request, url, init = {}, limit = JSON_LIMIT, timeout = 15_000) {
  const signal = AbortSignal.timeout(timeout);
  const options = { ...init, redirect: 'error', signal };
  try {
    const response = await request(url, options);
    const status = response.status ?? response.statusCode;
    const headers = new Headers(response.headers);
    const stream = response.statusCode === undefined ? response.body : response;
    if (status !== 200 || Number(headers.get('content-length')) > limit || !stream) {
      if (stream?.destroy) stream.destroy();
      else await stream?.cancel();
      throw new Error();
    }
    const chunks = [];
    let size = 0;
    for await (const chunk of stream) {
      size += chunk.byteLength;
      if (size > limit) throw new Error();
      chunks.push(Buffer.from(chunk));
    }
    signal.throwIfAborted();
    return { bytes: Buffer.concat(chunks, size), headers };
  } catch {
    throw new PilotFailure('Provider request rejected or failed.');
  }
}

function parse(bytes, message) {
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new PilotFailure(message);
  }
}

async function fetchSchema(request) {
  const { bytes } = await boundedRequest(request, DOC);
  const markdown = bytes.toString('utf8');
  const requestSchema = /^  \/api\/v1\/jobs\/createTask:\r?\n    post:\r?\n[\s\S]*?^      requestBody:\r?\n([\s\S]*?)(?=^ {0,6}\S|(?![\s\S]))/m.exec(markdown)?.[1];
  const modelBlock = /^ {16}model:\r?\n((?: {17,}[^\n]*\n)+)/m.exec(requestSchema ?? '')?.[1];
  requirePilot(modelBlock?.split(/\r?\n/).some((line) => line.trim() === '- ' + MODEL),
    'Provider schema rejected.');
  return extractInputSchema(requestSchema);
}

function checkSchema(fields, candidate) {
  const keys = Object.keys(candidate.input);
  requirePilot(new Set(fields.map(({ name }) => name)).size === fields.length &&
    fields.every(({ name, required }) => !required || keys.includes(name)), 'Provider schema rejected.');
  for (const [name, value] of Object.entries(candidate.input)) {
    const field = fields.find((item) => item.name === name);
    requirePilot(field?.type === 'string' &&
      (name !== 'duration' || field.enum.includes('10')) &&
      (!field.enum.length || field.enum.includes(value)) &&
      value.length <= Number(field.constraints.maxLength ?? 2500) &&
      value.length >= Number(field.constraints.minLength ?? 0), 'Provider schema rejected.');
  }
}

async function checkPrice(request) {
  const matches = [];
  let total;
  let seen = 0;
  for (let pageNum = 1; pageNum <= MAX_PRICE_PAGES; pageNum++) {
    const { bytes } = await boundedRequest(request, PRICE, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pageNum, pageSize: 100, modelDescription: '', interfaceType: '' }),
    });
    const page = parse(bytes, 'Public price response rejected.');
    const rawTotal = page?.data?.total;
    const pageTotal = typeof rawTotal === 'string' && /^\d{1,4}$/.test(rawTotal) ? Number(rawTotal) : rawTotal;
    const records = page?.data?.records;
    total ??= pageTotal;
    requirePilot(page?.code === 200 && Number.isSafeInteger(total) && total > 0 &&
      total <= MAX_PRICE_PAGES * 100 && total === pageTotal &&
      Array.isArray(records) && records.length === Math.min(100, total - seen), 'Public price pagination rejected.');
    matches.push(...records.filter((row) => row?.anchor === ANCHOR && row?.modelDescription === DESCRIPTION));
    seen += records.length;
    if (seen === total) break;
  }
  const [row] = matches;
  requirePilot(seen === total && matches.length === 1 && row.interfaceType === 'video' &&
    row.provider === 'Kling' && row.creditPrice === '126' && row.creditUnit === 'per video' &&
    row.usdPrice === '0.63' && row.discountPrice === false, 'Exact public price rejected.');
}

export async function validatePublicMetadata(request = httpsOnce) {
  const draft = payload('https://tempfile.redpandaai.co/dry/first.png', 'https://tempfile.redpandaai.co/dry/tail.png');
  const schema = await fetchSchema(request);
  checkSchema(schema, draft);
  await checkPrice(request);
  return { model: MODEL, duration: '10', credits: QUOTED_CREDITS, usd: 0.63 };
}

async function readLocal(dir, name, limit) {
  const handle = await open(join(dir, name), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = await handle.stat();
    requirePilot(stat.isFile() && stat.size > 0 && stat.size <= limit, 'Invalid frame file.');
    const bytes = Buffer.alloc(stat.size + 1);
    const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
    requirePilot(bytesRead === stat.size, 'Invalid frame file size.');
    return bytes.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

export async function checkFrames(dir) {
  try {
    requirePilot(await realpath(dir) === resolve(dir), 'Invalid frame directory.');
    const manifest = parse(await readLocal(dir, 'frames.json', 4096), 'Invalid frame manifest.');
    requirePilot(manifest?.ready === true && Object.keys(manifest).length === 3 &&
      typeof manifest.first === 'string' && typeof manifest.tail === 'string' &&
      /^[a-f0-9]{64}$(?![\s\S])/.test(manifest.first) && /^[a-f0-9]{64}$(?![\s\S])/.test(manifest.tail) &&
      manifest.first !== manifest.tail, 'Local frame manifest is unready or invalid.');
    const frames = [];
    for (const role of ['first', 'tail']) {
      const bytes = await readLocal(dir, role + '.png', PNG_LIMIT);
      requirePilot(bytes.length >= 29 && bytes.subarray(0, 16).equals(PNG) &&
        createHash('sha256').update(bytes).digest('hex') === manifest[role], 'Invalid frame format or hash.');
      frames.push(bytes);
    }
    requirePilot(frames[0].subarray(16, 24).equals(frames[1].subarray(16, 24)) &&
      frames[0].readUInt32BE(16) > 0 && frames[0].readUInt32BE(20) > 0, 'Invalid frame dimensions.');
    return frames;
  } catch (error) {
    if (error instanceof PilotFailure) throw error;
    throw new PilotFailure('Local frame files unavailable.');
  }
}

function providerClient(request, key, existingTask) {
  let expectedPayload;
  let submitted = false;
  let activeTask = existingTask;
  const readOnly = existingTask !== undefined;
  const transport = async (url, init) => {
    const method = init.method ?? 'GET';
    const allowedGet = method === 'GET' && ((!readOnly && url === CREDIT) || (activeTask && url === STATUS + activeTask));
    const allowedCreate = !readOnly && method === 'POST' && url === CREATE && !submitted &&
      expectedPayload && init.body === expectedPayload;
    requirePilot(allowedGet || allowedCreate, 'Authenticated endpoint rejected.');
    if (allowedCreate) submitted = true;
    const { bytes } = await boundedRequest(request, url, init);
    // Validate the documented task identifier before KieClient can coerce or fall back.
    if (allowedCreate) {
      const response = parse(bytes, 'Create response rejected.');
      requirePilot(response?.code === 200 && typeof response.data?.taskId === 'string', 'Create response rejected.');
      taskId(response.data.taskId);
    }
    return new Response(bytes);
  };
  return {
    client: new KieClient(key, undefined, transport),
    setTask(value) { activeTask = taskId(value); },
    setPayload(value) { expectedPayload = JSON.stringify(value); },
  };
}

async function upload(request, key, bytes, name, folder) {
  const body = new FormData();
  body.append('file', new Blob([bytes], { type: 'image/png' }), name);
  body.append('uploadPath', folder);
  body.append('fileName', name);
  const packet = await boundedRequest(request, UPLOAD, {
    method: 'POST', headers: { authorization: 'Bearer ' + key }, body,
  }, JSON_LIMIT, 45_000);
  const response = parse(packet.bytes, 'Upload response rejected.');
  requirePilot(response?.code === 200 && response.success === true, 'Upload response rejected.');
  const url = checkImageUrl(response.data?.downloadUrl);
  requirePilot(!url.includes(key), 'Upload response rejected.');
  return url;
}

// Only idempotent status/download reads enter this retry helper. No create or upload caller.
async function retryRead(read, pause) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await read(); }
    catch {
      if (attempt === 2) throw new PilotFailure('Provider read failed after three attempts.');
      await pause(1000);
    }
  }
}

async function retrieveTask({ id, key, client, request, pause }) {
  for (let poll = 0; poll < 65; poll++) {
    const status = await retryRead(() => client.status('jobs', id), pause);
    requirePilot(status.taskId === id && status.model === MODEL, 'Provider task response rejected.');
    if (status.state === 'success') {
      const charged = status.creditsConsumed;
      requirePilot(charged === undefined || (Number.isSafeInteger(charged) && charged >= 0),
        'Provider billing data rejected.');
      requirePilot(typeof status.resultJson === 'string', 'Provider result rejected.');
      const result = parse(status.resultJson, 'Provider result rejected.');
      requirePilot(Array.isArray(result?.resultUrls) && result.resultUrls.length === 1, 'Provider result rejected.');
      const url = checkVideoUrl(result.resultUrls[0]);
      requirePilot(!url.includes(key), 'Video response rejected.');
      const video = await retryRead(() => boundedRequest(request, url, {}, VIDEO_LIMIT, 60_000), pause);
      requirePilot(video.headers.get('content-type')?.split(';')[0].trim() === 'video/mp4' &&
        video.bytes.length >= 16 && video.bytes.toString('ascii', 4, 8) === 'ftyp', 'Invalid provider video.');
      const summary = { taskId: id, quotedCredits: QUOTED_CREDITS, providerBillingCap: false,
        billingViolation: charged !== undefined && charged > QUOTED_CREDITS };
      if (charged !== undefined) summary.creditsConsumed = charged;
      return { summary, video: video.bytes };
    }
    requirePilot(['waiting', 'queuing', 'generating'].includes(status.state), 'Provider task stopped.');
    if (poll < 64) await pause(10_000);
  }
  throw new PilotFailure('Provider polling limit reached.');
}

export async function runPilot({
  dir = FRAMES, mode, confirmation, attempt, getKey, request = httpsOnce, pause = delay, onSubmitted = () => {}, existingTask, submitOnly = false,
}) {
  if (mode === 'recover-existing-task') {
    const id = taskId(existingTask);
    const key = getKey();
    requirePilot(typeof key === 'string' && /^[A-Za-z0-9_.~-]{1,512}$(?![\s\S])/.test(key), 'Kie credential unavailable.');
    requirePilot(!id.includes(key), 'Recovery task rejected.');
    const { client } = providerClient(request, key, id);
    return retrieveTask({ id, key, client, request, pause });
  }
  requirePilot(mode === 'dry-run' || (mode === 'generate-one' && confirmation === TOKEN && attempt === '1'),
    'Run authorization rejected.');
  const frames = await checkFrames(dir);
  const draft = payload('https://tempfile.redpandaai.co/dry/first.png', 'https://tempfile.redpandaai.co/dry/tail.png');
  const schema = await fetchSchema(request);
  checkSchema(schema, draft);
  await checkPrice(request);
  if (mode === 'dry-run') return { summary: { quotedCredits: QUOTED_CREDITS, providerBillingCap: false } };

  try {
    const key = getKey();
    requirePilot(typeof key === 'string' && /^[A-Za-z0-9_.~-]{1,512}$(?![\s\S])/.test(key), 'Kie credential unavailable.');
    const { client, setTask, setPayload } = providerClient(request, key);
    const credits = await client.credits();
    requirePilot(Number.isFinite(credits) && credits >= QUOTED_CREDITS, 'Insufficient provider credits.');

    const folder = 'serum3-pilot/' + randomUUID();
    const first = await upload(request, key, frames[0], 'first.png', folder);
    const tail = await upload(request, key, frames[1], 'tail.png', folder);
    const createPayload = payload(first, tail);
    checkSchema(schema, createPayload);
    setPayload(createPayload);
    // Recheck after uploads, immediately before the only billable POST. This is NOT a billing reservation.
    await checkPrice(request);
    const id = taskId(await client.create('jobs', MODEL, createPayload.input));
    requirePilot(!id.includes(key), 'Create response rejected.');
    setTask(id);
    try {
      await onSubmitted(id);
    } catch {
      console.warn('Submission metadata write failed; continuing to preserve the provider result.');
    }

    if (submitOnly) return { summary: { taskId: id, state: 'submitted', quotedCredits: QUOTED_CREDITS, providerBillingCap: false } };
    return await retrieveTask({ id, key, client, request, pause });
  } catch (error) {
    if (error instanceof PilotFailure) throw error;
    throw new PilotFailure('Authenticated pilot failed. Submission may have occurred.');
  }
}

async function mediaTool(tool, args, bytes) {
  return new Promise((resolveOutput, reject) => {
    const child = spawn(tool, args, { env: { PATH: process.env.PATH }, stdio: ['pipe', 'pipe', 'ignore'] });
    const chunks = [];
    let size = 0;
    const timer = setTimeout(() => { child.kill('SIGKILL'); }, 30_000);
    const fail = () => { clearTimeout(timer); reject(new PilotFailure('Decoded media validation failed.')); };
    child.on('error', fail);
    child.stdin.on('error', () => {});
    child.stdout.on('data', (chunk) => {
      size += chunk.length;
      if (size > 16_384) child.kill('SIGKILL');
      else chunks.push(chunk);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0 || size > 16_384) fail();
      else resolveOutput(Buffer.concat(chunks));
    });
    child.stdin.end(bytes);
  });
}

export async function validateDecodedMedia(bytes, kind) {
  requirePilot(kind === 'png' || kind === 'video', 'Decoded media type rejected.');
  const progress = (await mediaTool('ffmpeg', ['-v', 'error', '-xerror', '-protocol_whitelist', 'pipe',
    '-i', 'pipe:0', '-map', '0:v:0', '-map', '0:a?', '-progress', 'pipe:1', '-nostats', '-f', 'null', '-'], bytes)).toString('utf8');
  const frameCounts = [...progress.matchAll(/^frame=(\d+)$/gm)];
  const times = [...progress.matchAll(/^out_time_us=(\d+)$/gm)];
  requirePilot(Number(frameCounts.at(-1)?.[1]) > 0 && progress.includes('progress=end'),
    'Decoded media has no complete video frames.');
  if (kind === 'png') requirePilot(bytes.subarray(0, 16).equals(PNG), 'Decoded media format rejected.');
  else requirePilot(Number(times.at(-1)?.[1]) > 0 && Number(times.at(-1)[1]) <= 10_000_000,
    'Decoded media duration exceeds the approved ten seconds.');
}

export function authorizePaidRun(env) {
  requirePilot(env.GITHUB_ACTIONS === 'true' && env.GITHUB_EVENT_NAME === 'workflow_dispatch' &&
    env.GITHUB_RUN_ATTEMPT === '1' && env.SERUM3_CONFIRMATION === TOKEN && env.RUNNER_TEMP &&
    /^\d{1,20}$/.test(env.GITHUB_RUN_ID ?? '') &&
    env.SERUM3_APPROVED_RUN_ID === env.GITHUB_RUN_ID, 'Run authorization rejected.');
}

export function authorizeRecoveryRun(env) {
  const id = taskId(env.SERUM3_RECOVERY_TASK_ID);
  requirePilot(env.GITHUB_ACTIONS === 'true' && env.GITHUB_EVENT_NAME === 'workflow_dispatch' && env.RUNNER_TEMP &&
    /^\d{1,20}$/.test(env.GITHUB_RUN_ID ?? '') && env.SERUM3_APPROVED_RUN_ID === env.GITHUB_RUN_ID &&
    /^\d{1,20}$/.test(env.SERUM3_SOURCE_RUN_ID ?? '') &&
    env.SERUM3_APPROVED_SOURCE_RUN_ID === env.SERUM3_SOURCE_RUN_ID && env.SERUM3_APPROVED_TASK_ID === id,
  'Recovery authorization rejected.');
}

export async function writeTaskReceipt(dir, id, env) {
  taskId(id);
  requirePilot(/^\d{1,20}$/.test(env.GITHUB_RUN_ID ?? '') && /^[a-f0-9]{40}$/.test(env.GITHUB_SHA ?? ''),
    'Receipt context rejected.');
  const receipt = { taskId: id, sourceRunId: env.GITHUB_RUN_ID, sourceSha: env.GITHUB_SHA, model: MODEL,
    duration: '10', quotedCredits: QUOTED_CREDITS, providerBillingCap: false, state: 'submitted' };
  const handle = await open(join(dir, 'task-receipt.json'), 'wx', 0o600);
  try { await handle.writeFile(JSON.stringify(receipt) + '\n'); await handle.sync(); }
  finally { await handle.close(); }
  return receipt;
}

async function main() {
  const [mode, ...extra] = process.argv.slice(2);
  requirePilot(extra.length === 0, 'Run authorization rejected.');
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  const appendSummary = async (line) => {
    console.log(line);
    if (summaryPath) {
      try { await appendFile(summaryPath, line + '\n'); }
      catch { console.warn('Actions summary write failed; result preservation continues.'); }
    }
  };
  requirePilot(['dry-run', 'generate-one', 'recover-existing-task'].includes(mode), 'Run authorization rejected.');
  if (mode === 'recover-existing-task') authorizeRecoveryRun(process.env);
  if (mode === 'generate-one') {
    authorizePaidRun(process.env);
    // Exclusive directory also refuses a second process in the same job.
    await mkdir(join(process.env.RUNNER_TEMP, 'serum3-result'), { mode: 0o700 });
  }
  if (mode === 'recover-existing-task') {
    await mkdir(join(process.env.RUNNER_TEMP, 'serum3-result'), { recursive: true, mode: 0o700 });
  } else {
    const verifiedFrames = await checkFrames(FRAMES);
    for (const frame of verifiedFrames) await validateDecodedMedia(frame, 'png');
  }
  const result = await runPilot({
    mode, confirmation: process.env.SERUM3_CONFIRMATION, attempt: process.env.GITHUB_RUN_ATTEMPT,
    submitOnly: mode === 'generate-one', existingTask: process.env.SERUM3_RECOVERY_TASK_ID,
    getKey() {
      const key = process.env.KIE_API_KEY;
      delete process.env.KIE_API_KEY;
      return key;
    },
    onSubmitted: async (id) => {
      // Persist and fsync locally before any status read; next Actions step publishes this receipt independently.
      try { await writeTaskReceipt(join(process.env.RUNNER_TEMP, 'serum3-result'), id, process.env); }
      finally {
        await appendSummary('Submitted provider task `' + id + '`. Quoted 126 credits / USD0.63; NOT a provider billing ceiling.');
        if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, 'task_id=' + id + '\n');
      }
    },
  });
  if (result.video) {
    const output = join(process.env.RUNNER_TEMP, 'serum3-result');
    await writeFile(join(output, 'unverified.mp4'), result.video, { flag: 'wx', mode: 0o600 });
    result.summary.mediaValidated = false;
    await writeFile(join(output, 'result.json'), JSON.stringify(result.summary) + '\n', { flag: 'w', mode: 0o600 });
    await validateDecodedMedia(result.video, 'video');
    await rename(join(output, 'unverified.mp4'), join(output, 'result.mp4'));
    result.summary.mediaValidated = true;
    await writeFile(join(output, 'result.json'), JSON.stringify(result.summary) + '\n', { flag: 'w', mode: 0o600 });
    const charged = result.summary.creditsConsumed;
    if (charged !== undefined) await appendSummary('Provider-reported credits consumed ' + charged + '.');
    if (result.summary.billingViolation) throw new PilotFailure('Provider-reported charge exceeds quote; paid output preserved for reconciliation.');
  } else if (mode === 'dry-run') {
    await appendSummary('Dry run passed. Quoted ' + QUOTED_CREDITS + ' credits / USD0.63; NOT a provider billing ceiling.');
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main().catch((error) => {
    console.error(error instanceof PilotFailure ? error.message : 'Pilot failed.');
    process.exitCode = 1;
  });
}
