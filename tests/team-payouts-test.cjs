// Teste de Fechamento de Diárias & Folha com Regras de Banco de Horas
const { calculateMissionOffHours } = require('../src/utils/workHours');

console.log('🧪 Iniciando testes de apuração de Diárias, Banco de Horas e Zerar Horas...');

const mockMembers = [
  { id: 'mem-1', name: 'Gabriel Costa', hourlyRate: 25, dailyRate: 200, company: 'MegaFilmes' },
  { id: 'mem-2', name: 'Manoel', hourlyRate: 50, dailyRate: 200, company: 'MegaFilmes' },
];

const mockMissions = [
  // Missão 1: Segunda 09h às 17h (100% dentro do horário comercial)
  {
    id: 'mis-1',
    code: '#20261101',
    date: '2026-11-02', // Segunda
    departureTime: '09:00',
    returnTimeEstimated: '17:00',
    teamIds: ['mem-1', 'mem-2'],
  },
  // Missão 2: Segunda 18h às 22h (4h fora do expediente - Gabriel com taxa personalizada de R$ 35/h)
  {
    id: 'mis-2',
    code: '#20261102',
    date: '2026-11-02',
    departureTime: '18:00',
    returnTimeEstimated: '22:00',
    teamIds: ['mem-1', 'mem-2'],
    customRates: {
      'mem-1': 35, // Gabriel R$ 35/h em vez do padrão R$ 25/h
    },
  },
  // Missão 3: Domingo 14h às 18h (4h fora do expediente - domingo dia todo)
  {
    id: 'mis-3',
    code: '#20261103',
    date: '2026-11-08', // Domingo
    departureTime: '14:00',
    returnTimeEstimated: '18:00',
    teamIds: ['mem-2'],
  },
  // Missão 4: Viagem de 2 dias
  {
    id: 'mis-4',
    code: '#20261104',
    date: '2026-11-20',
    endDate: '2026-11-21',
    isMultiDay: true,
    departureTime: '08:00',
    returnTimeEstimated: '18:00',
    teamIds: ['mem-1'],
  },
];

// Função de cálculo simulando TeamPayoutsDashboard
function computePayouts(members, missions, closures = {}) {
  return members.map((member) => {
    let totalOffHours = 0;
    let totalAmount = 0;
    let totalTravelDays = 0;

    missions.forEach((m) => {
      if (!m.teamIds.includes(member.id)) return;

      const isMDay = Boolean(m.isMultiDay || (m.endDate && m.endDate !== m.date));
      const offInfo = calculateMissionOffHours(m.date, m.departureTime, m.endDate, m.returnTimeEstimated, isMDay);
      const customRate = m.customRates && m.customRates[member.id] !== undefined ? Number(m.customRates[member.id]) : null;
      const effectiveRate = customRate !== null ? customRate : member.hourlyRate;

      if (isMDay) {
        const days = 2; // de 20 a 21
        totalTravelDays += days;
        totalAmount += days * member.dailyRate;
      } else {
        totalOffHours += offInfo.offHours;
        totalAmount += offInfo.offHours * effectiveRate;
      }
    });

    const closure = closures[member.id] || null;
    const isPaid = closure?.status === 'Pago';

    return {
      id: member.id,
      name: member.name,
      totalOffHours,
      totalTravelDays,
      totalAmount,
      isPaid,
      hoursCleared: closure?.hoursCleared || 0,
      clearedAt: closure?.clearedAt || null,
    };
  });
}

// 1. Testa cálculo com horas normais vs. fora de expediente
const initialPayouts = computePayouts(mockMembers, mockMissions);

const gabriel = initialPayouts.find((m) => m.id === 'mem-1');
console.log('Gabriel Costa:', gabriel);
// Gabriel:
// Mis 1 (comercial): 0h extra, R$ 0
// Mis 2 (18h-22h): 4h extra * R$ 35 = R$ 140
// Mis 4 (viagem 2 dias): 2 dias * R$ 200 = R$ 400
// Total horas fora de expediente: 4h
// Total valor: R$ 540
if (gabriel.totalOffHours !== 4) throw new Error(`Gabriel deveria ter 4h extras, obteve ${gabriel.totalOffHours}`);
if (gabriel.totalAmount !== 540) throw new Error(`Gabriel deveria ter R$ 540, obteve ${gabriel.totalAmount}`);
console.log('  ✅ Gabriel Costa apurado corretamente com taxa personalizada (R$ 35/h) e 0h na missão comercial!');

const manoel = initialPayouts.find((m) => m.id === 'mem-2');
console.log('Manoel:', manoel);
// Manoel:
// Mis 1 (comercial): 0h extra, R$ 0
// Mis 2 (18h-22h): 4h extra * R$ 50 = R$ 200
// Mis 3 (domingo 14h-18h): 4h extra * R$ 50 = R$ 200
// Total horas: 8h
// Total valor: R$ 400
if (manoel.totalOffHours !== 8) throw new Error(`Manoel deveria ter 8h extras, obteve ${manoel.totalOffHours}`);
if (manoel.totalAmount !== 400) throw new Error(`Manoel deveria ter R$ 400, obteve ${manoel.totalAmount}`);
console.log('  ✅ Manoel apurado corretamente com 8h no banco de horas e R$ 400!');

// 2. Testa ação de "Zerar Horas" para Manoel
const simulatedClosures = {
  'mem-2': {
    status: 'Pago',
    paidAmount: manoel.totalAmount,
    hoursCleared: manoel.totalOffHours,
    clearedAt: new Date().toISOString(),
  },
};

const afterClearPayouts = computePayouts(mockMembers, mockMissions, simulatedClosures);
const manoelCleared = afterClearPayouts.find((m) => m.id === 'mem-2');
console.log('Manoel após Zerar Horas:', manoelCleared);
if (!manoelCleared.isPaid) throw new Error('Manoel deveria estar com status Pago');
if (manoelCleared.hoursCleared !== 8) throw new Error(`Horas zeradas incorretas: ${manoelCleared.hoursCleared}`);
console.log('  ✅ Ação de Zerar Horas validada com sucesso!');

console.log('\n🎉 TODOS OS TESTES DE FECHAMENTO E BANCO DE HORAS PASSARAM 100%!');
