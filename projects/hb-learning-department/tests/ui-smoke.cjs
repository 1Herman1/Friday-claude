/* Real local browser smoke test. Disposable credentials/data, no LLM calls.
   Requires playwright-core in an external test environment and a Chromium path.
   HB_PLAYWRIGHT_MODULE=/path/to/playwright-core HB_CHROME_PATH=/path/to/chrome node tests/ui-smoke.cjs
*/
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const {spawn} = require('node:child_process');
const assert = require('node:assert/strict');
const {chromium} = require(process.env.HB_PLAYWRIGHT_MODULE || 'playwright-core');
const root = path.resolve(__dirname, '..');
const scratch = process.env.TMPDIR || os.tmpdir();
const temp = fs.mkdtempSync(path.join(scratch, 'hb-ui-smoke-'));
const out = path.join(root, 'reports', 'screenshots');
fs.mkdirSync(out, {recursive:true});
const server = spawn(process.env.HB_PYTHON || 'python3', [path.join(root, 'app.py'), '--port', '0', '--data-dir', temp], {cwd:root, env:{...process.env, HB_MENTOR:'off', HB_API_KEY:'', HB_API_URL:'', HB_MODEL:''}});
const checks = [];
let browser;
(async () => {
  const url = await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error('Local server did not start')), 20000);
    server.stdout.on('data', chunk => {
      output += chunk.toString();
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) {clearTimeout(timer); resolve(match[0]);}
    });
    server.once('exit', code => {clearTimeout(timer); reject(new Error('Server exited: ' + code));});
  });
  const tokens = JSON.parse(fs.readFileSync(path.join(temp, 'tokens.json'), 'utf8'));
  browser = await chromium.launch({headless:true, ...(process.env.HB_CHROME_PATH ? {executablePath:process.env.HB_CHROME_PATH} : {})});
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const login = async role => {
    await page.locator('#token').fill(tokens[role]);
    await page.locator('#login-form button').click();
    await page.locator('#shell').waitFor({state:'visible'});
    await page.waitForFunction(() => document.querySelectorAll('#lessons button').length === 24);
  };
  await page.goto(url);
  await login('student');
  assert.equal(await page.locator('#lessons button').count(), 24);
  assert.equal(await page.locator('#production').isDisabled(), true);
  assert.match(await page.locator('#lesson-text').innerText(), /Практика/);
  checks.push('Student login; 24 lessons; production disabled; real course text');
  await page.screenshot({path:path.join(out, 'desktop-learning.png'),fullPage:false});

  const message = 'Учебный UI-прогон: <img src=x onerror="window.__xss=1">';
  await page.locator('#message').fill(message);
  await page.locator('#chat-form button').click();
  await page.waitForFunction(() => document.querySelector('#messages').textContent.includes('Учебный UI-прогон'));
  assert.equal(await page.evaluate(() => window.__xss), undefined);
  assert.equal(await page.locator('#messages img').count(), 0);
  checks.push('Message persists as text, no HTML injection');

  await page.locator('[data-tab="files"]').click();
  await page.locator('#project-name').fill('FORMA — учебный UI-прогон');
  await page.locator('#project-form button').click();
  await page.waitForFunction(() => document.querySelector('#project-form').hidden);
  await page.locator('#file-content').fill('<!doctype html><html lang="ru"><body><h1>FORMA: проверка</h1><p>Учебные данные.</p><script>parent.__preview_escape=1</script></body></html>');
  await page.locator('#file-form button').click();
  await page.waitForFunction(() => document.querySelector('#file-list').textContent.includes('index.html'));
  await page.locator('#preview-button').click();
  await page.waitForFunction(() => document.querySelector('#preview').srcdoc.includes('FORMA: проверка'));
  assert.equal(await page.locator('#preview').getAttribute('sandbox'), '');
  assert.match(await page.frameLocator('#preview').locator('h1').innerText(), /FORMA: проверка/);
  assert.equal(await page.evaluate(() => window.__preview_escape), undefined);
  checks.push('Create own project; save HTML; sandboxed preview; script cannot escape');
  await page.screenshot({path:path.join(out, 'desktop-workspace.png'),fullPage:false});

  await page.locator('[data-tab="lesson"]').click();
  await page.locator('#method').fill('Реальный браузерный прогон в отдельной тестовой среде');
  await page.locator('#expected').fill('Заголовок виден, script не выполняется');
  await page.locator('#actual').fill('Заголовок проверен, sandbox пустой, переменная родителя не появилась');
  await page.locator('#explanation').fill('Учебная тестовая работа. Это не аттестация настоящего сотрудника.');
  await page.locator('#submission-form button').click();
  await page.waitForFunction(() => document.querySelector('#submissions').textContent.includes('На проверке'));
  await page.locator('#logout').click();
  await login('owner');
  await page.locator('[data-tab="review"]').click();
  await page.getByRole('button', {name:'Принять',exact:true}).waitFor();
  page.once('dialog', dialog => dialog.accept('Принято только как проверка интерфейса на тестовых данных.'));
  await page.getByRole('button', {name:'Принять',exact:true}).click();
  await page.waitForFunction(() => document.querySelector('#progress-label').textContent.startsWith('1 / 24'));
  await page.locator('#production').click();
  assert.match(await page.locator('#notice').innerText(), /24 принятых/);
  checks.push('Submit snapshot/evidence; owner accepts; 1/24 progress; early production blocked');

  const downloadEvent = page.waitForEvent('download');
  await page.locator('#download-handbook').click();
  const download = await downloadEvent;
  const downloaded = path.join(temp, 'handbook.pdf');
  await download.saveAs(downloaded);
  const canonical = fs.readFileSync(path.resolve(root, '../../docs/training/hb-learning-department/handbook/HB-Web-Development-Handbook.pdf'));
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(downloaded)).digest('hex'), crypto.createHash('sha256').update(canonical).digest('hex'));
  checks.push('Authenticated PDF download matches built handbook byte-for-byte');

  await page.locator('#logout').click();
  await login('student');
  await page.locator('#message').fill('Проверка отключённого live-наставника');
  await page.locator('#ask-mentor').check();
  await page.locator('#chat-form button').click();
  await page.waitForFunction(() => document.querySelector('#notice').textContent.includes('провайдер не подключен'));
  assert.match(await page.locator('#jobs').innerText(), /В очереди/);
  assert.equal(await page.locator('.message.mentor').count(), 0);
  checks.push('Provider-off error is explicit; durable queue; no fabricated AI response');
  await page.reload();
  await page.locator('#shell').waitFor({state:'visible'});
  await page.waitForFunction(() => document.querySelector('#progress-label').textContent.startsWith('1 / 24'));
  assert.match(await page.locator('#messages').innerText(), /Учебный UI-прогон/);
  checks.push('Reload restores dialogue, project and accepted progress');

  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(out, 'mobile-learning.png'),fullPage:false});
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
  assert.deepEqual(errors, []);
  checks.push('390px responsive layout has no horizontal overflow; no uncaught page errors');
  const report = {status:'passed', browser:'Chromium headless', fixture:'Disposable generated local credentials, demonstration project only', checks, screenshots:['desktop-learning.png','desktop-workspace.png','mobile-learning.png'], live_model_tested:false, telegram_tested:false};
  fs.writeFileSync(path.join(root, 'reports', 'ui-smoke.json'), JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
})().catch(error => {console.error(error); process.exitCode=1;}).finally(async () => {
  if (browser) await browser.close();
  server.kill('SIGTERM');
  // Never copy disposable credentials into reports or attachments.
  fs.rmSync(temp, {recursive:true,force:true});
});
