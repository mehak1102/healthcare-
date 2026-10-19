/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional absolute API base for deployments where the API is on another subdomain. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
