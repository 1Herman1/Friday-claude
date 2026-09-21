import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { dribbbleImporter } from "./dribbble.js";
import { pinterestCookiesImporter } from "./pinterest-cookies.js";
import { xCookiesImporter } from "./x-cookies.js";
import { ProviderError, UsageError } from "../../../core/errors.js";
import type { Importer, ImportRunOptions, RefCandidate } from "../types.js";

/**
 * Локальные импортёры: ни одного реального запроса и ни одного реального
 * таймера (NULLUME_NO_DELAY=1), сессии — во временном NULLUME_HOME.
 */

const GATE_ENV = { NULLUME_LOCAL_IMPORTERS: "1", NULLUME_NO_DELAY: "1" } as NodeJS.ProcessEnv;
const GATE_CONFIG = { acknowledgedRiskyImporters: true } as any;

function recordingFetch(
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>
): { impl: typeof fetch; calls: string[] } {
  const calls: string[] = [];
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
    calls.push(urlStr);
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

/** Временный NULLUME_HOME с сессиями (права 600, иначе readSession откажет) */
async function withSessions<T>(
  sessions: Record<string, unknown>,
  fn: () => Promise<T>
): Promise<T> {
  const old = process.env.NULLUME_HOME;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nullume-local-"));
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

const DRIBBBLE_SESSION = { token: "tok", createdAt: "2026-01-01T00:00:00Z" };
const PINTEREST_SESSION = {
  cookies: { auth_token: "tok" },
  createdAt: "2026-01-01T00:00:00Z",
};
const X_SESSION = { cookies: { auth_token: "tok" }, createdAt: "2026-01-01T00:00:00Z" };

function opts(over: Partial<ImportRunOptions>): ImportRunOptions {
  return {
    limit: 10,
    log: () => {},
    config: GATE_CONFIG,
    env: GATE_ENV,
    ...over,
  } as ImportRunOptions;
}

async function collect(importer: Importer, o: ImportRunOptions): Promise<RefCandidate[]> {
  const out: RefCandidate[] = [];
  for await (const c of importer.run(o)) out.push(c);
  return out;
}

function shot(id: number) {
  return {
    id,
    title: `Shot ${id}`,
    html_url: `https://dribbble.com/shots/${id}`,
    tags: ["ui"],
    images: { hidpi: `https://cdn.dribbble.com/${id}@2x.jpg`, normal: `https://cdn.dribbble.com/${id}.jpg` },
  };
}

function pin(id: string) {
  return {
    id,
    images: { orig: { url: `https://i.pinimg.com/originals/${id}.jpg` } },
    pinner: { username: "u" },
  };
}

function pinterestBody(pins: unknown[], bookmark?: string) {
  return {
    resource_response: {
      data: { results: pins },
      ...(bookmark ? { bookmark } : {}),
    },
  };
}

/* ------------------------------------------------------------------ */
/* 429 / 403 — ProviderError без ретраев                                */
/* ------------------------------------------------------------------ */

for (const status of [429, 403]) {
  test(`dribbble: HTTP ${status} даёт ProviderError без единого ретрая`, async () => {
    await withSessions({ dribbble: DRIBBBLE_SESSION }, async () => {
      const { impl, calls } = recordingFetch(() => new Response("rate limited", { status }));
      await assert.rejects(
        () => collect(dribbbleImporter, opts({ fetchImpl: impl })),
        (err: unknown) => {
          assert.ok(err instanceof ProviderError, `ожидался ProviderError, получен ${err}`);
          assert.equal((err as ProviderError).code, status);
          assert.match((err as Error).message, /Dribbble/);
          return true;
        }
      );
      assert.equal(calls.length, 1, "local-only импортёр не должен ретраить ограничение доступа");
    });
  });

  test(`pinterest-cookies: HTTP ${status} даёт ProviderError без единого ретрая`, async () => {
    await withSessions({ pinterest: PINTEREST_SESSION }, async () => {
      const { impl, calls } = recordingFetch(() => new Response("rate limited", { status }));
      await assert.rejects(
        () => collect(pinterestCookiesImporter, opts({ query: "design", fetchImpl: impl })),
        (err: unknown) => {
          assert.ok(err instanceof ProviderError, `ожидался ProviderError, получен ${err}`);
          assert.equal((err as ProviderError).code, status);
          assert.match((err as Error).message, /Pinterest/);
          return true;
        }
      );
      assert.equal(calls.length, 1, "local-only импортёр не должен ретраить ограничение доступа");
    });
  });
}

test("dribbble: HTTP 500 даёт ProviderError с кодом и без ретраев", async () => {
  await withSessions({ dribbble: DRIBBBLE_SESSION }, async () => {
    const { impl, calls } = recordingFetch(() => new Response("boom", { status: 500 }));
    await assert.rejects(
      () => collect(dribbbleImporter, opts({ fetchImpl: impl })),
      (err: unknown) => err instanceof ProviderError && (err as ProviderError).code === 500
    );
    assert.equal(calls.length, 1);
  });
});

/* ------------------------------------------------------------------ */
/* Битый JSON — понятная ошибка, не падение процесса                    */
/* ------------------------------------------------------------------ */

test("dribbble: битый JSON даёт понятную ProviderError", async () => {
  await withSessions({ dribbble: DRIBBBLE_SESSION }, async () => {
    const { impl } = recordingFetch(() => new Response("{это не json", { status: 200 }));
    await assert.rejects(
      () => collect(dribbbleImporter, opts({ fetchImpl: impl })),
      (err: unknown) =>
        err instanceof ProviderError && /Не удалось распарсить ответ Dribbble/.test((err as Error).message)
    );
  });
});

test("pinterest-cookies: битый JSON даёт понятную ProviderError", async () => {
  await withSessions({ pinterest: PINTEREST_SESSION }, async () => {
    const { impl } = recordingFetch(() => new Response("{это не json", { status: 200 }));
    await assert.rejects(
      () => collect(pinterestCookiesImporter, opts({ query: "design", fetchImpl: impl })),
      (err: unknown) =>
        err instanceof ProviderError && /Не удалось распарсить ответ Pinterest/.test((err as Error).message)
    );
  });
});

test("pinterest-cookies: изменившийся формат ответа даёт ProviderError, а не исключение zod", async () => {
  await withSessions({ pinterest: PINTEREST_SESSION }, async () => {
    const { impl } = recordingFetch(() =>
      json({ resource_response: { data: { results: [{ id: 42 }] } } })
    );
    await assert.rejects(
      () => collect(pinterestCookiesImporter, opts({ query: "design", fetchImpl: impl })),
      (err: unknown) =>
        err instanceof ProviderError && /Формат ответа Pinterest изменился/.test((err as Error).message)
    );
  });
});

/* ------------------------------------------------------------------ */
/* Пустой ответ — генератор завершается                                 */
/* ------------------------------------------------------------------ */

test("dribbble: пустой массив шотов завершает генератор одним запросом", async () => {
  await withSessions({ dribbble: DRIBBBLE_SESSION }, async () => {
    const { impl, calls } = recordingFetch(() => json([]));
    const candidates = await collect(dribbbleImporter, opts({ limit: 50, fetchImpl: impl }));
    assert.equal(candidates.length, 0);
    assert.equal(calls.length, 1);
  });
});

test("pinterest-cookies: пустые results без bookmark завершают генератор", async () => {
  await withSessions({ pinterest: PINTEREST_SESSION }, async () => {
    const { impl, calls } = recordingFetch(() => json(pinterestBody([])));
    const candidates = await collect(
      pinterestCookiesImporter,
      opts({ query: "design", limit: 50, fetchImpl: impl })
    );
    assert.equal(candidates.length, 0);
    assert.equal(calls.length, 1);
  });
});

/* ------------------------------------------------------------------ */
/* Пропуск невалидных элементов                                         */
/* ------------------------------------------------------------------ */

test("dribbble: шот с невалидным URL пропускается схемой, валидный отдаётся", async () => {
  await withSessions({ dribbble: DRIBBBLE_SESSION }, async () => {
    const logs: string[] = [];
    const { impl } = recordingFetch(() =>
      json([{ id: 1, html_url: "не-ссылка", images: { normal: "тоже-не-ссылка" } }, shot(2)])
    );
    const candidates = await collect(
      dribbbleImporter,
      opts({ fetchImpl: impl, log: (m) => logs.push(m) })
    );
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].sourceRef, "2");
    assert.ok(logs.some((l) => l.includes("DRIBBBLE_SKIP_INVALID")));
  });
});

