// ==============================================================================
// GestorMF - Teste Automatizado: Central do Administrador & Arquitetura de Menus
// ==============================================================================
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log('  TESTE: CENTRAL DO ADMINISTRADOR & ARQUITETURA DE MENUS         ');
console.log('================================================================\n');

// 1. Verifica App.jsx
const appJsx = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.jsx'), 'utf8');

assert(appJsx.includes("import AdminCenter from './components/AdminCenter'"),
  'Falha: App.jsx deve importar AdminCenter');

assert(appJsx.includes("isAdminUser ?") && appJsx.includes("Central do Admin") && appJsx.includes("Meu Espaço"),
  'Falha: App.jsx deve exibir condicionalmente "Central do Admin" para administradores e "Meu Espaço" para colaboradores');

assert(appJsx.includes("activeTab === 'admin' && isAdminUser && (") && appJsx.includes("<AdminCenter"),
  'Falha: App.jsx deve renderizar AdminCenter quando activeTab for admin e o usuário for administrador');

assert(appJsx.includes("activeTab === 'me' && !isAdminUser && (") && appJsx.includes("<CollaboratorSpace"),
  'Falha: App.jsx deve renderizar CollaboratorSpace apenas quando não for administrador');

console.log('[PASS] 01. App.jsx: Arquitetura de menus condicional (Admin vs Colaborador) verificada.');

// 2. Verifica AdminCenter.jsx
const adminCenterJsx = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'AdminCenter.jsx'), 'utf8');

assert(adminCenterJsx.includes("TeamPayoutsDashboard"),
  'Falha: AdminCenter.jsx deve conter TeamPayoutsDashboard');

assert(adminCenterJsx.includes("TeamPerformanceRanking"),
  'Falha: AdminCenter.jsx deve conter TeamPerformanceRanking');

assert(adminCenterJsx.includes("Aprovações de Horas Extras") && adminCenterJsx.includes("Diárias") && adminCenterJsx.includes("Fechamento") && adminCenterJsx.includes("Inteligência") && adminCenterJsx.includes("Ranking"),
  'Falha: AdminCenter.jsx deve conter as 3 sub-abas solicitadas');

assert(adminCenterJsx.includes("handleAction(req.missionId, req.id, 'APPROVE')") && adminCenterJsx.includes("handleAction(req.missionId, req.id, 'REJECT')"),
  'Falha: AdminCenter.jsx deve implementar aprovação e recusa centralizada de horas extras');

console.log('[PASS] 02. AdminCenter.jsx: Sub-abas de Aprovação de Horas Extras, Diárias & Fechamento e Inteligência & Ranking validadas.');

// 3. Verifica TeamManager.jsx
const teamManagerJsx = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'TeamManager.jsx'), 'utf8');

assert(!teamManagerJsx.includes("teamSubView === 'ranking'"),
  'Falha: TeamManager.jsx não deve mais conter a subvisão de ranking');

assert(!teamManagerJsx.includes("teamSubView === 'payouts'"),
  'Falha: TeamManager.jsx não deve mais conter a subvisão de fechamento/diárias');

console.log('[PASS] 03. TeamManager.jsx: Removidas informações de Ranking e Fechamento da tela de Equipes.');

console.log('\nTODOS OS TESTES DA CENTRAL DO ADMINISTRADOR PASSARAM COM SUCESSO!\n');
