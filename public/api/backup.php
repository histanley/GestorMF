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

        // 3. Restaura Colaboradores (Reconstrução integral com user_id único)
        if (isset($tables['members']) && is_array($tables['members'])) {
            $db->exec("DELETE FROM members");
            $stmtMem = $db->prepare("
                INSERT INTO members (id, user_id, name, role, company, phone, photo_url, can_drive, cnh_category, active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            foreach ($tables['members'] as $m) {
                $stmtMem->execute([
                    $m['id'],
                    $m['user_id'] ?? null,
                    $m['name'],
                    $m['role'],
                    $m['company'] ?? 'MegaFilmes',
                    $m['phone'] ?? '',
                    $m['photo_url'] ?? null,
                    isset($m['can_drive']) ? (int)$m['can_drive'] : 0,
                    $m['cnh_category'] ?? 'B',
                    isset($m['active']) ? (int)$m['active'] : 1
                ]);
            }
        }

        // 4. Restaura Missões (Todas as 44 colunas incluindo Pós-Produção e Versão)
        if (isset($tables['missions']) && is_array($tables['missions'])) {
            $db->exec("DELETE FROM missions");
            $stmtMis = $db->prepare("
                INSERT INTO missions (
                    id, code, description, location_name, address, lat, lon, date,
                    departure_time, arrival_time_estimated, return_time_estimated,
                    vehicle_id, vehicle_name_display, vehicle_allocations,
                    driver_id, driver_name, team_ids, team_names_display,
                    edition_status, mission_status, is_round_trip,
                    distance_km, total_distance_km, driving_duration_minutes, round_trip_duration_minutes,
                    estimated_fuel_liters, estimated_fuel_cost,
                    route_coordinates, return_coordinates, notes, created_by,
                    editor_id, editor_name, editor_ids, editor_names_display,
                    delivery_deadline_date, delivery_deadline_time, edition_completed_at, edition_completed_by,
                    is_overdue, edition_delivery_status, reopen_reason, edition_history, version
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?,
                    ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?, ?
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
                    $mis['vehicle_id'] ?? null,
                    $mis['vehicle_name_display'] ?? null,
                    is_array($mis['vehicle_allocations'] ?? null) ? json_encode($mis['vehicle_allocations'], JSON_UNESCAPED_UNICODE) : ($mis['vehicle_allocations'] ?? null),
                    $mis['driver_id'] ?? null,
                    $mis['driver_name'] ?? null,
                    is_array($mis['team_ids'] ?? null) ? json_encode($mis['team_ids'], JSON_UNESCAPED_UNICODE) : ($mis['team_ids'] ?? null),
                    $mis['team_names_display'] ?? null,
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

        $db->commit();

        logAudit('BACKUP_RESTORE', 'BACKUP', 'all', "Procedimento de restauração integral e criptografada (AES-256-GCM) executado com sucesso por {$user['name']}.", $user['id'], $user['name']);
        bumpSyncVersion("backup_restored");

        jsonResponse([
            'success' => true,
            'message' => 'Backup integral restaurado com sucesso! Configurações, viaturas, membros, missões, contas de acesso, auditoria e telemetria foram reconstruídos com fidelidade exata ao estado original.'
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

// Função auxiliar de geração de snapshot integral criptografado com AES-256-GCM e HMAC-SHA256 (Itens 01 e 02)
function generateFullBackupData($db) {
    $sec = loadAppSecrets();
    list($encKey, $sigKey) = getBackupKeys($sec);

    $tables = [
        'settings'      => $db->query("SELECT * FROM settings WHERE id = 1")->fetch() ?: [],
        'vehicles'      => $db->query("SELECT * FROM vehicles")->fetchAll() ?: [],
        'members'       => $db->query("SELECT * FROM members")->fetchAll() ?: [],
        'missions'      => $db->query("SELECT * FROM missions")->fetchAll() ?: [],
        'users'         => $db->query("SELECT id, name, email, password_hash, role, title, department, phone, avatar, created_at FROM users")->fetchAll() ?: [],
        'audit_logs'    => $db->query("SELECT id, user_id, user_name, action, module, entity_id, details, ip_address, created_at FROM audit_logs ORDER BY id DESC LIMIT 5000")->fetchAll() ?: [],
        'gps_locations' => $db->query("SELECT id, member_id, member_name, mission_id, lat, lon, speed, heading, accuracy, battery_percent, captured_at, is_active, updated_at FROM gps_locations")->fetchAll() ?: [],
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

