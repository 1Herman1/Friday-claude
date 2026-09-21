import { test } from "node:test";
import assert from "node:assert";
import { pexels } from "./pexels.js";
import { ConfigError, UsageError } from "../../../core/errors.js";
import { NullumeConfig } from "../../../core/config.js";

const pexelsFixture = {
  page: 1,
  per_page: 80,
  photos: [
    {
      id: 1,
      width: 5000,
      height: 3333,
      url: "https://www.pexels.com/photo/1/",
      photographer: "John Doe",
      photographer_url: "https://www.pexels.com/@johndoe/",
      avg_color: "#FF5733",
      src: {
        original: "https://images.pexels.com/photos/1/original.jpg",
        large2x: "https://images.pexels.com/photos/1/large2x.jpg",
        large: "https://images.pexels.com/photos/1/large.jpg",
        medium: "https://images.pexels.com/photos/1/medium.jpg",
        small: "https://images.pexels.com/photos/1/small.jpg",
        portrait: "https://images.pexels.com/photos/1/portrait.jpg",
        landscape: "https://images.pexels.com/photos/1/landscape.jpg",
        tiny: "https://images.pexels.com/photos/1/tiny.jpg",
      },
      alt: "Beautiful landscape",
    },
    {
      id: 2,
      width: 4000,
      height: 2667,
      url: "https://www.pexels.com/photo/2/",
      photographer: "Jane Smith",
      photographer_url: "https://www.pexels.com/@janesmith/",
      avg_color: "#3357FF",
      src: {
        original: "https://images.pexels.com/photos/2/original.jpg",
        large2x: "https://images.pexels.com/photos/2/large2x.jpg",
        large: "https://images.pexels.com/photos/2/large.jpg",
        medium: "https://images.pexels.com/photos/2/medium.jpg",
        small: "https://images.pexels.com/photos/2/small.jpg",
        portrait: "https://images.pexels.com/photos/2/portrait.jpg",
        landscape: "https://images.pexels.com/photos/2/landscape.jpg",
        tiny: "https://images.pexels.com/photos/2/tiny.jpg",
      },
      alt: "Mountain view",
    },
  ],
  total_results: 2,
};

test("pexels: configure должен выбросить ConfigError без ключа", async () => {
  const config: NullumeConfig = {};
  const env: NodeJS.ProcessEnv = {};

  await assert.rejects(
    () => pexels.configure(config, env),
    (err) => err instanceof ConfigError
  );
});

test("pexels: configure должен пройти с ключом в config", async () => {
  const config: NullumeConfig = {
    importers: { pexels: { key: "test_key_pexels" } },
  };
  const env: NodeJS.ProcessEnv = {};

  await assert.doesNotReject(() => pexels.configure(config, env));
});

test("pexels: configure должен пройти с ключом в env", async () => {
  const config: NullumeConfig = {};
  const oldKey = process.env.PEXELS_API_KEY;

  try {
    process.env.PEXELS_API_KEY = "test_key_pexels";
    await assert.doesNotReject(() => pexels.configure(config, process.env));
  } finally {
    if (oldKey !== undefined) {
      process.env.PEXELS_API_KEY = oldKey;
    } else {
      delete process.env.PEXELS_API_KEY;
    }
  }
});

test("pexels: run должен выбросить UsageError без query", async () => {
  const config: NullumeConfig = {
    importers: { pexels: { key: "test_key" } },
  };

  const opts = {
    limit: 10,
    log: () => {},
    config,
    env: process.env,
  };

  const gen = pexels.run(opts as any);
  await assert.rejects(() => gen.next(), (err) => err instanceof UsageError);
});

test("pexels: run должен вернуть кандидатов с правильными полями", async () => {
  const config: NullumeConfig = {
    importers: { pexels: { key: "test_key" } },
  };

  let callCount = 0;
  const mockFetch = async (url: string, init?: RequestInit) => {
    callCount++;
    return new Response(JSON.stringify(pexelsFixture), { status: 200 });
  };

  const opts = {
    query: "nature",
    limit: 5,
    fetchImpl: mockFetch as typeof fetch,
    log: () => {},
    config,
    env: process.env,
  };

  const candidates = [];
  for await (const candidate of pexels.run(opts)) {
    candidates.push(candidate);
  }

  assert.equal(candidates.length, 2);

  const first = candidates[0];
  assert.equal(first.source, "pexels");
  assert.equal(first.sourceRef, "1");
  assert.equal(first.url, "https://images.pexels.com/photos/1/large2x.jpg");
  assert.equal(first.pageUrl, "https://www.pexels.com/photo/1/");
  assert.equal(first.author, "John Doe");
  assert.equal(first.license, "Pexels License");
  assert(Array.isArray(first.tags));
  assert.equal(first.meta.alt, "Beautiful landscape");
  assert.equal(first.meta.width, 5000);
  assert.equal(first.meta.height, 3333);
});

test("pexels: run должен останавливаться при достижении limit", async () => {
  const config: NullumeConfig = {
    importers: { pexels: { key: "test_key" } },
  };

  const mockFetch = async (url: string, init?: RequestInit) => {
    return new Response(JSON.stringify(pexelsFixture), { status: 200 });
  };

  const opts = {
    query: "nature",
    limit: 1,
    fetchImpl: mockFetch as typeof fetch,
    log: () => {},
    config,
    env: process.env,
  };

  const candidates = [];
  for await (const candidate of pexels.run(opts)) {
    candidates.push(candidate);
  }

  assert.equal(candidates.length, 1);
});
