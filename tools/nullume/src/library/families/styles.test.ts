import { test } from "node:test";
import assert from "node:assert/strict";
import { MemoryStore } from "../store/memory.js";
import type { NewReference } from "../store/types.js";
import { applyStyleFile } from "./styles.js";
import { UsageError } from "../../core/errors.js";

test("memory store: getFamilyBySlug works after createFamily", () => {
  const store = new MemoryStore();

  const family = store.createFamily({
    slug: "test-slug",
    name: "Test Family",
    status: "proposed",
    proposedBy: "owner",
  });

  const retrieved = store.getFamilyBySlug("test-slug");
  assert.ok(retrieved, "Should find family by slug");
  assert.strictEqual(retrieved.id, family.id);
  assert.strictEqual(retrieved.slug, "test-slug");
});

/**
 * Build a minimal valid descriptor for testing
 */
function buildValidDescriptor(overrides: Record<string, unknown> = {}) {
  return {
    summary: "Test style",
    palette: [
      { hex: "#0b0b0d", role: "bg", ratio: 1.0 },
      { hex: "#f2f0ea", role: "text", ratio: 0.96 },
      { hex: "#8b7355", role: "accent", ratio: 0.5 },
      { hex: "#e8e6e0", role: "surface", ratio: 0.9 },
    ],
    type: {
      display: "Manrope",
      body: "Inter",
      scale: [0.75, 1, 1.25, 1.5],
      weightDisplay: 600,
      tracking: 0,
      caseAccent: "none",
    },
    spacing: {
      base: 16,
      rhythm: [4, 8, 16, 24, 32],
      density: "balanced",
    },
    radii: {
      small: 4,
      large: 12,
      pattern: "uniform",
    },
    shadows: "soft",
    motion: {
      duration: [200, 400],
      easing: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
      character: "calm",
    },
    dials: {
      visualDensity: 0.5,
      designVariance: 0.4,
      decorLevel: 0.2,
      symmetry: 0.6,
    },
    decor: [],
    dominant_pattern: "minimal grid",
    divergences: [],
    prompt_fragment: "Clean minimal design",
    negative_fragment: "busy, loud, chaotic",
    mood: ["clean", "minimal"],
    antiRefCheck: [],
    ...overrides,
  };
}

/**
 * Create test references with tags
 */
function createRefsWithTag(store: MemoryStore, tag: string, count: number): string[] {
  const refIds: string[] = [];
  for (let i = 0; i < count; i++) {
    const ref = store.insertReference({
      sha256: `sha-${tag}-${i}`,
      source: "test",
      sourceRef: `ref-${tag}-${i}`,
      originalPath: `test-${tag}-${i}.png`,
      width: 100,
      height: 100,
      bytes: 1000,
      meta: {},
      status: "active",
    });
    store.addTags(ref.id, [tag], "test");
    refIds.push(ref.id);
  }
  return refIds;
}

