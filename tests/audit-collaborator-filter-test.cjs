const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Iniciando testes de auditoria, filtro de colaboradores e modo claro...');

const settingsJsx = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'SettingsModal.jsx'), 'utf8');
const auditPhp = fs.readFileSync(path.join(__dirname, '..', 'public', 'api', 'audit.php'), 'utf8');
const apiJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'utils', 'api.js'), 'utf8');
const appCss = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.css'), 'utf8');

// 1. Backend audit.php
assert(auditPhp.includes('$userFilter'), 'audit.php deve capturar $userFilter');
assert(auditPhp.includes('user_name = ?') || auditPhp.includes('user_name LIKE ?'), 'audit.php deve filtrar por user_name');

// 2. api.js
assert(apiJs.includes('user = \'\''), 'apiGetAuditLogs deve aceitar parâmetro user');

// 3. SettingsModal.jsx
assert(settingsJsx.includes('auditUserFilter'), 'SettingsModal deve ter estado auditUserFilter');
assert(settingsJsx.includes('audit-collab-select'), 'SettingsModal deve renderizar o select de colaboradores');
assert(settingsJsx.includes('availableCollaborators'), 'SettingsModal deve calcular availableCollaborators');
assert(settingsJsx.includes('filteredAuditLogs'), 'SettingsModal deve filtrar logs');

// 4. App.css (Modo Claro & Elementos dos 3 Prints)
assert(appCss.includes('body.light-theme .backup-count-item'), 'App.css deve ter suporte light-theme para backup-count-item');
assert(appCss.includes('body.light-theme .audit-thead-tr'), 'App.css deve ter suporte light-theme para audit-thead-tr');
assert(appCss.includes('body.light-theme .cs-upc-role-chip .chip-pts'), 'App.css deve ter suporte light-theme para pontuações de colaboradores');
assert(appCss.includes('body.light-theme .audit-collab-select'), 'App.css deve estilizar o seletor de colaboradores no tema claro');

console.log('✅ TODOS OS TESTES DE AUDITORIA, FILTRO DE COLABORADOR E MODO CLARO PASSARAM COM SUCESSO!');
