# VPS.PLATFORM.ACME.CERT_CAPTURE.PROD_ROUTER.2.report

## 1. Executive summary
- ACME capture run выполнен успешно с production router labels (`env-based`) на `seminar-app`.
- В окне Traefik owner сертификат выдан: на minute-02 issuer стал Let's Encrypt.
- `acme.json` изменился, `Certificates` перешёл `0 -> 1`, SAN включает `www.seminar-ai.ru`.
- Обязательный forensic capture выполнен до rollback.
- Legacy owner восстановлен: `nginx active`, публичный `https://seminar-ai.ru` снова обслуживается через nginx.

Forensics directory:
- `/opt/platform/traefik/forensics/acme-capture2-20260301T155757Z`

## 2. SPEC GUARD confirmation
Подтверждено до старта окна:
1. Файлы присутствуют:
   - `/opt/platform/traefik/compose.platform-edge.yml`
   - `/opt/seminar/compose.seminar.ghcr.yml`
   - `/opt/seminar/.env.seminar`
2. `docker network edge` существует.
3. `/opt/platform/traefik/acme/acme.json` существует и writable.
4. Baseline capture сохранён:
   - `date -u`
   - `ss -tulpn | grep -E ':80|:443'`
   - `sha256sum acme.json`
   - `docker network ls | grep edge`

`SPEC_GUARD=PASS` зафиксирован в `spec_guard.result.txt`.

## 3. Router label proof (pre-window)
Команда:
```bash
docker compose --env-file /opt/seminar/.env.seminar \
  -f /opt/seminar/compose.seminar.ghcr.yml config
```

Проверка соответствия env -> effective labels:
```text
expected_rule=Host(`seminar-ai.ru`) || Host(`www.seminar-ai.ru`)
actual_rule=Host(`seminar-ai.ru`) || Host(`www.seminar-ai.ru`)

expected_certresolver=le
actual_certresolver=le

expected_port=8787
actual_port=8787
```

Contract conflict не обнаружен.

## 4. Window timeline (minute probes)
Window start:
1. `systemctl stop nginx`
2. `docker compose ...compose.platform-edge.yml up -d`
3. `docker compose ...compose.seminar.ghcr.yml up -d`
4. health:
   - traefik: `health=healthy status=running`
   - seminar-app: `health=healthy status=running`

Container ids:
1. `platform-edge-traefik`: `ddc7634dbbee...`
2. `seminar-app`: `dd9d7e26d010...`

Minute probes:
1. minute-01:
   - HTTP probe code: `404` (request accepted by Traefik, no timeout)
   - cert:
     - `issuer=CN = TRAEFIK DEFAULT CERT`
     - `subject=CN = TRAEFIK DEFAULT CERT`
   - `acme cert_count=0`
2. minute-02:
   - HTTP probe code: `404`
   - cert:
     - `issuer=C = US, O = Let's Encrypt, CN = R13`
     - `subject=CN = seminar-ai.ru`
   - `acme cert_count=1`
   - success condition reached (`cert_detected_minute_02`)

## 5. Traefik ACME log highlights
Источник: `final/traefik.logs.since30m.log`

Ключевые события:
1. `Starting provider *acme.Provider`
2. `Testing certificate renew...`
3. Во время probe-запросов:
   - `Cannot retrieve the ACME challenge for seminar-ai.ru (token "probe2-01")`
   - `Cannot retrieve the ACME challenge for seminar-ai.ru (token "probe2-02")`

Несмотря на probe errors, issuance произошла (подтверждено issuer + `acme.json` state change).

## 6. acme.json timeline
Start:
```text
2991c569a59fa2f83cdfc4afae0780253bf770f2ac8b7f98d9f469c6e5e42837  /opt/platform/traefik/acme/acme.json
```

Final:
```text
dc8555cf1e47c7a138cd7dcde08b361206311847c527054a4f54018b28aaf067  final/acme.final.json
cert_count=1
```

Safe parsed certificate domains:
```text
cert_1_main=seminar-ai.ru
cert_1_sans=www.seminar-ai.ru
```

Итого:
1. `Certificates`: `0 -> 1`
2. Выпущен SAN-cert для apex + www.

## 7. Verdict (CERT_ISSUED / NOT_ISSUED_WITH_CAUSE)
`CERT_ISSUED`

Rollback status after mandatory capture:
1. `docker compose ...seminar... down`
2. `docker compose ...traefik... down`
3. `systemctl start nginx`
4. Проверка:
   - `systemctl is-active nginx` -> `active`
   - `curl -I https://seminar-ai.ru` -> `200 OK`

## 8. Next minimal step (1 пункт)
1. Выполнить controlled public cutover prompt, используя уже выданный сертификат и тот же routing parity gate (`docker compose config` + label proof) перед переключением owner.
