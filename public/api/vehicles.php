<?php
// ==============================================================================
// GestorMF API - Gestão de Viaturas & Combustível (com Auditoria & Tempo Real)
// ==============================================================================
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();
$action = $_GET['action'] ?? '';

// LISTAR VIATURAS (GET)
if ($method === 'GET') {
    $user = requireAuth();
    $stmt = $db->query("SELECT * FROM vehicles ORDER BY name ASC");
    $raw = $stmt->fetchAll();

    $vehicles = array_map(function($v) {
        $fLogs = [];
        if (!empty($v['fuel_logs'])) {
            $decoded = json_decode($v['fuel_logs'], true);
            if (is_array($decoded)) {
                $fLogs = $decoded;
            } elseif (is_string($decoded)) {
                $second = json_decode($decoded, true);
                if (is_array($second)) $fLogs = $second;
            }
        }

        return [
            'id'                 => $v['id'],
            'name'               => $v['name'],
            'plate'              => $v['plate'],
            'company'            => $v['company'],
            'type'               => $v['type'],
            'fuelType'           => $v['fuel_type'],
            'autonomyKmPerLiter' => (float)$v['autonomy_km_per_liter'],
            'tankCapacity'       => (float)$v['tank_capacity'],
            'currentFuelPercent' => (float)$v['current_fuel_percent'],
            'currentKm'          => (int)$v['current_km'],
            'status'             => $v['status'],
            'fuelLogs'           => $fLogs,
            'createdAt'          => $v['created_at'],
            'updatedAt'          => $v['updated_at']
        ];
    }, $raw);

    jsonResponse(['success' => true, 'vehicles' => $vehicles]);
}

// ACTION DEDICADA: ADICIONAR REGISTRO DE ABASTECIMENTO (POST ?action=add_fuel_log)
if ($method === 'POST' && $action === 'add_fuel_log') {
    $user = requireAuth(); // Admins, Managers e Colaboradores autorizados
    $data = getJsonInput();
    $vehicleId = trim($data['vehicleId'] ?? $data['id'] ?? '');
    $log = $data['fuelLog'] ?? $data['log'] ?? null;

    if (empty($vehicleId) || empty($log)) {
        jsonResponse(['success' => false, 'error' => 'ID da viatura e dados do abastecimento são obrigatórios.'], 400);
    }

    $stmt = $db->prepare("SELECT id, name, plate, current_km, fuel_logs FROM vehicles WHERE id = ?");
    $stmt->execute([$vehicleId]);
    $veh = $stmt->fetch();

    if (!$veh) {
        jsonResponse(['success' => false, 'error' => 'Viatura não encontrada.'], 404);
    }

    $currentLogs = [];
    if (!empty($veh['fuel_logs'])) {
        $decoded = json_decode($veh['fuel_logs'], true);
        if (is_array($decoded)) {
            $currentLogs = $decoded;
        } elseif (is_string($decoded)) {
            $second = json_decode($decoded, true);
            if (is_array($second)) $currentLogs = $second;
        }
    }

    // Adiciona o novo abastecimento
    $currentLogs[] = $log;
    $logKm = (int)($log['km'] ?? 0);
    $newKm = max((int)$veh['current_km'], $logKm);

    $stmtUp = $db->prepare("UPDATE vehicles SET fuel_logs = :logs, current_km = :km WHERE id = :id");
    $stmtUp->execute([
        ':logs' => json_encode($currentLogs, JSON_UNESCAPED_UNICODE),
        ':km'   => $newKm,
        ':id'   => $vehicleId
    ]);

    $liters = $log['liters'] ?? 0;
    $amount = $log['amountSpent'] ?? 0;
    logAudit('ADD_FUEL_LOG', 'FLEET', $vehicleId, "Abastecimento de {$liters}L (R$ {$amount}) registrado na viatura {$veh['name']} ({$veh['plate']}) por {$user['name']}.", $user['id'], $user['name']);
    bumpSyncVersion("fuel_{$vehicleId}");

    jsonResponse([
        'success'   => true,
        'message'   => 'Abastecimento gravado com sucesso no servidor!',
        'vehicleId' => $vehicleId,
        'fuelLogs'  => $currentLogs,
        'currentKm' => $newKm
    ]);
}

