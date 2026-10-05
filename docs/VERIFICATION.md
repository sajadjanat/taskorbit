# Preview verification

Recorded on 2026-10-05. These checks describe the preview, not production readiness.

- 22 API tests passed using temporary SQLite databases: authentication, permissions, workspace isolation, optimistic task updates, persistence, attachments, dependency cycles and session revocation.
- TypeScript checking and the Vite production build passed. The production dependency audit reported zero vulnerabilities at the time of the check.
- Playwright passed the project/sprint/task/comment/upload workflow in Chromium and iPhone-size WebKit. It checks language switching, the PWA manifest, private-data cache exclusion and serious/critical axe accessibility findings. WebKit emulation does not verify installation on a physical iPhone.
- [Verification CI](https://github.com/sajadjanat/taskorbit/actions/runs/37313287031) also built the Docker image and checked a running container's health endpoint.
- [Release build](https://github.com/sajadjanat/taskorbit/actions/runs/37313292330) passed desktop Rust unit tests and produced Windows x64 NSIS, macOS Intel/Apple Silicon DMG, Linux x64 DEB/AppImage and the web/server archive. Its original Android SDK step failed; Android is rebuilt separately with the corrected workflow.
- The public GHCR image `ghcr.io/sajadjanat/taskorbit:v0.1.1` has Linux amd64 and arm64 manifests, verified with anonymous registry access.

Physical-device installation, native-client end-to-end server connection, iPhone PWA installation/resume, production deployment, backup restoration under load and Windows/macOS code signing remain unverified or incomplete. See [ROADMAP.md](ROADMAP.md).

The `v0.1.1` source tag predates the Android Gradle npm-script fix. To build Android from that tag, first run `npm pkg set scripts.tauri=tauri`; the current main branch includes this script. Android SDK setup in CI uses `android-actions/setup-android@v4` with explicit `platform-tools`.
