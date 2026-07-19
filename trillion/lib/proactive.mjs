// Trillion proactive (V2 §21-23) — elle parle la première.
// Morning Brief, alertes de vérité, silence intelligent, agents Reporter & Sentinelle,
// et le connecteur universel CSV. Règle : une notification proactive par jour maximum,
// sauf alerte critique — et si rien ne mérite l'attention, Trillion se tait.
import { buildReport, pnlForPeriod } from './trillion.mjs';

const DAY = 24 * 3600 * 1000;
const fmt$ = (n) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toLocaleString('fr-CA')} $`;
const dayKey = (d) => new Date(d).toISOString().slice(0, 10);

// ---- §21 · Sentinelle : les alertes de vérité, calculées depuis les vraies données ----
export function computeAlerts(venture, now = new Date()) {
  const alerts = [];

  // P&L négatif 3 jours de suite → critique
  const daily = {};
  for (const e of venture.pnlLog || []) {
    const k = dayKey(e.at);
    daily[k] = (daily[k] || 0) + e.amount;
  }
  const days = Object.keys(daily).sort().slice(-3);
  const recent = days.length === 3 && (now - new Date(days[2])) <= 4 * DAY;
  if (recent && days.every(d => daily[d] < 0)) {
    alerts.push({
      level: 'critical', kind: 'pnl-streak',
      text: `◈ ${venture.name} : P&L négatif 3 jours de suite (${days.map(d => fmt$(daily[d])).join(' · ')}). On regarde ça ensemble ?`,
    });
  }

  // Tâche bloquée > 3 jours
  const stale = (venture.tasks || [])
    .filter(t => !t.done && (now - new Date(t.at)) > 3 * DAY)
    .sort((a, b) => a.at.localeCompare(b.at));
  if (stale.length) {
    const age = Math.floor((now - new Date(stale[0].at)) / DAY);
    alerts.push({
      level: 'warn', kind: 'stale-task',
      text: `⏳ ${venture.name} : « ${stale[0].text} » traîne depuis ${age} jours${stale.length > 1 ? ` (+${stale.length - 1} autre(s))` : ''}.`,
    });
  }

  return alerts.map(a => ({ ...a, ventureId: venture.id, ventureName: venture.name }));
}

// ---- §21 · Morning Brief : « Bonjour. Voici ton empire ce matin. » ----
// 15 secondes de lecture. Silence intelligent : rien à dire → silent: true.
export async function buildMorningBrief(store, now = new Date()) {
  const settings = await store.settings();
  const ventures = await store.ventures();
  if (!ventures.length) return { silent: true, reason: 'aucun venture' };

  const alerts = ventures.flatMap(v => computeAlerts(v, now));
  const critical = alerts.some(a => a.level === 'critical');
  const weekend = [0, 6].includes(now.getDay());

  // Coupures demandées par conversation — une alerte critique passe toujours.
  if (!settings.alerts.enabled && !critical) return { silent: true, reason: 'alertes coupées par conversation' };
  if (settings.alerts.quietWeekends && weekend && !critical) return { silent: true, reason: 'silence weekend demandé' };

  // P&L d'hier, tous ventures confondus
  const yesterday = dayKey(new Date(now - DAY));
  let pnlYesterday = 0, hasPnl = false;
  for (const v of ventures) {
    for (const e of v.pnlLog || []) {
      if (dayKey(e.at) === yesterday) { pnlYesterday += e.amount; hasPnl = true; }
    }
  }

  const openTasks = ventures.flatMap(v => (v.tasks || []).filter(t => !t.done).map(t => ({ ...t, ventureName: v.name })));

  // Silence intelligent : aucune donnée, aucune alerte, aucune tâche → Trillion se tait.
  if (!hasPnl && !alerts.length && !openTasks.length) return { silent: true, reason: 'rien ne mérite ton attention' };

  // LA priorité du jour : l'alerte critique d'abord, sinon la tâche la plus vieille, sinon l'objectif n°1.
  let priority;
  if (critical) priority = alerts.find(a => a.level === 'critical').text;
  else if (openTasks.length) {
    const oldest = openTasks.sort((a, b) => a.at.localeCompare(b.at))[0];
    priority = `Finis « ${oldest.text} » (${oldest.ventureName}).`;
  } else {
    const v = ventures[0];
    priority = v.analysis?.objectives?.[0]
      ? `Avance sur : ${v.analysis.objectives[0]} (${v.name}).`
      : `Donne-moi tes chiffres du jour et je m'occupe du reste.`;
  }

  const lines = [
    hasPnl ? `◈ P&L d'hier : ${fmt$(pnlYesterday)}` : null,
    openTasks.length ? `☰ ${openTasks.length} tâche(s) ouvertes dans l'empire` : null,
    ...alerts.map(a => a.text),
  ].filter(Boolean);

  return {
    silent: false,
    date: dayKey(now),
    greeting: `Bonjour. Voici ton empire ce matin — ${ventures.length} venture(s) sous mes yeux.`,
    lines,
    priority: `✦ LA priorité du jour : ${priority}`,
    alerts,
  };
}

