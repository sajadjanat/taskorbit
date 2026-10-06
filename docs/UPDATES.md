# Updating TaskOrbit

## Self-hosted one-click server upgrades

Enable the updater when provisioning or upgrading your installation to 0.1.3:

```sh
docker compose -f compose.image.yaml -f compose.updates.yaml pull
docker compose -f compose.image.yaml -f compose.updates.yaml up -d
```

Use the same Compose project name and directory as your existing installation, so its named data volume is retained. For public HTTPS, also pass `-f compose.https.yaml` to every command and set `TASKORBIT_DOMAIN`. A custom reverse proxy works too. The application remains one container; the updater adds one container, and optional Caddy adds one more. A one-container installation can check releases but needs an operator to replace its image.

Sign in as the instance administrator → **Admin** → **Server updates** → **Check for updates** → **Install update**. Only newer published releases from the official repository are eligible. The updater downloads the fixed version image, pauses writes, stops the server gracefully, makes a cold database backup, checks its integrity, replaces the application container and waits for its version and health check. Downloads happen before downtime. Accounts, sessions, tasks, comments and attachment blobs live in the retained SQLite volume. There is a brief service interruption during replacement; the panel reconnects and reloads after completion.

If download fails, the existing server stays installed. If replacement or health verification fails, the previous container and database backup are restored. On an interrupted upgrade, the updater's persisted journal triggers recovery on restart. Editing remains paused if recovery cannot finish; the UI reports that an operator is required. Do not attempt another upgrade in that state. Backups are retained in `taskorbit-updates:/backups/<job-id>/`; make an independent off-host backup as well. Old upgrade backups are not deleted automatically, so monitor disk space and retain those needed for recovery.

The updater has no public port. Its control API requires a random token shared through a read-only volume; its private journal is readable only by the updater. It uses the local Docker socket and verifies instance labels and the named data volume before selecting a container. Docker socket access is host-level privilege: provision this service only on a host you administer. The application and remote clients do not receive that socket. Custom database paths, bind-mounted databases and replicated servers are not supported by this upgrade path.

The `stable` image follows fully published releases. The agent continues running while replacing the server; to update the agent itself, periodically run the same `pull` and `up -d` commands above. Avoid automatic external container updaters during an in-panel upgrade. After success, the new image is also tagged `stable` locally, keeping a subsequent Compose restart on the installed release.

### Recovery requiring operator attention

Keep both named volumes. Stop the updater and all application containers for this Compose project before inspecting/restoring any database. Inspect the updater logs and root-only `/updates/journal.json` locally; it can contain container environment configuration, so never publish it. The original container may remain with a `-rollback-<job-id>` suffix. Its backup contains checksummed database files and their original ownership. Use `upgradeStorage.restore(job)` from `server/upgrade-storage.mjs` only with that verified journal and both volumes mounted; it verifies all checksums before replacing files. Restore the prior version identified by `job.from`, restart it, and verify accounts and work items before clearing the recovery state. Never delete a volume to fix an upgrade.

## Desktop clients

Windows, macOS and Linux clients check the signed GitHub update manifest from the local connection screen. Use **Connection → Server connection and updates…** in the desktop menu to open it, and **Back to workspace** to return. The remembered server opens automatically on a new launch. Choose **Install update** to download and verify the package, then install and restart. Remote self-hosted pages have no native updater permissions. The updater signature is distinct from Windows code signing or macOS notarization, which are not configured in this preview.

If an older client opens a blank screen from its Connection menu, close it and install the current installer over it once. This fixes the local navigation code and preserves the saved server. Server data stays on the self-hosted server.

Clients before 0.1.3 need one manual installation of 0.1.3 to acquire the updater. The first updater-enabled release reports up to date until a newer version is published. Keep the persistent updater private key outside Git and configure `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` in release CI. Signing keys must remain consistent across releases.

## Android

The local connection screen checks the official release for a newer arm64 APK. **Download APK** opens that exact release asset. Android requires the user to approve package installation; retain the same APK signing key to update the existing installation. The saved server opens automatically on launch. Use the system Back action through the navigation history to return to the local screen; returning there does not repeat the startup redirect. Physical-device back/resume behavior remains on the verification checklist.

## Web, iPhone and iPad PWA

Web/PWA code comes from your own server. After the administrator upgrades it, connected clients check its version once a minute and offer **Reload app**. Save unfinished edits before accepting. Reloading retrieves the new UI; the service worker never caches private work data. There is no separate iOS binary or silent operating-system update.

## Release channel

Starting with 0.1.3, published releases are eligible for GitHub's `latest` endpoint and include `latest.json`, package signatures and `SHA256SUMS`. Publication requires successful web/API/browser checks, real Docker replacement and rollback fixtures, desktop packaging, APK signature verification and the multi-architecture container health check. This update channel does not imply that every physical-device or production-readiness check on the roadmap is complete.