// ACTION DEDICADA: EXCLUIR REGISTRO DE ABASTECIMENTO (POST ?action=delete_fuel_log)
if ($method === 'POST' && $action === 'delete_fuel_log') {
    $user = requireAuth(['ADMIN', 'MANAGER']);
    $data = getJsonInput();
    $vehicleId = trim($data['vehicleId'] ?? $data['id'] ?? '');
    $logId = trim($data['fuelLogId'] ?? $data['logId'] ?? '');

    if (empty($vehicleId) || empty($logId)) {
        jsonResponse(['success' => false, 'error' => 'ID da viatura e ID do abastecimento são obrigatórios.'], 400);
    }

    $stmt = $db->prepare("SELECT id, name, plate, fuel_logs FROM vehicles WHERE id = ?");
    $stmt->execute([$vehicleId]);
    $veh = $stmt->fetch();

    if (!$veh) {
        jsonResponse(['success' => false, 'error' => 'Viatura não encontrada.'], 404);
    }

    $currentLogs = [];
    if (!empty($veh['fuel_logs'])) {
        $decoded = json_decode($veh['fuel_logs'], true);
        if (is_array($decoded)) {
            $currentLogs = $decoded;
        } elseif (is_string($decoded)) {
            $second = json_decode($decoded, true);
            if (is_array($second)) $currentLogs = $second;
        }
    }

    $filteredLogs = array_values(array_filter($currentLogs, function($l) use ($logId) {
        return (string)($l['id'] ?? '') !== (string)$logId;
    }));

    $stmtUp = $db->prepare("UPDATE vehicles SET fuel_logs = :logs WHERE id = :id");
    $stmtUp->execute([
        ':logs' => !empty($filteredLogs) ? json_encode($filteredLogs, JSON_UNESCAPED_UNICODE) : null,
        ':id'   => $vehicleId
    ]);

    logAudit('DELETE_FUEL_LOG', 'FLEET', $vehicleId, "Registro de abastecimento {$logId} excluído na viatura {$veh['name']} ({$veh['plate']}) por {$user['name']}.", $user['id'], $user['name']);
    bumpSyncVersion("fuel_del_{$vehicleId}");

    jsonResponse([
        'success'   => true,
        'message'   => 'Abastecimento excluído com sucesso!',
        'vehicleId' => $vehicleId,
        'fuelLogs'  => $filteredLogs
    ]);
}

