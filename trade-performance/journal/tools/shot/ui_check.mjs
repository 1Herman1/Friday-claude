import { chromium } from "playwright";
const base = "http://127.0.0.1:3100";
const out = process.env.HOME + "/.hermes/cache/scratch/diary/";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
await p.goto(base + "/trades?sort=date_asc"); await p.waitForTimeout(1500);
await p.screenshot({ path: out + "ui_list.png" });
// клик по строке #2 → карточка
await p.locator("tbody tr").nth(1).click(); await p.waitForURL(/\/trades\/[0-9a-f-]{36}/); await p.waitForTimeout(2500);
console.log("click ->", p.url());
await p.screenshot({ path: out + "ui_card2.png", fullPage: true });
await p.goto(base + "/trades/e89efab6-f802-4850-b273-4a365910ed07"); await p.waitForTimeout(2500);
await p.screenshot({ path: out + "ui_card14.png" });
await b.close();
