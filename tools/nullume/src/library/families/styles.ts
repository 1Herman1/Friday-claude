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
 * Validated style ready for writing
 */
interface ValidatedStyle {
  slug: string;
  name: string;
  tag: string;
  refIds: string[];
  descriptor: unknown;
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

  if (opts.dryRun) {
    // Dry-run: validate everything without writing
    for (const style of input.styles) {
      const { slug, name, tag, descriptor: descriptorInput } = style;

      // Find refs for validation
      const refIds = store.listRefIdsByTag(tag);
      if (refIds.length === 0) {
        const reason = `Пропуск ${slug}: нет активных референсов с тегом ${tag}`;
        opts.log(`⚠ ${reason}`);
        skipped.push({ slug, reason });
        continue;
      }

      // Validate descriptor
      try {
        const fullDescriptor = {
          ...(descriptorInput as Record<string, unknown>),
          name,
          slug,
          exemplars: refIds.slice(0, 8),
        };

        validateDescriptor(fullDescriptor);
        applied.push(slug);
        opts.log(`✓ [сухой прогон] Стиль валиден: ${slug}`);
      } catch (e) {
        if (e instanceof UsageError) {
          throw new UsageError(`Стиль ${slug}: ${e.message}`);
        }
        throw e;
      }
    }

    return { applied, skipped };
  }

  // Phase 1: Validate all styles before writing anything
  const validatedStyles: ValidatedStyle[] = [];
  const invalidStyles: Array<{ slug: string; reason: string }> = [];

  for (const style of input.styles) {
    const { slug, name, tag, descriptor: descriptorInput } = style;

    const refIds = store.listRefIdsByTag(tag);
    if (refIds.length === 0) {
      const reason = `Пропуск ${slug}: нет активных референсов с тегом ${tag}`;
      opts.log(`⚠ ${reason}`);
      skipped.push({ slug, reason });
      continue;
    }

    try {
      // Build descriptor for validation
      const fullDescriptor = {
        ...(descriptorInput as Record<string, unknown>),
        name,
        slug,
        exemplars: refIds.slice(0, 8),
      };

      // Validate (will throw if invalid)
      const validated = validateDescriptor(fullDescriptor);

      validatedStyles.push({
        slug,
        name,
        tag,
        refIds,
        descriptor: validated,
      });
    } catch (e) {
      const reason = e instanceof UsageError ? e.message : (e as Error).message;
      invalidStyles.push({ slug, reason });
    }
  }

  // If any invalid, throw now with all of them listed
  if (invalidStyles.length > 0) {
    const issues = invalidStyles.map((inv) => `  ${inv.slug}: ${inv.reason}`).join("\n");
    throw new UsageError(`Ошибки в стилях:\n${issues}`);
  }

  // Phase 2: Write all validated styles in a transaction
  return store.transaction(() => {
    for (const validated of validatedStyles) {
      const { slug, name, tag, refIds, descriptor } = validated;

      // Get or create family
      let family = store.getFamilyBySlug(slug);

      if (!family) {
        // New family: create and set members
        const newFamilyData = {
          slug,
          name,
          status: "proposed" as const,
          proposedBy: "owner" as const,
        };
        family = store.createFamily(newFamilyData);

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

        // Apply proposal and approve for new family
        const proposal = {
          families: [
            {
              familyId: familyId,
              name,
              slug,
              descriptor,
            },
          ],
        };

        applyProposal(store, proposal);
        approveFamily(store, familyId);

        applied.push(slug);
        opts.log(`✓ Стиль применён: ${slug}`);
      } else {
        // Existing family: check if already approved
        const familyId = family.id;
        const wasApproved = family.status === "approved";

        // Update members if there are new refs
        const existingMembers = store.getMembers(familyId);
        const existingRefIds = new Set(existingMembers.map((m) => m.refId));
        const newRefIds = refIds.filter((id) => !existingRefIds.has(id));

        if (newRefIds.length > 0) {
          // Add new members with isExemplar=false
          const membersToAdd = newRefIds.map((refId) => ({
            familyId: familyId,
            refId,
            distance: 0,
            isExemplar: false,
          }));
          store.setMembers(familyId, [...existingMembers, ...membersToAdd]);
        }

        if (wasApproved) {
          // For already-approved family: update directly without re-proposing
          store.updateFamily(familyId, {
            name,
            slug,
            descriptor,
          });
        } else {
          // For non-approved family: go through proposal path
          const proposal = {
            families: [
              {
                familyId: familyId,
                name,
                slug,
                descriptor,
              },
            ],
          };

          applyProposal(store, proposal);
          approveFamily(store, familyId);
        }

        applied.push(slug);
        opts.log(`✓ Стиль применён: ${slug}`);
      }
    }

    return { applied, skipped };
  });
}
