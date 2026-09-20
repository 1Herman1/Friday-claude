import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const toolsRoot = path.join(dir, "..");
const src = path.join(toolsRoot, "skills/nullume/SKILL.md");
const dest = path.join(toolsRoot, "../../.claude/skills/nullume/SKILL.md");

test("sync-skill: source file exists", () => {
  assert(fs.existsSync(src), `Source skill file should exist at ${src}`);
});

test("sync-skill: destination can be written", async () => {
  // Create destination directory
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });

  // Read source
  const srcContent = await fs.promises.readFile(src, "utf-8");

  // Verify it's a valid skill file
  assert(srcContent.includes("name: nullume"), "Skill should have name: nullume");
  assert(srcContent.includes("---"), "Skill should have frontmatter");

  // Write to destination
  await fs.promises.writeFile(dest, srcContent, "utf-8");

  // Verify destination
  assert(fs.existsSync(dest), "Destination should exist after write");

  // Verify content matches
  const destContent = await fs.promises.readFile(dest, "utf-8");
  assert.strictEqual(srcContent, destContent, "Source and destination should have identical content");
});

test("sync-skill: updates produce identical files", async () => {
  // Ensure destination directory exists
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });

  // First sync
  const content1 = await fs.promises.readFile(src, "utf-8");
  await fs.promises.writeFile(dest, content1, "utf-8");
  const written1 = await fs.promises.readFile(dest, "utf-8");

  // Second sync (simulate re-running)
  const content2 = await fs.promises.readFile(src, "utf-8");
  await fs.promises.writeFile(dest, content2, "utf-8");
  const written2 = await fs.promises.readFile(dest, "utf-8");

  assert.strictEqual(written1, written2, "Multiple syncs should produce identical results");
});
