# Environment Matrix

| Environment | TURNSTILE_MODE | ALLOW_TURNSTILE_MOCK | DB | ADMIN_SECRET | NODE_VERSION |
| --- | --- | --- | --- | --- | --- |
| local (default) | `real` | `0` | local D1 (`--local`) | from `.dev.vars` | local toolchain |
| local (smoke) | `mock` | `1` | local D1 (`--local`) | from `.dev.vars` | local toolchain |
| preview | unset (real mode) | unset / `0` | `preview_database_id` from `wrangler.toml` | set in Pages Preview env vars | `22` |
| production | unset (real mode) | unset / `0` | `database_id` from `wrangler.toml` | set in Pages Production env vars | `22` |

## Notes

1. Never commit real secrets to git.
2. Keep Preview and Production D1 IDs different to avoid data mixing.
3. `.dev.vars` is local-only for `wrangler pages dev`.
