# VPS.RELEASE.ARTIFACT_PARITY.FIX_VERIFY.1.report

## 1. Executive summary
- Release drift в smoke-контуре подтверждён и устранён без public edge switch.
- `seminar-app` на VPS запущен в Docker из требуемого артефакта (`BUILD_ID=cc8a658-34c65626-20260301T155536Z`, `image_id=sha256:00494800eaa87c526e307fe3ddbbc4b542777e7bfa997b8b7f4439b0fcede008`).
- `/admin/obs/logs` в docker-режиме проходит smoke (HTTP 200), `journalctl ENOENT` больше не возникает.
- Добавлен минимальный anti-drift guard в deploy-контракт: обязательный parity-check (`commit/build_id/image_id|digest`) + обязательный smoke `/admin/obs/logs` при `OBS_LOG_SOURCE=docker`.

## 2. SPEC GUARD results
### Проверенные SoT
- `docs/runbooks/DEPLOY_DOCKER_CONTRACT.md`
- `docs/runbooks/SEMINAR_MIGRATION_DOCKER.md`
- `docs/contracts/CONTRACT-OBS-002.log-retrieval-sources.v0.1.md`
- `docs/reports/2026-03-01/OBS.LOGS.DOCKER_ADAPTER.CONTRACT_IMPLEMENT.1.report.md`
- `docs/reports/2026-03-01/VPS.PLATFORM.SEMINAR.CUTOVER.PROD.1.report.md`

### Где появляется artifact и как попадает на VPS
1. Текущий CI (`.github/workflows/ci.yml`) не собирает и не публикует Docker image.
2. Legacy deploy делает tarball upload на VPS + `systemctl restart seminar`.
3. Для этого fix-verify использован контролируемый VPS artifact runtime (Docker image собран/запущен локально на VPS в smoke-контуре, без захвата public edge).

### Какие version identifiers доступны
- `git commit sha`: `cc8a658061bdf7d413baf84594ddafa2fc3dca39`
- `BUILD_ID`: `cc8a658-34c65626-20260301T155536Z`
- Runtime `image_id`: `sha256:00494800eaa87c526e307fe3ddbbc4b542777e7bfa997b8b7f4439b0fcede008`
- `container_id`: `67c7926ff6fd7ba8bac69fa58173ee6c46c50ee5e72d33b6d2cb6fdbd7719a92`

### Как доказан parity на VPS
1. Контейнер запущен с явным `BUILD_ID` и `OBS_LOG_SOURCE=docker`.
2. Runtime `image_id` зафиксирован через `docker inspect`.
3. Хеши критических файлов в контейнере совпали с текущим release source:
   - `server/obs/log-retrieval.mjs` -> `1cf5138f...aff517`
   - `server/index.mjs` -> `df26bc5c...33134`
4. Runtime smoke подтверждает docker OBS path (`obs_log_source_selected: source=docker`).

### Ограничение/контекст
- Registry digest mapping (`commit -> repo@sha256`) недоступен в текущем baseline:
  - CI не публикует image;
  - у текущего GH token нет `read:packages` (403).
- Применён временный parity режим через `image_id` + `BUILD_ID` + file-hash proof (зафиксирован в deploy-контракте).

## 3. Current VPS state evidence (redacted)
```bash
$ docker ps --no-trunc
seminar-app  image=seminar-app:cc8a658-34c65626-20260301T155536Z  status=Up (healthy)
platform-edge-smoke-traefik  Up
platform-edge-smoke-service  Up
```

```bash
$ docker inspect -f '... image_id ... health ...' seminar-app
image_id=sha256:00494800eaa87c526e307fe3ddbbc4b542777e7bfa997b8b7f4439b0fcede008
health=healthy
restarts=0
```

```bash
$ docker inspect env (redacted)
HOST=0.0.0.0
PORT=8787
DATABASE_PATH=/var/lib/seminar/seminar.sqlite
OBS_LOG_SOURCE=docker
OBS_DOCKER_CONTAINER=seminar-app
OBS_DOCKER_BIN=docker
BUILD_ID=cc8a658-34c65626-20260301T155536Z
ADMIN_SECRET=REDACTED
```

