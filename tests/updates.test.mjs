import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import {
  validateRelease,
  releaseChecker,
  newer,
  parseVersion,
  VERSION,
} from "../server/updates.mjs";
import { UpgradeEngine, publicJob } from "../server/upgrade-engine.mjs";
import { upgradeStorage } from "../server/upgrade-storage.mjs";
import { createApp } from "../server/app.mjs";
const release = {
  tag_name: "v1.2.3",
  html_url: "https://github.com/sajadjanat/taskorbit/releases/tag/v1.2.3",
  draft: false,
  prerelease: false,
};
test("update channel rejects other repositories, previews and unsafe versions", () => {
  assert.equal(validateRelease(release).version, "1.2.3");
  for (const tag_name of [
    "v1.2.3;rm",
    "v1.2.3-beta",
    "v1.2.3/path",
    "v999999999999999999.0.0",
  ])
    assert.throws(() => validateRelease({ ...release, tag_name }));
  for (const changes of [
    { draft: true },
    { prerelease: true },
    { html_url: "https://example.com/release" },
  ])
    assert.throws(() => validateRelease({ ...release, ...changes }));
  assert.ok(newer("1.10.0", "1.9.9"));
  assert.equal(newer("1.2.3", "1.2.3"), false);
  assert.throws(() => parseVersion("../latest"));
});
test("release check coalesces parallel calls and caches only valid responses", async () => {
  let calls = 0;
  const check = releaseChecker(async () => {
    calls++;
    await new Promise((r) => setTimeout(r, 5));
    return { ok: true, json: async () => release };
  });
  await Promise.all([check(), check(), check()]);
  await check();
  assert.equal(calls, 1);
  let fail = true;
  const retry = releaseChecker(async () => ({
    ok: !fail,
    json: async () => release,
  }));
  await assert.rejects(retry());
  fail = false;
  assert.equal((await retry()).version, "1.2.3");
});
function fixture({
  fail = false,
  downloadFail = false,
  backupFail = false,
} = {}) {
  const old = {
    Id: "old",
    Name: "/taskorbit-test",
    Config: {
      Env: ["DATABASE_PATH=/data/taskorbit.sqlite", "PRIVATE=value"],
      Labels: {},
    },
    HostConfig: {},
    Mounts: [{ Destination: "/data", Type: "volume", Name: "data" }],
    NetworkSettings: {
      Networks: { test: { NetworkID: "net", Aliases: ["taskorbit", "old"] } },
    },
    State: { Running: true },
  };
  const calls = [];
  let running = "old",
    connected = true,
    removed = false,
    restored = 0,
    backups = 0,
    saved;
  const docker = async (method, url, body) => {
    calls.push({ method, url, body });
    if (url.startsWith("/images/create")) {
      if (downloadFail) throw Error("network");
      return {};
    }
    if (url.startsWith("/images/") && url.endsWith("/json"))
      return { Id: "sha256:" + "a".repeat(64) };
    if (url.startsWith("/containers/json"))
      return decodeURIComponent(url).includes("io.taskorbit.upgrade=")
        ? removed
          ? []
          : [{ Id: "candidate" }]
        : [{ Id: "old", State: "running" }];
    if (url === "/containers/old/json")
      return {
        ...old,
        State: { Running: running === "old" },
        NetworkSettings: {
          Networks: connected ? old.NetworkSettings.Networks : {},
        },
      };
    if (url.startsWith("/containers/create")) return { Id: "candidate" };
    if (url.includes("/stop")) running = "";
    if (url.includes("/disconnect")) connected = false;
    if (url.includes("/connect")) connected = true;
    if (url.endsWith("/start"))
      running = url.includes("/old/") ? "old" : "candidate";
    if (method === "DELETE" && url.includes("candidate")) {
      removed = true;
      running = "";
    }
    return {};
  };
  const storage = {
    dataVolume: "data",
    load: () => undefined,
    save: (j) => {
      saved = structuredClone(j);
    },
    backup: async () => {
      backups++;
      if (backupFail) throw Error("disk");
    },
    restore: async () => {
      restored++;
    },
  };
  const engine = new UpgradeEngine({
    docker,
    storage,
    checkRelease: async () => ({ version: "1.2.3" }),
    health: async () => ({
      status: "ok",
      version: running === "old" ? "1.0.0" : fail ? "0.0.0" : "1.2.3",
    }),
    attempts: 2,
    sleep: async () => {},
  });
  return {
    engine,
    calls,
    stats: () => ({ running, restored, backups, saved }),
  };
}
test("successful server replacement backs up before creating and returns no private config", async () => {
  const f = fixture();
  const job = await f.engine.start({ version: "1.2.3", from: "1.0.0" });
  assert.equal(JSON.stringify(job).includes("PRIVATE"), false);
  await f.engine.completion;
  assert.equal(f.engine.job.state, "complete");
  assert.equal(f.stats().backups, 1);
  assert.equal(f.stats().restored, 0);
  assert.equal(f.stats().running, "candidate");
  assert.ok(
    f.calls.findIndex((c) => c.url.includes("/stop")) <
      f.calls.findIndex((c) => c.url.startsWith("/containers/create")),
  );
  assert.equal(publicJob(f.engine.job).backup_ready, true);
});
test("failed health check restores database and previous server", async () => {
  const f = fixture({ fail: true });
  await f.engine.start({ version: "1.2.3", from: "1.0.0" });
  await f.engine.completion;
  assert.equal(f.engine.job.state, "failed");
  assert.equal(f.engine.job.rolled_back, true);
  assert.equal(f.stats().restored, 1);
  assert.equal(f.stats().running, "old");
});
test("download failure does not stop server; backup failure resumes old server without restore", async () => {
  for (const option of [{ downloadFail: true }, { backupFail: true }]) {
    const f = fixture(option);
    await f.engine.start({ version: "1.2.3", from: "1.0.0" });
    await f.engine.completion;
    assert.equal(f.engine.job.state, "failed");
    assert.equal(f.stats().running, "old");
    assert.equal(f.stats().restored, 0);
    if (option.downloadFail)
      assert.equal(
        f.calls.some((c) => c.url.includes("/stop")),
        false,
      );
  }
});
test("concurrent upgrades, downgrade and unresolved recovery are rejected", async () => {
  const f = fixture();
  await assert.rejects(f.engine.start({ version: "0.9.0", from: "1.0.0" }));
  const first = f.engine.start({ version: "1.2.3", from: "1.0.0" });
  await assert.rejects(f.engine.start({ version: "1.2.3", from: "1.0.0" }));
  await first;
  await f.engine.completion;
  f.engine.job.phase = "recovery_required";
  await assert.rejects(f.engine.start({ version: "1.2.3", from: "1.0.0" }));
});
test("interrupted upgrade journal triggers recovery", async () => {
  const f = fixture({ fail: true });
  await f.engine.start({ version: "1.2.3", from: "1.0.0" });
  await f.engine.completion;
  f.engine.job.state = "running";
  await f.engine.recover();
  assert.equal(f.engine.job.state, "failed");
  assert.equal(f.engine.job.rolled_back, true);
  assert.equal(
    f.engine.job.error,
    "Interrupted upgrade recovered to previous version",
  );
});
test("cold SQLite backup restores data; altered backup is rejected before deleting current data", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "taskorbit-backup-"));
  try {
    const data = path.join(dir, "data");
    fs.mkdirSync(data);
    const root = path.join(dir, "updates"),
      file = path.join(data, "taskorbit.sqlite");
    let db = new DatabaseSync(file);
    db.exec("CREATE TABLE items(value TEXT);INSERT INTO items VALUES('kept')");
    db.close();
    const storage = upgradeStorage({
      root,
      data,
      dataVolume: "test",
      gid: process.getgid?.() ?? 1000,
    });
    const job = { id: randomUUID() };
    await storage.backup(job);
    db = new DatabaseSync(file);
    db.exec("DELETE FROM items");
    db.close();
    await storage.restore(job);
    db = new DatabaseSync(file);
    assert.equal(db.prepare("SELECT value FROM items").get().value, "kept");
    db.close();
    fs.appendFileSync(
      path.join(root, "backups", job.id, "taskorbit.sqlite"),
      "corrupt",
    );
    await assert.rejects(storage.restore(job));
    db = new DatabaseSync(file);
    assert.equal(db.prepare("SELECT value FROM items").get().value, "kept");
    db.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("server updates require instance admin, reject stale versions and pause writes during upgrade", async () => {
  const dir = fs.mkdtempSync(
      path.join(os.tmpdir(), "taskorbit-admin-updates-"),
    ),
    state = path.join(dir, "state.json");
  const next = "9.0.0";
  let starts = 0;
  const { app, db } = createApp({
    database: path.join(dir, "test.sqlite"),
    serveStatic: false,
    secure: false,
    origin: "http://tasks.test",
    maintenancePath: state,
    checkRelease: async () => ({
      version: next,
      url: "https://github.com/sajadjanat/taskorbit/releases/tag/v9.0.0",
    }),
    upgradeAgent: {
      enabled: true,
      request: async (route) => {
        if (route === "/upgrade") starts++;
        return { state: route === "/upgrade" ? "running" : "idle" };
      },
    },
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  let cookie = "";
  const req = (url, method = "GET", body, origin) =>
    fetch(base + url, {
      method,
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
        ...(origin ? { Origin: origin } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  try {
    assert.equal((await req("/admin/updates")).status, 401);
    const setup = await req("/setup", "POST", {
      name: "Test admin",
      email: "admin@example.test",
      password: "test-password-123",
      workspace: "Test workspace",
    });
    assert.equal(setup.status, 201);
    cookie = setup.headers.get("set-cookie").split(";")[0];
    const checked = await (await req("/admin/updates")).json();
    assert.equal(checked.current, VERSION);
    assert.equal(checked.available, true);
    assert.equal(
      (
        await req(
          "/admin/updates",
          "POST",
          { version: next },
          "https://evil.test",
        )
      ).status,
      403,
    );
    assert.equal(
      (await req("/admin/updates", "POST", { version: "8.0.0" })).status,
      409,
    );
    assert.equal(
      (await req("/admin/updates", "POST", { version: next })).status,
      202,
    );
    assert.equal(starts, 1);
    fs.writeFileSync(state, JSON.stringify({ state: "running" }));
    assert.equal((await req("/logout", "POST", {})).status, 503);
    assert.equal((await req("/admin/updates/status")).status, 200);
    fs.writeFileSync(
      state,
      JSON.stringify({ state: "failed", phase: "recovery_required" }),
    );
    assert.equal((await req("/logout", "POST", {})).status, 503);
    fs.writeFileSync(state, JSON.stringify({ state: "complete" }));
    assert.equal((await req("/logout", "POST", {})).status, 200);
  } finally {
    await new Promise((r) => server.close(r));
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
