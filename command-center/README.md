# 🪿 Goose Command Center

Le produit du **Super App Master Plan** (Obsidian → `11-Super-App-Master-Plan.md`) : un OS multi-agents qui planifie, exécute, surveille, valide, répare et archive le travail — avec **vérité visible** et friction minimale.

Zéro dépendance. Node ≥ 18. Fonctionne tel quel sur Windows, WSL, Linux, Mac.

## Démarrage

```bash
cd command-center
npm start          # → http://127.0.0.1:7777
npm run demo       # fait vivre un cycle complet (spec → preuve → validation → archive)
npm test           # 9 tests : moteur, watchdog, API end-to-end
```

`PORT` et `HOST` configurables par variables d'environnement.

## Les 5 vues (§2 du master plan)

| Vue | Ce qu'elle montre |
|-----|-------------------|
| **Office** | Tâches revenu (leads, calls, follow-ups) en kanban + métriques |
| **Factory** | Tâches systèmes/automations en kanban + métriques |
| **Meeting Room** | Les 10 lanes d'agents (statut, tâche, %, next action, blocages) + fil live des événements |
| **Watchdog** | La vérité : spec/preuve/validation/archive par tâche, stales, escalades, directeur actif |
| **Mémoire** | Archives des tâches complétées + rapports Goose en français |

Tout est live par SSE (`/events`).

## Les règles de vérité (implémentées et testées)

- **Pas d'exécution sans spec** — `start` refuse une tâche sans spec attachée.
- **Pas de done sans preuve** — `proof` exige un lien ou fichier tangible.
- **Pas de done sans validation** — seul le directeur (Goose, ou Maverick en relève) valide contre la spec.
- **Pas d'archive sans done** — l'archive préserve spec + preuves + verdict en Markdown (compatible Obsidian).
- **Blocage explicite obligatoire** — `block` sans raison est refusé.
- **Pas d'update dans le délai → stale** (120 min) → notification directeur → **escalade à Max** (240 min).
- **Goose silencieux 30 min → Maverick prend la direction** ; Goose revient → restauration automatique.
- **Rapport seulement quand travail actif** — silence quand idle (règle §8).

## L'équipe (§3)

Goose (directeur), Maverick (backup), Ulysse (accélérateur), Worker 1 (Office), Worker 2 (Factory), Worker 3 (Mémoire), Doctor 1 & 2 (réparation), Hermes (support), Max (pilote humain). Seedée automatiquement au premier démarrage, avec les tâches de la roadmap §10.

## API (pour les agents)

```
GET  /api/snapshot                    état complet
GET  /events                          SSE live
POST /api/specs                       {actorId, taskId?, summary, doneDefinition, requiredProof[]}
POST /api/tasks                       {actorId, title, board, ownerId?}
POST /api/tasks/:id/spec              {specId}
POST /api/tasks/:id/start             {actorId}
POST /api/tasks/:id/progress          {actorId, progressPct, nextAction?}
POST /api/tasks/:id/block|unblock     {actorId, reason}
POST /api/tasks/:id/proof             {actorId, resultSummary, proofLinks[]}
POST /api/tasks/:id/validate          {actorId, verdict: approved|rejected|needs_changes, notes?}
POST /api/tasks/:id/archive           {actorId}
POST /api/tasks/:id/assign            {actorId, ownerId}
POST /api/tasks/:id/help              {actorId, question}
POST /api/agents/:id/heartbeat        {status?, progressPct?, nextAction?}
GET|POST /api/watchdog/scan|status
GET|POST /api/reports                 POST {force?} génère un rapport FR
GET  /api/archive[/:file]
```

CLI équivalente : `node bin/goosectl.mjs <commande>` (voir l'en-tête du fichier). Les agents OpenClaw/Telegram de Max peuvent piloter le système avec de simples `fetch`/`curl`.

## Branchement Obsidian

Le dossier `archive/` contient des notes Markdown prêtes pour le vault. Pointer `archiveDir` (ou copier le dossier) vers `OpenClawMemory/Memory/...` pour que les archives tombent directement dans la mémoire long-terme.

## Definition of Done du master plan (§9) — état

| Exigence | État |
|----------|------|
| Office View significative | ✅ kanban + métriques revenu |
| Factory View significative | ✅ kanban + métriques systèmes |
| Meeting Room significative | ✅ 10 lanes live + événements |
| Completion Watchdog fonctionnel | ✅ stale + escalade + table de vérité |
| Mémoire structurée et à jour | ✅ archives MD + rapports |
| Goose dirige et valide | ✅ rôles directeur enforced |
| Maverick prend le relais | ✅ failover/restauration automatique testés |
| Ulysse accélère, Workers exécutent, Doctors réparent | ✅ lanes + routage §7 |
| Preuves visibles | ✅ partout (UI, API, archives) |
| Stales visibles | ✅ Watchdog + kanban + rapports |
| Complétion enforced | ✅ règles de vérité testées |
| Pas de chemin fragile unique | ✅ fichiers plats + failover directeur |
