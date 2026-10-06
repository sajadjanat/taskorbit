// Mounted at /app/aapanel-entry.mjs in the published server image.
import { isIP } from "node:net";
import { createApp } from "./server/app.mjs";

const proxyAddress = process.env.TRUSTED_PROXY_ADDRESS;
if (!isIP(proxyAddress || "")) {
  throw new Error("Set TRUSTED_PROXY_ADDRESS to the reverse proxy's single IP");
}
const { app, db } = createApp({
  database: process.env.DATABASE_PATH || "/data/taskorbit.sqlite",
});
app.set("trust proxy", [proxyAddress]);
const server = app.listen(4310, "0.0.0.0", () => {
  console.log("TaskOrbit aaPanel server listening on port 4310");
});
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
  });
}
