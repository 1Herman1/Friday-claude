import { UsageError } from "../../core/errors.js";
import { NullumeConfig } from "../../core/config.js";

/**
 * Текст предупреждения о рисках импортёров с ограничениями
 */
export const LOCAL_ONLY_WARNING = `⚠️  Используются импортёры с ограничениями:
   - Pinterest (поиск по cookies): риск блокировки аккаунта
   - Dribbble (расширенный скрейп): не поддерживается API
   - X (платный поиск): $0.005 за запрос

Убедитесь, что вы согласны с этими рисками. Риск на вас.`;

/**
 * Проверить, разрешено ли использование local-only импортёров
 * Требует трёх условий одновременно:
 * 1. config.acknowledgedRiskyImporters === true
 * 2. env.NULLUME_LOCAL_IMPORTERS === '1'
 * 3. Не в CI/GitHub Actions
 *
 * @param config Конфиг nullume
 * @param env Переменные окружения (по умолчанию process.env)
 * @throws UsageError если условия не выполнены
 */
export function assertLocalOnlyAllowed(config: NullumeConfig, env: NodeJS.ProcessEnv = process.env): void {
  // Условие 1: явное согласие в конфиге
  if (!config.acknowledgedRiskyImporters) {
    throw new UsageError(
      `Local-only импортёры требуют acknowledgedRiskyImporters=true в ~/.nullume/config.json\n${LOCAL_ONLY_WARNING}`
    );
  }

  // Условие 2: переменная окружения
  if (env.NULLUME_LOCAL_IMPORTERS !== "1") {
    throw new UsageError(
      `Установите env NULLUME_LOCAL_IMPORTERS=1 для использования local-only импортёров\n${LOCAL_ONLY_WARNING}`
    );
  }

  // Условие 3: не в CI
  if (env.CI || env.GITHUB_ACTIONS) {
    throw new UsageError(
      `Local-only импортёры не запускаются в CI/GitHub Actions\n${LOCAL_ONLY_WARNING}`
    );
  }

  // Предупреждение: запуск через прокси
  if (env.HTTPS_PROXY || env.http_proxy) {
    console.error(`⚠️  Запуск local-only импортёров через прокси может привести к блокировке`);
  }
}
