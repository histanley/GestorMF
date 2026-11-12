// tests/sort-chronology-test.cjs
const assert = require('assert');

// Mock dos helpers e da função sortMissionsByStatusPriority
function isMissionFinalizada(m) {
  const status = (m?.missionStatus || '').toLowerCase();
  return status === 'finalizada' || status === 'finalizado' || status === 'concluída' || status === 'concluida';
}

function getMissionStatusPriority(mission) {
  const status = (mission?.missionStatus || 'agendada').toLowerCase();
  if (status === 'em execução' || status === 'em preparo' || status === 'em andamento') return 1;
  if (status === 'pendente') return 2;
  if (status === 'agendada' || status === 'agendado') return 3;
  if (isMissionFinalizada(mission)) return 4;
  if (status === 'cancelada' || status === 'cancelado') return 5;
  return 6;
}

function sortMissionsByStatusPriority(missions = []) {
  if (!Array.isArray(missions)) return [];
  return [...missions].sort((a, b) => {
    const isFinA = isMissionFinalizada(a) || a.missionStatus === 'Cancelada';
    const isFinB = isMissionFinalizada(b) || b.missionStatus === 'Cancelada';

    // Missões ativas sempre vêm antes de missões finalizadas/canceladas
    if (!isFinA && isFinB) return -1;
    if (isFinA && !isFinB) return 1;

    // Se ambas forem finalizadas/canceladas: mais recentes primeiro (data DESC, hora DESC)
    if (isFinA && isFinB) {
      const dateComp = String(b.date || '').localeCompare(String(a.date || ''));
      if (dateComp !== 0) return dateComp;
      const timeComp = String(b.departureTime || '00:00').localeCompare(String(a.departureTime || '00:00'));
      if (timeComp !== 0) return timeComp;
      return String(b.id || '').localeCompare(String(a.id || ''));
    }

    // Ambas são ativas:
    // 1º lugar: Em Execução / Em Andamento tem prioridade máxima imediata no terreno
    const isExecA = a.missionStatus === 'Em Execução' || a.missionStatus === 'Em Andamento';
    const isExecB = b.missionStatus === 'Em Execução' || b.missionStatus === 'Em Andamento';
    if (isExecA && !isExecB) return -1;
    if (!isExecA && isExecB) return 1;

    // 2º lugar: Ordem de acontecimento cronológico estrito (o que vai acontecer logo aparece primeiro)
    const dateA = String(a.date || '9999-99-99');
    const dateB = String(b.date || '9999-99-99');
    const dateComp = dateA.localeCompare(dateB);
    if (dateComp !== 0) return dateComp;

    // 3º lugar: No mesmo dia, o horário de saída mais cedo vem primeiro
    const timeA = String(a.departureTime || a.eventStartTime || '99:99');
    const timeB = String(b.departureTime || b.eventStartTime || '99:99');
    const timeComp = timeA.localeCompare(timeB);
    if (timeComp !== 0) return timeComp;

    // 4º lugar: Prioridade de status (Pendente vs Agendada)
    const pA = getMissionStatusPriority(a);
    const pB = getMissionStatusPriority(b);
    if (pA !== pB) return pA - pB;

    // 5º lugar: ID crescente
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
}

console.log('=== TESTE DE ORDENAÇÃO CRONOLÓGICA DAS MISSÕES ===');

// Cenário exatamente reproduzido da foto do usuário
const mockMissions = [
  { id: '1', date: '2026-11-12', departureTime: '09:55', missionStatus: 'Pendente', description: 'Gravação libras Nina' },
  { id: '2', date: '2026-12-01', departureTime: '08:00', missionStatus: 'Agendada', description: 'TJ Sessões Criminal Dezembro' },
  { id: '3', date: '2026-11-30', departureTime: '08:00', missionStatus: 'Agendada', description: 'TJ Turma Recursal Fim de Novembro' },
  { id: '4', date: '2026-11-26', departureTime: '08:00', missionStatus: 'Agendada', description: 'Câmara Cível' },
  { id: '5', date: '2026-11-24', departureTime: '08:00', missionStatus: 'Agendada', description: 'TJ Sessões Criminal 24' },
  { id: '6', date: '2026-11-19', departureTime: '08:00', missionStatus: 'Agendada', description: 'TJ Sessões Criminal 19' },
  { id: '7', date: '2026-11-12', departureTime: '08:00', missionStatus: 'Agendada', description: 'Missão cedo hoje' },
  { id: '8', date: '2026-11-10', departureTime: '10:00', missionStatus: 'Finalizada', description: 'Missão passada já concluída' }
];

const sorted = sortMissionsByStatusPriority(mockMissions);

console.log('Ordem resultante:');
sorted.forEach((m, idx) => {
  console.log(`  ${idx + 1}. [${m.date} ${m.departureTime}] [${m.missionStatus}] ${m.description}`);
});

// Verificações
// 1. As ativas de 12/11 devem vir antes de 19/11
assert.strictEqual(sorted[0].date, '2026-11-12');
assert.strictEqual(sorted[1].date, '2026-11-12');
assert.strictEqual(sorted[2].date, '2026-11-19');
assert.strictEqual(sorted[3].date, '2026-11-24');
assert.strictEqual(sorted[4].date, '2026-11-26');
assert.strictEqual(sorted[5].date, '2026-11-30');
assert.strictEqual(sorted[6].date, '2026-12-01');

// 2. No mesmo dia (12/11), 08:00 deve vir antes de 09:55
assert.strictEqual(sorted[0].departureTime, '08:00');
assert.strictEqual(sorted[1].departureTime, '09:55');

// 3. Finalizada deve ficar por último
assert.strictEqual(sorted[7].missionStatus, 'Finalizada');

console.log('\n✅ TODOS OS TESTES DE ORDENAÇÃO CRONOLÓGICA PASSARAM COM SUCESSO!');

