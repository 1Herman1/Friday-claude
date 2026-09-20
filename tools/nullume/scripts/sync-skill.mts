#!/usr/bin/env node
/**
 * Sync skill from tools/nullume/skills/nullume/SKILL.md
 * to ../../.claude/skills/nullume/SKILL.md (Friday repository)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const toolsRoot = path.join(dir, "..");
const src = path.join(toolsRoot, "skills/nullume/SKILL.md");
const dest = path.join(toolsRoot, "../../.claude/skills/nullume/SKILL.md");

async function sync() {
  try {
    // Ensure destination directory exists
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });

    // Read source
    const content = await fs.promises.readFile(src, "utf-8");

    // Write destination
    await fs.promises.writeFile(dest, content, "utf-8");

    console.log(`✓ Synced: ${src} → ${dest}`);
  } catch (error) {
    console.error(`✕ Sync failed: ${(error as Error).message}`);
    process.exit(1);
  }
}

sync();
