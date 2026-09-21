import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { arenaImporter } from "./arena.js";
import { civitaiImporter } from "./civitai.js";
import { pexels } from "./pexels.js";
import { pixabay } from "./pixabay.js";
import { unsplash } from "./unsplash.js";
import { raindropImporter } from "./raindrop.js";
import { pinterestApiImporter } from "./pinterest-api.js";
import { shotcafeImporter } from "./shotcafe.js";
import { rssImporter } from "./rss.js";
import { eagleImporter } from "./eagle.js";
import type { Importer, ImportRunOptions, RefCandidate } from "../types.js";
import { mockConfig } from "../testing-utils.js";

/**
 * fetch-мок, записывающий все вызовы. Ни один тест в файле не ходит в сеть
 * и не использует реальных таймеров.
 */
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

function baseOpts(over: Partial<ImportRunOptions>): ImportRunOptions {
  return {
    limit: 10,
    log: () => {},
    config: mockConfig(),
    env: { NULLUME_NO_DELAY: "1" },
    ...over,
  } as ImportRunOptions;
}

async function collect(importer: Importer, opts: ImportRunOptions): Promise<RefCandidate[]> {
  const out: RefCandidate[] = [];
  for await (const c of importer.run(opts)) out.push(c);
  return out;
}

/** Временный NULLUME_HOME: изолирует кэш импортёров от домашнего каталога */
async function withTempHome<T>(fn: () => Promise<T>): Promise<T> {
  const old = process.env.NULLUME_HOME;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nullume-contract-"));
  process.env.NULLUME_HOME = dir;
  try {
    return await fn();
  } finally {
    if (old === undefined) delete process.env.NULLUME_HOME;
    else process.env.NULLUME_HOME = old;
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const keyed = {
  pexels: mockConfig({ importers: { pexels: { key: "k" } } }),
  pixabay: mockConfig({ importers: { pixabay: { key: "k" } } }),
  unsplash: mockConfig({ importers: { unsplash: { key: "k" } } }),
  raindrop: mockConfig({ importers: { raindrop: { token: "t" } } }),
  pinterest: mockConfig({ importers: { pinterest: { accessToken: "t" } } }),
};

/* ------------------------------------------------------------------ */
/* limit: 0 — ни одного сетевого запроса                               */
/* ------------------------------------------------------------------ */

const zeroLimitCases: Array<[string, Importer, Partial<ImportRunOptions>]> = [
  ["arena (канал)", arenaImporter, { collection: "design" }],
  ["arena (поиск)", arenaImporter, { query: "design" }],
  ["civitai", civitaiImporter, {}],
  ["pexels", pexels, { query: "nature", config: keyed.pexels }],
  ["unsplash", unsplash, { query: "nature", config: keyed.unsplash }],
  ["raindrop", raindropImporter, { config: keyed.raindrop }],
  ["pinterest-api", pinterestApiImporter, { collection: "b1", config: keyed.pinterest }],
  ["shotcafe", shotcafeImporter, { collection: "noir" }],
];

for (const [name, importer, over] of zeroLimitCases) {
  test(`${name}: limit=0 не делает ни одного запроса и завершается`, async () => {
    const { impl, calls } = recordingFetch(() => {
      throw new Error("fetch не должен вызываться при limit=0");
    });
    const candidates = await collect(importer, baseOpts({ ...over, limit: 0, fetchImpl: impl }));
    assert.equal(candidates.length, 0);
    assert.deepEqual(calls, []);
  });
}

test("pixabay: limit=0 не делает ни одного запроса и завершается", async () => {
  await withTempHome(async () => {
    const { impl, calls } = recordingFetch(() => {
      throw new Error("fetch не должен вызываться при limit=0");
    });
    const candidates = await collect(
      pixabay,
      baseOpts({ query: "nature", limit: 0, config: keyed.pixabay, fetchImpl: impl })
    );
    assert.equal(candidates.length, 0);
    assert.deepEqual(calls, []);
  });
});

/* ------------------------------------------------------------------ */
/* Пустой ответ (0 элементов) — генератор завершается, не зацикливается */
/* ------------------------------------------------------------------ */

const emptyCases: Array<[string, Importer, unknown, Partial<ImportRunOptions>]> = [
  ["arena (канал)", arenaImporter, { contents: [], total_count: 0 }, { collection: "design" }],
  ["arena (поиск)", arenaImporter, { results: [], total_count: 0 }, { query: "design" }],
  ["civitai", civitaiImporter, { items: [], metadata: {} }, {}],
  ["pexels", pexels, { photos: [], page: 1, per_page: 80, total_results: 0 }, { query: "n", config: keyed.pexels }],
  ["unsplash", unsplash, { results: [], total: 0, total_pages: 0 }, { query: "n", config: keyed.unsplash }],
  ["raindrop", raindropImporter, { result: true, items: [], count: 0 }, { config: keyed.raindrop }],
  ["pinterest-api", pinterestApiImporter, { items: [] }, { collection: "b1", config: keyed.pinterest }],
];

for (const [name, importer, body, over] of emptyCases) {
  test(`${name}: пустой ответ завершает генератор с 0 кандидатов`, async () => {
    const { impl, calls } = recordingFetch(() => json(body));
    const candidates = await collect(importer, baseOpts({ ...over, limit: 50, fetchImpl: impl }));
    assert.equal(candidates.length, 0);
    assert.equal(calls.length, 1, "должен быть ровно один запрос, без зацикливания пагинации");
  });
}

test("pixabay: пустой ответ завершает генератор с 0 кандидатов", async () => {
  await withTempHome(async () => {
    const { impl, calls } = recordingFetch(() => json({ total: 0, totalHits: 0, hits: [] }));
    const candidates = await collect(
      pixabay,
      baseOpts({ query: "nature", limit: 50, config: keyed.pixabay, fetchImpl: impl })
    );
    assert.equal(candidates.length, 0);
    assert.equal(calls.length, 1);
  });
});

test("shotcafe: страница без картинок завершает генератор", async () => {
  const { impl, calls } = recordingFetch(() => new Response("<html><body>пусто</body></html>", { status: 200 }));
  const candidates = await collect(
    shotcafeImporter,
    baseOpts({ collection: "noir", limit: 50, fetchImpl: impl })
  );
  assert.equal(candidates.length, 0);
  assert.equal(calls.length, 1);
});

test("rss: лента без items завершает генератор", async () => {
  await withTempHome(async () => {
    const { impl } = recordingFetch(
      () => new Response(`<?xml version="1.0"?><rss><channel><title>t</title></channel></rss>`, { status: 200 })
    );
    const candidates = await collect(
      rssImporter,
      baseOpts({ collection: "onepagelove", limit: 50, fetchImpl: impl })
    );
    assert.equal(candidates.length, 0);
  });
});

/* ------------------------------------------------------------------ */
/* Битый JSON — понятная ошибка, процесс не падает                      */
/* ------------------------------------------------------------------ */

const brokenJsonCases: Array<[string, Importer, Partial<ImportRunOptions>, RegExp]> = [
  ["arena", arenaImporter, { collection: "design" }, /Are\.na/],
  ["civitai", civitaiImporter, {}, /Civitai/],
  ["raindrop", raindropImporter, { config: keyed.raindrop }, /Raindrop/],
  ["pinterest-api", pinterestApiImporter, { collection: "b1", config: keyed.pinterest }, /Pinterest/],
  ["eagle", eagleImporter, {}, /Eagle/],
];

for (const [name, importer, over, msgRe] of brokenJsonCases) {
  test(`${name}: битый JSON даёт понятную ошибку, а не падение процесса`, async () => {
    const { impl } = recordingFetch(
      () => new Response("{это не json", { status: 200, headers: { "content-type": "application/json" } })
    );
    await assert.rejects(
      () => collect(importer, baseOpts({ ...over, fetchImpl: impl })),
      (err: unknown) => {
        assert.ok(err instanceof Error, "ошибка должна быть Error");
        assert.match(err.message, msgRe, `сообщение должно называть источник: ${(err as Error).message}`);
        assert.ok(err.message.length > 10);
        return true;
      }
    );
  });
}

test("shotcafe: битый HTML (не HTML вовсе) не роняет импортёр", async () => {
  const { impl } = recordingFetch(() => new Response("\u0000\u0001\u0002", { status: 200 }));
  const candidates = await collect(shotcafeImporter, baseOpts({ collection: "noir", fetchImpl: impl }));
  assert.equal(candidates.length, 0);
});

/* ------------------------------------------------------------------ */
/* http:// вместо https — кандидат не отдаётся                          */
/* ------------------------------------------------------------------ */

test("arena: блок с http:// картинкой пропускается", async () => {
  const { impl } = recordingFetch(() =>
    json({
      contents: [
        { id: 1, class: "Image", image: { large: { url: "http://insecure.example.com/a.jpg" } } },
        { id: 2, class: "Image", image: { large: { url: "https://secure.example.com/b.jpg" } } },
      ],
      total_count: 2,
    })
  );
  const candidates = await collect(arenaImporter, baseOpts({ collection: "design", fetchImpl: impl }));
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].sourceRef, "2");
  assert.ok(candidates[0].url!.startsWith("https://"));
});

