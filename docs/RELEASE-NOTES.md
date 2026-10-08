# TaskOrbit 0.2.0 — team workflows and a clearer workspace

- Added global search across accessible tasks, projects, sprints and pages, with Ctrl / ⌘ K, arrow-key navigation and direct result navigation.
- Added an inbox for assignments, discussions, completions and approaching/overdue deadlines. Notifications respect membership and ownership, retain read state and avoid duplicate deadline reminders.
- Added daily, weekly and monthly task recurrence. Completing an occurrence creates its successor once, with calendar-safe dates and a fresh sprint/parent assignment.
- Added atomic bulk editing for up to 100 visible items. Stale versions cancel the complete change, preventing partial saves and duplicate recurrence.
- Added four-language Product delivery, Campaign launch and Team operations starter templates.
- Added JSON project export/import and generic CSV task import, with file/destination preview, validation, remapped references and all-or-nothing rollback. Discussions, files, links and saved views are excluded; this is not a complete backup.
- Added sprint point capacity, scope/completion/remaining-work summaries, team workload and recorded daily history. History begins with this version and only records observed days; no past data is invented. Current reports are not time tracking or velocity forecasting.
- Added optional SMTP password recovery. Single-use hashed reset links expire after 30 minutes; successful resets revoke sessions and API/MCP tokens. Without configured mail, the UI explains how to contact an administrator. External mail delivery is not configured or verified by default.
- Improved Persian/Arabic dialog alignment, mobile controls, card boundaries, search/inbox visibility and actionable empty states. Added transparent Mercury artwork and optimized WebP delivery.
- The existing MCP tools accept recurrence, project-template/locale and sprint-capacity fields. Existing authenticated live collaboration continues to update the new workflows.
- Updated a development dependency to eliminate the audit-reported shell-quote vulnerability.

## Upgrade

Back up your complete data volume, upgrade the server, then reload open web/PWA clients. Schema version 3 is additive and retains existing accounts, sessions, tasks and references. SMTP recovery requires private server configuration; see the [recovery guide](https://github.com/sajadjanat/taskorbit/blob/main/docs/PASSWORD-RECOVERY.md). See the [workflow guide](https://github.com/sajadjanat/taskorbit/blob/main/docs/WORKFLOWS.md) for import limits and recurrence/history behavior.

The release pipeline packages Windows x64, macOS Intel/Apple Silicon, Linux x64 DEB/AppImage, Android arm64 and the web/server archive. It also builds Linux amd64/arm64 server images at `ghcr.io/sajadjanat/taskorbit:v0.2.0`; `stable` advances only after all required publication checks pass. Desktop updater packages, signatures, `latest.json`, MCP bridge and checksums accompany a successful release.

## Verification limits

Local API/MCP/upgrade/workflow tests use temporary databases. Browser checks cover desktop Chromium and iPhone WebKit emulation, keyboard navigation, import/export, recurrence, bulk edits, reports, RTL and accessibility. Emulation does not establish physical-device installation. Release CI separately gates publication on Docker upgrade/rollback, native builds, Windows navigation, persistent Android signing and updater signatures.

Physical Mac/Linux/Android installation and iPhone PWA installation remain unverified. Windows/macOS OS code signing and macOS notarization are not configured; signed updater packages and the persistent Android APK signing key are configured in release CI. Editing requires connectivity. Private work data is not cached by the service worker. This release does not deploy or upgrade any existing production instance automatically. See [verification](https://github.com/sajadjanat/taskorbit/blob/main/docs/VERIFICATION.md) for recorded evidence.
