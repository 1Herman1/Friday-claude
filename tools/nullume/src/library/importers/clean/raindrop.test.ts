import { test } from "node:test";
import assert from "node:assert";
import { raindropImporter } from "./raindrop.js";
import { ConfigError, ProviderError } from "../../../core/errors.js";
import { NullumeConfig } from "../../../core/config.js";

test("raindrop: configure должен выбросить ConfigError без токена", async () => {
  const config: NullumeConfig = {};
  const env: NodeJS.ProcessEnv = {};

  await assert.rejects(
    () => raindropImporter.configure(config, env),
    (err) => err instanceof ConfigError
  );
});

test("raindrop: configure должен пройти с токеном в конфиге", async () => {
  const config: NullumeConfig = {
    importers: {
      raindrop: { token: "test-token" },
    },
  };
  const env: NodeJS.ProcessEnv = {};

  await assert.doesNotReject(() => raindropImporter.configure(config, env));
});

test("raindrop: configure должен пройти с токеном в env", async () => {
  const config: NullumeConfig = {
    importers: {
      raindrop: { token: "test-token" },
    },
  };
  const env: NodeJS.ProcessEnv = {};

  await assert.doesNotReject(() => raindropImporter.configure(config, env));
});

test("raindrop: run должен пагинировать и вернуть кандидаты", async () => {
  let fetchCallCount = 0;

  const mockFetch = async (url: string, opts?: any) => {
    fetchCallCount++;

    const params = new URL(url).searchParams;
    const page = Number(params.get("page")) || 0;

    if (page === 0) {
      return {
        ok: true,
        json: async () => ({
          result: true,
          items: [
            {
              _id: 1,
              link: "https://example.com/image1.jpg",
              cover: "https://cdn.raindrop.io/image1.jpg",
              domain: "example.com",
              tags: ["design", "inspiration"],
              title: "Beautiful Design",
              excerpt: "A great design reference",
              type: "image",
            },
            {
              _id: 2,
              link: "https://example.com/image2.jpg",
              cover: "https://cdn.raindrop.io/image2.jpg",
              domain: "example.com",
              tags: ["ui"],
              title: "UI Component",
            },
          ],
          count: 2,
        }),
      };
    }

    if (page === 1) {
      return {
        ok: true,
        json: async () => ({
          result: true,
          items: [
            {
              _id: 3,
              link: "https://example.com/image3.jpg",
              cover: "https://cdn.raindrop.io/image3.jpg",
              domain: "example.com",
              tags: [],
            },
          ],
          count: 1,
        }),
      };
    }

    return {
      ok: true,
      json: async () => ({
        result: true,
        items: [],
        count: 0,
      }),
    };
  };

  const config: NullumeConfig = {
    importers: {
      raindrop: { token: "test-token" },
    },
  };
  const env: NodeJS.ProcessEnv = {};
  const log = () => {};

  const candidates = [];
  for await (const candidate of raindropImporter.run({
    config,
    env,
    log,
    limit: 5,
    fetchImpl: mockFetch as any,
  })) {
    candidates.push(candidate);
  }

  assert.strictEqual(candidates.length, 3);
  assert.strictEqual(candidates[0].source, "raindrop");
  assert.strictEqual(candidates[0].sourceRef, "1");
  assert.strictEqual(candidates[0].url, "https://cdn.raindrop.io/image1.jpg");
  assert.strictEqual(candidates[0].pageUrl, "https://example.com/image1.jpg");
  assert.deepEqual(candidates[0].tags, ["design", "inspiration"]);
  assert.strictEqual(candidates[0].meta?.title, "Beautiful Design");
});

test("raindrop: run должен уважать limit", async () => {
  const mockFetch = async (url: string, opts?: any) => {
    return {
      ok: true,
      json: async () => ({
        result: true,
        items: [
          {
            _id: 1,
            link: "https://example.com/image1.jpg",
            cover: "https://cdn.raindrop.io/image1.jpg",
            domain: "example.com",
            tags: [],
          },
          {
            _id: 2,
            link: "https://example.com/image2.jpg",
            cover: "https://cdn.raindrop.io/image2.jpg",
            domain: "example.com",
            tags: [],
          },
          {
            _id: 3,
            link: "https://example.com/image3.jpg",
            cover: "https://cdn.raindrop.io/image3.jpg",
            domain: "example.com",
            tags: [],
          },
        ],
        count: 3,
      }),
    };
  };

  const config: NullumeConfig = {
    importers: {
      raindrop: { token: "test-token" },
    },
  };
  const env: NodeJS.ProcessEnv = {};
  const log = () => {};

  const candidates = [];
  for await (const candidate of raindropImporter.run({
    config,
    env,
    log,
    limit: 2,
    fetchImpl: mockFetch as any,
  })) {
    candidates.push(candidate);
  }

  assert.strictEqual(candidates.length, 2);
});

test("raindrop: run должен пропустить кандидата без cover", async () => {
  const logMessages: string[] = [];

  const mockFetch = async (url: string, opts?: any) => {
    const params = new URL(url).searchParams;
    const page = Number(params.get("page")) || 0;

    if (page === 0) {
      return {
        ok: true,
        json: async () => ({
          result: true,
          items: [
            {
              _id: 1,
              link: "https://example.com/page",
              domain: "example.com",
              tags: [],
            },
            {
              _id: 2,
              link: "https://example.com/image.jpg",
              cover: "https://cdn.raindrop.io/image.jpg",
              domain: "example.com",
              tags: [],
            },
          ],
          count: 2,
        }),
      };
    }

    return {
      ok: true,
      json: async () => ({
        result: true,
        items: [],
        count: 0,
      }),
    };
  };

  const config: NullumeConfig = {
    importers: {
      raindrop: { token: "test-token" },
    },
  };
  const env: NodeJS.ProcessEnv = {};
  const log = (msg: string) => logMessages.push(msg);

  const candidates = [];
  for await (const candidate of raindropImporter.run({
    config,
    env,
    log,
    limit: 100,
    fetchImpl: mockFetch as any,
  })) {
    candidates.push(candidate);
  }

  assert.strictEqual(candidates.length, 1);
  assert(logMessages.some((m) => m.includes("без cover")));
});

test("raindrop: run должен выбросить ProviderError при 401", async () => {
  const mockFetch = async (url: string, opts?: any) => {
    return {
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    };
  };

  const config: NullumeConfig = {
    importers: {
      raindrop: { token: "bad-token" },
    },
  };
  const env: NodeJS.ProcessEnv = {};
  const log = () => {};

  const iterator = raindropImporter.run({
    config,
    env,
    log,
    limit: 100,
    fetchImpl: mockFetch as any,
  });

  let caughtError: Error | undefined;
  try {
    for await (const _ of iterator) {
      // consume
    }
  } catch (e) {
    caughtError = e as Error;
  }

  assert(caughtError instanceof ProviderError);
  assert(caughtError.message.includes("Raindrop"));
});
