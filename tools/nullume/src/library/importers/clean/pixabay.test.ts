import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { pixabay } from "./pixabay.js";
import { ConfigError, UsageError } from "../../../core/errors.js";
import { NullumeConfig } from "../../../core/config.js";

const pixabayFixture = {
  total: 2,
  totalHits: 2,
  hits: [
    {
      id: 1,
      pageURL: "https://pixabay.com/photos/example-1/",
      type: "photo",
      tags: "nature, landscape, mountain",
      previewURL: "https://cdn.pixabay.com/photo/example-1-preview.jpg",
      previewWidth: 150,
      previewHeight: 100,
      webformatURL: "https://cdn.pixabay.com/photo/example-1-webformat.jpg",
      webformatWidth: 640,
      webformatHeight: 427,
      largeImageURL: "https://cdn.pixabay.com/photo/example-1-large.jpg",
      imageWidth: 1920,
      imageHeight: 1280,
      imageSize: 1024000,
      views: 100,
      downloads: 50,
      favorites: 10,
      likes: 25,
      comments: 5,
      user_id: 1,
      user: "John Doe",
      userImageURL: "https://cdn.pixabay.com/user/example-1-avatar.jpg",
    },
    {
      id: 2,
      pageURL: "https://pixabay.com/photos/example-2/",
      type: "photo",
      tags: "city, urban, street",
      previewURL: "https://cdn.pixabay.com/photo/example-2-preview.jpg",
      previewWidth: 150,
      previewHeight: 100,
      webformatURL: "https://cdn.pixabay.com/photo/example-2-webformat.jpg",
      webformatWidth: 640,
      webformatHeight: 427,
      largeImageURL: "https://cdn.pixabay.com/photo/example-2-large.jpg",
      imageWidth: 1600,
      imageHeight: 1200,
      imageSize: 921600,
      views: 200,
      downloads: 100,
      favorites: 20,
      likes: 50,
      comments: 10,
      user_id: 2,
      user: "Jane Smith",
      userImageURL: "https://cdn.pixabay.com/user/example-2-avatar.jpg",
    },
  ],
};

test("pixabay: configure должен выбросить ConfigError без ключа", async () => {
  const config: NullumeConfig = {};
  const env: NodeJS.ProcessEnv = {};

  await assert.rejects(
    () => pixabay.configure(config, env),
    (err) => err instanceof ConfigError
  );
});

test("pixabay: configure должен пройти с ключом в config", async () => {
  const config: NullumeConfig = {
    importers: { pixabay: { key: "test_key_pixabay" } },
  };
  const env: NodeJS.ProcessEnv = {};

  await assert.doesNotReject(() => pixabay.configure(config, env));
});

test("pixabay: configure должен пройти с ключом в env", async () => {
  const config: NullumeConfig = {};
  const oldKey = process.env.PIXABAY_API_KEY;

  try {
    process.env.PIXABAY_API_KEY = "test_key_pixabay";
    await assert.doesNotReject(() => pixabay.configure(config, process.env));
  } finally {
    if (oldKey !== undefined) {
      process.env.PIXABAY_API_KEY = oldKey;
    } else {
      delete process.env.PIXABAY_API_KEY;
    }
  }
});

test("pixabay: run должен выбросить UsageError без query", async () => {
  const config: NullumeConfig = {
    importers: { pixabay: { key: "test_key" } },
  };

  const opts = {
    limit: 10,
    log: () => {},
    config,
    env: process.env,
  };

  const gen = pixabay.run(opts as any);
  await assert.rejects(() => gen.next(), (err) => err instanceof UsageError);
});

test("pixabay: run должен вернуть кандидатов с правильными полями", async () => {
  const config: NullumeConfig = {
    importers: { pixabay: { key: "test_key" } },
  };

  const mockFetch = async (url: string, init?: RequestInit) => {
    return new Response(JSON.stringify(pixabayFixture), { status: 200 });
  };

  // Create temp cache dir for this test
  const oldHome = process.env.NULLUME_HOME;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nullume-test-"));
  process.env.NULLUME_HOME = tmpDir;

  try {
    const opts = {
      query: "nature",
      limit: 5,
      fetchImpl: mockFetch as typeof fetch,
      log: () => {},
      config,
      env: process.env,
    };

    const candidates = [];
    for await (const candidate of pixabay.run(opts)) {
      candidates.push(candidate);
    }

    assert.equal(candidates.length, 2);

    const first = candidates[0];
    assert.equal(first.source, "pixabay");
    assert.equal(first.sourceRef, "1");
    assert.equal(first.url, "https://cdn.pixabay.com/photo/example-1-large.jpg");
    assert.equal(first.pageUrl, "https://pixabay.com/photos/example-1/");
    assert.equal(first.author, "John Doe");
    assert.equal(first.license, "Pixabay Content License");
    assert(Array.isArray(first.tags));
    assert.deepEqual(first.tags, ["nature", "landscape", "mountain"]);
    assert.equal(first.meta.width, 1920);
    assert.equal(first.meta.height, 1280);
  } finally {
    process.env.NULLUME_HOME = oldHome;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("pixabay: run должен кэшировать результаты на 24 часа (второй запрос не трогает fetchImpl)", async () => {
  const config: NullumeConfig = {
    importers: { pixabay: { key: "test_key" } },
  };

  let fetchCount = 0;
  const mockFetch = async (url: string, init?: RequestInit) => {
    fetchCount++;
    return new Response(JSON.stringify(pixabayFixture), { status: 200 });
  };

  // Create temp cache dir for this test
  const oldHome = process.env.NULLUME_HOME;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nullume-test-"));
  process.env.NULLUME_HOME = tmpDir;

  try {
    // First run
    const opts1 = {
      query: "nature",
      limit: 5,
      fetchImpl: mockFetch as typeof fetch,
      log: () => {},
      config,
      env: process.env,
    };

    const candidates1 = [];
    for await (const candidate of pixabay.run(opts1)) {
      candidates1.push(candidate);
    }

    const fetchCountAfterFirst = fetchCount;
    assert(fetchCountAfterFirst > 0, "First run should fetch");

    // Second run with same query - should use cache
    const opts2 = {
      query: "nature",
      limit: 5,
      fetchImpl: mockFetch as typeof fetch,
      log: () => {},
      config,
      env: process.env,
    };

    const candidates2 = [];
    for await (const candidate of pixabay.run(opts2)) {
      candidates2.push(candidate);
    }

    assert.equal(fetchCount, fetchCountAfterFirst, "Second run should use cache (fetchImpl not called again)");
    assert.equal(candidates2.length, 2);
  } finally {
    process.env.NULLUME_HOME = oldHome;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("pixabay: run должен останавливаться при достижении limit", async () => {
  const config: NullumeConfig = {
    importers: { pixabay: { key: "test_key" } },
  };

  const mockFetch = async (url: string, init?: RequestInit) => {
    return new Response(JSON.stringify(pixabayFixture), { status: 200 });
  };

  // Create temp cache dir for this test
  const oldHome = process.env.NULLUME_HOME;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nullume-test-"));
  process.env.NULLUME_HOME = tmpDir;

  try {
    const opts = {
      query: "nature",
      limit: 1,
      fetchImpl: mockFetch as typeof fetch,
      log: () => {},
      config,
      env: process.env,
    };

    const candidates = [];
    for await (const candidate of pixabay.run(opts)) {
      candidates.push(candidate);
    }

    assert.equal(candidates.length, 1);
  } finally {
    process.env.NULLUME_HOME = oldHome;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
