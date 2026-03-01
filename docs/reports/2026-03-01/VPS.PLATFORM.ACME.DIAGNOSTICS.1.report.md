# VPS.PLATFORM.ACME.DIAGNOSTICS.1.report

## 1. Executive summary
- Диагностика выполнена в режиме `read-only`: без остановки `nginx`, без перезапуска Traefik, без изменений DNS/ACME/конфигов.
- Текущий публичный контур: `nginx` владеет `:80/:443`, challenge path `/.well-known/acme-challenge/*` сейчас отвечает через `nginx` и уходит в HTTPS redirect (`301`).
- `acme.json` валиден по правам (`600`), ACME account зарегистрирован (`status=valid`), но `le.Certificates = null`.
- Наиболее вероятный класс сбоя для неудачного cutover: `HTTP-01 challenge not reachable / not completed in cutover window`.
- Критичный GAP: runtime-логи `platform-edge-traefik` на момент fail отсутствуют (контейнер удалён rollback'ом), поэтому точная подпричина (challenge routing vs rate-limit) не может быть доказана с высокой уверенностью.

## 2. DNS findings
### 2.1 Команды
```powershell
# dig недоступен (и на VPS, и локально), использован эквивалент Resolve-DnsName
Resolve-DnsName -Name seminar-ai.ru -Type A
Resolve-DnsName -Name seminar-ai.ru -Type AAAA
Resolve-DnsName -Name seminar-ai.ru -Type NS
Resolve-DnsName -Name seminar-ai.ru -Type A -Server 1.1.1.1
Resolve-DnsName -Name seminar-ai.ru -Type A -Server 8.8.8.8
Resolve-DnsName -Name www.seminar-ai.ru -Type A
```

### 2.2 Выводы (факты)
```text
A (apex): 91.132.48.224
A (www):  91.132.48.224
AAAA: отсутствует (authority SOA returned)
NS: monika.ns.cloudflare.com, vicky.ns.cloudflare.com
A @1.1.1.1: 91.132.48.224
A @8.8.8.8: 91.132.48.224
TTL observed:
- local cache: 59591 (apex), 70647 (www)
- 1.1.1.1: 86400
- 8.8.8.8: 10579 (apex), 21600 (www)
```

### 2.3 Интерпретация
- `seminar-ai.ru` и `www.seminar-ai.ru` резолвятся в IP VPS `91.132.48.224`.
- NS на Cloudflare есть, но A-записи возвращают origin-IP VPS (признаков CF proxy-front в ответах не найдено).

## 3. External reachability findings
### 3.1 Команды
```bash
curl -v http://seminar-ai.ru/.well-known/acme-challenge/test
curl -I http://seminar-ai.ru
curl -I https://seminar-ai.ru
```

### 3.2 Выводы (факты)
```text
* Connected to seminar-ai.ru (91.132.48.224) port 80
< HTTP/1.1 301 Moved Permanently
< Server: nginx/1.18.0
< Location: https://seminar-ai.ru/.well-known/acme-challenge/test

HTTP/1.1 301 Moved Permanently
Server: nginx/1.18.0
Location: https://seminar-ai.ru/

HTTP/1.1 200 OK
Server: nginx/1.18.0
```

### 3.3 Интерпретация
- На текущем live challenge-path на `:80` обслуживает `nginx`, не Traefik.
- Внешняя связность до `:80` и `:443` есть.

## 4. Traefik config findings
### 4.1 Runtime наличие контейнера
```bash
docker ps -a --filter name=platform-edge
docker inspect platform-edge-traefik
docker logs platform-edge-traefik --since 30m
```

```text
docker ps -a: empty (no platform-edge containers)
docker inspect platform-edge-traefik -> []
docker logs platform-edge-traefik -> No such container
```

### 4.2 Конфиг стека на VPS
Источник: `/opt/platform/traefik/compose.platform-edge.yml`

```text
--entrypoints.web.address=:80
--entrypoints.websecure.address=:443
--certificatesresolvers.le.acme.storage=/acme/acme.json
--certificatesresolvers.le.acme.httpchallenge=true
--certificatesresolvers.le.acme.httpchallenge.entrypoint=web
```

Источник: `/opt/seminar/compose.seminar.ghcr-smoke.yml`

```text
traefik.http.routers.seminar-web.rule=Host(`seminar-ai.ru`) || Host(`www.seminar-ai.ru`)
traefik.http.routers.seminar-websecure.rule=Host(`seminar-ai.ru`) || Host(`www.seminar-ai.ru`)
traefik.http.routers.seminar-websecure.tls=true
traefik.http.routers.seminar-websecure.tls.certresolver=le
```

### 4.3 Исторические артефакты cutover (read-only)
Источник: `/tmp/cutover2-stage2b.sh`, `/tmp/cutover2b-head.err`

```text
- script explicitly: systemctl stop nginx
- then: docker compose ... compose.platform-edge.yml up -d
- then TLS wait loop (~3 min)
- failure: curl: (60) SSL certificate problem: self signed certificate
```

Источник: `/var/lib/docker/containers/*-json.log` (исторический smoke-контейнер 10:31 UTC)

```text
provider *acme.Provider started
provider *docker error: client version 1.24 is too old. Minimum supported API version is 1.44
```

Примечание:
- этот docker API mismatch относится к раннему smoke-эпизоду (`10:31 UTC`) и не доказывает причину финального cutover (`~14:42 UTC`).
- текущий Docker на VPS: `ServerVersion=28.5.2`, `MinAPIVersion=1.24`.

## 5. ACME storage findings
### 5.1 Команды
```bash
stat -c '%n %a %U:%G %s bytes %y' /opt/platform/traefik/acme/acme.json
# анализ содержимого (без вывода приватного ключа)
```

### 5.2 Выводы (факты)
```text
/opt/platform/traefik/acme/acme.json 600 root:root 3449 bytes 2026-03-01 14:12:44 +0000
ACME account: present
Registration status: valid
Certificates: null
```

### 5.3 Интерпретация
- Права/доступ к storage выглядят корректно (`600`, writable ранее подтверждён по факту записи account).
- Сертификат не выпущен/не сохранён (`Certificates = null`).

## 6. Firewall findings
### 6.1 Команды
```bash
ss -tulpn | grep -E ':80|:443'
iptables -L INPUT -n --line-numbers
iptables -L DOCKER-USER -n --line-numbers
ufw status
```

### 6.2 Выводы (факты)
```text
:80/:443 listen by nginx (0.0.0.0 and [::])
INPUT policy ACCEPT
Only explicit INPUT rule: f2b-sshd on tcp/22
DOCKER-USER chain present, no blocking rules
ufw: command not found
```

### 6.3 Интерпретация
- Признаков firewall-блокировки `:80`/`:443` не выявлено.

## 7. Root cause classification
- [ ] DNS misconfiguration
- [ ] Wrong IP
- [ ] Cloudflare proxy interference
- [x] HTTP-01 challenge not reachable / not completed in cutover window
- [ ] Port 80 blocked
- [ ] Traefik router misconfiguration
- [ ] ACME rate limit
- [ ] File permission issue
- [x] Other (explicit): отсутствуют runtime-логи Traefik именно на момент fail (контейнер удалён rollback), поэтому точная подпричина не доказуема post-factum.

Обоснование выбора:
1. DNS и IP корректны и консистентны по нескольким резолверам.
2. Порты публично достижимы, явной firewall-блокировки нет.
3. ACME storage корректен по правам, account валиден, но cert отсутствует.
4. На момент неудачи фиксировался self-signed (значит LE cert не был готов в окно cutover).

## 8. Minimal corrective action (no changes applied)
1. В следующем cutover-окне добавить обязательный ACME forensic capture до rollback:
   - `docker logs platform-edge-traefik --since <window>` в файл артефакта;
   - внешний probe challenge-path (`http://seminar-ai.ru/.well-known/acme-challenge/<probe>`) пока Traefik владеет `:80`.
2. Увеличить ACME wait-gate (например, до 10-15 минут) с live-проверкой двух условий:
   - в Traefik logs появились попытки/результаты ACME challenge;
   - `acme.json` перешёл из `Certificates=null` в непустой сертификат.
3. В rollback-скрипт включить обязательное сохранение Traefik логов и `acme.json` snapshot перед `compose down`.

## 9. Confidence level
`medium`

Причина не `high`:
- недоступны runtime-логи именно failed prod-контейнера Traefik (после rollback контейнер удалён), поэтому точная первопричина между `HTTP-01 validation path` и `ACME-side rejection/rate-limit` не доказана напрямую.
