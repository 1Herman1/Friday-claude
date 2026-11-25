#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const cli = fileURLToPath(new URL("./design-lint.mjs", import.meta.url));
const RULE_SEEDS = [
  ["forbidden-font", "Inter", "ERROR"],
  ["purple-blue-gradient", "from-purple-500 to-blue-500", "ERROR"],
  ["gray-text-on-color-bg", "text-gray-500 bg-red-500", "ERROR"],
  ["side-border-decor", "border-l-4", "ERROR"],
  ["bounce-elastic-easing", "animate-bounce", "ERROR"],
  ["small-touch-target", "h-4 w-4", "ERROR"],
  ["too-round-corners", "rounded-3xl", "ERROR"],
  ["price-without-division", "{price}", "WARNING"],
  ["transition-all", "transition-all", "ERROR"],
  ["blanket-will-change", "will-change: transform", "WARNING"],
  ["ease-in-on-ui", "ease-in", "ERROR"],
  ["animate-layout-prop", "transition: width 2s", "WARNING"],
  ["scale-from-zero", "scale(0)", "ERROR"],
  // Preserve the legacy Cyrillic word-boundary heuristic, not a policy fix.
  ["marketing-filler", "xРеволюционный", "WARNING"],
  ["offbrand-hex", "color: #445566", "WARNING"],
  ["offbrand-font", "font-['Other']", "WARNING"],
  ["arbitrary-spacing", "p-[7px]", "WARNING"],
];
for (const [rule, seed, level] of RULE_SEEDS) {
  test(`legacy seed: ${rule}`, (t) => {
    const f = fixture(t);
    f.write("docs/projects/brand/design-system/MASTER.md", "#112233\nfontFamily: { body: ['Brand'] }");
    f.write("seed.tsx", `\n${seed}\n`);
    const result = f.run("--json", "seed.tsx");
    assert.equal(result.status, level === "ERROR" ? 2 : 0);
    const data = JSON.parse(result.stdout);
    assert.deepEqual(data.findings.map(({ rule: name, line, level: severity }) => [name, line, severity]), [[rule, 2, level]]);
    assert.equal(data.coverage.scannedCount, 1);
    assert.equal(data.exitCode, result.status);
    assert.equal(typeof data.findings[0].hint, "string");
  });
}

test("warning human output stays successful without claiming no findings", (t) => {
  const f = fixture(t);
  f.write("warning.tsx", "{price}");
  const result = f.run("warning.tsx");
  assert.equal(result.status, 0);
  assert.match(result.stdout, /warning.tsx:1 — .*\[WARNING\]/);
  assert.match(result.stdout, /1 проблем в 1 файлах/);
});

test("clean human output and existing exclusions remain unchanged", (t) => {
  const f = fixture(t);
  f.write("clean.html", "<!doctype html>\n<main class='rounded-full ease-in-out' style='font-size: 10px'>\n<input value={price} />\n{price / 100}\n{price.toFixed(2)}\n</main>");
  const result = f.run("clean.html");
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "\nПроблем не обнаружено.\n");
  assert.equal(result.stderr, "");
});

test("imported MASTER scope follows projects and tools path before active project", (t) => {
  const f = fixture(t);
  f.write("docs/projects/.active", "beta");
  f.write("docs/projects/alpha/design-system/MASTER.md", "#112233\nfontFamily: { body: ['Alpha'] }");
  f.write("docs/projects/beta/design-system/MASTER.md", "#445566\nfontFamily: { body: ['Beta'] }");
  f.write("projects/alpha/a.tsx", "#112233 font-['Alpha']");
  f.write("tools/alpha/b.tsx", "#112233 font-['Alpha']");
  f.write("plain.tsx", "#445566 font-['Beta']");
  f.write("projects/alpha/off.tsx", "#445566 font-['Beta']");
  const result = f.run("--json", "projects/alpha", "tools/alpha", "plain.tsx");
  assert.equal(result.status, 0);
  const data = JSON.parse(result.stdout);
  assert.deepEqual(data.findings.map(({ file, rule }) => [file, rule]), [["projects/alpha/off.tsx", "offbrand-hex"], ["projects/alpha/off.tsx", "offbrand-font"]]);
  assert.equal(data.coverage.scannedCount, 4);
});

test("implicit registry keeps src preference and TSX-only discovery through real imported helper", (t) => {
  const f = fixture(t);
  f.write("docs/projects/README.md", "| A | app | `a/` | `projects/a/` | none |\n| B | app | `b/` | `tools/b/` | none |");
  f.write("projects/a/src/clean.tsx", "<main />");
  f.write("projects/a/outside.tsx", "Inter");
  f.write("projects/a/src/ignored.jsx", "Inter");
  f.write("tools/b/nested/clean.tsx", "<main />");
  const result = f.run("--json");
  assert.equal(result.status, 0);
  const data = JSON.parse(result.stdout);
  assert.equal(data.coverage.mode, "registry");
  assert.deepEqual(data.coverage.files, ["projects/a/src/clean.tsx", "tools/b/nested/clean.tsx"]);
  assert.equal(data.coverage.scannedCount, 2);
});