test("dribbble: шот без изображений пропускается", async () => {
  await withSessions({ dribbble: DRIBBBLE_SESSION }, async () => {
    const logs: string[] = [];
    const { impl } = recordingFetch(() =>
      json([{ id: 1, html_url: "https://dribbble.com/shots/1", images: {} }, shot(2)])
    );
    const candidates = await collect(
      dribbbleImporter,
      opts({ fetchImpl: impl, log: (m) => logs.push(m) })
    );
    assert.equal(candidates.length, 1);
    assert.ok(logs.some((l) => l.includes("DRIBBBLE_SKIP_NO_IMAGE")));
  });
});

test("pinterest-cookies: пин без изображений пропускается", async () => {
  await withSessions({ pinterest: PINTEREST_SESSION }, async () => {
    const logs: string[] = [];
    const { impl } = recordingFetch(() => json(pinterestBody([{ id: "p1", images: {} }, pin("p2")])));
    const candidates = await collect(
      pinterestCookiesImporter,
      opts({ query: "design", fetchImpl: impl, log: (m) => logs.push(m) })
    );
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].sourceRef, "p2");
    assert.ok(logs.some((l) => l.includes("PINTEREST_SKIP_NO_IMAGE")));
  });
});

/* ------------------------------------------------------------------ */
/* sourceRef уникален в пределах ответа                                 */
/* ------------------------------------------------------------------ */

