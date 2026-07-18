// Règles de vérité du moteur (§Completion Rule du master plan).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Store } from '../lib/store.mjs';
import { Engine, EngineError } from '../lib/engine.mjs';
import { seedAgents } from '../lib/seed.mjs';

async function makeEngine() {
  const dir = await mkdtemp(join(tmpdir(), 'cc-engine-'));
  const store = new Store(join(dir, 'state'));
  await store.init();
  await store.saveAgents(seedAgents());
  return { engine: new Engine(store), store, dir };
}

test('cycle complet: spec → start → proof → validate → archive', async (t) => {
  const { engine, store, dir } = await makeEngine();
  t.after(() => rm(dir, { recursive: true, force: true }));

  const task = await engine.createTask({ actorId: 'goose', title: 'Test', board: 'factory' });
  assert.equal(task.status, 'spec');
  assert.equal(task.ownerId, 'worker2'); // routage §7

  // Règle: pas d'exécution sans spec
  await assert.rejects(engine.startTask({ actorId: 'worker2', taskId: task.id }), /pas d’exécution sans spec/);

  const spec = await engine.createSpec({ actorId: 'goose', taskId: task.id, summary: 's', doneDefinition: 'd', requiredProof: ['p'] });
  await engine.attachSpec({ taskId: task.id, specId: spec.id });
  await engine.startTask({ actorId: 'worker2', taskId: task.id });
  assert.equal((await engine.getTask(task.id)).status, 'working');

  // Progress jamais 100 par simple update
  const prog = await engine.updateProgress({ actorId: 'worker2', taskId: task.id, progressPct: 150 });
  assert.equal(prog.progressPct, 99);

  // Règle: preuve tangible obligatoire
  await assert.rejects(
    engine.submitProof({ actorId: 'worker2', taskId: task.id, resultSummary: 'fini' }),
    /preuve tangible/
  );
  await engine.submitProof({ actorId: 'worker2', taskId: task.id, resultSummary: 'fini', proofLinks: ['file://preuve'] });
  assert.equal((await engine.getTask(task.id)).status, 'review');

  // Règle: validation par directeur seulement
  await assert.rejects(engine.validateTask({ actorId: 'worker2', taskId: task.id, verdict: 'approved' }), EngineError);

  const { task: done } = await engine.validateTask({ actorId: 'goose', taskId: task.id, verdict: 'approved' });
  assert.equal(done.status, 'done');
  assert.equal(done.progressPct, 100);

  const archived = await engine.archiveTask({ actorId: 'goose', taskId: task.id });
  assert.equal(archived.status, 'archived');
  const files = await store.listArchive();
  assert.equal(files.length, 1);
  const content = await store.readArchiveNote(files[0]);
  assert.match(content, /## Spec/);
  assert.match(content, /## Exécution \/ Preuves/);
  assert.match(content, /## Validation/);
});

test('pas d’archive sans done, pas de validation sans preuve', async (t) => {
  const { engine, dir } = await makeEngine();
  t.after(() => rm(dir, { recursive: true, force: true }));

  const task = await engine.createTask({ actorId: 'goose', title: 'x', board: 'office' });
  await assert.rejects(engine.archiveTask({ actorId: 'goose', taskId: task.id }), /pas d’archive sans done/);

  const spec = await engine.createSpec({ actorId: 'goose', summary: 's', doneDefinition: 'd', requiredProof: ['p'] });
  await engine.attachSpec({ taskId: task.id, specId: spec.id });
  await engine.startTask({ actorId: 'worker1', taskId: task.id });
  // pas en review → refus
  await assert.rejects(engine.validateTask({ actorId: 'goose', taskId: task.id, verdict: 'approved' }), /seulement en review/);
});

test('needs_changes renvoie la tâche en working sans validation', async (t) => {
  const { engine, dir } = await makeEngine();
  t.after(() => rm(dir, { recursive: true, force: true }));

  const task = await engine.createTask({ actorId: 'goose', title: 'x', board: 'memory' });
  const spec = await engine.createSpec({ actorId: 'goose', summary: 's', doneDefinition: 'd', requiredProof: ['p'] });
  await engine.attachSpec({ taskId: task.id, specId: spec.id });
  await engine.startTask({ actorId: 'worker3', taskId: task.id });
  await engine.submitProof({ actorId: 'worker3', taskId: task.id, resultSummary: 'r', proofLinks: ['x'] });
  const { task: back } = await engine.validateTask({ actorId: 'goose', taskId: task.id, verdict: 'needs_changes', notes: 'manque un critère' });
  assert.equal(back.status, 'working');
  assert.equal(back.validationId, null);
  assert.equal(back.nextAction, 'manque un critère');
});

test('blocage explicite obligatoire + maverick refusé sans failover', async (t) => {
  const { engine, dir } = await makeEngine();
  t.after(() => rm(dir, { recursive: true, force: true }));

  const task = await engine.createTask({ actorId: 'goose', title: 'x', board: 'factory' });
  const spec = await engine.createSpec({ actorId: 'goose', summary: 's', doneDefinition: 'd', requiredProof: ['p'] });
  await engine.attachSpec({ taskId: task.id, specId: spec.id });
  await engine.startTask({ actorId: 'worker2', taskId: task.id });

  await assert.rejects(engine.blockTask({ actorId: 'worker2', taskId: task.id }), /blocage doit être explicite/);
  await engine.blockTask({ actorId: 'worker2', taskId: task.id, reason: 'attente accès API' });

  // Maverick ne dirige pas tant que Goose est actif
  await assert.rejects(engine.createTask({ actorId: 'maverick', title: 'y', board: 'office' }), /Goose est absent/);
  // Un worker ne dirige jamais
  await assert.rejects(engine.createTask({ actorId: 'worker1', title: 'y', board: 'office' }), /directeur/);
});
