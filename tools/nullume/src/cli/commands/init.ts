import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import { packageRoot } from "../../core/paths.js";
import { emit } from "../output.js";
import { getGlobalFlags } from "../context.js";

interface McpConfig {
  [key: string]: unknown;
  mcpServers?: Record<
    string,
    {
      command?: string;
      args?: string[];
      env?: Record<string, string>;
      type?: string;
      url?: string;
      headers?: Record<string, string>;
    }
  >;
}

interface InitResult {
  created: string[];
  updated: string[];
  skipped: string[];
  errors: string[];
}

async function ensureDir(dir: string): Promise<void> {
  try {
    await fs.promises.mkdir(dir, { recursive: true, mode: 0o755 });
  } catch (e) {
    if ((e as any)?.code !== "EEXIST") throw e;
  }
}

async function copyFile(src: string, dest: string, overwrite: boolean): Promise<{ copied: boolean; message: string }> {
  if (fs.existsSync(dest) && !overwrite) {
    return { copied: false, message: `skipped (exists): ${path.relative(".", dest)}` };
  }

  await ensureDir(path.dirname(dest));
  await fs.promises.copyFile(src, dest);
  return { copied: true, message: `${fs.existsSync(dest) ? "updated" : "created"}: ${path.relative(".", dest)}` };
}

async function readJson(filePath: string): Promise<unknown> {
  try {
    return JSON.parse(await fs.promises.readFile(filePath, "utf-8"));
  } catch {
    return null;
  }
}

async function writeJson(filePath: string, data: unknown, indent: number = 2): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.promises.writeFile(filePath, JSON.stringify(data, null, indent) + "\n");
}

async function initProject(targetDir: string, force: boolean): Promise<InitResult> {
  const result: InitResult = {
    created: [],
    updated: [],
    skipped: [],
    errors: [],
  };

  try {
    const pRoot = packageRoot();
    const skillSrc = path.join(pRoot, "skills/nullume/SKILL.md");

    // Check if running from dist (npm installed) or src (development)
    const isFromDist = !fs.existsSync(path.join(pRoot, "src"));

    // Determine MCP command and args
    let mcpCommand: string;
    let mcpArgs: string[];
    let mcpEnv: Record<string, string>;

    if (isFromDist) {
      // Installed from npm: use npx
      mcpCommand = "npx";
      mcpArgs = ["-y", "nullume", "mcp"];
    } else {
      // Running from source: use bash wrapper
      const mpcStdioPath = path.join(pRoot, "bin/mcp-stdio.sh");
      mcpCommand = "bash";
      mcpArgs = [mpcStdioPath];
    }

    mcpEnv = {
      KIE_API_KEY: "${KIE_API_KEY}",
    };

    // 1. Handle .mcp.json
    const mcpJsonPath = path.join(targetDir, ".mcp.json");
    let existing: McpConfig | null = null;
    if (fs.existsSync(mcpJsonPath)) {
      // Битый JSON не перезаписываем молча: иначе пропадут чужие серверы.
      existing = (await readJson(mcpJsonPath)) as McpConfig | null;
      if (existing === null) {
        result.errors.push("существующий .mcp.json повреждён — почини вручную или удали, запись пропущена");
      }
    }
    const mcpConfig: McpConfig = existing || { mcpServers: {} };

    if (!mcpConfig.mcpServers) {
      mcpConfig.mcpServers = {};
    }

    if (fs.existsSync(mcpJsonPath) && existing === null) {
      // пропуск: ошибка уже записана выше
    } else if (mcpConfig.mcpServers.nullume && !force) {
      result.skipped.push(".mcp.json (nullume entry exists, use --force to overwrite)");
    } else {
      mcpConfig.mcpServers.nullume = {
        command: mcpCommand,
        args: mcpArgs,
        env: mcpEnv,
      };
      await writeJson(mcpJsonPath, mcpConfig);
      if (existing && existing.mcpServers && existing.mcpServers.nullume) {
        result.updated.push(".mcp.json");
      } else {
        result.created.push(".mcp.json");
      }
    }

    // 2. Copy SKILL.md
    const skillDestDir = path.join(targetDir, ".claude/skills/nullume");
    const skillDest = path.join(skillDestDir, "SKILL.md");

    if (fs.existsSync(skillSrc)) {
      const skillRel = path.relative(targetDir, skillDest);
      const existedBefore = fs.existsSync(skillDest);
      const skillResult = await copyFile(skillSrc, skillDest, force);
      if (skillResult.copied) {
        (existedBefore ? result.updated : result.created).push(skillRel);
      } else {
        result.skipped.push(`${skillRel} (exists, use --force to overwrite)`);
      }
    } else {
      result.errors.push(`Source skill file not found: ${skillSrc}`);
    }

    // 2b. Copy taste-curator agent
    const agentSrc = path.join(pRoot, "agents/taste-curator.md");
    const agentDestDir = path.join(targetDir, ".claude/agents");
    const agentDest = path.join(agentDestDir, "taste-curator.md");

    if (fs.existsSync(agentSrc)) {
      const agentRel = path.relative(targetDir, agentDest);
      const agentExistedBefore = fs.existsSync(agentDest);
      const agentResult = await copyFile(agentSrc, agentDest, force);
      if (agentResult.copied) {
        (agentExistedBefore ? result.updated : result.created).push(agentRel);
      } else {
        result.skipped.push(`${agentRel} (exists, use --force to overwrite)`);
      }
    } else {
      result.errors.push(`Source agent file not found: ${agentSrc}`);
    }

    // 3. Update .env.example
    const envExamplePath = path.join(targetDir, ".env.example");
    let envContent = "";

    if (fs.existsSync(envExamplePath)) {
      envContent = await fs.promises.readFile(envExamplePath, "utf-8");
    }

    if (!envContent.includes("KIE_API_KEY")) {
      envContent = (envContent.trim() + "\nKIE_API_KEY=\n").trim() + "\n";
      await ensureDir(path.dirname(envExamplePath));
      await fs.promises.writeFile(envExamplePath, envContent);
      if (fs.existsSync(envExamplePath)) {
        result.updated.push(".env.example");
      }
    }

    // 4. Update .gitignore
    const gitignorePath = path.join(targetDir, ".gitignore");
    let gitignoreContent = "";

    if (fs.existsSync(gitignorePath)) {
      gitignoreContent = await fs.promises.readFile(gitignorePath, "utf-8");
    }

    if (!gitignoreContent.includes(".env")) {
      gitignoreContent = (gitignoreContent.trim() + "\n.env\n").trim() + "\n";
      await ensureDir(path.dirname(gitignorePath));
      await fs.promises.writeFile(gitignorePath, gitignoreContent);
      if (fs.existsSync(gitignorePath)) {
        result.updated.push(".gitignore");
      }
    }
  } catch (error) {
    result.errors.push((error as Error).message);
  }

  return result;
}

