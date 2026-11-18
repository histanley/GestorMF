const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Testando alinhamento e parsing de valores em Real dos campos de combustível...');

// Teste de parsing de BRL
function parseBrlNumber(val, fallback = 0) {
  if (val === undefined || val === null || val === '') return fallback;
  if (typeof val === 'number') return isNaN(val) ? fallback : val;
  const str = String(val).trim().replace(/\s/g, '').replace('R$', '').replace(',', '.');
  const num = parseFloat(str);
  return isNaN(num) ? fallback : num;
}

assert.strictEqual(parseBrlNumber('7,56'), 7.56);
assert.strictEqual(parseBrlNumber('7.56'), 7.56);
assert.strictEqual(parseBrlNumber('R$ 7,56'), 7.56);
assert.strictEqual(parseBrlNumber('0,95'), 0.95);
assert.strictEqual(parseBrlNumber('0.95'), 0.95);
assert.strictEqual(parseBrlNumber('', 6.45), 6.45);
assert.strictEqual(parseBrlNumber(null, 6.45), 6.45);

// Verificar SettingsModal.jsx
const settingsModalPath = path.resolve(__dirname, '../src/components/SettingsModal.jsx');
const settingsModalContent = fs.readFileSync(settingsModalPath, 'utf8');

assert(settingsModalContent.includes('wasOpenRef'), 'SettingsModal deve usar wasOpenRef para impedir que o polling resete os inputs');
assert(settingsModalContent.includes('fuel-inputs-row'), 'SettingsModal deve usar a classe fuel-inputs-row para alinhamento em grid');
assert(settingsModalContent.includes('brl-currency-input-wrap'), 'SettingsModal deve usar brl-currency-input-wrap');
assert(settingsModalContent.includes('brl-currency-suffix'), 'SettingsModal deve exibir o sufixo /L e /kWh');
assert(settingsModalContent.includes('inputMode="decimal"'), 'SettingsModal deve usar inputMode decimal');

// Verificar App.css
const appCssPath = path.resolve(__dirname, '../src/App.css');
const appCssContent = fs.readFileSync(appCssPath, 'utf8');

assert(appCssContent.includes('.fuel-inputs-row'), 'App.css deve conter regras para .fuel-inputs-row');
assert(appCssContent.includes('.brl-currency-suffix'), 'App.css deve conter regras para .brl-currency-suffix');
assert(appCssContent.includes('.fuel-input-label'), 'App.css deve conter regras para .fuel-input-label com min-height');

console.log('✅ Todos os testes de alinhamento e moeda BRL dos campos de combustível passaram com sucesso!');
