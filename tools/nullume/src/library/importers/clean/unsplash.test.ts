import { test } from "node:test";
import assert from "node:assert";
import { unsplash } from "./unsplash.js";
import { ConfigError, UsageError } from "../../../core/errors.js";
import { NullumeConfig } from "../../../core/config.js";

const unsplashFixture = {
  total: 2,
  total_pages: 1,
  results: [
    {
      id: "abc123",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-02T00:00:00Z",
      width: 5000,
      height: 3333,
      color: "#FF5733",
      blur_hash: "LeD;=]xt7odoIll6RjWB",
      description: "Beautiful mountain landscape at sunset",
      alt_description: "Mountain landscape at sunset",
      urls: {
        raw: "https://images.unsplash.com/photo-abc123?ixlib=rb-4.0.3",
        full: "https://images.unsplash.com/photo-abc123?ixlib=rb-4.0.3&q=80",
        regular: "https://images.unsplash.com/photo-abc123?ixlib=rb-4.0.3&q=80&w=1080",
        small: "https://images.unsplash.com/photo-abc123?ixlib=rb-4.0.3&q=80&w=400",
        thumb: "https://images.unsplash.com/photo-abc123?ixlib=rb-4.0.3&q=80&w=200",
      },
      links: {
        self: "https://api.unsplash.com/photos/abc123",
        html: "https://unsplash.com/photos/abc123",
        download: "https://unsplash.com/photos/abc123/download",
        download_location: "https://api.unsplash.com/photos/abc123/download",
      },
      likes: 100,
      liked_by_user: false,
      current_user_collections: [],
      user: {
        id: "user123",
        username: "johndoe",
        name: "John Doe",
        first_name: "John",
        last_name: "Doe",
        email: "john@example.com",
        portfolio_url: "https://johndoe.com",
        bio: "Photographer",
        location: "USA",
        total_likes: 1000,
        total_photos: 50,
        total_collections: 10,
        instagram_username: "johndoe",
        twitter_username: "johndoe",
        links: {
          self: "https://api.unsplash.com/users/johndoe",
          html: "https://unsplash.com/@johndoe",
          photos: "https://api.unsplash.com/users/johndoe/photos",
          likes: "https://api.unsplash.com/users/johndoe/likes",
          portfolio: "https://johndoe.com",
          following: "https://api.unsplash.com/users/johndoe/following",
          followers: "https://api.unsplash.com/users/johndoe/followers",
        },
      },
      tags: [{ title: "nature" }, { title: "landscape" }, { title: "mountain" }],
    },
    {
      id: "def456",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-02T00:00:00Z",
      width: 4000,
      height: 2667,
      color: "#3357FF",
      blur_hash: "L3D45{xt7odoIll6RjWB",
      description: "City street photography",
      alt_description: "City street",
      urls: {
        raw: "https://images.unsplash.com/photo-def456?ixlib=rb-4.0.3",
        full: "https://images.unsplash.com/photo-def456?ixlib=rb-4.0.3&q=80",
        regular: "https://images.unsplash.com/photo-def456?ixlib=rb-4.0.3&q=80&w=1080",
        small: "https://images.unsplash.com/photo-def456?ixlib=rb-4.0.3&q=80&w=400",
        thumb: "https://images.unsplash.com/photo-def456?ixlib=rb-4.0.3&q=80&w=200",
      },
      links: {
        self: "https://api.unsplash.com/photos/def456",
        html: "https://unsplash.com/photos/def456",
        download: "https://unsplash.com/photos/def456/download",
        download_location: "https://api.unsplash.com/photos/def456/download",
      },
      likes: 200,
      liked_by_user: false,
      current_user_collections: [],
      user: {
        id: "user456",
        username: "janesmith",
        name: "Jane Smith",
        first_name: "Jane",
        last_name: "Smith",
        email: "jane@example.com",
        portfolio_url: "https://janesmith.com",
        bio: "Urban photographer",
        location: "USA",
        total_likes: 2000,
        total_photos: 100,
        total_collections: 20,
        instagram_username: "janesmith",
        twitter_username: "janesmith",
        links: {
          self: "https://api.unsplash.com/users/janesmith",
          html: "https://unsplash.com/@janesmith",
          photos: "https://api.unsplash.com/users/janesmith/photos",
          likes: "https://api.unsplash.com/users/janesmith/likes",
          portfolio: "https://janesmith.com",
          following: "https://api.unsplash.com/users/janesmith/following",
          followers: "https://api.unsplash.com/users/janesmith/followers",
        },
      },
      tags: [{ title: "city" }, { title: "urban" }, { title: "street" }],
    },
  ],
};

