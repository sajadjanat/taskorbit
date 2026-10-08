# Connect an AI agent to TaskOrbit

[English](MCP.md) · [Persian](MCP.fa.md) · [Arabic](MCP.ar.md) · [简体中文](MCP.zh-CN.md)

MCP lets an agent read and manage your team's work through your self-hosted TaskOrbit server. It does not install a model or send data to an AI provider by itself. The agent you connect receives the work data returned by the tools it calls.

## 1. Create your token

1. Sign in to **your TaskOrbit server** in a browser or connected client.
2. Open **Settings → AI integrations · MCP**.
3. Enter a recognizable name, such as `My Codex`, and an expiry in days (1–365; default 30).
4. Leave **Allow editing work data** off for a read-only connection. Turn it on if the agent should create or edit work. Instance administrators may separately allow instance administration, which grants their server-wide access. Without that permission, even an administrator's token is restricted to their workspace memberships.
5. Select **Create token**, copy it once and save it in the agent's private secret configuration. The server stores only a SHA-256 hash. You cannot retrieve the original later; revoke it and create another if lost.

Tokens never grant more access than the account's current role. Viewers cannot write even with a write token. Membership changes take effect on the next operation. Password changes/resets and account deactivation revoke tokens. Logging out of the app does not revoke an agent token; use **Revoke** explicitly. Only the signed-in application can create or revoke your tokens.

## 2. Choose a connection

| Method                 | Requirements                                                                   | Use it for                                                |
| ---------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------- |
| Remote Streamable HTTP | HTTPS root server address; client supports custom Bearer authentication        | Codex, Cursor, Claude Code, custom SDK agents             |
| Local stdio bridge     | Node.js ≥22.18 on the agent's machine; internet for first package installation | Claude Desktop and agents that launch local MCP processes |

Replace `https://tasks.example.com` with your server's **root address**. The remote MCP endpoint is `https://tasks.example.com/mcp`; the bridge's `TASKORBIT_SERVER` is `https://tasks.example.com` (without `/mcp` or `/api`). HTTP is accepted only for localhost development. No extra Docker service is needed. Configure `APP_ORIGIN` to the public HTTPS origin and preserve its Host header through your reverse proxy.

### Codex: remote HTTP

Create a private environment variable named `TASKORBIT_TOKEN` containing the copied token, available to the process that launches Codex. In PowerShell, `$env:TASKORBIT_TOKEN = 'YOUR_TOKEN'` sets it for that shell and its child processes; on macOS/Linux use `export TASKORBIT_TOKEN='YOUR_TOKEN'`. Replace the placeholder privately. For a desktop application launched from a menu, use your OS user environment settings or launch the app from the configured shell. Do not put the token in a shared shell script or repository. Fully restart the application after changing its environment.

Add to your private `~/.codex/config.toml`:

```toml
[mcp_servers.taskorbit]
url = "https://tasks.example.com/mcp"
bearer_token_env_var = "TASKORBIT_TOKEN"
```

Or register it from the configured shell:

```sh
codex mcp add taskorbit --url https://tasks.example.com/mcp --bearer-token-env-var TASKORBIT_TOKEN
```

