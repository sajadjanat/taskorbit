import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { request as httpRequest, createServer } from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createApp } from "../server/app.mjs";
import { createApi, serverAddress } from "../mcp/api.mjs";
const dir = mkdtempSync(path.join(tmpdir(), "taskorbit-mcp-"));
const { app, db, closeRealtime } = createApp({
  database: path.join(dir, "test.sqlite"),
  serveStatic: false,
  secure: false,
});
let server, base, cookie, ws, p, read, write, admin, viewer, other;
async function req(url, method = "GET", body, credential = cookie) {
  const r = await fetch(base + "/api" + url, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(credential
        ? credential.startsWith("to_")
          ? { Authorization: `Bearer ${credential}` }
          : { Cookie: credential }
        : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json(), r };
}
async function good(...args) {
  const r = await req(...args);
  assert.ok(r.r.ok, `${args[0]} ${r.status}: ${JSON.stringify(r.data)}`);
  return r.data;
}
async function client(token) {
  const c = new Client({ name: "test-agent", version: "1.0.0" });
  await c.connect(
    new StreamableHTTPClientTransport(new URL(base + "/mcp"), {
      requestInit: { headers: { Authorization: `Bearer ${token}` } },
    }),
  );
  return c;
}
async function call(c, name, args = {}) {
  const r = await c.callTool({ name, arguments: args });
  assert.equal(r.isError, undefined, r.content?.[0]?.text);
  return JSON.parse(r.content[0].text);
}
before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
  const setup = await req(
    "/setup",
    "POST",
    {
      name: "Fixture owner",
      email: "mcp@example.test",
      password: "mcp-fixture-password",
      workspace: "MCP fixture",
    },
    null,
  );
  cookie = setup.r.headers.get("set-cookie").split(";")[0];
  ws = (await good("/workspaces"))[0];
  p = await good(`/workspaces/${ws.id}/projects`, "POST", {
    name: "Agent project",
    identifier: "AGENT",
  });
  read = await good("/me/tokens", "POST", { name: "Read fixture" });
  write = await good("/me/tokens", "POST", {
    name: "Write fixture",
    write: true,
  });
  admin = await good("/me/tokens", "POST", {
    name: "Admin fixture",
    write: true,
    admin: true,
  });
});
after(async () => {
  closeRealtime();
  await new Promise((r) => server.close(r));
  db.close();
  rmSync(dir, { recursive: true, force: true });
});
test("personal tokens are shown once, hashed in SQLite, scoped, expiring and excluded from export", async () => {
  const list = await good("/me/tokens");
  assert.equal(list.length, 3);
  assert.ok(list.every((t) => !t.token && !t.token_hash && !t.user_id));
  assert.notEqual(
    db.prepare("SELECT token_hash FROM api_tokens WHERE id=?").get(read.id)
      .token_hash,
    read.token,
  );
  assert.deepEqual(read.scopes, ["read"]);
  assert.ok(read.expires > Date.now());
  assert.equal((await good("/admin/export")).api_tokens, undefined);
  assert.equal(
    (
      await req(
        "/me/tokens",
        "POST",
        { name: "Escalation", write: true, admin: true },
        write.token,
      )
    ).status,
    403,
  );
  assert.equal(
    (await req(`/me/tokens/${read.id}`, "DELETE", undefined, write.token))
      .status,
    403,
  );
});
test("HTTP protocol authenticates, rejects query secrets, forged Origin/Host and unsupported methods", async () => {
  assert.equal((await fetch(base + "/mcp")).status, 401);
  assert.equal(
    (
      await fetch(base + "/mcp?token=not-a-real-token", {
        headers: { Authorization: `Bearer ${read.token}` },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await fetch(base + "/mcp", {
        headers: {
          Authorization: `Bearer ${read.token}`,
          Origin: "https://evil.test",
        },
      })
    ).status,
    403,
  );
  const badHost = await new Promise((resolve, reject) => {
    const request = httpRequest(
      base + "/mcp",
      { headers: { Authorization: `Bearer ${read.token}`, Host: "evil.test" } },
      (res) => {
        res.resume();
        resolve(res.statusCode);
      },
    );
    request.on("error", reject);
    request.end();
  });
  assert.equal(badHost, 403);
  assert.equal(
    (
      await fetch(base + "/mcp", {
        headers: { Authorization: `Bearer ${read.token}` },
      })
    ).status,
    405,
  );
});
test("read-only SDK client initializes, lists tools and prompts and cannot mutate", async () => {
  const c = await client(read.token);
  try {
    const keys = (await c.listTools()).tools.map((t) => t.name);
    assert.ok(keys.includes("list_tasks"));
    assert.ok(!keys.includes("create_task"));
    assert.ok(!keys.includes("list_users"));
    assert.equal(
      (await call(c, "list_projects", { workspace_id: ws.id })).items[0].id,
      p.id,
    );
    assert.ok(
      (await c.listPrompts()).prompts.some((p) => p.name === "getting_started"),
    );
    assert.equal(
      (
        await c.callTool({
          name: "create_task",
          arguments: { project_id: p.id, title: "Forbidden" },
        })
      ).isError,
      true,
    );
    assert.equal(
      (
        await req(
          `/projects/${p.id}/tasks`,
          "POST",
          { title: "Forbidden" },
          read.token,
        )
      ).status,
      403,
    );
    assert.equal(
      (await req("/admin/users", "GET", undefined, read.token)).status,
      403,
    );
  } finally {
    await c.close();
  }
});
test("SDK writes use normal task version conflicts, comments, sprint/module/page/view/file/link permissions and audit", async () => {
  const c = await client(admin.token);
  try {
    assert.equal((await c.listTools()).tools.length, 48);
    const sprint = await call(c, "create_sprint", {
      project_id: p.id,
      name: "Sprint",
      start_date: "2026-10-06",
      end_date: "2026-10-20",
    });
    const module = await call(c, "create_module", {
      project_id: p.id,
      name: "Module",
    });
    const t = await call(c, "create_task", {
      project_id: p.id,
      title: "Agent work",
      sprint_id: sprint.id,
      module_id: module.id,
    });
    const updated = await call(c, "update_task", {
      task_id: t.id,
      version: t.version,
      status: "doing",
    });
    assert.equal(updated.title, t.title);
    assert.equal(updated.version, 1);
    const stale = await c.callTool({
      name: "update_task",
      arguments: { task_id: t.id, version: 0, title: "Lost update" },
    });
    assert.equal(stale.isError, true);
    assert.match(stale.content[0].text, /409/);
    await call(c, "add_comment", { task_id: t.id, body: "Agent comment" });
    assert.equal((await call(c, "list_comments", { task_id: t.id })).total, 1);
    const file = await call(c, "upload_attachment", {
      task_id: t.id,
      name: "fixture.txt",
      base64: Buffer.from("Agent file").toString("base64"),
    });
    assert.equal(
      Buffer.from(
        (await call(c, "download_attachment", { attachment_id: file.id }))
          .base64,
        "base64",
      ).toString(),
      "Agent file",
    );
    const next = await call(c, "create_task", {
      project_id: p.id,
      title: "Dependency",
    });
    const link = await call(c, "create_link", {
      task_id: t.id,
      target_id: next.id,
      type: "blocks",
    });
    assert.equal((await call(c, "list_links", { task_id: t.id })).total, 1);
    await call(c, "delete_link", { link_id: link.id });
    const page = await call(c, "create_page", {
      project_id: p.id,
      title: "Agent notes",
      body: "Draft",
    });
    await call(c, "update_page", {
      id: page.id,
      title: page.title,
      body: "Edited",
      version: page.version,
    });
    assert.equal(
      (
        await c.callTool({
          name: "update_page",
          arguments: {
            id: page.id,
            title: page.title,
            body: "Stale",
            version: 0,
          },
        })
      ).isError,
      true,
    );
    const view = await call(c, "create_view", {
      project_id: p.id,
      name: "Doing",
      filters: { status: "doing" },
    });
    await call(c, "delete_view", { id: view.id });
    await call(c, "delete_attachment", { attachment_id: file.id });
    await call(c, "delete_page", { id: page.id });
    await call(c, "delete_module", { id: module.id });
    assert.equal(
      (await call(c, "get_task", { task_id: t.id })).module_id,
      null,
    );
    assert.ok(
      (await call(c, "list_activity", { project_id: p.id })).total >= 4,
    );
    await call(c, "delete_task", { task_id: next.id });
    await call(c, "delete_task", { task_id: t.id });
  } finally {
    await c.close();
  }
});
test("tokens preserve viewer and workspace boundaries and cannot escalate admin", async () => {
  viewer = await good("/admin/users", "POST", {
    name: "Viewer fixture",
    email: "viewer-mcp@example.test",
    password: "mcp-fixture-password",
  });
  await good(`/workspaces/${ws.id}/members`, "POST", {
    email: viewer.email,
    role: "viewer",
  });
  const login = await req(
    "/login",
    "POST",
    { email: viewer.email, password: "mcp-fixture-password" },
    null,
  );
  const vc = login.r.headers.get("set-cookie").split(";")[0];
  const token = await good(
    "/me/tokens",
    "POST",
    { name: "Viewer write", write: true },
    vc,
  );
  assert.equal(
    (await req("/me/tokens", "POST", { name: "Fake admin", admin: true }, vc))
      .status,
    403,
  );
  const c = await client(token.token);
  try {
    assert.equal(
      (
        await c.callTool({
          name: "create_task",
          arguments: { project_id: p.id, title: "Viewer edit" },
        })
      ).isError,
      true,
    );
    const privateWs = await good("/workspaces", "POST", {
      name: "Private fixture",
    });
    other = await good(`/workspaces/${privateWs.id}/projects`, "POST", {
      name: "Private",
      identifier: "PRIVATE",
    });
    assert.equal(
      (
        await c.callTool({
          name: "list_tasks",
          arguments: { project_id: other.id },
        })
      ).isError,
      true,
    );
    assert.equal(
      (await req(`/projects/${other.id}/tasks`, "GET", undefined, write.token))
        .status,
      200,
    );
    assert.equal(
      (await req(`/me/tokens/${read.id}`, "DELETE", undefined, vc)).status,
      404,
    );
    await good(`/workspaces/${ws.id}/members/${viewer.id}`, "DELETE");
    assert.equal(
      (
        await c.callTool({
          name: "list_tasks",
          arguments: { project_id: p.id },
        })
      ).isError,
      true,
    );
    await good(`/admin/users/${viewer.id}`, "PATCH", { active: false });
    assert.equal((await req("/me", "GET", undefined, token.token)).status, 401);
  } finally {
    await c.close();
  }
});
test("stdio protocol connects to the real API using environment configuration", async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.resolve("mcp/server.mjs")],
    env: {
      ...process.env,
      TASKORBIT_SERVER: base,
      TASKORBIT_TOKEN: write.token,
    },
    stderr: "pipe",
  });
  let stderr = "";
  transport.stderr?.on("data", (chunk) => (stderr += chunk));
  const c = new Client({ name: "stdio-fixture", version: "1.0.0" });
  try {
    await c.connect(transport);
    assert.ok(
      (await c.listTools()).tools.some((t) => t.name === "create_task"),
    );
    assert.equal((await call(c, "who_am_i")).scopes.includes("write"), true);
    const t = await call(c, "create_task", {
      project_id: p.id,
      title: "Stdio work",
    });
    assert.equal(t.title, "Stdio work");
    assert.ok(!stderr.includes(write.token));
  } finally {
    await c.close();
  }
});
test("revocation, expiry and account reset invalidate tokens; malformed credentials cannot fall back to cookies", async () => {
  const expired = await good("/me/tokens", "POST", { name: "Expire" });
  db.prepare("UPDATE api_tokens SET expires=0 WHERE id=?").run(expired.id);
  assert.equal((await req("/me", "GET", undefined, expired.token)).status, 401);
  await good(`/me/tokens/${read.id}`, "DELETE");
  assert.equal((await req("/me", "GET", undefined, read.token)).status, 401);
  const forged = await fetch(base + "/api/me", {
    headers: { Cookie: cookie, Authorization: "Bearer invalid" },
  });
  assert.equal(forged.status, 401);
  const reset = await good("/me/tokens", "POST", { name: "Reset me" });
  await good("/me/password", "PUT", {
    current: "mcp-fixture-password",
    password: "new-fixture-password",
  });
  assert.equal((await req("/me", "GET", undefined, reset.token)).status, 401);
  assert.equal(
    db
      .prepare(
        "SELECT COUNT(*) AS n FROM api_tokens WHERE user_id=(SELECT id FROM users WHERE email='mcp@example.test')",
      )
      .get().n,
    0,
  );
});
test("stdio addresses disallow credentials, paths and nonlocal cleartext; redirects never forward credentials", async () => {
  for (const url of [
    "http://remote.test",
    "https://user:password@example.test",
    "https://example.test/path",
    "https://example.test/?token=x",
  ])
    assert.throws(() => serverAddress(url));
  assert.equal(serverAddress("https://example.test/"), "https://example.test");
  assert.throws(() => createApi(base, "bad-token"));
  let forwarded = false;
  const target = createServer((request, response) => {
    forwarded = true;
    response.end("unexpected");
  });
  target.listen(0, "127.0.0.1");
  await new Promise((r) => target.once("listening", r));
  const redirect = createServer((request, response) => {
    response.writeHead(307, {
      Location: `http://127.0.0.1:${target.address().port}/api/me`,
    });
    response.end();
  });
  redirect.listen(0, "127.0.0.1");
  await new Promise((r) => redirect.once("listening", r));
  try {
    const api = createApi(
      `http://127.0.0.1:${redirect.address().port}`,
      write.token,
    );
    await assert.rejects(api("/me"), /Cannot reach TaskOrbit/);
    assert.equal(
      forwarded,
      false,
      "A redirect must not forward the request or credentials",
    );
  } finally {
    await Promise.all([
      new Promise((r) => redirect.close(r)),
      new Promise((r) => target.close(r)),
    ]);
  }
});
