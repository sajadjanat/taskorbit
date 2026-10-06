# TaskOrbit 0.1.8 — consistent connection and sign-in

- English is the default for a new or invalid language preference. Existing valid language choices are preserved.
- Server connection, sign-in and initial setup share a responsive Mercury layout, consistent spacing, visible labels, 44 px form controls and accessible light/dark styling.
- Client updates are a compact disclosure below the connection form; new-version availability remains visible.
- Password visibility, appropriate autocomplete, busy feedback and recoverable error messages improve the entry workflow. Password fields and visibility state are cleared after successful sign-in and sign-out.
- Standard desktop File/Edit/Window/Help menus accompany a Connection menu for returning to the local connection and update screen.

- Transparent sunlit Mercury app icon for desktop and standard web icons. Android adaptive and iPhone/maskable home-screen tiles use a light stone surface where a solid background is required.
- Four-language interface with English, Persian, Arabic and Simplified Chinese selection, localized dates and Arabic/Persian RTL.
- Each translated README uses its own four actual UI previews, including localized fictional project/task data and task details.
- Smaller sidebar wordmark, with a compact 160 px footprint.
- Transparent Mercury wordmarks switch lettering for light and dark themes, without a black background.
- README presentation includes centered branding, badges, feature/download tables and actual application previews in four documentation languages.
- Instance administrator can check official releases and perform a one-click server upgrade with the optional updater container.
- Database backup and integrity verification precede replacement; failed health checks restore the previous server and database. Interrupted upgrades use a persistent recovery journal.
- Windows/macOS/Linux clients include a signed updater and a menu for returning to the local connection screen. Clients before 0.1.3 need one manual installation; 0.1.3 clients can use the in-app updater.
- Android checks newer releases and opens the persistent-key-signed APK for user-approved installation.
- Web/iPhone PWA detects a changed server version and offers reload after saving unfinished work.
- Mercury identity throughout the application; English main README and separate Persian, Arabic and Simplified Chinese README files.
- Independent TaskOrbit product descriptions across project documentation.

## Downloads

Windows x64 installer; macOS Intel and Apple Silicon DMGs; Linux x64 DEB/AppImage; Android arm64 APK; web/server archive. Desktop updater packages and signatures, latest.json and SHA256SUMS accompany them. Server image: ghcr.io/sajadjanat/taskorbit:v0.1.8 and :stable, Linux amd64/arm64. See [update guide](https://github.com/sajadjanat/taskorbit/blob/main/docs/UPDATES.md).

## Preview limitations

TaskOrbit remains an early preview with additional workflows on the roadmap. Installer builds do not establish physical-device installation or native server-connection verification. Windows/macOS OS code signing and macOS notarization are not configured; updater signatures are configured. Android is an APK without a Play Store listing. iPhone uses PWA without an App Store binary. Editing requires connectivity and private work data is not cached by the service worker. No production deployment is implied. See [roadmap](https://github.com/sajadjanat/taskorbit/blob/main/docs/ROADMAP.md) and [verification](https://github.com/sajadjanat/taskorbit/blob/main/docs/VERIFICATION.md).
