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

// 2. Verifica Componentes
const managerPath = path.join(__dirname, '../src/components/EquipmentRentalManager.jsx');
assert.ok(fs.existsSync(managerPath), 'EquipmentRentalManager.jsx deve existir');

const contractPath = path.join(__dirname, '../src/components/RentalContractModal.jsx');
assert.ok(fs.existsSync(contractPath), 'RentalContractModal.jsx deve existir');

// 3. Verifica API PHP
const apiPath = path.join(__dirname, '../public/api/rentals.php');
assert.ok(fs.existsSync(apiPath), 'rentals.php deve existir');
const apiContent = fs.readFileSync(apiPath, 'utf8');
assert.ok(apiContent.includes('CREATE TABLE IF NOT EXISTS equipment'), 'API deve criar tabela equipment');
assert.ok(apiContent.includes('CREATE TABLE IF NOT EXISTS rentals'), 'API deve criar tabela rentals');
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
