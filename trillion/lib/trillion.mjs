// Trillion — la présence intelligente vivante de l'application (§1, §9).
// Elle écoute, répond, comprend les entreprises, recommande, garde la mémoire,
// et adapte le dashboard en temps réel par la conversation (§6).
//
// Deux moteurs :
//  - Claude API (claude-opus-4-8) quand ANTHROPIC_API_KEY est disponible — Trillion répond à tout, avec contexte.
//  - Moteur local déterministe sinon — le produit reste 100 % fonctionnel hors ligne.
import { VIEW_CATALOG, buildQuickActions } from './analyzer.mjs';

const VIEW_ALIASES = {
  fournisseur: 'suppliers', supplier: 'suppliers',
  'p&l': 'pnl', pnl: 'pnl', profit: 'pnl',
  risque: 'risk', risk: 'risk', radar: 'risk',
  client: 'clients', 'follow-up': 'clients', suivi: 'clients',
  crm: 'clients', pipeline: 'pipeline', vente: 'pipeline', lead: 'pipeline',
  tâche: 'tasks', tache: 'tasks', task: 'tasks',
  'next action': 'nextactions', 'prochaine action': 'nextactions',
  script: 'scripts', objection: 'scripts',
  inventaire: 'inventory', inventory: 'inventory',
  ads: 'ads', publicité: 'ads', acquisition: 'ads', campagne: 'ads',
  position: 'positions', marché: 'market', market: 'market',
  mémoire: 'memory', memory: 'memory', memoire: 'memory',
  stratégie: 'strategy', strategy: 'strategy', journal: 'strategy',
  commande: 'orders', order: 'orders',
  mrr: 'mrr', churn: 'mrr', abonnement: 'mrr',
  performance: 'performance', agent: 'agents',
};

const PERIODS = { jour: 'day', day: 'day', semaine: 'week', week: 'week', mois: 'month', month: 'month', année: 'year', annee: 'year', year: 'year', lifetime: 'lifetime', 'à vie': 'lifetime' };

function findView(text) {
  const lower = text.toLowerCase();
  for (const [alias, viewId] of Object.entries(VIEW_ALIASES)) {
    if (lower.includes(alias)) return viewId;
  }
  return null;
}

