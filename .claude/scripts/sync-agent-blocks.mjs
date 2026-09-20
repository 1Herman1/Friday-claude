#!/usr/bin/env node
// Синхронизатор общих блоков в определениях агентов.
//
// Claude Code читает каждый файл агента как самостоятельный промпт — включения
// файлов нет, поэтому общий текст обязан лежать копией в каждом файле. Но копии
// расходятся: через сутки после заведения блока «Порог уверенности» у 23
// агентов стояло «Порог 80% выше — про находки», а у двух «Порог 80% — про
// находки», и этого никто не заметил.
//
// Источник истины — docs/core/agent-report-format.md. Здесь только разнос и
// сверка. Блоки ищутся по структуре, без служебных маркеров в файлах агентов:
// маркер это шум прямо в промпте.
//
//   node .claude/scripts/sync-agent-blocks.mjs            сверить (по умолчанию)
//   node .claude/scripts/sync-agent-blocks.mjs --apply    выровнять по эталону
import fs from "node:fs";
import path from "node:path";

const SOURCE = "docs/core/agent-report-format.md";
const AGENTS = ".claude/agents";

// Департаменты, чьи агенты пишут отчёты о находках. Критерий тот же, что в
// проверке [9] selftest.mjs — если менять, менять в обоих местах.
const REVIEW_DEPTS = ["review", "quality", "design", "security", "legal"];
const NOT_REVIEWERS = new Set([
  "component-curator", "icon-curator", "media-generator", "motion-curator",
]);

const THRESHOLD_HEADING = "## Порог уверенности: два разных случая";

function die(msg) {
  console.error(msg);
  process.exit(1);
}

// --- эталонные тексты из источника ---------------------------------------

function loadSource() {
  if (!fs.existsSync(SOURCE)) die(`нет источника ${SOURCE}`);
  const s = fs.readFileSync(SOURCE, "utf8");

  const fences = [...s.matchAll(/```(?:markdown)?\n([\s\S]*?)```/g)].map((m) => m[1]);
  const threshold = fences.find((f) => f.includes(THRESHOLD_HEADING));
  const rubric = fences.find((f) => f.trimStart().startsWith("ВОЗРАЖЕНИЕ"));

  if (!threshold) die(`в ${SOURCE} не найден блок порога`);
  if (!rubric) die(`в ${SOURCE} не найдена рубрика ВОЗРАЖЕНИЕ`);

  return { threshold: threshold.trim(), rubric: rubric.trim() };
}

// --- обход агентов --------------------------------------------------------

function walk(dir, prefix = "") {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) out.push(...walk(path.join(dir, e.name), `${prefix}${e.name}/`));
    else if (e.name.endsWith(".md") && e.name !== "README.md") out.push(`${prefix}${e.name}`);
  }
  return out;
}

function reviewers() {
  if (!fs.existsSync(AGENTS)) die(`нет каталога ${AGENTS}`);
  return walk(AGENTS).filter((f) => {
    const dept = f.includes("/") ? f.split("/")[0] : "";
    return REVIEW_DEPTS.includes(dept) && !NOT_REVIEWERS.has(path.basename(f, ".md"));
  });
}

// --- вырезание блоков из файла агента -------------------------------------

function findThreshold(body) {
  const start = body.indexOf(THRESHOLD_HEADING);
  if (start < 0) return null;
  const after = body.slice(start + THRESHOLD_HEADING.length);
  const next = after.indexOf("\n## ");
  const end = next < 0 ? body.length : start + THRESHOLD_HEADING.length + next;
  return { start, end, text: body.slice(start, end).trim() };
}

function findRubric(body) {
  const start = body.indexOf("ВОЗРАЖЕНИЕ");
  if (start < 0) return null;
  // рубрика живёт внутри примера в блоке формата — до закрывающего фенса
  const after = body.slice(start);
  const fence = after.indexOf("\n```");
  const end = fence < 0 ? body.length : start + fence;
  return { start, end, text: body.slice(start, end).trim() };
}

// --- основное -------------------------------------------------------------

function main() {
  const apply = process.argv.includes("--apply");
  const src = loadSource();
  const files = reviewers();

  if (files.length === 0) die("не найдено ни одного агента-ревьюера — проверь критерий отбора");

  const drift = [];
  const missing = [];
  let fixed = 0;

  for (const rel of files) {
    const full = path.join(AGENTS, rel);
    let body = fs.readFileSync(full, "utf8");
    let changed = false;

    for (const [name, find, want] of [
      ["порог", findThreshold, src.threshold],
      ["рубрика", findRubric, src.rubric],
    ]) {
      const found = find(body);
      if (!found) { missing.push(`${rel} — ${name}`); continue; }
      if (found.text === want) continue;
      drift.push(`${rel} — ${name} разошлась с эталоном`);
      if (apply) {
        body = body.slice(0, found.start) + want + body.slice(found.end);
        changed = true;
      }
    }

    if (changed) { fs.writeFileSync(full, body); fixed += 1; }
  }

  for (const m of missing) console.log(`нет блока: ${m}`);
  for (const d of drift) console.log(apply ? `выровнено: ${d}` : d);

  console.log("");
  console.log(`проверено агентов: ${files.length}, источник: ${SOURCE}`);

  if (apply) {
    console.log(fixed ? `выровнено файлов: ${fixed}` : "выравнивать нечего");
    process.exit(0);
  }

  if (drift.length) {
    console.log(`${drift.length} расхождений с эталоном — выровнять: node ${process.argv[1].replace(process.cwd() + "/", "")} --apply`);
    process.exit(1);
  }

  console.log("Расхождений с эталоном нет.");
  process.exit(0);
}

main();
