// Runs only inside an isolated Docker fixture, with disposable named volumes.
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { dockerClient } from "../server/docker.mjs";
import { UpgradeEngine } from "../server/upgrade-engine.mjs";
import { upgradeStorage } from "../server/upgrade-storage.mjs";
const instance = process.env.TEST_INSTANCE;
const dockerRequest = dockerClient();
assert.match(instance, /^taskorbit-test-[a-f0-9-]+$/);
const health = async () => {
  const r = await fetch("http://taskorbit:4310/api/health", {
    signal: AbortSignal.timeout(3000),
  });
  assert.ok(r.ok);
  return r.json();
};
for (let i = 0; i < 30; i++) {
  try {
    if ((await health()).status === "ok") break;
  } catch {}
  await new Promise((r) => setTimeout(r, 500));
}
assert.equal((await health()).version, "1.0.0");
const setup = await fetch("http://taskorbit:4310/api/setup", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "Fixture admin",
    email: "fixture@example.test",
    password: "fixture-password-123",
    workspace: "Fixture workspace",
  }),
});
assert.equal(setup.status, 201);
const cookie = setup.headers.get("set-cookie").split(";")[0];
const beforeDb = new DatabaseSync("/data/taskorbit.sqlite");
const user = beforeDb.prepare("SELECT id,password FROM users").get();
beforeDb.close();
const storage = upgradeStorage({ dataVolume: process.env.TEST_DATA_VOLUME });
const failure = process.env.TEST_FAILURE === "1";
let mutated = false;
const engine = new UpgradeEngine({
  instance,
  storage,
  attempts: 4,
  sleep: (ms) => new Promise((r) => setTimeout(r, Math.min(ms, 500))),
  checkRelease: async () => ({ version: "2.0.0" }),
  // The fixture prebuilds a local candidate, avoiding any production pull or tag mutation.
  docker: (method, url, body) =>
    url.startsWith("/images/create?")
      ? Promise.resolve({})
      : dockerRequest(method, url, body),
  health: async () => {
    const result = await health();
    if (failure && result.version === "2.0.0") {
      if (!mutated) {
        const db = new DatabaseSync("/data/taskorbit.sqlite");
        db.exec("CREATE TABLE failed_migration(value TEXT)");
        db.close();
        mutated = true;
      }
      return { ...result, status: "unhealthy" };
    }
    return result;
  },
});
await engine.start({ version: "2.0.0", from: "1.0.0" });
await engine.completion;
assert.equal(engine.job.state, failure ? "failed" : "complete");
assert.equal((await health()).version, failure ? "1.0.0" : "2.0.0");
assert.equal(engine.job.backup_ready, true);
if (failure) {
  assert.equal(mutated, true);
  assert.equal(engine.job.rolled_back, true);
}
const afterDb = new DatabaseSync("/data/taskorbit.sqlite");
assert.deepEqual(afterDb.prepare("SELECT id,password FROM users").get(), user);
assert.equal(
  afterDb
    .prepare("SELECT name FROM sqlite_master WHERE name='failed_migration'")
    .get(),
  undefined,
);
afterDb.close();
const me = await fetch("http://taskorbit:4310/api/me", {
  headers: { Cookie: cookie },
});
assert.equal(me.status, 200);
// Start the real authenticated agent against the completed fixture journal.
const agent = await dockerRequest(
  "POST",
  "/containers/create?name=" + instance + "-agent",
  {
    Image: "taskorbit:test",
    User: "0:0",
    Cmd: ["node", "server/update-agent.mjs"],
    Env: ["TASKORBIT_INSTANCE=" + instance],
    Labels: { "io.taskorbit.instance": instance },
    HostConfig: {
      Binds: [
        process.env.TEST_DATA_VOLUME + ":/data",
        process.env.TEST_UPDATE_VOLUME + ":/updates",
        "/var/run/docker.sock:/var/run/docker.sock",
      ],
    },
    NetworkingConfig: {
      EndpointsConfig: { [instance]: { Aliases: ["updater"] } },
    },
  },
);
await dockerRequest("POST", `/containers/${agent.Id}/start`);
let agentReady = false;
for (let i = 0; i < 30; i++) {
  try {
    const r = await fetch("http://updater:4311/status");
    if (r.status === 401) {
      agentReady = true;
      break;
    }
  } catch {}
  await new Promise((r) => setTimeout(r, 500));
}
assert.equal(agentReady, true);
const status = await fetch("http://updater:4311/status", {
  headers: { Authorization: "Bearer " + storage.token },
});
assert.equal(status.status, 200);
const text = await status.text();
assert.equal(JSON.parse(text).state, engine.job.state);
assert.equal(text.includes(storage.token), false);
assert.equal(text.includes("HostConfig"), false);
console.log(
  failure
    ? "Docker rollback restored original version, user, session and database schema"
    : "Docker upgrade preserved user, session and named database volume",
);
