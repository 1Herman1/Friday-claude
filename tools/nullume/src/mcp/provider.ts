import { getProvider } from "../core/providers/index.js";
import { getApiKey } from "../core/config.js";
import { loadCatalog } from "../core/catalog.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(dir, "../..", "data");

interface PricingData {
  verified_at?: string;
  usd_per_credit?: number;
  records: any[];
}

let cachedProvider: any = null;
let cachedUsdPerCredit: number = 0.005;

export async function getProviderInstance() {
  if (cachedProvider) return cachedProvider;

  const providerName = process.env.NULLUME_PROVIDER || "kie";

  if (providerName === "mock") {
    const provider = await getProvider("mock");
    cachedProvider = provider;
    return provider;
  }

  const apiKey = await getApiKey();
  const models = await loadCatalog();

  let pricing: any[] = [];
  try {
    const pricingPath = path.join(dataDir, "prices.json");
    const content = await fs.promises.readFile(pricingPath, "utf-8");
    const data: PricingData = JSON.parse(content);
    pricing = data.records || [];
    cachedUsdPerCredit = data.usd_per_credit ?? 0.005;
  } catch (e) {
    // Ignore pricing load errors, use defaults
  }

  const provider = await getProvider("kie", apiKey, models, pricing);
  cachedProvider = provider;
  return provider;
}

export async function getMockProvider() {
  const models = await loadCatalog();
  return getProvider("mock", undefined, models);
}

export function getUsdPerCredit(): number {
  return cachedUsdPerCredit;
}
