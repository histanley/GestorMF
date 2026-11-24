/**
 * Test Suite: Cálculo de Horas Extras no Intervalo de Almoço (12h às 14h)
 * e Modalidades de Refeição de Campo - Regras Oficiais MegaFilmes
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Carrega o módulo workHours via leitura e module.exports para ambiente Node.js CJS
const workHoursSrc = fs.readFileSync(path.join(__dirname, '../src/utils/workHours.js'), 'utf8');
const transformedSrc = workHoursSrc
  .replace(/export function /g, 'function ')
  .replace(/export const /g, 'const ')
  + '\nmodule.exports = { calculateMissionOffHours, calculateEventOnlyOffHours, classifyMissionShift, isMemberEligibleForExtraHours, calculateExtraHoursRemuneration };';

const m = { exports: {} };
const fn = new Function('module', 'exports', transformedSrc);
fn(m, m.exports);

const {
  calculateMissionOffHours,
  calculateEventOnlyOffHours,
  classifyMissionShift,
  isMemberEligibleForExtraHours,
  calculateExtraHoursRemuneration,
} = m.exports;

console.log('🧪 Iniciando testes de regras de Horas Extras no Intervalo de Almoço...');

// --------------------------------------------------------------------------
// 1. Segunda a Sexta: Trabalho contínuo através do almoço (08:00 às 14:00) com no_break
// --------------------------------------------------------------------------
const t1 = calculateMissionOffHours('2026-11-24', '08:00', '2026-11-24', '14:00', false, {
  lunchBreakOption: 'no_break',
  hasLunchBreak: false,
});
assert.strictEqual(t1.inHours, 4.0, 'In-hours deve ser 4.0h (08h às 12h)');
assert.strictEqual(t1.offHours, 2.0, 'Off-hours deve ser 2.0h (12h às 14h almoço trabalhado)');
assert.strictEqual(t1.lunchOffHours, 2.0, 'lunchOffHours deve ser 2.0h');
assert.strictEqual(t1.isOffHours, true, 'Deve gerar horas extras');
console.log('  ✅ Cenário 1: 08h às 14h contínuo = 4h expediente + 2h extras de almoço trabalhado');

// --------------------------------------------------------------------------
// 2. Segunda a Sexta: Dia completo com intervalo de almoço (08:00 às 18:00) com with_break
// --------------------------------------------------------------------------
const t2 = calculateMissionOffHours('2026-11-24', '08:00', '2026-11-24', '18:00', false, {
  lunchBreakOption: 'with_break',
  hasLunchBreak: true,
});
assert.strictEqual(t2.inHours, 8.0, 'In-hours deve ser 8.0h (4h manhã + 4h tarde)');
assert.strictEqual(t2.offHours, 0.0, 'Off-hours deve ser 0.0h');
assert.strictEqual(t2.breakHours, 2.0, 'Break deve ser 2.0h (12h às 14h)');
assert.strictEqual(t2.isOffHours, false, 'Com intervalo regular, não há horas extras');
console.log('  ✅ Cenário 2: 08h às 18h com intervalo = 8h expediente + 2h pausa (0h extra)');

// --------------------------------------------------------------------------
// 3. Segunda a Sexta: Dia completo contínuo (08:00 às 18:00) com no_break
// --------------------------------------------------------------------------
const t3 = calculateMissionOffHours('2026-11-24', '08:00', '2026-11-24', '18:00', false, {
  lunchBreakOption: 'no_break',
  hasLunchBreak: false,
});
assert.strictEqual(t3.inHours, 8.0, 'In-hours deve ser 8.0h');
assert.strictEqual(t3.offHours, 2.0, 'Off-hours deve ser 2.0h (12h às 14h)');
assert.strictEqual(t3.lunchOffHours, 2.0, 'lunchOffHours deve ser 2.0h');
assert.strictEqual(t3.totalHours, 10.0, 'Total deve ser 10.0h');
console.log('  ✅ Cenário 3: 08h às 18h contínuo = 8h expediente + 2h extras de almoço (total 10h)');

// --------------------------------------------------------------------------
// 4. Missão #202611242 (TJRR Sessões Criminais) - Detecção e Apuração Automática
// --------------------------------------------------------------------------
const missionTjrr = {
  id: 'mis-tjrr-today',
  code: '202611242',
  description: 'TJRR Sessões Criminais - Transmissão ao Vivo',
  date: '2026-11-24',
  departureTime: '08:00',
  eventStartTime: '09:00',
  eventEndTime: '14:00',
  returnTimeEstimated: '14:30',
  teamIds: ['mem-cine-1', 'mem-audio-1'],
  editorIds: ['mem-editor-studio'],
};

const t4 = calculateEventOnlyOffHours(missionTjrr);
assert.strictEqual(t4.inHours, 3.0, '09h às 12h = 3.0h no expediente');
assert.strictEqual(t4.offHours, 2.0, '12h às 14h = 2.0h de hora extra de almoço');
assert.strictEqual(t4.lunchOffHours, 2.0, 'lunchOffHours deve ser 2.0h');
assert.strictEqual(t4.isOffHours, true, 'Deve gerar horas extras');
console.log('  ✅ Cenário 4: Missão #202611242 TJRR = 3h expediente + 2h extras de almoço apuradas automaticamente');

// --------------------------------------------------------------------------
// 5. Elegibilidade de Colaboradores na Missão #202611242:
// - Equipe presencial em campo (Cinegrafista / Áudio) recebe horas extras.
// - Editores de pós-produção em estúdio NÃO recebem horas extras.
// --------------------------------------------------------------------------
const cinegrafista = { id: 'mem-cine-1', name: 'Carlos Câmera', role: 'Cinegrafista' };
const editorStudio = { id: 'mem-editor-studio', name: 'Mateus Henrique', role: 'Editor de Vídeo' };

const isCineEligible = isMemberEligibleForExtraHours(cinegrafista, missionTjrr);
const isEditorEligible = isMemberEligibleForExtraHours(editorStudio, missionTjrr);

assert.strictEqual(isCineEligible, true, 'Cinegrafista presencial em campo deve receber horas extras');
assert.strictEqual(isEditorEligible, false, 'Editor de estúdio não deve receber horas extras');
console.log('  ✅ Cenário 5: Cinegrafista em campo recebe horas extras, editor de estúdio não recebe');

// --------------------------------------------------------------------------
// 6. Cálculo de Remuneração das 2 Horas Extras de Almoço
// --------------------------------------------------------------------------
const remun = calculateExtraHoursRemuneration(t4.offHours, 50);
assert.strictEqual(remun.amount, 100.0, '2h extras a R$ 50/h = R$ 100,00');
console.log('  ✅ Cenário 6: 2h extras de almoço × R$ 50/h = R$ 100,00 por colaborador em campo');

// --------------------------------------------------------------------------
// 7. Classificação de Turno (classifyMissionShift) com Almoço Trabalhado
// --------------------------------------------------------------------------
const shift = classifyMissionShift(missionTjrr);
assert.strictEqual(shift.hasLunchExtra, true, 'Deve indicar almoço trabalhado no turno');
assert.strictEqual(shift.lunchOffHours, 2.0, 'lunchOffHours deve ser 2.0h no turno');
console.log('  ✅ Cenário 7: classifyMissionShift identificou corretamente hasLunchExtra=true e 2h');

// --------------------------------------------------------------------------
// 8. Compatibilidade com chamadas legado sem opções
// --------------------------------------------------------------------------
const legacy = calculateMissionOffHours('2026-11-16', '09:00', '2026-11-16', '17:00');
assert.strictEqual(legacy.inHours, 8.0, 'Chamada legado mantém 8h em expediente');
assert.strictEqual(legacy.offHours, 0.0, 'Chamada legado mantém 0h fora de expediente');
console.log('  ✅ Cenário 8: Compatibilidade 100% mantida com testes e chamadas legadas');

// --------------------------------------------------------------------------
// 9. Missões Finalizadas Antigas (sem lunchBreakOption definido no cadastro)
// --------------------------------------------------------------------------
const pastFinalizedMission = {
  id: 'mis-finalized-past',
  code: '202611131',
  description: 'ENSAIO FOTOGRAFICO EXTERNO ABC SESI',
  date: '2026-11-13', // Sexta-feira
  departureTime: '08:00',
  eventStartTime: '08:30',
  eventEndTime: '15:00',
  returnTimeEstimated: '15:30',
  missionStatus: 'Finalizada',
  // lunchBreakOption e hasLunchBreak não estavam definidos no passado
};

const t9 = calculateEventOnlyOffHours(pastFinalizedMission);
assert.strictEqual(t9.lunchOffHours, 2.0, 'Missão finalizada no almoço deve apurar 2.0h de almoço trabalhado');
assert.strictEqual(t9.offHours, 2.0, 'Deve conter 2.0h de horas extras de almoço');
assert.strictEqual(t9.isOffHours, true, 'Deve ser marcada como fora do expediente');
console.log('  ✅ Cenário 9: Missão finalizada antiga (#202611131 SESI) recalculada com sucesso: 2.0h extras de almoço');

console.log('\n🎉 TODOS OS TESTES DE HORAS EXTRAS DE ALMOÇO E REFEIÇÃO PASSARAM COM 100% DE SUCESSO!\n');