// §6 — dashboard conversationnel : parse une commande de modification du cockpit.
// Retourne null si ce n'est pas une commande dashboard.
export function parseDashboardCommand(text) {
  const lower = text.toLowerCase();

  const period = Object.entries(PERIODS).find(([k]) => lower.includes(k));
  const wantsPeriod = /\b(vue|affiche|montre|passe|mets|show|switch|view)\b/.test(lower) || /jour\s*\/\s*semaine|day\s*\/\s*week/.test(lower);
  if (period && wantsPeriod && !/ajoute|add|enlève|remove/.test(lower)) {
    return { action: 'set_period', period: period[1] };
  }

  if (/(ajoute|add|crée|cree|create|fais[- ]moi|je veux voir)/.test(lower)) {
    const view = findView(lower);
    if (view) return { action: 'add_view', view };
  }

  if (/(enlève|enleve|retire|supprime|remove|pas besoin|n'a pas besoin)/.test(lower)) {
    const view = findView(lower);
    if (view) return { action: 'remove_view', view };
  }

  if (/(plus gros|plus grand|agrandis|bigger|larger)/.test(lower)) {
    const view = findView(lower);
    if (view) return { action: 'resize_view', view, size: 'large' };
  }
  if (/(plus petit|réduis|reduis|smaller)/.test(lower)) {
    const view = findView(lower);
    if (view) return { action: 'resize_view', view, size: 'small' };
  }

  if (/(orienté|oriente|axée?|focus)/.test(lower) && /vente|sales/.test(lower)) {
    const view = findView(lower);
    if (view) return { action: 'refocus_view', view, focus: 'ventes' };
  }

  return null;
}

// Applique une commande dashboard à un venture. Retourne {venture, reply}.
export function applyDashboardCommand(venture, cmd) {
  const name = (v) => VIEW_CATALOG[v]?.name || v;
  switch (cmd.action) {
    case 'add_view': {
      if (!venture.views.includes(cmd.view)) venture.views.push(cmd.view);
      return { venture, reply: `C'est fait — j'ai ajouté la vue ${name(cmd.view)} à ton cockpit. ✦` };
    }
    case 'remove_view': {
      venture.views = venture.views.filter(v => v !== cmd.view);
      return { venture, reply: `Compris. La vue ${name(cmd.view)} est retirée — ce projet n'en a pas besoin.` };
    }
    case 'resize_view': {
      venture.layout = venture.layout || {};
      venture.layout[cmd.view] = cmd.size;
      return { venture, reply: `Voilà — ${name(cmd.view)} est maintenant ${cmd.size === 'large' ? 'en grand format' : 'en format compact'}.` };
    }
    case 'set_period': {
      venture.period = cmd.period;
      const fr = { day: 'jour', week: 'semaine', month: 'mois', year: 'année', lifetime: 'depuis le début' };
      return { venture, reply: `Le cockpit affiche maintenant la période : ${fr[cmd.period]}.` };
    }
    case 'refocus_view': {
      venture.layout = venture.layout || {};
      venture.layout[`${cmd.view}:focus`] = cmd.focus;
      return { venture, reply: `J'ai réorienté la vue ${name(cmd.view)} vers les ${cmd.focus}.` };
    }
    default:
      return { venture, reply: 'Je n’ai pas compris cette modification du cockpit.' };
  }
}

// Détecte une décision à mémoriser (§8 : vraie mémoire business).
export function detectDecision(text) {
  const lower = text.toLowerCase();
  if (/(on décide|je décide|décision\s*:|c'est décidé|on part sur|je choisis|on y va avec)/.test(lower)) {
    return text.trim();
  }
  return null;
}

// P&L conversationnel (§12) : « j'ai gagné 500$ », « perte de 200$ », « P&L +350 ».
export function parsePnlEntry(text) {
  const lower = text.toLowerCase();
  if (!/(p&l|profit|perte|gagné|gagne|perdu|revenu|vendu|made|lost|loss|won)/.test(lower)) return null;
  const m = text.match(/([+-])?\s?\$?\s?(\d[\d\s,]*(?:[.,]\d{1,2})?)\s?(k)?\s?\$?/i);
  if (!m) return null;
  let amount = parseFloat(m[2].replace(/[\s,]/g, '').replace(',', '.'));
  if (m[3]) amount *= 1000;
  if (Number.isNaN(amount) || amount === 0) return null;
  const negative = m[1] === '-' || /(perte|perdu|lost|loss|dépens)/.test(lower);
  return { amount: negative ? -amount : amount, note: text.trim().slice(0, 120) };
}

// §10 — Create a task : transforme la discussion en tâche suivable.
export function parseTaskCommand(text) {
  const m = text.match(/(?:create a task|crée(?:r)? une tâche|ajoute une tâche|nouvelle tâche)\s*[:\-—]?\s*(.*)/i);
  if (!m) return null;
  return { text: m[1]?.trim() || null };
}

const sum = (entries) => entries.reduce((n, e) => n + e.amount, 0);
const fmt$ = (n) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toLocaleString('fr-CA')} $`;

function periodStart(period, now = new Date()) {
  const d = new Date(now);
  switch (period) {
    case 'day': d.setHours(0, 0, 0, 0); return d;
    case 'week': d.setDate(d.getDate() - 7); return d;
    case 'month': d.setMonth(d.getMonth() - 1); return d;
    case 'year': d.setFullYear(d.getFullYear() - 1); return d;
    default: return new Date(0);
  }
}

export function pnlForPeriod(venture, period = venture.period || 'week') {
  const log = venture.pnlLog || [];
  const start = periodStart(period);
  const entries = log.filter(e => new Date(e.at) >= start);
  const total = sum(entries);
  const wins = entries.filter(e => e.amount > 0).length;
  return {
    total, entries,
    winRate: entries.length ? Math.round((wins / entries.length) * 100) : null,
    best: entries.length ? Math.max(...entries.map(e => e.amount)) : null,
    worst: entries.length ? Math.min(...entries.map(e => e.amount)) : null,
  };
}

// §10 — Build a report : rapport clair sur l'entreprise, depuis les vraies données.
export function buildReport(ctx) {
  const { venture, memory } = ctx;
  const a = venture.analysis || {};
  const p = pnlForPeriod(venture, 'month');
  const tasks = venture.tasks || [];
  const open = tasks.filter(t => !t.done);
  const decisions = (memory?.decisions || []).slice(-4);
  return [
    `📋 Rapport — ${venture.name} (${a.businessType || 'général'}) · ${new Date().toLocaleDateString('fr-CA')}`,
    '',
    `◈ P&L (30 jours) : ${p.entries.length ? `${fmt$(p.total)} sur ${p.entries.length} entrée(s)${p.winRate != null ? ` · win rate ${p.winRate}%` : ''}` : 'aucune donnée — dis-moi tes gains/pertes et je les suis.'}`,
    `✧ Objectifs : ${a.objectives?.length ? a.objectives.join(' · ') : 'à définir'}`,
    `◉ KPIs : ${a.kpis?.length ? a.kpis.slice(0, 3).join(' · ') : 'à définir'}`,
    `☰ Tâches : ${tasks.length ? `${open.length} ouverte(s), ${tasks.length - open.length} terminée(s)` : 'aucune'}`,
    `◬ Risques : ${a.risks?.length ? a.risks.join(' · ') : 'aucun identifié'}`,
    decisions.length ? `❖ Décisions récentes : ${decisions.map(d => d.text.slice(0, 70)).join(' · ')}` : '❖ Aucune décision récente en mémoire.',
    '',
    `➤ Ma recommandation : ${open.length ? `finis « ${open[0].text} »` : a.objectives?.[0] ? `avance sur « ${a.objectives[0].slice(0, 80)} »` : 'fixe l’objectif principal de la semaine'}.`,
  ].join('\n');
}

// §10 — Find the bottleneck : ce qui bloque la croissance ou l'exécution.
export function findBottleneck(ctx) {
  const { venture, memory } = ctx;
  const a = venture.analysis || {};
  const tasks = (venture.tasks || []).filter(t => !t.done);
  const staleTasks = tasks.filter(t => (Date.now() - new Date(t.at)) > 3 * 24 * 3600 * 1000);
  const candidates = [];
  if (staleTasks.length) candidates.push(`⏳ ${staleTasks.length} tâche(s) ouvertes depuis plus de 3 jours — la plus vieille : « ${staleTasks[0].text} ». C'est probablement là que ça coince.`);
  if (a.risks?.length) candidates.push(`◬ Ton Masterplan nomme ce risque : « ${a.risks[0]} ». S'il est actif, c'est ton goulot.`);
  const p = pnlForPeriod(venture, 'month');
  if (p.entries.length && p.total < 0) candidates.push(`◈ Ton P&L 30 jours est négatif (${fmt$(p.total)}) — le bottleneck est dans l'exécution, pas dans le plan.`);
  if (!candidates.length) candidates.push('Rien d’évident dans mes données. Raconte-moi ta semaine — je vais trouver où ça accroche.');
  return ['🔍 Bottleneck scan :', ...candidates].join('\n');
}

