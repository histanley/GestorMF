<?php
// ==============================================================================
// GestorMF - Utilitário Exclusivo de Terminal (CLI) para Restauração de Backups Legados
// ==============================================================================
if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    echo "Acesso negado: a restauração de formatos legados só pode ser executada via terminal CLI.\n";
    exit(1);
}

define('GESTORMF_RUN_MIGRATIONS', true);
require_once dirname(__DIR__) . '/api/config.php';
require_once dirname(__DIR__) . '/api/schema.php';

echo "=============================================================\n";
echo "   GESTORMF - RESTAURAÇÃO DE BACKUPS LEGADOS (CLI APENAS)   \n";
echo "=============================================================\n\n";

if ($argc < 2) {
    echo "Uso: php public/bin/restore-legacy.php <caminho_do_arquivo.json>\n";
    exit(1);
}

$filepath = $argv[1];
if (!file_exists($filepath)) {
    echo "Erro: arquivo não encontrado em '{$filepath}'.\n";
    exit(1);
}

$raw = file_get_contents($filepath);
$data = json_decode($raw, true);

if (!is_array($data) || empty($data['tables'])) {
    echo "Erro: arquivo JSON não contém estrutura de tabelas válida.\n";
    exit(1);
}

echo "Arquivo lido com sucesso. Versão: " . ($data['version'] ?? 'legada') . "\n";
echo "AVISO CRÍTICO: Esta operação substituirá o estado atual do banco de dados pelo backup informado.\n";
echo "Deseja continuar com a restauração do backup legado? (digite 'SIM' para confirmar): ";

$handle = fopen("php://stdin", "r");
$line = trim(fgets($handle));
if ($line !== 'SIM') {
    echo "Operação cancelada pelo administrador.\n";
    exit(0);
}

$db = getDB();
$db->beginTransaction();

try {
    $tables = $data['tables'];

    if (isset($tables['settings']) && !empty($tables['settings'])) {
        $s = $tables['settings'];
        $db->prepare("
            REPLACE INTO settings (id, company_name, fuel_price_per_liter, gasoline_price_per_liter, diesel_price_per_liter, base_location, roles)
            VALUES (1, :comp, :fuel, :gas, :die, :base, :roles)
        ")->execute([
            ':comp'  => $s['company_name'] ?? 'MegaFilmes & Mega Print',
            ':fuel'  => $s['fuel_price_per_liter'] ?? 6.45,
            ':gas'   => $s['gasoline_price_per_liter'] ?? 6.45,
            ':die'   => $s['diesel_price_per_liter'] ?? 6.89,
            ':base'  => is_array($s['base_location']) ? json_encode($s['base_location']) : $s['base_location'],
            ':roles' => is_array($s['roles']) ? json_encode($s['roles']) : $s['roles']
        ]);
        echo " - Configurações restauradas.\n";
    }

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
                is_array($v['fuel_logs'] ?? null) ? json_encode($v['fuel_logs']) : ($v['fuel_logs'] ?? null)
            ]);
        }
        echo " - " . count($tables['vehicles']) . " viaturas restauradas.\n";
    }

    if (isset($tables['members']) && is_array($tables['members'])) {
        $db->exec("DELETE FROM members");
        $stmtMem = $db->prepare("
            INSERT INTO members (id, user_id, name, role, company, phone, photo_url, can_drive, cnh_category, active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        foreach ($tables['members'] as $m) {
            $stmtMem->execute([
                $m['id'], $m['user_id'] ?? null, $m['name'], $m['role'], $m['company'] ?? 'MegaFilmes',
                $m['phone'] ?? '', $m['photo_url'] ?? null, isset($m['can_drive']) ? (int)$m['can_drive'] : 0,
                $m['cnh_category'] ?? 'B', isset($m['active']) ? (int)$m['active'] : 1
            ]);
        }
        echo " - " . count($tables['members']) . " colaboradores restaurados.\n";
    }

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
                route_coordinates, return_coordinates, notes, created_by, version
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?,
                ?, ?, ?, ?, ?
            )
        ");
        foreach ($tables['missions'] as $mis) {
            $stmtMis->execute([
                $mis['id'], $mis['code'] ?? null, $mis['description'], $mis['location_name'] ?? null,
                $mis['address'] ?? null, $mis['lat'] ?? null, $mis['lon'] ?? null, $mis['date'],
                $mis['departure_time'] ?? null, $mis['arrival_time_estimated'] ?? null, $mis['return_time_estimated'] ?? null,
                $mis['vehicle_id'] ?? null, $mis['vehicle_name_display'] ?? null,
                is_array($mis['vehicle_allocations'] ?? null) ? json_encode($mis['vehicle_allocations']) : ($mis['vehicle_allocations'] ?? null),
                $mis['driver_id'] ?? null, $mis['driver_name'] ?? null,
                is_array($mis['team_ids'] ?? null) ? json_encode($mis['team_ids']) : ($mis['team_ids'] ?? null),
                $mis['team_names_display'] ?? null, $mis['edition_status'] ?? 'Pendente',
                $mis['mission_status'] ?? 'Agendada', isset($mis['is_round_trip']) ? (int)$mis['is_round_trip'] : 1,
                $mis['distance_km'] ?? 0, $mis['total_distance_km'] ?? 0, $mis['driving_duration_minutes'] ?? 0,
                $mis['round_trip_duration_minutes'] ?? 0, $mis['estimated_fuel_liters'] ?? 0, $mis['estimated_fuel_cost'] ?? 0,
                is_array($mis['route_coordinates'] ?? null) ? json_encode($mis['route_coordinates']) : ($mis['route_coordinates'] ?? null),
                is_array($mis['return_coordinates'] ?? null) ? json_encode($mis['return_coordinates']) : ($mis['return_coordinates'] ?? null),
                $mis['notes'] ?? null, $mis['created_by'] ?? 'cli-migration', isset($mis['version']) ? (int)$mis['version'] : 1
            ]);
        }
        echo " - " . count($tables['missions']) . " missões restauradas.\n";
    }

    $db->commit();
    echo "\n=== Restauração de backup legado concluída com sucesso! ===\n";
    exit(0);

} catch (Exception $e) {
    $db->rollBack();
    echo "\nERRO DURANTE RESTAURAÇÃO: " . $e->getMessage() . "\n";
    exit(1);
}

