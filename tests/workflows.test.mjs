import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createApp } from "../server/app.mjs";
import { nextDueDate, parseCsv } from "../server/workflows.mjs";
import { openDatabase } from "../server/db.mjs";

async function fixture(t, mailer = null) {
  const dir = mkdtempSync(path.join(tmpdir(), "taskorbit-workflows-"));
  const { app, db, closeRealtime } = createApp({
    database: path.join(dir, "db.sqlite"),
    serveStatic: false,
    secure: false,
    origin: "https://tasks.example.test",
    sendPasswordReset: mailer,
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const cookies = new Map();
  t.after(async () => {
    closeRealtime();
    await new Promise((resolve) => server.close(resolve));
    if (db.isOpen) db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  async function req(url, method = "GET", body, as = "owner") {
    const response = await fetch(base + "/api" + url, {
      method,
      headers: {
        Origin: "https://tasks.example.test",
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(cookies.has(as) ? { Cookie: cookies.get(as) } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    const cookie = response.headers.get("set-cookie");
    if (cookie) cookies.set(as, cookie.split(";")[0]);
    return { status: response.status, data };
  }
  async function ok(url, method = "GET", body, as = "owner") {
    const result = await req(url, method, body, as);
    assert.ok(
      result.status >= 200 && result.status < 300,
      `${method} ${url}: ${result.status} ${JSON.stringify(result.data)}`,
    );
    return result.data;
  }
  const owner = await ok("/setup", "POST", {
    name: "Test owner",
    email: "owner@example.test",
    password: "test-password-123",
    workspace: "Test workspace",
  });
  const workspace = (await ok("/workspaces"))[0];
  const project = await ok(`/workspaces/${workspace.id}/projects`, "POST", {
    name: "Test project",
    identifier: "TEST",
  });
  async function user(name, role) {
    const u = await ok("/admin/users", "POST", {
      name,
      email: `${name}@example.test`,
      password: "test-password-123",
      admin: false,
    });
    if (role)
      await ok(`/workspaces/${workspace.id}/members`, "POST", {
        email: u.email,
        role,
      });
    await ok(
      "/login",
      "POST",
      { email: u.email, password: "test-password-123" },
      name,
    );
    return u;
  }
  return {
    req,
    ok,
    db,
    database: path.join(dir, "db.sqlite"),
    owner,
    workspace,
    project,
    user,
  };
}

test("v2 migration preserves populated work, sessions and references and can reopen twice", async (t) => {
  const f = await fixture(t);
  const sprint = await f.ok(`/projects/${f.project.id}/sprints`, "POST", {
    name: "Existing sprint",
    start_date: "2026-10-08",
    end_date: "2026-10-22",
  });
  const task = await f.ok(`/projects/${f.project.id}/tasks`, "POST", {
    title: "Existing task",
    sprint_id: sprint.id,
    labels: ["keep"],
    estimate: 3,
  });
  await f.ok(`/tasks/${task.id}/comments`, "POST", {
    body: "Existing discussion",
  });
  // Reconstruct the exact previous schema using a disposable, populated database.
  f.db.exec(
    "DROP INDEX task_recurrence_source; ALTER TABLE tasks DROP COLUMN recurrence_source_id; ALTER TABLE tasks DROP COLUMN recurrence; ALTER TABLE sprints DROP COLUMN capacity; DROP TABLE notifications; DROP TABLE password_resets; DROP TABLE sprint_history; PRAGMA user_version=2;",
  );
  const sessions = f.db.prepare("SELECT * FROM sessions").all();
  f.db.close();
  for (let attempt = 0; attempt < 2; attempt++) {
    const migrated = openDatabase(f.database);
    try {
      assert.equal(
        migrated.prepare("PRAGMA user_version").get().user_version,
        3,
      );
      const persisted = migrated
        .prepare("SELECT * FROM tasks WHERE id=?")
        .get(task.id);
      assert.equal(persisted.title, task.title);
      assert.equal(persisted.sprint_id, sprint.id);
      assert.equal(persisted.labels, '["keep"]');
      assert.equal(persisted.recurrence, "none");
      assert.equal(
        migrated
          .prepare("SELECT capacity FROM sprints WHERE id=?")
          .get(sprint.id).capacity,
        0,
      );
      assert.equal(
        migrated
          .prepare("SELECT body FROM comments WHERE task_id=?")
          .get(task.id).body,
        "Existing discussion",
      );
      assert.deepEqual(
        migrated.prepare("SELECT * FROM sessions").all(),
        sessions,
      );
      assert.deepEqual(migrated.prepare("PRAGMA foreign_key_check").all(), []);
    } finally {
      migrated.close();
    }
  }
});

test("slow or failed reset delivery does not delay the generic response or keep invalid tokens", async (t) => {
  let rejectDelivery;
  const delivery = new Promise((_resolve, reject) => {
    rejectDelivery = reject;
  });
  const f = await fixture(t, () => delivery);
  await f.ok(
    "/password/forgot",
    "POST",
    { email: "owner@example.test" },
    "anonymous",
  );
  assert.equal(
    f.db.prepare("SELECT COUNT(*) AS count FROM password_resets").get().count,
    1,
  );
  rejectDelivery(new Error("Test mail delivery failure"));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(
    f.db.prepare("SELECT COUNT(*) AS count FROM password_resets").get().count,
    0,
  );
});

test("global search respects membership and searches tasks, projects, sprints and pages", async (t) => {
  const f = await fixture(t);
  await f.user("member", "member");
  const item = await f.ok(`/projects/${f.project.id}/tasks`, "POST", {
    title: "Visible orbit work",
  });
  await f.ok(`/projects/${f.project.id}/pages`, "POST", {
    title: "Orbit notes",
    body: "Visible details",
  });
  await f.ok(`/projects/${f.project.id}/sprints`, "POST", {
    name: "Orbit sprint",
    start_date: "2026-10-08",
    end_date: "2026-10-22",
  });
  const other = await f.ok("/workspaces", "POST", {
    name: "Private workspace",
  });
  const privateProject = await f.ok(
    `/workspaces/${other.id}/projects`,
    "POST",
    { name: "Secret project", identifier: "SECRET" },
  );
  await f.ok(`/projects/${privateProject.id}/tasks`, "POST", {
    title: "Secret orbit work",
  });
  const rows = await f.ok("/search?q=orbit", "GET", undefined, "member");
  assert.deepEqual(
    new Set(rows.map((r) => r.kind)),
    new Set(["task", "page", "sprint"]),
  );
  assert.ok(rows.some((r) => r.id === item.id));
  assert.ok(rows.every((r) => r.workspace_id === f.workspace.id));
  assert.equal(
    (await f.ok("/search?q=SECRET", "GET", undefined, "member")).length,
    0,
  );
  assert.equal(
    (await f.ok("/search?q=TEST", "GET", undefined, "member")).some(
      (r) => r.kind === "project",
    ),
    true,
  );
  await f.ok(
    `/workspaces/${f.workspace.id}/members/${(await f.ok(`/workspaces/${f.workspace.id}/members`)).find((u) => u.email === "member@example.test").id}`,
    "DELETE",
  );
  assert.deepEqual(
    await f.ok("/search?q=orbit", "GET", undefined, "member"),
    [],
  );
});

test("completion creates one calendar-safe recurring occurrence and stale edits cannot duplicate it", async (t) => {
  const f = await fixture(t);
  assert.equal(nextDueDate("2026-01-31", "monthly"), "2026-02-28");
  assert.equal(nextDueDate("2028-01-31", "monthly"), "2028-02-29");
  assert.equal(nextDueDate("2026-12-30", "weekly"), "2027-01-06");
  assert.equal(
    (
      await f.req(`/projects/${f.project.id}/tasks`, "POST", {
        title: "Missing deadline",
        recurrence: "weekly",
      })
    ).status,
    400,
  );
  const first = await f.ok(`/projects/${f.project.id}/tasks`, "POST", {
    title: "Monthly review",
    recurrence: "monthly",
    due_date: "2026-01-31",
    estimate: 3,
  });
  const done = await f.ok(`/tasks/${first.id}`, "PUT", {
    ...first,
    status: "done",
  });
  let rows = await f.ok(`/projects/${f.project.id}/tasks`);
  assert.equal(rows.length, 2);
  const next = rows.find((r) => r.id !== first.id);
  assert.equal(next.due_date, "2026-02-28");
  assert.equal(next.status, "todo");
  assert.equal(next.recurrence_source_id, first.id);
  assert.equal(
    (await f.req(`/tasks/${first.id}`, "PUT", { ...first, status: "done" }))
      .status,
    409,
  );
  const reopened = await f.ok(`/tasks/${first.id}`, "PUT", {
    ...done,
    status: "todo",
  });
  await f.ok(`/tasks/${first.id}`, "PUT", { ...reopened, status: "done" });
  assert.equal((await f.ok(`/projects/${f.project.id}/tasks`)).length, 2);
  await f.ok(`/tasks/${next.id}`, "PUT", { ...next, status: "done" });
  rows = await f.ok(`/projects/${f.project.id}/tasks`);
  assert.equal(rows.length, 3);
});

test("bulk edits enforce roles, project boundaries and all-or-nothing optimistic locking", async (t) => {
  const f = await fixture(t);
  await f.user("viewer", "viewer");
  const a = await f.ok(`/projects/${f.project.id}/tasks`, "POST", {
    title: "One",
    status: "review",
    priority: "high",
  });
  const b = await f.ok(`/projects/${f.project.id}/tasks`, "POST", {
    title: "Two",
    status: "doing",
  });
  const body = {
    tasks: [
      { id: a.id, version: 0 },
      { id: b.id, version: 0 },
    ],
    changes: { priority: "urgent" },
  };
  assert.equal(
    (
      await f.req(
        `/projects/${f.project.id}/tasks/bulk`,
        "POST",
        body,
        "viewer",
      )
    ).status,
    403,
  );
  await f.ok(`/tasks/${b.id}`, "PUT", { ...b, title: "Changed concurrently" });
  assert.equal(
    (await f.req(`/projects/${f.project.id}/tasks/bulk`, "POST", body)).status,
    409,
  );
  const unchanged = await f.ok(`/tasks/${a.id}`);
  assert.equal(unchanged.priority, "high");
  assert.equal(unchanged.version, 0);
  body.tasks[1].version = 1;
  await f.ok(`/projects/${f.project.id}/tasks/bulk`, "POST", body);
  const changed = await f.ok(`/tasks/${a.id}`);
  assert.equal(changed.priority, "urgent");
  assert.equal(changed.status, "review");
  const other = await f.ok(`/workspaces/${f.workspace.id}/projects`, "POST", {
    name: "Other",
    identifier: "OTHER",
  });
  const foreign = await f.ok(`/projects/${other.id}/tasks`, "POST", {
    title: "Foreign",
  });
  assert.equal(
    (
      await f.req(`/projects/${f.project.id}/tasks/bulk`, "POST", {
        tasks: [
          { id: a.id, version: changed.version },
          { id: foreign.id, version: 0 },
        ],
        changes: { status: "done" },
      })
    ).status,
    400,
  );
  assert.equal((await f.ok(`/tasks/${a.id}`)).status, "review");
});

test("inbox ownership, assignment, discussion, due deduplication and access revocation", async (t) => {
  const f = await fixture(t);
  const member = await f.user("member", "member");
  const item = await f.ok(`/projects/${f.project.id}/tasks`, "POST", {
    title: "Assigned work",
    assignee_id: member.id,
    due_date: "2020-01-01",
  });
  const first = await f.ok("/notifications", "GET", undefined, "member");
  assert.equal(first.unread, 2);
  assert.deepEqual(
    new Set(first.items.map((r) => r.kind)),
    new Set(["assigned", "overdue"]),
  );
  assert.equal(
    (await f.ok("/notifications", "GET", undefined, "member")).items.length,
    2,
  );
  await f.ok(`/tasks/${item.id}/comments`, "POST", { body: "Please review" });
  const withComment = await f.ok("/notifications", "GET", undefined, "member");
  assert.equal(withComment.unread, 3);
  await f.ok(`/notifications/${withComment.items[0].id}/read`, "POST");
  assert.equal(
    (await f.ok("/notifications", "GET", undefined, "member")).unread,
    3,
  );
  await f.ok("/notifications/read", "POST", undefined, "member");
  assert.equal(
    (await f.ok("/notifications", "GET", undefined, "member")).unread,
    0,
  );
  await f.ok(`/workspaces/${f.workspace.id}/members/${member.id}`, "DELETE");
  assert.deepEqual(
    (await f.ok("/notifications", "GET", undefined, "member")).items,
    [],
  );
});

test("templates are localized; project imports remap references, preserve old work and roll back invalid files", async (t) => {
  const f = await fixture(t);
  const p = await f.ok(`/workspaces/${f.workspace.id}/projects`, "POST", {
    name: "Template",
    identifier: "TPL",
    template: "operations",
    locale: "fa",
  });
  assert.equal((await f.ok(`/projects/${p.id}/tasks`)).length, 4);
  assert.match((await f.ok(`/projects/${p.id}/tasks`))[0].title, /هفتگی/);
  const sprint = await f.ok(`/projects/${p.id}/sprints`, "POST", {
    name: "Imported sprint",
    start_date: "2026-10-08",
    end_date: "2026-10-22",
    status: "active",
    capacity: 20,
  });
  const parent = await f.ok(`/projects/${p.id}/tasks`, "POST", {
    title: "Parent",
    sprint_id: sprint.id,
  });
  await f.ok(`/projects/${p.id}/tasks`, "POST", {
    title: "Child",
    parent_id: parent.id,
    sprint_id: sprint.id,
  });
  await f.ok(`/projects/${p.id}/pages`, "POST", {
    title: "Notes",
    body: "Keep this content",
  });
  const exported = await f.ok(`/projects/${p.id}/export`);
  assert.equal(exported.schema, "taskorbit-project");
  assert.equal(exported.users, undefined);
  assert.equal(exported.sessions, undefined);
  const existing = await f.ok(`/projects/${f.project.id}/tasks`, "POST", {
    title: "Keep existing",
  });
  const imported = await f.ok(`/projects/${f.project.id}/import`, "POST", {
    format: "json",
    content: JSON.stringify(exported),
  });
  assert.equal(imported.tasks, 6);
  assert.equal(imported.pages, 1);
  const rows = await f.ok(`/projects/${f.project.id}/tasks`);
  assert.equal(rows.length, 7);
  assert.ok(rows.some((r) => r.id === existing.id));
  const importedParent = rows.find((r) => r.title === "Parent");
  assert.notEqual(importedParent.id, parent.id);
  assert.equal(
    rows.find((r) => r.title === "Child").parent_id,
    importedParent.id,
  );
  assert.equal(
    (await f.ok(`/projects/${f.project.id}/sprints`))[0].status,
    "planned",
  );
  const invalid = structuredClone(exported);
  invalid.tasks[1].title = "";
  assert.equal(
    (
      await f.req(`/projects/${f.project.id}/import`, "POST", {
        format: "json",
        content: JSON.stringify(invalid),
      })
    ).status,
    400,
  );
  assert.equal((await f.ok(`/projects/${f.project.id}/tasks`)).length, 7);
  assert.equal((await f.ok(`/projects/${f.project.id}/sprints`)).length, 1);
  invalid.tasks[0].parent_id = invalid.tasks[0].id;
  assert.equal(
    (
      await f.req(`/projects/${f.project.id}/import`, "POST", {
        format: "json",
        content: JSON.stringify(invalid),
      })
    ).status,
    400,
  );
  await f.user("member", "member");
  assert.equal(
    (
      await f.req(
        `/projects/${f.project.id}/import`,
        "POST",
        { format: "json", content: JSON.stringify(exported) },
        "member",
      )
    ).status,
    403,
  );
});

test("CSV migration parses quoted multilingual rows and rejects malformed or invalid data atomically", async (t) => {
  const f = await fixture(t);
  const csv =
    '\uFEFFSummary,description,status,priority,due_date,estimate,labels\r\n"مرور, هفتگی","Line one\nLine ""two""",In Progress,High,2026-10-15,3,team;ops\r\n';
  assert.equal(parseCsv(csv)[1][1], 'Line one\nLine "two"');
  const result = await f.ok(`/projects/${f.project.id}/import`, "POST", {
    format: "csv",
    content: csv,
  });
  assert.equal(result.tasks, 1);
  const rows = await f.ok(`/projects/${f.project.id}/tasks`);
  assert.equal(rows[0].status, "doing");
  assert.equal(rows[0].estimate, 3);
  assert.deepEqual(rows[0].labels, ["team", "ops"]);
  for (const content of [
    'title\n"unterminated',
    "wrong\nvalue",
    "title,status\nvalid,todo\ninvalid,unknown",
    "title,due_date\nInvalid,2026-02-30",
  ]) {
    assert.equal(
      (
        await f.req(`/projects/${f.project.id}/import`, "POST", {
          format: "csv",
          content,
        })
      ).status,
      400,
    );
    assert.equal((await f.ok(`/projects/${f.project.id}/tasks`)).length, 1);
  }
});

test("capacity and daily remaining-work snapshots include unassigned effort and stay project-scoped", async (t) => {
  const f = await fixture(t);
  await f.user("outsider");
  const sprint = await f.ok(`/projects/${f.project.id}/sprints`, "POST", {
    name: "Capacity sprint",
    start_date: "2026-10-08",
    end_date: "2026-10-22",
    capacity: 5,
  });
  const a = await f.ok(`/projects/${f.project.id}/tasks`, "POST", {
    title: "Delivery",
    sprint_id: sprint.id,
    estimate: 3,
    assignee_id: f.owner.id,
  });
  await f.ok(`/projects/${f.project.id}/tasks`, "POST", {
    title: "Unassigned",
    sprint_id: sprint.id,
    estimate: 4,
  });
  await f.ok(`/tasks/${a.id}`, "PUT", { ...a, status: "done" });
  const report = await f.ok(`/sprints/${sprint.id}/report`);
  assert.equal(report.sprint.capacity, 5);
  assert.equal(report.total_points, 7);
  assert.equal(report.completed_points, 3);
  assert.equal(report.remaining_points, 4);
  assert.equal(report.workload.find((r) => r.assignee_id === null).points, 4);
  assert.equal(report.history.length, 1);
  assert.equal(report.history[0].remaining_points, 4);
  assert.equal(
    (await f.req(`/sprints/${sprint.id}/report`, "GET", undefined, "outsider"))
      .status,
    403,
  );
});

test("email recovery is generic, token hashes expire, successful reset revokes sessions and API tokens", async (t) => {
  const mail = [];
  const f = await fixture(t, async (message) => {
    mail.push(message);
  });
  assert.equal((await f.ok("/auth-options")).password_reset, true);
  await f.ok("/me/tokens", "POST", { name: "Test credential", days: 30 });
  const missing = await f.ok(
    "/password/forgot",
    "POST",
    { email: "missing@example.test" },
    "anonymous",
  );
  const existing = await f.ok(
    "/password/forgot",
    "POST",
    { email: "owner@example.test", locale: "fa" },
    "anonymous",
  );
  assert.deepEqual(existing, missing);
  assert.equal(mail.length, 1);
  const token = new URL(mail[0].url).searchParams.get("reset");
  assert.equal(new URL(mail[0].url).origin, "https://tasks.example.test");
  assert.ok(
    !f.db
      .prepare("SELECT * FROM password_resets")
      .all()
      .some((r) => JSON.stringify(r).includes(token)),
  );
  f.db.prepare("UPDATE password_resets SET expires=0").run();
  assert.equal(
    (
      await f.req(
        "/password/reset",
        "POST",
        { token, password: "new-test-password-123" },
        "anonymous",
      )
    ).status,
    400,
  );
  await f.ok(
    "/password/forgot",
    "POST",
    { email: "owner@example.test" },
    "anonymous",
  );
  const valid = new URL(mail[1].url).searchParams.get("reset");
  await f.ok(
    "/password/reset",
    "POST",
    { token: valid, password: "new-test-password-123" },
    "anonymous",
  );
  assert.equal((await f.req("/me")).status, 401);
  assert.equal(
    f.db.prepare("SELECT COUNT(*) AS count FROM api_tokens").get().count,
    0,
  );
  assert.equal(
    (
      await f.req(
        "/password/reset",
        "POST",
        { token: valid, password: "another-test-password" },
        "anonymous",
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await f.req(
        "/login",
        "POST",
        { email: "owner@example.test", password: "test-password-123" },
        "anonymous",
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await f.req(
        "/login",
        "POST",
        { email: "owner@example.test", password: "new-test-password-123" },
        "anonymous",
      )
    ).status,
    200,
  );
});

test("unconfigured recovery offers administrator assistance and never exposes a reset token", async (t) => {
  const f = await fixture(t);
  assert.equal((await f.ok("/auth-options")).password_reset, false);
  const result = await f.req(
    "/password/forgot",
    "POST",
    { email: "owner@example.test" },
    "anonymous",
  );
  assert.equal(result.status, 503);
  assert.equal(result.data.token, undefined);
});
