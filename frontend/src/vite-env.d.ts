/// <reference types="vite/client" />

declare const __AUTH_REAL__: boolean;

interface ImportMetaEnv {
  readonly VITE_SHOW_DEMO_CREDENTIALS?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_AUTH_MODE?: string;
  readonly VITE_DEV_SWITCHER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
