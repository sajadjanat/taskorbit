import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
export function openDatabase(file) {
  if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,password TEXT NOT NULL,admin INTEGER NOT NULL DEFAULT 0,active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS api_tokens(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,name TEXT NOT NULL,token_hash TEXT NOT NULL UNIQUE,scopes TEXT NOT NULL,expires INTEGER NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,last_used_at TEXT);
    CREATE TABLE IF NOT EXISTS workspaces(id TEXT PRIMARY KEY,name TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS members(workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,role TEXT NOT NULL CHECK(role IN ('admin','member','viewer')),PRIMARY KEY(workspace_id,user_id));
    CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,name TEXT NOT NULL,identifier TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',color TEXT NOT NULL DEFAULT '#2563eb',archived INTEGER NOT NULL DEFAULT 0,sequence INTEGER NOT NULL DEFAULT 0,UNIQUE(workspace_id,identifier));
    CREATE TABLE IF NOT EXISTS sprints(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,name TEXT NOT NULL,goal TEXT NOT NULL DEFAULT '',start_date TEXT NOT NULL,end_date TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('planned','active','completed')));
    CREATE TABLE IF NOT EXISTS modules(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,name TEXT NOT NULL,description TEXT NOT NULL DEFAULT '');
    CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,number INTEGER NOT NULL,title TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',status TEXT NOT NULL CHECK(status IN ('backlog','todo','doing','review','done','cancelled')),priority TEXT NOT NULL CHECK(priority IN ('urgent','high','medium','low','none')),assignee_id TEXT REFERENCES users(id),sprint_id TEXT REFERENCES sprints(id) ON DELETE SET NULL,module_id TEXT REFERENCES modules(id) ON DELETE SET NULL,parent_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,labels TEXT NOT NULL DEFAULT '[]',due_date TEXT,estimate INTEGER NOT NULL DEFAULT 0,version INTEGER NOT NULL DEFAULT 0,created_by TEXT NOT NULL REFERENCES users(id),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(project_id,number));
    CREATE TABLE IF NOT EXISTS comments(id TEXT PRIMARY KEY,task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id),body TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS activity(id INTEGER PRIMARY KEY AUTOINCREMENT,project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,task_id TEXT,user_id TEXT NOT NULL REFERENCES users(id),action TEXT NOT NULL,detail TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS pages(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,title TEXT NOT NULL,body TEXT NOT NULL DEFAULT '',version INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS views(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,name TEXT NOT NULL,filters TEXT NOT NULL DEFAULT '{}');
    CREATE TABLE IF NOT EXISTS attachments(id TEXT PRIMARY KEY,task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id),name TEXT NOT NULL,size INTEGER NOT NULL,content BLOB NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS links(id TEXT PRIMARY KEY,task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,target_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,type TEXT NOT NULL CHECK(type IN ('related','blocks')),UNIQUE(task_id,target_id,type),CHECK(task_id!=target_id));
    CREATE INDEX IF NOT EXISTS task_project ON tasks(project_id,status);
    CREATE INDEX IF NOT EXISTS session_expiry ON sessions(expires);
    CREATE UNIQUE INDEX IF NOT EXISTS one_active_sprint ON sprints(project_id) WHERE status='active';
    CREATE INDEX IF NOT EXISTS api_token_user ON api_tokens(user_id);
    CREATE TABLE IF NOT EXISTS password_resets(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,kind TEXT NOT NULL,actor_id TEXT REFERENCES users(id),read INTEGER NOT NULL DEFAULT 0,dedupe_key TEXT UNIQUE,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE INDEX IF NOT EXISTS notification_user ON notifications(user_id,read,created_at);
    CREATE TABLE IF NOT EXISTS sprint_history(sprint_id TEXT NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,day TEXT NOT NULL,scope_points INTEGER NOT NULL,remaining_points INTEGER NOT NULL,completed_items INTEGER NOT NULL,PRIMARY KEY(sprint_id,day));`);
  // Additive, idempotent migrations retain all existing work and user accounts.
  for (const [table, column, definition] of [
    ["tasks", "recurrence", "TEXT NOT NULL DEFAULT 'none'"],
    [
      "tasks",
      "recurrence_source_id",
      "TEXT REFERENCES tasks(id) ON DELETE SET NULL",
    ],
    ["sprints", "capacity", "INTEGER NOT NULL DEFAULT 0"],
  ]) {
    if (
      !db
        .prepare(`PRAGMA table_info(${table})`)
        .all()
        .some((c) => c.name === column)
    )
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
  db.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS task_recurrence_source ON tasks(recurrence_source_id) WHERE recurrence_source_id IS NOT NULL; PRAGMA user_version=3;",
  );
  return db;
}
export function transaction(db, fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
