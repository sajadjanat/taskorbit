// Documentation-only fixture. Uses an ephemeral database and fictional accounts.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { chromium } from "@playwright/test";
import { createApp } from "../server/app.mjs";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "taskorbit-docs-"));
const { app, db } = createApp({
  database: path.join(dir, "docs.sqlite"),
  serveStatic: true,
  secure: false,
  origin: "http://localhost:4313",
  checkRelease: async () => ({
    version: "0.1.4",
    url: "https://github.com/sajadjanat/taskorbit/releases/tag/v0.1.4",
  }),
  upgradeAgent: { enabled: false },
});
const server = app.listen(4313, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
let browser,
  cookie = "";
const call = async (url, body) => {
  const r = await fetch("http://localhost:4313/api" + url, {
    method: body ? "POST" : "GET",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw Error(`Fixture ${url}: ${r.status}`);
  if (r.headers.get("set-cookie"))
    cookie = r.headers.get("set-cookie").split(";")[0];
  return r.json();
};
try {
  await call("/setup", {
    name: "Demo administrator",
    email: "demo@example.test",
    password: "documentation-only-123",
    workspace: "Orbit studio",
  });
  const [workspace] = await call("/workspaces");
  const members = [(await call("/me")).id];
  for (const name of ["Alex Morgan", "Sam Rivera", "Taylor Chen"]) {
    const email = name.toLowerCase().replaceAll(" ", ".") + "@example.test";
    const user = await call("/admin/users", {
      name,
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
    name: "Mercury launch",
    identifier: "MRC",
    description: "A calm, focused launch for our team workspace.",
    color: "#b88645",
  });
  await call(`/workspaces/${workspace.id}/projects`, {
    name: "Customer experience",
    identifier: "CX",
    description: "Keep the next customer step clear.",
    color: "#7b8d80",
  });
  const sprint = await call(`/projects/${project.id}/sprints`, {
    name: "Sprint 03 — Ready for launch",
    goal: "Deliver a polished first workspace with reliable upgrades.",
    start_date: "2026-10-01",
    end_date: "2026-10-15",
    status: "active",
  });
  const items = [
    ["Map the onboarding journey", "backlog", "medium", ["design"]],
    ["Review team access roles", "backlog", "low", ["security"]],
    ["Write the launch checklist", "todo", "high", ["release"]],
    ["Polish the mobile workspace", "todo", "medium", ["mobile"]],
    ["Add the project guide", "todo", "low", ["docs"]],
    ["Build the sprint dashboard", "doing", "high", ["frontend"]],
    ["Verify the backup workflow", "doing", "urgent", ["server"]],
    ["Review the Mercury theme", "review", "medium", ["design"]],
    ["Test shared task filters", "review", "low", ["qa"]],
    ["Create the first workspace", "done", "medium", ["core"]],
    ["Ship Persian RTL layouts", "done", "high", ["i18n"]],
  ];
  let first;
  for (let i = 0; i < items.length; i++) {
    const [title, status, priority, labels] = items[i];
    const task = await call(`/projects/${project.id}/tasks`, {
      title,
      status,
      priority,
      labels,
      description: "Sample work item for the TaskOrbit documentation preview.",
      sprint_id: sprint.id,
      assignee_id: members[i % members.length],
      estimate: 3,
      due_date: "2026-10-12",
    });
    first ??= task;
  }
  await call(`/tasks/${first.id}/comments`, {
    body: "The next step is clear. Ready for the team review.",
  });
  browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
    headless: true,
  });
  const context = await browser.newContext({
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
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem("taskorbit.locale", "en");
    localStorage.setItem("taskorbit.theme", "dark");
  });
  await page.goto("http://localhost:4313");
  await page
    .locator(".project-nav button")
    .filter({ hasText: "Mercury launch" })
    .click();
  await page.getByRole("button", { name: "Board", exact: true }).click();

  await page.locator(".task-card").first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    animations: "disabled",
    path: "docs/images/taskorbit-board-dark.png",
  });
  await page
    .locator(".main-nav")
    .getByRole("button", { name: "Overview", exact: true })
    .click();
  await page.screenshot({
    animations: "disabled",
    path: "docs/images/taskorbit-overview-dark.png",
  });
  await page
    .locator(".main-nav")
    .getByRole("button", { name: /Work items/ })
    .click();
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await page.screenshot({
    animations: "disabled",
    path: "docs/images/taskorbit-board-light.png",
  });
  await page.getByRole("button", { name: "فارسی", exact: true }).click();
  await page.screenshot({
    animations: "disabled",
    path: "docs/images/taskorbit-fa-board.png",
  });
  console.log(
    "Captured four actual application views with disposable sample data",
  );
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
}
