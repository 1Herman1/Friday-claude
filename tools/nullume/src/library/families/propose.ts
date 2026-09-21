/**
 * Building proposal contexts and applying family proposals from Claude
 */

import { z } from "zod";
import type { LibraryStore } from "../store/types.js";
import { DESCRIPTOR_TEMPLATE, StyleDescriptorSchema, validateDescriptor } from "./descriptor.js";
import { UsageError } from "../../core/errors.js";
import type { PaletteEntry } from "../store/types.js";

/**
 * Exemplar info for proposal context
 */
export interface ExemplarInfo {
  refId: string;
  previewPath?: string;
  pageUrl?: string;
  source: string;
  tags: string[];
}

/**
 * Aggregate palette from multiple references
 */
export interface AggregatedPalette {
  hex: string;
  ratio: number;
}

/**
 * Context for Claude to fill out a descriptor
 */
export interface ProposalContext {
  familyId: string;
  size: number; // total members in family
  exemplars: ExemplarInfo[];
  paletteAggregate: AggregatedPalette[];
  tagsTop: string[];
  prompts: string[]; // up to 5 meta.prompt values
  instructions: string;
  template: typeof DESCRIPTOR_TEMPLATE;
}

/**
 * Build proposal context for one or more proposed families
 */
export function buildProposalContext(
  store: LibraryStore,
  opts?: {
    familyIds?: string[];
    exemplarsPerFamily?: number;
  }
): ProposalContext[] {
  const exemplarsPerFamily = opts?.exemplarsPerFamily ?? 6;
  let families = store.listFamilies("proposed");

  if (opts?.familyIds && opts.familyIds.length > 0) {
    families = families.filter((f) => opts.familyIds!.includes(f.id));
  }

  return families.map((family) => {
    const members = store.getMembers(family.id);
    const exemplarMembers = members.slice(0, exemplarsPerFamily);

    // Collect exemplar infos
    const exemplars: ExemplarInfo[] = exemplarMembers.map((member) => {
      const ref = store.getReference(member.refId)!;
      return {
        refId: member.refId,
        previewPath: ref.previewPath,
        pageUrl: ref.pageUrl,
        source: ref.source,
        tags: store.getTags(member.refId),
      };
    });

    // Aggregate palette from all members
    const paletteMap = new Map<string, { ratio: number; count: number }>();
    for (const member of members) {
      const palette = store.getPalette(member.refId);
      if (palette) {
        for (const entry of palette) {
          const key = entry.r + "," + entry.g + "," + entry.b;
          const existing = paletteMap.get(key) || { ratio: 0, count: 0 };
          existing.ratio += entry.ratio;
          existing.count += 1;
          paletteMap.set(key, existing);
        }
      }
    }

    // Convert back to hex and sort by aggregate ratio
    const paletteAggregate: AggregatedPalette[] = Array.from(paletteMap.entries())
      .map(([key, data]) => {
        const [r, g, b] = key.split(",").map(Number);
        const hex =
          "#" +
          [r, g, b]
            .map((x) => {
              const hex = x.toString(16);
              return hex.length === 1 ? "0" + hex : hex;
            })
            .join("")
            .toUpperCase();
        return {
          hex,
          ratio: data.ratio / (data.count || 1),
        };
      })
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, 8);

    // Collect top tags
    const tagCounts = new Map<string, number>();
    for (const member of members) {
      const tags = store.getTags(member.refId);
      for (const tag of tags) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }
    const tagsTop = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => tag);

    // Collect prompts (up to 5)
    const prompts: string[] = [];
    for (const member of members) {
      const ref = store.getReference(member.refId)!;
      if (ref.meta?.prompt && typeof ref.meta.prompt === "string" && prompts.length < 5) {
        prompts.push(ref.meta.prompt);
      }
    }

    const instructions = `На основе собранных примеров опишите стиль семейства. Следуйте методике:

1. **Доминирующий паттерн**: Один основной визуальный мотив или подход (сетка, асимметрия, ритм и т.д.)
2. **Расхождения**: Назовите отклонения от основного паттерна — не усредняйте, это мешает стилю
3. **Проверка anti-references**: Убедитесь, что выбор не включает bounce/elastic, контрастность >= 4.5:1

Palette и Tags — только подсказки. Палитра из примеров может быть неполной.
Exemplars показаны только для контекста.

Заполните все поля в template. Промпт и negative-промпт — короче и конкретнее.`;

    return {
      familyId: family.id,
      size: members.length,
      exemplars,
      paletteAggregate,
      tagsTop,
      prompts,
      instructions,
      template: DESCRIPTOR_TEMPLATE,
    };
  });
}

/**
 * Schema for proposal payload
 */
const ProposalFamilySchema = z.object({
  familyId: z.string().uuid(),
  name: z.string().min(1),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
  descriptor: z.unknown(), // Will be validated separately with full schema
});

const ProposalSchema = z.object({
  families: z.array(ProposalFamilySchema).min(1),
});

export type ProposalPayload = z.infer<typeof ProposalSchema>;

/**
 * Apply a proposal (update families with validated descriptors)
 */
export function applyProposal(store: LibraryStore, proposal: unknown): void {
  // Validate proposal structure
  const parsed = ProposalSchema.safeParse(proposal);
  if (!parsed.success) {
    const messages = parsed.error.issues.map((issue) => {
      const path = issue.path.join(".");
      return `${path || "root"}: ${issue.message}`;
    });
    throw new UsageError(`Invalid proposal:\n${messages.join("\n")}`);
  }

  const payload = parsed.data;

  // Collect all non-discarded slugs to check for duplicates
  const existingSlugs = new Set<string>();
  for (const family of store.listFamilies()) {
    if (family.status !== "discarded" && family.slug) {
      existingSlugs.add(family.slug);
    }
  }

  // Validate each family
  for (const fam of payload.families) {
    const family = store.getFamily(fam.familyId);
    if (!family) {
      throw new UsageError(`Family ${fam.familyId} not found`);
    }

    // Check for slug duplicates (excluding this family's current slug)
    if (family.slug !== fam.slug && existingSlugs.has(fam.slug)) {
      throw new UsageError(
        `Family slug "${fam.slug}" already exists. Family ID: ${fam.familyId}, existing family: ${family.id}`
      );
    }

    // Validate descriptor
    const descriptor = validateDescriptor(fam.descriptor);

    // Mark exemplars
    const exemplarIds = new Set(descriptor.exemplars);
    for (const exemplarId of exemplarIds) {
      const members = store.getMembers(fam.familyId);
      for (const member of members) {
        if (member.refId === exemplarId) {
          // Mark via updating family (store doesn't have direct exemplar flag)
          // So we just store it for reference
        }
      }
    }

    // Update family
    store.updateFamily(fam.familyId, {
      name: fam.name,
      slug: fam.slug,
      descriptor: descriptor as unknown,
      proposedBy: "claude",
      status: "proposed",
    });

    // Record decision
    store.recordDecision({
      familyId: fam.familyId,
      action: "approve",
      payload: { name: fam.name, slug: fam.slug },
      actor: "owner",
    });
  }
}
