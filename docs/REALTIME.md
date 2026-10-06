# Live collaboration

TaskOrbit 0.1.10 streams authenticated, same-origin server events at `/api/events`. Web, PWA and native clients connected to that server use the same synchronization path. No extra container, broker or database service is required.

Successful changes invalidate the affected workspace or project. Events contain resource identifiers, not task contents, account credentials or session tokens. Clients fetch related data through the normal permission-checked API. Open task details, comments, files and relationships update without a full page reload. Unsaved forms and comment drafts are preserved; simultaneous edits still use task/page version checks to prevent lost updates. This is live work-data synchronization, not simultaneous character-by-character editing.

Workspace access is checked again for each recipient. Membership changes notify the affected account to refresh its access; removed members receive no later workspace events. Logout, changed passwords and account deactivation invalidate open streams. A heartbeat verifies idle sessions every 20 seconds. Slow consumers are disconnected rather than accumulating unbounded output buffers. There is a limit of ten streams per user and 1,000 per server.

Every connection and reconnection sends a `ready` event that triggers a fresh snapshot. Browser EventSource reconnects after network interruptions; foreground/online events also refresh data missed while a device was asleep. No offline edits are queued.

Reverse proxies must stream responses: disable proxy buffering and shared caching, and allow an idle timeout longer than the 20-second heartbeat. The [aaPanel deployment](AAPANEL.md) already disables buffering and uses a 90-second timeout. The server also sends `X-Accel-Buffering: no` and `Cache-Control: no-store`. Private API data and event streams are excluded from the PWA service-worker cache.

Tests use temporary databases: `npm test` covers authorization and event scopes; `npm run test:e2e` verifies updates in independent browser contexts, draft preservation and reconnect. `node scripts/test-native-windows.mjs <built-taskorbit.exe>` exercises the real Windows client on a disposable runner and refuses to overwrite an existing server configuration.

Authenticated sessions and personal MCP/API tokens have independent 300-request-per-minute quotas. Anonymous or invalid credentials share the IP quota. A temporarily failed data refresh retains its full-refresh intent and retries after five seconds; a new event may trigger an earlier refresh. SDK MCP writes use the same normal API and therefore publish the same scoped live events.
