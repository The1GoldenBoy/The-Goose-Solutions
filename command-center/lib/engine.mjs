// Command Center — moteur de tâches.
// Implémente le cycle complet du master plan §4 :
// SPEC → ASSIGN → EXECUTE → PROOF → VALIDATE → ARCHIVE, surveillé par le Watchdog.
// Règles de vérité (§ Completion Rule) : jamais de done sans spec + exécution + preuve + validation,
// jamais d'archive sans done. Toute transition émet un événement.
import { randomUUID } from 'node:crypto';

export const BOARDS = ['office', 'factory', 'meeting', 'memory'];
export const TASK_STATUSES = ['spec', 'working', 'blocked', 'review', 'done', 'archived', 'stale'];
export const AGENT_STATUSES = ['idle', 'working', 'blocked', 'broken', 'offline', 'moving', 'done'];
export const DIRECTORS = ['goose', 'maverick'];

// §7 Routing rules — owner par défaut selon le board.
export const DEFAULT_ROUTING = { office: 'worker1', factory: 'worker2', memory: 'worker3', meeting: 'hermes' };

export class EngineError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

const now = () => new Date().toISOString();
const shortId = (prefix) => `${prefix}-${randomUUID().slice(0, 8)}`;

export class Engine {
  /** @param {import('./store.mjs').Store} store */
  constructor(store, { onEvent } = {}) {
    this.store = store;
    this.onEvent = onEvent || (() => {});
  }

