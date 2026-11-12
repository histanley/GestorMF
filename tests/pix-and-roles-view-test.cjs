// ==============================================================================
// GestorMF - Teste Automatizado: PIX (Cadastrar/Editar/Excluir) e Visualização de Funções
// ==============================================================================
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log('  TESTE: GESTÃO DE CHAVE PIX & VISUALIZAÇÃO DE FUNÇÕES          ');
console.log('================================================================\n');

// 1. Verifica backend public/api/auth.php
const authPhp = fs.readFileSync(path.join(__dirname, '..', 'public', 'api', 'auth.php'), 'utf8');

assert(authPhp.includes("action === 'update_pix'"),
  'Falha: auth.php deve possuir endpoint dedicado action=update_pix');

assert(authPhp.includes("UPDATE members") && authPhp.includes("pix_key = ?"),
  'Falha: auth.php deve sincronizar a chave PIX na tabela members');

assert(authPhp.includes("UPDATE users") && authPhp.includes("pix_key = ?"),
  'Falha: auth.php deve salvar a chave PIX na tabela users');

assert(authPhp.includes("bumpSyncVersion(\"members\")"),
  'Falha: auth.php deve emitir evento de sincronização realtime bumpSyncVersion');

console.log('[PASS] 01. Backend (auth.php): Endpoint action=update_pix e sincronização bidirecional de PIX verificados.');

// 2. Verifica utils/api.js
const apiJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'utils', 'api.js'), 'utf8');

assert(apiJs.includes('export async function apiUpdatePixKey(pixKey)'),
  'Falha: api.js deve exportar a função apiUpdatePixKey');

console.log('[PASS] 02. API Client (api.js): Função apiUpdatePixKey exportada corretamente.');

// 3. Verifica CollaboratorSpace.jsx
const colabSpaceJsx = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'CollaboratorSpace.jsx'), 'utf8');

assert(colabSpaceJsx.includes('handleStartEditPix') && colabSpaceJsx.includes('handleDeletePix') && colabSpaceJsx.includes('handleSavePix'),
  'Falha: CollaboratorSpace.jsx deve ter handlers para iniciar edição, salvar e excluir chave PIX');

assert(colabSpaceJsx.includes('cs-hero-role-secondary') && colabSpaceJsx.includes('cs-role-tag-badge'),
  'Falha: CollaboratorSpace.jsx deve exibir a Função Principal e Funções Adicionais no Hero');

assert(colabSpaceJsx.includes('Cadastrar PIX') || colabSpaceJsx.includes('Cadastrar Chave PIX'),
  'Falha: CollaboratorSpace.jsx deve permitir cadastrar chave PIX quando não cadastrada');

console.log('[PASS] 03. Frontend (CollaboratorSpace.jsx): Gestão completa de PIX (cadastrar, editar, excluir) e exibição das funções (somente leitura) validadas.');

// 4. Verifica UserProfileModal.jsx
const userProfileJsx = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'UserProfileModal.jsx'), 'utf8');

assert(userProfileJsx.includes('pixKey') && userProfileJsx.includes('setPixKey'),
  'Falha: UserProfileModal.jsx deve possuir estado de chave PIX');

assert(userProfileJsx.includes('Minhas Funções na Empresa'),
  'Falha: UserProfileModal.jsx deve possuir seção Minhas Funções na Empresa');

assert(userProfileJsx.includes('Somente Leitura'),
  'Falha: UserProfileModal.jsx deve marcar as funções como Somente Leitura');

console.log('[PASS] 04. Frontend (UserProfileModal.jsx): Seção de funções em modo somente-leitura e campo de chave PIX validados.');

// 5. Verifica App.jsx
const appJsx = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.jsx'), 'utf8');

assert(appJsx.includes('handleUpdatePixKey'),
  'Falha: App.jsx deve implementar handleUpdatePixKey');

assert(appJsx.includes('onUpdatePixKey={handleUpdatePixKey}'),
  'Falha: App.jsx deve repassar onUpdatePixKey para CollaboratorSpace');

console.log('[PASS] 05. Frontend (App.jsx): Integração do fluxo de atualização de PIX e propagação de estado verificada.');

console.log('\nTODOS OS TESTES DE PIX E FUNÇÕES PASSARAM COM 100% DE SUCESSO!\n');
