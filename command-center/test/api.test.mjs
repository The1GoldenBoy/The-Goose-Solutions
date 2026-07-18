// Intégration HTTP : cycle complet via l'API + rapport français + mémoire.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createApp } from '../server.mjs';

async function startServer() {
  const dir = await mkdtemp(join(tmpdir(), 'cc-api-'));
  const app = await createApp({ stateDir: join(dir, 'state'), watchdogIntervalMs: 0 });
  await new Promise(res => app.server.listen(0, '127.0.0.1', res));
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

test('API: seed, cycle complet, rapport FR, archive lisible', async (t) => {
  const { app, base, dir } = await startServer();
  t.after(async () => { app.close(); await rm(dir, { recursive: true, force: true }); });

  // Seed automatique: 10 agents du master plan + tâches roadmap
  const snap = (await call(base, 'GET', '/api/snapshot')).data;
  assert.equal(snap.agents.length, 10);
  assert.deepEqual(snap.agents.map(a => a.id).sort(), ['doctor1', 'doctor2', 'goose', 'hermes', 'maverick', 'max', 'ulysse', 'worker1', 'worker2', 'worker3']);
  assert.ok(snap.tasks.length >= 6);

  // healthz
  assert.equal((await call(base, 'GET', '/healthz')).data.ok, true);

  // Cycle complet par HTTP
  const task = (await call(base, 'POST', '/api/tasks', { actorId: 'goose', title: 'API e2e', board: 'factory' })).data;
  const noSpec = await call(base, 'POST', `/api/tasks/${task.id}/start`, { actorId: 'worker2' });
  assert.equal(noSpec.status, 400); // vérité: pas d'exécution sans spec

  const spec = (await call(base, 'POST', '/api/specs', { actorId: 'goose', taskId: task.id, summary: 's', doneDefinition: 'd', requiredProof: ['p'] })).data;
  await call(base, 'POST', `/api/tasks/${task.id}/spec`, { specId: spec.id });
  assert.equal((await call(base, 'POST', `/api/tasks/${task.id}/start`, { actorId: 'worker2' })).status, 200);
  await call(base, 'POST', `/api/tasks/${task.id}/progress`, { actorId: 'worker2', progressPct: 50 });
  await call(base, 'POST', `/api/tasks/${task.id}/proof`, { actorId: 'worker2', resultSummary: 'ok', proofLinks: ['x://p'] });
  const val = await call(base, 'POST', `/api/tasks/${task.id}/validate`, { actorId: 'goose', verdict: 'approved' });
  assert.equal(val.data.task.status, 'done');
  const arch = await call(base, 'POST', `/api/tasks/${task.id}/archive`, { actorId: 'goose' });
  assert.equal(arch.data.status, 'archived');

  // Mémoire: l'archive existe et se lit par l'API
  const archives = (await call(base, 'GET', '/api/archive')).data;
  assert.equal(archives.length, 1);
  const note = (await call(base, 'GET', `/api/archive/${encodeURIComponent(archives[0])}`)).data;
  assert.match(note.content, /API e2e/);

  // Rapport français
  const rep = (await call(base, 'POST', '/api/reports', { force: true })).data;
  assert.equal(rep.written, true);
  const repContent = (await call(base, 'GET', `/api/reports/${encodeURIComponent(rep.fileName)}`)).data;
  assert.match(repContent.content, /# Rapport Goose/);
  assert.match(repContent.content, /Directeur actif/);
  assert.match(repContent.content, /Métriques par vue/);

  // Watchdog joignable
  const wd = (await call(base, 'GET', '/api/watchdog/status')).data;
  assert.ok(wd.findings);
  assert.equal(wd.director.activeDirector, 'goose');

  // Événements traçés
  const evts = (await call(base, 'GET', '/api/events/recent')).data;
  const types = evts.map(e => e.type);
  for (const required of ['task_assigned', 'spec_created', 'task_started', 'proof_submitted', 'validated', 'archived', 'report_generated']) {
    assert.ok(types.includes(required), `événement manquant: ${required}`);
  }

  // UI servie
  const ui = await fetch(base + '/');
  assert.equal(ui.status, 200);
  assert.match(await ui.text(), /Goose Command Center/);
});

test('API: heartbeat agent + rapport silencieux au repos', async (t) => {
  const { app, base, dir } = await startServer();
  t.after(async () => { app.close(); await rm(dir, { recursive: true, force: true }); });

  const hb = await call(base, 'POST', '/api/agents/goose/heartbeat', { status: 'working' });
  assert.equal(hb.data.agent.status, 'working');
  assert.equal((await call(base, 'POST', '/api/agents/inconnu/heartbeat', {})).status, 404);

  // Règle §8: pas de rapport écrit si aucun travail actif (sans force)
  await call(base, 'POST', '/api/agents/goose/heartbeat', { status: 'idle' });
  const rep = (await call(base, 'POST', '/api/reports', {})).data;
  assert.equal(rep.written, false);
  assert.match(rep.reason, /silence/);
});