test("unsplash: configure должен выбросить ConfigError без ключа", async () => {
  const config: NullumeConfig = {};
  const env: NodeJS.ProcessEnv = {};

  await assert.rejects(
    () => unsplash.configure(config, env),
    (err) => err instanceof ConfigError
  );
});

test("unsplash: configure должен пройти с ключом в config", async () => {
  const config: NullumeConfig = {
    importers: { unsplash: { key: "test_key_unsplash" } },
  };
  const env: NodeJS.ProcessEnv = {};

  await assert.doesNotReject(() => unsplash.configure(config, env));
});

test("unsplash: configure должен пройти с ключом в env", async () => {
  const config: NullumeConfig = {};
  const oldKey = process.env.UNSPLASH_ACCESS_KEY;

  try {
    process.env.UNSPLASH_ACCESS_KEY = "test_key_unsplash";
    await assert.doesNotReject(() => unsplash.configure(config, process.env));
  } finally {
    if (oldKey !== undefined) {
      process.env.UNSPLASH_ACCESS_KEY = oldKey;
    } else {
      delete process.env.UNSPLASH_ACCESS_KEY;
    }
  }
});

test("unsplash: run должен выбросить UsageError без query", async () => {
  const config: NullumeConfig = {
    importers: { unsplash: { key: "test_key" } },
  };

  const opts = {
    limit: 10,
    log: () => {},
    config,
    env: process.env,
  };

  const gen = unsplash.run(opts as any);
  await assert.rejects(() => gen.next(), (err) => err instanceof UsageError);
});

test("unsplash: run должен вернуть кандидатов с правильными полями", async () => {
  const config: NullumeConfig = {
    importers: { unsplash: { key: "test_key" } },
  };

  const mockFetch = async (url: string, init?: RequestInit) => {
    return new Response(JSON.stringify(unsplashFixture), { status: 200 });
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
  for await (const candidate of unsplash.run(opts)) {
    candidates.push(candidate);
  }

  assert.equal(candidates.length, 2);

  const first = candidates[0];
  assert.equal(first.source, "unsplash");
  assert.equal(first.sourceRef, "abc123");
  assert.equal(first.url, "https://images.unsplash.com/photo-abc123?ixlib=rb-4.0.3&q=80&w=1080");
  assert.equal(first.pageUrl, "https://unsplash.com/photos/abc123");
  assert.equal(first.author, "John Doe");
  assert.equal(first.license, "Unsplash License");
  assert(Array.isArray(first.tags));
  assert.deepEqual(first.tags, ["nature", "landscape", "mountain"]);
  assert.equal(first.meta.width, 5000);
  assert.equal(first.meta.height, 3333);
});

test("unsplash: run должен заполнить meta.downloadLocation", async () => {
  const config: NullumeConfig = {
    importers: { unsplash: { key: "test_key" } },
  };

  const mockFetch = async (url: string, init?: RequestInit) => {
    return new Response(JSON.stringify(unsplashFixture), { status: 200 });
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
  for await (const candidate of unsplash.run(opts)) {
    candidates.push(candidate);
  }

  assert.equal(candidates.length, 1);
  const first = candidates[0];
  assert(first.meta.downloadLocation);
  assert.equal(first.meta.downloadLocation, "https://api.unsplash.com/photos/abc123/download");
});

test("unsplash: run должен останавливаться при достижении limit", async () => {
  const config: NullumeConfig = {
    importers: { unsplash: { key: "test_key" } },
  };

  const mockFetch = async (url: string, init?: RequestInit) => {
    return new Response(JSON.stringify(unsplashFixture), { status: 200 });
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
  for await (const candidate of unsplash.run(opts)) {
    candidates.push(candidate);
  }

  assert.equal(candidates.length, 1);
});

test("unsplash: run должен обрабатывать пустой массив tags", async () => {
  const config: NullumeConfig = {
    importers: { unsplash: { key: "test_key" } },
  };

  const fixtureWithoutTags = {
    ...unsplashFixture,
    results: [
      {
        ...unsplashFixture.results[0],
        tags: undefined,
      },
    ],
  };

  const mockFetch = async (url: string, init?: RequestInit) => {
    return new Response(JSON.stringify(fixtureWithoutTags), { status: 200 });
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
  for await (const candidate of unsplash.run(opts)) {
    candidates.push(candidate);
  }

  assert.equal(candidates.length, 1);
  assert.deepEqual(candidates[0].tags, []);
});
