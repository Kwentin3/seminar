# DOCS.PRODUCTION.BASELINE.DOCKER_TRAEFIK.CANON.1.report

## 1. Executive summary
Documentation baseline hardened: Docker + Traefik + GHCR pinned digest is now documented as the only canonical production model. Legacy `systemd + nginx` is documented as deprecated rollback-only flow.

SPEC GUARD review completed for:
1. `docs/runbooks/DEPLOY_DOCKER_CONTRACT.md`
2. `docs/runbooks/GITHUB_GUARDRAILS.md`
3. `docs/runbooks/SEMINAR_MIGRATION_DOCKER.md`
4. `docs/runbooks/PLATFORM_EDGE_BASELINE.md`
5. `docs/reports/2026-03-01/VPS.PLATFORM.SEMINAR.CUTOVER.PROD.3.report.md`

Conflict status:
- No contradiction found between documented canonical baseline and recorded production cutover state.

## 2. Files modified
1. `docs/infra-ops/PRODUCTION_BASELINE_DOCKER_TRAEFIK.md` (new canonical baseline document)
2. `docs/README.md`
3. `docs/ARCHITECTURE/NORTH_STAR.md` (canonical architecture north star path in this repo)
4. `docs/DOCS_CANON.md`
5. `docs/runbooks/GO_LIVE.md`
6. `docs/runbooks/GITHUB_GUARDRAILS.md`

## 3. Canon baseline summary
1. Production runtime is defined as Docker-only.
2. Public edge owner is defined as Traefik-only on `:80/:443`.
3. Artifact flow is defined as GHCR publish -> pinned digest deploy only.
4. Deploy gates are defined as mandatory parity-check + mandatory smoke.
5. TLS model is defined as Traefik ACME with required router labels and no issuance wait during cutover.
6. Observability model is defined as `OBS_LOG_SOURCE=docker` in production.
7. Backup/restore baseline references SQLite SLA contract.
8. Rollback contract is explicit and step-by-step.

## 4. Strategic invariants
1. Production deploy path is Docker-only.
2. Pinned digest is mandatory.
3. Traefik owns public edge.
4. Explicit router rules are mandatory.
5. Structured logging contract remains deterministic.

## 5. Forbidden actions list
1. `systemctl restart seminar` in production release flow.
2. `image: latest` for production deploy.
3. Missing router rule for production domain.
4. Public cutover without parity-check pass.
5. Public cutover without smoke pass.

## 6. Drift prevention reinforcement
1. Added canonical baseline document with mandatory gate model.
2. Added sticky legacy deprecation banner in `GO_LIVE`.
3. Hardened GitHub guardrails with Docker-only + pinned-digest + transitional rollback-only legacy status.
4. Added agent context anchor in `DOCS_CANON`:
   - `AGENT MUST ASSUME: Production = Docker + Traefik + GHCR pinned digest.`

Validation note:
- Repository has no dedicated markdown lint pipeline; structural validation was executed via content checks (`rg`) and cross-doc consistency review.

## 7. Verdict (PASS/FAIL)
`PASS`

## 8. Next minimal step (1 пункт)
1. Открыть PR с этими docs-изменениями и после merge формально закрыть legacy deploy path как non-default в CI governance.
