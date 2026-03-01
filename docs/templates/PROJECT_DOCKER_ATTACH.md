# Project Docker Attach Template

## Purpose
Шаблон подключения проекта к общему edge Traefik на multi-project VPS.

## Required Inputs
- Project name: `<project_name>`
- Primary domain: `<project_domain>`
- Optional aliases: `<alias_domains...>`
- Internal app port: `<app_port>`
- Health endpoint: `<health_path>` (example: `/api/healthz`)
- TLS resolver: `le`

## Mandatory Rules
1. Service MUST join external network `edge`.
2. Service MUST NOT expose host ports when fronted by Traefik.
3. `traefik.enable=true` MUST be set explicitly.
4. Router rule MUST use explicit `Host(...)` only.
5. No catch-all/wildcard routes unless separately approved.
6. Healthcheck MUST be defined if endpoint exists.

## Label Contract (Example)
```yaml
labels:
  - traefik.enable=true
  - traefik.http.routers.<project>-https.rule=Host(`<project_domain>`)
  - traefik.http.routers.<project>-https.entrypoints=websecure
  - traefik.http.routers.<project>-https.tls=true
  - traefik.http.routers.<project>-https.tls.certresolver=le
  - traefik.http.services.<project>.loadbalancer.server.port=<app_port>
```

## Traefik Labels Via Env (Recommended)
Используйте готовое `APP_HOST_RULE` как строку целиком, вместо сборки из списка доменов внутри compose.

Required env:
1. `APP_ROUTER_NAME` (пример: `seminar`)
2. `APP_HOST_RULE` (пример: `Host(\`seminar-ai.ru\`) || Host(\`www.seminar-ai.ru\`)`)
3. `APP_SERVICE_PORT` (пример: `8787`)
4. `TRAEFIK_CERTRESOLVER` (пример: `le`)
5. `TRAEFIK_ENTRYPOINTS_WEB` (пример: `web`)
6. `TRAEFIK_ENTRYPOINTS_WEBSECURE` (пример: `websecure`)

Optional env:
1. `APP_ENABLE_WWW_REDIRECT=0|1`
2. `APP_WWW_REDIRECT_TO=<apex-domain>`
3. `APP_MIDDLEWARES=<comma-separated>`

Compose verification before deploy:
```bash
docker compose --env-file /opt/<project>/.env.<project> \
  -f /opt/<project>/compose.<project>.ghcr.yml config > /tmp/<project>.effective.yml

grep -n "traefik.http.routers.${APP_ROUTER_NAME}-web.rule" /tmp/<project>.effective.yml
grep -n "traefik.http.routers.${APP_ROUTER_NAME}-websecure.tls.certresolver" /tmp/<project>.effective.yml
grep -n "traefik.http.services.${APP_ROUTER_NAME}-svc.loadbalancer.server.port" /tmp/<project>.effective.yml
```

## Optional WWW Redirect Contract
For `www.<project_domain>` -> apex redirect:
```yaml
labels:
  - traefik.http.routers.<project>-www.rule=Host(`www.<project_domain>`)
  - traefik.http.routers.<project>-www.entrypoints=web,websecure
  - traefik.http.routers.<project>-www.middlewares=<project>-redirect-www
  - traefik.http.middlewares.<project>-redirect-www.redirectregex.regex=^https?://www\\.(.+)
  - traefik.http.middlewares.<project>-redirect-www.redirectregex.replacement=https://$${1}
  - traefik.http.middlewares.<project>-redirect-www.redirectregex.permanent=true
```

## Healthcheck Template
```yaml
healthcheck:
  test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:<app_port><health_path> >/dev/null || exit 1"]
  interval: 30s
  timeout: 5s
  retries: 3
  start_period: 20s
```

## Attach Checklist
1. Domain DNS points to edge host.
2. Service container is healthy.
3. `curl -H "Host: <project_domain>" http://127.0.0.1:<edge_port>/` returns `200/expected`.
4. TLS cert issued and valid.
5. Rollback command tested.
