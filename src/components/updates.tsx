import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Update } from "@tauri-apps/plugin-updater";
import { Button } from "./ui/button";
import { api } from "../lib/api";
import { messages, type Locale } from "../lib/i18n";
import { version as webVersion } from "../../package.json";
import { ChevronDown, Download } from "lucide-react";
type Job = {
  state: string;
  phase?: string;
  version?: string;
  rolled_back?: boolean;
  backup_ready?: boolean;
  error?: string;
};
type Release = { version: string; url: string; notes: string };
type ServerInfo = {
  current: string;
  available: boolean;
  one_click: boolean;
  release: Release;
};
type NativeInfo = { version: string; platform: string };
type MobileUpdate = {
  android: true;
  version: string;
  body?: string;
  url: string;
};
export function Updates({
  locale,
  native = false,
  compact = false,
}: {
  locale: Locale;
  native?: boolean;
  compact?: boolean;
}) {
  const t = (key: keyof typeof messages.en) => messages[locale][key];
  const [info, setInfo] = useState<ServerInfo>(),
    [client, setClient] = useState<NativeInfo>(),
    [update, setUpdate] = useState<Update | MobileUpdate | null>(),
    [job, setJob] = useState<Job>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [checked, setChecked] = useState(false),
    [progress, setProgress] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  async function check() {
    setBusy(true);
    setError("");
    try {
      if (native) {
        if (update instanceof Update) await update.close();
        setUpdate(null);
        setClient(await invoke<NativeInfo>("client_info"));
        const metadata = await invoke<
          (ConstructorParameters<typeof Update>[0] | MobileUpdate) | null
        >("check_client_update");
        setUpdate(
          metadata && "android" in metadata
            ? metadata
            : metadata
              ? new Update(metadata)
              : null,
        );
      } else {
        setInfo(await api<ServerInfo>("/admin/updates"));
        setJob(await api<Job>("/admin/updates/status"));
      }
      setChecked(true);
    } catch {
      setError(t("updateUnavailable"));
    } finally {
      setBusy(false);
    }
  }
  function poll() {
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(async () => {
      try {
        const status = await api<Job>("/admin/updates/status");
        setJob(status);
        if (status.state !== "running") {
          clearInterval(timer.current);
          timer.current = undefined;
          setBusy(false);
          if (status.state === "complete") location.reload();
        }
      } catch {
        /* Expected during server restart; keep polling instead of claiming failure. */
      }
    }, 2000);
  }
  useEffect(() => {
    void check();
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);
  useEffect(() => {
    if (job?.state === "running") {
      setBusy(true);
      poll();
    }
  }, [job?.state]);
  async function install() {
    setError("");
    setBusy(true);
    try {
      if (native && update) {
        if ("android" in update) {
          await invoke("open_apk_update", { version: update.version });
          setBusy(false);
        } else {
          await update.downloadAndInstall((event) => {
            if (event.event === "Started") setProgress(0);
            if (event.event === "Progress")
              setProgress((n) => n + event.data.chunkLength);
          });
          await invoke("restart_client");
        }
      } else if (info) {
        const result = await api<Job>("/admin/updates", "POST", {
          version: info.release.version,
        });
        setJob(result);
        poll();
      }
    } catch {
      setError(t("updateUnavailable"));
      setBusy(false);
    }
  }
  const available = native ? !!update : info?.available;
  const content = (
    <>
      <p>
        {t("installedVersion")}:{" "}
        <b dir="ltr">{native ? client?.version : info?.current || "—"}</b>
      </p>
      <p>{t(native ? "clientUpdateHint" : "serverUpdateHint")}</p>
      {error && <p role="alert">{error}</p>}
      {job?.state === "running" && (
        <p role="status">
          {t("upgrading")} ·{" "}
          {t(
            ("updatePhase_" + job.phase in messages.en
              ? "updatePhase_" + job.phase
              : "upgrading") as keyof typeof messages.en,
          )}
        </p>
      )}
      {job?.state === "failed" && (
        <p role="alert">
          {t(job.rolled_back ? "updateRolledBack" : "updateRecovery")}
        </p>
      )}
      {available && (
        <p>
          {t("newVersion")}:{" "}
          <b dir="ltr">{native ? update?.version : info?.release.version}</b>
        </p>
      )}
      <div className="update-actions">
        {available && (
          <Button
            onClick={install}
            disabled={busy || (!native && !info?.one_click)}
          >
            {t(
              native && update && "android" in update
                ? "downloadApk"
                : "installUpdate",
            )}
          </Button>
        )}
        <Button variant="outline" disabled={busy} onClick={() => void check()}>
          {t("checkUpdates")}
        </Button>
      </div>
      {native && progress > 0 && (
        <p role="status">
          {t("downloading")}: {(progress / 1048576).toFixed(1)} MB
        </p>
      )}
      {checked && !available && !error && job?.state !== "running" && (
        <p>{t("upToDate")}</p>
      )}
      {!native && info && !info.one_click && (
        <p>
          {t("enableUpgradeService")}{" "}
          <a
            href="https://github.com/sajadjanat/taskorbit/blob/main/docs/UPDATES.md"
            target="_blank"
            rel="noreferrer"
          >
            {t("updateGuide")}
          </a>
        </p>
      )}
    </>
  );
  if (compact)
    return (
      <details className="client-update-disclosure">
        <summary>
          <Download size={16} aria-hidden="true" />
          <span>{t("clientUpdates")}</span>
          <span
            className={
              available ? "update-summary available" : "update-summary"
            }
          >
            {busy ? (
              t("loading")
            ) : available ? (
              <>
                {t("newVersion")} <b dir="ltr">{update?.version}</b>
              </>
            ) : (
              <b dir="ltr">{client?.version || webVersion}</b>
            )}
          </span>
          <ChevronDown size={16} aria-hidden="true" />
        </summary>
        <div className="client-update-content">{content}</div>
      </details>
    );
  return (
    <section className="panel settings-panel update-panel">
      <h2>{t(native ? "clientUpdates" : "serverUpdates")}</h2>
      {content}
    </section>
  );
}
export function WebUpdateNotice({ locale }: { locale: Locale }) {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const health = await api<{ version: string }>("/health");
        if (active) setAvailable(health.version !== webVersion);
      } catch {}
    };
    void check();
    const timer = setInterval(check, 60000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  if (!available) return null;
  const t = (key: keyof typeof messages.en) => messages[locale][key];
  return (
    <section className="panel settings-panel" role="status">
      <p>{t("webUpdateReady")}</p>
      <Button
        onClick={() => {
          void navigator.serviceWorker
            ?.getRegistration()
            .then((r) => r?.update());
          location.reload();
        }}
      >
        {t("reloadApp")}
      </Button>
    </section>
  );
}
