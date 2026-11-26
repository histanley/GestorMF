const assert = require('assert');

// Import ES modules from geo.js
async function runTests() {
  console.log('🧪 Iniciando testes de Missões Multi-Dia e Viatura do Contratante...');

  const {
    getMultiDayProgress,
    computeMissionAutoStatus,
    isVehicleInMission,
    getActiveMissionForVehicle
  } = await import('../src/utils/geo.js');

  // TESTE 1: getMultiDayProgress
  console.log('\n--- 1. Teste getMultiDayProgress ---');
  const startDate = '2026-11-25';
  const endDate = '2026-11-27';

  // Dia 1: 2026-11-25
  const day1 = getMultiDayProgress(startDate, endDate, new Date('2026-11-25T10:00:00'));
  assert.strictEqual(day1.isMultiDay, true);
  assert.strictEqual(day1.totalDays, 3);
  assert.strictEqual(day1.currentDayNumber, 1);
  assert.strictEqual(day1.badgeText, '1º Dia de Missão');
  console.log('✅ Dia 1:', day1.badgeText);

  // Dia 2: 2026-11-26 (HOJE)
  const day2 = getMultiDayProgress(startDate, endDate, new Date('2026-11-26T14:00:00'));
  assert.strictEqual(day2.isMultiDay, true);
  assert.strictEqual(day2.totalDays, 3);
  assert.strictEqual(day2.currentDayNumber, 2);
  assert.strictEqual(day2.badgeText, '2º Dia de Missão');
  console.log('✅ Dia 2 (Hoje):', day2.badgeText);

  // Dia 3: 2026-11-27 (Último dia)
  const day3 = getMultiDayProgress(startDate, endDate, new Date('2026-11-27T17:00:00'));
  assert.strictEqual(day3.isMultiDay, true);
  assert.strictEqual(day3.totalDays, 3);
  assert.strictEqual(day3.currentDayNumber, 3);
  assert.ok(day3.badgeText.includes('3º Dia de Missão'));
  console.log('✅ Dia 3:', day3.badgeText);

  // TESTE 2: computeMissionAutoStatus para Missão Multi-Dia
  console.log('\n--- 2. Teste computeMissionAutoStatus (Prevenção de Encerramento Prematuro) ---');
  const multiDayMission = {
    id: 'mis-202611251',
    code: '202611251',
    description: 'VIAGEM TJ RORAINOPOLIS',
    date: '2026-11-25',
    endDate: '2026-11-27',
    isMultiDay: true,
    departureTime: '08:00',
    returnTimeEstimated: '18:00',
    missionStatus: 'Agendada'
  };

  // Dia 1 à noite (20:00 do dia 25/11): antes do fix, o sistema fechava como Finalizada!
  const statusDay1Night = computeMissionAutoStatus(multiDayMission, new Date('2026-11-25T20:00:00'));
  assert.strictEqual(statusDay1Night, 'Em Execução', 'No dia 1 à noite deve continuar Em Execução!');
  console.log('✅ Status dia 25/11 às 20h:', statusDay1Night);

  // Dia 2 à tarde (14:00 do dia 26/11 - HOJE): deve ser Em Execução!
  const statusDay2 = computeMissionAutoStatus(multiDayMission, new Date('2026-11-26T14:00:00'));
  assert.strictEqual(statusDay2, 'Em Execução', 'No dia 2 (hoje) deve ser Em Execução!');
  console.log('✅ Status dia 26/11 às 14h (Hoje):', statusDay2);

  // Caso tenha sido marcada como 'Finalizada' erroneamente no banco:
  const wronglyFinalizedMission = {
    ...multiDayMission,
    missionStatus: 'Finalizada'
  };
  const recoveredStatus = computeMissionAutoStatus(wronglyFinalizedMission, new Date('2026-11-26T14:00:00'));
  assert.strictEqual(recoveredStatus, 'Em Execução', 'Missão multi-dia ativa marcada erroneamente como Finalizada deve recuperar para Em Execução!');
  console.log('✅ Recuperação de status indevido:', recoveredStatus);

  // Dia 3 após as 18:00 (dia 27/11 às 19:00): encerra normalmente!
  const statusDay3End = computeMissionAutoStatus(multiDayMission, new Date('2026-11-27T19:00:00'));
  assert.strictEqual(statusDay3End, 'Finalizada', 'Após o horário final do último dia deve encerrar como Finalizada!');
  console.log('✅ Status dia 27/11 após as 18h:', statusDay3End);

  // TESTE 3: Viatura do Contratante (Sem afetação da frota da empresa)
  console.log('\n--- 3. Teste Viatura do Contratante / client_vehicle ---');
  const sparkVehicle = {
    id: 'veh-spark',
    name: 'Chev Spark',
    plate: 'ABC4E67',
    tankCapacity: 42,
    autonomyKmPerLiter: 6.6
  };

  const clientVehicleMission = {
    id: 'mis-202611301',
    code: '202611301',
    description: 'TJ SESSÕES TURMA RECURSAL',
    date: '2026-11-25',
    endDate: '2026-11-27',
    isMultiDay: true,
    departureTime: '08:00',
    returnTimeEstimated: '18:00',
    transportType: 'client_vehicle',
    vehicleNameDisplay: '🤝 Viatura do Contratante',
    vehicleAllocations: [],
    missionStatus: 'Em Execução'
  };

  const inMission = isVehicleInMission(sparkVehicle, clientVehicleMission);
  assert.strictEqual(inMission, false, 'Viatura Chev Spark NÃO deve ser considerada em uso quando o transporte é do contratante!');
  console.log('✅ isVehicleInMission com client_vehicle:', inMission);

  const activeVehMission = getActiveMissionForVehicle(sparkVehicle, [clientVehicleMission]);
  assert.strictEqual(activeVehMission, null, 'Nenhuma missão da frota deve prender o veículo quando é transporte do cliente!');
  console.log('✅ getActiveMissionForVehicle com client_vehicle:', activeVehMission);

  console.log('\n🎉 TODOS OS TESTES PASSARAM COM SUCESSO!\n');
}

runTests().catch((err) => {
  console.error('❌ ERRO NO TESTE:', err);
  process.exit(1);
});
