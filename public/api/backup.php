<?php
// ==============================================================================
// GestorMF API - Backup Automático e Procedimento de Restauração Testado
// ==============================================================================
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? 'download';
$db = getDB();

// Chave para acionamento de rotina de Cron Job automático sem login interativo (lida de gestormf-secrets.php)
$secrets = loadAppSecrets();
$configuredCronKey = $secrets['cron_key'] ?? $secrets['CRON_KEY'] ?? null;

// ------------------------------------------------------------------------------
// ROTINA DE BACKUP AUTOMÁTICO (EXCLUSIVAMENTE CLI - BLOQUEIA ACESSO VIA WEB/HTTP)
// ------------------------------------------------------------------------------
if ($action === 'auto' || php_sapi_name() === 'cli') {
    // P1-06: Impede qualquer acionamento de auto-backup por HTTP (bloqueio total com 403)
    if (php_sapi_name() !== 'cli') {
        jsonResponse([
            'success' => false,
            'error'   => 'Acesso negado: rotina automática desativada via HTTP. Execute exclusivamente via CLI no Cron do cPanel: php /home1/gestormf/cron-backup.php'
        ], 403);
    }

    $backupDir = dirname(__DIR__, 2) . '/backups';
    if (!is_dir($backupDir)) {
        @mkdir($backupDir, 0750, true);
    }

    $backupData = generateFullBackupData($db);
    $filename = 'gestormf_auto_' . date('Y-m-d_H-i-s') . '.json';
    $filepath = $backupDir . '/' . $filename;
    $tmpFile  = $filepath . '.tmp.' . bin2hex(random_bytes(6));

    $jsonStr = json_encode($backupData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    
    // P1-07: Gravação atômica com LOCK_EX e renomeação segura
    $written = @file_put_contents($tmpFile, $jsonStr, LOCK_EX);
    if ($written === false || $written !== strlen($jsonStr)) {
        @unlink($tmpFile);
        error_log("[GestorMF Backup Error] Falha de integridade ao gravar backup temporário em {$tmpFile}");
        echo "Erro ao gravar backup no disco.\n";
        exit(1);
    }

    if (!@rename($tmpFile, $filepath)) {
        @unlink($tmpFile);
        error_log("[GestorMF Backup Error] Falha ao mover arquivo temporário para {$filepath}");
        echo "Erro ao finalizar arquivo de backup.\n";
        exit(1);
    }

    // Mantém apenas os últimos 14 arquivos para economizar espaço
    $files = glob($backupDir . '/gestormf_auto_*.json');
    if (count($files) > 14) {
        usort($files, function($a, $b) { return filemtime($a) - filemtime($b); });
        while (count($files) > 14) {
            @unlink(array_shift($files));
        }
    }

    logAudit('AUTO_BACKUP', 'BACKUP', $filename, "Backup automático gerado via rotina de servidor (CLI).", 'system', 'Cron');
    echo "Backup automático gerado com sucesso: {$filename}\n";
    exit(0);
}

// Para download e restauração interativos, exige login como ADMINISTRADOR
$user = requireAuth(['ADMIN']);

// Derivação segura e isolada de chaves de criptografia e assinatura para backups (Item 02)
function getBackupKeys($secrets) {
    $secret = $secrets['app_secret'] ?? '';
    if (empty($secret)) {
        throw new Exception('Chave app_secret não configurada no servidor.');
    }
    // Chave de criptografia de dados (AES-256-GCM) separada da chave de assinatura digital (HMAC)
    $encKey = hash_hkdf('sha256', $secret, 32, 'gestormf-backup-encryption-key-v1');
    $sigKey = hash_hkdf('sha256', $secret, 32, 'gestormf-backup-signature-key-v1');
    return [$encKey, $sigKey];
}

// ------------------------------------------------------------------------------
// DOWNLOAD MANUAL DE BACKUP COMPLETO (GET)
// ------------------------------------------------------------------------------
if ($method === 'GET' && $action === 'download') {
    $backupData = generateFullBackupData($db);
    $filename = 'gestormf_backup_' . date('Y-m-d_H-i') . '.enc.json';

    header('Content-Type: application/json; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');

    logAudit('BACKUP_DOWNLOAD', 'BACKUP', $filename, "Download de backup integral criptografado (AES-256-GCM) realizado por {$user['name']}.", $user['id'], $user['name']);

    echo json_encode($backupData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit();
}

// ------------------------------------------------------------------------------
// RESTAURAÇÃO DE BACKUP COM PROCEDIMENTO TESTADO (POST)
// ------------------------------------------------------------------------------
if ($method === 'POST' && $action === 'restore') {
    $input = getJsonInput();

    // Aceita arquivo enviado via multipart/form-data ou payload JSON direto
    if (isset($_FILES['backup_file']) && is_uploaded_file($_FILES['backup_file']['tmp_name'])) {
        $raw = file_get_contents($_FILES['backup_file']['tmp_name']);
        $input = json_decode($raw, true);
    }

    if (!is_array($input)) {
        jsonResponse(['success' => false, 'error' => 'Arquivo de backup inválido ou ilegível.'], 400);
    }

    $format = $input['format'] ?? '';
    $version = (string)($input['version'] ?? '1.0');

    // Item 05: Interface Web REST aceita exclusivamente backups modernos criptografados e assinados (v6.0+)
    if ($format !== 'aes-256-gcm-encrypted' || empty($input['payload']) || empty($input['iv']) || empty($input['tag']) || empty($input['signature'])) {
        jsonResponse([
            'success' => false,
            'error'   => 'Acesso negado: a interface web aceita exclusivamente backups modernos criptografados (AES-256-GCM) e assinados (v6.0+). Backups legados não assinados devem ser restaurados exclusivamente via terminal CLI seguro (php bin/restore-legacy.php).'
        ], 400);
    }

    try {
        list($encKey, $sigKey) = getBackupKeys($secrets);
    } catch (Exception $e) {
        jsonResponse(['success' => false, 'error' => 'Chave de segurança do servidor ausente ou mal configurada.'], 500);
    }

    // Validação estrita da assinatura digital HMAC-SHA256 antes da descriptografia (Item 02 & P0-04)
    $signedPayload = "{$input['payload']}|{$input['iv']}|{$input['tag']}|" . ($input['checksum'] ?? '');
    $expectedSig = hash_hmac('sha256', $signedPayload, $sigKey);

    if (!hash_equals($expectedSig, (string)$input['signature'])) {
        jsonResponse([
            'success' => false,
            'error'   => 'Falha crítica de segurança: a assinatura digital HMAC do backup não confere com a chave deste servidor. O arquivo foi adulterado ou pertence a outra instalação.'
        ], 403);
    }

    // Descriptografia com autenticação de integridade AES-256-GCM
    $ciphertext = base64_decode($input['payload']);
    $iv = base64_decode($input['iv']);
    $tag = base64_decode($input['tag']);
    $decrypted = openssl_decrypt($ciphertext, 'aes-256-gcm', $encKey, OPENSSL_RAW_DATA, $iv, $tag);

    if ($decrypted === false) {
        jsonResponse([
            'success' => false,
            'error'   => 'Falha de integridade criptográfica: a tag de autenticação AES-256-GCM foi rejeitada. O conteúdo está corrompido.'
        ], 400);
    }

    // Validação do Checksum SHA-256 dos dados descriptografados
    if (!empty($input['checksum'])) {
        $computedChecksum = hash('sha256', $decrypted);
        if (!hash_equals($input['checksum'], $computedChecksum)) {
            jsonResponse(['success' => false, 'error' => 'Falha de integridade: a soma de verificação do conteúdo descriptografado não confere.'], 400);
        }
    }

    $tables = json_decode($decrypted, true);
    if (!is_array($tables)) {
        jsonResponse(['success' => false, 'error' => 'Estrutura JSON interna das tabelas do backup é inválida.'], 400);
    }

    // Inicia Transação Atômica: Se qualquer etapa falhar, restaura o estado original sem perda
    $db->beginTransaction();

    try {
        // 1. Restaura Configurações
        if (isset($tables['settings']) && !empty($tables['settings'])) {
            $s = $tables['settings'];
            $hasElecCol = false;
            try {
                $chk = $db->query("SHOW COLUMNS FROM settings LIKE 'electric_price_per_kwh'")->fetch();
                $hasElecCol = !empty($chk);
            } catch (Exception $e) {}

            if ($hasElecCol) {
                $stmtSet = $db->prepare("
                    REPLACE INTO settings (id, company_name, fuel_price_per_liter, gasoline_price_per_liter, diesel_price_per_liter, electric_price_per_kwh, base_location, roles)
                    VALUES (1, :comp, :fuel, :gas, :die, :elec, :base, :roles)
                ");
                $stmtSet->execute([
                    ':comp'  => $s['company_name'] ?? 'MegaFilmes & Mega Print',
                    ':fuel'  => $s['fuel_price_per_liter'] ?? 6.45,
                    ':gas'   => $s['gasoline_price_per_liter'] ?? 6.45,
                    ':die'   => $s['diesel_price_per_liter'] ?? 6.89,
                    ':elec'  => $s['electric_price_per_kwh'] ?? 0.95,
                    ':base'  => is_array($s['base_location']) ? json_encode($s['base_location'], JSON_UNESCAPED_UNICODE) : $s['base_location'],
                    ':roles' => is_array($s['roles']) ? json_encode($s['roles'], JSON_UNESCAPED_UNICODE) : $s['roles']
                ]);
            } else {
                $stmtSet = $db->prepare("
                    REPLACE INTO settings (id, company_name, fuel_price_per_liter, gasoline_price_per_liter, diesel_price_per_liter, base_location, roles)
                    VALUES (1, :comp, :fuel, :gas, :die, :base, :roles)
                ");
                $stmtSet->execute([
                    ':comp'  => $s['company_name'] ?? 'MegaFilmes & Mega Print',
                    ':fuel'  => $s['fuel_price_per_liter'] ?? 6.45,
                    ':gas'   => $s['gasoline_price_per_liter'] ?? 6.45,
                    ':die'   => $s['diesel_price_per_liter'] ?? 6.89,
                    ':base'  => is_array($s['base_location']) ? json_encode($s['base_location'], JSON_UNESCAPED_UNICODE) : $s['base_location'],
                    ':roles' => is_array($s['roles']) ? json_encode($s['roles'], JSON_UNESCAPED_UNICODE) : $s['roles']
                ]);
            }
        }

        // 2. Restaura Viaturas (Reconstrução integral)
        if (isset($tables['vehicles']) && is_array($tables['vehicles'])) {
            $db->exec("DELETE FROM vehicles");
            $stmtVeh = $db->prepare("
                INSERT INTO vehicles (id, name, plate, company, type, fuel_type, autonomy_km_per_liter, tank_capacity, current_fuel_percent, current_km, status, fuel_logs)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            foreach ($tables['vehicles'] as $v) {
                $stmtVeh->execute([
                    $v['id'], $v['name'], $v['plate'], $v['company'] ?? 'MegaFilmes', $v['type'] ?? '',
                    $v['fuel_type'] ?? 'Gasolina', $v['autonomy_km_per_liter'] ?? 10.0, $v['tank_capacity'] ?? 50.0,
                    $v['current_fuel_percent'] ?? 100.0, $v['current_km'] ?? 0, $v['status'] ?? 'Disponível',
                    is_array($v['fuel_logs']) ? json_encode($v['fuel_logs'], JSON_UNESCAPED_UNICODE) : $v['fuel_logs']
                ]);
            }
        }

        // 3. Restaura Colaboradores (Reconstrução integral com user_id único e campos financeiros/funções)
        if (isset($tables['members']) && is_array($tables['members'])) {
            $db->exec("DELETE FROM members");
            $stmtMem = $db->prepare("
                INSERT INTO members (
                    id, user_id, name, role, secondary_roles, company, phone, photo_url,
                    can_drive, cnh_category, active, rate_model, hourly_rate, daily_rate,
                    pix_key, extra_hours_availability
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            foreach ($tables['members'] as $m) {
                $stmtMem->execute([
                    $m['id'],
                    $m['user_id'] ?? null,
                    $m['name'],
                    $m['role'],
                    is_array($m['secondary_roles'] ?? null) ? json_encode($m['secondary_roles'], JSON_UNESCAPED_UNICODE) : ($m['secondary_roles'] ?? null),
                    $m['company'] ?? 'MegaFilmes',
                    $m['phone'] ?? '',
                    $m['photo_url'] ?? null,
                    isset($m['can_drive']) ? (int)$m['can_drive'] : 0,
                    $m['cnh_category'] ?? 'B',
                    isset($m['active']) ? (int)$m['active'] : 1,
                    $m['rate_model'] ?? 'both',
                    isset($m['hourly_rate']) ? (float)$m['hourly_rate'] : 50.0,
                    isset($m['daily_rate']) ? (float)$m['daily_rate'] : 200.0,
                    $m['pix_key'] ?? null,
                    $m['extra_hours_availability'] ?? 'unknown'
                ]);
            }
        }

        // 4. Restaura Missões (Todas as colunas incluindo Pós-Produção, Escala, Financeiro e Versão)
        if (isset($tables['missions']) && is_array($tables['missions'])) {
            $db->exec("DELETE FROM missions");
            $stmtMis = $db->prepare("
                INSERT INTO missions (
                    id, code, description, location_name, address, lat, lon, date,
                    departure_time, arrival_time_estimated, return_time_estimated,
                    event_start_time, event_end_time, antecedence_minutes, suggested_departure_time,
                    vehicle_id, vehicle_name_display, vehicle_allocations,
                    driver_id, driver_name, team_ids, team_names_display, guests,
                    edition_status, mission_status, is_round_trip,
                    distance_km, total_distance_km, driving_duration_minutes, round_trip_duration_minutes,
                    estimated_fuel_liters, estimated_fuel_cost,
                    route_coordinates, return_coordinates, notes, created_by, created_by_name,
                    editor_id, editor_name, editor_ids, editor_names_display,
                    delivery_deadline_date, delivery_deadline_time, edition_completed_at, edition_completed_by,
                    is_overdue, edition_delivery_status, reopen_reason, edition_history, editors_delivery,
                    server_file_path, is_recurring, recurrence_id, recurrence_rule, recurrence_days,
                    is_multi_day, end_date, custom_rates, off_hours, remuneration_type,
                    member_remuneration_types, member_roles, equipment_allocations,
                    extra_hours_planned, extra_hours_approved, extra_hours_requests, version
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?,
                    ?, ?, ?, ?
                )
            ");
            foreach ($tables['missions'] as $mis) {
                $stmtMis->execute([
                    $mis['id'],
                    $mis['code'] ?? null,
                    $mis['description'],
                    $mis['location_name'] ?? null,
                    $mis['address'] ?? null,
                    $mis['lat'] ?? null,
                    $mis['lon'] ?? null,
                    $mis['date'],
                    $mis['departure_time'] ?? null,
                    $mis['arrival_time_estimated'] ?? null,
                    $mis['return_time_estimated'] ?? null,
                    $mis['event_start_time'] ?? null,
                    $mis['event_end_time'] ?? null,
                    isset($mis['antecedence_minutes']) ? (int)$mis['antecedence_minutes'] : 15,
                    $mis['suggested_departure_time'] ?? null,
                    $mis['vehicle_id'] ?? null,
                    $mis['vehicle_name_display'] ?? null,
                    is_array($mis['vehicle_allocations'] ?? null) ? json_encode($mis['vehicle_allocations'], JSON_UNESCAPED_UNICODE) : ($mis['vehicle_allocations'] ?? null),
                    $mis['driver_id'] ?? null,
                    $mis['driver_name'] ?? null,
                    is_array($mis['team_ids'] ?? null) ? json_encode($mis['team_ids'], JSON_UNESCAPED_UNICODE) : ($mis['team_ids'] ?? null),
                    $mis['team_names_display'] ?? null,
                    is_array($mis['guests'] ?? null) ? json_encode($mis['guests'], JSON_UNESCAPED_UNICODE) : ($mis['guests'] ?? null),
                    $mis['edition_status'] ?? 'Pendente',
                    $mis['mission_status'] ?? 'Agendada',
                    isset($mis['is_round_trip']) ? (int)$mis['is_round_trip'] : 1,
                    $mis['distance_km'] ?? 0,
                    $mis['total_distance_km'] ?? 0,
                    $mis['driving_duration_minutes'] ?? 0,
                    $mis['round_trip_duration_minutes'] ?? 0,
                    $mis['estimated_fuel_liters'] ?? 0,
                    $mis['estimated_fuel_cost'] ?? 0,
                    is_array($mis['route_coordinates'] ?? null) ? json_encode($mis['route_coordinates']) : ($mis['route_coordinates'] ?? null),
                    is_array($mis['return_coordinates'] ?? null) ? json_encode($mis['return_coordinates']) : ($mis['return_coordinates'] ?? null),
                    $mis['notes'] ?? null,
                    $mis['created_by'] ?? $user['id'],
                    $mis['created_by_name'] ?? null,
                    $mis['editor_id'] ?? null,
                    $mis['editor_name'] ?? null,
                    is_array($mis['editor_ids'] ?? null) ? json_encode($mis['editor_ids'], JSON_UNESCAPED_UNICODE) : ($mis['editor_ids'] ?? null),
                    $mis['editor_names_display'] ?? null,
                    $mis['delivery_deadline_date'] ?? null,
                    $mis['delivery_deadline_time'] ?? null,
                    $mis['edition_completed_at'] ?? null,
                    $mis['edition_completed_by'] ?? null,
                    isset($mis['is_overdue']) ? (int)$mis['is_overdue'] : 0,
                    $mis['edition_delivery_status'] ?? null,
                    $mis['reopen_reason'] ?? null,
                    is_array($mis['edition_history'] ?? null) ? json_encode($mis['edition_history'], JSON_UNESCAPED_UNICODE) : ($mis['edition_history'] ?? null),
                    is_array($mis['editors_delivery'] ?? null) ? json_encode($mis['editors_delivery'], JSON_UNESCAPED_UNICODE) : ($mis['editors_delivery'] ?? null),
                    $mis['server_file_path'] ?? null,
                    isset($mis['is_recurring']) ? (int)$mis['is_recurring'] : 0,
                    $mis['recurrence_id'] ?? null,
                    $mis['recurrence_rule'] ?? null,
                    is_array($mis['recurrence_days'] ?? null) ? json_encode($mis['recurrence_days'], JSON_UNESCAPED_UNICODE) : ($mis['recurrence_days'] ?? null),
                    isset($mis['is_multi_day']) ? (int)$mis['is_multi_day'] : 0,
                    $mis['end_date'] ?? null,
                    is_array($mis['custom_rates'] ?? null) ? json_encode($mis['custom_rates'], JSON_UNESCAPED_UNICODE) : ($mis['custom_rates'] ?? null),
                    is_array($mis['off_hours'] ?? null) ? json_encode($mis['off_hours'], JSON_UNESCAPED_UNICODE) : ($mis['off_hours'] ?? null),
                    $mis['remuneration_type'] ?? 'extra_hours',
                    is_array($mis['member_remuneration_types'] ?? null) ? json_encode($mis['member_remuneration_types'], JSON_UNESCAPED_UNICODE) : ($mis['member_remuneration_types'] ?? null),
                    is_array($mis['member_roles'] ?? null) ? json_encode($mis['member_roles'], JSON_UNESCAPED_UNICODE) : ($mis['member_roles'] ?? null),
                    is_array($mis['equipment_allocations'] ?? null) ? json_encode($mis['equipment_allocations'], JSON_UNESCAPED_UNICODE) : ($mis['equipment_allocations'] ?? null),
                    isset($mis['extra_hours_planned']) ? (int)$mis['extra_hours_planned'] : 0,
                    isset($mis['extra_hours_approved']) ? (int)$mis['extra_hours_approved'] : 0,
                    is_array($mis['extra_hours_requests'] ?? null) ? json_encode($mis['extra_hours_requests'], JSON_UNESCAPED_UNICODE) : ($mis['extra_hours_requests'] ?? null),
                    isset($mis['version']) ? (int)$mis['version'] : 1
                ]);
            }
        }

        // 5. Restaura Contas de Usuários (Item 01: Reconstrução exata eliminando contas órfãs não presentes no backup)
        if (isset($tables['users']) && is_array($tables['users']) && !empty($tables['users'])) {
            $db->exec("DELETE FROM users");
            $stmtUser = $db->prepare("
                INSERT INTO users (id, name, email, password_hash, role, title, department, phone, avatar, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            foreach ($tables['users'] as $uRow) {
                if (empty($uRow['id']) || empty($uRow['email']) || empty($uRow['password_hash'])) continue;
                $stmtUser->execute([
                    $uRow['id'],
                    $uRow['name'] ?? 'Usuário',
                    $uRow['email'],
                    $uRow['password_hash'],
                    $uRow['role'] ?? 'USER',
                    $uRow['title'] ?? '',
                    $uRow['department'] ?? '',
                    $uRow['phone'] ?? '',
                    $uRow['avatar'] ?? null,
                    $uRow['created_at'] ?? date('Y-m-d H:i:s')
                ]);
            }

            // Invalida todas as sessões antigas por segurança, mantendo apenas a sessão ativa do operador da restauração
            $allHeaders = getallheaders();
            $authHeader = $allHeaders['Authorization'] ?? $allHeaders['authorization'] ?? '';
            $activeHash = null;
            if (preg_match('/Bearer\s+(\S+)/i', $authHeader, $matches)) {
                $activeHash = hash('sha256', $matches[1]);
            }
            if ($activeHash) {
                $db->prepare("DELETE FROM user_sessions WHERE token_hash != ?")->execute([$activeHash]);
            } else {
                $db->exec("DELETE FROM user_sessions");
            }
        }

        // 6. Restaura Histórico de Auditoria (Item 01: Recuperação integral)
        if (isset($tables['audit_logs']) && is_array($tables['audit_logs'])) {
            $db->exec("DELETE FROM audit_logs");
            $stmtAudit = $db->prepare("
                INSERT INTO audit_logs (id, user_id, user_name, action, module, entity_id, details, ip_address, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            foreach ($tables['audit_logs'] as $aRow) {
                $stmtAudit->execute([
                    $aRow['id'] ?? null,
                    $aRow['user_id'] ?? 'system',
                    $aRow['user_name'] ?? 'Sistema',
                    $aRow['action'] ?? 'LOG',
                    $aRow['module'] ?? 'SYSTEM',
                    $aRow['entity_id'] ?? null,
                    $aRow['details'] ?? '',
                    $aRow['ip_address'] ?? null,
                    $aRow['created_at'] ?? date('Y-m-d H:i:s')
                ]);
            }
        }

        // 7. Restaura Telemetria e Registros de GPS (Item 01: Recuperação integral)
        if (isset($tables['gps_locations']) && is_array($tables['gps_locations'])) {
            $db->exec("DELETE FROM gps_locations");
            $stmtGps = $db->prepare("
                INSERT INTO gps_locations (id, member_id, member_name, mission_id, lat, lon, speed, heading, accuracy, battery_percent, captured_at, is_active, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            foreach ($tables['gps_locations'] as $gRow) {
                $stmtGps->execute([
                    $gRow['id'] ?? null,
                    $gRow['member_id'],
                    $gRow['member_name'],
                    $gRow['mission_id'] ?? null,
                    $gRow['lat'],
                    $gRow['lon'],
                    $gRow['speed'] ?? 0.0,
                    $gRow['heading'] ?? 0.0,
                    $gRow['accuracy'] ?? 0.0,
                    $gRow['battery_percent'] ?? null,
                    $gRow['captured_at'] ?? null,
                    isset($gRow['is_active']) ? (int)$gRow['is_active'] : 1,
                    $gRow['updated_at'] ?? date('Y-m-d H:i:s')
                ]);
            }
        }

        // 8. Restaura Acervo de Equipamentos (BKP-01: equipment)
        if (isset($tables['equipment']) && is_array($tables['equipment'])) {
            $db->exec("DELETE FROM equipment");
            $stmtEq = $db->prepare("
                INSERT INTO equipment (id, name, category, daily_rate, rate_unit, total_qty, available_qty, maintenance_qty, maintenance_notes, serial_number, photo_url, photo_backup, description, status, asset_value)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            foreach ($tables['equipment'] as $eqRow) {
                if (empty($eqRow['id']) || empty($eqRow['name'])) continue;
                $stmtEq->execute([
                    $eqRow['id'],
                    $eqRow['name'],
                    $eqRow['category'] ?? 'accessories',
                    (float)($eqRow['daily_rate'] ?? 0),
                    $eqRow['rate_unit'] ?? 'diária',
                    (int)($eqRow['total_qty'] ?? 1),
                    (int)($eqRow['available_qty'] ?? 1),
                    (int)($eqRow['maintenance_qty'] ?? 0),
                    $eqRow['maintenance_notes'] ?? null,
                    $eqRow['serial_number'] ?? '',
                    $eqRow['photo_url'] ?? null,
                    $eqRow['photo_backup'] ?? null,
                    $eqRow['description'] ?? null,
                    $eqRow['status'] ?? 'available',
                    (float)($eqRow['asset_value'] ?? 0)
                ]);
            }
        }

        // 9. Restaura Contratos de Locações, Reservas, Vistorias, Comprovantes e Prejuízos (BKP-01: rentals)
        if (isset($tables['rentals']) && is_array($tables['rentals'])) {
            $db->exec("DELETE FROM rentals");
            $stmtRent = $db->prepare("
                INSERT INTO rentals (
                    id, code, client_name, client_document, client_phone, client_email, client_address,
                    start_date, start_time, end_date, end_time, total_days,
                    subtotal, discount, total_amount, payment_method, payment_status, status,
                    notes, items_json, pickup_photos_json, return_photos_json, pickup_notes, inspection_notes,
                    has_damage, damage_cost, damage_type, damage_notes,
                    paid_amount, remaining_amount, remaining_due_terms, remaining_due_date, security_deposit,
                    auth_signature, payment_receipt_url, payment_receipt_backup, created_by, created_at, returned_at, return_notes
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?
                )
            ");
            foreach ($tables['rentals'] as $rRow) {
                if (empty($rRow['id']) || empty($rRow['code'])) continue;
                $stmtRent->execute([
                    $rRow['id'],
                    $rRow['code'],
                    $rRow['client_name'] ?? 'Cliente',
                    $rRow['client_document'] ?? '',
                    $rRow['client_phone'] ?? '',
                    $rRow['client_email'] ?? '',
                    $rRow['client_address'] ?? '',
                    $rRow['start_date'] ?? date('Y-m-d'),
                    $rRow['start_time'] ?? '08:00',
                    $rRow['end_date'] ?? date('Y-m-d'),
                    $rRow['end_time'] ?? '18:00',
                    (int)($rRow['total_days'] ?? 1),
                    (float)($rRow['subtotal'] ?? 0),
                    (float)($rRow['discount'] ?? 0),
                    (float)($rRow['total_amount'] ?? 0),
                    $rRow['payment_method'] ?? 'PIX',
                    $rRow['payment_status'] ?? 'Pendente',
                    $rRow['status'] ?? 'active',
                    $rRow['notes'] ?? null,
                    is_array($rRow['items_json'] ?? null) ? json_encode($rRow['items_json'], JSON_UNESCAPED_UNICODE) : ($rRow['items_json'] ?? '[]'),
                    is_array($rRow['pickup_photos_json'] ?? null) ? json_encode($rRow['pickup_photos_json'], JSON_UNESCAPED_UNICODE) : ($rRow['pickup_photos_json'] ?? null),
                    is_array($rRow['return_photos_json'] ?? null) ? json_encode($rRow['return_photos_json'], JSON_UNESCAPED_UNICODE) : ($rRow['return_photos_json'] ?? null),
                    $rRow['pickup_notes'] ?? null,
                    $rRow['inspection_notes'] ?? null,
                    (int)($rRow['has_damage'] ?? 0),
                    (float)($rRow['damage_cost'] ?? 0),
                    $rRow['damage_type'] ?? '',
                    $rRow['damage_notes'] ?? null,
                    (float)($rRow['paid_amount'] ?? 0),
                    (float)($rRow['remaining_amount'] ?? 0),
                    $rRow['remaining_due_terms'] ?? '',
                    $rRow['remaining_due_date'] ?? null,
                    (float)($rRow['security_deposit'] ?? 0),
                    $rRow['auth_signature'] ?? null,
                    $rRow['payment_receipt_url'] ?? null,
                    $rRow['payment_receipt_backup'] ?? null,
                    $rRow['created_by'] ?? 'Sistema',
                    $rRow['created_at'] ?? date('Y-m-d H:i:s'),
                    $rRow['returned_at'] ?? null,
                    $rRow['return_notes'] ?? null
                ]);
            }
        }

        // 10. Restaura Fechamentos Financeiros Mensais (BKP-01: payout_closures)
        if (isset($tables['payout_closures']) && is_array($tables['payout_closures'])) {
            $db->exec("DELETE FROM payout_closures");
            $stmtPay = $db->prepare("
                INSERT INTO payout_closures (id, month_key, member_id, status, paid_at, paid_amount, hours_cleared, cleared_at, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            foreach ($tables['payout_closures'] as $pRow) {
                if (empty($pRow['id']) || empty($pRow['month_key']) || empty($pRow['member_id'])) continue;
                $stmtPay->execute([
                    $pRow['id'],
                    $pRow['month_key'],
                    $pRow['member_id'],
                    $pRow['status'] ?? 'Pendente',
                    $pRow['paid_at'] ?? null,
                    (float)($pRow['paid_amount'] ?? 0),
                    (float)($pRow['hours_cleared'] ?? 0),
                    $pRow['cleared_at'] ?? null,
                    $pRow['notes'] ?? null
                ]);
            }
        }

        // 11. Restaura Mensagens Internas e Comunicados Operacionais (BKP-01: system_messages)
        if (isset($tables['system_messages']) && is_array($tables['system_messages'])) {
            $db->exec("DELETE FROM system_messages");
            $stmtMsg = $db->prepare("
                INSERT INTO system_messages (id, sender_id, sender_name, sender_role, recipient_type, recipient_id, recipient_user_id, recipient_name, title, message, priority, read_by, dismissed_by, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            foreach ($tables['system_messages'] as $mRow) {
                if (empty($mRow['id']) || empty($mRow['title'])) continue;
                $stmtMsg->execute([
                    $mRow['id'],
                    $mRow['sender_id'] ?? 'system',
                    $mRow['sender_name'] ?? 'Sistema',
                    $mRow['sender_role'] ?? 'ADMIN',
                    $mRow['recipient_type'] ?? 'ALL',
                    $mRow['recipient_id'] ?? null,
                    $mRow['recipient_user_id'] ?? null,
                    $mRow['recipient_name'] ?? null,
                    $mRow['title'],
                    $mRow['message'] ?? '',
                    $mRow['priority'] ?? 'NORMAL',
                    is_array($mRow['read_by'] ?? null) ? json_encode($mRow['read_by']) : ($mRow['read_by'] ?? '[]'),
                    is_array($mRow['dismissed_by'] ?? null) ? json_encode($mRow['dismissed_by']) : ($mRow['dismissed_by'] ?? '[]'),
                    $mRow['created_at'] ?? date('Y-m-d H:i:s')
                ]);
            }
        }

        // 12. Restaura Inscrições Web Push (BKP-01: push_subscriptions)
        if (isset($tables['push_subscriptions']) && is_array($tables['push_subscriptions'])) {
            $db->exec("DELETE FROM push_subscriptions");
            $stmtPush = $db->prepare("
                INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ");
            foreach ($tables['push_subscriptions'] as $psRow) {
                if (empty($psRow['user_id']) || empty($psRow['endpoint'])) continue;
                $stmtPush->execute([
                    $psRow['id'] ?? null,
                    $psRow['user_id'],
                    $psRow['endpoint'],
                    $psRow['p256dh'] ?? null,
                    $psRow['auth'] ?? null,
                    $psRow['user_agent'] ?? null,
                    $psRow['created_at'] ?? date('Y-m-d H:i:s'),
                    $psRow['updated_at'] ?? date('Y-m-d H:i:s')
                ]);
            }
        }

        // 13. Restaura Anexos Físicos (fotos de vistoria, comprovantes e fotos customizadas do acervo) (BKP-01 & Item 6.3)
        if (isset($tables['uploaded_files']) && is_array($tables['uploaded_files'])) {
            $docRoot = !empty($_SERVER['DOCUMENT_ROOT']) ? rtrim($_SERVER['DOCUMENT_ROOT'], '/\\') : dirname(__DIR__);
            foreach ($tables['uploaded_files'] as $fItem) {
                $relPath = $fItem['relative_path'] ?? '';
                $b64Content = $fItem['content_base64'] ?? '';
                if (empty($relPath) || empty($b64Content)) continue;
                // Permite restaurar exclusivamente dentro de /images/rentals/ e /images/uploads/equipment/
                if (strpos($relPath, '/images/rentals/') !== 0 && strpos($relPath, '/images/uploads/equipment/') !== 0) {
                    continue;
                }
                $cleanFilename = basename($relPath);
                if (empty($cleanFilename) || strpos($cleanFilename, '..') !== false) continue;
                $subDir = strpos($relPath, '/images/rentals/') === 0 ? '/images/rentals' : '/images/uploads/equipment';
                $targetDir = $docRoot . $subDir;
                if (!is_dir($targetDir)) {
                    @mkdir($targetDir, 0755, true);
                }
                $rawBin = base64_decode($b64Content, true);
                if ($rawBin !== false && strlen($rawBin) > 0 && stripos($rawBin, '<?php') === false) {
                    $destFile = $targetDir . '/' . $cleanFilename;
                    @file_put_contents($destFile, $rawBin);
                    @chmod($destFile, 0644);
                }
            }
        }

        $db->commit();

        logAudit('BACKUP_RESTORE', 'BACKUP', 'all', "Procedimento de restauração integral e criptografada (AES-256-GCM) executado com sucesso por {$user['name']}.", $user['id'], $user['name']);
        bumpSyncVersion("backup_restored");

        jsonResponse([
            'success' => true,
            'message' => 'Backup integral restaurado com sucesso! Configurações, viaturas, colaboradores, missões, equipamentos, locações, fechamentos financeiros, mensagens, contas de acesso, auditoria, telemetria e anexos foram reconstruídos com fidelidade exata ao estado original.'
        ]);

    } catch (Exception $e) {
        $db->rollBack();
        error_log('[GestorMF Restore Error] ' . $e->getMessage());
        jsonResponse([
            'success' => false,
            'error'   => 'Falha na restauração do backup. O banco foi mantido intacto.'
        ], 500);
    }
}

// Coleta segura de tabela opcional no banco (caso ainda não tenha sido populada)
function safeFetchAllTable($db, $sql) {
    try {
        $stmt = $db->query($sql);
        return $stmt ? ($stmt->fetchAll() ?: []) : [];
    } catch (Exception $e) {
        return [];
    }
}

// Coleta manifesto e binários dos anexos enviados pelos usuários (fotos de vistoria, comprovantes e fotos customizadas)
function collectUploadedFilesForBackup() {
    $docRoot = !empty($_SERVER['DOCUMENT_ROOT']) ? rtrim($_SERVER['DOCUMENT_ROOT'], '/\\') : dirname(__DIR__);
    $dirs = [
        '/images/rentals'           => $docRoot . '/images/rentals',
        '/images/uploads/equipment' => $docRoot . '/images/uploads/equipment'
    ];
    $filesManifest = [];
    foreach ($dirs as $relPrefix => $absDir) {
        if (!is_dir($absDir)) continue;
        $entries = @scandir($absDir);
        if (!is_array($entries)) continue;
        foreach ($entries as $entry) {
            if ($entry === '.' || $entry === '..') continue;
            $fullPath = $absDir . '/' . $entry;
            if (!is_file($fullPath)) continue;
            $size = @filesize($fullPath);
            // Limita arquivos individuais a 10MB no manifesto JSON para preservar memória
            if ($size > 0 && $size <= 10485760) {
                $content = @file_get_contents($fullPath);
                if ($content !== false) {
                    $filesManifest[] = [
                        'relative_path'  => $relPrefix . '/' . $entry,
                        'size'           => $size,
                        'sha256'         => hash('sha256', $content),
                        'content_base64' => base64_encode($content)
                    ];
                }
            }
        }
    }
    return $filesManifest;
}

// Função auxiliar de geração de snapshot integral criptografado com AES-256-GCM e HMAC-SHA256 (BKP-01 & Item 6.3)
function generateFullBackupData($db) {
    $sec = loadAppSecrets();
    list($encKey, $sigKey) = getBackupKeys($sec);

    $tables = [
        'settings'           => $db->query("SELECT * FROM settings WHERE id = 1")->fetch() ?: [],
        'vehicles'           => safeFetchAllTable($db, "SELECT * FROM vehicles"),
        'members'            => safeFetchAllTable($db, "SELECT * FROM members"),
        'missions'           => safeFetchAllTable($db, "SELECT * FROM missions"),
        'users'         => $db->query("SELECT id, name, email, password_hash, role, title, department, phone, avatar, pix_key, created_at FROM users")->fetchAll(),
        'equipment'          => safeFetchAllTable($db, "SELECT * FROM equipment"),
        'rentals'            => safeFetchAllTable($db, "SELECT * FROM rentals"),
        'payout_closures'    => safeFetchAllTable($db, "SELECT * FROM payout_closures"),
        'system_messages'    => safeFetchAllTable($db, "SELECT * FROM system_messages"),
        'push_subscriptions' => safeFetchAllTable($db, "SELECT * FROM push_subscriptions"),
        'audit_logs'         => safeFetchAllTable($db, "SELECT id, user_id, user_name, action, module, entity_id, details, ip_address, created_at FROM audit_logs ORDER BY id DESC LIMIT 5000"),
        'gps_locations'      => safeFetchAllTable($db, "SELECT id, member_id, member_name, mission_id, lat, lon, speed, heading, accuracy, battery_percent, captured_at, is_active, updated_at FROM gps_locations"),
        'system_migrations'  => safeFetchAllTable($db, "SELECT * FROM system_migrations"),
        'uploaded_files'     => collectUploadedFilesForBackup()
    ];

    $plainJson = json_encode($tables, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    $checksum = hash('sha256', $plainJson);

    // Criptografia AES-256-GCM em repouso
    $iv = random_bytes(12);
    $tag = '';
    $ciphertext = openssl_encrypt($plainJson, 'aes-256-gcm', $encKey, OPENSSL_RAW_DATA, $iv, $tag);
    if ($ciphertext === false) {
        throw new Exception('Falha ao criptografar dados do backup com AES-256-GCM.');
    }

    $b64Cipher = base64_encode($ciphertext);
    $b64Iv = base64_encode($iv);
    $b64Tag = base64_encode($tag);

    // Assinatura digital HMAC-SHA256 sobre dados criptografados e parâmetros de autenticação
    $signedPayload = "{$b64Cipher}|{$b64Iv}|{$b64Tag}|{$checksum}";
    $signature = hash_hmac('sha256', $signedPayload, $sigKey);

    return [
        'system'     => 'GestorMF',
        'format'     => 'aes-256-gcm-encrypted',
        'version'    => '6.0',
        'exportedAt' => date('c'),
        'checksum'   => $checksum,
        'iv'         => $b64Iv,
        'tag'        => $b64Tag,
        'signature'  => $signature,
        'payload'    => $b64Cipher
    ];
}

jsonResponse(['error' => 'Ação não permitida.'], 400);

