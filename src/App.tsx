import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { isTauri, invoke } from "@tauri-apps/api/core";
import { version as appVersion } from "../package.json";
import { Updates, WebUpdateNotice } from "./components/updates";
import { EntryShell } from "./components/entry-shell";
import { PasswordRecovery } from "./components/password-recovery";
import {
  GlobalSearch,
  Inbox,
  BulkActions,
  SprintReportButton,
  ProjectTransfer,
  RecurrenceBadge,
  type SearchResult,
} from "./components/workflow-tools";
import { workflowMessages } from "./lib/workflow-i18n";
import { McpIntegrations } from "./components/mcp-integrations";
import { useRealtime, type LiveChange } from "./lib/realtime";
import {
  LayoutDashboard,
  Layers,
  CheckCheck,
  Orbit,
  BookOpen,
  Users,
  Settings,
  Shield,
  Plus,
  Search,
  LayoutGrid,
  List,
  CalendarDays,
  Menu,
  X,
  LogOut,
  Sun,
  Moon,
  ArrowUpRight,
  ChevronRight,
  MoreHorizontal,
  RefreshCw,
  MessageSquare,
  ArrowRight,
  Filter,
  Download,
  Clock,
  Activity as ActivityIcon,
  Archive,
  Trash2,
  Eye,
  EyeOff,
  LoaderCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { TaskExtras } from "@/components/task-extras";
import {
  messages,
  localeNames,
  resolveLocale,
  localeDirection,
  dateLocales,
  type Locale,
  type MessageKey,
} from "./lib/i18n";
import {
  api,
  ApiError,
  type User,
  type Workspace,
  type Project,
  type Task,
  type Sprint,
  type Module,
  type Page,
  type View,
  type Activity,
  type Comment,
  type Filters,
} from "./lib/api";

type Section =
  | "overview"
  | "tasks"
  | "sprints"
  | "modules"
  | "pages"
  | "activity"
  | "members"
  | "admin"
  | "settings";
type Editor = {
  kind:
    | "task"
    | "project"
    | "sprint"
    | "module"
    | "page"
    | "user"
    | "workspace"
    | "view"
    | "password"
    | "member";
  data: Record<string, unknown>;
  isNew: boolean;
};
type Option = { id: string; name: string };
const statuses = ["backlog", "todo", "doing", "review", "done", "cancelled"],
  priorities = ["urgent", "high", "medium", "low", "none"];
const blankFilters: Filters = {
  q: "",
  status: "",
  priority: "",
  assignee_id: "",
  sprint_id: "",
};
const today = () => new Date().toISOString().slice(0, 10);
const isLocalClient = () =>
  isTauri() &&
  (location.protocol === "tauri:" ||
    location.hostname === "tauri.localhost" ||
    (["localhost", "127.0.0.1"].includes(location.hostname) &&
      location.port === "5173"));
const blankTask = {
  title: "",
  description: "",
  status: "todo",
  priority: "medium",
  assignee_id: null,
  sprint_id: null,
  module_id: null,
  parent_id: null,
  labels: [],
  due_date: null,
  estimate: 0,
  recurrence: "none",
};
function Picker({
  value,
  onChange,
  options,
  label,
  empty,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  label: string;
  empty?: string;
}) {
  return (
    <Select
      value={value || "__none"}
      onValueChange={(v) => onChange(v === "__none" ? "" : v)}
    >
      <SelectTrigger aria-label={label} className="w-full">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {empty && <SelectItem value="__none">{empty}</SelectItem>}
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
function Logo() {
  return (
    <div className="brand">
      <img
        className="brand-light"
        src="/wordmark-light.png"
        alt="TaskOrbit"
        onError={(e) => {
          e.currentTarget.onerror = null;
          e.currentTarget.src = "/icon.png";
        }}
      />
      <img className="brand-dark" src="/wordmark-dark.png" alt="TaskOrbit" />
    </div>
  );
}

export default function App() {
  const [locale, setLocale] = useState<Locale>(() =>
    resolveLocale(localStorage.getItem("taskorbit.locale")),
  );
  const [dark, setDark] = useState(
    () => localStorage.getItem("taskorbit.theme") === "dark",
  );
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [pendingTask, setPendingTask] = useState("");
  const [pendingResource, setPendingResource] = useState("");
  const [resetToken] = useState(
    () => new URLSearchParams(location.search).get("reset") || "",
  );
  const [recovery, setRecovery] = useState(() =>
    resetToken ? "reset" : "none",
  );
  const t = useCallback(
    (key: string): string =>
      messages[locale][key as MessageKey] ||
      workflowMessages[locale][key] ||
      key,
    [locale],
  );
  const [user, setUser] = useState<User | null>(null),
    [setup, setSetup] = useState(false),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]),
    [wid, setWid] = useState(""),
    [projects, setProjects] = useState<Project[]>([]),
    [pid, setPid] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]),
    [sprints, setSprints] = useState<Sprint[]>([]),
    [modules, setModules] = useState<Module[]>([]),
    [pages, setPages] = useState<Page[]>([]),
    [views, setViews] = useState<View[]>([]),
    [activities, setActivities] = useState<Activity[]>([]),
    [members, setMembers] = useState<User[]>([]),
    [users, setUsers] = useState<User[]>([]);
  const [section, setSection] = useState<Section>("overview"),
    [mode, setMode] = useState<"board" | "list" | "timeline">("board"),
    [filters, setFilters] = useState<Filters>(blankFilters),
    [mobile, setMobile] = useState(false),
    [editor, setEditor] = useState<Editor | null>(null),
    [deletion, setDeletion] = useState<{
      url: string;
      after?: () => void;
    } | null>(null),
    [detail, setDetail] = useState<Task | null>(null),
    [comments, setComments] = useState<Comment[]>([]),
    [comment, setComment] = useState("");
  const [serverUrl, setServerUrl] = useState(
      localStorage.getItem("taskorbit.server") || "",
    ),
    [connection] = useState(isLocalClient()),
    [rememberedServer, setRememberedServer] = useState(""),
    [authForm, setAuthForm] = useState({
      name: "",
      email: "",
      password: "",
      workspace: "",
    });
  useEffect(() => {
    let active = true;
    if (connection) {
      invoke<string>("saved_server")
        .then(async (saved) => {
          if (!active) return;
          setServerUrl(saved);
          setRememberedServer(saved);
          const firstEntry = await invoke<boolean>("should_resume");
          if (!active) return;
          if (
            saved &&
            firstEntry &&
            new URLSearchParams(location.search).get("settings") !== "1"
          ) {
            setBusy(true);
            try {
              await invoke("resume_server");
            } catch (error) {
              if (active)
                showError(typeof error === "string" ? new Error(error) : error);
            } finally {
              if (active) setBusy(false);
            }
          }
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [connection]);
  const searchRef = useRef<HTMLInputElement>(null);
  const selection = useRef({ wid, pid, detailId: detail?.id });
  selection.current = { wid, pid, detailId: detail?.id };
  const projectRequest = useRef(0),
    workspaceRequest = useRef(0);
  const projectVersions = useRef<Record<string, number>>({});
  const [liveRevision, setLiveRevision] = useState(0);
  const project = projects.find((p) => p.id === pid),
    workspace = workspaces.find((w) => w.id === wid),
    canManage = !!user?.admin || workspace?.role === "admin",
    canWrite =
      !!user?.admin ||
      workspace?.role === "admin" ||
      workspace?.role === "member";
  const writable = canWrite && !project?.archived;
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = localeDirection(locale);
    document.title = `TaskOrbit | ${t("projects")} · ${t("tasks")}`;
    localStorage.setItem("taskorbit.locale", locale);
  }, [locale]);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("taskorbit.theme", dark ? "dark" : "light");
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", dark ? "#171615" : "#f6f4f0");
  }, [dark]);
  function showError(e: unknown) {
    if (e instanceof ApiError) {
      if (e.status === 401 && user) {
        setUser(null);
        setError(t("sessionExpired"));
      } else if (e.message === "Invalid email or password")
        setError(t("invalidCredentials"));
      else if (e.message === "Origin not allowed") setError(t("originError"));
      else if (e.message === "Recurring tasks need a due date")
        setError(t("recurrenceHint"));
      else
        setError(
          e.status === 0
            ? t("networkError")
            : e.status === 409
              ? t("conflict")
              : locale === "en"
                ? e.message
                : t("saveError") + " (" + e.message + ")",
        );
    } else setError(e instanceof Error ? e.message : t("error"));
  }
  const loadWorkspaces = useCallback(async () => {
    const ws = await api<Workspace[]>("/workspaces");
    setWorkspaces(ws);
    setWid((old) => (ws.some((w) => w.id === old) ? old : ws[0]?.id || ""));
  }, []);
  const loadProject = useCallback(
    async (resources?: Set<string>) => {
      const sequence = ++projectRequest.current;
      for (const resource of [
        "tasks",
        "sprints",
        "modules",
        "pages",
        "views",
        "activity",
      ]) {
        if (!resources || resources.has(resource) || resource === "activity")
          projectVersions.current[resource] = sequence;
      }
      if (!pid) {
        setTasks([]);
        setSprints([]);
        setModules([]);
        setPages([]);
        setViews([]);
        setActivities([]);
        return;
      }
      const [ts, ss, ms, ps, vs, as] = await Promise.all([
        !resources || resources.has("tasks")
          ? api<Task[]>(`/projects/${pid}/tasks`)
          : null,
        !resources || resources.has("sprints")
          ? api<Sprint[]>(`/projects/${pid}/sprints`)
          : null,
        !resources || resources.has("modules")
          ? api<Module[]>(`/projects/${pid}/modules`)
          : null,
        !resources || resources.has("pages")
          ? api<Page[]>(`/projects/${pid}/pages`)
          : null,
        !resources || resources.has("views")
          ? api<View[]>(`/projects/${pid}/views`)
          : null,
        api<Activity[]>(`/projects/${pid}/activity`),
      ]);
      if (selection.current.pid !== pid) return;
      if (ts && projectVersions.current.tasks === sequence) setTasks(ts);
      if (ss && projectVersions.current.sprints === sequence) setSprints(ss);
      if (ms && projectVersions.current.modules === sequence) setModules(ms);
      if (ps && projectVersions.current.pages === sequence) setPages(ps);
      if (vs && projectVersions.current.views === sequence) setViews(vs);
      if (projectVersions.current.activity === sequence) setActivities(as);
      if (ts && projectVersions.current.tasks === sequence)
        setDetail((old) =>
          old ? ts.find((task) => task.id === old.id) || null : null,
        );
    },
    [pid],
  );
  const loadWorkspace = useCallback(async () => {
    const sequence = ++workspaceRequest.current;
    if (!wid) {
      setProjects([]);
      setMembers([]);
      return;
    }
    const [ps, ms] = await Promise.all([
      api<Project[]>(`/workspaces/${wid}/projects`),
      api<User[]>(`/workspaces/${wid}/members`),
    ]);
    if (sequence !== workspaceRequest.current || selection.current.wid !== wid)
      return;
    setProjects(ps);
    setMembers(ms);
    setPid((old) =>
      ps.some((p) => p.id === old)
        ? old
        : ps.find((p) => !p.archived)?.id || ps[0]?.id || "",
    );
  }, [wid]);
  useEffect(() => {
    if (connection) {
      setReady(true);
      return;
    }
    let active = true;
    (async () => {
      try {
        const s = await api<{ required: boolean }>("/setup");
        if (!active) return;
        setSetup(s.required);
        if (!s.required) {
          try {
            setUser(await api<User>("/me"));
          } catch (e) {
            if (!(e instanceof ApiError) || e.status !== 401) throw e;
          }
        }
      } catch (e) {
        if (active) showError(e);
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [connection]);
  useEffect(() => {
    if (user) loadWorkspaces().catch(showError);
  }, [user?.id, loadWorkspaces]);
  useEffect(() => {
    if (user) loadWorkspace().catch(showError);
    setFilters(blankFilters);
  }, [wid, user?.id, loadWorkspace]);
  useEffect(() => {
    if (user) loadProject().catch(showError);
    setDetail(null);
    setFilters(blankFilters);
  }, [pid, user?.id, loadProject]);
  async function refreshLive(changes: LiveChange[] | null) {
    setLiveRevision((v) => v + 1);
    const access =
      !changes ||
      changes.some(
        (change) => change.kind === "access" || change.kind === "workspace",
      );
    if (access) {
      const me = await api<User>("/me");
      setUser(me);
      const ws = await api<Workspace[]>("/workspaces");
      setWorkspaces(ws);
      if (!ws.some((w) => w.id === selection.current.wid)) {
        setWid(ws[0]?.id || "");
        setPid("");
        setProjects([]);
        setMembers([]);
        setTasks([]);
        setSprints([]);
        setModules([]);
        setPages([]);
        setViews([]);
        setActivities([]);
        setDetail(null);
        setEditor(null);
        setDeletion(null);
        setUsers([]);
        return;
      }
      if (me.admin && (section === "admin" || section === "members"))
        setUsers(await api<User[]>("/admin/users"));
      else if (!me.admin) setUsers([]);
    }
    if (
      access ||
      changes?.some(
        (change) =>
          change.workspace_id === wid && change.resource === "projects",
      )
    )
      await loadWorkspace();
    if (
      access ||
      changes?.some(
        (change) =>
          change.project_id === pid ||
          (change.kind === "workspace" && change.workspace_id === wid),
      )
    ) {
      const relevant =
        changes?.filter((change) => change.project_id === pid) || [];
      const partial =
        !access &&
        relevant.every(
          (change) => change.resource && change.resource !== "projects",
        );
      const resources = new Set(relevant.map((change) => change.resource!));
      // Removing a module/sprint also clears task references through SQLite foreign keys.
      if (resources.has("modules") || resources.has("sprints"))
        resources.add("tasks");
      await loadProject(partial ? resources : undefined);
      const id = selection.current.detailId;
      if (
        id &&
        (access ||
          relevant.some(
            (change) =>
              change.resource === "comments" || change.resource === "tasks",
          ))
      ) {
        const updated = await api<Comment[]>(`/tasks/${id}/comments`).catch(
          (e) => {
            if (e instanceof ApiError && e.status === 404) return [];
            throw e;
          },
        );
        if (selection.current.detailId === id) setComments(updated);
      }
    }
  }
  useRealtime(!!user && !connection, refreshLive, async () => {
    try {
      await api<User>("/me");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setUser(null);
        setDetail(null);
        setEditor(null);
        setError(t("sessionExpired"));
      }
    }
  });
  useEffect(() => {
    if (user?.admin && (section === "admin" || section === "members"))
      api<User[]>("/admin/users").then(setUsers).catch(showError);
  }, [section, user?.admin]);
  useEffect(() => {
    if (!detail) {
      setComments([]);
      return;
    }
    api<Comment[]>(`/tasks/${detail.id}/comments`)
      .then(setComments)
      .catch(showError);
    setComment("");
  }, [detail?.id]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        user &&
        !editor &&
        !detail &&
        (e.metaKey || e.ctrlKey) &&
        e.key.toLowerCase() === "k"
      ) {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
      if (
        e.key === "n" &&
        !document.querySelector('[role="dialog"]') &&
        !(
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement
        ) &&
        !editor &&
        !detail &&
        writable &&
        pid
      ) {
        setEditor({ kind: "task", isNew: true, data: { ...blankTask } });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editor, detail, writable, pid, user?.id]);
  useEffect(() => {
    if (!pendingTask) return;
    const found = tasks.find(
      (item) => item.id === pendingTask && item.project_id === pid,
    );
    if (found) {
      setDetail(found);
      setPendingTask("");
    }
  }, [tasks, pendingTask, pid]);
  useEffect(() => {
    if (!pendingResource) return;
    const node = document.getElementById(`resource-${pendingResource}`);
    if (node) {
      node.scrollIntoView({ block: "center" });
      node.focus({ preventScroll: true });
      setPendingResource("");
    }
  }, [pendingResource, pages, sprints, section]);
  function navigateResult(result: SearchResult) {
    setError("");
    setDetail(null);
    setEditor(null);
    setWid(result.workspace_id);
    setPid(result.project_id);
    setMobile(false);
    setSection(
      result.kind === "sprint"
        ? "sprints"
        : result.kind === "page"
          ? "pages"
          : result.kind === "project"
            ? "overview"
            : "tasks",
    );
    setPendingTask(result.kind === "task" ? result.id : "");
    setPendingResource(
      ["page", "sprint"].includes(result.kind) ? result.id : "",
    );
  }
  async function refresh() {
    setBusy(true);
    try {
      await loadWorkspace();
      await loadProject();
      if (user?.admin) setUsers(await api<User[]>("/admin/users"));
      setError("");
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  }
  async function signIn(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      setUser(await api<User>(setup ? "/setup" : "/login", "POST", authForm));
      setAuthForm((form) => ({ ...form, password: "" }));
      setPasswordVisible(false);
      setSetup(false);
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  }
  async function signOut() {
    try {
      await api("/logout", "POST");
      setAuthForm((form) => ({ ...form, password: "" }));
      setPasswordVisible(false);
      setUser(null);
      setSearchOpen(false);
      setPendingTask("");
      setPendingResource("");
      setDetail(null);
      setEditor(null);
      setTasks([]);
      setProjects([]);
      setWorkspaces([]);
      setWid("");
      setPid("");
    } catch (e) {
      showError(e);
    }
  }
  const optionList = (values: string[]) =>
    values.map((id) => ({ id, name: t(id) }));
  const filtered = tasks.filter(
    (task) =>
      (!filters.q ||
        `${task.title} ${task.description} ${project?.identifier}-${task.number} ${task.labels.join(" ")}`
          .toLowerCase()
          .includes(filters.q.toLowerCase())) &&
      (!filters.status || task.status === filters.status) &&
      (!filters.priority || task.priority === filters.priority) &&
      (!filters.assignee_id || task.assignee_id === filters.assignee_id) &&
      (!filters.sprint_id || task.sprint_id === filters.sprint_id),
  );
  const complete = tasks.filter((x) => x.status === "done").length,
    percent = tasks.length ? Math.round((complete / tasks.length) * 100) : 0,
    activeSprint = sprints.find((s) => s.status === "active");
  const overdue = tasks.filter(
    (x) =>
      x.due_date &&
      x.due_date < today() &&
      !["done", "cancelled"].includes(x.status),
  );
  const formatDate = (d: string | null) =>
    d
      ? new Intl.DateTimeFormat(dateLocales[locale], {
          dateStyle: "medium",
        }).format(
          new Date(
            d.includes("T")
              ? d
              : d.length === 10
                ? d + "T12:00:00"
                : d.replace(" ", "T") + "Z",
          ),
        )
      : t("noDeadline");
  const open = (
    kind: Editor["kind"],
    data: Record<string, unknown> = {},
    isNew = true,
  ) => {
    setError("");
    setEditor({ kind, data, isNew });
  };
  async function saveEditor(e: FormEvent) {
    e.preventDefault();
    if (!editor) return;
    setBusy(true);
    setError("");
    const { kind, data, isNew } = editor;
    let url = "",
      method = isNew ? "POST" : "PUT",
      body = { ...data };
    try {
      if (kind === "task") {
        url = isNew ? `/projects/${pid}/tasks` : `/tasks/${data.id}`;
        body = {
          ...data,
          estimate: Number(data.estimate || 0),
          labels:
            typeof data.labels === "string"
              ? data.labels
                  .split(/[,،]/)
                  .map((x) => x.trim())
                  .filter(Boolean)
              : data.labels || [],
          assignee_id: data.assignee_id || null,
          sprint_id: data.sprint_id || null,
          module_id: data.module_id || null,
          parent_id: data.parent_id || null,
          due_date: data.due_date || null,
        };
      }
      if (kind === "project") {
        url = isNew ? `/workspaces/${wid}/projects` : `/projects/${data.id}`;
        body = { ...data, archived: !!data.archived, locale };
      }
      if (kind === "sprint") {
        url = isNew ? `/projects/${pid}/sprints` : `/sprints/${data.id}`;
        body = { ...data, capacity: Number(data.capacity || 0) };
      }
      if (kind === "module" || kind === "page" || kind === "view") {
        const resource =
          kind === "module" ? "modules" : kind === "page" ? "pages" : "views";
        url = isNew
          ? `/projects/${pid}/${resource}`
          : `/${resource}/${data.id}`;
      }
      if (kind === "user") {
        url = isNew ? "/admin/users" : `/admin/users/${data.id}`;
        method = isNew ? "POST" : "PATCH";
        if (!isNew) {
          body = {
            name: data.name,
            admin: !!data.admin,
            active: !!data.active,
            ...(data.password ? { password: data.password } : {}),
          };
        }
      }
      if (kind === "workspace") url = "/workspaces";
      if (kind === "member") {
        url = isNew
          ? `/workspaces/${wid}/members`
          : `/workspaces/${wid}/members/${data.user_id}`;
        method = isNew ? "POST" : "PUT";
        body = isNew
          ? { email: data.email, role: data.role }
          : { role: data.role };
      }
      if (kind === "password") {
        url = "/me/password";
        method = "PUT";
      }
      const result = await api<Record<string, unknown>>(url, method, body);
      setEditor(null);
      if (kind === "password") {
        setUser(null);
        setError(t("passwordChanged"));
        return;
      }
      if (kind === "task" && detail && detail.id === data.id)
        setDetail(result as unknown as Task);
      if (kind === "workspace") {
        await loadWorkspaces();
        setWid(result.id as string);
      } else if (kind === "project") {
        await loadWorkspace();
        setPid(result.id as string);
      } else if (kind === "user") {
        setUsers(await api<User[]>("/admin/users"));
        await loadWorkspace();
      } else if (kind === "member") await loadWorkspace();
      else await loadProject();
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  }
  async function moveTask(task: Task, status: string) {
    if (!writable || task.status === status) return;
    try {
      await api(`/tasks/${task.id}`, "PUT", { ...task, status });
      await loadProject();
    } catch (e) {
      showError(e);
      await loadProject().catch(() => {});
    }
  }
  async function sendComment(e: FormEvent) {
    e.preventDefault();
    if (!detail || !comment.trim()) return;
    setBusy(true);
    try {
      await api(`/tasks/${detail.id}/comments`, "POST", { body: comment });
      setComments(await api<Comment[]>(`/tasks/${detail.id}/comments`));
      setComment("");
      await loadProject();
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  }
  async function doDelete() {
    if (!deletion) return;
    setBusy(true);
    try {
      await api(deletion.url, "DELETE");
      deletion.after?.();
      setDeletion(null);
      await loadProject();
      await loadWorkspace();
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  }
  const newTask = (overrides: Record<string, unknown> = {}) =>
    open("task", { ...blankTask, ...overrides });
  const newSprint = () =>
    open("sprint", {
      name: "",
      goal: "",
      start_date: today(),
      end_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      status: "planned",
      capacity: 0,
    });
  const empty = (title: string, hint?: string, action?: ReactNode) => (
    <div className="empty">
      {[t("projectHint"), t("noTasks")].includes(title) ? (
        <img
          className="empty-orbit"
          src="/onboarding-orbit.webp"
          alt=""
          width={144}
          height={144}
        />
      ) : (
        <Orbit size={38} />
      )}
      <h3>{title}</h3>
      {(hint || title === t("projectHint")) && (
        <p>{hint || t("gettingStartedHint")}</p>
      )}
      {action}
    </div>
  );
  const issueTag = (task: Task) => (
    <span className="issue-id">
      {project?.identifier}-{task.number}
    </span>
  );
  const statusBadge = (status: string) => (
    <Badge variant="outline" className={`status status-${status}`}>
      <span className="status-dot" />
      {t(status)}
    </Badge>
  );
  const taskCard = (task: Task) => (
    <article
      key={task.id}
      className="task-card"
      draggable={writable}
      onDragStart={(e) => e.dataTransfer.setData("text/taskorbit", task.id)}
    >
      <button
        className="task-open"
        onClick={() => {
          setDetail(task);
          setError("");
        }}
      >
        {issueTag(task)}
        <h3>{task.title}</h3>
      </button>
      {task.labels.length > 0 && (
        <div className="labels">
          {task.labels.map((l) => (
            <Badge key={l} variant="secondary">
              {l}
            </Badge>
          ))}
        </div>
      )}
      <div className="task-meta">
        <RecurrenceBadge task={task} locale={locale} />
        <span className={`priority priority-${task.priority}`}>
          <span /> {t(task.priority)}
        </span>
        <span className="meta-end">
          {task.estimate > 0 && (
            <span>
              {task.estimate} {t("points")}
            </span>
          )}
          {task.due_date && (
            <span
              className={overdue.some((o) => o.id === task.id) ? "overdue" : ""}
            >
              <Clock size={12} />
              {formatDate(task.due_date)}
            </span>
          )}
          <span
            className="avatar"
            title={
              members.find((m) => m.id === task.assignee_id)?.name ||
              t("unassigned")
            }
          >
            {members.find((m) => m.id === task.assignee_id)?.name.slice(0, 1) ||
              "–"}
          </span>
        </span>
      </div>
    </article>
  );
  const errorBanner = error && (
    <div
      role="alert"
      id={!user || connection ? "entry-error" : undefined}
      className="error-banner"
    >
      <span>{error}</span>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("close")}
        onClick={() => setError("")}
      >
        <X size={16} />
      </Button>
    </div>
  );
  const languageControl = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={t("language")}>
          {localeNames[locale]}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(Object.keys(localeNames) as Locale[]).map((language) => (
          <DropdownMenuItem
            key={language}
            lang={language}
            dir={localeDirection(language)}
            onSelect={() => setLocale(language)}
          >
            {localeNames[language]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
  const themeControl = (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t(dark ? "light" : "dark")}
      onClick={() => setDark(!dark)}
    >
      {dark ? <Sun size={17} /> : <Moon size={17} />}
    </Button>
  );
  const entryControls = (
    <>
      {languageControl}
      {themeControl}
    </>
  );
  if (!ready)
    return (
      <EntryShell
        brand={<Logo />}
        controls={entryControls}
        locale={locale}
        title={t("loading")}
        description={t("welcomeHint")}
      >
        <div className="entry-loading" role="status">
          <LoaderCircle
            className="entry-spinner"
            size={22}
            aria-hidden="true"
          />
          {t("loading")}
        </div>
      </EntryShell>
    );
  if (connection)
    return (
      <EntryShell
        brand={<Logo />}
        controls={entryControls}
        locale={locale}
        title={t("connection")}
        description={t("serverHint")}
        supplement={<Updates locale={locale} native compact />}
      >
        {errorBanner}
        <form
          className="entry-form"
          aria-busy={busy}
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy) return;
            setBusy(true);
            setError("");
            try {
              await invoke("connect_server", { address: serverUrl.trim() });
            } catch (error) {
              showError(typeof error === "string" ? new Error(error) : error);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="entry-field">
            <Label htmlFor="server">{t("serverUrl")}</Label>
            <Input
              id="server"
              type="url"
              dir="ltr"
              autoComplete="url"
              autoCapitalize="none"
              spellCheck={false}
              value={serverUrl}
              onChange={(event) => setServerUrl(event.target.value)}
              required
              readOnly={busy}
              aria-describedby={
                error ? "server-hint entry-error" : "server-hint"
              }
              placeholder="https://tasks.example.com"
            />
            <p id="server-hint" className="entry-field-hint">
              {t("serverAddressHint")}
            </p>
          </div>
          <Button disabled={busy} type="submit" className="entry-submit">
            {busy ? (
              <LoaderCircle
                className="entry-spinner"
                size={17}
                aria-hidden="true"
              />
            ) : (
              <ArrowRight size={17} aria-hidden="true" />
            )}
            {t(busy ? "connecting" : "connect")}
          </Button>
        </form>
        {rememberedServer && (
          <Button
            variant="outline"
            className="w-full mt-3"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await invoke("resume_server");
              } catch (error) {
                showError(typeof error === "string" ? new Error(error) : error);
              } finally {
                setBusy(false);
              }
            }}
          >
            {t("backToWorkspace")}
          </Button>
        )}
      </EntryShell>
    );
  if (recovery !== "none")
    return (
      <PasswordRecovery
        locale={locale}
        token={recovery === "reset" ? resetToken : ""}
        brand={<Logo />}
        controls={entryControls}
        onBack={() => {
          setRecovery("none");
          setError("");
          setAuthForm((f) => ({ ...f, password: "" }));
          if (resetToken) {
            setUser(null);
            const url = new URL(location.href);
            url.searchParams.delete("reset");
            history.replaceState(null, "", url);
          }
        }}
      />
    );
  if (!user)
    return (
      <EntryShell
        brand={<Logo />}
        controls={entryControls}
        locale={locale}
        title={t(setup ? "setup" : "login")}
        description={t(setup ? "setupHint" : "loginHint")}
      >
        {errorBanner}
        <form
          className="entry-form"
          onSubmit={signIn}
          aria-busy={busy}
          aria-describedby={error ? "entry-error" : undefined}
        >
          {setup && (
            <>
              <div className="entry-field">
                <Label htmlFor="name">{t("name")}</Label>
                <Input
                  id="name"
                  autoComplete="name"
                  value={authForm.name}
                  required
                  maxLength={200}
                  readOnly={busy}
                  onChange={(event) =>
                    setAuthForm({ ...authForm, name: event.target.value })
                  }
                />
              </div>
              <div className="entry-field">
                <Label htmlFor="workspace">{t("workspace")}</Label>
                <Input
                  id="workspace"
                  autoComplete="organization"
                  value={authForm.workspace}
                  required
                  readOnly={busy}
                  onChange={(event) =>
                    setAuthForm({ ...authForm, workspace: event.target.value })
                  }
                />
              </div>
            </>
          )}
          <div className="entry-field">
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              dir="ltr"
              required
              value={authForm.email}
              readOnly={busy}
              placeholder="you@example.com"
              onChange={(event) =>
                setAuthForm({ ...authForm, email: event.target.value })
              }
            />
          </div>
          <div className="entry-field">
            <Label htmlFor="password">{t("password")}</Label>
            <div className="entry-password">
              <Input
                id="password"
                type={passwordVisible ? "text" : "password"}
                dir="ltr"
                autoComplete={setup ? "new-password" : "current-password"}
                minLength={setup ? 12 : 1}
                maxLength={128}
                required
                value={authForm.password}
                readOnly={busy}
                aria-describedby={setup ? "password-hint" : undefined}
                onChange={(event) =>
                  setAuthForm({ ...authForm, password: event.target.value })
                }
              />
              <Button
                variant="ghost"
                size="icon"
                type="button"
                aria-label={t(
                  passwordVisible ? "hidePassword" : "showPassword",
                )}
                aria-pressed={passwordVisible}
                onClick={() => setPasswordVisible(!passwordVisible)}
              >
                {passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
              </Button>
            </div>
            {setup && (
              <p id="password-hint" className="entry-field-hint">
                {t("passwordHint")}
              </p>
            )}
          </div>
          <Button type="submit" disabled={busy} className="entry-submit">
            {busy ? (
              <LoaderCircle
                className="entry-spinner"
                size={17}
                aria-hidden="true"
              />
            ) : (
              <ArrowRight size={17} aria-hidden="true" />
            )}
            {t(
              busy
                ? setup
                  ? "creatingInstance"
                  : "signingIn"
                : setup
                  ? "create"
                  : "login",
            )}
          </Button>
        </form>
        {!setup && (
          <Button
            className="forgot-password"
            variant="ghost"
            type="button"
            onClick={() => {
              setError("");
              setRecovery("request");
            }}
          >
            {t("forgotPassword")}
          </Button>
        )}
      </EntryShell>
    );

  return (
    <div className="app-shell">
      {mobile && (
        <button
          className="mobile-backdrop"
          aria-label={t("close")}
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? "is-open" : ""}`}>
        <Logo />
        <div className="workspace-switch">
          <Picker
            value={wid}
            onChange={(v) => {
              setWid(v);
              setSection("overview");
            }}
            options={workspaces.map((w) => ({ id: w.id, name: w.name }))}
            label={t("workspace")}
            empty={!workspaces.length ? t("empty") : undefined}
          />
          {!!user.admin && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("newWorkspace")}
              onClick={() => open("workspace", { name: "" })}
            >
              <Plus size={15} />
            </Button>
          )}
        </div>
        <nav className="main-nav">
          {(
            [
              ["overview", LayoutDashboard],
              ["tasks", CheckCheck],
              ["sprints", Orbit],
              ["modules", Layers],
              ["pages", BookOpen],
              ["activity", ActivityIcon],
            ] as const
          ).map(([s, Icon]) => (
            <button
              key={s}
              className={section === s ? "active" : ""}
              onClick={() => {
                setSection(s);
                setMobile(false);
              }}
            >
              <Icon size={18} />
              <span>{t(s)}</span>
              {s === "tasks" && (
                <span className="nav-count">{tasks.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-label">
          <span>{t("projects")}</span>
          {canManage && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("newProject")}
              onClick={() =>
                open("project", {
                  name: "",
                  identifier: "",
                  description: "",
                  color: "#7d4b0b",
                  archived: false,
                })
              }
            >
              <Plus size={15} />
            </Button>
          )}
        </div>
        <nav className="project-nav">
          {projects.map((p) => (
            <button
              key={p.id}
              className={p.id === pid ? "active" : ""}
              onClick={() => {
                setPid(p.id);
                setSection("tasks");
                setMobile(false);
              }}
            >
              <span className="project-dot" style={{ background: p.color }} />
              <span>{p.name}</span>
              {!!p.archived && <Archive size={13} />}
            </button>
          ))}
          {!projects.length && (
            <p className="sidebar-empty">{t("projectHint")}</p>
          )}
        </nav>
        {views.length > 0 && (
          <>
            <div className="sidebar-label">{t("views")}</div>
            <nav className="project-nav">
              {views.map((v) => (
                <button
                  key={v.id}
                  onClick={() => {
                    setFilters(v.filters);
                    setSection("tasks");
                    setMobile(false);
                  }}
                >
                  <Filter size={14} />
                  {v.name}
                </button>
              ))}
            </nav>
          </>
        )}
        <div className="sidebar-bottom">
          <nav className="main-nav">
            {(
              [
                ["members", Users],
                ["settings", Settings],
                ...(user.admin ? [["admin", Shield]] : []),
              ] as [Section, typeof Users][]
            ).map(([s, Icon]) => (
              <button
                key={s}
                className={section === s ? "active" : ""}
                onClick={() => {
                  setSection(s);
                  setMobile(false);
                }}
              >
                <Icon size={17} />
                {t(s)}
              </button>
            ))}
          </nav>
          <div className="user-block">
            <span className="avatar large">{user.name.slice(0, 1)}</span>
            <span>
              <strong>{user.name}</strong>
              <small>
                {user.admin
                  ? t("instanceAdmin")
                  : t(workspace?.role || "member")}
              </small>
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("logout")}
              onClick={signOut}
            >
              <LogOut size={16} />
            </Button>
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <Button
            className="mobile-toggle"
            variant="ghost"
            size="icon"
            aria-label={t("projects")}
            onClick={() => setMobile(!mobile)}
          >
            <Menu size={18} />
          </Button>
          <div className="breadcrumbs">
            <span>{workspace?.name || "TaskOrbit"}</span>
            <ChevronRight size={13} />
            <span>{project?.name || t("projects")}</span>
            <ChevronRight size={13} />
            <strong>{t(section)}</strong>
          </div>
          <div className="topbar-actions">
            <Button
              variant="ghost"
              className="workspace-search"
              aria-label={t("globalSearch")}
              onClick={() => setSearchOpen(true)}
            >
              <Search size={17} />
              <span className="search-label">{t("searchEverything")}</span>
              <kbd dir="ltr">Ctrl K</kbd>
            </Button>
            <Inbox
              locale={locale}
              revision={liveRevision}
              onSelect={navigateResult}
            />
            {languageControl}
            {themeControl}
            <Button
              variant="ghost"
              size="icon"
              disabled={busy}
              aria-label={t("refresh")}
              onClick={refresh}
            >
              <RefreshCw size={16} />
            </Button>
          </div>
        </header>
        <div className="content">
          <WebUpdateNotice locale={locale} />
          {errorBanner}
          <div className="page-header">
            <div>
              <h1>
                {t(section)}
                {project && ["overview", "tasks"].includes(section) && (
                  <span className="project-title">{project.name}</span>
                )}
              </h1>
              <p>
                {section === "overview"
                  ? formatDate(today())
                  : section === "tasks"
                    ? `${filtered.length} / ${tasks.length}`
                    : section === "sprints"
                      ? t("sprintHint")
                      : section === "modules"
                        ? t("moduleHint")
                        : section === "pages"
                          ? t("pagesHint")
                          : section === "members"
                            ? t("teamHint")
                            : ""}
              </p>
            </div>
            <div className="header-actions">
              {pid && ["overview", "tasks", "settings"].includes(section) && (
                <ProjectTransfer
                  projectId={pid}
                  projectName={project?.name || ""}
                  canImport={canManage && writable}
                  locale={locale}
                  after={loadProject}
                />
              )}
              {!!project?.archived && (
                <Badge variant="secondary">{t("archived")}</Badge>
              )}
              {!canWrite && <Badge variant="outline">{t("readOnly")}</Badge>}
              {writable && pid && ["overview", "tasks"].includes(section) && (
                <Button onClick={() => newTask()}>
                  <Plus size={16} />
                  {t("newTask")}
                </Button>
              )}
              {writable && pid && section === "sprints" && (
                <Button onClick={newSprint}>
                  <Plus size={16} />
                  {t("newSprint")}
                </Button>
              )}
              {writable && pid && section === "modules" && (
                <Button
                  onClick={() => open("module", { name: "", description: "" })}
                >
                  <Plus size={16} />
                  {t("newModule")}
                </Button>
              )}
              {writable && pid && section === "pages" && (
                <Button onClick={() => open("page", { title: "", body: "" })}>
                  <Plus size={16} />
                  {t("newPage")}
                </Button>
              )}
              {canManage && wid && section === "members" && (
                <Button
                  onClick={() =>
                    open("member", { user_id: "", role: "member" })
                  }
                >
                  <Plus size={16} />
                  {t("addMember")}
                </Button>
              )}
              {!!user.admin && section === "admin" && (
                <Button
                  onClick={() =>
                    open("user", {
                      name: "",
                      email: "",
                      password: "",
                      admin: false,
                      active: true,
                    })
                  }
                >
                  <Plus size={16} />
                  {t("newUser")}
                </Button>
              )}
            </div>
          </div>
          {!pid && !["members", "admin", "settings"].includes(section) ? (
            empty(
              t("projectHint"),
              undefined,
              canManage && wid ? (
                <Button
                  onClick={() =>
                    open("project", {
                      name: "",
                      identifier: "",
                      description: "",
                      color: "#7d4b0b",
                    })
                  }
                >
                  <Plus size={16} />
                  {t("newProject")}
                </Button>
              ) : undefined,
            )
          ) : (
            <>
              {section === "overview" && (
                <>
                  {tasks.length === 0 && writable && (
                    <div className="first-step">
                      <img
                        src="/onboarding-orbit.webp"
                        alt=""
                        width={88}
                        height={88}
                      />
                      <div>
                        <h2>{t("gettingStartedTitle")}</h2>
                        <p>{t("noTasksHint")}</p>
                      </div>
                      <Button onClick={() => newTask()}>
                        <Plus size={16} />
                        {t("newTask")}
                      </Button>
                    </div>
                  )}
                  <div className="overview-stats">
                    {[
                      [t("total"), tasks.length, CheckCheck],
                      [t("progress"), `${percent}%`, Orbit],
                      [t("overdue"), overdue.length, Clock],
                      [
                        t("unassigned"),
                        tasks.filter(
                          (x) => !x.assignee_id && x.status !== "done",
                        ).length,
                        Users,
                      ],
                    ].map(([label, value, Icon]) => {
                      const I = Icon as typeof Users;
                      return (
                        <Card key={String(label)}>
                          <CardContent className="stat-content">
                            <div>
                              <span>{String(label)}</span>
                              <strong>{String(value)}</strong>
                            </div>
                            <I size={22} />
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                  <div className="overview-grid">
                    <section className="panel">
                      <div className="panel-heading">
                        <h2>{t("myWork")}</h2>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setFilters({
                              ...blankFilters,
                              assignee_id: user.id,
                            });
                            setSection("tasks");
                          }}
                        >
                          {t("all")}
                          <ArrowUpRight size={14} />
                        </Button>
                      </div>
                      {tasks.filter(
                        (x) =>
                          x.assignee_id === user.id &&
                          !["done", "cancelled"].includes(x.status),
                      ).length
                        ? tasks
                            .filter(
                              (x) =>
                                x.assignee_id === user.id &&
                                !["done", "cancelled"].includes(x.status),
                            )
                            .slice(0, 6)
                            .map((task) => (
                              <button
                                key={task.id}
                                className="work-row"
                                onClick={() => setDetail(task)}
                              >
                                <span
                                  className={`row-dot dot-${task.status}`}
                                />
                                {issueTag(task)}
                                <strong>{task.title}</strong>
                                {statusBadge(task.status)}
                              </button>
                            ))
                        : empty(t("empty"))}
                    </section>
                    <section className="panel">
                      <div className="panel-heading">
                        <h2>{t("sprints")}</h2>
                        <Orbit size={18} />
                      </div>
                      {activeSprint ? (
                        <div className="sprint-summary">
                          <Badge>{t("active")}</Badge>
                          <h3>{activeSprint.name}</h3>
                          <p>{activeSprint.goal}</p>
                          <span>
                            {formatDate(activeSprint.start_date)} —{" "}
                            {formatDate(activeSprint.end_date)}
                          </span>
                          <div className="progress-track">
                            <span
                              style={{
                                width: `${tasks.filter((x) => x.sprint_id === activeSprint.id).length ? (tasks.filter((x) => x.sprint_id === activeSprint.id && x.status === "done").length / tasks.filter((x) => x.sprint_id === activeSprint.id).length) * 100 : 0}%`,
                              }}
                            />
                          </div>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setFilters({
                                ...blankFilters,
                                sprint_id: activeSprint.id,
                              });
                              setSection("tasks");
                            }}
                          >
                            {t("tasks")}
                            <ArrowUpRight size={14} />
                          </Button>
                        </div>
                      ) : (
                        empty(
                          t("empty"),
                          undefined,
                          writable ? (
                            <Button variant="outline" onClick={newSprint}>
                              {t("newSprint")}
                            </Button>
                          ) : undefined,
                        )
                      )}
                    </section>
                    <section className="panel">
                      <div className="panel-heading">
                        <h2>{t("status")}</h2>
                        <span>{tasks.length}</span>
                      </div>
                      <div className="status-breakdown">
                        {statuses.map((s) => (
                          <div key={s}>
                            <span>{statusBadge(s)}</span>
                            <div className="progress-track">
                              <span
                                className={`bar-${s}`}
                                style={{
                                  width: `${tasks.length ? (tasks.filter((x) => x.status === s).length / tasks.length) * 100 : 0}%`,
                                }}
                              />
                            </div>
                            <strong>
                              {tasks.filter((x) => x.status === s).length}
                            </strong>
                          </div>
                        ))}
                      </div>
                    </section>
                    <section className="panel">
                      <div className="panel-heading">
                        <h2>{t("activity")}</h2>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSection("activity")}
                        >
                          {t("all")}
                        </Button>
                      </div>
                      <div className="activity-list">
                        {activities.slice(0, 5).map((a) => (
                          <div key={a.id}>
                            <span className="avatar">{a.name.slice(0, 1)}</span>
                            <span>
                              <strong>{a.name}</strong> {t(a.action)}
                              <small>{formatDate(a.created_at)}</small>
                            </span>
                          </div>
                        ))}
                        {!activities.length && empty(t("empty"))}
                      </div>
                    </section>
                  </div>
                </>
              )}
              {section === "tasks" && (
                <>
                  <div className="tasks-toolbar">
                    <div className="search-box">
                      <Search size={16} />
                      <Input
                        ref={searchRef}
                        aria-label={t("search")}
                        placeholder={t("search")}
                        value={filters.q}
                        onChange={(e) =>
                          setFilters({ ...filters, q: e.target.value })
                        }
                      />
                    </div>
                    {writable && (
                      <BulkActions
                        projectId={pid}
                        tasks={filtered}
                        members={members}
                        sprints={sprints}
                        locale={locale}
                        after={loadProject}
                      />
                    )}
                    <div className="view-switch">
                      {(
                        [
                          ["board", LayoutGrid],
                          ["list", List],
                          ["timeline", CalendarDays],
                        ] as const
                      ).map(([v, Icon]) => (
                        <Button
                          key={v}
                          variant={mode === v ? "secondary" : "ghost"}
                          size="sm"
                          onClick={() => setMode(v)}
                        >
                          <Icon size={15} />
                          {t(v)}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="filter-bar">
                    <Filter size={15} />
                    <Picker
                      value={filters.status}
                      onChange={(v) => setFilters({ ...filters, status: v })}
                      options={optionList(statuses)}
                      label={t("status")}
                      empty={t("status") + ": " + t("all")}
                    />
                    <Picker
                      value={filters.priority}
                      onChange={(v) => setFilters({ ...filters, priority: v })}
                      options={optionList(priorities)}
                      label={t("priority")}
                      empty={t("priority") + ": " + t("all")}
                    />
                    <Picker
                      value={filters.assignee_id}
                      onChange={(v) =>
                        setFilters({ ...filters, assignee_id: v })
                      }
                      options={members.map((m) => ({ id: m.id, name: m.name }))}
                      label={t("assignee_id")}
                      empty={t("assignee_id") + ": " + t("all")}
                    />
                    <Picker
                      value={filters.sprint_id}
                      onChange={(v) => setFilters({ ...filters, sprint_id: v })}
                      options={sprints.map((s) => ({ id: s.id, name: s.name }))}
                      label={t("sprint_id")}
                      empty={t("sprint_id") + ": " + t("all")}
                    />
                    {writable && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => open("view", { name: "", filters })}
                      >
                        {t("viewSave")}
                      </Button>
                    )}
                    {Object.values(filters).some(Boolean) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setFilters(blankFilters)}
                      >
                        {t("clear")}
                      </Button>
                    )}
                  </div>
                  {!filtered.length && mode !== "board" ? (
                    empty(
                      t("noTasks"),
                      t("noTasksHint"),
                      writable ? (
                        <Button onClick={() => newTask()}>
                          {t("newTask")}
                        </Button>
                      ) : undefined,
                    )
                  ) : mode === "board" ? (
                    <div className="board">
                      {statuses.map((s) => (
                        <section
                          key={s}
                          className="board-column"
                          onDragOver={(e) => {
                            if (writable) e.preventDefault();
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const item = tasks.find(
                              (x) =>
                                x.id ===
                                e.dataTransfer.getData("text/taskorbit"),
                            );
                            if (item) moveTask(item, s);
                          }}
                        >
                          <div className="column-header">
                            <span className={`row-dot dot-${s}`} />
                            <h2>{t(s)}</h2>
                            <span>
                              {filtered.filter((x) => x.status === s).length}
                            </span>
                            {writable && (
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={t("newTask") + " " + t(s)}
                                onClick={() => newTask({ status: s })}
                              >
                                <Plus size={15} />
                              </Button>
                            )}
                          </div>
                          <div className="column-items">
                            {filtered
                              .filter((x) => x.status === s)
                              .map(taskCard)}
                            {writable && (
                              <Button
                                variant="ghost"
                                className="add-card"
                                onClick={() => newTask({ status: s })}
                              >
                                <Plus size={15} />
                                {t("newTask")}
                              </Button>
                            )}
                          </div>
                        </section>
                      ))}
                    </div>
                  ) : mode === "list" ? (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>{t("issueId")}</th>
                            <th>{t("title")}</th>
                            <th>{t("status")}</th>
                            <th>{t("priority")}</th>
                            <th>{t("assignee_id")}</th>
                            <th>{t("due_date")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((task) => (
                            <tr key={task.id}>
                              <td>{issueTag(task)}</td>
                              <td>
                                <button
                                  className="title-link"
                                  onClick={() => setDetail(task)}
                                >
                                  {task.title}
                                </button>
                              </td>
                              <td>{statusBadge(task.status)}</td>
                              <td>
                                <span
                                  className={`priority priority-${task.priority}`}
                                >
                                  {t(task.priority)}
                                </span>
                              </td>
                              <td>
                                {members.find((m) => m.id === task.assignee_id)
                                  ?.name || "–"}
                              </td>
                              <td>{formatDate(task.due_date)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="timeline-list">
                      {[...new Set(filtered.map((x) => x.due_date || ""))]
                        .sort()
                        .map((date) => (
                          <section key={date}>
                            <h3>
                              <CalendarDays size={18} />
                              {formatDate(date || null)}
                            </h3>
                            <div>
                              {filtered
                                .filter((x) => (x.due_date || "") === date)
                                .map(taskCard)}
                            </div>
                          </section>
                        ))}
                    </div>
                  )}
                  {views.length > 0 && (
                    <div className="saved-views">
                      {views.map((v) => (
                        <div key={v.id}>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setFilters(v.filters)}
                          >
                            {v.name}
                          </Button>
                          {canManage && (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={t("delete") + " " + v.name}
                              onClick={() =>
                                setDeletion({ url: `/views/${v.id}` })
                              }
                            >
                              <X size={12} />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
              {section === "sprints" && (
                <div className="resource-grid">
                  {sprints.map((s) => {
                    const items = tasks.filter((x) => x.sprint_id === s.id),
                      done = items.filter((x) => x.status === "done").length;
                    return (
                      <Card key={s.id} id={`resource-${s.id}`} tabIndex={-1}>
                        <CardContent className="resource-card">
                          <div className="resource-heading">
                            {statusBadge(s.status)}
                            {writable && (
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={t("edit") + " " + s.name}
                                onClick={() => open("sprint", { ...s }, false)}
                              >
                                <MoreHorizontal size={18} />
                              </Button>
                            )}
                          </div>
                          <h2>{s.name}</h2>
                          <p>{s.goal}</p>
                          <span className="muted">
                            {formatDate(s.start_date)} —{" "}
                            {formatDate(s.end_date)}
                          </span>
                          <div className="progress-track">
                            <span
                              style={{
                                width: `${items.length ? (done / items.length) * 100 : 0}%`,
                              }}
                            />
                          </div>
                          <div className="resource-footer">
                            <span>
                              {done} / {items.length} {t("tasks")}
                            </span>
                            <SprintReportButton
                              sprint={s}
                              locale={locale}
                              revision={
                                liveRevision +
                                tasks.length +
                                tasks.reduce((sum, v) => sum + v.version, 0)
                              }
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setFilters({
                                  ...blankFilters,
                                  sprint_id: s.id,
                                });
                                setSection("tasks");
                              }}
                            >
                              {t("tasks")}
                              <ArrowUpRight size={15} />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                  {!sprints.length && empty(t("empty"))}
                </div>
              )}
              {section === "modules" && (
                <div className="resource-grid">
                  {modules.map((m) => (
                    <Card key={m.id}>
                      <CardContent className="resource-card">
                        <div className="resource-heading">
                          <Layers size={22} />
                          {writable && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={t("edit") + " " + m.name}
                                >
                                  <MoreHorizontal size={16} />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent>
                                <DropdownMenuItem
                                  onClick={() =>
                                    open("module", { ...m }, false)
                                  }
                                >
                                  {t("edit")}
                                </DropdownMenuItem>
                                {canManage && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      setDeletion({ url: `/modules/${m.id}` })
                                    }
                                  >
                                    {t("delete")}
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                        <h2>{m.name}</h2>
                        <p>{m.description}</p>
                        <span>
                          {
                            tasks.filter(
                              (x) =>
                                x.module_id === m.id && x.status === "done",
                            ).length
                          }{" "}
                          / {tasks.filter((x) => x.module_id === m.id).length}{" "}
                          {t("tasks")}
                        </span>
                      </CardContent>
                    </Card>
                  ))}
                  {!modules.length && empty(t("empty"))}
                </div>
              )}
              {section === "pages" && (
                <div className="pages-list">
                  {pages.map((p) => (
                    <section
                      key={p.id}
                      id={`resource-${p.id}`}
                      tabIndex={-1}
                      className="panel document"
                    >
                      <div className="panel-heading">
                        <h2>
                          <BookOpen size={18} />
                          {p.title}
                        </h2>
                        <div>
                          {writable && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => open("page", { ...p }, false)}
                            >
                              {t("edit")}
                            </Button>
                          )}
                          {canManage && writable && (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={t("delete") + " " + p.title}
                              onClick={() =>
                                setDeletion({ url: `/pages/${p.id}` })
                              }
                            >
                              <Trash2 size={15} />
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="document-body">
                        {p.body || t("empty")}
                      </div>
                    </section>
                  ))}
                  {!pages.length && empty(t("empty"))}
                </div>
              )}
              {section === "activity" && (
                <div className="panel activity-full">
                  {activities.map((a) => (
                    <div key={a.id} className="activity-row">
                      <span className="avatar">{a.name.slice(0, 1)}</span>
                      <div>
                        <strong>{a.name}</strong> <span>{t(a.action)}</span>
                        <p>
                          {(JSON.parse(a.detail) as { title?: string }).title}
                        </p>
                      </div>
                      <time>{formatDate(a.created_at)}</time>
                    </div>
                  ))}
                  {!activities.length && empty(t("empty"))}
                </div>
              )}
              {section === "members" && (
                <>
                  <p className="muted mb-5">{t("inviteHint")}</p>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>{t("name")}</th>
                          <th>{t("email")}</th>
                          <th>{t("role")}</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {members.map((m) => (
                          <tr key={m.id}>
                            <td>
                              <span className="member-name">
                                <span className="avatar">
                                  {m.name.slice(0, 1)}
                                </span>
                                {m.name}
                              </span>
                            </td>
                            <td dir="ltr">{m.email}</td>
                            <td>
                              {t(
                                m.role === "admin"
                                  ? "administrator"
                                  : m.role || "member",
                              )}
                            </td>
                            <td>
                              {canManage && m.id !== user.id && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      open(
                                        "member",
                                        { user_id: m.id, role: m.role },
                                        false,
                                      )
                                    }
                                  >
                                    {t("edit")}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      setDeletion({
                                        url: `/workspaces/${wid}/members/${m.id}`,
                                      })
                                    }
                                  >
                                    {t("remove")}
                                  </Button>
                                </>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              {section === "admin" && !!user.admin && (
                <>
                  <Updates locale={locale} />
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>{t("name")}</th>
                          <th>{t("email")}</th>
                          <th>{t("role")}</th>
                          <th>{t("status")}</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((u) => (
                          <tr key={u.id}>
                            <td>{u.name}</td>
                            <td dir="ltr">{u.email}</td>
                            <td>{u.admin ? t("instanceAdmin") : t("user")}</td>
                            <td>
                              <Badge
                                variant={u.active ? "secondary" : "outline"}
                              >
                                {u.active ? t("active") : t("cancelled")}
                              </Badge>
                            </td>
                            <td>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  open(
                                    "user",
                                    {
                                      ...u,
                                      admin: !!u.admin,
                                      active: !!u.active,
                                      password: "",
                                    },
                                    false,
                                  )
                                }
                              >
                                {t("edit")}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <section className="panel settings-panel">
                    <h2>{t("export")}</h2>
                    <p>{t("exportHint")}</p>
                    <Button variant="outline" asChild>
                      <a href="/api/admin/export" download>
                        <Download size={16} />
                        {t("export")}
                      </a>
                    </Button>
                  </section>
                </>
              )}
              {section === "settings" && (
                <div className="settings-grid">
                  <McpIntegrations locale={locale} admin={user.admin === 1} />
                  {user.admin === 1 && <Updates locale={locale} />}
                  <section className="panel settings-panel">
                    <h2>{t("theme")}</h2>
                    <div className="settings-row">
                      <span>{t("language")}</span>
                      {languageControl}
                    </div>
                    <div className="settings-row">
                      <span>{t("theme")}</span>
                      {themeControl}
                    </div>
                    <Button
                      variant="outline"
                      onClick={() =>
                        open("password", { current: "", password: "" })
                      }
                    >
                      {t("changePassword")}
                    </Button>
                  </section>
                  {project && canManage && (
                    <section className="panel settings-panel">
                      <h2>{t("projectSettings")}</h2>
                      <p>{project.name}</p>
                      <Button
                        variant="outline"
                        onClick={() =>
                          open(
                            "project",
                            { ...project, archived: !!project.archived },
                            false,
                          )
                        }
                      >
                        {t("edit")}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={async () => {
                          try {
                            await api(`/projects/${pid}`, "PUT", {
                              ...project,
                              archived: !project.archived,
                            });
                            await loadWorkspace();
                          } catch (e) {
                            showError(e);
                          }
                        }}
                      >
                        <Archive size={16} />
                        {t(project.archived ? "restore" : "archive")}
                      </Button>
                    </section>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        <footer className="app-footer">
          <span>TaskOrbit {appVersion}</span>
          <a
            href="https://github.com/sajadjanat/taskorbit"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </footer>
      </main>
      <GlobalSearch
        open={searchOpen}
        setOpen={setSearchOpen}
        locale={locale}
        onSelect={navigateResult}
      />
      <Dialog
        open={!!editor}
        onOpenChange={(v) => {
          if (!v && !busy) setEditor(null);
        }}
      >
        <DialogContent className="editor-dialog">
          <DialogHeader>
            <DialogTitle>
              {editor
                ? t(
                    editor.kind === "password"
                      ? "changePassword"
                      : editor.isNew
                        ? (
                            {
                              task: "newTask",
                              project: "newProject",
                              sprint: "newSprint",
                              module: "newModule",
                              page: "newPage",
                              user: "newUser",
                              workspace: "newWorkspace",
                              view: "viewSave",
                              member: "addMember",
                            } as const
                          )[editor.kind]
                        : "edit",
                  )
                : ""}
            </DialogTitle>
            <DialogDescription>
              {editor?.kind === "task"
                ? project?.name
                : editor?.kind === "user"
                  ? t("passwordHint")
                  : t("save")}
            </DialogDescription>
          </DialogHeader>
          {editor && (
            <form onSubmit={saveEditor}>
              {errorBanner}
              <div className="form-grid">
                {editorFields(editor).map((field) => {
                  const value = editor.data[field.key],
                    set = (v: unknown) =>
                      setEditor({
                        ...editor,
                        data: { ...editor.data, [field.key]: v },
                      });
                  return (
                    <div
                      key={field.key}
                      className={field.wide ? "field wide" : "field"}
                    >
                      <Label htmlFor={"field-" + field.key}>
                        {t(field.key)}
                      </Label>
                      {field.options ? (
                        <Picker
                          value={String(
                            value ||
                              (field.key === "template"
                                ? "blank"
                                : field.key === "recurrence"
                                  ? "none"
                                  : ""),
                          )}
                          onChange={(v) => set(v)}
                          options={field.options}
                          label={t(field.key)}
                          empty={field.nullable ? t("none") : undefined}
                        />
                      ) : field.type === "textarea" ? (
                        <Textarea
                          id={"field-" + field.key}
                          rows={field.key === "body" ? 12 : 4}
                          value={String(value || "")}
                          maxLength={30000}
                          onChange={(e) => set(e.target.value)}
                        />
                      ) : field.type === "checkbox" ? (
                        <div className="checkbox-field">
                          <input
                            id={"field-" + field.key}
                            type="checkbox"
                            checked={!!value}
                            onChange={(e) => set(e.target.checked)}
                          />
                          <span>{t(field.key)}</span>
                        </div>
                      ) : (
                        <Input
                          id={"field-" + field.key}
                          type={field.type || "text"}
                          value={
                            field.key === "labels" && Array.isArray(value)
                              ? value.join(", ")
                              : String(value ?? "")
                          }
                          required={field.required}
                          min={field.type === "number" ? 0 : undefined}
                          max={
                            field.type === "number"
                              ? field.key === "capacity"
                                ? 100000
                                : 1000
                              : undefined
                          }
                          minLength={
                            field.type === "password" && field.required
                              ? 12
                              : undefined
                          }
                          maxLength={
                            field.key === "identifier"
                              ? 10
                              : field.type === "password"
                                ? 128
                                : 200
                          }
                          dir={
                            ["email", "identifier", "password"].includes(
                              field.key,
                            )
                              ? "ltr"
                              : undefined
                          }
                          onChange={(e) =>
                            set(
                              field.key === "identifier"
                                ? e.target.value.toUpperCase()
                                : e.target.value,
                            )
                          }
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              {editor.kind === "task" && (
                <p className="workflow-note template-hint">
                  {t("recurrenceHint")}
                </p>
              )}
              {editor.kind === "project" && editor.isNew && (
                <p className="workflow-note template-hint">
                  {t("templateHint")}
                </p>
              )}
              <div className="dialog-actions">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setEditor(null)}
                >
                  {t("cancel")}
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? t("loading") : t("save")}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!detail}
        onOpenChange={(v) => {
          if (!v) setDetail(null);
        }}
      >
        <DialogContent className="detail-dialog">
          <DialogHeader>
            <DialogTitle>
              {detail && (
                <>
                  {issueTag(detail)}
                  <span>{detail.title}</span>
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {detail && statusBadge(detail.status)}
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <>
              <div className="detail-actions">
                {writable && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDetail(null);
                      open("task", { ...detail }, false);
                    }}
                  >
                    {t("edit")}
                  </Button>
                )}
                {writable && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDetail(null);
                      newTask({ parent_id: detail.id });
                    }}
                  >
                    <Plus size={14} />
                    {t("addSubtask")}
                  </Button>
                )}
                {canManage && writable && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setDeletion({
                        url: `/tasks/${detail.id}`,
                        after: () => setDetail(null),
                      })
                    }
                  >
                    {t("delete")}
                  </Button>
                )}
              </div>
              <div className="detail-content">
                <div className="detail-main">
                  <div className="document-body">
                    {detail.description || "–"}
                  </div>
                  {detail.labels.length > 0 && (
                    <div className="labels">
                      {detail.labels.map((l) => (
                        <Badge variant="secondary" key={l}>
                          {l}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <h3>{t("subtasks")}</h3>
                  {tasks
                    .filter((x) => x.parent_id === detail.id)
                    .map((x) => (
                      <button
                        className="work-row"
                        key={x.id}
                        onClick={() => setDetail(x)}
                      >
                        {issueTag(x)}
                        <strong>{x.title}</strong>
                        {statusBadge(x.status)}
                      </button>
                    ))}
                  <TaskExtras
                    revision={liveRevision}
                    task={detail}
                    tasks={tasks}
                    writable={writable}
                    locale={locale}
                    onError={showError}
                    onOpen={setDetail}
                  />
                  <h3>
                    <MessageSquare size={17} />
                    {t("comments")}
                  </h3>
                  <div className="comments">
                    {comments.map((c) => (
                      <article key={c.id}>
                        <header>
                          <span className="avatar">{c.name.slice(0, 1)}</span>
                          <strong>{c.name}</strong>
                          <time>{formatDate(c.created_at)}</time>
                        </header>
                        <p>{c.body}</p>
                      </article>
                    ))}
                  </div>
                  {writable && (
                    <form onSubmit={sendComment}>
                      <Textarea
                        aria-label={t("comment")}
                        placeholder={t("comment")}
                        value={comment}
                        maxLength={10000}
                        onChange={(e) => setComment(e.target.value)}
                        required
                      />
                      <Button
                        type="submit"
                        disabled={busy || !comment.trim()}
                        size="sm"
                      >
                        {t("send")}
                      </Button>
                    </form>
                  )}
                </div>
                <dl className="detail-properties">
                  {[
                    ["priority", t(detail.priority)],
                    [
                      "assignee_id",
                      members.find((x) => x.id === detail.assignee_id)?.name ||
                        t("unassigned"),
                    ],
                    [
                      "sprint_id",
                      sprints.find((x) => x.id === detail.sprint_id)?.name ||
                        "–",
                    ],
                    [
                      "module_id",
                      modules.find((x) => x.id === detail.module_id)?.name ||
                        "–",
                    ],
                    ["due_date", formatDate(detail.due_date)],
                    ["estimate", String(detail.estimate)],
                    [
                      "parent_id",
                      tasks.find((x) => x.id === detail.parent_id)?.title ||
                        "–",
                    ],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt>{t(k)}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              {errorBanner}
            </>
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!deletion}
        onOpenChange={(v) => {
          if (!v && !busy) setDeletion(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>{t("removeHint")}</AlertDialogDescription>
          </AlertDialogHeader>
          {errorBanner}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                doDelete();
              }}
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  function editorFields(e: Editor) {
    type Field = {
      key: string;
      type?: string;
      required?: boolean;
      wide?: boolean;
      nullable?: boolean;
      options?: Option[];
    };
    const fields: Field[] = [];
    const add = (key: string, extra: Omit<Field, "key"> = {}) =>
      fields.push({ key, ...extra });
    if (
      ["workspace", "module", "sprint", "project", "user", "view"].includes(
        e.kind,
      )
    )
      add("name", { required: true, wide: true });
    if (["task", "page"].includes(e.kind))
      add("title", { required: true, wide: true });
    if (["task", "module", "project"].includes(e.kind))
      add("description", { type: "textarea", wide: true });
    if (e.kind === "project") {
      add("identifier", { required: true });
      add("color", { type: "color" });
      if (e.isNew)
        add("template", {
          options: optionList(["blank", "software", "campaign", "operations"]),
          wide: true,
        });
    }
    if (e.kind === "sprint") {
      add("goal", { type: "textarea", wide: true });
      add("start_date", { type: "date", required: true });
      add("end_date", { type: "date", required: true });
      add("status", {
        options: optionList(["planned", "active", "completed"]),
      });
      add("capacity", { type: "number" });
    }
    if (e.kind === "task") {
      add("status", { options: optionList(statuses) });
      add("priority", { options: optionList(priorities) });
      add("assignee_id", {
        options: members
          .filter((m) => m.active)
          .map((m) => ({ id: m.id, name: m.name })),
        nullable: true,
      });
      add("sprint_id", {
        options: sprints.map((s) => ({ id: s.id, name: s.name })),
        nullable: true,
      });
      add("module_id", {
        options: modules.map((m) => ({ id: m.id, name: m.name })),
        nullable: true,
      });
      add("parent_id", {
        options: tasks
          .filter((x) => x.id !== e.data.id)
          .map((x) => ({
            id: x.id,
            name: `${project?.identifier}-${x.number} ${x.title}`,
          })),
        nullable: true,
      });
      add("due_date", { type: "date" });
      add("recurrence", {
        options: optionList(["none", "daily", "weekly", "monthly"]),
      });
      add("estimate", { type: "number" });
      add("labels", { wide: true });
    }
    if (e.kind === "page") add("body", { type: "textarea", wide: true });
    if (e.kind === "user") {
      if (e.isNew) add("email", { type: "email", required: true });
      add("password", { type: "password", required: e.isNew, wide: true });
      add("admin", { type: "checkbox" });
      if (!e.isNew) add("active", { type: "checkbox" });
    }
    if (e.kind === "member") {
      if (e.isNew) add("email", { type: "email", required: true, wide: true });
      else
        add("user_id", {
          options: members
            .filter((x) => x.active)
            .map((u) => ({ id: u.id, name: `${u.name} (${u.email})` })),
          required: true,
          wide: true,
        });
      add("role", { options: optionList(["admin", "member", "viewer"]) });
    }
    if (e.kind === "password") {
      add("current", { type: "password", required: true, wide: true });
      add("password", { type: "password", required: true, wide: true });
    }
    return fields;
  }
}
