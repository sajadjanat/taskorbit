import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createApp } from "../server/app.mjs";

test("authenticated live events cover mutations, isolation, reconnect and revocation", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "taskorbit-live-"));
  const { app, db } = createApp({
    database: path.join(dir, "db.sqlite"),
    serveStatic: false,
    secure: false,
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const streams = [];
  const call = async (url, method = "GET", body, cookie = "") => {
    const r = await fetch(base + url, {
      method,
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await r.json();
    assert.ok(r.ok, `${method} ${url}: ${r.status}`);
    return { data, cookie: r.headers.get("set-cookie")?.split(";")[0] };
  };
  async function stream(cookie) {
    const controller = new AbortController();
    streams.push(controller);
    const r = await fetch(base + "/events", {
      headers: { Cookie: cookie },
      signal: controller.signal,
    });
    assert.equal(
      r.status,
      200,
      "Real-time endpoint must accept authenticated clients",
    );
    assert.match(r.headers.get("content-type"), /text\/event-stream/);
    assert.equal(r.headers.get("x-accel-buffering"), "no");
    const reader = r.body.getReader();
    let buffered = "";
    return {
      controller,
      async next() {
        while (!buffered.includes("\n\n")) {
          const { value, done } = await reader.read();
          if (done) return null;
          buffered += new TextDecoder().decode(value);
        }
        const split = buffered.indexOf("\n\n"),
          block = buffered.slice(0, split);
        buffered = buffered.slice(split + 2);
        const event = block.match(/event: (.+)/)?.[1],
          payload = block.match(/data: (.+)/)?.[1];
        return { event, data: payload ? JSON.parse(payload) : {} };
      },
    };
  }
  const next = (s) =>
    Promise.race([
      s.next(),
      new Promise((_, reject) => {
        const t = setTimeout(() => reject(Error("Live event timed out")), 1800);
        t.unref();
      }),
    ]);
  try {
    assert.equal((await fetch(base + "/events")).status, 401);
    const owner = await call("/setup", "POST", {
      name: "Owner",
      email: "owner@example.test",
      password: "test-password-123",
      workspace: "Live team",
    });
    const cookie = owner.cookie;
    const ws = (await call("/workspaces", "GET", undefined, cookie)).data[0];
    const member = (
      await call(
        "/admin/users",
        "POST",
        {
          name: "Member",
          email: "member@example.test",
          password: "test-password-123",
        },
        cookie,
      )
    ).data;
    const outsider = (
      await call(
        "/admin/users",
        "POST",
        {
          name: "Outsider",
          email: "outsider@example.test",
          password: "test-password-123",
        },
        cookie,
      )
    ).data;
    await call(
      `/workspaces/${ws.id}/members`,
      "POST",
      { email: member.email, role: "member" },
      cookie,
    );
    const memberCookie = (
      await call("/login", "POST", {
        email: member.email,
        password: "test-password-123",
      })
    ).cookie;
    const otherCookie = (
      await call("/login", "POST", {
        email: outsider.email,
        password: "test-password-123",
      })
    ).cookie;
    const a = await stream(cookie),
      b = await stream(memberCookie),
      other = await stream(otherCookie);
    for (const s of [a, b, other]) assert.equal((await next(s)).event, "ready");
    const p = (
      await call(
        `/workspaces/${ws.id}/projects`,
        "POST",
        { name: "Shared", identifier: "SH" },
        cookie,
      )
    ).data;
    for (const s of [a, b]) {
      const e = await next(s);
      assert.equal(e.event, "changed");
      assert.equal(e.data.workspace_id, ws.id);
    }
    const task = (
      await call(`/projects/${p.id}/tasks`, "POST", { title: "Before" }, cookie)
    ).data;
    for (const s of [a, b]) assert.equal((await next(s)).data.project_id, p.id);
    await call(`/tasks/${task.id}`, "PUT", { ...task, title: "After" }, cookie);
    for (const s of [a, b]) {
      const e = await next(s);
      assert.equal(e.data.project_id, p.id);
      assert.ok(
        !JSON.stringify(e).includes("After"),
        "Notifications must not contain work data",
      );
    }
    for (const [resource, body] of [
      [
        "sprints",
        {
          name: "Live sprint",
          start_date: "2026-10-01",
          end_date: "2026-10-14",
        },
      ],
      ["modules", { name: "Live module" }],
      ["pages", { title: "Live page" }],
      ["views", { name: "Live view", filters: {} }],
    ]) {
      const item = (
        await call(`/projects/${p.id}/${resource}`, "POST", body, cookie)
      ).data;
      for (const s of [a, b])
        assert.equal((await next(s)).data.project_id, p.id);
      await call(
        `/${resource}/${item.id}`,
        "PUT",
        { ...item, ...body },
        cookie,
      );
      for (const s of [a, b])
        assert.equal((await next(s)).data.project_id, p.id);
      if (resource !== "sprints") {
        await call(`/${resource}/${item.id}`, "DELETE", undefined, cookie);
        for (const s of [a, b])
          assert.equal((await next(s)).data.project_id, p.id);
      }
    }
    const target = (
      await call(
        `/projects/${p.id}/tasks`,
        "POST",
        { title: "Linked task" },
        cookie,
      )
    ).data;
    for (const s of [a, b]) assert.equal((await next(s)).data.project_id, p.id);
    const link = (
      await call(
        `/tasks/${task.id}/links`,
        "POST",
        { target_id: target.id, type: "related" },
        cookie,
      )
    ).data;
    for (const s of [a, b]) assert.equal((await next(s)).data.project_id, p.id);
    await call(`/links/${link.id}`, "DELETE", undefined, cookie);
    for (const s of [a, b]) assert.equal((await next(s)).data.project_id, p.id);
    await call(
      `/tasks/${task.id}/comments`,
      "POST",
      { body: "Live comment" },
      cookie,
    );
    for (const s of [a, b]) assert.equal((await next(s)).data.project_id, p.id);
    const attached = await fetch(`${base}/tasks/${task.id}/attachments`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/octet-stream",
        "X-File-Name": "brief.txt",
      },
      body: "Brief",
    });
    assert.equal(attached.status, 201);
    const file = await attached.json();
    for (const s of [a, b]) assert.equal((await next(s)).data.project_id, p.id);
    await call(`/attachments/${file.id}`, "DELETE", undefined, cookie);
    for (const s of [a, b]) assert.equal((await next(s)).data.project_id, p.id);
    await call(`/tasks/${task.id}`, "DELETE", undefined, cookie);
    for (const s of [a, b])
      assert.equal(
        (await next(s)).data.project_id,
        p.id,
        "Delete retains the pre-mutation scope",
      );
    const again = await stream(memberCookie);
    assert.equal(
      (await next(again)).event,
      "ready",
      "Reconnect must request a fresh snapshot",
    );
    await call(
      `/workspaces/${ws.id}/members/${member.id}`,
      "DELETE",
      undefined,
      cookie,
    );
    assert.equal((await next(b)).data.kind, "access");
    assert.equal((await next(again)).data.kind, "access");
    assert.equal((await next(a)).data.workspace_id, ws.id);
    await call(
      `/projects/${p.id}/tasks`,
      "POST",
      { title: "Private after removal" },
      cookie,
    );
    assert.equal((await next(a)).data.project_id, p.id);
    // An unrelated user and a removed member receive no project notifications.
    let otherReceived = false,
      memberReceived = false;
    const pendingOther = other.next().then(() => {
        otherReceived = true;
      }),
      pendingMember = b.next().then(() => {
        memberReceived = true;
      });
    await new Promise((r) => setTimeout(r, 120));
    assert.equal(otherReceived, false);
    assert.equal(memberReceived, false);
    await call(`/admin/users/${member.id}`, "PATCH", { active: false }, cookie);
    assert.equal((await next(a)).data.kind, "access");
    assert.equal(
      await next(again),
      null,
      "Deactivation immediately closes an existing stream",
    );
    b.controller.abort();
    other.controller.abort();
    await Promise.allSettled([pendingOther, pendingMember]);
    await call("/logout", "POST", undefined, cookie);
    assert.equal(
      await next(a),
      null,
      "Logout immediately closes the session stream",
    );
  } finally {
    for (const c of streams) c.abort();
    await new Promise((r) => server.close(r));
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
