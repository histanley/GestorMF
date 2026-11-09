<?php
// ==============================================================================
// GestorMF API - Gestão de Viaturas & Combustível (com Auditoria & Tempo Real)
// ==============================================================================
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();

// LISTAR VIATURAS (GET)
if ($method === 'GET') {
    $user = requireAuth();
    $stmt = $db->query("SELECT * FROM vehicles ORDER BY name ASC");
    $raw = $stmt->fetchAll();

    $vehicles = array_map(function($v) {
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
            'fuelLogs'           => !empty($v['fuel_logs']) ? json_decode($v['fuel_logs'], true) : [],
            'createdAt'          => $v['created_at'],
            'updatedAt'          => $v['updated_at']
        ];
    }, $raw);

    jsonResponse(['success' => true, 'vehicles' => $vehicles]);
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
        ':fuel_logs'             => !empty($data['fuelLogs']) ? json_encode($data['fuelLogs'], JSON_UNESCAPED_UNICODE) : null
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

