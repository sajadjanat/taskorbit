# TaskOrbit 0.1.1 preview

First self-hosted preview: projects, sprints, tasks, subtasks, Kanban/list/due-date timeline, modules, text documents, saved views, comments, files, relations, activity and team roles. Persian/English UI with RTL, light/dark themes and local fonts. One application container and SQLite volume, with optional Caddy HTTPS.

Native clients open a configurable connection screen and connect to your own HTTPS server. Packaging targets: Windows x64 NSIS, macOS Intel/Apple Silicon DMG, Linux x64 DEB/AppImage and signed Android arm64 APK. The web server source/build archive and GHCR amd64/arm64 image are also built. iPhone/iPad installation is via the self-hosted PWA, not an iOS App Store binary.

This is a preview, not full Plane feature parity. Installer build success is not physical-device testing. Windows/macOS builds are unsigned and macOS is not notarized. Online connectivity is required for work data. See docs/ROADMAP.md for limitations and remaining scope. No production deployment is implied by publishing this release.

Validation: 22 API tests, TypeScript/build, Chromium and iPhone-size WebKit workflows, desktop Rust tests, Docker container health smoke and Android APK signature verification passed. Desktop/server/image build: https://github.com/sajadjanat/taskorbit/actions/runs/37313292330. Android recovery build: https://github.com/sajadjanat/taskorbit/actions/runs/37314638147. The original Android job failed at SDK setup; the recovery workflow builds the same tag with corrected packaging setup. Full evidence and remaining device checks: https://github.com/sajadjanat/taskorbit/blob/main/docs/VERIFICATION.md.

Building Android from the source tag requires `npm pkg set scripts.tauri=tauri` before the Tauri Android build. The main branch includes this fix. The server image is public at `ghcr.io/sajadjanat/taskorbit:v0.1.1` for Linux amd64/arm64; the main branch includes `compose.image.yaml` for using it.
