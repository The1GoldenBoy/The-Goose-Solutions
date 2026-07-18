// Analyse de Masterplan : type d'entreprise, vues sur mesure, quick actions concrètes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeMasterplan, buildSteps, draftMasterplan, VIEW_CATALOG } from '../lib/analyzer.mjs';
import { parseDashboardCommand, applyDashboardCommand, detectDecision, localAnswer } from '../lib/trillion.mjs';

const TRADING_PLAN = `# Fonds Aurora
Objectif : atteindre 500 000$ de capital sous gestion en 12 mois.
Stratégie de trading crypto et actions, swing trading hebdomadaire.
KPI : suivre le P&L mensuel et le drawdown maximum.
Risque : volatilité extrême du marché crypto.
`;

const AGENCY_PLAN = `# Agence Nova
On vend un service de réceptionniste IA aux PME du Québec.
Objectif : 20 clients payants à 500$/mois d'ici décembre.
Suivre les leads, les follow-ups et le taux de conversion.
Risque : cycle de vente trop long.
`;

test('détecte un venture trading et recommande Positions + Market Board', () => {
  const a = analyzeMasterplan(TRADING_PLAN);
  assert.equal(a.businessType, 'trading');
  assert.equal(a.name, 'Fonds Aurora');
  assert.ok(a.recommendedViews.includes('positions'));
  assert.ok(a.recommendedViews.includes('market'));
  assert.ok(a.recommendedViews.includes('risk'));
  assert.ok(a.recommendedViews.includes('communication'));
  assert.ok(a.recommendedViews.includes('memory'));
  assert.ok(a.objectives.length >= 1);
  assert.ok(a.risks.some(r => r.toLowerCase().includes('volatilité')));
});

test('détecte une agence et recommande Pipeline + Next Actions (§13) — dashboards différents par masterplan (§4)', () => {
  const a = analyzeMasterplan(AGENCY_PLAN);
  assert.equal(a.businessType, 'agency');
  assert.ok(a.recommendedViews.includes('pipeline'));
  assert.ok(a.recommendedViews.includes('nextactions'));
  assert.ok(a.recommendedViews.includes('scripts'));
  assert.ok(!a.recommendedViews.includes('positions'));
  // Deux types différents → deux cockpits différents
  const t = analyzeMasterplan(TRADING_PLAN);
  assert.notDeepEqual(a.recommendedViews, t.recommendedViews);
});

test('quick actions à vrai but (§10) : les 4 canoniques + une contextuelle', () => {
  const a = analyzeMasterplan(AGENCY_PLAN);
  for (const canonical of ['Build a report', 'Find the bottleneck', 'What should I do next?', 'Create a task']) {
    assert.ok(a.quickActions.includes(canonical), `manquant: ${canonical}`);
  }
  assert.ok(a.quickActions.some(q => q.includes('leads')));
});

test('build progressif : commence par Analyzing, finit par Dashboard ready (§6)', () => {
  const steps = buildSteps(analyzeMasterplan(TRADING_PLAN));
  assert.match(steps[0].label, /Analyzing masterplan/);
  assert.match(steps.at(-1).label, /Dashboard ready/);
  assert.ok(steps.some(s => s.view === 'positions'));
});

test('chemin B : draftMasterplan assemble un plan analysable', () => {
  const md = draftMasterplan({
    vision: 'Une boutique en ligne de produits pour chiens.',
    client: 'Propriétaires de chiens au Canada, on vend des jouets durables.',
    money: 'Vente en ligne, marge de 60% par produit.',
    goal: 'Objectif : 10 000$ de ventes par mois.',
    track: 'Suivre les commandes et le panier moyen.',
    risks: 'Risque : dépendance à un seul fournisseur.',
  });
  assert.match(md, /## Vision/);
  const a = analyzeMasterplan(md);
  assert.equal(a.businessType, 'ecommerce');
  assert.ok(a.recommendedViews.includes('orders'));
});

test('commandes dashboard conversationnelles (§6)', () => {
  assert.deepEqual(parseDashboardCommand('Ajoute une vue fournisseurs'), { action: 'add_view', view: 'suppliers' });
  assert.deepEqual(parseDashboardCommand('Mets le P&L plus gros'), { action: 'resize_view', view: 'pnl', size: 'large' });
  assert.deepEqual(parseDashboardCommand('Ce projet n’a pas besoin de CRM'), { action: 'remove_view', view: 'clients' });
  assert.deepEqual(parseDashboardCommand('Passe la vue en mois'), { action: 'set_period', period: 'month' });
  assert.equal(parseDashboardCommand('Comment vas-tu ?'), null);

  const venture = { views: ['communication', 'pnl'], layout: {}, period: 'week' };
  const r1 = applyDashboardCommand(venture, { action: 'add_view', view: 'suppliers' });
  assert.ok(r1.venture.views.includes('suppliers'));
  assert.match(r1.reply, /Suppliers/);
  const r2 = applyDashboardCommand(venture, { action: 'remove_view', view: 'pnl' });
  assert.ok(!r2.venture.views.includes('pnl'));
});

test('mémoire : détection de décisions + réponses « pourquoi » citent les dates (§8)', () => {
  assert.ok(detectDecision('On décide de lancer le produit en septembre.'));
  assert.equal(detectDecision('Quel temps fait-il ?'), null);

  const venture = { name: 'Nova', analysis: analyzeMasterplan(AGENCY_PLAN), views: [] };
  const memory = {
    facts: [{ at: '2026-04-01T00:00:00Z', text: 'Objectif : 20 clients à 500$/mois', source: 'masterplan' }],
    decisions: [{ at: '2026-04-12T00:00:00Z', text: 'On part sur le pricing à 500$/mois', source: 'conversation' }],
  };
  const answer = localAnswer('Pourquoi Trillion avait recommandé ça ?', { venture, memory });
  assert.match(answer, /12 avril 2026/);
  assert.match(answer, /Masterplan/);
});

test('catalogue de vues : toutes les vues du plan existent', () => {
  for (const key of ['communication', 'pnl', 'positions', 'market', 'risk', 'strategy', 'memory']) {
    assert.ok(VIEW_CATALOG[key], `vue manquante: ${key}`);
  }
});
