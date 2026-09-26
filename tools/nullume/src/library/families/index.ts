/**
 * Family CRUD operations and management
 */

import type { LibraryStore, Family } from "../store/types.js";
import { UsageError } from "../../core/errors.js";

/**
 * Convert a name to a slug (lowercase, hyphen-separated)
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove special characters
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/--+/g, "-") // Replace multiple hyphens with single
    .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
}

/**
 * Get a family by slug or ID
 */
export function getFamilyBySlugOrId(store: LibraryStore, x: string): Family | undefined {
  // Try ID first
  const byId = store.getFamily(x);
  if (byId) return byId;

  // Try slug
  return store.getFamilyBySlug(x);
}

/**
 * Approve a family (requires a valid descriptor already set with exemplars)
 */
export function approveFamily(store: LibraryStore, idOrSlug: string): Family {
  const family = getFamilyBySlugOrId(store, idOrSlug);
  if (!family) {
    throw new UsageError(`Family "${idOrSlug}" not found`);
  }

  if (!family.descriptor) {
    throw new UsageError(`Family "${idOrSlug}" does not have a descriptor. Set one before approving.`);
  }

  // Check that descriptor has exemplars
  const descriptor = family.descriptor as any;
  if (!descriptor.exemplars || descriptor.exemplars.length === 0) {
    throw new UsageError(
      `Нельзя утвердить стиль без образцов: соберите референсы — nullume lib style collect ${family.slug}`
    );
  }

  store.updateFamily(family.id, {
    status: "approved",
  });

  store.recordDecision({
    familyId: family.id,
    action: "approve",
    payload: { name: family.name, slug: family.slug },
    actor: "owner",
  });

  const updated = store.getFamily(family.id)!;
  return updated;
}

/**
 * Rename a family and optionally change slug
 */
export function renameFamily(store: LibraryStore, idOrSlug: string, newName: string, newSlug?: string): Family {
  const family = getFamilyBySlugOrId(store, idOrSlug);
  if (!family) {
    throw new UsageError(`Family "${idOrSlug}" not found`);
  }

  const finalSlug = newSlug || slugify(newName);

  // Check slug uniqueness
  if (finalSlug !== family.slug) {
    const existing = store.getFamilyBySlug(finalSlug);
    if (existing && existing.id !== family.id && existing.status !== "discarded") {
      throw new UsageError(`Slug "${finalSlug}" is already taken`);
    }
  }

  store.updateFamily(family.id, {
    name: newName,
    slug: finalSlug,
  });

  store.recordDecision({
    familyId: family.id,
    action: "rename",
    payload: { oldName: family.name, newName, oldSlug: family.slug, newSlug: finalSlug },
    actor: "owner",
  });

  const updated = store.getFamily(family.id)!;
  return updated;
}

/**
 * Merge two families (move members from one to another)
 */
export function mergeFamilies(store: LibraryStore, fromIdOrSlug: string, intoIdOrSlug: string): Family {
  const fromFamily = getFamilyBySlugOrId(store, fromIdOrSlug);
  if (!fromFamily) {
    throw new UsageError(`Source family "${fromIdOrSlug}" not found`);
  }

  const intoFamily = getFamilyBySlugOrId(store, intoIdOrSlug);
  if (!intoFamily) {
    throw new UsageError(`Target family "${intoIdOrSlug}" not found`);
  }

  if (fromFamily.id === intoFamily.id) {
    throw new UsageError("Cannot merge a family into itself");
  }

  // Move members from 'from' to 'into'
  const fromMembers = store.getMembers(fromFamily.id);
  const intoMembers = store.getMembers(intoFamily.id);
  const merged = [...intoMembers, ...fromMembers];
  store.setMembers(intoFamily.id, merged);

  // Mark 'from' as merged
  store.updateFamily(fromFamily.id, {
    status: "merged",
    mergedInto: intoFamily.id,
  });

  store.recordDecision({
    familyId: fromFamily.id,
    action: "merge",
    payload: { from: fromFamily.id, into: intoFamily.id, memberCount: fromMembers.length },
    actor: "owner",
  });

  const updated = store.getFamily(intoFamily.id)!;
  return updated;
}

/**
 * Discard a family
 */
export function discardFamily(store: LibraryStore, idOrSlug: string): Family {
  const family = getFamilyBySlugOrId(store, idOrSlug);
  if (!family) {
    throw new UsageError(`Family "${idOrSlug}" not found`);
  }

  store.updateFamily(family.id, {
    status: "discarded",
  });

  store.recordDecision({
    familyId: family.id,
    action: "discard",
    payload: { name: family.name, slug: family.slug },
    actor: "owner",
  });

  const updated = store.getFamily(family.id)!;
  return updated;
}

/**
 * List families with optional status filter
 */
export function listFamilies(store: LibraryStore, status?: Family["status"]): Family[] {
  return store.listFamilies(status);
}

/**
 * Export all public family operations
 */
export { buildProposalContext, applyProposal } from "./propose.js";
export { validateDescriptor, descriptorToPrompt, DESCRIPTOR_TEMPLATE, contrastRatio } from "./descriptor.js";
export type { ProposalContext, ExemplarInfo, AggregatedPalette } from "./propose.js";
export type { StyleDescriptor } from "./descriptor.js";
