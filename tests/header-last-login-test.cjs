const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Iniciando testes da barra de saudação superior remodelada e último login...');

const authPhp = fs.readFileSync(path.join(__dirname, '..', 'public', 'api', 'auth.php'), 'utf8');
const authJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'utils', 'auth.js'), 'utf8');
const headerJsx = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'SmartHeaderGreeting.jsx'), 'utf8');
const appCss = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.css'), 'utf8');

// 1. Backend auth.php
assert(authPhp.includes('previous_login_at'), 'auth.php deve tratar previous_login_at');
assert(authPhp.includes('last_login_at'), 'auth.php deve tratar last_login_at');

// 2. auth.js
assert(authJs.includes('export function formatLastLoginDisplay'), 'auth.js deve exportar formatLastLoginDisplay');
assert(authJs.includes('export function getLastLoginTime'), 'auth.js deve exportar getLastLoginTime');

// Teste de execução de formatLastLoginDisplay
const authModuleCode = authJs.replace(/export (default|const|let|var|function)/g, '$1') +
  '\nmodule.exports = { formatLastLoginDisplay };';
const m = { exports: {} };
new Function('module', 'exports', authModuleCode)(m, m.exports);
const { formatLastLoginDisplay } = m.exports;

const todayStr = new Date().toISOString();
assert(formatLastLoginDisplay(todayStr).includes('Hoje às'), 'Login de hoje deve exibir Hoje às HH:MM');

const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
assert(formatLastLoginDisplay(yesterday.toISOString()).includes('Ontem às'), 'Login de ontem deve exibir Ontem às HH:MM');

assert(formatLastLoginDisplay('2026-11-14T15:30:00Z').includes('14/11/2026 às'), 'Data passada deve conter DD/MM/AAAA às HH:MM');
assert.strictEqual(formatLastLoginDisplay(null), 'Primeiro acesso registrado');

// 3. SmartHeaderGreeting.jsx
assert(headerJsx.includes('sh-last-login-tag'), 'SmartHeaderGreeting deve ter sh-last-login-tag');
assert(headerJsx.includes('lastLoginFormatted'), 'SmartHeaderGreeting deve calcular lastLoginFormatted');
assert(headerJsx.includes('Último login:'), 'SmartHeaderGreeting deve conter o texto "Último login:"');

// 4. App.css
assert(appCss.includes('.sh-last-login-tag'), 'App.css deve conter estilos para .sh-last-login-tag');
assert(appCss.includes('body.light-theme .sh-last-login-tag'), 'App.css deve conter estilos no modo claro para .sh-last-login-tag');

console.log('✅ TODOS OS TESTES DA BARRA SUPERIOR REMODELADA E ÚLTIMO LOGIN PASSARAM COM SUCESSO!');
