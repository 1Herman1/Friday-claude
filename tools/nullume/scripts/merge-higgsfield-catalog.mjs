// Вливает выгруженные страницы Marketing Studio (jsonl) в data/higgsfield-catalog.json.
// Запуск: node scripts/merge-higgsfield-catalog.mjs <section> <file.jsonl>
// section: product-shot | motion. Дубликаты по id пропускаются.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [section, file] = process.argv.slice(2);
if (!["product-shot", "motion"].includes(section) || !file) {
  console.error("Использование: node scripts/merge-higgsfield-catalog.mjs <product-shot|motion> <file.jsonl>");
  process.exit(1);
}

const catalogPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "higgsfield-catalog.json");
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const known = new Set(catalog.items.map((i) => i.id));

const groupOf = (type) => String(type || "").replace(/_/g, "-").replace(/^product-shots-people$/, "product-people").replace(/^product-shots$/, "product");

let added = 0;
let skipped = 0;
for (const line of fs.readFileSync(file, "utf8").split("\n")) {
  if (!line.trim()) continue;
  const raw = JSON.parse(line);
  if (known.has(raw.id)) { skipped++; continue; }
  if (!/^https:\/\/cdn\.higgsfield\.ai\//.test(raw.thumbnailUrl)) { skipped++; continue; }
  // Host guard for previewUrl
  if (raw.previewUrl && !/^https:\/\/cdn\.higgsfield\.ai\//.test(raw.previewUrl)) { skipped++; continue; }
  catalog.items.push({
    id: raw.id,
    name: raw.name,
    description: "",
    section,
    group: groupOf(raw.type),
    sourceType: "marketing_studio",
    thumbnailUrl: raw.thumbnailUrl,
    previewUrl: raw.previewUrl,
    previewType: raw.previewType,
  });
  known.add(raw.id);
  added++;
}

fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + "\n");
const counts = {};
for (const i of catalog.items) counts[i.section] = (counts[i.section] || 0) + 1;
console.log(`✓ ${section}: добавлено ${added}, пропущено ${skipped}. Всего ${catalog.items.length}:`, counts);
