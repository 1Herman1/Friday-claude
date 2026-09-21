#!/usr/bin/env node
/**
 * Sync skill and agent from tools/nullume into Friday repository
 * Copies:
 *   1. skills/nullume/SKILL.md → ../../.claude/skills/nullume/SKILL.md
 *   2. agents/taste-curator.md → ../../.claude/agents/design/taste-curator.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const toolsRoot = path.join(dir, "..");
const fridayRoot = path.join(toolsRoot, "../../");

interface FileMapping {
  src: string;
  dest: string;
  name: string;
}

const filesToSync: FileMapping[] = [
  {
    src: path.join(toolsRoot, "skills/nullume/SKILL.md"),
    dest: path.join(fridayRoot, ".claude/skills/nullume/SKILL.md"),
    name: "Skill",
  },
  {
    src: path.join(toolsRoot, "agents/taste-curator.md"),
    dest: path.join(fridayRoot, ".claude/agents/design/taste-curator.md"),
    name: "Agent (taste-curator)",
  },
];

async function sync() {
  // Check if Friday directory exists (if not in Friday context, exit gracefully)
  if (!fs.existsSync(path.join(fridayRoot, ".claude"))) {
    console.log("Not in Friday context (.claude not found), skipping sync");
    process.exit(0);
  }

  let failed = false;

  for (const file of filesToSync) {
    try {
      // Check source exists
      if (!fs.existsSync(file.src)) {
        console.error(`✕ Source not found: ${file.src}`);
        failed = true;
        continue;
      }

      // Ensure destination directory exists
      await fs.promises.mkdir(path.dirname(file.dest), { recursive: true });

      // Read source
      const content = await fs.promises.readFile(file.src, "utf-8");

      // Write destination
      await fs.promises.writeFile(file.dest, content, "utf-8");

      console.log(`✓ Synced ${file.name}: ${file.src} → ${file.dest}`);
    } catch (error) {
      console.error(`✕ Sync failed for ${file.name}: ${(error as Error).message}`);
      failed = true;
    }
  }

  if (failed) {
    process.exit(1);
  }
}

sync();
