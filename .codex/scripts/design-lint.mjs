#!/usr/bin/env node
// Детерминированный детектор дизайн-анти-паттернов. Без LLM, без внешних зависимостей.
import fs from "node:fs";
import path from "node:path";
import { codeRoots } from "./lib/projects.mjs";

const RULES = [
  {
    name: "forbidden-font",
    // Exact fonts parsed from the target MASTER only; no global font whitelist.
    // This line-based signal cannot distinguish body, fallback and display roles.
    test: (line, ds, filePath) => {
      const targetProject = projectFromPath(filePath);
      const scoped = ds && (!targetProject || targetProject === projectFromPath(ds.masterPath));
      return [...line.matchAll(/\b(Inter|Arial)\b/g)].some((m) => !scoped || !ds.fonts.has(m[1]));
    },
    hint: "запрещённый шрифт (AI-slop), см docs/core/design-principles.md",
    level: "ERROR",
  },
  {
    name: "purple-blue-gradient",
    test: /from-purple-\d.*to-blue-\d|from-blue-\d.*to-purple-\d/,
    hint: "фиолетово-синий градиент — маркер AI-slop",
    level: "ERROR",
  },
  {
    name: "gray-text-on-color-bg",
    test: (line) =>
      /text-gray-\d00/.test(line) &&
      /bg-(red|blue|green|purple|indigo)-[5-9]00/.test(line),
    hint: "серый текст на цветном фоне, контраст < 4.5:1",
    level: "ERROR",
  },
  {
    name: "side-border-decor",
    test: /border-l-4|border-r-4/,
    hint: "боковая полоска-бордюр как декор",
    level: "ERROR",
  },
  {
    name: "bounce-elastic-easing",
    test: /animate-bounce|ease-elastic/,
    hint: "bounce/elastic easing запрещён",
    level: "ERROR",
  },
  {
    name: "small-touch-target",
    test: /\b(h-[1-4])\s+(w-[1-4])\b/,
    hint: "возможный тач-таргет < 44px",
    level: "ERROR",
  },
  {
    name: "too-round-corners",
    // rounded-full исключён: круглые элементы (аватары, иконки-кнопки, pill) — намеренны
    test: /rounded-\[(1[7-9]|[2-9]\d)px\]|rounded-3xl/,
    hint: "радиус > 16px — слишком круглые углы",
    level: "ERROR",
  },
  {
    name: "price-without-division",
    // value={...price} — поле ввода формы (там перевод копеек в другом месте), не показ цены
    test: (line) =>
      /[Pp]rice\}/.test(line) &&
      !/value=\{/.test(line) &&
      !/\/\s*100/.test(line) &&
      !/toFixed/.test(line),
    hint: "цена может выводиться в копейках без /100",
    level: "WARNING",
  },
  {
    name: "transition-all",
    // Ловим обе записи: CSS `transition: all` и Tailwind-класс `transition-all`.
    // Раньше правило знало только про CSS, и класс проходил мимо линтера.
    test: /transition:\s*all\b|\btransition-all\b/,
    hint: "transition: all — указывай конкретное свойство (transform/opacity)",
    level: "ERROR",
  },
  {
    name: "blanket-will-change",
    test: /will-change:\s*(?!auto)|\bwill-change-(transform|scroll|contents)\b/,
    hint: "проверь: элемент реально анимируется и will-change снимается после (иначе лишние слои)",
    level: "WARNING",
  },
  {
    name: "ease-in-on-ui",
    test: /\bease-in\b(?!-out)/,
    hint: "ease-in на UI тормозит начало — используй ease-out",
    level: "ERROR",
  },
  {
    name: "animate-layout-prop",
    test: (line) =>
      /transition|animate/.test(line) && /\b(width|height|margin|padding)\b.*\d/.test(line),
    hint: "анимация width/height/margin/padding грузит layout — только transform/opacity",
    level: "WARNING",
  },
  {
    name: "scale-from-zero",
    test: /scale\(0\)|scale-0\b/,
    hint: "не появляться из нуля — scale(0.95)+opacity",
    level: "ERROR",
  },
  {
    name: "marketing-filler",
    test: /\b(Революционн|Инновационн|Уникальн\w* в своём роде|Просто и удобно|Элитн|Не имеет аналогов)\w*/i,
    hint: "маркетинговый штамп — переписать конкретикой",
    level: "WARNING",
  },
];

// --- Слой 2: сверка с зафиксированной дизайн-системой проекта ---
// Читает docs/projects/*/design-system/MASTER.md. Если его нет — правила молча
// пропускаются, поведение скрипта не меняется.
// Проект определяется ПО ПУТИ ПРОВЕРЯЕМОГО ФАЙЛА (projects/<имя>/…,
// tools/<имя>/…), и только если путь ничего не сказал — по ACTIVE_PROJECT или
// docs/projects/.active. Иначе смена активного проекта заставляла линтер
// сверять код одного продукта с палитрой другого: файл лежит в projects/simba,
// а .active говорит perfect-skin — и все цвета Симбы становились «вне палитры».
const PROJECTS_ROOT = "docs/projects";