// ---- §22 · Reporter : le rapport hebdo se dépose seul dans le Vault + Living Memory ----
export async function runReporter(store, now = new Date()) {
  const ventures = await store.ventures();
  const deposited = [];
  for (const venture of ventures) {
    const last = venture.lastReportAt ? new Date(venture.lastReportAt) : null;
    const since = last ? now - last : Infinity;
    const age = now - new Date(venture.createdAt || now);
    const isFriday = now.getDay() === 5;
    // Dû : chaque vendredi (si pas déjà fait cette semaine), ou rattrapage si > 7 jours sans rapport.
    const due = (isFriday && since >= 6 * DAY) || (since >= 7 * DAY && age >= 7 * DAY);
    if (!due) continue;

    const memory = await store.memory(venture.id);
    const report = buildReport({ venture, memory });
    const safeName = venture.name.replace(/[/\\:]/g, '-');
    const notePath = `Ventures/${safeName}/Reports/${dayKey(now)}-hebdo.md`;
    await store.writeVaultNote(notePath, report);
    await store.rememberFact(venture.id, `Rapport hebdo du ${dayKey(now)} déposé dans le Vault par le Reporter.`, 'reporter');
    await store.logActivity(venture.id, { agent: 'Reporter', action: `Rapport hebdo déposé dans le Vault (${dayKey(now)}-hebdo.md)` });
    venture.lastReportAt = now.toISOString();
    await store.upsertVenture(venture);
    deposited.push({ ventureId: venture.id, path: notePath });
  }
  return deposited;
}

// ---- §22 · Sentinelle : surveille les seuils et trace chaque constat dans l'Activity Log ----
export async function runSentinelle(store, now = new Date()) {
  const ventures = await store.ventures();
  const all = [];
  for (const venture of ventures) {
    const alerts = computeAlerts(venture, now);
    if (!alerts.length) continue;
    const activity = await store.activity(venture.id);
    for (const alert of alerts) {
      // Un constat par seuil par jour — la Sentinelle ne radote pas.
      const seen = activity.some(a => a.agent === 'Sentinelle' && a.kind === alert.kind && dayKey(a.at) === dayKey(now));
      if (!seen) await store.logActivity(venture.id, { at: now.toISOString(), agent: 'Sentinelle', kind: alert.kind, level: alert.level, action: alert.text });
    }
    all.push(...alerts);
  }
  return all;
}

// Les agents tournent « en passant » : appelés au chargement du brief / de l'empire.
// Zéro action externe, zéro approbation requise — tout reste dans le Vault et l'Activity Log.
export async function runAgents(store, now = new Date()) {
  const reports = await runReporter(store, now);
  const alerts = await runSentinelle(store, now);
  return { reports, alerts };
}

// ---- §23 · Connecteur universel : import CSV du P&L ----
// Colonnes attendues (souples) : date, montant, note. Séparateur , ou ; — décimales . ou ,
export function parseCsvPnl(csv) {
  const lines = String(csv || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const entries = [], errors = [];
  for (const line of lines) {
    const sep = line.includes(';') ? ';' : ',';
    // Découpage qui respecte les guillemets : "1,5" reste une seule colonne.
    const cols = [];
    let cur = '', inQuotes = false;
    for (const ch of line) {
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === sep && !inQuotes) { cols.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    cols.push(cur.trim());
    if (cols.length < 2) { errors.push(line); continue; }
    const at = new Date(cols[0]);
    // "1 234,56" et "1,234.56" doivent tous deux donner un montant valide.
    const rawAmount = cols[1].replace(/\s/g, '').replace(/,(?=\d{1,2}$)/, '.').replace(/,/g, '');
    const amount = parseFloat(rawAmount.replace(/[^0-9.+-]/g, ''));
    if (Number.isNaN(at.getTime()) || Number.isNaN(amount)) {
      // ligne d'en-tête ("date,montant,note") ou ligne invalide
      if (entries.length === 0 && /date|montant|amount/i.test(line)) continue;
      errors.push(line);
      continue;
    }
    entries.push({ at: at.toISOString(), amount, note: cols.slice(2).join(' ').slice(0, 120) || 'import CSV' });
  }
  return { entries, errors };
}
