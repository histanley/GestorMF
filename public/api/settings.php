<?php
// ==============================================================================
// GestorMF API - Configurações Gerais da Empresa & Base (com Auditoria)
// ==============================================================================
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();

// OBTER CONFIGURAÇÕES (GET)
if ($method === 'GET') {
    $user = requireAuth();
    $stmt = $db->query("SELECT * FROM settings WHERE id = 1");
    $s = $stmt->fetch();

    if (!$s) {
        // Se ainda não existir, inicializa padrão
        jsonResponse([
            'success' => true,
            'settings' => [
                'companyName' => 'MegaFilmes & Mega Print',
                'fuelPricePerLiter' => 6.45,
                'gasolinePricePerLiter' => 6.45,
                'dieselPricePerLiter' => 6.89,
                'electricPricePerKwh' => 0.95,
                'defaultAutonomy' => 10.0,
                'baseLocation' => [
                    'name' => 'Sede MegaFilmes & Mega Print',
                    'address' => 'R. Sardinha, 1061 - Tancredo Neves, Boa Vista - RR, 69314-117',
                    'lat' => 2.8293822995808733,
                    'lon' => -60.730887232802566,
                ]
            ],
            'roles' => []
        ]);
    }

    $baseLocation = !empty($s['base_location']) ? json_decode($s['base_location'], true) : [
        'name' => 'Sede MegaFilmes & Mega Print',
        'address' => 'R. Sardinha, 1061 - Tancredo Neves, Boa Vista - RR, 69314-117',
        'lat' => 2.8293822995808733,
        'lon' => -60.730887232802566,
    ];

    // Se as coordenadas estiverem no valor legado provisório (2.825358), atualiza para a sede correta
    if (isset($baseLocation['lat']) && abs($baseLocation['lat'] - 2.825358) < 0.0002) {
        $baseLocation['lat'] = 2.8293822995808733;
        $baseLocation['lon'] = -60.730887232802566;
        $db->prepare("UPDATE settings SET base_location = ? WHERE id = 1")->execute([json_encode($baseLocation, JSON_UNESCAPED_UNICODE)]);
    }

    $roles = !empty($s['roles']) ? json_decode($s['roles'], true) : [];

    jsonResponse([
        'success' => true,
        'settings' => [
            'companyName'           => $s['company_name'],
            'fuelPricePerLiter'     => (float)$s['fuel_price_per_liter'],
            'gasolinePricePerLiter' => (float)$s['gasoline_price_per_liter'],
            'dieselPricePerLiter'   => (float)$s['diesel_price_per_liter'],
            'electricPricePerKwh'   => isset($s['electric_price_per_kwh']) ? (float)$s['electric_price_per_kwh'] : 0.95,
            'defaultAutonomy'       => isset($s['default_autonomy']) ? (float)$s['default_autonomy'] : 10.0,
            'baseLocation'          => $baseLocation,
            'updatedAt'             => $s['updated_at']
        ],
        'roles' => $roles
    ]);
}

// ATUALIZAR CONFIGURAÇÕES (POST / PUT - APENAS ADMIN)
if ($method === 'POST' || $method === 'PUT') {
    $user = requireAuth(['ADMIN']);
    $data = getJsonInput();

    $settingsData = $data['settings'] ?? $data;
    $rolesData = $data['roles'] ?? null;

    $companyName = trim($settingsData['companyName'] ?? 'MegaFilmes & Mega Print');
    $gasolinePrice = (float)($settingsData['gasolinePricePerLiter'] ?? ($settingsData['fuelPricePerLiter'] ?? 6.45));
    $dieselPrice = (float)($settingsData['dieselPricePerLiter'] ?? 6.89);
    $electricPrice = (float)($settingsData['electricPricePerKwh'] ?? 0.95);
    $defaultAutonomy = (float)($settingsData['defaultAutonomy'] ?? 10.0);
    $baseLocationJson = !empty($settingsData['baseLocation']) ? json_encode($settingsData['baseLocation'], JSON_UNESCAPED_UNICODE) : null;

    $hasElecCol = false;
    try {
        $chk = $db->query("SHOW COLUMNS FROM settings LIKE 'electric_price_per_kwh'")->fetch();
        $hasElecCol = !empty($chk);
    } catch (Exception $e) {}

    if ($hasElecCol) {
        $stmt = $db->prepare("
            INSERT INTO settings (id, company_name, fuel_price_per_liter, gasoline_price_per_liter, diesel_price_per_liter, electric_price_per_kwh, default_autonomy, base_location, roles)
            VALUES (1, :comp, :gas, :gas, :die, :elec, :auto, :base, :roles)
            ON DUPLICATE KEY UPDATE
                company_name = VALUES(company_name),
                fuel_price_per_liter = VALUES(fuel_price_per_liter),
                gasoline_price_per_liter = VALUES(gasoline_price_per_liter),
                diesel_price_per_liter = VALUES(diesel_price_per_liter),
                electric_price_per_kwh = VALUES(electric_price_per_kwh),
                default_autonomy = VALUES(default_autonomy),
                base_location = COALESCE(VALUES(base_location), base_location),
                roles = COALESCE(VALUES(roles), roles)
        ");
        $stmt->execute([
            ':comp'  => $companyName,
            ':gas'   => $gasolinePrice,
            ':die'   => $dieselPrice,
            ':elec'  => $electricPrice,
            ':auto'  => $defaultAutonomy,
            ':base'  => $baseLocationJson,
            ':roles' => $rolesJson
        ]);
    } else {
        $stmt = $db->prepare("
            INSERT INTO settings (id, company_name, fuel_price_per_liter, gasoline_price_per_liter, diesel_price_per_liter, default_autonomy, base_location, roles)
            VALUES (1, :comp, :gas, :gas, :die, :auto, :base, :roles)
            ON DUPLICATE KEY UPDATE
                company_name = VALUES(company_name),
                fuel_price_per_liter = VALUES(fuel_price_per_liter),
                gasoline_price_per_liter = VALUES(gasoline_price_per_liter),
                diesel_price_per_liter = VALUES(diesel_price_per_liter),
                default_autonomy = VALUES(default_autonomy),
                base_location = COALESCE(VALUES(base_location), base_location),
                roles = COALESCE(VALUES(roles), roles)
        ");
        $stmt->execute([
            ':comp'  => $companyName,
            ':gas'   => $gasolinePrice,
            ':die'   => $dieselPrice,
            ':auto'  => $defaultAutonomy,
            ':base'  => $baseLocationJson,
            ':roles' => $rolesJson
        ]);
    }

    logAudit('UPDATE_SETTINGS', 'CONFIG', '1', "Configurações da empresa/sede atualizadas por {$user['name']}.", $user['id'], $user['name']);
    bumpSyncVersion("settings");

    jsonResponse(['success' => true, 'message' => 'Configurações atualizadas com sucesso!']);
}

jsonResponse(['error' => 'Método não suportado.'], 405);

