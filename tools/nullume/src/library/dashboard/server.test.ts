import { test } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { MemoryStore } from "../store/memory.js";
import { startDashboard } from "./server.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const testDir = join(tmpdir(), `nullume-test-${Date.now()}`);

async function setup() {
  mkdirSync(testDir, { recursive: true });

  const store = new MemoryStore();

  // Create test preview file
  const previewPath = join(testDir, "test-preview.jpg");
  writeFileSync(previewPath, Buffer.from([0xff, 0xd8, 0xff])); // JPEG header

  // Create two families with members
  const ref1 = store.insertReference({
    sha256: "abc123",
    source: "test",
    sourceRef: "ref1",
    originalPath: "/test/ref1.jpg",
    previewPath,
    width: 100,
    height: 100,
    bytes: 1000,
    meta: {},
    status: "active",
  });

  const ref2 = store.insertReference({
    sha256: "def456",
    source: "test",
    sourceRef: "ref2",
    originalPath: "/test/ref2.jpg",
    previewPath,
    width: 100,
    height: 100,
    bytes: 1000,
    meta: {},
    status: "active",
  });

  const family1 = store.createFamily({
    name: "Button",
    status: "proposed",
    descriptor: { summary: "Button component", palette: [{ r: 100, g: 150, b: 200, ratio: 0.5 }] },
    proposedBy: "claude",
  });

  const family2 = store.createFamily({
    name: "Input",
    status: "proposed",
    descriptor: { summary: "Input field" },
    proposedBy: "claude",
  });

  store.setMembers(family1.id, [
    { familyId: family1.id, refId: ref1.id, distance: 0, isExemplar: true },
  ]);

  store.setMembers(family2.id, [
    { familyId: family2.id, refId: ref2.id, distance: 0.1, isExemplar: true },
  ]);

  return { store, ref1, ref2, family1, family2 };
}

test("dashboard GET without token returns 404", async () => {
  const { store } = await setup();
  const server = await startDashboard(store);

  try {
    const res = await fetch(`${server.url}../../../not-token/state`);
    assert.equal(res.status, 404);
  } finally {
    await server.close();
  }
});

test("dashboard GET /state with token returns families", async () => {
  const { store } = await setup();
  const server = await startDashboard(store);

  try {
    const res = await fetch(`${server.url}state`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.families.length, 2);
    assert.equal(data.families[0].name, "Button");
    assert(data.families[0].exemplars.length > 0);
    assert(data.stats.totalFamilies === 2);
  } finally {
    await server.close();
  }
});

test("dashboard POST /decide approve changes status", async () => {
  const { store, family1 } = await setup();
  const server = await startDashboard(store);

  try {
    const res = await fetch(`${server.url}decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ familyId: family1.id, action: "approve" }),
    });
    assert.equal(res.status, 200);

    const updated = store.getFamily(family1.id);
    assert.equal(updated?.status, "approved");

    const decisions = store.listDecisions();
    assert.equal(decisions.length, 1);
    assert.equal(decisions[0].action, "approve");
  } finally {
    await server.close();
  }
});

test("dashboard POST /decide rename changes name and slug", async () => {
  const { store, family1 } = await setup();
  const server = await startDashboard(store);

  try {
    const res = await fetch(`${server.url}decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        familyId: family1.id,
        action: "rename",
        name: "PrimaryButton",
        slug: "primary-button",
      }),
    });
    assert.equal(res.status, 200);

    const updated = store.getFamily(family1.id);
    assert.equal(updated?.name, "PrimaryButton");
    assert.equal(updated?.slug, "primary-button");
  } finally {
    await server.close();
  }
});

test("dashboard POST /decide merge transfers members", async () => {
  const { store, family1, family2 } = await setup();
  const server = await startDashboard(store);

  try {
    const res = await fetch(`${server.url}decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        familyId: family1.id,
        action: "merge",
        mergeInto: family2.id,
      }),
    });
    assert.equal(res.status, 200);

    const updated1 = store.getFamily(family1.id);
    assert.equal(updated1?.status, "merged");
    assert.equal(updated1?.mergedInto, family2.id);

    const members2 = store.getMembers(family2.id);
    assert.equal(members2.length, 2);
  } finally {
    await server.close();
  }
});

test("dashboard POST /decide discard changes status", async () => {
  const { store, family1 } = await setup();
  const server = await startDashboard(store);

  try {
    const res = await fetch(`${server.url}decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ familyId: family1.id, action: "discard" }),
    });
    assert.equal(res.status, 200);

    const updated = store.getFamily(family1.id);
    assert.equal(updated?.status, "discarded");
  } finally {
    await server.close();
  }
});

test("dashboard POST without same-origin returns 403", async () => {
  const { store } = await setup();
  const server = await startDashboard(store);

  try {
    const res = await fetch(`${server.url}decide`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "http://attacker.com",
        "Sec-Fetch-Site": "cross-site",
      },
      body: JSON.stringify({ familyId: "test", action: "approve" }),
    });
    assert.equal(res.status, 403);
  } finally {
    await server.close();
  }
});

test("dashboard GET /preview/:refId returns image", async () => {
  const { store, ref1 } = await setup();
  const server = await startDashboard(store);

  try {
    const res = await fetch(`${server.url}preview/${ref1.id}`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Content-Type"), "image/jpeg");

    const buffer = await res.arrayBuffer();
    assert.equal(buffer.byteLength, 3);
  } finally {
    await server.close();
  }
});

test("dashboard GET /preview/:unknown returns 404", async () => {
  const { store } = await setup();
  const server = await startDashboard(store);

  try {
    const res = await fetch(`${server.url}preview/unknown-id`);
    assert.equal(res.status, 404);
  } finally {
    await server.close();
  }
});

test("dashboard POST /done closes server", async () => {
  const { store } = await setup();
  const server = await startDashboard(store);

  try {
    const donePromise = server.done;

    const res = await fetch(`${server.url}done`, { method: "POST" });
    assert.equal(res.status, 200);

    const decisions = await donePromise;
    assert.ok(Array.isArray(decisions));
  } finally {
    await server.close();
  }
});

test("page.html has no http/https outside comments", () => {
  const pageHtml = readFileSync(
    join(__dirname, "page.html"),
    "utf-8"
  );

  // Remove comments
  const noComments = pageHtml.replace(/<!--[\s\S]*?-->/g, "");

  // Check for http:// or https:// (should not appear except in comments)
  const httpMatch = noComments.match(/https?:\/\//g);
  assert.equal(httpMatch, null, "Found http/https outside comments");
});

test("dashboard server close method works", async () => {
  const { store } = await setup();
  const server = await startDashboard(store, { idleMs: 30000 });

  try {
    // Verify server is responsive
    const res = await fetch(`${server.url}state`);
    assert.equal(res.status, 200);

    // Explicitly close
    await server.close();

    // Try to fetch after close - should fail
    let failed = false;
    try {
      await fetch(`${server.url}state`, { signal: AbortSignal.timeout(500) });
    } catch (err: any) {
      failed = true;
    }
    assert.ok(failed, "Expected fetch to fail after close");
  } finally {
    await server.close().catch(() => {});
  }
});

// Cleanup
test.after(() => {
  try {
    rmSync(testDir, { recursive: true });
  } catch {}
});
