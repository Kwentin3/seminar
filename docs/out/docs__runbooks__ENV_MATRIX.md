# Environment Matrix

| Environment | Runtime | Storage | TURNSTILE_SECRET_KEY | ADMIN_SECRET | Key Files |
| --- | --- | --- | --- | --- | --- |
| local (default) | `node server/index.mjs` | local SQLite (`./data/seminar.sqlite`) | unset (captcha disabled) | set locally | `.env.local` (optional), shell env |
| local (captcha real) | `node server/index.mjs` | local SQLite (`./data/seminar.sqlite`) | set (real verify) | set locally | `.env.local` (optional), shell env |
| vps production | `systemd` service (`seminar.service`) | SQLite (`/var/lib/seminar/seminar.sqlite`) | optional (recommended if region allows) | required | `/etc/seminar/seminar.env` |

## Notes

1. Never commit real secrets to git.
2. Current production does not use Cloudflare Pages/D1.
3. `TURNSTILE_SITE_KEY` is optional for UI:
   - if unset, widget is hidden;
   - backend accepts leads without Turnstile validation when `TURNSTILE_SECRET_KEY` is unset.
4. Keep `ADMIN_SECRET` in env only and rotate at least once per 30 days.
