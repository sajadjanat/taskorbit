import { useEffect, useRef } from "react";

export type LiveChange = {
  kind: "project" | "workspace" | "access";
  workspace_id?: string;
  project_id?: string;
  resource?: string;
};

export function useRealtime(
  enabled: boolean,
  refresh: (changes: LiveChange[] | null) => Promise<void>,
  onError: () => Promise<void>,
) {
  const callbacks = useRef({ refresh, onError });
  callbacks.current = { refresh, onError };
  useEffect(() => {
    if (!enabled) return;
    let active = true,
      running = false,
      full = false;
    let pending: LiveChange[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function flush() {
      timer = undefined;
      if (!active || running) return;
      running = true;
      try {
        do {
          const changes = full ? null : pending;
          full = false;
          pending = [];
          await callbacks.current.refresh(changes);
        } while (active && (full || pending.length));
      } catch {
        if (active) await callbacks.current.onError();
      } finally {
        running = false;
      }
    }
    function schedule(change?: LiveChange) {
      if (change) pending.push(change);
      else full = true;
      if (!timer && !running) timer = setTimeout(() => void flush(), 60);
    }
    const events = new EventSource("/api/events");
    events.addEventListener("ready", () => schedule());
    events.addEventListener("changed", (event) => {
      try {
        schedule(JSON.parse((event as MessageEvent).data));
      } catch {
        schedule();
      }
    });
    events.onerror = () => {
      if (active) void callbacks.current.onError();
    };
    const wake = () => {
      if (document.visibilityState === "visible") schedule();
    };
    window.addEventListener("online", wake);
    document.addEventListener("visibilitychange", wake);
    return () => {
      active = false;
      events.close();
      clearTimeout(timer);
      window.removeEventListener("online", wake);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [enabled]);
}
