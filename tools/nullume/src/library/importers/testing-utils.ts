import type { NullumeConfig } from "../../core/config.js";

/**
 * Создать mock конфиг для тестирования
 */
export function mockConfig(overrides?: Partial<NullumeConfig>): NullumeConfig {
  return {
    apiKey: "test-key",
    ...overrides,
  };
}

/**
 * Типы для mock fetch responses
 */
interface MockResponse {
  status: number;
  data: string | unknown;
  headers?: Record<string, string>;
}

/**
 * Создать mock fetch функцию с предопределёнными ответами
 */
export function createMockFetch(
  responses: Record<string, MockResponse>
): typeof fetch {
  return async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;

    const response = responses[urlStr];
    if (!response) {
      return new Response(`Not mocked: ${urlStr}`, { status: 404 });
    }

    const body =
      typeof response.data === "string"
        ? response.data
        : JSON.stringify(response.data);

    return new Response(body, {
      status: response.status,
      headers: response.headers || { "content-type": "text/plain" },
    });
  };
}

/**
 * Вспомогательный тип для мока нескольких страниц
 */
export function createPaginatedMockFetch(
  pages: Record<string, MockResponse[]>
): typeof fetch {
  const responses: Record<string, MockResponse> = {};

  for (const [baseUrl, pageResponses] of Object.entries(pages)) {
    for (let i = 0; i < pageResponses.length; i++) {
      const url =
        i === 0 ? baseUrl : `${baseUrl}?page=${i + 1}`;
      responses[url] = pageResponses[i];
    }
  }

  return createMockFetch(responses);
}
