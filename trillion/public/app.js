// TRILLION — l'application (vanilla JS).
// Barre Active Ventures, ajout d'entreprise (Chemins A & B), dashboard qui se bâtit
// sous les yeux, Communication Center conversationnel, voix + texte avec trace écrite.
'use strict';

const $ = (s) => document.querySelector(s);
const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let state = {
  ventures: [],
  current: null,        // venture actif
  memory: null,
  messages: [],
  activity: [],         // §22 — Activity Log des agents
  brief: null,          // §21 — Morning Brief du jour
  interview: null,      // {questions, index, answers} — Chemin B en cours
  pendingLaunch: null,  // {masterplan, analysis} en attente de Launch Dashboard
  voiceReply: false,
  viewCatalog: {},
};

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

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast._h);
  toast._h = setTimeout(() => { t.hidden = true; }, 3200);
}

// ---------- Fond cosmique : étoiles mauves + particules (§2) ----------
function startCosmos() {
  const canvas = $('#cosmos');
  const ctx = canvas.getContext('2d');
  let stars = [];
  const resize = () => {
    canvas.width = innerWidth; canvas.height = innerHeight;
    stars = Array.from({ length: Math.min(160, innerWidth / 8) }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      r: Math.random() * 1.6 + 0.3, tw: Math.random() * Math.PI * 2,
      hue: [258, 270, 200, 300][Math.floor(Math.random() * 4)],
      vy: Math.random() * 0.08 + 0.02,
    }));
  };
  resize(); addEventListener('resize', resize);
  (function frame(t) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of stars) {
      const a = 0.35 + 0.45 * Math.sin(t / 900 + s.tw);
      ctx.beginPath();
      ctx.fillStyle = `hsla(${s.hue}, 85%, 72%, ${a})`;
      ctx.shadowColor = `hsla(${s.hue}, 90%, 65%, ${a})`;
      ctx.shadowBlur = 6;
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      s.y -= s.vy;
      if (s.y < -4) { s.y = canvas.height + 4; s.x = Math.random() * canvas.width; }
    }
    requestAnimationFrame(frame);
  })(0);
}

// ---------- Voix (§8) : dictée éditable + réponses vocales avec trace écrite ----------
function makeRecognizer(onText) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const rec = new SR();
  rec.lang = navigator.language?.startsWith('fr') ? 'fr-CA' : 'en-US';
  rec.interimResults = true;
  rec.onresult = (e) => {
    const text = Array.from(e.results).map(r => r[0].transcript).join(' ');
    onText(text, e.results[e.results.length - 1].isFinal);
  };
  return rec;
}

