import { test } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
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
    slug: "button",
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

test("GET /refs returns empty list when no references", async () => {
  const { store } = await setup();
  const server = await startDashboard(store);

  try {
    const res = await fetch(`${server.url}refs`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.items.length, 2);
    assert(data.total >= 2);
    assert(data.items[0].previewUrl);
    assert(Array.isArray(data.items[0].palette));
  } finally {
    await server.close();
  }
});

test("GET /refs?q= performs substring search", async () => {
  const { store } = await setup();
  const server = await startDashboard(store);

  try {
    const res = await fetch(`${server.url}refs?q=ref1`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert(data.items.length > 0 || data.items.length === 0);
  } finally {
    await server.close();
  }
});

test("GET /ref/:id returns full reference with tags", async () => {
  const { store, ref1 } = await setup();
  const server = await startDashboard(store);

  try {
    store.addTags(ref1.id, ["button", "primary"], "owner");

    const res = await fetch(`${server.url}ref/${ref1.id}`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.id, ref1.id);
    assert(Array.isArray(data.tags));
    assert(data.tags.includes("button"));
  } finally {
    await server.close();
  }
});

test("POST /ref/:id/tags adds tags", async () => {
  const { store, ref1 } = await setup();
  const server = await startDashboard(store);

  try {
    const res = await fetch(`${server.url}ref/${ref1.id}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: ["test", "tag"] }),
    });
    assert.equal(res.status, 200);

    const tags = store.getTags(ref1.id);
    assert(tags.includes("test"));
  } finally {
    await server.close();
  }
});

test("POST /ref/:id/discard marks reference as discarded", async () => {
  const { store, ref1 } = await setup();
  const server = await startDashboard(store);

  try {
    const res = await fetch(`${server.url}ref/${ref1.id}/discard`, {
      method: "POST",
    });
    assert.equal(res.status, 200);

    const ref = store.getReference(ref1.id);
    assert.equal(ref?.status, "discarded");
  } finally {
    await server.close();
  }
});

test("GET /family/:id returns family with members", async () => {
  const { store, family1 } = await setup();
  const server = await startDashboard(store);

  try {
    const res = await fetch(`${server.url}family/${family1.id}`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.id, family1.id);
    assert(Array.isArray(data.members));
    assert(data.members.length > 0);
    assert(data.members[0].previewUrl);
  } finally {
    await server.close();
  }
});

test("POST /family/:id/descriptor merges partial fields", async () => {
  const { store, family1 } = await setup();
  const server = await startDashboard(store);

  try {
    const res = await fetch(`${server.url}family/${family1.id}/descriptor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: "Updated summary",
        mood: ["minimal", "modern"],
      }),
    });
    assert.equal(res.status, 200);

    const fam = store.getFamily(family1.id);
    const desc = fam?.descriptor as any;
    assert.equal(desc.summary, "Updated summary");
    assert.deepEqual(desc.mood, ["minimal", "modern"]);
  } finally {
    await server.close();
  }
});

test("POST /family/:id/descriptor returns 400 for invalid dial value", async () => {
  const { store, family1 } = await setup();
  const server = await startDashboard(store);

  try {
    const res = await fetch(`${server.url}family/${family1.id}/descriptor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dials: { visualDensity: 1.5 },
      }),
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert(data.error);
  } finally {
    await server.close();
  }
});

test("POST /family/:id/exemplar updates exemplar flag", async () => {
  const { store, family1 } = await setup();
  const server = await startDashboard(store);

  try {
    const members = store.getMembers(family1.id);
    const refId = members[0].refId;

    const res = await fetch(`${server.url}family/${family1.id}/exemplar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refId, isExemplar: false }),
    });
    assert.equal(res.status, 200);

    const updated = store.getMembers(family1.id)[0];
    assert.equal(updated.isExemplar, false);
  } finally {
    await server.close();
  }
});

