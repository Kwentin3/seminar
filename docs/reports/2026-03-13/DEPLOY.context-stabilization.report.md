---
id: REPORT-2026-03-13.deploy.context-stabilization
status: draft
owner: @Kwentin3
approved_by:
  - @Kwentin3
last_updated: 2026-03-13
core_snapshot: docs/epics/EPIC-002.cabinet.auth-foundation/CONTEXT_SNAPSHOT.md
related:
  - docs/reports/2026-03-13/DEPLOY.anamnesis.pre-cabinet-go-live.report.md
  - docs/notes/NOTE-006.deploy-contour-reality.md
  - docs/notes/NOTE-007.deploy-entrypoints-and-truth-map.md
  - docs/runbooks/DEPLOY_DOCKER_CONTRACT.md
  - docs/runbooks/ENV_MATRIX.md
  - docs/runbooks/GO_LIVE.md
  - docs/infra-ops/VPS_LIVE_BASELINE_2026-03-01.md
  - README.md
  - docs/README.md
tags:
  - report
  - deploy
  - ops
  - handoff
  - context
---

# Deploy Context Stabilization Report

## Executive Summary
1. This pass did not change production or prepare a rollout directly.
2. The goal was to make the deploy chain recoverable by a new agent in a fresh chat without re-running server forensics first.
3. Active live truth is now reinforced across docs and sticky comments:
   - Docker + Traefik
   - pinned GHCR image
   - `/opt/seminar` control plane
   - SQLite under mounted volume
4. Legacy `systemd + nginx` paths are now marked more explicitly as rollback-only or historical.
5. Critical operator confusion points now carry short warnings inside CI, compose, and startup-sensitive code.

## What Was Confusing Before
1. README and docs already mentioned Docker as canonical, but a new agent still had to reconcile that with:
   - legacy `GO_LIVE.md`
   - legacy VPS snapshot
   - live host residue
   - legacy CI `deploy` job
2. The repo still visually exposed `/var/www/seminar` and `systemctl restart seminar` in places where a zero-context agent could mistake them for the default release path.
3. Cabinet first-go-live caveats were documented in reports, but not surfaced as a compact “read this first” entrypoint.

## Primary Entrypoints Now
New-agent reading order is now explicit:
1. `docs/notes/NOTE-007.deploy-entrypoints-and-truth-map.md`
2. `docs/reports/2026-03-13/DEPLOY.anamnesis.pre-cabinet-go-live.report.md`
3. `docs/runbooks/DEPLOY_DOCKER_CONTRACT.md`
4. `docs/runbooks/ENV_MATRIX.md`

Secondary historical/rollback references:
1. `docs/runbooks/GO_LIVE.md`
2. `docs/infra-ops/VPS_LIVE_BASELINE_2026-03-01.md`

## Sticky Comments Added
### CI
1. `.github/workflows/ci.yml`
   - legacy `deploy` job is marked as rollback-only/non-default
   - `deploy_docker_smoke` is marked as live-truth-adjacent smoke, not the full cabinet go-live sequence

### Runtime Code
1. `server/index.mjs`
   - startup migration path now warns that first cabinet go-live on a pre-cabinet DB requires SQLite triplet backup
   - bootstrap admin path now warns against leaving reset-enabled envs in long-lived production
2. `server/cabinet/config.mjs`
   - `CABINET_BOOTSTRAP_ALLOW_RESET` is explicitly documented as separate from create-first bootstrap

### Ops Artifacts
1. `ops/platform/seminar/compose.seminar.ghcr.yml`
   - marked as the live production deploy control plane
2. `ops/platform/seminar/compose.seminar.ghcr-smoke.yml`
   - marked as smoke/parity aid, not the complete go-live procedure
3. `ops/platform/seminar/.env.seminar.example`
   - marked as matching the active Docker control plane, not legacy systemd deploy

## Legacy Paths Explicitly Marked As Non-Default
1. `docs/runbooks/GO_LIVE.md`
   - retitled in the header as legacy rollback runbook
   - points readers to the new truth-map and anamnesis
2. `docs/infra-ops/VPS_LIVE_BASELINE_2026-03-01.md`
   - now explicitly points to newer live-truth docs
3. `.github/workflows/ci.yml`
   - legacy deploy job now carries a direct warning

## Handoff Quality Improvement
1. A new agent can now answer “where production really lives” from one note plus one report.
2. Default deploy and rollback paths are separated from historical residue more clearly.
3. Cabinet first-go-live caveats are visible before a deploy prompt is written, not only after reading long reports.
4. README and `docs/README.md` now route readers toward the correct deploy entrypoints faster.

## What Remains Open Before Real Go-Live
1. Cabinet is still not live on the public domain.
2. Production DB is still pre-cabinet and needs migration-on-start for first rollout.
3. Temporary cabinet bootstrap envs still need to be prepared intentionally for first launch.
4. `www -> apex` public behavior still deserves verification during the real deploy sequence.
5. `ai-work.pro` still creates domain-routing ambiguity and should not be assumed to be an active seminar host without explicit confirmation.

## Recommended Next Prompt
Next logical prompt:

`Prepare and execute a Docker-only cabinet go-live rollout for seminar-ai.ru using the active /opt/seminar control plane, with pre-deploy SQLite triplet backup, temporary cabinet bootstrap envs, post-deploy cabinet/auth/admin smoke checks, and an explicit rollback path to the previous pinned image plus DB snapshot.`
