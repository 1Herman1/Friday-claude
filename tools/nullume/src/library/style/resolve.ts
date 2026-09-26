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

/**
 * Convert hex color to nearest common English color name
 */
function hexToColorName(hex: string): string {
  const h = hex.toLowerCase().replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);

  // Named colors with RGB values
  const colors: Array<[string, number, number, number]> = [
    ["black", 0, 0, 0],
    ["white", 255, 255, 255],
    ["red", 255, 0, 0],
    ["green", 0, 128, 0],
    ["blue", 0, 0, 255],
    ["yellow", 255, 255, 0],
    ["cyan", 0, 255, 255],
    ["magenta", 255, 0, 255],
    ["gray", 128, 128, 128],
    ["navy", 0, 0, 128],
    ["teal", 0, 128, 128],
    ["olive", 128, 128, 0],
    ["maroon", 128, 0, 0],
    ["purple", 128, 0, 128],
    ["silver", 192, 192, 192],
    ["orange", 255, 165, 0],
    ["brown", 165, 42, 42],
    ["pink", 255, 192, 203],
    ["cream", 255, 253, 208],
    ["ivory", 255, 255, 240],
    ["sand", 194, 178, 128],
    ["terracotta", 230, 126, 34],
    ["sage", 137, 155, 104],
  ];

  // Find closest color by Euclidean distance
  let closest = colors[0];
  let minDist = Infinity;

  for (const [name, cr, cg, cb] of colors) {
    const dist = Math.sqrt((r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2);
    if (dist < minDist) {
      minDist = dist;
      closest = [name, cr, cg, cb];
    }
  }

  return closest[0];
}

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
    // Build palette description
    let promptWithStyle = descriptor.prompt_fragment;
    const bgColor = descriptor.palette.find((p) => p.role === "bg");
    const accentColor = descriptor.palette.find((p) => p.role === "accent");
    const surfaceColor = descriptor.palette.find((p) => p.role === "surface");

    if (bgColor || accentColor) {
      const colorNames: string[] = [];
      if (bgColor) {
        colorNames.push(`${hexToColorName(bgColor.hex)} background`);
      }
      if (accentColor) {
        colorNames.push(`${hexToColorName(accentColor.hex)} accents`);
      }
      if (surfaceColor && surfaceColor.hex !== bgColor?.hex) {
        colorNames.push(`${hexToColorName(surfaceColor.hex)} surfaces`);
      }

      if (colorNames.length > 0) {
        promptWithStyle += `. Colour palette: ${colorNames.join(", ")}.`;
      }
    }

    newPrompt = `${prompt}. ${promptWithStyle}`;
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
