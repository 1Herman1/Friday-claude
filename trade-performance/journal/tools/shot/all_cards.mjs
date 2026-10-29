// Скрины всех карточек сделок (полная страница) + список → journal/data/backup/<dir>/screens
import { chromium } from "playwright";
import { mkdirSync } from "fs";
const base = process.env.JOURNAL_WEB ?? "http://127.0.0.1:3100";
const out = process.argv[2];
mkdirSync(out, { recursive: true });
const ids = JSON.parse(process.argv[3]); // [[n, id, base], ...]
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
await p.goto(base + "/trades?sort=date_asc"); await p.waitForTimeout(1500);
await p.screenshot({ path: `${out}/000_list.png`, fullPage: true });
let ok = 0, fail = [];
for (const [n, id, coin] of ids) {
  try {
    await p.goto(`${base}/trades/${id}`, { timeout: 60000 }); await p.waitForTimeout(1800);
    await p.screenshot({ path: `${out}/${String(n).padStart(3, "0")}_${coin}.png`, fullPage: true });
    ok++;
  } catch (e) { fail.push(n); }
}
await b.close();
console.log(JSON.stringify({ ok, fail }));
