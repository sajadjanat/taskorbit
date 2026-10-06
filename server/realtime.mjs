// Same-origin, session-authenticated invalidation events. Work data stays behind the normal API.
export function createRealtime(db) {
  const clients = new Set();
  let heartbeat;
  const currentUser = (client) =>
    db
      .prepare(
        "SELECT u.id,u.admin FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>? AND u.active=1",
      )
      .get(client.session, Date.now());
  function send(client, event, data = {}) {
    if (!client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      client.res.end();
  }
  function reconcile() {
    for (const client of clients) if (!currentUser(client)) client.res.end();
  }
  function visible(user, wid) {
    return (
      !!user.admin ||
      !!db
        .prepare("SELECT 1 FROM members WHERE workspace_id=? AND user_id=?")
        .get(wid, user.id)
    );
  }
  function publish(scope) {
    for (const client of clients) {
      const user = currentUser(client);
      if (!user) {
        client.res.end();
        continue;
      }
      if (scope.affectedUsers?.has(user.id)) {
        send(client, "changed", { kind: "access" });
      } else if (scope.workspace_id && visible(user, scope.workspace_id)) {
        send(client, "changed", {
          kind: scope.project_id ? "project" : "workspace",
          workspace_id: scope.workspace_id,
          ...(scope.project_id ? { project_id: scope.project_id } : {}),
          ...(scope.resource ? { resource: scope.resource } : {}),
        });
      } else if (scope.admin && user.admin) {
        send(client, "changed", { kind: "access" });
      }
    }
  }
  function scopeFor(req) {
    const route = req.originalUrl.split("?")[0];
    let match;
    if ((match = route.match(/^\/api\/workspaces\/([^/]+)/))) {
      const scope = { workspace_id: match[1] };
      const member = route.match(/\/members\/([^/]+)$/);
      if (member) scope.affectedUsers = new Set([member[1]]);
      return scope;
    }
    if (route === "/api/workspaces")
      return { admin: true, affectedUsers: new Set([req.user.id]) };
    if ((match = route.match(/^\/api\/admin\/users(?:\/([^/]+))?$/))) {
      const affectedUsers = new Set();
      if (match[1]) {
        affectedUsers.add(match[1]);
        for (const u of db
          .prepare(
            "SELECT DISTINCT b.user_id FROM members a JOIN members b ON a.workspace_id=b.workspace_id WHERE a.user_id=?",
          )
          .all(match[1]))
          affectedUsers.add(u.user_id);
      }
      return { admin: true, affectedUsers };
    }
    if (
      (match = route.match(
        /^\/api\/(projects|tasks|sprints|modules|pages|views|attachments|links)\/([^/]+)/,
      ))
    ) {
      const [, kind, id] = match;
      const sql =
        kind === "projects"
          ? "SELECT workspace_id,id AS project_id FROM projects WHERE id=?"
          : kind === "attachments" || kind === "links"
            ? `SELECT p.workspace_id,p.id AS project_id FROM ${kind} r JOIN tasks t ON t.id=r.task_id JOIN projects p ON p.id=t.project_id WHERE r.id=?`
            : `SELECT p.workspace_id,p.id AS project_id FROM ${kind} r JOIN projects p ON p.id=r.project_id WHERE r.id=?`;
      const resource = kind === "tasks" ? route.split("/")[4] || "tasks" : kind;
      return { ...db.prepare(sql).get(id), resource };
    }
    return {};
  }
  function track(req, res, next) {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    // Resolve before a deletion removes the row needed to determine its scope.
    const scope = scopeFor(req);
    res.once("finish", () => {
      if (res.statusCode < 200 || res.statusCode >= 300) return;
      reconcile();
      if (scope.workspace_id || scope.admin || scope.affectedUsers)
        publish(scope);
    });
    next();
  }
  function connect(req, res) {
    if (
      req.headers.origin &&
      req.headers.origin !== `${req.protocol}://${req.get("host")}`
    )
      return res.status(403).json({ error: "Origin not allowed" });
    if (
      clients.size >= 1000 ||
      [...clients].filter((c) => c.userId === req.user.id).length >= 10
    )
      return res.status(429).json({ error: "Too many live connections" });
    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders();
    const client = { res, userId: req.user.id, session: req.session };
    clients.add(client);
    res.once("close", () => {
      clients.delete(client);
      if (!clients.size) {
        clearInterval(heartbeat);
        heartbeat = undefined;
      }
    });
    res.write("retry: 1500\n");
    send(client, "ready"); // Refresh on every reconnect, including changes missed while offline.
    if (!heartbeat)
      heartbeat = setInterval(() => {
        reconcile();
        for (const c of clients)
          if (!c.res.writableEnded && !c.res.write(": heartbeat\n\n"))
            c.res.end();
      }, 20000).unref();
  }
  function close() {
    for (const c of clients) c.res.end();
    clearInterval(heartbeat);
  }
  return { connect, track, close };
}
