import { Command } from "commander";
import { getApiKey } from "../../core/config.js";
import { getProvider } from "../../core/providers/index.js";
import { emit } from "../output.js";
import { getGlobalFlags } from "../context.js";

export default new Command("upload")
  .argument("<file>", "Путь к файлу")
  .description("Загрузить файл на сервер kie.ai")
  .action(async function (file: string) {
    const flags = getGlobalFlags();

    try {
      const apiKey = process.env.NULLUME_PROVIDER === "mock" ? "mock" : await getApiKey();
      const provider = await getProvider(process.env.NULLUME_PROVIDER || "kie", apiKey);

      const url = await provider.upload(file);

      emit(flags, { data: { url }, message: `URL: ${url}` });
    } catch (error) {
      throw error;
    }
  });
