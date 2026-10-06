import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createApp } from "../server/app.mjs";
test("validated sessions have independent API quotas; forged cookies retain the anonymous quota", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "taskorbit-quota-"));
  const { app, db } = createApp({
    database: path.join(dir, "db.sqlite"),
    secure: false,
    serveStatic: false,
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  try {
    const credentials = {
      name: "Quota owner",
      workspace: "Quota team",
      email: "quota@example.test",
      password: "quota-test-password",
    };
    const setup = await fetch(base + "/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    });
    const login = await fetch(base + "/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    });
    const a = setup.headers.get("set-cookie").split(";")[0],
      b = login.headers.get("set-cookie").split(";")[0];
    const partition = (r) =>
      r.headers.get("ratelimit-policy")?.match(/pk=:([^:]+):/)?.[1];
    const one = await fetch(base + "/me", { headers: { Cookie: a } }),
      two = await fetch(base + "/me", { headers: { Cookie: b } });
    assert.equal(one.status, 200);
    assert.equal(two.status, 200);
    assert.notEqual(
      partition(one),
      partition(two),
      "Independent signed-in clients must not share the same IP quota",
    );
    const anonymous = await fetch(base + "/health"),
      forged = await fetch(base + "/me", {
        headers: { Cookie: "taskorbit_session=forged-cookie" },
      });
    assert.equal(forged.status, 401);
    assert.equal(
      partition(anonymous),
      partition(forged),
      "Unverified cookie values cannot select a new quota",
    );
    let limited;
    for (let n = 0; n < 305; n++) {
      const r = await fetch(base + "/health");
      if (r.status === 429) {
        limited = r;
        break;
      }
      await r.arrayBuffer();
    }
    assert.ok(limited);
    assert.equal(
      typeof (await limited.json()).error,
      "string",
      "Rate-limit errors must use the API JSON format",
    );
    assert.equal(
      (await fetch(base + "/me", { headers: { Cookie: a } })).status,
      200,
      "An anonymous burst cannot block a valid session",
    );
  } finally {
    await new Promise((r) => server.close(r));
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
