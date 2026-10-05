import { createApp } from "./app.mjs";
const port = Number(process.env.PORT || 4310),
  host = process.env.HOST || "127.0.0.1";
const { app, db } = createApp({
  database: process.env.DATABASE_PATH || "data/taskorbit.sqlite",
});
const server = app.listen(port, host, () =>
  console.log(`TaskOrbit listening on http://${host}:${port}`),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () =>
    server.close(() => {
      db.close();
      process.exit(0);
    }),
  );
