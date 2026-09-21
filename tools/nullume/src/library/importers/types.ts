import { z } from "zod";
import { NullumeConfig } from "../../core/config.js";

/**
 * Тип импортёра: 'clean' (публичный API) или 'local-only' (требует гейт)
 */
export type ImporterKind = "clean" | "local-only";

/**
 * Опции для запуска импортёра
 */
export interface ImportRunOptions {
  /** Поисковый запрос (зависит от импортёра) */
  query?: string;
  /** Коллекция/доска/канал (зависит от импортёра) */
  collection?: string;
  /** Максимальное количество результатов */
  limit: number;
  /** Дата начала (ISO 8601, опционально) */
  since?: string;
  /** Реализация fetch для тестирования (по умолчанию встроенный fetch) */
  fetchImpl?: typeof fetch;
  /** AbortSignal для отмены */
  signal?: AbortSignal;
  /** Логирование */
  log: (msg: string) => void;
  /** Конфиг nullume (для учётных данных) */
  config: NullumeConfig;
  /** Переменные окружения */
  env: NodeJS.ProcessEnv;
}

/**
 * Кандидат на добавление в библиотеку: изображение с метаданными
 */
const PaletteColorSchema = z.object({
  /** RGB цвет [0-255, 0-255, 0-255] */
  color: z.tuple([
    z.number().min(0).max(255),
    z.number().min(0).max(255),
    z.number().min(0).max(255),
  ]),
  /** Доля цвета в изображении [0-1] */
  ratio: z.number().min(0).max(1),
});

const BaseCandidateSchema = z.object({
  /** Прямая ссылка на изображение (https только) */
  url: z.string().url().optional(),
  /** Локальный путь к файлу (если скачано) */
  filePath: z.string().optional(),
  /** URL страницы источника (где найдено изображение) */
  pageUrl: z.string().url().optional(),
  /** Автор/создатель */
  author: z.string().optional(),
  /** Лицензия использования */
  license: z.string().optional(),
  /** ID источника (например 'unsplash', 'pinterest') */
  source: z.string(),
  /** Уникальный ID в источнике */
  sourceRef: z.string(),
  /** Дополнительные метаданные */
  meta: z.record(z.string(), z.unknown()).optional(),
  /** Палитра цветов с долей */
  palette: z.array(PaletteColorSchema).optional(),
  /** Теги/ключевые слова */
  tags: z.array(z.string()).optional(),
});

export const RefCandidateSchema = BaseCandidateSchema
  .refine(
    (data: z.infer<typeof BaseCandidateSchema>) => !!(data.url || data.filePath),
    "Должно быть либо url, либо filePath"
  )
  .transform((data) => ({
    ...data,
    meta: data.meta ?? {},
    tags: data.tags ?? [],
  }));

export type RefCandidate = z.infer<typeof RefCandidateSchema>;

/**
 * Интерфейс импортёра
 */
export interface Importer {
  /** Уникальный ID импортёра */
  id: string;
  /** Вид импортёра: 'clean' или 'local-only' */
  kind: ImporterKind;
  /** Название импортёра */
  title: string;
  /** Описание и инструкции */
  description: string;
  /**
   * Настройка импортёра: проверка учётных данных, сессий.
   * Для local-only импортёров ДОЛЖЕН вызвать assertLocalOnlyAllowed()
   */
  configure(config: NullumeConfig, env: NodeJS.ProcessEnv): Promise<void>;
  /**
   * Запустить импортёр и вернуть async iterable кандидатов
   */
  run(opts: ImportRunOptions): AsyncIterable<RefCandidate>;
}