const dateFR = (iso) => new Date(iso).toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' });

// ---- Moteur local : réponses contextuelles sans API ----
export function localAnswer(message, ctx) {
  const lower = message.toLowerCase();
  const { venture, memory } = ctx;
  const a = venture?.analysis || {};

  if (/pourquoi/.test(lower)) {
    const decisions = memory?.decisions?.slice(-3) || [];
    const facts = memory?.facts?.slice(0, 2) || [];
    if (decisions.length || facts.length) {
      const parts = ['Voici ce que ma mémoire me dit :'];
      for (const f of facts) parts.push(`— Dans le Masterplan, tu avais posé : « ${f.text.slice(0, 140)} »`);
      for (const d of decisions) parts.push(`— Le ${dateFR(d.at)}, on avait décidé : « ${d.text.slice(0, 140)} »`);
      return parts.join('\n');
    }
  }

  if (/(prochaine action|next action|what should i do|quoi faire|par où)/.test(lower)) {
    const obj = a.objectives?.[0];
    const risk = a.risks?.[0];
    return [
      `Pour ${venture.name}, voici ce que je recommande maintenant :`,
      obj ? `1. Avance sur ton objectif : ${obj}` : '1. Clarifie ton objectif principal — dis-le-moi et je le grave en mémoire.',
      risk ? `2. Garde un œil sur ce risque : ${risk}` : '2. Vérifie tes chiffres de la semaine dans la vue Performance.',
      '3. Dis-moi ce que tu as accompli et je mets la mémoire à jour.',
    ].join('\n');
  }

  if (/(risque|risk)/.test(lower)) {
    if (a.risks?.length) return `D'après ton Masterplan, tes risques principaux sont :\n${a.risks.map(r => `— ${r}`).join('\n')}\nJe les surveille dans le Risk Radar.`;
    return 'Ton Masterplan ne liste pas encore de risques. Dis-moi ce qui t’inquiète et je l’ajoute au Risk Radar.';
  }

  if (/(résume|resume|summary|semaine)/.test(lower)) {
    const decisions = memory?.decisions?.slice(-5) || [];
    return [
      `Résumé pour ${venture.name} :`,
      `— Type : ${a.businessType || 'général'} · ${venture.views?.length || 0} vues actives au cockpit`,
      a.objectives?.[0] ? `— Objectif : ${a.objectives[0]}` : null,
      decisions.length ? `— Dernières décisions : ${decisions.map(d => d.text.slice(0, 60)).join(' · ')}` : '— Aucune décision enregistrée cette semaine.',
      '— Prochaine étape : dis-moi tes chiffres et je les intègre.',
    ].filter(Boolean).join('\n');
  }

  if (/(kpi|métrique|chiffre|objectif|goal)/.test(lower)) {
    if (a.kpis?.length) return `Voici ce qu'on suit pour ${venture.name} :\n${a.kpis.map(k => `— ${k}`).join('\n')}`;
    return 'On n’a pas encore défini de KPIs précis. Dis-moi les 3 chiffres qui comptent le plus et je les mets au cockpit.';
  }

  // Réponse générale — Trillion reste présente et honnête.
  return [
    `Je t'écoute. Je garde ${venture ? `le contexte de ${venture.name}` : 'le contexte général'} en tête${memory?.decisions?.length ? ` — avec ${memory.decisions.length} décision(s) en mémoire` : ''}.`,
    'Je peux modifier ton cockpit (« ajoute une vue fournisseurs »), te dire ta prochaine action, résumer la semaine, ou graver une décision.',
    'Branche une clé ANTHROPIC_API_KEY côté serveur et je réponds à absolument tout, en profondeur.',
  ].join('\n');
}

