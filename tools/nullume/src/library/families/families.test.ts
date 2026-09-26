import { test } from "node:test";
import assert from "node:assert";
import { MemoryStore } from "../store/memory.js";
import type { NewReference } from "../store/types.js";
import {
  validateDescriptor,
  descriptorToPrompt,
  DESCRIPTOR_TEMPLATE,
  contrastRatio,
  StyleDescriptorSchema,
} from "./descriptor.js";
import {
  buildProposalContext,
  applyProposal,
} from "./propose.js";
import {
  approveFamily,
  discardFamily,
  getFamilyBySlugOrId,
  mergeFamilies,
  renameFamily,
  slugify,
  listFamilies,
} from "./index.js";
import { UsageError } from "../../core/errors.js";

test("descriptor: valid descriptor passes validation", () => {
  const valid = validateDescriptor(DESCRIPTOR_TEMPLATE);
  assert.ok(valid.name);
  assert.ok(valid.slug);
  assert.strictEqual(valid.palette.length, 7);
});

test("descriptor: empty exemplars array is valid", () => {
  const noExemplars = {
    ...DESCRIPTOR_TEMPLATE,
    exemplars: [],
  };
  const valid = validateDescriptor(noExemplars);
  assert.strictEqual(valid.exemplars.length, 0);
});

test("descriptor: exemplars with 0-8 items valid", () => {
  for (let i = 0; i <= 8; i++) {
    // Create valid UUIDs (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
    const validExemplars = Array.from({ length: i }, (_, j) => {
      const hex = String(j).padStart(36, "0");
      // Format: 8-4-4-4-12
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
    });

    const desc = {
      ...DESCRIPTOR_TEMPLATE,
      exemplars: validExemplars,
    };
    const valid = validateDescriptor(desc);
    assert.strictEqual(valid.exemplars.length, i);
  }
});

test("descriptor: contrast 2:1 fails validation", () => {
  const bad = {
    ...DESCRIPTOR_TEMPLATE,
    palette: [
      { hex: "#ffffff", role: "bg", ratio: 1.0 },
      { hex: "#eeeeee", role: "text", ratio: 0.95 }, // Only ~1.2:1 contrast
      ...DESCRIPTOR_TEMPLATE.palette.slice(2),
    ],
  };
  assert.throws(
    () => validateDescriptor(bad),
    (err) => err instanceof UsageError && err.message.includes("Contrast")
  );
});

test("descriptor: bounce in easing fails validation", () => {
  const bad = {
    ...DESCRIPTOR_TEMPLATE,
    motion: {
      ...DESCRIPTOR_TEMPLATE.motion,
      easing: "cubic-bezier with bounce",
    },
  };
  assert.throws(
    () => validateDescriptor(bad),
    (err) => err instanceof UsageError && err.message.includes("bounce")
  );
});

test("descriptor: elastic in easing fails validation", () => {
  const bad = {
    ...DESCRIPTOR_TEMPLATE,
    motion: {
      ...DESCRIPTOR_TEMPLATE.motion,
      easing: "elastic-out",
    },
  };
  assert.throws(
    () => validateDescriptor(bad),
    (err) => err instanceof UsageError && err.message.includes("elastic")
  );
});

test("descriptor: slug with spaces fails validation", () => {
  const bad = {
    ...DESCRIPTOR_TEMPLATE,
    slug: "example style",
  };
  assert.throws(
    () => validateDescriptor(bad),
    (err) => err instanceof UsageError && err.message.includes("slug")
  );
});

test("descriptor: descriptorToPrompt generates valid output", () => {
  const result = descriptorToPrompt(DESCRIPTOR_TEMPLATE);
  assert.ok(result.prompt);
  assert.ok(result.negative);
  assert(result.prompt.includes("Палитра:"));
  assert(result.prompt.includes("Шрифт:"));
  assert.strictEqual(result.negative, DESCRIPTOR_TEMPLATE.negative_fragment);
});

test("descriptor: contrastRatio calculates correctly", () => {
  // Black on white should be 21:1
  const blackWhite = contrastRatio("#000000", "#ffffff");
  assert(blackWhite > 20, `Expected > 20, got ${blackWhite}`);

  // 50% gray on white should be ~3.95:1
  const grayWhite = contrastRatio("#808080", "#ffffff");
  assert(grayWhite > 3.9, `Expected > 3.9, got ${grayWhite}`);
  assert(grayWhite < 4.0, `Expected < 4.0, got ${grayWhite}`);

  // Dark blue on white should be > 4.5
  const darkBlueWhite = contrastRatio("#1F3A5F", "#ffffff");
  assert(darkBlueWhite > 4.5, `Expected > 4.5 for dark blue, got ${darkBlueWhite}`);
});