test("civitai: элемент с http:// URL пропускается", async () => {
  const { impl } = recordingFetch(() =>
    json({
      items: [
        { id: 1, url: "http://insecure.example.com/a.jpg", nsfwLevel: "None" },
        { id: 2, url: "https://secure.example.com/b.jpg", nsfwLevel: "None" },
      ],
      metadata: {},
    })
  );
  const candidates = await collect(civitaiImporter, baseOpts({ fetchImpl: impl }));
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].sourceRef, "2");
});

test("eagle: pageUrl c http:// не попадает в кандидата", async () => {
  await withTempHome(async () => {
    const libDir = fs.mkdtempSync(path.join(os.tmpdir(), "nullume-eagle-"));
    const itemDir = path.join(libDir, "images", "IT1.info");
    fs.mkdirSync(itemDir, { recursive: true });
    fs.writeFileSync(path.join(itemDir, "pic.jpg"), "x");

    const { impl } = recordingFetch((url) => {
      if (url.includes("/api/library/info")) return json({ data: { library: { path: libDir } } });
      if (url.includes("offset=0")) {
        return json({
          data: [{ id: "IT1", name: "pic", ext: "jpg", url: "http://insecure.example.com/page" }],
          data_count: 1,
          total_count: 1,
        });
      }
      return json({ data: [], data_count: 0, total_count: 1 });
    });

    const candidates = await collect(eagleImporter, baseOpts({ limit: 1, fetchImpl: impl }));
    fs.rmSync(libDir, { recursive: true, force: true });

    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].pageUrl, undefined, "http:// pageUrl должен быть отброшен");
  });
});