function speak(text) {
  if (!state.voiceReply || !window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text.replace(/[✦◈◉⬖⬡◬✧❖☰⟁◭⬢▣∿⟠🖋]/g, ''));
  u.lang = 'fr-CA'; u.rate = 1.02; u.pitch = 1.05;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

function wireMic(btn, textarea) {
  const rec = makeRecognizer((text) => { textarea.value = text; });
  if (!rec) { btn.title = 'Dictée non supportée par ce navigateur'; return; }
  let listening = false;
  btn.onclick = () => {
    listening = !listening;
    btn.classList.toggle('listening', listening);
    if (listening) rec.start(); else rec.stop();
  };
  rec.onend = () => { listening = false; btn.classList.remove('listening'); };
}

// ---------- Sidebar : Active Ventures ----------
function renderSidebar() {
  const list = $('#ventures-list');
  list.innerHTML = '';
  for (const v of state.ventures) {
    const item = el('div', 'venture-item' + (state.current?.id === v.id ? ' active' : ''));
    item.append(
      el('span', null, `${esc(v.name)}<br/><span class="vtype">${esc(v.businessType)}</span>`),
      Object.assign(el('span', 'vdel', '✕'), {
        onclick: async (e) => {
          e.stopPropagation();
          if (!confirm(`Retirer ${v.name} des Active Ventures ?`)) return;
          await api(`/api/ventures/${v.id}`, { method: 'DELETE' });
          if (state.current?.id === v.id) state.current = null;
          await loadVentures();
          if (!state.current) showWelcome();
        },
      }),
    );
    item.onclick = () => openVenture(v.id);
    list.append(item);
  }
}

async function loadVentures() {
  state.ventures = await api('/api/ventures');
  renderSidebar();
}

// ---------- Écrans ----------
function show(id) {
  for (const s of document.querySelectorAll('.screen')) s.hidden = true;
  $(id).hidden = false;
}

function showWelcome() {
  state.current = null; state.interview = null; state.pendingLaunch = null;
  renderSidebar();
  $('#welcome-chat').innerHTML = '';
  $('#welcome-input').value = '';
  $('#welcome-input').placeholder = 'Talk with Trillion';
  show('#screen-welcome');
  welcomeSay('Bienvenue. Colle le Masterplan de ton entreprise ici et je construis ton cockpit — ou clique « Create a masterplan » et on le bâtit ensemble, en jasant.');
}

function welcomeSay(text, extras = null) {
  const chat = $('#welcome-chat');
  const m = el('div', 'msg trillion', esc(text));
  if (extras) m.append(extras);
  chat.append(m);
  m.scrollIntoView({ behavior: 'smooth', block: 'end' });
  speak(text);
}

function welcomeUser(text) {
  const chat = $('#welcome-chat');
  chat.append(el('div', 'msg user', esc(text)));
}

// ---------- Chemin A : masterplan collé → analyse → Launch Dashboard (§5) ----------
async function handleWelcomeSend() {
  const input = $('#welcome-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  welcomeUser(text);

  // Interview en cours (Chemin B) → la réponse alimente le masterplan
  if (state.interview) return interviewAnswer(text);

  // Texte long = probablement un masterplan (Chemin A)
  if (text.length > 120 || /masterplan|master plan/i.test(text)) {
    try {
      const { analysis } = await api('/api/ventures/analyze', { method: 'POST', body: { masterplan: text } });
      state.pendingLaunch = { masterplan: text, analysis };
      const views = analysis.recommendedViews.map(v => `- ${state.viewCatalog[v]?.name || v}`).join('\n');
      const btn = el('button', 'launch-btn', 'Launch Dashboard');
      btn.onclick = launchPending;
      welcomeSay(`I understand this venture — ${analysis.name} (${analysis.businessType}).\nI recommend this custom dashboard:\n${views}`, btn);
    } catch (e) { toast(e.message); }
    return;
  }

  // Message court : Trillion répond quand même (conversation générale)
  welcomeSay('Je t’écoute. Pour construire ton cockpit, colle ton Masterplan au complet ici — ou clique « Create a masterplan » et je te pose les bonnes questions.');
}

async function launchPending() {
  if (!state.pendingLaunch) return;
  try {
    const { venture, steps } = await api('/api/ventures', { method: 'POST', body: { masterplan: state.pendingLaunch.masterplan } });
    state.pendingLaunch = null;
    await loadVentures();
    await playBuild(venture, steps);
  } catch (e) { toast(e.message); }
}

// ---------- Chemin B : Create a masterplan — conversation, pas formulaire (§5) ----------
async function startInterview() {
  const questions = await api('/api/interview');
  state.interview = { questions, index: 0, answers: {} };
  $('#welcome-input').placeholder = 'Enter your masterplan';
  welcomeSay('Parfait — on le bâtit ensemble. ' + questions[0].q);
}

async function interviewAnswer(text) {
  const it = state.interview;
  it.answers[it.questions[it.index].key] = text;
  it.index += 1;
  if (it.index < it.questions.length) {
    welcomeSay(it.questions[it.index].q);
    return;
  }
  // Interview terminée → Trillion assemble le Masterplan et propose le cockpit
  try {
    const { masterplan, analysis } = await api('/api/ventures/draft', { method: 'POST', body: { answers: it.answers } });
    state.interview = null;
    state.pendingLaunch = { masterplan, analysis };
    const views = analysis.recommendedViews.map(v => `- ${state.viewCatalog[v]?.name || v}`).join('\n');
    const btn = el('button', 'launch-btn', 'Launch Dashboard');
    btn.onclick = launchPending;
    welcomeSay(`Voici ton Masterplan, assemblé à partir de ce que tu m'as raconté :\n\n${masterplan.slice(0, 700)}${masterplan.length > 700 ? '…' : ''}\n\nI recommend this custom dashboard:\n${views}`, btn);
  } catch (e) { toast(e.message); }
}

// ---------- §6 : le dashboard se bâtit sous les yeux ----------
async function playBuild(venture, steps) {
  show('#screen-building');
  $('#building-title').textContent = `Trillion construit le cockpit de ${venture.name}…`;
  const stepsBox = $('#building-steps');
  const grid = $('#building-grid');
  stepsBox.innerHTML = ''; grid.innerHTML = '';

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const line = el('div', 'step now', esc(step.label));
    stepsBox.append(line);
    if (step.view) grid.append(buildPanel(venture, step.view, true));
    await new Promise(r => setTimeout(r, i === steps.length - 1 ? 900 : 620));
    line.classList.remove('now'); line.classList.add('done');
  }
  await openVenture(venture.id);
}

// ---------- Dashboard ----------
async function openVenture(id) {
  const { venture, memory, messages, activity } = await api(`/api/ventures/${id}`);
  state.current = venture; state.memory = memory; state.messages = messages; state.activity = activity || [];
  renderSidebar();
  renderDashboard();
  show('#screen-dashboard');
}

function renderDashboard() {
  const v = state.current;
  $('#dash-name').textContent = v.name;
  $('#dash-type').textContent = `${v.businessType} · cockpit construit par Trillion`;
  for (const b of document.querySelectorAll('#period-picker button')) {
    b.classList.toggle('active', b.dataset.period === (v.period || 'week'));
  }
  const grid = $('#dash-grid');
  grid.innerHTML = '';
  grid.append(buildCommPanel(v));
  for (const viewId of v.views.filter(x => x !== 'communication')) {
    grid.append(buildPanel(v, viewId));
  }
}

const PERIOD_FR = { day: 'aujourd’hui', week: 'cette semaine', month: 'ce mois-ci', year: 'cette année', lifetime: 'depuis le début' };

function periodStart(period) {
  const d = new Date();
  if (period === 'day') { d.setHours(0, 0, 0, 0); return d; }
  if (period === 'week') { d.setDate(d.getDate() - 7); return d; }
  if (period === 'month') { d.setMonth(d.getMonth() - 1); return d; }
  if (period === 'year') { d.setFullYear(d.getFullYear() - 1); return d; }
  return new Date(0);
}

function pnlStats(venture) {
  const start = periodStart(venture.period || 'week');
  const entries = (venture.pnlLog || []).filter(e => new Date(e.at) >= start);
  const total = entries.reduce((n, e) => n + e.amount, 0);
  const wins = entries.filter(e => e.amount > 0).length;
  return {
    entries, total,
    winRate: entries.length ? Math.round((wins / entries.length) * 100) : null,
    best: entries.length ? Math.max(...entries.map(e => e.amount)) : null,
    worst: entries.length ? Math.min(...entries.map(e => e.amount)) : null,
  };
}

const fmt$ = (n) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toLocaleString('fr-CA')} $`;

// §12 : courbe lumineuse — gains en bleu/violet, pertes en magenta. Zéro look Excel.
function drawEquityCurve(canvas, entries) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.offsetWidth * 2;
  const h = canvas.height = canvas.offsetHeight * 2;
  ctx.clearRect(0, 0, w, h);
  if (entries.length < 2) return;
  let acc = 0;
  const pts = entries.map(e => (acc += e.amount));
  const min = Math.min(0, ...pts), max = Math.max(0, ...pts);
  const x = (i) => (i / (pts.length - 1)) * (w - 20) + 10;
  const y = (v) => h - 14 - ((v - min) / (max - min || 1)) * (h - 28);
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, '#38bdf8'); grad.addColorStop(0.6, '#8b5cf6');
  grad.addColorStop(1, pts.at(-1) >= 0 ? '#8b5cf6' : '#d946ef');
  ctx.strokeStyle = grad; ctx.lineWidth = 3; ctx.lineJoin = 'round';
  ctx.shadowColor = pts.at(-1) >= 0 ? 'rgba(139,92,246,0.9)' : 'rgba(217,70,239,0.9)';
  ctx.shadowBlur = 14;
  ctx.beginPath();
  pts.forEach((v, i) => i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v)));
  ctx.stroke();
}

// §11 : Living Memory — graphe animé style Obsidian, nœuds lumineux, étoiles mauves.
function drawMemoryGraph(canvas, venture, memory) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.offsetWidth * 2;
  const h = canvas.height = canvas.offsetHeight * 2;
  const nodes = [
    { label: venture.name, hue: 200, r: 13, cx: 0.5, cy: 0.5 },
    ...(memory?.facts || []).slice(-5).map((f, i) => ({ label: f.text, hue: 258, r: 6, seed: i })),
    ...(memory?.decisions || []).slice(-5).map((d, i) => ({ label: d.text, hue: 300, r: 7, seed: i + 5 })),
    ...(venture.tasks || []).filter(t => !t.done).slice(-4).map((t, i) => ({ label: t.text, hue: 270, r: 5, seed: i + 10 })),
  ];
  nodes.forEach((n, i) => {
    if (i === 0) { n.x = w / 2; n.y = h / 2; return; }
    const angle = (i / (nodes.length - 1)) * Math.PI * 2 + (n.seed || 0) * 0.7;
    const dist = (0.28 + ((n.seed || 0) % 3) * 0.09) * Math.min(w, h);
    n.x = w / 2 + Math.cos(angle) * dist * 1.35;
    n.y = h / 2 + Math.sin(angle) * dist * 0.85;
  });
  let stop = false;
  canvas.closest('.panel')?.addEventListener('DOMNodeRemoved', () => { stop = true; }, { once: true });
  (function frame(t) {
    if (stop || !canvas.isConnected) return;
    ctx.clearRect(0, 0, w, h);
    for (let i = 1; i < nodes.length; i++) {
      const pulse = 0.25 + 0.35 * Math.abs(Math.sin(t / 1400 + i));
      ctx.strokeStyle = `hsla(${nodes[i].hue}, 80%, 70%, ${pulse})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(nodes[0].x, nodes[0].y); ctx.lineTo(nodes[i].x, nodes[i].y); ctx.stroke();
    }
    for (const [i, n] of nodes.entries()) {
      const glow = 0.7 + 0.3 * Math.sin(t / 900 + i * 2);
      ctx.beginPath();
      ctx.fillStyle = `hsla(${n.hue}, 85%, ${i === 0 ? 78 : 68}%, ${glow})`;
      ctx.shadowColor = `hsla(${n.hue}, 90%, 65%, ${glow})`;
      ctx.shadowBlur = 22;
      ctx.arc(n.x, n.y, n.r * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(frame);
  })(0);
}

