import fs from "node:fs";
import path from "node:path";
const dir = process.argv[2] || "release-files",
  version =
    process.env.GITHUB_REF_NAME?.replace(/^v/, "") ||
    JSON.parse(fs.readFileSync("package.json", "utf8")).version;
if (!/^\d+\.\d+\.\d+$/.test(version)) throw Error("Invalid release version");
const files = fs.readdirSync(dir);
const platforms = {};
function add(target, pattern) {
  const matches = files.filter((f) => pattern.test(f));
  if (matches.length !== 1)
    throw Error(
      `Expected one updater package for ${target}, got ${matches.length}`,
    );
  const name = matches[0],
    signature = fs.readFileSync(path.join(dir, name + ".sig"), "utf8").trim();
  if (!signature || fs.statSync(path.join(dir, name)).size === 0)
    throw Error("Empty update artifact");
  platforms[target] = {
    signature,
    url: `https://github.com/sajadjanat/taskorbit/releases/download/v${version}/${encodeURIComponent(name)}`,
  };
}
add("windows-x86_64", /x64-setup\.exe$/);
add("darwin-aarch64", /aarch64\.app\.tar\.gz$/);
add("darwin-x86_64", /x64\.app\.tar\.gz$/);
add("linux-x86_64", /amd64\.AppImage$/);
// Newer updater runtimes select package-specific targets; keep the generic AppImage target too.
platforms["windows-x86_64-nsis"] = platforms["windows-x86_64"];
platforms["darwin-aarch64-app"] = platforms["darwin-aarch64"];
platforms["darwin-x86_64-app"] = platforms["darwin-x86_64"];
platforms["linux-x86_64-appimage"] = platforms["linux-x86_64"];
if (files.some((f) => /amd64\.deb\.sig$/.test(f)))
  add("linux-x86_64-deb", /amd64\.deb$/);
fs.writeFileSync(
  path.join(dir, "latest.json"),
  JSON.stringify(
    {
      version,
      notes: fs.readFileSync("docs/RELEASE-NOTES.md", "utf8"),
      pub_date: new Date().toISOString(),
      platforms,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Updater manifest ${version}: ${Object.keys(platforms).join(", ")}`,
);
