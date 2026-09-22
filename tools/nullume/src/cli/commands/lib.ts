import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import { stderr, stdout } from "node:process";
import { spawn } from "node:child_process";
import { UsageError, ConfigError } from "../../core/errors.js";
import { emit, table } from "../output.js";
import { getGlobalFlags } from "../context.js";
import { loadConfig, mergeConfig } from "../../core/config.js";
import { ensureDir, getLibraryDir, getLibraryDbPath, getLibraryOriginalsDir, getLibraryPreviewsDir } from "../../core/paths.js";
import { openStore } from "../../library/store/sqlite.js";
import type { LibraryStore } from "../../library/store/types.js";
import { getImporter, listImporters } from "../../library/importers/registry.js";
import { ingest } from "../../library/ingest/ingest.js";
import { createIngestStore } from "../../library/ingest/adapter.js";
import { getEmbedder, modelNotInstalledHint } from "../../library/embed/index.js";
import { downloadModels } from "../../library/embed/init.js";
import { readSession, writeSession, redactSession, parseCookieFile } from "../../library/sessions.js";
import { assertLocalOnlyAllowed, LOCAL_ONLY_WARNING } from "../../library/importers/gate.js";
import type { RefCandidate } from "../../library/importers/types.js";
import { clusterLibrary } from "../../library/cluster/index.js";
import { searchLibrary } from "../../library/search.js";
import { buildProposalContext, applyProposal } from "../../library/families/propose.js";
import { startDashboard } from "../../library/dashboard/server.js";
import {
  getFamilyBySlugOrId,
  approveFamily,
  renameFamily,
  mergeFamilies,
  discardFamily,
} from "../../library/families/index.js";

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

      // Скачать веса модели: без этого эмбеддинги не заведутся, потому что
      // вне init удалённая загрузка выключена намеренно.
      let modelId: string | undefined;
      if (!options.skipModels) {
        try {
          const downloaded = await downloadModels({
            model: modelType as "clip" | "siglip",
            log: (msg) => {
              if (!flags.quiet && !flags.json) stderr.write(`  ${msg}\n`);
            },
          });
          modelId = downloaded.model;
        } catch (e) {
          const message = (e as Error).message;
          if (/@huggingface\/transformers/.test(message)) {
            stderr.write(modelNotInstalledHint() + "\n");
          } else {
            throw e;
          }
        }
      }

      // Сохранить фактический ID модели, если она доступна
      if (!modelId) {
        const embedder = await getEmbedder({ model: modelType as "clip" | "siglip" }).catch(() => null);
        modelId = embedder?.model;
      }
      if (modelId) {
        store.setMeta("embed_model", modelId);
      }

      emit(
        flags,
        { data: { dirs: [libDir, origDir, prevDir], model: modelId ?? modelType, db: dbPath } },
        () => {
          const modelLine = modelId
            ? `  Модель: ${modelId}`
            : `  Модель: ${modelType} (веса не загружены — поиск по смыслу и кластеры недоступны)`;
          return `✓ Библиотека инициализирована\n  Каталоги: ${libDir}\n${modelLine}\n  БД: ${dbPath}`;
        }
      );
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
        if (!options.dryRun) {
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
      if (!options.dryRun) {
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
        if (options.dryRun) {
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
            allowedRoots: [process.cwd(), ...(config.library?.importDirs ?? [])],
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

      if (options.dryRun) {
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
          pageUrl: options.pageUrl as string | undefined,
          tags: (options.tag as string[]) || [],
          meta: {},
        };

        const result = await ingest(candidate, {
          store: storeAdapter,
          embedder: embedder ? { embedImage: (p: string) => embedder.embedImage(p) } : undefined,
          fetchImpl: fetch,
          log,
          allowedRoots: [process.cwd(), ...(config.library?.importDirs ?? [])],
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
const sessionCmd = libCmd
  .command("session")
  .description("Сессии и токены импортёров");

sessionCmd
  .command("set <importer>")
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
      if (options.cookieFile) {
        const content = await fs.promises.readFile(options.cookieFile as string, "utf-8");
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

      if (cookies && Object.keys(cookies).length === 0) cookies = undefined;

      if (!cookies && !token) {
        throw new UsageError(
          "Укажите --cookie name=value, --cookie-file <файл> или --token. " +
            "Файл принимается в формате Netscape cookies.txt или строкой name=value; name2=value2"
        );
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

// lib cluster [--k <n>] [--k-min] [--k-max] [--min-size] [--seed] [--json]
libCmd
  .command("cluster")
  .option("--k <n>", "Количество кластеров (автоматическое если не задано)")
  .option("--k-min <n>", "Минимум кластеров", "3")
  .option("--k-max <n>", "Максимум кластеров", "12")
  .option("--min-size <n>", "Минимальный размер кластера", "4")
  .option("--seed <n>", "Seed для K-means", "42")
  .description("Кластеризовать библиотеку")
  .action(async function (options: Record<string, unknown>) {
    const flags = getGlobalFlags();

    let store: LibraryStore | undefined;
    try {
      const dbPath = getLibraryDbPath();
      store = openStore(dbPath);
      const config = await loadConfig();
      const embedConfig = config.library;

      if (!embedConfig?.embedModel) {
        throw new UsageError("Сначала nullume lib embed");
      }

      const embedder = await getEmbedder({ model: embedConfig.embedModel as "clip" | "siglip" });
      if (!embedder) {
        throw new UsageError("Сначала nullume lib embed");
      }

      const result = clusterLibrary(store, {
        k: options.k ? parseInt(options.k as string, 10) : undefined,
        kMin: parseInt(options.kMin as string, 10),
        kMax: parseInt(options.kMax as string, 10),
        minSize: parseInt(options.minSize as string, 10),
        seed: parseInt(options.seed as string, 10),
        model: embedder.model,
      });

      const rows = result.families.map((f) => ({
        id: f.familyId.slice(0, 8),
        size: f.size.toString(),
        exemplars: f.exemplarRefIds.length.toString(),
        silhouette: result.silhouette.toFixed(3),
      }));

      emit(
        flags,
        { data: { k: result.k, silhouette: result.silhouette, families: result.families.length, unassigned: result.unassigned.length } },
        () => {
          let msg = `✓ Кластеризация завершена: ${result.k} кластеров, silhouette: ${result.silhouette.toFixed(3)}`;
          if (result.families.length > 0) {
            msg += "\n\n" + table(rows, [
              { key: "id", header: "ID семейства" },
              { key: "size", header: "Размер" },
              { key: "exemplars", header: "Exemplars" },
              { key: "silhouette", header: "Silhouette" },
            ]);
          }
          return msg;
        }
      );

    } finally {
      store?.close();
    }
  });

// lib search <text> [--image <path>] [--family <slug>] [--limit] [--json]
libCmd
  .command("search [text]")
  .option("--image <path>", "Путь к изображению для поиска")
  .option("--family <slug>", "Фильтр по семейству")
  .option("--limit <n>", "Максимум результатов", "12")
  .description("Поиск в библиотеке")
  .action(async function (text: string | undefined, options: Record<string, unknown>) {
    const flags = getGlobalFlags();

    let store: LibraryStore | undefined;
    try {
      const dbPath = getLibraryDbPath();
      store = openStore(dbPath);
      const config = await loadConfig();
      const embedConfig = config.library;

      const embedder = embedConfig?.embedModel
        ? await getEmbedder({ model: embedConfig.embedModel as "clip" | "siglip" })
        : null;

      const results = await searchLibrary(store, embedder, {
        text,
        imagePath: options.image as string | undefined,
        familySlug: options.family as string | undefined,
        limit: parseInt(options.limit as string, 10) || 12,
      });

      const rows = results.map((r) => ({
        id: r.refId.slice(0, 8),
        source: r.source,
        score: r.score.toFixed(3),
        family: r.familySlug || "—",
      }));

      emit(flags, { data: results }, () => {
        if (results.length === 0) {
          return "Результаты не найдены";
        }
        return table(rows, [
          { key: "id", header: "ID" },
          { key: "source", header: "Источник" },
          { key: "score", header: "Score" },
          { key: "family", header: "Семейство" },
        ]);
      });

    } finally {
      store?.close();
    }
  });

// lib propose [--apply <file.json>] [--json]
libCmd
  .command("propose")
  .option("--apply <file>", "Применить предложение из JSON файла")
  .description("Построить контекст предложения для Claude")
  .action(async function (options: Record<string, unknown>) {
    const flags = getGlobalFlags();

    let store: LibraryStore | undefined;
    try {
      const dbPath = getLibraryDbPath();
      store = openStore(dbPath);

      if (options.apply) {
        // Применить предложение из файла
        const filePath = options.apply as string;
        const content = await fs.promises.readFile(filePath, "utf-8");
        const proposal = JSON.parse(content);

        applyProposal(store, proposal);

        const familyCount = proposal.families?.length || 0;
        emit(flags, { data: { applied: familyCount } }, () => {
          return `✓ Применено семейств: ${familyCount}`;
        });
      } else {
        // Построить контекст
        const context = buildProposalContext(store, { exemplarsPerFamily: 6 });

        emit(flags, { data: context }, () => {
          return JSON.stringify(context, null, 2);
        });
      }

    } finally {
      store?.close();
    }
  });

// lib dashboard [--port <n>] [--idle <min>] [--open]
libCmd
  .command("dashboard")
  .option("--port <n>", "Порт сервера")
  .option("--idle <min>", "Минуты неактивности перед завершением", "30")
  .option("--open", "Открыть в браузере")
  .description("Запустить интерактивный дашборд")
  .action(async function (options: Record<string, unknown>) {
    const flags = getGlobalFlags();

    let store: LibraryStore | undefined;
    try {
      const dbPath = getLibraryDbPath();
      store = openStore(dbPath);

      const idleMs = (parseInt(options.idle as string, 10) || 30) * 60 * 1000;
      const config = await loadConfig();
      const embedder = config.library?.embedModel
        ? await getEmbedder({ model: config.library.embedModel as "clip" | "siglip" })
        : null;
      const server = await startDashboard(store, {
        port: options.port ? parseInt(options.port as string, 10) : undefined,
        idleMs,
        config,
        embedder,
      });

      emit(flags, { data: { url: server.url, port: server.port } }, () => {
        return `✓ Дашборд запущен\n  URL: ${server.url}\n  Закрыть: Ctrl+C`;
      });

      // Открыть в браузере если --open
      if (options.open) {
        const openCmd = process.platform === "win32" ? "start" : process.platform === "darwin" ? "open" : "xdg-open";
        try {
          spawn(openCmd, [server.url], { detached: true, stdio: "ignore" });
        } catch {
          // Ignore if browser open fails
        }
      }

      // Ждем завершения дашборда или SIGINT
      await server.done;
      await server.close();
    } finally {
      store?.close();
    }
  });

// lib family <subcommand>
const familyCmd = libCmd
  .command("family")
  .description("Управление семействами");

// lib family list [--status <s>] [--json]
familyCmd
  .command("list")
  .option("--status <s>", "Фильтр по статусу (approved, proposed)")
  .description("Список семейств")
  .action(async function (options: Record<string, unknown>) {
    const flags = getGlobalFlags();

    let store: LibraryStore | undefined;
    try {
      const dbPath = getLibraryDbPath();
      store = openStore(dbPath);

      const db = store;
      const families = db.listFamilies(options.status as "approved" | "proposed" | undefined);

      const rows = families.map((f) => ({
        id: f.id.slice(0, 8),
        slug: f.slug,
        name: f.name,
        status: f.status,
        members: db.getMembers(f.id).length.toString(),
      }));

      emit(flags, { data: families }, () => {
        if (families.length === 0) {
          return "Семейств не найдено";
        }
        return table(rows, [
          { key: "id", header: "ID" },
          { key: "slug", header: "Slug" },
          { key: "name", header: "Имя" },
          { key: "status", header: "Статус" },
          { key: "members", header: "Членов" },
        ]);
      });

    } finally {
      store?.close();
    }
  });

// lib family show <slug|id> [--json]
familyCmd
  .command("show <id>")
  .description("Показать детали семейства")
  .action(async function (id: string, options: Record<string, unknown>) {
    const flags = getGlobalFlags();

    let store: LibraryStore | undefined;
    try {
      const dbPath = getLibraryDbPath();
      store = openStore(dbPath);

      const family = getFamilyBySlugOrId(store, id);
      if (!family) {
        throw new UsageError(`Семейство "${id}" не найдено`);
      }

      const db = store;
      const members = db.getMembers(family.id);
      const exemplars = members
        .filter((m) => m.isExemplar)
        .slice(0, 6)
        .map((m) => {
          const ref = db.getReference(m.refId);
          return ref?.previewPath || null;
        })
        .filter((p) => p !== null);

      const data = {
        id: family.id,
        slug: family.slug,
        name: family.name,
        status: family.status,
        size: members.length,
        descriptor: family.descriptor || null,
        exemplarCount: exemplars.length,
      };

      emit(flags, { data }, () => {
        return (
          `📦 Семейство: ${family.name}\n` +
          `   ID: ${family.id}\n` +
          `   Slug: ${family.slug}\n` +
          `   Статус: ${family.status}\n` +
          `   Членов: ${members.length}\n` +
          `   Exemplars: ${exemplars.length}`
        );
      });

    } finally {
      store?.close();
    }
  });

// lib family set <slug|id> [--name] [--slug] [--status]
familyCmd
  .command("set <id>")
  .option("--name <n>", "Новое имя")
  .option("--slug <s>", "Новый slug")
  .option("--status <s>", "Новый статус: approved или discarded")
  .description("Обновить семейство")
  .action(async function (id: string, options: Record<string, unknown>) {
    const flags = getGlobalFlags();

    let store: LibraryStore | undefined;
    try {
      const dbPath = getLibraryDbPath();
      store = openStore(dbPath);

      const family = getFamilyBySlugOrId(store, id);
      if (!family) {
        throw new UsageError(`Семейство "${id}" не найдено`);
      }

      if (options.name && options.slug) {
        renameFamily(store, id, options.name as string, options.slug as string);
      } else if (options.name) {
        renameFamily(store, id, options.name as string);
      }

      if (options.status === "approved") {
        approveFamily(store, family.id);
      } else if (options.status === "discarded") {
        discardFamily(store, family.id);
      } else if (options.status) {
        throw new UsageError(`--status принимает approved или discarded, получено: ${options.status}`);
      }

      const updated = getFamilyBySlugOrId(store, id);
      emit(flags, { data: { id: updated?.id, slug: updated?.slug, name: updated?.name, status: updated?.status } }, () => {
        return `✓ Семейство обновлено: ${updated?.name}`;
      });

    } finally {
      store?.close();
    }
  });

// lib family merge <from> <into>
familyCmd
  .command("merge <from> <into>")
  .description("Объединить семейства")
  .action(async function (from: string, into: string) {
    const flags = getGlobalFlags();

    let store: LibraryStore | undefined;
    try {
      const dbPath = getLibraryDbPath();
      store = openStore(dbPath);

      const fromFamily = getFamilyBySlugOrId(store, from);
      const intoFamily = getFamilyBySlugOrId(store, into);

      if (!fromFamily) {
        throw new UsageError(`Семейство "${from}" не найдено`);
      }
      if (!intoFamily) {
        throw new UsageError(`Семейство "${into}" не найдено`);
      }

      const result = mergeFamilies(store, from, into);
      const fromMembers = store.getMembers(fromFamily.id);

      emit(
        flags,
        { data: { from: fromFamily.id, into: intoFamily.id, movedCount: fromMembers.length } },
        () => `✓ Объединено: ${fromMembers.length} членов переместо в ${result.name}`
      );

    } finally {
      store?.close();
    }
  });

// lib family discard <slug|id>
familyCmd
  .command("discard <id>")
  .description("Отменить семейство")
  .action(async function (id: string) {
    const flags = getGlobalFlags();

    let store: LibraryStore | undefined;
    try {
      const dbPath = getLibraryDbPath();
      store = openStore(dbPath);

      const family = getFamilyBySlugOrId(store, id);
      if (!family) {
        throw new UsageError(`Семейство "${id}" не найдено`);
      }

      const result = discardFamily(store, id);
      emit(flags, { data: { id: result.id, slug: result.slug, status: result.status } }, () => {
        return `✓ Семейство отменено: ${family.name}`;
      });

    } finally {
      store?.close();
    }
  });

export default libCmd;