test("JSON findings are deterministic and preserve exact explicit file spelling", (t) => {
  const f = fixture(t);
  f.write("space dir/a.tsx", "Inter\n{price}");
  const target = "./space dir/a.tsx";
  const first = f.run("--json", target);
  const second = f.run(target, "--json");
  assert.equal(first.status, 2);
  assert.equal(first.stdout, second.stdout);
  const data = JSON.parse(first.stdout);
  assert.deepEqual(data.coverage.targets, [target]);
  assert.equal(data.findings[0].file, target);
  assert.deepEqual(data.findings.map(({ rule, line, level }) => [rule, line, level]), [["forbidden-font", 1, "ERROR"], ["price-without-division", 2, "WARNING"]]);
  assert.deepEqual(data.summary, { errors: 1, warnings: 1, operationalErrors: 0 });
});
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "design-lint-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return {
    root,
    write(file, content) {
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      fs.writeFileSync(path.join(root, file), content);
    },
    run(...args) {
      const env = { ...process.env };
      delete env.ACTIVE_PROJECT;
      const result = spawnSync(process.execPath, [cli, ...args], {
        cwd: root, env, encoding: "utf8", timeout: 10000,
      });
      assert.equal(result.error, undefined);
      return result;
    },
  };
}

test("registry coverage retains discovered root targets and deduplicates overlapping roots", (t) => {
  const f = fixture(t);
  f.write("docs/projects/README.md", "| A | app | `a/` | `projects/a/` `projects/a/nested/` | none |");
  f.write("projects/a/nested/a.tsx", "<main />");
  const result = f.run("--json");
  assert.equal(result.status, 0);
  const data = JSON.parse(result.stdout);
  assert.deepEqual(data.coverage.targets, ["projects/a", "projects/a/nested"]);
  assert.equal(data.coverage.targetCount, 2);
  assert.deepEqual(data.coverage.files, ["projects/a/nested/a.tsx"]);
  assert.equal(data.coverage.scannedCount, 1);
});

test("unreadable registry produces JSON diagnostic instead of uncaught exception", (t) => {
  const f = fixture(t);
  f.write("docs/projects/README.md", "registry");
  fs.chmodSync(path.join(f.root, "docs/projects/README.md"), 0);
  const result = f.run("--json");
  assert.equal(result.status, 1);
  assert.equal(result.stderr, "");
  const data = JSON.parse(result.stdout);
  assert.equal(data.diagnostics[0].code, "read-error");
  assert.equal(data.diagnostics[0].path, "docs/projects/README.md");
});

test("explicit file keeps legacy non-UI extension support", (t) => {
  const f = fixture(t);
  f.write("tokens.ts", "Inter");
  const result = f.run("--json", "tokens.ts");
  assert.equal(result.status, 2);
  assert.equal(JSON.parse(result.stdout).findings[0].rule, "forbidden-font");
});

test("mixed missing and ERROR target retains actual coverage with exit 1 precedence", (t) => {
  const f = fixture(t);
  f.write("good.tsx", "Inter");
  const result = f.run("--json", "missing.tsx", "good.tsx");
  assert.equal(result.status, 1);
  const data = JSON.parse(result.stdout);
  assert.deepEqual(data.coverage.targets, ["missing.tsx", "good.tsx"]);
  assert.deepEqual(data.coverage.files, ["good.tsx"]);
  assert.deepEqual(data.coverage.scannedFiles, ["good.tsx"]);
  assert.equal(data.coverage.discoveredCount, 1);
  assert.equal(data.summary.errors, 1);
  assert.equal(data.summary.operationalErrors, 1);
  assert.equal(data.diagnostics[0].path, "missing.tsx");
});

test("directory symlink cycles are not traversed or treated as UI files", (t) => {
  const f = fixture(t);
  f.write("ui/good.tsx", "<main />");
  fs.symlinkSync(".", path.join(f.root, "ui/loop.tsx"));
  const result = f.run("--json", "ui");
  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.stdout).coverage.files, ["ui/good.tsx"]);
});

test("MASTER ambiguity diagnostics are structured warnings in JSON", (t) => {
  const f = fixture(t);
  f.write("docs/projects/a/design-system/MASTER.md", "#112233");
  f.write("docs/projects/b/design-system/MASTER.md", "#445566");
  f.write("plain.tsx", "<main />");
  const result = f.run("--json", "plain.tsx");
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  const data = JSON.parse(result.stdout);
  assert.equal(data.diagnostics[0].code, "master-scope");
  assert.equal(data.diagnostics[0].level, "WARNING");
  assert.equal(data.summary.operationalErrors, 0);
  const human = f.run("plain.tsx");
  assert.match(human.stdout, /Проблем не обнаружено/);
  assert.match(human.stderr, /Сверка с MASTER.md пропущена/);
});