// ---- Moteur Claude : Trillion répond à tout, avec le contexte du venture (§9) ----
let anthropicClient; // lazy singleton

async function getClaude() {
  if (anthropicClient !== undefined) return anthropicClient;
  if (!process.env.ANTHROPIC_API_KEY) { anthropicClient = null; return null; }
  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    anthropicClient = new Anthropic();
  } catch {
    anthropicClient = null; // SDK absent → moteur local
  }
  return anthropicClient;
}

export async function isClaudeAvailable() { return Boolean(await getClaude()); }

function systemPrompt(ctx) {
  const { venture, memory } = ctx;
  const a = venture?.analysis || {};
  const memLines = [
    ...(memory?.facts || []).map(f => `[${dateFR(f.at)}] FAIT (${f.source}): ${f.text}`),
    ...(memory?.decisions || []).map(d => `[${dateFR(d.at)}] DÉCISION: ${d.text}`),
  ].slice(-40).join('\n');
  return [
    'Tu es Trillion — la présence intelligente vivante d’un command center premium. Élégante, calme, puissante, chaleureuse et directe.',
    'Tu réponds à tout : business d’abord avec le contexte du venture actif, mais aussi toute question générale.',
    'Réponds dans la langue de l’utilisateur (français québécois naturel si le message est en français). Sois concrète : chiffres, prochaines actions, pas de blabla.',
    'Quand tu expliques une recommandation passée, cite la mémoire avec ses dates (« Le 12 avril, on avait décidé… »).',
    venture ? [
      `\n== VENTURE ACTIF : ${venture.name} (type: ${a.businessType || 'général'}) ==`,
      a.objectives?.length ? `Objectifs: ${a.objectives.join(' | ')}` : '',
      a.kpis?.length ? `KPIs: ${a.kpis.join(' | ')}` : '',
      a.risks?.length ? `Risques: ${a.risks.join(' | ')}` : '',
      venture.views?.length ? `Vues du cockpit: ${venture.views.join(', ')}` : '',
      venture.masterplan ? `\n== MASTERPLAN ==\n${venture.masterplan.slice(0, 6000)}` : '',
      memLines ? `\n== MÉMOIRE VIVANTE (citable avec dates) ==\n${memLines}` : '',
    ].filter(Boolean).join('\n') : '\n(Aucun venture actif — conversation générale.)',
  ].join('\n');
}

