import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";

async function workspace(
  page: Page,
  request: APIRequestContext,
  suffix: string,
) {
  const required = (await (await request.get("/api/setup")).json()).required;
  const response = await request.post(required ? "/api/setup" : "/api/login", {
    data: {
      email: "demo@example.test",
      password: "demo-only-password",
      ...(required
        ? { name: "Demo administrator", workspace: "Orbit studio" }
        : {}),
    },
  });
  expect(response.ok()).toBeTruthy();
  const ws = await (
    await request.post("/api/workspaces", {
      data: { name: `Workflows ${suffix}` },
    })
  ).json();
  const project = await (
    await request.post(`/api/workspaces/${ws.id}/projects`, {
      data: { name: "Team delivery", identifier: "FLOW" },
    })
  ).json();
  await page.context().addCookies((await request.storageState()).cookies);
  await page.goto("/");
  if ((page.viewportSize()?.width || 1280) < 760)
    await page.locator(".mobile-toggle").click();
  await page.getByRole("combobox", { name: "Workspace", exact: true }).click();
  await page.getByRole("option", { name: ws.name, exact: true }).click();
  if (await page.locator(".mobile-backdrop").isVisible())
    await page.locator(".mobile-backdrop").click({
      position: { x: (page.viewportSize()?.width || 390) - 12, y: 12 },
    });
  await expect(page.locator(".page-header h1")).toBeVisible();
  return { ws, project };
}
async function nav(page: Page, name: RegExp) {
  if ((page.viewportSize()?.width || 1280) < 760)
    await page.locator(".mobile-toggle").click();
  await page.locator(".main-nav").getByRole("button", { name }).click();
}
async function accessible(page: Page) {
  expect(
    (
      await new AxeBuilder({ page })
        .include('[role="dialog"]')
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
}
async function saveCreated(page: Page, resource: string) {
  const [response] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.request().method() === "POST" &&
        new URL(r.url()).pathname.endsWith(resource),
    ),
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Save", exact: true })
      .click(),
  ]);
  expect(response.status()).toBe(201);
  await expect(page.getByRole("dialog")).not.toBeVisible();
}

