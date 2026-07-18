// Goose Command Center — UI des 5 vues (vanilla JS, live via SSE).
'use strict';

const STATUS_FR = {
  spec: 'Spec', working: 'En travail', blocked: 'Bloquées', review: 'À valider',
  done: 'Complétées', archived: 'Archivées', stale: 'Stales',
};
const AGENT_STATUS_FR = {
  idle: 'repos', working: 'travaille', blocked: 'bloqué', broken: 'cassé',
  offline: 'hors ligne', moving: 'transition', done: 'terminé',
};
const COLS = ['spec', 'working', 'blocked', 'review', 'done', 'stale', 'archived'];

let snapshot = { agents: [], tasks: [], specs: [], executions: [], validations: [], system: { activeDirector: 'goose' } };
let events = [];
let currentView = localStorage.getItem('cc-view') || 'meeting';

const $ = (sel) => document.querySelector(sel);
const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const timeAgo = (iso) => {
  if (!iso) return '—';
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (min < 1) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  return h < 48 ? `il y a ${h} h` : `il y a ${Math.round(h / 24)} j`;
};

function toast(msg, isError = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast' + (isError ? ' error' : '');
  t.hidden = false;
  clearTimeout(toast._h);
  toast._h = setTimeout(() => { t.hidden = true; }, 3500);
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `erreur ${res.status}`);
  return data;
}

async function refresh() {
  snapshot = await api('/api/snapshot');
  events = await api('/api/events/recent?limit=60');
  render();
}

function actor() { return $('#actor').value; }

// ---------- rendu global ----------
function render() {
  const dp = $('#director-pill');
  const failover = snapshot.system.activeDirector !== 'goose';
  dp.textContent = `Directeur : ${failover ? 'Maverick (relève)' : 'Goose'}`;
  dp.className = 'pill' + (failover ? ' failover' : '');

  const sel = $('#actor');
  if (sel.options.length !== snapshot.agents.length) {
    const prev = sel.value;
    sel.innerHTML = snapshot.agents.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('');
    sel.value = prev && [...sel.options].some(o => o.value === prev) ? prev : 'goose';
  }

  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.view === currentView));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  $(`#view-${currentView}`).classList.add('active');

  ({ meeting: renderMeeting, office: () => renderBoard('office'), factory: () => renderBoard('factory'), watchdog: renderWatchdog, memory: renderMemory })[currentView]();
}

// ---------- Meeting Room : 10 lanes d'agents + fil d'événements ----------
function renderMeeting() {
  const root = $('#view-meeting');
  root.innerHTML = '';
  const lanes = el('div', 'lanes');
  for (const a of snapshot.agents) {
    const task = snapshot.tasks.find(t => t.id === a.currentTaskId);
    const lane = el('div', 'agent-lane');
    lane.append(
      el('div', 'head', `<h3>${esc(a.name)}</h3><span class="badge ${esc(a.status)}">${esc(AGENT_STATUS_FR[a.status] || a.status)}</span>`),
      el('div', 'role', esc(a.role || '')),
      el('div', 'kv', `<span class="k">Tâche :</span> ${task ? esc(task.id + ' · ' + task.title) : 'aucune'}`),
      el('div', 'kv', `<span class="k">Next :</span> ${esc(task?.nextAction || a.nextAction || '—')}`),
      el('div', 'kv', `<span class="k">Maj :</span> ${timeAgo(a.lastUpdateAt)}`),
    );
    if (a.blockedReason) lane.append(el('div', 'kv', `<span class="k" style="color:var(--warn)">Blocage :</span> ${esc(a.blockedReason)}`));
    const pct = task ? task.progressPct : a.progressPct || 0;
    const prog = el('div', 'progress');
    prog.append(Object.assign(el('div', 'bar'), { style: `width:${pct}%` }));
    lane.append(prog, el('div', 'kv', `<span class="k">Avancement :</span> ${pct}%`));
    if (task) { lane.style.cursor = 'pointer'; lane.onclick = () => openTask(task.id); }
    lanes.append(lane);
  }
  root.append(lanes);

  const feed = el('div', 'panel');
  feed.append(el('h2', null, 'Fil des événements — handoffs, preuves, validations'));
  const list = el('div', 'events-feed');
  for (const e of [...events].reverse()) {
    list.append(el('div', 'evt', `<span class="t">${esc(new Date(e.at).toLocaleTimeString('fr-CA'))}</span><span class="type">${esc(e.type)}</span>${esc(describeEvent(e))}`));
  }
  feed.append(list);
  root.append(feed);
}

