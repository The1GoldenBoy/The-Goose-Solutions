// Command Center — état initial : l'équipe complète du master plan (§3)
// et les tâches de la roadmap (§10) prêtes à être dirigées par Goose.
const now = () => new Date().toISOString();

export function seedAgents() {
  const base = { currentTaskId: null, progressPct: 0, lastUpdateAt: now(), blockedReason: null, risks: [], nextAction: null };
  return [
    { id: 'goose', name: 'Goose', role: 'Directeur principal — spec, validation, rapports FR', model: 'claude-opus', status: 'idle', ...base },
    { id: 'maverick', name: 'Maverick', role: 'Backup directeur — continuité si Goose absent', model: 'claude-opus', status: 'idle', ...base },
    { id: 'ulysse', name: 'Ulysse', role: 'Accélérateur — parallélisation, tâches mémoire-lourdes', model: 'gpt-5.2', status: 'idle', ...base },
    { id: 'worker1', name: 'Worker 1', role: 'Office executor — revenu, leads, calls, follow-ups', model: 'mini', status: 'idle', ...base },
    { id: 'worker2', name: 'Worker 2', role: 'Factory executor — bots, automations, scripts', model: 'mini', status: 'idle', ...base },
    { id: 'worker3', name: 'Worker 3', role: 'Memory executor — Obsidian, archivage, docs', model: 'mini', status: 'idle', ...base },
    { id: 'doctor1', name: 'Doctor 1', role: 'Réparation principale — repair first, reboot last', model: 'mini', status: 'idle', ...base },
    { id: 'doctor2', name: 'Doctor 2', role: 'Réparation backup', model: 'mini', status: 'idle', ...base },
    { id: 'hermes', name: 'Hermes', role: 'Support technique — monitoring, help routing', model: 'mini', status: 'idle', ...base },
    { id: 'max', name: 'Max', role: 'Pilote humain — priorités, approbation, override', model: 'humain', status: 'idle', ...base },
  ];
}

// Tâches initiales tirées de la roadmap §10 du master plan.
export function seedTasks() {
  const t = (id, title, board, ownerId, nextAction) => ({
    id, title, board, priority: 'normal', status: 'spec', ownerId, progressPct: 0,
    nextAction, specId: null, executionIds: [], validationId: null, archiveFile: null,
    blockedReason: null, staleSince: null, escalatedAt: null,
    createdAt: now(), lastUpdateAt: now(), dueAt: null,
  });
  return [
    t('T-PH1-MAVERICK', 'Phase 1 — Créer Maverick et la logique de handoff', 'factory', 'worker2', 'Écrire la spec du failover directeur'),
    t('T-PH2-WORKERS', 'Phase 2 — Instancier Worker 1, 2, 3 sur leurs lanes', 'factory', 'worker2', 'Spec des lanes et modèles par worker'),
    t('T-PH3-WATCHDOG', 'Phase 3 — Moteur de tâches + watchdog stale', 'factory', 'worker2', 'Brancher le cron watchdog'),
    t('T-PH4-MEETING', 'Phase 4 — Meeting Room UI avec lanes live', 'factory', 'worker2', 'Étendre le dashboard existant'),
    t('T-PH6-LEADS', 'Phase 6 — Production : premiers leads MTLI traités', 'office', 'worker1', 'Importer la liste de leads et scorer'),
    t('T-MEM-SYNC', 'Sync mémoire — promotion daily notes vers long-terme', 'memory', 'worker3', 'Définir le cycle de promotion'),
  ];
}
