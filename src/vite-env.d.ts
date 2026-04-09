/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENVIRONMENT_MODE?: string
  readonly VITE_API_BASE_URL?: string
  readonly VITE_INGESTION_SERVICE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
