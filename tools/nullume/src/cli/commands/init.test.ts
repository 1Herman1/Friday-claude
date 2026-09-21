import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { v4 as uuid } from "crypto";

// Simple UUID generator since we can't use uuid package
function simpleUuid(): string {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function initProject(targetDir: string, force: boolean = false): Promise<{
  created: string[];
  updated: string[];
  skipped: string[];
  errors: string[];
}> {
  const { packageRoot } = await import("../../core/paths.js");
  const pRoot = packageRoot();
  const skillSrc = path.join(pRoot, "skills/nullume/SKILL.md");

  // Check if running from dist (npm installed) or src (development)
  const isFromDist = !fs.existsSync(path.join(pRoot, "src"));

  // Determine MCP command and args
  let mcpCommand: string;
  let mcpArgs: string[];

  if (isFromDist) {
    mcpCommand = "npx";
    mcpArgs = ["-y", "nullume", "mcp"];
  } else {
    const mpcStdioPath = path.join(pRoot, "bin/mcp-stdio.sh");
    mcpCommand = "bash";
    mcpArgs = [mpcStdioPath];
  }

  const mcpEnv = {
    KIE_API_KEY: "${KIE_API_KEY}",
  };

  const result = {
    created: [] as string[],
    updated: [] as string[],
    skipped: [] as string[],
    errors: [] as string[],
  };

  try {
    // Create .mcp.json
    const mcpJsonPath = path.join(targetDir, ".mcp.json");
    let existing = null;
    if (fs.existsSync(mcpJsonPath)) {
      try {
        existing = JSON.parse(fs.readFileSync(mcpJsonPath, "utf-8"));
      } catch {
        // ignore
      }
    }

    const mcpConfig = existing || { mcpServers: {} };
    if (!mcpConfig.mcpServers) {
      mcpConfig.mcpServers = {};
    }

    if (mcpConfig.mcpServers.nullume && !force) {
      result.skipped.push(".mcp.json (nullume entry exists, use --force to overwrite)");
    } else {
      mcpConfig.mcpServers.nullume = {
        command: mcpCommand,
        args: mcpArgs,
        env: mcpEnv,
      };
      await fs.promises.mkdir(path.dirname(mcpJsonPath), { recursive: true });
      await fs.promises.writeFile(mcpJsonPath, JSON.stringify(mcpConfig, null, 2) + "\n");
      result[existing && existing.mcpServers && existing.mcpServers.nullume ? "updated" : "created"].push(
        ".mcp.json"
      );
    }

    // Copy SKILL.md if it exists
    if (fs.existsSync(skillSrc)) {
      const skillDestDir = path.join(targetDir, ".claude/skills/nullume");
      const skillDest = path.join(skillDestDir, "SKILL.md");
      await fs.promises.mkdir(skillDestDir, { recursive: true });
      const content = await fs.promises.readFile(skillSrc, "utf-8");
      await fs.promises.writeFile(skillDest, content);
      result.created.push(skillDest);
    }

    // Copy taste-curator.md agent if it exists
    const agentSrc = path.join(pRoot, "agents/taste-curator.md");
    if (fs.existsSync(agentSrc)) {
      const agentDestDir = path.join(targetDir, ".claude/agents");
      const agentDest = path.join(agentDestDir, "taste-curator.md");
      await fs.promises.mkdir(agentDestDir, { recursive: true });
      const content = await fs.promises.readFile(agentSrc, "utf-8");
      await fs.promises.writeFile(agentDest, content);
      result.created.push(agentDest);
    }

    // Update .env.example
    const envExamplePath = path.join(targetDir, ".env.example");
    let envContent = "";
    if (fs.existsSync(envExamplePath)) {
      envContent = await fs.promises.readFile(envExamplePath, "utf-8");
    }

    if (!envContent.includes("KIE_API_KEY")) {
      envContent = (envContent.trim() + "\nKIE_API_KEY=\n").trim() + "\n";
      await fs.promises.mkdir(path.dirname(envExamplePath), { recursive: true });
      await fs.promises.writeFile(envExamplePath, envContent);
      result.updated.push(".env.example");
    }

    // Update .gitignore
    const gitignorePath = path.join(targetDir, ".gitignore");
    let gitignoreContent = "";
    if (fs.existsSync(gitignorePath)) {
      gitignoreContent = await fs.promises.readFile(gitignorePath, "utf-8");
    }

    if (!gitignoreContent.includes(".env")) {
      gitignoreContent = (gitignoreContent.trim() + "\n.env\n").trim() + "\n";
      await fs.promises.mkdir(path.dirname(gitignorePath), { recursive: true });
      await fs.promises.writeFile(gitignorePath, gitignoreContent);
      result.updated.push(".gitignore");
    }
  } catch (error) {
    result.errors.push((error as Error).message);
  }

  return result;
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
