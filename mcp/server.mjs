#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createApi } from "./api.mjs";
import { createMcpServer } from "./tools.mjs";
try {
  const token = process.env.TASKORBIT_TOKEN_FILE
    ? (await readFile(process.env.TASKORBIT_TOKEN_FILE, "utf8")).trim()
    : process.env.TASKORBIT_TOKEN;
  const api = createApi(process.env.TASKORBIT_SERVER || "", token);
  const identity = await api("/me/token-info");
  const server = createMcpServer(api, identity);
  await server.connect(new StdioServerTransport());
} catch {
  console.error(
    "TaskOrbit MCP could not start. Set TASKORBIT_SERVER to your HTTPS server root and TASKORBIT_TOKEN (or TASKORBIT_TOKEN_FILE) to a valid personal token. Check connectivity and token expiry. See https://github.com/sajadjanat/taskorbit/blob/main/docs/MCP.md",
  );
  process.exitCode = 1;
}