function describeEvent(e) {
  const bits = [];
  if (e.taskId) bits.push(e.taskId);
  if (e.agentId) bits.push(e.agentId);
  if (e.ownerId) bits.push(`→ ${e.ownerId}`);
  if (e.verdict) bits.push(`verdict: ${e.verdict}`);
  if (e.reason) bits.push(e.reason);
  if (e.question) bits.push(`« ${e.question} »`);
  if (e.by) bits.push(`par ${e.by}`);
  if (e.to) bits.push(`→ ${e.to}`);
  if (e.fileName) bits.push(e.fileName);
  return bits.join(' · ');
}

// ---------- Office / Factory : kanban + métriques ----------
function renderBoard(board) {
  const root = $(`#view-${board}`);
  root.innerHTML = '';
  const tasks = snapshot.tasks.filter(t => t.board === board);

  const m = (label, n, cls = '') => `<div class="metric ${cls}"><div class="num">${n}</div><div class="lbl">${label}</div></div>`;
  const metrics = el('div', 'metrics',
    m('Tâches', tasks.length) +
    m('En travail', tasks.filter(t => ['working', 'review'].includes(t.status)).length, 'good') +
    m('Bloquées', tasks.filter(t => t.status === 'blocked').length, 'warn') +
    m('Stales', tasks.filter(t => t.status === 'stale').length, 'bad') +
    m('Archivées', tasks.filter(t => t.status === 'archived').length) +
    m('Preuves', snapshot.executions.filter(e => tasks.some(t => t.id === e.taskId)).length)
  );
  root.append(metrics);

  const newBtn = el('button', 'action', `+ Nouvelle tâche ${board}`);
  newBtn.onclick = () => openNewTask(board);
  const btnRow = el('div', 'actions-row');
  btnRow.append(newBtn);
  root.append(btnRow, el('div', null, '&nbsp;'));

  const boardEl = el('div', 'board');
  for (const status of COLS) {
    const col = el('div', 'col');
    const colTasks = tasks.filter(t => t.status === status);
    col.append(el('h3', null, `${STATUS_FR[status]} (${colTasks.length})`));
    for (const t of colTasks) {
      const card = el('div', 'card');
      card.append(el('div', null, esc(t.title)));
      card.append(el('div', 'meta', `<span>${esc(t.id)}</span><span>${esc(t.ownerId)} · ${t.progressPct}%</span>`));
      if (t.blockedReason) card.append(el('div', 'warn-note', `⚠ ${esc(t.blockedReason)}`));
      if (t.status === 'stale') card.append(el('div', 'warn-note', `⏰ stale ${timeAgo(t.staleSince || t.lastUpdateAt)}`));
      card.onclick = () => openTask(t.id);
      col.append(card);
    }
    boardEl.append(col);
  }
  root.append(boardEl);
}

