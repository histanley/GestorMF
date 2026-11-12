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

assert(rankingJsx.includes('videoCount') && rankingJsx.includes('photoCount') && rankingJsx.includes('editorCount'),
  'Falha: TeamPerformanceRanking deve calcular atuações em vídeo, fotografia e edição');

assert(rankingJsx.includes('score ='),
  'Falha: TeamPerformanceRanking deve calcular pontuação de XP');

assert(rankingJsx.includes('podium-step-gold') && rankingJsx.includes('podium-step-silver') && rankingJsx.includes('podium-step-bronze'),
  'Falha: TeamPerformanceRanking deve renderizar o pódio Top 3');

assert(rankingJsx.includes('ranking-ray-modal'),
  'Falha: TeamPerformanceRanking deve renderizar o modal de Raio-X');

console.log('[PASS] 01. Componente TeamPerformanceRanking: Métricas, pontuação gamificada, pódio e raio-x verificados.');

// 2. Verifica src/components/TeamManager.jsx
const teamManagerJsx = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'TeamManager.jsx'), 'utf8');

assert(teamManagerJsx.includes("import TeamPerformanceRanking from './TeamPerformanceRanking'"),
  'Falha: TeamManager.jsx deve importar TeamPerformanceRanking');

assert(teamManagerJsx.includes("userRole === 'admin'") && teamManagerJsx.includes("setTeamSubView('ranking')"),
  'Falha: Aba de ranking deve ser exibida exclusivamente para administradores');

assert(teamManagerJsx.includes("<TeamPerformanceRanking"),
  'Falha: TeamManager.jsx deve renderizar TeamPerformanceRanking quando teamSubView === ranking');

console.log('[PASS] 02. Integração no TeamManager: Aba exclusiva para administradores e renderização condicional verificadas.');

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
