// Trillion — serveur (Node natif). Statics + API du cockpit.
// « Add a business. Give Trillion the Masterplan. She builds the cockpit. »
import { createServer } from 'node:http';
import { existsSync, createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

import { Store } from './lib/store.mjs';
import { analyzeMasterplan, buildSteps, draftMasterplan, INTERVIEW, VIEW_CATALOG } from './lib/analyzer.mjs';
import { respond, isClaudeAvailable, pnlForPeriod } from './lib/trillion.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = resolve(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

export async function createApp({ stateDir = resolve(__dirname, 'state') } = {}) {
  const store = new Store(stateDir);
  await store.init();

  const sendJson = (res, status, obj) => {
    const body = JSON.stringify(obj);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
    res.end(body);
  };

  const readBody = (req) => new Promise((resolveBody, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolveBody({});
      try { resolveBody(JSON.parse(raw)); } catch { reject(new Error('JSON invalide')); }
    });
    req.on('error', reject);
  });

  async function serveStatic(res, urlPath) {
    const rel = urlPath === '/' ? '/index.html' : urlPath;
    const full = resolve(PUBLIC_DIR, '.' + rel);
    if (!full.startsWith(PUBLIC_DIR) || !existsSync(full)) { res.writeHead(404); res.end('not found'); return; }
    const s = await stat(full);
    if (s.isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[extname(full).toLowerCase()] || 'application/octet-stream', 'Content-Length': s.size });
    createReadStream(full).pipe(res);
  }

  // Crée le venture complet à partir d'un masterplan (le Launch Dashboard du Chemin A).
  async function createVenture({ masterplan, name }) {
    if (!masterplan?.trim()) throw new Error('masterplan requis');
    const analysis = analyzeMasterplan(masterplan, { name });
    const venture = {
      id: `v-${randomUUID().slice(0, 8)}`,
      name: analysis.name,
      businessType: analysis.businessType,
      masterplan,
      analysis,
      views: analysis.recommendedViews,
      layout: {},
      period: 'week',
      createdAt: new Date().toISOString(),
    };
    venture.tasks = [];
    venture.pnlLog = [];
    await store.upsertVenture(venture);
    // Mémoire initiale (§5) : le masterplan alimente la Living Memory dès le premier jour.
    for (const o of analysis.objectives.slice(0, 3)) await store.rememberFact(venture.id, `Objectif: ${o}`);
    for (const r of analysis.risks.slice(0, 3)) await store.rememberFact(venture.id, `Risque identifié: ${r}`);
    for (const k of analysis.kpis.slice(0, 3)) await store.rememberFact(venture.id, `KPI: ${k}`);
    // Memory Vault (§11) — structure Obsidian-connectable.
    await store.writeVaultNote(`Ventures/${venture.name.replace(/[/\\:]/g, '-')}/Masterplan.md`, masterplan);
    return venture;
  }

  // §15 — Empire Overview : « Qu'est-ce qui mérite mon attention maintenant ? »
  async function empireOverview() {
    const ventures = await store.ventures();
    const rows = [];
    let totalPnl = 0, openTasks = 0, blockedTasks = 0;
    const risks = [], agents = [];
    for (const v of ventures) {
      const p = pnlForPeriod(v, 'month');
      totalPnl += p.total;
      const open = (v.tasks || []).filter(t => !t.done);
      openTasks += open.length;
      blockedTasks += open.filter(t => (Date.now() - new Date(t.at)) > 3 * 24 * 3600 * 1000).length;
      risks.push(...(v.analysis?.risks || []).slice(0, 1).map(r => `${v.name} : ${r}`));
      agents.push(...(v.analysis?.suggestedAgents || []).slice(0, 2).map(a => `${a} (${v.name})`));
      rows.push({
        id: v.id, name: v.name, businessType: v.businessType,
        pnlMonth: p.total, openTasks: open.length,
        health: p.total < 0 || open.some(t => (Date.now() - new Date(t.at)) > 3 * 24 * 3600 * 1000) ? 'attention' : 'ok',
        objective: v.analysis?.objectives?.[0] || null,
      });
    }
    const attention = rows.find(r => r.health === 'attention');
    return {
      ventures: rows, totalPnlMonth: totalPnl, openTasks, blockedTasks,
      risks: risks.slice(0, 5), agents: agents.slice(0, 6),
      recommendation: attention
        ? `${attention.name} mérite ton attention maintenant${attention.pnlMonth < 0 ? ' — P&L négatif ce mois-ci' : ' — des tâches traînent'}.`
        : ventures.length ? 'Tout est sain. Avance sur ton objectif principal.' : 'Ajoute ta première entreprise avec le bouton +.',
    };
  }

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const path = url.pathname;

      if (req.method === 'GET') {
        if (path === '/healthz') return sendJson(res, 200, { ok: true, at: new Date().toISOString() });
        if (path === '/api/status') return sendJson(res, 200, { claude: await isClaudeAvailable(), viewCatalog: VIEW_CATALOG });
        if (path === '/api/interview') return sendJson(res, 200, INTERVIEW);
        if (path === '/api/empire') return sendJson(res, 200, await empireOverview());
        if (path === '/api/ventures') return sendJson(res, 200, await store.ventures());
        const mVenture = path.match(/^\/api\/ventures\/([^/]+)$/);
        if (mVenture) {
          const venture = await store.getVenture(mVenture[1]);
          if (!venture) return sendJson(res, 404, { error: 'venture inconnu' });
          const [memory, messages] = await Promise.all([store.memory(venture.id), store.messages(venture.id)]);
          return sendJson(res, 200, { venture, memory, messages });
        }
        return serveStatic(res, path);
      }

      if (req.method === 'POST') {
        const body = await readBody(req);

        // Chemin A — analyse sans persistance : « I understand this venture. I recommend… »
        if (path === '/api/ventures/analyze') {
          if (!body.masterplan?.trim()) return sendJson(res, 400, { error: 'masterplan requis' });
          const analysis = analyzeMasterplan(body.masterplan, { name: body.name });
          return sendJson(res, 200, { analysis, steps: buildSteps(analysis) });
        }

        // Chemin B — Trillion assemble le Masterplan depuis l'interview.
        if (path === '/api/ventures/draft') {
          const masterplan = draftMasterplan(body.answers || {});
          const analysis = analyzeMasterplan(masterplan);
          return sendJson(res, 200, { masterplan, analysis, steps: buildSteps(analysis) });
        }

        // Launch Dashboard — création réelle + étapes du build progressif (§6).
        if (path === '/api/ventures') {
          const venture = await createVenture(body);
          return sendJson(res, 201, { venture, steps: buildSteps(venture.analysis) });
        }

        // Chat contextuel d'un venture (Communication Center).
        const mChat = path.match(/^\/api\/ventures\/([^/]+)\/chat$/);
        if (mChat) {
          const venture = await store.getVenture(mChat[1]);
          if (!venture) return sendJson(res, 404, { error: 'venture inconnu' });
          if (!body.text?.trim()) return sendJson(res, 400, { error: 'text requis' });
          const history = await store.messages(venture.id, 24);
          // Trace écrite obligatoire (§8) — même si le message vient de la voix.
          await store.appendMessage(venture.id, { role: 'user', text: body.text, voice: Boolean(body.voice) });
          const memory = await store.memory(venture.id);
          const result = await respond(body.text, { venture, memory, store }, history);
          await store.appendMessage(venture.id, { role: 'trillion', text: result.text, spoken: Boolean(body.speak) });
          const safeName = venture.name.replace(/[/\\:]/g, '-');
          if (result.text.includes('🖋')) {
            await store.appendVaultNote(`Ventures/${safeName}/Decisions.md`, `- ${new Date().toISOString().slice(0, 10)} — ${body.text.trim()}`);
          }
          if (result.report) {
            await store.writeVaultNote(`Ventures/${safeName}/Reports/${new Date().toISOString().slice(0, 10)}.md`, result.text);
          }
          const fresh = await store.getVenture(venture.id);
          return sendJson(res, 200, { reply: result.text, dashboardChanged: result.dashboardChanged, venture: fresh });
        }

        // Tasks (§10/§13) : cocher / décocher.
        const mTask = path.match(/^\/api\/ventures\/([^/]+)\/tasks\/([^/]+)\/toggle$/);
        if (mTask) {
          const venture = await store.getVenture(mTask[1]);
          if (!venture) return sendJson(res, 404, { error: 'venture inconnu' });
          const task = (venture.tasks || []).find(t => t.id === mTask[2]);
          if (!task) return sendJson(res, 404, { error: 'tâche inconnue' });
          task.done = !task.done;
          task.doneAt = task.done ? new Date().toISOString() : null;
          await store.upsertVenture(venture);
          return sendJson(res, 200, { ok: true, task, venture });
        }

        return sendJson(res, 404, { error: 'route inconnue' });
      }

      if (req.method === 'DELETE') {
        const mVenture = path.match(/^\/api\/ventures\/([^/]+)$/);
        if (mVenture) { await store.deleteVenture(mVenture[1]); return sendJson(res, 200, { ok: true }); }
        return sendJson(res, 404, { error: 'route inconnue' });
      }

      res.writeHead(405); res.end('method not allowed');
    } catch (err) {
      const status = /requis|invalide/.test(err.message) ? 400 : 500;
      if (status >= 500) console.error('[trillion]', err);
      try { sendJson(res, status, { error: err.message }); } catch { /* déjà répondu */ }
    }
  });

  return { server, store, close: () => server.close() };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const PORT = Number(process.env.PORT || 8888);
  // 0.0.0.0 par défaut : joignable par l'hébergeur ET depuis ton iPhone sur le même WiFi.
  // Mets HOST=127.0.0.1 pour restreindre à la machine locale.
  const HOST = process.env.HOST || '0.0.0.0';
  const { server } = await createApp({});
  server.listen(PORT, HOST, () => console.log(`[trillion] ✦ http://${HOST}:${PORT}`));
}
