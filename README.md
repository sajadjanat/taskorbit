<p align="center"><img src="assets/brand/taskorbit-wordmark-v4-balanced.png" width="800" alt="TaskOrbit wordmark with sunlit Mercury as the central O" /></p>
<h1 align="center">TaskOrbit</h1>
<p align="center">A lighter orbit for team work. Self-hosted projects, sprints and work items.</p>

**Languages:** English · [Persian](README.fa.md) · [Arabic](README.ar.md) · [Simplified Chinese](README.zh-CN.md)

TaskOrbit is an independent, MIT-licensed implementation inspired by the project-management workflows of [Plane](https://github.com/sajadjanat/plane-persian). It does not contain Plane source code. The first release is an early preview, not full feature parity with Plane.

## Available in the preview

- Multiple workspaces and projects, project identifiers, colors and archiving.
- Sprints with goals, dates, planned/active/completed states and progress.
- Kanban with drag-and-drop, searchable list and due-date timeline.
- Task descriptions, priorities, assignees, sprint/module assignment, estimates, due dates and labels.
- Subtasks, related items and blocking dependencies with cycle prevention.
- Comments, activity history and attachments up to 10 MB each (20 per task).
- Modules, plain-text project documents and shared saved filters.
- Instance administrator, user creation/deactivation/password reset, workspace administrator/member/viewer roles.
- Persian and English, RTL and LTR, local fonts and light/dark appearance.
- Web app and iPhone/iPad PWA with an offline connection screen. Editing requires connectivity.
- Tauri clients for Windows, macOS, Linux and Android, with a user-supplied self-hosted server URL.
- One server container and a persistent SQLite volume. No Redis, message queue or separate database service.

README translations are available in four languages; the application interface currently supports Persian and English.

## Self-host locally (one container)

```sh
git clone https://github.com/sajadjanat/taskorbit.git
cd taskorbit
docker compose up -d --build
```

Open `http://localhost:4310`. Create the first administrator and workspace. There is no default password. Public registration closes after this account is created. The administrator then creates user accounts and adds them to a workspace from **Team**. A workspace is the permission boundary: all its members can see its projects.

To use the published multi-architecture image instead of building from source:

```sh
docker compose -f compose.image.yaml up -d
```

The public image is `ghcr.io/sajadjanat/taskorbit:v0.1.2` for Linux amd64 and arm64. For HTTPS with this image, combine `compose.image.yaml` with `compose.https.yaml` and set the same `TASKORBIT_DOMAIN` described below.

SQLite, attachments and account data persist in `taskorbit-data`. Do not use `docker compose down -v` unless you intend to delete them.

## Public server with HTTPS (two containers)

Point a domain at the server, permit inbound ports 80 and 443, and create a `.env`:

```dotenv
TASKORBIT_DOMAIN=tasks.example.com
```

```sh
docker compose -f compose.yaml -f compose.https.yaml up -d --build
```

The second container is Caddy, which obtains TLS certificates and proxies to TaskOrbit. Alternatively, use your existing reverse proxy and only the TaskOrbit container; set `APP_ORIGIN=https://tasks.example.com` and `NODE_ENV=production`. The origin must match the URL used by your browser. The application binds to loopback on the Docker host by default. Do not expose first-run setup until the owner is ready to create the administrator.

### Install on your devices

Download native clients from [Releases](https://github.com/sajadjanat/taskorbit/releases). Each launch opens a connection screen. Enter your own HTTPS server root URL, for example `https://tasks.example.com`, then sign in. The address is remembered; passwords are not stored by the native connection screen. Relaunch the client to choose another server. HTTP is permitted only for localhost development.

On **iPhone/iPad**, open your server in Safari → Share → **Add to Home Screen**. The installed PWA uses the same server and accounts. A secure HTTPS origin is required. The PWA caches only public icons and an offline screen; authenticated work data is not stored in the service-worker cache. No offline synchronization is included yet.

Windows installers and macOS apps are not code-signed/notarized in the preview. Android APKs require the repository's persistent release signing key; do not substitute a new key for each release. An App Store / Play Store listing is not included.

## Development

Requires Node.js 22.18+:

```sh
npm ci
npm run dev
```

Visit `http://localhost:5173` and set `APP_ORIGIN=http://localhost:5173` for the development API. For a built local server:

```sh
npm run build
npm start
```

`PORT` defaults to `4310`, `HOST` defaults to `127.0.0.1`, and `DATABASE_PATH` defaults to `data/taskorbit.sqlite`.

```sh
npm test
npm run build
npx playwright install chromium webkit
npm run test:e2e
```

Tests use temporary databases and do not touch `data/`. On machines where the Playwright browser download is unavailable, run `PLAYWRIGHT_CHANNEL=chrome npx playwright test --project=chromium` against installed Chrome (PowerShell: `$env:PLAYWRIGHT_CHANNEL='chrome'`). The WebKit mobile run is a browser-engine check, not a claim of physical iPhone testing.

For desktop development, install the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/), then `npm run desktop`. Build on the target OS with `npm run desktop:build -- --bundles nsis` (Windows), `--bundles dmg` (macOS), or `--bundles deb,appimage` (Linux). Android needs Java 17, Android SDK/NDK and `npx tauri android init` followed by `npx tauri android build --apk --target aarch64`.

## Backup and operations

The admin JSON export contains work data and user metadata, but excludes password hashes, sessions and attachment bytes. It is not a complete restore backup. For a complete backup, stop TaskOrbit, archive its `/data` volume, then start it again. See [operations](docs/OPERATIONS.md). The SQLite file holds attachment blobs, so backing up only the file while the server is actively writing is unsafe unless using SQLite's backup API.

The Compose resource settings cap the application at 512 MB and one CPU; these are limits, not measured idle-memory claims. SQLite WAL makes this suitable for a small team on one server instance. Do not run multiple replicas over a shared/network-mounted database file.

## Release and scope

Tag `v0.1.2` triggers verification, native packaging, a multi-architecture server image and a draft prerelease. Publication occurs only after all platform jobs succeed. See [release notes](docs/RELEASE-NOTES.md) and [roadmap](docs/ROADMAP.md) for implemented and remaining features.

Stack: React, TypeScript, Vite, Tailwind, genuine shadcn/ui source components, Express, Node's SQLite API and Tauri 2. Font: Vazirmatn (OFL). The Mercury wordmark and app icon use warm solar lighting, with stone/charcoal surfaces and gold accents throughout both UI themes. Brand artwork was generated from the owner's GitOrbit reference; see [brand details](assets/brand/WORDMARK.md).

## License

MIT. Generated component sources and bundled dependencies retain their original licenses. See [third-party notices](THIRD-PARTY-NOTICES.md).
