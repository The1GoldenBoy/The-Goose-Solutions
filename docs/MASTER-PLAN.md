# 11-Super-App-Master-Plan

## 0. Mission
Construire un système d'exploitation multi-agents qui planifie, exécute, surveille, valide, répare et archive le travail business + technique + mémoire, avec vérité visible et friction minimale.

Objectif business: compagnie 24/7 autonome, $500K revenu an prochain, chemin vers milliardaire par automation + investissement passif.

## 1. Principe fondateur
Le système doit toujours montrer la vérité. Jamais de fausse complétion, jamais de tâche cachée.

Pour chaque tâche on voit:
- Qui travaille dessus
- Quel est l'avancement %
- Quels sont les blocages
- Quelle est la prochaine action
- Quelle est la preuve
- Où est l'archive

## 2. Architecture à 5 vues

### Vue 1: Office — le revenu
Tout ce qui touche directement l'argent.

Contenu:
- Leads actifs avec scoring
- Calls à faire (scripts préparés)
- Follow-ups programmés
- Propositions envoyées + état
- Factures en cours
- Pipeline MTLI + side-projects
- Priorités du jour/semaine

Métriques:
- Leads créés / semaine
- Calls complétés
- Follow-ups envoyés
- Propositions envoyées
- Factures émises
- Revenu influencé $
- Tâches complétées vs bloquées vs stales

Règles:
- Chaque tâche revenu a un owner
- Chaque tâche a une next action claire
- Pas de "en cours" éternel
- Money-work = priorité absolue

### Vue 2: Factory — les systèmes
Tout ce qui devient automation, bot, script, pipeline.

Contenu:
- Bots en construction
- Scrapers (LinkedIn, annuaires, etc.)
- Automations HubSpot / CRM
- Pipelines de data
- Intégrations (email, Telegram, social)
- Outils internes
- Systèmes de delivery
- État des tests + production

Métriques:
- Systèmes livrés
- Automations actives
- Bugs corrigés
- Tests passés
- Intégrations complétées
- Incidents de prod
- Temps de réparation

Règles:
- Toute tâche build a un spec
- Toute tâche build a une preuve
- Pas d'archive sans validation
- Réparer sans reboot inutile

### Vue 3: Meeting Room — la collaboration live
Espace où les agents se parlent, se passent des tâches, demandent de l'aide.

Ce qu'on voit:
- Les 10 lanes d'agents (Goose, Maverick, Ulysse, W1-3, Doc1-2, Hermes, Max)
- Badge de statut par agent (working, blocked, broken, idle, moving, done)
- Tâche actuelle de chaque agent
- Avancement %
- Dernière mise à jour
- Handoffs visibles
- Demandes d'aide en cours

Événements:
- task assigned
- task started
- task blocked / unblocked
- help requested / answered
- proof submitted
- validated
- archived
- escalated
- repaired

Règles:
- Rien d'invisible s'il affecte le système
- Handoffs explicites
- Preuve de travail attachée
- Si Goose absent → Maverick reprend

### Vue 4: Completion Watchdog — la vérité
Couche qui empêche les fausses complétions.

Responsabilités:
- Tracker chaque tâche ouverte
- Détecter les tâches stales (seuil configurable)
- Exiger une preuve de travail
- Exiger une validation Goose
- Notifier Goose quand dépasse seuil
- Escalader à Max si nécessaire

Statuts:
todo → working → blocked → needs review → done → archived → stale

Règles de vérité:
- Pas d'update dans le délai → stale
- Stale → Goose doit voir
- Bloqué → blocage explicite
- Done sans preuve → pas done
- Done sans validation → pas done
- Done sans archive → pas done

### Vue 5: Obsidian Memory — la mémoire durable
Source de vérité persistante.

Stocke:
- Identité, buts, projets actifs
- Chemins critiques (PATHS.md)
- Décisions importantes
- Specs d'agents
- Résultats de validation
- Architecture système
- Historique archivé
- Tâches stales résolues

Principe:
- Mémoire stable vit ici
- Chat n'est pas la source de vérité
- Daily notes capturent le brut
- Promotion manuelle ou par Goose vers long-terme

## 3. Les agents (équipe complète)

### Goose — Directeur principal
- Modèle: Claude Opus 4.7
- Bot Telegram: @GooseChief_bot
- Déclencheur: messages commençant par `-`
- Caractère: directif, fier, budget-conscient, sévère avec l'équipe

Responsabilités:
- Découper les tâches en atomique
- Assigner au meilleur agent (charge + skills + priorité)
- Monitorer le progrès
- Exiger preuve
- Valider la complétion
- Marquer les stales
- Escalader les blockers
- Repartager le travail pour maximiser l'efficacité
- Produire les rapports français
- Garder le système truthful et en mouvement

Format de rapport standard:
- Date/heure
- Agents actifs (tâche, %, next action, blocage, preuve)
- Stales
- Escalations

Règle qualité Goose:
Ne peut jamais dire qu'une tâche est done sans: spec + exécution + preuve + validation + archive.

