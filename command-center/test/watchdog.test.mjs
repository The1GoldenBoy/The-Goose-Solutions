// Watchdog : stale, escalade à Max, failover Goose → Maverick (§Watchdog + §Goose Backup).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Store } from '../lib/store.mjs';
import { Engine } from '../lib/engine.mjs';
import { Watchdog } from '../lib/watchdog.mjs';
import { seedAgents } from '../lib/seed.mjs';

async function setup() {
  const dir = await mkdtemp(join(tmpdir(), 'cc-wd-'));
  const store = new Store(join(dir, 'state'));
  await store.init();
  await store.saveAgents(seedAgents());
  const engine = new Engine(store);
  return { store, engine, watchdog: new Watchdog(engine), dir };
}

async function makeWorkingTask(engine) {
  const task = await engine.createTask({ actorId: 'goose', title: 'w', board: 'factory' });
  const spec = await engine.createSpec({ actorId: 'goose', summary: 's', doneDefinition: 'd', requiredProof: ['p'] });
  await engine.attachSpec({ taskId: task.id, specId: spec.id });
  await engine.startTask({ actorId: 'worker2', taskId: task.id });
  return engine.getTask(task.id);
}

test('tâche sans update au-delà du seuil → stale, puis escalade à Max', async (t) => {
  const { store, engine, watchdog, dir } = await setup();
  t.after(() => rm(dir, { recursive: true, force: true }));
  const task = await makeWorkingTask(engine);

  // Rien ne se passe à l'intérieur du seuil
  let scan = await watchdog.scan(new Date(Date.parse(task.lastUpdateAt) + 60 * 60 * 1000)); // +1 h
  assert.ok(scan.findings.ok.includes(task.id));
  assert.equal(scan.findings.stale.length, 0);

  // +3 h > seuil 120 min → stale + notification directeur
  scan = await watchdog.scan(new Date(Date.parse(task.lastUpdateAt) + 3 * 60 * 60 * 1000));
  assert.ok(scan.findings.stale.includes(task.id));
  const types = (await store.recentEvents()).map(e => e.type);
  assert.ok(types.includes('stale_detected'));
  assert.ok(types.includes('director_notified'));

  // +8 h → stale depuis > 240 min → escalade Max
  scan = await watchdog.scan(new Date(Date.parse(task.lastUpdateAt) + 8 * 60 * 60 * 1000));
  assert.ok(scan.findings.escalated.includes(task.id));
  assert.ok((await store.recentEvents()).some(e => e.type === 'escalated' && e.to === 'max'));
});

test('une tâche stale peut repartir (start) et redevient saine', async (t) => {
  const { engine, watchdog, dir } = await setup();
  t.after(() => rm(dir, { recursive: true, force: true }));
  const task = await makeWorkingTask(engine);
  await watchdog.scan(new Date(Date.parse(task.lastUpdateAt) + 3 * 60 * 60 * 1000));
  assert.equal((await engine.getTask(task.id)).status, 'stale');
  await engine.startTask({ actorId: 'worker2', taskId: task.id });
  const revived = await engine.getTask(task.id);
  assert.equal(revived.status, 'working');
  assert.equal(revived.staleSince, null);
});

test('Goose silencieux → failover Maverick, Goose revient → restauration', async (t) => {
  const { store, engine, watchdog, dir } = await setup();
  t.after(() => rm(dir, { recursive: true, force: true }));

  const agents = await store.agents();
  const goose = agents.find(a => a.id === 'goose');
  goose.lastUpdateAt = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // silencieux 1 h > 30 min
  await store.saveAgents(agents);

  let scan = await watchdog.scan();
  assert.equal(scan.director.activeDirector, 'maverick');
  assert.ok((await store.recentEvents()).some(e => e.type === 'director_failover'));

  // Maverick peut maintenant diriger
  const task = await engine.createTask({ actorId: 'maverick', title: 'relève', board: 'office' });
  assert.equal(task.status, 'spec');

  // Goose revient (heartbeat) → il reprend la direction
  await engine.agentHeartbeat({ agentId: 'goose', status: 'idle' });
  scan = await watchdog.scan();
  assert.equal(scan.director.activeDirector, 'goose');
  assert.ok((await store.recentEvents()).some(e => e.type === 'director_restored'));
});
