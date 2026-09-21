import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import { stderr, stdout } from "node:process";
import { UsageError, ConfigError } from "../../core/errors.js";
import { emit, table } from "../output.js";
import { getGlobalFlags } from "../context.js";
import { loadConfig, mergeConfig } from "../../core/config.js";
import { ensureDir, getLibraryDir, getLibraryDbPath, getLibraryOriginalsDir, getLibraryPreviewsDir } from "../../core/paths.js";
import { openStore } from "../../library/store/sqlite.js";
import { getImporter, listImporters } from "../../library/importers/registry.js";
import { ingest } from "../../library/ingest/ingest.js";
import { createIngestStore } from "../../library/ingest/adapter.js";
import { getEmbedder, modelNotInstalledHint } from "../../library/embed/index.js";
import { downloadModels } from "../../library/embed/init.js";
import { readSession, writeSession, redactSession, parseCookieFile } from "../../library/sessions.js";
import { assertLocalOnlyAllowed, LOCAL_ONLY_WARNING } from "../../library/importers/gate.js";
import type { RefCandidate } from "../../library/importers/types.js";

const libCmd = new Command("lib").description("Управление библиотекой вкуса");

// lib init [--model clip|siglip] [--skip-models]
libCmd
  .command("init")
  .option("--model <model>", "Модель для embedding: clip или siglip", "clip")
  .option("--skip-models", "Не загружать модели (если уже установлены)")
  .description("Инициализировать библиотеку")
  .action(async function (options: Record<string, unknown>) {
    const flags = getGlobalFlags();

    try {
      const libDir = getLibraryDir();
      const origDir = getLibraryOriginalsDir();
      const prevDir = getLibraryPreviewsDir();

      // Создать каталоги
      await ensureDir(libDir);
      await ensureDir(origDir);
      await ensureDir(prevDir);

      // Открыть store (создастся БД с миграциями)
      const dbPath = getLibraryDbPath();
      const store = openStore(dbPath);

      // Записать модель в конфиг
      const modelType = options.model === "siglip" ? "siglip" : "clip";
      await mergeConfig({ library: { embedModel: modelType } });

      // Получить фактический ID модели и сохранить в БД
      const embedder = await getEmbedder({ model: modelType as "clip" | "siglip" });
      if (embedder) {
        store.setMeta("embed_model", embedder.model);
      }

      emit(flags, { data: { dirs: [libDir, origDir, prevDir], model: modelType, db: dbPath } }, () => {
        return `✓ Библиотека инициализирована\n  Каталоги: ${libDir}\n  Модель: ${modelType}\n  БД: ${dbPath}`;
      });

      // Загрузить модели если требуется
      if (!options["skip-models"]) {
        const embedder = await getEmbedder({ model: modelType as "clip" | "siglip" });
        if (embedder === null) {
          stderr.write(modelNotInstalledHint() + "\n");
          // Продолжить с exit 0
        } else {
          emit(flags, { data: { model: embedder.model, dim: embedder.dim } }, () => {
            return `✓ Модели для ${embedder.model} готовы`;
          });
        }
      }
    } catch (error) {
      throw error;
    }
  });

// lib sources
libCmd
  .command("sources")
  .description("Список импортёров")
  .action(async function () {
    const flags = getGlobalFlags();

    try {
      const config = await loadConfig();
      const cleanImporters = await listImporters("clean");
      const localImporters = await listImporters("local-only");

      const rows: Array<{
        id: string;
        kind: string;
        title: string;
        configured: string;
        gate: string;
      }> = [];

      for (const imp of cleanImporters) {
        try {
          await imp.configure(config, process.env);
          rows.push({
            id: imp.id,
            kind: imp.kind,
            title: imp.title,
            configured: "✓",
            gate: "",
          });
        } catch (e) {
          rows.push({
            id: imp.id,
            kind: imp.kind,
            title: imp.title,
            configured: "✗",
            gate: `${(e as Error).message.slice(0, 40)}...`,
          });
        }
      }

      for (const imp of localImporters) {
        try {
          await imp.configure(config, process.env);
          rows.push({
            id: imp.id,
            kind: imp.kind,
            title: imp.title,
            configured: "✓",
            gate: "⚠️  local-only",
          });
        } catch (e) {
          rows.push({
            id: imp.id,
            kind: imp.kind,
            title: imp.title,
            configured: "✗",
            gate: "⚠️  local-only",
          });
        }
      }

      emit(flags, { data: [...cleanImporters, ...localImporters] }, () => {
        return table(rows, [
          { key: "id", header: "ID" },
          { key: "kind", header: "Вид" },
          { key: "title", header: "Название" },
          { key: "configured", header: "Готов" },
          { key: "gate", header: "Примечание" },
        ]);
      });
    } catch (error) {
      throw error;
    }
  });

