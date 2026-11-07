// Единственный источник правды о том, где лежит код проектов.
//
// Раньше каждая проверка держала свой список каталогов, и списки разъезжались:
// design-lint знал про client/ и admin/, rkn-lint — ещё про hb-landing и
// perfect-skin, хук дизайн-линта — только про первые два. Новый проект
// добавлялся в один список из трёх, и проверки молча его не видели.
//
// Теперь корни кода объявлены один раз — в таблице реестра
// docs/projects/README.md, колонка «Код в репозитории». Строка таблицы
// заводится всё равно, значит и проверки подхватят проект сами.
import fs from "node:fs";
import path from "node:path";

const REGISTRY = "docs/projects/README.md";

/** Имя активного проекта или null. */
export function activeProject() {
  const p = "docs/projects/.active";
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8").trim() || null : null;
}

/**
 * Проекты реестра: { docs, roots }. `roots` — каталоги кода в репозитории,
 * взятые из колонки «Код в репозитории»; у проектов без кода он пустой.
 */
export function projects() {
  if (!fs.existsSync(REGISTRY)) return [];
  const out = [];
  for (const line of fs.readFileSync(REGISTRY, "utf8").split("\n")) {
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").map((c) => c.trim());
    // | Проект | Что это | Каталог доков | Код в репозитории | Ветка выкатки |
    if (cells.length < 6) continue;
    const docsCell = cells[3];
    const codeCell = cells[4];
    const docs = (docsCell.match(/`([^`]+)`/) || [])[1];
    if (!docs || !docs.endsWith("/") || docs.startsWith("_")) continue;
    const roots = [...codeCell.matchAll(/`([^`]+)`/g)]
      .map((m) => m[1].replace(/\/$/, ""))
      .filter((r) => r && !r.includes(" "));
    out.push({ docs: docs.replace(/\/$/, ""), roots });
  }
  return out;
}

/** Все корни кода всех проектов, существующие на диске. */
export function codeRoots() {
  const roots = projects().flatMap((p) => p.roots);
  return [...new Set(roots)].filter((r) => fs.existsSync(r));
}

/**
 * Относится ли файл к коду какого-нибудь проекта. Нужно хукам: они получают
 * путь и решают, запускать ли проверку.
 */
export function isProjectCode(file) {
  const rel = path.normalize(file).replace(/^\.\//, "");
  return codeRoots().some((r) => rel === r || rel.startsWith(r + path.sep));
}