test("families: slugify converts names correctly", () => {
  assert.strictEqual(slugify("Example Style"), "example-style");
  assert.strictEqual(slugify("Clean & Minimal"), "clean-minimal");
  assert.strictEqual(slugify("  Multiple   Spaces  "), "multiple-spaces");
  assert.strictEqual(slugify("MixedCase123"), "mixedcase123");
});

test("families: buildProposalContext aggregates palette and tags", () => {
  const store = new MemoryStore();

  // Create two references with different palettes
  const ref1: NewReference = {
    sha256: "sha1",
    source: "test",
    sourceRef: "ref1",
    originalPath: "test1.png",
    width: 100,
    height: 100,
    bytes: 1000,
    meta: { prompt: "prompt 1" },
    status: "active",
  };

  const ref2: NewReference = {
    sha256: "sha2",
    source: "test",
    sourceRef: "ref2",
    originalPath: "test2.png",
    width: 100,
    height: 100,
    bytes: 1000,
    meta: { prompt: "prompt 2" },
    status: "active",
  };

  const r1 = store.insertReference(ref1);
  const r2 = store.insertReference(ref2);

  // Add tags
  store.addTags(r1.id, ["modern", "minimal"], "test");
  store.addTags(r2.id, ["modern", "elegant"], "test");

  // Add palettes
  store.putPalette(r1.id, [
    { r: 255, g: 255, b: 255, ratio: 0.8 },
    { r: 0, g: 0, b: 0, ratio: 0.9 },
  ]);

  store.putPalette(r2.id, [
    { r: 255, g: 255, b: 255, ratio: 0.85 },
    { r: 100, g: 100, b: 100, ratio: 0.7 },
  ]);

  // Create proposed family
  const family = store.createFamily({
    name: "Test Family",
    status: "proposed",
    proposedBy: "cluster",
  });

  store.setMembers(family.id, [
    { familyId: family.id, refId: r1.id, distance: 0.1, isExemplar: true },
    { familyId: family.id, refId: r2.id, distance: 0.15, isExemplar: false },
  ]);

  const contexts = buildProposalContext(store);
  assert.strictEqual(contexts.length, 1);

  const ctx = contexts[0];
  assert.strictEqual(ctx.familyId, family.id);
  assert.strictEqual(ctx.size, 2);
  assert.ok(ctx.paletteAggregate.length > 0);
  assert(ctx.tagsTop.includes("modern"));
  assert.ok(ctx.prompts.length <= 5);
});

test("families: applyProposal rejects duplicate slug", () => {
  const store = new MemoryStore();

  // Create two families
  const fam1 = store.createFamily({
    name: "Family 1",
    slug: "family-1",
    status: "active",
    proposedBy: "owner",
  });

  const fam2 = store.createFamily({
    name: "Family 2",
    slug: "family-2",
    status: "proposed",
    proposedBy: "cluster",
  });

  const proposal = {
    families: [
      {
        familyId: fam2.id,
        name: "Family 2 Renamed",
        slug: "family-1", // Already taken by fam1
        descriptor: DESCRIPTOR_TEMPLATE,
      },
    ],
  };

  assert.throws(
    () => applyProposal(store, proposal),
    (err) => err instanceof UsageError && err.message.includes("already exists")
  );
});

test("families: approveFamily requires descriptor", () => {
  const store = new MemoryStore();

  const family = store.createFamily({
    name: "No Descriptor",
    status: "proposed",
    proposedBy: "cluster",
  });

  assert.throws(
    () => approveFamily(store, family.id),
    (err) => err instanceof UsageError && err.message.includes("descriptor")
  );
});

test("families: approveFamily requires exemplars in descriptor", () => {
  const store = new MemoryStore();

  const descriptorWithoutExemplars = {
    ...DESCRIPTOR_TEMPLATE,
    exemplars: [],
  };

  const family = store.createFamily({
    name: "No Exemplars",
    status: "proposed",
    proposedBy: "cluster",
    descriptor: descriptorWithoutExemplars,
  });

  assert.throws(
    () => approveFamily(store, family.id),
    (err) => err instanceof UsageError && (err.message.includes("exemplars") || err.message.includes("образцов"))
  );
});

test("families: approveFamily succeeds with exemplars", () => {
  const store = new MemoryStore();

  const family = store.createFamily({
    name: "With Exemplars",
    status: "proposed",
    proposedBy: "cluster",
    descriptor: DESCRIPTOR_TEMPLATE, // Has exemplars
  });

  const approved = approveFamily(store, family.id);
  assert.strictEqual(approved.status, "approved");
});