// lib import <source> [--query] [--collection] [--limit 50] [--since] [--dry-run]
libCmd
  .command("import <source>")
  .option("--query <q>", "Поисковый запрос")
  .option("--collection <c>", "Коллекция/доска/канал")
  .option("--limit <n>", "Максимум результатов", "50")
  .option("--since <date>", "Дата начала (ISO 8601)")
  .option("--dry-run", "Показать кандидатов без сохранения")
  .description("Импортировать из источника")
  .action(async function (source: string, options: Record<string, unknown>) {
    const flags = getGlobalFlags();

    try {
      const config = await loadConfig();
      const limit = parseInt(options.limit as string, 10);

      // Получить импортёр
      let importer;
      let kind: "clean" | "local-only" = "clean";
      try {
        importer = await getImporter(source, "clean");
      } catch {
        kind = "local-only";
        importer = await getImporter(source, kind);
        // Проверить гейт
        if (!options["dry-run"]) {
          assertLocalOnlyAllowed(config, process.env);
        } else {
          stderr.write(LOCAL_ONLY_WARNING + "\n");
        }
      }

      // Настроить импортёр
      try {
        await importer.configure(config, process.env);
      } catch (e) {
        throw new ConfigError(`Не удалось настроить ${source}: ${(e as Error).message}`);
      }

      // Получить embedder если нужен
      const embedConfig = config.library;
      const embedder = embedConfig?.embedModel
        ? await getEmbedder({ model: embedConfig.embedModel as "clip" | "siglip" })
        : null;

      // Открыть store и создать адаптер
      const dbPath = getLibraryDbPath();
      const sqliteStore = openStore(dbPath);

      const embedModelId = embedder?.model || (sqliteStore.getMeta("embed_model") as string | undefined) || "default";
      const storeAdapter = createIngestStore(sqliteStore, {
        embedModel: embedModelId,
        tagOrigin: "source",
      });

      let ingested = 0,
        dedup = 0,
        failed = 0;
      const results: Array<{ url?: string; status: string; reason?: string }> = [];

      // Запустить импортёр
      const log = (msg: string) => {
        if (!flags.quiet) stderr.write(`  ${msg}\n`);
      };

      let importRunId: string | null = null;
      if (!options["dry-run"]) {
        importRunId = sqliteStore.beginImport(source, kind, (options.query as string) || "");
      }

      for await (const candidate of importer.run({
        query: options.query as string | undefined,
        collection: options.collection as string | undefined,
        limit,
        since: options.since as string | undefined,
        fetchImpl: fetch,
        log,
        config,
        env: process.env,
      })) {
        if (options["dry-run"]) {
          // Только печать без cookie
          const output = { ...candidate };
          delete (output as any).cookies;
          stdout.write(JSON.stringify(output, null, 2) + "\n");
        } else {
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

          results.push({
            url: candidate.url,
            status: result.status,
            reason: result.reason,
          });
        }
      }

      if (options["dry-run"]) {
        emit(flags, { data: { mode: "dry-run", candidates: results.length } }, () => {
          return `Режим сухой прогон: ${results.length} кандидатов`;
        });
      } else {
        if (importRunId) {
          sqliteStore.finishImport(importRunId, { count: ingested, skipped: dedup, errors: failed });
        }

        const output = {
          ingested,
          dedup,
          failed,
          results,
        };

        emit(flags, { data: output }, () => {
          return `✓ Импорт завершён: ${ingested} добавлено, ${dedup} дубликатов, ${failed} ошибок`;
        });
      }
    } catch (error) {
      throw error;
    }
  });

