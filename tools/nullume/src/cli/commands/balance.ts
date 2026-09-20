import { Command } from "commander";
import { getApiKey } from "../../core/config.js";
import { getProviderWithCatalog } from "../provider.js";
import { emit } from "../output.js";
import { getGlobalFlags } from "../context.js";

export default new Command("balance")
  .description("Показать баланс")
  .action(async function () {
    const flags = getGlobalFlags();
    const providerName = process.env.NULLUME_PROVIDER || "kie";
    const apiKey = providerName === "mock" ? "mock" : await getApiKey();
    const provider = await getProviderWithCatalog(providerName, apiKey);
    const balance = await provider.balance();

    emit(flags, { data: balance }, (data: unknown) => {
      const b = data as { total: number; used: number };
      return `Баланс: ${b.total} кредитов (использовано: ${b.used})`;
    });
  });
