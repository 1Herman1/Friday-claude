/**
 * Apply pre-authored style descriptors to the taste library
 */

import { z } from "zod";
import type { LibraryStore } from "../store/types.js";
import { StyleDescriptorSchema, validateDescriptor } from "./descriptor.js";
import { applyProposal } from "./propose.js";
import { approveFamily } from "./index.js";
import { UsageError } from "../../core/errors.js";

/**
 * Input style entry (omits name, slug, exemplars from descriptor)
 */
const StyleEntrySchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens")
    .min(1),
  name: z.string().min(1, "Name required"),
  tag: z.string().min(1, "Tag required"),
  descriptor: z.unknown(), // Full validation happens after building the descriptor
});

const ApplyStyleFileSchema = z.object({
  styles: z.array(StyleEntrySchema).min(1),
});

type ApplyStyleFileInput = z.infer<typeof ApplyStyleFileSchema>;

/**
 * Result of applying style files
 */
export interface ApplyStyleFileResult {
  applied: string[];
  skipped: Array<{
    slug: string;
    reason: string;
  }>;
}

/**
 * Apply pre-authored style descriptors from a file
 */
export function applyStyleFile(
  store: LibraryStore,
  payload: unknown,
  opts: { dryRun?: boolean; log: (msg: string) => void }
): ApplyStyleFileResult {
  const result = ApplyStyleFileSchema.safeParse(payload);
  if (!result.success) {
    const messages = result.error.issues.map((issue) => {
      const path = issue.path.join(".");
      return `${path || "root"}: ${issue.message}`;
    });
    throw new UsageError(`Invalid style file:\n${messages.join("\n")}`);
  }

  const input = result.data;
  const applied: string[] = [];
  const skipped: Array<{ slug: string; reason: string }> = [];

  for (const style of input.styles) {
    const { slug, name, tag, descriptor: descriptorInput } = style;

    // Step 1: Find all refs with this tag
    const refIds = store.listRefIdsByTag(tag);
    if (refIds.length === 0) {
      const reason = `Пропуск ${slug}: нет активных референсов с тегом ${tag}`;
      opts.log(`⚠ ${reason}`);
      skipped.push({ slug, reason });
      continue;
    }

    try {
      if (!opts.dryRun) {
        // Step 2: Get or create family
        let family = store.getFamilyBySlug(slug);
        if (!family) {
          const newFamilyData = {
            slug,
            name,
            status: "proposed" as const,
            proposedBy: "owner" as const,
          };
          family = store.createFamily(newFamilyData);

          // Set members if family is new
          const familyId = family.id;
          store.setMembers(
            familyId,
            refIds.map((refId, i) => ({
              familyId: familyId,
              refId,
              distance: 0,
              isExemplar: i < 4, // First 4 are exemplars
            }))
          );
        }

        // Step 3: Build full descriptor
        const familyId = family.id;
        const members = store.getMembers(familyId);
        const exemplarMembers = members.filter((m) => m.isExemplar);
        const exemplars =
          exemplarMembers.length > 0
            ? exemplarMembers.map((m) => m.refId).slice(0, 8)
            : refIds.slice(0, 8);

        const fullDescriptor = {
          ...(descriptorInput as Record<string, unknown>),
          name,
          slug,
          exemplars,
        };

        // Validate full descriptor - throws if invalid
        const validated = validateDescriptor(fullDescriptor);

        // Step 4: Apply proposal
        const proposal = {
          families: [
            {
              familyId: familyId,
              name,
              slug,
              descriptor: validated,
            },
          ],
        };

        try {
          applyProposal(store, proposal);
        } catch (e) {
          const msg = (e as Error).message;
          throw new UsageError(`Стиль ${slug}: ${msg}`);
        }

        // Step 5: Approve family
        approveFamily(store, familyId);

        applied.push(slug);
        opts.log(`✓ Стиль применён: ${slug}`);
      } else {
        // Dry-run: just validate
        const fullDescriptor = {
          ...(descriptorInput as Record<string, unknown>),
          name,
          slug,
          exemplars: refIds.slice(0, 8),
        };

        validateDescriptor(fullDescriptor);
        applied.push(slug);
        opts.log(`✓ [сухой прогон] Стиль валиден: ${slug}`);
      }
    } catch (e) {
      // Re-throw UsageError (validation errors, applyProposal errors) with slug prefix
      if (e instanceof UsageError) {
        if (e.message.includes(`Стиль ${slug}:`)) {
          // Already prefixed
          throw e;
        } else {
          throw new UsageError(`Стиль ${slug}: ${e.message}`);
        }
      }
      // Unknown errors also propagate
      throw e;
    }
  }

  return { applied, skipped };
}
