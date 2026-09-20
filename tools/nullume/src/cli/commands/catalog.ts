import { Command } from "commander";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadCatalog } from "../../core/catalog.js";
import { emit } from "../output.js";
import { getGlobalFlags } from "../context.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(dir, "../../..");

const catalogCmd = new Command("catalog").description("Управление каталогом моделей");

catalogCmd
  .command("refresh")
  .description("Обновить каталог моделей")
  .action(async function () {
    const flags = getGlobalFlags();

    try {
      // Run build script
      execSync("npm run build:catalog", { cwd: projectRoot, stdio: "inherit" });
      const models = await loadCatalog();
      emit(flags, {
        data: { count: models.length },
        message: `Каталог обновлён. Моделей: ${models.length}`,
      });
    } catch (error) {
      throw error;
    }
  });

catalogCmd
  .command("audit")
  .option("--json", "JSON-формат вывода")
  .description("Сравнить локальный каталог с живой документацией и прайсом kie.ai")
  .action(async function (options: Record<string, unknown>) {
    const flags = { ...getGlobalFlags(), ...options };

    try {
      const { loadCatalog } = await import("../../core/catalog.js");
      const { fetchLiveCatalog } = await import("../../core/providers/kie/registry.js");
      const { buildModelFromLiveEntry } = await import("../../core/providers/kie/build.js");
      const { fetchPricing } = await import("../../core/providers/kie/pricing.js");
      const { auditCatalog } = await import("../../core/audit.js");

      // Load vendored
      const vendoredModels = await loadCatalog();

      // Fetch live
      const liveEntries = await fetchLiveCatalog();
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
          // Skip on error
        }
      }

      // Fetch pricing
      const pricingRecords = await fetchPricing();

      // Run audit
      const report = auditCatalog(vendoredModels, liveModels, [], pricingRecords);

      if (flags.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log("=== AUDIT REPORT ===\n");
        console.log(`Vendored models: ${report.vendoredCount}`);
        console.log(`Live models: ${report.liveCount}`);
        console.log(`Discrepancies found: ${report.discrepancies.length}\n`);

        if (report.discrepancies.length > 0) {
          console.log("DISCREPANCIES:");
          for (const disc of report.discrepancies) {
            console.log(`\n  ${disc.modelId}: ${disc.type}`);
            console.log(`    ${disc.description}`);
            if (disc.vendored) console.log(`    Vendored: ${disc.vendored}`);
            if (disc.live) console.log(`    Live: ${disc.live}`);
          }
        }

        console.log(`\n\nSUMMARY:`);
        console.log(`  Missing models (removed): ${report.summary.missing}`);
        console.log(`  New models: ${report.summary.new}`);
        console.log(`  Metadata changes: ${report.summary.metaChanged}`);
        console.log(`  Price changes: ${report.summary.priceChanged}`);
      }

      if (report.discrepancies.length > 0) {
        throw new Error(`Audit found ${report.discrepancies.length} discrepancies`);
      }

      emit(flags, { message: "Audit passed" });
    } catch (error) {
      throw error;
    }
  });

export default catalogCmd;
