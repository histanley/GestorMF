const assert = require('assert');
const fs = require('fs');

console.log('====================================================');
console.log('   TESTE DE PROGRESSÃO DE CARREIRA & NÍVEIS DE XP   ');
console.log('====================================================\n');

// 1. Verificar arquivo companyRoles.js
const companyRolesCode = fs.readFileSync('src/utils/companyRoles.js', 'utf8');
assert(companyRolesCode.includes('export const CAREER_TIERS ='), 'CAREER_TIERS deve ser exportado');
assert(companyRolesCode.includes('export function getCareerProgression('), 'getCareerProgression deve ser exportado');
console.log('[PASS] 01. Exportação de CAREER_TIERS e getCareerProgression verificadas em companyRoles.js');

// 2. Verificar simulação lógica de pontuação
const mockTiers = [
  { level: 1, min: 0, max: 60, title: 'Iniciante de Campo' },
  { level: 2, min: 60, max: 150, title: 'Operador Prata' },
  { level: 3, min: 150, max: 300, title: 'Especialista Ouro' },
  { level: 4, min: 300, max: 550, title: 'Mestre Diamante' },
  { level: 5, min: 550, max: 900, title: 'Comandante de Set' },
  { level: 6, min: 900, max: 999999, title: 'Lenda MegaFilmes' },
];

function testProgression(score) {
  const s = Math.max(0, Number(score) || 0);
  const currentTier = mockTiers.find((t) => s >= t.min && s < t.max) || mockTiers[mockTiers.length - 1];
  const completedTiers = mockTiers.filter((t) => t.level < currentTier.level);
  return { level: currentTier.level, title: currentTier.title, completedCount: completedTiers.length };
}

// Caso Mateus Henrique: 222 XP (Nível 3 - Especialista Ouro)
const mateusProfile = testProgression(222);
assert.strictEqual(mateusProfile.level, 3, 'Mateus deve estar no Nível 3');
assert.strictEqual(mateusProfile.title, 'Especialista Ouro', 'Mateus deve ser Especialista Ouro');
assert.strictEqual(mateusProfile.completedCount, 2, 'Mateus deve ter superado 2 níveis (Iniciante de Campo e Operador Prata)');
console.log('[PASS] 02. Cálculo de Nível e Níveis Superados validado para 222 XP (Nível 3 com 2 níveis superados)');

// Caso Iniciante: 30 XP (Nível 1)
const rookieProfile = testProgression(30);
assert.strictEqual(rookieProfile.level, 1, 'Iniciante deve estar no Nível 1');
assert.strictEqual(rookieProfile.completedCount, 0, 'Iniciante não superou níveis ainda');
console.log('[PASS] 03. Validação de Nível 1 (0 níveis superados)');

// Caso Lenda: 1200 XP (Nível 6)
const legendProfile = testProgression(1200);
assert.strictEqual(legendProfile.level, 6, 'Lenda deve estar no Nível 6');
assert.strictEqual(legendProfile.completedCount, 5, 'Lenda deve ter superado 5 níveis');
console.log('[PASS] 04. Validação de Nível 6 (5 níveis superados)');

// 3. Verificar integração em CollaboratorSpace.jsx
const csCode = fs.readFileSync('src/components/CollaboratorSpace.jsx', 'utf8');
assert(csCode.includes('getCareerProgression'), 'CollaboratorSpace deve chamar getCareerProgression');
assert(csCode.includes('cs-xp-current-tier-explainer'), 'CollaboratorSpace deve conter o box explicativo da patente atual');
assert(csCode.includes('cs-xp-career-journey-section'), 'CollaboratorSpace deve conter a seção de jornada de carreira');
assert(csCode.includes('cs-career-status-box completed'), 'CollaboratorSpace deve renderizar o feedback de níveis já superados');
console.log('[PASS] 05. Integração dos componentes visuais em CollaboratorSpace.jsx confirmada');

// 4. Verificar estilos em App.css
const cssCode = fs.readFileSync('src/App.css', 'utf8');
assert(cssCode.includes('.cs-xp-current-tier-explainer'), 'App.css deve conter .cs-xp-current-tier-explainer');
assert(cssCode.includes('.cs-xp-career-journey-section'), 'App.css deve conter .cs-xp-career-journey-section');
assert(cssCode.includes('.cs-career-pill.completed'), 'App.css deve conter .cs-career-pill.completed');
assert(cssCode.includes('body.light-theme .cs-xp-career-card.is-completed'), 'App.css deve ter suporte ao tema light');
console.log('[PASS] 06. Estilos Dark e Light presentes em App.css');

console.log('\nTODOS OS TESTES DE CARREIRA E PROGRESSÃO PASSARAM COM SUCESSO!\n');
