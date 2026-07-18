# Master Plan Trillion — V2

> Talk to Trillion. Give her the Masterplan. Watch your business cockpit come alive.

La V1 (sections 1-20) est verrouillée et déjà codée : le concept, l'identité cosmique, Trillion, Active Ventures, les deux chemins d'ajout, le dashboard qui se bâtit sous les yeux, le Communication Center, la voix avec trace écrite, les quick actions à vrai but, Living Memory, les cockpits Trading/CRM/E-commerce, l'Empire Overview, le wording final.

La V2 ne change rien à ça. Elle ajoute ce qui transforme la vision en produit qui se vend, se retient et se paie. Chaque section a une Definition of Done mesurable — jamais de fausse complétion.

---

## 21. Trillion proactive — elle parle la première

La V1 fait de Trillion une présence qui répond. La V2 en fait une présence qui **initie**.

- **Morning Brief** : chaque matin, Trillion ouvre la journée — « Bonjour Max. Voici ton empire ce matin : P&L d'hier, la tâche qui traîne, le risque qui grossit, LA priorité du jour. » Une seule carte, 15 secondes de lecture.
- **Alertes de vérité** : P&L négatif 3 jours de suite, tâche bloquée > 3 jours, KPI qui s'éloigne de l'objectif → Trillion le dit sans qu'on demande.
- **Silence intelligent** : si rien ne mérite l'attention, Trillion se tait. Une présence qui parle pour rien devient du bruit.

Règle : **une** notification proactive par jour maximum, sauf alerte critique.

**Done =** le Morning Brief apparaît à l'ouverture, les alertes se déclenchent sur les vrais seuils, et on peut les couper par conversation (« Trillion, plus d'alertes le weekend »).

## 22. Les agents passent à l'action

Dans la V1, la vue Agents est une liste. Dans la V2, les agents **travaillent** — et Trillion reste l'interface unique : on ne configure jamais un agent, on le demande.

| Agent | Ce qu'il fait seul |
|---|---|
| Reporter | Génère le rapport hebdo chaque vendredi et le dépose dans le Vault + Living Memory |
| Sentinelle | Surveille les seuils (P&L, KPIs, tâches stales) et nourrit les alertes de §21 |
| Relanceur (CRM) | Prépare les messages de relance des leads dormants — Trillion propose, l'humain approuve |
| Vigie (Trading) | Tient le Strategy Journal : rappelle les règles quand une décision les contredit (« Le 12 avril, tu as fixé le levier max à 3x. ») |

Architecture : Trillion est la voix et le cerveau ; **Hermes Agent est le moteur d'action** derrière (fichiers, navigateur, intégrations, automatisations) — exactement le rôle pressenti en §9. Toute action irréversible (envoyer, payer, publier) exige une approbation humaine : notification → clic → fait.

**Done =** au moins Reporter et Sentinelle actifs sans intervention, chaque action d'agent visible dans l'Activity Log, zéro action externe sans approbation.

## 23. Données réelles — les connecteurs par cockpit

