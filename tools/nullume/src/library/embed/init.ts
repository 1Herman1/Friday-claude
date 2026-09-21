import fs from "node:fs";
import { promisify } from "node:util";
import { getModelsDir, ensureDir } from "../../core/paths.js";
import { TransformersModule } from "./index.js";

const statfs = promisify(fs.statfs);

interface DownloadModelsOptions {
  model?: "clip" | "siglip";
  loader?: () => Promise<TransformersModule>;
  log?: (msg: string) => void;
}

interface DownloadModelsResult {
  model: string;
  dim: number;
  cacheDir: string;
}

/**
 * Загрузить модели embeddings с дискового кэша в getModelsDir()
 * Единственное место где allowRemoteModels = true
 */
export async function downloadModels(
  opts: DownloadModelsOptions = {}
): Promise<DownloadModelsResult> {
  const modelType = opts.model || "clip";
  const log = opts.log || (() => {});
  const cacheDir = getModelsDir();

  // Проверяем свободное место
  await ensureDir(cacheDir);
  const stats = await statfs(cacheDir);
  const freeMB = Math.floor((stats.bavail * stats.bsize) / (1024 * 1024));

  if (freeMB < 500) {
    throw new Error(
      `Недостаточно свободного места. Требуется ≥ 500 МБ, доступно ${freeMB} МБ`
    );
  }

  log(`📥 Загрузка моделей для ${modelType.toUpperCase()}...`);
  log(`📍 Кэш: ${cacheDir}`);
  log(`💾 Свободного места: ${freeMB} МБ`);

  let transformers: TransformersModule;
  try {
    if (opts.loader) {
      transformers = await opts.loader();
    } else {
      // @ts-expect-error optionalDependency
      transformers = (await import("@huggingface/transformers")) as TransformersModule;
    }
  } catch (e) {
    if ((e as any)?.code === "ERR_MODULE_NOT_FOUND") {
      throw new Error(
        "Пакет @huggingface/transformers не установлен. " +
        "Установи: npm install @huggingface/transformers"
      );
    }
    throw e;
  }

  // ЕДИНСТВЕННОЕ место где allowRemoteModels = true
  transformers.env.allowRemoteModels = true;
  transformers.env.cacheDir = cacheDir;

  try {
    if (modelType === "clip") {
      await downloadCLIPModels(transformers, log);
      return { model: "Xenova/clip-vit-base-patch32", dim: 512, cacheDir };
    } else {
      await downloadSigLIPModels(transformers, log);
      return { model: "Xenova/siglip-base-patch16-224", dim: 768, cacheDir };
    }
  } finally {
    // Гарантируем что удалённая загрузка выключена
    transformers.env.allowRemoteModels = false;
  }
}

/**
 * Загрузить CLIP модели
 */
async function downloadCLIPModels(
  transformers: TransformersModule,
  log: (msg: string) => void
): Promise<void> {
  const modelId = "Xenova/clip-vit-base-patch32";

  log(`  📦 Vision model...`);
  await transformers.CLIPVisionModelWithProjection!.from_pretrained(
    modelId,
    { progress_callback: (progress: any) => {
      if (progress.status === "progress" && progress.progress) {
        const pct = Math.round(progress.progress);
        if (pct % 10 === 0) log(`    ⏳ ${pct}%`);
      }
    } }
  );

  log(`  📦 Text model...`);
  await transformers.CLIPTextModelWithProjection!.from_pretrained(
    modelId,
    { progress_callback: (progress: any) => {
      if (progress.status === "progress" && progress.progress) {
        const pct = Math.round(progress.progress);
        if (pct % 10 === 0) log(`    ⏳ ${pct}%`);
      }
    } }
  );

  log(`  📦 Processor...`);
  await transformers.AutoProcessor!.from_pretrained(modelId);

  log(`  📦 Tokenizer...`);
  await transformers.AutoTokenizer!.from_pretrained(modelId);

  log(`✅ CLIP модели загружены`);
}

/**
 * Загрузить SigLIP модели
 */
async function downloadSigLIPModels(
  transformers: TransformersModule,
  log: (msg: string) => void
): Promise<void> {
  const modelId = "Xenova/siglip-base-patch16-224";

  log(`  📦 Vision model...`);
  await transformers.SiglipVisionModel!.from_pretrained(
    modelId,
    { progress_callback: (progress: any) => {
      if (progress.status === "progress" && progress.progress) {
        const pct = Math.round(progress.progress);
        if (pct % 10 === 0) log(`    ⏳ ${pct}%`);
      }
    } }
  );

  log(`  📦 Text model...`);
  await transformers.SiglipTextModel!.from_pretrained(
    modelId,
    { progress_callback: (progress: any) => {
      if (progress.status === "progress" && progress.progress) {
        const pct = Math.round(progress.progress);
        if (pct % 10 === 0) log(`    ⏳ ${pct}%`);
      }
    } }
  );

  log(`  📦 Processor...`);
  await transformers.AutoProcessor!.from_pretrained(modelId);

  log(`  📦 Tokenizer...`);
  await transformers.AutoTokenizer!.from_pretrained(modelId);

  log(`✅ SigLIP модели загружены`);
}
