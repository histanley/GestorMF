<?php
// ==============================================================================
// GestorMF API - Configurações Gerais da Empresa & Base (com Auditoria)
// ==============================================================================
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();

// Garante colunas de contato e identidade da empresa na tabela settings
ensureSettingsColumnsExist($db);

function ensureSettingsColumnsExist($db) {
    static $ensured = false;
    if ($ensured) return;
    $ensured = true;

    $settingsCols = [
        'company_name2'          => 'VARCHAR(150) NULL',
        'tagline'                => 'VARCHAR(255) NULL',
        'phone'                  => 'VARCHAR(50) NULL',
        'email'                  => 'VARCHAR(150) NULL',
        'website'                => 'VARCHAR(255) NULL',
        'cnpj'                   => 'VARCHAR(50) NULL',
        'electric_price_per_kwh' => 'DECIMAL(6,2) DEFAULT 0.95',
        'default_autonomy'       => 'DECIMAL(6,2) DEFAULT 10.00',
        'roles'                  => 'LONGTEXT NULL',
        'accent_color'           => 'VARCHAR(30) NULL',
        'logo_url'               => 'LONGTEXT NULL',
        'companies'              => 'LONGTEXT NULL',
        'mission_statuses'       => 'LONGTEXT NULL',
        'edition_statuses'       => 'LONGTEXT NULL',
        'vehicle_types'          => 'LONGTEXT NULL'
    ];

    $existingCols = [];
    try {
        $stmt = $db->query("SHOW COLUMNS FROM settings");
        if ($stmt) {
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $existingCols[strtolower($row['Field'])] = true;
            }
        }
    } catch (Exception $e) {}

    foreach ($settingsCols as $col => $def) {
        if (!isset($existingCols[strtolower($col)])) {
            try {
                $db->exec("ALTER TABLE settings ADD COLUMN {$col} {$def}");
            } catch (Exception $e) {}
        }
    }
}

// OBTER CONFIGURAÇÕES (GET)
if ($method === 'GET') {
    $user = requireAuth();
    $stmt = $db->query("SELECT * FROM settings WHERE id = 1");
    $s = $stmt->fetch();

    if (!$s) {
        // Se ainda não existir, inicializa padrão completo
        jsonResponse([
            'success' => true,
            'settings' => [
                'companyName'           => 'MegaFilmes & Mega Print',
                'companyName2'          => 'Mega Print',
                'tagline'               => 'Sistema de Agendas, Equipes e Viaturas',
                'phone'                 => '(95) 99999-9999',
                'email'                 => 'contato@megafilmes.com.br',
                'website'               => 'https://megafilmes.com.br',
                'cnpj'                  => '00.000.000/0001-00',
                'fuelPricePerLiter'     => 6.45,
                'gasolinePricePerLiter' => 6.45,
                'dieselPricePerLiter'   => 6.89,
                'electricPricePerKwh'   => 0.95,
                'defaultAutonomy'       => 10.0,
                'baseLocation' => [
                    'name'    => 'Sede MegaFilmes & Mega Print',
                    'address' => 'R. Sardinha, 1061 - Tancredo Neves, Boa Vista - RR, 69314-117',
                    'lat'     => 2.8293822995808733,
                    'lon'     => -60.730887232802566,
                ]
            ],
            'roles' => []
        ]);
    }

    $baseLocation = !empty($s['base_location']) ? json_decode($s['base_location'], true) : [
        'name'    => 'Sede MegaFilmes & Mega Print',
        'address' => 'R. Sardinha, 1061 - Tancredo Neves, Boa Vista - RR, 69314-117',
        'lat'     => 2.8293822995808733,
        'lon'     => -60.730887232802566,
    ];

    // DB-05: Normaliza coordenadas legadas apenas na resposta (GET estritamente somente leitura)
    if (isset($baseLocation['lat']) && abs($baseLocation['lat'] - 2.825358) < 0.0002) {
        $baseLocation['lat'] = 2.8293822995808733;
        $baseLocation['lon'] = -60.730887232802566;
    }

    $roles = !empty($s['roles']) ? json_decode($s['roles'], true) : [];

    jsonResponse([
        'success' => true,
        'settings' => [
            'companyName'           => !empty($s['company_name']) ? $s['company_name'] : 'MegaFilmes & Mega Print',
            'companyName2'          => !empty($s['company_name2']) ? $s['company_name2'] : 'Mega Print',
            'tagline'               => !empty($s['tagline']) ? $s['tagline'] : 'Sistema de Agendas, Equipes e Viaturas',
            'phone'                 => !empty($s['phone']) ? $s['phone'] : '(95) 99999-9999',
            'email'                 => !empty($s['email']) ? $s['email'] : 'contato@megafilmes.com.br',
            'website'               => !empty($s['website']) ? $s['website'] : 'https://megafilmes.com.br',
            'cnpj'                  => !empty($s['cnpj']) ? $s['cnpj'] : '00.000.000/0001-00',
            'fuelPricePerLiter'     => (float)($s['fuel_price_per_liter'] ?? 6.45),
            'gasolinePricePerLiter' => (float)($s['gasoline_price_per_liter'] ?? ($s['fuel_price_per_liter'] ?? 6.45)),
            'dieselPricePerLiter'   => (float)($s['diesel_price_per_liter'] ?? 6.89),
            'electricPricePerKwh'   => isset($s['electric_price_per_kwh']) ? (float)$s['electric_price_per_kwh'] : 0.95,
            'defaultAutonomy'       => isset($s['default_autonomy']) ? (float)$s['default_autonomy'] : 10.0,
            'baseLocation'          => $baseLocation,
            'accentColor'           => !empty($s['accent_color']) ? $s['accent_color'] : '#f59e0b',
            'logoUrl'               => $s['logo_url'] ?? '',
            'companies'             => !empty($s['companies']) ? json_decode($s['companies'], true) : null,
            'missionStatuses'       => !empty($s['mission_statuses']) ? json_decode($s['mission_statuses'], true) : null,
            'editionStatuses'       => !empty($s['edition_statuses']) ? json_decode($s['edition_statuses'], true) : null,
            'vehicleTypes'          => !empty($s['vehicle_types']) ? json_decode($s['vehicle_types'], true) : null,
            'updatedAt'             => $s['updated_at'] ?? date('Y-m-d H:i:s')
        ],
        'roles' => $roles
    ]);
}

