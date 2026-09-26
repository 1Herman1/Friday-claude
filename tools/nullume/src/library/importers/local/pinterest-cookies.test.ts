import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pinterestCookiesImporter } from "./pinterest-cookies.js";
import { ProviderError, UsageError } from "../../../core/errors.js";
import type { ImportRunOptions, RefCandidate } from "../types.js";

const GATE_ENV = { NULLUME_LOCAL_IMPORTERS: "1", NULLUME_NO_DELAY: "1" } as NodeJS.ProcessEnv;
const GATE_CONFIG = { acknowledgedRiskyImporters: true } as any;

function recordingFetch(
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>
): { impl: typeof fetch; calls: Array<{ url: string; headers: Record<string, string> }> } {
  const calls: Array<{ url: string; headers: Record<string, string> }> = [];
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
    const headers: Record<string, string> = {};
    if (init?.headers) {
      const h = init.headers as Record<string, string>;
      for (const [k, v] of Object.entries(h)) {
        headers[k.toLowerCase()] = v;
      }
    }
    calls.push({ url: urlStr, headers });
    return handler(urlStr, init);
  }) as unknown as typeof fetch;
  return { impl, calls };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Временный NULLUME_HOME с сессиями (права 600) */
async function withSessions<T>(
  sessions: Record<string, unknown>,
  fn: () => Promise<T>
): Promise<T> {
  const old = process.env.NULLUME_HOME;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nullume-pinterest-"));
  const sessDir = path.join(dir, "sessions");
  fs.mkdirSync(sessDir, { recursive: true });
  for (const [id, body] of Object.entries(sessions)) {
    const file = path.join(sessDir, `${id}.json`);
    fs.writeFileSync(file, JSON.stringify(body));
    fs.chmodSync(file, 0o600);
  }
  process.env.NULLUME_HOME = dir;
  try {
    return await fn();
  } finally {
    if (old === undefined) delete process.env.NULLUME_HOME;
    else process.env.NULLUME_HOME = old;
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function opts(over: Partial<ImportRunOptions>): ImportRunOptions {
  return {
    limit: 10,
    log: () => {},
    config: GATE_CONFIG,
    env: GATE_ENV,
    query: "design",
    ...over,
  } as ImportRunOptions;
}

async function collect(o: ImportRunOptions): Promise<RefCandidate[]> {
  const out: RefCandidate[] = [];
  for await (const c of pinterestCookiesImporter.run(o)) out.push(c);
  return out;
}

function loadFixture(name: string): unknown {
  const fixture = fs.readFileSync(
    path.join(path.dirname(import.meta.url).replace("file://", ""), `__fixtures__/${name}`)
  );
  return JSON.parse(fixture.toString());
}

/* ------------------------------------------------------------------ */
/* Чтение сессии: новое имя pinterest-cookies, запасное pinterest     */
/* ------------------------------------------------------------------ */

test("pinterest-cookies: читает сессию pinterest-cookies", async () => {
  await withSessions(
    {
      "pinterest-cookies": {
        cookies: { _pinterest_sess: "sess123" },
        createdAt: "2026-01-01T00:00:00Z",
      },
    },
    async () => {
      const { impl, calls } = recordingFetch(() => json({ resource_response: { data: { results: [] } } }));
      const candidates = await collect(opts({ fetchImpl: impl }));
      assert.equal(candidates.length, 0);
      assert.equal(calls.length, 1);
    }
  );
});

test("pinterest-cookies: читает сессию pinterest если pinterest-cookies нет (обратная совместимость)", async () => {
  await withSessions(
    {
      pinterest: {
        cookies: { _pinterest_sess: "sess456" },
        createdAt: "2026-01-01T00:00:00Z",
      },
    },
    async () => {
      const { impl, calls } = recordingFetch(() => json({ resource_response: { data: { results: [] } } }));
      const candidates = await collect(opts({ fetchImpl: impl }));
      assert.equal(candidates.length, 0);
      assert.equal(calls.length, 1);
    }
  );
});

/* ------------------------------------------------------------------ */
/* Cookie validation: требуется _pinterest_sess                        */
/* ------------------------------------------------------------------ */

test("pinterest-cookies: ошибка если отсутствует _pinterest_sess", async () => {
  await withSessions(
    {
      "pinterest-cookies": {
        cookies: { other: "value" },
        createdAt: "2026-01-01T00:00:00Z",
      },
    },
    async () => {
      const { impl, calls } = recordingFetch(() => {
        throw new Error("fetch не должен вызваться");
      });
      await assert.rejects(
        () => collect(opts({ fetchImpl: impl })),
        (err: unknown) => err instanceof UsageError && /_pinterest_sess/.test((err as Error).message)
      );
      assert.equal(calls.length, 0);
    }
  );
});

/* ------------------------------------------------------------------ */
/* Headers: Cookie и X-CSRFToken                                      */
/* ------------------------------------------------------------------ */

test("pinterest-cookies: заголовок Cookie содержит все cookies из сессии", async () => {
  await withSessions(
    {
      "pinterest-cookies": {
        cookies: {
          _pinterest_sess: "sess_value",
          _b: "another_value",
          unknown: "third_value",
        },
        createdAt: "2026-01-01T00:00:00Z",
      },
    },
    async () => {
      const { impl, calls } = recordingFetch(() => json({ resource_response: { data: { results: [] } } }));
      await collect(opts({ fetchImpl: impl }));
      assert.equal(calls.length, 1);
      const cookieHeader = calls[0].headers.cookie;
      assert.ok(cookieHeader.includes("_pinterest_sess=sess_value"), `cookie header должен содержать _pinterest_sess`);
      assert.ok(cookieHeader.includes("_b=another_value"), `cookie header должен содержать _b`);
      assert.ok(cookieHeader.includes("unknown=third_value"), `cookie header должен содержать unknown`);
    }
  );
});

test("pinterest-cookies: X-CSRFToken передаётся если csrftoken есть в cookies", async () => {
  await withSessions(
    {
      "pinterest-cookies": {
        cookies: {
          _pinterest_sess: "sess_value",
          csrftoken: "csrf_abc123",
        },
        createdAt: "2026-01-01T00:00:00Z",
      },
    },
    async () => {
      const { impl, calls } = recordingFetch(() => json({ resource_response: { data: { results: [] } } }));
      await collect(opts({ fetchImpl: impl }));
      assert.equal(calls.length, 1);
      assert.equal(calls[0].headers["x-csrftoken"], "csrf_abc123");
    }
  );
});

test("pinterest-cookies: X-CSRFToken не передаётся если csrftoken отсутствует", async () => {
  await withSessions(
    {
      "pinterest-cookies": {
        cookies: { _pinterest_sess: "sess_value" },
        createdAt: "2026-01-01T00:00:00Z",
      },
    },
    async () => {
      const { impl, calls } = recordingFetch(() => json({ resource_response: { data: { results: [] } } }));
      await collect(opts({ fetchImpl: impl }));
      assert.equal(calls.length, 1);
      assert.equal(calls[0].headers["x-csrftoken"], undefined);
    }
  );
});

/* ------------------------------------------------------------------ */
/* HTTP Status: 401 / 403 / 429                                       */
/* ------------------------------------------------------------------ */

for (const status of [401, 403]) {
  test(`pinterest-cookies: HTTP ${status} даёт ProviderError про устаревшую сессию`, async () => {
    await withSessions(
      {
        "pinterest-cookies": {
          cookies: { _pinterest_sess: "sess_invalid" },
          createdAt: "2026-01-01T00:00:00Z",
        },
      },
      async () => {
        const { impl } = recordingFetch(() => new Response("auth failed", { status }));
        await assert.rejects(
          () => collect(opts({ fetchImpl: impl })),
          (err: unknown) => {
            assert.ok(err instanceof ProviderError);
            assert.equal((err as ProviderError).code, status);
            assert.match(
              (err as Error).message,
              /устарела|недействительна/,
              `сообщение должно упомянуть что сессия устарела`
            );
            return true;
          }
        );
      }
    );
  });
}

test("pinterest-cookies: HTTP 429 даёт ProviderError про rate limit", async () => {
  await withSessions(
    {
      "pinterest-cookies": {
        cookies: { _pinterest_sess: "sess_valid" },
        createdAt: "2026-01-01T00:00:00Z",
      },
    },
    async () => {
      const { impl } = recordingFetch(() => new Response("rate limited", { status: 429 }));
      await assert.rejects(
        () => collect(opts({ fetchImpl: impl })),
        (err: unknown) => {
          assert.ok(err instanceof ProviderError);
          assert.equal((err as ProviderError).code, 429);
          assert.match((err as Error).message, /ограничил|rate limit/);
          return true;
        }
      );
    }
  );
});

/* ------------------------------------------------------------------ */
/* JSON Parsing и Schema Validation                                   */
/* ------------------------------------------------------------------ */

test("pinterest-cookies: битый JSON даёт ProviderError про парсинг", async () => {
  await withSessions(
    {
      "pinterest-cookies": {
        cookies: { _pinterest_sess: "sess_valid" },
        createdAt: "2026-01-01T00:00:00Z",
      },
    },
    async () => {
      const { impl } = recordingFetch(() => new Response("{это не json", { status: 200 }));
      await assert.rejects(
        () => collect(opts({ fetchImpl: impl })),
        (err: unknown) =>
          err instanceof ProviderError && /Не удалось распарсить ответ Pinterest/.test((err as Error).message)
      );
    }
  );
});

test("pinterest-cookies: изменившийся формат ответа даёт ProviderError про формат", async () => {
  await withSessions(
    {
      "pinterest-cookies": {
        cookies: { _pinterest_sess: "sess_valid" },
        createdAt: "2026-01-01T00:00:00Z",
      },
    },
    async () => {
      const { impl } = recordingFetch(() => json({ unexpected: "structure" }));
      await assert.rejects(
        () => collect(opts({ fetchImpl: impl })),
        (err: unknown) =>
          err instanceof ProviderError && /Формат ответа Pinterest изменился/.test((err as Error).message)
      );
    }
  );
});

/* ------------------------------------------------------------------ */
/* Parse fixture: структура ответа и extraction                       */
/* ------------------------------------------------------------------ */

test("pinterest-cookies: парсит fixture с несколькими пинами", async () => {
  await withSessions(
    {
      "pinterest-cookies": {
        cookies: { _pinterest_sess: "sess_valid" },
        createdAt: "2026-01-01T00:00:00Z",
      },
    },
    async () => {
      const fixture = loadFixture("pinterest-search-response.json");
      const { impl } = recordingFetch(() => json(fixture));
      const candidates = await collect(opts({ fetchImpl: impl }));

      assert.equal(candidates.length, 3);

      // Pin 001: orig приоритетнее 736x
      assert.equal(candidates[0].sourceRef, "pin-001");
      assert.equal(candidates[0].url, "https://i.pinimg.com/originals/aa/bb/cc/aabbccdd.jpg");
      assert.equal(candidates[0].pageUrl, "https://www.pinterest.com/pin/pin-001/");
      assert.equal(candidates[0].author, "designer-jane");
      assert.equal(candidates[0].source, "pinterest-cookies");
      assert.equal(candidates[0].meta.title, "Modern UI Design Patterns");

      // Pin 002: только 736x
      assert.equal(candidates[1].sourceRef, "pin-002");
      assert.equal(candidates[1].url, "https://i.pinimg.com/736x/dd/ee/ff/ddeeff.jpg");

      // Pin 003: orig есть
      assert.equal(candidates[2].sourceRef, "pin-003");
      assert.equal(candidates[2].url, "https://i.pinimg.com/originals/11/22/33/112233.jpg");
    }
  );
});

/* ------------------------------------------------------------------ */
/* Пропуск невалидных элементов                                       */
/* ------------------------------------------------------------------ */

test("pinterest-cookies: пин без изображений пропускается", async () => {
  await withSessions(
    {
      "pinterest-cookies": {
        cookies: { _pinterest_sess: "sess_valid" },
        createdAt: "2026-01-01T00:00:00Z",
      },
    },
    async () => {
      const logs: string[] = [];
      const { impl } = recordingFetch(() =>
        json({
          resource_response: {
            data: {
              results: [
                { id: "no-img", images: {} },
                { id: "with-img", images: { orig: { url: "https://i.pinimg.com/orig.jpg" } } },
              ],
            },
          },
        })
      );
      const candidates = await collect(opts({ fetchImpl: impl, log: (m) => logs.push(m) }));
      assert.equal(candidates.length, 1);
      assert.equal(candidates[0].sourceRef, "with-img");
      assert.ok(logs.some((l) => l.includes("PINTEREST_SKIP_NO_IMAGE")));
    }
  );
});

/* ------------------------------------------------------------------ */
/* Пагинация                                                           */
/* ------------------------------------------------------------------ */

test("pinterest-cookies: следующая страница по bookmark", async () => {
  await withSessions(
    {
      "pinterest-cookies": {
        cookies: { _pinterest_sess: "sess_valid" },
        createdAt: "2026-01-01T00:00:00Z",
      },
    },
    async () => {
      let callCount = 0;
      const { impl, calls } = recordingFetch(() => {
        callCount++;
        if (callCount === 1) {
          return json({
            resource_response: {
              data: {
                results: [{ id: "p1", images: { orig: { url: "https://i.pinimg.com/p1.jpg" } } }],
              },
              bookmark: "next-page-token",
            },
          });
        } else {
          return json({
            resource_response: {
              data: {
                results: [{ id: "p2", images: { orig: { url: "https://i.pinimg.com/p2.jpg" } } }],
              },
            },
          });
        }
      });

      const candidates = await collect(opts({ fetchImpl: impl, limit: 10 }));
      assert.equal(candidates.length, 2);
      assert.equal(calls.length, 2);
      assert.equal(candidates[0].sourceRef, "p1");
      assert.equal(candidates[1].sourceRef, "p2");
    }
  );
});

/* ------------------------------------------------------------------ */
/* AbortSignal                                                        */
/* ------------------------------------------------------------------ */

test("pinterest-cookies: прерванный signal не отдаёт кандидатов", async () => {
  await withSessions(
    {
      "pinterest-cookies": {
        cookies: { _pinterest_sess: "sess_valid" },
        createdAt: "2026-01-01T00:00:00Z",
      },
    },
    async () => {
      const controller = new AbortController();
      controller.abort();
      const { impl } = recordingFetch(() =>
        json({
          resource_response: {
            data: {
              results: [{ id: "p1", images: { orig: { url: "https://i.pinimg.com/p1.jpg" } } }],
            },
          },
        })
      );
      const candidates = await collect(opts({ fetchImpl: impl, signal: controller.signal }));
      assert.equal(candidates.length, 0);
    }
  );
});
