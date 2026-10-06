import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createApp } from "../server/app.mjs";
import { openDatabase } from "../server/db.mjs";

const dir = mkdtempSync(path.join(tmpdir(), "taskorbit-test-")),
  file = path.join(dir, "test.sqlite");
const { app, db } = createApp({
  database: file,
  serveStatic: false,
  origin: "http://tasks.test",
  secure: false,
});
let server,
  base,
  owner,
  workspace,
  project,
  sprint,
  task,
  member,
  viewer,
  other,
  cookie = "";
const auth = new Map();
async function request(url, method = "GET", body, as = "owner", origin) {
  const r = await fetch(base + "/api" + url, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(auth.get(as) ? { Cookie: auth.get(as) } : {}),
      ...(origin ? { Origin: origin } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  return { r, data };
}
async function good(url, method = "GET", body, as = "owner") {
  const { r, data } = await request(url, method, body, as);
  assert.ok(r.ok, `${method} ${url}: ${r.status} ${JSON.stringify(data)}`);
  return data;
}
async function login(email, as) {
  const { r, data } = await request(
    "/login",
    "POST",
    { email, password: "test-password-123" },
    "anonymous",
  );
  assert.equal(r.status, 200);
  auth.set(as, r.headers.get("set-cookie").split(";")[0]);
  return data;
}
before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise((r) => server.close(r));
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

test("health and setup are public; work data requires login", async () => {
  assert.equal((await request("/health")).r.status, 200);
  assert.equal((await request("/workspaces")).r.status, 401);
  assert.equal((await request("/setup")).data.required, true);
});
test("setup creates exactly one instance admin and workspace; password never returned", async () => {
  const { r, data } = await request(
    "/setup",
    "POST",
    {
      name: "Test owner",
      email: "owner@example.test",
      password: "test-password-123",
      workspace: "Test workspace",
    },
    "anonymous",
  );
  assert.equal(r.status, 201);
  assert.equal(data.admin, 1);
  assert.equal(data.password, undefined);
  owner = data;
  cookie = r.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  auth.set("owner", cookie.split(";")[0]);
  workspace = (await good("/workspaces"))[0];
  assert.equal(
    (
      await request(
        "/setup",
        "POST",
        {
          name: "Again",
          email: "again@example.test",
          password: "test-password-123",
          workspace: "Again",
        },
        "anonymous",
      )
    ).r.status,
    409,
  );
  assert.equal((await request("/setup")).data.required, false);
});
test("origin check blocks browser CSRF", async () => {
  assert.equal(
    (
      await request(
        "/workspaces",
        "POST",
        { name: "Bad" },
        "owner",
        "https://evil.test",
      )
    ).r.status,
    403,
  );
});
test("creates users and hashed sessions; duplicate email rejected", async () => {
  member = await good("/admin/users", "POST", {
    name: "Test member",
    email: "member@example.test",
    password: "test-password-123",
  });
  viewer = await good("/admin/users", "POST", {
    name: "Test viewer",
    email: "viewer@example.test",
    password: "test-password-123",
  });
  other = await good("/admin/users", "POST", {
    name: "Test outsider",
    email: "outsider@example.test",
    password: "test-password-123",
  });
  assert.equal(
    (
      await request("/admin/users", "POST", {
        name: "Duplicate",
        email: "member@example.test",
        password: "test-password-123",
      })
    ).r.status,
    409,
  );
  await login(member.email, "member");
  await login(viewer.email, "viewer");
  await login(other.email, "other");
  assert.ok(
    !db
      .prepare("SELECT token FROM sessions LIMIT 1")
      .get()
      .token.includes(cookie),
  );
  assert.notEqual(
    db.prepare("SELECT password FROM users WHERE id=?").get(owner.id).password,
    "test-password-123",
  );
});
test("workspace memberships control reads and writes; no cross-workspace leaks", async () => {
  await good(`/workspaces/${workspace.id}/members/${member.id}`, "PUT", {
    role: "member",
  });
  await good(`/workspaces/${workspace.id}/members/${viewer.id}`, "PUT", {
    role: "viewer",
  });
  assert.equal(
    (
      await request(
        `/workspaces/${workspace.id}/members`,
        "GET",
        undefined,
        "other",
      )
    ).r.status,
    403,
  );
  assert.equal(
    (await good("/workspaces", "GET", undefined, "other")).length,
    0,
  );
  assert.equal(
    (await request("/admin/users", "GET", undefined, "member")).r.status,
    403,
  );
});
test("only managers create projects; identifiers are unique", async () => {
  assert.equal(
    (
      await request(
        `/workspaces/${workspace.id}/projects`,
        "POST",
        { name: "Denied", identifier: "NO" },
        "member",
      )
    ).r.status,
    403,
  );
  project = await good(`/workspaces/${workspace.id}/projects`, "POST", {
    name: "Project",
    identifier: "TEST",
  });
  assert.equal(
    (
      await request(`/workspaces/${workspace.id}/projects`, "POST", {
        name: "Duplicate",
        identifier: "TEST",
      })
    ).r.status,
    409,
  );
});
test("validates sprint dates and permits only one active sprint", async () => {
  assert.equal(
    (
      await request(`/projects/${project.id}/sprints`, "POST", {
        name: "Bad",
        start_date: "2026-10-10",
        end_date: "2026-10-01",
      })
    ).r.status,
    400,
  );
  assert.equal(
    (
      await request(`/projects/${project.id}/sprints`, "POST", {
        name: "Invalid",
        start_date: "2026-02-31",
        end_date: "2026-03-12",
      })
    ).r.status,
    400,
  );
  sprint = await good(`/projects/${project.id}/sprints`, "POST", {
    name: "Sprint 1",
    start_date: "2026-10-05",
    end_date: "2026-10-19",
    status: "active",
  });
  assert.equal(
    (
      await request(`/projects/${project.id}/sprints`, "POST", {
        name: "Concurrent",
        start_date: "2026-10-05",
        end_date: "2026-10-19",
        status: "active",
      })
    ).r.status,
    409,
  );
});
test("members create full work items; viewers cannot write", async () => {
  task = await good(
    `/projects/${project.id}/tasks`,
    "POST",
    {
      title: "Test task",
      description: "Multiline\nbody",
      assignee_id: member.id,
      sprint_id: sprint.id,
      labels: ["backend"],
      estimate: 3,
      due_date: "2026-10-12",
    },
    "member",
  );
  assert.equal(task.number, 1);
  assert.equal(task.version, 0);
  assert.deepEqual(task.labels, ["backend"]);
  assert.equal(
    (
      await request(
        `/projects/${project.id}/tasks`,
        "POST",
        { title: "Denied" },
        "viewer",
      )
    ).r.status,
    403,
  );
  assert.equal(
    (await good(`/projects/${project.id}/tasks`, "GET", undefined, "viewer"))
      .length,
    1,
  );
});
test("rejects unrelated assignees and cross-project sprint/parent references", async () => {
  const p = await good(`/workspaces/${workspace.id}/projects`, "POST", {
    name: "Second",
    identifier: "SECOND",
  });
  assert.equal(
    (
      await request(`/projects/${project.id}/tasks`, "POST", {
        title: "Bad assignee",
        assignee_id: other.id,
      })
    ).r.status,
    400,
  );
  assert.equal(
    (
      await request(`/projects/${p.id}/tasks`, "POST", {
        title: "Bad sprint",
        sprint_id: sprint.id,
      })
    ).r.status,
    400,
  );
  assert.equal(
    (
      await request(`/projects/${p.id}/tasks`, "POST", {
        title: "Bad parent",
        parent_id: task.id,
      })
    ).r.status,
    400,
  );
  assert.equal(
    (await request(`/tasks/${task.id}`, "GET", undefined, "other")).r.status,
    403,
  );
});
test("optimistic locking prevents lost updates and logs activity", async () => {
  const changed = await good(
    `/tasks/${task.id}`,
    "PUT",
    { ...task, status: "doing" },
    "member",
  );
  assert.equal(changed.version, 1);
  assert.equal(
    (
      await request(
        `/tasks/${task.id}`,
        "PUT",
        { ...task, status: "done" },
        "member",
      )
    ).r.status,
    409,
  );
  task = changed;
  const activity = await good(`/projects/${project.id}/activity`);
  assert.equal(activity[0].action, "updated");
});
test("subtasks prevent cycles and cascade on parent deletion", async () => {
  const parent = await good(`/projects/${project.id}/tasks`, "POST", {
    title: "Parent",
  });
  const child = await good(`/projects/${project.id}/tasks`, "POST", {
    title: "Child",
    parent_id: parent.id,
  });
  assert.equal(
    (
      await request(`/tasks/${parent.id}`, "PUT", {
        ...parent,
        parent_id: child.id,
      })
    ).r.status,
    400,
  );
  await good(`/tasks/${parent.id}`, "DELETE");
  assert.ok(
    !(await good(`/projects/${project.id}/tasks`)).some(
      (t) => t.id === child.id,
    ),
  );
});
test("comments require write access and return author names", async () => {
  await good(
    `/tasks/${task.id}/comments`,
    "POST",
    { body: "A test comment" },
    "member",
  );
  assert.equal(
    (
      await request(
        `/tasks/${task.id}/comments`,
        "POST",
        { body: "Denied" },
        "viewer",
      )
    ).r.status,
    403,
  );
  const cs = await good(`/tasks/${task.id}/comments`);
  assert.equal(cs[0].name, member.name);
  assert.equal(cs[0].body, "A test comment");
});
test("modules, pages and shared views persist; pages reject stale edits", async () => {
  const m = await good(`/projects/${project.id}/modules`, "POST", {
    name: "Module",
  });
  const p = await good(`/projects/${project.id}/pages`, "POST", {
    title: "Decision",
    body: "Plain text <script>alert(1)</script>",
  });
  await good(`/pages/${p.id}`, "PUT", { ...p, body: "Updated" });
  assert.equal((await request(`/pages/${p.id}`, "PUT", p)).r.status, 409);
  const v = await good(`/projects/${project.id}/views`, "POST", {
    name: "Doing",
    filters: { status: "doing" },
  });
  assert.equal(
    (await good(`/projects/${project.id}/views`))[0].filters.status,
    "doing",
  );
  await good(`/modules/${m.id}`, "DELETE");
  await good(`/views/${v.id}`, "DELETE");
});
test("data export excludes password hashes and sessions", async () => {
  const ex = await good("/admin/export");
  assert.ok(ex.users.length);
  assert.ok(ex.tasks.length);
  assert.equal(ex.users[0].password, undefined);
  assert.equal(ex.sessions, undefined);
  assert.equal(
    (await request("/admin/export", "GET", undefined, "member")).r.status,
    403,
  );
});
test("workspace administrator can add an existing user by email", async () => {
  await good(`/workspaces/${workspace.id}/members`, "POST", {
    email: viewer.email,
    role: "viewer",
  });
  assert.equal(
    (
      await request(`/workspaces/${workspace.id}/members`, "POST", {
        email: "missing@example.test",
        role: "member",
      })
    ).r.status,
    404,
  );
});
test("attachments require membership and download as inert attachments", async () => {
  const r = await fetch(base + `/api/tasks/${task.id}/attachments`, {
    method: "POST",
    headers: {
      Cookie: auth.get("member"),
      "Content-Type": "application/octet-stream",
      "X-File-Name": encodeURIComponent("brief.html"),
    },
    body: Buffer.from("<script>bad()</script>"),
  });
  assert.equal(r.status, 201);
  const a = await r.json();
  const dl = await fetch(base + `/api/attachments/${a.id}`, {
    headers: { Cookie: auth.get("owner") },
  });
  assert.equal(dl.status, 200);
  assert.match(dl.headers.get("content-disposition"), /^attachment;/);
  assert.match(dl.headers.get("content-type"), /application\/octet-stream/);
  assert.equal(await dl.text(), "<script>bad()</script>");
  assert.equal(
    (await request(`/tasks/${task.id}/attachments`, "GET", undefined, "other"))
      .r.status,
    403,
  );
  const blocked = await fetch(base + `/api/attachments/${a.id}`, {
    headers: { Cookie: auth.get("other") },
  });
  assert.equal(blocked.status, 403);
  await good(`/attachments/${a.id}`, "DELETE");
});
test("dependency graph rejects cycles and cross-project links", async () => {
  const a = await good(`/projects/${project.id}/tasks`, "POST", {
    title: "Depends on work",
  });
  await good(`/tasks/${task.id}/links`, "POST", {
    target_id: a.id,
    type: "blocks",
  });
  assert.equal(
    (
      await request(`/tasks/${a.id}/links`, "POST", {
        target_id: task.id,
        type: "blocks",
      })
    ).r.status,
    400,
  );
  assert.equal(
    (
      await request(`/tasks/${task.id}/links`, "POST", {
        target_id: task.id,
        type: "related",
      })
    ).r.status,
    400,
  );
  const l = (await good(`/tasks/${task.id}/links`))[0];
  assert.equal(l.title, a.title);
  await good(`/links/${l.id}`, "DELETE");
  await good(`/tasks/${a.id}`, "DELETE");
});
test("archived projects are read-only and can be restored by managers", async () => {
  await good(`/projects/${project.id}`, "PUT", { ...project, archived: true });
  assert.equal(
    (await request(`/projects/${project.id}/tasks`, "POST", { title: "No" })).r
      .status,
    409,
  );
  assert.ok((await good(`/projects/${project.id}/tasks`)).length);
  await good(`/projects/${project.id}`, "PUT", { ...project, archived: false });
});
test("revoking membership immediately revokes task and comment access", async () => {
  await good(`/workspaces/${workspace.id}/members/${viewer.id}`, "DELETE");
  assert.equal(
    (await request(`/projects/${project.id}/tasks`, "GET", undefined, "viewer"))
      .r.status,
    403,
  );
  assert.equal(
    (await request(`/tasks/${task.id}/comments`, "GET", undefined, "viewer")).r
      .status,
    403,
  );
});
test("disable user invalidates existing sessions; admin cannot disable self", async () => {
  await good(`/admin/users/${other.id}`, "PATCH", { active: false });
  assert.equal((await request("/me", "GET", undefined, "other")).r.status, 401);
  assert.equal(
    (await request(`/admin/users/${owner.id}`, "PATCH", { active: false })).r
      .status,
    400,
  );
});
test("password change invalidates sessions; logout clears login", async () => {
  await good(
    "/me/password",
    "PUT",
    { current: "test-password-123", password: "another-test-password" },
    "member",
  );
  assert.equal(
    (await request("/me", "GET", undefined, "member")).r.status,
    401,
  );
  await good("/logout", "POST");
  assert.equal((await request("/me")).r.status, 401);
});
test("opening database again preserves projects and work items", () => {
  const reopened = openDatabase(file);
  assert.equal(
    reopened.prepare("SELECT title FROM tasks WHERE id=?").get(task.id).title,
    "Test task",
  );
  assert.equal(reopened.prepare("PRAGMA user_version").get().user_version, 2);
  reopened.close();
});
