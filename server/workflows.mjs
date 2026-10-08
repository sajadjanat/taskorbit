import { parseCsv } from "../shared/csv.mjs";
export { parseCsv } from "../shared/csv.mjs";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { transaction } from "./db.mjs";

const templates = {
  software: {
    en: [
      "Product delivery",
      "Design the first milestone",
      "Build the core workflow",
      "Review accessibility",
      "Prepare release notes",
    ],
    fa: [
      "تحویل محصول",
      "طراحی اولین مرحله",
      "ساخت جریان اصلی محصول",
      "بررسی دسترس‌پذیری",
      "آماده‌سازی یادداشت انتشار",
    ],
    ar: [
      "تسليم المنتج",
      "تصميم المرحلة الأولى",
      "بناء سير العمل الأساسي",
      "مراجعة إمكانية الوصول",
      "إعداد ملاحظات الإصدار",
    ],
    "zh-CN": [
      "产品交付",
      "设计首个里程碑",
      "构建核心流程",
      "检查无障碍体验",
      "准备版本说明",
    ],
  },
  campaign: {
    en: [
      "Campaign launch",
      "Define audience and goal",
      "Prepare campaign content",
      "Review and approve assets",
      "Measure campaign results",
    ],
    fa: [
      "راه‌اندازی کمپین",
      "تعیین مخاطب و هدف",
      "آماده‌سازی محتوای کمپین",
      "بازبینی و تأیید محتوا",
      "اندازه‌گیری نتیجهٔ کمپین",
    ],
    ar: [
      "إطلاق حملة",
      "تحديد الجمهور والهدف",
      "إعداد محتوى الحملة",
      "مراجعة المحتوى واعتماده",
      "قياس نتائج الحملة",
    ],
    "zh-CN": [
      "活动发布",
      "确定受众与目标",
      "准备活动内容",
      "审核并批准素材",
      "衡量活动效果",
    ],
  },
  operations: {
    en: [
      "Team operations",
      "Review this week's priorities",
      "Resolve outstanding requests",
      "Update team documentation",
      "Share weekly progress",
    ],
    fa: [
      "عملیات تیم",
      "مرور اولویت‌های هفته",
      "رسیدگی به درخواست‌های باز",
      "به‌روزرسانی مستندات تیم",
      "اشتراک‌گذاری پیشرفت هفتگی",
    ],
    ar: [
      "عمليات الفريق",
      "مراجعة أولويات الأسبوع",
      "معالجة الطلبات المفتوحة",
      "تحديث وثائق الفريق",
      "مشاركة تقدم الأسبوع",
    ],
    "zh-CN": [
      "团队运营",
      "审查本周优先事项",
      "处理未完成请求",
      "更新团队文档",
      "分享每周进展",
    ],
  },
};
export const templateIds = ["blank", ...Object.keys(templates)];

export function nextDueDate(date, recurrence) {
  const d = new Date(`${date}T12:00:00Z`);
  if (recurrence === "monthly") {
    const day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + 1);
    const last = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
    ).getUTCDate();
    d.setUTCDate(Math.min(day, last));
  } else d.setUTCDate(d.getUTCDate() + (recurrence === "weekly" ? 7 : 1));
  return d.toISOString().slice(0, 10);
}