// Panneaux de vues — contenus honnêtes, tirés de l'analyse et de la mémoire (jamais de faux chiffres).
function buildPanel(venture, viewId, skeleton = false) {
  const meta = state.viewCatalog[viewId] || { name: viewId, icon: '✦' };
  const panel = el('div', 'panel glass' + (venture.layout?.[viewId] === 'large' ? ' large' : ''));
  panel.append(el('h3', null, `<span class="glyph">${meta.icon}</span> ${esc(meta.name)}`));
  if (skeleton) { panel.append(el('div', 'empty', '…')); return panel; }

  const a = venture.analysis || {};
  const mem = state.memory || { facts: [], decisions: [] };
  const period = PERIOD_FR[venture.period || 'week'];
  const lines = (items, fmt) => items.length
    ? items.map(x => el('div', 'line', fmt(x)))
    : [el('div', 'empty', 'Rien encore — dis-le à Trillion et elle le garde ici.')];

  switch (viewId) {
    case 'pnl': {
      // §12 : P&L obligatoire — gros chiffre, pourcentage, equity curve, win rate.
      const p = pnlStats(venture);
      panel.append(el('div', 'line', `<small>Profit / Loss · ${period}</small>`));
      if (p.entries.length) {
        const big = el('div', `pnl-big ${p.total >= 0 ? 'pos' : 'neg'}`, esc(fmt$(p.total)));
        const base = Math.abs(p.entries[0].amount) || 1;
        big.append(Object.assign(el('span', 'pnl-pct', `${p.winRate}% win rate`), {}));
        panel.append(big);
        const canvas = el('canvas', 'equity-canvas');
        panel.append(canvas);
        requestAnimationFrame(() => drawEquityCurve(canvas, p.entries));
        panel.append(el('div', 'line', `<small>Best : ${esc(fmt$(p.best))} · Worst : ${esc(fmt$(p.worst))} · ${p.entries.length} entrée(s)</small>`));
      } else {
        panel.append(el('div', 'pnl-big pos', '— $'));
        panel.append(el('div', 'empty', `Dis tes résultats à Trillion (« +500$ sur le trade Tesla », « perte de 200$ ») et la courbe s'allume.`));
      }
      // §23 — jamais de chiffre sans origine : provenance + heure de sync.
      const log = venture.pnlLog || [];
      const said = log.filter(e => e.source !== 'csv').length;
      const csvSrc = (venture.sources || []).find(s => s.type === 'csv');
      const provenance = [
        said ? `dit à Trillion (${said})` : null,
        csvSrc ? `import CSV (${csvSrc.entries}, sync ${new Date(csvSrc.lastSyncAt).toLocaleDateString('fr-CA')})` : null,
      ].filter(Boolean).join(' · ');
      if (provenance) panel.append(el('div', 'line src-line', `<small>Sources : ${esc(provenance)}</small>`));
      // §23 — connecteur universel : importer un CSV (date, montant, note).
      const importBtn = el('button', 'ghost-btn mini', 'Importer CSV');
      const fileInput = Object.assign(el('input'), { type: 'file', accept: '.csv,text/csv', hidden: true });
      importBtn.onclick = () => fileInput.click();
      fileInput.onchange = async () => {
        const file = fileInput.files[0];
        if (!file) return;
        try {
          const r = await api(`/api/ventures/${venture.id}/import/csv`, { method: 'POST', body: { csv: await file.text() } });
          toast(`✦ ${r.imported} entrée(s) importées${r.ignored ? ` · ${r.ignored} ignorée(s)` : ''}`);
          await openVenture(venture.id);
        } catch (e) { toast(e.message); }
      };
      panel.append(importBtn, fileInput);
      break;
    }
    case 'performance':
      panel.append(...lines(a.kpis || [], k => esc(k)));
      break;
    case 'risk':
      panel.append(...lines(a.risks || [], r => `◬ ${esc(r)}`));
      break;
    case 'strategy':
      panel.append(...lines(a.objectives || [], o => `✧ ${esc(o)}`));
      break;
    case 'memory': {
      // §11 : graphe animé style Obsidian — nœuds lumineux, connexions, étoiles mauves.
      const canvas = el('canvas', 'memory-canvas');
      panel.append(canvas);
      requestAnimationFrame(() => drawMemoryGraph(canvas, venture, mem));
      const entries = [
        ...mem.facts.map(f => ({ ...f, kind: 'fait' })),
        ...mem.decisions.map(d => ({ ...d, kind: d.revokedAt ? 'décision · révoquée' : 'décision' })),
        ...(mem.lessons || []).map(l => ({ ...l, kind: 'leçon ⟁' })),
      ].sort((x, y) => x.at.localeCompare(y.at)).slice(-5);
      panel.append(...entries.map(e => el('div', 'line' + (e.revokedAt ? ' revoked' : ''),
        `<small>${new Date(e.at).toLocaleDateString('fr-CA')} · ${e.kind}</small><br/>${esc(e.text.slice(0, 110))}`)));
      panel.append(el('div', 'memory-tagline', '« Trillion ne répond pas seulement. Elle se souvient. »'));
      // §24/§28 — export total : ta mémoire t'appartient, en Markdown ouvert.
      const exportBtn = el('button', 'ghost-btn mini', 'Exporter (Markdown)');
      exportBtn.onclick = () => { window.open(`/api/ventures/${venture.id}/export`, '_blank'); };
      panel.append(exportBtn);
      break;
    }
    case 'tasks': {
      const tasks = venture.tasks || [];
      if (!tasks.length) { panel.append(el('div', 'empty', 'Dis « Create a task : … » à Trillion et la discussion devient une tâche suivable.')); break; }
      for (const t of tasks.slice(-10)) {
        const line = el('label', 'task-line' + (t.done ? ' done' : ''));
        const cb = Object.assign(el('input'), { type: 'checkbox', checked: t.done });
        cb.onchange = async () => {
          await api(`/api/ventures/${venture.id}/tasks/${t.id}/toggle`, { method: 'POST', body: {} });
          await openVenture(venture.id);
        };
        line.append(cb, el('span', null, esc(t.text)));
        panel.append(line);
      }
      break;
    }
    case 'nextactions': {
      const open = (venture.tasks || []).filter(t => !t.done).slice(0, 4);
      panel.append(...lines(
        [...open.map(t => `☰ ${t.text}`), ...(a.objectives || []).slice(0, 1).map(o => `✧ Avancer : ${o}`)],
        x => esc(x)));
      break;
    }
    case 'scripts':
      panel.append(...lines(a.revenueModel || [], r => `✎ ${esc(r)}`));
      panel.append(el('div', 'empty', 'Colle tes scripts de vente et réponses aux objections à Trillion — elle les garde ici.'));
      break;
    case 'agents': {
      // §22 — Reporter et Sentinelle travaillent seuls ; chaque action est visible ici.
      const activity = (state.activity || []).slice(-6).reverse();
      if (activity.length) {
        panel.append(el('div', 'line', `<small>Activity Log — rien ne se fait en cachette</small>`));
        panel.append(...activity.map(x => el('div', 'line activity',
          `<small>${new Date(x.at).toLocaleDateString('fr-CA')} · <strong>${esc(x.agent)}</strong></small><br/>${esc(x.action.slice(0, 120))}`)));
      } else {
        panel.append(el('div', 'empty', 'Reporter dépose le rapport hebdo chaque vendredi ; la Sentinelle surveille tes seuils. Leurs actions apparaîtront ici.'));
      }
      panel.append(...(a.suggestedAgents || []).map(s => el('div', 'line', `⟠ ${esc(s)} <small>· prêt à assigner</small>`)));
      break;
    }
    default:
      panel.append(el('div', 'empty',
        `Vue ${meta.name} en place (${period}). Alimente-la en parlant à Trillion — ` +
        `elle structure ce que tu lui dis, ou branche une source de données.`));
  }
  return panel;
}

