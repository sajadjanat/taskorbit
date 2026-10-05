import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
const run = (args, input) =>
  execFileSync("docker", args, {
    input,
    stdio: input ? ["pipe", "inherit", "inherit"] : "inherit",
  });
const image = "ghcr.io/sajadjanat/taskorbit";
for (const version of ["1.0.0", "2.0.0"]) {
  run(
    ["build", "-t", image + ":v" + version, "-f", "-", "."],
    `FROM taskorbit:test\nUSER root\nRUN node -e "const fs=require('fs');const p=require('./package.json');p.version='${version}';fs.writeFileSync('package.json',JSON.stringify(p))"\nUSER node\n`,
  );
}
for (const failure of [false, true]) {
  const id = "taskorbit-test-" + randomUUID(),
    data = id + "-data",
    updates = id + "-updates",
    server = id + "-server",
    tester = id + "-tester";
  try {
    run(["network", "create", id]);
    run(["volume", "create", data]);
    run(["volume", "create", updates]);
    run([
      "run",
      "-d",
      "--name",
      server,
      "--network",
      id,
      "--network-alias",
      "taskorbit",
      "--label",
      "io.taskorbit.role=server",
      "--label",
      "io.taskorbit.instance=" + id,
      "-e",
      "UPDATE_STATE_PATH=/updates/state.json",
      "-v",
      data + ":/data",
      "-v",
      updates + ":/updates:ro",
      image + ":v1.0.0",
    ]);
    run([
      "run",
      "--name",
      tester,
      "--network",
      id,
      "--user",
      "0:0",
      "-e",
      "TEST_INSTANCE=" + id,
      "-e",
      "TEST_DATA_VOLUME=" + data,
      "-e",
      "TEST_FAILURE=" + (failure ? "1" : "0"),
      "-v",
      "/var/run/docker.sock:/var/run/docker.sock",
      "-v",
      data + ":/data",
      "-v",
      updates + ":/updates",
      "-v",
      path.resolve("tests") + ":/app/tests:ro",
      "taskorbit:test",
      "node",
      "tests/upgrade.docker.mjs",
    ]);
  } finally {
    // All targets are locally generated fixture names, never production containers/volumes.
    for (const name of [server, tester]) {
      try {
        run(["rm", "-f", name]);
      } catch {}
    }
    const leftovers = execFileSync(
      "docker",
      ["ps", "-aq", "--filter", "label=io.taskorbit.instance=" + id],
      { encoding: "utf8" },
    )
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    for (const container of leftovers) run(["rm", "-f", container]);
    for (const volume of [data, updates]) {
      try {
        run(["volume", "rm", volume]);
      } catch {}
    }
    try {
      run(["network", "rm", id]);
    } catch {}
  }
}
