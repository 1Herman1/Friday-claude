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

// Границы блоков ищем так, чтобы они не зависели от везения в расположении
// абзацев. Предыдущая версия брала ПЕРВОЕ вхождение слова «ВОЗРАЖЕНИЕ» — а в
// design-reviewer.md первое вхождение стоит в прозе («рубрика ВОЗРАЖЕНИЕ под
// него не подпадает»), и --apply заменил бы абзац на текст рубрики, оставив
// настоящую рубрику ниже. Следующая сверка при этом стала бы зелёной: первое
// вхождение совпало бы с эталоном. Ровно та галочка, что подтверждает порчу.

// Все фенсы файла: [{ inner, start, end }], где start/end — границы содержимого
function fences(body) {
  const out = [];
  const re = /```[^\n]*\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    const inner = m[1];
    const start = m.index + m[0].indexOf("\n") + 1;
    out.push({ inner, start, end: start + inner.length });
  }
  return out;
}

function findThreshold(body) {
  const start = body.indexOf(THRESHOLD_HEADING);
  if (start < 0) return null;
  // следующий заголовок 2-го уровня, но только вне фенсов: «## » внутри примера
  // обрезало бы блок посередине
  const blocks = fences(body);
  const inFence = (i) => blocks.some((f) => i >= f.start && i < f.end);
  let end = body.length;
  let from = start + THRESHOLD_HEADING.length;
  for (;;) {
    const next = body.indexOf("\n## ", from);
    if (next < 0) break;
    if (!inFence(next + 1)) { end = next; break; }
    from = next + 1;
  }
  return { start, end, text: body.slice(start, end).trim() };
}

// Рубрика привязана к фенсу, а не к слову: кандидаты — фенсы, содержащие
// строку, которая НАЧИНАЕТСЯ с «ВОЗРАЖЕНИЕ». Ровно один кандидат — правим;
// ноль — блока нет; больше одного — отказываемся править и говорим об этом.
function findRubric(body) {
  const cands = fences(body).filter((f) => /^ВОЗРАЖЕНИЕ/m.test(f.inner));
  if (cands.length === 0) return null;
  if (cands.length > 1) return { ambiguous: true };
  const f = cands[0];
  const idx = f.inner.search(/^ВОЗРАЖЕНИЕ/m);
  const start = f.start + idx;
  return { start, end: f.end, text: body.slice(start, f.end).trim() };
}

// --- основное -------------------------------------------------------------

async function main() {
  const apply = process.argv.includes("--apply");
  // --check принимается явно: эталон называет режим по имени, и молчаливое
  // игнорирование неизвестного флага тут было бы очередной зелёной галочкой
  for (const a of process.argv.slice(2)) {
    if (a !== "--apply" && a !== "--check") die(`неизвестный флаг ${a} — есть --check (по умолчанию) и --apply`);
  }

  // Порчу от --apply не отличить от своих правок, если дерево грязное.
  if (apply) {
    const { execSync } = await import("node:child_process");
    let dirty = "";
    try { dirty = execSync(`git status --porcelain -- ${AGENTS}`, { encoding: "utf8" }).trim(); } catch {}
    if (dirty) die(`в ${AGENTS} есть незакоммиченные правки — закоммить их, иначе автоправку не отличить от своей:\n${dirty}`);
  }
  const src = loadSource();
  const files = reviewers();

  if (files.length === 0) die("не найдено ни одного агента-ревьюера — проверь критерий отбора");

  const drift = [];
  const missing = [];
  const ambiguous = [];
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
      if (found.ambiguous) { ambiguous.push(`${rel} — ${name}: несколько блоков, поправить руками`); continue; }
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
  for (const a of ambiguous) console.log(`неоднозначно: ${a}`);
  for (const d of drift) console.log(apply ? `выровнено: ${d}` : d);

  console.log("");
  console.log(`проверено агентов: ${files.length}, источник: ${SOURCE}`);

  if (apply) {
    console.log(fixed ? `выровнено файлов: ${fixed}` : "выравнивать нечего");
    process.exit(0);
  }

  if (ambiguous.length) {
    console.log(`${ambiguous.length} файлов с неоднозначной разметкой — автоправка по ним отключена`);
    process.exit(1);
  }

  if (drift.length) {
    console.log(`${drift.length} расхождений с эталоном — выровнять: node ${process.argv[1].replace(process.cwd() + "/", "")} --apply`);
    process.exit(1);
  }

  console.log("Расхождений с эталоном нет.");
  process.exit(0);
}

main();
