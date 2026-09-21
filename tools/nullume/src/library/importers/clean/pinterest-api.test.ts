import { test } from "node:test";
import assert from "node:assert";
import { pinterestApiImporter } from "./pinterest-api.js";
import { ConfigError, ProviderError } from "../../../core/errors.js";
import { NullumeConfig } from "../../../core/config.js";

test("pinterest-api: configure должен выбросить ConfigError без токена", async () => {
  const config: NullumeConfig = {};
  const env: NodeJS.ProcessEnv = {};

  await assert.rejects(
    () => pinterestApiImporter.configure(config, env),
    (err) => err instanceof ConfigError
  );
});

test("pinterest-api: configure должен пройти с токеном в конфиге", async () => {
  const config: NullumeConfig = {
    importers: {
      pinterest: { accessToken: "test-token" },
    },
  };
  const env: NodeJS.ProcessEnv = {};

  await assert.doesNotReject(() => pinterestApiImporter.configure(config, env));
});

test("pinterest-api: configure должен пройти с токеном в env", async () => {
  const config: NullumeConfig = {
    importers: {
      pinterest: { accessToken: "test-token" },
    },
  };
  const env: NodeJS.ProcessEnv = {};

  await assert.doesNotReject(() => pinterestApiImporter.configure(config, env));
});

test("pinterest-api: run без collection должен вывести список досок и выйти", async () => {
  const logMessages: string[] = [];

  const mockFetch = async (url: string, opts?: any) => {
    if (url.includes("/v5/boards")) {
      return {
        ok: true,
        json: async () => ({
          items: [
            { id: "board1", name: "Design Inspiration" },
            { id: "board2", name: "UI Components" },
          ],
          bookmark: undefined,
        }),
      };
    }

    throw new Error(`Unexpected URL: ${url}`);
  };

  const config: NullumeConfig = {
    importers: {
      pinterest: { accessToken: "test-token" },
    },
  };
  const env: NodeJS.ProcessEnv = {};
  const log = (msg: string) => logMessages.push(msg);

  const candidates = [];
  for await (const candidate of pinterestApiImporter.run({
    config,
    env,
    log,
    limit: 100,
    fetchImpl: mockFetch as any,
  })) {
    candidates.push(candidate);
  }

  assert.strictEqual(candidates.length, 0);
  assert(logMessages.some((m) => m.includes("Доступные доски")));
  assert(logMessages.some((m) => m.includes("Design Inspiration")));
  assert(logMessages.some((m) => m.includes("board1")));
});

test("pinterest-api: run с collection должен пагинировать и вернуть кандидаты", async () => {
  let fetchCallCount = 0;

  const mockFetch = async (url: string, opts?: any) => {
    fetchCallCount++;

    if (url.includes("/v5/boards/board1/pins")) {
      const params = new URL(url).searchParams;
      const bookmark = params.get("bookmark");

      if (!bookmark) {
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                id: "pin1",
                title: "Design 1",
                description: "Beautiful design",
                alt_text: "a design pattern",
                media: {
                  images: {
                    "1200x": { url: "https://cdn.pinimg.com/design1-1200x.jpg" },
                    "600x": { url: "https://cdn.pinimg.com/design1-600x.jpg" },
                  },
                },
              },
              {
                id: "pin2",
                title: "Design 2",
                media: {
                  images: {
                    "600x": { url: "https://cdn.pinimg.com/design2-600x.jpg" },
                  },
                },
              },
            ],
            bookmark: "next-page",
          }),
        };
      }

      if (bookmark === "next-page") {
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                id: "pin3",
                title: "Design 3",
                media: {
                  images: {
                    "1200x": { url: "https://cdn.pinimg.com/design3-1200x.jpg" },
                  },
                },
              },
            ],
            bookmark: undefined,
          }),
        };
      }
    }

    throw new Error(`Unexpected URL: ${url}`);
  };

  const config: NullumeConfig = {
    importers: {
      pinterest: { accessToken: "test-token" },
    },
  };
  const env: NodeJS.ProcessEnv = {};
  const log = () => {};

  const candidates = [];
  for await (const candidate of pinterestApiImporter.run({
    config,
    env,
    log,
    limit: 10,
    collection: "board1",
    fetchImpl: mockFetch as any,
  })) {
    candidates.push(candidate);
  }

  assert.strictEqual(candidates.length, 3);
  assert.strictEqual(candidates[0].source, "pinterest-api");
  assert.strictEqual(candidates[0].sourceRef, "pin1");
  assert.strictEqual(candidates[0].url, "https://cdn.pinimg.com/design1-1200x.jpg");
  assert.strictEqual(candidates[0].pageUrl, "https://www.pinterest.com/pin/pin1/");
  assert.strictEqual(candidates[0].meta?.title, "Design 1");
  assert.strictEqual(candidates[0].meta?.alt_text, "a design pattern");
});

