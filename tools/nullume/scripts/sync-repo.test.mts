import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const toolsRoot = path.join(dir, "..");
const skillSrc = path.join(toolsRoot, "skills/nullume/SKILL.md");
const agentSrc = path.join(toolsRoot, "agents/taste-curator.md");
const skillDest = path.join(toolsRoot, "../../.claude/skills/nullume/SKILL.md");
const agentDest = path.join(toolsRoot, "../../.claude/agents/design/taste-curator.md");

test("sync-repo: source files exist", () => {
  assert(fs.existsSync(skillSrc), `Source skill file should exist at ${skillSrc}`);
  assert(fs.existsSync(agentSrc), `Source agent file should exist at ${agentSrc}`);
});

test("sync-repo: skill.md can be synced", async () => {
  // Create destination directory
  await fs.promises.mkdir(path.dirname(skillDest), { recursive: true });

  // Read source
  const srcContent = await fs.promises.readFile(skillSrc, "utf-8");

  // Verify it's a valid skill file
  assert(srcContent.includes("name: nullume"), "Skill should have name: nullume");
  assert(srcContent.includes("---"), "Skill should have frontmatter");

  // Write to destination
  await fs.promises.writeFile(skillDest, srcContent, "utf-8");

  // Verify destination
  assert(fs.existsSync(skillDest), "Destination should exist after write");

  // Verify content matches
  const destContent = await fs.promises.readFile(skillDest, "utf-8");
  assert.strictEqual(srcContent, destContent, "Source and destination should have identical content");
});

test("sync-repo: agent.md can be synced", async () => {
  // Create destination directory
  await fs.promises.mkdir(path.dirname(agentDest), { recursive: true });

  // Read source
  const srcContent = await fs.promises.readFile(agentSrc, "utf-8");

  // Verify it's a valid agent file
  assert(srcContent.includes("name: taste-curator"), "Agent should have name: taste-curator");
  assert(srcContent.includes("---"), "Agent should have frontmatter");

  // Write to destination
  await fs.promises.writeFile(agentDest, srcContent, "utf-8");

  // Verify destination
  assert(fs.existsSync(agentDest), "Destination should exist after write");

  // Verify content matches
  const destContent = await fs.promises.readFile(agentDest, "utf-8");
  assert.strictEqual(srcContent, destContent, "Source and destination should have identical content");
});