test("applyStyleFile: two styles with 2+ refs each → both families created and approved", () => {
  const store = new MemoryStore();
  const logs: string[] = [];
  const log = (msg: string) => logs.push(msg);

  // Create refs with tags
  const hfNoir1 = createRefsWithTag(store, "hf:noir", 2);
  const hfWarm1 = createRefsWithTag(store, "hf:warm", 2);

  // Apply styles
  const payload = {
    styles: [
      {
        slug: "higgsfield-noir",
        name: "Higgsfield · Noir",
        tag: "hf:noir",
        descriptor: buildValidDescriptor({
          prompt_fragment: "Dark noir aesthetic",
        }),
      },
      {
        slug: "higgsfield-warm",
        name: "Higgsfield · Warm",
        tag: "hf:warm",
        descriptor: buildValidDescriptor({
          prompt_fragment: "Warm earthy tones",
        }),
      },
    ],
  };

  const result = applyStyleFile(store, payload, { dryRun: false, log });

  // Check results
  assert.deepStrictEqual(
    result.applied.sort(),
    ["higgsfield-noir", "higgsfield-warm"],
    `Applied should be both styles. Got: ${JSON.stringify(result.applied)}, Skipped: ${JSON.stringify(result.skipped)}, Logs: ${JSON.stringify(logs)}`
  );
  assert.strictEqual(result.skipped.length, 0);

  // Verify families were created and approved
  const families = store.listFamilies();
  const noirInList = families.find(f => f.slug === "higgsfield-noir");
  const warmInList = families.find(f => f.slug === "higgsfield-warm");

  assert.ok(noirInList, `Noir should be in list. Families: ${JSON.stringify(families.map(f => ({ id: f.id.slice(0,8), slug: f.slug, status: f.status })))}`);
  assert.ok(warmInList, "Warm should be in list");

  const noir = store.getFamilyBySlug("higgsfield-noir");
  const warm = store.getFamilyBySlug("higgsfield-warm");

  assert.ok(noir, `Noir family lookup failed. Existing: ${JSON.stringify(families.map(f => f.slug))}`);
  assert.ok(warm, "Warm family lookup failed");

  assert.strictEqual(noir!.status, "approved", `Noir status is ${noir?.status}`);
  assert.strictEqual(warm!.status, "approved", `Warm status is ${warm?.status}`);

  // Verify members and exemplars
  const noirMembers = store.getMembers(noir.id);
  const warmMembers = store.getMembers(warm.id);

  assert.strictEqual(noirMembers.length, 2);
  assert.strictEqual(warmMembers.length, 2);

  // Verify exemplars are set in descriptor
  const noirDesc = noir.descriptor as any;
  const warmDesc = warm.descriptor as any;

  assert.ok(Array.isArray(noirDesc.exemplars));
  assert.ok(Array.isArray(warmDesc.exemplars));
  assert.strictEqual(noirDesc.exemplars.length, 2);
  assert.strictEqual(warmDesc.exemplars.length, 2);
});

test("applyStyleFile: style with no refs → skipped with reason", () => {
  const store = new MemoryStore();
  const logs: string[] = [];
  const log = (msg: string) => logs.push(msg);

  // Don't create any refs with the tag

  const payload = {
    styles: [
      {
        slug: "empty-style",
        name: "Empty Style",
        tag: "nonexistent:tag",
        descriptor: buildValidDescriptor(),
      },
    ],
  };

  const result = applyStyleFile(store, payload, { dryRun: false, log });

  assert.strictEqual(result.applied.length, 0);
  assert.strictEqual(result.skipped.length, 1);
  assert.strictEqual(result.skipped[0].slug, "empty-style");
  assert.ok(result.skipped[0].reason.includes("nonexistent:tag"));

  // Family should not be created
  const empty = store.getFamilyBySlug("empty-style");
  assert.strictEqual(empty, undefined);
});

test("applyStyleFile: running apply twice → one family per slug, descriptor updated, members unchanged", () => {
  const store = new MemoryStore();
  const logs: string[] = [];
  const log = (msg: string) => logs.push(msg);

  const refIds = createRefsWithTag(store, "test:tag", 3);

  // First apply
  const payload1 = {
    styles: [
      {
        slug: "test-style",
        name: "Test Style",
        tag: "test:tag",
        descriptor: buildValidDescriptor({
          prompt_fragment: "First version",
        }),
      },
    ],
  };

  const result1 = applyStyleFile(store, payload1, { dryRun: false, log });
  assert.strictEqual(result1.applied.length, 1);

  const family1 = store.getFamilyBySlug("test-style");
  const members1 = store.getMembers(family1!.id);
  const desc1 = (family1!.descriptor as any).prompt_fragment;

  // Second apply with updated descriptor
  const payload2 = {
    styles: [
      {
        slug: "test-style",
        name: "Test Style Updated",
        tag: "test:tag",
        descriptor: buildValidDescriptor({
          prompt_fragment: "Second version",
        }),
      },
    ],
  };

  const result2 = applyStyleFile(store, payload2, { dryRun: false, log });
  assert.strictEqual(result2.applied.length, 1);

  const family2 = store.getFamilyBySlug("test-style");
  const members2 = store.getMembers(family2!.id);
  const desc2 = (family2!.descriptor as any).prompt_fragment;

  // Verify same family
  assert.strictEqual(family1!.id, family2!.id);

  // Verify descriptor updated
  assert.strictEqual(desc1, "First version");
  assert.strictEqual(desc2, "Second version");

  // Verify members unchanged (still 3)
  assert.strictEqual(members1.length, 3);
  assert.strictEqual(members2.length, 3);
});

