// Trillion — analyse de Masterplan (§5 du Master Plan Trillion).
// « Ajoute une entreprise. Donne son Masterplan à Trillion. Elle construit le cockpit. »
// Déterministe et local : Trillion comprend le type d'entreprise, le modèle de revenus,
// les objectifs, KPIs, opérations, risques, et recommande le dashboard sur mesure.
// Règle §4 : type d'entreprise + masterplan + objectifs + opérations + KPIs + données disponibles —
// deux entreprises du même type peuvent recevoir des dashboards différents.

// Catalogue de vues que Trillion sait construire (§12-14 du Master Plan).
export const VIEW_CATALOG = {
  communication: { id: 'communication', name: 'Communication Center', icon: '✦' },
  pnl: { id: 'pnl', name: 'P&L', icon: '◈' },
  performance: { id: 'performance', name: 'Performance', icon: '◉' },
  positions: { id: 'positions', name: 'Positions', icon: '⬖' },
  market: { id: 'market', name: 'Market Board', icon: '⬡' },
  risk: { id: 'risk', name: 'Risk Radar', icon: '◬' },
  strategy: { id: 'strategy', name: 'Strategy Journal', icon: '✧' },
  memory: { id: 'memory', name: 'Living Memory', icon: '❖' },
  tasks: { id: 'tasks', name: 'Tasks', icon: '☰' },
  pipeline: { id: 'pipeline', name: 'Pipeline', icon: '⟁' },
  nextactions: { id: 'nextactions', name: 'Next Actions', icon: '➤' },
  scripts: { id: 'scripts', name: 'Scripts / Objections', icon: '✎' },
  clients: { id: 'clients', name: 'Customer Follow-up', icon: '◭' },
  suppliers: { id: 'suppliers', name: 'Suppliers', icon: '⬢' },
  orders: { id: 'orders', name: 'Orders', icon: '▣' },
  inventory: { id: 'inventory', name: 'Inventory', icon: '⧈' },
  ads: { id: 'ads', name: 'Ads / Acquisition', icon: '◎' },
  productperf: { id: 'productperf', name: 'Product Performance', icon: '⬗' },
  mrr: { id: 'mrr', name: 'MRR & Churn', icon: '∿' },
  agents: { id: 'agents', name: 'Agents', icon: '⟠' },
};

// §12 Trading · §13 Acquisition/CRM · §14 Produit/E-commerce — chaque type a son cockpit.
const TYPE_RULES = [
  { type: 'trading', words: ['trading', 'trader', 'crypto', 'bourse', 'stock', 'actions', 'portfolio', 'investissement', 'investing', 'forex'], views: ['pnl', 'positions', 'market', 'risk', 'strategy', 'performance'] },
  { type: 'saas', words: ['saas', 'abonnement', 'subscription', 'mrr', 'churn', 'app ', 'logiciel', 'software', 'plateforme'], views: ['mrr', 'performance', 'pnl', 'pipeline', 'tasks', 'risk'] },
  { type: 'ecommerce', words: ['ecommerce', 'e-commerce', 'boutique', 'shopify', 'produit', 'inventaire', 'stock ', 'dropship', 'commande'], views: ['orders', 'inventory', 'ads', 'productperf', 'clients', 'pnl'] },
  { type: 'agency', words: ['agence', 'agency', 'client', 'service', 'consultation', 'consulting', 'lead', 'prospect', 'mandat', 'contrat', 'réceptionniste', 'receptionist'], views: ['pipeline', 'nextactions', 'tasks', 'performance', 'scripts'] },
  { type: 'restaurant', words: ['restaurant', 'menu', 'cuisine', 'food', 'traiteur', 'café'], views: ['pnl', 'orders', 'suppliers', 'performance', 'risk'] },
  { type: 'immobilier', words: ['immobilier', 'real estate', 'loyer', 'locataire', 'propriété', 'flip', 'rental'], views: ['positions', 'pnl', 'pipeline', 'risk', 'strategy'] },
];

const money = (text) => {
  const matches = text.match(/\$?\s?\d[\d\s,.]*\s?(?:\$|k\$?|m\$?|CAD|USD|€)(?:\s|\/|$|\.|,)/gim) || [];
  return matches.map(m => m.trim().replace(/[.,]$/, '')).slice(0, 6);
};