// ---------- Communication Center (§7) ----------
function buildCommPanel(venture) {
  const panel = el('div', 'panel glass comm');
  panel.append(el('h3', null, `<span class="glyph">✦</span> Communication Center`));

  const log = el('div', 'comm-log');
  for (const m of state.messages.slice(-30)) {
    log.append(el('div', `msg ${m.role === 'trillion' ? 'trillion' : 'user'}`, esc(m.text)));
  }
  panel.append(log);

  // Quick actions concrètes (§10)
  const qa = el('div', 'quick-actions');
  for (const action of venture.analysis?.quickActions || []) {
    const chip = el('button', 'qa-chip', esc(action));
    chip.onclick = () => { textarea.value = action; sendComm(); };
    qa.append(chip);
  }
  panel.append(qa);

  const composer = el('div', 'comm-composer');
  const textarea = Object.assign(el('textarea'), { placeholder: 'Talk with Trillion', rows: 1 });
  const mic = el('button', 'icon-btn', '🎙');
  const voiceToggle = el('button', 'icon-btn' + (state.voiceReply ? ' on' : ''), '🔊');
  voiceToggle.title = 'Trillion répond aussi en voix (la trace écrite reste toujours)';
  voiceToggle.onclick = () => { state.voiceReply = !state.voiceReply; voiceToggle.classList.toggle('on', state.voiceReply); };
  const send = el('button', 'send-btn', 'Send');
  composer.append(mic, textarea, voiceToggle, send);
  panel.append(composer);

  wireMic(mic, textarea);
  let usedVoice = false;
  mic.addEventListener('click', () => { usedVoice = true; });

  async function sendComm() {
    const text = textarea.value.trim();
    if (!text) return;
    textarea.value = '';
    log.append(el('div', 'msg user', esc(text)));
    log.scrollTop = log.scrollHeight;
    const thinking = el('div', 'msg trillion', '…');
    log.append(thinking);
    try {
      const r = await api(`/api/ventures/${venture.id}/chat`, {
        method: 'POST',
        body: { text, voice: usedVoice, speak: state.voiceReply },
      });
      usedVoice = false;
      thinking.innerHTML = esc(r.reply);
      speak(r.reply);
      if (r.dashboardChanged) {
        // §6 : Trillion modifie le dashboard en temps réel
        const { venture: fresh, memory, messages, activity } = await api(`/api/ventures/${venture.id}`);
        state.current = fresh; state.memory = memory; state.messages = messages; state.activity = activity || [];
        renderDashboard();
        toast('✦ Cockpit mis à jour par Trillion');
      } else {
        state.messages.push({ role: 'user', text }, { role: 'trillion', text: r.reply });
      }
    } catch (e) {
      thinking.innerHTML = esc(`Petit accroc : ${e.message}`);
    }
    log.scrollTop = log.scrollHeight;
  }

  send.onclick = sendComm;
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendComm(); }
  });
  return panel;
}