test("applyStyleFile: invalid descriptor → throws UsageError with slug", () => {
  const store = new MemoryStore();
  const logs: string[] = [];
  const log = (msg: string) => logs.push(msg);

  createRefsWithTag(store, "test:tag", 2);

  // Invalid descriptor: palette with only 1 entry
  const payload = {
    styles: [
      {
        slug: "bad-style",
        name: "Bad Style",
        tag: "test:tag",
        descriptor: buildValidDescriptor({
          palette: [{ hex: "#ffffff", role: "bg", ratio: 1.0 }], // Only 1 entry
        }),
      },
    ],
  };

  assert.throws(
    () => applyStyleFile(store, payload, { dryRun: false, log }),
    (err) => err instanceof UsageError && err.message.includes("bad-style")
  );
});

test("applyStyleFile: dry-run mode → no families created, returns what would apply", () => {
  const store = new MemoryStore();
  const logs: string[] = [];
  const log = (msg: string) => logs.push(msg);

  createRefsWithTag(store, "test:tag", 2);

  const payload = {
    styles: [
      {
        slug: "dryrun-style",
        name: "Dryrun Style",
        tag: "test:tag",
        descriptor: buildValidDescriptor(),
      },
    ],
  };

  const result = applyStyleFile(store, payload, { dryRun: true, log });

  // Should still report as applied in dry-run
  assert.deepStrictEqual(result.applied, ["dryrun-style"]);
  assert.strictEqual(result.skipped.length, 0);

  // But family should not actually exist in store
  const family = store.getFamilyBySlug("dryrun-style");
  assert.strictEqual(family, undefined);
});

test("applyStyleFile: invalid input structure → throws UsageError", () => {
  const store = new MemoryStore();
  const log = (msg: string) => {};

  const payload = {
    styles: [
      {
        // Missing 'name' field
        slug: "incomplete",
        tag: "test",
        descriptor: buildValidDescriptor(),
      },
    ],
  };

  assert.throws(
    () => applyStyleFile(store, payload, { dryRun: false, log }),
    (err) => err instanceof UsageError && err.message.includes("Invalid style file")
  );
});

test("applyStyleFile: rerun on approved family keeps status and no duplicate decision", () => {
  const store = new MemoryStore();
  const logs: string[] = [];
  const log = (msg: string) => logs.push(msg);

  const refIds = createRefsWithTag(store, "test:tag", 3);

  // First apply
  const payload1 = {
    styles: [
      {
        slug: "test-style",
        name: "Test Style",
        tag: "test:tag",
        descriptor: buildValidDescriptor({
          prompt_fragment: "First version",
        }),
      },
    ],
  };

  const result1 = applyStyleFile(store, payload1, { dryRun: false, log });
  assert.strictEqual(result1.applied.length, 1);

  const family1 = store.getFamilyBySlug("test-style")!;
  const decisions1 = store.listDecisions(family1.id);
  assert.strictEqual(family1.status, "approved", "After first apply, family should be approved");
  assert.ok(decisions1.length >= 1, "Should have at least one approval decision");
  const approvalCount1 = decisions1.filter((d) => d.action === "approve").length;

  // Second apply with updated descriptor
  const payload2 = {
    styles: [
      {
        slug: "test-style",
        name: "Test Style Updated",
        tag: "test:tag",
        descriptor: buildValidDescriptor({
          prompt_fragment: "Second version",
        }),
      },
    ],
  };

  const result2 = applyStyleFile(store, payload2, { dryRun: false, log });
  assert.strictEqual(result2.applied.length, 1);

  const family2 = store.getFamilyBySlug("test-style")!;
  const decisions2 = store.listDecisions(family2.id);
  assert.strictEqual(family2.status, "approved", "After second apply, family should still be approved");

  // Key assertion: no new approval decision was added
  const approvalCount2 = decisions2.filter((d) => d.action === "approve").length;
  assert.strictEqual(
    approvalCount2,
    approvalCount1,
    `Approval count should not increase. Before: ${approvalCount1}, After: ${approvalCount2}, All decisions: ${JSON.stringify(decisions2.map(d => d.action))}`
  );
});

