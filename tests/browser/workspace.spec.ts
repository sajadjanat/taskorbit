import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { messages } from "../../src/lib/i18n";
test("setup, project, sprint, work item, comment, language and persistence", async ({
  page,
  request,
}, testInfo) => {
  await page.addInitScript(() =>
    localStorage.setItem("taskorbit.locale", "en"),
  );
  const setup = (await (await request.get("/api/setup")).json()).required;
  await page.goto("/");
  if (setup) {
    await page.getByLabel("Name", { exact: true }).fill("Demo administrator");
    await page.getByLabel("Workspace", { exact: true }).fill("Orbit studio");
  }
  await page.getByLabel("Email", { exact: true }).fill("demo@example.test");
  await page.getByLabel("Password", { exact: true }).fill("demo-only-password");
  await page
    .getByRole("button", { name: "Show password", exact: true })
    .click();
  await page
    .getByRole("button", { name: setup ? "Create" : "Sign in", exact: true })
    .click();
  await expect(page.locator(".user-block strong")).toHaveText(
    "Demo administrator",
  );
  const mobile = (page.viewportSize()?.width || 1280) < 760;
  const nav = async (name: string | RegExp) => {
    if (mobile) await page.locator(".mobile-toggle").click();
    await page
      .locator(".main-nav")
      .getByRole("button", { name, exact: typeof name === "string" })
      .click();
  };
  if (mobile) await page.locator(".mobile-toggle").click();
  await page
    .getByRole("button", { name: "New project", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Name", { exact: true })
    .fill("Launch " + testInfo.project.name);
  await dialog
    .getByLabel("Identifier", { exact: true })
    .fill(testInfo.project.name === "chromium" ? "WEB" : "IOS");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  if (mobile && (await page.locator(".mobile-backdrop").isVisible()))
    await page.locator(".mobile-backdrop").click({
      position: { x: (page.viewportSize()?.width || 390) - 12, y: 12 },
    });
  await nav("Sprints");
  await page.getByRole("button", { name: "New sprint", exact: true }).click();
  await dialog.getByLabel("Name", { exact: true }).fill("Sprint 01");
  await dialog
    .getByLabel("Goal", { exact: true })
    .fill("Deliver our first team workspace");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Sprint 01", exact: true }),
  ).toBeVisible();
  await nav(/Work items/);
  await page
    .locator(".header-actions")
    .getByRole("button", { name: "New work item", exact: true })
    .click();
  await dialog
    .getByLabel("Title", { exact: true })
    .fill("Design the onboarding flow");
  await dialog
    .getByLabel("Description", { exact: true })
    .fill("Keep the setup short and clear.\nSupport Persian and English.");
  await dialog
    .getByLabel("Labels (comma separated)")
    .fill("design, onboarding");
  await dialog.getByLabel("Estimate (points)").fill("3");
  await dialog.getByLabel("Sprint", { exact: true }).click();
  await page.getByRole("option", { name: "Sprint 01", exact: true }).click();
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole("button", { name: /Design the onboarding flow/ })
    .click();
  await dialog.getByLabel("Add a comment").fill("Ready for review.");
  await dialog.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    dialog.getByText("Ready for review.", { exact: true }),
  ).toBeVisible();
  await dialog.locator("input[type=file]").setInputFiles({
    name: "brief.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("TaskOrbit sample brief"),
  });
  await expect(dialog.getByRole("link", { name: /brief.txt/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.reload();
  await nav(/Work items/);
  await expect(
    page.getByRole("button", { name: /Design the onboarding flow/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "Timeline", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No due date" }),
  ).toBeVisible();
  const scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(
    scan.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    ),
  ).toEqual([]);
  await page.getByRole("button", { name: "Language", exact: true }).click();
  await page.getByRole("menuitem", { name: "فارسی", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  for (const [currentLabel, language, direction, taskLabel] of [
    ["زبان", "العربية", "rtl", "المهام"],
    ["اللغة", "简体中文", "ltr", "任务"],
    ["语言", "فارسی", "rtl", "کارها"],
  ]) {
    await page.getByRole("button", { name: currentLabel, exact: true }).click();
    await page.getByRole("menuitem", { name: language, exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", direction);
    await expect(
      page
        .locator(mobile ? ".mobile-bottom-nav" : ".main-nav")
        .getByRole("button", { name: new RegExp(`^${taskLabel}`) }),
    ).toBeVisible();
  }
  await page.getByRole("button", { name: "برد", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `work/screenshots/${testInfo.project.name}-fa.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "تیره", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  // Scan the settled theme, after button color transitions finish.
  await page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) => {
          const end = animation.effect?.getComputedTiming().endTime;
          return typeof end === "number" && Number.isFinite(end);
        })
        .map((animation) => animation.finished.catch(() => {})),
    );
  });
  const darkScan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(
    darkScan.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    ),
  ).toEqual([]);
  await page.screenshot({
    path: `work/screenshots/${testInfo.project.name}-fa-dark.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "روشن", exact: true }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.display).toBe("standalone");
  expect((await request.get("/apple-touch-icon.png")).status()).toBe(200);
  expect((await request.get("/sw.js")).status()).toBe(200);
  const cache = await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    return Promise.all(
      (await caches.keys()).map(async (key) =>
        (await (await caches.open(key)).keys()).map((r) => r.url),
      ),
    );
  });
  expect(cache.flat().some((url) => url.includes("/api/"))).toBe(false);
  if (mobile) await page.locator(".mobile-toggle").click();
  await page
    .getByRole("button", { name: messages.fa.logout, exact: true })
    .click();
  await expect(
    page.getByLabel(messages.fa.password, { exact: true }),
  ).toHaveValue("");
  await expect(
    page.getByLabel(messages.fa.password, { exact: true }),
  ).toHaveAttribute("type", "password");
});
