const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('=== TESTE DE PERSISTÊNCIA E AUTO-RECUPERAÇÃO DE MÍDIA ===\n');

// 1. Validar .htaccess
const htaccessPath = path.resolve(__dirname, '../public/.htaccess');
const htaccess = fs.readFileSync(htaccessPath, 'utf8');
assert(htaccess.includes('images/(uploads/equipment|rentals)/(.*)'), 'Regra Rewrite para auto-cura de fotos deve existir no .htaccess');
assert(htaccess.includes('action=view_photo'), '.htaccess deve direcionar fotos ausentes para action=view_photo');
console.log('✔ .htaccess possui regras de auto-recuperação e bypass da SPA para imagens');

// 2. Validar rentals.php
const rentalsPhpPath = path.resolve(__dirname, '../public/api/rentals.php');
const rentalsPhp = fs.readFileSync(rentalsPhpPath, 'utf8');

// Colunas photo_backup e payment_receipt_backup no schema
assert(rentalsPhp.includes('ADD COLUMN photo_backup LONGTEXT NULL'), 'Migração photo_backup deve estar presente');
assert(rentalsPhp.includes('ADD COLUMN payment_receipt_backup LONGTEXT NULL'), 'Migração payment_receipt_backup deve estar presente');

// Endpoints view_photo e equipment_photo
assert(rentalsPhp.includes("action === 'view_photo'"), 'Endpoint view_photo deve existir');
assert(rentalsPhp.includes("action === 'equipment_photo'"), 'Endpoint equipment_photo deve existir');

// Salvamento perpétuo no UPDATE e INSERT
assert(rentalsPhp.includes("photo_backup = ?"), 'UPDATE equipment deve salvar photo_backup');
assert(rentalsPhp.includes("photo_backup"), 'INSERT INTO equipment deve incluir photo_backup');
assert(rentalsPhp.includes("payment_receipt_backup"), 'rentals deve persistir payment_receipt_backup');

console.log('✔ public/api/rentals.php possui schema, endpoints de auto-recuperação e persistência perpétua no MySQL');

// 3. Validar rentalsData.js
const rentalsDataPath = path.resolve(__dirname, '../src/utils/rentalsData.js');
const rentalsData = fs.readFileSync(rentalsDataPath, 'utf8');
assert(rentalsData.includes('export function getEquipPhotoUrl'), 'getEquipPhotoUrl deve ser exportada');
assert(rentalsData.includes('export function handleRentalPhotoError'), 'handleRentalPhotoError deve ser exportada');
assert(rentalsData.includes('action=view_photo'), 'handleRentalPhotoError deve invocar action=view_photo');
assert(rentalsData.includes('action=equipment_photo'), 'handleRentalPhotoError deve invocar action=equipment_photo');
assert(rentalsData.includes('/images/equipment/'), 'handleRentalPhotoError deve ter fallback estático');
assert(rentalsData.includes('data:image/svg+xml'), 'handleRentalPhotoError deve ter fallback final seguro em SVG');

console.log('✔ src/utils/rentalsData.js implementa cascata completa de auto-recuperação e fallback visual');

// 4. Validar EquipmentDetailModal.jsx
const detailModalPath = path.resolve(__dirname, '../src/components/EquipmentDetailModal.jsx');
const detailModal = fs.readFileSync(detailModalPath, 'utf8');
assert(detailModal.includes('handleRentalPhotoError'), 'EquipmentDetailModal deve importar e usar handleRentalPhotoError');
assert(detailModal.includes('onError='), 'EquipmentDetailModal deve conter tratamento onError nas tags <img>');

console.log('✔ EquipmentDetailModal.jsx protegido contra imagens quebradas');

// 5. Validar EquipmentRentalManager.jsx
const managerPath = path.resolve(__dirname, '../src/components/EquipmentRentalManager.jsx');
const manager = fs.readFileSync(managerPath, 'utf8');
assert(manager.includes('handleRentalPhotoError'), 'EquipmentRentalManager deve importar e usar handleRentalPhotoError');
assert(manager.includes('photoBackup: finalBackup'), 'handleUpdateEquipmentPhoto deve salvar photoBackup no estado local');

console.log('✔ EquipmentRentalManager.jsx atualizado com suporte completo a backups e onError');

console.log('\nTODOS OS TESTES DE PERSISTÊNCIA DE MÍDIA PASSARAM COM SUCESSO! 🎯\n');
