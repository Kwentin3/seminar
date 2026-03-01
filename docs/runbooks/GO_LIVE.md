⚠️ LEGACY DEPLOY (systemd + nginx) — DEPRECATED

Production baseline since 2026-03-01:
Docker + Traefik + GHCR pinned digest.

Legacy flow allowed only for rollback scenarios.

# Go Live Runbook (JustHost VPS)

## Purpose

Repeatable production deployment checklist for `seminar` on a single VPS runtime:
- Node.js app (`server/index.mjs`) + SQLite
- `systemd` service (`seminar.service`)
- `nginx` reverse proxy
- `fail2ban` protection
- Let's Encrypt TLS

Current status:
- This runbook is retained for rollback operations only.
- Canonical production deploy path is defined in `docs/runbooks/DEPLOY_DOCKER_CONTRACT.md`.

## Current Production Baseline

- Runtime host: JustHost VPS (`91.132.48.224`)
- SSH access policy (updated `2026-02-27`): root login via SSH key only (`PasswordAuthentication` is disabled for operational access).
- OS: Debian 11
- App path:
  - releases: `/var/www/seminar/releases/<timestamp>`
  - current symlink: `/var/www/seminar/current`
- App port (internal): `127.0.0.1:8787`
- Public entrypoint: `nginx :80/:443`
- Database file: `/var/lib/seminar/seminar.sqlite`

## Prerequisites

1. Root SSH key-based access to VPS (password login is not used for deployment operations).
2. DNS control for:
   - `seminar-ai.ru`
3. Local machine with `pnpm`, `node`, and SSH/SCP client.

### SSH Access Check (Current)

Use this command to verify key-based access:

```bash
ssh -o BatchMode=yes root@91.132.48.224 "echo ok && whoami"
```

## A) One-Time Server Bootstrap

Install base packages and runtime:

```bash
apt-get update -y
apt-get install -y nginx fail2ban certbot python3-certbot-nginx curl ca-certificates gnupg
```

Install Node.js 22 and pnpm:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
corepack enable
corepack prepare pnpm@10.17.1 --activate
```

Create system user and folders:

```bash
useradd --system --create-home --home-dir /var/lib/seminar --shell /usr/sbin/nologin seminar || true
mkdir -p /var/www/seminar/releases /etc/seminar /var/lib/seminar
```

## B) Deploy New Release

1. Build frontend locally:

```bash
pnpm install
pnpm run build:web
```

2. Upload repository snapshot to VPS (without `.git`, `node_modules`).
3. Unpack to new release folder:

```bash
RELEASE_DIR="/var/www/seminar/releases/$(date +%Y%m%d%H%M%S)"
mkdir -p "$RELEASE_DIR"
tar -xzf /root/seminar-deploy.tgz -C "$RELEASE_DIR"
ln -sfn "$RELEASE_DIR" /var/www/seminar/current
```

4. Install deps and build on VPS:

```bash
cd /var/www/seminar/current
pnpm install --frozen-lockfile
pnpm run build:web
```

5. Set ownership:

```bash
chown -R seminar:seminar /var/www/seminar /var/lib/seminar
```

## C) Environment Configuration

Create/update `/etc/seminar/seminar.env`:

```bash
PORT=8787
HOST=127.0.0.1
NODE_ENV=production
DATABASE_PATH=/var/lib/seminar/seminar.sqlite
ADMIN_SECRET=<set_real_value>
# Optional:
# TURNSTILE_SECRET_KEY=<set_if_turnstile_enabled>
# ALLOW_TURNSTILE_MOCK=0
# TURNSTILE_MODE=real
```

Permissions:

```bash
chown root:seminar /etc/seminar/seminar.env
chmod 640 /etc/seminar/seminar.env
```

## D) systemd Service

`/etc/systemd/system/seminar.service`:

```ini
[Unit]
Description=Seminar web application
After=network.target

[Service]
Type=simple
User=seminar
Group=seminar
WorkingDirectory=/var/www/seminar/current
EnvironmentFile=/etc/seminar/seminar.env
ExecStart=/usr/bin/node server/index.mjs
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Apply:

```bash
systemctl daemon-reload
systemctl enable --now seminar
systemctl restart seminar
```

## E) Nginx

`/etc/nginx/sites-available/seminar`:

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name seminar-ai.ru _;

    client_max_body_size 2m;

    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Apply:

```bash
ln -sfn /etc/nginx/sites-available/seminar /etc/nginx/sites-enabled/seminar
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now nginx
systemctl reload nginx
```

## F) Fail2ban

Install python journald binding (required for `sshd` jail):

```bash
apt-get install -y python3-systemd
```

`/etc/fail2ban/jail.d/seminar.local`:

```ini
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5
backend = auto
usedns = warn

[sshd]
enabled = true
backend = systemd
port = ssh

[nginx-http-auth]
enabled = true
backend = auto
port = http,https
logpath = /var/log/nginx/error.log

[nginx-botsearch]
enabled = true
backend = auto
port = http,https
logpath = /var/log/nginx/access.log
maxretry = 10
findtime = 10m
bantime = 30m
```

Apply:

```bash
systemctl enable --now fail2ban
systemctl restart fail2ban
fail2ban-client status
```

## G) DNS and TLS

Before certificate issuance, this A record must resolve to `91.132.48.224`:
- `seminar-ai.ru`

Remove stale `AAAA` records if they point elsewhere.

Issue and install certificates:

```bash
certbot --nginx --non-interactive --agree-tos -m kwentin3@mail.ru --redirect \
  -d seminar-ai.ru
```

Verify:

```bash
nginx -t
systemctl reload nginx
certbot renew --dry-run
```

## H) Functional Smoke Checklist

1. `GET /` -> `200`
2. `GET /api/healthz` -> `200`
3. `POST /api/leads` valid payload -> `200` + `{ ok: true, lead_id }`
4. duplicate phone within 24h -> `409 duplicate_lead`
5. `GET /api/admin/leads`:
   - wrong/missing secret -> `401 admin_unauthorized`
   - valid secret -> `200` + leads list

## I) Operations Notes

1. Rotate `ADMIN_SECRET` at least once per 30 days.
2. Keep root password temporary; migrate to SSH keys and disable password auth.
3. Monitor:
   - `journalctl -u seminar -f`
   - `journalctl -u nginx -f`
   - `tail -f /var/log/fail2ban.log`
