import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readFileSync } from "node:fs";
const version = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
).version;

const uuid = z.string().uuid();
const name = z.string().trim().min(1).max(200);
const text = z.string().max(30000);
const role = z.enum(["admin", "member", "viewer"]);
const status = z.enum([
  "backlog",
  "todo",
  "doing",
  "review",
  "done",
  "cancelled",
]);
const priority = z.enum(["urgent", "high", "medium", "low", "none"]);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const paging = {
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
};
const taskFields = {
  title: name,
  description: text.optional(),
  status: status.optional(),
  priority: priority.optional(),
  assignee_id: uuid.nullable().optional(),
  sprint_id: uuid.nullable().optional(),
  module_id: uuid.nullable().optional(),
  parent_id: uuid.nullable().optional(),
  labels: z.array(z.string().min(1).max(40)).max(20).optional(),
  due_date: date.nullable().optional(),
  estimate: z.number().int().min(0).max(1000).optional(),
  recurrence: z.enum(["none", "daily", "weekly", "monthly"]).optional(),
};
const projectFields = {
  name,
  identifier: z.string().regex(/^[A-Z][A-Z0-9]{1,9}$/),
  description: text.optional(),
  color: z
    .string()
    .regex(/^#[A-Fa-f0-9]{6}$/)
    .optional(),
  archived: z.boolean().optional(),
  template: z.enum(["blank", "software", "campaign", "operations"]).optional(),
  locale: z.enum(["en", "fa", "ar", "zh-CN"]).optional(),
};
const sprintFields = {
  name,
  goal: text.optional(),
  start_date: date,
  end_date: date,
  status: z.enum(["planned", "active", "completed"]).optional(),
  capacity: z.number().int().min(0).max(100000).optional(),
};
const filterFields = {
  q: z.string().max(200).optional(),
  status: z.string().max(30).optional(),
  priority: z.string().max(30).optional(),
  assignee_id: z.string().max(40).optional(),
  sprint_id: z.string().max(40).optional(),
};
const resources = {
  modules: { name, description: text.optional() },
  pages: { title: name, body: text.optional() },
  views: { name, filters: z.object(filterFields).optional() },
};
const partial = (fields) =>
  Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.optional()]));
const page = (items, { limit, offset }) => ({
  items: items.slice(offset, offset + limit),
  total: items.length,
  offset,
  limit,
  has_more: offset + limit < items.length,
});

