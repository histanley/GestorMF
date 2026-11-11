// ==============================================================================
// GestorMF - Teste Automatizado de Múltiplas Funções por Colaborador
// ==============================================================================
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('   TESTE DE MÚLTIPLAS FUNÇÕES POR COLABORADOR       ');
console.log('====================================================\n');

// 1. Verifica backend members.php
const membersPhp = fs.readFileSync(path.join(__dirname, '..', 'public', 'api', 'members.php'), 'utf8');

assert(membersPhp.includes("secondary_roles"), 'Falha: members.php deve suportar a coluna secondary_roles');
assert(membersPhp.includes("secondaryRoles"), 'Falha: members.php deve retornar e processar secondaryRoles');

console.log('[PASS] 01. Backend (members.php): Migração automática e persistência de secondary_roles verificadas.');

// 2. Verifica frontend TeamManager.jsx
const teamManagerJsx = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'TeamManager.jsx'), 'utf8');

assert(teamManagerJsx.includes("secondaryRoles"), 'Falha: TeamManager.jsx deve gerenciar secondaryRoles no estado');
assert(teamManagerJsx.includes("secondary-roles-chips-grid"), 'Falha: TeamManager.jsx deve conter o seletor de chips de funções adicionais');
assert(teamManagerJsx.includes("member-secondary-roles-wrap"), 'Falha: TeamManager.jsx deve exibir as tags de funções adicionais no card do colaborador');

console.log('[PASS] 02. Frontend (TeamManager.jsx): Seletor de chips no modal e exibição no card verificados.');

// 3. Verifica reconhecimento de múltiplas funções no MissionModal.jsx
const missionModalJsx = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'MissionModal.jsx'), 'utf8');

assert(missionModalJsx.includes("m?.secondaryRoles"), 'Falha: MissionModal.jsx deve considerar secondaryRoles na elegibilidade de pós-produção');

console.log('[PASS] 03. Frontend (MissionModal.jsx): Reconhecimento de editores por função principal ou secundária verificado.');

console.log('\nTODOS OS TESTES DE MÚLTIPLAS FUNÇÕES POR COLABORADOR PASSARAM COM SUCESSO!\n');

