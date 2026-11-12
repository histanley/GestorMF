<?php
// ==============================================================================
// GestorMF API - Gestão de Missões e Deslocamentos (com Auditoria & Tempo Real)
// ==============================================================================
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();

// Auto-garantia de colunas de pós-produção, histórico e versionamento no MySQL
function ensureMissionColumnsExist($db) {
    static $ensured = false;
    if ($ensured) return;
    $ensured = true;

    $cols = [
        'code'                    => 'VARCHAR(50) NULL',
        'editor_id'               => 'VARCHAR(64) NULL',
        'editor_name'             => 'VARCHAR(150) NULL',
        'editor_ids'              => 'LONGTEXT NULL',
        'editor_names_display'    => 'VARCHAR(255) NULL',
        'delivery_deadline_date'  => 'VARCHAR(20) NULL',
        'delivery_deadline_time'  => 'VARCHAR(10) NULL',
        'edition_completed_at'    => 'VARCHAR(35) NULL',
        'edition_completed_by'    => 'VARCHAR(150) NULL',
        'is_overdue'              => 'TINYINT(1) DEFAULT 0',
        'edition_delivery_status' => 'VARCHAR(30) NULL',
        'reopen_reason'           => 'TEXT NULL',
        'edition_history'         => 'LONGTEXT NULL',
        'edition_status'          => "VARCHAR(50) DEFAULT 'Pendente'",
        'mission_status'          => "VARCHAR(50) DEFAULT 'Agendada'",
        'event_start_time'        => 'VARCHAR(10) NULL',
        'antecedence_minutes'     => 'INT DEFAULT 30',
        'suggested_departure_time'=> 'VARCHAR(10) NULL',
        'guests'                  => 'LONGTEXT NULL',
        'server_file_path'        => 'VARCHAR(500) NULL',
        'is_recurring'            => 'TINYINT(1) DEFAULT 0',
        'recurrence_id'           => 'VARCHAR(64) NULL',
        'recurrence_rule'         => 'VARCHAR(255) NULL',
        'recurrence_days'         => 'VARCHAR(100) NULL',
        'is_multi_day'            => 'TINYINT(1) DEFAULT 0',
        'end_date'                => 'VARCHAR(20) NULL',
        'custom_rates'            => 'LONGTEXT NULL',
        'off_hours'               => 'DECIMAL(5,1) DEFAULT 0.0',
        'remuneration_type'       => "VARCHAR(20) DEFAULT 'off_hours'",
        'member_roles'            => 'LONGTEXT NULL',
        'extra_hours_planned'     => 'DECIMAL(6,2) DEFAULT 0.00',
        'extra_hours_approved'    => 'DECIMAL(6,2) DEFAULT 0.00',
        'extra_hours_requests'    => 'LONGTEXT NULL',
        'version'                 => 'INT NOT NULL DEFAULT 1'
    ];

    try {
        $existingCols = [];
        $stmt = $db->query("SHOW COLUMNS FROM missions");
        if ($stmt) {
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $existingCols[strtolower($row['Field'])] = true;
            }
        }
        foreach ($cols as $colName => $colDef) {
            if (!isset($existingCols[strtolower($colName)])) {
                try {
                    $db->exec("ALTER TABLE missions ADD COLUMN {$colName} {$colDef}");
                } catch (Exception $ex) {}
            }
        }
        try {
            $db->exec("UPDATE missions SET version = 1 WHERE version IS NULL OR version = 0");
        } catch (Exception $ex) {}
    } catch (Exception $e) {
        error_log('[GestorMF EnsureCols Error] ' . $e->getMessage());
    }
}