// ATUALIZAR CONFIGURAÇÕES (POST / PUT - ADMIN & MANAGER)
if ($method === 'POST' || $method === 'PUT') {
    $user = requireAuth(['ADMIN', 'MANAGER']);
    $data = getJsonInput();

    $settingsData = $data['settings'] ?? $data;
    $rolesData = $data['roles'] ?? null;

    $currentSettingsStmt = $db->query("SELECT * FROM settings WHERE id = 1");
    $currentSettings = $currentSettingsStmt ? $currentSettingsStmt->fetch() : null;

    $companyName = trim($settingsData['companyName'] ?? ($currentSettings['company_name'] ?? 'MegaFilmes & Mega Print'));
    $companyName2 = trim($settingsData['companyName2'] ?? ($currentSettings['company_name2'] ?? 'Mega Print'));
    $tagline = trim($settingsData['tagline'] ?? ($currentSettings['tagline'] ?? 'Sistema de Agendas, Equipes e Viaturas'));
    $phone = trim($settingsData['phone'] ?? ($currentSettings['phone'] ?? '(95) 99999-9999'));
    $email = trim($settingsData['email'] ?? ($currentSettings['email'] ?? 'contato@megafilmes.com.br'));
    $website = trim($settingsData['website'] ?? ($currentSettings['website'] ?? 'https://megafilmes.com.br'));
    $cnpj = trim($settingsData['cnpj'] ?? ($currentSettings['cnpj'] ?? '00.000.000/0001-00'));
    $gasolinePrice = (float)($settingsData['gasolinePricePerLiter'] ?? ($settingsData['fuelPricePerLiter'] ?? ($currentSettings['gasoline_price_per_liter'] ?? 6.45)));
    $dieselPrice = (float)($settingsData['dieselPricePerLiter'] ?? ($currentSettings['diesel_price_per_liter'] ?? 6.89));
    $electricPrice = (float)($settingsData['electricPricePerKwh'] ?? ($currentSettings['electric_price_per_kwh'] ?? 0.95));
    $defaultAutonomy = (float)($settingsData['defaultAutonomy'] ?? ($currentSettings['default_autonomy'] ?? 10.0));
    $accentColor = trim($settingsData['accentColor'] ?? ($currentSettings['accent_color'] ?? '#f59e0b'));
    $logoUrl = $settingsData['logoUrl'] ?? ($currentSettings['logo_url'] ?? null);

    $baseLocationJson = !empty($settingsData['baseLocation']) 
        ? json_encode($settingsData['baseLocation'], JSON_UNESCAPED_UNICODE) 
        : (!empty($currentSettings['base_location']) ? $currentSettings['base_location'] : null);

    $companiesJson = !empty($settingsData['companies']) && is_array($settingsData['companies'])
        ? json_encode($settingsData['companies'], JSON_UNESCAPED_UNICODE)
        : ($currentSettings['companies'] ?? null);

    $missionStatusesJson = !empty($settingsData['missionStatuses']) && is_array($settingsData['missionStatuses'])
        ? json_encode($settingsData['missionStatuses'], JSON_UNESCAPED_UNICODE)
        : ($currentSettings['mission_statuses'] ?? null);

    $editionStatusesJson = !empty($settingsData['editionStatuses']) && is_array($settingsData['editionStatuses'])
        ? json_encode($settingsData['editionStatuses'], JSON_UNESCAPED_UNICODE)
        : ($currentSettings['edition_statuses'] ?? null);

    $vehicleTypesJson = !empty($settingsData['vehicleTypes']) && is_array($settingsData['vehicleTypes'])
        ? json_encode($settingsData['vehicleTypes'], JSON_UNESCAPED_UNICODE)
        : ($currentSettings['vehicle_types'] ?? null);

    // Processamento e sanitização segura da lista de funções (roles)
    $rolesJson = null;
    if ($rolesData !== null && is_array($rolesData)) {
        $cleanRoles = array_values(array_filter(array_map('trim', $rolesData), function($r) {
            return $r !== '';
        }));
        $rolesJson = json_encode($cleanRoles, JSON_UNESCAPED_UNICODE);
    }
    $effectiveRoles = $rolesJson !== null ? $rolesJson : (!empty($currentSettings['roles']) ? $currentSettings['roles'] : '[]');

    $stmt = $db->prepare("
        INSERT INTO settings (
            id, company_name, company_name2, tagline, phone, email, website, cnpj,
            fuel_price_per_liter, gasoline_price_per_liter, diesel_price_per_liter,
            electric_price_per_kwh, default_autonomy, base_location, roles,
            accent_color, logo_url, companies, mission_statuses, edition_statuses, vehicle_types
        )
        VALUES (
            1, :comp, :comp2, :tagline, :phone, :email, :website, :cnpj,
            :fuel, :gas, :die,
            :elec, :auto, :base, :roles,
            :accent, :logo, :companies, :mis_stat, :edit_stat, :veh_types
        )
        ON DUPLICATE KEY UPDATE
            company_name = VALUES(company_name),
            company_name2 = VALUES(company_name2),
            tagline = VALUES(tagline),
            phone = VALUES(phone),
            email = VALUES(email),
            website = VALUES(website),
            cnpj = VALUES(cnpj),
            fuel_price_per_liter = VALUES(fuel_price_per_liter),
            gasoline_price_per_liter = VALUES(gasoline_price_per_liter),
            diesel_price_per_liter = VALUES(diesel_price_per_liter),
            electric_price_per_kwh = VALUES(electric_price_per_kwh),
            default_autonomy = VALUES(default_autonomy),
            base_location = COALESCE(VALUES(base_location), base_location),
            roles = VALUES(roles),
            accent_color = VALUES(accent_color),
            logo_url = VALUES(logo_url),
            companies = VALUES(companies),
            mission_statuses = VALUES(mission_statuses),
            edition_statuses = VALUES(edition_statuses),
            vehicle_types = VALUES(vehicle_types)
    ");
    $stmt->execute([
        ':comp'       => $companyName,
        ':comp2'      => $companyName2,
        ':tagline'    => $tagline,
        ':phone'      => $phone,
        ':email'      => $email,
        ':website'    => $website,
        ':cnpj'       => $cnpj,
        ':fuel'       => $gasolinePrice,
        ':gas'        => $gasolinePrice,
        ':die'        => $dieselPrice,
        ':elec'       => $electricPrice,
        ':auto'       => $defaultAutonomy,
        ':base'       => $baseLocationJson,
        ':roles'      => $effectiveRoles,
        ':accent'     => $accentColor,
        ':logo'       => $logoUrl,
        ':companies'  => $companiesJson,
        ':mis_stat'   => $missionStatusesJson,
        ':edit_stat'  => $editionStatusesJson,
        ':veh_types'  => $vehicleTypesJson
    ]);

    logAudit('UPDATE_SETTINGS', 'CONFIG', '1', "Configurações da empresa/sede e dados de contato atualizados por {$user['name']}.", $user['id'], $user['name']);
    bumpSyncVersion("settings");

    jsonResponse(['success' => true, 'message' => 'Configurações atualizadas com sucesso!']);
}

jsonResponse(['error' => 'Método não suportado.'], 405);


