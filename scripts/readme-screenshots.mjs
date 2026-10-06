// Actual UI screenshots with separate disposable databases and localized fictional data.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { createApp } from "../server/app.mjs";
import { samples } from "./readme-sample-data.mjs";
const version = JSON.parse(fs.readFileSync("package.json", "utf8")).version;
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
  headless: true,
});
try {
  for (const [locale, data] of Object.entries(samples)) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "taskorbit-docs-"));
    const { app, db } = createApp({
      database: path.join(dir, "docs.sqlite"),
      serveStatic: true,
      secure: false,
      origin: "http://localhost:4313",
      checkRelease: async () => ({
        version,
        url: `https://github.com/sajadjanat/taskorbit/releases/tag/v${version}`,
      }),
      upgradeAgent: { enabled: false },
    });
    const server = app.listen(4313, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    let context,
      cookie = "";
    const call = async (url, body) => {
      const response = await fetch("http://localhost:4313/api" + url, {
        method: body ? "POST" : "GET",
        headers: { Cookie: cookie, "Content-Type": "application/json", Connection: "close" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok)
        throw Error(`Fixture ${locale} ${url}: ${response.status}`);
      if (response.headers.get("set-cookie"))
        cookie = response.headers.get("set-cookie").split(";")[0];
      return response.json();
    };
    try {
      await call("/setup", {
        name: data.admin,
        email: "demo@example.test",
        password: "documentation-only-123",
        workspace: data.workspace,
      });
      const [workspace] = await call("/workspaces");
      const members = [(await call("/me")).id];
      for (let i = 0; i < data.members.length; i++) {
        const email = `member-${i}@example.test`;
        const user = await call("/admin/users", {
          name: data.members[i],
          email,
          password: "documentation-only-123",
          admin: false,
        });
        await call(`/workspaces/${workspace.id}/members`, {
          email,
          role: "member",
        });
        members.push(user.id);
      }
      const project = await call(`/workspaces/${workspace.id}/projects`, {
        name: data.project,
        identifier: "MRC",
        description: data.description,
        color: "#b88645",
      });
      await call(`/workspaces/${workspace.id}/projects`, {
        name: data.otherProject,
        identifier: "CX",
        description: data.otherDescription,
        color: "#7b8d80",
      });
      const sprint = await call(`/projects/${project.id}/sprints`, {
        name: data.sprint,
        goal: data.goal,
        start_date: "2026-10-01",
        end_date: "2026-10-15",
        status: "active",
      });
      const states = [
        "backlog",
        "backlog",
        "todo",
        "todo",
        "todo",
        "doing",
        "doing",
        "review",
        "review",
        "done",
        "done",
      ];
      const priorities = [
        "medium",
        "low",
        "high",
        "medium",
        "low",
        "high",
        "urgent",
        "medium",
        "low",
        "medium",
        "high",
      ];
      let first;
      for (let i = 0; i < data.titles.length; i++) {
        const task = await call(`/projects/${project.id}/tasks`, {
          title: data.titles[i],
          status: states[i],
          priority: priorities[i],
          labels: [data.labels[i]],
          description: data.taskDescription,
          sprint_id: sprint.id,
          assignee_id: members[i % members.length],
          estimate: 3,
          due_date: "2026-10-12",
        });
        first ??= task;
      }
      await call(`/tasks/${first.id}/comments`, { body: data.comment });
      context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        deviceScaleFactor: 1,
      });
      await context.addCookies([
        {
          name: "taskorbit_session",
          value: cookie.split("=")[1],
          url: "http://localhost:4313",
        },
      ]);
      await context.addInitScript(
        ({ locale }) => {
          localStorage.setItem("taskorbit.locale", locale);
          localStorage.setItem("taskorbit.theme", "dark");
        },
        { locale },
      );
      const page = await context.newPage();
      await page.goto("http://localhost:4313");
      await page
        .locator(".project-nav button")
        .filter({ hasText: data.project })
        .click();
      await page.getByRole("button", { name: data.board, exact: true }).click();
      await page.locator(".task-card").first().waitFor();
      assert.equal(await page.locator("html").getAttribute("lang"), locale);
      assert((await page.locator(".app-footer").innerText()).includes(version), "UI version differs from package metadata");
      assert.equal(
        await page.locator("html").getAttribute("dir"),
        ["fa", "ar"].includes(locale) ? "rtl" : "ltr",
      );
      const output = `docs/images/${locale}`;
      fs.mkdirSync(output, { recursive: true });
      const capture = async (name) => {
        await page.evaluate(async () => {
          await document.fonts.ready;
          await Promise.all(
            document
              .getAnimations()
              .filter((a) =>
                Number.isFinite(a.effect?.getComputedTiming().endTime),
              )
              .map((a) => a.finished.catch(() => {})),
          );
        });
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `${locale}: horizontal overflow`,
        );
        await page.screenshot({
          animations: "disabled",
          path: `${output}/${name}.png`,
        });
      };
      await capture("board-dark");
      await page
        .locator(".main-nav")
        .getByRole("button", { name: data.overview, exact: true })
        .click();
      await capture("overview-dark");
      await page
        .locator(".main-nav")
        .getByRole("button", { name: new RegExp(`^${data.tasks}`) })
        .click();
      await page.getByRole("button", { name: data.light, exact: true }).click();
      await capture("board-light");
      await page
        .locator(".task-open")
        .filter({ hasText: data.titles[0] })
        .click();
      await page
        .getByRole("heading", { name: data.attachments, exact: true })
        .waitFor();
      await capture("task-detail-light");
      console.log(`Captured ${locale}: four actual localized UI previews`);
    } finally {
      await context?.close();
      await new Promise((r) => server.close(r));
      db.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
} finally {
  await browser.close();
}
