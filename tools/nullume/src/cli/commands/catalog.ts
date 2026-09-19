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
  .description("Аудит полноты локального каталога (required, поле промпта, цена)")
  .action(async function () {
    const flags = getGlobalFlags();

    try {
      execSync("npm run audit:catalog", { cwd: projectRoot, stdio: "inherit" });
      emit(flags, { message: "Аудит пройден" });
    } catch (error) {
      throw error;
    }
  });

export default catalogCmd;
