import fs from "node:fs";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { publicJob } from "./upgrade-engine.mjs";
const names = [
  "taskorbit.sqlite",
  "taskorbit.sqlite-wal",
  "taskorbit.sqlite-shm",
];
async function digest(file) {
  const hash = createHash("sha256");
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}
export function upgradeStorage({
  root = "/updates",
  data = "/data",
  dataVolume,
  gid = 1000,
  ownerUid = process.getuid?.() ?? 0,
} = {}) {
  fs.mkdirSync(root, { recursive: true, mode: 0o750 });
  if (process.platform !== "win32") {
    fs.chownSync(root, ownerUid, gid);
    fs.chmodSync(root, 0o750);
  }
  const own = (file) => {
    if (process.platform !== "win32") fs.chownSync(file, ownerUid, gid);
  };
  const tokenFile = path.join(root, "control-token");
  if (!fs.existsSync(tokenFile)) {
    fs.writeFileSync(tokenFile, randomBytes(32).toString("hex"), {
      mode: 0o640,
    });
    own(tokenFile);
  }
  const journal = path.join(root, "journal.json");
  const atomic = (file, value, publicFile = false) => {
    fs.writeFileSync(file + ".tmp", JSON.stringify(value), {
      mode: publicFile ? 0o640 : 0o600,
    });
    if (publicFile) own(file + ".tmp");
    fs.renameSync(file + ".tmp", file);
  };
  const folder = (job) => {
    if (!/^[a-f0-9-]{36}$/.test(job.id))
      throw new Error("Invalid backup identifier");
    return path.join(root, "backups", job.id);
  };
  return {
    dataVolume,
    token: fs.readFileSync(tokenFile, "utf8").trim(),
    load() {
      return fs.existsSync(journal)
        ? JSON.parse(fs.readFileSync(journal, "utf8"))
        : undefined;
    },
    save(job) {
      atomic(journal, job);
      atomic(path.join(root, "state.json"), publicJob(job), true);
    },
    async backup(job) {
      const target = folder(job);
      fs.mkdirSync(target, { recursive: true, mode: 0o700 });
      const files = [];
      for (const name of names) {
        const source = path.join(data, name);
        if (!fs.existsSync(source)) continue;
        const stat = fs.lstatSync(source);
        if (!stat.isFile() || stat.isSymbolicLink())
          throw new Error("Unsupported database file");
        files.push({
          name,
          size: stat.size,
          uid: stat.uid,
          gid: stat.gid,
          mode: stat.mode & 0o777,
        });
      }
      if (!files.some((f) => f.name === "taskorbit.sqlite"))
        throw new Error("Database is missing");
      const space = fs.statfsSync(root);
      if (
        space.bavail * space.bsize <
        files.reduce((n, f) => n + f.size, 0) + 64 * 1024 * 1024
      )
        throw new Error("Insufficient backup space");
      for (const file of files) {
        const dest = path.join(target, file.name);
        fs.copyFileSync(path.join(data, file.name), dest);
        fs.chmodSync(dest, 0o600);
        file.sha256 = await digest(dest);
      }
      const db = new DatabaseSync(path.join(target, "taskorbit.sqlite"), {
        readOnly: true,
      });
      try {
        if (db.prepare("PRAGMA integrity_check").get().integrity_check !== "ok")
          throw new Error("Backup integrity failed");
      } finally {
        db.close();
      }
      // SQLite can create/change SHM during a read-only check; persist only copied originals.
      for (const file of files)
        file.sha256 = await digest(path.join(target, file.name));
      job.backup = { files };
    },
    async restore(job) {
      const target = folder(job);
      if (!job.backup?.files?.some((f) => f.name === "taskorbit.sqlite"))
        throw new Error("Backup manifest missing");
      for (const file of job.backup.files) {
        if (
          !names.includes(file.name) ||
          (await digest(path.join(target, file.name))) !== file.sha256
        )
          throw new Error("Backup integrity failed");
      }
      for (const file of job.backup.files) {
        const temp = path.join(data, file.name + ".restore");
        fs.copyFileSync(path.join(target, file.name), temp);
        if (process.platform !== "win32")
          fs.chownSync(temp, file.uid, file.gid);
        fs.chmodSync(temp, file.mode);
      }
      for (const name of names) {
        const destination = path.join(data, name);
        if (fs.existsSync(destination)) fs.unlinkSync(destination);
        if (job.backup.files.some((f) => f.name === name))
          fs.renameSync(destination + ".restore", destination);
      }
    },
  };
}
