// Command Center — rapports Goose en français (§Goose Reporting Format du master plan).
// Chaque rapport inclut : date/heure, agents actifs (tâche, %, next action, blocage, preuve),
// état de validation, stales, escalations, et métriques par board.

const STATUS_FR = {
  spec: 'en spec', working: 'en travail', blocked: 'bloquée', review: 'en validation',
  done: 'complétée', archived: 'archivée', stale: 'stale',
  idle: 'au repos', broken: 'cassé', offline: 'hors ligne', moving: 'en transition',
};

export function formatDateFR(d = new Date()) {
  return d.toLocaleString('fr-CA', { dateStyle: 'full', timeStyle: 'short', timeZone: 'America/Toronto' });
}

export async function buildReport(store, nowDate = new Date()) {
  const { agents, tasks, executions, validations, system } = await store.snapshot();

  const byId = (id) => tasks.find(t => t.id === id);
  const activeAgents = agents.filter(a => a.id !== 'max' && ['working', 'blocked', 'moving'].includes(a.status));
  const stales = tasks.filter(t => t.status === 'stale');
  const escalations = tasks.filter(t => t.escalatedAt && t.status !== 'archived');
  const blocked = tasks.filter(t => t.status === 'blocked');
  const inReview = tasks.filter(t => t.status === 'review');
  const doneNotArchived = tasks.filter(t => t.status === 'done');

  const metrics = {};
  for (const board of ['office', 'factory', 'meeting', 'memory']) {
    const bt = tasks.filter(t => t.board === board);
    metrics[board] = {
      total: bt.length,
      archived: bt.filter(t => t.status === 'archived').length,
      working: bt.filter(t => ['working', 'review'].includes(t.status)).length,
      blocked: bt.filter(t => t.status === 'blocked').length,
      stale: bt.filter(t => t.status === 'stale').length,
    };
  }

  const agentLine = (a) => {
    const t = a.currentTaskId ? byId(a.currentTaskId) : null;
    const proofState = t
      ? (t.executionIds.length ? `preuve déposée (${t.executionIds.length})` : 'preuve à venir')
      : '—';
    const validState = t
      ? (t.validationId ? 'validée' : (t.status === 'review' ? 'en attente de validation' : '—'))
      : '—';
    return [
      `### ${a.name} — ${STATUS_FR[a.status] ?? a.status}`,
      `- Tâche: ${t ? `${t.id} · ${t.title}` : 'aucune'}`,
      `- Avancement: ${t ? t.progressPct : a.progressPct ?? 0}%`,
      `- Prochaine action: ${t?.nextAction || a.nextAction || '—'}`,
      `- Blocage: ${t?.blockedReason || a.blockedReason || 'aucun'}`,
      `- Preuve: ${proofState}`,
      `- Validation: ${validState}`,
    ].join('\n');
  };

  const taskRef = (t) => `- ${t.id} · ${t.title} (owner: ${t.ownerId}, ${STATUS_FR[t.status]}${t.blockedReason ? `, blocage: ${t.blockedReason}` : ''})`;

  const md = [
    `# Rapport Goose — ${formatDateFR(nowDate)}`,
    '',
    `Directeur actif: **${system.activeDirector === 'goose' ? 'Goose' : 'Maverick (relève)'}**`,
    '',
    '## Agents actifs',
    activeAgents.length ? activeAgents.map(agentLine).join('\n\n') : '_Aucun agent actif — système au repos._',
    '',
    '## Tâches stales',
    stales.length ? stales.map(taskRef).join('\n') : '_Aucune tâche stale. Le système est vrai et en mouvement._',
    '',
    '## Escalations (Max doit voir)',
    escalations.length ? escalations.map(taskRef).join('\n') : '_Aucune escalation en cours._',
    '',
    '## En attente de validation directeur',
    inReview.length ? inReview.map(taskRef).join('\n') : '_Rien en attente._',
    '',
    '## Complétées à archiver',
    doneNotArchived.length ? doneNotArchived.map(taskRef).join('\n') : '_Rien à archiver._',
    '',
    '## Blocages explicites',
    blocked.length ? blocked.map(taskRef).join('\n') : '_Aucun blocage._',
    '',
    '## Métriques par vue',
    '| Vue | Tâches | En cours | Bloquées | Stales | Archivées |',
    '|-----|--------|----------|----------|--------|-----------|',
    ...Object.entries(metrics).map(([b, m]) => `| ${b} | ${m.total} | ${m.working} | ${m.blocked} | ${m.stale} | ${m.archived} |`),
    '',
    `_Preuves totales déposées: ${executions.length} · Validations rendues: ${validations.length}_`,
    '',
  ].join('\n');

  return { markdown: md, data: { activeAgents: activeAgents.length, stales: stales.length, escalations: escalations.length, metrics } };
}

// Règle §8 : rapport seulement quand il y a du travail actif ; silence quand idle.
export async function generateReport(store, { force = false } = {}) {
  const nowDate = new Date();
  const report = await buildReport(store, nowDate);
  const hasActivity = report.data.activeAgents > 0 || report.data.stales > 0 || report.data.escalations > 0;
  if (!hasActivity && !force) {
    return { written: false, reason: 'système au repos — silence (règle §8)', ...report };
  }
  const stamp = nowDate.toISOString().replace(/[:]/g, '-').slice(0, 19);
  const fileName = `RAPPORT-${stamp}.md`;
  await store.writeReport(fileName, report.markdown);
  await store.appendEvent({ type: 'report_generated', fileName });
  return { written: true, fileName, ...report };
}