### Maverick — Backup Directeur (jumeau)
- Modèle: Claude Opus 4.7
- Rôle: Continuité totale de Goose
- Activation: quand Goose absent, stalled, broken, ou sous charge

Règles:
- Même caractère, même discipline
- Lit l'état depuis Obsidian
- Continue monitoring + repartition
- Ne reset pas le système sauf si requis
- Préserve état ouvert + preuves
- Garde la cadence vivante

### Ulysse — Accélérateur
- Modèle: GPT-5.2 ou Opus 4.7 selon charge
- Rôle: Second cerveau, parallélisation

Responsabilités:
- Travailler en parallèle sur tâches mémoire-lourdes
- Utilise la même mémoire Obsidian
- Accélère la construction du système
- Prépare le contexte pour les autres agents
- Structure l'info en artefacts utilisables
- Réduit les bottlenecks

### Worker 1 — Office Executor
Focus: revenu, leads, calls, follow-ups, pipeline MTLI.

Output attendu par tâche:
- task completed
- proof of work
- progress %
- next task
- blocker si applicable

### Worker 2 — Factory Executor
Focus: systèmes, bots, automations, scripts, workflows, features.

### Worker 3 — Obsidian/Memory Executor
Focus: mémoire, promotion, archivage, structure, documentation.

### Doctor 1 & 2 — Réparation
Rôle: stabilisation sans reboot.

Responsabilités:
- Réparer outils, agents, listeners, pipelines cassés
- Préserver l'état tout en réparant
- Doctor 2 = backup de Doctor 1

Règles:
- Repair first, reboot last
- Jamais détruire de l'état si évitable

### Hermes — Support technique
Rôle: monitoring, clarification, help routing dans Meeting Room.

### Max — Pilote (humain)
Rôle: priorités, approbation, override, direction finale.

## 4. Workflow de tâche (cycle complet)

1. SPEC — Goose écrit: objectif, deliverable, acceptance, risques, preuve requise, done definition
2. ASSIGN — Goose choisit l'agent (charge + skills + priorité + chain de dépendance)
3. EXECUTE — Agent bosse UNE tâche à la fois. Update status + %. Records blockers.
4. PROOF — Agent dépose la preuve: fichier / commit / note / link / screenshot / artefact / log
5. VALIDATE — Goose check contre le spec. ✅ continue ou ❌ changements demandés
6. ARCHIVE — Obsidian: résultat + décision + preuve préservés
7. WATCHDOG — Monitore owner, statut, dernière update, preuve, stale timer. Stale → Goose → escalade Max si persiste

## 5. Objets de données

### Task object
```json
{
  "id": "string",
  "title": "string",
  "owner": "goose | maverick | ulysse | worker1 | worker2 | worker3 | doctor1 | doctor2 | hermes",
  "board": "office | factory | meeting | memory",
  "status": "spec | working | blocked | review | done | archived | stale",
  "specId": "string | null",
  "dueAt": "string | null",
  "nextAction": "string",
  "proofOfWork": "string | null",
  "lastUpdateAt": "string",
  "validatedBy": "string | null",
  "validatedAt": "string | null"
}
```

### Spec object (créé par Goose)
```json
{
  "id": "string",
  "taskId": "string",
  "summary": "string",
  "acceptanceCriteria": ["..."],
  "risks": ["..."],
  "requiredProof": ["..."],
  "doneDefinition": "string",
  "createdAt": "string",
  "createdBy": "goose"
}
```

### Execution object (preuve)
```json
{
  "taskId": "string",
  "actionTaken": "string",
  "filesChanged": ["..."],
  "resultSummary": "string",
  "proofLinks": ["..."],
  "createdAt": "string",
  "createdBy": "worker|ulysse|doctor"
}
```

### Validation object (Goose)
```json
{
  "taskId": "string",
  "verdict": "approved | rejected | needs_changes",
  "checkedAgainstSpec": "string",
  "missingItems": ["..."],
  "notes": "string",
  "validatedAt": "string",
  "validatedBy": "goose"
}
```

### Watchdog object
```json
{
  "taskId": "string",
  "staleAfterMinutes": 120,
  "lastUpdateAt": "string",
  "status": "ok | stale | blocked",
  "reminderSentAt": "string | null",
  "escalationSentAt": "string | null"
}
```

## 6. Plan d'implémentation — 8 couches

