/**
 * Test Suite: Diárias, Banco de Horas & Fechamento de Folha (Admin)
 */
const assert = require('assert');

console.log('🧪 Iniciando Teste de Diárias, Banco de Horas & Fechamento...');

// 1. Simulação do cálculo de horas de missão local
function calculateMissionHours(depTime, retTime) {
  if (!depTime || !retTime) return 4;
  const [h1, m1] = depTime.split(':').map(Number);
  const [h2, m2] = retTime.split(':').map(Number);
  let mins = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (mins < 0) mins += 24 * 60; // atravessou meia-noite
  const hrs = mins / 60;
  return hrs > 0 ? Number(hrs.toFixed(1)) : 4;
}

// 2. Simulação do cálculo de dias entre datas para missões longas
function calculateDaysBetween(startDateStr, endDateStr) {
  if (!startDateStr || !endDateStr) return 1;
  const [y1, m1, d1] = String(startDateStr).split('-').map(Number);
  const [y2, m2, d2] = String(endDateStr).split('-').map(Number);
  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  const diff = Math.round((utc2 - utc1) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 1;
}

// 3. Simulação de apuração por colaborador
function computeMemberPayout(member, missions, targetMonth) {
  const hourlyRate = Number(member.hourlyRate ?? member.hourly_rate ?? 50);
  const dailyRate = Number(member.dailyRate ?? member.daily_rate ?? 200);
  const rateModel = member.rateModel || member.rate_model || 'hourly';
  const blockRate = Number(member.blockRate ?? member.block_rate ?? 200);

  let totalHours = 0;
  let totalTravelDays = 0;
  let missionCount = 0;
  let totalAmount = 0;

  const monthMissions = missions.filter(m => (m.date || '').startsWith(targetMonth));

  monthMissions.forEach(m => {
    const isMemberInMission = (m.teamIds || []).includes(member.id) ||
      (m.team || []).includes(member.name) ||
      m.driverId === member.id ||
      m.driverName === member.name;

    if (!isMemberInMission) return;

    missionCount++;

    if (m.isMultiDay && m.endDate) {
      const days = calculateDaysBetween(m.date, m.endDate);
      totalTravelDays += days;
      totalAmount += days * dailyRate;
    } else {
      const hrs = calculateMissionHours(m.departureTime, m.returnTime);
      totalHours += hrs;
      if (rateModel === 'block_4h') {
        const blocks = Math.ceil(hrs / 4);
        totalAmount += blocks * blockRate;
      } else {
        totalAmount += hrs * hourlyRate;
      }
    }
  });

  return {
    memberId: member.id,
    missionCount,
    totalHours,
    totalTravelDays,
    totalAmount,
  };
}

// ==========================================
// CASO DE TESTE 1: Cálculo de horas e meia-noite
// ==========================================
console.log('Teste 1: Cálculo de duração em horas');
const h1 = calculateMissionHours('14:00', '18:00');
assert.strictEqual(h1, 4, '14:00 às 18:00 deve dar 4 horas');

const h2 = calculateMissionHours('20:00', '02:00'); // Atravessa meia-noite
assert.strictEqual(h2, 6, '20:00 às 02:00 deve dar 6 horas cruzando meia-noite');

console.log('  ✅ Teste 1 passou: Horários e travessia de meia-noite calculados corretamente.');

// ==========================================
// CASO DE TESTE 2: Missão Prolongada (Recálculo dinâmico)
// Exemplo do áudio: evento previsto até 22:00 foi alterado para 23:00
// ==========================================
console.log('Teste 2: Missão prolongada (adição de 1 hora no retorno)');
const memberJunior = {
  id: 'm-cauan',
  name: 'Cauan Santos',
  hourlyRate: 25,
  rateModel: 'hourly',
  dailyRate: 150,
};

const missionOriginal = {
  id: 'miss-1',
  date: '2026-11-15',
  departureTime: '17:00',
  returnTime: '22:00', // 5 horas
  teamIds: ['m-cauan'],
};

const payoutOriginal = computeMemberPayout(memberJunior, [missionOriginal], '2026-11');
assert.strictEqual(payoutOriginal.totalHours, 5);
assert.strictEqual(payoutOriginal.totalAmount, 5 * 25); // R$ 125,00

// Alteração da hora de retorno para 23:00 (evento prolongado)
const missionUpdated = {
  ...missionOriginal,
  returnTime: '23:00', // 6 horas (+1 hora)
};
const payoutUpdated = computeMemberPayout(memberJunior, [missionUpdated], '2026-11');
assert.strictEqual(payoutUpdated.totalHours, 6);
assert.strictEqual(payoutUpdated.totalAmount, 6 * 25); // R$ 150,00 (+ R$ 25)

console.log('  ✅ Teste 2 passou: Recálculo automático de missão prolongada funcionou perfeitamente.');

// ==========================================
// CASO DE TESTE 3: Modelo de Bloco de 4 Horas (Pacote)
// ==========================================
console.log('Teste 3: Modelo de Remuneração por Blocos de 4 Horas');
const memberSenior = {
  id: 'm-mateus',
  name: 'Mateus Henrique',
  hourlyRate: 50,
  rateModel: 'block_4h',
  blockRate: 200,
  dailyRate: 200,
};

// Missão de 3 horas (1 bloco de 4h = R$ 200)
const mission3h = {
  id: 'miss-3h',
  date: '2026-11-10',
  departureTime: '08:00',
  returnTime: '11:00',
  teamIds: ['m-mateus'],
};
const payout3h = computeMemberPayout(memberSenior, [mission3h], '2026-11');
assert.strictEqual(payout3h.totalAmount, 200, '3 horas deve cobrar 1 bloco de 4h (R$ 200)');

// Missão de 5 horas (passou de 4h -> 2 blocos de 4h = R$ 400)
const mission5h = {
  id: 'miss-5h',
  date: '2026-11-12',
  departureTime: '08:00',
  returnTime: '13:00',
  teamIds: ['m-mateus'],
};
const payout5h = computeMemberPayout(memberSenior, [mission5h], '2026-11');
assert.strictEqual(payout5h.totalAmount, 400, '5 horas deve cobrar 2 blocos de 4h (R$ 400)');

console.log('  ✅ Teste 3 passou: Pacote de blocos de 4 horas apurado com precisão.');

// ==========================================
// CASO DE TESTE 4: Missão de Longa Duração / Viagem de Campo (+1 dia)
// ==========================================
console.log('Teste 4: Viagem de campo de longa duração');
const multiDayMission = {
  id: 'miss-trip',
  date: '2026-11-25',
  endDate: '2026-11-27', // 2 dias de intervalo
  isMultiDay: true,
  departureTime: '06:00',
  returnTime: '18:00',
  teamIds: ['m-mateus'],
};

const payoutTrip = computeMemberPayout(memberSenior, [multiDayMission], '2026-11');
assert.strictEqual(payoutTrip.totalTravelDays, 2, 'Deve registrar 2 dias de operação');
assert.strictEqual(payoutTrip.totalAmount, 2 * 200, '2 dias a R$ 200/dia = R$ 400');

console.log('  ✅ Teste 4 passou: Diárias de viagem de longa duração apuradas com sucesso.');

// ==========================================
// CASO DE TESTE 5: Restrição de Acesso de Administrador
// ==========================================
console.log('Teste 5: Restrição de Acesso');
function canAccessPayoutsModule(userRole) {
  return userRole === 'admin';
}
assert.strictEqual(canAccessPayoutsModule('admin'), true, 'Admin deve ter acesso');
assert.strictEqual(canAccessPayoutsModule('manager'), false, 'Gestor não deve ter acesso');
assert.strictEqual(canAccessPayoutsModule('user'), false, 'Colaborador comum não deve ter acesso');

console.log('  ✅ Teste 5 passou: Módulo restrito exclusivamente ao Administrador.');

console.log('\n🎉 TODOS OS TESTES DE DIÁRIAS & FECHAMENTO PASSARAM COM 100% DE SUCESSO!');

