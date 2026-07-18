// Command Center — persistance plate (JSON + JSONL), zéro dépendance.
// Source de vérité: fichiers dans state/. Écritures atomiques (tmp → rename).
import { readFile, writeFile, appendFile, rename, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const DEFAULT_CONFIG = {
  staleAfterMinutes: 120,        // §Watchdog: pas d'update dans le délai → stale
  escalationAfterMinutes: 240,   // stale persistant → escalade à Max
  directorFailoverMinutes: 30,   // Goose silencieux → Maverick prend le relais
  reportLocale: 'fr-CA',
};

export class Store {
  constructor(stateDir, { archiveDir, reportsDir } = {}) {
    this.stateDir = resolve(stateDir);
    this.archiveDir = archiveDir ? resolve(archiveDir) : resolve(this.stateDir, '..', 'archive');
    this.reportsDir = reportsDir ? resolve(reportsDir) : resolve(this.stateDir, '..', 'reports');
    this.paths = {
      agents: join(this.stateDir, 'agents.json'),
      tasks: join(this.stateDir, 'tasks.json'),
      specs: join(this.stateDir, 'specs.json'),
      executions: join(this.stateDir, 'executions.json'),
      validations: join(this.stateDir, 'validations.json'),
      config: join(this.stateDir, 'config.json'),
      system: join(this.stateDir, 'system.json'),
      events: join(this.stateDir, 'events.jsonl'),
    };
  }

  async init() {
    await mkdir(this.stateDir, { recursive: true });
    await mkdir(this.archiveDir, { recursive: true });
    await mkdir(this.reportsDir, { recursive: true });
  }

  async #readJson(path, fallback) {
    try { return JSON.parse(await readFile(path, 'utf8')); }
    catch { return fallback; }
  }

  async #writeJsonAtomic(path, obj) {
    const tmp = path + '.tmp';
    await writeFile(tmp, JSON.stringify(obj, null, 2) + '\n', 'utf8');
    await rename(tmp, path);
  }

  agents() { return this.#readJson(this.paths.agents, []); }
  tasks() { return this.#readJson(this.paths.tasks, []); }
  specs() { return this.#readJson(this.paths.specs, []); }
  executions() { return this.#readJson(this.paths.executions, []); }
  validations() { return this.#readJson(this.paths.validations, []); }
  async config() { return { ...DEFAULT_CONFIG, ...(await this.#readJson(this.paths.config, {})) }; }
  system() { return this.#readJson(this.paths.system, { activeDirector: 'goose' }); }

  saveAgents(v) { return this.#writeJsonAtomic(this.paths.agents, v); }
  saveTasks(v) { return this.#writeJsonAtomic(this.paths.tasks, v); }
  saveSpecs(v) { return this.#writeJsonAtomic(this.paths.specs, v); }
  saveExecutions(v) { return this.#writeJsonAtomic(this.paths.executions, v); }
  saveValidations(v) { return this.#writeJsonAtomic(this.paths.validations, v); }
  saveConfig(v) { return this.#writeJsonAtomic(this.paths.config, v); }
  saveSystem(v) { return this.#writeJsonAtomic(this.paths.system, v); }

  async appendEvent(evt) {
    const withMeta = { id: randomUUID().slice(0, 8), at: new Date().toISOString(), ...evt };
    await appendFile(this.paths.events, JSON.stringify(withMeta) + '\n', 'utf8');
    return withMeta;
  }

  async recentEvents(limit = 100) {
    if (!existsSync(this.paths.events)) return [];
    const raw = await readFile(this.paths.events, 'utf8');
    const lines = raw.split('\n').filter(Boolean);
    return lines.slice(-limit).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  }

  async writeArchiveNote(fileName, markdown) {
    const path = join(this.archiveDir, fileName);
    await writeFile(path, markdown, 'utf8');
    return path;
  }

  async listArchive() {
    try { return (await readdir(this.archiveDir)).filter(f => f.endsWith('.md')).sort().reverse(); }
    catch { return []; }
  }

  async readArchiveNote(fileName) {
    if (fileName.includes('/') || fileName.includes('..')) throw new Error('nom de fichier invalide');
    return readFile(join(this.archiveDir, fileName), 'utf8');
  }

  async writeReport(fileName, markdown) {
    const path = join(this.reportsDir, fileName);
    await writeFile(path, markdown, 'utf8');
    return path;
  }

  async listReports() {
    try { return (await readdir(this.reportsDir)).filter(f => f.endsWith('.md')).sort().reverse(); }
    catch { return []; }
  }

  async readReport(fileName) {
    if (fileName.includes('/') || fileName.includes('..')) throw new Error('nom de fichier invalide');
    return readFile(join(this.reportsDir, fileName), 'utf8');
  }

  async snapshot() {
    const [agents, tasks, specs, executions, validations, system, config] = await Promise.all([
      this.agents(), this.tasks(), this.specs(), this.executions(), this.validations(), this.system(), this.config(),
    ]);
    return { agents, tasks, specs, executions, validations, system, config, at: new Date().toISOString() };
  }
}
