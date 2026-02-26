/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly TURNSTILE_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
