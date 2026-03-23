/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENVIRONMENT_MODE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
