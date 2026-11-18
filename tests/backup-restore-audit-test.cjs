const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Iniciando testes de auditoria de Backup & Restauração do GestorMF...');

// 1. Verificar public/api/backup.php
const backupPhpPath = path.resolve(__dirname, '../public/api/backup.php');
assert(fs.existsSync(backupPhpPath), 'public/api/backup.php deve existir');
const backupPhpContent = fs.readFileSync(backupPhpPath, 'utf8');

// 2. Verificar suporte a export_json
assert(backupPhpContent.includes("action === 'export_json'"), 'backup.php deve ter suporte para action=export_json');

// 3. Verificar suporte a restore com ambos os formatos
assert(backupPhpContent.includes("$format === 'aes-256-gcm-encrypted'"), 'backup.php deve aceitar formato criptografado aes-256-gcm');
assert(backupPhpContent.includes("$tables = $input['tables']"), 'backup.php deve aceitar backups JSON em formato direto');

// 4. Verificar inclusão de member_notes em missions
assert(backupPhpContent.includes('member_notes'), 'backup.php deve incluir a coluna member_notes no restore de missões');
assert(backupPhpContent.includes('equipment_allocations, member_notes,'), 'backup.php deve incluir member_notes após equipment_allocations no INSERT INTO missions');

// 5. Verificar suporte a todas as 68 colunas de missões
const missionCols = [
  'id', 'code', 'description', 'location_name', 'address', 'lat', 'lon', 'date',
  'departure_time', 'arrival_time_estimated', 'return_time_estimated',
  'event_start_time', 'event_end_time', 'antecedence_minutes', 'suggested_departure_time',
  'vehicle_id', 'vehicle_name_display', 'vehicle_allocations',
  'driver_id', 'driver_name', 'team_ids', 'team_names_display', 'guests',
  'edition_status', 'mission_status', 'is_round_trip',
  'distance_km', 'total_distance_km', 'driving_duration_minutes', 'round_trip_duration_minutes',
  'estimated_fuel_liters', 'estimated_fuel_cost',
  'route_coordinates', 'return_coordinates', 'notes', 'created_by', 'created_by_name',
  'editor_id', 'editor_name', 'editor_ids', 'editor_names_display',
  'delivery_deadline_date', 'delivery_deadline_time', 'edition_completed_at', 'edition_completed_by',
  'is_overdue', 'edition_delivery_status', 'reopen_reason', 'edition_history', 'editors_delivery',
  'server_file_path', 'is_recurring', 'recurrence_id', 'recurrence_rule', 'recurrence_days',
  'is_multi_day', 'end_date', 'custom_rates', 'off_hours', 'remuneration_type',
  'member_remuneration_types', 'member_roles', 'equipment_allocations', 'member_notes',
  'extra_hours_planned', 'extra_hours_approved', 'extra_hours_requests', 'version'
];

assert.strictEqual(missionCols.length, 68, 'Devem ser exatamente 68 colunas em missions');
for (const col of missionCols) {
  assert(backupPhpContent.includes(col), `backup.php deve incluir coluna de missão: ${col}`);
}

// 6. Verificar suporte a fotos e imagens físicas
assert(backupPhpContent.includes('collectUploadedFilesForBackup'), 'backup.php deve coletar anexos físicos');
assert(backupPhpContent.includes("strpos($relPath, '/images/') !== 0"), 'backup.php deve validar caminho em /images/');
assert(backupPhpContent.includes('allowedExtensions'), 'backup.php deve filtrar extensões permitidas de imagens');

// 7. Verificar SettingsModal.jsx
const settingsModalPath = path.resolve(__dirname, '../src/components/SettingsModal.jsx');
const settingsModalContent = fs.readFileSync(settingsModalPath, 'utf8');

assert(settingsModalContent.includes('apiRestoreBackup'), 'SettingsModal deve chamar apiRestoreBackup');
assert(settingsModalContent.includes('apiDownloadFullJsonBackup'), 'SettingsModal deve chamar apiDownloadFullJsonBackup');
assert(settingsModalContent.includes('accept=".json,.enc.json"'), 'SettingsModal deve aceitar extensões .json e .enc.json');
assert(settingsModalContent.includes('isRestoring'), 'SettingsModal deve gerenciar estado de restauração');

// 8. Verificar api.js
const apiJsPath = path.resolve(__dirname, '../src/utils/api.js');
const apiJsContent = fs.readFileSync(apiJsPath, 'utf8');

assert(apiJsContent.includes('export async function apiDownloadFullJsonBackup()'), 'api.js deve exportar apiDownloadFullJsonBackup');
assert(apiJsContent.includes('export async function apiRestoreBackup('), 'api.js deve exportar apiRestoreBackup');
assert(apiJsContent.includes('gestormf_snapshot_'), 'apiDownloadBackup deve nomear o arquivo como snapshot .enc.json');

console.log('✅ Todos os testes de integridade e auditoria de backup & restauração passaram com 100% de sucesso!');
