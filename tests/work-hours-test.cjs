/**
 * Test Suite: Cálculo de Horário Comercial vs. Banco de Horas (Horas Extras)
 */
const assert = require('assert');

// Implementação espelho para teste CJS
function calculateMissionOffHours(startDateStr, departureTime, endDateStr, returnTime, isMultiDay = false) {
  if (!startDateStr || !departureTime || !returnTime) {
    return { totalHours: 0, inHours: 0, offHours: 0, isOffHours: false };
  }

  const effectiveEndDateStr = (isMultiDay && endDateStr) ? endDateStr : startDateStr;

  const [y1, m1, d1] = String(startDateStr).split('-').map(Number);
  const [h1, min1] = String(departureTime).split(':').map(Number);

  const [y2, m2, d2] = String(effectiveEndDateStr).split('-').map(Number);
  const [h2, min2] = String(returnTime).split(':').map(Number);

  const start = new Date(y1, m1 - 1, d1, h1, min1, 0, 0);
  let end = new Date(y2, m2 - 1, d2, h2, min2, 0, 0);

  if (end <= start && startDateStr === effectiveEndDateStr) {
    end = new Date(y2, m2 - 1, d2 + 1, h2, min2, 0, 0);
  }

  if (end <= start) return { totalHours: 0, inHours: 0, offHours: 0, isOffHours: false };

  const totalMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
  let offHoursMinutes = 0;
  let inHoursMinutes = 0;

  const cur = new Date(start.getTime());
  while (cur < end) {
    const dayOfWeek = cur.getDay(); // 0 = Dom, 1..5 = Seg..Sex, 6 = Sáb
    const curHour = cur.getHours();
    const curMinute = cur.getMinutes();
    const minuteOfDay = curHour * 60 + curMinute;

    let isWorkHour = false;
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      // 08:00 (480) até 18:00 (1080)
      if (minuteOfDay >= 480 && minuteOfDay < 1080) {
        isWorkHour = true;
      }
    } else if (dayOfWeek === 6) {
      // 08:00 (480) até 12:00 (720)
      if (minuteOfDay >= 480 && minuteOfDay < 720) {
        isWorkHour = true;
      }
    } else {
      isWorkHour = false;
    }

    if (isWorkHour) inHoursMinutes++;
    else offHoursMinutes++;

    cur.setMinutes(cur.getMinutes() + 1);
  }

  const offHours = Number((offHoursMinutes / 60).toFixed(1));
  const inHours = Number((inHoursMinutes / 60).toFixed(1));
  const totalHours = Number((totalMinutes / 60).toFixed(1));

  return { totalHours, inHours, offHours, isOffHours: offHoursMinutes > 0 };
}

console.log('🧪 Iniciando testes de regras de Horário Comercial vs. Banco de Horas...');

// 1. Segunda-feira dentro do horário comercial (09:00 às 17:00)
// 2026-11-16 é Segunda-feira
const t1 = calculateMissionOffHours('2026-11-16', '09:00', '2026-11-16', '17:00');
assert.strictEqual(t1.totalHours, 8);
assert.strictEqual(t1.inHours, 8);
assert.strictEqual(t1.offHours, 0);
assert.strictEqual(t1.isOffHours, false);
console.log('  ✅ Cenário 1: Segunda 09h às 17h = 0h de banco de horas (100% dentro do expediente)');

// 2. Segunda-feira com saída às 16:00 e retorno às 21:00 (3h após as 18:00)
const t2 = calculateMissionOffHours('2026-11-16', '16:00', '2026-11-16', '21:00');
assert.strictEqual(t2.totalHours, 5);
assert.strictEqual(t2.inHours, 2); // 16h às 18h
assert.strictEqual(t2.offHours, 3); // 18h às 21h
assert.strictEqual(t2.isOffHours, true);
console.log('  ✅ Cenário 2: Segunda 16h às 21h = 2h expediente + 3h banco de horas');

// 3. Segunda-feira de madrugada (06:00 às 10:00)
const t3 = calculateMissionOffHours('2026-11-16', '06:00', '2026-11-16', '10:00');
assert.strictEqual(t3.totalHours, 4);
assert.strictEqual(t3.inHours, 2); // 08h às 10h
assert.strictEqual(t3.offHours, 2); // 06h às 08h
console.log('  ✅ Cenário 3: Segunda 06h às 10h = 2h antes das 08h no banco de horas');

// 4. Sábado: 2026-11-21 é Sábado
// Saída 09:00 às 15:00 (Expediente até 12h, após 12h é extra)
const t4 = calculateMissionOffHours('2026-11-21', '09:00', '2026-11-21', '15:00');
assert.strictEqual(t4.totalHours, 6);
assert.strictEqual(t4.inHours, 3); // 09h às 12h
assert.strictEqual(t4.offHours, 3); // 12h às 15h
console.log('  ✅ Cenário 4: Sábado 09h às 15h = 3h expediente + 3h banco de horas (após 12h)');

// 5. Domingo: 2026-11-22 é Domingo
// Saída 10:00 às 14:00 (Domingo dia inteiro é fora do expediente)
const t5 = calculateMissionOffHours('2026-11-22', '10:00', '2026-11-22', '14:00');
assert.strictEqual(t5.totalHours, 4);
assert.strictEqual(t5.inHours, 0);
assert.strictEqual(t5.offHours, 4);
console.log('  ✅ Cenário 5: Domingo 10h às 14h = 4h banco de horas (100% fora do expediente)');

// 6. Missão noturna que atravessa meia-noite (22:00 às 02:00)
const t6 = calculateMissionOffHours('2026-11-16', '22:00', '2026-11-16', '02:00');
assert.strictEqual(t6.totalHours, 4);
assert.strictEqual(t6.inHours, 0);
assert.strictEqual(t6.offHours, 4);
console.log('  ✅ Cenário 6: Noite 22h às 02h = 4h banco de horas (atravessando meia-noite)');

console.log('\n🎉 TODOS OS TESTES DE REGRAS DE HORÁRIO COMERCIAL E BANCO DE HORAS PASSARAM COM SUCESSO!');
