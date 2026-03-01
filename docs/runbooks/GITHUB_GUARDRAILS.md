# GitHub Guardrails

## CI Overview

Workflow: `.github/workflows/ci.yml`

Triggers:
- `pull_request` (any branch)
- `push` to `main`

CI runs:
1. `pnpm install --frozen-lockfile`
2. `pnpm -r lint`
3. `pnpm -r typecheck`
4. `pnpm -r build`
5. Smoke leads in mock mode:
   - `pnpm run start:vps` (background)
   - `pnpm run test:smoke:leads`
6. Publish Docker image to GHCR (on `push` and manual dispatch):
   - canonical image: `ghcr.io/kwentin3/seminar`
   - tags: `sha-<shortsha>` and `main` (for `main`)
   - CI summary exports pinned digest reference
7. Deploy to VPS (legacy, only on `push` to `main`, after green CI):
   - upload release archive via SSH key
   - build on VPS
   - switch `/var/www/seminar/current` symlink
   - restart `seminar.service`
   - smoke `http://127.0.0.1:8787/` and `/api/healthz`
8. Deploy Docker smoke on VPS by pinned digest (parallel, without public cutover):
   - pull `ghcr.io/kwentin3/seminar@sha256:<digest>`
   - run smoke through Traefik smoke bind `127.0.0.1:18080`
   - mandatory `/admin/obs/logs` check with `OBS_LOG_SOURCE=docker`

Note:
- Production runtime is VPS (`server/index.mjs` + `nginx` + `systemd`) and is deployed via runbook.
- Trusted public domain for this project is only `https://seminar-ai.ru/`.
- Public edge `:80/:443` ownership is unchanged in docker smoke flow.

## Required Secrets/Variables For Deploy

Repository secrets:
1. `VPS_HOST` - VPS IP/FQDN.
2. `VPS_SSH_USER` - SSH user for deploy (recommended dedicated deploy user).
3. `VPS_SSH_PRIVATE_KEY` - private key (PEM/OpenSSH) matching authorized key on VPS.
4. `VPS_KNOWN_HOSTS` - known_hosts line for VPS host key.

Repository variables:
1. `VPS_SSH_PORT` - SSH port (default `22` if omitted).

Current operational policy (updated `2026-02-27`):
- Deploy access is key-based only.
- Root password authentication is not part of deploy flow.

## Branching Rules

1. `main` is protected.
2. No direct work on `main`.
3. All changes go through `feature/*` branches + Pull Request.
4. Merge only after green CI.

## Required Checks

PR is merge-ready only when CI is green:
- lint
- typecheck
- build
- smoke leads (mock)

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

## Secrets Rule

1. Never commit real secrets to git.
2. Commit only template files (`*.example`, e.g. `.dev.vars.example`, `.env.example`).
3. Real secrets live only in:
   - GitHub repository/environment secrets (if needed)
   - VPS env file (`/etc/seminar/seminar.env`) for production
4. If a real secret is committed by mistake: rotate immediately and remove from history.
