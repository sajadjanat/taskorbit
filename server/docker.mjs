import http from "node:http";
export function dockerClient(socketPath = "/var/run/docker.sock") {
  return async (method, route, body) =>
    new Promise((resolve, reject) => {
      const request = http.request(
        {
          socketPath,
          method,
          path: route,
          headers: body ? { "Content-Type": "application/json" } : {},
        },
        (response) => {
          let data = "";
          response.setEncoding("utf8");
          response.on("data", (chunk) => {
            data += chunk;
            if (data.length > 16 * 1024 * 1024) {
              request.destroy(new Error("Docker response exceeds limit"));
            }
          });
          response.on("end", () => {
            if (response.statusCode >= 300) {
              const e = new Error(
                `Docker ${method} ${route.split("?")[0]} failed (${response.statusCode})`,
              );
              e.status = response.statusCode;
              return reject(e);
            }
            if (!data) return resolve(undefined);
            try {
              const parsed = JSON.parse(data);
              if (parsed?.error)
                return reject(new Error("Image download failed"));
              resolve(parsed);
            } catch {
              try {
                const lines = data
                  .trim()
                  .split("\n")
                  .map((line) => JSON.parse(line));
                if (lines.some((line) => line.error))
                  throw new Error("Image download failed");
                resolve(lines);
              } catch (e) {
                reject(e);
              }
            }
          });
        },
      );
      request.setTimeout(10 * 60 * 1000, () =>
        request.destroy(new Error("Docker operation timed out")),
      );
      request.on("error", reject);
      request.end(body ? JSON.stringify(body) : undefined);
    });
}
