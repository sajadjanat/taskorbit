import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "../mcp/tools.mjs";
import { createApi } from "../mcp/api.mjs";
export function mountMcp(app, { origin, identify, limit }) {
  const configured = new URL(origin);
  app.use(
    "/mcp",
    identify,
    limit,
    (req, res, next) => {
      res.set("Cache-Control", "no-store");
      if (req.query.token || req.query.access_token)
        return res
          .status(400)
          .json({ error: "Send the token in the Authorization header" });
      if (!req.token || !req.user)
        return res
          .status(401)
          .json({
            error:
              "Create an MCP token in Settings → AI integrations; send Authorization: Bearer <token>",
          });
      const local = ["localhost", "127.0.0.1", "[::1]"].includes(
        configured.hostname,
      );
      if (
        req.headers.host !== configured.host &&
        !(local && req.headers.host === `127.0.0.1:${req.socket.localPort}`)
      )
        return res.status(403).json({ error: "Host not allowed" });
      if (req.headers.origin && req.headers.origin !== origin)
        return res.status(403).json({ error: "Origin not allowed" });
      if (req.path !== "/")
        return res.status(404).json({ error: "Use the /mcp endpoint" });
      if (req.method !== "POST")
        return res
          .set("Allow", "POST")
          .status(405)
          .json({
            jsonrpc: "2.0",
            error: {
              code: -32000,
              message: "Stateless MCP accepts POST requests",
            },
            id: null,
          });
      next();
    },
    express.json({ limit: "16mb" }),
    async (req, res) => {
      const api = createApi(
        `http://127.0.0.1:${req.socket.localPort}`,
        req.headers.authorization.slice(7),
        origin,
      );
      const server = createMcpServer(api, {
        scopes: req.token.scopes,
        user: req.user,
      });
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      res.on("close", () => {
        void transport.close();
        void server.close();
      });
      try {
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
      } catch {
        if (!res.headersSent)
          res
            .status(500)
            .json({
              jsonrpc: "2.0",
              error: { code: -32603, message: "MCP request failed" },
              id: null,
            });
      }
    },
  );
}