### Couche 1: Command Center
- Hub central (déjà conceptuel, à instancier comme interface)
- Task router (code à écrire: dispatch basé sur `board` + skills)
- Status tracker (lit les sessions + états d'agents)
- Memory bridge (lit/écrit Obsidian)
- Launch control (vérifie que tout est vivant)

### Couche 2: Workers
- Spawn Worker 1, 2, 3 comme agents isolés OpenClaw
- Chaque worker: 1 tâche à la fois
- Rapporte en % + blockers + next step
- Dépose preuve avant completion

### Couche 3: Goose
- Agent créé, Opus 4.7, bot Telegram actif
- Reçoit les rapports des workers
- Écrit specs
- Valide preuves
- Produit rapports FR
- Sync vers Obsidian
- Escalade blockers

### Couche 4: Maverick
- Duplicate de Goose (même workspace ou workspace parallèle)
- Active sur absence/stall Goose
- Préserve continuité

### Couche 5: Doctors
- Doctor 1 = repair principal
- Doctor 2 = backup
- Réparent sans reboot quand possible

### Couche 6: Obsidian Memory
- Structure en place (00-Index à 17)
- PATHS.md, MEMORY.md, TOOLS.md à jour
- Sync script Goose → Obsidian déjà écrit
- Daily notes capturent le raw

### Couche 7: Automation
- Cron/heartbeat chaque X minutes
- Seulement si travail actif
- Push rapports dans Obsidian
- Move inbox → processed
- Silence si idle

### Couche 8: Launch Readiness
Checklist avant de dire "le système est live":
- Workers actifs
- Command Center reçoit updates
- Goose rapporte correctement
- Mémoire synchronisée
- Aucun chemin critique manquant

## 7. Routing rules

- Office tasks → Worker 1 (principal), Ulysse (accel), Goose (spec+valid)
- Factory tasks → Worker 2 (principal), Ulysse (accel), Doctors (repair)
- Memory tasks → Worker 3, Ulysse, Goose
- Repair tasks → Doctor 1 (→ Doctor 2 si indispo)
- Coordination → Meeting Room
- Completion oversight → Goose + Watchdog
- Backup oversight → Maverick
- Décision finale → Max

## 8. Règles de sortie (pour les rapports)

- Tous les status updates en français
- Rapports doivent inclure: qui fait quoi, % progrès, blocage, next task, état preuve
- Rapports seulement quand travail actif
- Silence quand idle
- Si travail actif, rapport clair et vrai

## 9. Definition of Done pour le Super App

Le système n'est vraiment operational que quand:
- Office View existe et est significative
- Factory View existe et est significative
- Meeting Room existe et est significative
- Completion Watchdog existe et fonctionne
- Mémoire Obsidian structurée et à jour
- Goose peut diriger et valider
- Maverick peut prendre le relais
- Ulysse peut accélérer le parallèle
- Workers peuvent exécuter en parallèle
- Doctors peuvent réparer
- Preuves visibles
- Stales visibles
- Complétion enforced
- Système peut bouger sans dépendre d'un seul chemin fragile

## 10. Roadmap d'exécution — ordre réaliste

### Phase 0 — Débloquer Goose (bloquant)
- Restart gateway pour appliquer dnsResultOrder=ipv4first
- Test: `- salut` sur @GooseChief_bot → réponse en français
- Goose reporte son premier rapport

### Phase 1 — Duo directeur (Goose + Maverick)
- Créer Maverick comme agent OpenClaw (Opus 4.7)
- Bot Telegram dédié ou partagé
- Maverick lit Obsidian au démarrage
- Logique de handoff entre Goose et Maverick

### Phase 2 — Workers de base
- Worker 1, 2, 3 comme agents OpenClaw (ou subagents selon complexité)
- Chacun son modèle (mini pour économiser, 5.2 pour qualité)
- Testent chacun leur lane respective

### Phase 3 — Watchdog + Task Storage
- Écrire le moteur de tâches (JSON dans `C:\Users\MAX\.openclaw\state\tasks\`)
- Script cron: vérifie les stales toutes les X min
- Intègre à Goose via un tool

### Phase 4 — Meeting Room (UI)
- Interface web/dashboard qui montre les lanes d'agents
- Live status via WebSocket vers gateway (port 18789)
- Extension du dashboard OpenClaw existant

### Phase 5 — Support & Repair
- Ulysse, Doctors, Hermes instanciés
- Ulysse parallélise
- Doctors peuvent éditer la config OpenClaw pour réparer

### Phase 6 — Production
- Tests de charge
- Travail réel (leads MTLI, landing pages, etc.)
- Métriques collectées
- Premiers $ générés

## 11. Questions ouvertes (à trancher)

1. Workers = agents OpenClaw séparés OU subagents spawnés à la demande?
   - Recommandation: hybride — Goose/Maverick persistants, Workers spawnés à la demande

2. Meeting Room: UI custom ou extension du dashboard OpenClaw existant?
   - Recommandation: extension du dashboard (déjà sur http://127.0.0.1:18789/)

3. Budget modèles:
   - Opus partout = cher mais qualité max
   - Recommandation: mix — Opus pour Goose/Maverick, GPT-5.2 pour Workers clés, mini pour tâches simples

4. Data storage des tâches:
   - Recommandation: JSON en phase 1 (~/.openclaw/state/tasks/), migration SQLite si besoin phase 3

## 12. État actuel

- Goose: créé, Opus 4.7, bot Telegram actif, réponses françaises OK côté modèle
- Bug en cours: sendMessage Telegram échoue, besoin restart gateway pour appliquer dnsResultOrder=ipv4first
- Maverick: pas encore créé (Phase 1)
- Workers / Ulysse / Doctors / Hermes: pas encore instanciés
- Obsidian memory: structure complète en place
- PATHS.md / MEMORY.md / TOOLS.md: à jour

## 13. Prochaine action concrète
Restart gateway → test Goose live → Phase 1 (Maverick).