// ---------- Watchdog : la vérité ----------
async function renderWatchdog() {
  const root = $('#view-watchdog');
  root.innerHTML = '';
  let scan;
  try { scan = await api('/api/watchdog/status'); }
  catch (e) { root.append(el('div', 'panel', `Erreur watchdog: ${esc(e.message)}`)); return; }
  const f = scan.findings;

  const m = (label, n, cls = '') => `<div class="metric ${cls}"><div class="num">${n}</div><div class="lbl">${label}</div></div>`;
  root.append(el('div', 'metrics',
    m('Actives OK', f.ok.length, 'good') +
    m('Stales', f.stale.length, f.stale.length ? 'bad' : '') +
    m('Escaladées à Max', f.escalated.length, f.escalated.length ? 'bad' : '') +
    m('Bloquées', f.blocked.length, f.blocked.length ? 'warn' : '') +
    m('À valider', f.awaitingValidation.length, f.awaitingValidation.length ? 'warn' : '') +
    m('À archiver', f.awaitingArchive.length)
  ));

  const dirPanel = el('div', 'panel');
  dirPanel.append(el('h2', null, 'Direction'));
  dirPanel.append(el('div', 'kv', `<span class="k">Directeur actif :</span> ${scan.director.activeDirector === 'goose' ? 'Goose' : '⚠ Maverick (relève — Goose silencieux)'}`));
  dirPanel.append(el('div', 'kv', `<span class="k">Seuil stale :</span> ${scan.config.staleAfterMinutes} min · <span class="k">Escalade :</span> ${scan.config.escalationAfterMinutes} min · <span class="k">Failover directeur :</span> ${scan.config.directorFailoverMinutes} min`));
  const row = el('div', 'actions-row');
  const scanBtn = el('button', 'action', 'Relancer un scan maintenant');
  scanBtn.onclick = async () => { await api('/api/watchdog/scan', { method: 'POST', body: {} }); toast('Scan watchdog exécuté'); refresh(); };
  row.append(scanBtn);
  dirPanel.append(row);
  root.append(dirPanel);

  const truth = el('div', 'panel');
  truth.append(el('h2', null, 'Règles de vérité — état par tâche ouverte'));
  const table = el('table');
  table.innerHTML = `<tr><th>Tâche</th><th>Owner</th><th>Statut</th><th>Spec</th><th>Preuve</th><th>Validation</th><th>Archive</th><th>Dernière maj</th></tr>`;
  for (const t of snapshot.tasks.filter(t => t.status !== 'archived')) {
    const tr = document.createElement('tr');
    const yes = '✅', no = '—';
    tr.innerHTML = `
      <td>${esc(t.id)} · ${esc(t.title)}</td><td>${esc(t.ownerId)}</td>
      <td>${esc(STATUS_FR[t.status] || t.status)}${t.escalatedAt ? ' 🔺' : ''}</td>
      <td>${t.specId ? yes : no}</td>
      <td>${t.executionIds.length ? `${yes} (${t.executionIds.length})` : no}</td>
      <td>${t.validationId ? yes : no}</td>
      <td>${t.archiveFile ? yes : no}</td>
      <td>${esc(timeAgo(t.lastUpdateAt))}</td>`;
    tr.style.cursor = 'pointer';
    tr.onclick = () => openTask(t.id);
    table.append(tr);
  }
  truth.append(table);
  truth.append(el('div', 'truth-note', 'Pas de done sans spec + preuve + validation. Pas d’archive sans done. Pas d’update dans le délai → stale → Goose → escalade Max.'));
  root.append(truth);
}

// ---------- Mémoire : archives + rapports ----------
async function renderMemory() {
  const root = $('#view-memory');
  root.innerHTML = '';
  const [archives, reports] = await Promise.all([api('/api/archive'), api('/api/reports')]);

  const wrap = el('div', 'two-cols');
  const left = el('div');

  const repPanel = el('div', 'panel');
  repPanel.append(el('h2', null, `Rapports Goose (${reports.length})`));
  const genRow = el('div', 'actions-row');
  const genBtn = el('button', 'action good', 'Générer un rapport maintenant');
  genBtn.onclick = async () => {
    const r = await api('/api/reports', { method: 'POST', body: { force: true } });
    toast(r.written ? `Rapport écrit : ${r.fileName}` : r.reason);
    renderMemory();
  };
  genRow.append(genBtn);
  repPanel.append(genRow, el('div', null, '&nbsp;'));
  for (const f of reports) {
    const item = el('div', 'list-item', `📄 ${esc(f)}`);
    item.onclick = async () => { const { content } = await api(`/api/reports/${encodeURIComponent(f)}`); $('#md-view').textContent = content; };
    repPanel.append(item);
  }
  left.append(repPanel);

  const arcPanel = el('div', 'panel');
  arcPanel.append(el('h2', null, `Archives — tâches complétées (${archives.length})`));
  if (!archives.length) arcPanel.append(el('div', 'kv', 'Aucune archive encore. Une tâche archivée = résultat + décision + preuve préservés.'));
  for (const f of archives) {
    const item = el('div', 'list-item', `🗄 ${esc(f)}`);
    item.onclick = async () => { const { content } = await api(`/api/archive/${encodeURIComponent(f)}`); $('#md-view').textContent = content; };
    arcPanel.append(item);
  }
  left.append(arcPanel);

  const right = el('div', 'panel');
  right.append(el('h2', null, 'Lecture'));
  right.append(Object.assign(el('div', 'md-view', 'Choisis un rapport ou une archive à gauche.'), { id: 'md-view' }));

  wrap.append(left, right);
  root.append(wrap);
}

