export function serverAddress(value) {
  const u = new URL(value);
  if (
    u.username ||
    u.password ||
    (u.pathname !== "/" && u.pathname !== "") ||
    u.search ||
    u.hash ||
    (u.protocol !== "https:" &&
      !(
        u.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)
      ))
  ) {
    throw Error(
      "Use your HTTPS server root address, or HTTP localhost for development",
    );
  }
  return u.origin;
}
export function createApi(address, token, origin) {
  const base = serverAddress(address);
  if (!/^to_[A-Za-z0-9_-]{43}$/.test(token || ""))
    throw Error(
      "TASKORBIT_TOKEN must be a token created in Settings → AI integrations",
    );
  return async (
    path,
    method = "GET",
    body,
    binary = false,
    extraHeaders = {},
  ) => {
    if (!/^\/[a-zA-Z0-9_/?=&%.-]+$/.test(path) || path.includes(".."))
      throw Error("Invalid API path");
    let response;
    try {
      response = await fetch(base + "/api" + path, {
        method,
        redirect: "error",
        signal: AbortSignal.timeout(30000),
        headers: {
          Authorization: `Bearer ${token}`,
          ...(origin ? { Origin: origin } : {}),
          ...(body
            ? {
                "Content-Type": Buffer.isBuffer(body)
                  ? "application/octet-stream"
                  : "application/json",
              }
            : {}),
          ...extraHeaders,
        },
        body: body
          ? Buffer.isBuffer(body)
            ? body
            : JSON.stringify(body)
          : undefined,
      });
    } catch {
      throw Error(
        "Cannot reach TaskOrbit. Check the server root address, HTTPS certificate and network connection.",
      );
    }
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const hints = {
        401: "Token expired or revoked. Create a new token in Settings → AI integrations.",
        403: "Check token permissions and your workspace role.",
        409: "Read the current item and retry with its new version; do not overwrite changes blindly.",
        429: "Request quota reached. Wait before retrying.",
        503: "Server temporarily unavailable or upgrading. Retry later.",
      };
      throw Error(
        `HTTP ${response.status}: ${data.error || "Request failed"}${hints[response.status] ? " " + hints[response.status] : ""}`,
      );
    }
    return binary ? Buffer.from(await response.arrayBuffer()) : response.json();
  };
}