/* ------------------------------------------------------------------ */
/* sourceRef уникален в пределах ответа фикстуры                        */
/* ------------------------------------------------------------------ */

function assertUniqueRefs(candidates: RefCandidate[]): void {
  assert.ok(candidates.length > 1, "нужно больше одного кандидата, иначе проверка бессмысленна");
  const refs = candidates.map((c) => c.sourceRef);
  assert.ok(
    refs.every((r) => typeof r === "string" && r.length > 0),
    "sourceRef должен быть непустой строкой"
  );
  assert.equal(new Set(refs).size, refs.length, `sourceRef не уникальны: ${refs.join(", ")}`);
}

test("arena: sourceRef уникальны в пределах ответа", async () => {
  const { impl } = recordingFetch(() =>
    json({
      contents: [1, 2, 3].map((id) => ({
        id,
        class: "Image",
        image: { large: { url: `https://cdn.example.com/${id}.jpg` } },
      })),
      total_count: 3,
    })
  );
  assertUniqueRefs(await collect(arenaImporter, baseOpts({ collection: "design", fetchImpl: impl })));
});

test("civitai: sourceRef уникальны в пределах ответа", async () => {
  const { impl } = recordingFetch(() =>
    json({
      items: [1, 2, 3].map((id) => ({ id, url: `https://cdn.example.com/${id}.jpg`, nsfwLevel: "None" })),
      metadata: {},
    })
  );
  assertUniqueRefs(await collect(civitaiImporter, baseOpts({ fetchImpl: impl })));
});

