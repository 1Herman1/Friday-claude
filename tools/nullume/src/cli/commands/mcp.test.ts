import { test } from "node:test";
import assert from "node:assert";
import { createMcpServer } from "../../mcp/index.js";

test("mcp command creates server successfully", () => {
  const server = createMcpServer();

  // Verify server is created without errors
  assert(server !== null && server !== undefined, "Should create MCP server instance");
  assert(typeof server === "object", "Server should be an object");
});

test("mcp server created without errors", () => {
  // This test ensures no errors occur during server creation
  // which includes registering all tools
  const server = createMcpServer();
  assert(server, "Server should be created without errors");
});
