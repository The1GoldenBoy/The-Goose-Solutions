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

// §24 — « Leçon : ne jamais trader le dimanche soir » → Lessons/ du Vault + mémoire.
export function parseLesson(text) {
  const m = text.match(/^\s*le[çc]on\s*[:\-—]\s*(.+)/i);
  return m ? m[1].trim() : null;
}

// §21 — les alertes se coupent par conversation, jamais par panneau de réglages.
export function parseAlertSetting(text) {
  const lower = text.toLowerCase().replace(/’/g, "'");
  if (!/alerte|notification/.test(lower)) return null;
  if (/(plus|pas|arrête|coupe|stop).*(weekend|week-end|fin de semaine)/.test(lower)) {
    return { alerts: { quietWeekends: true }, reply: 'Compris — plus d’alertes le weekend. Je garde le silence, sauf si quelque chose devient critique.' };
  }
  if (/(réactive|remets|remet|reprends|réveille)/.test(lower)) {
    return { alerts: { enabled: true, quietWeekends: false }, reply: 'Les alertes sont réactivées. Je reprends la garde, sept jours sur sept.' };
  }
  if (/(plus d'alertes|pas d'alertes|coupe les alertes|arrête les alertes|stop les alertes)/.test(lower)) {
    return { alerts: { enabled: false }, reply: 'D’accord, je coupe les alertes. Je ne parlerai que si quelque chose devient vraiment critique — c’est ma seule exception.' };
  }
  return null;
}

// §24 — « Trillion, cette décision du 12 avril n'est plus vraie » → révocation datée.
const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export function parseMemoryRevoke(text) {
  const lower = text.toLowerCase().replace(/’/g, "'");
  if (!/(n'est plus (vraie?|valide)|ne tient plus|annule (cette|la|ma) décision|révoque)/.test(lower)) return null;
  const revoke = {};
  const md = lower.match(/du\s+(\d{1,2})(?:er)?\s+([a-zéûô]+)/);
  if (md && MONTHS_FR.includes(md[2])) revoke.day = Number(md[1]), revoke.month = MONTHS_FR.indexOf(md[2]);
  const quote = text.match(/[«"]([^»"]{4,})[»"]/);
  if (quote) revoke.quote = quote[1].trim();
  return revoke;
}

// §23 — débrancher une source se fait aussi par conversation.
export function parseSourceDisconnect(text) {
  const lower = text.toLowerCase();
  if (/(débranche|debranche|déconnecte|enlève|retire).*(stripe)/.test(lower)) return { source: 'stripe' };
  if (/(débranche|debranche|déconnecte|enlève|retire).*(csv|l'import|import)/.test(lower)) return { source: 'csv' };
  return null;
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
    const decisions = (memory?.decisions || []).filter(d => !d.revokedAt).slice(-3);
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
    const lesson = memory?.lessons?.at(-1); // §24 — la Vigie ressort la leçon au bon moment
    return [
      `Pour ${venture.name}, voici ce que je recommande maintenant :`,
      obj ? `1. Avance sur ton objectif : ${obj}` : '1. Clarifie ton objectif principal — dis-le-moi et je le grave en mémoire.',
      risk ? `2. Garde un œil sur ce risque : ${risk}` : '2. Vérifie tes chiffres de la semaine dans la vue Performance.',
      '3. Dis-moi ce que tu as accompli et je mets la mémoire à jour.',
      lesson ? `⟁ Et rappelle-toi ta leçon du ${dateFR(lesson.at)} : « ${lesson.text} »` : null,
    ].filter(Boolean).join('\n');
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
    ...(memory?.decisions || []).map(d => `[${dateFR(d.at)}] DÉCISION${d.revokedAt ? ` (RÉVOQUÉE le ${dateFR(d.revokedAt)} — ne plus s'y fier, mais citable comme historique)` : ''}: ${d.text}`),
    ...(memory?.lessons || []).map(l => `[${dateFR(l.at)}] LEÇON (à ressortir quand une décision la contredit): ${l.text}`),
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

  // §21 — réglage des alertes par conversation (« plus d'alertes le weekend »)
  const alertSetting = parseAlertSetting(message);
  if (alertSetting) {
    await ctx.store.saveSettings({ alerts: alertSetting.alerts });
    return { text: [alertSetting.reply, ...notes].join('\n'), dashboardChanged: false };
  }

  if (ctx.venture) {
    // §24 — Leçon : gravée en mémoire + Lessons.md du Vault, la Vigie la ressortira.
    const lesson = parseLesson(message);
    if (lesson) {
      await ctx.store.rememberLesson(ctx.venture.id, lesson);
      const safeName = ctx.venture.name.replace(/[/\\:]/g, '-');
      await ctx.store.appendVaultNote(`Ventures/${safeName}/Lessons.md`, `- ${new Date().toISOString().slice(0, 10)} — ${lesson}`);
      return { text: [`⟁ Leçon gravée : « ${lesson} ». Je te la ressortirai au bon moment.`, ...notes].join('\n'), dashboardChanged: false };
    }

    // §24 — la mémoire qui se corrige : révoquer une décision, jamais l'effacer.
    const revoke = parseMemoryRevoke(message);
    if (revoke) {
      const match = (d) => {
        const at = new Date(d.at);
        if (revoke.quote) return d.text.toLowerCase().includes(revoke.quote.toLowerCase());
        if (revoke.day != null) return at.getDate() === revoke.day && at.getMonth() === revoke.month;
        return true; // sans précision : la décision la plus récente
      };
      const target = await ctx.store.revokeDecision(ctx.venture.id, match);
      if (!target) {
        return { text: 'Je ne retrouve pas cette décision dans ma mémoire. Cite-moi sa date (« du 12 avril ») ou un bout de son texte entre « guillemets ».', dashboardChanged: false };
      }
      const safeName = ctx.venture.name.replace(/[/\\:]/g, '-');
      await ctx.store.appendVaultNote(`Ventures/${safeName}/Decisions.md`, `- ${new Date().toISOString().slice(0, 10)} — RÉVOQUÉE : « ${target.text.slice(0, 120)} » (décision du ${dateFR(target.at)})`);
      ctx.memory = await ctx.store.memory(ctx.venture.id);
      return {
        text: [`🖋 C'est corrigé. La décision du ${dateFR(target.at)} — « ${target.text.slice(0, 100)} » — est archivée comme révoquée aujourd'hui. L'historique reste, la vérité change.`, ...notes].join('\n'),
        dashboardChanged: false,
      };
    }

    // §23 — débrancher une source de données par conversation.
    const disconnect = parseSourceDisconnect(message);
    if (disconnect) {
      const before = (ctx.venture.pnlLog || []).length;
      ctx.venture.pnlLog = (ctx.venture.pnlLog || []).filter(e => e.source !== disconnect.source);
      ctx.venture.sources = (ctx.venture.sources || []).filter(s => s.type !== disconnect.source);
      await ctx.store.upsertVenture(ctx.venture);
      const removed = before - ctx.venture.pnlLog.length;
      const label = disconnect.source === 'stripe' ? 'Stripe débranché' : 'Import CSV débranché';
      return { text: [`⏏ ${label} — ${removed} entrée(s) retirées du P&L. Ce que tu m'as dit en conversation reste intact.`, ...notes].join('\n'), dashboardChanged: true };
    }

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
      // §23 — provenance : un chiffre dit en conversation est marqué comme tel.
      ctx.venture.pnlLog.push({ at: new Date().toISOString(), source: 'conversation', ...pnl });
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
