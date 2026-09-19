#!/usr/bin/env node
// Дымовой тест системы агентов: проверяет, что заявленное реально работает.
// Ловит класс ошибок «в инструкции написано, механизма нет».
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { projects } from "./lib/projects.mjs";

let fail = 0;
let warn = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m) => { console.log(`  ✗ ${m}`); fail++; };
const wrn = (m) => { console.log(`  ! ${m}`); warn++; };

const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null);
// Агенты лежат подкаталогами-департаментами — обходим рекурсивно.
// Плоский readdirSync после переезда возвращал только README.md, и все
// проверки по агентам становились пустыми, продолжая печатать «валиден».
const walkAgents = (dir, prefix = "") => {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) out.push(...walkAgents(path.join(dir, e.name), `${prefix}${e.name}/`));
    else if (e.name.endsWith(".md") && e.name !== "README.md") out.push(`${prefix}${e.name}`);
  }
  return out;
};
const agents = walkAgents(".claude/agents");

console.log("\n[1] Frontmatter агентов");
for (const f of agents) {
  const t = read(`.claude/agents/${f}`);
  const base = path.basename(f, ".md"); // f теперь «департамент/имя.md»
  if (!t.startsWith("---")) { bad(`${base}: нет frontmatter`); continue; }
  const end = t.indexOf("\n---", 3);
  if (end < 0) { bad(`${base}: незакрытый frontmatter`); continue; }
  const fm = t.slice(4, end);
  const name = (fm.match(/^name:\s*(.+)$/m) || [])[1]?.trim();
  if (name !== base) bad(`${base}: name="${name}" не совпадает с именем файла`);
  for (const key of ["description", "tools", "model"]) {
    if (!new RegExp(`^${key}:`, "m").test(fm)) bad(`${base}: нет поля ${key}`);
  }
}
if (!fail) ok(`${agents.length} агентов, frontmatter валиден`);

console.log("\n[2] Оркестраторы могут вызывать субагентов");
const settings = read(".claude/settings.json");
const depth = settings ? (JSON.parse(settings).env || {}).CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH : null;
const orchestrators = agents.filter((f) => /^tools:.*\bAgent\b/m.test(read(`.claude/agents/${f}`)));
if (orchestrators.length && (!depth || Number(depth) < 2)) {
  bad(`агенты с tools: Agent (${orchestrators.map((f) => path.basename(f, ".md")).join(", ")}) не смогут вызывать субагентов — задай env.CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH >= 2 в .claude/settings.json`);
} else if (orchestrators.length) {
  ok(`${orchestrators.length} оркестраторов, глубина вложенности = ${depth}`);
}

console.log("\n[3] Суб-агенты, упомянутые оркестраторами, существуют");
let missing = 0;
for (const f of orchestrators) {
  const body = read(`.claude/agents/${f}`);
  // Отдел называет подчинённых в таблице команды: `имя-агента` в обратных
  // кавычках. Дефис обязателен — иначе в выборку попадают обычные слова.
  const mentioned = [...body.matchAll(/`([a-z]+(?:-[a-z]+)+)`/g)].map((m) => m[1]);
  for (const name of new Set(mentioned)) {
    if (agents.some((a) => path.basename(a, ".md") === name)) continue;
    if (fs.existsSync(`.claude/commands/${name}.md`)) continue;
    if (fs.existsSync(`.claude/skills/${name}`)) continue;
    // Отдел продвижения командует скиллами GEO-рантайма, а не агентами:
    // они лежат своим каталогом и агентами Claude Code не являются.
    if (fs.existsSync(`.geo-topic-agent-runtime/skills/${name}/SKILL.md`)) continue;
    if (name.includes(".")) continue;
    bad(`${path.basename(f, ".md")} ссылается на «${name}» — такого агента, команды или скилла нет`);
    missing++;
  }
}
if (!missing) ok(`проверено, ${orchestrators.length} отделов`);

