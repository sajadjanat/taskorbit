import express from "express";
import helmet from "helmet";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { z } from "zod";
import {
  randomUUID,
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import path from "node:path";
import { readFileSync } from "node:fs";
import { openDatabase, transaction } from "./db.mjs";
import { createRealtime } from "./realtime.mjs";
import { mountMcp } from "./mcp.mjs";
import { mountPasswordRecovery, passwordMailer } from "./password-recovery.mjs";
import { mountWorkflows, templateIds } from "./workflows.mjs";
import {
  VERSION,
  releaseChecker,
  newer,
  updateAgentClient,
} from "./updates.mjs";

const id = z.string().uuid(),
  short = z.string().trim().min(1).max(200),
  date = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(
      (s) =>
        !Number.isNaN(Date.parse(s)) &&
        new Date(s).toISOString().slice(0, 10) === s,
    );
const text = z.string().max(30000),
  password = z.string().min(12).max(128);
const credentials = z.object({
  name: short,
  email: z.email().transform((s) => s.toLowerCase()),
  password,
});
const projectSchema = z.object({
  name: short,
  identifier: z.string().regex(/^[A-Z][A-Z0-9]{1,9}$/),
  description: text.default(""),
  color: z
    .string()
    .regex(/^#[a-fA-F0-9]{6}$/)
    .default("#7d4b0b"),
  archived: z.boolean().default(false),
  template: z.enum(templateIds).default("blank"),
  locale: z.enum(["en", "fa", "ar", "zh-CN"]).default("en"),
});
const sprintSchema = z
  .object({
    name: short,
    goal: text.default(""),
    start_date: date,
    end_date: date,
    status: z.enum(["planned", "active", "completed"]).default("planned"),
    capacity: z.number().int().min(0).max(100000).default(0),
  })
  .refine((v) => v.end_date >= v.start_date, {
    message: "End date precedes start date",
  });
const taskSchema = z.object({
  title: short,
  description: text.default(""),
  status: z
    .enum(["backlog", "todo", "doing", "review", "done", "cancelled"])
    .default("todo"),
  priority: z
    .enum(["urgent", "high", "medium", "low", "none"])
    .default("medium"),
  assignee_id: id.nullable().default(null),
  sprint_id: id.nullable().default(null),
  module_id: id.nullable().default(null),
  parent_id: id.nullable().default(null),
  labels: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  due_date: date.nullable().default(null),
  estimate: z.number().int().min(0).max(1000).default(0),
  recurrence: z.enum(["none", "daily", "weekly", "monthly"]).default("none"),
});
const hash = (v) => createHash("sha256").update(v).digest("hex");
export function hashPassword(value) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(value, salt, 64).toString("hex");
}
function verify(value, stored) {
  const [salt, key] = stored.split(":");
  return timingSafeEqual(Buffer.from(key, "hex"), scryptSync(value, salt, 64));
}
const publicUser = ({ password, ...u }) => u;
const fail = (code, message) => {
  const e = new Error(message);
  e.status = code;
  throw e;
};

export function createApp({
  database = "data/taskorbit.sqlite",
  origin = process.env.APP_ORIGIN || "http://localhost:4310",
  secure = process.env.NODE_ENV === "production",
  serveStatic = true,
  checkRelease = releaseChecker(),
  upgradeAgent = updateAgentClient(),
  maintenancePath = process.env.UPDATE_STATE_PATH,
  sendPasswordReset = passwordMailer(),
} = {}) {
  const db = openDatabase(database),
    app = express();
  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          fontSrc: ["'self'"],
          imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'"],
          upgradeInsecureRequests: secure ? [] : null,
        },
      },
    }),
  );
  const json = express.json({ limit: "256kb" });
  app.use(/^\/api\/projects\/[^/]+\/import$/, express.json({ limit: "2mb" }));
  app.use((req, res, next) =>
    req.path === "/mcp" || req.path === "/mcp/" ? next() : json(req, res, next),
  );
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (maintenancePath && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      try {
        const state = JSON.parse(readFileSync(maintenancePath, "utf8"));
        if (state.state === "running" || state.phase === "recovery_required")
          return res.status(503).json({
            error:
              "Server upgrade in progress; editing resumes after health verification",
          });
      } catch (e) {
        if (e.code !== "ENOENT")
          return res.status(503).json({
            error: "Upgrade state unavailable; editing temporarily paused",
          });
      }
    }
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers.origin &&
      req.headers.origin !== origin
    )
      return res.status(403).json({ error: "Origin not allowed" });
    next();
  });
  app.use("/api", identifySession);
  const apiLimit = rateLimit({
    windowMs: 60000,
    limit: 300,
    keyGenerator: (req) =>
      req.token
        ? `token:${req.token.id}`
        : req.session
          ? `session:${req.session}`
          : `ip:${ipKeyGenerator(req.ip)}`,
    message: { error: "Too many requests; retry shortly" },
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });
  app.use("/api", apiLimit);
  mountMcp(app, { origin, identify: identifySession, limit: apiLimit });
  const authLimit = rateLimit({
    windowMs: 15 * 60000,
    limit: 20,
    message: { error: "Too many sign-in attempts; try again later" },
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });
  function session(req, res, u) {
    db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
    const token = randomBytes(32).toString("hex");
    db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
      hash(token),
      u.id,
      Date.now() + 7 * 86400000,
    );
    res.cookie("taskorbit_session", token, {
      httpOnly: true,
      secure,
      sameSite: "strict",
      maxAge: 7 * 86400000,
      path: "/",
    });
    return publicUser(u);
  }
  function identifySession(req, res, next) {
    if (req.headers.authorization) {
      const bearer = /^Bearer (to_[A-Za-z0-9_-]{43})$/.exec(
        req.headers.authorization,
      )?.[1];
      const t =
        bearer &&
        db
          .prepare("SELECT * FROM api_tokens WHERE token_hash=? AND expires>?")
          .get(hash(bearer), Date.now());
      const u =
        t &&
        db
          .prepare("SELECT * FROM users WHERE id=? AND active=1")
          .get(t.user_id);
      if (u) {
        const scopes = JSON.parse(t.scopes);
        req.token = { id: t.id, name: t.name, scopes, expires: t.expires };
        req.user = {
          ...u,
          admin: Number(!!u.admin && scopes.includes("admin")),
        };
        db.prepare(
          "UPDATE api_tokens SET last_used_at=CURRENT_TIMESTAMP WHERE id=? AND (last_used_at IS NULL OR last_used_at<datetime('now','-1 minute'))",
        ).run(t.id);
      }
      return next();
    }
    const token = req.headers.cookie
      ?.split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("taskorbit_session="))
      ?.slice(18);
    const u =
      token &&
      db
        .prepare(
          "SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>? AND u.active=1",
        )
        .get(hash(token), Date.now());
    if (u) {
      req.user = u;
      req.session = hash(token);
    }
    next();
  }
  function auth(req, res, next) {
    if (!req.user) return res.status(401).json({ error: "Sign in required" });
    if (
      req.token &&
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      !req.token.scopes.includes("write")
    )
      return res.status(403).json({ error: "Token requires write permission" });
    next();
  }
  function sessionOnly(req, res, next) {
    if (!req.session)
      return res.status(403).json({
        error: "Use the signed-in application to manage account credentials",
      });
    next();
  }
  function admin(req, res, next) {
    if (!req.user.admin)
      return res.status(403).json({ error: "Instance administrator required" });
    next();
  }
  function workspace(req, wid, write = false, manage = false) {
    const w = db.prepare("SELECT * FROM workspaces WHERE id=?").get(wid);
    if (!w) fail(404, "Workspace not found");
    const m = db
      .prepare("SELECT role FROM members WHERE workspace_id=? AND user_id=?")
      .get(wid, req.user.id);
    if (
      !req.user.admin &&
      (!m || (write && m.role === "viewer") || (manage && m.role !== "admin"))
    )
      fail(403, "Workspace access denied");
    return w;
  }
  function project(req, pid, write = false, manage = false) {
    const p = db.prepare("SELECT * FROM projects WHERE id=?").get(pid);
    if (!p) fail(404, "Project not found");
    workspace(req, p.workspace_id, write, manage);
    if (write && p.archived) fail(409, "Project is archived");
    return p;
  }
  function task(req, tid, write = false) {
    const t = db.prepare("SELECT * FROM tasks WHERE id=?").get(tid);
    if (!t) fail(404, "Task not found");
    project(req, t.project_id, write);
    return t;
  }
  function audit(req, pid, tid, action, detail) {
    db.prepare(
      "INSERT INTO activity(project_id,task_id,user_id,action,detail) VALUES(?,?,?,?,?)",
    ).run(pid, tid, req.user.id, action, JSON.stringify(detail));
  }
  const decode = (t) => ({ ...t, labels: JSON.parse(t.labels) });
  function taskRefs(p, v, tid) {
    if (v.recurrence && v.recurrence !== "none" && !v.due_date)
      fail(400, "Recurring tasks need a due date");
    if (
      v.assignee_id &&
      !db
        .prepare(
          "SELECT 1 FROM members m JOIN users u ON u.id=m.user_id WHERE m.workspace_id=? AND m.user_id=? AND u.active=1",
        )
        .get(p.workspace_id, v.assignee_id)
    )
      fail(400, "Assignee must be an active workspace member");
    for (const [key, table] of [
      ["sprint_id", "sprints"],
      ["module_id", "modules"],
      ["parent_id", "tasks"],
    ]) {
      if (
        v[key] &&
        !db
          .prepare(`SELECT 1 FROM ${table} WHERE id=? AND project_id=?`)
          .get(v[key], p.id)
      )
        fail(400, "Related item belongs to a different project");
    }
    if (v.parent_id) {
      let parent = v.parent_id;
      while (parent) {
        if (parent === tid) fail(400, "Subtask cycle is not allowed");
        parent = db
          .prepare("SELECT parent_id FROM tasks WHERE id=?")
          .get(parent)?.parent_id;
      }
    }
  }

  app.get("/api/health", (req, res) => {
    db.prepare("SELECT 1").get();
    res.json({ status: "ok", version: VERSION });
  });
  app.get("/api/setup", (req, res) =>
    res.json({ required: !db.prepare("SELECT 1 FROM users LIMIT 1").get() }),
  );
  app.post("/api/setup", authLimit, (req, res) => {
    const v = credentials.extend({ workspace: short }).parse(req.body);
    const u = transaction(db, () => {
      if (db.prepare("SELECT 1 FROM users LIMIT 1").get())
        fail(409, "Instance already configured");
      const uid = randomUUID(),
        wid = randomUUID();
      db.prepare(
        "INSERT INTO users(id,name,email,password,admin) VALUES(?,?,?,?,1)",
      ).run(uid, v.name, v.email, hashPassword(v.password));
      db.prepare("INSERT INTO workspaces(id,name) VALUES(?,?)").run(
        wid,
        v.workspace,
      );
      db.prepare("INSERT INTO members VALUES(?,?,?)").run(wid, uid, "admin");
      return db.prepare("SELECT * FROM users WHERE id=?").get(uid);
    });
    res.status(201).json(session(req, res, u));
  });
  app.post("/api/login", authLimit, (req, res) => {
    const v = z
      .object({
        email: z.email().transform((s) => s.toLowerCase()),
        password: z.string().min(1).max(128),
      })
      .parse(req.body);
    const u = db
      .prepare("SELECT * FROM users WHERE email=? AND active=1")
      .get(v.email);
    if (!u) {
      scryptSync(v.password, "dummy-login-salt", 64);
      fail(401, "Invalid email or password");
    }
    if (!verify(v.password, u.password)) fail(401, "Invalid email or password");
    res.json(session(req, res, u));
  });
  mountPasswordRecovery(app, {
    db,
    origin,
    limiter: authLimit,
    mailer: sendPasswordReset,
    hashPassword,
    fail,
  });
  app.use("/api", auth);
  const realtime = createRealtime(db);
  app.get("/api/events", sessionOnly, realtime.connect);
  app.use("/api", realtime.track);
  const workflows = mountWorkflows(app, {
    db,
    workspace,
    project,
    task,
    audit,
    taskSchema,
    taskRefs,
    decode,
    fail,
  });
  app.get("/api/me", (req, res) => res.json(publicUser(req.user)));
  app.get("/api/me/token-info", (req, res) =>
    res.json({
      user: publicUser(req.user),
      scopes: req.token?.scopes ?? [
        "read",
        "write",
        ...(req.user.admin ? ["admin"] : []),
      ],
      expires: req.token?.expires ?? null,
    }),
  );
  app.get("/api/me/tokens", sessionOnly, (req, res) => {
    res.json(
      db
        .prepare(
          "SELECT id,name,scopes,expires,created_at,last_used_at FROM api_tokens WHERE user_id=? ORDER BY rowid DESC",
        )
        .all(req.user.id)
        .map((t) => ({ ...t, scopes: JSON.parse(t.scopes) })),
    );
  });
  app.post("/api/me/tokens", sessionOnly, (req, res) => {
    const v = z
      .object({
        name: short,
        days: z.number().int().min(1).max(365).default(30),
        write: z.boolean().default(false),
        admin: z.boolean().default(false),
      })
      .strict()
      .parse(req.body);
    if (v.admin && !req.user.admin)
      fail(403, "Instance administrator required");
    const tid = randomUUID(),
      token = "to_" + randomBytes(32).toString("base64url"),
      expires = Date.now() + v.days * 86400000;
    const scopes = [
      "read",
      ...(v.write ? ["write"] : []),
      ...(v.admin ? ["admin"] : []),
    ];
    db.prepare(
      "INSERT INTO api_tokens(id,user_id,name,token_hash,scopes,expires) VALUES(?,?,?,?,?,?)",
    ).run(
      tid,
      req.user.id,
      v.name,
      hash(token),
      JSON.stringify(scopes),
      expires,
    );
    res.status(201).json({ id: tid, name: v.name, scopes, expires, token });
  });
  app.delete("/api/me/tokens/:id", sessionOnly, (req, res) => {
    const result = db
      .prepare("DELETE FROM api_tokens WHERE id=? AND user_id=?")
      .run(req.params.id, req.user.id);
    if (!result.changes) fail(404, "Token not found");
    res.json({ ok: true });
  });
  app.post("/api/logout", sessionOnly, (req, res) => {
    db.prepare("DELETE FROM sessions WHERE token=?").run(req.session);
    res
      .clearCookie("taskorbit_session", {
        path: "/",
        httpOnly: true,
        secure,
        sameSite: "strict",
      })
      .json({ ok: true });
  });
  app.put("/api/me/password", sessionOnly, (req, res) => {
    const v = z
      .object({ current: z.string().max(128), password })
      .parse(req.body);
    if (!verify(v.current, req.user.password))
      fail(403, "Current password is incorrect");
    transaction(db, () => {
      db.prepare("UPDATE users SET password=? WHERE id=?").run(
        hashPassword(v.password),
        req.user.id,
      );
      db.prepare("DELETE FROM sessions WHERE user_id=?").run(req.user.id);
      db.prepare("DELETE FROM api_tokens WHERE user_id=?").run(req.user.id);
      db.prepare("DELETE FROM password_resets WHERE user_id=?").run(
        req.user.id,
      );
    });
    res.clearCookie("taskorbit_session", { path: "/" }).json({ ok: true });
  });
  app.get("/api/admin/updates", admin, async (req, res) => {
    try {
      const release = await checkRelease();
      res.json({
        current: VERSION,
        release,
        available: newer(release.version, VERSION),
        one_click: upgradeAgent.enabled,
      });
    } catch {
      res.status(503).json({
        error: "Cannot check releases; try again when online",
        current: VERSION,
        one_click: upgradeAgent.enabled,
      });
    }
  });
  app.get("/api/admin/updates/status", admin, async (req, res) => {
    try {
      res.json(
        upgradeAgent.enabled
          ? await upgradeAgent.request("/status")
          : { state: "disabled" },
      );
    } catch {
      res.status(503).json({ error: "Upgrade service unavailable" });
    }
  });
  app.post("/api/admin/updates", admin, async (req, res) => {
    try {
      const { version } = z
        .object({ version: z.string().regex(/^\d+\.\d+\.\d+$/) })
        .parse(req.body);
      const release = await checkRelease();
      if (version !== release.version || !newer(version, VERSION))
        return res.status(409).json({
          error: "Check the current eligible release before upgrading",
        });
      if (!upgradeAgent.enabled)
        return res.status(409).json({
          error:
            "Enable the Docker upgrade service before using one-click updates",
        });
      res
        .status(202)
        .json(
          await upgradeAgent.request("/upgrade", { version, from: VERSION }),
        );
    } catch (e) {
      res.status(e instanceof z.ZodError ? 400 : 503).json({
        error:
          e instanceof z.ZodError
            ? "Invalid release version"
            : "Cannot start upgrade; check the release and upgrade service",
      });
    }
  });
  app.get("/api/admin/users", admin, (req, res) =>
    res.json(
      db
        .prepare(
          "SELECT id,name,email,admin,active,created_at FROM users ORDER BY created_at",
        )
        .all(),
    ),
  );
  app.post("/api/admin/users", admin, (req, res) => {
    const v = credentials
        .extend({ admin: z.boolean().default(false) })
        .parse(req.body),
      uid = randomUUID();
    db.prepare(
      "INSERT INTO users(id,name,email,password,admin) VALUES(?,?,?,?,?)",
    ).run(uid, v.name, v.email, hashPassword(v.password), Number(v.admin));
    res
      .status(201)
      .json(publicUser(db.prepare("SELECT * FROM users WHERE id=?").get(uid)));
  });
  app.patch("/api/admin/users/:id", admin, (req, res) => {
    const v = z
      .object({
        name: short.optional(),
        active: z.boolean().optional(),
        admin: z.boolean().optional(),
        password: password.optional(),
      })
      .strict()
      .parse(req.body);
    const u = db.prepare("SELECT * FROM users WHERE id=?").get(req.params.id);
    if (!u) fail(404, "User not found");
    if (u.id === req.user.id && (v.active === false || v.admin === false))
      fail(400, "Cannot disable or demote yourself");
    transaction(db, () => {
      db.prepare(
        "UPDATE users SET name=?,active=?,admin=?,password=? WHERE id=?",
      ).run(
        v.name ?? u.name,
        Number(v.active ?? !!u.active),
        Number(v.admin ?? !!u.admin),
        v.password ? hashPassword(v.password) : u.password,
        u.id,
      );
      if (v.password || v.active === false) {
        db.prepare("DELETE FROM sessions WHERE user_id=?").run(u.id);
        db.prepare("DELETE FROM api_tokens WHERE user_id=?").run(u.id);
        db.prepare("DELETE FROM password_resets WHERE user_id=?").run(u.id);
      }
    });
    res.json(
      publicUser(db.prepare("SELECT * FROM users WHERE id=?").get(u.id)),
    );
  });
  app.get("/api/workspaces", (req, res) =>
    res.json(
      req.user.admin
        ? db.prepare("SELECT *, 'admin' AS role FROM workspaces").all()
        : db
            .prepare(
              "SELECT w.*,m.role FROM workspaces w JOIN members m ON m.workspace_id=w.id WHERE m.user_id=?",
            )
            .all(req.user.id),
    ),
  );
  app.post("/api/workspaces", admin, (req, res) => {
    const v = z.object({ name: short }).parse(req.body),
      wid = randomUUID();
    transaction(db, () => {
      db.prepare("INSERT INTO workspaces(id,name) VALUES(?,?)").run(
        wid,
        v.name,
      );
      db.prepare("INSERT INTO members VALUES(?,?,?)").run(
        wid,
        req.user.id,
        "admin",
      );
    });
    res.status(201).json({ id: wid, name: v.name, role: "admin" });
  });
  app.get("/api/workspaces/:wid/members", (req, res) => {
    workspace(req, req.params.wid);
    res.json(
      db
        .prepare(
          "SELECT u.id,u.name,u.email,u.active,m.role FROM users u JOIN members m ON m.user_id=u.id WHERE m.workspace_id=?",
        )
        .all(req.params.wid),
    );
  });
  app.post("/api/workspaces/:wid/members", (req, res) => {
    workspace(req, req.params.wid, true, true);
    const v = z
      .object({
        email: z.email().transform((s) => s.toLowerCase()),
        role: z.enum(["admin", "member", "viewer"]),
      })
      .parse(req.body);
    const u = db
      .prepare("SELECT id FROM users WHERE email=? AND active=1")
      .get(v.email);
    if (!u)
      fail(
        404,
        "Active user not found. Ask the instance administrator to create the account first.",
      );
    if (u.id === req.user.id && v.role !== "admin")
      fail(400, "Cannot demote yourself");
    db.prepare(
      "INSERT INTO members VALUES(?,?,?) ON CONFLICT(workspace_id,user_id) DO UPDATE SET role=excluded.role",
    ).run(req.params.wid, u.id, v.role);
    res.status(201).json({ ok: true });
  });
  app.put("/api/workspaces/:wid/members/:uid", (req, res) => {
    workspace(req, req.params.wid, true, true);
    const v = z
      .object({ role: z.enum(["admin", "member", "viewer"]) })
      .parse(req.body);
    if (
      !db
        .prepare("SELECT 1 FROM users WHERE id=? AND active=1")
        .get(req.params.uid)
    )
      fail(404, "Active user not found");
    if (req.params.uid === req.user.id && v.role !== "admin")
      fail(400, "Cannot demote yourself");
    db.prepare(
      "INSERT INTO members VALUES(?,?,?) ON CONFLICT(workspace_id,user_id) DO UPDATE SET role=excluded.role",
    ).run(req.params.wid, req.params.uid, v.role);
    res.json({ ok: true });
  });
  app.delete("/api/workspaces/:wid/members/:uid", (req, res) => {
    workspace(req, req.params.wid, true, true);
    if (req.params.uid === req.user.id) fail(400, "Cannot remove yourself");
    transaction(db, () => {
      db.prepare("DELETE FROM members WHERE workspace_id=? AND user_id=?").run(
        req.params.wid,
        req.params.uid,
      );
      db.prepare(
        "UPDATE tasks SET assignee_id=NULL,version=version+1 WHERE assignee_id=? AND project_id IN (SELECT id FROM projects WHERE workspace_id=?)",
      ).run(req.params.uid, req.params.wid);
    });
    res.json({ ok: true });
  });
  app.get("/api/workspaces/:wid/projects", (req, res) => {
    workspace(req, req.params.wid);
    res.json(
      db
        .prepare("SELECT * FROM projects WHERE workspace_id=? ORDER BY name")
        .all(req.params.wid),
    );
  });
  app.post("/api/workspaces/:wid/projects", (req, res) => {
    workspace(req, req.params.wid, true, true);
    const v = projectSchema.parse(req.body),
      pid = randomUUID();
    transaction(db, () => {
      db.prepare(
        "INSERT INTO projects(id,workspace_id,name,identifier,description,color) VALUES(?,?,?,?,?,?)",
      ).run(pid, req.params.wid, v.name, v.identifier, v.description, v.color);
      workflows.seedTemplate(
        req,
        db.prepare("SELECT * FROM projects WHERE id=?").get(pid),
        v.template,
        v.locale,
      );
    });
    res
      .status(201)
      .json(db.prepare("SELECT * FROM projects WHERE id=?").get(pid));
  });
  app.put("/api/projects/:pid", (req, res) => {
    const p = db
      .prepare("SELECT * FROM projects WHERE id=?")
      .get(req.params.pid);
    if (!p) fail(404, "Project not found");
    workspace(req, p.workspace_id, true, true);
    const v = projectSchema.parse(req.body);
    db.prepare(
      "UPDATE projects SET name=?,identifier=?,description=?,color=?,archived=? WHERE id=?",
    ).run(
      v.name,
      v.identifier,
      v.description,
      v.color,
      Number(v.archived),
      p.id,
    );
    res.json(db.prepare("SELECT * FROM projects WHERE id=?").get(p.id));
  });
  app.get("/api/projects/:pid/sprints", (req, res) => {
    project(req, req.params.pid);
    res.json(
      db
        .prepare(
          "SELECT * FROM sprints WHERE project_id=? ORDER BY start_date DESC",
        )
        .all(req.params.pid),
    );
  });
  app.post("/api/projects/:pid/sprints", (req, res) => {
    project(req, req.params.pid, true);
    const v = sprintSchema.parse(req.body),
      sid = randomUUID();
    db.prepare(
      "INSERT INTO sprints(id,project_id,name,goal,start_date,end_date,status,capacity) VALUES(?,?,?,?,?,?,?,?)",
    ).run(
      sid,
      req.params.pid,
      v.name,
      v.goal,
      v.start_date,
      v.end_date,
      v.status,
      v.capacity,
    );
    res.status(201).json({ id: sid, project_id: req.params.pid, ...v });
  });
  app.put("/api/sprints/:sid", (req, res) => {
    const s = db
      .prepare("SELECT * FROM sprints WHERE id=?")
      .get(req.params.sid);
    if (!s) fail(404, "Sprint not found");
    project(req, s.project_id, true);
    const v = sprintSchema.parse(req.body);
    db.prepare(
      "UPDATE sprints SET name=?,goal=?,start_date=?,end_date=?,status=?,capacity=? WHERE id=?",
    ).run(v.name, v.goal, v.start_date, v.end_date, v.status, v.capacity, s.id);
    workflows.snapshot(s.id, s.status !== "completed");
    res.json({ ...s, ...v });
  });
  app.get("/api/projects/:pid/tasks", (req, res) => {
    project(req, req.params.pid);
    res.json(
      db
        .prepare("SELECT * FROM tasks WHERE project_id=? ORDER BY number DESC")
        .all(req.params.pid)
        .map(decode),
    );
  });
  app.get("/api/tasks/:tid", (req, res) =>
    res.json(decode(task(req, req.params.tid))),
  );
  app.post("/api/projects/:pid/tasks", (req, res) => {
    const p = project(req, req.params.pid, true),
      v = taskSchema.parse(req.body);
    res
      .status(201)
      .json(transaction(db, () => workflows.insertTask(req, p, v)));
  });
  app.put("/api/tasks/:tid", (req, res) => {
    const t = task(req, req.params.tid, true),
      p = project(req, t.project_id, true),
      v = taskSchema
        .extend({ version: z.number().int().min(0) })
        .parse(req.body);
    taskRefs(p, v, t.id);
    transaction(db, () => {
      const result = db
        .prepare(
          "UPDATE tasks SET title=?,description=?,status=?,priority=?,assignee_id=?,sprint_id=?,module_id=?,parent_id=?,labels=?,due_date=?,estimate=?,recurrence=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND version=?",
        )
        .run(
          v.title,
          v.description,
          v.status,
          v.priority,
          v.assignee_id,
          v.sprint_id,
          v.module_id,
          v.parent_id,
          JSON.stringify(v.labels),
          v.due_date,
          v.estimate,
          v.recurrence,
          t.id,
          v.version,
        );
      if (!result.changes) fail(409, "Task changed. Refresh before saving.");
      audit(req, p.id, t.id, "updated", {
        from: t.status,
        to: v.status,
        title: v.title,
      });
      workflows.afterTaskChange(
        req,
        t,
        db.prepare("SELECT * FROM tasks WHERE id=?").get(t.id),
      );
    });
    res.json(decode(db.prepare("SELECT * FROM tasks WHERE id=?").get(t.id)));
  });
  app.delete("/api/tasks/:tid", (req, res) => {
    const t = task(req, req.params.tid, true);
    project(req, t.project_id, true, true);
    transaction(db, () => {
      audit(req, t.project_id, t.id, "deleted", { title: t.title });
      db.prepare("DELETE FROM tasks WHERE id=?").run(t.id);
      workflows.snapshot(t.sprint_id);
    });
    res.json({ ok: true });
  });
  app.get("/api/tasks/:tid/comments", (req, res) => {
    task(req, req.params.tid);
    res.json(
      db
        .prepare(
          "SELECT c.*,u.name FROM comments c JOIN users u ON u.id=c.user_id WHERE c.task_id=? ORDER BY c.created_at,c.rowid",
        )
        .all(req.params.tid),
    );
  });
  app.post("/api/tasks/:tid/comments", (req, res) => {
    const t = task(req, req.params.tid, true),
      v = z
        .object({ body: z.string().trim().min(1).max(10000) })
        .parse(req.body),
      cid = randomUUID();
    transaction(db, () => {
      db.prepare(
        "INSERT INTO comments(id,task_id,user_id,body) VALUES(?,?,?,?)",
      ).run(cid, t.id, req.user.id, v.body);
      audit(req, t.project_id, t.id, "commented", {});
      workflows.afterComment(req, t);
    });
    res.status(201).json({ id: cid, ...v });
  });
  app.get("/api/projects/:pid/activity", (req, res) => {
    project(req, req.params.pid);
    res.json(
      db
        .prepare(
          "SELECT a.*,u.name FROM activity a JOIN users u ON u.id=a.user_id WHERE a.project_id=? ORDER BY a.id DESC LIMIT 200",
        )
        .all(req.params.pid),
    );
  });
  app.get("/api/tasks/:tid/attachments", (req, res) => {
    task(req, req.params.tid);
    res.json(
      db
        .prepare(
          "SELECT id,name,size,created_at FROM attachments WHERE task_id=? ORDER BY rowid DESC",
        )
        .all(req.params.tid),
    );
  });
  app.post(
    "/api/tasks/:tid/attachments",
    express.raw({ type: "application/octet-stream", limit: "10mb" }),
    (req, res) => {
      const t = task(req, req.params.tid, true);
      const name = z
        .string()
        .min(1)
        .max(180)
        .refine((s) => !/[\x00-\x1f\x7f/\\]/.test(s))
        .parse(decodeURIComponent(req.headers["x-file-name"] || ""));
      if (!Buffer.isBuffer(req.body) || !req.body.length)
        fail(400, "Empty file");
      if (
        db
          .prepare("SELECT COUNT(*) AS n FROM attachments WHERE task_id=?")
          .get(t.id).n >= 20
      )
        fail(400, "At most 20 attachments per task");
      const aid = randomUUID();
      transaction(db, () => {
        db.prepare(
          "INSERT INTO attachments(id,task_id,user_id,name,size,content) VALUES(?,?,?,?,?,?)",
        ).run(aid, t.id, req.user.id, name, req.body.length, req.body);
        audit(req, t.project_id, t.id, "attached", {
          name,
          size: req.body.length,
        });
      });
      res.status(201).json({ id: aid, name, size: req.body.length });
    },
  );
  app.get("/api/attachments/:aid", (req, res) => {
    const a = db
      .prepare("SELECT * FROM attachments WHERE id=?")
      .get(req.params.aid);
    if (!a) fail(404, "Attachment not found");
    task(req, a.task_id);
    res
      .attachment(a.name)
      .type("application/octet-stream")
      .send(Buffer.from(a.content));
  });
  app.delete("/api/attachments/:aid", (req, res) => {
    const a = db
      .prepare("SELECT * FROM attachments WHERE id=?")
      .get(req.params.aid);
    if (!a) fail(404, "Attachment not found");
    const t = task(req, a.task_id, true);
    if (a.user_id !== req.user.id) project(req, t.project_id, true, true);
    db.prepare("DELETE FROM attachments WHERE id=?").run(a.id);
    res.json({ ok: true });
  });
  app.get("/api/tasks/:tid/links", (req, res) => {
    task(req, req.params.tid);
    res.json(
      db
        .prepare(
          "SELECT l.*,t.title,t.number FROM links l JOIN tasks t ON t.id=l.target_id WHERE l.task_id=?",
        )
        .all(req.params.tid),
    );
  });
  app.post("/api/tasks/:tid/links", (req, res) => {
    const t = task(req, req.params.tid, true),
      v = z
        .object({ target_id: id, type: z.enum(["related", "blocks"]) })
        .parse(req.body),
      target = task(req, v.target_id);
    if (t.project_id !== target.project_id || t.id === target.id)
      fail(400, "Link must point to another task in this project");
    if (v.type === "blocks") {
      const cycle = db
        .prepare(
          "WITH RECURSIVE deps(id) AS (SELECT target_id FROM links WHERE task_id=? AND type='blocks' UNION SELECT l.target_id FROM links l JOIN deps d ON l.task_id=d.id WHERE l.type='blocks') SELECT 1 FROM deps WHERE id=?",
        )
        .get(target.id, t.id);
      if (cycle) fail(400, "Dependency cycle is not allowed");
    }
    const lid = randomUUID();
    db.prepare("INSERT INTO links VALUES(?,?,?,?)").run(
      lid,
      t.id,
      target.id,
      v.type,
    );
    res.status(201).json({ id: lid, ...v });
  });
  app.delete("/api/links/:lid", (req, res) => {
    const l = db.prepare("SELECT * FROM links WHERE id=?").get(req.params.lid);
    if (!l) fail(404, "Link not found");
    task(req, l.task_id, true);
    db.prepare("DELETE FROM links WHERE id=?").run(l.id);
    res.json({ ok: true });
  });
  for (const resource of ["modules", "pages", "views"]) {
    const schema =
      resource === "modules"
        ? z.object({ name: short, description: text.default("") })
        : resource === "pages"
          ? z.object({ title: short, body: text.default("") })
          : z.object({
              name: short,
              filters: z.object({
                q: z.string().max(200).default(""),
                status: z
                  .enum([
                    "",
                    "backlog",
                    "todo",
                    "doing",
                    "review",
                    "done",
                    "cancelled",
                  ])
                  .default(""),
                priority: z
                  .enum(["", "urgent", "high", "medium", "low", "none"])
                  .default(""),
                assignee_id: z.union([id, z.literal("")]).default(""),
                sprint_id: z.union([id, z.literal("")]).default(""),
              }),
            });
    app.get(`/api/projects/:pid/${resource}`, (req, res) => {
      project(req, req.params.pid);
      res.json(
        db
          .prepare(
            `SELECT * FROM ${resource} WHERE project_id=? ORDER BY rowid DESC`,
          )
          .all(req.params.pid)
          .map((r) =>
            resource === "views" ? { ...r, filters: JSON.parse(r.filters) } : r,
          ),
      );
    });
    app.post(`/api/projects/:pid/${resource}`, (req, res) => {
      project(req, req.params.pid, true);
      const v = schema.parse(req.body),
        rid = randomUUID(),
        cols = Object.keys(v);
      db.prepare(
        `INSERT INTO ${resource}(id,project_id,${cols.join(",")}) VALUES(?,?,${cols.map(() => "?").join(",")})`,
      ).run(
        rid,
        req.params.pid,
        ...cols.map((k) => (k === "filters" ? JSON.stringify(v[k]) : v[k])),
      );
      res.status(201).json({
        id: rid,
        project_id: req.params.pid,
        ...v,
        ...(resource === "pages" ? { version: 0 } : {}),
      });
    });
    app.put(`/api/${resource}/:rid`, (req, res) => {
      const r = db
        .prepare(`SELECT * FROM ${resource} WHERE id=?`)
        .get(req.params.rid);
      if (!r) fail(404, "Item not found");
      project(req, r.project_id, true);
      const v = (
          resource === "pages"
            ? schema.extend({ version: z.number().int().min(0) })
            : schema
        ).parse(req.body),
        cols = Object.keys(v).filter((k) => k !== "version");
      const result = db
        .prepare(
          `UPDATE ${resource} SET ${cols.map((k) => k + "=?").join(",")}${resource === "pages" ? ",version=version+1,updated_at=CURRENT_TIMESTAMP" : ""} WHERE id=?${resource === "pages" ? " AND version=?" : ""}`,
        )
        .run(
          ...cols.map((k) => (k === "filters" ? JSON.stringify(v[k]) : v[k])),
          r.id,
          ...(resource === "pages" ? [v.version] : []),
        );
      if (!result.changes) fail(409, "Page changed. Refresh before saving.");
      res.json({
        ...r,
        ...v,
        ...(resource === "pages" ? { version: v.version + 1 } : {}),
      });
    });
    app.delete(`/api/${resource}/:rid`, (req, res) => {
      const r = db
        .prepare(`SELECT * FROM ${resource} WHERE id=?`)
        .get(req.params.rid);
      if (!r) fail(404, "Item not found");
      project(req, r.project_id, true, true);
      db.prepare(`DELETE FROM ${resource} WHERE id=?`).run(r.id);
      res.json({ ok: true });
    });
  }
  app.get("/api/admin/export", admin, (req, res) => {
    const data = { version: 1, exported_at: new Date().toISOString() };
    transaction(db, () => {
      for (const t of [
        "users",
        "workspaces",
        "members",
        "projects",
        "sprints",
        "modules",
        "tasks",
        "comments",
        "activity",
        "pages",
        "views",
      ])
        data[t] = db
          .prepare(
            t === "users"
              ? "SELECT id,name,email,admin,active,created_at FROM users"
              : `SELECT * FROM ${t}`,
          )
          .all();
    });
    res.attachment("taskorbit-export.json").json(data);
  });
  app.use("/api", (req, res) =>
    res.status(404).json({ error: "API route not found" }),
  );
  if (serveStatic) {
    app.use(express.static(path.resolve("dist"), { index: false }));
    app.get("/{*path}", (req, res) =>
      res.sendFile(path.resolve("dist/index.html")),
    );
  }
  app.use((error, req, res, next) => {
    if (error instanceof z.ZodError)
      return res.status(400).json({
        error: "Invalid input",
        issues: error.issues.map((x) => ({
          path: x.path,
          message: x.message,
        })),
      });
    if (
      error.code?.startsWith("ERR_SQLITE") ||
      error.message?.includes("constraint")
    )
      return res
        .status(409)
        .json({ error: "Duplicate identifier or conflicting data" });
    if (error.type === "entity.parse.failed")
      return res.status(400).json({ error: "Invalid JSON" });
    if (error.type === "entity.too.large")
      return res.status(413).json({ error: "Request too large" });
    res
      .status(error.status || 500)
      .json({ error: error.status ? error.message : "Server error" });
    if (!error.status) console.error(error);
  });
  return { app, db, closeRealtime: realtime.close };
}
