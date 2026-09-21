import { RateLimiter, fetchJson, safeFetch, SafeFetchOptions } from "../../core/net.js";
import { getCached, setCached } from "../../core/cache.js";
import { RefCandidateSchema } from "./types.js";

/**
 * Элемент RSS ленты
 */
export interface RssItem {
  title?: string;
  link?: string;
  pubDate?: string;
  description?: string;
  enclosureUrl?: string;
}

/**
 * Опции для importerFetchJson
 */
export interface ImporterFetchJsonOptions {
  /** Реализация fetch для тестирования */
  fetchImpl?: typeof fetch;
  /** Rate limiter для ограничения количества запросов */
  limiter?: RateLimiter;
  /** Ключ кэша (если не задан, кэширование отключено) */
  cacheKey?: string;
  /** TTL кэша в миллисекундах (по умолчанию 24 часа) */
  ttlMs?: number;
  /** Дополнительные заголовки */
  headers?: Record<string, string>;
  /** AbortSignal для отмены */
  signal?: AbortSignal;
}

/**
 * Загрузить и распарсить JSON с кэшированием и rate limiting
 * @param url URL для запроса
 * @param options Опции запроса
 * @returns Распарсенный JSON
 */
export async function importerFetchJson<T = unknown>(
  url: string,
  options: ImporterFetchJsonOptions = {}
): Promise<T> {
  const { fetchImpl, limiter, cacheKey, ttlMs = 24 * 60 * 60 * 1000, headers, signal } = options;

  // Проверить кэш
  if (cacheKey) {
    const cached = await getCached<T>(cacheKey, ttlMs);
    if (cached !== null) {
      return cached;
    }
  }

  // Rate limiting
  if (limiter) {
    await limiter.acquire();
  }

  // Запрос с signal
  const data = await fetchJson<T>(url, { fetchImpl, headers, signal });

  // Сохранить в кэш
  if (cacheKey) {
    await setCached(cacheKey, data);
  }

  return data;
}

/**
 * Опции для importerFetchText
 */
export interface ImporterFetchTextOptions {
  /** Реализация fetch для тестирования */
  fetchImpl?: typeof fetch;
  /** Rate limiter для ограничения количества запросов */
  limiter?: RateLimiter;
  /** Ключ кэша (если не задан, кэширование отключено) */
  cacheKey?: string;
  /** TTL кэша в миллисекундах (по умолчанию 24 часа) */
  ttlMs?: number;
  /** Дополнительные заголовки */
  headers?: Record<string, string>;
  /** AbortSignal для отмены */
  signal?: AbortSignal;
}

/**
 * Загрузить текст (RSS, HTML) с кэшированием и rate limiting
 * @param url URL для запроса
 * @param options Опции запроса
 * @returns Текст ответа
 */
export async function importerFetchText(
  url: string,
  options: ImporterFetchTextOptions = {}
): Promise<string> {
  const { fetchImpl, limiter, cacheKey, ttlMs = 24 * 60 * 60 * 1000, headers, signal } = options;

  // Проверить кэш
  if (cacheKey) {
    const cached = await getCached<string>(cacheKey, ttlMs);
    if (cached !== null) {
      return cached;
    }
  }

  // Rate limiting
  if (limiter) {
    await limiter.acquire();
  }

  // Запрос через safeFetch (https-only, лимит 5 МБ, таймаут 30 с)
  const resp = await safeFetch(url, {
    headers,
    maxBytes: 5 * 1024 * 1024,
    timeoutMs: 30000,
    fetchImpl,
    signal,
  });

  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} при загрузке ${url}`);
  }

  const text = await resp.text();

  // Сохранить в кэш
  if (cacheKey) {
    await setCached(cacheKey, text);
  }

  return text;
}

/**
 * Распарсить RSS/Atom ленту и вернуть элементы
 * Парсер работает через regex без DOM-зависимостей
 * @param xml Текст RSS/Atom
 * @returns Массив элементов
 */
export function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = [];

  // Найти все <item> теги
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let itemMatch;

  while ((itemMatch = itemRegex.exec(xml)) !== null) {
    const itemContent = itemMatch[1];
    const item: RssItem = {};

    // Извлечь title
    const titleMatch = /<title[^>]*>([^<]*)<\/title>/i.exec(itemContent);
    if (titleMatch) item.title = titleMatch[1].trim();

    // Извлечь link
    const linkMatch = /<link[^>]*>([^<]*)<\/link>/i.exec(itemContent);
    if (linkMatch) item.link = linkMatch[1].trim();

    // Извлечь pubDate
    const pubDateMatch = /<pubDate[^>]*>([^<]*)<\/pubDate>/i.exec(itemContent);
    if (pubDateMatch) item.pubDate = pubDateMatch[1].trim();

    // Извлечь description (обычная)
    const descMatch = /<description[^>]*>([^<]*)<\/description>/i.exec(itemContent);
    if (descMatch) item.description = descMatch[1].trim();

    // Извлечь content:encoded (приоритет над description, включая CDATA)
    const contentRegex = /<content:encoded[^>]*>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([^<]*?))<\/content:encoded>/i;
    const contentMatch = contentRegex.exec(itemContent);
    if (contentMatch) {
      // CDATA в группе 1, обычный текст в группе 2
      item.description = (contentMatch[1] || contentMatch[2] || "").trim();
    }

    // Извлечь enclosure URL
    const enclosureMatch = /<enclosure[^>]*url=["']([^"']*)/i.exec(itemContent);
    if (enclosureMatch) item.enclosureUrl = enclosureMatch[1].trim();

    items.push(item);
  }

  return items;
}

/**
 * Извлечь все HTTPS URLs из HTML
 * @param html Текст HTML
 * @returns Массив https:// URLs
 */
export function extractImgSrcs(html: string): string[] {
  const srcs = new Set<string>();

  // Найти все src="..." в img, video, source тегах
  const srcRegex = /src=["'](https:\/\/[^"']*)/gi;
  let match;

  while ((match = srcRegex.exec(html)) !== null) {
    const url = match[1].trim();
    if (url.startsWith("https://")) {
      srcs.add(url);
    }
  }

  return Array.from(srcs);
}

/**
 * Ждать указанное время в миллисекундах
 * @param ms Миллисекунды
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Валидировать кандидата через RefCandidateSchema и логировать ошибки
 * @param candidate Кандидат для валидации
 * @param log Функция логирования
 * @returns Валидный кандидат или null если ошибка
 */
export function yieldValid(candidate: unknown, log: (msg: string) => void) {
  try {
    return RefCandidateSchema.parse(candidate);
  } catch (e) {
    log(`Невалидный кандидат: ${(e as any).message}`);
    return null;
  }
}
