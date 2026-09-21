import { test } from "node:test";
import assert from "node:assert/strict";
import { getEmbedder, modelNotInstalledHint } from "./index.js";

test("getEmbedder: возвращает null если пакет не установлен", async () => {
  const embedder = await getEmbedder({
    loader: async () => {
      const err = new Error("Cannot find module");
      (err as any).code = "ERR_MODULE_NOT_FOUND";
      throw err;
    },
  });

  assert.strictEqual(embedder, null);
});

test("modelNotInstalledHint: содержит инструкции", () => {
  const hint = modelNotInstalledHint();
  assert.ok(hint.includes("npm install"));
  assert.ok(hint.includes("@huggingface/transformers"));
  assert.ok(hint.includes("nullume lib init"));
});

test("getEmbedder: работает с фейковым loader для CLIP", async () => {
  const mockModule = {
    env: {
      allowRemoteModels: false,
      cacheDir: "",
      logLevel: "error",
    },
    CLIPVisionModelWithProjection: {
      async from_pretrained() {
        return {
          async call(inputs: any) {
            // Возвращаем объект с image_embeds
            return {
              image_embeds: {
                data: new Float32Array(512).fill(0.5),
              },
            };
          },
        };
      },
    },
    CLIPTextModelWithProjection: {
      async from_pretrained() {
        return {
          async call(inputs: any) {
            return {
              text_embeds: {
                data: new Float32Array(512).fill(0.25),
              },
            };
          },
        };
      },
    },
    AutoProcessor: {
      async from_pretrained() {
        return {
          async call(image: any) {
            return {};
          },
        };
      },
    },
    AutoTokenizer: {
      async from_pretrained() {
        return {
          async call(text: string, opts: any) {
            return {};
          },
        };
      },
    },
    RawImage: {
      async read(path: string) {
        return {};
      },
    },
  };

  const embedder = await getEmbedder({
    model: "clip",
    loader: async () => mockModule as any,
  });

  assert.ok(embedder !== null);
  assert.strictEqual(embedder!.model, "Xenova/clip-vit-base-patch32");
  assert.strictEqual(embedder!.dim, 512);

  // Проверяем что allowRemoteModels остаётся false
  assert.strictEqual(mockModule.env.allowRemoteModels, false);
});

test("getEmbedder: работает с фейковым loader для SigLIP", async () => {
  const mockModule = {
    env: {
      allowRemoteModels: false,
      cacheDir: "",
      logLevel: "error",
    },
    SiglipVisionModel: {
      async from_pretrained() {
        return {
          async call(inputs: any) {
            return {
              last_hidden_state: {
                data: new Float32Array(768).fill(0.3),
              },
            };
          },
        };
      },
    },
    SiglipTextModel: {
      async from_pretrained() {
        return {
          async call(inputs: any) {
            return {
              last_hidden_state: {
                data: new Float32Array(768).fill(0.2),
              },
            };
          },
        };
      },
    },
    AutoProcessor: {
      async from_pretrained() {
        return {
          async call(image: any) {
            return {};
          },
        };
      },
    },
    AutoTokenizer: {
      async from_pretrained() {
        return {
          async call(text: string, opts: any) {
            return {};
          },
        };
      },
    },
    RawImage: {
      async read(path: string) {
        return {};
      },
    },
  };

  const embedder = await getEmbedder({
    model: "siglip",
    loader: async () => mockModule as any,
  });

  assert.ok(embedder !== null);
  assert.strictEqual(embedder!.model, "Xenova/siglip-base-patch16-224");
  assert.strictEqual(embedder!.dim, 768);

  // Проверяем что allowRemoteModels остаётся false
  assert.strictEqual(mockModule.env.allowRemoteModels, false);
});

test("getEmbedder: другие ошибки пробрасываются", async () => {
  await assert.rejects(
    () =>
      getEmbedder({
        loader: async () => {
          throw new Error("Connection timeout");
        },
      }),
    /Connection timeout/
  );
});