```bash
$ docker logs --tail 1000 seminar-app | grep -c 'spawn journalctl ENOENT'
0
$ docker logs --tail 1000 seminar-app | grep -c 'spawn docker ENOENT'
0
```

## 4. Expected artifact mapping (commit -> digest)
Target release commit:
- `cc8a658061bdf7d413baf84594ddafa2fc3dca39`

Effective runtime mapping used for parity proof:
- `commit_sha=cc8a658061bdf7d413baf84594ddafa2fc3dca39`
- `build_id=cc8a658-34c65626-20260301T155536Z`
- `image_id=sha256:00494800eaa87c526e307fe3ddbbc4b542777e7bfa997b8b7f4439b0fcede008`
- `container_id=67c7926ff6fd7ba8bac69fa58173ee6c46c50ee5e72d33b6d2cb6fdbd7719a92`

Notes:
- `repo_digests=[]` for this image in current VPS flow (no registry-published digest in pipeline baseline).

## 5. Deploy steps performed
1. Снят runtime inventory (`docker ps`, `docker inspect`, env keys, logs signatures).
2. Подтверждён drift signature до фикса: ранее фиксировался `spawn docker ENOENT`.
3. Обновлён smoke compose `/opt/seminar/compose.seminar.artifact.yml`:
   - добавлены bind mounts:
     - `/usr/bin/docker:/usr/bin/docker:ro`
     - `/var/run/docker.sock:/var/run/docker.sock`
   - сохранены явные env:
     - `OBS_LOG_SOURCE=docker`
     - `OBS_DOCKER_CONTAINER=seminar-app`
     - `OBS_DOCKER_BIN=docker`
     - `BUILD_ID=...`
4. Выполнен `docker compose up -d --force-recreate` для smoke-контейнера.
5. Проверен container health + runtime parity markers.

## 6. Smoke evidence
Smoke через Traefik smoke-port `127.0.0.1:18080` (Host: `seminar-ai.ru`):

```bash
root=200
health=200
lead_create=200
lead_duplicate=409
obs_logs=200
leads_before=2
leads_after=3
leads_delta=1
```

Structured evidence:
```json
{"event":"obs_log_source_selected","payload":{"source":"docker", "...":"..."}}
{"event":"obs_log_retrieval_completed","payload":{"source":"docker","emitted_count":0,"emitted_bytes":0}}
```

Error signature check:
- `spawn journalctl ENOENT` -> `0`
- `spawn docker ENOENT` -> `0`

Public prod untouched:
- `systemctl is-active nginx seminar` -> `active / active`
- nginx остаётся owner `:80/:443`, Traefik работает только в smoke bind `127.0.0.1:18080/18443`.

## 7. Drift guard changes
Обновлён `docs/runbooks/DEPLOY_DOCKER_CONTRACT.md`:
1. Добавлены обязательные поля artifact identity (`commit_sha`, `build_id`, `image_digest|image_id`).
2. Добавлен обязательный post-deploy parity-check (`docker inspect` + env check).
3. Добавлен обязательный smoke `/admin/obs/logs` при `OBS_LOG_SOURCE=docker`.
4. Зафиксированы два режима anti-drift:
   - Target: registry pinned digest.
   - Temporary: `image_id + BUILD_ID + file-hash` parity proof при отсутствии registry digest.

## 8. Verdict (PASS/FAIL)
`PASS`

Условия prompt выполнены:
1. `seminar-app` поднят в Docker на VPS без public edge switch.
2. `/admin/obs/logs` в docker-source green (HTTP 200), `journalctl ENOENT` не воспроизводится.
3. Сформирован parity proof bundle (`commit_sha`, `build_id`, `image_id`, `container_id`, structured logs).
4. Добавлен минимальный guard в deploy-контракт.

## 9. Next minimal step (1 пункт)
1. Добавить в CI publish шага Docker image (GHCR) и перевести parity-check с `image_id` на pinned `repo@sha256:digest` как mandatory production gate.
