# Platform Edge Baseline (Docker + Traefik)

## Purpose
Определяет единый edge-контракт для multi-project VPS при переходе на Docker/Traefik.

## Status
- Stage: `pre-cutover`
- Current production edge owner: `nginx` on host `:80/:443`
- New edge baseline: Traefik stack in smoke mode (non-prod ports), then controlled cutover

## Hard Invariants
1. Edge публикует только `80/tcp` и `443/tcp` в production режиме.
2. Запрещены catch-all host rules (`HostRegexp`, `_`, wildcard без явного согласования).
3. Каждый router MUST иметь явное `Host(...)` правило.
4. `providers.docker.exposedbydefault=false` обязательно.
5. Dashboard Traefik не публикуется в internet (в baseline выключен).
6. Все edge логи идут в stdout/stderr контейнера.
7. ACME storage MUST быть persistent и writable.
8. Shared network MUST быть внешней и именованной: `edge`.
9. Edge stack сам по себе не владеет project-domain routing; domain routers задаются на service-контейнерах через `traefik.*` labels.

## Current Domain Inventory (Live Snapshot 2026-03-01)
- Seminar domain set:
  - `seminar-ai.ru`
  - `www.seminar-ai.ru`
- Additional domains on same VPS (owner contract required before cutover):
  - `ai-work.pro`
  - `www.ai-work.pro`

## Host Routing Contract
Маршрутизация доменов определяется labels на приложениях (attachment stacks), а не labels Traefik контейнера.

### Seminar
- Primary router:
  - Rule: `Host("seminar-ai.ru")`
  - EntryPoints: `websecure`
  - TLS: `certResolver=le`

- WWW redirect router:
  - Rule: `Host("www.seminar-ai.ru")`
  - EntryPoints: `web`,`websecure`
  - Middleware: `redirect-www-to-apex`
  - Target: `https://seminar-ai.ru`

### Non-seminar domains on same VPS
- `ai-work.pro`, `www.ai-work.pro` не подключать к новому edge без отдельного ownership/contract решения.
- До решения домены остаются на legacy edge.

## TLS Contract
- Certificate authority: Let's Encrypt ACME
- Resolver name: `le`
- Challenge: `httpChallenge` on entrypoint `web`
- Persistent storage: host file (example) `/opt/platform/traefik/acme/acme.json`
- File permissions: `0600`

## Network Contract
- External Docker network name: `edge`
- All routed services MUST join `edge`.
- Services MUST NOT публиковать host-ports, если трафик идет через Traefik.

## Security Baseline
- `no-new-privileges` for Traefik container
- docker socket mount read-only
- No secrets in compose files
- Traefik image pinning by major/minor tag (no `latest`)

## Smoke-First Cutover Policy
1. Smoke Traefik выполняется на непубличных портах (`127.0.0.1:18080/18443`) без изменения legacy edge.
2. Public cutover к `:80/:443` разрешается только после green smoke gates.
3. До final cutover DNS/public routes текущего production не меняются.

## Stack Artifacts
- Production stack file: `ops/platform/traefik/compose.platform-edge.yml`
- Smoke stack file: `ops/platform/traefik/compose.platform-edge.smoke.yml`
- Env template: `ops/platform/traefik/.env.platform-edge.example`
- Project attachment template: `docs/templates/PROJECT_DOCKER_ATTACH.md`

## Project Router Source
Project-specific domain routing MUST идти из labels приложений через env-substituted compose values.
Recommended required env for attachments:
1. `APP_ROUTER_NAME`
2. `APP_HOST_RULE`
3. `APP_SERVICE_PORT`
4. `TRAEFIK_CERTRESOLVER`
5. `TRAEFIK_ENTRYPOINTS_WEB`
6. `TRAEFIK_ENTRYPOINTS_WEBSECURE`

## Minimal Runtime Commands
Create network:
```bash
docker network create edge
```

Run smoke stack:
```bash
docker compose --env-file /opt/platform/traefik/.env.platform-edge \
  -f /opt/platform/traefik/compose.platform-edge.smoke.yml up -d
```

Smoke check:
```bash
curl -i -H 'Host: edge-smoke.local' http://127.0.0.1:18080/
```

## Version Pin (Current Verified State)
- Verified Docker Engine on VPS: `28.5.2`
- Reason: with Docker `29.x`, Traefik docker provider failed with
  `client version 1.24 is too old. Minimum supported API version is 1.44`
- Action: keep Engine pinned to `28.5.x` until compatibility is re-verified.