// lib add <files...> [--tag t]... [--page-url u] [--source manual]
libCmd
  .command("add <files...>")
  .option("--tag <tag>", "Теги (можно несколько)", (v: string, prev: string[] = []) => [...prev, v])
  .option("--page-url <url>", "URL страницы источника")
  .option("--source <name>", "Источник", "manual")
  .description("Добавить локальные файлы")
  .action(async function (files: string[], options: Record<string, unknown>) {
    const flags = getGlobalFlags();

    try {
      const dbPath = getLibraryDbPath();
      const sqliteStore = openStore(dbPath);
      const config = await loadConfig();
      const embedConfig = config.library;
      const embedder = embedConfig?.embedModel
        ? await getEmbedder({ model: embedConfig.embedModel as "clip" | "siglip" })
        : null;

      // Создать адаптер store
      const embedModelId = embedder?.model || (sqliteStore.getMeta("embed_model") as string | undefined) || "default";
      const storeAdapter = createIngestStore(sqliteStore, {
        embedModel: embedModelId,
        tagOrigin: "owner",
      });

      let ingested = 0,
        dedup = 0,
        failed = 0;
      const results: Array<{ file: string; status: string; reason?: string; refId?: string }> = [];

      const log = (msg: string) => {
        if (!flags.quiet) stderr.write(`  ${msg}\n`);
      };

      for (const file of files) {
        const candidate: RefCandidate = {
          filePath: path.resolve(file),
          source: (options.source as string) || "manual",
          sourceRef: file,
          pageUrl: options["page-url"] as string | undefined,
          tags: (options.tag as string[]) || [],
          meta: {},
        };

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

        results.push({
          file,
          status: result.status,
          reason: result.reason,
          refId: result.refId,
        });
      }

      const output = {
        ingested,
        dedup,
        failed,
        total: files.length,
        results,
      };

      emit(
        flags,
        { data: output },
        () => {
          let msg = `✓ Добавлено: ${ingested} файлов, ${dedup} дубликатов, ${failed} ошибок`;
          if (failed > 0) {
            const errors = results.filter((r) => r.status === "failed");
            msg += "\n\nОшибки:";
            for (const err of errors) {
              msg += `\n  ${err.file}: ${err.reason || "Unknown error"}`;
            }
          }
          return msg;
        }
      );
    } catch (error) {
      throw error;
    }
  });

// lib embed [--reindex] [--batch 32]
libCmd
  .command("embed")
  .option("--reindex", "Переиндексировать все")
  .option("--batch <n>", "Размер батча", "32")
  .description("Встроить изображения")
  .action(async function (options: Record<string, unknown>) {
    const flags = getGlobalFlags();

    try {
      const dbPath = getLibraryDbPath();
      const store = openStore(dbPath);
      const config = await loadConfig();
      const embedConfig = config.library;

      if (!embedConfig?.embedModel) {
        throw new UsageError("Модель не настроена. Запусти `lib init` сначала");
      }

      const embedder = await getEmbedder({ model: embedConfig.embedModel as "clip" | "siglip" });
      if (!embedder) {
        stderr.write(modelNotInstalledHint() + "\n");
        throw new UsageError("Модель не установлена");
      }

      // Сохранить ID модели в мета
      store.setMeta("embed_model", embedder.model);

      const batchSize = parseInt(options.batch as string, 10) || 32;
      let refIds: string[];

      if (options.reindex) {
        // Все референсы
        const allRefs = store.listReferences();
        refIds = allRefs.map((r) => r.id);
      } else {
        // Только без эмбеддинга
        refIds = store.refsWithoutEmbedding(embedder.model);
      }

      if (refIds.length === 0) {
        emit(flags, { data: { status: "complete", embedded: 0 } }, () => "Все референсы уже встроены");
        return;
      }

      let embedded = 0;
      for (let i = 0; i < refIds.length; i += batchSize) {
        const batch = refIds.slice(i, i + batchSize);
        for (const refId of batch) {
          const ref = store.getReference(refId);
          if (!ref || !ref.previewPath) continue;

          try {
            const vec = await embedder.embedImage(ref.previewPath);
            store.putEmbedding(refId, embedder.model, vec);
            embedded++;
          } catch (e) {
            if (!flags.quiet) stderr.write(`  Ошибка ${refId}: ${(e as Error).message}\n`);
          }
        }
      }

      emit(
        flags,
        { data: { embedded, total: refIds.length, model: embedder.model } },
        () => `✓ Встроено ${embedded}/${refIds.length} изображений (модель: ${embedder.model})`
      );
    } catch (error) {
      throw error;
    }
  });

