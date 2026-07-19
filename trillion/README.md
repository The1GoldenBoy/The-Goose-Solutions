# ✦ TRILLION

> **Talk to Trillion. Give her the Masterplan. Watch your business cockpit come alive.**

Trillion est un command center IA où chaque entreprise/projet actif possède son propre cockpit personnalisé. L'utilisateur ne configure pas le software — **il parle à Trillion, et Trillion configure le software autour de l'entreprise** (§19 du Master Plan Trillion).

Implémentation complète du **Master Plan Trillion** (sections 1 à 20) + le cœur de la **V2** (§21-25, 27, 30 : Trillion proactive, agents Reporter/Sentinelle, connecteur CSV, mémoire corrigible, onboarding 90 secondes, voix signature, KPIs Founder Mode). Node ≥ 18, zéro dépendance obligatoire.

## Démarrage

```bash
cd trillion
npm start                 # → http://127.0.0.1:8888
npm test                  # 18 tests
```

**Cerveau de Trillion** : moteur local déterministe inclus (fonctionne hors ligne). Pour que Trillion réponde à *tout* en profondeur (§9) :

```bash
npm install               # installe @anthropic-ai/sdk (optionnel)
ANTHROPIC_API_KEY=sk-... npm start
```

Le badge dans la barre de gauche indique le moteur actif (`✦ Claude connectée` / `◌ moteur local`).

## Ce qui est implémenté (fidèle au plan, section par section)