test("team account creation, Persian filter direction and glass themes", async ({
  page,
  request,
}, info) => {
  const { ws } = await workspace(
    page,
    request,
    `${info.project.name}-accounts`,
  );
  await nav(page, /^Team$/);
  await page
    .locator(".header-actions")
    .getByRole("button", { name: "Create user", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  const email = `created-${info.project.name}@example.test`;
  await dialog.getByLabel("Name", { exact: true }).fill("New teammate");
  await dialog.getByLabel("Email", { exact: true }).fill(email);
  await dialog
    .getByLabel("Password", { exact: true })
    .fill("test-password-123");
  await accessible(page);
  await saveCreated(page, "/members/create");
  await expect(
    page.getByRole("cell", { name: email, exact: true }),
  ).toBeVisible();
  const members = await (
    await request.get(`/api/workspaces/${ws.id}/members`)
  ).json();
  expect(members.find((m: { email: string }) => m.email === email).role).toBe(
    "member",
  );
  await page
    .locator(".topbar-actions")
    .getByRole("button", { name: "Language", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "فارسی", exact: true }).click();
  await nav(page, /کارها/);
  const status = page.locator(".filter-bar").getByRole("combobox").first();
  await expect(status).toHaveAttribute("dir", "rtl");
  await expect(status).toHaveCSS("text-align", "start");
  await status.click();
  await expect(page.getByRole("listbox")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("option").first()).toHaveCSS(
    "text-align",
    "start",
  );
  await page.screenshot({
    path: info.outputPath("persian-filters.png"),
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await nav(page, /تنظیمات/);
  const themes = page.getByRole("group", { name: "ظاهر", exact: true });
  await themes.getByRole("button", { name: "تیره", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(
    themes.getByRole("button", { name: "تیره", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.evaluate(async () => {
    await Promise.all(
      document.getAnimations().map((a) => a.finished.catch(() => {})),
    );
  });
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
      .violations,
  ).toEqual([]);
  await page.screenshot({
    path: info.outputPath("glass-dark.png"),
    fullPage: true,
  });
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await nav(page, /تنظیمات/);
  await themes.getByRole("button", { name: "روشن", exact: true }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await expect(page.locator(".topbar")).toHaveCSS("backdrop-filter", /blur/);
  await page.screenshot({
    path: info.outputPath("glass-light.png"),
    fullPage: true,
  });
});

test("global keyboard search opens a task; recurring completion and bulk editing persist", async ({
  page,
  request,
}, info) => {
  const { ws, project } = await workspace(
    page,
    request,
    `${info.project.name}-bulk`,
  );
  await expect(page.locator(".first-step img")).toBeVisible();
  await page.screenshot({
    path: info.outputPath("empty-project.png"),
    fullPage: true,
  });
  await nav(page, /Work items/);
  await page
    .locator(".header-actions")
    .getByRole("button", { name: "New work item", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  const taskTitle = `Weekly review ${info.project.name}`;
  await dialog.getByLabel("Title", { exact: true }).fill(taskTitle);
  await dialog.getByLabel("Due date", { exact: true }).fill("2026-10-15");
  await dialog.getByLabel("Repeat", { exact: true }).click();
  await page.getByRole("option", { name: "Every week", exact: true }).click();
  await saveCreated(page, "/tasks");
  await expect(page.locator(".recurrence-badge").first()).toHaveText(
    "Every week",
  );
  await page.keyboard.press("Control+k");
  const search = page.getByRole("combobox", { name: "Search your workspace" });
  await search.fill(taskTitle);
  await expect(
    page.getByRole("option", { name: new RegExp(taskTitle) }),
  ).toBeVisible();
  await accessible(page);
  await page.screenshot({
    path: info.outputPath("global-search.png"),
    fullPage: true,
  });
  await search.press("Enter");
  await expect(dialog.getByText(taskTitle, { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Bulk edit", exact: true }).click();
  await dialog.getByLabel("Select all", { exact: true }).check();
  await dialog.getByLabel("New value", { exact: true }).selectOption("done");
  await accessible(page);
  await dialog.getByRole("button", { name: /Apply changes/ }).click();
  await expect(dialog).not.toBeVisible();
  const rows = await (
    await request.get(`/api/projects/${project.id}/tasks`)
  ).json();
  expect(rows).toHaveLength(2);
  expect(
    rows.find((r: { status: string }) => r.status === "todo").due_date,
  ).toBe("2026-10-22");
  await page.reload();
  if ((page.viewportSize()?.width || 1280) < 760)
    await page.locator(".mobile-toggle").click();
  await page.getByRole("combobox", { name: "Workspace", exact: true }).click();
  await page.getByRole("option", { name: ws.name, exact: true }).click();
  if (await page.locator(".mobile-backdrop").isVisible())
    await page.locator(".mobile-backdrop").click({
      position: { x: (page.viewportSize()?.width || 390) - 12, y: 12 },
    });
  await nav(page, /Work items/);
  await expect(
    page.getByRole("button", { name: new RegExp(taskTitle) }),
  ).toHaveCount(2);
});

test("import preview, JSON download, sprint report and inbox work in Persian without overflow", async ({
  page,
  request,
}, info) => {
  const { project } = await workspace(
    page,
    request,
    `${info.project.name}-reports`,
  );
  const sprint = await (
    await request.post(`/api/projects/${project.id}/sprints`, {
      data: {
        name: "Delivery sprint",
        start_date: "2026-10-08",
        end_date: "2026-10-22",
        capacity: 5,
      },
    })
  ).json();
  await request.post(`/api/projects/${project.id}/tasks`, {
    data: { title: "Delivery milestone", sprint_id: sprint.id, estimate: 7 },
  });
  await nav(page, /Sprints/);
  await page
    .getByRole("button", { name: "Sprint report", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText("Over capacity", { exact: true }),
  ).toBeVisible();
  await accessible(page);
  await page.screenshot({
    path: info.outputPath("sprint-report.png"),
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await nav(page, /Work items/);
  await page
    .getByRole("button", { name: "Import & export", exact: true })
    .click();
  await dialog.getByLabel("Choose a file", { exact: true }).setInputFiles({
    name: "work.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      `Summary,status,estimate\nImported weekly review ${info.project.name},To do,3\n`,
    ),
  });
  await expect(dialog.getByText(/Ready to add/)).toBeVisible();
  await accessible(page);
  await dialog
    .getByRole("button", { name: "Add imported items", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toContainText("Import complete");
  const download = page.waitForEvent("download");
  await dialog
    .getByRole("button", { name: "Export project JSON", exact: true })
    .click();
  const file = await (await download).path();
  const exported = JSON.parse(await readFile(file!, "utf8"));
  expect(exported.schema).toBe("taskorbit-project");
  expect(exported.tasks).toHaveLength(2);
  expect(exported.users).toBeUndefined();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Language", exact: true }).click();
  await page.getByRole("menuitem", { name: "فارسی", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.getByRole("button", { name: "صندوق ورودی", exact: true }).click();
  await expect(
    dialog.getByText("همهٔ اعلان‌ها را دیده‌اید", { exact: true }),
  ).toBeVisible();
  await accessible(page);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /جست‌وجو در فضای کاری/ }).click();
  await page
    .getByRole("combobox", { name: "جست‌وجو در فضای کاری", exact: true })
    .fill(`Imported weekly review ${info.project.name}`);
  await expect(
    page.getByRole("option", {
      name: new RegExp(`Imported weekly review ${info.project.name}`),
    }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("search-persian.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("recovery provides administrator help when mail is not configured", async ({
  page,
}, info) => {
  await page.route("**/api/me", (route) =>
    route.fulfill({ status: 401, json: { error: "Unauthorized" } }),
  );
  await page.route("**/api/setup", (route) =>
    route.fulfill({ json: { required: false } }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Forgot password?", exact: true })
    .click();
  await expect(page.getByText(/Ask your instance administrator/)).toBeVisible();
  await page.screenshot({
    path: info.outputPath("recovery-help.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Back to sign in", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
});
