const assert = require('assert');

// Simulação da função getMissionStatusPriority e sortMissionsByStatusPriority
function getMissionStatusPriority(mission) {
  if (!mission) return 99;
  const status = (mission.missionStatus || 'Agendada').toLowerCase().trim();

  // 1º lugar: Em Execução e variações de campo ativo
  if (
    status === 'em execução' ||
    status === 'em execucao' ||
    status === 'em andamento' ||
    status === 'em preparo' ||
    status === 'saiu' ||
    status === 'em deslocamento'
  ) {
    return 1;
  }

  // 2º lugar: Pendente (Pós-Produção)
  if (status === 'pendente') {
    return 2;
  }

  // 3º lugar: Agendadas
  if (status === 'agendada' || status === 'agendado') {
    return 3;
  }

  // 4º lugar: Finalizadas / Concluídas
  if (
    status === 'finalizada' ||
    status === 'finalizado' ||
    status === 'concluída' ||
    status === 'concluida'
  ) {
    return 4;
  }

  // 5º lugar: Canceladas
  if (status === 'cancelada' || status === 'cancelado') {
    return 5;
  }

  return 6;
}

function sortMissionsByStatusPriority(missions = []) {
  if (!Array.isArray(missions)) return [];
  return [...missions].sort((a, b) => {
    const pA = getMissionStatusPriority(a);
    const pB = getMissionStatusPriority(b);
    if (pA !== pB) {
      return pA - pB;
    }

    const dateComp = String(b.date || '').localeCompare(String(a.date || ''));
    if (dateComp !== 0) return dateComp;

    const timeA = String(a.departureTime || a.eventStartTime || '99:99');
    const timeB = String(b.departureTime || b.eventStartTime || '99:99');
    const timeComp = timeA.localeCompare(timeB);
    if (timeComp !== 0) return timeComp;

    return String(b.id || '').localeCompare(String(a.id || ''));
  });
}

// TESTES:
const mockMissions = [
  { id: 'm1', code: '101', description: 'Gravação Futura', missionStatus: 'Agendada', date: '2026-11-10', departureTime: '14:00' },
  { id: 'm2', code: '102', description: 'Gravação em Andamento', missionStatus: 'Em Execução', date: '2026-11-10', departureTime: '10:00' },
  { id: 'm3', code: '103', description: 'Pauta Concluída em Edição', missionStatus: 'Pendente', date: '2026-11-09', departureTime: '08:00' },
  { id: 'm4', code: '104', description: 'Em Preparo 1h antes', missionStatus: 'Em Preparo', date: '2026-11-10', departureTime: '11:00' },
  { id: 'm5', code: '105', description: 'Pauta do Mês Passado', missionStatus: 'Finalizada', date: '2026-10-25', departureTime: '09:00' },
  { id: 'm6', code: '106', description: 'Pauta Pendente Mais Recente', missionStatus: 'Pendente', date: '2026-11-10', departureTime: '09:00' },
];

const sorted = sortMissionsByStatusPriority(mockMissions);

// Validações
// 1º lugar: Devem ser Em Execução / Em Preparo
assert.strictEqual(sorted[0].id, 'm2', '1º deve ser Em Execução (m2)');
assert.strictEqual(sorted[1].id, 'm4', '2º deve ser Em Preparo (m4)');

// 2º lugar: Devem ser Pendentes (data mais recente primeiro: m6 antes de m3)
assert.strictEqual(sorted[2].id, 'm6', '3º deve ser Pendente mais recente (m6)');
assert.strictEqual(sorted[3].id, 'm3', '4º deve ser Pendente anterior (m3)');

// 3º lugar: Deve ser Agendada
assert.strictEqual(sorted[4].id, 'm1', '5º deve ser Agendada (m1)');

// 4º lugar: Deve ser Finalizada
assert.strictEqual(sorted[5].id, 'm5', '6º deve ser Finalizada (m5)');

console.log('[PASS] Teste de ordenação de missões (Em Execução > Pendente > Agendada) passou com sucesso!');