console.log("\n[4] Хук design-lint доносит находки до модели");
const hook = read(".claude/hooks/post-edit-design-lint.sh");
if (!hook) bad("хук не найден");
else if (!/exit 2/.test(hook)) bad("хук не использует exit 2 — при exit 0 stdout не возвращается модели, находки теряются");
else if (!/>&2/.test(hook)) bad("хук не пишет в stderr — модель не увидит вывод");
else ok("exit 2 + stderr — находки дойдут до агента");

console.log("\n[5] Линтер запускается и видит дизайн-систему");
try {
  const out = execSync("node .claude/scripts/design-lint.mjs 2>&1", { encoding: "utf8" });
  ok(`линтер отработал: ${out.trim().split("\n").pop()}`);
} catch { bad("линтер упал"); }
const active = read("docs/projects/.active");
if (!active) wrn("нет docs/projects/.active — при нескольких проектах сверка с MASTER.md пропустится");
else if (!fs.existsSync(`docs/projects/${active.trim()}/design-system/MASTER.md`))
  bad(`активный проект "${active.trim()}" без MASTER.md`);
else ok(`активный проект: ${active.trim()}, MASTER.md на месте`);

console.log("\n[6] Реестр CLAUDE.md соответствует файлам");
const claude = read("CLAUDE.md") || "";
for (const f of agents) {
  const base = path.basename(f, ".md"); // f теперь «департамент/имя.md»
  if (!claude.includes(`\`${base}\``)) wrn(`${base} не упомянут в CLAUDE.md`);
}
for (const dir of ["commands"]) {
  for (const f of fs.readdirSync(`.claude/${dir}`).filter((x) => x.endsWith(".md"))) {
    const base = f.replace(/\.md$/, "");
    if (!claude.includes(`/${base}`)) wrn(`команда /${base} не упомянута в CLAUDE.md`);
  }
}
ok("реестр сверен");

console.log("\n[7] Ссылки на файлы в доках и агентах");
const scanned = new Set();
for (const dir of ["CLAUDE.md", ".claude", "docs"]) {
  const walk = (p) => {
    if (!fs.existsSync(p)) return;
    if (fs.statSync(p).isDirectory()) { for (const e of fs.readdirSync(p)) walk(path.join(p, e)); return; }
    if (!/\.(md|mjs|sh)$/.test(p)) return;
    // Архив сессий — исторические записи. Ссылка, верная на момент записи,
    // после переезда файла устаревает законно: переписывать прошлое нельзя.
    if (p.startsWith(path.join("docs", "archive"))) return;
    const t = read(p) || "";
    for (const m of t.matchAll(/`?(docs\/[\w./-]+\.md)`?/g)) {
      const target = m[1];
      // docs/en/* — URL внешней документации Anthropic (code.claude.com/docs/en/…), не наши файлы
      if (target.includes("<") || target.startsWith("docs/en/") || scanned.has(target)) continue;
      scanned.add(target);
      if (!fs.existsSync(target)) bad(`битая ссылка: ${target} (упомянут в ${p})`);
    }
  };
  walk(dir);
}
ok(`проверено ${scanned.size} ссылок`);

console.log("\n[8] Механика возражения на месте");
const challengerFile = agents.find((a) => path.basename(a, ".md") === "challenger");
const challenger = challengerFile ? read(`.claude/agents/${challengerFile}`) : null;
const claudeMd = read("CLAUDE.md") || "";
if (!challenger) bad("нет агента challenger — возражать против решений некому");
else if (!/ПРИ КАКИХ УСЛОВИЯХ/.test(challenger)) bad("challenger без раздела условий неверности — вернётся к пустому согласию");
else ok("агент-оппонент на месте");
if (!/Возражение по существу/.test(claudeMd)) bad("в CLAUDE.md нет раздела «Возражение по существу»");
else ok("правило для главного агента записано");
if (!fs.existsSync(".claude/commands/council.md")) wrn("нет команды /council");
else ok("режим совета на месте");

