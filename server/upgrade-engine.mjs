import { IMAGE, newer, parseVersion } from "./updates.mjs";
import { randomUUID } from "node:crypto";
const enc = encodeURIComponent;
export function publicJob(job) {
  if (!job) return { state: "idle" };
  const {
    id,
    state,
    phase,
    version,
    started_at,
    finished_at,
    backup_ready,
    error,
    rolled_back,
  } = job;
  return {
    id,
    state,
    phase,
    version,
    started_at,
    finished_at,
    backup_ready,
    error,
    rolled_back,
  };
}
export class UpgradeEngine {
  constructor({
    docker,
    storage,
    checkRelease,
    health,
    instance = "default",
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    attempts = 60,
  }) {
    Object.assign(this, {
      docker,
      storage,
      checkRelease,
      health,
      instance,
      sleep,
      attempts,
    });
    this.job = storage.load();
    this.busy = false;
  }
  save() {
    this.storage.save(this.job);
  }
  phase(value) {
    this.job.phase = value;
    this.save();
  }
  async target() {
    const filters = enc(
      JSON.stringify({
        label: [
          `io.taskorbit.role=server`,
          `io.taskorbit.instance=${this.instance}`,
        ],
      }),
    );
    const matches = await this.docker(
      "GET",
      "/containers/json?all=1&filters=" + filters,
    );
    const candidates = matches.filter((c) => c.State === "running");
    if (candidates.length !== 1)
      throw new Error("Expected exactly one managed TaskOrbit server");
    const old = await this.docker(
      "GET",
      `/containers/${candidates[0].Id}/json`,
    );
    if (
      old.Config.Env?.find((v) => v.startsWith("DATABASE_PATH=")) !==
      "DATABASE_PATH=/data/taskorbit.sqlite"
    )
      throw new Error("Unsupported database location");
    if (
      !old.Mounts?.some(
        (m) =>
          m.Destination === "/data" &&
          m.Type === "volume" &&
          m.Name === this.storage.dataVolume,
      )
    )
      throw new Error("Database volume mismatch");
    return old;
  }
  async start({ version, from }) {
    parseVersion(version);
    parseVersion(from);
    if (
      this.busy ||
      this.job?.state === "running" ||
      this.job?.phase === "recovery_required"
    )
      throw new Error("An upgrade is running or requires recovery");
    this.busy = true;
    try {
      const release = await this.checkRelease();
      if (release.version !== version || !newer(version, from))
        throw new Error("Release is not an eligible upgrade");
      const current = await this.health();
      if (current.version !== from)
        throw new Error("Installed version changed");
      const old = await this.target();
      this.job = {
        id: randomUUID(),
        state: "running",
        phase: "downloading",
        version,
        from,
        started_at: new Date().toISOString(),
        old,
        name: old.Name.replace(/^\//, ""),
      };
      this.save();
      this.completion = this.run().finally(() => {
        this.busy = false;
      });
      return publicJob(this.job);
    } catch (e) {
      this.busy = false;
      throw e;
    }
  }
  async waitHealthy(version) {
    for (let i = 0; i < this.attempts; i++) {
      try {
        const result = await this.health();
        if (result.status === "ok" && result.version === version) return;
      } catch {}
      await this.sleep(2000);
    }
    throw new Error("New server health check failed");
  }
  networkConfig(old) {
    return Object.fromEntries(
      Object.entries(old.NetworkSettings.Networks).map(([name, network]) => [
        name,
        {
          Aliases: (network.Aliases || []).filter(
            (a) => a !== old.Id && a !== old.Id.slice(0, 12),
          ),
          ...(network.IPAMConfig ? { IPAMConfig: network.IPAMConfig } : {}),
        },
      ]),
    );
  }
  async detach(old) {
    for (const network of Object.values(old.NetworkSettings.Networks))
      await this.docker(
        "POST",
        `/networks/${enc(network.NetworkID)}/disconnect`,
        { Container: old.Id, Force: true },
      );
  }
  async attach(old) {
    for (const [name, endpoint] of Object.entries(this.networkConfig(old)))
      await this.docker("POST", `/networks/${enc(name)}/connect`, {
        Container: old.Id,
        EndpointConfig: endpoint,
      });
  }
  async run() {
    const job = this.job;
    let mutation = false;
    try {
      await this.docker(
        "POST",
        `/images/create?fromImage=${enc(IMAGE)}&tag=v${job.version}`,
      );
      const image = await this.docker(
        "GET",
        `/images/${enc(IMAGE + ":v" + job.version)}/json`,
      );
      if (!/^sha256:[a-f0-9]{64}$/.test(image.Id))
        throw new Error("Invalid downloaded image");
      job.image = image.Id;
      this.phase("backing_up");
      mutation = true;
      await this.docker("POST", `/containers/${job.old.Id}/stop?t=30`);
      await this.storage.backup(job);
      job.backup_ready = true;
      this.save();
      await this.docker(
        "POST",
        `/containers/${job.old.Id}/rename?name=${enc(job.name + "-rollback-" + job.id)}`,
      );
      await this.detach(job.old);
      this.phase("installing");
      const config = {
        ...job.old.Config,
        Hostname: "",
        Image: image.Id,
        Labels: {
          ...job.old.Config.Labels,
          "io.taskorbit.upgrade": job.id,
          "com.docker.compose.image": image.Id,
        },
        HostConfig: job.old.HostConfig,
        NetworkingConfig: { EndpointsConfig: this.networkConfig(job.old) },
      };
      delete config.Labels["io.taskorbit.upgrade-backup"];
      const created = await this.docker(
        "POST",
        `/containers/create?name=${enc(job.name)}`,
        config,
      );
      job.candidate = created.Id;
      this.save();
      await this.docker("POST", `/containers/${created.Id}/start`);
      this.phase("checking_health");
      await this.waitHealthy(job.version);
      await this.docker(
        "POST",
        `/images/${enc(image.Id)}/tag?repo=${enc(IMAGE)}&tag=stable`,
      );
      job.state = "complete";
      job.phase = "complete";
      job.finished_at = new Date().toISOString();
      this.save();
      // Cleanup is best-effort only after the new version is healthy and committed.
      try {
        await this.docker("DELETE", `/containers/${job.old.Id}`);
      } catch {}
    } catch {
      if (mutation) {
        try {
          await this.rollback();
          job.rolled_back = true;
          job.error = "Upgrade failed; previous version restored";
        } catch {
          job.error =
            "Automatic recovery needs operator attention; backup retained";
          job.phase = "recovery_required";
        }
      } else
        job.error = "Download or preflight failed; installed server unchanged";
      job.state = "failed";
      job.finished_at = new Date().toISOString();
      if (job.phase !== "recovery_required") job.phase = "failed";
      this.save();
    }
  }
  async rollback() {
    const job = this.job;
    this.phase("rolling_back");
    // Find a candidate even if the agent crashed before persisting its Docker ID.
    const filter = enc(
      JSON.stringify({ label: [`io.taskorbit.upgrade=${job.id}`] }),
    );
    const candidates = await this.docker(
      "GET",
      "/containers/json?all=1&filters=" + filter,
    );
    for (const candidate of candidates) {
      if (candidate.Id !== job.old.Id)
        await this.docker("DELETE", `/containers/${candidate.Id}?force=true`);
    }
    const old = await this.docker("GET", `/containers/${job.old.Id}/json`);
    if (old.State.Running)
      await this.docker("POST", `/containers/${job.old.Id}/stop?t=30`);
    if (job.backup_ready) await this.storage.restore(job);
    if (old.Name.replace(/^\//, "") !== job.name)
      await this.docker(
        "POST",
        `/containers/${job.old.Id}/rename?name=${enc(job.name)}`,
      );
    // Disconnection may have been interrupted; connect only missing endpoints.
    const latest = await this.docker("GET", `/containers/${job.old.Id}/json`);
    for (const [name, endpoint] of Object.entries(
      this.networkConfig(job.old),
    )) {
      if (!latest.NetworkSettings.Networks[name])
        await this.docker("POST", `/networks/${enc(name)}/connect`, {
          Container: job.old.Id,
          EndpointConfig: endpoint,
        });
    }
    await this.docker("POST", `/containers/${job.old.Id}/start`);
    await this.waitHealthy(job.from);
  }
  async recover() {
    if (this.job?.state !== "running") return;
    this.busy = true;
    try {
      await this.rollback();
      this.job.rolled_back = true;
      this.job.error = "Interrupted upgrade recovered to previous version";
      this.job.phase = "failed";
    } catch {
      this.job.error = "Recovery needs operator attention; backup retained";
      this.job.phase = "recovery_required";
    }
    this.job.state = "failed";
    this.job.finished_at = new Date().toISOString();
    this.save();
    this.busy = false;
  }
}