test("applyStyleFile: mixed valid A and invalid B and valid C → throws with B listed, nothing written", () => {
  const store = new MemoryStore();
  const logs: string[] = [];
  const log = (msg: string) => logs.push(msg);

  const refIds = createRefsWithTag(store, "test:tag", 3);

  // Invalid descriptor: palette with invalid hex
  const payload = {
    styles: [
      {
        slug: "style-a",
        name: "Style A",
        tag: "test:tag",
        descriptor: buildValidDescriptor({
          prompt_fragment: "Valid A",
        }),
      },
      {
        slug: "style-b",
        name: "Style B",
        tag: "test:tag",
        descriptor: buildValidDescriptor({
          palette: [
            { hex: "invalid-hex", role: "bg", ratio: 1.0 }, // Invalid hex format
            { hex: "#f2f0ea", role: "text", ratio: 0.96 },
          ],
        }),
      },
      {
        slug: "style-c",
        name: "Style C",
        tag: "test:tag",
        descriptor: buildValidDescriptor({
          prompt_fragment: "Valid C",
        }),
      },
    ],
  };

  // Should throw with B in the error message
  let threwError = false;
  let errorMsg = "";
  try {
    applyStyleFile(store, payload, { dryRun: false, log });
  } catch (e) {
    threwError = true;
    errorMsg = (e as Error).message;
  }

  assert.ok(threwError, "Should throw an error");
  assert.ok(errorMsg.includes("style-b"), `Error message should mention style-b. Got: ${errorMsg}`);

  // Verify no families were created for A or C
  const familyA = store.getFamilyBySlug("style-a");
  const familyB = store.getFamilyBySlug("style-b");
  const familyC = store.getFamilyBySlug("style-c");

  assert.strictEqual(familyA, undefined, "Family A should not exist (nothing written due to B error)");
  assert.strictEqual(familyB, undefined, "Family B should not exist (validation failed)");
  assert.strictEqual(familyC, undefined, "Family C should not exist (nothing written due to B error)");
});

test("applyStyleFile: new ref tagged after first apply → second apply adds to members", () => {
  const store = new MemoryStore();
  const logs: string[] = [];
  const log = (msg: string) => logs.push(msg);

  // Create initial 2 refs with tag
  const initialRefIds = createRefsWithTag(store, "test:tag", 2);

  // First apply
  const payload1 = {
    styles: [
      {
        slug: "test-style",
        name: "Test Style",
        tag: "test:tag",
        descriptor: buildValidDescriptor({
          prompt_fragment: "Initial",
        }),
      },
    ],
  };

  const result1 = applyStyleFile(store, payload1, { dryRun: false, log });
  assert.strictEqual(result1.applied.length, 1);

  const family1 = store.getFamilyBySlug("test-style")!;
  const members1 = store.getMembers(family1.id);
  assert.strictEqual(members1.length, 2, "Initial members should be 2");

  // Create a new ref and tag it with the same tag
  const newRef = store.insertReference({
    sha256: "sha-new",
    source: "test",
    sourceRef: "ref-new",
    originalPath: "new.png",
    width: 100,
    height: 100,
    bytes: 1000,
    meta: {},
    status: "active",
  });
  store.addTags(newRef.id, ["test:tag"], "test");

  // Second apply (same style, but now there are 3 refs with the tag)
  const payload2 = {
    styles: [
      {
        slug: "test-style",
        name: "Test Style",
        tag: "test:tag",
        descriptor: buildValidDescriptor({
          prompt_fragment: "Updated",
        }),
      },
    ],
  };

  const result2 = applyStyleFile(store, payload2, { dryRun: false, log });
  assert.strictEqual(result2.applied.length, 1);

  const family2 = store.getFamilyBySlug("test-style")!;
  const members2 = store.getMembers(family2.id);
  assert.strictEqual(
    members2.length,
    3,
    `Members should be 3 after adding new tagged ref. Got ${members2.length}, members: ${JSON.stringify(members2.map(m => m.refId.slice(0, 8)))}`
  );

  // Verify the new ref is in the members
  const memberRefIds = new Set(members2.map((m) => m.refId));
  assert.ok(memberRefIds.has(newRef.id), "New ref should be in members");

  // Verify new member has isExemplar=false
  const newMember = members2.find((m) => m.refId === newRef.id);
  assert.ok(newMember, "New member should exist");
  assert.strictEqual(newMember.isExemplar, false, "New member should not be exemplar");
});
