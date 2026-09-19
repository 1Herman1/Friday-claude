import fs from "node:fs";
import { ConfigError } from "./errors.js";
import { getConfigPath, ensureDir, getDataDir } from "./paths.js";

export interface NullumeConfig {
  apiKey?: string;
  [key: string]: unknown;
}

export async function loadConfig(): Promise<NullumeConfig> {
  const configPath = getConfigPath();
  try {
    if (!fs.existsSync(configPath)) return {};
    const content = await fs.promises.readFile(configPath, "utf-8");
    return JSON.parse(content);
  } catch (e) {
    if ((e as any)?.code === "ENOENT") return {};
    throw new ConfigError(`Ошибка чтения конфига: ${(e as Error).message}`);
  }
}

export async function saveConfig(config: NullumeConfig): Promise<void> {
  const configPath = getConfigPath();
  await ensureDir(getDataDir());
  await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2), {
    encoding: "utf-8",
    mode: 0o600,
  });
}

export async function mergeConfig(updates: Partial<NullumeConfig>): Promise<NullumeConfig> {
  const config = await loadConfig();
  const merged = { ...config, ...updates };
  await saveConfig(merged);
  return merged;
}

export async function getApiKey(): Promise<string> {
  // env > config > error
  const key = process.env.KIE_API_KEY;
  if (key) return key;

  const config = await loadConfig();
  if (config.apiKey) return config.apiKey;

  throw new ConfigError(
    "API-ключ kie.ai не задан. Выполни `nullume setup --key YOUR_KEY` или установи переменную KIE_API_KEY."
  );
}
