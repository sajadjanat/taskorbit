# Product scope and remaining work

The 0.2 preview implements the core workflows listed in README. Completed release work and the longer-term product roadmap are tracked separately.

## Added in 0.2.0

- Search across accessible projects, tasks, sprints and pages, with keyboard navigation.
- Assignment/discussion/completion/deadline inbox, recurrence and optimistic atomic bulk edits.
- Localized starter templates, JSON work-data transfer and generic CSV task import.
- Sprint point capacity, current workload and recorded daily remaining-work history.
- Optional SMTP password reset and clearer assistance when mail is not configured.
- UI refinements for RTL, mobile dialogs, card boundaries and empty-project guidance.

## Before calling the product production-ready

- Verify installation and server connection on physical Windows, Mac, Linux and Android devices; producing installer files alone does not verify those flows.
- Verify PWA installation on a physical iPhone, cookies across installed/browser contexts and background/resume behavior.
- Measure server idle/load memory, database growth, concurrent users and backup restoration; report hardware and workload alongside results.
- A formal security review, administrative setup provisioning, upload quotas and operational monitoring.
- Release signing and macOS notarization; Android key escrow and recovery owned by the maintainer.
- Verify configured SMTP delivery in an operated instance. Account invitations and email/desktop/push notifications remain pending.

## Additional project management capabilities

- Custom workflows/statuses and private projects with project-specific access roles.
- Rich text / Markdown rendering with sanitization, inline images and editable checklists.
- Triage intake and duplicate detection beyond the notification inbox.
- Continuous daily history collection, velocity and time tracking beyond current capacity/workload reports.
- Task order/reordering, additional grouping/sorting and calendar/gantt start/end intervals.
- Full-fidelity restoration of discussions, files and relationships; tool-specific migrations, webhooks and additional integrations. JSON/CSV work-data transfer, personal API tokens and MCP are implemented.
- Collaborative text editing and presence indicators; live data synchronization is implemented through authenticated server events.
- Indexed full-text search and project pagination for large data sets.
- Additional interface languages beyond English/Persian/Arabic/Simplified Chinese, with native-speaker review. User-written task content is preserved when switching the interface language; documentation fixtures use separately localized fictional data.
- Offline edits and conflict-aware synchronization.
- Mobile app distribution beyond the initial Android arm64 APK. iPhone uses PWA in this release.

Shipping core code does not establish completion of the roadmap or multi-device runtime verification.
