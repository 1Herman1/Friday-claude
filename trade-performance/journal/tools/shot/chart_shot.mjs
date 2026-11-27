// Скрин графика сделки из веб-карточки (элемент #trade-chart): свечи MEXC + точки входа/выхода.
// node chart_shot.mjs jobs.json   где jobs.json = [{"id": "<uuid>", "out": "/abs/path.png"}, ...]
import { chromium } from "playwright";
import fs from "node:fs";
import { createHash } from "node:crypto";
const jobs = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const base = process.env.JOURNAL_WEB ?? "http://127.0.0.1:3100";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1.5 });
let ok = 0;
for (const j of jobs) {
  try {
    await p.goto(`${base}/trades/${j.id}`, { waitUntil: "networkidle", timeout: 60000 });
    const el = p.locator("#trade-chart");
    await el.waitFor({ timeout: 20000 });
    await p.waitForTimeout(800);
    await el.screenshot({ path: j.out });
    fs.writeFileSync(j.out + ".json", JSON.stringify({
      trade_id: j.id, source_label: await el.innerText(), captured_at: new Date().toISOString(),
      sha256: createHash("sha256").update(fs.readFileSync(j.out)).digest("hex"),
    }, null, 2));
    ok++;
  } catch (e) { console.error(j.id, String(e).slice(0, 200)); }
}
await b.close();
console.log(JSON.stringify({ shots: ok, of: jobs.length }));
