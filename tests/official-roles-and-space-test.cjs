const assert = require('assert');

console.log('====================================================');
console.log(' TESTE: 11 FUNÇÕES, DIÁRIAS OBRIGATÓRIAS E MEU ESPAÇO');
console.log('====================================================');

// 1. Testa 11 funções oficiais
const {
  OFFICIAL_COMPANY_ROLES,
  normalizeToOfficialRole,
  computeMemberRoleCounts,
} = require('../src/utils/companyRoles.js');

assert.strictEqual(OFFICIAL_COMPANY_ROLES.length, 11, 'Devem existir exatamente 11 funções oficiais');

const expectedRoles = [
  'Diretor(a) de Cena',
  'Cinegrafista',
  'Piloto de Drone',
  'Fotógrafo(a)',
  'Editor de Vídeo',
  'Motorista / Produção',
  'Assistente Geral',
  'Designer Gráfico',
  'Operador de Áudio',
  'Social Mídia',
  'Transmissão (Streamer)',
];

expectedRoles.forEach((r) => {
  assert(OFFICIAL_COMPANY_ROLES.includes(r), `A função ${r} deve estar entre as 11 oficiais`);
});
console.log('[PASS] 01. 11 Funções Oficiais da Empresa validadas com sucesso.');

// 2. Normalização
assert.strictEqual(normalizeToOfficialRole('Cinegrafista / Câmera'), 'Cinegrafista');
assert.strictEqual(normalizeToOfficialRole('Designer Gráfico (Mega Print)'), 'Designer Gráfico');
assert.strictEqual(normalizeToOfficialRole('Piloto de Drone'), 'Piloto de Drone');
assert.strictEqual(normalizeToOfficialRole('Streamer'), 'Transmissão (Streamer)');
assert.strictEqual(normalizeToOfficialRole('Social Media'), 'Social Mídia');
assert.strictEqual(normalizeToOfficialRole('Motorista'), 'Motorista / Produção');
console.log('[PASS] 02. Normalização inteligente de cargos e funções aprovada.');

// 3. Contagem fiel de funções exercidas
const dummyMember = { id: 'm1', name: 'Gabriel Costa', role: 'Cinegrafista' };
const dummyMissions = [
  {
    id: 'mis-1',
    date: '2026-11-20',
    missionStatus: 'Finalizada',
    teamIds: ['m1'],
    memberRoles: { m1: 'Diretor(a) de Cena' },
  },
  {
    id: 'mis-2',
    date: '2026-11-21',
    missionStatus: 'Finalizada',
    teamIds: ['m1'],
    memberRoles: { m1: 'Cinegrafista' },
  },
  {
    id: 'mis-3',
    date: '2026-11-22',
    missionStatus: 'Finalizada',
    teamIds: ['m1'],
    memberRoles: { m1: 'Fotógrafo(a)' },
  },
  {
    id: 'mis-4',
    date: '2026-11-23',
    missionStatus: 'Finalizada',
    vehicleAllocations: [{ driverId: 'm1', driverName: 'Gabriel Costa' }],
    teamIds: [],
  },
];

const counts = computeMemberRoleCounts(dummyMember, dummyMissions);
assert.strictEqual(counts['Diretor(a) de Cena'], 1);
assert.strictEqual(counts['Cinegrafista'], 1);
assert.strictEqual(counts['Fotógrafo(a)'], 1);
assert.strictEqual(counts['Motorista / Produção'], 1);
assert.strictEqual(counts['Piloto de Drone'], 0);
console.log('[PASS] 03. Rastreamento fiel e métricas de cumprimento de funções aprovadas.');

// 4. Verificação de trava de diária obrigatória em missões de mais de um dia
const missionModalCode = require('fs').readFileSync('src/components/MissionModal.jsx', 'utf8');
assert(missionModalCode.includes("isMultiDay ? 'daily'"), 'isMultiDay deve forçar remunerationType para daily');
assert(missionModalCode.includes('Obrigatório: Diária de Viagem'), 'Interface deve exibir trava de Diária de Viagem obrigatória');
console.log('[PASS] 04. Trava mandatória de Diária para Viagens / Mais de 1 dia verificada.');

console.log('\nTODOS OS TESTES DE REQUISITOS NOVOS FORAM APROVADOS COM SUCESSO!\n');

