# Product scope and remaining work

The 0.1 preview implements the core workflows listed in README. Keep the workspace tracking card doing while the broader requested scope remains incomplete.

## Before calling the product production-ready

- Verify installation and server connection on physical Windows, Mac, Linux and Android devices; producing installer files alone does not verify those flows.
- Verify PWA installation on a physical iPhone, cookies across installed/browser contexts and background/resume behavior.
- Measure server idle/load memory, database growth, concurrent users and backup restoration; report hardware and workload alongside results.
- A formal security review, administrative setup provisioning, upload quotas and operational monitoring.
- Release signing and macOS notarization; Android key escrow and recovery owned by the maintainer.
- Password recovery by email, account invitations and email/desktop/push notifications.

## Additional project management capabilities

- Custom workflows/statuses and private projects with project-specific access roles.
- Rich text / Markdown rendering with sanitization, inline images and editable checklists.
- Triage inbox, duplicates, bulk actions and recurring tasks.
- Sprint burndown/history, velocity, capacity, time tracking and workload reporting.
- Task order/reordering, additional grouping/sorting and calendar/gantt start/end intervals.
- Import/export restoration and migration from other project management tools; API tokens, webhooks and integrations.
- Collaborative text editing and presence indicators; live data synchronization is implemented through authenticated server events.
- Search across projects and project pagination for large data sets.
- Additional interface languages beyond English/Persian/Arabic/Simplified Chinese, with native-speaker review. User-written task content is preserved when switching the interface language; documentation fixtures use separately localized fictional data.
- Offline edits and conflict-aware synchronization.
- Mobile app distribution beyond the initial Android arm64 APK. iPhone uses PWA in this release.

Shipping core code does not establish completion of the roadmap or multi-device runtime verification.