// lib list [--family] [--source] [--status] [--limit 50]
libCmd
  .command("list")
  .option("--family <id>", "Фильтр по family ID")
  .option("--source <name>", "Фильтр по источнику")
  .option("--status <status>", "Фильтр по статусу", "active")
  .option("--limit <n>", "Максимум записей", "50")
  .description("Список референсов")
  .action(async function (options: Record<string, unknown>) {
    const flags = getGlobalFlags();

    try {
      const dbPath = getLibraryDbPath();
      const store = openStore(dbPath);
      const limit = parseInt(options.limit as string, 10);

      const refs = store.listReferences({
        familyId: options.family as string | undefined,
        source: options.source as string | undefined,
        status: (options.status as "active" | "discarded") || "active",
        limit,
      });

      const rows = refs.map((ref) => ({
        id: ref.id.slice(0, 8),
        source: ref.source,
        size: `${Math.round(ref.bytes / 1024)}K`,
        preview: ref.previewPath ? "✓" : "✗",
        dims: `${ref.width}×${ref.height}`,
      }));

      const data = refs.map((ref) => ({ ...ref, dhash: ref.dhash === null || ref.dhash === undefined ? null : ref.dhash.toString(16) }));
      emit(flags, { data }, () => {
        return table(rows, [
          { key: "id", header: "ID" },
          { key: "source", header: "Источник" },
          { key: "size", header: "Размер" },
          { key: "preview", header: "Превью" },
          { key: "dims", header: "Размеры" },
        ]);
      });
    } catch (error) {
      throw error;
    }
  });

// lib status
libCmd
  .command("status")
  .description("Статус библиотеки")
  .action(async function () {
    const flags = getGlobalFlags();

    try {
      const dbPath = getLibraryDbPath();
      const store = openStore(dbPath);
      const config = await loadConfig();
      const embedConfig = config.library;

      const allRefs = store.listReferences({ status: "active" });

      // Get actual embed model from store metadata or config
      let embedModelId = (store.getMeta("embed_model") as string) || embedConfig?.embedModel;
      const withEmbedding = embedModelId
        ? store.listEmbeddings(embedModelId).length
        : 0;

      // Размер на диске
      const libDir = getLibraryDir();
      let totalBytes = 0;
      try {
        const walk = (dir: string) => {
          for (const file of fs.readdirSync(dir)) {
            const fpath = path.join(dir, file);
            const stat = fs.statSync(fpath);
            if (stat.isFile()) {
              totalBytes += stat.size;
            } else if (stat.isDirectory()) {
              walk(fpath);
            }
          }
        };
        if (fs.existsSync(libDir)) walk(libDir);
      } catch {
        // Ignore
      }

      const families = store.listFamilies("approved");

      const data = {
        references: allRefs.length,
        embedded: withEmbedding,
        families: families.length,
        diskUsage: Math.round(totalBytes / (1024 * 1024)),
        embedModel: embedModelId || "none",
      };

      emit(flags, { data }, () => {
        return (
          `📚 Статус библиотеки\n` +
          `  Референсы: ${data.references}\n` +
          `  С векторами: ${data.embedded}\n` +
          `  Семейства: ${data.families}\n` +
          `  На диске: ${data.diskUsage} МБ\n` +
          `  Модель: ${data.embedModel}`
        );
      });
    } catch (error) {
      throw error;
    }
  });

// lib session set <importer> [--cookie k=v]... [--cookie-file path] [--token t]
libCmd
  .command("session set <importer>")
  .option("--cookie <kv>", "Cookie (k=v), можно несколько", (v: string, prev: string[] = []) => [...prev, v])
  .option("--cookie-file <path>", "Файл с cookies (Netscape или простой формат)")
  .option("--token <t>", "API токен")
  .description("Сохранить сессию для импортёра")
  .action(async function (importerId: string, options: Record<string, unknown>) {
    const flags = getGlobalFlags();

    try {
      let cookies: Record<string, string> | undefined;
      let token: string | undefined;

      // Собрать cookies
      if (options["cookie-file"]) {
        const content = await fs.promises.readFile(options["cookie-file"] as string, "utf-8");
        cookies = parseCookieFile(content);
      }

      if (options.cookie) {
        if (!cookies) cookies = {};
        for (const pair of options.cookie as string[]) {
          const [k, v] = pair.split("=", 2);
          if (k && v) cookies[k] = v;
        }
      }

      if (options.token) {
        token = options.token as string;
      }

      if (!cookies && !token) {
        throw new UsageError("Укажите --cookie, --cookie-file или --token");
      }

      // Записать сессию
      await writeSession(importerId, {
        cookies,
        token,
        createdAt: new Date().toISOString(),
      });

      // Вывести редактированное (без значений)
      const saved = {
        cookies: cookies ? Object.keys(cookies).length + " cookies" : undefined,
        token: token ? "***" : undefined,
        createdAt: new Date().toISOString(),
      };

      emit(flags, { data: saved }, () => `✓ Сессия сохранена для ${importerId}`);
    } catch (error) {
      throw error;
    }
  });

export default libCmd;
