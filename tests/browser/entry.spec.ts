import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function entry(page: Page, setup = false) {
  await page.route("**/api/setup", (route) =>
    route.fulfill({ json: { required: setup } }),
  );
  await page.route("**/api/me", (route) =>
    route.fulfill({ status: 401, json: { error: "Unauthorized" } }),
  );
  await page.goto("/");
  await expect(page.locator(".entry-card")).toBeVisible();
}

test("entry defaults to English and supports accessible light/dark forms", async ({
  page,
}, testInfo) => {
  await entry(page, true);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(
    page.getByRole("heading", { name: "Set up your instance" }),
  ).toBeVisible();
  const password = page.getByLabel("Password", { exact: true });
  await password.fill("temporary-test-password");
  await page
    .getByRole("button", { name: "Show password", exact: true })
    .click();
  await expect(password).toHaveAttribute("type", "text");
  await expect(password).toHaveValue("temporary-test-password");
  await page
    .getByRole("button", { name: "Hide password", exact: true })
    .click();
  await expect(password).toHaveAttribute("type", "password");
  expect((await password.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  for (const theme of ["light", "dark"]) {
    if (theme === "dark")
      await page.getByRole("button", { name: "Dark", exact: true }).click();
    await expect(page.locator("html")).toHaveClass(
      theme === "dark" ? /dark/ : /^(?!.*\bdark\b)/,
    );
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        document
          .getAnimations()
          .map((animation) => animation.finished.catch(() => {})),
      );
    });
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(result.violations).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`setup-${theme}.png`),
      fullPage: true,
    });
  }
});

test("sign-in retains the selected language and recovers from an authentication error", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("taskorbit.locale"))
      localStorage.setItem("taskorbit.locale", "fa");
  });
  await entry(page);
  await expect(page.locator("html")).toHaveAttribute("lang", "fa");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.getByRole("button", { name: "زبان", exact: true }).click();
  await page.getByRole("menuitem", { name: "English", exact: true }).click();
  await page.route("**/api/login", async (route) => {
    await route.fulfill({
      status: 401,
      json: { error: "Invalid credentials" },
    });
  });
  await page.getByLabel("Email", { exact: true }).fill("sample@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("temporary-test-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeEnabled();
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue(
    "sample@example.test",
  );
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("native connection prioritizes the form and exposes updates on demand", async ({
  page,
  request,
}, testInfo) => {
  // Test-only IPC stub verifies the rendered connection UI, without navigating a real native client.
  await page.addInitScript(() => {
    const native = window as typeof window & {
      isTauri: boolean;
      __TAURI_INTERNALS__: unknown;
      connections: string[];
    };
    native.isTauri = true;
    native.connections = [];
    native.__TAURI_INTERNALS__ = {
      invoke: async (command: string, args: { address: string }) => {
        if (command === "saved_server") return "";
        if (command === "client_info")
          return { version: "0.1.8", platform: "android" };
        if (command === "check_client_update")
          return {
            android: true,
            version: "0.1.9",
            url: "https://github.com/sajadjanat/taskorbit/releases",
          };
        if (command === "connect_server") {
          native.connections.push(args.address);
          throw "The server could not be reached.";
        }
        throw Error(`Unexpected test IPC command: ${command}`);
      },
    };
  });
  await page.route("http://tauri.localhost/**", async (route) => {
    const source = new URL(route.request().url());
    const response = await request.get(
      `http://127.0.0.1:4312${source.pathname}${source.search}`,
    );
    await route.fulfill({ response });
  });
  await page.goto("http://tauri.localhost/");
  await expect(
    page.getByRole("heading", { name: "Server connection", exact: true }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator(".client-update-disclosure")).not.toHaveAttribute(
    "open",
  );
  await expect(
    page.getByRole("button", { name: "Check for updates", exact: true }),
  ).not.toBeVisible();
  await expect(page.locator(".update-summary")).toContainText("0.1.9");
  await page.screenshot({
    path: testInfo.outputPath("connection-light.png"),
    fullPage: true,
  });
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(result.violations).toEqual([]);
  await page.locator(".client-update-disclosure summary").click();
  await expect(
    page.getByRole("button", { name: "Check for updates", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Server URL", { exact: true })
    .fill("https://tasks.example.test");
  await page
    .getByRole("button", { name: "Connect to server", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "The server could not be reached.",
  );
  await expect(
    page.getByRole("button", { name: "Connect to server", exact: true }),
  ).toBeEnabled();
  expect(
    await page.evaluate(
      () => (window as unknown as { connections: string[] }).connections,
    ),
  ).toEqual(["https://tasks.example.test"]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
