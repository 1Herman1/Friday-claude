// Dev check: node ../../node_modules/.bin/... — run from repo root: node tools/nullume/scripts/dashboard-console-check.mjs <dashboard-url> [screenshot.png]. Prints CSP/console errors, counts cards, opens the family editor.
import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" }).catch(async()=>chromium.launch({channel:"chromium"}));
const p = await b.newPage();
p.on("console", m => { if (["error","warning"].includes(m.type())) console.log("CONSOLE", m.type(), m.text().slice(0,300)); });
p.on("pageerror", e => console.log("PAGEERROR", e.message.slice(0,300)));
await p.goto(process.argv[2]); await p.waitForTimeout(1500);
console.log("cards:", await p.locator(".ref-card, .card, img").count());
await p.click("[aria-controls='families-panel']"); await p.waitForTimeout(300);
await p.click("text=Редактировать").catch(e=>console.log("click fail", e.message.slice(0,100))); await p.waitForTimeout(800);
await p.screenshot({ path: process.argv[3] || "/tmp/dashboard-editor.png", fullPage: true });
await b.close();