// ------------------------------------------------------------------------------
// LISTAR MISSÕES (GET) - Exige autenticação de sessão
// ------------------------------------------------------------------------------
if ($method === 'GET') {
    $user = requireAuth();

    // Auto-finalização e atualização de status em tempo real baseado nos horários da escala
    try {
        $todayDate = date('Y-m-d');
        $nowTime = date('H:i:s');

        // Condições de pós-produção:
        // Missões com pós-produção (vídeo/edição) exigem validação e aprovação explícita do administrador para serem finalizadas.
        $hasPostProdCond = "edition_status IS NOT NULL AND edition_status != '' AND edition_status NOT IN ('Não se aplica', 'Não se aplica (Mega Print / Instalação)')";
        $noPostProdCond = "(edition_status IS NULL OR edition_status = '' OR edition_status IN ('Não se aplica', 'Não se aplica (Mega Print / Instalação)'))";

        // 1. Qualquer missão de datas anteriores que não esteja cancelada:
        // - Se tem pós-produção e ainda não foi aprovada pela gestão -> vai para 'Pendente'
        $db->exec("
            UPDATE missions
            SET mission_status = 'Pendente', updated_at = NOW()
            WHERE COALESCE(NULLIF(end_date, ''), date) < '{$todayDate}'
              AND {$hasPostProdCond}
              AND (edition_history NOT LIKE '%\"type\":\"APPROVED\"%' OR edition_history IS NULL)
              AND mission_status NOT IN ('Pendente', 'Cancelada')
        ");
        // - Se NÃO tem pós-produção -> vai para 'Finalizada' automaticamente
        $db->exec("
            UPDATE missions
            SET mission_status = 'Finalizada', updated_at = NOW()
            WHERE COALESCE(NULLIF(end_date, ''), date) < '{$todayDate}'
              AND {$noPostProdCond}
              AND mission_status NOT IN ('Finalizada', 'Finalizado', 'Cancelada')
        ");

        // 2. Missões de hoje cujo horário previsto de retorno/término já chegou:
        // - Se tem pós-produção e ainda não foi aprovada pela gestão -> vai para 'Pendente'
        $db->exec("
            UPDATE missions
            SET mission_status = 'Pendente', updated_at = NOW()
            WHERE COALESCE(NULLIF(end_date, ''), date) = '{$todayDate}'
              AND (
                  (return_time_estimated IS NOT NULL AND return_time_estimated != '' AND return_time_estimated <= '{$nowTime}')
                  OR
                  ((return_time_estimated IS NULL OR return_time_estimated = '') AND arrival_time_estimated IS NOT NULL AND arrival_time_estimated != '' AND arrival_time_estimated <= '{$nowTime}')
              )
              AND {$hasPostProdCond}
              AND (edition_history NOT LIKE '%\"type\":\"APPROVED\"%' OR edition_history IS NULL)
              AND mission_status NOT IN ('Pendente', 'Cancelada')
        ");
        // - Se NÃO tem pós-produção -> vai para 'Finalizada' automaticamente
        $db->exec("
            UPDATE missions
            SET mission_status = 'Finalizada', updated_at = NOW()
            WHERE COALESCE(NULLIF(end_date, ''), date) = '{$todayDate}'
              AND (
                  (return_time_estimated IS NOT NULL AND return_time_estimated != '' AND return_time_estimated <= '{$nowTime}')
                  OR
                  ((return_time_estimated IS NULL OR return_time_estimated = '') AND arrival_time_estimated IS NOT NULL AND arrival_time_estimated != '' AND arrival_time_estimated <= '{$nowTime}')
              )
              AND {$noPostProdCond}
              AND mission_status NOT IN ('Finalizada', 'Finalizado', 'Cancelada')
        ");

        // 2b. Correção retroativa: Se uma missão com pós-produção foi marcada como 'Finalizada' sem aprovação da gestão, mantê-la como 'Pendente'
        $db->exec("
            UPDATE missions
            SET mission_status = 'Pendente', updated_at = NOW()
            WHERE mission_status IN ('Finalizada', 'Finalizado')
              AND {$hasPostProdCond}
              AND (edition_history NOT LIKE '%\"type\":\"APPROVED\"%' OR edition_history IS NULL)
        ");

        // 3. Missões de hoje cujo horário de saída já chegou -> Em Execução
        $db->exec("
            UPDATE missions
            SET mission_status = 'Em Execução', updated_at = NOW()
            WHERE date = '{$todayDate}'
              AND departure_time <= '{$nowTime}'
              AND (
                  (return_time_estimated IS NOT NULL AND return_time_estimated != '' AND return_time_estimated > '{$nowTime}')
                  OR
                  ((return_time_estimated IS NULL OR return_time_estimated = '') AND (arrival_time_estimated IS NULL OR arrival_time_estimated = '' OR arrival_time_estimated > '{$nowTime}'))
              )
              AND mission_status = 'Agendada'
        ");
    } catch (Exception $e) {
        error_log('[GestorMF Auto-Status Error] ' . $e->getMessage());
    }

    $stmt = $db->query("
        SELECT * FROM missions 
        ORDER BY 
            CASE 
                WHEN mission_status IN ('Em Execução', 'Em Preparo', 'Saiu', 'Em Deslocamento') THEN 1 
                WHEN mission_status = 'Pendente' THEN 2 
                WHEN mission_status = 'Agendada' OR mission_status IS NULL THEN 3 
                WHEN mission_status IN ('Finalizada', 'Finalizado', 'Concluída') THEN 4 
                ELSE 5 
            END ASC, 
            date DESC, 
            departure_time ASC,
            id DESC
    ");
    $rawMissions = $stmt->fetchAll();

    $missions = array_map(function($m) {
        return [
            'id'                       => $m['id'],
            'code'                     => $m['code'],
            'description'              => $m['description'],
            'locationName'             => $m['location_name'],
            'address'                  => $m['address'],
            'lat'                      => $m['lat'] !== null ? (float)$m['lat'] : null,
            'lon'                      => $m['lon'] !== null ? (float)$m['lon'] : null,
            'date'                     => $m['date'],
            'departureTime'            => $m['departure_time'],
            'arrivalTimeEstimated'     => $m['arrival_time_estimated'],
            'returnTimeEstimated'      => $m['return_time_estimated'],
            'eventStartTime'           => $m['event_start_time'] ?? null,
            'antecedenceMinutes'       => isset($m['antecedence_minutes']) && $m['antecedence_minutes'] !== null ? (int)$m['antecedence_minutes'] : 30,
            'suggestedDepartureTime'   => $m['suggested_departure_time'] ?? null,
            'vehicleId'                => $m['vehicle_id'],
            'vehicleNameDisplay'       => $m['vehicle_name_display'],
            'vehicleAllocations'       => !empty($m['vehicle_allocations']) ? json_decode($m['vehicle_allocations'], true) : [],
            'driverId'                 => $m['driver_id'],
            'driverName'               => $m['driver_name'],
            'teamIds'                  => !empty($m['team_ids']) ? json_decode($m['team_ids'], true) : [],
            'teamNamesDisplay'         => $m['team_names_display'],
            'guests'                   => !empty($m['guests']) ? json_decode($m['guests'], true) : [],
            'editorId'                 => $m['editor_id'] ?? null,
            'editorName'               => $m['editor_name'] ?? null,
            'editorIds'                => !empty($m['editor_ids']) ? json_decode($m['editor_ids'], true) : [],
            'editorNamesDisplay'       => $m['editor_names_display'] ?? null,
            'deliveryDeadlineDate'     => $m['delivery_deadline_date'] ?? null,
            'deliveryDeadlineTime'     => $m['delivery_deadline_time'] ?? null,
            'editionCompletedAt'       => $m['edition_completed_at'] ?? null,
            'editionCompletedBy'       => $m['edition_completed_by'] ?? null,
            'isOverdue'                => !empty($m['is_overdue']),
            'editionDeliveryStatus'    => $m['edition_delivery_status'] ?? null,
            'serverFilePath'           => $m['server_file_path'] ?? null,
            'reopenReason'             => $m['reopen_reason'] ?? null,
            'editionHistory'           => !empty($m['edition_history']) ? json_decode($m['edition_history'], true) : [],
            'editionStatus'            => $m['edition_status'] ?? 'Pendente',
            'missionStatus'            => $m['mission_status'] ?? 'Agendada',
            'isRoundTrip'              => (bool)$m['is_round_trip'],
            'distanceKm'               => (float)$m['distance_km'],
            'totalDistanceKm'          => (float)$m['total_distance_km'],
            'drivingDurationMinutes'   => (int)$m['driving_duration_minutes'],
            'roundTripDurationMinutes' => (int)$m['round_trip_duration_minutes'],
            'estimatedFuelLiters'      => (float)$m['estimated_fuel_liters'],
            'estimatedFuelCost'        => (float)$m['estimated_fuel_cost'],
            'routeCoordinates'         => !empty($m['route_coordinates']) ? json_decode($m['route_coordinates'], true) : [],
            'returnCoordinates'        => !empty($m['return_coordinates']) ? json_decode($m['return_coordinates'], true) : [],
            'notes'                    => $m['notes'],
            'isRecurring'              => !empty($m['is_recurring']),
            'recurrenceId'             => $m['recurrence_id'] ?? null,
            'recurrenceRule'           => $m['recurrence_rule'] ?? null,
            'recurrenceDays'           => $m['recurrence_days'] ?? null,
            'isMultiDay'               => !empty($m['is_multi_day']),
            'endDate'                  => $m['end_date'] ?? null,
            'customRates'              => !empty($m['custom_rates']) ? json_decode($m['custom_rates'], true) : null,
            'offHours'                 => isset($m['off_hours']) ? (float)$m['off_hours'] : 0.0,
            'remunerationType'         => $m['remuneration_type'] ?? (!empty($m['is_multi_day']) ? 'daily' : 'off_hours'),
            'memberRoles'              => !empty($m['member_roles']) ? json_decode($m['member_roles'], true) : new stdClass(),
            'extraHoursPlanned'        => isset($m['extra_hours_planned']) ? (float)$m['extra_hours_planned'] : 0.0,
            'extraHoursApproved'       => isset($m['extra_hours_approved']) ? (float)$m['extra_hours_approved'] : 0.0,
            'extraHoursRequests'       => !empty($m['extra_hours_requests']) ? json_decode($m['extra_hours_requests'], true) : [],
            'version'                  => (int)($m['version'] ?? 1),
            'createdAt'                => $m['created_at'],
            'updatedAt'                => $m['updated_at']
        ];
    }, $rawMissions);

    jsonResponse(['success' => true, 'missions' => $missions]);
}

// ==============================================================================
// FUNÇÕES AUXILIARES DE CONFLITOS DE ESCALA (RODADA 2 - ROBUSTA E ATÔMICA)
// ==============================================================================
function getMissionTimeRangeTs($date, $depTime, $retTime, $endDate = null) {
    $dateStr = !empty($date) ? trim($date) : date('Y-m-d');
    $depTimeStr = !empty($depTime) ? trim($depTime) : '08:00';
    $depTs = strtotime("{$dateStr} {$depTimeStr}");
    if (!$depTs) $depTs = strtotime("{$dateStr} 08:00:00");

    $retDateStr = !empty($endDate) ? trim($endDate) : $dateStr;
    if (!empty($retTime)) {
        $retTimeStr = trim($retTime);
        $retTs = strtotime("{$retDateStr} {$retTimeStr}");
        if ($retTs <= $depTs) {
            $retTs = strtotime("{$retDateStr} {$retTimeStr}") + 86400; // Atravessa a meia-noite (dia seguinte)
        }
    } else {
        $retTs = strtotime("{$retDateStr} 23:59:59"); // Fim do dia final previsto
    }
    return [$depTs, $retTs];
}

function checkRosterConflicts($db, $targetMissionId, $data) {
    $date = $data['date'] ?? date('Y-m-d');
    $endDate = !empty($data['endDate']) ? $data['endDate'] : $date;
    $depTime = $data['departureTime'] ?? '08:00';
    $retTime = $data['returnTimeEstimated'] ?? $data['arrivalTimeEstimated'] ?? null;
    list($depTs, $retTs) = getMissionTimeRangeTs($date, $depTime, $retTime, $endDate);

    // Coleta todos os veículos da missão
    $vehicles = [];
    if (!empty($data['vehicleAllocations']) && is_array($data['vehicleAllocations'])) {
        foreach ($data['vehicleAllocations'] as $alloc) {
            if (!empty($alloc['vehicleId'])) $vehicles[] = $alloc['vehicleId'];
        }
    }
    if (!empty($data['vehicleId'])) $vehicles[] = $data['vehicleId'];
    $vehicles = array_unique(array_filter($vehicles));

    // Coleta todos os condutores da missão
    $drivers = [];
    if (!empty($data['vehicleAllocations']) && is_array($data['vehicleAllocations'])) {
        foreach ($data['vehicleAllocations'] as $alloc) {
            if (!empty($alloc['driverId'])) $drivers[] = $alloc['driverId'];
        }
    }
    if (!empty($data['driverId'])) $drivers[] = $data['driverId'];
    $drivers = array_unique(array_filter($drivers));

    // Coleta equipe escalada
    $team = !empty($data['teamIds']) && is_array($data['teamIds']) ? $data['teamIds'] : [];
    $team = array_unique(array_filter($team));

    if (empty($vehicles) && empty($drivers) && empty($team)) {
        return null;
    }

    $minDate = date('Y-m-d', $depTs - 86400);
    $maxDate = date('Y-m-d', $retTs + 86400);

    $stmtOther = $db->prepare("
        SELECT id, code, description, date, end_date, departure_time, return_time_estimated, arrival_time_estimated,
               vehicle_id, vehicle_name_display, vehicle_allocations,
               driver_id, driver_name, team_ids, team_names_display
        FROM missions
        WHERE id != ?
          AND mission_status NOT IN ('Finalizada', 'Cancelada', 'Pendente')
          AND date <= ?
          AND COALESCE(NULLIF(end_date, ''), date) >= ?
        FOR UPDATE
    ");
    $stmtOther->execute([$targetMissionId, $maxDate, $minDate]);
    $otherMissions = $stmtOther->fetchAll();

    foreach ($otherMissions as $other) {
        $oDate = $other['date'] ?? $date;
        $oEndDate = $other['end_date'] ?? null;
        $oDepTime = $other['departure_time'] ?? '08:00';
        $oRetTime = $other['return_time_estimated'] ?: ($other['arrival_time_estimated'] ?: null);
        list($oDepTs, $oRetTs) = getMissionTimeRangeTs($oDate, $oDepTime, $oRetTime, $oEndDate);

        // Verifica sobreposição temporal exata: max(A, C) < min(B, D)
        $overlap = max($depTs, $oDepTs) < min($retTs, $oRetTs);
        if (!$overlap) continue;

        $otherTimeRange = ($other['departure_time'] ?: '??') . ' às ' . ($oRetTime ?: '??');
        $otherTitle = !empty($other['code']) ? "#{$other['code']} - {$other['description']}" : $other['description'];

        // 1. Checa conflito de viatura
        $otherVehicles = [];
        if (!empty($other['vehicle_allocations'])) {
            $otherAlloc = json_decode($other['vehicle_allocations'], true);
            if (is_array($otherAlloc)) {
                foreach ($otherAlloc as $oa) {
                    if (!empty($oa['vehicleId'])) $otherVehicles[] = $oa['vehicleId'];
                }
            }
        }
        if (!empty($other['vehicle_id'])) $otherVehicles[] = $other['vehicle_id'];

        foreach ($vehicles as $vId) {
            if (in_array($vId, $otherVehicles)) {
                $vehName = $data['vehicleNameDisplay'] ?? 'selecionada';
                return [
                    'type'    => 'VEHICLE',
                    'message' => "A viatura '{$vehName}' já está escalada na missão '{$otherTitle}' no mesmo horário ({$otherTimeRange})."
                ];
            }
        }

        // 2. Checa conflito de condutor
        $otherDrivers = [];
        if (!empty($other['vehicle_allocations'])) {
            $otherAlloc = json_decode($other['vehicle_allocations'], true);
            if (is_array($otherAlloc)) {
                foreach ($otherAlloc as $oa) {
                    if (!empty($oa['driverId'])) $otherDrivers[] = $oa['driverId'];
                }
            }
        }
        if (!empty($other['driver_id'])) $otherDrivers[] = $other['driver_id'];

        foreach ($drivers as $dId) {
            if (in_array($dId, $otherDrivers)) {
                $driverName = $data['driverName'] ?? 'selecionado';
                return [
                    'type'    => 'DRIVER',
                    'message' => "O condutor '{$driverName}' já está escalado na missão '{$otherTitle}' no mesmo horário ({$otherTimeRange})."
                ];
            }
        }

        // 3. Checa conflito de equipe de campo
        $otherTeam = !empty($other['team_ids']) ? json_decode($other['team_ids'], true) : [];
        if (is_array($otherTeam)) {
            foreach ($team as $mId) {
                if (in_array($mId, $otherTeam)) {
                    return [
                        'type'    => 'TEAM_MEMBER',
                        'message' => "Um ou mais colaboradores escalados já fazem parte da missão '{$otherTitle}' no mesmo horário ({$otherTimeRange})."
                    ];
                }
            }
        }
    }

    return null;
}

// ------------------------------------------------------------------------------
// SALVAR OU ATUALIZAR MISSÃO (POST / PUT)
// ------------------------------------------------------------------------------
$action = $_GET['action'] ?? '';

// SOLICITAR HORAS EXTRAS ADICIONAIS (+1h, +2h) PELO COLABORADOR EM CAMPO
if ($method === 'POST' && $action === 'request_extra_hours') {
    $user = requireAuth();
    $data = getJsonInput();
    $missionId = trim($data['missionId'] ?? '');
    $hours = max(0.5, (float)($data['hoursRequested'] ?? 1.0));
    $reason = trim($data['reason'] ?? 'Necessário tempo adicional para finalizar os trabalhos.');

    if (empty($missionId)) {
        jsonResponse(['success' => false, 'error' => 'ID da missão é obrigatório.'], 400);
    }

    ensureMissionColumnsExist($db);
    $stmt = $db->prepare("SELECT * FROM missions WHERE id = ?");
    $stmt->execute([$missionId]);
    $m = $stmt->fetch();
    if (!$m) {
        jsonResponse(['success' => false, 'error' => 'Missão não encontrada.'], 404);
    }

    $existingRequests = !empty($m['extra_hours_requests']) ? json_decode($m['extra_hours_requests'], true) : [];
    if (!is_array($existingRequests)) $existingRequests = [];

    $newReq = [
        'id'             => 'ehr-' . bin2hex(random_bytes(6)),
        'memberId'       => $data['memberId'] ?? $user['id'],
        'memberName'     => $data['memberName'] ?? $user['name'],
        'hoursRequested' => $hours,
        'reason'         => $reason,
        'status'         => 'PENDING',
        'createdAt'      => date('Y-m-d H:i:s')
    ];
    $existingRequests[] = $newReq;

    $stmtUp = $db->prepare("UPDATE missions SET extra_hours_requests = ?, version = version + 1 WHERE id = ?");
    $stmtUp->execute([json_encode($existingRequests, JSON_UNESCAPED_UNICODE), $missionId]);

    // Cria notificação no sistema para Administradores
    try {
        $msgId = 'msg-ehr-' . bin2hex(random_bytes(6));
        $db->prepare("
            INSERT INTO system_messages (id, title, message, type, priority, requires_confirmation, created_by)
            VALUES (?, ?, ?, 'ALERT', 'HIGH', 0, ?)
        ")->execute([
            $msgId,
            "⏱️ Solicitação de Hora Extra: +{$hours}h",
            "{$user['name']} solicitou +{$hours}h adicional na missão '{$m['description']}'. Motivo: {$reason}",
            $user['id']
        ]);
    } catch (Exception $e) {}

    logAudit('REQUEST_EXTRA_HOURS', 'MISSIONS', $missionId, "{$user['name']} solicitou +{$hours}h de hora extra.", $user['id'], $user['name']);
    bumpSyncVersion("mission_{$missionId}");

    jsonResponse(['success' => true, 'request' => $newReq, 'message' => 'Solicitação de hora extra enviada para a gestão.']);
}

// GESTÃO APROVA OU RECUSA HORA EXTRA ADICIONAL
if ($method === 'POST' && $action === 'respond_extra_hours') {
    $user = requireAuth(['ADMIN', 'MANAGER']);
    $data = getJsonInput();
    $missionId = trim($data['missionId'] ?? '');
    $requestId = trim($data['requestId'] ?? '');
    $decision = strtoupper(trim($data['decision'] ?? 'APPROVE')); // 'APPROVE' or 'REJECT'

    if (empty($missionId) || empty($requestId)) {
        jsonResponse(['success' => false, 'error' => 'Parâmetros incompletos.'], 400);
    }

    ensureMissionColumnsExist($db);
    $stmt = $db->prepare("SELECT * FROM missions WHERE id = ?");
    $stmt->execute([$missionId]);
    $m = $stmt->fetch();
    if (!$m) {
        jsonResponse(['success' => false, 'error' => 'Missão não encontrada.'], 404);
    }

    $existingRequests = !empty($m['extra_hours_requests']) ? json_decode($m['extra_hours_requests'], true) : [];
    if (!is_array($existingRequests)) $existingRequests = [];

    $found = false;
    $approvedHoursDelta = 0.0;
    foreach ($existingRequests as &$req) {
        if ($req['id'] === $requestId) {
            $req['status'] = ($decision === 'APPROVE') ? 'APPROVED' : 'REJECTED';
            $req['respondedAt'] = date('Y-m-d H:i:s');
            $req['respondedBy'] = $user['name'];
            if ($decision === 'APPROVE') {
                $approvedHoursDelta = (float)($req['hoursRequested'] ?? 1.0);
            }
            $found = true;
            break;
        }
    }

    if (!$found) {
        jsonResponse(['success' => false, 'error' => 'Solicitação não encontrada nesta missão.'], 404);
    }

    $newApproved = (float)($m['extra_hours_approved'] ?? 0.0) + $approvedHoursDelta;
    $stmtUp = $db->prepare("
        UPDATE missions
        SET extra_hours_requests = ?, extra_hours_approved = ?, version = version + 1
        WHERE id = ?
    ");
    $stmtUp->execute([
        json_encode($existingRequests, JSON_UNESCAPED_UNICODE),
        $newApproved,
        $missionId
    ]);

    logAudit('RESPOND_EXTRA_HOURS', 'MISSIONS', $missionId, "Gestão {$decision} solicitação {$requestId} de {$approvedHoursDelta}h.", $user['id'], $user['name']);
    bumpSyncVersion("mission_{$missionId}");

    jsonResponse([
        'success' => true,
        'approvedHours' => $newApproved,
        'message' => 'Solicitação de hora extra ' . ($decision === 'APPROVE' ? 'aprovada' : 'recusada') . ' com sucesso.'
    ]);
}

if ($method === 'POST' || $method === 'PUT') {
    $user = requireAuth();
    $data = getJsonInput();

    $id = trim($data['id'] ?? '');
    if (empty($id)) {
        $id = 'mis-' . date('Ymd') . '-' . bin2hex(random_bytes(6));
    }

    $description = trim($data['description'] ?? '');
    if (empty($description)) {
        jsonResponse(['success' => false, 'error' => 'A descrição/pauta da missão é obrigatória.'], 400);
    }

    ensureMissionColumnsExist($db);
    $stmtCheck = $db->prepare("SELECT * FROM missions WHERE id = ?");
    $stmtCheck->execute([$id]);
    $existing = $stmtCheck->fetch();

    // Controle de Concorrência Otimista (HTTP 409 Conflict)
    if ($existing && !empty($data['updatedAt']) && empty($data['forceOverwrite'])) {
        $serverUpdatedTs = strtotime($existing['updated_at']);
        $clientUpdatedTs = strtotime($data['updatedAt']);
        if ($serverUpdatedTs > ($clientUpdatedTs + 3)) {
            jsonResponse([
                'success'         => false,
                'conflict'        => true,
                'serverUpdatedAt' => $existing['updated_at'],
                'error'           => "Conflito de concorrência: Esta missão foi alterada por outro usuário às " . date('H:i:s', $serverUpdatedTs) . ". Deseja recarregar a versão mais recente para não sobrescrever dados?"
            ], 409);
        }
    }

    // Se for missão nova, apenas ADMIN ou MANAGER podem cadastrar
    if (!$existing && !in_array($user['role'], ['ADMIN', 'MANAGER'])) {
        jsonResponse(['success' => false, 'error' => 'Apenas Administradores e Gestores podem cadastrar novas missões.'], 403);
    }

    // Se for usuário operacional (USER) atualizando uma missão existente:
    // Ele só tem permissão se for integrante da missão e APENAS para campos operacionais (allowlist)
    if ($existing && $user['role'] === 'USER') {
        $uId = $user['id'];
        $uName = strtolower(trim($user['name']));

        // Resolve o colaborador vinculado a esta conta de usuário (por user_id ou id, com fallback por nome)
        $userMember = null;
        try {
            $stmtMember = $db->prepare("SELECT id, name FROM members WHERE user_id = ? OR id = ? LIMIT 1");
            $stmtMember->execute([$uId, $uId]);
            $userMember = $stmtMember->fetch();
        } catch (Throwable $ex) {
            error_log('[GestorMF Member Lookup by ID Error] ' . $ex->getMessage());
        }

        if (!$userMember && !empty($user['name'])) {
            try {
                $stmtMemName = $db->prepare("SELECT id, name FROM members WHERE LOWER(TRIM(name)) = ? LIMIT 1");
                $stmtMemName->execute([strtolower(trim($user['name']))]);
                $userMember = $stmtMemName->fetch();
            } catch (Throwable $ex) {
                error_log('[GestorMF Member Lookup by Name Error] ' . $ex->getMessage());
            }
        }

        $mId = $userMember['id'] ?? null;
        $mName = !empty($userMember['name']) ? strtolower(trim($userMember['name'])) : $uName;

        // Verifica vínculo com a missão (como motorista, equipe escalada ou editor)
        $isDriver = ($existing['driver_id'] === $uId || ($mId && $existing['driver_id'] === $mId));
        $team = !empty($existing['team_ids']) ? json_decode($existing['team_ids'], true) : [];
        $isTeam = is_array($team) && (in_array($uId, $team) || ($mId && in_array($mId, $team)));
        $editors = !empty($existing['editor_ids']) ? json_decode($existing['editor_ids'], true) : [];
        $incomingEditors = !empty($data['editorIds']) ? (is_array($data['editorIds']) ? $data['editorIds'] : json_decode($data['editorIds'], true)) : [];
        $allEditorIds = array_merge(is_array($editors) ? $editors : [], is_array($incomingEditors) ? $incomingEditors : []);

        $isEditor = ($existing['editor_id'] === $uId || ($mId && $existing['editor_id'] === $mId)) ||
                    (!empty($data['editorId']) && ($data['editorId'] === $uId || ($mId && $data['editorId'] === $mId))) ||
                    in_array($uId, $allEditorIds) || ($mId && in_array($mId, $allEditorIds));

        // Verificação textual abrangente por nome de editor caso IDs sejam heterogêneos
        if (!$isEditor) {
            $targetEdNames = strtolower(trim(
                ($existing['editor_names_display'] ?? '') . ' ' .
                ($data['editorNamesDisplay'] ?? '') . ' ' .
                ($existing['editor_name'] ?? '') . ' ' .
                ($data['editorName'] ?? '')
            ));

            if (!empty($targetEdNames)) {
                // Checa nome completo do usuário ou membro
                if (($uName !== '' && strpos($targetEdNames, $uName) !== false) ||
                    ($mName !== '' && strpos($targetEdNames, $mName) !== false)) {
                    $isEditor = true;
                } else {
                    // Checa tokens de nome (ex: "jonathan", "jordan") e prefixo do e-mail
                    $emailPrefix = !empty($user['email']) ? strtolower(explode('@', $user['email'])[0]) : '';
                    $rawTokens = array_merge(
                        explode(' ', str_replace(['.', '-', '_'], ' ', $uName)),
                        explode(' ', str_replace(['.', '-', '_'], ' ', $mName)),
                        [$emailPrefix]
                    );

                    foreach ($rawTokens as $token) {
                        $clean = trim($token);
                        if (strlen($clean) >= 3 && strpos($targetEdNames, $clean) !== false) {
                            $isEditor = true;
                            break;
                        }
                    }
                }
            }
        }

        if (!$isDriver && !$isTeam && !$isEditor) {
            jsonResponse(['success' => false, 'error' => 'Você não faz parte desta missão para atualizá-la.'], 403);
        }

        // ALLOWLIST ESTRITA (P2 / P1-09): USER nunca pode alterar descrição, destino, datas, viatura, equipe ou custos
        $newMissionStatus = $existing['mission_status'];
        $newEditionStatus = $existing['edition_status'] ?? 'Pendente';
        $editionCompletedAt = $existing['edition_completed_at'] ?? null;
        $editionCompletedBy = $existing['edition_completed_by'] ?? null;
        $serverFilePath = $data['serverFilePath'] ?? $existing['server_file_path'] ?? null;
        $editionDeliveryStatus = $data['editionDeliveryStatus'] ?? $existing['edition_delivery_status'] ?? null;
        $isOverdue = isset($data['isOverdue']) ? (int)$data['isOverdue'] : ($existing['is_overdue'] ?? 0);
        $editionHistory = isset($data['editionHistory']) ? (is_array($data['editionHistory']) ? json_encode($data['editionHistory'], JSON_UNESCAPED_UNICODE) : $data['editionHistory']) : ($existing['edition_history'] ?? null);
        $notes = $existing['notes'] ?? '';

        // FSM Operacional: 'Agendada' -> 'Em Execução' -> 'Pendente' / 'Finalizada' (USER não pode Cancelar ou retroceder)
        if (($isDriver || $isTeam) && isset($data['missionStatus'])) {
            $requestedStatus = $data['missionStatus'];
            $currentStatus = $existing['mission_status'] ?? 'Agendada';
            if ($requestedStatus !== $currentStatus) {
                $validTransitions = [
                    'Agendada'     => ['Em Execução'],
                    'Em Execução'  => ['Pendente', 'Finalizada'],
                    'Pendente'     => ['Finalizada'],
                    'Finalizada'   => []
                ];
                $allowedNext = $validTransitions[$currentStatus] ?? [];
                if (!in_array($requestedStatus, $allowedNext)) {
                    jsonResponse([
                        'success' => false,
                        'error' => "Transição de status operacional não autorizada para usuário de campo: de '{$currentStatus}' para '{$requestedStatus}'."
                    ], 403);
                }
                // Se a missão possui pós-produção e o colaborador concluiu o deslocamento em campo:
                $hasEdition = !empty($existing['edition_status']) && !in_array($existing['edition_status'], ['Não se aplica', 'Não se aplica (Mega Print / Instalação)']);
                if ($requestedStatus === 'Finalizada' && $hasEdition) {
                    $newMissionStatus = 'Pendente';
                } else {
                    $newMissionStatus = $requestedStatus;
                }
            }
        }

        if ($isEditor && isset($data['editionStatus'])) {
            $allowedEdition = ['Pendente', 'Em Edição', 'Edição Concluída', 'Entregue', 'Entregue ao Cliente', 'Não se aplica', 'Não se aplica (Mega Print / Instalação)'];
            if (in_array($data['editionStatus'], $allowedEdition)) {
                $newEditionStatus = $data['editionStatus'];
                if ($newEditionStatus === 'Edição Concluída' || $newEditionStatus === 'Entregue' || $newEditionStatus === 'Entregue ao Cliente') {
                    $editionCompletedAt = date('Y-m-d H:i:s');
                    $editionCompletedBy = $user['name'];
                    // Para o editor, o status da missão PERMANECE 'Pendente' até confirmação explícita da gestão!
                    $newMissionStatus = 'Pendente';
                } elseif (in_array($newEditionStatus, ['Pendente', 'Em Edição'])) {
                    $newMissionStatus = 'Pendente';
                }
            }
        }

        // Histórico de notas append-only com autor e carimbo de data/hora
        if (isset($data['notes']) && trim($data['notes']) !== '') {
            $incomingNote = trim($data['notes']);
            $currentNotes = trim($existing['notes'] ?? '');
            $authorTag = "[{$user['name']} - " . date('d/m/Y H:i') . "]: ";
            if ($currentNotes !== '' && strpos($currentNotes, $incomingNote) === false) {
                $notes = $currentNotes . "\n" . $authorTag . $incomingNote;
            } elseif ($currentNotes === '') {
                $notes = $authorTag . $incomingNote;
            } else {
                $notes = $currentNotes;
            }
        }

        $reopenReason = ($newEditionStatus === 'Edição Concluída') ? '' : ($existing['reopen_reason'] ?? '');

        // P0-02: Concorrência Operacional Atômica com verificação estrita de version
        if (!isset($data['version'])) {
            jsonResponse([
                'success' => false,
                'error'   => 'Parâmetro version é obrigatório para atualização de status operacional.'
            ], 400);
        }
        $expectedOpVer = (int)$data['version'];

        $db->beginTransaction();
        try {
            $stmtOp = $db->prepare("
                UPDATE missions
                SET mission_status = ?,
                    edition_status = ?,
                    edition_delivery_status = ?,
                    is_overdue = ?,
                    edition_history = ?,
                    edition_completed_at = ?,
                    edition_completed_by = ?,
                    server_file_path = ?,
                    reopen_reason = ?,
                    notes = ?,
                    version = version + 1,
                    updated_at = NOW()
                WHERE id = ? AND version = ?
            ");
            $stmtOp->execute([$newMissionStatus, $newEditionStatus, $editionDeliveryStatus, $isOverdue, $editionHistory, $editionCompletedAt, $editionCompletedBy, $serverFilePath, $reopenReason, $notes, $id, $expectedOpVer]);

            if ($stmtOp->rowCount() === 0) {
                $db->rollBack();
                $stmtCurVer = $db->prepare("SELECT version FROM missions WHERE id = ?");
                $stmtCurVer->execute([$id]);
                $cRow = $stmtCurVer->fetch();
                $cVer = (int)($cRow['version'] ?? 1);
                jsonResponse([
                    'success'        => false,
                    'conflict'       => true,
                    'currentVersion' => $cVer,
                    'error'          => 'Conflito de Concorrência: A missão foi alterada por outro usuário simultaneamente. Recarregue os dados antes de prosseguir.'
                ], 409);
            }

            $newVersion = $expectedOpVer + 1;
            $db->commit();
        } catch (Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            error_log('[GestorMF Operational Update Exception] ' . $e->getMessage());
            jsonResponse([
                'success' => false,
                'error'   => 'Falha ao salvar status operacional: ' . $e->getMessage()
            ], 500);
        }

        logAudit('OPERATIONAL_UPDATE_MISSION', 'MISSIONS', $id, "Status operacional atualizado por {$user['name']} (Missão: {$newMissionStatus}, Edição: {$newEditionStatus}).", $user['id'], $user['name']);
        bumpSyncVersion("mission_{$id}");

        jsonResponse([
            'success'   => true,
            'message'   => 'Status da missão atualizado com sucesso!',
            'id'        => $id,
            'version'   => $newVersion,
            'updatedAt' => date('Y-m-d H:i:s')
        ]);
    }

    // Apenas ADMIN ou MANAGER podem alterar os dados cadastrais completos da missão
    if (!in_array($user['role'], ['ADMIN', 'MANAGER'])) {
        jsonResponse(['success' => false, 'error' => 'Acesso negado: apenas Administradores e Gestores podem alterar dados cadastrais da missão.'], 403);
    }

    // Inicia transação atômica para checagem e gravação concorrente (P0-01 e P0-02)
    $db->beginTransaction();

    try {
        // Checagem Atômica de Conflitos de Escala com FOR UPDATE (P0-02 e P1-05)
        $conflict = checkRosterConflicts($db, $id, $data);
        if ($conflict) {
            $hasOverride = !empty($data['ignoreConflicts']) && in_array($user['role'], ['ADMIN', 'MANAGER']) && !empty($data['overrideReason']);
            if ($hasOverride) {
                logAudit('OVERRIDE_ROSTER_CONFLICT', 'MISSIONS', $id, [
                    'conflict' => $conflict['message'],
                    'reason'   => trim($data['overrideReason'])
                ], $user['id'], $user['name']);
            } else {
                $db->rollBack();
                jsonResponse([
                    'success'         => false,
                    'hasConflict'     => true,
                    'conflictType'    => $conflict['type'],
                    'conflictMessage' => $conflict['message'],
                    'error'           => "Conflito de Escala: " . $conflict['message']
                ], 422);
            }
        }

        // Concorrência Otimista com verificação estrita de version (P0-04)
        if ($existing) {
            $stmtVer = $db->prepare("SELECT version, updated_at, description FROM missions WHERE id = ? FOR UPDATE");
            $stmtVer->execute([$id]);
            $currentVerRow = $stmtVer->fetch();
            $dbVersion = (int)($currentVerRow['version'] ?? 1);

            $expectedVersion = isset($data['version']) ? (int)$data['version'] : null;
            $adminForce = !empty($data['forceOverwrite']) && $user['role'] === 'ADMIN';

            // Concorrência Otimista estrita: exige igualdade exata de versão (dbVersion === expectedVersion)
            if (!$adminForce && ($expectedVersion === null || $dbVersion !== $expectedVersion)) {
                $db->rollBack();
                jsonResponse([
                    'success'        => false,
                    'conflict'       => true,
                    'currentVersion' => $dbVersion,
                    'updatedAt'      => $currentVerRow['updated_at'],
                    'error'          => 'Esta missão foi alterada por outro usuário ou está desatualizada no seu navegador. Recarregue os dados para evitar sobreposição.'
                ], 409);
            }

            if ($adminForce && $expectedVersion !== null && $dbVersion !== $expectedVersion) {
                logAudit('FORCE_OVERWRITE_MISSION', 'MISSIONS', $id, "Sobrescrita forçada de versão ({$expectedVersion} -> {$dbVersion}) por Administrador ({$user['name']})", $user['id'], $user['name']);
            }
        }

    $isRecurring = !empty($data['isRecurring']) ? 1 : 0;
    $recurrenceId = !empty($data['recurrenceId']) ? trim($data['recurrenceId']) : ($isRecurring ? ('rec-' . bin2hex(random_bytes(8))) : null);
    $recurrenceRule = !empty($data['recurrenceRule']) ? trim($data['recurrenceRule']) : null;
    $recurrenceDays = !empty($data['recurrenceDays']) ? (is_array($data['recurrenceDays']) ? implode(', ', $data['recurrenceDays']) : trim($data['recurrenceDays'])) : null;
    $isMultiDay = !empty($data['isMultiDay']) ? 1 : 0;
    $endDate = !empty($data['endDate']) ? trim($data['endDate']) : null;
    if (!$isMultiDay) {
        $endDate = null;
    }

    $sql = "
        INSERT INTO missions (
            id, code, description, location_name, address, lat, lon, date,
            departure_time, arrival_time_estimated, return_time_estimated,
            event_start_time, antecedence_minutes, suggested_departure_time,
            vehicle_id, vehicle_name_display, vehicle_allocations,
            driver_id, driver_name, team_ids, team_names_display, guests,
            editor_id, editor_name, editor_ids, editor_names_display,
            delivery_deadline_date, delivery_deadline_time,
            edition_completed_at, edition_completed_by, is_overdue, edition_delivery_status, server_file_path, reopen_reason, edition_history,
            edition_status, mission_status, is_round_trip,
            distance_km, total_distance_km, driving_duration_minutes, round_trip_duration_minutes,
            estimated_fuel_liters, estimated_fuel_cost,
            route_coordinates, return_coordinates, notes,
            is_recurring, recurrence_id, recurrence_rule, recurrence_days,
            is_multi_day, end_date,
            custom_rates, off_hours,
            remuneration_type, member_roles, extra_hours_planned, extra_hours_approved, extra_hours_requests,
            created_by
        ) VALUES (
            :id, :code, :description, :location_name, :address, :lat, :lon, :date,
            :departure_time, :arrival_time_estimated, :return_time_estimated,
            :event_start_time, :antecedence_minutes, :suggested_departure_time,
            :vehicle_id, :vehicle_name_display, :vehicle_allocations,
            :driver_id, :driver_name, :team_ids, :team_names_display, :guests,
            :editor_id, :editor_name, :editor_ids, :editor_names_display,
            :delivery_deadline_date, :delivery_deadline_time,
            :edition_completed_at, :edition_completed_by, :is_overdue, :edition_delivery_status, :server_file_path, :reopen_reason, :edition_history,
            :edition_status, :mission_status, :is_round_trip,
            :distance_km, :total_distance_km, :driving_duration_minutes, :round_trip_duration_minutes,
            :estimated_fuel_liters, :estimated_fuel_cost,
            :route_coordinates, :return_coordinates, :notes,
            :is_recurring, :recurrence_id, :recurrence_rule, :recurrence_days,
            :is_multi_day, :end_date,
            :custom_rates, :off_hours,
            :remuneration_type, :member_roles, :extra_hours_planned, :extra_hours_approved, :extra_hours_requests,
            :created_by
        )
        ON DUPLICATE KEY UPDATE
            version = version + 1,
            code = VALUES(code),
            description = VALUES(description),
            location_name = VALUES(location_name),
            address = VALUES(address),
            lat = VALUES(lat),
            lon = VALUES(lon),
            date = VALUES(date),
            departure_time = VALUES(departure_time),
            arrival_time_estimated = VALUES(arrival_time_estimated),
            return_time_estimated = VALUES(return_time_estimated),
            event_start_time = VALUES(event_start_time),
            antecedence_minutes = VALUES(antecedence_minutes),
            suggested_departure_time = VALUES(suggested_departure_time),
            vehicle_id = VALUES(vehicle_id),
            vehicle_name_display = VALUES(vehicle_name_display),
            vehicle_allocations = VALUES(vehicle_allocations),
            driver_id = VALUES(driver_id),
            driver_name = VALUES(driver_name),
            team_ids = VALUES(team_ids),
            team_names_display = VALUES(team_names_display),
            guests = VALUES(guests),
            editor_id = VALUES(editor_id),
            editor_name = VALUES(editor_name),
            editor_ids = VALUES(editor_ids),
            editor_names_display = VALUES(editor_names_display),
            delivery_deadline_date = VALUES(delivery_deadline_date),
            delivery_deadline_time = VALUES(delivery_deadline_time),
            edition_completed_at = VALUES(edition_completed_at),
            edition_completed_by = VALUES(edition_completed_by),
            is_overdue = VALUES(is_overdue),
            edition_delivery_status = VALUES(edition_delivery_status),
            server_file_path = VALUES(server_file_path),
            reopen_reason = VALUES(reopen_reason),
            edition_history = VALUES(edition_history),
            edition_status = VALUES(edition_status),
            mission_status = VALUES(mission_status),
            is_round_trip = VALUES(is_round_trip),
            distance_km = VALUES(distance_km),
            total_distance_km = VALUES(total_distance_km),
            driving_duration_minutes = VALUES(driving_duration_minutes),
            round_trip_duration_minutes = VALUES(round_trip_duration_minutes),
            estimated_fuel_liters = VALUES(estimated_fuel_liters),
            estimated_fuel_cost = VALUES(estimated_fuel_cost),
            route_coordinates = VALUES(route_coordinates),
            return_coordinates = VALUES(return_coordinates),
            notes = VALUES(notes),
            is_recurring = VALUES(is_recurring),
            recurrence_id = VALUES(recurrence_id),
            recurrence_rule = VALUES(recurrence_rule),
            recurrence_days = VALUES(recurrence_days),
            is_multi_day = VALUES(is_multi_day),
            end_date = VALUES(end_date),
            custom_rates = VALUES(custom_rates),
            off_hours = VALUES(off_hours),
            remuneration_type = VALUES(remuneration_type),
            member_roles = VALUES(member_roles),
            extra_hours_planned = VALUES(extra_hours_planned),
            extra_hours_approved = VALUES(extra_hours_approved),
            extra_hours_requests = VALUES(extra_hours_requests)
    ";

    $saveParams = [
        ':id'                          => $id,
        ':code'                        => $data['code'] ?? null,
        ':description'                 => $description,
        ':location_name'               => $data['locationName'] ?? null,
        ':address'                     => $data['address'] ?? null,
        ':lat'                         => isset($data['lat']) && $data['lat'] !== '' ? $data['lat'] : null,
        ':lon'                         => isset($data['lon']) && $data['lon'] !== '' ? $data['lon'] : null,
        ':date'                        => $data['date'] ?? date('Y-m-d'),
        ':departure_time'              => $data['departureTime'] ?? '08:00',
        ':arrival_time_estimated'      => $data['arrivalTimeEstimated'] ?? null,
        ':return_time_estimated'       => $data['returnTimeEstimated'] ?? null,
        ':event_start_time'            => $data['eventStartTime'] ?? null,
        ':antecedence_minutes'         => isset($data['antecedenceMinutes']) ? (int)$data['antecedenceMinutes'] : 30,
        ':suggested_departure_time'    => $data['suggestedDepartureTime'] ?? null,
        ':vehicle_id'                  => $data['vehicleId'] ?? null,
        ':vehicle_name_display'        => $data['vehicleNameDisplay'] ?? null,
        ':vehicle_allocations'         => !empty($data['vehicleAllocations']) ? json_encode($data['vehicleAllocations'], JSON_UNESCAPED_UNICODE) : null,
        ':driver_id'                   => $data['driverId'] ?? null,
        ':driver_name'                 => $data['driverName'] ?? null,
        ':team_ids'                    => !empty($data['teamIds']) ? json_encode($data['teamIds'], JSON_UNESCAPED_UNICODE) : null,
        ':team_names_display'          => $data['teamNamesDisplay'] ?? null,
        ':guests'                      => !empty($data['guests']) ? (is_array($data['guests']) ? json_encode($data['guests'], JSON_UNESCAPED_UNICODE) : $data['guests']) : null,
        ':editor_id'                   => $data['editorId'] ?? null,
        ':editor_name'                 => $data['editorName'] ?? null,
        ':editor_ids'                  => !empty($data['editorIds']) ? json_encode($data['editorIds'], JSON_UNESCAPED_UNICODE) : null,
        ':editor_names_display'        => $data['editorNamesDisplay'] ?? null,
        ':delivery_deadline_date'      => $data['deliveryDeadlineDate'] ?? null,
        ':delivery_deadline_time'      => $data['deliveryDeadlineTime'] ?? null,
        ':edition_completed_at'        => $data['editionCompletedAt'] ?? null,
        ':edition_completed_by'        => $data['editionCompletedBy'] ?? null,
        ':is_overdue'                  => !empty($data['isOverdue']) ? 1 : 0,
        ':edition_delivery_status'     => $data['editionDeliveryStatus'] ?? null,
        ':server_file_path'            => $data['serverFilePath'] ?? null,
        ':reopen_reason'               => $data['reopenReason'] ?? null,
        ':edition_history'             => !empty($data['editionHistory']) ? json_encode($data['editionHistory'], JSON_UNESCAPED_UNICODE) : null,
        ':edition_status'              => $data['editionStatus'] ?? 'Pendente',
        ':mission_status'              => $data['missionStatus'] ?? 'Agendada',
        ':is_round_trip'               => !empty($data['isRoundTrip']) ? 1 : 0,
        ':distance_km'                 => (float)($data['distanceKm'] ?? 0),
        ':total_distance_km'           => (float)($data['totalDistanceKm'] ?? 0),
        ':driving_duration_minutes'    => (int)($data['drivingDurationMinutes'] ?? 0),
        ':round_trip_duration_minutes' => (int)($data['roundTripDurationMinutes'] ?? 0),
        ':estimated_fuel_liters'       => (float)($data['estimatedFuelLiters'] ?? 0),
        ':estimated_fuel_cost'         => (float)($data['estimatedFuelCost'] ?? 0),
        ':route_coordinates'           => !empty($data['routeCoordinates']) ? json_encode($data['routeCoordinates']) : null,
        ':return_coordinates'          => !empty($data['returnCoordinates']) ? json_encode($data['returnCoordinates']) : null,
        ':notes'                       => $data['notes'] ?? null,
        ':is_recurring'                => $isRecurring,
        ':recurrence_id'               => $recurrenceId,
        ':recurrence_rule'             => $recurrenceRule,
        ':recurrence_days'             => $recurrenceDays,
        ':is_multi_day'                => $isMultiDay,
        ':end_date'                    => $endDate,
        ':custom_rates'                => !empty($data['customRates']) ? json_encode($data['customRates'], JSON_UNESCAPED_UNICODE) : null,
        ':off_hours'                   => isset($data['offHours']) ? (float)$data['offHours'] : 0.0,
        ':remuneration_type'           => $data['remunerationType'] ?? ($isMultiDay ? 'daily' : 'off_hours'),
        ':member_roles'                => !empty($data['memberRoles']) ? (is_array($data['memberRoles']) ? json_encode($data['memberRoles'], JSON_UNESCAPED_UNICODE) : $data['memberRoles']) : null,
        ':extra_hours_planned'         => isset($data['extraHoursPlanned']) ? (float)$data['extraHoursPlanned'] : 0.0,
        ':extra_hours_approved'        => isset($data['extraHoursApproved']) ? (float)$data['extraHoursApproved'] : 0.0,
        ':extra_hours_requests'        => !empty($data['extraHoursRequests']) ? (is_array($data['extraHoursRequests']) ? json_encode($data['extraHoursRequests'], JSON_UNESCAPED_UNICODE) : $data['extraHoursRequests']) : null,
        ':created_by'                  => $user['id']
    ];

    $stmtSave = $db->prepare($sql);
    $stmtSave->execute($saveParams);

    $createdMissions = [];
    // Se for cadastro de nova missão recorrente (com múltiplas datas programadas)
    if (!$existing && $isRecurring && !empty($data['recurringDates']) && is_array($data['recurringDates'])) {
        $baseDate = $data['date'] ?? date('Y-m-d');
        $baseDateTs = strtotime($baseDate);
        $deadlineTs = !empty($data['deliveryDeadlineDate']) ? strtotime($data['deliveryDeadlineDate']) : $baseDateTs;
        $diffDays = max(0, (int)round(($deadlineTs - $baseDateTs) / 86400));

        foreach ($data['recurringDates'] as $rDate) {
            $rDate = trim($rDate);
            if ($rDate === $baseDate || empty($rDate)) continue;

            $childId = 'mis-rec-' . bin2hex(random_bytes(6));
            $cleanDate = preg_replace('/\D/', '', $rDate);
            $datePrefix = strlen($cleanDate) >= 8 ? substr($cleanDate, 0, 8) : date('Ymd');

            $stmtCount = $db->prepare("SELECT COUNT(*) FROM missions WHERE date = ?");
            $stmtCount->execute([$rDate]);
            $dCount = (int)$stmtCount->fetchColumn();
            $childCode = $datePrefix . ($dCount + 1);
            $childDeadlineDate = date('Y-m-d', strtotime("{$rDate} + {$diffDays} days"));

            $childParams = $saveParams;
            $childParams[':id'] = $childId;
            $childParams[':code'] = $childCode;
            $childParams[':date'] = $rDate;
            $childParams[':delivery_deadline_date'] = $childDeadlineDate;

            $stmtSave->execute($childParams);

            $childObj = $data;
            $childObj['id'] = $childId;
            $childObj['code'] = $childCode;
            $childObj['date'] = $rDate;
            $childObj['deliveryDeadlineDate'] = $childDeadlineDate;
            $childObj['isRecurring'] = true;
            $childObj['recurrenceId'] = $recurrenceId;
            $childObj['recurrenceRule'] = $recurrenceRule;
            $childObj['recurrenceDays'] = $recurrenceDays;
            $childObj['version'] = 1;
            $childObj['createdAt'] = date('Y-m-d H:i:s');
            $childObj['updatedAt'] = date('Y-m-d H:i:s');
            $createdMissions[] = $childObj;
        }
    }

    // Se estiver editando e optar por atualizar todas as futuras missões da série
    if ($existing && !empty($existing['recurrence_id']) && !empty($data['updateSeries'])) {
        $stmtUpSeries = $db->prepare("
            UPDATE missions
            SET description = ?,
                location_name = ?,
                address = ?,
                lat = ?,
                lon = ?,
                departure_time = ?,
                arrival_time_estimated = ?,
                return_time_estimated = ?,
                event_start_time = ?,
                antecedence_minutes = ?,
                suggested_departure_time = ?,
                vehicle_id = ?,
                vehicle_name_display = ?,
                vehicle_allocations = ?,
                driver_id = ?,
                driver_name = ?,
                team_ids = ?,
                team_names_display = ?,
                editor_id = ?,
                editor_name = ?,
                editor_ids = ?,
                editor_names_display = ?,
                delivery_deadline_time = ?,
                distance_km = ?,
                total_distance_km = ?,
                driving_duration_minutes = ?,
                round_trip_duration_minutes = ?,
                estimated_fuel_liters = ?,
                estimated_fuel_cost = ?,
                route_coordinates = ?,
                return_coordinates = ?,
                notes = ?,
                version = version + 1,
                updated_at = NOW()
            WHERE recurrence_id = ? AND date > ? AND id != ?
        ");
        $stmtUpSeries->execute([
            $description,
            $data['locationName'] ?? null,
            $data['address'] ?? null,
            isset($data['lat']) && $data['lat'] !== '' ? $data['lat'] : null,
            isset($data['lon']) && $data['lon'] !== '' ? $data['lon'] : null,
            $data['departureTime'] ?? '08:00',
            $data['arrivalTimeEstimated'] ?? null,
            $data['returnTimeEstimated'] ?? null,
            $data['eventStartTime'] ?? null,
            isset($data['antecedenceMinutes']) ? (int)$data['antecedenceMinutes'] : 30,
            $data['suggestedDepartureTime'] ?? null,
            $data['vehicleId'] ?? null,
            $data['vehicleNameDisplay'] ?? null,
            !empty($data['vehicleAllocations']) ? json_encode($data['vehicleAllocations'], JSON_UNESCAPED_UNICODE) : null,
            $data['driverId'] ?? null,
            $data['driverName'] ?? null,
            !empty($data['teamIds']) ? json_encode($data['teamIds'], JSON_UNESCAPED_UNICODE) : null,
            $data['teamNamesDisplay'] ?? null,
            $data['editorId'] ?? null,
            $data['editorName'] ?? null,
            !empty($data['editorIds']) ? json_encode($data['editorIds'], JSON_UNESCAPED_UNICODE) : null,
            $data['editorNamesDisplay'] ?? null,
            $data['deliveryDeadlineTime'] ?? null,
            (float)($data['distanceKm'] ?? 0),
            (float)($data['totalDistanceKm'] ?? 0),
            (int)($data['drivingDurationMinutes'] ?? 0),
            (int)($data['roundTripDurationMinutes'] ?? 0),
            (float)($data['estimatedFuelLiters'] ?? 0),
            (float)($data['estimatedFuelCost'] ?? 0),
            !empty($data['routeCoordinates']) ? json_encode($data['routeCoordinates']) : null,
            !empty($data['returnCoordinates']) ? json_encode($data['returnCoordinates']) : null,
            $data['notes'] ?? null,
            $existing['recurrence_id'],
            $data['date'] ?? date('Y-m-d'),
            $id
        ]);
        $seriesCount = $stmtUpSeries->rowCount();
        logAudit('UPDATE_MISSION_SERIES', 'MISSIONS', $id, "{$seriesCount} ocorrências futuras da série recorrente foram atualizadas.", $user['id'], $user['name']);
    }

    $db->commit();

    $actionName = $existing ? 'UPDATE_MISSION' : 'CREATE_MISSION';
    $auditMsg = $existing
        ? "Missão '{$description}' (#{$id}) atualizada. Status: " . ($data['missionStatus'] ?? 'Agendada')
        : "Nova missão criada: '{$description}' (#{$id})" . ($isRecurring ? " [Recorrente - " . count($createdMissions) . " ocorrências adicionais]" : "") . ".";

    logAudit($actionName, 'MISSIONS', $id, $auditMsg, $user['id'], $user['name']);
    bumpSyncVersion("mission_{$id}");

    // Dispara mensagem automática de comunicado para que toda a equipe receba na Central de Notificações
    if (!$existing) {
        try {
            $msgId = 'msg-mis-' . substr(md5($id . microtime()), 0, 10);
            $msgCode = !empty($code) ? "#{$code}" : "#{$id}";
            $msgTitle = "📅 Nova Missão Cadastrada: {$msgCode}";
            $destLoc = !empty($data['locationName']) ? $data['locationName'] : (!empty($data['address']) ? $data['address'] : 'Local Definido');
            $depTime = !empty($data['departureTime']) ? " Saída prevista às {$data['departureTime']}." : "";
            $msgBody = "Nova pauta criada: '{$description}' com destino a {$destLoc}.{$depTime}";

            $colsSM = [];
            try {
                $stCols = $db->query("SHOW COLUMNS FROM system_messages");
                while ($cRow = $stCols->fetch()) {
                    $colsSM[strtolower($cRow['Field'])] = true;
                }
            } catch (Exception $eCols) {}

            $hasDismissedCol = isset($colsSM['dismissed_by']);
            if ($hasDismissedCol) {
                $stmtMsg = $db->prepare("
                    INSERT INTO system_messages (
                        id, sender_id, sender_name, sender_role, recipient_type, recipient_id, recipient_name, title, message, priority, read_by, dismissed_by, created_at
                    ) VALUES (
                        ?, ?, ?, 'Gestor/Admin', 'ALL', NULL, NULL, ?, ?, 'NORMAL', '[]', '[]', NOW()
                    )
                ");
                $stmtMsg->execute([$msgId, $user['id'], $user['name'], $msgTitle, $msgBody]);
            } else {
                $stmtMsg = $db->prepare("
                    INSERT INTO system_messages (
                        id, sender_id, sender_name, sender_role, recipient_type, recipient_id, recipient_name, title, message, priority, read_by, created_at
                    ) VALUES (
                        ?, ?, ?, 'Gestor/Admin', 'ALL', NULL, NULL, ?, ?, 'NORMAL', '[]', NOW()
                    )
                ");
                $stmtMsg->execute([$msgId, $user['id'], $user['name'], $msgTitle, $msgBody]);
            }
        } catch (Exception $eMsg) {
            error_log('[GestorMF Auto Message Mission] ' . $eMsg->getMessage());
        }
    }

    $nowUpdated = date('Y-m-d H:i:s');
    $newVersion = $existing ? ($dbVersion + 1) : 1;
    jsonResponse([
        'success'         => true,
        'message'         => $isRecurring && count($createdMissions) > 0
            ? "Missão e " . (count($createdMissions) + 1) . " agendamentos recorrentes salvos com sucesso!"
            : 'Missão salva com sucesso!',
        'id'              => $id,
        'version'         => $newVersion,
        'updatedAt'       => $nowUpdated,
        'createdMissions' => $createdMissions,
        'recurrenceId'    => $recurrenceId
    ]);
} catch (Exception $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }

    // Auto-cura de banco se faltar alguma coluna ou tabela no MySQL do servidor
    $errMsg = $e->getMessage();
    $isMissingColOrTable = ($e instanceof PDOException) && (
        $e->getCode() === '42S22' || 
        $e->getCode() === '42S02' || 
        strpos($errMsg, 'Unknown column') !== false ||
        strpos($errMsg, "Table doesn't exist") !== false
    );

    if ($isMissingColOrTable && !defined('GESTORMF_MISSION_RETRY_DONE')) {
        define('GESTORMF_MISSION_RETRY_DONE', true);
        try {
            require_once __DIR__ . '/schema.php';
            runDatabaseInstallation($db);

            $db->beginTransaction();
            $stmtRetry = $db->prepare($sql);
            $stmtRetry->execute($saveParams);
            $db->commit();

            $actionName = $existing ? 'UPDATE_MISSION' : 'CREATE_MISSION';
            $auditMsg = $existing
                ? "Missão '{$description}' (#{$id}) atualizada. Status: " . ($data['missionStatus'] ?? 'Agendada')
                : "Nova missão criada: '{$description}' (#{$id}).";

            logAudit($actionName, 'MISSIONS', $id, $auditMsg, $user['id'], $user['name']);
            bumpSyncVersion("mission_{$id}");

            $nowUpdated = date('Y-m-d H:i:s');
            $newVersion = $existing ? (($dbVersion ?? 1) + 1) : 1;
            jsonResponse([
                'success'   => true,
                'message'   => 'Missão salva com sucesso após auto-recuperação do banco!',
                'id'        => $id,
                'version'   => $newVersion,
                'updatedAt' => $nowUpdated
            ]);
            exit;
        } catch (Exception $e2) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            $e = $e2;
        }
    }

    $incidentCode = 'ERR-MIS-' . bin2hex(random_bytes(4));
    error_log("[GestorMF Incident {$incidentCode}] Erro ao salvar missão: " . $e->getMessage());
    $displayError = ($user['role'] === 'ADMIN')
        ? "Erro no servidor ao processar missão (Protocolo {$incidentCode}): " . $e->getMessage()
        : "Erro interno no servidor ao processar missão (Protocolo: {$incidentCode}).";
    jsonResponse(['success' => false, 'error' => $displayError, 'incidentCode' => $incidentCode], 500);
}
}

// ------------------------------------------------------------------------------
// EXCLUIR MISSÃO (DELETE - Apenas Administrador)
// ------------------------------------------------------------------------------
if ($method === 'DELETE') {
    $user = requireAuth(['ADMIN']);
    $id = $_GET['id'] ?? '';
    if (empty($id)) {
        $input = getJsonInput();
        $id = $input['id'] ?? '';
    }

    if (empty($id)) {
        jsonResponse(['success' => false, 'error' => 'ID da missão não informado.'], 400);
    }

    $deleteSeries = !empty($_GET['deleteSeries']) || !empty($_GET['deleteAllRecurring']);

    $stmtGet = $db->prepare("SELECT description, recurrence_id, date FROM missions WHERE id = ?");
    $stmtGet->execute([$id]);
    $mis = $stmtGet->fetch();

    if ($mis && $deleteSeries && !empty($mis['recurrence_id'])) {
        $stmtDel = $db->prepare("DELETE FROM missions WHERE recurrence_id = ? AND date >= ?");
        $stmtDel->execute([$mis['recurrence_id'], $mis['date']]);
        $deletedCount = $stmtDel->rowCount();
        logAudit('DELETE_MISSION_SERIES', 'MISSIONS', $id, "Série recorrente da missão '{$mis['description']}' excluída ({$deletedCount} ocorrências).", $user['id'], $user['name']);
        jsonResponse([
            'success'      => true,
            'message'      => "{$deletedCount} agendamentos da série recorrente foram excluídos com sucesso.",
            'deletedCount' => $deletedCount,
            'deleteSeries' => true,
            'recurrenceId' => $mis['recurrence_id']
        ]);
    } else {
        $stmtDel = $db->prepare("DELETE FROM missions WHERE id = ?");
        $stmtDel->execute([$id]);
        $desc = $mis ? $mis['description'] : $id;
        logAudit('DELETE_MISSION', 'MISSIONS', $id, "Missão '{$desc}' excluída.", $user['id'], $user['name']);
        jsonResponse(['success' => true, 'message' => 'Missão excluída com sucesso.']);
    }
}

jsonResponse(['error' => 'Método não suportado.'], 405);
