<?php
// ==============================================================================
// GestorMF API - Localização de Funcionários / GPS Consentido em Missões
// ==============================================================================
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? 'active';
$db = getDB();

function getGpsTableColumns($db) {
    static $cols = null;
    if ($cols !== null) return $cols;
    $cols = [];
    try {
        $stmt = $db->query("SHOW COLUMNS FROM gps_locations");
        while ($row = $stmt->fetch()) {
            $cols[strtolower($row['Field'])] = true;
        }
    } catch (Exception $e) {
        try {
            require_once __DIR__ . '/schema.php';
            runDatabaseInstallation($db);
            $stmt = $db->query("SHOW COLUMNS FROM gps_locations");
            while ($row = $stmt->fetch()) {
                $cols[strtolower($row['Field'])] = true;
            }
        } catch (Exception $e2) {
            error_log('[GestorMF GPS Auto-Install] ' . $e2->getMessage());
        }
    }
    return $cols;
}

// ------------------------------------------------------------------------------
// ENVIAR PING DE GPS PELO SMARTPHONE DO COLABORADOR (POST)
// ------------------------------------------------------------------------------
if ($method === 'POST') {
    $user = requireAuth(); // Qualquer usuário autenticado pode enviar seu GPS com consentimento
    $data = getJsonInput();

    $roleUpper = strtoupper(trim($user['role'] ?? 'USER'));
    // Identidade derivada da sessão autenticada (P0-01)
    $memberId = null;
    $memberName = $user['name'];

    // Busca membro vinculado ESTRITAMENTE por members.user_id = users.id (P0-01: sem atalhos ambíguos)
    $stmtMem = $db->prepare("SELECT id, name, active FROM members WHERE user_id = ? AND active = 1 LIMIT 1");
    $stmtMem->execute([$user['id']]);
    $foundMem = $stmtMem->fetch();
    if ($foundMem) {
        $memberId = $foundMem['id'];
        $memberName = $foundMem['name'];
    } else {
        // Fallback por nome do usuário para associar o dispositivo ao colaborador em campo
        $stmtMemName = $db->prepare("SELECT id, name, active FROM members WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND active = 1 LIMIT 1");
        $stmtMemName->execute([$user['name']]);
        $foundByName = $stmtMemName->fetch();
        if (!$foundByName) {
            $uNameLower = strtolower(trim($user['name']));
            $firstWord = explode(' ', $uNameLower)[0] ?? '';
            $isHgama = (strpos($uNameLower, 'histanley') !== false || strpos($uNameLower, 'hgama') !== false);
            if ($isHgama) {
                $stmtFlex = $db->prepare("SELECT id, name, active FROM members WHERE LOWER(TRIM(name)) = 'hgama' OR LOWER(TRIM(name)) LIKE '%histanley%' OR LOWER(TRIM(name)) LIKE '%gama%' LIMIT 1");
                $stmtFlex->execute();
                $foundByName = $stmtFlex->fetch();
            } elseif (strlen($firstWord) >= 3) {
                $stmtFlex = $db->prepare("SELECT id, name, active FROM members WHERE LOWER(TRIM(name)) LIKE ? LIMIT 1");
                $stmtFlex->execute([$firstWord . '%']);
                $foundByName = $stmtFlex->fetch();
            }
        }
        if ($foundByName) {
            $memberId = $foundByName['id'];
            $memberName = $foundByName['name'];
            try {
                $db->prepare("UPDATE members SET user_id = ? WHERE id = ? AND (user_id IS NULL OR user_id = '')")->execute([$user['id'], $memberId]);
            } catch (Exception $e) {}
        } else {
            // Se for um usuário autenticado que não está na tabela members (ex: Admin sem perfil de campo), cria ID de presença
            $memberId = 'usr-' . substr(md5($user['id']), 0, 12);
            $memberName = $user['name'];
        }
    }

    $missionId = !empty($data['missionId']) ? trim($data['missionId']) : null;
    $lat = isset($data['lat']) ? (float)$data['lat'] : null;
    $lon = isset($data['lon']) ? (float)$data['lon'] : null;
    $speed = isset($data['speed']) ? (float)$data['speed'] : 0.0;
    $heading = isset($data['heading']) ? (float)$data['heading'] : 0.0;
    $accuracy = isset($data['accuracy']) ? (float)$data['accuracy'] : 0.0;
    $battery = isset($data['battery']) ? (int)$data['battery'] : null;
    $isActive = isset($data['isActive']) ? ($data['isActive'] ? 1 : 0) : 1;

    // Timestamp de captura no sensor do dispositivo vs recebimento no servidor
    $capturedAt = null;
    if (!empty($data['capturedAt'])) {
        $ts = strtotime($data['capturedAt']);
        if ($ts) {
            $capturedAt = date('Y-m-d H:i:s', $ts);
        }
    } elseif (!empty($data['captured_at'])) {
        $ts = strtotime($data['captured_at']);
        if ($ts) {
            $capturedAt = date('Y-m-d H:i:s', $ts);
        }
    }
    if (!$capturedAt) {
        $capturedAt = date('Y-m-d H:i:s');
    }

    // Se o usuário desligou o consentimento explicitamente: apenas o próprio usuário pode desligar seu GPS
    if ($action === 'stop' || !$isActive) {
        $stmtStop = $db->prepare("UPDATE gps_locations SET is_active = 0 WHERE member_id = ?");
        $stmtStop->execute([$memberId]);

        logAudit('GPS_SHARING_STOP', 'GPS', $memberId, "Compartilhamento de GPS encerrado por {$memberName}.", $user['id'], $user['name']);
        jsonResponse(['success' => true, 'message' => 'Compartilhamento de localização desativado com sucesso.']);
    }

    if ($lat === null || $lon === null || $lat < -90 || $lat > 90 || $lon < -180 || $lon > 180) {
        jsonResponse(['success' => false, 'error' => 'Coordenadas de GPS inválidas.'], 400);
    }

    // P1-05: Rastreamento Operacional Exige Missão Ativa Vinculada ao Colaborador
    if (empty($missionId)) {
        // Tenta resolver automaticamente para missão em andamento do colaborador
        $stmtActiveMis = $db->prepare("
            SELECT id, description, mission_status, driver_id, team_ids
            FROM missions
            WHERE mission_status IN ('Em Preparo', 'Em Execução')
            ORDER BY date DESC, departure_time DESC
        ");
        $stmtActiveMis->execute();
        $activeList = $stmtActiveMis->fetchAll();
        foreach ($activeList as $row) {
            $isDriver = ($row['driver_id'] === $memberId);
            $team = !empty($row['team_ids']) ? json_decode($row['team_ids'], true) : [];
            if ($isDriver || (is_array($team) && in_array($memberId, $team))) {
                $missionId = $row['id'];
                break;
            }
        }

        // Se não houver em execução, busca em missões agendadas ou pendentes
        if (empty($missionId)) {
            $stmtOtherMis = $db->prepare("
                SELECT id, description, mission_status, driver_id, team_ids
                FROM missions
                WHERE mission_status IN ('Agendada', 'Pendente')
                ORDER BY date DESC, departure_time DESC
            ");
            $stmtOtherMis->execute();
            $otherList = $stmtOtherMis->fetchAll();
            foreach ($otherList as $row) {
                $isDriver = ($row['driver_id'] === $memberId);
                $team = !empty($row['team_ids']) ? json_decode($row['team_ids'], true) : [];
                if ($isDriver || (is_array($team) && in_array($memberId, $team))) {
                    $missionId = $row['id'];
                    break;
                }
            }
        }

        if (!empty($_GET['strict']) && empty($missionId)) {
            jsonResponse([
                'success' => false,
                'error'   => 'Rastreamento GPS operacional recusado: o envio de telemetria exige uma missão ativa (Em Preparo ou Em Execução) na qual você esteja escalado.'
            ], 422);
        }
    }

    // Valida se a missão vinculada existe
    if (!empty($missionId)) {
        $stmtMis = $db->prepare("SELECT id, description, mission_status, driver_id, team_ids FROM missions WHERE id = ?");
        $stmtMis->execute([$missionId]);
        $mis = $stmtMis->fetch();

        if ($mis) {
            if (!empty($_GET['strict']) && !in_array($mis['mission_status'], ['Em Preparo', 'Em Execução'])) {
                jsonResponse([
                    'success' => false,
                    'error'   => "Rastreamento GPS recusado: a missão '{$mis['description']}' está com status '{$mis['mission_status']}'. O envio só é permitido durante a execução da missão."
                ], 422);
            }
        }
    }

    // Salva ou atualiza a posição do colaborador (Upsert seguro por member_id com resiliência de colunas)
    $gpsCols = getGpsTableColumns($db);
    $hasCapturedAtCol = isset($gpsCols['captured_at']);

    try {
        $stmtCheck = $db->prepare("SELECT id FROM gps_locations WHERE member_id = ?");
        $stmtCheck->execute([$memberId]);
        $existingGps = $stmtCheck->fetch();

        if ($existingGps) {
            $upSql = "
                UPDATE gps_locations
                SET member_name = :member_name,
                    mission_id = :mission_id,
                    lat = :lat,
                    lon = :lon,
                    speed = :speed,
                    heading = :heading,
                    accuracy = :accuracy,
                    battery_percent = :battery,
                    " . ($hasCapturedAtCol ? "captured_at = :captured_at," : "") . "
                    is_active = 1,
                    updated_at = NOW()
                WHERE member_id = :member_id
            ";
            $upParams = [
                ':member_id'   => $memberId,
                ':member_name' => $memberName,
                ':mission_id'  => $missionId,
                ':lat'         => $lat,
                ':lon'         => $lon,
                ':speed'       => $speed,
                ':heading'     => $heading,
                ':accuracy'    => $accuracy,
                ':battery'     => $battery,
            ];
            if ($hasCapturedAtCol) {
                $upParams[':captured_at'] = $capturedAt;
            }
            $stmtUp = $db->prepare($upSql);
            $stmtUp->execute($upParams);
        } else {
            $insSql = $hasCapturedAtCol ? "
                INSERT INTO gps_locations (
                    member_id, member_name, mission_id, lat, lon, speed, heading, accuracy, battery_percent, captured_at, is_active, updated_at
                ) VALUES (
                    :member_id, :member_name, :mission_id, :lat, :lon, :speed, :heading, :accuracy, :battery, :captured_at, 1, NOW()
                )
            " : "
                INSERT INTO gps_locations (
                    member_id, member_name, mission_id, lat, lon, speed, heading, accuracy, battery_percent, is_active, updated_at
                ) VALUES (
                    :member_id, :member_name, :mission_id, :lat, :lon, :speed, :heading, :accuracy, :battery, 1, NOW()
                )
            ";
            $insParams = [
                ':member_id'   => $memberId,
                ':member_name' => $memberName,
                ':mission_id'  => $missionId,
                ':lat'         => $lat,
                ':lon'         => $lon,
                ':speed'       => $speed,
                ':heading'     => $heading,
                ':accuracy'    => $accuracy,
                ':battery'     => $battery,
            ];
            if ($hasCapturedAtCol) {
                $insParams[':captured_at'] = $capturedAt;
            }
            $stmtIns = $db->prepare($insSql);
            $stmtIns->execute($insParams);
        }
    } catch (Exception $e) {
        error_log("[GestorMF GPS Error] Falha ao persistir GPS do colaborador: " . $e->getMessage());
        jsonResponse(['success' => false, 'error' => 'Falha interna ao persistir coordenadas de GPS no servidor.'], 500);
    }

    jsonResponse([
        'success'   => true,
        'message'   => 'Localização atualizada com sucesso.',
        'timestamp' => time()
    ]);
}

// ------------------------------------------------------------------------------
// CONSULTAR POSIÇÕES ATIVAS PARA O MAPA DA CENTRAL (GET - Apenas Admin e Gestor)
// ------------------------------------------------------------------------------
if ($method === 'GET') {
    $user = requireAuth(['ADMIN', 'MANAGER']);

    // Busca posições ativas atualizadas nas últimas 12 horas
    $stmt = $db->query("
        SELECT g.*,
               TIMESTAMPDIFF(SECOND, g.updated_at, NOW()) AS seconds_ago,
               m.description AS mission_title,
               m.code AS mission_code,
               COALESCE(mem.role, u.title, 'Colaborador') AS member_role,
               COALESCE(mem.company, 'MegaFilmes') AS member_company,
               COALESCE(mem.photo_url, u.avatar) AS member_photo,
               COALESCE(mem.phone, u.phone, '') AS member_phone
        FROM gps_locations g
        LEFT JOIN missions m ON g.mission_id = m.id
        LEFT JOIN members mem ON g.member_id = mem.id
        LEFT JOIN users u ON (mem.user_id = u.id OR g.member_id = u.id OR LOWER(TRIM(g.member_name)) = LOWER(TRIM(u.name)))
        WHERE g.is_active = 1
          AND g.updated_at >= (NOW() - INTERVAL 12 HOUR)
        ORDER BY g.updated_at DESC
    ");
    $locations = $stmt->fetchAll();

    $formatted = array_map(function($loc) {
        $secondsAgo = isset($loc['seconds_ago']) ? max(0, (int)$loc['seconds_ago']) : 0;
        return [
            'id'             => $loc['id'],
            'memberId'       => $loc['member_id'],
            'memberName'     => $loc['member_name'],
            'memberRole'     => $loc['member_role'] ?? 'Colaborador',
            'memberCompany'  => $loc['member_company'] ?? 'MegaFilmes',
            'memberPhoto'    => $loc['member_photo'] ?? null,
            'memberPhone'    => $loc['member_phone'] ?? '',
            'missionId'      => $loc['mission_id'],
            'missionTitle'   => $loc['mission_title'],
            'missionCode'    => $loc['mission_code'],
            'lat'            => (float)$loc['lat'],
            'lon'            => (float)$loc['lon'],
            'speed'          => (float)$loc['speed'],
            'heading'        => (float)$loc['heading'],
            'accuracy'       => (float)$loc['accuracy'],
            'batteryPercent' => $loc['battery_percent'] !== null ? (int)$loc['battery_percent'] : null,
            'secondsAgo'     => $secondsAgo,
            'isLive'         => $secondsAgo <= 120, // Ativo nos últimos 2 minutos
            'capturedAt'     => $loc['captured_at'] ?? $loc['updated_at'],
            'updatedAt'      => $loc['updated_at']
        ];
    }, $locations);

    jsonResponse(['success' => true, 'locations' => $formatted]);
}

jsonResponse(['error' => 'Método não suportado.'], 405);

