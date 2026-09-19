import { Command } from "commander";
import readline from "node:readline";
import { saveConfig } from "../../core/config.js";
import { getProvider } from "../../core/providers/index.js";
import { emit } from "../output.js";
import { getGlobalFlags } from "../context.js";

async function promptForKey(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question("Введи API-ключ kie.ai: ", (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

export default new Command("setup")
  .option("--key <key>", "API-ключ kie.ai (если не указан, спросит интерактивно)")
  .description("Настроить API-ключ и проверить подключение")
  .action(async function (options: Record<string, unknown>) {
    const flags = getGlobalFlags();

    try {
      let apiKey = options.key as string | undefined;

      if (!apiKey) {
        apiKey = await promptForKey();
      }

      if (!apiKey) {
        throw new Error("API-ключ не может быть пустым");
      }

      // Save key
      await saveConfig({ apiKey });

      emit(flags, { message: "Ключ сохранён" });

      // Test connection
      const provider = await getProvider("kie", apiKey, []);
      const balance = await provider.balance();

      emit(flags, {
        data: balance,
        message: `Подключение успешно. Баланс: ${balance.total} кредитов`,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("401") || error.message.includes("Unauthorized")) {
          throw new Error("API-ключ невалиден. Проверь его и попробуй снова");
        }
      }
      throw error;
    }
  });
