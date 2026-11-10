<?php
// ==============================================================================
// GestorMF - Criação de Estrutura do Banco de Dados (Schema)
// ==============================================================================

function runDatabaseInstallation($db) {
    // 1. Sincronização
    $db->exec("
        CREATE TABLE IF NOT EXISTS system_sync (
            id INT PRIMARY KEY,
            version INT NOT NULL DEFAULT 1,
            last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    $db->exec("
        INSERT INTO system_sync (id, version) VALUES (1, 1)
        ON DUPLICATE KEY UPDATE id=1;
    ");

    // 2. Usuários
    $db->exec("
        CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(64) PRIMARY KEY,
            name VARCHAR(150) NOT NULL,
            email VARCHAR(191) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            role ENUM('ADMIN', 'MANAGER', 'USER') NOT NULL DEFAULT 'USER',
            title VARCHAR(150) NULL,
            department VARCHAR(150) NULL,
            phone VARCHAR(50) NULL,
            avatar MEDIUMTEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_user_role (role)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    // Seed inicial seguro caso o administrador padrão não exista
    $secrets = function_exists('loadAppSecrets') ? loadAppSecrets() : [];
    $defaultAdminPass = $secrets['DEFAULT_ADMIN_PASSWORD'] ?? null;

    if (!empty($defaultAdminPass)) {
        $adminEmail = $secrets['ADMIN_EMAIL'] ?? 'admin@gestormf.shop';
        $adminName = $secrets['ADMIN_NAME'] ?? 'Administrador Geral';
        $adminHash = password_hash($defaultAdminPass, PASSWORD_BCRYPT, ['cost' => 11]);

        $stmt = $db->prepare("SELECT id FROM users WHERE email = ?");
        $stmt->execute([$adminEmail]);
        if (!$stmt->fetch()) {
            $stmtInsert = $db->prepare("
                INSERT INTO users (id, name, email, password_hash, role, title, department, phone, avatar)
                VALUES (?, ?, ?, ?, 'ADMIN', 'Administrador Geral & TI', 'Diretoria Executiva', '', NULL)
            ");
            $stmtInsert->execute(['usr-admin-initial', $adminName, $adminEmail, $adminHash]);
        }
    }

    // 3. Configurações
    $db->exec("
        CREATE TABLE IF NOT EXISTS settings (
            id INT PRIMARY KEY,
            company_name VARCHAR(150) NOT NULL DEFAULT 'MegaFilmes & Mega Print',
            fuel_price_per_liter DECIMAL(8,2) NOT NULL DEFAULT 6.45,
            gasoline_price_per_liter DECIMAL(8,2) NOT NULL DEFAULT 6.45,
            diesel_price_per_liter DECIMAL(8,2) NOT NULL DEFAULT 6.89,
            electric_price_per_kwh DECIMAL(8,2) NOT NULL DEFAULT 0.95,
            base_location LONGTEXT NULL,
            roles LONGTEXT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    $defaultBaseLocation = json_encode([
        'name' => 'Sede MegaFilmes & Mega Print',
        'address' => 'R. Sardinha, 1061 - Tancredo Neves, Boa Vista - RR, 69314-117',
        'lat' => 2.8293822995808733,
        'lon' => -60.730887232802566,
    ], JSON_UNESCAPED_UNICODE);

    $defaultRoles = json_encode([
        'Diretor(a) de Cena',
        'Cinegrafista / Câmera',
        'Piloto de Drone',
        'Fotógrafo(a)',
        'Editor de Vídeo',
        'Técnico de Instalação (Mega Print)',
        'Motorista / Produção',
        'Assistente Geral',
        'Designer Gráfico (Mega Print)',
        'Operador de Áudio'
    ], JSON_UNESCAPED_UNICODE);

    $stmtSet = $db->prepare("
        INSERT INTO settings (id, company_name, fuel_price_per_liter, gasoline_price_per_liter, diesel_price_per_liter, base_location, roles)
        VALUES (1, 'MegaFilmes & Mega Print', 6.45, 6.45, 6.89, ?, ?)
        ON DUPLICATE KEY UPDATE id=1;
    ");
    $stmtSet->execute([$defaultBaseLocation, $defaultRoles]);

    // 4. Viaturas
    $db->exec("
        CREATE TABLE IF NOT EXISTS vehicles (
            id VARCHAR(64) PRIMARY KEY,
            name VARCHAR(150) NOT NULL,
            plate VARCHAR(20) NOT NULL,
            company VARCHAR(100) NOT NULL DEFAULT 'MegaFilmes',
            type VARCHAR(100) NULL,
            fuel_type VARCHAR(50) NOT NULL DEFAULT 'Gasolina',
            autonomy_km_per_liter DECIMAL(6,2) NOT NULL DEFAULT 10.0,
            tank_capacity DECIMAL(6,2) NOT NULL DEFAULT 50.0,
            current_fuel_percent DECIMAL(5,2) NOT NULL DEFAULT 100.0,
            current_km INT NOT NULL DEFAULT 0,
            status VARCHAR(50) NOT NULL DEFAULT 'Disponível',
            fuel_logs LONGTEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_veh_plate (plate),
            INDEX idx_veh_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    // 5. Membros
    $db->exec("
        CREATE TABLE IF NOT EXISTS members (
            id VARCHAR(64) PRIMARY KEY,
            name VARCHAR(150) NOT NULL,
            role VARCHAR(120) NOT NULL,
            company VARCHAR(100) NOT NULL DEFAULT 'MegaFilmes',
            phone VARCHAR(50) NULL,
            photo_url LONGTEXT NULL,
            user_id VARCHAR(64) NULL,
            can_drive TINYINT(1) NOT NULL DEFAULT 0,
            cnh_category VARCHAR(10) NULL DEFAULT 'B',
            active TINYINT(1) NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_mem_active (active),
            INDEX idx_mem_drive (can_drive),
            UNIQUE KEY uq_mem_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    // Migração de colunas de CNH / Condução e Vínculo de Usuário na tabela members
    try {
        $db->exec("ALTER TABLE members ADD COLUMN can_drive TINYINT(1) NOT NULL DEFAULT 0");
    } catch (Exception $e) {}
    try {
        $db->exec("ALTER TABLE members ADD COLUMN cnh_category VARCHAR(10) NULL DEFAULT 'B'");
    } catch (Exception $e) {}
    try {
        $db->exec("ALTER TABLE members ADD COLUMN user_id VARCHAR(64) NULL");
    } catch (Exception $e) {}
    try {
        $db->exec("ALTER TABLE members ADD UNIQUE KEY uq_mem_user (user_id)");
    } catch (Exception $e) {}

    // 6. Missões
    $db->exec("
        CREATE TABLE IF NOT EXISTS missions (
            id VARCHAR(64) PRIMARY KEY,
            code VARCHAR(50) NULL,
            description VARCHAR(255) NOT NULL,
            location_name VARCHAR(255) NULL,
            address VARCHAR(255) NULL,
            lat DECIMAL(10,7) NULL,
            lon DECIMAL(10,7) NULL,
            date DATE NOT NULL,
            departure_time VARCHAR(10) NULL,
            arrival_time_estimated VARCHAR(10) NULL,
            return_time_estimated VARCHAR(10) NULL,
            vehicle_id VARCHAR(64) NULL,
            vehicle_name_display VARCHAR(150) NULL,
            vehicle_allocations LONGTEXT NULL,
            driver_id VARCHAR(64) NULL,
            driver_name VARCHAR(150) NULL,
            team_ids LONGTEXT NULL,
            team_names_display VARCHAR(255) NULL,
            edition_status VARCHAR(50) DEFAULT 'Pendente',
            mission_status VARCHAR(50) DEFAULT 'Agendada',
            is_round_trip TINYINT(1) DEFAULT 1,
            distance_km DECIMAL(8,2) DEFAULT 0.00,
            total_distance_km DECIMAL(8,2) DEFAULT 0.00,
            driving_duration_minutes INT DEFAULT 0,
            round_trip_duration_minutes INT DEFAULT 0,
            estimated_fuel_liters DECIMAL(8,2) DEFAULT 0.00,
            estimated_fuel_cost DECIMAL(8,2) DEFAULT 0.00,
            route_coordinates LONGTEXT NULL,
            return_coordinates LONGTEXT NULL,
            notes TEXT NULL,
            is_recurring TINYINT(1) DEFAULT 0,
            recurrence_id VARCHAR(64) NULL,
            recurrence_rule VARCHAR(255) NULL,
            recurrence_days VARCHAR(100) NULL,
            created_by VARCHAR(64) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_mis_date (date),
            INDEX idx_mis_status (mission_status),
            INDEX idx_mis_recurrence (recurrence_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    // Auto-migração exaustiva: Todas as colunas da tabela missions para compatibilidade com qualquer versão do banco
    $missionCols = [
        'code'                        => 'VARCHAR(50) NULL',
        'description'                 => 'VARCHAR(255) NOT NULL',
        'location_name'               => 'VARCHAR(255) NULL',
        'address'                     => 'VARCHAR(255) NULL',
        'lat'                         => 'DECIMAL(10,7) NULL',
        'lon'                         => 'DECIMAL(10,7) NULL',
        'date'                        => 'DATE NOT NULL',
        'departure_time'              => 'VARCHAR(10) NULL',
        'arrival_time_estimated'      => 'VARCHAR(10) NULL',
        'return_time_estimated'       => 'VARCHAR(10) NULL',
        'vehicle_id'                  => 'VARCHAR(64) NULL',
        'vehicle_name_display'        => 'VARCHAR(150) NULL',
        'vehicle_allocations'         => 'LONGTEXT NULL',
        'driver_id'                   => 'VARCHAR(64) NULL',
        'driver_name'                 => 'VARCHAR(150) NULL',
        'team_ids'                    => 'LONGTEXT NULL',
        'team_names_display'          => 'VARCHAR(255) NULL',
        'editor_id'                   => 'VARCHAR(64) NULL',
        'editor_name'                 => 'VARCHAR(150) NULL',
        'editor_ids'                  => 'LONGTEXT NULL',
        'editor_names_display'        => 'VARCHAR(255) NULL',
        'delivery_deadline_date'      => 'VARCHAR(20) NULL',
        'delivery_deadline_time'      => 'VARCHAR(10) NULL',
        'edition_completed_at'        => 'VARCHAR(35) NULL',
        'edition_completed_by'        => 'VARCHAR(150) NULL',
        'is_overdue'                  => 'TINYINT(1) DEFAULT 0',
        'edition_delivery_status'     => 'VARCHAR(30) NULL',
        'server_file_path'            => 'VARCHAR(500) NULL',
        'reopen_reason'               => 'TEXT NULL',
        'edition_history'             => 'LONGTEXT NULL',
        'edition_status'              => "VARCHAR(50) DEFAULT 'Pendente'",
        'mission_status'              => "VARCHAR(50) DEFAULT 'Agendada'",
        'is_round_trip'               => 'TINYINT(1) DEFAULT 1',
        'distance_km'                 => 'DECIMAL(8,2) DEFAULT 0.00',
        'total_distance_km'           => 'DECIMAL(8,2) DEFAULT 0.00',
        'driving_duration_minutes'    => 'INT DEFAULT 0',
        'round_trip_duration_minutes' => 'INT DEFAULT 0',
        'estimated_fuel_liters'       => 'DECIMAL(8,2) DEFAULT 0.00',
        'estimated_fuel_cost'         => 'DECIMAL(8,2) DEFAULT 0.00',
        'route_coordinates'           => 'LONGTEXT NULL',
        'return_coordinates'          => 'LONGTEXT NULL',
        'notes'                       => 'TEXT NULL',
        'is_recurring'                => 'TINYINT(1) DEFAULT 0',
        'recurrence_id'               => 'VARCHAR(64) NULL',
        'recurrence_rule'             => 'VARCHAR(255) NULL',
        'recurrence_days'             => 'VARCHAR(100) NULL',
        'created_by'                  => 'VARCHAR(64) NULL',
        'version'                     => 'INT NOT NULL DEFAULT 1'
    ];
    foreach ($missionCols as $cName => $cDef) {
        try {
            $db->exec("ALTER TABLE missions ADD COLUMN {$cName} {$cDef}");
        } catch (Exception $e) {}
    }
    try {
        $db->exec("UPDATE missions SET version = 1 WHERE version IS NULL OR version = 0");
    } catch (Exception $e) {}

    // 7. Auditoria
    $db->exec("
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id VARCHAR(64) NOT NULL,
            user_name VARCHAR(150) NOT NULL,
            action VARCHAR(50) NOT NULL,
            module VARCHAR(50) NOT NULL,
            entity_id VARCHAR(64) NULL,
            details LONGTEXT NULL,
            ip_address VARCHAR(45) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_audit_module (module),
            INDEX idx_audit_user (user_id),
            INDEX idx_audit_date (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    // 8. GPS
    $db->exec("
        CREATE TABLE IF NOT EXISTS gps_locations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            member_id VARCHAR(64) NOT NULL,
            member_name VARCHAR(150) NOT NULL,
            mission_id VARCHAR(64) NULL,
            lat DECIMAL(10,7) NOT NULL,
            lon DECIMAL(10,7) NOT NULL,
            speed DECIMAL(6,2) NULL DEFAULT 0.0,
            heading DECIMAL(6,2) NULL DEFAULT 0.0,
            accuracy DECIMAL(6,2) NULL DEFAULT 0.0,
            battery_percent INT NULL,
            captured_at TIMESTAMP NULL,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_gps_mission (mission_id),
            INDEX idx_gps_active (is_active),
            INDEX idx_gps_member (member_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    try {
        $db->exec("ALTER TABLE gps_locations ADD COLUMN captured_at TIMESTAMP NULL AFTER battery_percent");
    } catch (Exception $e) {}

    // 9. Inscrições de Web Push (P1-06)
    $db->exec("
        CREATE TABLE IF NOT EXISTS push_subscriptions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id VARCHAR(64) NOT NULL,
            endpoint TEXT NOT NULL,
            p256dh VARCHAR(255) NULL,
            auth VARCHAR(255) NULL,
            user_agent VARCHAR(255) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_push_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    // 10. Mensagens Internas & Comunicados Operacionais
    $db->exec("
        CREATE TABLE IF NOT EXISTS system_messages (
            id VARCHAR(64) PRIMARY KEY,
            sender_id VARCHAR(64) NOT NULL,
            sender_name VARCHAR(150) NOT NULL,
            sender_role VARCHAR(50) NOT NULL,
            recipient_type ENUM('ALL', 'INDIVIDUAL') NOT NULL DEFAULT 'ALL',
            recipient_id VARCHAR(64) NULL,
            recipient_user_id VARCHAR(64) NULL,
            recipient_name VARCHAR(150) NULL,
            title VARCHAR(200) NOT NULL,
            message TEXT NOT NULL,
            priority ENUM('NORMAL', 'HIGH', 'URGENT') NOT NULL DEFAULT 'NORMAL',
            read_by JSON NULL,
            dismissed_by JSON NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_msg_sender (sender_id),
            INDEX idx_msg_recipient (recipient_id),
            INDEX idx_msg_rec_user (recipient_user_id),
            INDEX idx_msg_type (recipient_type),
            INDEX idx_msg_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    try {
        $db->exec("ALTER TABLE system_messages ADD COLUMN recipient_user_id VARCHAR(64) NULL AFTER recipient_id");
    } catch (Exception $e) {}
    try {
        $db->exec("ALTER TABLE system_messages ADD COLUMN dismissed_by JSON NULL AFTER read_by");
    } catch (Exception $e) {}
}

