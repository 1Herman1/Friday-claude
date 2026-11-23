// Extracted from reviewed serum3 transport; endpoint/method policy is in the fixed adapter.
import {spawn} from 'node:child_process';
import {lookup} from 'node:dns';
import {request as httpsRequest} from 'node:https';
import {BlockList,isIPv4} from 'node:net';
const UPLOAD='https://kieai.redpandaai.co/api/file-stream-upload';
const JSON_LIMIT=1024*1024;
class PilotFailure extends Error {}
function requirePilot(v,m){if(!v)throw new PilotFailure(m);}
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
export async function httpsOnce(url, init) {
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
  requirePilot(kind === 'image' || kind === 'video', 'Decoded media type rejected.');
  const progress = (await mediaTool('ffmpeg', ['-v', 'error', '-xerror', '-protocol_whitelist', 'pipe',
    '-i', 'pipe:0', '-map', '0:v:0', '-map', '0:a?', '-progress', 'pipe:1', '-nostats', '-f', 'null', '-'], bytes)).toString('utf8');
  const frameCounts = [...progress.matchAll(/^frame=(\d+)$/gm)];
  const times = [...progress.matchAll(/^out_time_us=(\d+)$/gm)];
  requirePilot(Number(frameCounts.at(-1)?.[1]) > 0 && progress.includes('progress=end'),
    'Decoded media has no complete video frames.');
  if (kind === 'video') requirePilot(Number(times.at(-1)?.[1]) > 0 && Number(times.at(-1)[1]) <= 10_000_000,
    'Decoded media duration exceeds the approved ten seconds.');
}


// Case-specific full decode + stream measurements, with child PATH only (no secrets).
export function validateWanProbe(p,kind) {
 requirePilot(['source','reference','result'].includes(kind),'Invalid media role.');
 requirePilot(Array.isArray(p.streams)&&p.streams.length===1,'Exactly one silent video stream required.');
 const v=p.streams[0];requirePilot(v.codec_type==='video','Video stream required.');
 if(kind==='reference') {
  requirePilot(v.codec_name==='png'&&v.width===432&&v.height===736&&v.pix_fmt==='rgb24'&&Number(v.nb_read_frames)===1,'Fixed RGB reference mismatch.');return;
 }
 const rate=x=>{const [a,b]=String(x).split('/').map(Number);return a/b;};
 const fps=rate(v.avg_frame_rate),frames=Number(v.nb_read_frames);
 requirePilot(Number.isFinite(fps)&&fps>=1&&fps<=60&&rate(v.r_frame_rate)===fps&&Number.isInteger(frames)&&frames===2*fps,'Frame timing mismatch.');
 requirePilot(Number(v.duration??p.format?.duration)===2&&Number(p.format?.duration)===2,'Exactly two seconds required.');
 if(kind==='source') requirePilot(v.codec_name==='h264'&&v.width===432&&v.height===736&&fps===24&&frames===48&&v.pix_fmt==='yuv420p','Fixed crop mismatch.');
 else requirePilot(Math.min(v.width,v.height)===720&&Math.abs(v.width/v.height-432/736)<=0.02,'720p result geometry mismatch; preserve original and inspect.');
}
export async function validateWanMedia(bytes,kind) {
 const out=await mediaTool('ffprobe',['-v','error','-protocol_whitelist','pipe','-i','pipe:0','-count_frames','-show_streams','-show_format','-of','json'],bytes);
 let p;try{p=JSON.parse(out.toString());}catch{throw new PilotFailure('Invalid media metadata.');}
 validateWanProbe(p,kind);await validateDecodedMedia(bytes,kind==='reference'?'image':'video');return p;
}
