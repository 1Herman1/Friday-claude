#!/usr/bin/env node
// Детерминированный детектор дизайн-анти-паттернов. Без LLM, без внешних зависимостей.
import fs from "node:fs";
import path from "node:path";
import { codeRoots } from "./lib/projects.mjs";

const RULES = [
  {
    name: "forbidden-font",
    test: /\b(Inter|Arial)\b/,
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
// Активный проект: env ACTIVE_PROJECT → docs/projects/.active → единственный
// найденный. При нескольких кандидатах без явного указателя — предупредить и
// не сверять (иначе линтер молча сверит код с чужой палитрой).
function resolveActiveProject() {
  const root = "docs/projects";
  if (!fs.existsSync(root)) return null;

  const projects = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("_"))
    .map((e) => e.name)
    .filter((n) => fs.existsSync(path.join(root, n, "design-system", "MASTER.md")));

  if (projects.length === 0) return null;

  const explicit =
    process.env.ACTIVE_PROJECT ||
    (fs.existsSync(path.join(root, ".active"))
      ? fs.readFileSync(path.join(root, ".active"), "utf8").trim()
      : null);

  if (explicit) {
    if (!projects.includes(explicit)) {
      console.error(`design-lint: активный проект "${explicit}" не найден или без MASTER.md`);
      return null;
    }
    return path.join(root, explicit, "design-system", "MASTER.md");
  }

  if (projects.length > 1) {
    console.error(
      `design-lint: найдено несколько проектов (${projects.join(", ")}) — укажи активный в docs/projects/.active или ACTIVE_PROJECT. Сверка с MASTER.md пропущена.`,
    );
    return null;
  }
  return path.join(root, projects[0], "design-system", "MASTER.md");
}

function loadDesignSystem() {
  const masterPath = resolveActiveProject();
  if (!masterPath) return null;

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
  return { masterPath, hexes, fonts };
}

const DS = loadDesignSystem();

const MASTER_RULES = [
  {
    name: "offbrand-hex",
    test: (line) => {
      if (!DS || DS.hexes.size === 0) return false;
      const found = line.match(/#[0-9A-Fa-f]{6}\b/g);
      if (!found) return false;
      return found.some((h) => !DS.hexes.has(h.toUpperCase()));
    },
    hint: "цвет вне палитры проекта — сверься с design-system/MASTER.md",
    level: "WARNING",
  },
  {
    name: "offbrand-font",
    test: (line) => {
      if (!DS || DS.fonts.size === 0) return false;
      const m = line.match(/font-\[['"]?([A-Za-z][\w\s-]*)/);
      if (!m) return false;
      return !DS.fonts.has(m[1].trim());
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

function lintFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  const findings = [];

  lines.forEach((line, idx) => {
    for (const rule of [...RULES, ...MASTER_RULES]) {
      const matched = typeof rule.test === "function" ? rule.test(line) : rule.test.test(line);
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

function walkDir(dir, exts) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      results.push(...walkDir(fullPath, exts));
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

function collectFiles(args) {
  if (args.length > 0) return args;

  // Корни кода берутся из реестра проектов, а не из списка в этом файле:
  // иначе новый проект молча остаётся непроверенным.
  const files = [];
  for (const root of codeRoots()) {
    const ui = fs.existsSync(path.join(root, "src")) ? path.join(root, "src") : root;
    files.push(...walkDir(ui, [".tsx"]));
  }
  return files;
}

function main() {
  const args = process.argv.slice(2);
  const files = collectFiles(args);

  let total = 0;
  const filesWithFindings = new Set();

  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const findings = lintFile(file);
    for (const f of findings) {
      console.log(`${f.file}:${f.line} — ${f.hint} [${f.level}]`);
      total += 1;
      filesWithFindings.add(f.file);
    }
  }

  console.log("");
  if (total === 0) {
    console.log("Проблем не обнаружено.");
  } else {
    console.log(`${total} проблем в ${filesWithFindings.size} файлах`);
  }

  process.exit(0);
}

main();
