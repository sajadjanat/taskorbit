import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  Search,
  Bell,
  CheckCheck,
  ListChecks,
  Upload,
  Download,
  ArrowUpRight,
  BarChart3,
  LoaderCircle,
  FileJson,
  Repeat2,
} from "lucide-react";
import { api, ApiError, type Task, type User, type Sprint } from "@/lib/api";
import type { Locale } from "@/lib/i18n";
import { dateLocales } from "@/lib/i18n";
import { workflowText } from "@/lib/workflow-i18n";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";

export type SearchResult = {
  id: string;
  title: string;
  reference: string;
  project_name?: string;
  workspace_name?: string;
  kind: "task" | "project" | "sprint" | "page";
  workspace_id: string;
  project_id: string;
  status?: string;
};
type Navigate = (result: SearchResult) => void;
const statuses = ["backlog", "todo", "doing", "review", "done", "cancelled"];
const priorities = ["urgent", "high", "medium", "low", "none"];
const errorText = (e: unknown, t: (key: string) => string) =>
  t(
    e instanceof ApiError && e.status === 409
      ? "refreshConflict"
      : "serverError",
  );
const dateText = (value: string, locale: Locale) =>
  new Intl.DateTimeFormat(dateLocales[locale], { dateStyle: "medium" }).format(
    new Date(
      value.length === 10
        ? value + "T12:00:00Z"
        : value.replace(" ", "T") + "Z",
    ),
  );

