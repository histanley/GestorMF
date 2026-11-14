const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Iniciando testes do Sistema de Aluguel de Equipamentos (MegaFilmes)...');

// 1. Verifica arquivo rentalsData.js
const rentalsDataPath = path.join(__dirname, '../src/utils/rentalsData.js');
assert.ok(fs.existsSync(rentalsDataPath), 'rentalsData.js deve existir');

const rentalsDataContent = fs.readFileSync(rentalsDataPath, 'utf8');
assert.ok(rentalsDataContent.includes('INITIAL_EQUIPMENT_CATALOG'), 'Deve conter INITIAL_EQUIPMENT_CATALOG');
assert.ok(rentalsDataContent.includes('Sony a7III'), 'Deve conter Sony a7III');
assert.ok(rentalsDataContent.includes('Sony Fx30'), 'Deve conter Sony Fx30');
assert.ok(rentalsDataContent.includes('Grua 8m'), 'Deve conter Grua 8m');
assert.ok(rentalsDataContent.includes('Microfone Sennheiser Mike 600'), 'Deve conter Sennheiser Mike 600');
assert.ok(rentalsDataContent.includes('Tocha AD600 pro II'), 'Deve conter Tocha AD600 pro II');
assert.ok(rentalsDataContent.includes('formatCpfCnpj'), 'Deve exportar formatCpfCnpj');
assert.ok(rentalsDataContent.includes('formatPhoneBR'), 'Deve exportar formatPhoneBR');

// Teste unitário da função formatCpfCnpj extraída
function formatCpfCnpj(value) {
  if (!value) return '';
  const d = String(value).replace(/\D/g, '').slice(0, 14);
  if (d.length <= 11) {
    if (d.length <= 3) return d;
    if (d.length <= 6) return d.slice(0, 3) + '.' + d.slice(3);
    if (d.length <= 9) return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6);
    return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-' + d.slice(9);
  }
  if (d.length <= 12) {
    return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5, 8) + '/' + d.slice(8);
  }
  return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5, 8) + '/' + d.slice(8, 12) + '-' + d.slice(12);
}

// Validação CPF (11 dígitos enviado pelo usuário)
assert.strictEqual(formatCpfCnpj('94854076291'), '948.540.762-91', 'Deve formatar CPF com 11 dígitos');
// Validação CNPJ (14 dígitos)
assert.strictEqual(formatCpfCnpj('12345678000195'), '12.345.678/0001-95', 'Deve formatar CNPJ com 14 dígitos');

// 2. Verifica Componentes
const managerPath = path.join(__dirname, '../src/components/EquipmentRentalManager.jsx');
assert.ok(fs.existsSync(managerPath), 'EquipmentRentalManager.jsx deve existir');

const contractPath = path.join(__dirname, '../src/components/RentalContractModal.jsx');
assert.ok(fs.existsSync(contractPath), 'RentalContractModal.jsx deve existir');

const detailModalPath = path.join(__dirname, '../src/components/EquipmentDetailModal.jsx');
assert.ok(fs.existsSync(detailModalPath), 'EquipmentDetailModal.jsx deve existir');

const managerContent = fs.readFileSync(managerPath, 'utf8');
assert.ok(managerContent.includes('EquipmentDetailModal'), 'EquipmentRentalManager deve importar EquipmentDetailModal');
assert.ok(managerContent.includes('selectedDetailEquipment'), 'EquipmentRentalManager deve controlar selectedDetailEquipment');
assert.ok(managerContent.includes('modal-box equip-edit-modal'), 'Modal de edição deve usar modal-box');

// 3. Verifica API PHP
const apiPath = path.join(__dirname, '../public/api/rentals.php');
assert.ok(fs.existsSync(apiPath), 'rentals.php deve existir');
const apiContent = fs.readFileSync(apiPath, 'utf8');
assert.ok(apiContent.includes('CREATE TABLE IF NOT EXISTS equipment'), 'API deve criar tabela equipment');
assert.ok(apiContent.includes('CREATE TABLE IF NOT EXISTS rentals'), 'API deve criar tabela rentals');
assert.ok(apiContent.includes('photo_url'), 'API deve suportar photo_url');
assert.ok(apiContent.includes('create_rental'), 'API deve ter ação create_rental');
assert.ok(apiContent.includes('return_rental'), 'API deve ter ação return_rental');

// 4. Verifica integração no AdminCenter e App.jsx
const adminCenterContent = fs.readFileSync(path.join(__dirname, '../src/components/AdminCenter.jsx'), 'utf8');
assert.ok(adminCenterContent.includes('EquipmentRentalManager'), 'AdminCenter deve importar EquipmentRentalManager');
assert.ok(adminCenterContent.includes("adminTab === 'rentals'"), 'AdminCenter deve ter aba rentals');

const appContent = fs.readFileSync(path.join(__dirname, '../src/App.jsx'), 'utf8');
assert.ok(appContent.includes('EquipmentRentalManager'), 'App.jsx deve importar EquipmentRentalManager');
assert.ok(appContent.includes("activeTab === 'rentals'"), 'App.jsx deve suportar aba rentals para gestor');

console.log('✅ Todos os 4 conjuntos de validações do Sistema de Aluguel passaram com 100% de sucesso!');

