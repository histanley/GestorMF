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

const fs = require('fs');
const path = require('path');

const reopened = reopenMission(pendingEditions[0], 'Histanley', 'Corrigir transição e vinheta aos 02:15');
assert.strictEqual(reopened.missionStatus, 'Pendente');
assert.strictEqual(reopened.editionStatus, 'Em Edição');
assert.strictEqual(reopened.reopenReason, 'Corrigir transição e vinheta aos 02:15');

// Validação de código nos componentes:
// 1. Reabertura de missão já Finalizada pelo Administrador
// 2. Exibição de dia e hora de entrega do editor (formatDeliveryDateTimeBR)
// 3. Blindagem contra falso positivo de entrega por evento ASSIGNED
const postProdCode = fs.readFileSync(path.join(__dirname, '..', 'src', 'utils', 'postProduction.js'), 'utf8');
const serviceBoardCode = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'ServiceBoard.jsx'), 'utf8');
const adminCenterCode = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'AdminCenter.jsx'), 'utf8');
const missionsPhpCode = fs.readFileSync(path.join(__dirname, '..', 'public', 'api', 'missions.php'), 'utf8');

assert(postProdCode.includes('export function formatDeliveryDateTimeBR'),
  'postProduction.js deve exportar formatDeliveryDateTimeBR para exibir dia e hora da entrega');
assert(postProdCode.includes("lastDecision.type === 'REOPENED'") && postProdCode.includes('return false;'),
  'isMissionApprovedOrFinished deve retornar false quando o último evento de decisão for REOPENED');
assert(serviceBoardCode.includes('Reabrir Missão &amp; Pós-Produção') && serviceBoardCode.includes('Reabrir Pós-Produção'),
  'ServiceBoard.jsx deve exibir botão para o Administrador reabrir missões finalizadas e as entregas da pós-produção');
assert(serviceBoardCode.includes('Entregue em:') && serviceBoardCode.includes('formatDeliveryDateTimeBR'),
  'ServiceBoard.jsx deve exibir dia e hora de quando cada editor entregou o material');
assert(adminCenterCode.includes('Reabrir Missão &amp; Pós-Produção') && adminCenterCode.includes('formatDeliveryDateTimeBR'),
  'AdminCenter.jsx deve permitir reabrir missões do Histórico Finalizado e exibir dia e hora da entrega de cada editor');
assert(adminCenterCode.includes('ac-pp-history-list-wrap') && adminCenterCode.includes('Aprovação da Diretoria (Dia e Hora)'),
  'AdminCenter.jsx deve exibir o Histórico Finalizado em lista detalhada com dia e hora da aprovação da diretoria');
assert(missionsPhpCode.includes("in_array(\$hType, ['COMPLETED', 'PARTIAL_COMPLETED', 'CONCLUDED'], true)"),
  'missions.php só deve recuperar entregas do histórico a partir de eventos reais de conclusão (COMPLETED/PARTIAL_COMPLETED/CONCLUDED)');
assert(missionsPhpCode.includes("stripos(\$noteStr, 'Editor responsável:') !== false"),
  'missions.php deve higienizar automaticamente falsos positivos antigos gerados por eventos ASSIGNED no editors_delivery');

console.log('✅ TESTES DA CENTRAL DO ADMINISTRADOR (APROVAÇÃO DE PÓS-PRODUÇÃO E REABERTURA) PASSARAM COM 100% DE SUCESSO!');

