# TaskOrbit 0.1.10 — live collaboration and AI agent connections

- Clients reopen their remembered self-hosted server automatically. Connection settings remain reachable without being redirected back into the workspace.
- Fixed the Windows blank screen from **Connection → Server connection and updates…**: the menu now uses the actual loaded local page instead of the initial `about:blank` address.
- Added a localized **Back to workspace** action. Server settings and signed updates retain local-only native permissions; remote servers receive no native updater access.
- Authenticated live events synchronize tasks, projects, sprints, modules, pages, saved views, comments, attachments, links and membership changes across connected web and native clients.
- Events respect current workspace access. Logout, session revocation and account deactivation close existing streams. Reconnection refreshes changes missed while offline.
- Related data is refreshed without reloading the page or replacing unsaved editor/comment drafts. Concurrent task and page saves retain optimistic conflict protection.
- No additional server service or container is required for live collaboration.
- Valid signed-in sessions receive independent API request quotas, so clients behind the same network do not block each other's synchronization. Invalid cookies retain the anonymous IP quota; rate-limit errors use the API JSON format. Temporarily failed refreshes retry without discarding pending changes.
- Removing a linked module refreshes the task reference too, so subsequent edits do not submit a deleted module identifier.

- Added personal expiring MCP/API tokens, shown once and stored as hashes, with read/write/admin permissions, immediate revocation and current workspace-role enforcement.
- MCP supports authenticated stateless Streamable HTTP and a versioned local stdio bridge. The full administrator catalog contains 48 tools; read-only/non-admin tokens expose fewer. Settings include clear four-language activation steps and generated Codex, Cursor, Claude Code and stdio configurations.
- Added the `taskorbit-mcp-0.1.10.tgz` release asset and four-language setup/troubleshooting guides. Both transports are tested against the official SDK; OAuth-only connectors are not supported in this release.

## Upgrade

If your existing desktop client opens a blank connection screen, close it and install the new installer over the current installation. The remembered server and normal server data are retained. Fixed clients can use the signed in-app updater normally. The administrator must upgrade the self-hosted server to enable live collaboration, then reload open web clients.

Windows x64 installer; macOS Intel and Apple Silicon DMGs; Linux x64 DEB/AppImage; Android arm64 APK; web/server archive. Desktop updater packages, signatures, `latest.json` and `SHA256SUMS` accompany them. Server image: `ghcr.io/sajadjanat/taskorbit:v0.1.10` and `:stable`, Linux amd64/arm64. See the [update guide](https://github.com/sajadjanat/taskorbit/blob/main/docs/UPDATES.md).

## Verification limits

Windows startup and the actual native menu/return path are exercised with WebView2, separately from browser IPC stubs. API and two-context browser tests cover live updates, drafts, reconnect and access revocation. Release CI verifies desktop packages, APK signing, updater signatures and Docker upgrade/rollback fixtures before publication. Physical Mac/Linux/Android installation and iPhone PWA installation remain unverified. Windows/macOS OS code signing and macOS notarization are not configured; signed updater packages and the persistent Android APK signing key are configured. Editing requires connectivity. Private work data is not cached by the service worker. See [verification](https://github.com/sajadjanat/taskorbit/blob/main/docs/VERIFICATION.md) and the [roadmap](https://github.com/sajadjanat/taskorbit/blob/main/docs/ROADMAP.md).
