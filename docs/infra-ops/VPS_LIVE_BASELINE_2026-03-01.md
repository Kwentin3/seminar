# VPS Live Baseline Snapshot (2026-03-01)

## Scope
- Snapshot source: live VPS `91.132.48.224`
- Collection date (UTC): `2026-03-01`
- Purpose: close context gaps for Docker/Traefik migration planning

## Domain Inventory (Live)
- `seminar-ai.ru`
- `www.seminar-ai.ru`
- `ai-work.pro`
- `www.ai-work.pro`

DNS A records observed from operator workstation (2026-03-01):
- `seminar-ai.ru -> 91.132.48.224`
- `www.seminar-ai.ru -> 91.132.48.224`
- `ai-work.pro -> 91.132.48.224`
- `www.ai-work.pro -> 91.132.48.224`

## Current Runtime Ports (Live)
- `0.0.0.0:80` -> `nginx`
- `0.0.0.0:443` -> `nginx`
- `127.0.0.1:8787` -> `node` (`seminar`)
- `0.0.0.0:22` -> `sshd`

## TLS Strategy (Current)
- Cert manager: `certbot` with nginx integration
- Active cert:
  - Name: `seminar-ai.ru`
  - Domains: `seminar-ai.ru`, `www.seminar-ai.ru`
  - Expiry: `2026-05-28`

## Live systemd Snapshot (Redacted)
File: `/etc/systemd/system/seminar.service`

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
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ReadWritePaths=/var/lib/seminar /var/www/seminar

[Install]
WantedBy=multi-user.target
```

## Live nginx Snapshot (Redacted)
File: `/etc/nginx/sites-available/seminar` (enabled via symlink from `/etc/nginx/sites-enabled/seminar`)

```nginx
server {
    server_name seminar-ai.ru www.seminar-ai.ru ai-work.pro www.ai-work.pro _;

    client_max_body_size 2m;

    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    listen [::]:443 ssl ipv6only=on; # managed by Certbot
    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/seminar-ai.ru/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/seminar-ai.ru/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

server {
    if ($host = www.seminar-ai.ru) {
        return 301 https://$host$request_uri;
    } # managed by Certbot

    if ($host = seminar-ai.ru) {
        return 301 https://$host$request_uri;
    } # managed by Certbot

    listen 80 default_server;
    listen [::]:80 default_server;
    server_name seminar-ai.ru www.seminar-ai.ru ai-work.pro www.ai-work.pro _;
    return 404; # managed by Certbot
}
```

## Live Env Key Inventory (Redacted)
File: `/etc/seminar/seminar.env`

```env
PORT=8787
HOST=127.0.0.1
NODE_ENV=production
DATABASE_PATH=/var/lib/seminar/seminar.sqlite
ADMIN_SECRET=<redacted>
```

## Hidden State Check (Live)
- Root crontab: empty
- System timers present:
  - `certbot.timer`
  - `apt-daily.timer`
  - `apt-daily-upgrade.timer`
  - `systemd-tmpfiles-clean.timer`
  - `fstrim.timer`
  - `e2scrub_all.timer`
- No explicit SQLite backup timer/job found in this snapshot

## Migration-Relevant Facts
- Current edge config contains catch-all host `_` (must be removed for multi-project Traefik contract).
- Current app bind is `127.0.0.1:8787` (not valid for container-to-container Traefik path).
- Existing non-seminar domains (`ai-work.pro`, `www.ai-work.pro`) are present on same VPS and require explicit routing ownership before edge cutover.
