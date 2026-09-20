import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'

// .env не подхватывается сам (dotenv в зависимостях нет) — читаем руками,
// чтобы интеграционные тесты работали в свежем окружении без экспорта вручную.
try {
  for (const line of readFileSync(new URL('./.env', import.meta.url), 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z_]+)="?([^"]*)"?$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
} catch {
  // нет .env — тесты сами скажут, чего не хватает
}

export default defineConfig({
  test: {
    environment: 'node',
    // Все интеграционные наборы делят одну dev-БД и гоняются за общими
    // строками товаров/остатков — параллельные файлы дают гонки. Гоним
    // тесты последовательно, одним воркером.
    fileParallelism: false,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
})
