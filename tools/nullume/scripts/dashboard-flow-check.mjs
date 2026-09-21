// Dev check, run from repo root (playwright-core there):
//   node tools/nullume/scripts/dashboard-flow-check.mjs <dashboard-url>
// Drives the dashboard like an owner would: approve a family, edit mood and
// dials, save, request the generate command, tag a reference. Prints PASS/FAIL.
import { chromium } from "playwright-core";

const url = process.argv[2];
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await b.newPage();
const errors = [];
p.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
p.on("pageerror", (e) => errors.push("pageerror " + e.message.slice(0, 200)));
const step = async (name, fn) => {
  try { await fn(); console.log("PASS", name); } catch (e) { console.log("FAIL", name, "-", e.message.slice(0, 200)); }
};

await p.goto(url);
await p.waitForTimeout(800);

await step("refs grid renders", async () => {
  const n = await p.locator("#refs-panel img").count();
  if (n < 3) throw new Error(`only ${n} previews`);
});

await step("open reference panel and add tag", async () => {
  await p.locator("#refs-panel img").first().click();
  await p.waitForTimeout(400);
  await p.locator("#ref-tag-input").fill("warm");
  await p.locator("[data-action='add-ref-tag']").click();
  await p.waitForTimeout(400);
  const has = await p.locator("#ref-panel", { hasText: "warm" }).count();
  if (!has) throw new Error("tag not shown");
});

await p.click("[aria-controls='families-panel']");
await p.waitForTimeout(400);

await step("approve first proposed family", async () => {
  const card = p.locator("#families-panel article, #families-panel .family-card").first();
  await card.locator("button", { hasText: "Утвердить" }).click();
  await p.waitForTimeout(600);
  const badge = await card.textContent();
  if (!/утверждено/.test(badge)) throw new Error("badge not updated: " + badge.slice(0, 80));
});

await step("edit family: mood + dial + save", async () => {
  await p.locator("#families-panel button", { hasText: "Редактировать" }).first().click();
  await p.waitForTimeout(400);
  const moodInput = p.locator("input[placeholder*='слово' i]");
  await moodInput.fill("тёплый");
  await p.locator("[data-action='add-mood-chip']").click({ force: true });
  const slider = p.locator("#families-panel input[type=range]").first();
  await slider.fill("0.9");
  await p.locator("#families-panel button", { hasText: "Сохранить" }).click();
  await p.waitForTimeout(600);
  const state = await (await p.request.get(url + "state")).json();
  const fam = state.families[0];
  const detail = await (await p.request.get(url + "family/" + fam.id)).json();
  const d = detail.descriptor || {};
  if (!Array.isArray(d.mood) || !d.mood.includes("тёплый")) throw new Error("mood not saved: " + JSON.stringify(d.mood));
  if (!d.dials || Math.abs(d.dials.visualDensity - 0.9) > 0.01) throw new Error("dial not saved: " + JSON.stringify(d.dials));
});

await step("copy generate command shows status", async () => {
  // After save, editor is closed and family card shows "Команда генерации" button
  // Click first one (should be the approved family)
  await p.locator("[data-action='copy-generate-command']").first().click();
  await p.waitForTimeout(500);
  const txt = await p.locator("body").textContent();
  if (!/generate create|скопирован/i.test(txt)) throw new Error("no feedback");
});

await p.click("[aria-controls='cluster-panel']");
await step("cluster without embeddings shows hint, not crash", async () => {
  await p.locator("#cluster-panel button", { hasText: /кластеризац/i }).click();
  await p.waitForTimeout(600);
  const txt = await p.locator("body").textContent();
  if (!/embed/.test(txt)) throw new Error("hint not shown");
});

console.log(errors.length ? "CONSOLE ERRORS:\n" + errors.join("\n") : "no console errors");
await b.close();
