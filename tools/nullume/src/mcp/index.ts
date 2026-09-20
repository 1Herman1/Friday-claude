#!/usr/bin/env node
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

const transport = new StdioServerTransport();
await server.connect(transport);