// ---------- §15 : Empire Overview ----------
async function showEmpire() {
  const e = await api('/api/empire');
  state.current = null;
  renderSidebar();
  const grid = $('#empire-grid');
  grid.innerHTML = '';

  // §21 — Morning Brief : Trillion parle la première (une fois par jour, silence intelligent sinon).
  const brief = state.brief;
  if (brief && !brief.silent && localStorage.getItem('trillion-brief-seen') !== brief.date) {
    const card = el('div', 'panel glass large brief');
    card.append(el('h3', null, '<span class="glyph">☼</span> Morning Brief'));
    card.append(el('div', 'line', esc(brief.greeting)));
    for (const line of brief.lines) card.append(el('div', 'line', esc(line)));
    card.append(el('div', 'line brief-priority', esc(brief.priority)));
    const ok = el('button', 'ghost-btn mini', 'Compris ✦');
    ok.onclick = () => { localStorage.setItem('trillion-brief-seen', brief.date); card.remove(); };
    card.append(ok);
    grid.append(card);
  }

  const health = el('div', 'panel glass');
  health.append(el('h3', null, '<span class="glyph">❖</span> Santé globale'));
  health.append(el('div', `pnl-big ${e.totalPnlMonth >= 0 ? 'pos' : 'neg'}`, esc(fmt$(e.totalPnlMonth))));
  health.append(el('div', 'line', `<small>Revenus / P&L totaux (30 jours) · ${e.ventures.length} venture(s) active(s)</small>`));
  health.append(el('div', 'line', `☰ ${e.openTasks} tâche(s) ouvertes · ${e.blockedTasks ? `<span class="health-attention">${e.blockedTasks} bloquée(s)</span>` : '<span class="health-ok">aucune bloquée</span>'}`));
  grid.append(health);

  const reco = el('div', 'panel glass');
  reco.append(el('h3', null, '<span class="glyph">✦</span> Priorité du jour — recommandation de Trillion'));
  reco.append(el('div', 'line', esc(e.recommendation)));
  grid.append(reco);

  const vents = el('div', 'panel glass large');
  vents.append(el('h3', null, '<span class="glyph">⟁</span> Toutes les entreprises'));
  if (!e.ventures.length) vents.append(el('div', 'empty', 'Ton empire commence ici. Clique + et donne un Masterplan à Trillion.'));
  for (const v of e.ventures) {
    const row = el('div', 'line',
      `<span class="health-${v.health}">●</span> <strong>${esc(v.name)}</strong> <small>· ${esc(v.businessType)}</small>` +
      ` — ${esc(fmt$(v.pnlMonth))} (30 j) · ${v.openTasks} tâche(s)` +
      (v.objective ? `<br/><small>✧ ${esc(v.objective.slice(0, 90))}</small>` : ''));
    row.style.cursor = 'pointer';
    row.onclick = () => openVenture(v.id);
    vents.append(row);
  }
  grid.append(vents);

  const risks = el('div', 'panel glass');
  risks.append(el('h3', null, '<span class="glyph">◬</span> Risques principaux'));
  risks.append(...(e.risks.length ? e.risks.map(r => el('div', 'line', `◬ ${esc(r)}`)) : [el('div', 'empty', 'Aucun risque identifié.')]));
  grid.append(risks);

  const agents = el('div', 'panel glass');
  agents.append(el('h3', null, '<span class="glyph">⟠</span> Agents actifs'));
  agents.append(...(e.agents.length ? e.agents.map(a => el('div', 'line', `⟠ ${esc(a)}`)) : [el('div', 'empty', 'Les agents arrivent avec tes ventures.')]));
  grid.append(agents);

  show('#screen-empire');
}
$('#empire-btn').onclick = showEmpire;