export function GlobalSearch({
  open,
  setOpen,
  locale,
  onSelect,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  locale: Locale;
  onSelect: Navigate;
}) {
  const t = workflowText(locale);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [index, setIndex] = useState(0);
  useEffect(() => {
    let active = true;
    setResults([]);
    setIndex(0);
    setError("");
    setLoading(open && query.trim().length >= 2);
    if (!open || query.trim().length < 2) return;
    const timer = setTimeout(
      () =>
        api<SearchResult[]>(`/search?q=${encodeURIComponent(query.trim())}`)
          .then((data) => {
            if (active) setResults(data);
          })
          .catch((e) => {
            if (active) setError(errorText(e, t));
          })
          .finally(() => {
            if (active) setLoading(false);
          }),
      250,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, open, locale]);
  const choose = (result: SearchResult) => {
    setOpen(false);
    onSelect(result);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="command-dialog">
        <DialogHeader>
          <DialogTitle>{t("globalSearch")}</DialogTitle>
          <DialogDescription>{t("searchHint")}</DialogDescription>
        </DialogHeader>
        <div className="command-input">
          <Search size={20} />
          <Input
            aria-label={t("globalSearch")}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={results.length > 0}
            aria-controls="search-results"
            aria-activedescendant={
              results.length ? `search-result-${index}` : undefined
            }
            placeholder={t("globalSearch")}
            value={query}
            maxLength={100}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (
                results.length &&
                ["ArrowDown", "ArrowUp", "Enter"].includes(e.key)
              ) {
                e.preventDefault();
                if (e.key === "Enter") choose(results[index]);
                else
                  setIndex(
                    (old) =>
                      (old +
                        (e.key === "ArrowDown" ? 1 : -1) +
                        results.length) %
                      results.length,
                  );
              }
            }}
          />
        </div>
        <div className="command-results" aria-live="polite">
          <div
            id="search-results"
            role="listbox"
            aria-label={t("globalSearch")}
          >
            {error && (
              <p className="workflow-error" role="alert">
                {error}
              </p>
            )}
            {results.map((r, i) => (
              <button
                id={`search-result-${i}`}
                role="option"
                aria-selected={i === index}
                key={r.kind + r.id}
                className={`command-result ${i === index ? "is-highlighted" : ""}`}
                onClick={() => choose(r)}
              >
                <span className="result-kind">{t(r.kind)}</span>
                <span>
                  <small dir="auto">
                    {[r.workspace_name, r.project_name, r.reference]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                  <strong>{r.title}</strong>
                </span>
                <ArrowUpRight size={16} />
              </button>
            ))}
          </div>
          {loading ? (
            <p className="workflow-empty">
              <LoaderCircle className="entry-spinner" size={22} />
              {t("loading")}
            </p>
          ) : (
            !results.length && (
              <p className="workflow-empty">
                {t(query.trim().length < 2 ? "searchMinimum" : "noResults")}
              </p>
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type Notification = {
  id: string;
  task_id: string;
  title: string;
  reference: string;
  project_id: string;
  workspace_id: string;
  kind: string;
  read: number;
  actor: string | null;
  created_at: string;
};
export function Inbox({
  locale,
  revision,
  onSelect,
}: {
  locale: Locale;
  revision: number;
  onSelect: Navigate;
}) {
  const t = workflowText(locale);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ items: Notification[]; unread: number }>({
    items: [],
    unread: 0,
  });
  const [filter, setFilter] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    const load = () =>
      api<typeof data>("/notifications")
        .then((value) => {
          if (active) {
            setData(value);
            setError("");
          }
        })
        .catch((e) => {
          if (active) setError(errorText(e, t));
        });
    void load();
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, 60000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [revision, open, locale]);
  async function read(notification?: Notification) {
    if (busy) return;
    setBusy(true);
    try {
      await api(
        notification
          ? `/notifications/${notification.id}/read`
          : "/notifications/read",
        "POST",
      );
      setData(await api<typeof data>("/notifications"));
      if (notification) {
        setOpen(false);
        onSelect({ ...notification, id: notification.task_id, kind: "task" });
      }
    } catch (e) {
      setError(errorText(e, t));
    } finally {
      setBusy(false);
    }
  }
  const items = data.items.filter((n) => !filter || !n.read);
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="inbox-trigger"
        aria-label={`${t("inbox")}${data.unread ? ` (${data.unread})` : ""}`}
        onClick={() => setOpen(true)}
      >
        <Bell size={18} />
        {data.unread > 0 && (
          <span className="inbox-count">
            {data.unread > 99 ? "99+" : data.unread}
          </span>
        )}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="inbox-dialog">
          <DialogHeader>
            <DialogTitle>{t("inbox")}</DialogTitle>
            <DialogDescription>{t("inboxHint")}</DialogDescription>
          </DialogHeader>
          <div className="workflow-actions">
            <div className="workflow-segments">
              <Button
                size="sm"
                variant={filter ? "ghost" : "secondary"}
                onClick={() => setFilter(false)}
              >
                {t("all")}
              </Button>
              <Button
                size="sm"
                variant={filter ? "secondary" : "ghost"}
                onClick={() => setFilter(true)}
              >
                {t("unread")} · {data.unread}
              </Button>
            </div>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy || !data.unread}
              onClick={() => void read()}
            >
              <CheckCheck size={15} />
              {t("markAllRead")}
            </Button>
          </div>
          {error && (
            <p className="workflow-error" role="alert">
              {error}
            </p>
          )}
          <div className="inbox-items">
            {items.length ? (
              items.map((n) => (
                <button
                  key={n.id}
                  className={`inbox-item ${!n.read ? "is-unread" : ""}`}
                  disabled={busy}
                  onClick={() => void read(n)}
                >
                  <span className="notification-dot" />
                  <span>
                    <small>
                      {t(n.kind)}
                      {n.actor ? ` · ${n.actor}` : ""}
                    </small>
                    <strong>{n.title}</strong>
                    <small dir="auto">
                      {n.reference} · {dateText(n.created_at, locale)}
                    </small>
                  </span>
                  <ArrowUpRight size={16} />
                </button>
              ))
            ) : (
              <div className="workflow-empty">
                <Bell size={28} />
                <p>{t("inboxEmpty")}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function BulkActions({
  projectId,
  tasks,
  members,
  sprints,
  locale,
  after,
}: {
  projectId: string;
  tasks: Task[];
  members: User[];
  sprints: Sprint[];
  locale: Locale;
  after: () => Promise<void>;
}) {
  const t = workflowText(locale);
  const [open, setOpen] = useState(false);
  const [candidates, setCandidates] = useState<Task[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [field, setField] = useState("status");
  const [value, setValue] = useState("todo");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const toggle = (id: string) =>
    setSelected((old) => {
      const next = new Set(old);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const options =
    field === "status"
      ? statuses.map((id) => ({ id, name: t(id) }))
      : field === "priority"
        ? priorities.map((id) => ({ id, name: t(id) }))
        : [
            { id: "", name: t("unassigned") },
            ...(field === "assignee_id"
              ? members.filter((m) => m.active)
              : sprints
            ).map((v) => ({ id: v.id, name: v.name })),
          ];
  async function apply(event: FormEvent) {
    event.preventDefault();
    if (busy || !selected.size) return;
    setBusy(true);
    setError("");
    try {
      await api(`/projects/${projectId}/tasks/bulk`, "POST", {
        tasks: candidates
          .filter((v) => selected.has(v.id))
          .map(({ id, version }) => ({ id, version })),
        changes: { [field]: value || null },
      });
      await after();
      setOpen(false);
    } catch (e) {
      setError(errorText(e, t));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={!tasks.length}
        onClick={() => {
          setCandidates(tasks.slice(0, 100));
          setSelected(new Set());
          setError("");
          setOpen(true);
        }}
      >
        <ListChecks size={16} />
        {t("bulkActions")}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!busy) setOpen(v);
        }}
      >
        <DialogContent className="bulk-dialog">
          <DialogHeader>
            <DialogTitle>{t("bulkActions")}</DialogTitle>
            <DialogDescription>{t("bulkHint")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={apply}>
            <div className="workflow-actions">
              <label className="selection-label">
                <input
                  type="checkbox"
                  disabled={busy}
                  checked={
                    !!candidates.length && candidates.length === selected.size
                  }
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? new Set(candidates.map((v) => v.id))
                        : new Set(),
                    )
                  }
                />
                {t("selectAll")}
              </label>
              <span>
                {selected.size} {t("selected")}
              </span>
            </div>
            <div className="bulk-items">
              {candidates.map((v) => (
                <label key={v.id} className="bulk-item">
                  <input
                    type="checkbox"
                    disabled={busy}
                    checked={selected.has(v.id)}
                    onChange={() => toggle(v.id)}
                  />
                  <span>
                    <strong>{v.title}</strong>
                    <small>
                      {t(v.status)} · {t(v.priority)}
                      {v.recurrence !== "none" ? ` · ${t(v.recurrence)}` : ""}
                    </small>
                  </span>
                </label>
              ))}
            </div>
            <div className="workflow-form-grid">
              <div>
                <Label htmlFor="bulk-field">{t("changeField")}</Label>
                <select
                  id="bulk-field"
                  className="workflow-select"
                  disabled={busy}
                  value={field}
                  onChange={(e) => {
                    const f = e.target.value;
                    setField(f);
                    setValue(
                      f === "status"
                        ? "todo"
                        : f === "priority"
                          ? "medium"
                          : "",
                    );
                  }}
                >
                  {["status", "priority", "assignee_id", "sprint_id"].map(
                    (f) => (
                      <option value={f} key={f}>
                        {t(f)}
                      </option>
                    ),
                  )}
                </select>
              </div>
              <div>
                <Label htmlFor="bulk-value">{t("newValue")}</Label>
                <select
                  id="bulk-value"
                  className="workflow-select"
                  value={value}
                  disabled={busy}
                  onChange={(e) => setValue(e.target.value)}
                >
                  {options.map((o) => (
                    <option value={o.id} key={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {error && (
              <p className="workflow-error" role="alert">
                {error}
              </p>
            )}
            <div className="dialog-actions">
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={busy || !selected.size}>
                {busy && <LoaderCircle size={16} className="entry-spinner" />}
                {t("applyChanges")} · {selected.size}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

type Report = {
  sprint: Sprint;
  total_points: number;
  completed_points: number;
  remaining_points: number;
  total_items: number;
  completed_items: number;
  workload: {
    assignee_id: string | null;
    name: string | null;
    items: number;
    points: number;
    completed: number;
  }[];
  history: { day: string; scope_points: number; remaining_points: number }[];
};
export function SprintReportButton({
  sprint,
  locale,
  revision,
}: {
  sprint: Sprint;
  locale: Locale;
  revision: number;
}) {
  const t = workflowText(locale);
  const [open, setOpen] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    if (open) {
      setError("");
      api<Report>(`/sprints/${sprint.id}/report`)
        .then((data) => {
          if (active) setReport(data);
        })
        .catch((e) => {
          if (active) setError(errorText(e, t));
        });
    }
    return () => {
      active = false;
    };
  }, [open, sprint.id, revision, locale]);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <BarChart3 size={15} />
        {t("sprintReport")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="report-dialog">
          <DialogHeader>
            <DialogTitle>
              {sprint.name} · {t("sprintReport")}
            </DialogTitle>
            <DialogDescription>{t("reportHint")}</DialogDescription>
          </DialogHeader>
          {error && (
            <p className="workflow-error" role="alert">
              {error}
            </p>
          )}
          {!report ? (
            <p role="status">{t("loading")}</p>
          ) : (
            <div className="report-content">
              <div className="report-summary">
                {[
                  ["scopePoints", report.total_points],
                  ["completedPoints", report.completed_points],
                  ["remainingPoints", report.remaining_points],
                ].map(([label, count]) => (
                  <div key={label}>
                    <small>{t(String(label))}</small>
                    <strong>{count}</strong>
                    <span>{t("points")}</span>
                  </div>
                ))}
              </div>
              <section className="report-section">
                <div className="workflow-actions">
                  <h3>{t("capacity")}</h3>
                  <span>
                    {report.sprint.capacity
                      ? `${report.total_points} / ${report.sprint.capacity}`
                      : t("noCapacity")}
                  </span>
                </div>
                {report.sprint.capacity > 0 && (
                  <>
                    <progress
                      className={
                        report.total_points > report.sprint.capacity
                          ? "is-over-capacity"
                          : ""
                      }
                      aria-label={t("capacity")}
                      value={report.total_points}
                      max={Math.max(
                        report.sprint.capacity,
                        report.total_points,
                      )}
                    />
                    {report.total_points > report.sprint.capacity && (
                      <p className="capacity-warning">{t("overCapacity")}</p>
                    )}
                  </>
                )}
              </section>
              <section className="report-section">
                <h3>{t("workload")}</h3>
                {report.workload.map((r) => (
                  <div className="workload-row" key={r.assignee_id || "none"}>
                    <span>{r.name || t("unassigned")}</span>
                    <progress
                      aria-label={r.name || t("unassigned")}
                      max={Math.max(r.points, 1)}
                      value={r.completed}
                    />
                    <strong>
                      {r.completed} / {r.points}
                    </strong>
                  </div>
                ))}
              </section>
              <section className="report-section">
                <h3>{t("history")}</h3>
                {report.history.map((r) => (
                  <div className="workload-row" key={r.day}>
                    <span>{dateText(r.day, locale)}</span>
                    <progress
                      aria-label={`${dateText(r.day, locale)} ${t("remainingPoints")}`}
                      max={Math.max(r.scope_points, report.total_points, 1)}
                      value={r.remaining_points}
                    />
                    <strong>
                      {r.remaining_points} / {r.scope_points}
                    </strong>
                  </div>
                ))}
                {report.history.length < 2 && (
                  <p className="workflow-note">{t("noHistory")}</p>
                )}
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ProjectTransfer({
  projectId,
  projectName,
  canImport,
  locale,
  after,
}: {
  projectId: string;
  projectName: string;
  canImport: boolean;
  locale: Locale;
  after: () => Promise<void>;
}) {
  const t = workflowText(locale);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<{
    name: string;
    content: string;
    format: "json" | "csv";
    count: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    tasks: number;
    unassigned: number;
  } | null>(null);
  const fileRequest = useRef(0);
  useEffect(() => {
    fileRequest.current++;
    setOpen(false);
    setFile(null);
    setResult(null);
    setError("");
  }, [projectId]);
  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const request = ++fileRequest.current;
    const input = event.target;
    const chosen = input.files?.[0];
    input.value = "";
    if (!chosen) return;
    setFile(null);
    setResult(null);
    setError("");
    if (chosen.size > 1500000) {
      setError(t("fileTooLarge"));
      return;
    }
    try {
      const content = await chosen.text();
      const format = chosen.name.toLowerCase().endsWith(".csv")
        ? "csv"
        : "json";
      let count: number;
      if (format === "json") {
        const data = JSON.parse(content);
        if (
          data.schema !== "taskorbit-project" ||
          data.version !== 1 ||
          !Array.isArray(data.tasks)
        )
          throw new Error();
        count = data.tasks.length;
      } else {
        const { parseCsv } = await import("../../shared/csv.mjs");
        const rows = parseCsv(content);
        if (
          !rows[0]?.some((h) =>
            ["title", "summary", "name"].includes(h.trim().toLowerCase()),
          )
        )
          throw new Error();
        count = rows.length - 1;
      }
      if (count < 0 || count > 500) throw new Error();
      if (request === fileRequest.current)
        setFile({ name: chosen.name, content, format, count });
    } catch {
      if (request === fileRequest.current) setError(t("invalidFile"));
    }
  }
  async function download() {
    setBusy(true);
    setError("");
    try {
      const data = await api(`/projects/${projectId}/export`);
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "taskorbit-project.json";
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(errorText(e, t));
    } finally {
      setBusy(false);
    }
  }
  async function importFile() {
    if (!file || busy) return;
    setBusy(true);
    setError("");
    try {
      setResult(await api(`/projects/${projectId}/import`, "POST", file));
      setFile(null);
      await after();
    } catch (e) {
      setError(
        t(
          e instanceof ApiError && e.status === 400
            ? "invalidImport"
            : e instanceof ApiError && e.status === 409
              ? "importConflict"
              : "serverError",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setOpen(true);
          setError("");
        }}
      >
        <Upload size={15} />
        {t("transfer")}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!busy) setOpen(v);
        }}
      >
        <DialogContent className="transfer-dialog">
          <DialogHeader>
            <DialogTitle>
              {t("transfer")} · {projectName}
            </DialogTitle>
            <DialogDescription>{t("transferHint")}</DialogDescription>
          </DialogHeader>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void download()}
          >
            <Download size={16} />
            {t("exportProject")}
          </Button>
          {canImport && (
            <section className="transfer-import">
              <h3>{t("importFile")}</h3>
              <p className="workflow-note">{t("importHint")}</p>
              <p className="workflow-note" dir="auto">
                {t("csvHint")}
              </p>
              <label className="import-picker">
                <Upload size={22} />
                <span>{t("chooseFile")}</span>
                <input
                  aria-label={t("chooseFile")}
                  type="file"
                  accept=".json,.csv,application/json,text/csv"
                  disabled={busy}
                  onChange={(event) => void choose(event)}
                />
              </label>
              {file && (
                <div className="import-preview">
                  <FileJson size={22} />
                  <div>
                    <strong dir="auto">{file.name}</strong>
                    <p>
                      {file.count} {t("task")} · {t("readyToImport")}
                    </p>
                    <small>
                      {t("project")}: {projectName}
                    </small>
                  </div>
                </div>
              )}
              {file && (
                <Button disabled={busy} onClick={() => void importFile()}>
                  {busy && <LoaderCircle size={16} className="entry-spinner" />}
                  {t("importNow")}
                </Button>
              )}
            </section>
          )}
          {result && (
            <p className="workflow-success" role="status">
              {t("importSuccess")} · {result.tasks} {t("importedTasks")}
              {result.unassigned
                ? ` · ${result.unassigned} ${t("unassigned")}`
                : ""}
            </p>
          )}
          {error && (
            <p className="workflow-error" role="alert">
              {error}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function RecurrenceBadge({
  task,
  locale,
}: {
  task: Task;
  locale: Locale;
}) {
  return task.recurrence && task.recurrence !== "none" ? (
    <span
      className="recurrence-badge"
      title={workflowText(locale)("recurrenceHint")}
    >
      <Repeat2 size={12} />
      {workflowText(locale)(task.recurrence)}
    </span>
  ) : null;
}
