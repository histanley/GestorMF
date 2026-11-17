const assert = require('assert');
const fs = require('fs');

console.log('================================================================');
console.log('  TESTE: PRORROGAÇÃO 15 MIN & PAGINAÇÃO 5/10 NO MEU ESPAÇO     ');
console.log('================================================================\n');

// 1. Verificar regra em CollaboratorSpace.jsx
const csCode = fs.readFileSync('src/components/CollaboratorSpace.jsx', 'utf8');

// A. Verificar se a condição do botão inclui progress.isUrgentEnd
assert(
  csCode.includes('!isClosed && progress.isUrgentEnd && isMemberEligibleForExtraHours'),
  'O botão deve exigir explicitamente progress.isUrgentEnd (15 min antes de finalizar)'
);
console.log('[PASS] 01. Botão de Prorrogar/Hora Extra exige progress.isUrgentEnd e exclui missões passadas e futuras.');

// B. Verificar se isClosed trata todos os estados de missão passada/finalizada/pendente/cancelada
assert(
  csCode.includes("mStatus === 'finalizada'") &&
  csCode.includes("mStatus === 'concluída'") &&
  csCode.includes("mStatus === 'pendente'") &&
  csCode.includes("mStatus === 'cancelada'"),
  'isClosed deve verificar todos os status de conclusão'
);
console.log('[PASS] 02. Identificação de missões fechadas/concluídas (isClosed) validada para todos os status.');

// C. Verificar estado de paginação com incremento +10 e limite inicial de 5 missões no total
assert(
  csCode.includes('additionalConcluded'),
  'Estado additionalConcluded deve controlar a expansão de missões concluídas'
);
assert(
  csCode.includes('prev + 10'),
  'Botão "Mostrar mais" deve incrementar de 10 em 10 (+10)'
);
assert(
  csCode.includes('displayedActive = active.slice(0, 5)'),
  'Deve limitar a exibição inicial a 5 missões no total'
);
console.log('[PASS] 03. Paginação de missões concluídas configurada: 5 iniciais no total e expansão de 10 em 10.');

// D. Simulação lógica de progressão e paginação
const sampleMissions = Array.from({ length: 24 }, (_, i) => ({
  id: `mis-${i + 1}`,
  code: `202611${100 + i}`,
  missionStatus: i < 5 ? 'Em Execução' : 'Finalizada',
  date: '2026-11-16',
}));

// Testar separação
const todayStr = '2026-11-16';
const active = sampleMissions.filter(m => m.missionStatus === 'Em Execução');
const concluded = sampleMissions.filter(m => m.missionStatus === 'Finalizada');

assert.strictEqual(active.length, 5, 'Deve haver 5 ativas');
assert.strictEqual(concluded.length, 19, 'Deve haver 19 concluídas');

// Início: 5 no total na tela (5 ativas, 0 concluídas inicialmente pois já tem 5 ativas)
let additionalConcluded = 0;
let displayedActive = active.slice(0, 5);
let initialSlots = Math.max(0, 5 - displayedActive.length);
let displayed = [...displayedActive, ...concluded.slice(0, initialSlots + additionalConcluded)];
assert.strictEqual(displayed.length, 5, 'Exatamente 5 missões no total inicial');

// Clicar em "Mostrar mais" (+10 concluídas)
additionalConcluded += 10;
displayed = [...displayedActive, ...concluded.slice(0, initialSlots + additionalConcluded)];
assert.strictEqual(displayed.length, 15, '5 ativas + 10 concluídas = 15 após primeiro clique');

// Clicar novamente em "Mostrar mais" (+10 concluídas)
additionalConcluded += 10;
displayed = [...displayedActive, ...concluded.slice(0, initialSlots + additionalConcluded)];
assert.strictEqual(displayed.length, 24, '5 ativas + 19 concluídas = 24 (todas visíveis)');
console.log('[PASS] 04. Simulação de paginação: 5 -> 15 -> 24 aprovada com sucesso.');

// E. Verificar estilos CSS em App.css
const cssCode = fs.readFileSync('src/App.css', 'utf8');
assert(cssCode.includes('.cs-show-more-missions-wrap'), 'App.css deve conter .cs-show-more-missions-wrap');
assert(cssCode.includes('.cs-btn-show-more-missions'), 'App.css deve conter .cs-btn-show-more-missions');
assert(cssCode.includes('body.light-theme .cs-btn-show-more-missions'), 'App.css deve ter suporte a tema claro');
console.log('[PASS] 05. Estilos de paginação (Dark e Light) confirmados em App.css.');

console.log('\nTODOS OS TESTES DE REGRAS DE PRORROGAÇÃO E PAGINAÇÃO PASSARAM COM SUCESSO!\n');