test("pexels: sourceRef уникальны в пределах ответа", async () => {
  const { impl } = recordingFetch(() =>
    json({
      page: 1,
      per_page: 80,
      total_results: 3,
      photos: [1, 2, 3].map((id) => ({
        id,
        width: 1,
        height: 1,
        url: `https://www.pexels.com/photo/${id}/`,
        photographer: "A",
        photographer_url: "https://www.pexels.com/@a",
        avg_color: "#fff",
        alt: "",
        src: { original: "", large2x: `https://images.pexels.com/${id}.jpg`, large: "", medium: "", small: "", portrait: "", landscape: "", tiny: "" },
      })),
    })
  );
  assertUniqueRefs(await collect(pexels, baseOpts({ query: "n", config: keyed.pexels, fetchImpl: impl })));
});

test("unsplash: sourceRef уникальны в пределах ответа", async () => {
  const { impl } = recordingFetch(() =>
    json({
      total: 3,
      total_pages: 1,
      results: ["a", "b", "c"].map((id) => ({
        id,
        created_at: "",
        updated_at: "",
        width: 1,
        height: 1,
        color: "#fff",
        urls: { raw: "", full: "", regular: `https://images.unsplash.com/${id}.jpg`, small: "", thumb: "" },
        links: { self: "", html: `https://unsplash.com/photos/${id}`, download: "", download_location: "" },
        likes: 0,
        user: { id, username: id, name: id, first_name: id },
      })),
    })
  );
  assertUniqueRefs(await collect(unsplash, baseOpts({ query: "n", config: keyed.unsplash, fetchImpl: impl })));
});

test("pixabay: sourceRef уникальны в пределах ответа", async () => {
  await withTempHome(async () => {
    const { impl } = recordingFetch(() =>
      json({
        total: 3,
        totalHits: 3,
        hits: [1, 2, 3].map((id) => ({
          id,
          pageURL: `https://pixabay.com/photos/${id}/`,
          type: "photo",
          tags: "a, b",
          largeImageURL: `https://cdn.pixabay.com/${id}.jpg`,
          imageWidth: 1,
          imageHeight: 1,
          user: "u",
        })),
      })
    );
    assertUniqueRefs(
      await collect(pixabay, baseOpts({ query: "unique-refs", config: keyed.pixabay, fetchImpl: impl }))
    );
  });
});

test("raindrop: sourceRef уникальны в пределах ответа", async () => {
  const { impl } = recordingFetch((url) => {
    if (url.includes("page=0")) {
      return json({
        result: true,
        count: 3,
        items: [1, 2, 3].map((id) => ({
          _id: id,
          link: `https://example.com/${id}`,
          cover: `https://cdn.example.com/${id}.jpg`,
          domain: "example.com",
          tags: [],
        })),
      });
    }
    return json({ result: true, count: 3, items: [] });
  });
  assertUniqueRefs(
    await collect(raindropImporter, baseOpts({ limit: 3, config: keyed.raindrop, fetchImpl: impl }))
  );
});

test("pinterest-api: sourceRef уникальны в пределах ответа", async () => {
  const { impl } = recordingFetch(() =>
    json({
      items: ["p1", "p2", "p3"].map((id) => ({
        id,
        media: { images: { "1200x": { url: `https://i.pinimg.com/${id}.jpg` } } },
      })),
    })
  );
  assertUniqueRefs(
    await collect(
      pinterestApiImporter,
      baseOpts({ collection: "b1", limit: 3, config: keyed.pinterest, fetchImpl: impl })
    )
  );
});

