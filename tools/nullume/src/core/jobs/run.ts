import { assertUploadable } from "../files.js";
import { getDownloadsDir, getLibraryPreviewsDir } from "../paths.js";
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
  libraryStore?: any; // LibraryStore, type only for tests to avoid circular imports
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
  const { model: modelId, prompt, images = [], input = {}, style, fetchImpl = fetch, libraryStore } = options;

  // Resolve model
  let modelInfo = await provider.model(modelId);

  // Resolve and prepare style before checking files (so exemplar paths are known)
  let styleFamily: string | undefined;
  let resolvedStyle: any; // ResolvedStyle
  if (style) {
    const { resolveStyle, applyStyle } = await import("../../library/style/resolve.js");
    resolvedStyle = await resolveStyle(style, libraryStore);
    styleFamily = resolvedStyle.family.slug;
  }

  // Локальные файлы проверяем до любого выхода в сеть: отказ по deny-листу
  // должен случиться раньше, чем уйдёт первый запрос.
  const allowedRoots = [process.cwd(), getDownloadsDir()];
  if (resolvedStyle) {
    allowedRoots.push(getLibraryPreviewsDir());
  }

  for (const img of images) {
    if (!/^https?:\/\//.test(img)) {
      await assertUploadable(img, allowedRoots);
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

  // Apply style if provided
  let finalPrompt = prompt;
  let finalImages = [...images];
  let finalInput = { ...input };

  if (resolvedStyle) {
    const { applyStyle } = await import("../../library/style/resolve.js");
    const applied = applyStyle({
      prompt: finalPrompt,
      images: finalImages,
      input: finalInput,
      modelMeta: modelInfo.meta,
      fields: modelInfo.fields,
      resolved: resolvedStyle,
    });
    finalPrompt = applied.prompt;
    finalImages = applied.images;
    finalInput = applied.input;
  }

  // Add prompt (only if not already in input)
  if (modelInfo.meta.promptField && !(modelInfo.meta.promptField in finalInput)) {
    finalInput[modelInfo.meta.promptField] = finalPrompt;
  }

  // Add images (only if not already in input)
  if (finalImages.length > 0 && modelInfo.meta.imageField && !(modelInfo.meta.imageField in finalInput)) {
    const imageUrls: string[] = [];
    for (const img of finalImages) {
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

  if (styleFamily) job.styleFamily = styleFamily;

  await saveJob(job);
  return job;
}
