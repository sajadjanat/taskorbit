import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LoaderCircle,
  Mail,
  CheckCircle2,
} from "lucide-react";
import { EntryShell } from "./entry-shell";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { api, ApiError } from "@/lib/api";
import type { Locale } from "@/lib/i18n";
import { workflowText } from "@/lib/workflow-i18n";

export function PasswordRecovery({
  locale,
  token,
  brand,
  controls,
  onBack,
}: {
  locale: Locale;
  token: string;
  brand: ReactNode;
  controls: ReactNode;
  onBack: () => void;
}) {
  const t = workflowText(locale);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    if (!token)
      api<{ password_reset: boolean }>("/auth-options")
        .then((v) => {
          if (active) setEnabled(v.password_reset);
        })
        .catch(() => {
          if (active) setError(t("serverError"));
        });
    return () => {
      active = false;
    };
  }, [token, locale]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (token && password !== repeat) {
      setError(t("passwordMismatch"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api(
        token ? "/password/reset" : "/password/forgot",
        "POST",
        token ? { token, password } : { email, locale },
      );
      setDone(true);
      setPassword("");
      setRepeat("");
      if (token) {
        const url = new URL(location.href);
        url.searchParams.delete("reset");
        history.replaceState(null, "", url);
      }
    } catch (e) {
      setError(
        t(
          e instanceof ApiError && e.status === 400 && token
            ? "resetInvalid"
            : e instanceof ApiError && e.status === 503
              ? "recoveryUnavailable"
              : "serverError",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <EntryShell
      brand={brand}
      controls={controls}
      locale={locale}
      title={t("recoveryTitle")}
      description={t("recoveryHint")}
    >
      {error && (
        <p className="workflow-error" role="alert">
          {error}
        </p>
      )}
      {done ? (
        <div className="recovery-success" role="status">
          <CheckCircle2 size={28} />
          <p>{t(token ? "resetDone" : "resetSent")}</p>
        </div>
      ) : !token && enabled === false ? (
        <p className="workflow-note">{t("recoveryUnavailable")}</p>
      ) : !token && enabled === null ? (
        <p role="status">{error ? "" : t("loading")}</p>
      ) : (
        <form className="entry-form" onSubmit={submit} aria-busy={busy}>
          {token ? (
            <>
              <div className="entry-field">
                <Label htmlFor="reset-password">{t("newPassword")}</Label>
                <div className="entry-password">
                  <Input
                    id="reset-password"
                    type={visible ? "text" : "password"}
                    dir="ltr"
                    autoComplete="new-password"
                    required
                    minLength={12}
                    maxLength={128}
                    value={password}
                    disabled={busy}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-describedby="reset-password-hint"
                  />
                  <Button
                    variant="ghost"
                    type="button"
                    size="icon"
                    aria-label={t(visible ? "hidePassword" : "showPassword")}
                    aria-pressed={visible}
                    onClick={() => setVisible(!visible)}
                  >
                    {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                  </Button>
                </div>
                <p id="reset-password-hint" className="entry-field-hint">
                  {t("passwordHint")}
                </p>
              </div>
              <div className="entry-field">
                <Label htmlFor="repeat-password">{t("repeatPassword")}</Label>
                <Input
                  id="repeat-password"
                  type="password"
                  dir="ltr"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={128}
                  value={repeat}
                  disabled={busy}
                  onChange={(e) => setRepeat(e.target.value)}
                />
              </div>
            </>
          ) : (
            <div className="entry-field">
              <Label htmlFor="recovery-email">{t("email")}</Label>
              <Input
                id="recovery-email"
                type="email"
                autoComplete="email"
                dir="ltr"
                required
                value={email}
                disabled={busy}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          )}
          <Button className="entry-submit" disabled={busy} type="submit">
            {busy ? (
              <LoaderCircle className="entry-spinner" size={17} />
            ) : (
              <Mail size={17} />
            )}
            {t(token ? "resetPassword" : "sendReset")}
          </Button>
        </form>
      )}
      <Button
        type="button"
        variant="ghost"
        className="recovery-back"
        disabled={busy}
        onClick={onBack}
      >
        <ArrowRight size={16} />
        {t("backToLogin")}
      </Button>
    </EntryShell>
  );
}