function knownProjects() {
  if (!fs.existsSync(PROJECTS_ROOT)) return [];
  return fs
    .readdirSync(PROJECTS_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("_"))
    .map((e) => e.name)
    .filter((n) => fs.existsSync(path.join(PROJECTS_ROOT, n, "design-system", "MASTER.md")));
}

function projectFromPath(filePath) {
  const m = path
    .normalize(filePath)
    .replace(/\\/g, "/")
    .match(/(?:^|\/)(?:projects|tools)\/([^/]+)\//);
  return m ? m[1] : null;
}

function resolveActiveProject(filePath, diagnostics) {
  const projects = knownProjects();
  const fromPath = filePath ? projectFromPath(filePath) : null;
  if (fromPath) {
    const masterPath = path.join(PROJECTS_ROOT, fromPath, "design-system", "MASTER.md");
    if (projects.includes(fromPath)) return masterPath;
    diagnostics.push({ code: "master-scope", path: filePath, level: "WARNING", message: `design-lint: у целевого проекта нет ${masterPath}. Сверка с MASTER.md пропущена.` });
    return null;
  }
  if (projects.length === 0) return null;

  const explicit =
    process.env.ACTIVE_PROJECT ||
    (fs.existsSync(path.join(PROJECTS_ROOT, ".active"))
      ? fs.readFileSync(path.join(PROJECTS_ROOT, ".active"), "utf8").trim()
      : null);

  if (explicit) {
    if (!projects.includes(explicit)) {
      diagnostics.push({ code: "master-scope", path: filePath, level: "WARNING", message: `design-lint: активный проект "${explicit}" не найден или без MASTER.md` });
      return null;
    }
    return path.join(PROJECTS_ROOT, explicit, "design-system", "MASTER.md");
  }

  if (projects.length > 1) {
    diagnostics.push({ code: "master-scope", path: filePath, level: "WARNING", message: `design-lint: найдено несколько проектов (${projects.join(", ")}) — укажи активный в docs/projects/.active или ACTIVE_PROJECT. Сверка с MASTER.md пропущена.` });
    return null;
  }
  return path.join(PROJECTS_ROOT, projects[0], "design-system", "MASTER.md");
}

const dsCache = new Map();

function loadDesignSystem(filePath, diagnostics) {
  const masterPath = resolveActiveProject(filePath, diagnostics);
  if (!masterPath) return null;
  if (dsCache.has(masterPath)) return dsCache.get(masterPath);

  const master = fs.readFileSync(masterPath, "utf8");
  const hexes = new Set(
    (master.match(/#[0-9A-Fa-f]{6}\b/g) || []).map((h) => h.toUpperCase()),
  );
  const fonts = new Set();
  const fontBlock = master.match(/fontFamily:\s*\{[\s\S]*?\}/);
  if (fontBlock) {
    for (const m of fontBlock[0].matchAll(/['"]([A-Za-z][\w\s-]*)['"]/g)) {
      fonts.add(m[1].replace(/^["']|["']$/g, ""));
    }
  }
  const ds = { masterPath, hexes, fonts };
  dsCache.set(masterPath, ds);
  return ds;
}

const MASTER_RULES = [
  {
    name: "offbrand-hex",
    test: (line, ds) => {
      if (!ds || ds.hexes.size === 0) return false;
      const found = line.match(/#[0-9A-Fa-f]{6}\b/g);
      if (!found) return false;
      return found.some((h) => !ds.hexes.has(h.toUpperCase()));
    },
    hint: "цвет вне палитры проекта — сверься с design-system/MASTER.md",
    level: "WARNING",
  },
  {
    name: "offbrand-font",
    test: (line, ds) => {
      if (!ds || ds.fonts.size === 0) return false;
      const m = line.match(/font-\[['"]?([A-Za-z][\w\s-]*)/);
      if (!m) return false;
      return !ds.fonts.has(m[1].trim());
    },
    hint: "шрифт вне дизайн-системы — сверься с design-system/MASTER.md",
    level: "WARNING",
  },
  {
    name: "arbitrary-spacing",
    test: (line) => {
      const m = [...line.matchAll(/\b(?:p|m|gap|space)[xytrbl]?-\[(\d+)px\]/g)];
      return m.some((x) => Number(x[1]) % 4 !== 0);
    },
    hint: "отступ вне шкалы (кратность 4px) — сверься с design-system/MASTER.md",
    level: "WARNING",
  },
];

function lintFile(filePath, diagnostics) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  const findings = [];
  const ds = loadDesignSystem(filePath, diagnostics);

  lines.forEach((line, idx) => {
    for (const rule of [...RULES, ...MASTER_RULES]) {
      const matched =
        typeof rule.test === "function" ? rule.test(line, ds, filePath) : rule.test.test(line);
      if (matched) {
        findings.push({
          file: filePath,
          line: idx + 1,
          rule: rule.name,
          hint: rule.hint,
          level: rule.level,
        });
      }
    }
  });

  return findings;
}

function walkDir(dir, exts, diagnostics) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    diagnostics.push({ code: "read-error", path: dir, level: "ERROR", message: `design-lint: не удалось прочитать ${dir}: ${error.message}` });
    return results;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      results.push(...walkDir(fullPath, exts, diagnostics));
    } else if (entry.isFile() && exts.some((ext) => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

const UI_EXTENSIONS = [".tsx", ".jsx", ".html", ".css"];

function collectFiles(args, diagnostics, targets) {
  if (args.length > 0) {
    const files = [];
    for (const target of args) {
      if (!target.trim() || target.startsWith("-")) {
        diagnostics.push({ code: "invalid-target", path: target, level: "ERROR", message: `design-lint: некорректный target: ${target}` });
        continue;
      }
      if (!fs.existsSync(target)) {
        diagnostics.push({ code: "missing-target", path: target, level: "ERROR", message: `design-lint: target не найден: ${target}` });
        continue;
      }
      if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
        const before = diagnostics.length;
        const found = walkDir(target, UI_EXTENSIONS, diagnostics);
        if (!found.length && diagnostics.length === before) diagnostics.push({ code: "empty-target", path: target, level: "ERROR", message: `design-lint: нет UI-файлов: ${target}` });
        files.push(...found);
      } else files.push(target);
    }
    return [...new Map(files.map((file) => [path.resolve(file), file])).values()].sort();
  }

  // Корни кода берутся из реестра проектов, а не из списка в этом файле:
  // иначе новый проект молча остаётся непроверенным.
  const files = [];
  let roots;
  try {
    roots = codeRoots();
  } catch (error) {
    diagnostics.push({ code: "read-error", path: "docs/projects/README.md", level: "ERROR", message: `design-lint: ${error.message}` });
    return files;
  }
  for (const root of roots) {
    targets.push(root);
    const ui = fs.existsSync(path.join(root, "src")) ? path.join(root, "src") : root;
    files.push(...walkDir(ui, [".tsx"], diagnostics));
  }
  return [...new Map(files.map((file) => [path.resolve(file), file])).values()].sort();
}

function main() {
  const json = process.argv.slice(2).includes("--json");
  const args = process.argv.slice(2).filter((arg) => arg !== "--json");
  const diagnostics = [];
  const targets = [...args];
  const files = collectFiles(args, diagnostics, targets);
  if (!files.length && !diagnostics.length) diagnostics.push({ code: "zero-targets", path: null, level: "ERROR", message: "design-lint: нет файлов для проверки" });
  const findings = [];
  const scannedFiles = [];

  for (const file of files) {
    if (!fs.existsSync(file)) {
      diagnostics.push({ code: "missing-target", path: file, level: "ERROR", message: `design-lint: target не найден: ${file}` });
      continue;
    }
    try {
      findings.push(...lintFile(file, diagnostics));
      scannedFiles.push(file);
    } catch (error) {
      diagnostics.push({ code: "read-error", path: file, level: "ERROR", message: `design-lint: не удалось прочитать ${file}: ${error.message}` });
    }
  }

  const summary = {
    errors: findings.filter((f) => f.level === "ERROR").length,
    warnings: findings.filter((f) => f.level === "WARNING").length,
    operationalErrors: diagnostics.filter((d) => d.level === "ERROR").length,
  };
  const exitCode = summary.operationalErrors ? 1 : summary.errors ? 2 : 0;
  if (json) {
    console.log(JSON.stringify({
      schemaVersion: 1, findings, diagnostics,
      coverage: {
        mode: args.length ? "explicit" : "registry", targets, files, scannedFiles,
        targetCount: targets.length, discoveredCount: files.length, scannedCount: scannedFiles.length,
      },
      summary, exitCode,
    }));
  } else {
    for (const f of findings) console.log(`${f.file}:${f.line} — ${f.hint} [${f.level}]`);
    for (const d of diagnostics) console.error(d.message);
    console.log("");
    if (findings.length === 0 && summary.operationalErrors === 0) {
      console.log("Проблем не обнаружено.");
    } else if (findings.length) {
      console.log(`${findings.length} проблем в ${new Set(findings.map((f) => f.file)).size} файлах`);
    }
  }
  process.exitCode = exitCode;
}

main();
