import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchLiveCatalogDetailed } from "../src/core/providers/kie/registry.js";
import { buildModelFromLiveEntry, sanitizeDescription } from "../src/core/providers/kie/build.js";
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
    const { entries: liveEntries, unread } = await fetchLiveCatalogDetailed();
    console.log(`Found ${liveEntries.length} live models`);
    if (unread.length > 0) {
      console.log(`Unread pages: ${unread.length}`);
    }

    // Fetch pricing
    console.log("Fetching pricing...");
    const pricingRecords = await fetchPricing();
    console.log(`Found ${pricingRecords.length} pricing records`);

    // Load vendored models for unread page preservation
    const unreadSet = new Set(unread);
    const oldModels = new Map<string, ModelInfo>();
    const modelsJsonPath = path.join(dataDir, "models.json");
    if (fs.existsSync(modelsJsonPath)) {
      try {
        const oldData = JSON.parse(fs.readFileSync(modelsJsonPath, "utf-8"));
        if (Array.isArray(oldData.models)) {
          for (const model of oldData.models) {
            if (model.docUrl) {
              oldModels.set(model.id, model);
            }
          }
        }
      } catch (e) {
        console.warn("Failed to load old models.json, starting fresh");
      }
    }

    // Build model map
    const models = new Map<string, ModelInfo>();

    // Add live entries
    for (const entry of liveEntries) {
      const model = await buildModelFromLiveEntry(
        entry.id,
        entry.category,
        entry.description,
        entry.docUrl
      );
      model.price = priceForModel(pricingRecords, entry.id) || undefined;
      models.set(entry.id, model);
    }

    // Preserve models with unread docUrls from old catalog
    let preservedCount = 0;
    for (const [id, oldModel] of oldModels) {
      if (oldModel.docUrl && unreadSet.has(oldModel.docUrl) && !models.has(id)) {
        models.set(id, oldModel);
        preservedCount++;
      }
    }

    // Seed-модели: живая документация точнее выдуманных id, поэтому живую
    // запись seed не перекрывает. Добавляем только семейства со своим
    // API (veo, suno, gpt4o…) — их в market-каталоге нет, а id у них
    // проверены клиентом.
    for (const [id, seedEntry] of Object.entries(SEED_MODELS)) {
      if (models.has(id) || seedEntry.api === "jobs") continue;
      const seedInfo = seedModelInfo(id, seedEntry);
      seedInfo.price = priceForModel(pricingRecords, id) || undefined;
      models.set(id, seedInfo);
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

    // Report on unread pages
    if (unread.length > 0) {
      console.log(
        `\nНе прочитано страниц: ${unread.length} — прежние записи сохранены (моделей сохранено: ${preservedCount})`
      );
      for (const url of unread.slice(0, 5)) {
        console.log(`  ${url}`);
      }
      if (unread.length > 5) {
        console.log(`  … и ещё ${unread.length - 5}`);
      }
    }
  } catch (e) {
    console.error("Error building catalog:", e);
    process.exit(1);
  }
}

buildCatalog();
