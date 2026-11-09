<?php
// ==============================================================================
// GestorMF API - Localização de Funcionários / GPS Consentido em Missões
// ==============================================================================
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? 'active';
$db = getDB();

// ------------------------------------------------------------------------------
// ENVIAR PING DE GPS PELO SMARTPHONE DO COLABORADOR (POST)
// ------------------------------------------------------------------------------
if ($method === 'POST') {
    $user = requireAuth(); // Qualquer usuário autenticado pode enviar seu GPS com consentimento
    $data = getJsonInput();

    $roleUpper = strtoupper(trim($user['role'] ?? 'USER'));
    // REGRA DE GOVERNANÇA: Administradores e Gestores NÃO transmitem GPS no mapa
    if (in_array($roleUpper, ['ADMIN', 'MANAGER'])) {
        jsonResponse(['success' => true, 'message' => 'Administradores e Gestores não transmitem rastreamento GPS.']);
    }

    // Identidade derivada ESTRITAMENTE da sessão autenticada (P0-01)
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
        jsonResponse(['success' => false, 'error' => 'Acesso não autorizado: sua conta de usuário não está vinculada a um colaborador de campo ativo cadastrado.'], 403);
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

        if (empty($missionId)) {
            jsonResponse([
                'success' => false,
                'error'   => 'Rastreamento GPS operacional recusado: o envio de telemetria exige uma missão ativa (Em Preparo ou Em Execução) na qual você esteja escalado.'
            ], 422);
        }
    }

    // Valida se a missão vinculada existe, está ativa e se o colaborador está escalado (P1-05)
    $stmtMis = $db->prepare("SELECT id, description, mission_status, driver_id, team_ids FROM missions WHERE id = ?");
    $stmtMis->execute([$missionId]);
    $mis = $stmtMis->fetch();

    if (!$mis) {
        jsonResponse(['success' => false, 'error' => 'Missão informada para vincular o GPS não foi encontrada.'], 404);
    }

    if (!in_array($mis['mission_status'], ['Em Preparo', 'Em Execução'])) {
        jsonResponse([
            'success' => false,
            'error'   => "Rastreamento GPS recusado: a missão '{$mis['description']}' está com status '{$mis['mission_status']}'. O envio só é permitido durante a execução da missão."
        ], 422);
    }

    // Verifica se o colaborador faz parte da missão
    $isDriver = ($mis['driver_id'] === $memberId);
    $team = !empty($mis['team_ids']) ? json_decode($mis['team_ids'], true) : [];
    $isTeam = is_array($team) && in_array($memberId, $team);

    if (!$isDriver && !$isTeam) {
        jsonResponse(['success' => false, 'error' => 'Acesso negado: você não está escalado nesta missão.'], 403);
    }

    // Salva ou atualiza a posição do colaborador (Upsert seguro por member_id)
    try {
        $stmtCheck = $db->prepare("SELECT id FROM gps_locations WHERE member_id = ?");
        $stmtCheck->execute([$memberId]);
        $existingGps = $stmtCheck->fetch();

        if ($existingGps) {
            $stmtUp = $db->prepare("
                UPDATE gps_locations
                SET member_name = :member_name,
                    mission_id = :mission_id,
                    lat = :lat,
                    lon = :lon,
                    speed = :speed,
                    heading = :heading,
                    accuracy = :accuracy,
                    battery_percent = :battery,
                    captured_at = :captured_at,
                    is_active = 1,
                    updated_at = NOW()
                WHERE member_id = :member_id
            ");
            $stmtUp->execute([
                ':member_id'   => $memberId,
                ':member_name' => $memberName,
                ':mission_id'  => $missionId,
                ':lat'         => $lat,
                ':lon'         => $lon,
                ':speed'       => $speed,
                ':heading'     => $heading,
                ':accuracy'    => $accuracy,
                ':battery'     => $battery,
                ':captured_at' => $capturedAt
            ]);
        } else {
            $stmtIns = $db->prepare("
                INSERT INTO gps_locations (
                    member_id, member_name, mission_id, lat, lon, speed, heading, accuracy, battery_percent, captured_at, is_active, updated_at
                ) VALUES (
                    :member_id, :member_name, :mission_id, :lat, :lon, :speed, :heading, :accuracy, :battery, :captured_at, 1, NOW()
                )
            ");
            $stmtIns->execute([
                ':member_id'   => $memberId,
                ':member_name' => $memberName,
                ':mission_id'  => $missionId,
                ':lat'         => $lat,
                ':lon'         => $lon,
                ':speed'       => $speed,
                ':heading'     => $heading,
                ':accuracy'    => $accuracy,
                ':battery'     => $battery,
                ':captured_at' => $capturedAt
            ]);
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

    // Busca apenas colaboradores operacionais de campo (ROLE = 'USER') atualizados nas últimas 12 horas
    $stmt = $db->query("
        SELECT g.*,
               TIMESTAMPDIFF(SECOND, g.updated_at, NOW()) AS seconds_ago,
               m.description AS mission_title,
               m.code AS mission_code,
               mem.role AS member_role,
               mem.company AS member_company,
               mem.photo_url AS member_photo,
               mem.phone AS member_phone
        FROM gps_locations g
        LEFT JOIN missions m ON g.mission_id = m.id
        LEFT JOIN members mem ON g.member_id = mem.id
        LEFT JOIN users u ON mem.user_id = u.id
        WHERE g.is_active = 1
          AND g.updated_at >= (NOW() - INTERVAL 12 HOUR)
          AND (u.role IS NULL OR u.role = 'USER')
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

