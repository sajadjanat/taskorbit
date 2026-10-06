import { test, expect } from "@playwright/test";
test("MCP settings create a token once, generate agent configs and revoke access", async ({
  page,
  request,
}, testInfo) => {
  const required = (await (await request.get("/api/setup")).json()).required;
  const login = await request.post(required ? "/api/setup" : "/api/login", {
    data: {
      email: "demo@example.test",
      password: "demo-only-password",
      ...(required
        ? { name: "Demo administrator", workspace: "Orbit studio" }
        : {}),
    },
  });
  expect(login.ok()).toBeTruthy();
  await page.context().addCookies((await request.storageState()).cookies);
  await page.goto("/");
  if ((page.viewportSize()?.width || 1280) < 760)
    await page.locator(".mobile-toggle").click();
  await page
    .locator(".main-nav")
    .getByRole("button", { name: /Settings/ })
    .click();
  const panel = page.locator(".mcp-panel");
  await expect(
    panel.getByRole("heading", { name: "AI integrations · MCP" }),
  ).toBeVisible();
  await panel
    .getByLabel("Token name", { exact: true })
    .fill(`UI agent ${testInfo.project.name}`);
  await panel
    .getByRole("button", { name: "Create token", exact: true })
    .click();
  const secret = panel.getByRole("textbox", { name: "MCP token", exact: true });
  await expect(secret).toHaveValue(/^to_/);
  const token = await secret.inputValue();
  expect(
    (
      await request.get("/api/me/token-info", {
        headers: { Authorization: `Bearer ${token}` },
      })
    ).ok(),
  ).toBeTruthy();
  const list = await (await request.get("/api/me/tokens")).json();
  expect(JSON.stringify(list)).not.toContain(token);
  await panel.getByRole("button", { name: "I have saved my token" }).click();
  await expect(secret).toHaveCount(0);
  const stored = await page.evaluate(() =>
    JSON.stringify({
      local: { ...localStorage },
      session: { ...sessionStorage },
    }),
  );
  expect(stored).not.toContain(token);
  await expect(panel.locator("pre")).toContainText("bearer_token_env_var");
  await panel.getByLabel("Agent / connection method").selectOption("cursor");
  await expect(panel.locator("pre")).toContainText("${env:TASKORBIT_TOKEN}");
  await panel
    .getByLabel("Agent / connection method")
    .selectOption("stdio-windows");
  await expect(panel.locator("pre")).toContainText('"command": "cmd"');
  await expect(panel.locator("pre")).toContainText("taskorbit-mcp-0.1.10.tgz");
  await expect(
    panel.getByRole("link", { name: /Full setup guide/ }),
  ).toHaveAttribute("href", /docs\/MCP\.md$/);
  page.once("dialog", (d) => d.accept());
  await panel
    .getByRole("button", {
      name: `Revoke UI agent ${testInfo.project.name}`,
      exact: true,
    })
    .click();
  await expect(
    panel.getByText(`UI agent ${testInfo.project.name}`, { exact: true }),
  ).toHaveCount(0);
  expect(
    (
      await request.get("/api/me/token-info", {
        headers: { Authorization: `Bearer ${token}` },
      })
    ).status(),
  ).toBe(401);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 2,
    ),
  ).toBeTruthy();
});
