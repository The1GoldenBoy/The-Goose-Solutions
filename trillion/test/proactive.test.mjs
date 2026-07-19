// V2 §21-24 — Trillion proactive : Morning Brief, alertes, agents, CSV, mémoire corrigible.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { computeAlerts, buildMorningBrief, runReporter, runSentinelle, parseCsvPnl } from '../lib/proactive.mjs';
import { parseLesson, parseAlertSetting, parseMemoryRevoke, parseSourceDisconnect } from '../lib/trillion.mjs';
import { Store } from '../lib/store.mjs';
import { createApp } from '../server.mjs';

const DAY = 24 * 3600 * 1000;
const iso = (msAgo) => new Date(Date.now() - msAgo).toISOString();

function fakeVenture(over = {}) {
  return {
    id: 'v-test1234', name: 'Nova', businessType: 'agency',
    createdAt: iso(30 * DAY), views: ['pnl'], tasks: [], pnlLog: [],
    analysis: { objectives: ['20 clients payants'], risks: [], kpis: [] },
    ...over,
  };
}

// ---- §21 : alertes de vérité ----
test('computeAlerts : P&L négatif 3 jours de suite → alerte critique', () => {
  const v = fakeVenture({
    pnlLog: [
      { at: iso(2 * DAY), amount: -100 },
      { at: iso(1 * DAY), amount: -50 },
      { at: iso(2 * 3600 * 1000), amount: -75 },
    ],
  });
  const alerts = computeAlerts(v);
  assert.ok(alerts.some(a => a.kind === 'pnl-streak' && a.level === 'critical'));
});

test('computeAlerts : tâche bloquée > 3 jours → alerte ; rien à signaler → silence', () => {
  const stale = fakeVenture({ tasks: [{ id: 't1', text: 'Relancer les leads', done: false, at: iso(5 * DAY) }] });
  assert.ok(computeAlerts(stale).some(a => a.kind === 'stale-task'));
  const sain = fakeVenture({
    pnlLog: [{ at: iso(DAY), amount: 500 }],
    tasks: [{ id: 't1', text: 'Frais', done: false, at: iso(DAY) }],
  });
  assert.equal(computeAlerts(sain).length, 0);
});

// ---- §21 : Morning Brief + silence intelligent ----
test('buildMorningBrief : silence sans venture, parle avec données, respecte les réglages', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'trillion-brief-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  await store.init();

  // Aucun venture → silence
  assert.equal((await buildMorningBrief(store)).silent, true);

  // Venture avec P&L d'hier et tâche → brief parlant
  await store.upsertVenture(fakeVenture({
    pnlLog: [{ at: iso(DAY), amount: 800 }],
    tasks: [{ id: 't1', text: 'Appeler la clinique', done: false, at: iso(DAY) }],
  }));
  const brief = await buildMorningBrief(store);
  assert.equal(brief.silent, false);
  assert.match(brief.greeting, /Bonjour/);
  assert.ok(brief.lines.some(l => /P&L d'hier/.test(l)));
  assert.match(brief.priority, /priorité du jour/);

  // « plus d'alertes » → silence (pas d'alerte critique active)
  await store.saveSettings({ alerts: { enabled: false } });
  assert.equal((await buildMorningBrief(store)).silent, true);

  // silence weekend demandé → muet le samedi
  await store.saveSettings({ alerts: { enabled: true, quietWeekends: true } });
  const saturday = new Date('2026-07-18T12:00:00Z'); // un samedi
  assert.equal((await buildMorningBrief(store, saturday)).silent, true);
});

// ---- §22 : Reporter + Sentinelle ----
test('Reporter : dépose le rapport hebdo une seule fois ; Sentinelle trace sans radoter', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'trillion-agents-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  await store.init();
  await store.upsertVenture(fakeVenture({
    pnlLog: [{ at: iso(2 * DAY), amount: 300 }],
    tasks: [{ id: 't1', text: 'Vieille tâche', done: false, at: iso(6 * DAY) }],
  }));

  const friday = new Date('2026-07-17T13:00:00Z'); // un vendredi
  const deposited = await runReporter(store, friday);
  assert.equal(deposited.length, 1);
  const vaultPath = join(dir, 'vault', 'Trillion Memory Vault', deposited[0].path);
  assert.ok(existsSync(vaultPath));
  assert.match(await readFile(vaultPath, 'utf8'), /Rapport — Nova/);
  // Mémoire nourrie + pas de doublon au 2e passage
  const mem = await store.memory('v-test1234');
  assert.ok(mem.facts.some(f => f.source === 'reporter'));
  assert.equal((await runReporter(store, friday)).length, 0);

  // Sentinelle : un constat par seuil par jour
  const alerts1 = await runSentinelle(store, friday);
  assert.ok(alerts1.some(a => a.kind === 'stale-task'));
  await runSentinelle(store, friday);
  const activity = await store.activity('v-test1234');
  assert.equal(activity.filter(a => a.agent === 'Sentinelle' && a.kind === 'stale-task').length, 1);
  assert.ok(activity.some(a => a.agent === 'Reporter'));
});

