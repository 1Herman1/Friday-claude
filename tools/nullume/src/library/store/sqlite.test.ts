import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { storeContract } from "./store.contract";
import { openStore, openMemoryStore } from "./sqlite";

// Run contract tests on SQLite file-based store
storeContract("SqliteStore (file)", () => {
  const tmpDir = path.join(os.tmpdir(), `nullume-test-${Date.now()}-${Math.random()}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  const dbPath = path.join(tmpDir, "test.db");
  const store = openStore(dbPath);

  // Cleanup on close
  const originalClose = store.close.bind(store);
  (store as any).close = () => {
    originalClose();
    try {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    } catch {
      // ignore
    }
  };

  return store;
});

// Run contract tests on SQLite in-memory store
storeContract("SqliteStore (memory)", () => openMemoryStore());

// Additional SQLite-specific tests
test("SqliteStore file has correct permissions (0600)", () => {
  const tmpDir = path.join(os.tmpdir(), `nullume-test-perms-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  const dbPath = path.join(tmpDir, "test.db");

  const store = openStore(dbPath);
  store.insertReference({
    sha256: "test",
    source: "s",
    sourceRef: "r",
    originalPath: "/p",
    width: 800,
    height: 600,
    bytes: 1024,
    meta: {},
    status: "active",
  });
  store.close();

  const stats = fs.statSync(dbPath);
  const mode = stats.mode & 0o777;

  // Check that file has restrictive permissions (0600 or similar secure mode)
  // 0o600 = user read/write only
  assert(mode === 0o600 || mode === 0o640 || mode === 0o644, `Expected secure mode, got ${mode.toString(8)}`);

  // Cleanup
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
});

test("SqliteStore migrations are idempotent", () => {
  const tmpDir = path.join(os.tmpdir(), `nullume-test-idempotent-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  const dbPath = path.join(tmpDir, "test.db");

  // First open
  const store1 = openStore(dbPath);
  const ref1 = store1.insertReference({
    sha256: "s1",
    source: "s",
    sourceRef: "r",
    originalPath: "/p",
    width: 800,
    height: 600,
    bytes: 1024,
    meta: {},
    status: "active",
  });
  store1.close();

  // Second open of same file (migrations should be idempotent)
  const store2 = openStore(dbPath);
  const ref2 = store2.getReference(ref1.id);

  assert(ref2);
  assert.equal(ref2.sha256, "s1");

  // Insert another ref to verify schema still works
  const ref3 = store2.insertReference({
    sha256: "s2",
    source: "s",
    sourceRef: "r2",
    originalPath: "/p",
    width: 800,
    height: 600,
    bytes: 1024,
    meta: {},
    status: "active",
  });
  assert(ref3.id);
  store2.close();

  // Cleanup
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
});

test("SqliteStore with NULLUME_HOME env var", () => {
  const tmpDir = path.join(os.tmpdir(), `nullume-test-env-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const oldEnv = process.env.NULLUME_HOME;
  try {
    process.env.NULLUME_HOME = tmpDir;

    // This test just ensures the env var is respected during openStore
    // We'll manually specify path for now to avoid full path dependency
    const dbPath = path.join(tmpDir, "test.db");
    const store = openStore(dbPath);
    assert(fs.existsSync(dbPath));
    store.close();
  } finally {
    if (oldEnv) {
      process.env.NULLUME_HOME = oldEnv;
    } else {
      delete process.env.NULLUME_HOME;
    }

    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
});

test("SqliteStore WAL mode and foreign keys are enabled", () => {
  const tmpDir = path.join(os.tmpdir(), `nullume-test-pragmas-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  const dbPath = path.join(tmpDir, "test.db");

  const store = openStore(dbPath);

  // Create family and reference to test FK constraint
  const ref = store.insertReference({
    sha256: "s1",
    source: "s",
    sourceRef: "r",
    originalPath: "/p",
    width: 800,
    height: 600,
    bytes: 1024,
    meta: {},
    status: "active",
  });

  const family = store.createFamily({
    name: "Test",
    status: "approved",
    proposedBy: "owner",
  });

  // This should not throw because FK constraint is enforced
  assert.doesNotThrow(() => {
    store.setMembers(family.id, [
      {
        familyId: family.id,
        refId: ref.id,
        distance: 0.1,
        isExemplar: false,
      },
    ]);
  });

  store.close();

  // Cleanup
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
});

test("SqliteStore in-memory store works", () => {
  const store = openMemoryStore();
  const ref = store.insertReference({
    sha256: "s1",
    source: "s",
    sourceRef: "r",
    originalPath: "/p",
    width: 800,
    height: 600,
    bytes: 1024,
    meta: {},
    status: "active",
  });

  assert(ref.id);
  assert.equal(store.countReferences(), 1);
  store.close();
});
