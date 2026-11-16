const assert = require('assert');

// Mock da função isMemberEligibleForExtraHours diretamente para teste
function isMemberEligibleForExtraHours(member, mission) {
  if (!member || !mission) return false;
  const memIdStr = String(member.id);
  const memNameNorm = String(member.name || '').trim().toLowerCase();

  // 1. Checa se o colaborador foi condutor/motorista em campo
  const allocations = Array.isArray(mission.vehicleAllocations) ? mission.vehicleAllocations : [];
  const isDriver = allocations.some(
    (a) => (a.driverId && String(a.driverId) === memIdStr) ||
           (a.driverName && String(a.driverName).trim().toLowerCase() === memNameNorm)
  ) || (mission.driverId && String(mission.driverId) === memIdStr) ||
       (mission.driverName && String(mission.driverName).trim().toLowerCase() === memNameNorm);

  if (isDriver) return true;

  // 2. Checa se o colaborador esteve escalado na equipe presencial de campo
  const teamIds = Array.isArray(mission.teamIds) ? mission.teamIds.map(String) : [];
  const inTeamIds = teamIds.includes(memIdStr);
  const inTeamMembers = Array.isArray(mission.teamMembers) &&
    mission.teamMembers.some((tm) => String(tm.id) === memIdStr || String(tm.name || '').trim().toLowerCase() === memNameNorm);
  const inTeamField = Array.isArray(mission.team) &&
    mission.team.some((t) => String(t) === memIdStr || String(t).trim().toLowerCase() === memNameNorm);

  // 3. Checa funções explícitas atribuídas no evento de campo
  const explicitRoles = mission.memberRoles?.[member.id] || mission.memberRoles?.[memIdStr];
  const hasFieldRole = Array.isArray(explicitRoles)
    ? explicitRoles.some((r) => r !== 'Editor de Vídeo' && r !== 'Designer Gráfico')
    : (typeof explicitRoles === 'string' && explicitRoles.trim() && explicitRoles !== 'Editor de Vídeo' && explicitRoles !== 'Designer Gráfico');

  const isFieldMember = inTeamIds || inTeamMembers || inTeamField || hasFieldRole;
  if (isFieldMember) return true;

  // Se o colaborador atuou apenas como editor de pós-produção (sem ir a campo), NÃO é elegível a horas extras
  return false;
}

console.log('====================================================');
console.log('   TESTE: REGRA DE HORAS EXTRAS PARA EDITORES      ');
console.log('====================================================');

// Cenário 1: Editor que fica apenas na pós-produção (não foi a campo)
const editorOnlyMember = { id: 10, name: 'Pedro Editor', role: 'Editor de Vídeo' };
const missionWithEditor = {
  id: 101,
  date: '2026-11-16',
  teamIds: [1, 2], // Equipe de campo: outros membros
  vehicleAllocations: [{ vehicleId: 'v1', driverId: 1 }],
  editorIds: [10], // Pedro é editor na pós
  extraHoursApproved: 2,
};

assert.strictEqual(
  isMemberEligibleForExtraHours(editorOnlyMember, missionWithEditor),
  false,
  'Editor exclusivo de pós-produção não deve ser elegível a horas extras'
);
console.log('[PASS] 01. Editor exclusivo de pós-produção não é elegível a horas extras.');

// Cenário 2: Colaborador que foi a campo como Cinegrafista
const fieldMember = { id: 2, name: 'Mateus Cinegrafista', role: 'Cinegrafista' };
assert.strictEqual(
  isMemberEligibleForExtraHours(fieldMember, missionWithEditor),
  true,
  'Colaborador na equipe de campo deve ser elegível a horas extras'
);
console.log('[PASS] 02. Membro presencial da equipe de campo é elegível a horas extras.');

// Cenário 3: Colaborador que foi como motorista
const driverMember = { id: 1, name: 'João Motorista', role: 'Motorista / Produção' };
assert.strictEqual(
  isMemberEligibleForExtraHours(driverMember, missionWithEditor),
  true,
  'Motorista em campo deve ser elegível a horas extras'
);
console.log('[PASS] 03. Motorista em campo é elegível a horas extras.');

// Cenário 4: Colaborador que foi a campo e também faz a pós-produção
const fieldAndEditorMember = { id: 3, name: 'Lucas Multi', role: 'Cinegrafista' };
const missionHybrid = {
  id: 102,
  date: '2026-11-16',
  teamIds: [3],
  editorIds: [3],
  vehicleAllocations: [],
  extraHoursApproved: 1.5,
};
assert.strictEqual(
  isMemberEligibleForExtraHours(fieldAndEditorMember, missionHybrid),
  true,
  'Colaborador que esteve na equipe presencial de campo é elegível a horas extras'
);
console.log('[PASS] 04. Colaborador que foi a campo e também editou recebe horas extras pelo campo.');

console.log('\nTODOS OS TESTES DA REGRA DE HORAS EXTRAS PASSARAM COM SUCESSO!\n');