const linesMatching = (text, words) =>
  text.split('\n')
    .map(l => l.replace(/^[-*•#\d.\s]+/, '').trim())
    .filter(l => l.length > 6 && l.length < 220 && words.some(w => l.toLowerCase().includes(w)))
    .slice(0, 6);

// Analyse complète d'un masterplan (texte libre).
export function analyzeMasterplan(text, { name = null } = {}) {
  const lower = text.toLowerCase();

  // Type d'entreprise
  let best = { type: 'general', views: ['performance', 'pnl', 'tasks', 'risk', 'strategy'], score: 0 };
  for (const rule of TYPE_RULES) {
    const score = rule.words.reduce((n, w) => n + (lower.split(w).length - 1), 0);
    if (score > best.score) best = { ...rule, score };
  }

  // Nom du venture : 1re ligne de titre, ou fourni
  const firstLine = text.split('\n').map(l => l.replace(/^[#\s]+/, '').trim()).find(l => l.length > 1) || 'Nouveau projet';
  const ventureName = name || (firstLine.length <= 48 ? firstLine : firstLine.slice(0, 45) + '…');

  const objectives = linesMatching(text, ['objectif', 'goal', 'but ', 'cible', 'target', 'mission', 'vision', 'atteindre', 'revenu', 'revenue']);
  const kpis = [...new Set([
    ...linesMatching(text, ['kpi', 'métrique', 'metric', 'mesurer', 'suivre', 'track']),
    ...money(text).map(m => `Cible financière : ${m}`),
  ])].slice(0, 8);
  const risks = linesMatching(text, ['risque', 'risk', 'danger', 'menace', 'blocage', 'blocker', 'faiblesse', 'weakness']);
  const operations = linesMatching(text, ['opération', 'operation', 'process', 'workflow', 'étape', 'production', 'livraison', 'delivery']);
  const revenueModel = linesMatching(text, ['prix', 'price', 'pricing', 'facturation', 'abonnement', 'commission', 'marge', 'vendre', 'sell', '$/']);

  // Vues recommandées : base type + modulées par le contenu du plan (règle §4)
  const views = ['communication', ...best.views];
  if (risks.length && !views.includes('risk')) views.push('risk');
  if ((lower.includes('tâche') || lower.includes('task') || lower.includes('todo')) && !views.includes('tasks')) views.push('tasks');
  if ((lower.includes('agent') || lower.includes('automation') || lower.includes('bot')) && !views.includes('agents')) views.push('agents');
  views.push('strategy', 'memory');
  const uniqueViews = [...new Set(views)].filter(v => VIEW_CATALOG[v]);

  // Quick actions concrètes (§10 : pas de tags abstraits)
  const quickActions = buildQuickActions(best.type, ventureName, kpis);

  return {
    name: ventureName,
    businessType: best.type,
    confidence: Math.min(1, best.score / 4),
    objectives, kpis, risks, operations, revenueModel,
    recommendedViews: uniqueViews,
    quickActions,
    suggestedAgents: suggestAgents(best.type),
  };
}

function suggestAgents(type) {
  const base = ['Analyste performance', 'Gardien des risques'];
  const byType = {
    trading: ['Scanner de marché', 'Journal de trades'],
    saas: ['Suivi churn', 'Onboarding clients'],
    ecommerce: ['Suivi commandes', 'Relance fournisseurs'],
    agency: ['Relance leads', 'Suivi follow-ups'],
    restaurant: ['Suivi coûts matière', 'Réservations'],
    immobilier: ['Veille marché', 'Suivi loyers'],
    general: ['Assistant opérations'],
  };
  return [...(byType[type] || []), ...base];
}

// §10 : quick actions à vrai but — plus simples, plus concrètes, plus utiles.
// Build a report · Find the bottleneck · What should I do next? · Create a task
// + une action contextuelle selon le type d'entreprise.
export function buildQuickActions(type, ventureName, kpis = []) {
  const canonical = [
    'Build a report',
    'Find the bottleneck',
    'What should I do next?',
    'Create a task',
  ];
  const byType = {
    trading: 'Quel est mon P&L du mois ?',
    saas: 'Comment va mon MRR ce mois-ci ?',
    ecommerce: 'Quelles commandes sont en retard ?',
    agency: 'Quels leads dois-je relancer aujourd’hui ?',
    restaurant: 'Quel est mon food cost cette semaine ?',
    immobilier: 'Quels loyers sont en retard ?',
    general: 'Où sont mes plus gros risques ?',
  };
  return [...canonical, byType[type] || byType.general];
}

// §6 : étapes du build progressif — l'utilisateur voit Trillion construire le cockpit.
export function buildSteps(analysis) {
  const viewSteps = analysis.recommendedViews
    .filter(v => v !== 'communication')
    .map(v => ({ label: `Creating ${VIEW_CATALOG[v].name}…`, view: v }));
  return [
    { label: 'Analyzing masterplan…' },
    { label: `Identifying business model… ${analysis.businessType}` },
    { label: 'Selecting dashboard views…' },
    { label: 'Creating Communication Center…', view: 'communication' },
    ...viewSteps,
    { label: 'Building Living Memory…' },
    { label: `Assigning agents… ${analysis.suggestedAgents.slice(0, 2).join(', ')}` },
    { label: 'Dashboard ready.' },
  ];
}

// §5 Chemin B · §25 : trois questions au lieu de six — le wow en moins de deux minutes.
// Pas un formulaire froid — une conversation. Trois de plus, optionnelles, pour aiguiser.
export const INTERVIEW = [
  { key: 'vision', q: 'Qu’est-ce que tu veux bâtir ? Raconte-moi l’idée comme à une amie.' },
  { key: 'money', q: 'Comment tu fais de l’argent avec ça ? (prix, abonnement, commission…)' },
  { key: 'goal', q: 'C’est quoi l’objectif principal — le chiffre qui te ferait dire « on a réussi » ?' },
];

export const INTERVIEW_DEEP = [
  { key: 'client', q: 'Qui est ton client idéal ? Et qu’est-ce que tu lui vends exactement ?' },
  { key: 'track', q: 'Qu’est-ce qu’on doit suivre chaque semaine ? Quelles décisions ce dashboard doit t’aider à prendre ?' },
  { key: 'risks', q: 'Où sont les risques ? Qu’est-ce qui bloque la croissance en ce moment ?' },
];

// Assemble un Masterplan propre à partir des réponses d'interview (Chemin B).
// §25 : les sections sans réponse disparaissent — jamais de trous « — » dans le plan.
export function draftMasterplan(answers) {
  const get = (k) => answers[k]?.trim() || null;
  const title = ((get('vision') || 'Nouveau projet').split(/[.!\n]/)[0] || 'Nouveau projet').slice(0, 60);
  const sections = [
    ['Vision', get('vision')],
    ['Client & Offre', get('client')],
    ['Modèle de revenus', get('money')],
    ['Objectif principal', get('goal')],
    ['KPIs à suivre', get('track')],
    ['Risques & blocages', get('risks')],
  ];
  return [
    `# ${title}`,
    '',
    ...sections.filter(([, v]) => v).flatMap(([h, v]) => [`## ${h}`, v, '']),
  ].join('\n');
}
