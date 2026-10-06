# TaskOrbit MCP bridge

Local stdio connection to your self-hosted TaskOrbit server. Requires Node.js ≥22.18.

Create a personal token in **TaskOrbit → Settings → AI integrations · MCP**. Set `TASKORBIT_SERVER` to the HTTPS root address and `TASKORBIT_TOKEN` to the token (or use `TASKORBIT_TOKEN_FILE`). Run `taskorbit-mcp` through your MCP client's stdio configuration. Windows clients can launch it through `cmd /c npx`; macOS/Linux can use `npx` directly.

Read-only tokens omit writing tools. All operations use the account's current workspace permissions. Revoke tokens inside TaskOrbit. Tokens are never included in this package.

See the complete configuration and troubleshooting instructions, including Codex, Cursor and Claude examples: [English](https://github.com/sajadjanat/taskorbit/blob/main/docs/MCP.md) · [Persian](https://github.com/sajadjanat/taskorbit/blob/main/docs/MCP.fa.md) · [Arabic](https://github.com/sajadjanat/taskorbit/blob/main/docs/MCP.ar.md) · [Simplified Chinese](https://github.com/sajadjanat/taskorbit/blob/main/docs/MCP.zh-CN.md).