export function createMcpServer(api, identity) {
  const server = new McpServer(
    { name: "taskorbit", version },
    {
      instructions:
        "TaskOrbit is a self-hosted team work manager. Start with list_workspaces, list_projects and list_tasks. IDs are UUIDs. Read before editing tasks/pages and send the version you actually observed. Workspace permissions still apply. Destructive tools require explicit user intent. Never reveal credentials. A read-only token intentionally omits write tools.",
    },
  );
  const write = identity.scopes.includes("write");
  const admin = !!identity.user.admin && identity.scopes.includes("admin");
  function tool(
    key,
    description,
    fields,
    run,
    { mutating = false, destructive = false, adminOnly = false } = {},
  ) {
    if ((mutating && !write) || (adminOnly && !admin)) return;
    server.registerTool(
      key,
      {
        description,
        inputSchema: z.object(fields).strict(),
        annotations: {
          readOnlyHint: !mutating,
          destructiveHint: destructive,
          idempotentHint: !mutating,
          openWorldHint: false,
        },
      },
      async (args) => {
        try {
          const result = await run(args);
          const content = JSON.stringify(result);
          if (content.length > 1500000)
            throw Error(
              "Result too large. Use smaller pages or download the export from the application.",
            );
          return { content: [{ type: "text", text: content }] };
        } catch (e) {
          return {
            isError: true,
            content: [{ type: "text", text: e.message || "Request failed" }],
          };
        }
      },
    );
  }
  const list = (key, description, fields, path, transform) =>
    tool(key, description, { ...fields, ...paging }, async (a) =>
      page(
        transform ? transform(await api(path(a)), a) : await api(path(a)),
        a,
      ),
    );
  const mutate = (
    key,
    description,
    fields,
    path,
    method = "POST",
    body = (a) => a,
    destructive = false,
    adminOnly = false,
  ) =>
    tool(key, description, fields, (a) => api(path(a), method, body(a)), {
      mutating: true,
      destructive,
      adminOnly,
    });
  tool(
    "who_am_i",
    "Read the authenticated user, token scopes and expiration.",
    {},
    () => api("/me/token-info"),
  );
  tool("server_info", "Read server health and TaskOrbit version.", {}, () =>
    api("/health"),
  );
  list(
    "list_workspaces",
    "List workspaces accessible to this token's user.",
    {},
    () => "/workspaces",
  );
  mutate(
    "create_workspace",
    "Create a workspace. Requires an instance admin token.",
    { name },
    () => "/workspaces",
    "POST",
    (a) => a,
    false,
    true,
  );
  list(
    "list_projects",
    "List projects in a workspace.",
    { workspace_id: uuid },
    (a) => `/workspaces/${a.workspace_id}/projects`,
  );
  mutate(
    "create_project",
    "Create a project. Requires workspace management permission.",
    { workspace_id: uuid, ...projectFields },
    (a) => `/workspaces/${a.workspace_id}/projects`,
    "POST",
    ({ workspace_id, ...v }) => v,
  );
  mutate(
    "update_project",
    "Update project metadata, archive or restore a project. Supply every required field.",
    {
      project_id: uuid,
      ...projectFields,
      description: text,
      color: z.string().regex(/^#[A-Fa-f0-9]{6}$/),
      archived: z.boolean(),
    },
    (a) => `/projects/${a.project_id}`,
    "PUT",
    ({ project_id, ...v }) => v,
  );
  list(
    "list_members",
    "List active/inactive workspace members and roles.",
    { workspace_id: uuid },
    (a) => `/workspaces/${a.workspace_id}/members`,
  );
  mutate(
    "add_member",
    "Add an existing active user to a workspace by email. Requires workspace admin.",
    { workspace_id: uuid, email: z.string().email(), role },
    (a) => `/workspaces/${a.workspace_id}/members`,
    "POST",
    ({ workspace_id, ...v }) => v,
  );
  mutate(
    "set_member_role",
    "Set a member's role. Requires workspace admin.",
    { workspace_id: uuid, user_id: uuid, role },
    (a) => `/workspaces/${a.workspace_id}/members/${a.user_id}`,
    "PUT",
    (a) => ({ role: a.role }),
  );
  mutate(
    "remove_member",
    "Remove a member and clear their task assignments. Requires workspace admin.",
    { workspace_id: uuid, user_id: uuid },
    (a) => `/workspaces/${a.workspace_id}/members/${a.user_id}`,
    "DELETE",
    () => undefined,
    true,
  );
  list(
    "list_tasks",
    "List/filter work items, including subtasks, estimates and versions. Pages are bounded.",
    {
      project_id: uuid,
      q: z.string().max(200).optional(),
      status: status.optional(),
      priority: priority.optional(),
      assignee_id: uuid.nullable().optional(),
      sprint_id: uuid.nullable().optional(),
      module_id: uuid.nullable().optional(),
      parent_id: uuid.nullable().optional(),
    },
    (a) => `/projects/${a.project_id}/tasks`,
    (items, a) =>
      items.filter(
        (t) =>
          (!a.q ||
            `${t.title} ${t.description}`
              .toLowerCase()
              .includes(a.q.toLowerCase())) &&
          [
            "status",
            "priority",
            "assignee_id",
            "sprint_id",
            "module_id",
            "parent_id",
          ].every((k) => a[k] === undefined || a[k] === t[k]),
      ),
  );
  tool(
    "get_task",
    "Read one work item and its current version before editing.",
    { task_id: uuid },
    (a) => api(`/tasks/${a.task_id}`),
  );
  mutate(
    "create_task",
    "Create a work item or subtask; references must belong to this project.",
    { project_id: uuid, ...taskFields },
    (a) => `/projects/${a.project_id}/tasks`,
    "POST",
    ({ project_id, ...v }) => v,
  );
  tool(
    "update_task",
    "Update selected fields. version must be the version previously read; conflicts return HTTP 409 without overwriting.",
    { task_id: uuid, version: z.number().int().min(0), ...partial(taskFields) },
    async ({ task_id, version, ...changes }) => {
      const current = await api(`/tasks/${task_id}`);
      return api(`/tasks/${task_id}`, "PUT", {
        ...current,
        ...changes,
        version,
      });
    },
    { mutating: true },
  );
  mutate(
    "delete_task",
    "Permanently delete a task and its subtasks, comments and files. Requires workspace admin.",
    { task_id: uuid },
    (a) => `/tasks/${a.task_id}`,
    "DELETE",
    () => undefined,
    true,
  );
  list(
    "list_sprints",
    "List project sprints.",
    { project_id: uuid },
    (a) => `/projects/${a.project_id}/sprints`,
  );
  mutate(
    "create_sprint",
    "Create a sprint; only one active sprint per project.",
    { project_id: uuid, ...sprintFields },
    (a) => `/projects/${a.project_id}/sprints`,
    "POST",
    ({ project_id, ...v }) => v,
  );
  mutate(
    "update_sprint",
    "Update sprint metadata or complete it. Supply all required fields.",
    {
      sprint_id: uuid,
      ...sprintFields,
      goal: text,
      status: z.enum(["planned", "active", "completed"]),
    },
    (a) => `/sprints/${a.sprint_id}`,
    "PUT",
    ({ sprint_id, ...v }) => v,
  );
  for (const [resource, fields] of Object.entries(resources)) {
    const singular = resource.slice(0, -1);
    list(
      `list_${resource}`,
      `List project ${resource}${resource === "pages" ? " with current versions" : ""}.`,
      { project_id: uuid },
      (a) => `/projects/${a.project_id}/${resource}`,
    );
    mutate(
      `create_${singular}`,
      `Create a project ${singular}.`,
      { project_id: uuid, ...fields },
      (a) => `/projects/${a.project_id}/${resource}`,
      "POST",
      ({ project_id, ...v }) => v,
    );
    mutate(
      `update_${singular}`,
      `Update a ${singular}.${resource === "pages" ? " Supply the version previously read; stale writes return 409." : " Supply all required fields."}`,
      {
        id: uuid,
        ...fields,
        ...(resource === "modules"
          ? { description: text }
          : resource === "pages"
            ? { body: text }
            : { filters: z.object(filterFields) }),
        ...(resource === "pages" ? { version: z.number().int().min(0) } : {}),
      },
      (a) => `/${resource}/${a.id}`,
      "PUT",
      ({ id, ...v }) => v,
    );
    mutate(
      `delete_${singular}`,
      `Permanently delete a ${singular}. Requires workspace admin.`,
      { id: uuid },
      (a) => `/${resource}/${a.id}`,
      "DELETE",
      () => undefined,
      true,
    );
  }
  list(
    "list_comments",
    "List task comments.",
    { task_id: uuid },
    (a) => `/tasks/${a.task_id}/comments`,
  );
  mutate(
    "add_comment",
    "Add a comment to a work item.",
    { task_id: uuid, body: z.string().trim().min(1).max(10000) },
    (a) => `/tasks/${a.task_id}/comments`,
    "POST",
    (a) => ({ body: a.body }),
  );
  list(
    "list_activity",
    "Read the latest 200 project activity records.",
    { project_id: uuid },
    (a) => `/projects/${a.project_id}/activity`,
  );
  list(
    "list_attachments",
    "List task file metadata; use download_attachment to read contents.",
    { task_id: uuid },
    (a) => `/tasks/${a.task_id}/attachments`,
  );
  tool(
    "download_attachment",
    "Download a file chunk as base64 (default 64 KiB; maximum 1 MiB per call). Advance offset until has_more is false to read a larger file.",
    {
      attachment_id: uuid,
      offset: z.number().int().min(0).default(0),
      max_bytes: z
        .number()
        .int()
        .min(1)
        .max(1024 * 1024)
        .default(65536),
    },
    async (a) => {
      const data = await api(
        `/attachments/${a.attachment_id}`,
        "GET",
        undefined,
        true,
      );
      const chunk = data.subarray(a.offset, a.offset + a.max_bytes);
      return {
        size: data.length,
        offset: a.offset,
        bytes: chunk.length,
        has_more: a.offset + chunk.length < data.length,
        base64: chunk.toString("base64"),
      };
    },
  );
  tool(
    "upload_attachment",
    "Attach a nonempty file up to 10 MiB to a task. Contents must be canonical base64.",
    {
      task_id: uuid,
      name: z
        .string()
        .min(1)
        .max(180)
        .refine((s) => !/[\x00-\x1f\x7f/\\]/.test(s)),
      base64: z.string().max(14 * 1024 * 1024),
    },
    async (a) => {
      const data = Buffer.from(a.base64, "base64");
      if (
        !data.length ||
        data.length > 10 * 1024 * 1024 ||
        data.toString("base64") !== a.base64
      )
        throw Error("Use canonical base64 for a nonempty file up to 10 MiB");
      return api(`/tasks/${a.task_id}/attachments`, "POST", data, false, {
        "X-File-Name": encodeURIComponent(a.name),
      });
    },
    { mutating: true },
  );
  mutate(
    "delete_attachment",
    "Permanently remove a file. Requires its author or workspace admin.",
    { attachment_id: uuid },
    (a) => `/attachments/${a.attachment_id}`,
    "DELETE",
    () => undefined,
    true,
  );
  list(
    "list_links",
    "List task relations and blocking dependencies.",
    { task_id: uuid },
    (a) => `/tasks/${a.task_id}/links`,
  );
  mutate(
    "create_link",
    "Relate or block another task in the same project. Cycles are rejected.",
    { task_id: uuid, target_id: uuid, type: z.enum(["related", "blocks"]) },
    (a) => `/tasks/${a.task_id}/links`,
    "POST",
    ({ task_id, ...v }) => v,
  );
  mutate(
    "delete_link",
    "Remove a relation or dependency.",
    { link_id: uuid },
    (a) => `/links/${a.link_id}`,
    "DELETE",
    () => undefined,
    true,
  );
  tool(
    "list_users",
    "List instance accounts. Requires admin scope and instance admin role.",
    paging,
    async (a) => page(await api("/admin/users"), a),
    { adminOnly: true },
  );
  mutate(
    "create_user",
    "Create an instance account. The provided password is sent only to your TaskOrbit server.",
    {
      name,
      email: z.string().email(),
      password: z.string().min(12).max(128),
      admin: z.boolean().default(false),
    },
    () => "/admin/users",
    "POST",
    (a) => a,
    false,
    true,
  );
  mutate(
    "update_user",
    "Rename, activate/deactivate, promote/demote or reset an account password. Deactivation/reset revokes sessions and tokens.",
    {
      user_id: uuid,
      name: name.optional(),
      active: z.boolean().optional(),
      admin: z.boolean().optional(),
      password: z.string().min(12).max(128).optional(),
    },
    (a) => `/admin/users/${a.user_id}`,
    "PATCH",
    ({ user_id, ...v }) => v,
    true,
    true,
  );
  tool(
    "export_data",
    "Read a JSON work-data export (no passwords, sessions or API tokens; files excluded). Requires admin scope.",
    {},
    () => api("/admin/export"),
    { adminOnly: true },
  );
  tool(
    "check_server_update",
    "Check the current eligible server release. Requires admin scope.",
    {},
    () => api("/admin/updates"),
    { adminOnly: true },
  );
  tool(
    "server_update_status",
    "Read server upgrade progress. Requires admin scope.",
    {},
    () => api("/admin/updates/status"),
    { adminOnly: true },
  );
  mutate(
    "start_server_update",
    "Start a backed-up server upgrade to the version just returned by check_server_update. Requires admin+write scope and configured upgrade service; obtain explicit user approval first.",
    { version: z.string().regex(/^\d+\.\d+\.\d+$/) },
    () => "/admin/updates",
    "POST",
    (a) => a,
    true,
    true,
  );
  server.registerPrompt(
    "getting_started",
    {
      description:
        "Discover your workspaces and safely plan work in TaskOrbit.",
    },
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "Use who_am_i and list_workspaces, then list_projects and list_tasks for the workspace I choose. Summarize priorities and sprint progress. Ask before destructive changes. Read current versions before editing; explain any permission error.",
          },
        },
      ],
    }),
  );
  return server;
}
