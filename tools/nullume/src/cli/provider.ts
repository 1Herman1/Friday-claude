import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Provider, ModelInfo } from "../core/providers/types.js";
import type { PricingRecord } from "../core/providers/kie/pricing.js";
import { getProvider as getCoreProvider } from "../core/providers/index.js";
import { loadCatalog } from "../core/catalog.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(dir, "../..", "data");

interface PricingData {
  verified_at?: string;
  usd_per_credit?: number;
  records: PricingRecord[];
}

export async function loadPricing(): Promise<{ records: PricingRecord[]; usd_per_credit: number }> {
  try {
    const pricingPath = path.join(dataDir, "prices.json");
    if (fs.existsSync(pricingPath)) {
      const data: PricingData = JSON.parse(fs.readFileSync(pricingPath, "utf-8"));
      return {
        records: data.records || [],
        usd_per_credit: data.usd_per_credit || 0.005,
      };
    }
  } catch (e) {
    console.error("Failed to load pricing:", e);
  }

  return { records: [], usd_per_credit: 0.005 };
}

export async function getProviderWithCatalog(
  name: string = "kie",
  apiKey?: string
): Promise<Provider> {
  const models = await loadCatalog();
  const pricing = await loadPricing();

  return getCoreProvider(name, apiKey, models, pricing.records);
}