Restart Codex and check its MCP tools. This integration uses a personal Bearer token; an OAuth login command is not needed. [Official configuration reference](https://developers.openai.com/codex/mcp/).

### Cursor: remote HTTP

With `TASKORBIT_TOKEN` available to the application, add this to your personal `~/.cursor/mcp.json`, or merge the `taskorbit` entry into its existing `mcpServers` object:

```json
{
  "mcpServers": {
    "taskorbit": {
      "url": "https://tasks.example.com/mcp",
      "headers": { "Authorization": "Bearer ${env:TASKORBIT_TOKEN}" }
    }
  }
}
```

Restart Cursor and enable the server in its MCP settings. [Official Cursor guide](https://cursor.com/docs/mcp).

### Claude Code: remote HTTP

Merge this entry into the appropriate personal `mcpServers` configuration (`~/.claude.json`), or `.mcp.json` with the secret kept in the environment:

```json
{
  "mcpServers": {
    "taskorbit": {
      "type": "http",
      "url": "https://tasks.example.com/mcp",
      "headers": { "Authorization": "Bearer ${TASKORBIT_TOKEN}" }
    }
  }
}
```

Restart and open `/mcp` to check the connection. This is token authentication, not OAuth. [Official Claude Code guide](https://code.claude.com/docs/en/mcp).

### Claude Desktop or another stdio client

Install Node.js ≥22.18 first. Open the client's MCP configuration (Claude Desktop: **Settings → Developer → Edit Config**) and merge this entry. Replace `YOUR_TOKEN` privately; keep this file outside Git. Existing servers should remain in the same `mcpServers` object.

```json
{
  "mcpServers": {
    "taskorbit": {
      "command": "npx",
      "args": [
        "-y",
        "--package=https://github.com/sajadjanat/taskorbit/releases/download/v0.2.1/taskorbit-mcp-0.2.1.tgz",
        "taskorbit-mcp"
      ],
      "env": {
        "TASKORBIT_SERVER": "https://tasks.example.com",
        "TASKORBIT_TOKEN": "YOUR_TOKEN"
      }
    }
  }
}
```

**Windows:** change `command` to `cmd` and prepend `"/c", "npx"` to `args`. The in-app guide generates both Windows and macOS/Linux examples. `node`, `npm` and `npx` must be visible on the client's PATH. If the first download exceeds the client's startup timeout, install the bridge first with `npm install -g <the package URL above>`, then use the full installed executable path as its command with no arguments. Fully quit and reopen the client.

Instead of placing a token in JSON, the bridge supports `TASKORBIT_TOKEN_FILE` pointing to an absolute private UTF-8 file containing only the token; it takes precedence over `TASKORBIT_TOKEN`. Restrict its permissions to your OS user. It still reads that file only at startup. Download the versioned package from [GitHub Releases](https://github.com/sajadjanat/taskorbit/releases) and check `SHA256SUMS`. The package runs a local process that calls your server API; it contains no server database or credentials.

For a source checkout, run `npm ci` at the repository root, then use `node /absolute/path/to/taskorbit/mcp/server.mjs` with the same environment variables. The bridge prints only MCP protocol messages on stdout; diagnostics go to stderr.

## 3. Verify and start using it

Ask the agent: **“Use TaskOrbit to list my workspaces.”** It should call `list_workspaces`. Choose the workspace and project you want, then ask it to list work items or summarize sprint progress. To create/edit items, enable writing when creating the token. Ask before deleting data or starting a server upgrade.

The 48-tool administrator catalog covers workspaces, projects, members, tasks/subtasks, priorities/labels/estimates, sprints, modules, pages, saved views, comments, activity, attachments, task relations, users, work-data export and server updates. A read-only or non-admin token sees fewer tools. `getting_started` is also available as an MCP prompt. Capabilities follow the existing product API: sprint completion is supported; sprint deletion and editing/deleting comments are not currently implemented. Account passwords and token lifecycle are managed in the app; administrative user reset is available only with explicit admin+write scope.

Tools use the normal API authorization, validation, activity history and maintenance rules. Task/page updates require the version previously read; stale edits return `409`. Tools that return lists support `limit` (1–200, default 50) and `offset`. File uploads are limited to 10 MiB and 20 files per task; `download_attachment` reads chunks of 64 KiB by default, up to 1 MiB per call. Advance its `offset` until `has_more` is false to retrieve larger files. A single textual tool result is limited to approximately 1.5 million characters. MCP edits propagate to connected web and native clients through the same live events.

## Troubleshooting

| Symptom                                 | Fix                                                                                                                                                               |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `401`, or startup failure               | Check the correct token, expiry and server address. A website login cookie is not an MCP token. Create a new token if needed.                                     |
| `403`                                   | Check both token scopes and the account's workspace role. An ordinary token cannot administer the entire instance.                                                |
| No editing tools                        | Revoke/create a new token with **Allow editing work data**, then restart the agent.                                                                               |
| `409` editing conflict                  | Read the current task/page, reconcile changes and retry with its new version.                                                                                     |
| `429`                                   | Wait before retrying; authenticated sessions/tokens have independent quotas. Do not loop requests.                                                                |
| Cannot reach server                     | Verify HTTPS, certificate, network and public `APP_ORIGIN`. Local bridge uses the root URL; remote HTTP uses `/mcp`.                                              |
| `405` from opening `/mcp` in a browser  | Expected: this stateless protocol endpoint accepts POST, not a browser page or standalone SSE GET. Use an MCP client.                                             |
| `npx` not found / bridge download fails | Install Node.js, restart the client so PATH updates, check registry/network and release URL; use the Windows command variant.                                     |
| Client insists on OAuth only            | This release uses manual Bearer tokens. Use a client supporting custom headers or its stdio mode. OAuth-only hosted connectors are not supported in this release. |

Protocols: standard stdio and stateless Streamable HTTP with JSON responses. Legacy HTTP+SSE, OAuth discovery, presence and server-initiated MCP notifications are not provided. Compatibility is verified with the official SDK over both transports; each third-party application's UI/installation is not physically verified. [MCP transport reference](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports), [SDK documentation](https://ts.sdk.modelcontextprotocol.io/).
