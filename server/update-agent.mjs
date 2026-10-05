import express from "express";
import { timingSafeEqual } from "node:crypto";
import { dockerClient } from "./docker.mjs";
import { UpgradeEngine, publicJob } from "./upgrade-engine.mjs";
import { upgradeStorage } from "./upgrade-storage.mjs";
import { releaseChecker } from "./updates.mjs";
const docker = dockerClient();
const hostname = process.env.HOSTNAME;
const self = await docker(
  "GET",
  `/containers/${encodeURIComponent(hostname)}/json`,
);
const volume = self.Mounts.find(
  (m) => m.Destination === "/data" && m.Type === "volume",
)?.Name;
if (!volume)
  throw new Error("Upgrade service requires the TaskOrbit named data volume");
const storage = upgradeStorage({ dataVolume: volume });
const engine = new UpgradeEngine({
  docker,
  storage,
  checkRelease: releaseChecker(),
  instance: process.env.TASKORBIT_INSTANCE || "default",
  health: async () => {
    const r = await fetch("http://taskorbit:4310/api/health", {
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) throw new Error("Server unavailable");
    return r.json();
  },
});
await engine.recover();
const app = express();
app.disable("x-powered-by");
app.use((req, res, next) => {
  const provided = Buffer.from(
      (req.headers.authorization || "").replace(/^Bearer /, ""),
    ),
    expected = Buffer.from(storage.token);
  if (
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  )
    return res.status(401).json({ error: "Upgrade authentication required" });
  res.set("Cache-Control", "no-store");
  next();
});
app.use(express.json({ limit: "4kb" }));
app.get("/status", (req, res) => res.json(publicJob(engine.job)));
app.post("/upgrade", async (req, res) => {
  try {
    res
      .status(202)
      .json(
        await engine.start({ version: req.body.version, from: req.body.from }),
      );
  } catch {
    res
      .status(409)
      .json({
        error: "Upgrade preflight failed or another upgrade is running",
      });
  }
});
app.listen(4311, "0.0.0.0", () =>
  console.log("TaskOrbit upgrade service ready"),
);
