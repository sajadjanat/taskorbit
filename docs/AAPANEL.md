# aaPanel deployment: board.sepehra.ir

TaskOrbit 0.1.10 is deployed at **https://board.sepehra.ir** using the published release image, also available as `ghcr.io/sajadjanat/taskorbit:stable`. The application and its updater are two containers; the existing aaPanel Nginx provides HTTPS. This installation does not add Caddy or a separate database container.

## Find it in aaPanel

- **Website → board.sepehra.ir**: domain, SSL certificate, Nginx configuration, reverse proxy and access/error logs.
- **Docker → Compose → taskorbit-board**: the application and updater, with start/stop/restart controls. Both also appear in the Docker container list.
- **Files → /opt/taskorbit-board**: deployment configuration and management scripts. The website document root `/www/wwwroot/board.sepehra.ir` is used for ACME certificate validation; application data lives in Docker volumes.

The site and Compose stack were registered through the installed aaPanel management classes. The stack's Compose project label is `705cc8f57d86e799d29f04c4b7f6f22f`, the MD5 of its displayed name, as required by this panel version. Preserve that project name and the named volumes when using the CLI.

## Configuration

The deployed files originate from [deploy/aapanel](../deploy/aapanel). Copy them together into `/opt/taskorbit-board` when reproducing this installation. These are settings for this host, so check ports and network overlap before using them elsewhere.

| Setting | Deployed value |
| --- | --- |
| Public origin | `https://board.sepehra.ir` |
| Host port | `127.0.0.1:4310` |
| App container | `taskorbit-board` |
| Updater container | `taskorbit-board-updater`, with no published port |
| Data volume | `taskorbit-board-data` |
| Updater journal/backups | `taskorbit-board-updates` |
| Docker network | `taskorbit-board`, `192.168.240.0/24` |
| Trusted proxy peer | `192.168.240.1`, the host gateway on that network |
| App / updater resource limits | 512 MiB / 1 CPU; 256 MiB / 0.5 CPU |
| Container log retention | Three 10 MiB files per container |

`app-entry.mjs` launches the published application with an explicit single-IP trusted proxy. Nginx overwrites `X-Forwarded-For` with its actual client address; it does not accept a caller-supplied forwarding chain. This lets rate limits distinguish clients behind the proxy. The launcher is mounted read-only and retained when the updater replaces the application container. The application has no Docker socket access; only the private updater has it.

Nginx redirects HTTP to HTTPS, accepts uploads up to 20 MiB, forwards requests to the loopback port, and disables the shared proxy cache. The application retains its own cache policy for public assets and private API responses.

## Certificates

A Let's Encrypt certificate is managed by Certbot. aaPanel's certificate paths point to its live certificate and key under `/etc/letsencrypt/live/board.sepehra.ir`. `certbot.timer` renews the certificate; the deployment hook validates and reloads the existing Nginx. ACME challenges are served from the website document root over HTTPS after the HTTP redirect.

The certificate is visible in aaPanel's SSL view. Keep Certbot as the renewal owner; if replacing the certificate through the panel, review the Certbot renewal configuration and certificate links together.

```sh
certbot renew --cert-name board.sepehra.ir --dry-run
systemctl status certbot.timer
```

## Accounts and updates

The initial administrator and workspace were provisioned before public proxy access was enabled. Public setup is closed. The unique initial password is stored privately outside the repository and is never included in deployment logs. Change it after signing in.

The instance administrator can check releases and install a newer server release from **Admin → Server updates**. The updater makes an integrity-checked backup before replacement and can roll back failed upgrades. The production installation was upgraded from 0.1.8 to 0.1.10 through this API on October 6, 2026: status reached `complete`, the backup was ready, and database integrity and aggregate work-record counts were preserved. The running application image ID matches the published 0.1.10 image; the updater pins an image ID during replacement. aaPanel still lists the site and both original container names. Production rollback was not needed; failed replacement and rollback were verified in isolated real-Docker CI fixtures. See [verification](VERIFICATION.md).

Live collaboration uses the application itself. Nginx disables buffering and caching for the proxy; receiving the authenticated initial event promptly verifies the public stream. Nginx consumes the `X-Accel-Buffering` response header, so its absence from the public response is expected.

To connect an agent, open **Settings → AI integrations · MCP**, create a personal token and follow the generated configuration. The remote endpoint is `https://board.sepehra.ir/mcp`; preserve the Host header in the proxy. MCP requires no additional container. See the [English](MCP.md), [Persian](MCP.fa.md), [Arabic](MCP.ar.md) or [Simplified Chinese](MCP.zh-CN.md) setup guide.

```sh
/opt/taskorbit-board/manage.sh ps
/opt/taskorbit-board/manage.sh logs --tail=100 taskorbit
/opt/taskorbit-board/manage.sh pull
/opt/taskorbit-board/manage.sh up -d
```

The last two commands refresh the containers from the published channel. For in-panel upgrades, let the TaskOrbit updater control the replacement; do not run another updater at the same time. Retain `app-entry.mjs` and both named volumes. Never run `down -v` to troubleshoot an installation.

## Backups

```sh
python3 /opt/taskorbit-board/backup.py
```

This reads the live database through SQLite's backup API, verifies the resulting snapshot and compresses it under `/opt/taskorbit-board/private/backups`, with root-only access. Attachments are stored in the database. It does not stop the application or change business data. An initial backup was taken after provisioning. The script is manual; no periodic or off-host backup is configured by this deployment. Keep independent backups outside the host and choose a retention policy before the workspace grows.

Upgrade backups are separately retained in `taskorbit-board-updates`. The updater's private journal can contain environment configuration; do not publish it. Disk monitoring, off-host backup and physical-device installation remain operational follow-up work.
