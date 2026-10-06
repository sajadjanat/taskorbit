import { test, expect } from "@playwright/test";

test("two independent clients receive changes immediately without reloading or losing drafts", async ({
  browser,
  request,
}, testInfo) => {
  const required = (await (await request.get("/api/setup")).json()).required;
  const auth = await request.post(required ? "/api/setup" : "/api/login", {
    data: {
      email: "demo@example.test",
      password: "demo-only-password",
      ...(required
        ? { name: "Demo administrator", workspace: "Orbit studio" }
        : {}),
    },
  });
  expect(auth.ok()).toBeTruthy();
  const ws = await (
    await request.post("/api/workspaces", {
      data: { name: `Live ${testInfo.project.name}` },
    })
  ).json();
  const project = await (
    await request.post(`/api/workspaces/${ws.id}/projects`, {
      data: { name: "Live project", identifier: "LIVE" },
    })
  ).json();
  const task = await (
    await request.post(`/api/projects/${project.id}/tasks`, {
      data: { title: "Original live item" },
    })
  ).json();
  const a = await browser.newContext({
    ...testInfo.project.use,
    storageState: await request.storageState(),
  });
  const b = await browser.newContext({
    ...testInfo.project.use,
    storageState: await request.storageState(),
  });
  try {
    const pages = await Promise.all([a.newPage(), b.newPage()]);
    for (const page of pages) {
      await page.goto("/");
      const mobile = (page.viewportSize()?.width || 1280) < 760;
      if (mobile) await page.locator(".mobile-toggle").click();
      await page
        .getByRole("combobox", { name: "Workspace", exact: true })
        .click();
      await page.getByRole("option", { name: ws.name, exact: true }).click();
      await page
        .locator(".main-nav")
        .getByRole("button", { name: /Work items/ })
        .click();
      await expect(
        page.getByRole("button", { name: /Original live item/ }),
      ).toBeVisible();
      await page.getByRole("button", { name: /Original live item/ }).click();
    }
    const receiver = pages[1];
    await receiver.getByLabel("Add a comment").fill("Unsent local draft");
    const started = Date.now();
    expect(
      (
        await request.put(`/api/tasks/${task.id}`, {
          data: {
            ...task,
            title: "Changed on another client",
            status: "doing",
          },
        })
      ).ok(),
    ).toBeTruthy();
    await expect(
      receiver
        .getByRole("dialog")
        .getByText("Changed on another client", { exact: true }),
    ).toBeVisible({ timeout: 4000 });
    expect(Date.now() - started).toBeLessThan(4000);
    await expect(receiver.getByLabel("Add a comment")).toHaveValue(
      "Unsent local draft",
    );
    await request.post(`/api/tasks/${task.id}/comments`, {
      data: { body: "Comment from another device" },
    });
    for (const page of pages)
      await expect(
        page.getByText("Comment from another device", { exact: true }),
      ).toBeVisible({ timeout: 4000 });
    await request.post(`/api/tasks/${task.id}/attachments`, {
      headers: {
        "Content-Type": "application/octet-stream",
        "X-File-Name": "live-note.txt",
      },
      data: Buffer.from("Live file"),
    });
    await expect(
      receiver.getByRole("link", { name: /live-note.txt/ }),
    ).toBeVisible({ timeout: 4000 });
    await request.delete(`/api/tasks/${task.id}`);
    for (const page of pages) {
      await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 4000 });
      await expect(
        page.getByRole("button", { name: /Changed on another client/ }),
      ).toHaveCount(0);
    }
    // Suspend transport, mutate while disconnected, then verify reconnect catches up.
    await b.setOffline(true);
    await request.post(`/api/projects/${project.id}/tasks`, {
      data: { title: "Created while disconnected" },
    });
    await b.setOffline(false);
    await expect(
      receiver.getByRole("button", { name: /Created while disconnected/ }),
    ).toBeVisible({ timeout: 6000 });
  } finally {
    await a.close();
    await b.close();
  }
});
