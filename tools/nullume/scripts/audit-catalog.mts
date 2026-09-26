import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchLiveCatalogDetailed } from "../src/core/providers/kie/registry.js";
import { buildModelFromLiveEntry } from "../src/core/providers/kie/build.js";
import { fetchPricing, priceForModel } from "../src/core/providers/kie/pricing.js";
import { auditCatalog } from "../src/core/audit.js";
import { loadCatalog } from "../src/core/catalog.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(dir, "..", "data");

async function auditCatalogCommand() {
  console.log("Auditing catalog...\n");

  try {
    // Load vendored catalog
    console.log("Loading vendored catalog...");
    const vendoredModels = await loadCatalog();
    console.log(`Loaded ${vendoredModels.length} vendored models`);

    // Fetch live catalog
    console.log("Fetching live catalog from docs.kie.ai...");
    const { entries: liveEntries, unread } = await fetchLiveCatalogDetailed();
    console.log(`Found ${liveEntries.length} live models`);
    if (unread.length > 0) {
      console.log(`Unread pages: ${unread.length}`);
    }

    // Build live models with schemas
    console.log("Building live model schemas...");
    const liveModels = [];
    for (const entry of liveEntries) {
      try {
        const model = await buildModelFromLiveEntry(
          entry.id,
          entry.category,
          entry.description,
          entry.docUrl
        );
        liveModels.push(model);
      } catch (e) {
        console.warn(`Failed to build model ${entry.id}:`, (e as Error).message);
      }
    }
    console.log(`Built ${liveModels.length} live models\n`);

    // Fetch pricing
    console.log("Fetching pricing...");
    const pricingRecords = await fetchPricing();
    console.log(`Found ${pricingRecords.length} pricing records\n`);

    // Load vendored prices
    const vendoredPrices = [];
    const pricesPath = path.join(dataDir, "prices.json");
    if (fs.existsSync(pricesPath)) {
      try {
        const pricesData = JSON.parse(fs.readFileSync(pricesPath, "utf-8"));
        vendoredPrices.push(...(pricesData.records || []));
      } catch (e) {
        console.warn("Failed to load vendored prices");
      }
    }

    const report = auditCatalog(vendoredModels, liveModels, vendoredPrices, pricingRecords, unread);
    const filteredDiscrepancies = report.discrepancies;
    const filteredSummary = report.summary;

    // Print report
    console.log("=== AUDIT REPORT ===\n");
    console.log(`Vendored models: ${report.vendoredCount}`);
    console.log(`Live models: ${report.liveCount}`);
    console.log(`Discrepancies found: ${filteredDiscrepancies.length}\n`);

    if (filteredDiscrepancies.length > 0) {
      console.log("DISCREPANCIES:");
      for (const disc of filteredDiscrepancies) {
        console.log(`\n  ${disc.modelId}: ${disc.type}`);
        console.log(`    ${disc.description}`);
        if (disc.vendored) console.log(`    Vendored: ${disc.vendored}`);
        if (disc.live) console.log(`    Live: ${disc.live}`);
      }
    }

    console.log(`\n\nSUMMARY:`);
    console.log(`  Missing models (removed): ${filteredSummary.missing}`);
    console.log(`  New models: ${filteredSummary.new}`);
    console.log(`  Metadata changes: ${filteredSummary.metaChanged}`);
    console.log(`  Price changes: ${filteredSummary.priceChanged}`);

    if (unread.length > 0) {
      console.log(`\n\nНЕ ПРОЧИТАНО: ${unread.length} страниц (проверка по ним не проводилась)`);
      for (const url of unread.slice(0, 5)) {
        console.log(`  ${url}`);
      }
      if (unread.length > 5) {
        console.log(`  … и ещё ${unread.length - 5}`);
      }
    }

    if (filteredDiscrepancies.length > 0) {
      process.exit(1);
    }
  } catch (e) {
    console.error("Error auditing catalog:", e);
    process.exit(1);
  }
}

auditCatalogCommand();
