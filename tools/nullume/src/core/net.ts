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
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const init: RequestInit = {
        method,
        headers: { "Content-Type": "application/json", ...headers },
        signal: AbortSignal.timeout(timeoutMs),
      };

      if (body) {
        init.body = typeof body === "string" ? body : JSON.stringify(body);
      }

      const resp = await fetchImpl(url, init);

      // Retry 429 и 5xx
      if (resp.status === 429) {
        if (attempt < maxRetries) {
          const backoff = Math.pow(2, attempt - 1) * 1000 + Math.random() * 1000;
          await new Promise((resolve) => setTimeout(resolve, backoff));
          continue;
        }
        throw new RateLimitError(`HTTP 429 после ${maxRetries} попыток`);
      }

      if (resp.status >= 500) {
        if (attempt < maxRetries) {
          const backoff = Math.pow(2, attempt - 1) * 1000 + Math.random() * 1000;
          await new Promise((resolve) => setTimeout(resolve, backoff));
          continue;
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
