import { UsageError } from "../../core/errors.js";
import { Importer, ImporterKind } from "./types.js";

/**
 * Получить список импортёров указанного вида
 * Clean импортёры загружаются статически
 * Local-only импортёры загружаются динамически при запросе
 *
 * @param kind Вид импортёра: 'clean' или 'local-only' (по умолчанию оба)
 * @returns Список импортёров
 */
export async function listImporters(kind?: ImporterKind): Promise<Importer[]> {
  const importers: Importer[] = [];

  // Clean импортёры всегда загружаются статически
  if (!kind || kind === "clean") {
    const { cleanImporters } = await import("./clean/index.js");
    importers.push(...cleanImporters);
  }

  // Local-only импортёры загружаются динамически ТОЛЬКО если запрошены
  if (!kind || kind === "local-only") {
    const { localImporters } = await import("./local/index.js");
    importers.push(...localImporters);
  }

  return importers;
}

/**
 * Получить импортёра по ID
 *
 * @param id ID импортёра
 * @returns Импортёр или выбросить UsageError
 */
export async function getImporter(id: string): Promise<Importer> {
  const importers = await listImporters();
  const importer = importers.find((i) => i.id === id);

  if (!importer) {
    throw new UsageError(`Импортёр не найден: ${id}`);
  }

  return importer;
}
