import { getModelsDir } from "../../core/paths.js";
import { normalize } from "./math.js";

/**
 * Минимальный интерфейс для модуля @huggingface/transformers
 */
export interface TransformersModule {
  env: {
    allowRemoteModels: boolean;
    cacheDir: string;
    logLevel?: string;
  };
  CLIPVisionModelWithProjection?: {
    from_pretrained(model: string, opts?: any): Promise<any>;
  };
  CLIPTextModelWithProjection?: {
    from_pretrained(model: string, opts?: any): Promise<any>;
  };
  SiglipVisionModel?: {
    from_pretrained(model: string, opts?: any): Promise<any>;
  };
  SiglipTextModel?: {
    from_pretrained(model: string, opts?: any): Promise<any>;
  };
  AutoProcessor?: {
    from_pretrained(model: string, opts?: any): Promise<any>;
  };
  AutoTokenizer?: {
    from_pretrained(model: string, opts?: any): Promise<any>;
  };
  RawImage?: {
    read(path: string): Promise<any>;
  };
}

/**
 * Интерфейс для встраивателя изображений и текста
 */
export interface Embedder {
  model: string;
  dim: number;
  embedImage(path: string): Promise<Float32Array>;
  embedText(text: string): Promise<Float32Array>;
}

/**
 * Текст подсказки при отсутствии пакета трансформеров
 */
export function modelNotInstalledHint(): string {
  return `Пакет @huggingface/transformers не установлен. Установи его командой:
  npm install @huggingface/transformers

Затем инициализируй модели:
  nullume lib init`;
}

/**
 * Получить встраиватель с поддержкой CLIP или SigLIP
 * Возвращает null если пакет не установлен
 */
export async function getEmbedder(opts?: {
  model?: "clip" | "siglip";
  loader?: () => Promise<TransformersModule>;
}): Promise<Embedder | null> {
  const modelName = opts?.model || "clip";

  let transformers: TransformersModule;
  try {
    if (opts?.loader) {
      transformers = await opts.loader();
    } else {
      // @ts-expect-error optionalDependency
      transformers = (await import("@huggingface/transformers")) as TransformersModule;
    }
  } catch (e) {
    if ((e as any)?.code === "ERR_MODULE_NOT_FOUND") {
      return null;
    }
    throw e;
  }

  // Гарантируем что allowRemoteModels = false
  transformers.env.allowRemoteModels = false;
  transformers.env.cacheDir = getModelsDir();

  if (modelName === "clip") {
    return createCLIPEmbedder(transformers);
  } else {
    return createSigLIPEmbedder(transformers);
  }
}

/**
 * Создать CLIP встраиватель
 */
async function createCLIPEmbedder(
  transformers: TransformersModule
): Promise<Embedder> {
  const modelId = "Xenova/clip-vit-base-patch32";

  const visionModel = await transformers.CLIPVisionModelWithProjection!.from_pretrained(
    modelId,
    { dtype: "fp32" }
  );
  const textModel = await transformers.CLIPTextModelWithProjection!.from_pretrained(
    modelId,
    { dtype: "fp32" }
  );
  const processor = await transformers.AutoProcessor!.from_pretrained(modelId);
  const tokenizer = await transformers.AutoTokenizer!.from_pretrained(modelId);

  return {
    model: modelId,
    dim: 512,

    async embedImage(path: string): Promise<Float32Array> {
      const image = await transformers.RawImage!.read(path);
      const imageInputs = await processor(image);
      const imageEmbeddings = await visionModel(imageInputs);

      const vec = new Float32Array(imageEmbeddings.image_embeds.data);
      normalize(vec);
      return vec;
    },

    async embedText(text: string): Promise<Float32Array> {
      const textInputs = await tokenizer(text, {
        padding: "max_length",
        truncation: true,
        max_length: 77,
      });
      const textEmbeddings = await textModel(textInputs);

      const vec = new Float32Array(textEmbeddings.text_embeds.data);
      normalize(vec);
      return vec;
    },
  };
}

/**
 * Создать SigLIP встраиватель
 */
async function createSigLIPEmbedder(
  transformers: TransformersModule
): Promise<Embedder> {
  const modelId = "Xenova/siglip-base-patch16-224";

  const visionModel = await transformers.SiglipVisionModel!.from_pretrained(
    modelId,
    { dtype: "fp32" }
  );
  const textModel = await transformers.SiglipTextModel!.from_pretrained(
    modelId,
    { dtype: "fp32" }
  );
  const processor = await transformers.AutoProcessor!.from_pretrained(modelId);
  const tokenizer = await transformers.AutoTokenizer!.from_pretrained(modelId);

  return {
    model: modelId,
    dim: 768,

    async embedImage(path: string): Promise<Float32Array> {
      const image = await transformers.RawImage!.read(path);
      const imageInputs = await processor(image);
      const imageEmbeddings = await visionModel(imageInputs);

      const vec = new Float32Array(imageEmbeddings.last_hidden_state.data);
      normalize(vec);
      return vec;
    },

    async embedText(text: string): Promise<Float32Array> {
      const textInputs = await tokenizer(text, {
        padding: "max_length",
        truncation: true,
        max_length: 77,
      });
      const textEmbeddings = await textModel(textInputs);

      const vec = new Float32Array(textEmbeddings.last_hidden_state.data);
      normalize(vec);
      return vec;
    },
  };
}
