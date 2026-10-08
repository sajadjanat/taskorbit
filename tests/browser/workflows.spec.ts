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
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).not.toBeVisible();
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