export async function claudeAnswer(message, ctx, history = []) {
  const client = await getClaude();
  if (!client) return null;
  const messages = [
    ...history.slice(-12).map(m => ({ role: m.role === 'trillion' ? 'assistant' : 'user', content: m.text })),
    { role: 'user', content: message },
  ];
  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 2048,
    system: [{ type: 'text', text: systemPrompt(ctx), cache_control: { type: 'ephemeral' } }],
    messages,
  });
  return response.content.filter(b => b.type === 'text').map(b => b.text).join('\n') || null;
}

// Point d'entrée : Trillion répond.
// Priorité : quick actions (§10) > commande dashboard (§6) > P&L log (§12) > mémoire > Claude > local.
export async function respond(message, ctx, history = []) {
  const lower = message.toLowerCase();
  const decision = detectDecision(message);
  const notes = [];
  if (decision && ctx.venture) {
    await ctx.store.rememberDecision(ctx.venture.id, decision);
    ctx.memory = await ctx.store.memory(ctx.venture.id);
    notes.push('🖋 Gravé dans la mémoire vivante.');
  }

  if (ctx.venture) {
    // §10 — quick actions à vrai but
    if (/build a report|bâtis un rapport|fais(-| )moi un rapport/.test(lower)) {
      return { text: [buildReport(ctx), ...notes].join('\n\n'), dashboardChanged: false, report: true };
    }
    if (/find the bottleneck|goulot|qu'est-ce qui bloque|what blocks/.test(lower)) {
      return { text: [findBottleneck(ctx), ...notes].join('\n\n'), dashboardChanged: false };
    }
    const task = parseTaskCommand(message);
    if (task) {
      const text = task.text
        || history.filter(m => m.role === 'user').at(-1)?.text?.slice(0, 120)
        || null;
      if (!text) return { text: 'Dis-moi la tâche à créer : « Create a task : relancer les 5 leads chauds ».', dashboardChanged: false };
      ctx.venture.tasks = ctx.venture.tasks || [];
      ctx.venture.tasks.push({ id: `t-${Date.now().toString(36)}`, text, done: false, at: new Date().toISOString() });
      if (!ctx.venture.views.includes('tasks')) ctx.venture.views.push('tasks');
      await ctx.store.upsertVenture(ctx.venture);
      return { text: [`☰ Tâche créée : « ${text} ». Elle est suivable dans la vue Tasks.`, ...notes].join('\n'), dashboardChanged: true };
    }

    // §6 — commande dashboard conversationnelle
    const cmd = parseDashboardCommand(message);
    if (cmd) {
      const { venture, reply } = applyDashboardCommand(ctx.venture, cmd);
      await ctx.store.upsertVenture(venture);
      return { text: [reply, ...notes].join('\n'), dashboardChanged: true, command: cmd };
    }

    // §12 — P&L conversationnel
    const pnl = parsePnlEntry(message);
    if (pnl) {
      ctx.venture.pnlLog = ctx.venture.pnlLog || [];
      ctx.venture.pnlLog.push({ at: new Date().toISOString(), ...pnl });
      if (!ctx.venture.views.includes('pnl')) ctx.venture.views.push('pnl');
      await ctx.store.upsertVenture(ctx.venture);
      const p = pnlForPeriod(ctx.venture, ctx.venture.period || 'week');
      return {
        text: [`◈ Noté : ${fmt$(pnl.amount)}. P&L ${PERIOD_LABEL[ctx.venture.period || 'week']} : ${fmt$(p.total)}.`, ...notes].join('\n'),
        dashboardChanged: true,
      };
    }
  }

  let text = null;
  try { text = await claudeAnswer(message, ctx, history); }
  catch { text = null; /* API indisponible → moteur local, jamais de crash */ }
  if (!text) text = localAnswer(message, ctx);

  return { text: [text, ...notes].join('\n\n'), dashboardChanged: false };
}

const PERIOD_LABEL = { day: 'du jour', week: 'de la semaine', month: 'du mois', year: 'de l’année', lifetime: 'lifetime' };