| § | Élément | Où |
|---|---------|-----|
| 1 | Concept : « Add a business. Give Trillion the Masterplan. She builds the cockpit. » | écran d'accueil |
| 2 | Identité : noir profond, indigo, violet, bleu électrique, magenta contrôlé, glassmorphism, particules, étoiles mauves. Zéro look Excel. | `public/app.css` + canvas cosmos |
| 3 | Trillion, la femme cosmique — présence animée au centre (dépose `public/assets/trillion.webp` pour l'image générée, sinon orbe cosmique CSS) | écran d'accueil |
| 4 | Barre de gauche **Active Ventures** ; même type + masterplan différent = cockpit différent | sidebar + `lib/analyzer.mjs` |
| 5 | Bouton **+** → écran minimal : Trillion, chat box, **Create a masterplan**. Chemin A (coller le plan → **Send** → « I understand this venture… » → **Launch Dashboard**) et Chemin B (conversation, pas formulaire) | `public/app.js` |
| 6 | Le dashboard **se bâtit sous les yeux** (Analyzing masterplan… → Dashboard ready.) et se **modifie par conversation** (« Ajoute une vue fournisseurs », « Mets le P&L plus gros », « Ce projet n'a pas besoin de CRM », jour/semaine/mois/année/lifetime) | `playBuild()` + `parseDashboardCommand()` |
| 7 | **Communication Center** — placeholder exactement « Talk with Trillion », bouton **Send** (Launch réservé aux actions) | panneau comm |
| 8 | **Voix + texte** : micro → dictée éditable → Send ; réponses vocales optionnelles ; **trace écrite obligatoire** de chaque échange (`messages/*.jsonl`) ; mémoire datée citée (« Le 12 avril, on avait décidé… ») | Web Speech API + store |
| 9 | **Trillion répond à tout** — avec le contexte du venture actif (masterplan, KPIs, mémoire, historique) via Claude (`claude-opus-4-8`), moteur local en secours | `lib/trillion.mjs` |
| 10 | Quick actions à vrai but : **Build a report**, **Find the bottleneck**, **What should I do next?**, **Create a task** — toutes fonctionnelles | `respond()` |
| 11 | **Living Memory** — graphe animé style Obsidian (nœuds lumineux, connexions, clusters) + **Memory Vault** en Markdown (`state/vault/Trillion Memory Vault/…`, connectable à Obsidian) : Masterplans, Decisions, Reports par venture | panneau memory + store |
| 12 | Dashboard **Trading** : P&L obligatoire (gros chiffre, win rate, equity curve lumineuse — gains bleu/violet, pertes magenta), Positions, Market Board, Risk Radar, Strategy Journal, Performance. P&L conversationnel : « j'ai gagné 800$ sur BTC » | vue pnl |
| 13 | Dashboard **Acquisition/CRM** : Pipeline, Next Actions, Tasks (à faire/terminé, cochables), Performance, Scripts/Objections | vues CRM |
| 14 | Dashboard **E-commerce** : Orders, Inventory, Ads/Acquisition, Product Performance, Customer Follow-up | vues ecommerce |
| 15 | **Empire Overview** — vue Home : toutes les entreprises, santé globale, revenus totaux, priorité du jour, risques, agents, recommandations. Répond à « Qu'est-ce qui mérite mon attention maintenant ? » | `/api/empire` |
| 16 | Les vues du bas = **views du dashboard actif**, différentes par entreprise | grille du cockpit |
| 17-18 | Wording final verrouillé : Trillion, Communication Center, Talk with Trillion, Send, Launch, +, Create a masterplan, Living Memory, Active Ventures, Views, Empire Overview | partout |
| 19 | « L'utilisateur ne configure pas le software. Il parle à Trillion. » | tout le produit |
| 21 | **Trillion proactive** : Morning Brief à l'ouverture (une carte, 15 s de lecture), alertes de vérité (P&L négatif 3 jours de suite, tâche bloquée > 3 jours), silence intelligent, coupure **par conversation** (« plus d'alertes le weekend ») | `lib/proactive.mjs` + carte Empire |
| 22 | Agents qui **travaillent** : le **Reporter** dépose le rapport hebdo (vendredi) dans le Vault + Living Memory ; la **Sentinelle** surveille les seuils. Chaque action est visible dans l'**Activity Log** (vue Agents) — rien ne se fait en cachette | `runAgents()` + `activity/*.jsonl` |
| 23 | **Connecteurs** : import **CSV** (date, montant, note) + **Stripe en lecture seule** (`STRIPE_API_KEY` → les revenus se remplissent seuls, re-sync idempotent). Règle de vérité : chaque chiffre affiche sa provenance — « dit à Trillion », « import CSV, sync … » ou « Stripe, sync … ». Débrancher se fait par conversation (« Débranche le CSV / Stripe ») | vue P&L + `/import/csv` + `/connect/stripe` |
| 24 | **La mémoire qui se corrige** : « Cette décision du 12 avril n'est plus vraie » → archivée avec date de révocation (jamais de suppression silencieuse) ; « Leçon : … » → `Lessons.md` du Vault, ressortie au bon moment ; **export total** en Markdown ouvert | `revokeDecision()` + `/export` |
| 25 | **Onboarding 90 secondes** : Chemin B en **3 questions au lieu de 6** (+ 3 optionnelles « Aiguise-le »), exemples prêts à coller (chips Univers), **time-to-cockpit mesuré** pour vrai et affiché (« Dashboard ready. — cockpit construit en 13 s ») | interview + `startTtc()` |
| 27 | **La voix signature** : ElevenLabs en streaming si `ELEVENLABS_API_KEY` est présente (une seule voix officielle, `TRILLION_VOICE_ID` pour la changer), **fallback navigateur silencieux** sinon. Trace écrite toujours (§8) | `/api/tts` + `speak()` |
| 30 | **Founder Mode (♛)** : les KPIs du produit mesurés localement — time-to-cockpit (< 2 min), % des modifications faites **par conversation** (> 70 % — LA mesure du §19), souvenirs cités / semaine (≥ 3), actions d'agents. Jamais inventés | `/api/kpis` + écran ♛ |

## API

```
GET  /api/status                        moteur actif + catalogue de vues
GET  /api/empire                        Empire Overview (§15)
GET  /api/ventures                      Active Ventures
POST /api/ventures/analyze              {masterplan} → analyse + vues recommandées (Chemin A)
GET  /api/interview                     questions du Chemin B
POST /api/ventures/draft                {answers} → Masterplan assemblé par Trillion
POST /api/ventures                      {masterplan} → Launch Dashboard (+ étapes du build)
GET  /api/ventures/:id                  venture + mémoire + messages + activity log
POST /api/ventures/:id/chat             {text, voice?, speak?} → réponse de Trillion
POST /api/ventures/:id/tasks/:tid/toggle
DELETE /api/ventures/:id
GET  /api/brief                         Morning Brief (§21) — fait aussi tourner Reporter + Sentinelle
POST /api/ventures/:id/import/csv       {csv} → P&L avec provenance + heure de sync (§23)
GET  /api/ventures/:id/export           export total en Markdown (§24)
GET  /api/interview?deep=1              les 3 questions d'aiguisage du Chemin B (§25)
POST /api/metrics                       mesures produit (time_to_cockpit…) (§30)
GET  /api/kpis                          KPIs du produit, mesurés localement (§30)
POST /api/tts                           voix signature ElevenLabs, 204 → fallback navigateur (§27)
POST /api/ventures/:id/connect/stripe   sync Stripe lecture seule — exige STRIPE_API_KEY (§23)
```

## Image de Trillion

L'image de la femme cosmique a été générée avec Higgsfield (job `e475e7e6-312d-4c01-b1aa-4d12904133a8`, dans ta librairie). Télécharge-la et dépose-la dans `public/assets/trillion.webp` — l'interface l'utilise automatiquement ; sinon l'orbe cosmique animé prend le relais.
