# CI.GHCR.PUBLISH.PINNED_DIGEST.DEPLOY.1.report

## 1. Executive summary
- Pipeline переведён на artifact flow с GHCR publish и pinned digest deploy для docker smoke-контура.
- CI теперь публикует Docker image в GHCR и фиксирует digest как output/summary/artifact.
- VPS smoke deploy использует только pinned digest (`ghcr.io/kwentin3/seminar@sha256:...`) с parity-check по digest/reference.
- Smoke в docker-контуре green (`/`, `/api/healthz`, `/admin/obs/logs`), `ENOENT` сигнатуры отсутствуют.
- Public edge switch не выполнялся: `nginx` остаётся владельцем `:80/:443`.

## 2. SPEC GUARD results
### Проверенные SoT
1. `docs/runbooks/DEPLOY_DOCKER_CONTRACT.md`
2. `docs/reports/2026-03-01/VPS.RELEASE.ARTIFACT_PARITY.FIX_VERIFY.1.report.md`
3. `.github/workflows/ci.yml`
4. Ops compose baseline (`ops/platform/traefik/*`, `ops/platform/seminar/compose.seminar.ghcr-smoke.yml`)

### Canonical image name
- `ghcr.io/kwentin3/seminar`

### Tag strategy
1. `sha-<shortsha>` (mandatory)
2. `main` (for `refs/heads/main`)
3. `<git-tag>` mirror for `refs/tags/*` (optional)

### Minimal GH permissions
1. Workflow default: `contents: read`
2. Publish job: `packages: write` (using `GITHUB_TOKEN`)
3. PAT не требуется для текущего repo-scoped publish потока.

## 3. What changed (workflows/docs/compose)
1. `.github/workflows/ci.yml`:
   - добавлены `workflow_dispatch` inputs;
   - добавлен `docker_publish` job (buildx + push GHCR + digest output + summary + artifact);
   - добавлен `deploy_docker_smoke` job (VPS pull by digest + parity-check + smoke), без public cutover;
   - legacy `deploy` job сохранён (parallel baseline).
2. `Dockerfile`:
   - reproducible build c `pnpm install` + `pnpm run build:web` внутри image build.
3. `.dockerignore`:
   - исключены лишние директории/артефакты для build context.
4. `ops/platform/seminar/compose.seminar.ghcr-smoke.yml`:
   - image строго через `${SEMINAR_IMAGE}` (pinned digest reference);
   - explicit env для docker OBS source;
   - edge network + Traefik host rules;
   - docker CLI/socket mounts для `/admin/obs/logs` docker-source.
5. `docs/runbooks/DEPLOY_DOCKER_CONTRACT.md`:
   - Mode A зафиксирован как mandatory production gate;
   - Mode B ограничен emergency/dev;
   - добавлены canonical coordinates + digest retrieval + strict parity-check.
6. `docs/runbooks/GITHUB_GUARDRAILS.md`:
   - отражён GHCR publish + docker smoke deploy + permissions baseline.
7. `docs/runbooks/SEMINAR_MIGRATION_DOCKER.md`:
   - precondition с обязательным CI digest.

## 4. Evidence: GHCR publish + digest
Primary CI run (PASS):
- Run URL: `https://github.com/Kwentin3/seminar/actions/runs/22544771309`
- Head SHA: `dcf5f3483d09b2639e40231293a42f78cbf872c3`
- Jobs:
  - `ci` -> success
  - `docker_publish` -> success
  - `deploy_docker_smoke` -> success
  - `deploy` (legacy) -> skipped in workflow_dispatch run

Published pinned reference (artifact `ghcr-image-ref.txt`):
- `ghcr.io/kwentin3/seminar@sha256:f17357c27e98897095b7945c5e529b3ed92dffd7d3ec5b47af80063a9744c5d4`

CI publish proof points:
1. `docker_publish` step `Build and push image` = success.
2. `Publish digest summary` = success.
3. `Upload digest artifact` = success.

## 5. Evidence: VPS pull + parity-check + smoke
Pinned digest pull on VPS:
```bash
docker pull ghcr.io/kwentin3/seminar@sha256:f17357c27e98897095b7945c5e529b3ed92dffd7d3ec5b47af80063a9744c5d4
Digest: sha256:f17357c27e98897095b7945c5e529b3ed92dffd7d3ec5b47af80063a9744c5d4
Status: Image is up to date
```

Parity/smoke evidence from CI `deploy_docker_smoke` logs:
1. `runtime_image=ghcr.io/kwentin3/seminar@sha256:f17357c27e98897095b7945c5e529b3ed92dffd7d3ec5b47af80063a9744c5d4`
2. `container_id=4780d62debc1e0d02ffa9f5681c496e858f8742ec6ea216d24e24b803aa76ea7`
3. `smoke_health=200`
4. `smoke_obs=200`
5. `enoent_journalctl=0`
6. `enoent_docker=0`

Direct VPS smoke re-check (post-CI):
```bash
root=200
health=200
obs=200
```

No public switch confirmation:
1. `systemctl is-active nginx seminar` -> `active / active`
2. listeners:
   - nginx on `:80/:443`
   - Traefik smoke on `127.0.0.1:18080`

## 6. Verdict (PASS/FAIL)
`PASS`

Verification matrix:
1. CI build+push PASS -> yes
2. Digest exposed as CI artifact/summary -> yes
3. VPS `docker pull ...@sha256:<digest>` -> yes
4. Parity-check digest match -> yes
5. Smoke `/admin/obs/logs` with `OBS_LOG_SOURCE=docker` -> 200
6. No public switch performed -> yes

## 7. Next minimal step (1 пункт)
1. Выполнить отдельный controlled prompt на production cutover (`nginx -> Traefik :80/:443`) с тем же pinned digest как immutable release input.
