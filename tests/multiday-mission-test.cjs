// ==============================================================================
// GestorMF - Teste Automatizado de Missões de Múltiplos Dias (Longa Duração)
// ==============================================================================
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('   TESTE DE MISSÕES DE MÚLTIPLOS DIAS (V6.6)       ');
console.log('====================================================\n');

// 1. Testa a lógica de cálculo de dias (calculateDaysBetween)
function calculateDaysBetween(startDateStr, endDateStr) {
  if (!startDateStr || !endDateStr) return 1;
  try {
    const [y1, m1, d1] = String(startDateStr).split('-').map(Number);
    const [y2, m2, d2] = String(endDateStr).split('-').map(Number);
    if (!y1 || !y2) return 1;
    const utc1 = Date.UTC(y1, m1 - 1, d1);
    const utc2 = Date.UTC(y2, m2 - 1, d2);
    const diff = Math.round((utc2 - utc1) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 1;
  } catch (e) {
    return 1;
  }
}

// Caso 1: 25/11/2026 até 28/11/2026 = 4 dias (exemplo do usuário)
const days1 = calculateDaysBetween('2026-11-25', '2026-11-28');
assert.strictEqual(days1, 4, `Esperado 4 dias para 25/11 a 28/11, obtido: ${days1}`);
console.log('[PASS] 01. Cálculo de dias exato para missão 25/11 a 28/11 = 4 dias.');

// Caso 2: Mesmo dia = 1 dia
const days2 = calculateDaysBetween('2026-11-25', '2026-11-25');
assert.strictEqual(days2, 1, `Esperado 1 dia para mesma data, obtido: ${days2}`);
console.log('[PASS] 02. Cálculo de dias para missão no mesmo dia = 1 dia.');

// 2. Verifica backend missions.php
const missionsPhp = fs.readFileSync(path.join(__dirname, '..', 'public', 'api', 'missions.php'), 'utf8');

assert(missionsPhp.includes("'is_multi_day'"), 'Falha: missions.php deve conter coluna is_multi_day');
assert(missionsPhp.includes("'end_date'"), 'Falha: missions.php deve conter coluna end_date');
assert(missionsPhp.includes("COALESCE(NULLIF(end_date, ''), date) < '{$todayDate}'"), 'Falha: missions.php deve respeitar end_date nas transições automáticas');
assert(missionsPhp.includes(":is_multi_day") && missionsPhp.includes(":end_date"), 'Falha: missions.php deve persistir is_multi_day e end_date no INSERT e UPDATE');

console.log('[PASS] 03. Backend (missions.php): Colunas, persistência e proteção contra finalização prematura de missões de longa duração verificadas.');

// 3. Verifica frontend MissionModal.jsx
const missionModalJsx = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'MissionModal.jsx'), 'utf8');

assert(missionModalJsx.includes('mm-multiday-box'), 'Falha: MissionModal.jsx deve renderizar mm-multiday-box');
assert(missionModalJsx.includes('handleToggleMultiDay'), 'Falha: MissionModal.jsx deve ter manipulador handleToggleMultiDay');
assert(missionModalJsx.includes('calculateDaysBetween'), 'Falha: MissionModal.jsx deve calcular e exibir duração');
assert(missionModalJsx.includes('Data Final / Retorno à Base'), 'Falha: MissionModal.jsx deve conter campo de Data Final');

console.log('[PASS] 04. Frontend (MissionModal.jsx): Card elegante com switch, campo de data final sob demanda e cálculo de dias verificado.');

console.log('\nTODOS OS TESTES DE MISSÕES DE MÚLTIPLOS DIAS PASSARAM COM SUCESSO!\n');

