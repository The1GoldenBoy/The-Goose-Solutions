// Intégration HTTP : cycle complet — analyse, Launch Dashboard, chat, mémoire, commandes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createApp } from '../server.mjs';

const PLAN = `# Agence Nova
On vend un service de réceptionniste IA aux PME.
Objectif : 20 clients payants à 500$/mois d'ici décembre.
Suivre les leads et follow-ups chaque semaine.
Risque : cycle de vente trop long.
`;

async function startServer() {
  const dir = await mkdtemp(join(tmpdir(), 'trillion-'));
  const app = await createApp({ stateDir: join(dir, 'state') });
  await new Promise(r => app.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  return { app, base, dir };
}

async function call(base, method, path, body) {
  const res = await fetch(base + path, {
    method, headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

test('flux complet : analyse → Launch → cockpit → chat → commande → mémoire', async (t) => {
  const { app, base, dir } = await startServer();
  t.after(async () => { app.close(); await rm(dir, { recursive: true, force: true }); });

  // Analyse (Chemin A, avant Launch)
  const analyzed = await call(base, 'POST', '/api/ventures/analyze', { masterplan: PLAN });
  assert.equal(analyzed.status, 200);
  assert.equal(analyzed.data.analysis.businessType, 'agency');
  assert.match(analyzed.data.steps[0].label, /Analyzing/);

  // Launch Dashboard
  const created = await call(base, 'POST', '/api/ventures', { masterplan: PLAN });
  assert.equal(created.status, 201);
  const venture = created.data.venture;
  assert.ok(venture.id.startsWith('v-'));
  assert.ok(venture.views.includes('pipeline'));

  // Mémoire initiale semée depuis le masterplan (§5)
  const got = await call(base, 'GET', `/api/ventures/${venture.id}`);
  assert.ok(got.data.memory.facts.length >= 2);

  // Chat : commande dashboard conversationnelle (§6)
  const cmd = await call(base, 'POST', `/api/ventures/${venture.id}/chat`, { text: 'Ajoute une vue fournisseurs' });
  assert.equal(cmd.status, 200);
  assert.equal(cmd.data.dashboardChanged, true);
  assert.ok(cmd.data.venture.views.includes('suppliers'));

  // Chat : décision → mémoire vivante (§8)
  await call(base, 'POST', `/api/ventures/${venture.id}/chat`, { text: 'On décide de viser les cliniques dentaires en premier.' });
  const after = await call(base, 'GET', `/api/ventures/${venture.id}`);
  assert.ok(after.data.memory.decisions.some(d => d.text.includes('cliniques dentaires')));

  // Trace écrite obligatoire (§8) : tous les échanges sont sauvegardés
  assert.ok(after.data.messages.length >= 4);
  assert.ok(after.data.messages.some(m => m.role === 'trillion'));

  // Chat : question contextuelle
  const q = await call(base, 'POST', `/api/ventures/${venture.id}/chat`, { text: 'Où sont mes risques ?' });
  assert.match(q.data.reply, /cycle de vente/i);

  // §10 — Create a task : la discussion devient une tâche suivable
  const taskR = await call(base, 'POST', `/api/ventures/${venture.id}/chat`, { text: 'Create a task : relancer les 5 leads chauds' });
  assert.equal(taskR.data.dashboardChanged, true);
  assert.ok(taskR.data.venture.tasks.some(t => t.text.includes('leads chauds')));
  const taskId = taskR.data.venture.tasks[0].id;
  const toggled = await call(base, 'POST', `/api/ventures/${venture.id}/tasks/${taskId}/toggle`, {});
  assert.equal(toggled.data.task.done, true);

  // §12 — P&L conversationnel
  const pnlR = await call(base, 'POST', `/api/ventures/${venture.id}/chat`, { text: 'J’ai gagné 500$ sur le mandat clinique' });
  assert.equal(pnlR.data.dashboardChanged, true);
  assert.equal(pnlR.data.venture.pnlLog[0].amount, 500);
  const pnlR2 = await call(base, 'POST', `/api/ventures/${venture.id}/chat`, { text: 'Perte de 200$ sur les pubs' });
  assert.equal(pnlR2.data.venture.pnlLog[1].amount, -200);

  // §10 — Build a report
  const report = await call(base, 'POST', `/api/ventures/${venture.id}/chat`, { text: 'Build a report' });
  assert.match(report.data.reply, /Rapport/);
  assert.match(report.data.reply, /P&L/);

  // §10 — Find the bottleneck
  const bn = await call(base, 'POST', `/api/ventures/${venture.id}/chat`, { text: 'Find the bottleneck' });
  assert.match(bn.data.reply, /Bottleneck/i);

  // §15 — Empire Overview
  const empire = await call(base, 'GET', '/api/empire');
  assert.equal(empire.data.ventures.length, 1);
  assert.equal(empire.data.totalPnlMonth, 300);
  assert.ok(empire.data.recommendation.length > 5);

  // Interview (Chemin B)
  const interview = await call(base, 'GET', '/api/interview');
  assert.ok(interview.data.length >= 5);
  const draft = await call(base, 'POST', '/api/ventures/draft', {
    answers: { vision: 'Boutique en ligne de jouets pour chiens', money: 'vente en ligne', goal: '10 000$/mois' },
  });
  assert.match(draft.data.masterplan, /## Vision/);
  assert.ok(draft.data.analysis.recommendedViews.length > 3);

  // Suppression
  const del = await call(base, 'DELETE', `/api/ventures/${venture.id}`);
  assert.equal(del.status, 200);
  assert.deepEqual((await call(base, 'GET', '/api/ventures')).data, []);

  // UI servie
  const ui = await fetch(base + '/');
  assert.match(await ui.text(), /TRILLION/);
  // Statut moteur
  const status = await call(base, 'GET', '/api/status');
  assert.ok('claude' in status.data);
});
