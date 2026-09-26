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
  /** Разрешить loopback адреса (localhost, 127.0.0.1, ::1) */
  allowLoopback?: boolean;
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
  const { fetchImpl, limiter, cacheKey, ttlMs = 24 * 60 * 60 * 1000, headers, signal, allowLoopback = false } = options;

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

  // Для loopback запросов используем safeFetch, иначе fetchJson
  let data: T;
  if (allowLoopback) {
    const resp = await safeFetch(url, {
      headers,
      fetchImpl,
      signal,
      allowLoopback,
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`HTTP ${resp.status}: ${text.slice(0, 200)}`);
    }

    data = (await resp.json()) as T;
  } else {
    data = await fetchJson<T>(url, { fetchImpl, headers, signal });
  }

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
/** Текст тега с распаковкой CDATA: половина лент оборачивает в него всё. */
function tagText(xml: string, tag: string): string | undefined {
  const re = new RegExp(
    `<${tag}(?:\\s[^>]*)?>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))</${tag}>`,
    "i"
  );
  const m = re.exec(xml);
  if (!m) return undefined;
  const value = (m[1] ?? m[2] ?? "").trim();
  return value || undefined;
}

export function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = [];

  // RSS 2.0: <item>
  const itemRegex = /<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi;
  let itemMatch;

  while ((itemMatch = itemRegex.exec(xml)) !== null) {
    const c = itemMatch[1];
    const item: RssItem = {};

    item.title = tagText(c, "title");
    item.link = tagText(c, "link");
    item.pubDate = tagText(c, "pubDate");
    // content:encoded точнее description, поэтому идёт вторым и перекрывает
    item.description = tagText(c, "content:encoded") ?? tagText(c, "description");

    // enclosure и media:content несут одно и то же: прямой адрес медиа
    const mediaMatch =
      /<enclosure[^>]*url=["']([^"']*)/i.exec(c) ?? /<media:content[^>]*url=["']([^"']*)/i.exec(c);
    if (mediaMatch) item.enclosureUrl = mediaMatch[1].trim();

    items.push(item);
  }

  if (items.length > 0) return items;

  // Atom: <entry>, ссылка живёт в атрибуте href, а не в тексте тега
  const entryRegex = /<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi;
  let entryMatch;

  while ((entryMatch = entryRegex.exec(xml)) !== null) {
    const c = entryMatch[1];
    const item: RssItem = {};

    item.title = tagText(c, "title");
    item.pubDate = tagText(c, "published") ?? tagText(c, "updated");
    item.description = tagText(c, "content") ?? tagText(c, "summary");

    const alt = /<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)/i.exec(c);
    const anyLink = /<link[^>]*href=["']([^"']+)/i.exec(c);
    const href = alt?.[1] ?? anyLink?.[1];
    if (href) item.link = href.trim();

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
