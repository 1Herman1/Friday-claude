import { Command } from "commander";
import { startMcpServer } from "../../mcp/index.js";

export default new Command("mcp")
  .description("Start MCP server for Claude Code")
  .action(async function () {
    await startMcpServer();
  });
