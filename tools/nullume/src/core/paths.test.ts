import { test } from "node:test";
import assert from "node:assert";
import { packageRoot, getPackageDataDir } from "./paths.js";
import fs from "node:fs";
import path from "node:path";

test("packageRoot() finds nullume package root", () => {
  const root = packageRoot();

  // Should end with nullume directory
  assert(root.endsWith("nullume"), `Expected root to end with 'nullume', got: ${root}`);

  // Should have package.json with name "nullume"
  const pkgPath = path.join(root, "package.json");
  assert(fs.existsSync(pkgPath), `package.json should exist at ${pkgPath}`);

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  assert.strictEqual(pkg.name, "nullume", `package.json name should be 'nullume'`);
});

test("getPackageDataDir() returns path to data directory", () => {
  const dataDir = getPackageDataDir();

  // Should end with /data
  assert(dataDir.endsWith("data"), `Expected data dir to end with 'data', got: ${dataDir}`);

  // data directory should exist (or be in tools/nullume/data)
  const root = packageRoot();
  assert.strictEqual(dataDir, path.join(root, "data"));
});

test("packageRoot() returns consistent path", () => {
  const root1 = packageRoot();
  const root2 = packageRoot();

  assert.strictEqual(root1, root2, "packageRoot() should return same path on multiple calls");
});