// ---------- Période ----------
$('#period-picker').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-period]');
  if (!btn || !state.current) return;
  const fr = { day: 'jour', week: 'semaine', month: 'mois', year: 'année', lifetime: 'lifetime' };
  await api(`/api/ventures/${state.current.id}/chat`, {
    method: 'POST', body: { text: `Mets la vue en ${fr[btn.dataset.period]}` },
  });
  await openVenture(state.current.id);
});

// ---------- Boot ----------
$('#welcome-send').onclick = handleWelcomeSend;
$('#welcome-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.metaKey) { e.preventDefault(); handleWelcomeSend(); }
});
$('#create-masterplan').onclick = startInterview;
$('#add-venture').onclick = showWelcome;
wireMic($('#welcome-mic'), $('#welcome-input'));

(async function boot() {
  startCosmos();
  try {
    const status = await api('/api/status');
    state.viewCatalog = status.viewCatalog || {};
    $('#brain-pill').textContent = status.claude ? '✦ Claude connectée' : '◌ moteur local';
    $('#brain-pill').title = status.claude
      ? 'Trillion pense avec Claude (claude-opus-4-8)'
      : 'Ajoute ANTHROPIC_API_KEY côté serveur pour que Trillion réponde à tout en profondeur';
  } catch { /* status non bloquant */ }
  await loadVentures();
  // §21 : les agents tournent en passant, puis Trillion prépare son Morning Brief.
  try { state.brief = (await api('/api/brief')).brief; } catch { state.brief = null; }
  // §15 : la vue Home représente tout l'empire.
  if (state.ventures.length) await showEmpire();
  else showWelcome();
})();

