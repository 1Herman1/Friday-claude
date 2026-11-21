import { pathToFileURL } from 'node:url';

const CREDIT_URL = 'https://api.kie.ai/api/v1/chat/credit';
const DOC_URL = 'https://docs.kie.ai/market/kling/v25-turbo-image-to-video-pro.md';
const PRICE_URL = 'https://api.kie.ai/client/v1/model-pricing/page';
const MODEL = 'kling/v2-5-turbo-image-to-video-pro';

// Injected into the existing Nullume client: only this single GET may use the key.
export function balanceTransport(fetchImpl) {
  return async (url, init = {}) => {
    if (String(url) !== CREDIT_URL || (init.method ?? 'GET') !== 'GET' || init.body) {
      throw new Error('Read-only request rejected');
    }
    const response = await fetchImpl(CREDIT_URL, {
      ...init, redirect: 'error', signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error('Balance request failed');
    const text = await response.text();
    if (text.length > 16384) throw new Error('Balance response too large');
    const data = JSON.parse(text);
    if (data.code !== 200 || typeof data.data !== 'number' ||
        !Number.isFinite(data.data) || data.data < 0) throw new Error('Invalid balance');
    // Never forward provider strings/errors; Nullume only sees validated numeric data.
    return new Response(JSON.stringify({code: 200, data: data.data}));
  };
}

export async function checkBalance(key, fetchImpl = globalThis.fetch) {
  if (!key) throw new Error('Missing credential');
  const { KieClient } = await import('../dist/core/providers/kie/client.js');
  const credits = await new KieClient(key, 'https://api.kie.ai', balanceTransport(fetchImpl)).credits();
  if (!Number.isFinite(credits) || credits < 0) throw new Error('Invalid balance');
  return { authenticated: true, balance_credits: credits, generation_requests: 0, uploads: 0 };
}

async function publicRequest(url, init = {}) {
  const response = await fetch(url, {...init, redirect: 'error', signal: AbortSignal.timeout(30000)});
  if (!response.ok) throw new Error('Public metadata unavailable');
  const text = await response.text();
  if (text.length > 2000000) throw new Error('Metadata response too large');
  return text;
}

export async function checkModel() {
  const { extractInputSchema } = await import('../dist/core/providers/kie/schema.js');
  const { normalizeRecord, priceForModel } = await import('../dist/core/providers/kie/pricing.js');
  const fields = extractInputSchema(await publicRequest(DOC_URL));
  const duration = fields.find(f => f.name === 'duration');
  if (!fields.some(f => f.name === 'image_url') || !duration || !duration.enum?.length) {
    throw new Error('Live schema not verified');
  }
  const records = [];
  let seen = 0, total = Infinity;
  for (let pageNum = 1; pageNum <= 20 && seen < total; pageNum++) {
    const payload = JSON.parse(await publicRequest(PRICE_URL, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({pageNum, pageSize: 100, modelDescription: '', interfaceType: ''}),
    }));
    if (payload.code !== 200 || !Array.isArray(payload.data?.records) ||
        !Number.isSafeInteger(Number(payload.data.total)) || Number(payload.data.total) < 0) {
      throw new Error('Invalid pricing response');
    }
    total = Number(payload.data.total);
    const batch = payload.data.records;
    if (!batch.length && seen < total) throw new Error('Incomplete pricing');
    seen += batch.length;
    records.push(...batch.map(normalizeRecord).filter(r => r?.id === MODEL));
  }
  if (seen < total || !records.length) throw new Error('Incomplete or missing pricing');
  const cost = priceForModel(records, MODEL);
  if (!cost || ![cost.creditsMin,cost.creditsMax,cost.usdMin,cost.usdMax].every(n =>
    typeof n === 'number' && Number.isFinite(n) && n >= 0)) throw new Error('Invalid price');
  // Range across provider variants is NOT an exact quote for this scenario.
  return {
    model: MODEL, live_schema: true,
    duration_type_string: duration.type === 'string',
    duration_5_supported: duration.enum.includes('5'),
    duration_10_supported: duration.enum.includes('10'),
    serum3_proposed_12s_supported: duration.enum.includes('12'),
    first_frame_supported: fields.some(f => f.name === 'image_url'),
    tail_frame_supported: fields.some(f => f.name === 'tail_image_url'),
    price_credits_min: cost.creditsMin, price_credits_max: cost.creditsMax,
    price_usd_min: cost.usdMin, price_usd_max: cost.usdMax,
    price_approximate: cost.approximate, exact_scenario_quote: false,
    generation_authorized: false, clean_frame_approved: false,
    generation_requests: 0, uploads: 0,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    let result;
    if (process.argv.length === 3 && process.argv[2] === '--balance') {
      result = await checkBalance(process.env.KIE_API_KEY);
    } else if (process.argv.length === 3 && process.argv[2] === '--model') {
      if (process.env.KIE_API_KEY) throw new Error('Unexpected credential in public step');
      result = await checkModel();
    } else throw new Error('Unsupported mode');
    console.log(JSON.stringify(result));
  } catch {
    // No raw exception/response/headers/env/stack, even when the provider echoes a key.
    console.error('Read-only readiness failed; credential, network or metadata requires review.');
    process.exitCode = 1;
  }
}