test("pinterest-api: run должен выбирать 1200x если доступно", async () => {
  const mockFetch = async (url: string, opts?: any) => {
    if (url.includes("/v5/boards/board1/pins")) {
      return {
        ok: true,
        json: async () => ({
          items: [
            {
              id: "pin1",
              media: {
                images: {
                  "1200x": { url: "https://cdn.pinimg.com/image-1200x.jpg" },
                  "600x": { url: "https://cdn.pinimg.com/image-600x.jpg" },
                },
              },
            },
          ],
          bookmark: undefined,
        }),
      };
    }

    throw new Error(`Unexpected URL: ${url}`);
  };

  const config: NullumeConfig = {
    importers: {
      pinterest: { accessToken: "test-token" },
    },
  };
  const env: NodeJS.ProcessEnv = {};
  const log = () => {};

  const candidates = [];
  for await (const candidate of pinterestApiImporter.run({
    config,
    env,
    log,
    limit: 100,
    collection: "board1",
    fetchImpl: mockFetch as any,
  })) {
    candidates.push(candidate);
  }

  assert.strictEqual(candidates.length, 1);
  assert.strictEqual(candidates[0].url, "https://cdn.pinimg.com/image-1200x.jpg");
});

test("pinterest-api: run должен выбирать 600x если 1200x нет", async () => {
  const mockFetch = async (url: string, opts?: any) => {
    if (url.includes("/v5/boards/board1/pins")) {
      return {
        ok: true,
        json: async () => ({
          items: [
            {
              id: "pin1",
              media: {
                images: {
                  "600x": { url: "https://cdn.pinimg.com/image-600x.jpg" },
                },
              },
            },
          ],
          bookmark: undefined,
        }),
      };
    }

    throw new Error(`Unexpected URL: ${url}`);
  };

  const config: NullumeConfig = {
    importers: {
      pinterest: { accessToken: "test-token" },
    },
  };
  const env: NodeJS.ProcessEnv = {};
  const log = () => {};

  const candidates = [];
  for await (const candidate of pinterestApiImporter.run({
    config,
    env,
    log,
    limit: 100,
    collection: "board1",
    fetchImpl: mockFetch as any,
  })) {
    candidates.push(candidate);
  }

  assert.strictEqual(candidates.length, 1);
  assert.strictEqual(candidates[0].url, "https://cdn.pinimg.com/image-600x.jpg");
});

test("pinterest-api: run должен пропустить pin без изображения", async () => {
  const logMessages: string[] = [];

  const mockFetch = async (url: string, opts?: any) => {
    if (url.includes("/v5/boards/board1/pins")) {
      return {
        ok: true,
        json: async () => ({
          items: [
            {
              id: "pin1",
              media: {
                images: {},
              },
            },
            {
              id: "pin2",
              media: {
                images: {
                  "600x": { url: "https://cdn.pinimg.com/image-600x.jpg" },
                },
              },
            },
          ],
          bookmark: undefined,
        }),
      };
    }

    throw new Error(`Unexpected URL: ${url}`);
  };

  const config: NullumeConfig = {
    importers: {
      pinterest: { accessToken: "test-token" },
    },
  };
  const env: NodeJS.ProcessEnv = {};
  const log = (msg: string) => logMessages.push(msg);

  const candidates = [];
  for await (const candidate of pinterestApiImporter.run({
    config,
    env,
    log,
    limit: 100,
    collection: "board1",
    fetchImpl: mockFetch as any,
  })) {
    candidates.push(candidate);
  }

  assert.strictEqual(candidates.length, 1);
  assert(logMessages.some((m) => m.includes("без изображения")));
});

test("pinterest-api: run должен уважать limit", async () => {
  const mockFetch = async (url: string, opts?: any) => {
    if (url.includes("/v5/boards/board1/pins")) {
      return {
        ok: true,
        json: async () => ({
          items: [
            {
              id: "pin1",
              media: { images: { "600x": { url: "https://cdn.pinimg.com/1.jpg" } } },
            },
            {
              id: "pin2",
              media: { images: { "600x": { url: "https://cdn.pinimg.com/2.jpg" } } },
            },
            {
              id: "pin3",
              media: { images: { "600x": { url: "https://cdn.pinimg.com/3.jpg" } } },
            },
          ],
          bookmark: undefined,
        }),
      };
    }

    throw new Error(`Unexpected URL: ${url}`);
  };

  const config: NullumeConfig = {
    importers: {
      pinterest: { accessToken: "test-token" },
    },
  };
  const env: NodeJS.ProcessEnv = {};
  const log = () => {};

  const candidates = [];
  for await (const candidate of pinterestApiImporter.run({
    config,
    env,
    log,
    limit: 2,
    collection: "board1",
    fetchImpl: mockFetch as any,
  })) {
    candidates.push(candidate);
  }

  assert.strictEqual(candidates.length, 2);
});

test("pinterest-api: run должен выбросить ProviderError при 401", async () => {
  const mockFetch = async (url: string, opts?: any) => {
    return {
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    };
  };

  const config: NullumeConfig = {
    importers: {
      pinterest: { accessToken: "bad-token" },
    },
  };
  const env: NodeJS.ProcessEnv = {};
  const log = () => {};

  const iterator = pinterestApiImporter.run({
    config,
    env,
    log,
    limit: 100,
    collection: "board1",
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
  assert(caughtError.message.includes("Pinterest"));
});
