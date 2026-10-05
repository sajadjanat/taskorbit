import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
mkdirSync("work/pwa-icons", { recursive: true });
const run = (args) => {
  const r = spawnSync(
    process.execPath,
    ["node_modules/@tauri-apps/cli/tauri.js", ...args],
    { stdio: "inherit" },
  );
  if (r.status) process.exit(r.status);
};
run(["icon", "assets/brand/taskorbit-icon.png", "-o", "src-tauri/icons"]);
writeFileSync(
  "src-tauri/icons/android/values/ic_launcher_background.xml",
  '<?xml version="1.0" encoding="utf-8"?>\n<resources><color name="ic_launcher_background">#171615</color></resources>\n',
);
run([
  "icon",
  "assets/brand/taskorbit-icon.png",
  "-o",
  "work/pwa-icons",
  "-p",
  "180",
  "-p",
  "192",
  "-p",
  "512",
]);
for (const [size, file] of [
  [180, "apple-touch-icon"],
  [192, "icon-192"],
  [512, "icon-512"],
])
  copyFileSync(`work/pwa-icons/${size}x${size}.png`, `public/${file}.png`);
copyFileSync("public/icon-192.png", "public/icon.png");
const png = readFileSync("assets/brand/taskorbit-icon.png").toString("base64");
writeFileSync(
  "work/pwa-icons/mask.svg",
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="#171615"/><image x="90" y="90" width="332" height="332" href="data:image/png;base64,${png}"/></svg>`,
);
run(["icon", "work/pwa-icons/mask.svg", "-o", "work/mask-icons", "-p", "512"]);
copyFileSync("work/mask-icons/512x512.png", "public/maskable-512.png");