// ---- Rail d'icônes + chips Univers (référence §18) ----
const SAMPLE_PLANS = {
  trading: `# Fonds personnel de trading\nStratégie swing trading crypto (BTC, ETH) et actions US.\nObjectif : atteindre 100 000$ de capital en 12 mois.\nKPI : P&L mensuel, win rate, drawdown maximum 15%.\nRègle : jamais plus de 2% du capital par trade.\nRisque : volatilité extrême du marché crypto.`,
  agency: `# Agence de services IA\nOn vend des réceptionnistes IA aux PME du Québec.\nClient idéal : cliniques, garages, salons — 500$/mois par client.\nObjectif : 20 clients récurrents d'ici 6 mois.\nKPI : leads contactés, démos bookées, taux de conversion, MRR.\nRisque : cycle de vente lent, dépendance aux référencements.`,
  ecommerce: `# Boutique e-commerce\nBoutique Shopify de produits bien-être, dropshipping au départ.\nObjectif : 10 000$/mois de ventes en 6 mois, marge 30%.\nKPI : commandes/jour, coût d'acquisition, panier moyen, retours.\nOpérations : fournisseurs à valider, inventaire à suivre.\nRisque : délais fournisseurs, coût des ads qui monte.`,
  saas: `# Micro-SaaS\nLogiciel d'abonnement pour gérer les rendez-vous des barbiers.\nPrix : 29$/mois par salon. Objectif : 1 000$ MRR en 4 mois.\nKPI : MRR, churn mensuel, essais convertis, tickets support.\nRisque : churn élevé si l'onboarding est faible.`,
  immobilier: `# Portefeuille immobilier\nAchat de duplex/triplex à revenus au Québec.\nObjectif : 3 portes de plus cette année, cashflow 300$/porte/mois.\nKPI : loyers perçus, taux d'occupation, cashflow net mensuel.\nRisque : taux d'intérêt, vacance locative, réparations surprises.`,
};

document.querySelectorAll('#universe-chips .chip').forEach(chip => {
  chip.onclick = () => {
    $('#welcome-input').value = SAMPLE_PLANS[chip.dataset.sample] || '';
    $('#welcome-input').focus();
    toast('Exemple de Masterplan inséré — modifie-le ou Send directement ✦');
  };
});

$('#rail-home')?.addEventListener('click', () => showEmpire());
$('#rail-new')?.addEventListener('click', () => showWelcome());
$('#rail-crown')?.addEventListener('click', () => toast('✦ Founder Mode — actif'));
