# Environment Matrix

| Environment | Runtime | Storage | TURNSTILE_SECRET_KEY | ADMIN_SECRET | Cabinet Bootstrap | Key Files |
| --- | --- | --- | --- | --- | --- | --- |
| local (default) | `node server/index.mjs` | local SQLite (`./data/seminar.sqlite`) | unset (captcha disabled) | set locally | optional | `.env.local` (optional), shell env |
| local (captcha real) | `node server/index.mjs` | local SQLite (`./data/seminar.sqlite`) | set (real verify) | set locally | optional | `.env.local` (optional), shell env |
| production (canonical) | Docker app container behind Traefik | SQLite (`/var/lib/seminar/seminar.sqlite` inside mounted volume) | optional (recommended if region allows) | required | disabled by default; enable only for intentional admin bootstrap/reset | `/etc/seminar/seminar.docker.env`, `/opt/seminar/.env.seminar`, `/opt/seminar/compose.seminar.ghcr.yml` |
| production (legacy rollback-only snapshot) | `systemd` service behind `nginx` | SQLite (`/var/lib/seminar/seminar.sqlite`) | optional | required | exceptional/manual only | `/etc/seminar/seminar.env`, `seminar.service`, nginx site config |

## Notes

1. Never commit real secrets to git.
2. Current production does not use Cloudflare Pages/D1.
3. `TURNSTILE_SITE_KEY` is optional for UI:
   - if unset, widget is hidden;
   - backend accepts leads without Turnstile validation when `TURNSTILE_SECRET_KEY` is unset.
4. Keep `ADMIN_SECRET` in env only and rotate at least once per 30 days.
5. Cabinet bootstrap env:
   - `CABINET_BOOTSTRAP_ADMIN`
   - `CABINET_BOOTSTRAP_USERNAME`
   - `CABINET_BOOTSTRAP_EMAIL`
   - `CABINET_BOOTSTRAP_PASSWORD`
   - `CABINET_BOOTSTRAP_ALLOW_RESET` (optional, only for intentional one-time reset)
6. Bootstrap flow is env-assisted and intentional:
   - enable to create the first internal admin;
   - if an existing admin must be reset, add `CABINET_BOOTSTRAP_ALLOW_RESET=1` only for that startup;
   - verify login;
   - disable again.
7. Optional cabinet tuning env:
   - `CABINET_SESSION_COOKIE_NAME`
   - `CABINET_SESSION_TTL_HOURS`
   - `CABINET_LOGIN_WINDOW_MINUTES`
   - `CABINET_LOGIN_MAX_ATTEMPTS`
8. Runtime interpretation:
   - local `node server/index.mjs` is the only expected local flow;
   - Docker + Traefik is the canonical production contour;
   - legacy `systemd + nginx` is rollback/live snapshot only and MUST NOT be treated as the default release path.
9. Current live control plane on the VPS is Docker-native:
   - `/etc/seminar/seminar.docker.env`
   - `/opt/seminar/.env.seminar`
   - `/opt/seminar/compose.seminar.ghcr.yml`
10. First cabinet go-live on a pre-cabinet production DB requires:
   - temporary bootstrap envs;
   - SQLite triplet backup before rollout;
   - docker-native rollback plan using previous pinned image plus DB snapshot if needed.