test("shotcafe: sourceRef уникальны в пределах страницы", async () => {
  const html = [1, 2, 3]
    .map((i) => `<img src="https://shot.cafe/images/t/film-slug-${i}.jpg">`)
    .join("\n");
  const { impl } = recordingFetch(() => new Response(html, { status: 200 }));
  assertUniqueRefs(await collect(shotcafeImporter, baseOpts({ collection: "noir", limit: 3, fetchImpl: impl })));
});

test("rss: sourceRef уникальны в пределах ленты", async () => {
  await withTempHome(async () => {
    const items = [1, 2, 3]
      .map(
        (i) => `<item>
        <title>Пост ${i}</title>
        <link>https://onepagelove.com/post-${i}</link>
        <description>&lt;img src="https://cdn.example.com/${i}.jpg"&gt;</description>
        <content:encoded><![CDATA[<img src="https://cdn.example.com/${i}.jpg">]]></content:encoded>
      </item>`
      )
      .join("\n");
    const { impl } = recordingFetch(
      () => new Response(`<?xml version="1.0"?><rss><channel>${items}</channel></rss>`, { status: 200 })
    );
    assertUniqueRefs(
      await collect(rssImporter, baseOpts({ collection: "onepagelove", limit: 10, fetchImpl: impl }))
    );
  });
});

/* ------------------------------------------------------------------ */
/* RSS: элемент без картинки пропускается                               */
/* ------------------------------------------------------------------ */

test("rss: элемент без картинок пропускается, остальные отдаются", async () => {
  await withTempHome(async () => {
    const xml = `<?xml version="1.0"?><rss><channel>
      <item>
        <title>Без картинки</title>
        <link>https://onepagelove.com/no-image</link>
        <content:encoded><![CDATA[<p>только текст, без картинок</p>]]></content:encoded>
      </item>
      <item>
        <title>С картинкой</title>
        <link>https://onepagelove.com/with-image</link>
        <content:encoded><![CDATA[<img src="https://cdn.example.com/ok.jpg">]]></content:encoded>
      </item>
    </channel></rss>`;
    const logs: string[] = [];
    const { impl } = recordingFetch(() => new Response(xml, { status: 200 }));
    const candidates = await collect(
      rssImporter,
      baseOpts({ collection: "onepagelove", limit: 10, fetchImpl: impl, log: (m) => logs.push(m) })
    );
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].sourceRef, "onepagelove:https://onepagelove.com/with-image");
    assert.ok(
      logs.some((l) => l.includes("не найдена картинка")),
      "пропуск должен быть залогирован"
    );
  });
});

test("rss: элемент с http:// картинкой в контенте пропускается", async () => {
  await withTempHome(async () => {
    const xml = `<?xml version="1.0"?><rss><channel>
      <item>
        <title>Небезопасная картинка</title>
        <link>https://onepagelove.com/insecure</link>
        <content:encoded><![CDATA[<img src="http://cdn.example.com/insecure.jpg">]]></content:encoded>
      </item>
    </channel></rss>`;
    const { impl } = recordingFetch(() => new Response(xml, { status: 200 }));
    const candidates = await collect(
      rssImporter,
      baseOpts({ collection: "onepagelove", limit: 10, fetchImpl: impl })
    );
    assert.equal(candidates.length, 0, "extractImgSrcs отдаёт только https");
  });
});

test("rss: элемент без link пропускается", async () => {
  await withTempHome(async () => {
    const xml = `<?xml version="1.0"?><rss><channel>
      <item><title>Без ссылки</title><content:encoded><![CDATA[<img src="https://cdn.example.com/a.jpg">]]></content:encoded></item>
    </channel></rss>`;
    const { impl } = recordingFetch(() => new Response(xml, { status: 200 }));
    const candidates = await collect(
      rssImporter,
      baseOpts({ collection: "onepagelove", limit: 10, fetchImpl: impl })
    );
    assert.equal(candidates.length, 0);
  });
});
