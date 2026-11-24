import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const server=fs.readFileSync(new URL('./trade.ts',import.meta.url),'utf8');
const page=fs.readFileSync(new URL('../app/trades/[id]/page.tsx',import.meta.url),'utf8');
test('open BingX positions show timestamped floating PnL separately from realized net',()=>{
 assert.match(server,/unrealizedProfit/);
 assert.match(server,/positionSide/);
 assert.match(page,/Плавающий PnL/);
 assert.match(page,/Реализовано с комиссиями/);
 assert.match(page,/Кросс-маржа/);
 assert.match(page,/live_at/);
});