// SALVAR OU ATUALIZAR VIATURA (POST / PUT)
if ($method === 'POST' || $method === 'PUT') {
    $user = requireAuth(['ADMIN', 'MANAGER']);
    $data = getJsonInput();

    $id = trim($data['id'] ?? '');
    if (empty($id)) {
        $id = 'v-' . bin2hex(random_bytes(8));
    }

    $name = trim($data['name'] ?? '');
    $plate = strtoupper(trim($data['plate'] ?? ''));

    if (empty($name) || empty($plate)) {
        jsonResponse(['success' => false, 'error' => 'Nome do veículo e placa são obrigatórios.'], 400);
    }

    $stmtCheck = $db->prepare("SELECT id, name FROM vehicles WHERE id = ?");
    $stmtCheck->execute([$id]);
    $existing = $stmtCheck->fetch();

    $fuelLogsPayload = null;
    if (isset($data['fuelLogs']) && is_array($data['fuelLogs']) && !empty($data['fuelLogs'])) {
        $fuelLogsPayload = json_encode(array_values($data['fuelLogs']), JSON_UNESCAPED_UNICODE);
    } elseif ($existing) {
        // Se a requisição não enviou fuelLogs explicitamente, mantém o que já existia no banco
        $stmtExistingLogs = $db->prepare("SELECT fuel_logs FROM vehicles WHERE id = ?");
        $stmtExistingLogs->execute([$id]);
        $rowLogs = $stmtExistingLogs->fetch();
        $fuelLogsPayload = $rowLogs['fuel_logs'] ?? null;
    }

    $sql = "
        INSERT INTO vehicles (
            id, name, plate, company, type, fuel_type,
            autonomy_km_per_liter, tank_capacity, current_fuel_percent,
            current_km, status, fuel_logs
        ) VALUES (
            :id, :name, :plate, :company, :type, :fuel_type,
            :autonomy_km_per_liter, :tank_capacity, :current_fuel_percent,
            :current_km, :status, :fuel_logs
        )
        ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            plate = VALUES(plate),
            company = VALUES(company),
            type = VALUES(type),
            fuel_type = VALUES(fuel_type),
            autonomy_km_per_liter = VALUES(autonomy_km_per_liter),
            tank_capacity = VALUES(tank_capacity),
            current_fuel_percent = VALUES(current_fuel_percent),
            current_km = VALUES(current_km),
            status = VALUES(status),
            fuel_logs = VALUES(fuel_logs)
    ";

    $stmtSave = $db->prepare($sql);
    $stmtSave->execute([
        ':id'                    => $id,
        ':name'                  => $name,
        ':plate'                 => $plate,
        ':company'               => $data['company'] ?? 'MegaFilmes',
        ':type'                  => $data['type'] ?? '',
        ':fuel_type'             => $data['fuelType'] ?? 'Gasolina',
        ':autonomy_km_per_liter' => (float)($data['autonomyKmPerLiter'] ?? 10.0),
        ':tank_capacity'         => (float)($data['tankCapacity'] ?? 50.0),
        ':current_fuel_percent'  => (float)($data['currentFuelPercent'] ?? 100.0),
        ':current_km'            => (int)($data['currentKm'] ?? 0),
        ':status'                => $data['status'] ?? 'Disponível',
        ':fuel_logs'             => $fuelLogsPayload
    ]);

    $actionName = $existing ? 'UPDATE_VEHICLE' : 'CREATE_VEHICLE';
    $auditMsg = "Viatura '{$name}' ({$plate}) salva por {$user['name']}.";
    logAudit($actionName, 'FLEET', $id, $auditMsg, $user['id'], $user['name']);
    bumpSyncVersion("vehicle_{$id}");

    jsonResponse(['success' => true, 'message' => 'Viatura salva com sucesso!', 'id' => $id]);
}

// EXCLUIR VIATURA (DELETE - Apenas Administrador)
if ($method === 'DELETE') {
    $user = requireAuth(['ADMIN']);
    $id = $_GET['id'] ?? '';
    if (empty($id)) {
        $input = getJsonInput();
        $id = $input['id'] ?? '';
    }

    if (empty($id)) {
        jsonResponse(['success' => false, 'error' => 'ID da viatura não informado.'], 400);
    }

    $stmtGet = $db->prepare("SELECT name, plate FROM vehicles WHERE id = ?");
    $stmtGet->execute([$id]);
    $veh = $stmtGet->fetch();

    $stmtDel = $db->prepare("DELETE FROM vehicles WHERE id = ?");
    $stmtDel->execute([$id]);

    $label = $veh ? "{$veh['name']} ({$veh['plate']})" : $id;
    logAudit('DELETE_VEHICLE', 'FLEET', $id, "Viatura '{$label}' removida.", $user['id'], $user['name']);
    bumpSyncVersion("delete_vehicle_{$id}");

    jsonResponse(['success' => true, 'message' => 'Viatura excluída com sucesso.']);
}

jsonResponse(['error' => 'Método não suportado.'], 405);
