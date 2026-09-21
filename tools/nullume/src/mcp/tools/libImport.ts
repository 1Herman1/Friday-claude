import { z } from "zod";
import { getStore, getEmbedderInstance } from "../library.js";
import { formatError } from "../utils.js";
import { getImporter, listImporters } from "../../library/importers/registry.js";
import { ingest } from "../../library/ingest/ingest.js";
import { createIngestStore } from "../../library/ingest/adapter.js";
import { loadConfig } from "../../core/config.js";
import { UsageError } from "../../core/errors.js";

/**
 * Build dynamic enum from clean importers
 */
async function buildImporterEnum(): Promise<string[]> {
  const importers = await listImporters("clean");
  return importers.map((i) => i.id);
}

export let schema: z.ZodSchema;

/**
 * Initialize schema with dynamic enum
 */
export async function initSchema() {
  const importerIds = await buildImporterEnum();
  schema = z.object({
    source: z.enum(importerIds as [string, ...string[]]).describe("ID импортёра"),
    query: z.string().optional().describe("Поисковый запрос или фильтр"),
    collection: z.string().optional().describe("Коллекция, доска или канал"),
    limit: z.number().int().min(1).max(200).default(30).describe("Максимум результатов (1-200)"),
  });
}

export async function handler(args: {
  source: string;
  query?: string;
  collection?: string;
  limit?: number;
}) {
  try {
    const store = getStore();
    const embedder = await getEmbedderInstance();
    const config = await loadConfig();

    // Получить импортёр
    const importer = await getImporter(args.source, "clean");

    // Настроить импортёр
    try {
      await importer.configure(config, process.env);
    } catch (e) {
      throw new UsageError(`Не удалось настроить ${args.source}: ${(e as Error).message}`);
    }

    // Создать адаптер
    const embedModelId = embedder?.model || (store.getMeta("embed_model") as string | undefined) || "default";
    const storeAdapter = createIngestStore(store, {
      embedModel: embedModelId,
      tagOrigin: "source",
    });

    let ingested = 0,
      dedup = 0,
      failed = 0;
    const logLines: string[] = [];

    const log = (msg: string) => {
      logLines.push(msg);
    };

    // Начать импорт
    const importRunId = store.beginImport(args.source, "clean", args.query || "");

    // Запустить импортёр
    for await (const candidate of importer.run({
      query: args.query,
      collection: args.collection,
      limit: args.limit || 30,
      fetchImpl: fetch,
      log,
      config,
      env: process.env,
    })) {
      const result = await ingest(candidate, {
        store: storeAdapter,
        embedder: embedder ? { embedImage: (p: string) => embedder.embedImage(p) } : undefined,
        fetchImpl: fetch,
        log,
        allowedRoots: [process.cwd()],
      });

      if (result.status === "ingested") {
        ingested++;
      } else if (result.status === "dedup") {
        dedup++;
      } else {
        failed++;
      }
    }

    // Завершить импорт
    store.finishImport(importRunId, { count: ingested, skipped: dedup, errors: failed });

    const logTail = logLines.slice(-10).join("\n");

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              import_id: importRunId,
              ingested,
              dedup,
              failed,
              log_tail: logTail,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ error: formatError(error) }) }],
      isError: true,
    };
  }
}
