# TaskOrbit 0.2.2 — cleaner mobile workspace

- Added a fixed bottom navigation for Overview, Work items, Team and More, with safe-area spacing and accessible page selection.
- Mobile boards display one full-width status column at a time. Status tabs expose counts, support keyboard arrows in both reading directions and follow the selected status filter. Desktop boards retain all columns.
- Search, view controls and actions now fit small screens. Filters expand into a two-column grid, with a visible active-filter count.
- Work-item lists and Team tables become readable cards on mobile. Dialogs use full-width bottom sheets, scrollable content and larger inputs to avoid iOS input zoom.
- Mobile navigation locks background scrolling, manages focus, supports Escape and closes when opening a form. Closed navigation is excluded from keyboard focus.
- Light/Dark glass surfaces and Persian/Arabic direction remain available. Added browser checks at 320, 390 and 430 pixels for overflow, touch targets, status/filter behavior, forms and navigation focus.
- No database schema change since 0.2.1. All local API and browser checks use disposable databases.

## Included from 0.2.1

- Workspace administrators can create a user directly from Team, setting name, email, password and workspace role. Login and membership save in one transaction. New accounts remain ordinary instance users; existing emails are not overwritten. Share initial passwords privately; this flow does not send invitation emails.
- Account creation requires a signed-in session and workspace management permission. Members, viewers, unrelated users and API/MCP tokens cannot create account credentials.
- Persian and Arabic Radix selectors use RTL direction, logical padding and selection indicators. Filter text follows the locale reading direction.
- Added explicit Light/Dark choices in Appearance, persistent device preferences and system preference on first use.
- Added glass navigation, cards, dialogs and menus in both themes, with subtle warm ambient light, readable foregrounds and an opaque fallback for unsupported blur.
- Made the horizontally scrolling MCP configuration keyboard accessible on mobile Safari.
- No database schema change since 0.2.0. API and browser verification use disposable databases; see the verification guide for the recorded checks.

## Included from 0.2.0

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

The release pipeline packages Windows x64, macOS Intel/Apple Silicon, Linux x64 DEB/AppImage, Android arm64 and the web/server archive. It also builds Linux amd64/arm64 server images at `ghcr.io/sajadjanat/taskorbit:v0.2.2`; `stable` advances only after all required publication checks pass. Desktop updater packages, signatures, `latest.json`, MCP bridge and checksums accompany a successful release.

## Verification limits

Local API/MCP/upgrade/workflow tests use temporary databases. Browser checks cover desktop Chromium and iPhone WebKit emulation, keyboard navigation, import/export, recurrence, bulk edits, reports, RTL and accessibility. Emulation does not establish physical-device installation. Release CI separately gates publication on Docker upgrade/rollback, native builds, Windows navigation, persistent Android signing and updater signatures.

Physical Mac/Linux/Android installation and iPhone PWA installation remain unverified. Windows/macOS OS code signing and macOS notarization are not configured; signed updater packages and the persistent Android APK signing key are configured in release CI. Editing requires connectivity. Private work data is not cached by the service worker. This release does not deploy or upgrade any existing production instance automatically. See [verification](https://github.com/sajadjanat/taskorbit/blob/main/docs/VERIFICATION.md) for recorded evidence.
