# Preview verification

Recorded on 2026-10-05. These checks describe the preview, not production readiness.

- 31 automated API/update tests passed using temporary SQLite databases: authentication, permissions, workspace isolation, optimistic updates, attachments, dependency cycles, sessions, update validation, concurrent upgrade rejection, backup integrity, rollback and interrupted recovery.
- TypeScript checking and Vite production build passed. Local Rust unit tests passed with the Windows GNU toolchain; release CI builds on each target OS.
- Local Chromium passed the full workflow in desktop and 390×844 mobile viewports, including Persian/English switching, public-only PWA cache and serious/critical axe accessibility checks. Physical-device installation is not established by viewport emulation.
- [Verification CI](https://github.com/sajadjanat/taskorbit/actions/runs/37324446459) passed Chromium and WebKit, Docker build/health, and real Docker upgrade/rollback fixtures. Disposable named volumes were used; user ID, password hash, login session and database schema were checked after replacement and rollback.
- [0.1.2 release build](https://github.com/sajadjanat/taskorbit/actions/runs/37320732815) successfully produced Windows x64, macOS Intel/Apple Silicon, Linux DEB/AppImage, signed Android arm64 APK, web/server archive and amd64/arm64 container image.
- The 0.1.3 release pipeline requires the real authenticated updater service fixture and package signature verification before publication. Its finished platform results must be checked at the release's linked Actions run.

Physical-device installation, native-client end-to-end update installation/server connection, iPhone PWA installation/resume, production deployment, backup restoration under concurrent production load and Windows/macOS OS code signing remain unverified or incomplete. Updater signatures and Android APK signing are distinct from OS code signing/notarization. See [ROADMAP.md](ROADMAP.md) and [UPDATES.md](UPDATES.md).