export function mountWorkflows(
  app,
  { db, workspace, project, task, audit, taskSchema, taskRefs, decode, fail },
) {
  const uid = z.string().uuid();
  const today = () => new Date().toISOString().slice(0, 10);
  const accessSql =
    "(?=1 OR EXISTS(SELECT 1 FROM members m WHERE m.workspace_id=p.workspace_id AND m.user_id=?))";
  const permitted = (req) => [Number(!!req.user.admin), req.user.id];

  function snapshot(sid, force = false) {
    if (!sid) return;
    const s = db.prepare("SELECT status FROM sprints WHERE id=?").get(sid);
    if (!s) return;
    const counts = db
      .prepare(
        "SELECT COALESCE(SUM(CASE WHEN status!='cancelled' THEN estimate ELSE 0 END),0) AS scope,COALESCE(SUM(CASE WHEN status NOT IN ('done','cancelled') THEN estimate ELSE 0 END),0) AS remaining,SUM(status='done') AS completed FROM tasks WHERE sprint_id=?",
      )
      .get(sid);
    // A completed sprint keeps its final snapshot; moving work later does not rewrite history.
    if (
      !force &&
      s.status === "completed" &&
      db.prepare("SELECT 1 FROM sprint_history WHERE sprint_id=?").get(sid)
    )
      return;
    db.prepare(
      "INSERT INTO sprint_history VALUES(?,?,?,?,?) ON CONFLICT(sprint_id,day) DO UPDATE SET scope_points=excluded.scope_points,remaining_points=excluded.remaining_points,completed_items=excluded.completed_items",
    ).run(sid, today(), counts.scope, counts.remaining, counts.completed || 0);
  }
  function notify(userId, t, kind, actorId, dedupe = null) {
    if (!userId || userId === actorId) return;
    if (
      !db
        .prepare(
          "SELECT 1 FROM users u JOIN members m ON m.user_id=u.id JOIN projects p ON p.workspace_id=m.workspace_id WHERE u.id=? AND u.active=1 AND p.id=?",
        )
        .get(userId, t.project_id)
    )
      return;
    db.prepare(
      "INSERT OR IGNORE INTO notifications(id,user_id,project_id,task_id,kind,actor_id,dedupe_key) VALUES(?,?,?,?,?,?,?)",
    ).run(
      randomUUID(),
      userId,
      t.project_id,
      t.id,
      kind,
      actorId || null,
      dedupe,
    );
  }
  function insertTask(req, p, v, source = null) {
    const tid = randomUUID();
    taskRefs(p, v, tid);
    const number = db
      .prepare(
        "UPDATE projects SET sequence=sequence+1 WHERE id=? RETURNING sequence",
      )
      .get(p.id).sequence;
    db.prepare(
      "INSERT INTO tasks(id,project_id,number,title,description,status,priority,assignee_id,sprint_id,module_id,parent_id,labels,due_date,estimate,created_by,recurrence,recurrence_source_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    ).run(
      tid,
      p.id,
      number,
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
      req.user.id,
      v.recurrence || "none",
      source,
    );
    audit(req, p.id, tid, "created", { title: v.title, status: v.status });
    const created = decode(
      db.prepare("SELECT * FROM tasks WHERE id=?").get(tid),
    );
    notify(created.assignee_id, created, "assigned", req.user.id);
    snapshot(created.sprint_id);
    return created;
  }
  function afterTaskChange(req, previous, current) {
    if (previous.assignee_id !== current.assignee_id)
      notify(current.assignee_id, current, "assigned", req.user.id);
    if (previous.status !== "done" && current.status === "done") {
      notify(current.created_by, current, "completed", req.user.id);
      if (
        current.recurrence !== "none" &&
        current.due_date &&
        !db
          .prepare("SELECT 1 FROM tasks WHERE recurrence_source_id=?")
          .get(current.id)
      ) {
        insertTask(
          req,
          project(req, current.project_id, true),
          taskSchema.parse({
            ...decode(current),
            status: "todo",
            due_date: nextDueDate(current.due_date, current.recurrence),
            parent_id: null,
            sprint_id: null,
          }),
          current.id,
        );
      }
    }
    snapshot(previous.sprint_id);
    snapshot(current.sprint_id);
  }
  function afterComment(req, t) {
    const recipients = new Set([
      t.assignee_id,
      t.created_by,
      ...db
        .prepare("SELECT DISTINCT user_id FROM comments WHERE task_id=?")
        .all(t.id)
        .map((c) => c.user_id),
    ]);
    for (const recipient of recipients)
      notify(recipient, t, "comment", req.user.id);
  }
  function seedTemplate(req, p, templateId, locale) {
    const rows = templates[templateId]?.[locale] || templates[templateId]?.en;
    if (!rows) return;
    rows.slice(1).forEach((title, index) =>
      insertTask(
        req,
        p,
        taskSchema.parse({
          title,
          status: index === 0 ? "todo" : "backlog",
          estimate: index === 0 ? 2 : 3,
        }),
      ),
    );
    db.prepare("INSERT INTO modules(id,project_id,name) VALUES(?,?,?)").run(
      randomUUID(),
      p.id,
      rows[0],
    );
  }

  app.get("/api/search", (req, res) => {
    const q = z
      .string()
      .trim()
      .max(100)
      .parse(req.query.q || "");
    if (q.length < 2) return res.json([]);
    const ps = permitted(req);
    const rows = [
      ...db
        .prepare(
          `SELECT t.id,t.title,t.status,t.project_id,p.workspace_id,p.identifier||'-'||t.number AS reference,'task' AS kind FROM tasks t JOIN projects p ON p.id=t.project_id WHERE p.archived=0 AND ${accessSql} AND instr(lower(t.title||' '||t.description||' '||p.identifier||'-'||t.number),lower(?))>0 ORDER BY t.updated_at DESC LIMIT 30`,
        )
        .all(...ps, q),
      ...db
        .prepare(
          `SELECT p.id,p.name AS title,p.id AS project_id,p.workspace_id,p.identifier AS reference,'project' AS kind FROM projects p WHERE p.archived=0 AND ${accessSql} AND instr(lower(p.name||' '||p.identifier),lower(?))>0 ORDER BY p.name LIMIT 10`,
        )
        .all(...ps, q),
      ...db
        .prepare(
          `SELECT s.id,s.name AS title,s.project_id,p.workspace_id,p.identifier AS reference,'sprint' AS kind FROM sprints s JOIN projects p ON p.id=s.project_id WHERE p.archived=0 AND ${accessSql} AND instr(lower(s.name||' '||s.goal),lower(?))>0 ORDER BY s.start_date DESC LIMIT 10`,
        )
        .all(...ps, q),
      ...db
        .prepare(
          `SELECT d.id,d.title,d.project_id,p.workspace_id,p.identifier AS reference,'page' AS kind FROM pages d JOIN projects p ON p.id=d.project_id WHERE p.archived=0 AND ${accessSql} AND instr(lower(d.title||' '||d.body),lower(?))>0 LIMIT 10`,
        )
        .all(...ps, q),
    ];
    const projectNames = new Map();
    const names = db.prepare(
      "SELECT p.name AS project_name,w.name AS workspace_name FROM projects p JOIN workspaces w ON w.id=p.workspace_id WHERE p.id=?",
    );
    res.json(
      rows.map((row) => {
        if (!projectNames.has(row.project_id))
          projectNames.set(row.project_id, names.get(row.project_id));
        return { ...row, ...projectNames.get(row.project_id) };
      }),
    );
  });
  app.get("/api/notifications", (req, res) => {
    const reminderTasks = db
      .prepare(
        `SELECT t.* FROM tasks t JOIN projects p ON p.id=t.project_id WHERE p.archived=0 AND ${accessSql} AND t.assignee_id=? AND t.status NOT IN ('done','cancelled') AND t.due_date<=?`,
      )
      .all(...permitted(req), req.user.id, nextDueDate(today(), "daily"));
    for (const t of reminderTasks) {
      const dedupe = `due:${req.user.id}:${t.id}:${t.due_date}`;
      const kind = t.due_date < today() ? "overdue" : "due";
      notify(req.user.id, t, kind, null, dedupe);
      // Retain read state while updating the reminder when its deadline passes.
      db.prepare("UPDATE notifications SET kind=? WHERE dedupe_key=?").run(
        kind,
        dedupe,
      );
    }
    const select = `FROM notifications n JOIN projects p ON p.id=n.project_id JOIN tasks t ON t.id=n.task_id LEFT JOIN users u ON u.id=n.actor_id WHERE n.user_id=? AND p.archived=0 AND ${accessSql}`;
    const params = [req.user.id, ...permitted(req)];
    res.json({
      items: db
        .prepare(
          `SELECT n.*,t.title,t.status,p.workspace_id,p.identifier||'-'||t.number AS reference,u.name AS actor ${select} ORDER BY n.created_at DESC,n.rowid DESC LIMIT 100`,
        )
        .all(...params),
      unread: db
        .prepare(`SELECT COUNT(*) AS count ${select} AND n.read=0`)
        .get(...params).count,
    });
  });
  app.post("/api/notifications/read", (req, res) => {
    db.prepare("UPDATE notifications SET read=1 WHERE user_id=?").run(
      req.user.id,
    );
    res.json({ ok: true });
  });
  app.post("/api/notifications/:id/read", (req, res) => {
    db.prepare("UPDATE notifications SET read=1 WHERE id=? AND user_id=?").run(
      req.params.id,
      req.user.id,
    );
    res.json({ ok: true });
  });
  app.post("/api/projects/:pid/tasks/bulk", (req, res) => {
    const p = project(req, req.params.pid, true);
    const v = z
      .object({
        tasks: z
          .array(z.object({ id: uid, version: z.number().int().min(0) }))
          .min(1)
          .max(100),
        changes: z
          .object({
            status: z
              .enum(["backlog", "todo", "doing", "review", "done", "cancelled"])
              .optional(),
            priority: z
              .enum(["urgent", "high", "medium", "low", "none"])
              .optional(),
            assignee_id: uid.nullable().optional(),
            sprint_id: uid.nullable().optional(),
          })
          .strict(),
      })
      .parse(req.body);
    if (
      !Object.keys(v.changes).length ||
      new Set(v.tasks.map((t) => t.id)).size !== v.tasks.length
    )
      fail(400, "Choose unique tasks and a change");
    transaction(db, () => {
      for (const selected of v.tasks) {
        const before = task(req, selected.id, true);
        if (before.project_id !== p.id)
          fail(400, "Bulk tasks must belong to this project");
        if (before.version !== selected.version)
          fail(409, "Task changed. Refresh before saving.");
        const next = taskSchema.parse({ ...decode(before), ...v.changes });
        taskRefs(p, next, before.id);
        const keys = Object.keys(v.changes);
        db.prepare(
          `UPDATE tasks SET ${keys.map((k) => `${k}=?`).join(",")},version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?`,
        ).run(...keys.map((k) => v.changes[k]), before.id);
        const current = db
          .prepare("SELECT * FROM tasks WHERE id=?")
          .get(before.id);
        audit(req, p.id, before.id, "updated", {
          from: before.status,
          to: current.status,
          title: current.title,
          bulk: true,
        });
        afterTaskChange(req, before, current);
      }
    });
    res.json({ updated: v.tasks.length });
  });
  app.get("/api/sprints/:sid/report", (req, res) => {
    const s = db
      .prepare("SELECT * FROM sprints WHERE id=?")
      .get(req.params.sid);
    if (!s) fail(404, "Sprint not found");
    project(req, s.project_id);
    snapshot(s.id);
    const tasks = db
      .prepare("SELECT * FROM tasks WHERE sprint_id=? AND status!='cancelled'")
      .all(s.id);
    const total = tasks.reduce((sum, t) => sum + t.estimate, 0);
    const completed = tasks
      .filter((t) => t.status === "done")
      .reduce((sum, t) => sum + t.estimate, 0);
    const workload = db
      .prepare(
        "SELECT t.assignee_id,u.name,COUNT(*) AS items,SUM(t.estimate) AS points,SUM(CASE WHEN t.status='done' THEN t.estimate ELSE 0 END) AS completed FROM tasks t LEFT JOIN users u ON u.id=t.assignee_id WHERE t.sprint_id=? AND t.status!='cancelled' GROUP BY t.assignee_id ORDER BY points DESC",
      )
      .all(s.id);
    res.json({
      sprint: s,
      total_points: total,
      completed_points: completed,
      remaining_points: total - completed,
      total_items: tasks.length,
      completed_items: tasks.filter((t) => t.status === "done").length,
      workload,
      history: db
        .prepare("SELECT * FROM sprint_history WHERE sprint_id=? ORDER BY day")
        .all(s.id),
    });
  });
  app.get("/api/projects/:pid/export", (req, res) => {
    const p = project(req, req.params.pid);
    const data = {
      schema: "taskorbit-project",
      version: 1,
      exported_at: new Date().toISOString(),
      project: p,
    };
    transaction(db, () => {
      for (const table of ["sprints", "modules", "pages"])
        data[table] = db
          .prepare(`SELECT * FROM ${table} WHERE project_id=? ORDER BY rowid`)
          .all(p.id);
      data.tasks = db
        .prepare(
          "SELECT t.*,u.email AS assignee_email FROM tasks t LEFT JOIN users u ON u.id=t.assignee_id WHERE t.project_id=? ORDER BY t.number",
        )
        .all(p.id)
        .map(decode);
    });
    res.attachment(`${p.identifier}-project.json`).json(data);
  });
  app.post("/api/projects/:pid/import", (req, res) => {
    const p = project(req, req.params.pid, true, true);
    const input = z
      .object({
        format: z.enum(["json", "csv"]),
        content: z.string().max(1500000),
      })
      .parse(req.body);
    let data;
    try {
      if (input.format === "json") data = JSON.parse(input.content);
      else {
        const [headers = [], ...rows] = parseCsv(input.content);
        const names = headers.map((h) => h.trim().toLowerCase());
        const titleAt = names.findIndex((h) =>
          ["title", "summary", "name"].includes(h),
        );
        if (titleAt === -1) fail(400, "CSV needs a title or Summary column");
        data = {
          schema: "taskorbit-project",
          version: 1,
          tasks: rows.map((row, index) => {
            if (row.length !== headers.length)
              fail(400, `CSV row ${index + 2} has a different column count`);
            const raw = Object.fromEntries(
              names.map((key, i) => [key, row[i]]),
            );
            const aliases = {
              "to do": "todo",
              "in progress": "doing",
              "in review": "review",
              closed: "done",
              highest: "urgent",
              lowest: "low",
            };
            const mapped = (value) =>
              aliases[value?.toLowerCase()] || value?.toLowerCase();
            return {
              id: randomUUID(),
              title: row[titleAt],
              description: raw.description || "",
              status: mapped(raw.status) || "todo",
              priority: mapped(raw.priority) || "medium",
              due_date: raw.due_date || raw["due date"] || null,
              estimate: Number(raw.estimate || 0),
              labels: (raw.labels || "")
                .split(/[;،]/)
                .map((l) => l.trim())
                .filter(Boolean),
            };
          }),
        };
      }
    } catch (e) {
      if (e.status) throw e;
      fail(400, "Invalid import file");
    }
    const entityIds = z
      .array(z.object({ id: uid }).passthrough())
      .max(500)
      .default([]);
    data = z
      .object({
        schema: z.literal("taskorbit-project"),
        version: z.literal(1),
        tasks: entityIds,
        sprints: entityIds,
        modules: entityIds,
        pages: entityIds,
      })
      .parse(data);
    for (const rows of [data.tasks, data.sprints, data.modules, data.pages])
      if (new Set(rows.map((r) => r.id)).size !== rows.length)
        fail(400, "Import contains duplicate IDs");
    const maps = Object.fromEntries(
      ["tasks", "sprints", "modules", "pages"].map((table) => [
        table,
        new Map(data[table].map((r) => [r.id, randomUUID()])),
      ]),
    );
    const mapRef = (table, id) => {
      if (!id) return null;
      if (!maps[table].has(id))
        fail(400, "Import contains a missing reference");
      return maps[table].get(id);
    };
    // Validate the entire file before importing anything, including parent cycles.
    const original = new Map(data.tasks.map((t) => [t.id, t]));
    const occurrenceSources = new Set();
    for (const t of data.tasks) {
      const seen = new Set([t.id]);
      let parent = t.parent_id;
      while (parent) {
        if (!original.has(parent) || seen.has(parent))
          fail(400, "Import contains a missing parent or a subtask cycle");
        seen.add(parent);
        parent = original.get(parent).parent_id;
      }
      let source = t.recurrence_source_id;
      const sourceChain = new Set([t.id]);
      if (source && occurrenceSources.has(source))
        fail(400, "Import repeats an occurrence source");
      if (source) occurrenceSources.add(source);
      while (source) {
        if (!original.has(source) || sourceChain.has(source))
          fail(400, "Import contains an invalid recurrence chain");
        sourceChain.add(source);
        source = original.get(source).recurrence_source_id;
      }
    }
    let unassigned = 0;
    transaction(db, () => {
      for (const s of data.sprints) {
        const v = z
          .object({
            name: z.string().trim().min(1).max(200),
            goal: z.string().max(30000).default(""),
            start_date: z.iso.date(),
            end_date: z.iso.date(),
            capacity: z.number().int().min(0).max(100000).default(0),
          })
          .parse(s);
        if (v.end_date < v.start_date)
          fail(400, "End date precedes start date");
        // Imported sprints start planned; an existing active sprint is never displaced.
        db.prepare(
          "INSERT INTO sprints(id,project_id,name,goal,start_date,end_date,status,capacity) VALUES(?,?,?,?,?,?,?,?)",
        ).run(
          maps.sprints.get(s.id),
          p.id,
          v.name,
          v.goal,
          v.start_date,
          v.end_date,
          "planned",
          v.capacity,
        );
      }
      for (const m of data.modules) {
        const v = z
          .object({
            name: z.string().trim().min(1).max(200),
            description: z.string().max(30000).default(""),
          })
          .parse(m);
        db.prepare("INSERT INTO modules VALUES(?,?,?,?)").run(
          maps.modules.get(m.id),
          p.id,
          v.name,
          v.description,
        );
      }
      for (const t of data.tasks) {
        const assignee =
          t.assignee_email &&
          db
            .prepare(
              "SELECT u.id FROM users u JOIN members m ON m.user_id=u.id WHERE u.email=? AND m.workspace_id=? AND u.active=1",
            )
            .get(String(t.assignee_email).toLowerCase(), p.workspace_id)?.id;
        if ((t.assignee_id || t.assignee_email) && !assignee) unassigned++;
        const v = taskSchema.parse({
          ...t,
          assignee_id: assignee || null,
          sprint_id: mapRef("sprints", t.sprint_id),
          module_id: mapRef("modules", t.module_id),
          parent_id: null,
        });
        taskRefs(p, v, maps.tasks.get(t.id));
        const n = db
          .prepare(
            "UPDATE projects SET sequence=sequence+1 WHERE id=? RETURNING sequence",
          )
          .get(p.id).sequence;
        db.prepare(
          "INSERT INTO tasks(id,project_id,number,title,description,status,priority,assignee_id,sprint_id,module_id,labels,due_date,estimate,created_by,recurrence) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        ).run(
          maps.tasks.get(t.id),
          p.id,
          n,
          v.title,
          v.description,
          v.status,
          v.priority,
          v.assignee_id,
          v.sprint_id,
          v.module_id,
          JSON.stringify(v.labels),
          v.due_date,
          v.estimate,
          req.user.id,
          v.recurrence,
        );
        audit(req, p.id, maps.tasks.get(t.id), "created", {
          title: v.title,
          status: v.status,
          imported: true,
        });
      }
      for (const t of data.tasks) {
        if (t.parent_id)
          db.prepare("UPDATE tasks SET parent_id=? WHERE id=?").run(
            mapRef("tasks", t.parent_id),
            maps.tasks.get(t.id),
          );
        if (t.recurrence_source_id)
          db.prepare("UPDATE tasks SET recurrence_source_id=? WHERE id=?").run(
            mapRef("tasks", t.recurrence_source_id),
            maps.tasks.get(t.id),
          );
        const imported = db
          .prepare("SELECT * FROM tasks WHERE id=?")
          .get(maps.tasks.get(t.id));
        notify(imported.assignee_id, imported, "assigned", req.user.id);
      }
      for (const page of data.pages) {
        const v = z
          .object({
            title: z.string().trim().min(1).max(200),
            body: z.string().max(30000).default(""),
          })
          .parse(page);
        db.prepare(
          "INSERT INTO pages(id,project_id,title,body) VALUES(?,?,?,?)",
        ).run(maps.pages.get(page.id), p.id, v.title, v.body);
      }
      for (const sid of maps.sprints.values()) snapshot(sid);
    });
    res.status(201).json({
      tasks: data.tasks.length,
      sprints: data.sprints.length,
      modules: data.modules.length,
      pages: data.pages.length,
      unassigned,
    });
  });
  return { insertTask, afterTaskChange, afterComment, seedTemplate, snapshot };
}
