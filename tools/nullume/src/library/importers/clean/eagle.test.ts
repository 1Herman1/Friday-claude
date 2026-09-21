import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { eagleImporter } from "./eagle.js";
import { ConfigError, ProviderError } from "../../../core/errors.js";
import { NullumeConfig } from "../../../core/config.js";

test("eagle: configure должен отказать если host не loopback", async () => {
  const config: NullumeConfig = {
    importers: {
      eagle: { url: "http://example.com:41595" },
    },
  };
  const env: NodeJS.ProcessEnv = {};

  await assert.rejects(
    () => eagleImporter.configure(config, env),
    (err) => err instanceof ConfigError
  );
});

test("eagle: configure должен пройти для localhost", async () => {
  const config: NullumeConfig = {
    importers: {
      eagle: { url: "http://localhost:41595" },
    },
  };
  const env: NodeJS.ProcessEnv = {};

  await assert.doesNotReject(() => eagleImporter.configure(config, env));
});

test("eagle: configure должен пройти для 127.0.0.1", async () => {
  const config: NullumeConfig = {
    importers: {
      eagle: { url: "http://127.0.0.1:41595" },
    },
  };
  const env: NodeJS.ProcessEnv = {};

  await assert.doesNotReject(() => eagleImporter.configure(config, env));
});

