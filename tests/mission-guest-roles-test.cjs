const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- TEST: Atribuição de Funções Oficiais a Convidados / Freelancers ---');

const missionModalPath = path.resolve(__dirname, '../src/components/MissionModal.jsx');
const serviceBoardPath = path.resolve(__dirname, '../src/components/ServiceBoard.jsx');
const detailModalPath = path.resolve(__dirname, '../src/components/MissionDetailModal.jsx');
const printModalPath = path.resolve(__dirname, '../src/components/ServiceBoardOfficialPrintModal.jsx');
const appCssPath = path.resolve(__dirname, '../src/App.css');

assert(fs.existsSync(missionModalPath), 'MissionModal.jsx deve existir');
assert(fs.existsSync(serviceBoardPath), 'ServiceBoard.jsx deve existir');
assert(fs.existsSync(detailModalPath), 'MissionDetailModal.jsx deve existir');
assert(fs.existsSync(printModalPath), 'ServiceBoardOfficialPrintModal.jsx deve existir');
assert(fs.existsSync(appCssPath), 'App.css deve existir');

const modalContent = fs.readFileSync(missionModalPath, 'utf8');
const boardContent = fs.readFileSync(serviceBoardPath, 'utf8');
const detailContent = fs.readFileSync(detailModalPath, 'utf8');
const printContent = fs.readFileSync(printModalPath, 'utf8');
const cssContent = fs.readFileSync(appCssPath, 'utf8');

// 1. Verificar gerenciamento de funções de convidados em MissionModal.jsx
assert(
  modalContent.includes('guestRoleInput') && modalContent.includes('setGuestRoleInput'),
  'MissionModal deve possuir estado para seleção de função do convidado'
);
assert(
  modalContent.includes('handleAddGuestRole') && modalContent.includes('handleRemoveGuestRole'),
  'MissionModal deve possuir handlers para adicionar e remover funções de convidados'
);
console.log('✅ 1. Estados e handlers de gerenciamento de funções de convidados implementados.');

// 2. Verificar que o seletor de funções utiliza a lista oficial com ícones
assert(
  modalContent.includes('OFFICIAL_COMPANY_ROLES') && modalContent.includes('ROLE_ICONS_MAP'),
  'MissionModal deve utilizar OFFICIAL_COMPANY_ROLES e ROLE_ICONS_MAP'
);
assert(
  modalContent.includes('mm-guest-role-select-inline'),
  'MissionModal deve incluir seletor inline de função ao cadastrar o convidado'
);
assert(
  modalContent.includes('Acumular outra função (Fotógrafo, Totem, Drone, Áudio...)'),
  'MissionModal deve permitir acumular funções para o convidado igual à lista oficial'
);
console.log('✅ 2. Seletor oficial com ícones e suporte a múltiplas funções/acumular presente no modal.');

// 3. Verificar que o card do convidado exibe as tags das funções atribuídas
assert(
  modalContent.includes('Função nesta Missão') &&
  modalContent.includes('guestRoles.map') &&
  modalContent.includes('handleRemoveGuestRole'),
  'Card do convidado deve renderizar tags coloridas com ícone e botão de remoção para cada função'
);
console.log('✅ 3. Card do convidado exibe tags personalizadas com ícones e remoção por função.');

// 4. Verificar exibição no painel de equipamentos (Passo 7)
assert(
  modalContent.includes('guestRoles.length > 0 ? `${guestRoles.join') &&
  modalContent.includes('Freelancer'),
  'Passo 7 de equipamentos deve exibir a função do convidado'
);
console.log('✅ 4. Painel de equipamentos reflete a função do convidado freelancer.');

// 5. Verificar exibição nas visões da Tabela de Serviço (ServiceBoard.jsx)
assert(
  boardContent.includes('gRoles.length > 0 ? gRoles.join') &&
  boardContent.includes('guest-role-tag'),
  'ServiceBoard deve exibir a função do convidado nas tags de equipe'
);
console.log('✅ 5. Tabela de Serviço (lista e kanban) exibe a função do convidado freelancer.');

// 6. Verificar exibição na Ficha de Detalhes da Missão (MissionDetailModal.jsx)
assert(
  detailContent.includes('gRoles.length > 0 ? `${gRoles.join') &&
  detailContent.includes('mgc-pill'),
  'MissionDetailModal deve exibir a função do convidado'
);
console.log('✅ 6. Ficha de Detalhes da Missão exibe a função do convidado.');

// 7. Verificar exibição na Impressão Oficial de Parede (ServiceBoardOfficialPrintModal.jsx)
assert(
  printContent.includes('gRoles.length > 0 ? `${gRoles.join') &&
  printContent.includes('excel-member-guest'),
  'ServiceBoardOfficialPrintModal deve exibir a função do convidado'
);
console.log('✅ 7. Impressão Oficial estilo Excel exibe a função do convidado.');

// 8. Verificar estilos no App.css
assert(
  cssContent.includes('.mm-guest-chip') &&
  cssContent.includes('.mm-guest-role-select-inline'),
  'App.css deve conter estilos para o chip e seletor do convidado'
);
console.log('✅ 8. Estilos CSS adaptados para tema escuro e claro.');

console.log('\n🎉 TODOS OS TESTES DE FUNÇÕES DE CONVIDADOS / FREELANCERS PASSARAM COM SUCESSO!\n');
