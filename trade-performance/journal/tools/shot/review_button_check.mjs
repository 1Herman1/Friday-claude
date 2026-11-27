// Real UI acceptance: starts ONE actual Codex review for the specified trade.
// DATABASE_URL is provided by the caller; no exchange keys are needed here.
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const root=path.join(homedir(),'Friday-claude/trade-performance');
const shotRequire=createRequire(path.join(root,'journal/tools/shot/package.json'));
const webRequire=createRequire(path.join(root,'journal/web/package.json'));
const {chromium}=shotRequire('playwright');
const {Pool}=webRequire('pg');
const tradeId=process.argv[2];
if(!tradeId)throw new Error('Pass an existing trade UUID; this runs a real review');
const out=process.argv[3] || path.join(root,'journal/data/reports/review-button-check');
fs.mkdirSync(out,{recursive:true});
const pool=new Pool({connectionString:process.env.DATABASE_URL});
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage({viewport:{width:1400,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(`http://127.0.0.1:3100/trades/${tradeId}`,{waitUntil:'networkidle',timeout:60000});
 assert.match(await page.locator('#trade-chart').innerText(),/свечи: BingX/);
 assert.ok((await page.locator('body').innerText()).includes('не получил привычное уведомление'));
 const started=(await pool.query('select now() t')).rows[0].t;
 await page.getByRole('button',{name:/Разобрать (агентом|заново)/}).click();
 let job;
 for(let i=0;i<180;i++){
  const r=await pool.query("select id,status from ai_reviews where trade_id=$1 and created_at >= $2 order by created_at desc limit 1",[tradeId,started]);
  if(r.rows[0])job=r.rows[0];
  if(job?.status==='done')break;
  if(job?.status==='failed')throw new Error('Review worker failed: '+job.id);
  await new Promise(r=>setTimeout(r,1000));
 }
 assert.equal(job?.status,'done');
 const result=(await pool.query(`select r.id,r.status,r.content_md,r.findings,l.provider,l.model,l.status as call_status,l.prompt
 from ai_reviews r join llm_calls l on l.ai_review_id=r.id where r.id=$1`,[job.id])).rows[0];
 assert.equal(result.provider,'openai-codex');assert.equal(result.call_status,'ok');
 assert.ok(result.prompt.includes('уведомлен') && result.prompt.includes('0.02666'));
 assert.ok(result.content_md.length>100);
 const running=(await pool.query("select count(*)::int n from ai_reviews where trade_id=$1 and status='running' and created_at >= $2",[tradeId,started])).rows[0].n;
 assert.equal(running,0);
 await page.reload({waitUntil:'networkidle'});
 assert.ok((await page.locator('body').innerText()).includes(result.content_md.replace(/\*\*/g,'').slice(0,60)));
 await page.screenshot({path:path.join(out,'BULLA_card.png'),fullPage:true});
 await page.locator('#trade-chart').screenshot({path:path.join(out,'BULLA_chart.png')});
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'review.md'),result.content_md+'\n');
 const receipt={trade_id:tradeId,review_id:job.id,status:result.status,provider:result.provider,model:result.model,call_status:result.call_status,running_rows:running,notes_in_prompt:true,page_errors:errors};
 fs.writeFileSync(path.join(out,'receipt.json'),JSON.stringify(receipt,null,2));
 console.log(JSON.stringify(receipt));
} finally {
 await browser.close();await pool.end();
}