console.log("\n[9] Порог уверенности расщеплён везде");
const withThreshold = agents.filter((f) => /80%/.test(read(`.claude/agents/${f}`) || ""));
const withSplit = withThreshold.filter((f) => /Порог уверенности: два разных случая/.test(read(`.claude/agents/${f}`) || ""));
if (withSplit.length !== withThreshold.length) {
  const missing = withThreshold.filter((f) => !withSplit.includes(f)).map((f) => path.basename(f, ".md"));
  bad(`порог 80% без расщепления в ${missing.length} агентах: ${missing.join(", ")} — они прочитают старую формулировку «сомневаешься молчи»`);
} else ok(`${withSplit.length} из ${withThreshold.length} агентов знают, что возражение порога не имеет`);

console.log("\n[10] Карта департаментов совпадает с диском");
{
  // .claude/agents/README.md — карта: какой агент в каком департаменте.
  // Карта, которую никто не сверяет с территорией, устаревает первой же
  // перестройкой, и новый агент ложится не туда.
  const map = read(".claude/agents/README.md") || "";
  const rows = new Map(); // каталог → имена, заявленные в его строке
  for (const line of map.split("\n")) {
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").map((c) => c.trim());
    if (cells.length < 6) continue;
    const dir = (cells[2].match(/`([^`]+)\/`/) || [])[1];
    if (!dir) continue;
    rows.set(dir, cells[3].split(",").map((n) => n.trim()).filter((n) => /^[a-z][a-z-]+$/.test(n)));
  }
  let drift = 0;
  for (const f of agents) {
    const dir = path.dirname(f).split(path.sep).pop();
    const name = path.basename(f, ".md");
    if (!rows.has(dir)) { bad(`каталог ${dir}/ не описан в .claude/agents/README.md`); drift++; continue; }
    // Имя названо в чужой строке — агент лежит не в своём департаменте.
    for (const [other, names] of rows) {
      if (other !== dir && names.includes(name)) {
        bad(`${name} лежит в ${dir}/, а карта относит его к ${other}/`);
        drift++;
      }
    }
  }
  if (!drift) ok(`${rows.size} департаментов, расхождений с картой нет`);
}

console.log("\n[11] Проекты укомплектованы по реестру");
{
  // Реестр обещает состав каталога проекта. Обещание, которое никто не
  // проверяет, со временем перестаёт быть правдой.
  const reg = read("docs/projects/README.md") || "";
  const promised = [...reg.matchAll(/^- `([^`]+\.md)`/gm)].map((m) => m[1]);
  // Дизайн-система и профиль безопасности осмысленны только там, где есть код.
  // У аналитического проекта без сайта их отсутствие — не дыра.
  const onlyWithCode = new Set(["design-system/MASTER.md", "security-profile.md"]);
  let holes = 0;
  for (const proj of projects()) {
    const need = promised.filter((f) => proj.roots.length || !onlyWithCode.has(f));
    const missing = need.filter((f) => !fs.existsSync(path.join("docs/projects", proj.docs, f)));
    if (missing.length) { wrn(`${proj.docs}: нет ${missing.join(", ")}`); holes += missing.length; }
  }
  if (!holes) ok(`состав каталога соответствует реестру у всех проектов`);
}

console.log("\n[12] Переносимость универсальной базы");
try {
  execSync("bash .claude/scripts/portability-check.sh", { stdio: "pipe" });
  ok("привязок к конкретному проекту нет");
} catch (e) {
  const out = String(e.stdout || "");
  const n = (out.match(/Привязок: (\d+) в (\d+) файлах/) || [])[0] || "есть привязки";
  wrn(`${n} — подробности: bash .claude/scripts/portability-check.sh`);
}

console.log(`\n${"─".repeat(50)}`);
console.log(fail ? `ПРОВАЛЕНО: ${fail} ошибок, ${warn} предупреждений` : `СИСТЕМА ЗДОРОВА (${warn} предупреждений)`);
process.exit(fail ? 1 : 0);
