import { readFileSync } from "node:fs";
export const VERSION = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
).version;
export const REPOSITORY = "sajadjanat/taskorbit";
export const IMAGE = "ghcr.io/" + REPOSITORY;
export function parseVersion(value) {
  if (typeof value !== "string" || !/^\d+\.\d+\.\d+$/.test(value))
    throw new Error("Invalid release version");
  const parts = value.split(".").map(Number);
  if (parts.some((n) => !Number.isSafeInteger(n)))
    throw new Error("Invalid release version");
  return parts;
}
export function newer(next, current) {
  const a = parseVersion(next),
    b = parseVersion(current);
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}
export function validateRelease(data) {
  if (
    data.draft ||
    data.prerelease ||
    !/^v\d+\.\d+\.\d+$/.test(data.tag_name || "")
  )
    throw new Error("No eligible release");
  const version = data.tag_name.slice(1);
  parseVersion(version);
  const url = `https://github.com/${REPOSITORY}/releases/tag/v${version}`;
  if (data.html_url !== url) throw new Error("Untrusted release address");
  return {
    version,
    tag: "v" + version,
    url,
    notes: String(data.body || "").slice(0, 20000),
    published_at: data.published_at,
  };
}
export function releaseChecker(fetcher = fetch) {
  let cached,
    expires = 0,
    pending;
  return async () => {
    if (cached && Date.now() < expires) return cached;
    if (pending) return pending;
    pending = (async () => {
      const response = await fetcher(
        `https://api.github.com/repos/${REPOSITORY}/releases/latest`,
        {
          headers: {
            Accept: "application/vnd.github+json",
            "User-Agent": "TaskOrbit-update-check",
          },
          signal: AbortSignal.timeout(15000),
        },
      );
      if (!response.ok) throw new Error("Release service unavailable");
      const result = validateRelease(await response.json());
      cached = result;
      expires = Date.now() + 60000;
      return result;
    })();
    try {
      return await pending;
    } finally {
      pending = undefined;
    }
  };
}
export function updateAgentClient({
  url = process.env.UPDATE_AGENT_URL,
  tokenPath = process.env.UPDATE_TOKEN_PATH || "/updates/control-token",
  fetcher = fetch,
} = {}) {
  const enabled = url === "http://updater:4311";
  return {
    enabled,
    async request(route, body) {
      if (!enabled) throw new Error("One-click upgrades are not configured");
      const token = readFileSync(tokenPath, "utf8").trim();
      const response = await fetcher(url + route, {
        method: body ? "POST" : "GET",
        headers: {
          Authorization: "Bearer " + token,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(15000),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Upgrade service unavailable");
      return data;
    },
  };
}
