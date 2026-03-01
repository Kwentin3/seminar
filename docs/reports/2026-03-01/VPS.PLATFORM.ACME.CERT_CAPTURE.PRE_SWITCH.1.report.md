# VPS.PLATFORM.ACME.CERT_CAPTURE.PRE_SWITCH.1.report

## 1. Executive summary
- Выполнен controlled ACME capture-run на VPS в окне `2026-03-01 15:03:09Z` → `15:12:14Z`.
- Во время окна Traefik владел `:80/:443`, форензика снималась поминутно 10 итераций.
- LE сертификат не выпущен: HTTPS оставался на `TRAEFIK DEFAULT CERT`, `acme.json` не изменился, `cert_count=0`.
- Forensic bundle сохранён до rollback, затем legacy восстановлен (`nginx active`, `https://seminar-ai.ru` -> `200`).
- Причина классифицирована как `Router misconfig / no matching rule` для домена `seminar-ai.ru` в поднятом stack-контуре capture-run.

Forensic directory:
- `/opt/platform/traefik/forensics/acme-capture-20260301T150309Z`

## 2. Baseline probes (nginx owner)
Команды и выводы (до переключения owner):

```bash
curl -I http://seminar-ai.ru/
curl -I https://seminar-ai.ru/
curl -v http://seminar-ai.ru/.well-known/acme-challenge/probe-pre
```

Факты:
- `http://seminar-ai.ru/` -> `301 Moved Permanently`, `Server: nginx/1.18.0`.
- `https://seminar-ai.ru/` -> `200 OK`, `Server: nginx/1.18.0`.
- `/.well-known/acme-challenge/probe-pre` -> `301` на HTTPS (через nginx).

Артефакты:
- `baseline/http.head.txt`
- `baseline/https.head.txt`
- `baseline/challenge.pre.stderr.txt`

## 3. Window probes (Traefik owner)
Переключение owner:
- `systemctl stop nginx`
- `docker compose --env-file /opt/platform/traefik/.env.platform-edge -f /opt/platform/traefik/compose.platform-edge.yml up -d`

Факты owner:
- После старта stack `:80/:443` заняты `docker-proxy` (Traefik).
- Traefik container: `platform-edge-traefik`, id `e66580b99cba...`, status `healthy`.

Поминутные probe-результаты (10/10 минут):
- HTTP probe `http://seminar-ai.ru/.well-known/acme-challenge/probe-XX` -> всегда `404`.
- HTTPS cert probe -> всегда:
  - `subject=CN = TRAEFIK DEFAULT CERT`
  - `issuer=CN = TRAEFIK DEFAULT CERT`
- Текущий `acme cert_count` -> всегда `0`.

Пример minute-01:
- `http.probe.code.txt`: `404`
- `https.cert.txt`:
  - `subject=CN = TRAEFIK DEFAULT CERT`
  - `issuer=CN = TRAEFIK DEFAULT CERT`

Артефакты:
- `window/minute-01..10/*`

## 4. Traefik ACME logs highlights
Источник:
- `final/traefik.logs.since30m.log`

Ключевые строки:
- startup:
  - `Starting provider *acme.Provider`
  - `Testing certificate renew...`
- во все минуты probe:
  - `Cannot retrieve the ACME challenge for seminar-ai.ru (token "probe-0X")`

Важно:
- В логах нет успешного ACME order/issuance для `seminar-ai.ru`.
- Нет признаков `rate limit` / `429` / `unauthorized`.

## 5. acme.json timeline (cert present? when?)
SHA256 и cert_count по timeline:
- start (`task0.acme.sha256.txt`):
  - `2991c569a59fa2f83cdfc4afae0780253bf770f2ac8b7f98d9f469c6e5e42837`
- snapshots (minute-01/03/05/07/09):
  - тот же SHA256
  - `cert_count=0`
- final (`final/acme.final.sha256`, `final/acme.final.meta`):
  - тот же SHA256
  - `cert_count=0`

Вывод:
- `acme.json` в окне capture-run не менялся по сути сертификатов; новых `Certificates` не появилось.

## 6. Root cause classification
Классификация:
- `Router misconfig / no matching rule`

Доказательства:
1. Traefik owner подтверждён (`:80/:443` на docker-proxy), HTTP достигает Traefik (probe = `404`, не timeout).
2. HTTPS всё окно отдавал `TRAEFIK DEFAULT CERT`.
3. `acme.json` неизменен (`cert_count=0`).
4. В поднятом production edge stack host-rule присутствует только для smoke:
   - `traefik.http.routers.edge-smoke.rule=Host(${SMOKE_HOST...})`
   - отсутствует router rule `Host(seminar-ai.ru)` в `ops/platform/traefik/compose.platform-edge.yml`.

Сопутствующие исключения (по логам):
- `HTTP-01 not reaching Traefik` — нет (до Traefik доходит, статус `404`).
- `Redirect issue` — нет в окне Traefik owner (редирект nginx был только baseline pre-switch).
- `ACME-side rejection / rate limit` — явных признаков нет.

## 7. Minimal corrective action
Без применения в этом run:
1. Для cert-capture поднимать Traefik с явным router для `seminar-ai.ru` + `tls.certresolver=le` (временный dedicated service/router или attach existing service с этим host rule).
2. Повторить 10–15 минутное capture-окно с тем же forensic-пакетом; success gate:
   - `issuer=Let's Encrypt` на `openssl s_client`,
   - и/или `acme.json -> Certificates > 0`.
3. Сохранить текущий forensic pattern как обязательный pre-cutover gate (логи + acme snapshots + probes до rollback).

## 8. Verdict (CERT_ISSUED / NOT_ISSUED_WITH_CAUSE)
`NOT_ISSUED_WITH_CAUSE`

Cause:
- `Router misconfig / no matching rule` для `seminar-ai.ru` в capture stack.

## 9. Next minimal step (1 пункт)
1. Отдельным OPS prompt добавить/поднять временный `Host(seminar-ai.ru)` router с `tls.certresolver=le` (без cutover), затем повторить этот же forensic capture-run.