// ---- §23 : connecteur CSV ----
test('parseCsvPnl : en-tête, séparateur ;, décimales FR, lignes invalides comptées', () => {
  const csv = [
    'date,montant,note',
    '2026-07-10,500,mandat clinique',
    '2026-07-11;-1 234,56;pubs Facebook',
    '2026-07-12,"2,5",café',
    'pas une ligne valide',
  ].join('\n');
  const { entries, errors } = parseCsvPnl(csv);
  assert.equal(entries.length, 3);
  assert.equal(entries[0].amount, 500);
  assert.equal(entries[1].amount, -1234.56);
  assert.equal(entries[2].amount, 2.5);
  assert.equal(errors.length, 1);
});

// ---- §21/§23/§24 : parseurs conversationnels ----
test('parseurs : leçon, réglages d’alertes, révocation, débranchement', () => {
  assert.equal(parseLesson('Leçon : ne jamais trader le dimanche soir'), 'ne jamais trader le dimanche soir');
  assert.equal(parseLesson('parle-moi de la leçon'), null);

  assert.equal(parseAlertSetting('Trillion, plus d’alertes le weekend').alerts.quietWeekends, true);
  assert.equal(parseAlertSetting('coupe les alertes').alerts.enabled, false);
  assert.equal(parseAlertSetting('réactive les alertes').alerts.enabled, true);
  assert.equal(parseAlertSetting('parle-moi des ventes'), null);

  const r = parseMemoryRevoke('cette décision du 12 avril n’est plus vraie');
  assert.equal(r.day, 12);
  assert.equal(r.month, 3);
  assert.ok(parseMemoryRevoke('annule la décision « viser les cliniques »').quote.includes('cliniques'));
  assert.equal(parseMemoryRevoke('on décide de viser les spas'), null);

  assert.equal(parseSourceDisconnect('débranche le CSV').source, 'csv');
  assert.equal(parseSourceDisconnect('branche le csv'), null);
});

// ---- Intégration HTTP : brief, import CSV, révocation, leçon, export ----
test('API : /api/brief, import CSV avec provenance, mémoire corrigible, export Markdown', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'trillion-v2-'));
  const app = await createApp({ stateDir: join(dir, 'state') });
  await new Promise(r => app.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  t.after(async () => { app.close(); await rm(dir, { recursive: true, force: true }); });
  const call = async (method, path, body) => {
    const res = await fetch(base + path, {
      method, headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, res, data: await (res.headers.get('content-type')?.includes('json') ? res.json() : res.text()) };
  };

  const plan = '# Agence Nova\nOn vend un service aux PME. Objectif : 20 clients.\nRisque : cycle de vente long.';
  const { data: created } = await call('POST', '/api/ventures', { masterplan: plan });
  const id = created.venture.id;

  // §23 — import CSV : provenance + sync + Activity Log
  const csv = 'date,montant,note\n2026-07-10,500,mandat\n2026-07-11,-200,pubs';
  const imp = await call('POST', `/api/ventures/${id}/import/csv`, { csv });
  assert.equal(imp.status, 200);
  assert.equal(imp.data.imported, 2);
  assert.ok(imp.data.venture.pnlLog.every(e => e.source === 'csv' && e.syncedAt));
  assert.equal(imp.data.venture.sources[0].type, 'csv');
  const got = await call('GET', `/api/ventures/${id}`);
  assert.ok(got.data.activity.some(a => a.agent === 'Connecteur CSV'));

  // §21 — brief parlant (P&L présent), et réglage par conversation
  const brief1 = await call('GET', '/api/brief');
  assert.equal(brief1.status, 200);
  assert.ok('silent' in brief1.data.brief);
  const mute = await call('POST', `/api/ventures/${id}/chat`, { text: 'Trillion, plus d’alertes le weekend' });
  assert.match(mute.data.reply, /weekend/i);

  // §24 — décision → révocation par conversation (l'historique reste)
  await call('POST', `/api/ventures/${id}/chat`, { text: 'On décide de viser les cliniques dentaires.' });
  const rev = await call('POST', `/api/ventures/${id}/chat`, { text: 'Cette décision n’est plus vraie' });
  assert.match(rev.data.reply, /révoquée/);
  const mem = (await call('GET', `/api/ventures/${id}`)).data.memory;
  const decision = mem.decisions.find(d => d.text.includes('cliniques'));
  assert.ok(decision.revokedAt);

  // §24 — leçon → mémoire + Vault
  const lecon = await call('POST', `/api/ventures/${id}/chat`, { text: 'Leçon : toujours qualifier le budget avant la démo' });
  assert.match(lecon.data.reply, /Leçon gravée/);
  const mem2 = (await call('GET', `/api/ventures/${id}`)).data.memory;
  assert.ok(mem2.lessons.some(l => l.text.includes('qualifier le budget')));

  // §23 — débrancher le CSV par conversation : les entrées dites restent
  await call('POST', `/api/ventures/${id}/chat`, { text: 'J’ai gagné 800$ sur le mandat spa' });
  const disc = await call('POST', `/api/ventures/${id}/chat`, { text: 'Débranche le CSV' });
  assert.equal(disc.data.venture.pnlLog.length, 1);
  assert.equal(disc.data.venture.pnlLog[0].source, 'conversation');
  assert.equal(disc.data.venture.sources.length, 0);

  // §24 — export total en Markdown
  const exp = await call('GET', `/api/ventures/${id}/export`);
  assert.equal(exp.status, 200);
  assert.match(exp.data, /# Agence Nova — export Trillion/);
  assert.match(exp.data, /révoquée le/);
  assert.match(exp.data, /qualifier le budget/);
  assert.match(exp.data, /dit à Trillion/);
});
