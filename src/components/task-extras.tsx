import { useEffect, useRef, useState } from "react";
import { Paperclip, Download, X, Link2 } from "lucide-react";
import { api, type Task } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { messages, type Locale, type MessageKey } from "@/lib/i18n";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
type FileItem = { id: string; name: string; size: number };
type Link = {
  id: string;
  target_id: string;
  title: string;
  number: number;
  type: string;
};
export function TaskExtras({
  task,
  tasks,
  writable,
  locale,
  onError,
  onOpen,
  revision = 0,
}: {
  task: Task;
  tasks: Task[];
  writable: boolean;
  locale: Locale;
  onError: (e: unknown) => void;
  onOpen: (task: Task) => void;
  revision?: number;
}) {
  const [files, setFiles] = useState<FileItem[]>([]),
    [links, setLinks] = useState<Link[]>([]),
    [target, setTarget] = useState(""),
    [type, setType] = useState("related"),
    [busy, setBusy] = useState(false);
  const t = (key: MessageKey) => messages[locale][key];
  const selected = useRef(task.id),
    request = useRef(0);
  selected.current = task.id;
  const load = async () => {
    const sequence = ++request.current,
      id = task.id;
    const [a, b] = await Promise.all([
      api<FileItem[]>(`/tasks/${task.id}/attachments`),
      api<Link[]>(`/tasks/${task.id}/links`),
    ]);
    if (selected.current !== id || request.current !== sequence) return;
    setFiles(a);
    setLinks(b);
  };
  useEffect(() => {
    let active = true;
    load().catch((error) => {
      if (active) onError(error);
    });
    return () => {
      active = false;
      request.current++;
    };
  }, [task.id, revision]);
  useEffect(() => {
    setTarget("");
  }, [task.id]);
  async function upload(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      onError(new Error(t("maxFileSize")));
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`/api/tasks/${task.id}/attachments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "X-File-Name": encodeURIComponent(file.name),
        },
        body: file,
      });
      const v = await r.json();
      if (!r.ok) throw new Error(v.error);
      await load();
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h3>
        <Paperclip size={17} />
        {t("attachments")}
      </h3>
      <div className="file-list">
        {files.map((f) => (
          <div key={f.id}>
            <a href={`/api/attachments/${f.id}`} download>
              <Download size={14} />
              {f.name} <small>{Math.ceil(f.size / 1024)} KB</small>
            </a>
          </div>
        ))}
      </div>
      {writable && (
        <label className="file-upload">
          <input
            type="file"
            className="sr-only"
            aria-label={t("addFile")}
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
          />
          {t(busy ? "uploading" : "addFile")}
        </label>
      )}
      <h3>
        <Link2 size={17} />
        {t("relations")}
      </h3>
      <div className="link-list">
        {links.map((l) => (
          <div key={l.id}>
            <span>{t(l.type === "blocks" ? "blocks" : "relatedTo")}</span>
            <button
              onClick={() => {
                const target = tasks.find((t) => t.id === l.target_id);
                if (target) onOpen(target);
              }}
            >
              {l.title}
            </button>
            {writable && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("removeRelation")}
                onClick={async () => {
                  try {
                    await api(`/links/${l.id}`, "DELETE");
                    await load();
                  } catch (e) {
                    onError(e);
                  }
                }}
              >
                <X size={12} />
              </Button>
            )}
          </div>
        ))}
      </div>
      {writable && (
        <div className="relation-form">
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger aria-label={t("relatedItem")}>
              <SelectValue placeholder={t("selectItem")} />
            </SelectTrigger>
            <SelectContent>
              {tasks
                .filter((t) => t.id !== task.id)
                .map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.title}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger aria-label={t("relationType")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="related">{t("related")}</SelectItem>
              <SelectItem value="blocks">{t("blocks")}</SelectItem>
            </SelectContent>
          </Select>
          <Button
            disabled={!target || busy}
            variant="outline"
            size="sm"
            onClick={async () => {
              setBusy(true);
              try {
                await api(`/tasks/${task.id}/links`, "POST", {
                  target_id: target,
                  type,
                });
                await load();
                setTarget("");
              } catch (e) {
                onError(e);
              } finally {
                setBusy(false);
              }
            }}
          >
            {t("add")}
          </Button>
        </div>
      )}
    </>
  );
}
