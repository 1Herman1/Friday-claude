import { assertUploadable } from "../files.js";
import { getDownloadsDir } from "../paths.js";
import { randomUUID } from "node:crypto";
import type { Provider, ModelInfo } from "../providers/types.js";
import type { Job } from "./model.js";
import { createJob } from "./model.js";
import { saveJob } from "./store.js";
import { extractInputSchema, deriveModelMeta } from "../providers/kie/schema.js";
import { getCachedSchema, setCachedSchema } from "../cache.js";

export interface CreateJobOptions {
  model: string;
  prompt: string;
  images?: string[];
  input?: Record<string, unknown>;
  style?: string;
  fetchImpl?: typeof fetch;
}

async function fetchLiveSchema(
  docUrl: string,
  fetchImpl: typeof fetch = fetch
): Promise<any | null> {
  try {
    const response = await fetchImpl(docUrl, {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return null;
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > 2 * 1024 * 1024) {
      return null;
    }

    const markdown = new TextDecoder().decode(buffer);
    return extractInputSchema(markdown);
  } catch {
    return null;
  }
}

function compareMetadata(vendored: ModelInfo, liveMeta: any): string[] {
  const differences: string[] = [];

  const liveRequired = liveMeta.map((f: any) => f.name).filter((n: any) => {
    return liveMeta.find((f: any) => f.name === n)?.required;
  }).sort();

  const vendoredRequired = vendored.meta.required.sort();

  if (JSON.stringify(liveRequired) !== JSON.stringify(vendoredRequired)) {
    differences.push(`required fields changed: ${JSON.stringify(vendoredRequired)} → ${JSON.stringify(liveRequired)}`);
  }

  const livePromptField = ["prompt", "text", "input_text", "description"].find((name) =>
    liveMeta.some((f: any) => f.name === name)
  );

  if (livePromptField !== vendored.meta.promptField) {
    differences.push(`prompt field changed: ${vendored.meta.promptField} → ${livePromptField}`);
  }

  return differences;
}

export async function createJobTask(
  provider: Provider,
  options: CreateJobOptions
): Promise<Job> {
  const { model: modelId, prompt, images = [], input = {}, style, fetchImpl = fetch } = options;

  // Resolve model
  let modelInfo = await provider.model(modelId);

  // Локальные файлы проверяем до любого выхода в сеть: отказ по deny-листу
  // должен случиться раньше, чем уйдёт первый запрос.
  for (const img of images) {
    if (!/^https?:\/\//.test(img)) {
      await assertUploadable(img, [process.cwd(), getDownloadsDir()]);
    }
  }

  // Check live schema if docUrl is available
  if (modelInfo.docUrl) {
    try {
      // Try cache first
      let liveSchema = await getCachedSchema(modelInfo.docUrl);

      if (!liveSchema) {
        // Fetch live schema
        liveSchema = await fetchLiveSchema(modelInfo.docUrl, fetchImpl);
        if (liveSchema) {
          // Cache it
          await setCachedSchema(modelInfo.docUrl, liveSchema);
        }
      }

      if (liveSchema && Array.isArray(liveSchema)) {
        // Derive live metadata
        const liveMeta = deriveModelMeta(liveSchema);
        const differences = compareMetadata(modelInfo, liveSchema);

        if (differences.length > 0) {
          console.error(
            `⚠️  Schema change for ${modelId}: ${differences.join("; ")}`
          );
          // Use live metadata
          modelInfo = {
            ...modelInfo,
            meta: liveMeta,
          };
        }
      }
    } catch (e) {
      // Silently fall back to vendored on any error
    }
  }

  // Build input
  let finalInput = { ...input };

  // Add prompt
  if (modelInfo.meta.promptField) {
    finalInput[modelInfo.meta.promptField] = prompt;
  }

  // Add images
  if (images.length > 0 && modelInfo.meta.imageField) {
    const imageUrls: string[] = [];
    for (const img of images) {
      if (img.startsWith("http://") || img.startsWith("https://")) {
        imageUrls.push(img);
      } else {
        // Upload local file
        const url = await provider.upload(img);
        imageUrls.push(url);
      }
    }

    if (modelInfo.meta.imageList) {
      finalInput[modelInfo.meta.imageField] = imageUrls;
    } else if (imageUrls.length > 0) {
      finalInput[modelInfo.meta.imageField] = imageUrls[0];
    }
  }

  // Validate required
  const missing = modelInfo.meta.required.filter((f) => !(f in finalInput));
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(", ")}`);
  }

  // Apply defaults
  for (const [key, value] of Object.entries(modelInfo.meta.defaults)) {
    if (!(key in finalInput)) finalInput[key] = value;
  }

  // Estimate
  const estimate = await provider.estimate(modelId, finalInput);

  // Create task
  const { taskId, api } = await provider.create(modelId, finalInput);

  const job = createJob(randomUUID(), provider.name, api, taskId, modelId, finalInput, estimate ? {
    creditsMin: estimate.creditsMin,
    creditsMax: estimate.creditsMax,
    usdMin: estimate.usdMin,
    usdMax: estimate.usdMax,
  } : undefined);

  if (style) job.styleFamily = style;

  await saveJob(job);
  return job;
}
