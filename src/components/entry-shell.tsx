import type { ReactNode } from "react";
import "./entry-shell.css";
import { Layers, Orbit, Users, ArrowUpRight } from "lucide-react";
import { version } from "../../package.json";
import { messages, type Locale } from "@/lib/i18n";

/** Shared entry foundation for server connection, sign-in and initial setup. */
export function EntryShell({
  brand,
  controls,
  title,
  description,
  locale,
  children,
  supplement,
}: {
  brand: ReactNode;
  controls: ReactNode;
  title: string;
  description: string;
  locale: Locale;
  children: ReactNode;
  supplement?: ReactNode;
}) {
  const t = (key: keyof typeof messages.en) => messages[locale][key];
  return (
    <div className="entry-shell">
      <header className="entry-header">
        {brand}
        <div className="entry-controls">{controls}</div>
      </header>
      <main className="entry-main">
        <aside className="entry-intro" aria-label="TaskOrbit">
          <img className="entry-mercury" src="/icon-512.png" alt="" />
          <h2>{t("welcome")}</h2>
          <p>{t("welcomeHint")}</p>
          <ul className="entry-features">
            <li>
              <Layers size={17} aria-hidden="true" />
              {t("projects")}
            </li>
            <li>
              <Orbit size={17} aria-hidden="true" />
              {t("sprints")}
            </li>
            <li>
              <Users size={17} aria-hidden="true" />
              {t("members")}
            </li>
          </ul>
        </aside>
        <div className="entry-workflow">
          <section className="entry-card" aria-labelledby="entry-title">
            <div className="entry-heading">
              <h1 id="entry-title">{title}</h1>
              <p>{description}</p>
            </div>
            {children}
          </section>
          {supplement}
        </div>
      </main>
      <footer className="entry-footer">
        <span>
          TaskOrbit <span dir="ltr">{version}</span>
        </span>
        <a
          href="https://github.com/sajadjanat/taskorbit#quick-start"
          target="_blank"
          rel="noreferrer"
        >
          {t("gettingStarted")}
          <ArrowUpRight size={14} aria-hidden="true" />
        </a>
      </footer>
    </div>
  );
}
