const assert = require('assert');
const { computeVehicleFuelTelemetry } = require('../src/utils/geo.js');

console.log('=== TEST SUITE: TELEMETRIA CRONOLÓGICA & REGISTRO DE ABASTECIMENTOS ===');

// 1. Caso Real da S10 (PHX0C45) do print do usuário
// A S10 possui 11 missões totalizando 5.915,4 km (consumo de 492,95 L) e 5 registros de combustível (152,67 L).
const s10Vehicle = {
  id: 'v3',
  name: 'S10',
  plate: 'PHX0C45',
  company: 'MegaFilmes',
  fuelType: 'Diesel',
  tankCapacity: 50,
  autonomyKmPerLiter: 12,
  currentKm: 169123.4,
  fuelLogs: [
    { id: 'f-1', date: '2026-11-01', liters: 30, amountSpent: 206.7 },
    { id: 'f-2', date: '2026-11-05', liters: 30, amountSpent: 206.7 },
    { id: 'f-3', date: '2026-11-10', liters: 30, amountSpent: 206.7 },
    { id: 'f-4', date: '2026-11-15', liters: 30, amountSpent: 206.7 },
    { id: 'f-5', date: '2026-11-18', liters: 32.67, amountSpent: 225.1 }
  ]
};

// 11 Missões realizadas ao longo de novembro
const s10Missions = [
  { id: 'm1', vehicleId: 'v3', date: '2026-11-02', totalDistanceKm: 500, missionStatus: 'Concluída' },
  { id: 'm2', vehicleId: 'v3', date: '2026-11-06', totalDistanceKm: 500, missionStatus: 'Concluída' },
  { id: 'm3', vehicleId: 'v3', date: '2026-11-11', totalDistanceKm: 500, missionStatus: 'Concluída' },
  { id: 'm4', vehicleId: 'v3', date: '2026-11-16', totalDistanceKm: 500, missionStatus: 'Concluída' },
  { id: 'm5', vehicleId: 'v3', date: '2026-11-19', totalDistanceKm: 600, missionStatus: 'Concluída' },
  { id: 'm6', vehicleId: 'v3', date: '2026-11-20', totalDistanceKm: 600, missionStatus: 'Concluída' },
  { id: 'm7', vehicleId: 'v3', date: '2026-11-21', totalDistanceKm: 600, missionStatus: 'Concluída' },
  { id: 'm8', vehicleId: 'v3', date: '2026-11-22', totalDistanceKm: 700, missionStatus: 'Concluída' },
  { id: 'm9', vehicleId: 'v3', date: '2026-11-22', totalDistanceKm: 700, missionStatus: 'Concluída' },
  { id: 'm10', vehicleId: 'v3', date: '2026-11-23', totalDistanceKm: 350, missionStatus: 'Concluída' },
  { id: 'm11', vehicleId: 'v3', date: '2026-11-23', totalDistanceKm: 365.4, missionStatus: 'Concluída' }
];

// Teste A: Antes do novo abastecimento, o tanque está em reserva (0 L)
const telBefore = computeVehicleFuelTelemetry(s10Vehicle, s10Missions);
assert.strictEqual(telBefore.currentLiters, 0, 'Antes do novo abastecimento o tanque deve estar em 0L');
assert.strictEqual(telBefore.currentPercent, 0, 'Percentual deve ser 0%');
assert.strictEqual(telBefore.isReserveAlert, true, 'Deve alertar reserva de combustível');
console.log('✓ Teste A passou: S10 em 0L (0%) com alerta de reserva antes do abastecimento');

// Teste B: Usuário abastece 50L (Completar Tanque) hoje (23/11)
const s10WithNewRefuel = {
  ...s10Vehicle,
  fuelLogs: [
    ...s10Vehicle.fuelLogs,
    { id: 'f-' + Date.now(), date: '2026-11-23', liters: 50, amountSpent: 344.5 }
  ]
};

const telAfterFull = computeVehicleFuelTelemetry(s10WithNewRefuel, s10Missions);
assert.strictEqual(telAfterFull.currentLiters, 50, 'Após abastecer 50L em tanque de 50L, o tanque deve ficar em 50L cheios');
assert.strictEqual(telAfterFull.currentPercent, 100, 'Percentual deve ir para 100%');
assert.strictEqual(telAfterFull.isReserveAlert, false, 'Alerta de reserva deve sumir imediatamente');
assert.strictEqual(telAfterFull.remainingRangeKm, 600, 'Autonomia deve ser de 600 km (50L * 12 km/L)');
console.log('✓ Teste B passou: S10 após abastecimento de 50L vai a 100% (50L, 600km) e alerta de reserva é extinto!');

// Teste C: Usuário faz abastecimento parcial de 20L
const s10PartialRefuel = {
  ...s10Vehicle,
  fuelLogs: [
    ...s10Vehicle.fuelLogs,
    { id: 'f-' + Date.now(), date: '2026-11-23', liters: 20, amountSpent: 137.8 }
  ]
};

const telAfterPartial = computeVehicleFuelTelemetry(s10PartialRefuel, s10Missions);
assert.strictEqual(telAfterPartial.currentLiters, 20, 'Tanque deve registrar exatamente os 20L colocados');
assert.strictEqual(telAfterPartial.currentPercent, 40, 'Percentual deve ir para 40% (20L / 50L)');
assert.strictEqual(telAfterPartial.isReserveAlert, false, 'Alerta de reserva (<=10%) não deve disparar em 40%');
console.log('✓ Teste C passou: Abastecimento parcial de 20L eleva tanque para 40% (20L) corretamente');

// Teste D: Veículo Elétrico (Chev Spark - 42 kWh)
const sparkVeh = {
  id: 'v1',
  name: 'Chev Spark',
  plate: 'ABC4E67',
  fuelType: 'Elétrico',
  tankCapacity: 42,
  autonomyKmPerLiter: 6.6,
  fuelLogs: []
};
const sparkMissions = [
  { id: 'sm1', vehicleId: 'v1', date: '2026-11-20', totalDistanceKm: 277.2 } // consumiu 42 kWh
];
const telSparkBefore = computeVehicleFuelTelemetry(sparkVeh, sparkMissions);
assert.strictEqual(telSparkBefore.currentLiters, 0, 'Bateria do Spark zerada após missão total');

const sparkRecharged = {
  ...sparkVeh,
  fuelLogs: [{ id: 'f-' + Date.now(), date: '2026-11-23', liters: 35.7, amountSpent: 33.9 }]
};
const telSparkAfter = computeVehicleFuelTelemetry(sparkRecharged, sparkMissions);
assert.strictEqual(telSparkAfter.currentLiters, 35.7, 'Bateria deve marcar 35.7 kWh');
assert.strictEqual(telSparkAfter.currentPercent, 85, 'Bateria deve marcar 85%');
console.log('✓ Teste D passou: Recarga de veículo elétrico atualiza bateria com precisão');

console.log('\nTODOS OS TESTES DE TELEMETRIA CRONOLÓGICA PASSARAM COM 100% DE SUCESSO!\n');