function assertUniqueRefs(candidates: RefCandidate[]): void {
  assert.ok(candidates.length > 1);
  const refs = candidates.map((c) => c.sourceRef);
  assert.ok(refs.every((r) => typeof r === "string" && r.length > 0));
  assert.equal(new Set(refs).size, refs.length, `sourceRef не уникальны: ${refs.join(", ")}`);
}

test("dribbble: sourceRef уникальны в пределах ответа", async () => {
  await withSessions({ dribbble: DRIBBBLE_SESSION }, async () => {
    const { impl } = recordingFetch(() => json([shot(1), shot(2), shot(3)]));
    assertUniqueRefs(await collect(dribbbleImporter, opts({ fetchImpl: impl })));
  });
});

test("pinterest-cookies: sourceRef уникальны в пределах ответа", async () => {
  await withSessions({ pinterest: PINTEREST_SESSION }, async () => {
    const { impl } = recordingFetch(() => json(pinterestBody([pin("p1"), pin("p2"), pin("p3")])));
    assertUniqueRefs(await collect(pinterestCookiesImporter, opts({ query: "design", fetchImpl: impl })));
  });
});

/* ------------------------------------------------------------------ */
/* signal: прерванный AbortController                                   */
/* ------------------------------------------------------------------ */

test("dribbble: уже прерванный signal не отдаёт ни одного кандидата", async () => {
  await withSessions({ dribbble: DRIBBBLE_SESSION }, async () => {
    const controller = new AbortController();
    controller.abort();
    const { impl } = recordingFetch(() => json([shot(1), shot(2)]));
    const candidates = await collect(
      dribbbleImporter,
      opts({ fetchImpl: impl, signal: controller.signal })
    );
    assert.equal(candidates.length, 0);
  });
});

test("pinterest-cookies: уже прерванный signal не отдаёт ни одного кандидата", async () => {
  await withSessions({ pinterest: PINTEREST_SESSION }, async () => {
    const controller = new AbortController();
    controller.abort();
    const { impl } = recordingFetch(() => json(pinterestBody([pin("p1"), pin("p2")])));
    const candidates = await collect(
      pinterestCookiesImporter,
      opts({ query: "design", fetchImpl: impl, signal: controller.signal })
    );
    assert.equal(candidates.length, 0);
  });
});

test("dribbble: signal, прерванный после первого кандидата, останавливает выдачу", async () => {
  await withSessions({ dribbble: DRIBBBLE_SESSION }, async () => {
    const controller = new AbortController();
    const { impl } = recordingFetch(() => json([shot(1), shot(2), shot(3)]));
    const out: RefCandidate[] = [];
    for await (const c of dribbbleImporter.run(
      opts({ fetchImpl: impl, signal: controller.signal })
    )) {
      out.push(c);
      controller.abort();
    }
    assert.equal(out.length, 1);
  });
});

/* ------------------------------------------------------------------ */
/* Гейт и конфигурация                                                  */
/* ------------------------------------------------------------------ */

test("dribbble: run без гейта падает до единого сетевого запроса", async () => {
  const { impl, calls } = recordingFetch(() => {
    throw new Error("fetch не должен вызываться");
  });
  await assert.rejects(
    () =>
      collect(
        dribbbleImporter,
        opts({ fetchImpl: impl, config: { acknowledgedRiskyImporters: false } as any, env: {} })
      ),
    (err: unknown) => err instanceof UsageError
  );
  assert.deepEqual(calls, []);
});

test("pinterest-cookies: сессия без auth_token даёт UsageError без запроса", async () => {
  await withSessions(
    { pinterest: { cookies: { other: "x" }, createdAt: "2026-01-01T00:00:00Z" } },
    async () => {
      const { impl, calls } = recordingFetch(() => {
        throw new Error("fetch не должен вызываться");
      });
      await assert.rejects(
        () => collect(pinterestCookiesImporter, opts({ query: "design", fetchImpl: impl })),
        (err: unknown) => err instanceof UsageError && /auth_token/.test((err as Error).message)
      );
      assert.deepEqual(calls, []);
    }
  );
});

test("x-cookies: пустой operationId в data/x-graphql.json даёт UsageError без запроса", async () => {
  await withSessions({ x: X_SESSION }, async () => {
    const { impl, calls } = recordingFetch(() => {
      throw new Error("fetch не должен вызываться");
    });
    await assert.rejects(
      () => collect(xCookiesImporter, opts({ collection: "bookmarks", fetchImpl: impl })),
      (err: unknown) => err instanceof UsageError && /x-graphql\.json|operationId/.test((err as Error).message)
    );
    assert.deepEqual(calls, []);
  });
});

test("x-cookies: неизвестная коллекция даёт UsageError без запроса", async () => {
  await withSessions({ x: X_SESSION }, async () => {
    const { impl, calls } = recordingFetch(() => {
      throw new Error("fetch не должен вызываться");
    });
    await assert.rejects(
      () => collect(xCookiesImporter, opts({ collection: "retweets", fetchImpl: impl })),
      (err: unknown) => err instanceof UsageError && /Неизвестная коллекция/.test((err as Error).message)
    );
    assert.deepEqual(calls, []);
  });
});