test("unreadable directory is structured and does not abort mixed targets", (t) => {
  const f = fixture(t);
  f.write("locked/a.tsx", "Inter");
  f.write("good.tsx", "<main />");
  const locked = path.join(f.root, "locked");
  fs.chmodSync(locked, 0);
  const result = f.run("--json", "locked", "good.tsx");
  fs.chmodSync(locked, 0o700);
  assert.equal(result.status, 1);
  assert.equal(result.stderr, "");
  const data = JSON.parse(result.stdout);
  assert.equal(data.diagnostics[0].code, "read-error");
  assert.equal(data.diagnostics[0].path, "locked");
  assert.deepEqual(data.coverage.scannedFiles, ["good.tsx"]);
});

test("invalid arguments are structured operational errors", (t) => {
  const f = fixture(t);
  for (const target of ["--bogus", ""]) {
    const result = f.run("--json", target);
    assert.equal(result.status, 1);
    const data = JSON.parse(result.stdout);
    assert.equal(data.diagnostics[0].code, "invalid-target");
    assert.equal(data.diagnostics[0].path, target);
    assert.equal(data.coverage.scannedCount, 0);
  }
});

test("unreadable file produces structured read-error and preserves other results", (t) => {
  const f = fixture(t);
  f.write("locked.tsx", "Inter");
  f.write("good.tsx", "Inter");
  fs.chmodSync(path.join(f.root, "locked.tsx"), 0);
  const result = f.run("--json", "locked.tsx", "good.tsx");
  assert.equal(result.status, 1);
  assert.equal(result.stderr, "");
  const data = JSON.parse(result.stdout);
  assert.equal(data.diagnostics[0].code, "read-error");
  assert.equal(data.diagnostics[0].path, "locked.tsx");
  assert.deepEqual(data.coverage.scannedFiles, ["good.tsx"]);
  assert.equal(data.findings[0].rule, "forbidden-font");
});

test("zero registry targets never claim clean", (t) => {
  const f = fixture(t);
  const result = f.run("--json");
  assert.equal(result.status, 1);
  const data = JSON.parse(result.stdout);
  assert.equal(data.coverage.mode, "registry");
  assert.equal(data.coverage.scannedCount, 0);
  assert.equal(data.diagnostics[0].code, "zero-targets");
  assert.doesNotMatch(f.run().stdout, /Проблем не обнаружено/);
});

test("empty explicit directory is operational failure even alongside valid target", (t) => {
  const f = fixture(t);
  f.write("empty/readme.md", "not UI");
  f.write("good.tsx", "<main />");
  const result = f.run("--json", "empty", "good.tsx");
  assert.equal(result.status, 1);
  const data = JSON.parse(result.stdout);
  assert.deepEqual(data.coverage.scannedFiles, ["good.tsx"]);
  assert.equal(data.diagnostics[0].code, "empty-target");
  assert.equal(data.diagnostics[0].path, "empty");
});

test("explicit directory recurses through TSX JSX HTML CSS and deduplicates overlaps", (t) => {
  const f = fixture(t);
  for (const file of ["ui/a.tsx", "ui/nested/b.jsx", "ui/page.html", "ui/style.css", "ui/ignored.js", "ui/node_modules/x.tsx", "ui/dist/y.tsx"]) f.write(file, "<main />");
  const result = f.run("--json", "ui", "ui/a.tsx");
  assert.equal(result.status, 0);
  const data = JSON.parse(result.stdout);
  assert.deepEqual(data.coverage.targets, ["ui", "ui/a.tsx"]);
  assert.deepEqual(data.coverage.files, ["ui/a.tsx", "ui/nested/b.jsx", "ui/page.html", "ui/style.css"]);
  assert.equal(data.coverage.scannedCount, 4);
});

test("JSON v1 reports findings, exact paths and coverage without human stdout", (t) => {
  const f = fixture(t);
  f.write("clean.tsx", "<main />");
  const result = f.run("--json", "clean.tsx");
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  const data = JSON.parse(result.stdout);
  assert.deepEqual(data, {
    schemaVersion: 1, findings: [], diagnostics: [],
    coverage: { mode: "explicit", targets: ["clean.tsx"], files: ["clean.tsx"], scannedFiles: ["clean.tsx"], targetCount: 1, discoveredCount: 1, scannedCount: 1 },
    summary: { errors: 0, warnings: 0, operationalErrors: 0 }, exitCode: 0,
  });
});

test("ERROR findings exit 2 and keep human output", (t) => {
  const f = fixture(t);
  f.write("bad.tsx", "Inter\n");
  const result = f.run("bad.tsx");
  assert.equal(result.status, 2);
  assert.match(result.stdout, /bad.tsx:1 — .*\[ERROR\]/);
  assert.match(result.stdout, /1 проблем в 1 файлах/);
});

test("missing target exits 1 instead of false clean", (t) => {
  const f = fixture(t);
  const result = f.run("missing.tsx");
  assert.equal(result.status, 1);
  assert.doesNotMatch(result.stdout, /Проблем не обнаружено/);
});
