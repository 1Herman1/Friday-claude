import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { ConfigError } from "../core/errors.js";
import { getSessionsDir, ensureDir } from "../core/paths.js";

/**
 * Схема для файла сессии
 * Хранит учётные данные: cookies для Pinterest/X или токен для Dribbble
 */
export const SessionFileSchema = z.object({
  /** Cookies в формате "name=value; name2=value2" или Netscape cookies.txt */
  cookies: z.record(z.string(), z.string()).optional(),
  /** API токен (для Dribbble, X и т.д.) */
  token: z.string().optional(),
  /** ISO 8601 дата создания сессии */
  createdAt: z.string().datetime(),
  /** Опциональная заметка: версия API, истечение и т.д. */
  note: z.string().optional(),
});

export type SessionFile = z.infer<typeof SessionFileSchema>;

/**
 * Прочитать сессию из ~/.nullume/sessions/<id>.json
 * Проверяет права доступа: файл должен быть 0600 (не более)
 *
 * @param id ID сессии (например 'pinterest', 'dribbble', 'x')
 * @returns Распарсенная сессия или выброс ConfigError
 */
export async function readSession(id: string): Promise<SessionFile> {
  const sessDir = getSessionsDir();
  const filePath = path.join(sessDir, `${id}.json`);

  // Проверить существование
  if (!fs.existsSync(filePath)) {
    throw new ConfigError(`Сессия не найдена: ${filePath}`);
  }

  // Проверить права доступа: недопустимо чтобы группа или другие могли читать
  const stat = await fs.promises.stat(filePath);
  const otherBits = stat.mode & 0o077; // маска для группы и других
  if (otherBits !== 0) {
    throw new ConfigError(
      `Сессия ${id} имеет небезопасные права доступа ${(stat.mode & 0o777)
        .toString(8)
        .padStart(3, "0")} (требуется 600). Выполните: chmod 600 ${filePath}`
    );
  }

  // Прочитать и распарсить JSON
  const content = await fs.promises.readFile(filePath, "utf-8");
  const data = JSON.parse(content);

  // Валидировать по схеме
  const validated = SessionFileSchema.parse(data);
  return validated;
}

/**
 * Записать сессию в ~/.nullume/sessions/<id>.json
 * Атомарная запись с временными файлами и правами 0600
 *
 * @param id ID сессии
 * @param data Данные сессии
 */
export async function writeSession(id: string, data: SessionFile): Promise<void> {
  const sessDir = getSessionsDir();
  await ensureDir(sessDir);

  // Валидировать по схеме
  const validated = SessionFileSchema.parse(data);

  const filePath = path.join(sessDir, `${id}.json`);
  const tmpPath = `${filePath}.tmp`;

  // Атомарная запись: tmp → chmod → rename
  const content = JSON.stringify(validated, null, 2);
  await fs.promises.writeFile(tmpPath, content, { encoding: "utf-8", mode: 0o600 });
  await fs.promises.chmod(tmpPath, 0o600);
  await fs.promises.rename(tmpPath, filePath);
}

/**
 * Распарсить cookies из текстового формата
 * Поддерживает два формата:
 * 1. Netscape cookies.txt: "#HttpOnly_<domain> <flag> <path> <secure> <expiry> <name> <value>"
 * 2. Простой формат: "name=value; name2=value2"
 *
 * @param text Текст cookies
 * @returns Record<string, string> {name: value, ...}
 */
export function parseCookieFile(text: string): Record<string, string> {
  const cookies: Record<string, string> = {};

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("# "));

  // Определить формат: если есть хотя бы одна строка с 7 полями разделённых табом - Netscape
  const hasNetscapeFormat = lines.some((line) => {
    const parts = line.split(/\t+/);
    return parts.length >= 7;
  });

  if (hasNetscapeFormat) {
    // Netscape cookies.txt формат
    for (const line of lines) {
      const parts = line.split(/\t+/);
      if (parts.length >= 7) {
        // domain, flag, path, secure, expiry, name, value
        const name = parts[5];
        const value = parts[6];
        if (name && value) {
          cookies[name] = value;
        }
      }
    }
  } else {
    // Простой формат: "name=value; name2=value2"
    for (const line of lines) {
      const pairs = line.split(";").map((p) => p.trim());
      for (const pair of pairs) {
        const [name, value] = pair.split("=", 2);
        if (name && value) {
          cookies[name.trim()] = value.trim();
        }
      }
    }
  }

  return cookies;
}

/**
 * Редактировать сессию для безопасного логирования
 * Заменить значения cookies и токена на ***
 *
 * @param session Сессия
 * @returns Копия с редактированными чувствительными данными
 */
export function redactSession(session: SessionFile): Partial<SessionFile> {
  const redacted: Partial<SessionFile> = {
    createdAt: session.createdAt,
    note: session.note,
  };

  if (session.cookies) {
    const redactedCookies: Record<string, string> = {};
    for (const name of Object.keys(session.cookies)) {
      redactedCookies[name] = "***";
    }
    redacted.cookies = redactedCookies;
  }

  if (session.token) {
    redacted.token = "***";
  }

  return redacted;
}
