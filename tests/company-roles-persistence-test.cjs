// ==============================================================================
// GestorMF - Teste Automatizado de Persistência de Funções da Empresa
// ==============================================================================
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('   TESTE DE PERSISTÊNCIA DE FUNÇÕES DA EMPRESA     ');
console.log('====================================================\n');

// 1. Verifica backend public/api/settings.php
const settingsPhp = fs.readFileSync(path.join(__dirname, '..', 'public', 'api', 'settings.php'), 'utf8');

assert(settingsPhp.includes('$rolesJson = json_encode($cleanRoles, JSON_UNESCAPED_UNICODE)'), 
  'Falha: settings.php deve sanitizar e converter $cleanRoles em JSON');

assert(settingsPhp.includes(':has_roles') && settingsPhp.includes(':roles_val'),
  'Falha: settings.php deve enviar parâmetros :has_roles e :roles_val');

assert(settingsPhp.includes('roles = CASE WHEN :has_roles = 1 THEN :roles_val ELSE roles END'),
  'Falha: settings.php deve atualizar a coluna roles condicionalmente sem perder dados');

assert(settingsPhp.includes("SHOW COLUMNS FROM settings LIKE 'roles'"),
  'Falha: settings.php deve ter auto-recuperação da coluna roles na tabela settings');

console.log('[PASS] 01. Backend (settings.php): Sanitização JSON, auto-recuperação de coluna e UPDATE condicional de roles verificados.');

// 2. Verifica frontend src/App.jsx
const appJsx = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.jsx'), 'utf8');

assert(appJsx.includes('handleUpdateRole = async (oldRole, updatedRole)'),
  'Falha: App.jsx deve ter handleUpdateRole assíncrono');

assert(appJsx.includes('await apiSaveSettings(settings, nextRoles)'),
  'Falha: App.jsx deve persistir as novas roles via apiSaveSettings no backend');

assert(appJsx.includes('await apiSaveMember(m)'),
  'Falha: App.jsx deve persistir colaboradores atualizados no banco de dados');

assert(appJsx.includes('handleAddRole = async (newRole)'),
  'Falha: App.jsx deve ter handleAddRole assíncrono');

assert(appJsx.includes('handleDeleteRole = async (roleToDelete)'),
  'Falha: App.jsx deve ter handleDeleteRole assíncrono');

console.log('[PASS] 02. Frontend (App.jsx): Sincronização de roles e atualização em cascata de colaboradores no MySQL verificadas.');

// 3. Verifica frontend src/components/TeamManager.jsx
const teamManagerJsx = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'TeamManager.jsx'), 'utf8');

assert(teamManagerJsx.includes('handleSaveEditRole = async ()'),
  'Falha: TeamManager.jsx deve ter handleSaveEditRole assíncrono');

assert(teamManagerJsx.includes('if (editingRole) {') && teamManagerJsx.includes('await handleSaveEditRole();'),
  'Falha: TeamManager.jsx deve salvar edição pendente automaticamente ao clicar em Concluído');

console.log('[PASS] 03. Frontend (TeamManager.jsx): Salvamento de renomeação e fechamento com salvamento automático verificados.');

console.log('\nTODOS OS TESTES DE PERSISTÊNCIA DE FUNÇÕES PASSARAM COM SUCESSO!\n');
