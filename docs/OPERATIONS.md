# Operations

Start using Docker Compose as described in README. `/api/health` checks the database connection and returns the version. Keep the server root at `/`, not a URL subpath, and match `APP_ORIGIN` to that public address. With HTTPS use `NODE_ENV=production` for Secure cookies.

For the deployed `board.sepehra.ir` instance, see the [aaPanel deployment guide](AAPANEL.md), including panel access, certificate renewal, backups and the Compose project identity.

## Complete volume backup

For a source checkout installed with Compose, on a Linux host:

```sh
docker compose stop taskorbit
docker compose run --rm --no-deps --entrypoint tar -v "$PWD/backups:/backups" taskorbit -czf /backups/taskorbit-data.tar.gz -C /data .
docker compose start taskorbit
```

Create `backups/` beforehand and ensure it is writable by the container's `node` user. Archive files contain sensitive account hashes, attachments and team data: restrict access and retain them outside the public repository. Test restores into a new empty volume before relying on backups. Do not overwrite an existing production volume as a test.

## Upgrade

Back up first, check release notes, pull the new version and run `docker compose up -d --build`. Database schema version 2 adds personal-token storage through additive initialization. Manual upgrades have no automatic downgrade support; the optional updater handles failed-upgrade recovery as described in [UPDATES.md](UPDATES.md). Keep the prior source/image and a known-good backup available.

## Deployment boundaries

One app instance, local SQLite WAL storage. Container settings are a 512 MB memory cap and 1 CPU cap, not a benchmark. Attachments are stored inside SQLite, with a 10 MB per-file and 20-files per-task limit. There is no instance-wide storage quota yet. Monitor host disk usage. Login/setup endpoints are rate-limited. No outbound email or third-party analytics is configured.

When using an existing reverse proxy, the application does not trust forwarded client-IP headers by default; rate limiting is based on the directly connected peer. Configure a precise trusted-proxy policy before enabling forwarded client IPs. Do not blindly trust arbitrary `X-Forwarded-For` values.
