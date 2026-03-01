# Production Baseline: Docker + Traefik (Canonical)

## 1. Executive Summary
Since `2026-03-01`, production for `seminar` MUST run as:
1. Docker runtime (`seminar-app`)
2. Traefik edge owner for `:80/:443`
3. GHCR pinned digest deployment (`ghcr.io/kwentin3/seminar@sha256:<digest>`)

Legacy `systemd + nginx` flow is DEPRECATED and allowed only for rollback.

## 2. Edge Ownership Model
1. Traefik MUST own host ports `:80/:443` in production mode.
2. Domain routers MUST be defined on application service labels.
3. Catch-all host rules are FORBIDDEN on multi-project VPS edge.
4. `nginx + seminar.service` MUST NOT be used as default production owner.

## 3. Artifact Flow
1. CI MUST publish image to GHCR: `ghcr.io/kwentin3/seminar`.
2. Production deploy MUST use pinned digest reference only.
3. Mutable tags (including `latest`) MUST NOT be used for production deploy.
4. Deploy MUST record `commit_sha`, `image_digest`, `BUILD_ID`.

## 4. Deploy Contract
1. Parity-check is MANDATORY before public cutover:
   - runtime image equals expected pinned digest;
   - runtime `BUILD_ID` equals expected commit sha;
   - runtime `OBS_LOG_SOURCE=docker`.
2. Smoke is MANDATORY before and after public cutover:
   - `/`
   - `/api/healthz`
   - `/api/leads`
   - `/admin/obs/logs`
3. Cutover MUST be blocked on any parity/smoke failure.

Reference:
- `docs/runbooks/DEPLOY_DOCKER_CONTRACT.md`

## 5. TLS Model
1. ACME MUST be handled by Traefik resolver (`httpChallenge` on `web`).
2. Router labels for production domains MUST exist before ACME/cutover.
3. Public cutover MUST start only with already issued valid certificate in Traefik storage.
4. Public cutover MUST NOT be used as certificate issuance waiting window.

## 6. Observability
1. Production runtime MUST set `OBS_LOG_SOURCE=docker`.
2. Log source switching MUST be explicit (`journald|docker`), no silent fallback.
3. Structured logging event model MUST remain unchanged.
4. `/admin/obs/logs` MUST stay admin-protected.

References:
- `docs/contracts/CONTRACT-OBS-001.logging.event-model.v0.4.md`
- `docs/contracts/CONTRACT-OBS-002.log-retrieval-sources.v0.1.md`

## 7. Backup & Restore
1. SQLite backup SLA MUST be satisfied before cutover.
2. Baseline SLA:
   - `RPO=24h`
   - `RTO=30m`
   - `Retention=14d`
   - `Restore drill=quarterly`
3. SQLite trio (`.sqlite`, `-wal`, `-shm`) MUST be handled consistently.
4. One writer rule MUST be enforced during snapshot/migration operations.

Reference:
- `docs/contracts/CONTRACT-OPS-001.sqlite-backup-sla.v0.1.md`

## 8. Rollback Contract
Rollback sequence (exact):
1. Stop Traefik stack.
2. Stop seminar docker stack.
3. Start `nginx`.
4. Start `seminar.service`.
5. Run legacy smoke (`/`, `/api/healthz`).

Rollback objective:
- Restore public service within 10 minutes.

## 9. Strategic Invariants
1. Production deploy path is Docker-only.
2. Pinned digest is mandatory.
3. Traefik is mandatory edge owner.
4. Domain routing is label-driven and explicit.
5. Structured logs contract is deterministic.

## 10. Forbidden Actions
1. `systemctl restart seminar` in production release flow.
2. `image: latest` in production deploy manifests.
3. Deploy without router rule for target production domain.
4. Cutover without successful parity-check.
5. Cutover without successful smoke.

## 11. Drift Prevention Model
1. Enforce Mode A parity gate (`digest` + `BUILD_ID` + `OBS_LOG_SOURCE`) for every production release.
2. Enforce routing parity gate (`docker compose config` contains expected router rule and certresolver).
3. Enforce smoke gate including `/admin/obs/logs` in docker source mode.
4. Treat any gate violation as release block.

## 12. Agent Context Notice
AGENT MUST ASSUME:
`Production = Docker + Traefik + GHCR pinned digest`.
