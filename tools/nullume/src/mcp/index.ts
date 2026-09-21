import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { schema as kieBalanceSchema, handler as kieBalanceHandler } from "./tools/kieBalance.js";
import { schema as listModelsSchema, handler as listModelsHandler } from "./tools/listModels.js";
import { schema as getModelSchema, handler as getModelHandler } from "./tools/getModel.js";
import { schema as recommendModelsSchema, handler as recommendModelsHandler } from "./tools/recommendModels.js";
import { schema as estimateCostSchema, handler as estimateCostHandler } from "./tools/estimateCost.js";
import { schema as generateSchema, handler as generateHandler } from "./tools/generate.js";
import { schema as getJobSchema, handler as getJobHandler } from "./tools/getJob.js";
import { schema as listJobsSchema, handler as listJobsHandler } from "./tools/listJobs.js";
import { schema as uploadFileSchema, handler as uploadFileHandler } from "./tools/uploadFile.js";
import { schema as listPresetsSchema, handler as listPresetsHandler } from "./tools/listPresets.js";
import { schema as rerunJobSchema, handler as rerunJobHandler } from "./tools/rerunJob.js";

import { schema as libSearchSchema, handler as libSearchHandler } from "./tools/libSearch.js";
import { schema as libFamiliesSchema, handler as libFamiliesHandler } from "./tools/libFamilies.js";
import { schema as libFamilySchema, handler as libFamilyHandler } from "./tools/libFamily.js";
import { initSchema as initLibImportSchema, schema as libImportSchema, handler as libImportHandler } from "./tools/libImport.js";
import { schema as libClustersSchema, handler as libClustersHandler } from "./tools/libClusters.js";
import { schema as libProposeSchema, handler as libProposeHandler } from "./tools/libPropose.js";

