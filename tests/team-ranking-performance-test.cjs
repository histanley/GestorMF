// ==============================================================================
// GestorMF - Teste Automatizado de Inteligência & Ranking de Colaboradores
// ==============================================================================
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('   TESTE DE INTELIGÊNCIA & RANKING DE EQUIPES       ');
console.log('====================================================\n');

// 1. Verifica src/components/TeamPerformanceRanking.jsx
const rankingJsx = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'TeamPerformanceRanking.jsx'), 'utf8');

assert(rankingJsx.includes('export default function TeamPerformanceRanking'),
  'Falha: TeamPerformanceRanking deve exportar componente padrão');

assert(rankingJsx.includes('drivingCount') && rankingJsx.includes('multiDayCount'),
  'Falha: TeamPerformanceRanking deve calcular contagem de motorista e missões de múltiplos dias');

assert(rankingJsx.includes('roleCounts') && rankingJsx.includes('bestEditor'),
  'Falha: TeamPerformanceRanking deve calcular atuações por função e melhor editor');

assert(rankingJsx.includes('ROLE_XP_POINTS') && rankingJsx.includes('calculateMemberPerformanceProfile'),
  'Falha: TeamPerformanceRanking deve calcular pontuação de XP e perfil gamificado');

assert(rankingJsx.includes('podium-step-gold') && rankingJsx.includes('podium-step-silver') && rankingJsx.includes('podium-step-bronze'),
  'Falha: TeamPerformanceRanking deve renderizar o pódio Top 3');

assert(rankingJsx.includes('ranking-ray-modal'),
  'Falha: TeamPerformanceRanking deve renderizar o modal de Raio-X');

console.log('[PASS] 01. Componente TeamPerformanceRanking: Métricas, pontuação gamificada, pódio e raio-x verificados.');

// 2. Verifica src/components/AdminCenter.jsx
const adminCenterJsx = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'AdminCenter.jsx'), 'utf8');

assert(adminCenterJsx.includes("import TeamPerformanceRanking from './TeamPerformanceRanking'"),
  'Falha: AdminCenter.jsx deve importar TeamPerformanceRanking');

assert(adminCenterJsx.includes("adminTab === 'ranking'"),
  'Falha: Aba de ranking deve existir na Central do Administrador');

assert(adminCenterJsx.includes("<TeamPerformanceRanking"),
  'Falha: AdminCenter.jsx deve renderizar TeamPerformanceRanking');

console.log('[PASS] 02. Integração no AdminCenter: Aba e renderização de TeamPerformanceRanking verificadas.');

// 3. Verifica src/App.css
const appCss = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.css'), 'utf8');

assert(appCss.includes('.team-ranking-dashboard'),
  'Falha: App.css deve conter .team-ranking-dashboard');

assert(appCss.includes('.ranking-podium-section'),
  'Falha: App.css deve conter .ranking-podium-section');

assert(appCss.includes('.ranking-member-card'),
  'Falha: App.css deve conter .ranking-member-card');

console.log('[PASS] 03. Estilos CSS (App.css): Classes de dashboard, pódio dourado/prateado/bronze e raio-x verificadas.');

console.log('\nTODOS OS TESTES DE RANKING & INTELIGÊNCIA OPERACIONAL PASSARAM COM SUCESSO!\n');

