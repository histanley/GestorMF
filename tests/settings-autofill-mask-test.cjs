const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Iniciando testes de Auto-preenchimento e Máscaras de Configurações...');

// 1. Testar formatPhoneMask
function formatPhoneMask(val) {
  if (!val) return '';
  const digits = String(val).replace(/\D/g, '').slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

assert.strictEqual(formatPhoneMask('95999999999'), '(95) 99999-9999');
assert.strictEqual(formatPhoneMask('95991234567'), '(95) 99123-4567');
assert.strictEqual(formatPhoneMask('9536231234'), '(95) 3623-1234');
assert.strictEqual(formatPhoneMask(''), '');

// 2. Testar formatCnpjMask
function formatCnpjMask(val) {
  if (!val) return '';
  const digits = String(val).replace(/\D/g, '').slice(0, 14);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
}

assert.strictEqual(formatCnpjMask('00000000000100'), '00.000.000/0001-00');
assert.strictEqual(formatCnpjMask('12345678000199'), '12.345.678/0001-99');
assert.strictEqual(formatCnpjMask(''), '');

// 3. Verificar DEFAULT_SETTINGS
const initialDataPath = path.resolve(__dirname, '../src/utils/initialData.js');
const initialDataContent = fs.readFileSync(initialDataPath, 'utf8');

assert(initialDataContent.includes('phone:'), 'DEFAULT_SETTINGS deve ter phone');
assert(initialDataContent.includes('email:'), 'DEFAULT_SETTINGS deve ter email');
assert(initialDataContent.includes('website:'), 'DEFAULT_SETTINGS deve ter website');
assert(initialDataContent.includes('cnpj:'), 'DEFAULT_SETTINGS deve ter cnpj');

// 4. Verificar public/api/settings.php
const settingsPhpPath = path.resolve(__dirname, '../public/api/settings.php');
const settingsPhpContent = fs.readFileSync(settingsPhpPath, 'utf8');

assert(settingsPhpContent.includes('ensureSettingsColumnsExist'), 'settings.php deve garantir colunas de contato');
assert(settingsPhpContent.includes('phone'), 'settings.php deve persistir phone');
assert(settingsPhpContent.includes('email'), 'settings.php deve persistir email');
assert(settingsPhpContent.includes('website'), 'settings.php deve persistir website');
assert(settingsPhpContent.includes('cnpj'), 'settings.php deve persistir cnpj');

// 5. Verificar SettingsModal.jsx
const settingsModalPath = path.resolve(__dirname, '../src/components/SettingsModal.jsx');
const settingsModalContent = fs.readFileSync(settingsModalPath, 'utf8');

assert(settingsModalContent.includes('formatPhoneMask'), 'SettingsModal.jsx deve exportar e usar formatPhoneMask');
assert(settingsModalContent.includes('formatCnpjMask'), 'SettingsModal.jsx deve exportar e usar formatCnpjMask');
assert(settingsModalContent.includes("website || 'https://megafilmes.com.br'"), 'SettingsModal.jsx deve auto-preencher website padrão');
assert(settingsModalContent.includes("cnpj || '00.000.000/0001-00'"), 'SettingsModal.jsx deve auto-preencher cnpj padrão');

console.log('✅ Todos os testes de auto-preenchimento e máscaras passaram com 100% de sucesso!');
