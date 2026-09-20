import { randomUUID } from "node:crypto";
import type { Provider } from "../providers/types.js";
import type { Job } from "./model.js";
import { createJob } from "./model.js";
import { saveJob } from "./store.js";

export interface CreateJobOptions {
  model: string;
  prompt: string;
  images?: string[];
  input?: Record<string, unknown>;
  style?: string;
}

export async function createJobTask(
  provider: Provider,
  options: CreateJobOptions
): Promise<Job> {
  const { model: modelId, prompt, images = [], input = {}, style } = options;

  // Resolve model
  const modelInfo = await provider.model(modelId);

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
