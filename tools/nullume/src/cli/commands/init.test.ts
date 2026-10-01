import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { initProject } from "./init.js";

// Simple UUID generator since we can't use uuid package
function simpleUuid(): string {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

test("init creates .mcp.json with nullume entry", async () => {
  const testDir = path.join(tmpdir(), `nullume-init-test-${simpleUuid()}`);
  await fs.promises.mkdir(testDir, { recursive: true });

  try {
    const result = await initProject(testDir);

    assert(result.created.includes(".mcp.json"), "Should create .mcp.json");

    const mcpJson = JSON.parse(await fs.promises.readFile(path.join(testDir, ".mcp.json"), "utf-8"));
    assert(mcpJson.mcpServers, "Should have mcpServers");
    assert(mcpJson.mcpServers.nullume, "Should have nullume server");
    assert(mcpJson.mcpServers.nullume.command, "Should have command");
    assert(mcpJson.mcpServers.nullume.args, "Should have args");
    assert(mcpJson.mcpServers.nullume.env, "Should have env");
  } finally {
    await fs.promises.rm(testDir, { recursive: true, force: true });
  }
});

test("init copies SKILL.md to .claude/skills/nullume", async () => {
  const testDir = path.join(tmpdir(), `nullume-init-test-${simpleUuid()}`);
  await fs.promises.mkdir(testDir, { recursive: true });

  try {
    const result = await initProject(testDir);

    const skillPath = path.join(testDir, ".claude/skills/nullume/SKILL.md");
    assert(fs.existsSync(skillPath), `SKILL.md should be copied to ${skillPath}`);

    const content = await fs.promises.readFile(skillPath, "utf-8");
    assert(content.includes("Nullume"), "SKILL.md should contain Nullume content");
  } finally {
    await fs.promises.rm(testDir, { recursive: true, force: true });
  }
});

test("init copies taste-curator.md agent to .claude/agents", async () => {
  const testDir = path.join(tmpdir(), `nullume-init-test-${simpleUuid()}`);
  await fs.promises.mkdir(testDir, { recursive: true });

  try {
    const result = await initProject(testDir);

    const agentPath = path.join(testDir, ".claude/agents/taste-curator.md");
    assert(fs.existsSync(agentPath), `taste-curator.md should be copied to ${agentPath}`);

    const content = await fs.promises.readFile(agentPath, "utf-8");
    assert(content.includes("name: taste-curator"), "Agent should have name: taste-curator");
    assert(content.includes("---"), "Agent should have frontmatter");
  } finally {
    await fs.promises.rm(testDir, { recursive: true, force: true });
  }
});

test("init updates .env.example with KIE_API_KEY", async () => {
  const testDir = path.join(tmpdir(), `nullume-init-test-${simpleUuid()}`);
  await fs.promises.mkdir(testDir, { recursive: true });

  try {
    const result = await initProject(testDir);

    assert(result.updated.includes(".env.example"), "Should update .env.example");

    const envExamplePath = path.join(testDir, ".env.example");
    const content = await fs.promises.readFile(envExamplePath, "utf-8");
    assert(content.includes("KIE_API_KEY="), "Should have KIE_API_KEY line");
  } finally {
    await fs.promises.rm(testDir, { recursive: true, force: true });
  }
});

test("init updates .gitignore with .env", async () => {
  const testDir = path.join(tmpdir(), `nullume-init-test-${simpleUuid()}`);
  await fs.promises.mkdir(testDir, { recursive: true });

  try {
    const result = await initProject(testDir);

    assert(result.updated.includes(".gitignore"), "Should update .gitignore");

    const gitignorePath = path.join(testDir, ".gitignore");
    const content = await fs.promises.readFile(gitignorePath, "utf-8");
    assert(content.includes(".env"), "Should have .env line");
  } finally {
    await fs.promises.rm(testDir, { recursive: true, force: true });
  }
});

test("init does not overwrite existing .mcp.json without --force", async () => {
  const testDir = path.join(tmpdir(), `nullume-init-test-${simpleUuid()}`);
  await fs.promises.mkdir(testDir, { recursive: true });

  try {
    // First init
    const result1 = await initProject(testDir);
    assert(result1.created.includes(".mcp.json"));

    // Add another entry to .mcp.json
    const mcpJsonPath = path.join(testDir, ".mcp.json");
    const mcpConfig = JSON.parse(await fs.promises.readFile(mcpJsonPath, "utf-8"));
    mcpConfig.mcpServers.other = { command: "test" };
    await fs.promises.writeFile(mcpJsonPath, JSON.stringify(mcpConfig, null, 2) + "\n");

    // Second init without --force should skip
    const result2 = await initProject(testDir, false);
    assert(result2.skipped.some((s) => s.includes(".mcp.json")), "Should skip .mcp.json without --force");

    // Verify other entry is still there
    const updated = JSON.parse(await fs.promises.readFile(mcpJsonPath, "utf-8"));
    assert(updated.mcpServers.other, "Should preserve other mcpServers entries");
  } finally {
    await fs.promises.rm(testDir, { recursive: true, force: true });
  }
});

test("init with --force overwrites existing .mcp.json entry", async () => {
  const testDir = path.join(tmpdir(), `nullume-init-test-${simpleUuid()}`);
  await fs.promises.mkdir(testDir, { recursive: true });

  try {
    // First init
    await initProject(testDir);

    // Add another entry
    const mcpJsonPath = path.join(testDir, ".mcp.json");
    const mcpConfig = JSON.parse(await fs.promises.readFile(mcpJsonPath, "utf-8"));
    mcpConfig.mcpServers.other = { command: "test" };
    await fs.promises.writeFile(mcpJsonPath, JSON.stringify(mcpConfig, null, 2) + "\n");

    // Second init with --force should update
    const result = await initProject(testDir, true);
    assert(!result.skipped.some((s) => s.includes(".mcp.json")), "Should not skip with --force");

    // Verify both entries exist
    const updated = JSON.parse(await fs.promises.readFile(mcpJsonPath, "utf-8"));
    assert(updated.mcpServers.nullume, "Should have nullume entry");
    assert(updated.mcpServers.other, "Should preserve other entries");
  } finally {
    await fs.promises.rm(testDir, { recursive: true, force: true });
  }
});

test("init does not duplicate KIE_API_KEY in .env.example", async () => {
  const testDir = path.join(tmpdir(), `nullume-init-test-${simpleUuid()}`);
  await fs.promises.mkdir(testDir, { recursive: true });

  try {
    // Create .env.example with KIE_API_KEY
    const envExamplePath = path.join(testDir, ".env.example");
    await fs.promises.writeFile(envExamplePath, "KIE_API_KEY=sk_test\n");

    // Init should not add it again
    const result = await initProject(testDir);

    const content = await fs.promises.readFile(envExamplePath, "utf-8");
    const count = (content.match(/KIE_API_KEY/g) || []).length;
    assert.strictEqual(count, 1, "Should have KIE_API_KEY exactly once");
  } finally {
    await fs.promises.rm(testDir, { recursive: true, force: true });
  }
});

test("init does not duplicate .env in .gitignore", async () => {
  const testDir = path.join(tmpdir(), `nullume-init-test-${simpleUuid()}`);
  await fs.promises.mkdir(testDir, { recursive: true });

  try {
    // Create .gitignore with .env
    const gitignorePath = path.join(testDir, ".gitignore");
    await fs.promises.writeFile(gitignorePath, ".env\n");

    // Init should not add it again
    const result = await initProject(testDir);

    const content = await fs.promises.readFile(gitignorePath, "utf-8");
    const count = (content.match(/^\.env$/gm) || []).length;
    assert.strictEqual(count, 1, "Should have .env entry exactly once");
  } finally {
    await fs.promises.rm(testDir, { recursive: true, force: true });
  }
});
