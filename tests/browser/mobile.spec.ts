import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("mobile layout keeps full-width work, filters, team cards and dialogs usable at small widths", async ({
  page,
  request,
}, info) => {
  const required = (await (await request.get("/api/setup")).json()).required;
  expect(
    (
      await request.post(required ? "/api/setup" : "/api/login", {
        data: {
          email: "demo@example.test",
          password: "demo-only-password",
          ...(required
            ? { name: "Demo administrator", workspace: "Orbit studio" }
            : {}),
        },
      })
    ).ok(),
  ).toBeTruthy();
  const ws = await (
    await request.post("/api/workspaces", {
      data: { name: `Mobile ${info.project.name}` },
    })
  ).json();
  const project = await (
    await request.post(`/api/workspaces/${ws.id}/projects`, {
      data: { name: "پروژهٔ موبایل", identifier: "MOB" },
    })
  ).json();
  for (const [status, title] of [
    ["todo", "اولین کار موبایل"],
    ["todo", "بازبینی تجربهٔ کاربری"],
    ["backlog", "کار بعدی تیم"],
    ["done", "کار انجام‌شده"],
  ])
    expect(
      (
        await request.post(`/api/projects/${project.id}/tasks`, {
          data: { title, status },
        })
      ).ok(),
    ).toBeTruthy();
  await page.context().addCookies((await request.storageState()).cookies);
  await page.addInitScript(() => {
    localStorage.setItem("taskorbit.locale", "fa");
    localStorage.setItem("taskorbit.theme", "light");
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.locator(".mobile-toggle").click();
  await page.getByRole("combobox", { name: "فضای تیمی", exact: true }).click();
  await page.getByRole("option", { name: ws.name, exact: true }).click();
  await page.locator(".sidebar-close").click();
  const nav = page.getByRole("navigation", {
    name: "ناوبری اصلی",
    exact: true,
  });
  await nav.getByRole("button", { name: "کارها", exact: true }).click();
  await expect(page.getByRole("tabpanel")).toHaveCount(1);
  await expect(page.getByRole("tabpanel").locator(".task-card")).toHaveCount(2);
  await expect(page.locator(".filter-bar")).not.toBeVisible();
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const card = await page
      .getByRole("tabpanel")
      .locator(".task-card")
      .first()
      .boundingBox();
    expect(card!.width).toBeGreaterThan(width - 40);
    expect((await nav.boundingBox())!.width).toBeLessThanOrEqual(width);
    for (const item of await nav.getByRole("button").all())
      expect((await item.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({
      path: info.outputPath(`mobile-${width}-light.png`),
      fullPage: false,
    });
  }
  await page.getByRole("button", { name: "فیلترها", exact: true }).click();
  await page
    .locator(".filter-bar")
    .getByRole("combobox", { name: "وضعیت", exact: true })
    .click();
  await page.getByRole("option", { name: "انجام‌شده", exact: true }).click();
  await expect(page.getByRole("tab", { name: /انجام‌شده/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("tabpanel").locator(".task-card")).toHaveCount(1);
  await page
    .getByRole("button", { name: "پاک‌کردن فیلترها", exact: true })
    .click();
  await page.getByRole("tab", { name: /برای انجام/ }).click();
  await page.getByRole("button", { name: "فیلترها", exact: true }).click();
  await page.getByRole("button", { name: "تیره", exact: true }).click();
  await page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .filter((a) => Number.isFinite(a.effect?.getComputedTiming().endTime))
        .map((a) => a.finished.catch(() => {})),
    );
  });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: info.outputPath("mobile-dark.png"),
    fullPage: false,
  });
  await page.getByRole("button", { name: "فهرست", exact: true }).click();
  await expect(page.locator(".task-table tbody tr")).toHaveCount(4);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await nav.getByRole("button", { name: "تیم", exact: true }).click();
  await expect(page.locator(".members-table")).toBeVisible();
  await page.getByRole("button", { name: "ساخت کاربر", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("نام", { exact: true })).toBeVisible();
  expect((await dialog.boundingBox())!.width).toBe(430);
  expect(
    (await dialog.getByLabel("ایمیل", { exact: true }).boundingBox())!.height,
  ).toBeGreaterThanOrEqual(44);
  expect(
    (
      await new AxeBuilder({ page })
        .include('[role="dialog"]')
        .withTags(["wcag2a", "wcag2aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: info.outputPath("mobile-user-form.png"),
    fullPage: false,
  });
  await dialog.getByRole("button", { name: "انصراف", exact: true }).click();
  await nav.getByRole("button", { name: "بیشتر", exact: true }).click();
  await expect(page.locator(".sidebar-close")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator(".sidebar")).toHaveAttribute("inert", "");
  await expect(
    nav.getByRole("button", { name: "بیشتر", exact: true }),
  ).toBeFocused();
});