export default new Command("init")
  .argument("[dir]", "Target directory (default: current directory)")
  .option("--force", "Overwrite existing nullume entry in .mcp.json")
  .option("--json", "Output as JSON")
  .description("Initialize nullume in another project")
  .action(async function (dir: string | undefined, options: Record<string, unknown>) {
    const flags = getGlobalFlags();
    const targetDir = dir || process.cwd();
    const force = options.force as boolean;

    try {
      const result = await initProject(targetDir, force);

      if (options.json) {
        emit(flags, {
          data: result,
        });
      } else {
        let output = `Initializing nullume in ${targetDir}\n\n`;

        if (result.created.length > 0) {
          output += "✓ Created:\n";
          result.created.forEach((f) => {
            output += `  • ${f}\n`;
          });
          output += "\n";
        }

        if (result.updated.length > 0) {
          output += "⟳ Updated:\n";
          result.updated.forEach((f) => {
            output += `  • ${f}\n`;
          });
          output += "\n";
        }

        if (result.skipped.length > 0) {
          output += "⊘ Skipped:\n";
          result.skipped.forEach((f) => {
            output += `  • ${f}\n`;
          });
          output += "\n";
        }

        if (result.errors.length > 0) {
          output += "✕ Errors:\n";
          result.errors.forEach((f) => {
            output += `  • ${f}\n`;
          });
          output += "\n";
        }

        if (result.errors.length === 0) {
          output += "Setup complete! Add KIE_API_KEY to .env and you're ready to go.\n";
        }

        emit(flags, { message: output.trim() });
      }
    } catch (error) {
      throw new Error(`Init failed: ${(error as Error).message}`);
    }
  });
