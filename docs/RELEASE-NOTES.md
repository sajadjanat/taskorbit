# TaskOrbit 0.1.2 — Mercury preview

The approved sunlit Mercury wordmark is used throughout the app and documentation. Light stone and dark charcoal surfaces with solar-gold accents replace the earlier blue theme. Updated native/PWA icons, mobile sign-in branding, Android adaptive-icon background and browser theme colors complete the identity.

The primary README is English-only, with separate linked Persian, Arabic and Simplified Chinese READMEs. Application UI languages remain Persian and English.

## Downloads and hosting

- Windows x64 NSIS installer.
- macOS Intel and Apple Silicon DMG.
- Linux x64 DEB and AppImage.
- Android arm64 APK signed with the persistent project release key.
- Web/server source and build archive; public Docker image `ghcr.io/sajadjanat/taskorbit:v0.1.2` for Linux amd64 and arm64.
- iPhone/iPad: open your own HTTPS server in Safari and choose Add to Home Screen to install the PWA.

Native clients ask for your self-hosted HTTPS server root URL. Hosting uses one application container and a persistent SQLite volume; optional Caddy HTTPS adds a second container. Use `compose.image.yaml` to run the published image. Back up the volume before upgrading; keep it to retain accounts, tasks and attachments.

## Verification and limits

The release workflow runs API tests, TypeScript/build, Chromium and iPhone-size WebKit workflows with light/dark accessibility scans, desktop Rust tests and APK signature verification. Publication waits for all platform build jobs to succeed. CI history and remaining checks are documented in [verification](https://github.com/sajadjanat/taskorbit/blob/main/docs/VERIFICATION.md).

This remains an early preview, with core projects/sprints/tasks/team administration rather than full Plane feature parity. Installer builds do not establish physical-device installation or native server-connection verification. Windows/macOS builds are unsigned; macOS is not notarized. Android is distributed as an APK, without a Play Store listing. iPhone uses PWA, without an App Store binary. Editing requires connectivity; private work data is not cached by the service worker. No production server deployment is implied by the release. See [roadmap](https://github.com/sajadjanat/taskorbit/blob/main/docs/ROADMAP.md).
