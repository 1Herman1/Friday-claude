import fs from "node:fs";
import { ConfigError } from "./errors.js";
import { getConfigPath, ensureDir, getDataDir } from "./paths.js";

export interface NullumeConfig {
  apiKey?: string;
  /** Явное согласие на использование импортёров с ограничениями (Pinterest, Dribbble, X) */
  acknowledgedRiskyImporters?: boolean;
  /** Учётные данные для импортёров: importers[importerId][settingKey] = value */
  importers?: Record<string, Record<string, string>>;
  /** Настройки библиотеки вкуса */
  library?: {
    /** Модель для embedding палитр и изображений: 'clip' или 'siglip' */
    embedModel?: 'clip' | 'siglip';
  };
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

  // Atomic write: temp file -> chmod -> rename
  const tmpPath = configPath + ".tmp";
  await fs.promises.writeFile(tmpPath, JSON.stringify(config, null, 2), {
    encoding: "utf-8",
    mode: 0o600,
  });
  await fs.promises.chmod(tmpPath, 0o600);
  await fs.promises.rename(tmpPath, configPath);
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

/**
 * Получить значение из конфига импортёра с fallback на переменную окружения
 * @param config Конфиг nullume
 * @param importerId ID импортёра (например 'pexels')
 * @param key Название поля (например 'token')
 * @param envName Опциональное имя переменной окружения (по умолчанию NULLUME_<IMPORTER>_<KEY> в верхнем регистре)
 * @returns Значение из config/env или undefined
 */
export function getImporterSetting(
  config: NullumeConfig,
  importerId: string,
  key: string,
  envName?: string
): string | undefined {
  // config.importers[importerId][key] первым приоритетом
  if (config.importers?.[importerId]?.[key]) {
    return config.importers[importerId][key];
  }

  // Затем env переменная
  const envKey = envName || `NULLUME_${importerId.toUpperCase()}_${key.toUpperCase()}`;
  return process.env[envKey];
}