test("eagle: run должен вернуть кандидаты с filePath", async () => {
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "eagle-test-"));
  const libraryPath = tmpDir;
  const imagePath = path.join(libraryPath, "images", "test-id.info", "image.jpg");
  await fs.promises.mkdir(path.dirname(imagePath), { recursive: true });
  await fs.promises.writeFile(imagePath, "fake image data");

  const mockFetch = async (url: string | URL | Request, opts?: any) => {
    const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;

    if (urlStr.includes("/api/library/info")) {
      return new Response(
        JSON.stringify({
          data: {
            library: {
              path: libraryPath,
            },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    if (urlStr.includes("/api/item/list")) {
      const urlObj = new URL(urlStr);
      const offset = Number(urlObj.searchParams.get("offset")) || 0;

      // Вернуть данные только на первом запросе (offset=0)
      if (offset === 0) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: "test-id",
                name: "image",
                ext: "jpg",
                tags: ["tag1", "tag2"],
                folders: ["folder1"],
                url: "https://example.com/image.jpg",
                palettes: [{ color: [255, 0, 0], ratio: 0.5 }],
                width: 1920,
                height: 1080,
              },
            ],
            data_count: 1,
            total_count: 1,
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      // На последующих запросах вернуть пустой массив
      return new Response(
        JSON.stringify({
          data: [],
          data_count: 0,
          total_count: 1,
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    throw new Error(`Unexpected URL: ${urlStr}`);
  };

  const config: NullumeConfig = {
    importers: {
      eagle: { url: "http://localhost:41595" },
    },
  };
  const env: NodeJS.ProcessEnv = {};
  const log = () => {};

  const candidates = [];
  for await (const candidate of eagleImporter.run({
    config,
    env,
    log,
    limit: 100,
    fetchImpl: mockFetch as any,
  })) {
    candidates.push(candidate);
  }

  assert.strictEqual(candidates.length, 1);
  assert.strictEqual(candidates[0].source, "eagle");
  assert.strictEqual(candidates[0].sourceRef, "test-id");
  assert.strictEqual(candidates[0].filePath, imagePath);
  assert.strictEqual(candidates[0].pageUrl, "https://example.com/image.jpg");
  assert.deepEqual(candidates[0].tags, ["tag1", "tag2"]);
  assert.strictEqual(candidates[0].palette?.length, 1);

  await fs.promises.rm(tmpDir, { recursive: true });
});

test("eagle: run должен пропустить несуществующие файлы", async () => {
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "eagle-test-"));

  const mockFetch = async (url: string | URL | Request, opts?: any) => {
    const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;

    if (urlStr.includes("/api/library/info")) {
      return new Response(
        JSON.stringify({
          data: {
            library: {
              path: tmpDir,
            },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    if (urlStr.includes("/api/item/list")) {
      const urlObj = new URL(urlStr);
      const offset = Number(urlObj.searchParams.get("offset")) || 0;

      if (offset === 0) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: "nonexistent-id",
                name: "image",
                ext: "jpg",
                tags: [],
                folders: [],
              },
            ],
            data_count: 1,
            total_count: 1,
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          data: [],
          data_count: 0,
          total_count: 1,
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    throw new Error(`Unexpected URL: ${urlStr}`);
  };

  const config: NullumeConfig = {
    importers: {
      eagle: { url: "http://localhost:41595" },
    },
  };
  const env: NodeJS.ProcessEnv = {};
  const logMessages: string[] = [];
  const log = (msg: string) => logMessages.push(msg);

  const candidates = [];
  for await (const candidate of eagleImporter.run({
    config,
    env,
    log,
    limit: 100,
    fetchImpl: mockFetch as any,
  })) {
    candidates.push(candidate);
  }

  assert.strictEqual(candidates.length, 0);
  assert(logMessages.some((m) => m.includes("не найден")));

  await fs.promises.rm(tmpDir, { recursive: true });
});

test("eagle: run должен фильтровать по коллекции", async () => {
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "eagle-test-"));
  const imagePath = path.join(tmpDir, "images", "test-id.info", "image.jpg");
  await fs.promises.mkdir(path.dirname(imagePath), { recursive: true });
  await fs.promises.writeFile(imagePath, "fake image data");

  const mockFetch = async (url: string | URL | Request, opts?: any) => {
    const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;

    if (urlStr.includes("/api/library/info")) {
      return new Response(
        JSON.stringify({
          data: {
            library: {
              path: tmpDir,
            },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    if (urlStr.includes("/api/item/list")) {
      const urlObj = new URL(urlStr);
      const offset = Number(urlObj.searchParams.get("offset")) || 0;

      if (offset === 0) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: "test-id",
                name: "image",
                ext: "jpg",
                folders: ["other-folder"],
              },
            ],
            data_count: 1,
            total_count: 1,
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          data: [],
          data_count: 0,
          total_count: 1,
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    throw new Error(`Unexpected URL: ${urlStr}`);
  };

  const config: NullumeConfig = {
    importers: {
      eagle: { url: "http://localhost:41595" },
    },
  };
  const env: NodeJS.ProcessEnv = {};
  const log = () => {};

  const candidates = [];
  for await (const candidate of eagleImporter.run({
    config,
    env,
    log,
    limit: 100,
    collection: "my-folder",
    fetchImpl: mockFetch as any,
  })) {
    candidates.push(candidate);
  }

  assert.strictEqual(candidates.length, 0);

  await fs.promises.rm(tmpDir, { recursive: true });
});

test("eagle: run должен передавать палитру", async () => {
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "eagle-test-"));
  const imagePath = path.join(tmpDir, "images", "test-id.info", "image.jpg");
  await fs.promises.mkdir(path.dirname(imagePath), { recursive: true });
  await fs.promises.writeFile(imagePath, "fake image data");

  const mockFetch = async (url: string | URL | Request, opts?: any) => {
    const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;

    if (urlStr.includes("/api/library/info")) {
      return new Response(
        JSON.stringify({
          data: {
            library: {
              path: tmpDir,
            },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    if (urlStr.includes("/api/item/list")) {
      const urlObj = new URL(urlStr);
      const offset = Number(urlObj.searchParams.get("offset")) || 0;

      if (offset === 0) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: "test-id",
                name: "image",
                ext: "jpg",
                palettes: [
                  { color: [255, 0, 0], ratio: 0.3 },
                  { color: [0, 255, 0], ratio: 0.7 },
                ],
              },
            ],
            data_count: 1,
            total_count: 1,
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          data: [],
          data_count: 0,
          total_count: 1,
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    throw new Error(`Unexpected URL: ${urlStr}`);
  };

  const config: NullumeConfig = {
    importers: {
      eagle: { url: "http://localhost:41595" },
    },
  };
  const env: NodeJS.ProcessEnv = {};
  const log = () => {};

  const candidates = [];
  for await (const candidate of eagleImporter.run({
    config,
    env,
    log,
    limit: 100,
    fetchImpl: mockFetch as any,
  })) {
    candidates.push(candidate);
  }

  assert.strictEqual(candidates.length, 1);
  assert.strictEqual(candidates[0].palette?.length, 2);
  assert.deepEqual(candidates[0].palette?.[0], { color: [255, 0, 0], ratio: 0.3 });

  await fs.promises.rm(tmpDir, { recursive: true });
});
