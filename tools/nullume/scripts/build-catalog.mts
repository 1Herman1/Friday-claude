import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchLiveCatalog } from "../src/core/providers/kie/registry.js";
import { extractInputSchema, deriveModelMeta } from "../src/core/providers/kie/schema.js";
import { fetchPricing, priceForModel } from "../src/core/providers/kie/pricing.js";
import { seedModelInfo, SEED_MODELS } from "../src/core/providers/kie/models.js";
import type { ModelInfo } from "../src/core/providers/types.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(dir, "..", "data");

async function buildCatalog() {
  console.log("Building catalog...");

  try {
    // Fetch live catalog
    console.log("Fetching live catalog from docs.kie.ai...");
    const liveEntries = await fetchLiveCatalog();
    console.log(`Found ${liveEntries.length} live models`);

    // Fetch pricing
    console.log("Fetching pricing...");
    const pricingRecords = await fetchPricing();
    console.log(`Found ${pricingRecords.length} pricing records`);

    // Build model map
    const models = new Map<string, ModelInfo>();

    // Add live entries
    for (const entry of liveEntries) {
      let schemaSource = "docs";
      const fields = await fetchAndParseSchema(entry.docUrl);

      models.set(entry.id, {
        id: entry.id,
        category: entry.category as any,
        api: "jobs",
        docUrl: entry.docUrl,
        fields,
        meta: deriveModelMeta(
          Object.entries(fields).map(([name, spec]) => ({
            name,
            type: spec.type,
            required: false,
            description: spec.description,
            enum: [],
            default: null,
            constraints: {},
          }))
        ),
        description: entry.description,
        price: priceForModel(pricingRecords, entry.id) || undefined,
        schemaSource: schemaSource as any,
        stale: false,
        source: "live",
      });
    }

    // Add seed models
    for (const [id, seedEntry] of Object.entries(SEED_MODELS)) {
      const existing = models.get(id);
      const seedInfo = seedModelInfo(id, seedEntry);
      seedInfo.price = priceForModel(pricingRecords, id) || undefined;

      if (existing) {
        // Merge: keep live data, override with seed metadata
        models.set(id, {
          ...existing,
          meta: seedInfo.meta,
          schemaSource: "seed",
          stale: false,
        });
      } else {
        models.set(id, seedInfo);
      }
    }

    // Write models.json
    fs.mkdirSync(dataDir, { recursive: true });
    const modelsJson = {
      built_at: new Date().toISOString(),
      source: "vendored",
      models: Array.from(models.values()),
    };

    fs.writeFileSync(
      path.join(dataDir, "models.json"),
      JSON.stringify(modelsJson, null, 2)
    );

    console.log(`Wrote ${models.size} models to data/models.json`);

    // Write prices.json
    const pricesJson = {
      verified_at: new Date().toISOString(),
      usd_per_credit: 0.005,
      records: pricingRecords,
    };

    fs.writeFileSync(
      path.join(dataDir, "prices.json"),
      JSON.stringify(pricesJson, null, 2)
    );

    console.log(`Wrote ${pricingRecords.length} pricing records to data/prices.json`);
  } catch (e) {
    console.error("Error building catalog:", e);
    process.exit(1);
  }
}

async function fetchAndParseSchema(docUrl: string) {
  try {
    const markdown = await fetch(docUrl).then((r) => r.text());
    const fields = extractInputSchema(markdown);
    const fieldsMap: Record<string, any> = {};

    for (const field of fields) {
      fieldsMap[field.name] = {
        type: field.type,
        required: field.required,
        description: field.description,
        enum: field.enum,
        default: field.default,
      };
    }

    return fieldsMap;
  } catch (e) {
    // console.warn(`Failed to fetch schema for ${docUrl}:`, e);
    return {};
  }
}

buildCatalog();