test("families: mergeFamilies transfers members and records decision", () => {
  const store = new MemoryStore();

  // Create references
  const ref1: NewReference = {
    sha256: "sha1",
    source: "test",
    sourceRef: "ref1",
    originalPath: "test1.png",
    width: 100,
    height: 100,
    bytes: 1000,
    meta: {},
    status: "active",
  };

  const ref2: NewReference = {
    sha256: "sha2",
    source: "test",
    sourceRef: "ref2",
    originalPath: "test2.png",
    width: 100,
    height: 100,
    bytes: 1000,
    meta: {},
    status: "active",
  };

  const r1 = store.insertReference(ref1);
  const r2 = store.insertReference(ref2);

  // Create families
  const fam1 = store.createFamily({
    name: "Source",
    slug: "source",
    status: "proposed",
    proposedBy: "cluster",
  });

  const fam2 = store.createFamily({
    name: "Target",
    slug: "target",
    status: "approved",
    proposedBy: "owner",
  });

  // Set members
  store.setMembers(fam1.id, [{ familyId: fam1.id, refId: r1.id, distance: 0.1, isExemplar: true }]);
  store.setMembers(fam2.id, [{ familyId: fam2.id, refId: r2.id, distance: 0.2, isExemplar: false }]);

  // Merge
  const result = mergeFamilies(store, fam1.id, fam2.id);

  // Check result
  assert.strictEqual(result.id, fam2.id);
  const members = store.getMembers(fam2.id);
  assert.strictEqual(members.length, 2);

  // Check source is marked as merged
  const merged = store.getFamily(fam1.id)!;
  assert.strictEqual(merged.status, "merged");
  assert.strictEqual(merged.mergedInto, fam2.id);

  // Check decision recorded
  const decisions = store.listDecisions(fam1.id);
  assert.ok(decisions.some((d) => d.action === "merge"));
});

test("families: renameFamily changes slug and records decision", () => {
  const store = new MemoryStore();

  const family = store.createFamily({
    name: "Old Name",
    slug: "old-name",
    status: "approved",
    proposedBy: "owner",
  });

  const result = renameFamily(store, family.id, "New Name", "new-name");

  assert.strictEqual(result.name, "New Name");
  assert.strictEqual(result.slug, "new-name");

  // Old slug should no longer resolve
  const byOldSlug = store.getFamilyBySlug("old-name");
  assert.strictEqual(byOldSlug, undefined);

  // New slug should resolve
  const byNewSlug = store.getFamilyBySlug("new-name");
  assert.ok(byNewSlug);

  // Decision should be recorded
  const decisions = store.listDecisions(family.id);
  assert.ok(decisions.some((d) => d.action === "rename"));
});

test("families: discardFamily marks as discarded", () => {
  const store = new MemoryStore();

  const family = store.createFamily({
    name: "To Discard",
    slug: "to-discard",
    status: "proposed",
    proposedBy: "cluster",
  });

  const result = discardFamily(store, family.id);

  assert.strictEqual(result.status, "discarded");

  // Decision recorded
  const decisions = store.listDecisions(family.id);
  assert.ok(decisions.some((d) => d.action === "discard"));
});

test("families: getFamilyBySlugOrId resolves both", () => {
  const store = new MemoryStore();

  const family = store.createFamily({
    name: "Test",
    slug: "test-family",
    status: "approved",
    proposedBy: "owner",
  });

  // By ID
  const byId = getFamilyBySlugOrId(store, family.id);
  assert.ok(byId);
  assert.strictEqual(byId.id, family.id);

  // By slug
  const bySlug = getFamilyBySlugOrId(store, "test-family");
  assert.ok(bySlug);
  assert.strictEqual(bySlug.id, family.id);
});

test("families: listFamilies filters by status", () => {
  const store = new MemoryStore();

  store.createFamily({
    name: "Proposed",
    status: "proposed",
    proposedBy: "cluster",
  });

  store.createFamily({
    name: "Approved",
    status: "approved",
    proposedBy: "owner",
  });

  store.createFamily({
    name: "Discarded",
    status: "discarded",
    proposedBy: "owner",
  });

  const proposed = listFamilies(store, "proposed");
  assert.strictEqual(proposed.length, 1);
  assert.strictEqual(proposed[0].name, "Proposed");

  const approved = listFamilies(store, "approved");
  assert.strictEqual(approved.length, 1);
  assert.strictEqual(approved[0].name, "Approved");

  const all = listFamilies(store);
  assert.strictEqual(all.length, 3);
});
