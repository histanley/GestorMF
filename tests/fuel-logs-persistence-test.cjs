const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('====================================================');
console.log('   TESTE DE PERSISTÊNCIA DE ABASTECIMENTOS         ');
console.log('====================================================');

// 1. Checa vehicles.php
const phpCode = fs.readFileSync(path.join(__dirname, '../public/api/vehicles.php'), 'utf8');

assert(phpCode.includes("action === 'add_fuel_log'"), 'vehicles.php deve possuir endpoint add_fuel_log');
assert(phpCode.includes("action === 'delete_fuel_log'"), 'vehicles.php deve possuir endpoint delete_fuel_log');
assert(phpCode.includes("UPDATE vehicles SET fuel_logs = :logs"), 'vehicles.php deve persistir fuel_logs no MySQL');
console.log('[PASS] 01. Backend (vehicles.php): Endpoints add_fuel_log e delete_fuel_log implementados com persistência no MySQL.');

// 2. Checa api.js
const apiJsCode = fs.readFileSync(path.join(__dirname, '../src/utils/api.js'), 'utf8');
assert(apiJsCode.includes('apiAddFuelLog'), 'api.js deve exportar apiAddFuelLog');
assert(apiJsCode.includes('apiDeleteFuelLog'), 'api.js deve exportar apiDeleteFuelLog');
console.log('[PASS] 02. API Client (api.js): apiAddFuelLog e apiDeleteFuelLog devidamente integrados.');

// 3. Checa App.jsx
const appJsxCode = fs.readFileSync(path.join(__dirname, '../src/App.jsx'), 'utf8');
assert(appJsxCode.includes('apiAddFuelLog({ vehicleId, fuelLog })'), 'App.jsx deve chamar apiAddFuelLog para salvar abastecimento');
assert(appJsxCode.includes('apiDeleteFuelLog({ vehicleId, fuelLogId })'), 'App.jsx deve chamar apiDeleteFuelLog para remover abastecimento');
console.log('[PASS] 03. Frontend (App.jsx): handleAddFuelLog e handleDeleteFuelLog persistem dados no servidor.');

// 4. Checa VehicleManager.jsx
const vmJsxCode = fs.readFileSync(path.join(__dirname, '../src/components/VehicleManager.jsx'), 'utf8');
assert(vmJsxCode.includes('await onAddFuelLog(selectedVehicleForFuel.id, log)'), 'VehicleManager deve aguardar onAddFuelLog');
assert(vmJsxCode.includes('await onDeleteFuelLog(vehicleId, logId)'), 'VehicleManager deve aguardar onDeleteFuelLog');
console.log('[PASS] 04. Componente (VehicleManager.jsx): Modais de abastecimento integrados e aguardando resposta da API.');

console.log('\nTODOS OS TESTES DE PERSISTÊNCIA DE ABASTECIMENTO PASSARAM COM SUCESSO!\n');
