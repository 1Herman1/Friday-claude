import { extractInputSchema, deriveModelMeta } from "./schema.js";
import type { ExtractedField } from "./schema.js";
import type { ModelInfo } from "../types.js";

export async function fetchAndParseSchema(
  docUrl: string,
  fetchImpl: typeof fetch = fetch
): Promise<Record<string, any>> {
  try {
    const response = await fetchImpl(docUrl, {
      signal: AbortSignal.timeout(20000),
    });

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > 2 * 1024 * 1024) {
      throw new Error(`Response too large: ${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB`);
    }

    const markdown = new TextDecoder().decode(buffer);
    const fields = extractInputSchema(markdown);
    const fieldsMap: Record<string, any> = {};

    for (const field of fields) {
      fieldsMap[field.name] = {
        type: field.type,
        required: field.required,
        description: field.description,
        enum: field.enum,
        default: field.default,
      };
    }

    return fieldsMap;
  } catch (e) {
    return {};
  }
}

export async function buildModelFromLiveEntry(
  id: string,
  category: string,
  description: string,
  docUrl: string,
  fetchImpl: typeof fetch = fetch
): Promise<ModelInfo> {
  const fields = await fetchAndParseSchema(docUrl, fetchImpl);

  const extractedFields: ExtractedField[] = Object.entries(fields).map(([name, spec]) => ({
    name,
    type: spec.type,
    required: Boolean(spec.required),
    description: spec.description,
    enum: spec.enum ?? [],
    default: spec.default ?? null,
    constraints: {},
  }));

  const meta = deriveModelMeta(extractedFields);

  return {
    id,
    category: category as any,
    api: "jobs",
    docUrl,
    fields,
    meta,
    description: sanitizeDescription(description),
    schemaSource: "docs" as const,
    stale: false,
    source: "live" as const,
  };
}

export function sanitizeDescription(desc: string | undefined): string | undefined {
  if (!desc) return undefined;
  // Remove markdown links [text](url) -> text
  let cleaned = desc.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  // Remove newlines and extra whitespace
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  // Truncate to 300 chars
  if (cleaned.length > 300) {
    cleaned = cleaned.slice(0, 297) + "...";
  }
  return cleaned;
}
