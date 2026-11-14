'use strict';
// Server authorizes every protected operation. No tokens in URLs or HTML.
const $ = id => document.getElementById(id);
let token = sessionStorage.getItem('hb-learning-token') || '';
let currentDay = 1;
let state = null;
let course = [];
const labels = {owner: 'Герман / владелец', student: 'Студент', mentor: 'ИИ-наставник'};
function node(tag, text, className) {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
}
function notice(text, error = false) {
  $('notice').textContent = text;
  $('notice').classList.toggle('error', error);
}
async function api(path, body) {
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'},
    ...(body === undefined ? {} : {body: JSON.stringify(body)})
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Ошибка запроса');
  return result;
}
function operationId() {
  return window.crypto.randomUUID ? window.crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2);
}
async function action(fn, success) {
  try {await fn(); if (success) notice(success);}
  catch (err) {notice(err.message, true);}
}
function formatLesson(text) {
  // Build only text nodes; source Markdown cannot inject HTML or execute JS.
  const article = $('lesson-text'); article.replaceChildren();
  let code = null;
  for (const line of text.split('\n')) {
    if (line.startsWith('```')) {
      if (code) {article.append(code); code = null;}
      else code = node('pre', '');
      continue;
    }
    if (code) {code.textContent += line + '\n'; continue;}
    if (!line.trim()) continue;
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) article.append(node('h' + Math.min(heading[1].length + 1, 4), heading[2]));
    else article.append(node('p', line, /^[-\d]/.test(line) ? 'list-item' : ''));
  }
  if (code) article.append(code);
}
async function selectLesson(day) {
  const lesson = await api('/api/lesson?day=' + day);
  currentDay = day;
  $('day-label').textContent = 'ДЕНЬ ' + String(day).padStart(2, '0');
  $('lesson-title').textContent = lesson.title;
  $('lesson-source').textContent = lesson.source === 'detail' ? 'Подробное занятие' : 'Программа занятия';
  $('criterion').value = 'D' + String(day).padStart(2, '0') + '-C1';
  formatLesson(lesson.text);
  document.querySelectorAll('#lessons button').forEach(button => button.setAttribute('aria-current', String(Number(button.dataset.day) === day)));
}
function paintState() {
  $('project-title').textContent = state.project ? state.project.name : 'Новый учебный проект';
  $('role-label').textContent = labels[state.role];
  $('progress-label').textContent = state.accepted_days.length + ' / 24 принято';
  $('progress').value = state.accepted_days.length;
  $('production').textContent = state.production.enabled ? 'Production: допуск выдан' : 'Production locked';
  $('production').setAttribute('aria-checked', String(state.production.enabled));
  $('production').disabled = state.role !== 'owner';
  $('incident-tab').hidden = state.role !== 'owner';
  $('project-form').hidden = Boolean(state.project);
  $('lessons').replaceChildren();
  for (const lesson of course) {
    const button = node('button'); button.type = 'button'; button.dataset.day = lesson.day;
    button.append(node('span', String(lesson.day).padStart(2, '0'), 'number'), node('span', lesson.title));
    if (state.accepted_days.includes(lesson.day)) button.append(node('span', '✓', 'accepted'));
    button.setAttribute('aria-current', String(lesson.day === currentDay));
    button.addEventListener('click', () => action(async () => {await selectLesson(lesson.day); selectTab('lesson');}));
    $('lessons').append(button);
  }
}
async function refreshMessages() {
  const result = await api('/api/messages');
  $('messages').replaceChildren();
  if (!result.messages.length) $('messages').append(node('p', 'Здесь будет история вопросов, отчётов и обсуждения работы.', 'empty'));
  for (const message of result.messages) {
    const item = node('div', undefined, 'message ' + message.role);
    item.append(node('span', (labels[message.role] || message.role) + ' · ' + message.created, 'message-head'), node('div', message.text));
    $('messages').append(item);
  }
  $('messages').scrollTop = $('messages').scrollHeight;
  const jobs = (await api('/api/jobs')).jobs;
  $('jobs').replaceChildren();
  const names = {queued:'В очереди — нужен подключённый провайдер', running:'Запрос выполняется', failed:'Ошибка провайдера, повтор разрешает владелец', succeeded:'Ответ получен'};
  for (const job of jobs.slice(-5)) {
    const item = node('p', 'Запрос #' + job.id + ': ' + (names[job.status] || job.status));
    if (state.role === 'owner' && ['queued', 'failed'].includes(job.status)) {
      const retry = node('button', 'Повторить');
      retry.addEventListener('click', () => action(async () => {await api('/api/mentor/retry', {id:job.id}); await refreshMessages();}));
      item.append(retry);
    }
    $('jobs').append(item);
  }
}
async function refreshFiles() {
  $('file-list').replaceChildren(node('option', 'Выбрать файл…'));
  if (!state.project) return;
  for (const path of (await api('/api/files')).files) {
    const option = node('option', path); option.value = path; $('file-list').append(option);
  }
}
async function refreshState() {state = await api('/api/state'); paintState();}
async function refreshReviews() {
  $('submissions').replaceChildren();
  const submissions = (await api('/api/submissions')).submissions;
  if (!submissions.length) $('submissions').append(node('p', 'Работ на проверку пока нет.', 'empty'));
  for (const item of submissions.slice().reverse()) {
    const card = node('section', undefined, 'review-card');
    const names = {submitted:'На проверке',accepted:'Принято',returned:'Нужна доработка'};
    card.append(node('h3', 'День ' + item.day + ' / ' + (names[item.status] || item.status)), node('p', item.explanation));
    for (const e of item.evidence) card.append(node('p', e.criterion + ' · ' + e.result + '\nПроверка: ' + e.method + '\nОжидание: ' + e.expected + '\nФакт: ' + e.actual));
    if (item.note) card.append(node('p', 'Решение владельца: ' + item.note));
    const details = node('details'); details.append(node('summary', 'Снимок файлов на момент подачи'));
    for (const [path, content] of Object.entries(item.snapshot)) details.append(node('h4', path), node('pre', content));
    card.append(details);
    if (state.role === 'owner' && item.status === 'submitted') {
      for (const [decision, title] of [['accepted','Принять'],['returned','На доработку']]) {
        const button = node('button', title);
        button.addEventListener('click', () => action(async () => {
          const note = window.prompt('Основание решения и замечания:'); if (!note || !note.trim()) return;
          await api('/api/decision', {id:item.id, decision, note});
          await refreshState(); await refreshReviews();
        })); card.append(button);
      }
    }
    $('submissions').append(card);
  }
}
async function refreshIncidents() {
  const incidents = (await api('/api/incidents')).incidents; $('incidents').replaceChildren();
  if (!incidents.length) $('incidents').append(node('p', 'Инцидентов пока нет.', 'empty'));
  for (const item of incidents) {
    const card = node('section', undefined, 'incident-card');
    card.append(node('b', item.code), node('p', 'Повторов: ' + item.count + ' · ' + item.status + '\nПоследний: ' + item.last_seen));
    if (item.status !== 'closed') {
      const close = node('button', 'Отметить закрытым');
      close.addEventListener('click', () => action(async () => {await api('/api/incidents', {id:item.id,status:'closed'}); await refreshIncidents();}));
      card.append(close);
    } $('incidents').append(card);
  }
}
function selectTab(name) {
  if (name === 'incidents' && state.role !== 'owner') return;
  document.querySelectorAll('[data-tab]').forEach(button => button.setAttribute('aria-selected', String(button.dataset.tab === name)));
  document.querySelectorAll('.tab-panel').forEach(panel => {panel.hidden = panel.id !== 'tab-' + name;});
  if (name === 'files') action(refreshFiles);
  if (name === 'review') action(refreshReviews);
  if (name === 'incidents') action(refreshIncidents);
}
async function enter() {
  state = await api('/api/state'); course = (await api('/api/course')).lessons;
  sessionStorage.setItem('hb-learning-token', token); $('token').value = '';
  $('login').hidden = true; $('shell').hidden = false; paintState();
  await selectLesson(currentDay); await refreshMessages(); await refreshFiles();
}
$('login-form').addEventListener('submit', async event => {
  event.preventDefault(); token = $('token').value.trim();
  try {await enter();} catch (err) {token = ''; sessionStorage.removeItem('hb-learning-token'); window.alert('Вход не выполнен: ' + err.message);}
});
$('download-handbook').addEventListener('click', () => action(async () => {
  const response = await fetch('/api/handbook', {headers:{Authorization:'Bearer ' + token}});
  if (!response.ok) throw new Error((await response.json()).error || 'Учебник недоступен');
  const url = URL.createObjectURL(await response.blob());
  const link = node('a'); link.href = url; link.download = 'HB-Web-Development-Handbook.pdf';
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}, 'PDF-учебник загружен.'));
$('logout').addEventListener('click', () => {
  token = ''; state = null; sessionStorage.removeItem('hb-learning-token');
  $('messages').replaceChildren(); $('lesson-text').replaceChildren();
  $('shell').hidden = true; $('login').hidden = false;
});
document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => selectTab(button.dataset.tab)));
$('chat-form').addEventListener('submit', event => {
  event.preventDefault(); const text = $('message').value;
  action(async () => {
    const result = await api('/api/messages', {text}); $('message').value = '';
    let error = '';
    if ($('ask-mentor').checked && state.role === 'student') {
      try {await api('/api/mentor', {message_id:result.messages.at(-1).id, operation_id:operationId()}); $('provider').textContent = 'Live: ответ получен';}
      catch (err) {error = err.message;}
    }
    await refreshMessages();
    notice(error ? 'Сообщение сохранено. ' + error : 'Сообщение сохранено.', Boolean(error));
  });
});
$('project-form').addEventListener('submit', event => {event.preventDefault(); action(async () => {
  await api('/api/project', {name:$('project-name').value}); await refreshState(); await refreshFiles();
}, 'Учебный проект создан.');});
$('file-form').addEventListener('submit', event => {event.preventDefault(); action(async () => {
  await api('/api/file', {path:$('file-path').value, content:$('file-content').value}); await refreshFiles();
}, 'Файл сохранён. После изменения нужна новая проверка.');});
$('file-list').addEventListener('change', () => action(async () => {
  const path = $('file-list').value; if (!path || path === 'Выбрать файл…') return;
  const result = await api('/api/file?path=' + encodeURIComponent(path));
  $('file-path').value = result.path; $('file-content').value = result.content;
}));
$('preview-button').addEventListener('click', () => action(async () => {
  const result = await api('/api/preview?path=' + encodeURIComponent($('preview-path').value) + '&css=' + encodeURIComponent($('preview-css').value));
  $('preview').srcdoc = result.html; notice(result.notice);
}));
$('submission-form').addEventListener('submit', event => {event.preventDefault(); action(async () => {
  await api('/api/submissions', {day:currentDay, operation_id:operationId(), explanation:$('explanation').value,
    evidence:[{criterion:$('criterion').value, method:$('method').value, expected:$('expected').value, actual:$('actual').value,result:$('result').value}]});
  await refreshReviews(); selectTab('review');
}, 'Работа передана владельцу. Самооценка не является автоматическим зачётом.');});
$('refresh-review').addEventListener('click', () => action(refreshReviews));
$('refresh-incidents').addEventListener('click', () => action(refreshIncidents));
$('production').addEventListener('click', () => action(async () => {
  if (state.role !== 'owner') return;
  const enabled = !state.production.enabled;
  if (enabled && state.accepted_days.length !== 24) throw new Error('Нужны 24 принятых урока и аттестация владельца.');
  const scope = enabled ? window.prompt('Область допуска после личной аттестации:') : '';
  if (enabled && !scope) return;
  const note = window.prompt('Основание решения:'); if (!note) return;
  await api('/api/production', {enabled, attested:enabled, scope, note}); await refreshState();
}, 'Решение о локальном допуске сохранено. Удалённая публикация не включена.'));
if (token) enter().catch(() => {token = ''; sessionStorage.removeItem('hb-learning-token'); $('shell').hidden = true; $('login').hidden = false;});
