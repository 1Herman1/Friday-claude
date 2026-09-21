/**
 * Style resolution: find and apply style from library to generation inputs
 */

import type { LibraryStore, Family } from "../store/types.js";
import type { StyleDescriptor } from "../families/descriptor.js";
import type { ModelMeta, FieldSpec } from "../../core/providers/types.js";
import { UsageError } from "../../core/errors.js";
import { getFamilyBySlugOrId } from "../families/index.js";
import { getLibraryPreviewsDir } from "../../core/paths.js";
import fs from "node:fs";
import path from "node:path";

export interface ResolvedStyle {
  family: Family;
  descriptor: StyleDescriptor;
  exemplarPaths: string[];
}

/**
 * Resolve a style by slug or ID from library
 * Requires family to be approved with a descriptor
 */
export async function resolveStyle(slug: string, store?: LibraryStore): Promise<ResolvedStyle> {
  // Open store if not provided
  let libStore = store;
  if (!libStore) {
    // Dynamic import to avoid loading sqlite in CLI/MCP contexts that don't need it
    const { openStore } = await import("../store/sqlite.js");
    libStore = openStore();
  }

  // Find family
  const family = getFamilyBySlugOrId(libStore, slug);
  if (!family) {
    throw new UsageError(`Style "${slug}" not found`);
  }

  // Check status
  if (family.status !== "approved") {
    throw new UsageError(
      `Style "${slug}" is not approved — approve it in nullume lib dashboard`
    );
  }

  // Check descriptor
  if (!family.descriptor) {
    throw new UsageError(
      `Style "${slug}" has no descriptor — approve it in nullume lib dashboard`
    );
  }

  // Parse descriptor (it's stored as unknown, but validated when saved)
  const descriptor = family.descriptor as StyleDescriptor;

  // Find exemplar paths from family members
  const exemplarPaths: string[] = [];
  const members = libStore.getMembers(family.id);
  const exemplars = members.filter((m) => m.isExemplar);

  for (const exemplar of exemplars) {
    const ref = libStore.getReference(exemplar.refId);
    if (ref && ref.previewPath && fs.existsSync(ref.previewPath)) {
      exemplarPaths.push(ref.previewPath);
    }
  }

  return {
    family,
    descriptor,
    exemplarPaths,
  };
}

export interface ApplyStyleParams {
  prompt: string;
  images: string[];
  input: Record<string, unknown>;
  modelMeta: ModelMeta;
  fields?: Record<string, FieldSpec>;
  resolved: ResolvedStyle;
}

export interface AppliedStyle {
  prompt: string;
  images: string[];
  input: Record<string, unknown>;
  applied: string[];
}

/**
 * Apply resolved style to generation inputs
 * Pure function: does not modify inputs, returns new values
 */
export function applyStyle(params: ApplyStyleParams): AppliedStyle {
  const {
    prompt,
    images,
    input,
    modelMeta,
    fields,
    resolved,
  } = params;

  const applied: string[] = [];
  const newInput = { ...input };
  let newPrompt = prompt;
  const newImages = [...images];

  const { descriptor } = resolved;
  const promptField = modelMeta.promptField || "prompt";

  // (a) Apply prompt fragment if user didn't provide prompt in input
  if (
    descriptor.prompt_fragment &&
    !(promptField in newInput) // User didn't override via input
  ) {
    newPrompt = `${prompt}. ${descriptor.prompt_fragment}`;
    applied.push("prompt_fragment");
  }

  // (b) Apply negative fragment if field exists and user didn't provide it
  if (descriptor.negative_fragment && fields) {
    // Find negative prompt field in fields
    const negativeFieldName = ["negative_prompt", "negativePrompt", "negative"].find(
      (name) => name in fields
    );

    if (negativeFieldName && !(negativeFieldName in newInput)) {
      newInput[negativeFieldName] = descriptor.negative_fragment;
      applied.push("negative_fragment");
    }
  }

  // (c) Apply exemplars if no images provided and model has imageField
  if (newImages.length === 0 && modelMeta.imageField && resolved.exemplarPaths.length > 0) {
    // Determine how many exemplars to include
    const exemplarCount = modelMeta.imageList ? 3 : 1;
    const selectedExemplars = resolved.exemplarPaths.slice(0, exemplarCount);

    newImages.push(...selectedExemplars);
    applied.push(`exemplars(${selectedExemplars.length})`);
  }

  return {
    prompt: newPrompt,
    images: newImages,
    input: newInput,
    applied,
  };
}
