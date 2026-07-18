#!/usr/bin/env node
// goosectl — CLI pour les agents (Goose, workers, doctors) : pilote l'API du Command Center.
// Usage: node bin/goosectl.mjs <commande> [options JSON]
//   node bin/goosectl.mjs snapshot
//   node bin/goosectl.mjs spec '{"actorId":"goose","taskId":"T-...","summary":"...","doneDefinition":"...","requiredProof":["..."]}'
//   node bin/goosectl.mjs task '{"actorId":"goose","title":"...","board":"factory"}'
//   node bin/goosectl.mjs start T-xxx worker2
//   node bin/goosectl.mjs progress T-xxx worker2 45 "prochaine action"
//   node bin/goosectl.mjs proof T-xxx worker2 "résumé" "lien-de-preuve"
//   node bin/goosectl.mjs validate T-xxx approved
//   node bin/goosectl.mjs archive T-xxx
//   node bin/goosectl.mjs heartbeat goose working
//   node bin/goosectl.mjs scan | report | events

const BASE = process.env.CC_URL || 'http://127.0.0.1:7777';

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { console.error('ERREUR:', data.error || res.status); process.exit(1); }
  return data;
}

const [cmd, ...args] = process.argv.slice(2);
const j = (s) => JSON.parse(s);
const out = (o) => console.log(JSON.stringify(o, null, 2));

switch (cmd) {
  case 'snapshot': out(await call('GET', '/api/snapshot')); break;
  case 'events': out(await call('GET', '/api/events/recent?limit=40')); break;
  case 'scan': out(await call('POST', '/api/watchdog/scan', {})); break;
  case 'report': out(await call('POST', '/api/reports', { force: true })); break;
  case 'spec': out(await call('POST', '/api/specs', j(args[0]))); break;
  case 'task': out(await call('POST', '/api/tasks', j(args[0]))); break;
  case 'attach-spec': out(await call('POST', `/api/tasks/${args[0]}/spec`, { specId: args[1] })); break;
  case 'start': out(await call('POST', `/api/tasks/${args[0]}/start`, { actorId: args[1] || 'goose' })); break;
  case 'progress': out(await call('POST', `/api/tasks/${args[0]}/progress`, { actorId: args[1], progressPct: Number(args[2]), nextAction: args[3] })); break;
  case 'block': out(await call('POST', `/api/tasks/${args[0]}/block`, { actorId: args[1], reason: args[2] })); break;
  case 'unblock': out(await call('POST', `/api/tasks/${args[0]}/unblock`, { actorId: args[1] })); break;
  case 'proof': out(await call('POST', `/api/tasks/${args[0]}/proof`, { actorId: args[1], resultSummary: args[2], proofLinks: [args[3]] })); break;
  case 'validate': out(await call('POST', `/api/tasks/${args[0]}/validate`, { actorId: args[2] || 'goose', verdict: args[1], notes: args[3] || '' })); break;
  case 'archive': out(await call('POST', `/api/tasks/${args[0]}/archive`, { actorId: args[1] || 'goose' })); break;
  case 'heartbeat': out(await call('POST', `/api/agents/${args[0]}/heartbeat`, { status: args[1] })); break;
  default:
    console.log('Commandes: snapshot | events | scan | report | spec | task | attach-spec | start | progress | block | unblock | proof | validate | archive | heartbeat');
    process.exit(cmd ? 1 : 0);
}
