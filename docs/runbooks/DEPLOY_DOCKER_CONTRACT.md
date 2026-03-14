# Deploy Docker Contract (Platform + Seminar)

## Purpose
Определяет canonical атомарный deploy/rollback контракт для production Docker-платформы.

Read first when resuming deploy work in a fresh chat:
- `docs/notes/NOTE-007.deploy-entrypoints-and-truth-map.md`
- `docs/reports/2026-03-13/DEPLOY.anamnesis.pre-cabinet-go-live.report.md`

## Scope
- Platform edge stack (Traefik)
- Seminar app stack (future attachment)

## Non-Negotiable Rules
1. Secrets не хранятся в git и не печатаются в CI logs.
2. Deploy в production выполняется только после green CI + green smoke.
3. Любой deploy имеет проверяемый rollback.
4. Public edge cutover выполняется отдельно от image build этапа.
5. Artifact identity MUST быть зафиксирован до deploy (`commit_sha` + expected `image_digest` + `BUILD_ID`).
6. `OBS_LOG_SOURCE` MUST быть выставлен явно (`docker` для docker runtime), fallback запрещён.
7. Production deploy MUST использовать только pinned digest image reference (`ghcr.io/...@sha256:<digest>`), `latest` запрещён.
8. Traefik domain routing MUST быть задан на service labels (attachment compose), не на Traefik service.
9. `APP_HOST_RULE`, `TRAEFIK_CERTRESOLVER`, `TRAEFIK_ENTRYPOINTS_WEB`, `TRAEFIK_ENTRYPOINTS_WEBSECURE`, `APP_SERVICE_PORT` MUST быть заданы явно для production attachment.
10. Production deploy Docker-only: `systemctl restart seminar` и legacy release path запрещены вне rollback.

## Atomic Roll-Forward Contract
1. Pull images:
```bash
docker compose -f <stack>.yml pull
```
2. Start/update stack:
```bash
docker compose -f <stack>.yml up -d --remove-orphans
```
3. Wait for health:
```bash
docker compose -f <stack>.yml ps
```
4. Run smoke gate:
```bash
curl -fsS http://127.0.0.1:<edge_http_port>/ -H "Host: <smoke-host>"
curl -fsS http://127.0.0.1:<edge_http_port>/api/healthz -H "Host: <smoke-host>"
curl -fsS -H "X-Admin-Secret: <redacted>" "http://127.0.0.1:<edge_http_port>/admin/obs/logs?since=<ISO8601>&limit=20" -H "Host: <smoke-host>"
```
For smoke/stage-safe contour, `<smoke-host>` MUST be a dedicated host header and MUST NOT reuse the public production domain.
5. Mark deploy success only after smoke passes.
6. Run artifact parity check (MUST pass before cutover):
```bash
docker inspect -f '{{.Config.Image}} {{range .Config.Env}}{{println .}}{{end}}' <container_name>
```
Expected:
- running container image reference equals expected pinned digest reference;
- `BUILD_ID=<expected_build_id>`;
- `OBS_LOG_SOURCE=docker`;
- no `spawn journalctl ENOENT` / `spawn docker ENOENT` in recent logs.
7. Run routing parity check (MUST pass before cutover):
```bash
docker compose --env-file <app_env_file> -f <app_stack>.yml config > /tmp/<app>.effective.yml
grep -n "traefik.http.routers.<router>-web.rule" /tmp/<app>.effective.yml
grep -n "traefik.http.routers.<router>-websecure.tls.certresolver" /tmp/<app>.effective.yml
grep -n "traefik.http.services.<router>-svc.loadbalancer.server.port" /tmp/<app>.effective.yml
```

## Atomic Rollback Contract
1. Keep previous immutable image tag and compose revision.
2. Rollback command:
```bash
docker compose -f <stack>.yml up -d --remove-orphans
```
using previous locked tags/config.
3. Re-run smoke gate.
4. If rollback smoke fails, switch edge back to previous known-good owner.

## CI/CD Runtime Rules
1. Production release flow использует только Docker deployment workflow (Mode A).
2. Legacy `systemd + nginx` flow допускается только для rollback и не может быть default pipeline.
3. Public cutover выполняется только после:
   - platform smoke pass,
   - seminar container smoke pass,
   - backup/restore contract gate closed,
   - OBS log retrieval policy gate closed,
   - artifact parity pass.

## Artifact Parity Guard (Release Drift Prevention)
Mode A (mandatory for production):
1. Deploy only pinned digest reference (`image: repo/name@sha256:<digest>`).
2. After deploy, verify runtime digest equals expected digest via `docker inspect`.
3. Cutover blocked if digest mismatch.

Mode B (emergency-only / dev-only):
1. Build artifact on VPS from explicit `commit_sha` and set `BUILD_ID`.
2. Capture runtime `image_id` (`sha256:...`) and treat it as expected parity id for the session.
3. Verify:
   - `container -> image_id` equals expected `image_id`;
   - critical file hashes (at least `server/index.mjs`, `server/obs/log-retrieval.mjs`) match expected release source;
   - smoke `/admin/obs/logs` with `OBS_LOG_SOURCE=docker` returns 200.
4. If any parity check fails, cutover is blocked.
5. Mode B MUST NOT использоваться для regular production deploy после включения GHCR publish pipeline.

## Canonical Artifact Coordinates
1. Canonical image name: `ghcr.io/kwentin3/seminar`.
2. Required tags from CI publish:
   - `sha-<shortsha>` (always)
   - `main` (for `refs/heads/main`)
   - release tag mirror (for `refs/tags/*`, optional)
3. Deploy reference MUST always be pinned digest:
   - `ghcr.io/kwentin3/seminar@sha256:<digest>`
4. Minimum GH permissions for publish:
   - workflow default: `contents: read`
   - publish job: `packages: write` (`GITHUB_TOKEN`).

## How To Take Digest From CI
1. From workflow summary (`GHCR Publish`) copy `pinned reference`.
2. Or via GH CLI:
```bash
gh run list --workflow CI --limit 5
gh run view <run_id> --log | rg "pinned image|digest|image_ref"
```
3. Deploy input values:
   - `EXPECTED_IMAGE_REF=ghcr.io/kwentin3/seminar@sha256:<digest>`
   - `EXPECTED_DIGEST=sha256:<digest>`
   - `BUILD_ID=<commit_sha>`

## Strategic Gates
- `STOP_CONTRACT_REQUIRED` if backup/restore contract is not approved.
- `STOP_CONTRACT_REQUIRED` if OBS logs source policy (journald vs docker logs) is not approved.
- `STOP_CONTRACT_REQUIRED` for the first cabinet go-live if temporary bootstrap envs and SQLite triplet backup are not prepared.

## Evidence Required Per Deploy
1. `docker compose ps` snapshot.
2. Smoke command outputs with HTTP status.
3. Active image digests/tags.
4. Rollback command and result.
