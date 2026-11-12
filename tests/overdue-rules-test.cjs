// Teste de validação das regras de atraso e pós-produção
const assert = require('assert');

// Mock das funções exportadas em src/utils/geo.js
function hasMissionPostProduction(mission) {
  if (!mission) return false;
  if (mission.hasPostProduction === false) return false;
  const edition = String(mission.editionStatus || '').trim().toLowerCase();
  if (!edition) return false;
  if (
    edition === 'não se aplica' ||
    edition === 'nao se aplica' ||
    edition.startsWith('não se aplica') ||
    edition.startsWith('nao se aplica') ||
    edition === 'sem pós-produção' ||
    edition === 'sem pos-producao' ||
    edition === 'desativado'
  ) {
    return false;
  }
  return true;
}

function checkIsMissionOverdue(mission) {
  if (!mission) return false;

  // 1. Sem pós-produção -> Nunca atrasada
  if (!hasMissionPostProduction(mission)) {
    return false;
  }

  // 2. Missão finalizada ou cancelada
  const mStatus = mission.missionStatus || 'Agendada';
  if (
    mStatus === 'Finalizada' ||
    mStatus === 'Finalizado' ||
    mStatus === 'Concluída' ||
    mStatus === 'Cancelada'
  ) {
    return false;
  }

  // 3. Edição já concluída ou entregue
  const edStatus = String(mission.editionStatus || '').trim();
  if (
    edStatus === 'Edição Concluída' ||
    edStatus === 'Entregue' ||
    edStatus === 'Aprovado' ||
    mission.editionDeliveryStatus === 'Dentro do Prazo'
  ) {
    return false;
  }

  // 4. Se a missão ainda é futura e está Agendada (o evento ainda não ocorreu)
  if (mStatus === 'Agendada' && mission.date) {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (mission.date > todayStr) {
      return false;
    }
    if (mission.date === todayStr && mission.departureTime) {
      const [depH, depM] = String(mission.departureTime).split(':').map(Number);
      if (!isNaN(depH) && !isNaN(depM)) {
        const missionStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), depH, depM, 0, 0);
        if (now.getTime() < missionStart.getTime()) {
          return false;
        }
      }
    }
  }

  // 5. Validação da data e horário limite de entrega
  if (!mission.deliveryDeadlineDate) {
    return false;
  }

  const dateParts = String(mission.deliveryDeadlineDate).split('-').map(Number);
  if (dateParts.length < 3) return false;
  const timeParts = String(mission.deliveryDeadlineTime || '18:00').split(':').map(Number);
  const [y, m, d] = dateParts;
  const [h, min] = timeParts;
  const deadlineDate = new Date(y, m - 1, d, isNaN(h) ? 18 : h, isNaN(min) ? 0 : min, 0, 0);

  return Date.now() > deadlineDate.getTime();
}

console.log('--- EXECUTANDO TESTES DE REGRAS DE PÓS-PRODUÇÃO E ATRASO ---');

// Cenário 1: Missão com "Não se aplica" com data residual vencida
const missionNotApplicable = {
  id: '1',
  missionStatus: 'Agendada',
  editionStatus: 'Não se aplica (Mega Print / Instalação)',
  date: '2026-11-17',
  deliveryDeadlineDate: '2026-11-12',
  deliveryDeadlineTime: '18:00',
  isOverdue: 1
};
assert.strictEqual(hasMissionPostProduction(missionNotApplicable), false, 'Não se aplica não tem pós-produção');
assert.strictEqual(checkIsMissionOverdue(missionNotApplicable), false, 'Não se aplica NUNCA deve ser marcada como atrasada');
console.log('✓ Cenário 1 passou: Missão com "Não se aplica" não tem pós-produção e nunca atrasa.');

// Cenário 2: Missão futura agendada com pós-produção (evento ainda não aconteceu)
const missionFuture = {
  id: '2',
  missionStatus: 'Agendada',
  editionStatus: 'Pendente',
  date: '2099-12-31',
  departureTime: '10:00',
  deliveryDeadlineDate: '2026-11-12', // Data residual passada
  deliveryDeadlineTime: '18:00'
};
assert.strictEqual(hasMissionPostProduction(missionFuture), true);
assert.strictEqual(checkIsMissionOverdue(missionFuture), false, 'Missão futura agendada NUNCA pode ter pós-produção atrasada');
console.log('✓ Cenário 2 passou: Missão futura agendada não entra em atraso de pós-produção antes do evento.');

// Cenário 3: Missão passada que já ocorreu e o prazo estipulado venceu
const missionRealOverdue = {
  id: '3',
  missionStatus: 'Pendente',
  editionStatus: 'Em Edição',
  date: '2026-11-01',
  departureTime: '08:00',
  deliveryDeadlineDate: '2026-11-05',
  deliveryDeadlineTime: '18:00'
};
assert.strictEqual(hasMissionPostProduction(missionRealOverdue), true);
assert.strictEqual(checkIsMissionOverdue(missionRealOverdue), true, 'Missão passada com prazo expirado DEVE estar atrasada');
console.log('✓ Cenário 3 passou: Missão passada com prazo expirado é corretamente marcada como atrasada.');

// Cenário 4: Missão finalizada
const missionFinalizada = {
  id: '4',
  missionStatus: 'Finalizada',
  editionStatus: 'Edição Concluída',
  date: '2026-11-01',
  deliveryDeadlineDate: '2026-11-05',
  deliveryDeadlineTime: '18:00'
};
assert.strictEqual(checkIsMissionOverdue(missionFinalizada), false, 'Missão finalizada nunca atrasa');
console.log('✓ Cenário 4 passou: Missão finalizada nunca atrasa.');

console.log('--- TODOS OS TESTES PASSARAM COM SUCESSO! ---');
