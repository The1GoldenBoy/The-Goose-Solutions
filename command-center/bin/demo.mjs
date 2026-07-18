// Démo — fait vivre le cycle complet du master plan sur un serveur local :
// spec → assign → execute → proof → validate → archive, puis rapport français.
// Usage: node bin/demo.mjs  (contre CC_URL ou http://127.0.0.1:7777)
const BASE = process.env.CC_URL || 'http://127.0.0.1:7777';

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method, headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path}: ${data.error || res.status}`);
  return data;
}

console.log('— Démo Command Center : cycle complet sur une tâche Office —');

const task = await call('POST', '/api/tasks', {
  actorId: 'goose', board: 'office', ownerId: 'worker1',
  title: 'Démo — appeler 5 leads MTLI et logger les résultats',
});
console.log('1. Tâche créée par Goose :', task.id);

const spec = await call('POST', '/api/specs', {
  actorId: 'goose', taskId: task.id,
  summary: '5 appels sortants sur les leads chauds MTLI, notes CRM à jour',
  acceptanceCriteria: ['5 appels complétés', 'notes CRM remplies', 'follow-ups programmés'],
  risks: ['leads injoignables'],
  requiredProof: ['export CRM des 5 fiches'],
  doneDefinition: '5 fiches CRM à jour avec issue de l’appel et prochaine étape',
});
await call('POST', `/api/tasks/${task.id}/spec`, { specId: spec.id });
console.log('2. Spec écrite et attachée :', spec.id);

await call('POST', `/api/tasks/${task.id}/start`, { actorId: 'worker1' });
console.log('3. Worker 1 démarre (refusé sans spec — règle de vérité)');

await call('POST', `/api/tasks/${task.id}/progress`, { actorId: 'worker1', progressPct: 60, nextAction: '2 derniers appels' });
console.log('4. Avancement 60 %');

const { execution } = await call('POST', `/api/tasks/${task.id}/proof`, {
  actorId: 'worker1',
  resultSummary: '5 appels faits : 2 rendez-vous pris, 3 follow-ups programmés',
  proofLinks: ['crm://export/leads-demo-5.csv'],
});
console.log('5. Preuve déposée :', execution.id);

await call('POST', `/api/tasks/${task.id}/validate`, { actorId: 'goose', verdict: 'approved', notes: 'Conforme à la spec.' });
console.log('6. Goose valide ✅');

const archived = await call('POST', `/api/tasks/${task.id}/archive`, { actorId: 'goose' });
console.log('7. Archivée dans la mémoire :', archived.archiveFile);

const report = await call('POST', '/api/reports', { force: true });
console.log('8. Rapport français généré :', report.fileName || report.reason);
console.log('\nOuvre le dashboard pour voir la vérité :', BASE);
