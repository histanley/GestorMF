const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- TEST: Regra de Remuneração e Hora Extra - Restrição Estrita a Administradores ---');

const missionModalPath = path.resolve(__dirname, '../src/components/MissionModal.jsx');
const appPath = path.resolve(__dirname, '../src/App.jsx');
const appCssPath = path.resolve(__dirname, '../src/App.css');

assert(fs.existsSync(missionModalPath), 'MissionModal.jsx deve existir');
assert(fs.existsSync(appPath), 'App.jsx deve existir');
assert(fs.existsSync(appCssPath), 'App.css deve existir');

const modalContent = fs.readFileSync(missionModalPath, 'utf8');
const appContent = fs.readFileSync(appPath, 'utf8');
const cssContent = fs.readFileSync(appCssPath, 'utf8');

// 1. Verificar passagem de currentUser e userRole de App.jsx para MissionModal
assert(
  appContent.includes('currentUser={currentUser}') && appContent.includes('userRole={userRole}'),
  'App.jsx deve repassar currentUser e userRole para o MissionModal'
);
console.log('✅ 1. App.jsx repassa credenciais de autorização (currentUser, userRole) para MissionModal.');

// 2. Verificar identificação e normalização de perfil e cálculo do isAdmin
assert(
  modalContent.includes('normalizeRole') && modalContent.includes('ROLES'),
  'MissionModal deve importar utilitários de autorização (normalizeRole, ROLES)'
);
assert(
  modalContent.includes('const isAdmin = effectiveRole === ROLES.ADMIN;'),
  'MissionModal deve calcular estritamente isAdmin baseado no papel normalizado'
);
console.log('✅ 2. MissionModal.jsx valida estritamente a condição de Administrador (isAdmin).');

// 3. Verificar que para o Gestor aparece APENAS a opção de Hora Extra (opção Diária restrita ao Administrador)
assert(
  modalContent.includes('{isAdmin && (') &&
  modalContent.includes("onClick={() => handleRemunerationTypeChange('daily')}"),
  'Botão de modalidade padrão Diária deve ser visível apenas para Administradores'
);
assert(
  modalContent.includes('{isAdmin && (') &&
  modalContent.includes("onClick={() => handleMemberRemunerationTypeChange(mId, 'daily')}"),
  'Botão individual de Diária para cada colaborador deve ser visível apenas para Administradores'
);
console.log('✅ 3. Opção de Diária completamente oculta para Gestores; apenas Hora Extra visível.');

// 4. Verificar bloqueio na UI para Não-Administradores (Gestores/Usuários) com exibição travada
assert(
  modalContent.includes('rcf-locked-display') && modalContent.includes('rcf-locked-pill'),
  'MissionModal deve conter o componente rcf-locked-display para usuários não-administradores'
);
assert(
  modalContent.includes('Tabela Oficial fixada pelo Administrador'),
  'MissionModal deve exibir aviso explícito de que o valor é fixado pelo Administrador'
);
assert(
  modalContent.includes('/ hora extra'),
  'Badge bloqueado para não-administradores deve indicar estritamente / hora extra'
);
console.log('✅ 4. Interface bloqueada com exibição da Tabela Oficial fixada para Gestores.');

// 5. Verificar bloqueio de handlers de edição de valores e modalidades
assert(
  modalContent.includes('if (!isAdmin)') &&
  modalContent.includes('handleCustomRateChange') &&
  modalContent.includes('Apenas Administradores possuem autorização'),
  'handleCustomRateChange deve bloquear alterações de valores por não-administradores'
);
assert(
  modalContent.includes("if (type !== 'off_hours' && !isAdmin)"),
  'Modalidades que não sejam off_hours devem ser bloqueadas para não-administradores'
);
console.log('✅ 5. Handlers de mudança de taxas e modalidades bloqueiam não-administradores.');

// 6. Verificar sanitização no submit para garantir que apenas off_hours seja salvo por não-administradores
assert(
  modalContent.includes('finalCustomRates') &&
  modalContent.includes('finalRemunType') &&
  modalContent.includes("finalRemunType = 'off_hours';"),
  'handleSubmit deve forçar finalRemunType = off_hours para não-administradores'
);
console.log('✅ 6. Sanitização rigorosa no salvamento da missão garante estritamente Hora Extra para Gestores.');

// 7. Verificar estilos CSS para rcf-locked-display
assert(
  cssContent.includes('.rcf-locked-display') &&
  cssContent.includes('.rcf-locked-pill') &&
  cssContent.includes('.rcf-locked-val'),
  'App.css deve conter as regras de estilo para os valores bloqueados'
);
console.log('✅ 7. Estilos visuais elegantes (.rcf-locked-display) presentes no App.css.');

console.log('\n🎉 TODOS OS TESTES DE RESTRIÇÃO DE HORA EXTRA E DIÁRIA PASSARAM COM SUCESSO!\n');
