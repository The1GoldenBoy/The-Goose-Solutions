# Mettre Trillion en ligne (pour l'ouvrir sur iPhone)

Trillion est un serveur Node natif, **sans dépendance obligatoire**. N'importe quel hébergeur Node ou Docker fonctionne. Voici le chemin le plus court.

## Option 1 — Render (gratuit, recommandé)

1. Va sur **[render.com](https://render.com)** → connecte ton compte GitHub.
2. **New +** → **Blueprint** → choisis le dépôt `The-Goose-Solutions`.
3. Render lit `trillion/render.yaml` tout seul et propose le service **trillion**. Clique **Apply**.
4. Attends ~2 min. Render te donne une URL du genre `https://trillion-xxxx.onrender.com`.
5. Ouvre cette URL sur ton iPhone → **Partager** → **Sur l'écran d'accueil**. Trillion s'installe comme une app (icône cristal, plein écran).

> Le palier gratuit s'endort après 15 min d'inactivité ; le premier chargement suivant prend ~30 s, puis c'est instantané.

## Option 2 — Railway / Fly.io / Cloud Run (Docker)

Le `Dockerfile` est prêt. Sur Railway : **New Project → Deploy from GitHub repo**, dossier racine `trillion`. Le port est fourni via `PORT`, l'hôte est déjà `0.0.0.0`.

## Option 3 — depuis ton iPhone, sans hébergeur (même WiFi)

Sur ton Mac/PC : `cd trillion && node server.mjs`. Le serveur écoute sur `0.0.0.0:8888`. Trouve l'IP locale de ton ordi (ex. `192.168.2.15`) et ouvre `http://192.168.2.15:8888` dans Safari sur ton iPhone (même réseau WiFi).

## Donner à Trillion toute son intelligence

Sans clé, Trillion tourne sur son **moteur local** (déterministe, hors ligne). Trois clés optionnelles, chacune débloque un pouvoir — toutes se mettent dans les variables d'environnement de l'hébergeur :

| Variable | Ce qu'elle débloque |
|---|---|
| `ANTHROPIC_API_KEY` | Trillion répond à tout avec Claude, en profondeur (§9) |
| `ELEVENLABS_API_KEY` | La voix signature de Trillion en streaming (§27) — sinon voix navigateur |
| `STRIPE_API_KEY` | Connecteur Stripe en lecture seule : les revenus se remplissent seuls (§23) — utilise une clé restreinte lecture seule |

## Note sur les données

Le palier gratuit a un disque **éphémère** : les ventures créés persistent tant que l'instance vit, puis se réinitialisent à un redéploiement. Pour une mémoire permanente, attache un volume (Render : *Disks* ; Railway : *Volume*) monté sur `trillion/state`. Le Vault Markdown reste exportable dans tous les cas.
