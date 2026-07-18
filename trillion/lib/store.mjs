// Trillion — persistance plate (JSON + JSONL), zéro dépendance obligatoire.
// ventures.json : les entreprises actives (barre de gauche)
// messages/<ventureId>.jsonl : chaque échange (règle : même les réponses vocales laissent une trace écrite)
// memory/<ventureId>.json : la mémoire business (décisions datées, faits, citations)
import { readFile, writeFile, appendFile, rename, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

export class Store {
  constructor(stateDir) {
    this.stateDir = resolve(stateDir);
    this.venturesPath = join(this.stateDir, 'ventures.json');
    this.messagesDir = join(this.stateDir, 'messages');
    this.memoryDir = join(this.stateDir, 'memory');
  }

  async init() {
    await mkdir(this.stateDir, { recursive: true });
    await mkdir(this.messagesDir, { recursive: true });
    await mkdir(this.memoryDir, { recursive: true });
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

  #safeId(id) {
    if (!/^[a-zA-Z0-9-]+$/.test(id)) throw new Error(`id invalide: ${id}`);
    return id;
  }

  // ---- Ventures ----
  ventures() { return this.#readJson(this.venturesPath, []); }
  saveVentures(v) { return this.#writeJsonAtomic(this.venturesPath, v); }

  async getVenture(id) {
    const ventures = await this.ventures();
    return ventures.find(v => v.id === id) || null;
  }

  async upsertVenture(venture) {
    const ventures = await this.ventures();
    const idx = ventures.findIndex(v => v.id === venture.id);
    if (idx >= 0) ventures[idx] = venture;
    else ventures.push(venture);
    await this.saveVentures(ventures);
    return venture;
  }

  async deleteVenture(id) {
    const ventures = await this.ventures();
    await this.saveVentures(ventures.filter(v => v.id !== id));
  }

  // ---- Messages (trace écrite obligatoire, §8 du master plan) ----
  async appendMessage(ventureId, msg) {
    this.#safeId(ventureId);
    const entry = { id: randomUUID().slice(0, 8), at: new Date().toISOString(), ...msg };
    await appendFile(join(this.messagesDir, `${ventureId}.jsonl`), JSON.stringify(entry) + '\n', 'utf8');
    return entry;
  }

  async messages(ventureId, limit = 200) {
    this.#safeId(ventureId);
    const path = join(this.messagesDir, `${ventureId}.jsonl`);
    if (!existsSync(path)) return [];
    const raw = await readFile(path, 'utf8');
    return raw.split('\n').filter(Boolean)
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean).slice(-limit);
  }

  // ---- Living Memory (§8-9 : mémoire business datée) ----
  async memory(ventureId) {
    this.#safeId(ventureId);
    return this.#readJson(join(this.memoryDir, `${ventureId}.json`), { facts: [], decisions: [] });
  }

  async saveMemory(ventureId, memory) {
    this.#safeId(ventureId);
    await this.#writeJsonAtomic(join(this.memoryDir, `${ventureId}.json`), memory);
    return memory;
  }

  async rememberDecision(ventureId, text, source = 'conversation') {
    const memory = await this.memory(ventureId);
    memory.decisions.push({ at: new Date().toISOString(), text, source });
    return this.saveMemory(ventureId, memory);
  }

  async rememberFact(ventureId, text, source = 'masterplan') {
    const memory = await this.memory(ventureId);
    memory.facts.push({ at: new Date().toISOString(), text, source });
    return this.saveMemory(ventureId, memory);
  }

  // ---- Memory Vault (§11) : notes Markdown, structure connectable à Obsidian ----
  // state/vault/Trillion Memory Vault/{Global Memory, Ventures/<nom>/{Masterplan.md, Decisions.md, Reports/, Lessons.md}}
  async writeVaultNote(relPath, content) {
    if (relPath.includes('..')) throw new Error('chemin invalide');
    const path = join(this.stateDir, 'vault', 'Trillion Memory Vault', relPath);
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, content, 'utf8');
    return path;
  }

  async appendVaultNote(relPath, line) {
    if (relPath.includes('..')) throw new Error('chemin invalide');
    const path = join(this.stateDir, 'vault', 'Trillion Memory Vault', relPath);
    await mkdir(join(path, '..'), { recursive: true });
    await appendFile(path, line + '\n', 'utf8');
    return path;
  }
}