Le P&L conversationnel (« j'ai gagné 800$ sur BTC ») reste le chemin zéro-friction. Les connecteurs enlèvent la friction qui reste. Priorité par cockpit, un seul connecteur bien fait à la fois :

1. **Universel** : import CSV + Stripe (revenus) — couvre 80 % des besoins dès le jour 1
2. **Trading** : API broker/exchange en lecture seule (positions et P&L se remplissent seuls)
3. **E-commerce** : Shopify (Orders, Inventory, Product Performance en vrai temps)
4. **CRM** : HubSpot / import de leads (le Pipeline respire)

Règle de vérité : une donnée branchée affiche sa source et son heure de sync. Une donnée dite en conversation affiche « dit à Trillion le … ». **Jamais de chiffre sans origine.**

**Done =** brancher Stripe prend < 3 minutes, le P&L affiche sa source, et débrancher se fait par conversation.

## 24. La mémoire qui se corrige

Living Memory devient une mémoire de confiance :

- **Chaque souvenir est citable ET éditable** : « Trillion, cette décision du 12 avril n'est plus vraie » → elle l'archive avec la date de révocation (jamais de suppression silencieuse — l'historique reste honnête).
- **Leçons** : « Leçon : … » crée une entrée dans `Lessons/` du Vault ; la Vigie les ressort au bon moment.
- **Mémoire globale vs venture** (déjà en V1) + **transfert explicite** : « retiens ça pour toutes mes entreprises ».
- **Export total en un clic** : le Vault est en Markdown ouvert — tes souvenirs t'appartiennent, connectables à Obsidian, jamais otages.

**Done =** corriger un souvenir par conversation fonctionne, les leçons remontent d'elles-mêmes au moins une fois par semaine dans le contexte pertinent.

## 25. Onboarding — le wow en 90 secondes

Le moment magique de Trillion, c'est le build sous les yeux. L'onboarding doit y amener en moins de deux minutes :

1. Écran d'accueil, Trillion respire, une phrase : « *Add a business. Give Trillion the Masterplan.* »
2. Pas de plan sous la main ? Un exemple prêt à coller (« Essaie avec ce plan de démo ») ou le Chemin B en trois questions au lieu de six.
3. Le cockpit se construit → première quick action suggérée → premier échange → première entrée en mémoire. La boucle complète au premier contact.

Mesure sacrée : **time-to-cockpit < 2 minutes** entre l'arrivée et « Dashboard ready. » Chaque écran d'onboarding se paie ou disparaît.

## 26. Trillion dans la poche — iPhone d'abord

Le command center vit là où le fondateur vit : sur son téléphone.

- **PWA installable** (icône Trillion, plein écran, offline en lecture) avant toute app native
- Vue mobile = **Empire Overview + Communication Center** — on consulte et on parle ; la construction lourde reste confortable sur grand écran
- La voix prend tout son sens en mobilité : bouton micro en premier plan
- Notifications de §21 via push

**Done =** installable depuis Safari iOS, Morning Brief en push, parler à Trillion en marchant fonctionne.

## 27. La voix de Trillion — une vraie voix

La synthèse navigateur (V1) est le plancher. La V2 donne à Trillion **une voix signature** : calme, chaleureuse, légèrement mystique — la même partout, reconnaissable comme un logo.

- TTS premium en streaming (ElevenLabs ou équivalent) avec fallback navigateur
- Règle intacte de §8 : **toute réponse vocale garde sa trace écrite**
- Plus tard (V3) : mode « présence » — l'orbe/l'image réagit pendant qu'elle parle

**Done =** une seule voix officielle configurée, latence < 1,5 s au premier mot, fallback silencieux si hors ligne.

## 28. Confiance, sécurité, propriété

Un command center voit tout l'empire d'un fondateur. La confiance est une feature :

- **Local d'abord** : les données vivent chez l'utilisateur (fichiers plats + Vault Markdown) ; le cloud est une option de sync, pas une prise d'otage
- Connecteurs en **lecture seule par défaut** ; toute écriture externe passe par l'approbation de §22
- Chaque venture est isolé ; l'export/suppression totale est un droit, en un clic
- Phrase de confiance, écrite dans le produit : « *Tes Masterplans, ta mémoire, tes chiffres : à toi. Trillion travaille pour toi, pas l'inverse.* »

## 29. Modèle d'affaires — Founder Mode

Trillion se vend seule ET nourrit Goose (offerte aux clients de Goose comme arme de rétention).

| Palier | Prix cible | Contenu |
|---|---|---|
| **Discover** | gratuit | 1 venture, cockpit complet, mémoire, quick actions — le wow sans carte de crédit |
| **Command** | ~29 $/mois | Ventures illimités, Empire Overview, connecteurs, voix premium, Morning Brief |
| **Founder Mode** | ~79 $/mois | Agents actifs (§22), rapports automatiques, mémoire globale multi-entreprises, priorité support |
| **Goose Edition** | bundle | Offerte/incluse pour les clients Goose — cockpit pré-configuré avec leur réceptionniste IA dedans |

La limite du gratuit est **le nombre de ventures, jamais la profondeur** : un utilisateur gratuit vit le produit au complet — c'est lui le vendeur.

**Done =** paiement Stripe en place, passage Discover → Command en un clic, et le compteur qui compte vraiment : conversion après le premier « Dashboard ready. »

## 30. Les chiffres qui disent la vérité (KPIs du produit)

| KPI | Cible V2 |
|---|---|
| Time-to-cockpit (arrivée → Dashboard ready.) | < 2 min |
| % des modifications de cockpit faites **par conversation** (vs UI) | > 70 % — c'est LA mesure du §19 |
| Rétention J7 / J30 | 40 % / 25 % |
| Souvenirs cités par Trillion / semaine / utilisateur actif | ≥ 3 — la preuve qu'elle se souvient |
| Conversion Discover → payant | ≥ 5 % |
| Notifications proactives jugées utiles (tap-through) | > 50 % |

## 31. Ordre de bataille

- **V1 — fait** : sections 1-20, codées, testées, poussées.
- **V1.5 (2-3 semaines)** : §25 onboarding + démo, §21 Morning Brief + alertes, §24 mémoire corrigible, §26 PWA iPhone. *Rien de nouveau à vendre — tout à retenir.*
- **V2 (4-8 semaines)** : §23 connecteurs (CSV + Stripe d'abord), §22 Reporter + Sentinelle, §27 voix signature, §29 paiements. *Là, ça se vend.*
- **V3** : agents complets avec approbations, mode présence animé, multi-utilisateurs (partager un cockpit avec un associé — lecture d'abord), API publique.

---

## La phrase qui ne change pas

> **L'utilisateur ne configure pas le software. Il parle à Trillion, et Trillion configure le software autour de l'entreprise.**

Tout ce qui précède sert cette phrase. Toute feature qui l'affaiblit — un panneau de réglages, un formulaire, un wizard — est refusée par défaut : si ça peut se dire à Trillion, ça doit se dire à Trillion.
