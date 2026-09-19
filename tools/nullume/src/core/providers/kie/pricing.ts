import type { PriceInfo, CostEstimate, CostSource } from "../types.js";

export const USD_PER_CREDIT = 0.005;
export const PRICING_URL = "https://api.kie.ai/client/v1/model-pricing/page";

export interface PricingRecord {
  id: string | null;
  category: string;
  description: string;
  creditsMin: number;
  creditsMax: number;
  usdMin: number;
  usdMax: number;
  unit: string;
  provider: string;
  approximate: boolean;
}

export function extractModelId(anchor: string | null | undefined): string | null {
  if (!anchor) return null;
  const match = /[?&]model=([^&]+)/.exec(String(anchor));
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export interface RawPricingRecord {
  anchor?: string;
  interfaceType?: string;
  creditPrice?: number | string;
  usdPrice?: number | string;
  creditUnit?: string;
  modelDescription?: string;
  provider?: string;
}

export function normalizeRecord(raw: RawPricingRecord): PricingRecord | null {
  const categoryMap: Record<string, string> = {
    image: "image",
    video: "video",
    music: "audio",
  };

  const category = categoryMap[String(raw.interfaceType || "").toLowerCase()];
  if (!category) return null;

  const credits = Number(raw.creditPrice);
  if (!Number.isFinite(credits)) return null;

  const usdRaw = Number(raw.usdPrice);
  const usd =
    raw.usdPrice !== undefined &&
    raw.usdPrice !== null &&
    raw.usdPrice !== "" &&
    Number.isFinite(usdRaw)
      ? usdRaw
      : credits * USD_PER_CREDIT;

  return {
    id: extractModelId(raw.anchor),
    category,
    creditsMin: credits,
    creditsMax: credits,
    usdMin: usd,
    usdMax: usd,
    description: String(raw.modelDescription || ""),
    unit: String(raw.creditUnit || ""),
    provider: String(raw.provider || ""),
    approximate: !raw.usdPrice,
  };
}

export async function fetchPricingPage(
  pageNum: number,
  pageSize: number = 100,
  timeoutMs: number = 30000
): Promise<any> {
  const resp = await fetch(PRICING_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pageNum, pageSize, modelDescription: "", interfaceType: "" }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

  const body = (await resp.json()) as any;
  if (body.code !== 200 || !body.data) {
    throw new Error(`Pricing API error: ${body.msg || `code ${body.code}`}`);
  }

  return body.data;
}

export async function fetchPricing(): Promise<PricingRecord[]> {
  const records: PricingRecord[] = [];
  let pageNum = 1;

  for (;;) {
    const data = await fetchPricingPage(pageNum, 100);
    const batch = Array.isArray(data.records) ? data.records : [];

    for (const raw of batch) {
      const record = normalizeRecord(raw);
      if (record) records.push(record);
    }

    const total = Number(data.total) || 0;
    if (batch.length === 0 || records.length >= total) break;
    pageNum += 1;
  }

  return records;
}

export function priceForModel(records: PricingRecord[], modelId: string): PriceInfo | null {
  const matching = records.filter((r) => r.id === modelId);
  if (matching.length === 0) return null;

  let minCredit = Infinity;
  let maxCredit = -Infinity;
  let minUsd = Infinity;
  let maxUsd = -Infinity;
  let isApproximate = false;

  for (const r of matching) {
    minCredit = Math.min(minCredit, r.creditsMin);
    maxCredit = Math.max(maxCredit, r.creditsMax);
    minUsd = Math.min(minUsd, r.usdMin);
    maxUsd = Math.max(maxUsd, r.usdMax);
    if (r.approximate) isApproximate = true;
  }

  return {
    creditsMin: minCredit,
    creditsMax: maxCredit,
    usdMin: minUsd,
    usdMax: maxUsd,
    approximate: isApproximate,
  };
}
