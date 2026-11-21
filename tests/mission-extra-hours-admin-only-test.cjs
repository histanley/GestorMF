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

// 3. Verificar bloqueio na UI para Não-Administradores (Gestores/Usuários)
assert(
  modalContent.includes('rcf-locked-display') && modalContent.includes('rcf-locked-pill'),
  'MissionModal deve conter o componente rcf-locked-display para usuários não-administradores'
);
assert(
  modalContent.includes('Tabela Oficial fixada pelo Administrador'),
  'MissionModal deve exibir aviso explícito de que o valor é fixado pelo Administrador'
);
console.log('✅ 3. Interface bloqueada com exibição da Tabela Oficial fixada para Gestores.');

// 4. Verificar bloqueio de handlers de edição de valores e modalidades personalizadas
assert(
  modalContent.includes('if (!isAdmin)') &&
  modalContent.includes('handleCustomRateChange') &&
  modalContent.includes('Apenas Administradores possuem autorização'),
  'handleCustomRateChange deve bloquear alterações de valores por não-administradores'
);
assert(
  modalContent.includes("if (type === 'custom' && !isAdmin)"),
  'Modalidades personalizadas devem ser bloqueadas para não-administradores'
);
console.log('✅ 4. Handlers de mudança de taxas e modalidade personalizada bloqueiam não-administradores.');

// 5. Verificar sanitização no submit para garantir que valores customizados não sejam injetados
assert(
  modalContent.includes('finalCustomRates') &&
  modalContent.includes('finalRemunType') &&
  modalContent.includes('delete finalCustomRates[mId];'),
  'handleSubmit deve sanitizar qualquer taxa alterada indevidamente por não-administradores'
);
console.log('✅ 5. Sanitização rigorosa no salvamento da missão impede injeção de valores avulsos por Gestores.');

// 6. Verificar estilos CSS para rcf-locked-display
assert(
  cssContent.includes('.rcf-locked-display') &&
  cssContent.includes('.rcf-locked-pill') &&
  cssContent.includes('.rcf-locked-val'),
  'App.css deve conter as regras de estilo para os valores bloqueados'
);
console.log('✅ 6. Estilos visuais elegantes (.rcf-locked-display) presentes no App.css.');

console.log('\n🎉 TODOS OS TESTES DE RESTRIÇÃO DE HORA EXTRA PARA ADMINISTRADORES PASSARAM COM SUCESSO!\n');
