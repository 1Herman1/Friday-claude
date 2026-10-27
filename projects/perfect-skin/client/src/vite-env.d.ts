/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_DEMO_VIDEO_REVIEWS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