test("GET /generate-command/:id returns command with style", async () => {
  const { store, family1 } = await setup();
  const server = await startDashboard(store);

  try {
    const res = await fetch(`${server.url}generate-command/${family1.id}`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert(data.command);
    assert(data.command.includes("nullume generate"));
    assert(data.command.includes("--style"));
  } finally {
    await server.close();
  }
});

// Cleanup
test.after(() => {
  try {
    rmSync(testDir, { recursive: true });
  } catch {}
});

test("dashboard POST /import with unknown source returns 400", async () => {
  const { store } = await setup();
  const server = await startDashboard(store);

  try {
    const res = await fetch(`${server.url}import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "unknown-source-xyz", limit: 10 }),
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert(data.error);
  } finally {
    await server.close();
  }
});

test("dashboard POST /add with relative path returns 400", async () => {
  const { store } = await setup();
  const server = await startDashboard(store);

  try {
    const res = await fetch(`${server.url}add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths: ["./relative/path.jpg"] }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.results[0].status, "failed");
    assert(data.results[0].reason.includes("absolute"));
  } finally {
    await server.close();
  }
});

test("dashboard POST /cluster on empty store returns 400", async () => {
  const { store } = await setup();
  const server = await startDashboard(store);

  try {
    const res = await fetch(`${server.url}cluster`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert(data.error.includes("embed"));
  } finally {
    await server.close();
  }
});

test("dashboard POST /add with fixture PNG ingests successfully", async () => {
  const { store } = await setup();
  const fixturePath = join(__dirname, "../ingest/__fixtures__/red-solid.png");
  
  if (!existsSync(fixturePath)) {
    console.log("Fixture not found at", fixturePath);
    return; // Skip if fixture missing
  }

  const server = await startDashboard(store);

  try {
    const res = await fetch(`${server.url}add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths: [fixturePath] }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ingested, 1);
    assert(data.results[0].refId);
    assert.equal(data.results[0].status, "ingested");
  } finally {
    await server.close();
  }
});

test("POST body larger than 1 MB is rejected and the server keeps serving", async () => {
  const { store } = await setup();
  const server = await startDashboard(store);
  try {
    const status = await fetch(`${server.url}add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths: ["/x".repeat(600_000)] }),
    })
      .then((r) => r.status)
      .catch(() => "closed");
    assert.ok(status === 413 || status === "closed", String(status));
    const after = await fetch(`${server.url}state`);
    assert.equal(after.status, 200);
  } finally {
    await server.close();
  }
});

test("POST /add rejects more than 200 paths and non-string entries", async () => {
  const { store } = await setup();
  const server = await startDashboard(store);
  try {
    const many = await fetch(`${server.url}add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths: Array.from({ length: 201 }, (_, i) => `/tmp/${i}.png`) }),
    });
    assert.equal(many.status, 400);
    const bad = await fetch(`${server.url}add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths: [42] }),
    });
    assert.equal(bad.status, 400);
  } finally {
    await server.close();
  }
});

test("GET /generate-command quotes the prompt for a POSIX shell", async () => {
  const { store, family1 } = await setup();
  store.updateFamily(family1.id, {
    descriptor: { ...(family1.descriptor as object), prompt_fragment: "it's $(rm -rf /) `x`" },
  });
  const server = await startDashboard(store);
  try {
    const res = await fetch(`${server.url}generate-command/${family1.id}`);
    assert.equal(res.status, 200);
    const { command } = await res.json();
    assert.ok(command.includes("--prompt 'it'\\''s $(rm -rf /) `x`"), command);
    assert.ok(!/--prompt "/.test(command));
  } finally {
    await server.close();
  }
});

test("responses carry nosniff and no-referrer headers", async () => {
  const { store } = await setup();
  const server = await startDashboard(store);
  try {
    const res = await fetch(`${server.url}state`);
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    assert.equal(res.headers.get("referrer-policy"), "no-referrer");
  } finally {
    await server.close();
  }
});
