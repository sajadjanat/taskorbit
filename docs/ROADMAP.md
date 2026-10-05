# Product scope and remaining work

The 0.1 preview implements the core workflows listed in README. It does not promise all Plane capabilities. Keep the workspace tracking card doing while the broader requested scope remains incomplete.

## Before calling the product production-ready

- Verify installation and server connection on physical Windows, Mac, Linux and Android devices; producing installer files alone does not verify those flows.
- Verify PWA installation on a physical iPhone, cookies across installed/browser contexts and background/resume behavior.
- Measure server idle/load memory, database growth, concurrent users and backup restoration; report hardware and workload alongside results.
- A formal security review, administrative setup provisioning, upload quotas and operational monitoring.
- Release signing and macOS notarization; Android key escrow and recovery owned by the maintainer.
- Password recovery by email, account invitations and email/desktop/push notifications.

## Additional Plane-style capabilities

- Custom workflows/statuses and private projects with project-specific access roles.
- Rich text / Markdown rendering with sanitization, inline images and editable checklists.
- Triage inbox, duplicates, bulk actions and recurring tasks.
- Sprint burndown/history, velocity, capacity, time tracking and workload reporting.
- Task order/reordering, additional grouping/sorting and calendar/gantt start/end intervals.
- Import/export restoration and migration from Plane/Jira; API tokens, webhooks and integrations.
- Real-time updates; current version refreshes project data every 15 seconds.
- Search across projects and project pagination for large data sets.
- Localization beyond Persian/English; a language selector for translated content is distinct from translating user-written task content.
- Offline edits and conflict-aware synchronization.
- Mobile app distribution beyond the initial Android arm64 APK. iPhone uses PWA in this release.

Shipping core code is not proof of Plane feature parity or multi-device runtime verification.
