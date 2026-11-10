// ==============================================================================
// Teste Unitário de Recorrência de Missões
// ==============================================================================
const assert = require('assert');

function getDayOfWeekFromDate(dateStr) {
  if (!dateStr) return 1;
  const parts = String(dateStr).split('-').map(Number);
  const dateObj = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
  return dateObj.getDay();
}

function generateRecurrenceDates(startDateStr, selectedDows, endDateStr, maxCount = 52) {
  const [sy, sm, sd] = startDateStr.split('-').map(Number);
  const [ey, em, ed] = endDateStr.split('-').map(Number);
  let cur = new Date(sy, sm - 1, sd, 12, 0, 0);
  const end = new Date(ey, em - 1, ed, 12, 0, 0);
  const dates = [];
  while (cur <= end && dates.length < maxCount) {
    if (selectedDows.includes(cur.getDay())) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const d = String(cur.getDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${d}`);
    }
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

console.log('Testando cálculo de dia da semana...');
// 2026-11-10 é uma Terça-feira (2)
assert.strictEqual(getDayOfWeekFromDate('2026-11-10'), 2, '2026-11-10 deve ser Terça-feira (2)');
// 2026-11-12 é uma Quinta-feira (4)
assert.strictEqual(getDayOfWeekFromDate('2026-11-12'), 4, '2026-11-12 deve ser Quinta-feira (4)');

console.log('Testando geração 2x por semana (Terça e Quinta) por 4 semanas...');
const dates = generateRecurrenceDates('2026-11-10', [2, 4], '2026-12-08');
console.log('Datas geradas:', dates);
assert.strictEqual(dates.length, 9, 'Deve gerar exatamente 9 datas (5 terças e 4 quintas)');
assert.strictEqual(dates[0], '2026-11-10');
assert.strictEqual(dates[1], '2026-11-12');
assert.strictEqual(dates[2], '2026-11-17');
assert.strictEqual(dates[3], '2026-11-19');

console.log('[PASS] Todos os testes de recorrência passaram com sucesso!');