// ---------- dialogue tâche : cycle complet ----------
function openTask(taskId) {
  const t = snapshot.tasks.find(x => x.id === taskId);
  if (!t) return;
  const spec = snapshot.specs.find(s => s.id === t.specId);
  const execs = snapshot.executions.filter(e => t.executionIds.includes(e.id));
  const validation = snapshot.validations.find(v => v.id === t.validationId);
  const d = $('#task-dialog');

  d.innerHTML = `
    <h2>${esc(t.id)} — ${esc(t.title)}</h2>
    <div class="kv"><span class="k">Board :</span> ${esc(t.board)} · <span class="k">Owner :</span> ${esc(t.ownerId)} · <span class="k">Statut :</span> ${esc(STATUS_FR[t.status] || t.status)} · ${t.progressPct}%</div>
    <div class="kv"><span class="k">Next :</span> ${esc(t.nextAction || '—')}</div>
    ${t.blockedReason ? `<div class="kv" style="color:var(--warn)">Blocage : ${esc(t.blockedReason)}</div>` : ''}
    <div class="truth-note">
      Spec : ${spec ? esc(spec.summary) : '❌ aucune — obligatoire avant de démarrer'}<br/>
      Preuves : ${execs.length ? execs.map(e => esc(e.resultSummary)).join(' · ') : 'aucune'}<br/>
      Validation : ${validation ? `${esc(validation.verdict)} par ${esc(validation.validatedBy)}` : 'aucune'}<br/>
      Archive : ${t.archiveFile ? esc(t.archiveFile) : 'non archivée'}
    </div>
    <div class="actions-row" id="dlg-actions"></div>
    <div class="actions-row"><button class="action" id="dlg-close">Fermer</button></div>`;

  const actions = d.querySelector('#dlg-actions');
  const btn = (label, cls, fn) => {
    const b = el('button', `action ${cls}`, label);
    b.onclick = async () => {
      try { await fn(); d.close(); toast('OK'); refresh(); }
      catch (e) { toast(e.message, true); }
    };
    actions.append(b);
  };

  if (!t.specId) {
    btn('Écrire la spec (directeur)', '', async () => {
      const summary = prompt('Résumé de la spec :', t.title);
      if (!summary) throw new Error('annulé');
      const doneDefinition = prompt('Definition of done :', 'Livré, prouvé, validé, archivé');
      const proof = prompt('Preuve requise :', 'lien ou fichier de preuve');
      const s = await api('/api/specs', { method: 'POST', body: { actorId: actor(), taskId: t.id, summary, doneDefinition, requiredProof: [proof] } });
      await api(`/api/tasks/${t.id}/spec`, { method: 'POST', body: { specId: s.id } });
    });
  }
  if (['spec', 'blocked', 'stale'].includes(t.status) && t.specId) {
    btn('Démarrer', 'good', () => api(`/api/tasks/${t.id}/start`, { method: 'POST', body: { actorId: actor() } }));
  }
  if (['working', 'blocked'].includes(t.status)) {
    btn('Avancement…', '', async () => {
      const pct = prompt('Avancement % (0-99) :', String(t.progressPct));
      if (pct == null) throw new Error('annulé');
      const nextAction = prompt('Prochaine action :', t.nextAction || '');
      await api(`/api/tasks/${t.id}/progress`, { method: 'POST', body: { actorId: actor(), progressPct: Number(pct), nextAction } });
    });
  }
  if (t.status === 'working') {
    btn('Bloquer…', 'warn', async () => {
      const reason = prompt('Raison du blocage (obligatoire) :');
      if (!reason) throw new Error('annulé');
      await api(`/api/tasks/${t.id}/block`, { method: 'POST', body: { actorId: actor(), reason } });
    });
    btn('Déposer une preuve…', 'good', async () => {
      const resultSummary = prompt('Résumé du résultat :');
      if (!resultSummary) throw new Error('annulé');
      const link = prompt('Lien/chemin de preuve (obligatoire) :');
      if (!link) throw new Error('annulé');
      await api(`/api/tasks/${t.id}/proof`, { method: 'POST', body: { actorId: actor(), resultSummary, proofLinks: [link] } });
    });
  }
  if (t.status === 'blocked') {
    btn('Débloquer', '', () => api(`/api/tasks/${t.id}/unblock`, { method: 'POST', body: { actorId: actor() } }));
  }
  if (t.status === 'review') {
    btn('Valider ✅ (directeur)', 'good', () => api(`/api/tasks/${t.id}/validate`, { method: 'POST', body: { actorId: actor(), verdict: 'approved' } }));
    btn('Demander des changements', 'warn', async () => {
      const notes = prompt('Changements demandés :');
      if (!notes) throw new Error('annulé');
      await api(`/api/tasks/${t.id}/validate`, { method: 'POST', body: { actorId: actor(), verdict: 'needs_changes', notes } });
    });
  }
  if (t.status === 'done') {
    btn('Archiver dans la mémoire 🗄 (directeur)', 'good', () => api(`/api/tasks/${t.id}/archive`, { method: 'POST', body: { actorId: actor() } }));
  }
  if (!['done', 'archived'].includes(t.status)) {
    btn('Réassigner…', '', async () => {
      const ownerId = prompt(`Nouvel owner (${snapshot.agents.map(a => a.id).join(', ')}) :`, t.ownerId);
      if (!ownerId) throw new Error('annulé');
      await api(`/api/tasks/${t.id}/assign`, { method: 'POST', body: { actorId: actor(), ownerId } });
    });
    btn('Demander de l’aide…', '', async () => {
      const question = prompt('Question pour la Meeting Room :');
      if (!question) throw new Error('annulé');
      await api(`/api/tasks/${t.id}/help`, { method: 'POST', body: { actorId: actor(), question } });
    });
  }

  d.querySelector('#dlg-close').onclick = () => d.close();
  d.showModal();
}

function openNewTask(board) {
  const title = prompt(`Titre de la nouvelle tâche (${board}) :`);
  if (!title) return;
  api('/api/tasks', { method: 'POST', body: { actorId: actor(), title, board } })
    .then(() => { toast('Tâche créée (spec requise avant démarrage)'); refresh(); })
    .catch(e => toast(e.message, true));
}

// ---------- boot ----------
$('#tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-view]');
  if (!btn) return;
  currentView = btn.dataset.view;
  localStorage.setItem('cc-view', currentView);
  render();
});

function connectSSE() {
  const es = new EventSource('/events');
  es.addEventListener('snapshot', (e) => { snapshot = JSON.parse(e.data); render(); });
  es.addEventListener('event', () => refresh());
  es.onopen = () => { $('#live-pill').className = 'pill ok'; $('#live-pill').textContent = '● live'; };
  es.onerror = () => { $('#live-pill').className = 'pill down'; $('#live-pill').textContent = '● reconnexion…'; };
}

refresh().then(connectSSE).catch(e => toast(e.message, true));
setInterval(refresh, 60_000); // filet de sécurité si un event SSE se perd
