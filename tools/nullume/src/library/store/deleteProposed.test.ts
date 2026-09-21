/**
 * Unit tests for deleteProposedFamilies with proposedBy filtering
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { MemoryStore } from "./memory.js";
import { SqliteStore } from "./sqlite.js";
import { openMemoryStore } from "./memory.js";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { rm } from "node:fs/promises";

describe("deleteProposedFamilies with proposedBy filtering", () => {
  it("should only delete cluster-proposed families by default", () => {
    const store = new MemoryStore();

    // Create cluster-proposed family
    const clusterFamily = store.createFamily({
      name: "Cluster Family",
      status: "proposed",
      proposedBy: "cluster",
    });

    // Create claude-proposed family
    const claudeFamily = store.createFamily({
      name: "Claude Family",
      status: "proposed",
      proposedBy: "claude",
    });

    // Delete proposed families (should only delete cluster)
    store.deleteProposedFamilies();

    // Verify cluster family is deleted
    assert.equal(store.getFamily(clusterFamily.id), undefined);

    // Verify claude family still exists
    assert.notEqual(store.getFamily(claudeFamily.id), undefined);
  });

  it("should delete only claude-proposed families when specified", () => {
    const store = new MemoryStore();

    // Create cluster-proposed family
    const clusterFamily = store.createFamily({
      name: "Cluster Family",
      status: "proposed",
      proposedBy: "cluster",
    });

    // Create claude-proposed family
    const claudeFamily = store.createFamily({
      name: "Claude Family",
      status: "proposed",
      proposedBy: "claude",
    });

    // Delete only claude-proposed families
    store.deleteProposedFamilies({ proposedBy: "claude" });

    // Verify cluster family still exists
    assert.notEqual(store.getFamily(clusterFamily.id), undefined);

    // Verify claude family is deleted
    assert.equal(store.getFamily(claudeFamily.id), undefined);
  });

  it("should filter by clusterRunId when provided", () => {
    const store = new MemoryStore();

    const runId1 = "run-1";
    const runId2 = "run-2";

    // Create cluster-proposed families with different run IDs
    const family1 = store.createFamily({
      name: "Family 1",
      status: "proposed",
      proposedBy: "cluster",
      clusterRunId: runId1,
    });

    const family2 = store.createFamily({
      name: "Family 2",
      status: "proposed",
      proposedBy: "cluster",
      clusterRunId: runId2,
    });

    // Delete only families from run 1
    store.deleteProposedFamilies({ clusterRunId: runId1 });

    // Verify family1 is deleted
    assert.equal(store.getFamily(family1.id), undefined);

    // Verify family2 still exists
    assert.notEqual(store.getFamily(family2.id), undefined);
  });

  it("should not delete approved families", () => {
    const store = new MemoryStore();

    const proposedFamily = store.createFamily({
      name: "Proposed",
      status: "proposed",
      proposedBy: "cluster",
    });

    const approvedFamily = store.createFamily({
      name: "Approved",
      status: "approved",
      proposedBy: "cluster",
    });

    store.deleteProposedFamilies();

    assert.equal(store.getFamily(proposedFamily.id), undefined);
    assert.notEqual(store.getFamily(approvedFamily.id), undefined);
  });

  it("should handle memory store deleteProposedFamilies", () => {
    const store = openMemoryStore();

    const claude = store.createFamily({
      name: "Claude proposal",
      status: "proposed",
      proposedBy: "claude",
    });

    const cluster = store.createFamily({
      name: "Cluster proposal",
      status: "proposed",
      proposedBy: "cluster",
    });

    // Default: delete only cluster
    store.deleteProposedFamilies();

    assert.equal(store.getFamily(cluster.id), undefined);
    assert.notEqual(store.getFamily(claude.id), undefined);
  });
});
