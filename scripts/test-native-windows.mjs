// Exercises the real packaged WebView and native menu, not an IPC stub.
import { chromium } from "playwright";
import { createApp } from "../server/app.mjs";
import {
  mkdtempSync,
  mkdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
if (process.platform !== "win32")
  throw Error("Windows WebView test requires Windows");
const executable = process.argv[2];
if (!executable || !existsSync(executable))
  throw Error("Pass the built TaskOrbit executable");
const existing = process.argv.includes("--existing-config");
const file = path.join(
  process.env.APPDATA,
  "ir.sepehra.taskorbit",
  "server.txt",
);
if (!existing && existsSync(file))
  throw Error(
    "Refusing to overwrite an existing client configuration; use a disposable Windows runner",
  );
if (existing && !existsSync(file))
  throw Error("No existing server configuration");
const dir = mkdtempSync(path.join(tmpdir(), "taskorbit-native-"));
const { app, db, closeRealtime } = createApp({
  database: path.join(dir, "test.sqlite"),
  secure: false,
});
const server = app.listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const target = existing
  ? readFileSync(file, "utf8").trim()
  : `http://127.0.0.1:${server.address().port}/`;
if (!existing) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, target);
}
let clientId, browser;
try {
  const debugPort = 8767;
  clientId = Number(
    execFileSync(
      "pwsh",
      [
        "-NoProfile",
        "-File",
        "scripts/launch-native.windows.ps1",
        "-Executable",
        path.resolve(executable),
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          WEBVIEW2_USER_DATA_FOLDER: path.join(dir, "webview"),
          WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${debugPort} --no-proxy-server`,
        },
      },
    ).trim(),
  );
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`);
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  assert.ok(browser, "Native WebView must start");
  const page = browser.contexts()[0].pages()[0];
  await page.waitForURL(target, { timeout: 20000 });
  console.log("Remembered server opened automatically.");
  let localSettings;
  for (let round = 0; round < 3; round++) {
    execFileSync("pwsh", [
      "-NoProfile",
      "-File",
      "tests/native-menu.windows.ps1",
      "-TaskProcessId",
      String(clientId),
    ]);
    await page
      .getByRole("heading", { name: "Server connection", exact: true })
      .waitFor({ timeout: 10000 });
    assert.notEqual(page.url(), "about:blank");
    localSettings = page.url();
    await page
      .getByRole("button", { name: "Back to workspace", exact: true })
      .click();
    await page.waitForURL(target, { timeout: 15000 });
  }
  const denied = await page.evaluate(async () => {
    try {
      await window.__TAURI_INTERNALS__.invoke("client_info");
      return false;
    } catch {
      return true;
    }
  });
  assert.equal(
    denied,
    true,
    "Remote server must not gain native command access",
  );
  const root = new URL(localSettings);
  root.search = "";
  await page.goto(root.href);
  await page
    .getByRole("heading", { name: "Server connection", exact: true })
    .waitFor({ timeout: 10000 });
  await page.waitForTimeout(300);
  assert.equal(
    page.url(),
    root.href,
    "Returning through browser/mobile history must not trigger another startup redirect",
  );
  await page
    .getByRole("button", { name: "Back to workspace", exact: true })
    .click();
  await page.waitForURL(target, { timeout: 15000 });
  console.log(
    "Native menu and return path passed 3 cycles; remote IPC rejected.",
  );
} finally {
  if (browser) await browser.close().catch(() => {});
  if (clientId) {
    try {
      execFileSync("taskkill", ["/PID", String(clientId), "/T", "/F"], {
        stdio: "ignore",
      });
    } catch {}
  }
  if (!existing) unlinkSync(file);
  closeRealtime();
  await new Promise((r) => server.close(r));
  db.close();
  // The validated temporary directory is the only cleanup target.
  assert.equal(path.dirname(dir), tmpdir());
  try {
    rmSync(dir, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    });
  } catch {
    console.log("Temporary WebView profile remains locked; cleanup deferred.");
  }
}
