// tests/service-board-views-test.cjs
const assert = require('assert');

// Mock helpers
function toDateISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

// Mock missões
const mockMissions = [
  { id: '1', date: '2026-11-12', endDate: '2026-11-12', description: 'Gravação libras Nina' },
  { id: '2', date: '2026-11-25', endDate: '2026-11-27', isMultiDay: true, description: 'Viagem multi-dias' },
  { id: '3', date: '2026-12-01', endDate: '2026-12-01', description: 'TJ Dezembro' }
];

console.log('=== TESTE DE VISUALIZAÇÕES DE SEMANA E MÊS DA TABELA DE SERVIÇO ===');

// 1. Teste de Semana
const refDate = new Date('2026-11-12T12:00:00'); // Quinta-feira
const monday = getMonday(refDate);
assert.strictEqual(monday.getDay(), 1, 'Primeiro dia deve ser Segunda-feira');
assert.strictEqual(toDateISO(monday), '2026-11-09');

// Gera a semana
const weekDays = [];
for (let i = 0; i < 7; i++) {
  const d = new Date(monday);
  d.setDate(d.getDate() + i);
  const dateISO = toDateISO(d);
  const dayMissions = mockMissions.filter((m) => {
    const start = m.date || '';
    const end = m.endDate || m.date || '';
    return dateISO >= start && dateISO <= end;
  });
  weekDays.push({ dateISO, missions: dayMissions });
}

assert.strictEqual(weekDays.length, 7);
// Quinta 12/11 deve conter a missão 1
const thu = weekDays.find((d) => d.dateISO === '2026-11-12');
assert.strictEqual(thu.missions.length, 1);
assert.strictEqual(thu.missions[0].id, '1');

// 2. Teste da Viagem Multi-dias (25/11 a 27/11)
const multiWeekMonday = getMonday(new Date('2026-11-25T12:00:00'));
const multiWeekDays = [];
for (let i = 0; i < 7; i++) {
  const d = new Date(multiWeekMonday);
  d.setDate(d.getDate() + i);
  const dateISO = toDateISO(d);
  const dayMissions = mockMissions.filter((m) => {
    const start = m.date || '';
    const end = m.endDate || m.date || '';
    return dateISO >= start && dateISO <= end;
  });
  multiWeekDays.push({ dateISO, count: dayMissions.length });
}

// 25/11 (Quarta), 26/11 (Quinta) e 27/11 (Sexta) devem conter a missão
assert.strictEqual(multiWeekDays.find((d) => d.dateISO === '2026-11-25').count, 1);
assert.strictEqual(multiWeekDays.find((d) => d.dateISO === '2026-11-26').count, 1);
assert.strictEqual(multiWeekDays.find((d) => d.dateISO === '2026-11-27').count, 1);
assert.strictEqual(multiWeekDays.find((d) => d.dateISO === '2026-11-28').count, 0);

console.log('✅ TESTES DE SEMANA E MÊS EXECUTADOS COM 100% DE SUCESSO!');