  async #emit(type, payload) {
    const evt = await this.store.appendEvent({ type, ...payload });
    try { this.onEvent(evt); } catch { /* les listeners ne cassent pas le moteur */ }
    return evt;
  }

  async #requireAgent(agentId) {
    const agents = await this.store.agents();
    const agent = agents.find(a => a.id === agentId);
    if (!agent) throw new EngineError(`agent inconnu: ${agentId}`, 404);
    return agent;
  }

  async #requireDirector(actorId) {
    const system = await this.store.system();
    if (!DIRECTORS.includes(actorId)) {
      throw new EngineError(`seul un directeur (goose/maverick) peut faire ça, pas: ${actorId}`, 403);
    }
    if (actorId === 'maverick' && system.activeDirector !== 'maverick') {
      throw new EngineError('Maverick ne dirige que quand Goose est absent (failover actif requis)', 403);
    }
    return actorId;
  }

  // ---- SPEC (§4.1) — Goose écrit la spec avant toute exécution ----
  async createSpec({ actorId = 'goose', taskId = null, summary, acceptanceCriteria = [], risks = [], requiredProof = [], doneDefinition }) {
    await this.#requireDirector(actorId);
    if (!summary || !doneDefinition) throw new EngineError('spec incomplète: summary et doneDefinition requis');
    if (!requiredProof.length) throw new EngineError('spec incomplète: au moins une preuve requise (requiredProof)');
    const specs = await this.store.specs();
    const spec = {
      id: shortId('SPEC'), taskId, summary,
      acceptanceCriteria, risks, requiredProof, doneDefinition,
      createdAt: now(), createdBy: actorId,
    };
    specs.push(spec);
    await this.store.saveSpecs(specs);
    await this.#emit('spec_created', { specId: spec.id, taskId, by: actorId });
    return spec;
  }

  // ---- Création + ASSIGN (§4.2) ----
  async createTask({ actorId = 'goose', title, board, ownerId = null, specId = null, dueAt = null, nextAction = '', priority = 'normal' }) {
    await this.#requireDirector(actorId);
    if (!title) throw new EngineError('title requis');
    if (!BOARDS.includes(board)) throw new EngineError(`board invalide: ${board} (${BOARDS.join('|')})`);
    const owner = ownerId || DEFAULT_ROUTING[board];
    await this.#requireAgent(owner);
    if (specId) await this.#requireSpec(specId);
    const tasks = await this.store.tasks();
    const task = {
      id: shortId('T'), title, board, priority,
      status: 'spec', ownerId: owner, progressPct: 0,
      nextAction: nextAction || 'Écrire/lier la spec puis démarrer',
      specId, executionIds: [], validationId: null, archiveFile: null,
      blockedReason: null, staleSince: null, escalatedAt: null,
      createdAt: now(), lastUpdateAt: now(), dueAt,
    };
    tasks.push(task);
    await this.store.saveTasks(tasks);
    await this.#emit('task_assigned', { taskId: task.id, ownerId: owner, board, by: actorId });
    return task;
  }

  async #requireSpec(specId) {
    const specs = await this.store.specs();
    const spec = specs.find(s => s.id === specId);
    if (!spec) throw new EngineError(`spec inconnue: ${specId}`, 404);
    return spec;
  }

  async #withTask(taskId, fn) {
    const tasks = await this.store.tasks();
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx < 0) throw new EngineError(`tâche inconnue: ${taskId}`, 404);
    const updated = await fn(tasks[idx]);
    updated.lastUpdateAt = now();
    tasks[idx] = updated;
    await this.store.saveTasks(tasks);
    return updated;
  }

  async getTask(taskId) {
    const tasks = await this.store.tasks();
    const task = tasks.find(t => t.id === taskId);
    if (!task) throw new EngineError(`tâche inconnue: ${taskId}`, 404);
    return task;
  }

  async assignTask({ actorId = 'goose', taskId, ownerId }) {
    await this.#requireDirector(actorId);
    await this.#requireAgent(ownerId);
    const task = await this.#withTask(taskId, t => {
      if (['done', 'archived'].includes(t.status)) throw new EngineError('impossible de réassigner une tâche terminée');
      return { ...t, ownerId };
    });
    await this.#emit('task_assigned', { taskId, ownerId, by: actorId });
    return task;
  }

  async attachSpec({ taskId, specId }) {
    const spec = await this.#requireSpec(specId);
    const task = await this.#withTask(taskId, t => ({ ...t, specId }));
    const specs = await this.store.specs();
    const idx = specs.findIndex(s => s.id === specId);
    specs[idx] = { ...spec, taskId };
    await this.store.saveSpecs(specs);
    return task;
  }

  // ---- EXECUTE (§4.3) — règle: pas d'exécution sans spec ----
  async startTask({ actorId, taskId }) {
    const task = await this.getTask(taskId);
    if (!task.specId) throw new EngineError('règle de vérité: pas d’exécution sans spec (attacher une spec d’abord)');
    if (actorId !== task.ownerId && !DIRECTORS.includes(actorId)) {
      throw new EngineError(`seul l’owner (${task.ownerId}) ou un directeur peut démarrer cette tâche`, 403);
    }
    const updated = await this.#withTask(taskId, t => {
      if (!['spec', 'blocked', 'stale', 'review'].includes(t.status)) {
        throw new EngineError(`transition invalide: ${t.status} → working`);
      }
      return { ...t, status: 'working', blockedReason: null, staleSince: null };
    });
    await this.#setAgentWorking(task.ownerId, taskId);
    await this.#emit('task_started', { taskId, by: actorId });
    return updated;
  }

  async updateProgress({ actorId, taskId, progressPct, nextAction }) {
    const updated = await this.#withTask(taskId, t => {
      if (!['working', 'blocked'].includes(t.status)) throw new EngineError(`progression seulement en working/blocked (statut: ${t.status})`);
      const pct = Math.max(0, Math.min(99, Number(progressPct))); // 100% passe par preuve+validation, jamais par un simple update
      return { ...t, progressPct: pct, nextAction: nextAction ?? t.nextAction, staleSince: null };
    });
    await this.#touchAgent(actorId, { progressPct: updated.progressPct, nextAction: updated.nextAction });
    await this.#emit('task_update', { taskId, progressPct: updated.progressPct, by: actorId });
    return updated;
  }

  async blockTask({ actorId, taskId, reason }) {
    if (!reason) throw new EngineError('règle de vérité: un blocage doit être explicite (reason requis)');
    const updated = await this.#withTask(taskId, t => ({ ...t, status: 'blocked', blockedReason: reason }));
    await this.#touchAgent(updated.ownerId, { status: 'blocked', blockedReason: reason });
    await this.#emit('task_blocked', { taskId, reason, by: actorId });
    return updated;
  }

  async unblockTask({ actorId, taskId, nextAction }) {
    const updated = await this.#withTask(taskId, t => {
      if (t.status !== 'blocked') throw new EngineError('la tâche n’est pas bloquée');
      return { ...t, status: 'working', blockedReason: null, nextAction: nextAction ?? t.nextAction };
    });
    await this.#touchAgent(updated.ownerId, { status: 'working', blockedReason: null });
    await this.#emit('task_unblocked', { taskId, by: actorId });
    return updated;
  }

  async requestHelp({ actorId, taskId, question }) {
    if (!question) throw new EngineError('question requise');
    await this.getTask(taskId);
    return this.#emit('help_requested', { taskId, question, by: actorId });
  }

  // ---- PROOF (§4.4) — l'agent dépose la preuve ----
  async submitProof({ actorId, taskId, actionTaken, filesChanged = [], resultSummary, proofLinks = [] }) {
    const task = await this.getTask(taskId);
    if (actorId !== task.ownerId && !DIRECTORS.includes(actorId)) {
      throw new EngineError(`seul l’owner (${task.ownerId}) peut déposer la preuve`, 403);
    }
    if (!resultSummary) throw new EngineError('resultSummary requis');
    if (!proofLinks.length && !filesChanged.length) {
      throw new EngineError('règle de vérité: une preuve tangible est requise (proofLinks ou filesChanged)');
    }
    const executions = await this.store.executions();
    const exec = {
      id: shortId('EXEC'), taskId, actionTaken: actionTaken || resultSummary,
      filesChanged, resultSummary, proofLinks,
      createdAt: now(), createdBy: actorId,
    };
    executions.push(exec);
    await this.store.saveExecutions(executions);
    const updated = await this.#withTask(taskId, t => {
      if (!['working', 'blocked', 'stale', 'review'].includes(t.status)) {
        throw new EngineError(`preuve refusée au statut ${t.status}`);
      }
      return { ...t, status: 'review', executionIds: [...t.executionIds, exec.id], progressPct: Math.max(t.progressPct, 90), nextAction: 'Validation Goose' };
    });
    await this.#emit('proof_submitted', { taskId, executionId: exec.id, by: actorId });
    return { task: updated, execution: exec };
  }

  // ---- VALIDATE (§4.5) — Goose vérifie contre la spec ----
  async validateTask({ actorId = 'goose', taskId, verdict, notes = '', missingItems = [] }) {
    await this.#requireDirector(actorId);
    if (!['approved', 'rejected', 'needs_changes'].includes(verdict)) {
      throw new EngineError('verdict invalide (approved|rejected|needs_changes)');
    }
    const task = await this.getTask(taskId);
    if (task.status !== 'review') throw new EngineError(`validation seulement en review (statut: ${task.status})`);
    if (!task.specId) throw new EngineError('règle de vérité: pas de done sans spec');
    if (!task.executionIds.length) throw new EngineError('règle de vérité: pas de done sans preuve d’exécution');
    const validations = await this.store.validations();
    const validation = {
      id: shortId('VAL'), taskId, verdict,
      checkedAgainstSpec: task.specId, missingItems, notes,
      validatedAt: now(), validatedBy: actorId,
    };
    validations.push(validation);
    await this.store.saveValidations(validations);
    const updated = await this.#withTask(taskId, t => {
      if (verdict === 'approved') {
        return { ...t, status: 'done', validationId: validation.id, progressPct: 100, nextAction: 'Archiver dans Obsidian' };
      }
      return { ...t, status: 'working', validationId: null, nextAction: notes || 'Changements demandés par le directeur' };
    });
    await this.#emit('validated', { taskId, verdict, validationId: validation.id, by: actorId });
    if (verdict === 'approved') await this.#setAgentIdle(task.ownerId);
    return { task: updated, validation };
  }

  // ---- ARCHIVE (§4.6) — résultat + décision + preuve préservés dans la mémoire ----
  async archiveTask({ actorId = 'goose', taskId }) {
    await this.#requireDirector(actorId);
    const task = await this.getTask(taskId);
    if (task.status !== 'done') throw new EngineError('règle de vérité: pas d’archive sans done (validation approuvée requise)');
    const [specs, executions, validations] = await Promise.all([
      this.store.specs(), this.store.executions(), this.store.validations(),
    ]);
    const spec = specs.find(s => s.id === task.specId);
    const execs = executions.filter(e => task.executionIds.includes(e.id));
    const validation = validations.find(v => v.id === task.validationId);
    const stamp = now().replace(/[:]/g, '-').slice(0, 19);
    const fileName = `${stamp}-${task.id}.md`;
    const md = [
      `# Archive — ${task.title}`,
      '',
      `- Tâche: ${task.id} (${task.board})`,
      `- Owner: ${task.ownerId}`,
      `- Archivée le: ${now()} par ${actorId}`,
      '',
      '## Spec',
      `- Résumé: ${spec?.summary ?? '—'}`,
      `- Definition of Done: ${spec?.doneDefinition ?? '—'}`,
      ...(spec?.acceptanceCriteria?.length ? ['- Critères:', ...spec.acceptanceCriteria.map(c => `  - ${c}`)] : []),
      '',
      '## Exécution / Preuves',
      ...execs.flatMap(e => [
        `- ${e.createdAt} — ${e.createdBy}: ${e.resultSummary}`,
        ...e.proofLinks.map(p => `  - preuve: ${p}`),
        ...e.filesChanged.map(f => `  - fichier: ${f}`),
      ]),
      '',
      '## Validation',
      `- Verdict: ${validation?.verdict ?? '—'} par ${validation?.validatedBy ?? '—'} le ${validation?.validatedAt ?? '—'}`,
      ...(validation?.notes ? [`- Notes: ${validation.notes}`] : []),
      '',
    ].join('\n');
    await this.store.writeArchiveNote(fileName, md);
    const updated = await this.#withTask(taskId, t => ({ ...t, status: 'archived', archiveFile: fileName, nextAction: '—' }));
    await this.#emit('archived', { taskId, archiveFile: fileName, by: actorId });
    return updated;
  }

  // ---- Agents ----
  async #mutateAgent(agentId, patch) {
    const agents = await this.store.agents();
    const idx = agents.findIndex(a => a.id === agentId);
    if (idx < 0) return null;
    agents[idx] = { ...agents[idx], ...patch, lastUpdateAt: now() };
    await this.store.saveAgents(agents);
    return agents[idx];
  }

  #setAgentWorking(agentId, taskId) { return this.#mutateAgent(agentId, { status: 'working', currentTaskId: taskId }); }
  #setAgentIdle(agentId) { return this.#mutateAgent(agentId, { status: 'idle', currentTaskId: null, progressPct: 0 }); }
  #touchAgent(agentId, patch = {}) { return this.#mutateAgent(agentId, patch); }

  async agentHeartbeat({ agentId, status, progressPct, nextAction, blockedReason = null }) {
    const agent = await this.#mutateAgent(agentId, {
      ...(status ? { status } : {}),
      ...(progressPct != null ? { progressPct: Number(progressPct) } : {}),
      ...(nextAction != null ? { nextAction } : {}),
      blockedReason,
    });
    if (!agent) throw new EngineError(`agent inconnu: ${agentId}`, 404);
    const evt = await this.#emit('agent_update', { agentId, status: agent.status });
    return { agent, event: evt };
  }
}
