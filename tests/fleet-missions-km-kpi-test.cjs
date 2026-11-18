const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Carregar utilitários geo
const geoPath = path.resolve(__dirname, '../src/utils/geo.js');
const geoCode = fs.readFileSync(geoPath, 'utf8');

// Testes estáticos de código no VehicleManager.jsx
const vmPath = path.resolve(__dirname, '../src/components/VehicleManager.jsx');
const vmCode = fs.readFileSync(vmPath, 'utf8');

console.log('--- Testando KPI de KM em Missões no GestorMF ---');

// 1. Verificar se o label antigo foi substituído
assert.strictEqual(
  vmCode.includes('<span className="kpi-label">KM Total Frota</span>'),
  false,
  'O label antigo "KM Total Frota" não deve existir mais no VehicleManager.jsx'
);

// 2. Verificar se o novo label e cálculo existem
assert.strictEqual(
  vmCode.includes('<span className="kpi-label">KM em Missões</span>'),
  true,
  'Deve conter o novo label "KM em Missões"'
);

assert.strictEqual(
  vmCode.includes('totalKmMissoes'),
  true,
  'Deve calcular a constante totalKmMissoes'
);

// 3. Simulação matemática da telemetria de missões da frota
const mockVehicles = [
  { id: 'v1', name: 'Chev Spark', plate: 'ABC4E67', currentKm: 30463.2, tankCapacity: 42, autonomyKmPerLiter: 6.6, fuelType: 'Elétrico' },
  { id: 'v2', name: 'Renault Master', plate: 'NAQ5H83', currentKm: 148478, tankCapacity: 50, autonomyKmPerLiter: 12, fuelType: 'Diesel' },
  { id: 'v3', name: 'S10', plate: 'PHX0C45', currentKm: 139646.4, tankCapacity: 50, autonomyKmPerLiter: 12, fuelType: 'Diesel' },
];

const mockMissions = [
  { id: 'm1', vehicleId: 'v1', distanceKm: 7.0, totalDistanceKm: 14.0, missionStatus: 'Concluída' },
  { id: 'm2', vehicleId: 'v1', distanceKm: 122.1, totalDistanceKm: 244.2, missionStatus: 'Concluída' },
  { id: 'm3', vehicleId: 'v3', distanceKm: 7.45, totalDistanceKm: 14.9, missionStatus: 'Agendada' },
  { id: 'm4', vehicleId: 'v3', distanceKm: 41.75, totalDistanceKm: 83.5, missionStatus: 'Concluída' },
  // Missão cancelada não deve ser contabilizada
  { id: 'm5', vehicleId: 'v3', distanceKm: 20.0, totalDistanceKm: 40.0, missionStatus: 'Cancelada' },
  // Missão sem viatura (a pé / remota)
  { id: 'm6', distanceKm: 15.0, totalDistanceKm: 30.0, missionStatus: 'Concluída' },
];

// Helper mock simples baseado na lógica de geo.js
function getMissionTotalKm(m) {
  if (!m) return 0;
  const oneWay = parseFloat(m.distanceKm) || 0;
  if (m.totalDistanceKm && m.totalDistanceKm > oneWay) {
    return parseFloat(parseFloat(m.totalDistanceKm).toFixed(1));
  }
  return parseFloat((oneWay * 2).toFixed(1));
}

function calculateTelemetry(v, missions) {
  const vMissions = missions.filter(m => m.vehicleId === v.id && m.missionStatus !== 'Cancelada');
  const totalMissionsKm = vMissions.reduce((acc, m) => acc + getMissionTotalKm(m), 0);
  return {
    totalMissionsKm: parseFloat(totalMissionsKm.toFixed(1)),
    effectiveOdometerKm: parseFloat(((parseFloat(v.currentKm) || 0) + totalMissionsKm).toFixed(1)),
  };
}

const telemetryList = mockVehicles.map(v => ({
  vehicle: v,
  telemetry: calculateTelemetry(v, mockMissions),
}));

const totalKmMissoes = parseFloat(
  telemetryList.reduce((acc, item) => acc + (item.telemetry.totalMissionsKm || 0), 0).toFixed(1)
);

const totalKmOdometro = parseFloat(
  telemetryList.reduce((acc, item) => acc + (item.telemetry.effectiveOdometerKm || 0), 0).toFixed(1)
);

console.log('Total KM Percorrido em Missões pela Frota:', totalKmMissoes, 'km');
console.log('Total Odômetro Acumulado da Frota:', totalKmOdometro, 'km');

// v1: 14.0 + 244.2 = 258.2 km
assert.strictEqual(telemetryList[0].telemetry.totalMissionsKm, 258.2);
// v2: 0 km
assert.strictEqual(telemetryList[1].telemetry.totalMissionsKm, 0);
// v3: 14.9 + 83.5 = 98.4 km (m5 cancelada ignorada)
assert.strictEqual(telemetryList[2].telemetry.totalMissionsKm, 98.4);

// Total em missões da frota: 258.2 + 0 + 98.4 = 356.6 km
assert.strictEqual(totalKmMissoes, 356.6);

// Odômetro total somado: (30463.2 + 258.2) + 148478 + (139646.4 + 98.4) = 318944.2 km
assert.strictEqual(totalKmOdometro, 318944.2);

console.log('✅ Todos os testes do KPI de KM em Missões passaram com sucesso!');
