import { lookup } from "node:dns/promises";
import { NetworkError, RateLimitError } from "./errors.js";

export interface FetchImpl {
  (url: string, init?: RequestInit): Promise<Response>;
}

export interface RateLimiterOptions {
  maxRequests: number;
  windowMs: number;
}

export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private maxTokens: number;
  private refillRate: number; // tokens per ms

  constructor(maxRequests: number = 20, windowMs: number = 10000) {
    this.maxTokens = maxRequests;
    this.tokens = maxRequests;
    this.lastRefill = Date.now();
    this.refillRate = maxRequests / windowMs;
  }

  async acquire(): Promise<void> {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    this.tokens = Math.min(this.maxTokens, this.tokens + timePassed * this.refillRate);
    this.lastRefill = now;

    if (this.tokens < 1) {
      const waitMs = Math.ceil((1 - this.tokens) / this.refillRate);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      return this.acquire();
    }

    this.tokens -= 1;
  }
}

export interface FetchJsonOptions {
  headers?: Record<string, string>;
  body?: unknown;
  method?: string;
  timeoutMs?: number;
  maxRetries?: number;
  fetchImpl?: FetchImpl;
  signal?: AbortSignal;
}

export async function fetchJson<T = unknown>(
  url: string,
  options: FetchJsonOptions = {}
): Promise<T> {
  const {
    headers = {},
    body = undefined,
    method = body ? "POST" : "GET",
    timeoutMs = 60000,
    maxRetries = 3,
    fetchImpl = fetch,
    signal,
  } = options;

  let lastError: Error | undefined;
  // Only retry GET requests; never POST (avoid duplicate charges)
  const shouldRetry = method === "GET";

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const init: RequestInit = {
        method,
        headers: { "Content-Type": "application/json", ...headers },
        signal: signal || AbortSignal.timeout(timeoutMs),
      };

      if (body) {
        init.body = typeof body === "string" ? body : JSON.stringify(body);
      }

      const resp = await fetchImpl(url, init);

      // Retry only on GET for 429 and 5xx
      if (shouldRetry && (resp.status === 429 || resp.status >= 500)) {
        if (attempt < maxRetries) {
          const noDelay = process.env.NULLUME_NO_DELAY === "1";
          const backoff = noDelay ? 0 : Math.pow(2, attempt - 1) * 1000 + Math.random() * 1000;
          await new Promise((resolve) => setTimeout(resolve, backoff));
          continue;
        }
        if (resp.status === 429) {
          throw new RateLimitError(`HTTP 429 после ${maxRetries} попыток`);
        }
      }

      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new NetworkError(`HTTP ${resp.status}: ${text.slice(0, 200)}`);
      }

      return (await resp.json()) as T;
    } catch (e) {
      lastError = e as Error;
      if (e instanceof RateLimitError) throw e;
      if (attempt === maxRetries) break;
    }
  }

  throw lastError || new NetworkError("Неизвестная ошибка при запросе");
}

/**
 * Проверить, является ли хост приватным IP адресом
 * Блокирует: 10/8, 172.16/12, 192.168/16, 127/8, 169.254/16, 100.64/10, ::1, fc00::/7, fe80::/10
 */
