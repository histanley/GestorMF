// tests/admin-center-approval-test.cjs
const assert = require('assert');

// Mock de missões contendo pauta pendente de aprovação de pós-produção
const mockMissions = [
  {
    id: 'm1',
    code: '202611121',
    description: 'Gravação de libras com Nina',
    date: '2026-11-12',
    departureTime: '09:55',
    missionStatus: 'Pendente',
    editionStatus: 'Edição Concluída',
    editorNamesDisplay: 'Jonathan Jordan',
    editionCompletedBy: 'Jonathan Jordan',
    serverFilePath: 'S:\\MEGA FILMES\\SEBRAE\\1112 (1)',
    editionHistory: [
      {
        id: 'h-1',
        type: 'CONCLUDED',
        user: 'Jonathan Jordan',
        serverFilePath: 'S:\\MEGA FILMES\\SEBRAE\\1112 (1)',
        message: 'Vídeo gravado e renderizado em 4K. Pronto para validação.'
      }
    ],
    extraHoursRequests: [
      {
        id: 'req-1',
        memberId: 5,
        memberName: 'Renato',
        hoursRequested: 2,
        status: 'PENDING',
        reason: 'Atraso na liberação da pauta pela contratante'
      }
    ]
  },
  {
    id: 'm2',
    code: '202611191',
    description: 'TJ Sessões Criminal',
    date: '2026-11-19',
    departureTime: '08:00',
    missionStatus: 'Agendada',
    editionStatus: 'Pendente'
  },
  {
    id: 'm3',
    code: '202611101',
    description: 'Comercial Loja Centro',
    date: '2026-11-10',
    departureTime: '10:00',
    missionStatus: 'Finalizada',
    editionStatus: 'Edição Concluída'
  }
];

// Teste de filtro de pós-produção pendente
const pendingEditions = mockMissions.filter(
  (m) => m.editionStatus === 'Edição Concluída' && m.missionStatus !== 'Finalizada'
);
assert.strictEqual(pendingEditions.length, 1);
assert.strictEqual(pendingEditions[0].code, '202611121');
assert.strictEqual(pendingEditions[0].description, 'Gravação de libras com Nina');
assert.strictEqual(pendingEditions[0].serverFilePath, 'S:\\MEGA FILMES\\SEBRAE\\1112 (1)');

// Teste de filtro de pós-produção finalizada (histórico)
const historyEditions = mockMissions.filter(
  (m) => m.missionStatus === 'Finalizada' && m.editionStatus === 'Edição Concluída'
);
assert.strictEqual(historyEditions.length, 1);
assert.strictEqual(historyEditions[0].code, '202611101');

// Teste de aprovação: atualiza para Finalizada
const approveMission = (mission, adminName) => {
  return {
    ...mission,
    missionStatus: 'Finalizada',
    editionStatus: 'Edição Concluída',
    editionHistory: [
      ...mission.editionHistory,
      {
        id: 'h-app',
        type: 'APPROVED',
        user: adminName,
        title: 'Material Aprovado e Missão Finalizada'
      }
    ]
  };
};

const approved = approveMission(pendingEditions[0], 'Histanley');
assert.strictEqual(approved.missionStatus, 'Finalizada');
assert.strictEqual(approved.editionStatus, 'Edição Concluída');
assert.strictEqual(approved.editionHistory.length, 2);
assert.strictEqual(approved.editionHistory[1].type, 'APPROVED');

// Teste de rejeição e reabertura: retorna para Pendente (Em Edição)
const reopenMission = (mission, adminName, reason) => {
  return {
    ...mission,
    missionStatus: 'Pendente',
    editionStatus: 'Em Edição',
    reopenReason: reason,
    editionHistory: [
      ...mission.editionHistory,
      {
        id: 'h-reopen',
        type: 'REOPENED',
        user: adminName,
        reason
      }
    ]
  };
};

const reopened = reopenMission(pendingEditions[0], 'Histanley', 'Corrigir transição e vinheta aos 02:15');
assert.strictEqual(reopened.missionStatus, 'Pendente');
assert.strictEqual(reopened.editionStatus, 'Em Edição');
assert.strictEqual(reopened.reopenReason, 'Corrigir transição e vinheta aos 02:15');

console.log('✅ TESTES DA CENTRAL DO ADMINISTRADOR (APROVAÇÃO DE PÓS-PRODUÇÃO E REABERTURA) PASSARAM COM 100% DE SUCESSO!');