export function createMcpServer() {
  const server = new McpServer({
    name: "nullume",
    version: "0.1.0",
  });

  server.registerTool(
    "kie_balance",
    {
      title: "Получить баланс кредитов",
      description: "Проверяет текущий баланс кредитов kie.ai. Используется перед генерацией дорогих моделей.",
      inputSchema: kieBalanceSchema,
    },
    kieBalanceHandler
  );

  server.registerTool(
    "list_models",
    {
      title: "Список моделей",
      description:
        "Показывает доступные модели для генерации (изображения, видео, аудио). " +
        "Компактный вывод: id, категория, цена в кредитах, примерная стоимость в USD. " +
        "Если моделей > 60, вернёт truncated с кол-вом неучтённых.",
      inputSchema: listModelsSchema,
    },
    listModelsHandler
  );

  server.registerTool(
    "get_model",
    {
      title: "Детали модели",
      description:
        "Полная информация о конкретной модели: поля, требуемые параметры, цена, источник схемы, документация. " +
        "Используется перед generate, чтобы узнать, какие поля обязательны.",
      inputSchema: getModelSchema,
    },
    getModelHandler
  );

  server.registerTool(
    "recommend_models",
    {
      title: "Рекомендованные модели",
      description:
        "Список рекомендованных моделей по категории, отсортированные по цене (дешевле в начале). " +
        "Помогает выбрать оптимальную модель для задачи.",
      inputSchema: recommendModelsSchema,
    },
    recommendModelsHandler
  );

  server.registerTool(
    "estimate_cost",
    {
      title: "Оценка стоимости",
      description:
        "Приблизительная стоимость генерации для модели и параметров. " +
        "Возвращает диапазон (min–max) в кредитах и USD. Если цена > $1 или неизвестна — используй confirm_cost в generate.",
      inputSchema: estimateCostSchema,
    },
    estimateCostHandler
  );

  server.registerTool(
    "generate",
    {
      title: "Создать генерацию",
      description:
        "Запустить задачу генерации изображения, видео или аудио через kie.ai. " +
        "По умолчанию ждёт завершения и скачивает результаты. " +
        "При стоимости > $1 или неизвестной цене требует confirm_cost=true. " +
        "При таймауте вернёт job_id для проверки статуса через get_job.",
      inputSchema: generateSchema,
    },
    generateHandler
  );

  server.registerTool(
    "get_job",
    {
      title: "Статус задачи",
      description:
        "Проверяет статус задачи генерации. Если задача pending, опросит kie.ai один раз и обновит. " +
        "При success скачает результаты. Используется после generate, если ожидание вышло по таймауту.",
      inputSchema: getJobSchema,
    },
    getJobHandler
  );

  server.registerTool(
    "list_jobs",
    {
      title: "История генераций",
      description:
        "Список недавних задач с их статусом. Помогает найти старые генерации и переиспользовать результаты.",
      inputSchema: listJobsSchema,
    },
    listJobsHandler
  );

  server.registerTool(
    "upload_file",
    {
      title: "Загрузить файл",
      description:
        "Загрузить локальный файл на kie.ai для использования в generate (например, исходное изображение для edit). " +
        "Возвращает URL для передачи в images параметр generate.",
      inputSchema: uploadFileSchema,
    },
    uploadFileHandler
  );

  server.registerTool(
    "list_presets",
    {
      title: "Список пресетов",
      description:
        "Доступные пресеты для быстрого выбора модели (product-photo, banner-16x9, social-square, social-story, image-edit, upscale, short-video, image-to-video, voiceover, music). " +
        "Каждый пресет содержит оптимальную модель и параметры по умолчанию.",
      inputSchema: listPresetsSchema,
    },
    listPresetsHandler
  );

  server.registerTool(
    "rerun_job",
    {
      title: "Повторить задачу",
      description:
        "Повторить задачу генерации с изменениями (новый промпт, другие параметры). " +
        "Использует модель исходной задачи, но позволяет изменить промпт и параметры. " +
        "По умолчанию ждёт завершения; при стоимости > $1 требует confirm_cost=true.",
      inputSchema: rerunJobSchema,
    },
    rerunJobHandler
  );

  server.registerTool(
    "lib_search",
    {
      title: "Поиск в библиотеке",
      description:
        "Поиск похожих рефов по тексту или изображению. " +
        "Возвращает список рефов с оценкой сходства, пути к превью и информацию об источнике. " +
        "Требует инициализации: nullume lib init (для эмбеддера).",
      inputSchema: libSearchSchema,
    },
    libSearchHandler
  );

  server.registerTool(
    "lib_families",
    {
      title: "Список семейств",
      description:
        "Список семейств (стилей) в библиотеке с информацией о статусе и размере. " +
        "Можно фильтровать по статусу (approved или proposed).",
      inputSchema: libFamiliesSchema,
    },
    libFamiliesHandler
  );

  server.registerTool(
    "lib_family",
    {
      title: "Детали семейства",
      description:
        "Получить полную информацию о семействе: дескриптор стиля, палитру, exemplars с путями к превью. " +
        "Используется перед lib_propose для редактирования дескриптора.",
      inputSchema: libFamilySchema,
    },
    libFamilyHandler
  );

  server.registerTool(
    "lib_import",
    {
      title: "Импортировать рефы",
      description:
        "Импортировать рефы из источника (Eagle, Raindrop, Pinterest API, Pexels и т.д). " +
        "Запускает импортёр, сохраняет рефы в БД, вычисляет эмбеддинги и палитры. " +
        "Возвращает статистику и ID импорта.",
      inputSchema: libImportSchema,
    },
    libImportHandler as any
  );

  server.registerTool(
    "lib_clusters",
    {
      title: "Кластеризовать библиотеку",
      description:
        "Кластеризовать рефы на основе эмбеддингов (CLIP/SigLIP) в стили (семейства). " +
        "Автоматически определяет оптимальное количество кластеров (k) и создаёт семейства. " +
        "Возвращает контекст для Claude для заполнения дескрипторов семейств.",
      inputSchema: libClustersSchema,
    },
    libClustersHandler as any
  );

  server.registerTool(
    "lib_propose",
    {
      title: "Применить предложение",
      description:
        "Применить предложения Claude (имена, slugs, дескрипторы) к семействам. " +
        "Обновляет семейства в БД и записывает решения. " +
        "Далее нужно утвердить в nullume lib dashboard или через CLI.",
      inputSchema: libProposeSchema,
    },
    libProposeHandler as any
  );

  return server;
}

export async function startMcpServer() {
  // Инициализировать динамическую схему libImport
  await initLibImportSchema();

  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Run server if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startMcpServer();
}