async function validateHost(hostname: string, allowLoopback: boolean = false): Promise<void> {
  // localhost и 127.0.0.1 - разрешены только если allowLoopback
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    if (!allowLoopback) {
      throw new NetworkError(`Loopback адрес запрещён без allowLoopback: ${hostname}`);
    }
    return;
  }

  try {
    const results = await lookup(hostname, { all: true });

    for (const result of results) {
      const addr = result.address;

      // IPv4 приватные диапазоны
      if (result.family === 4) {
        const parts = addr.split(".").map(Number);
        if (
          parts[0] === 10 || // 10.0.0.0/8
          (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || // 172.16.0.0/12
          (parts[0] === 192 && parts[1] === 168) || // 192.168.0.0/16
          parts[0] === 127 || // 127.0.0.0/8
          (parts[0] === 169 && parts[1] === 254) || // 169.254.0.0/16
          (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) // 100.64.0.0/10
        ) {
          throw new NetworkError(`Приватный IPv4 адрес запрещён: ${addr}`);
        }
      }

      // IPv6 приватные диапазоны
      if (result.family === 6) {
        const addrLower = addr.toLowerCase();
        if (
          addrLower === "::1" || // loopback
          addrLower.startsWith("fc") || // fc00::/7
          addrLower.startsWith("fd") || // fc00::/7
          addrLower.startsWith("fe80:") || // fe80::/10
          addrLower.startsWith("::ffff:127.") || // IPv4-mapped loopback
          addrLower.startsWith("::ffff:10.") || // IPv4-mapped private
          addrLower.startsWith("::ffff:172.") ||
          addrLower.startsWith("::ffff:192.168.")
        ) {
          throw new NetworkError(`Приватный IPv6 адрес запрещён: ${addr}`);
        }
      }
    }
  } catch (e) {
    if (e instanceof NetworkError) throw e;
    throw new NetworkError(`DNS валидация не пройдена: ${hostname}`);
  }
}

/**
 * Безопасный fetch с проверкой протокола, хоста и редиректов
 * @param url URL для запроса
 * @param init Опции: headers, body, method, timeoutMs, maxBytes, allowLoopback
 * @returns Response
 */
export interface SafeFetchOptions extends RequestInit {
  timeoutMs?: number;
  maxBytes?: number;
  allowLoopback?: boolean;
  fetchImpl?: FetchImpl;
}

export async function safeFetch(url: string, init: SafeFetchOptions = {}): Promise<Response> {
  const { timeoutMs = 60000, maxBytes = 10 * 1024 * 1024, allowLoopback = false, fetchImpl = fetch } = init;

  const urlObj = new URL(url);

  // Протокол: https обязателен, http только для loopback
  if (urlObj.protocol !== "https:") {
    if (urlObj.protocol === "http:" && allowLoopback) {
      const host = urlObj.hostname || "";
      if (host !== "127.0.0.1" && host !== "localhost" && host !== "::1") {
        throw new NetworkError(`HTTP запрещён вне loopback: ${url}`);
      }
    } else {
      throw new NetworkError(`Только https:// разрешён (http — лишь для loopback с allowLoopback), получен: ${url}`);
    }
  }

  // Валидировать хост
  const hostname = urlObj.hostname || "";
  await validateHost(hostname, allowLoopback);

  // Безопасные опции для fetch
  const safeInit: RequestInit = {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
    redirect: "manual",
  };

  let currentUrl = url;
  let response = await fetchImpl(currentUrl, safeInit);

  // Обработка редиректов с перепроверкой каждого хопа
  const maxRedirects = 5;
  let redirectCount = 0;

  while ((response.status >= 300 && response.status < 400) && redirectCount < maxRedirects) {
    const location = response.headers.get("Location");
    if (!location) {
      throw new NetworkError(`Редирект без Location заголовка: ${response.status}`);
    }

    currentUrl = new URL(location, currentUrl).href;
    const redirectUrl = new URL(currentUrl);

    // Перепроверить протокол
    if (redirectUrl.protocol !== "https:" && !(redirectUrl.protocol === "http:" && allowLoopback)) {
      throw new NetworkError(`Редирект на небезопасный протокол: ${currentUrl}`);
    }

    // Перепроверить хост
    const redirectHost = redirectUrl.hostname || "";
    await validateHost(redirectHost, allowLoopback);

    response = await fetchImpl(currentUrl, safeInit);
    redirectCount++;
  }

  if (redirectCount >= maxRedirects) {
    throw new NetworkError(`Превышено максимум редиректов: ${maxRedirects}`);
  }

  // Проверить Content-Length если доступен
  if (response.headers.has("content-length")) {
    const contentLength = parseInt(response.headers.get("content-length") || "0", 10);
    if (contentLength > maxBytes) {
      throw new NetworkError(`Content-Length превышает лимит: ${(contentLength / 1024 / 1024).toFixed(1)}MB > ${(maxBytes / 1024 / 1024).toFixed(1)}MB`);
    }
  }

  return response;
}
