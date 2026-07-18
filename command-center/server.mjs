// Command Center — serveur (Node natif, zéro dépendance).
// Statics + SSE + API REST du cycle complet spec → assign → execute → proof → validate → archive.
import { createServer } from 'node:http';
import { existsSync, createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Store } from './lib/store.mjs';
import { Engine, EngineError } from './lib/engine.mjs';
import { Watchdog } from './lib/watchdog.mjs';
import { generateReport } from './lib/reports.mjs';
import { seedAgents, seedTasks } from './lib/seed.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = resolve(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

export async function createApp({ stateDir = resolve(__dirname, 'state'), watchdogIntervalMs = 60_000, seed = true } = {}) {
  const store = new Store(stateDir);
  await store.init();

  if (seed && !(await store.agents()).length) {
    await store.saveAgents(seedAgents());
    await store.saveTasks(seedTasks());
    await store.appendEvent({ type: 'system_seeded', agents: 10, tasks: 6 });
  }

  const sseClients = new Set();
  const broadcast = (eventName, data) => {
    const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of sseClients) { try { res.write(payload); } catch { /* client mort */ } }
  };

  const engine = new Engine(store, { onEvent: (evt) => broadcast('event', evt) });
  const watchdog = new Watchdog(engine);
  if (watchdogIntervalMs > 0) watchdog.start(watchdogIntervalMs);

  const sendJson = (res, status, obj) => {
    const body = JSON.stringify(obj);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
    res.end(body);
  };

  const readBody = (req) => new Promise((resolvBody, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolvBody({});
      try { resolvBody(JSON.parse(raw)); } catch { reject(new EngineError('JSON invalide')); }
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

  async function handleSSE(req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache',
      Connection: 'keep-alive', 'X-Accel-Buffering': 'no',
    });
    res.write(':ok\n\n');
    res.write(`event: snapshot\ndata: ${JSON.stringify(await store.snapshot())}\n\n`);
    sseClients.add(res);
    const keep = setInterval(() => { try { res.write(':keepalive\n\n'); } catch { /* noop */ } }, 30_000);
    req.on('close', () => { clearInterval(keep); sseClients.delete(res); });
  }

  // taskId dans /api/tasks/:id/:action
  const TASK_ACTION = /^\/api\/tasks\/([^/]+)\/(assign|start|progress|block|unblock|proof|validate|archive|spec|help)$/;

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const path = url.pathname;

      if (req.method === 'GET') {
        if (path === '/events') return handleSSE(req, res);
        if (path === '/healthz') return sendJson(res, 200, { ok: true, at: new Date().toISOString() });
        if (path === '/api/snapshot') return sendJson(res, 200, await store.snapshot());
        if (path === '/api/events/recent') return sendJson(res, 200, await store.recentEvents(Number(url.searchParams.get('limit') || 100)));
        if (path === '/api/watchdog/status') return sendJson(res, 200, await watchdog.scan());
        if (path === '/api/reports') return sendJson(res, 200, await store.listReports());
        if (path.startsWith('/api/reports/')) return sendJson(res, 200, { content: await store.readReport(decodeURIComponent(path.slice('/api/reports/'.length))) });
        if (path === '/api/archive') return sendJson(res, 200, await store.listArchive());
        if (path.startsWith('/api/archive/')) return sendJson(res, 200, { content: await store.readArchiveNote(decodeURIComponent(path.slice('/api/archive/'.length))) });
        return serveStatic(res, path);
      }

      if (req.method === 'POST') {
        const body = await readBody(req);

        if (path === '/api/specs') return sendJson(res, 201, await engine.createSpec(body));
        if (path === '/api/tasks') return sendJson(res, 201, await engine.createTask(body));
        if (path === '/api/watchdog/scan') return sendJson(res, 200, await watchdog.scan());
        if (path === '/api/reports') return sendJson(res, 200, await generateReport(store, body));
        if (path.startsWith('/api/agents/') && path.endsWith('/heartbeat')) {
          const agentId = path.split('/')[3];
          return sendJson(res, 200, await engine.agentHeartbeat({ agentId, ...body }));
        }

        const m = path.match(TASK_ACTION);
        if (m) {
          const [, taskId, action] = m;
          const args = { ...body, taskId };
          switch (action) {
            case 'assign': return sendJson(res, 200, await engine.assignTask(args));
            case 'start': return sendJson(res, 200, await engine.startTask(args));
            case 'progress': return sendJson(res, 200, await engine.updateProgress(args));
            case 'block': return sendJson(res, 200, await engine.blockTask(args));
            case 'unblock': return sendJson(res, 200, await engine.unblockTask(args));
            case 'proof': return sendJson(res, 200, await engine.submitProof(args));
            case 'validate': return sendJson(res, 200, await engine.validateTask(args));
            case 'archive': return sendJson(res, 200, await engine.archiveTask(args));
            case 'spec': return sendJson(res, 200, await engine.attachSpec(args));
            case 'help': return sendJson(res, 200, await engine.requestHelp(args));
          }
        }
        return sendJson(res, 404, { error: 'route inconnue' });
      }

      res.writeHead(405); res.end('method not allowed');
    } catch (err) {
      const status = err instanceof EngineError ? err.status : 500;
      if (status >= 500) console.error('[command-center]', err);
      try { sendJson(res, status, { error: err.message }); } catch { /* réponse déjà partie */ }
    }
  });

  return { server, store, engine, watchdog, close: () => { watchdog.stop(); server.close(); } };
}

// Lancement direct: `node server.mjs`
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const PORT = Number(process.env.PORT || 7777);
  const HOST = process.env.HOST || '127.0.0.1';
  const { server } = await createApp({});
  server.listen(PORT, HOST, () => {
    console.log(`[command-center] http://${HOST}:${PORT}`);
  });
}
