# Team workflows in 0.2.0

## Search and inbox

Use **Search everything** in the top bar or **Ctrl / ⌘ K**. Enter at least two characters, then use the arrow keys and Enter. Search includes accessible, unarchived projects, tasks and references, sprint names/goals and page titles/content. Task results open the task; page and sprint results focus the matching resource. Results are capped at 30 tasks and 10 of each other kind.

The inbox collects assignments, discussions involving tasks you created, own or commented on, completions of your tasks, and approaching deadlines. Reminders cover assigned unfinished items due tomorrow or earlier, based on UTC calendar dates. They are deduplicated by assignee, task and deadline; passing the deadline updates the existing reminder to overdue without changing its read state. No desktop, push or notification email is sent. Membership removal hides inaccessible notifications immediately. The badge refreshes with live changes and once per minute while the page is visible.

## Recurrence and bulk edits

Choose **Repeat** and a due date when creating or editing a task. Changing its status to Done creates one next occurrence in To do. It preserves description, assignee, priority, labels, module and estimate; sprint and parent links are cleared so a new occurrence does not stay attached to an old sprint or parent. Reopening and completing the same task again does not duplicate it. Daily/weekly deadlines advance 1/7 days; monthly deadlines advance one calendar month and clamp to that month's last day.

**Bulk edit** works on up to 100 currently visible task results. Select items and change status, priority, assignee or sprint. Versions are checked and every change is committed together. A stale version cancels the operation, including recurrence and notifications. Refresh and select again after a conflict. Viewers cannot edit.

## Templates

New projects can start blank or use Product delivery, Campaign launch or Team operations. Each adds four editable tasks and a module, translated into the selected English/Persian/Arabic/Simplified Chinese interface language. It never translates existing user content.

## Sprint capacity and reports

Set a sprint's point capacity (0 means unset). **Sprint report** shows current scope, completed and remaining points, per-assignee delivery, unassigned effort, and recorded daily remaining work. Cancelled tasks are excluded. Over-capacity work is labelled explicitly.

Daily UTC snapshots start when this version observes or modifies the sprint. They are recorded on changes and report views, not by a scheduled background job. Missing days are not fabricated. Completed sprint history stays frozen; the current summary and workload still reflect tasks currently assigned to it. This release does not provide time tracking or velocity forecasting.

## Import and export

Open **Import & export** from a project's overview, tasks or settings. JSON exports portable tasks, sprints, modules and plain-text pages. Exported assignee email addresses are used for matching; treat the download as team data. Discussions, attachment contents, saved filters, links, activity history, accounts and credentials are excluded. Use a complete data-volume backup for disaster recovery.

Managers can select a JSON export or CSV, review the filename, count and destination, and add the imported items. Existing work is retained; IDs and parent, module, sprint and recurrence references are remapped. Invalid fields, missing references, cycles or conflicting recurrence sources roll back the entire import. Imported sprints start Planned. Assignees are matched to active workspace members by email; unmatched assignees are left unassigned and counted in the result.

Limits: 1.5 MB per file and 500 items per entity type. Large exports may need splitting before import.

CSV requires **title**, **Summary** or **name**. Optional columns:

| Column              | Accepted values                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------- |
| description         | Plain text, including quoted newlines                                                     |
| status              | backlog, todo, doing, review, done, cancelled; also To do, In Progress, In Review, Closed |
| priority            | urgent, high, medium, low, none; also Highest, Lowest                                     |
| due_date / Due date | Valid `YYYY-MM-DD` date                                                                   |
| estimate            | Integer from 0 to 1000                                                                    |
| labels              | Labels separated by semicolons or Persian commas                                          |

Quoted cells, escaped quotes, UTF-8 BOM and CRLF are supported. This is a generic CSV import, not a complete proprietary project-management migration.
