import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@simba/shared': path.resolve(__dirname, '../shared/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    // Интеграционные тесты делят одну тестовую базу и чистят её между кейсами —
    // параллельный запуск файлов сделал бы их недетерминированными.
    fileParallelism: false,
    testTimeout: 20000,
  },
})
