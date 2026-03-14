# GitHub Guardrails

## CI Overview

Workflow: `.github/workflows/ci.yml`

Read first before touching deploy jobs:
1. `docs/notes/NOTE-007.deploy-entrypoints-and-truth-map.md`
2. `docs/reports/2026-03-13/DEPLOY.anamnesis.pre-cabinet-go-live.report.md`

Triggers:
- `pull_request` (any branch)
- `push` to `main`
- `workflow_dispatch` (manual ops runs)

CI runs:
1. `pnpm install --frozen-lockfile`
2. `pnpm exec playwright install --with-deps chromium`
3. `pnpm -r lint`
4. `pnpm -r typecheck`
5. `pnpm run test:cabinet`
6. `pnpm -r build`
7. Self-managed cabinet browser smoke:
   - `pnpm run test:smoke:cabinet:browser`
8. Smoke leads + cabinet in mock mode:
   - `pnpm run start:vps` (background)
   - `pnpm run test:smoke:leads`
   - `pnpm run test:smoke:cabinet`
9. Publish Docker image to GHCR:
   - canonical image: `ghcr.io/kwentin3/seminar`
   - tags: `sha-<shortsha>` and `main` (for `main`)
   - CI summary exports pinned digest reference
10. Deploy Docker smoke on VPS by pinned digest (without public edge switch):
   - pull `ghcr.io/kwentin3/seminar@sha256:<digest>`
   - run smoke through Traefik smoke bind `127.0.0.1:18080`
   - use dedicated smoke host header `Host: stage-smoke.local`
   - mandatory `/admin/obs/logs` check with `OBS_LOG_SOURCE=docker`

Production policy:
- Production deploy is Docker-only.
- Pinned digest is mandatory.
- Legacy `systemd + nginx` flow is rollback-only.
- Any legacy deploy job in CI is transitional and rollback-only.

## Forbidden For Production Flow

1. `latest` image tags.
2. Deploy by mutable tag without digest parity check.
3. `systemctl restart seminar` as a release step.
4. Public cutover before smoke and parity gates are green.

## Required Secrets/Variables For Deploy

Repository secrets:
1. `VPS_HOST` - VPS IP/FQDN.
2. `VPS_SSH_USER` - SSH user for deploy.
3. `VPS_SSH_PRIVATE_KEY` - private key (PEM/OpenSSH) matching authorized key on VPS.
4. `VPS_KNOWN_HOSTS` - known_hosts line for VPS host key.

Repository variables:
1. `VPS_SSH_PORT` - SSH port (default `22` if omitted).

Workflow permissions baseline:
1. Default workflow permission: `contents: read`.
2. GHCR publish job requires: `packages: write` (using `GITHUB_TOKEN`).
3. PAT is not required when package is published by repository workflow with `packages: write`.

## Branching Rules

1. `main` is protected.
2. No direct work on `main`.
3. All changes go through `feature/*` branches + Pull Request.
4. Merge only after green CI.

## Required Checks

PR is merge-ready only when CI is green:
- lint
- typecheck
- cabinet integration
- build
- cabinet browser smoke
- smoke leads (mock)
- smoke cabinet (mock)

## Smoke Failure Triage

Where to look:
1. GitHub Actions -> failed run -> step `Smoke leads (mock mode)`.
2. Read step output first (status/body from smoke script).
3. Check dumped app log (`/tmp/seminar-app.log`) printed by workflow on failure.

Common actions:
1. Re-run failed jobs once (transient local runtime issue).
2. If still failing, inspect app startup in logs (`/tmp/seminar-app.log` in workflow output).
3. Validate local reproduction:
   - `pnpm run start:vps`
   - `pnpm run test:smoke:leads`
   - `pnpm run test:smoke:cabinet`
   - `pnpm run test:smoke:cabinet:browser`
4. For stage-safe cabinet verification on the docker smoke contour:
   - API smoke:
     - `LEADS_BASE_URL=http://127.0.0.1:18080`
     - `SMOKE_HOST_HEADER=stage-smoke.local`
     - `CABINET_SMOKE_SKIP_LEGACY_ADMIN=1`
   - Browser smoke:
     - tunnel `127.0.0.1:18443 -> VPS 127.0.0.1:18443`
     - `CABINET_BROWSER_SMOKE_USE_EXISTING_SERVER=1`
     - `LEADS_BASE_URL=https://stage-smoke.local:18443`
     - `PLAYWRIGHT_HOST_RESOLVER_RULES="MAP stage-smoke.local 127.0.0.1"`
     - `PLAYWRIGHT_IGNORE_HTTPS_ERRORS=1`
     - `CABINET_BROWSER_SMOKE_EXTERNAL_MINIMAL=1`
     - `CABINET_BROWSER_SMOKE_SKIP_SIMPLIFY=1`

## Secrets Rule

1. Never commit real secrets to git.
2. Commit only template files (`*.example`, e.g. `.dev.vars.example`, `.env.example`).
3. Real secrets live only in:
   - GitHub repository/environment secrets (if needed)
   - VPS env files (outside repository)
4. If a real secret is committed by mistake: rotate immediately and remove from history.
