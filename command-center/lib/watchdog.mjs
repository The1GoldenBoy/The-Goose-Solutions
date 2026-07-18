// Command Center — Completion Watchdog (§2 Vue 4 + §Watchdog Rule du master plan).
// Empêche les fausses complétions : détecte les tâches stales, exige la visibilité,
// escalade à Max, et bascule la direction sur Maverick si Goose est silencieux.
const MIN = 60 * 1000;

export class Watchdog {
  /** @param {import('./engine.mjs').Engine} engine */
  constructor(engine) {
    this.engine = engine;
    this.store = engine.store;
    this.timer = null;
  }

  start(intervalMs = 60 * 1000) {
    this.stop();
    this.timer = setInterval(() => this.scan().catch(() => {}), intervalMs);
    this.timer.unref?.();
  }

  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; }

  // Un passage de surveillance. Retourne le constat complet (utilisé par la vue Watchdog).
  async scan(nowDate = new Date()) {
    const config = await this.store.config();
    const tasks = await this.store.tasks();
    const nowMs = nowDate.getTime();
    const staleMs = config.staleAfterMinutes * MIN;
    const escalMs = config.escalationAfterMinutes * MIN;

    const findings = { stale: [], escalated: [], blocked: [], awaitingValidation: [], awaitingArchive: [], ok: [] };
    let dirty = false;

    for (const task of tasks) {
      if (['archived'].includes(task.status)) continue;
      const age = nowMs - Date.parse(task.lastUpdateAt);

      if (task.status === 'blocked') findings.blocked.push(task.id);
      if (task.status === 'review') findings.awaitingValidation.push(task.id);
      if (task.status === 'done') findings.awaitingArchive.push(task.id);

      const active = ['working', 'blocked', 'review', 'spec'].includes(task.status);
      if (active && age > staleMs) {
        if (task.status !== 'stale') {
          task.previousStatus = task.status;
          task.status = 'stale';
          task.staleSince = new Date(nowMs - age + staleMs).toISOString();
          dirty = true;
          await this.store.appendEvent({ type: 'stale_detected', taskId: task.id, ownerId: task.ownerId, ageMinutes: Math.round(age / MIN) });
          await this.store.appendEvent({ type: 'director_notified', taskId: task.id, director: (await this.store.system()).activeDirector });
        }
      }

      if (task.status === 'stale') {
        findings.stale.push(task.id);
        const staleAge = task.staleSince ? nowMs - Date.parse(task.staleSince) : age;
        if (staleAge > escalMs && !task.escalatedAt) {
          task.escalatedAt = new Date(nowMs).toISOString();
          dirty = true;
          await this.store.appendEvent({ type: 'escalated', taskId: task.id, to: 'max', reason: `stale depuis ${Math.round(staleAge / MIN)} min` });
        }
        if (task.escalatedAt) findings.escalated.push(task.id);
      } else if (active) {
        findings.ok.push(task.id);
      }
    }

    if (dirty) await this.store.saveTasks(tasks);
    const director = await this.#checkDirector(nowDate, config);
    return { at: nowDate.toISOString(), config, findings, director };
  }

  // §Goose Backup : si Goose est absent/cassé/silencieux → Maverick prend le relais.
  // Goose redevenu vivant → il reprend la direction.
  async #checkDirector(nowDate, config) {
    const agents = await this.store.agents();
    const system = await this.store.system();
    const goose = agents.find(a => a.id === 'goose');
    const nowMs = nowDate.getTime();
    const failMs = config.directorFailoverMinutes * MIN;

    const gooseDown = !goose
      || ['broken', 'offline'].includes(goose.status)
      || (nowMs - Date.parse(goose.lastUpdateAt)) > failMs;

    if (gooseDown && system.activeDirector !== 'maverick') {
      system.activeDirector = 'maverick';
      system.failoverAt = nowDate.toISOString();
      await this.store.saveSystem(system);
      await this.store.appendEvent({ type: 'director_failover', from: 'goose', to: 'maverick', reason: goose ? goose.status : 'goose introuvable' });
    } else if (!gooseDown && system.activeDirector !== 'goose') {
      system.activeDirector = 'goose';
      system.failoverAt = null;
      await this.store.saveSystem(system);
      await this.store.appendEvent({ type: 'director_restored', from: 'maverick', to: 'goose' });
    }
    return { activeDirector: (await this.store.system()).activeDirector, gooseDown };
  }
}
