<?php
// ==============================================================================
// GestorMF API - Sistema de Aluguel e Estoque de Equipamentos (MegaFilmes)
// ==============================================================================
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();

// 1. Garantir tabelas de Aluguel e Equipamentos
function ensureRentalsTables($db)
{
    $db->exec("
        CREATE TABLE IF NOT EXISTS equipment (
            id VARCHAR(64) PRIMARY KEY,
            name VARCHAR(191) NOT NULL,
            category VARCHAR(64) NOT NULL,
            daily_rate DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
            rate_unit VARCHAR(32) NOT NULL DEFAULT 'diária',
            total_qty INT NOT NULL DEFAULT 1,
            available_qty INT NOT NULL DEFAULT 1,
            serial_number VARCHAR(191) NULL DEFAULT '',
            photo_url LONGTEXT NULL,
            description TEXT NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'available',
            asset_value DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_equip_cat (category),
            INDEX idx_equip_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    try {
        $db->exec("ALTER TABLE equipment ADD COLUMN photo_url LONGTEXT NULL");
    } catch (Exception $e) {
    }
    try {
        $db->exec("ALTER TABLE equipment MODIFY photo_url LONGTEXT NULL");
    } catch (Exception $e) {
    }
    try {
        $db->exec("ALTER TABLE equipment ADD COLUMN asset_value DECIMAL(10, 2) NOT NULL DEFAULT 0.00");
    } catch (Exception $e) {
    }
    try {
        $db->exec("ALTER TABLE equipment ADD COLUMN maintenance_qty INT NOT NULL DEFAULT 0");
    } catch (Exception $e) {
    }
    try {
        $db->exec("ALTER TABLE equipment ADD COLUMN maintenance_notes TEXT NULL");
    } catch (Exception $e) {
    }
    try {
        $db->exec("ALTER TABLE rentals ADD COLUMN auth_signature VARCHAR(64) NULL");
    } catch (Exception $e) {
    }

    $db->exec("
        CREATE TABLE IF NOT EXISTS rentals (
            id VARCHAR(64) PRIMARY KEY,
            code VARCHAR(32) NOT NULL UNIQUE,
            client_name VARCHAR(191) NOT NULL,
            client_document VARCHAR(64) NULL DEFAULT '',
            client_phone VARCHAR(64) NULL DEFAULT '',
            client_email VARCHAR(191) NULL DEFAULT '',
            client_address TEXT NULL,
            start_date DATE NOT NULL,
            start_time VARCHAR(10) DEFAULT '08:00',
            end_date DATE NOT NULL,
            end_time VARCHAR(10) DEFAULT '18:00',
            total_days INT NOT NULL DEFAULT 1,
            subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
            discount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
            total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
            payment_method VARCHAR(64) DEFAULT 'PIX',
            payment_status VARCHAR(32) DEFAULT 'Pendente',
            status VARCHAR(32) DEFAULT 'active',
            notes TEXT NULL,
            items_json LONGTEXT NOT NULL,
            pickup_photos_json LONGTEXT NULL,
            return_photos_json LONGTEXT NULL,
            pickup_notes TEXT NULL,
            inspection_notes TEXT NULL,
            has_damage TINYINT(1) NOT NULL DEFAULT 0,
            paid_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
            remaining_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
            remaining_due_terms VARCHAR(191) NULL DEFAULT '',
            remaining_due_date DATE NULL,
            security_deposit DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
            created_by VARCHAR(150) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            returned_at TIMESTAMP NULL,
            return_notes TEXT NULL,
            INDEX idx_rent_status (status),
            INDEX idx_rent_client (client_name),
            INDEX idx_rent_dates (start_date, end_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    try {
        $db->exec("ALTER TABLE rentals ADD COLUMN pickup_photos_json LONGTEXT NULL");
    } catch (Exception $e) {
    }
    try {
        $db->exec("ALTER TABLE rentals ADD COLUMN return_photos_json LONGTEXT NULL");
    } catch (Exception $e) {
    }
    try {
        $db->exec("ALTER TABLE rentals ADD COLUMN pickup_notes TEXT NULL");
    } catch (Exception $e) {
    }
    try {
        $db->exec("ALTER TABLE rentals ADD COLUMN inspection_notes TEXT NULL");
    } catch (Exception $e) {
    }
    try {
        $db->exec("ALTER TABLE rentals ADD COLUMN has_damage TINYINT(1) NOT NULL DEFAULT 0");
    } catch (Exception $e) {
    }
    try {
        $db->exec("ALTER TABLE rentals ADD COLUMN paid_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00");
    } catch (Exception $e) {
    }
    try {
        $db->exec("ALTER TABLE rentals ADD COLUMN remaining_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00");
    } catch (Exception $e) {
    }
    try {
        $db->exec("ALTER TABLE rentals ADD COLUMN remaining_due_terms VARCHAR(191) NULL DEFAULT ''");
    } catch (Exception $e) {
    }
    try {
        $db->exec("ALTER TABLE rentals ADD COLUMN remaining_due_date DATE NULL");
    } catch (Exception $e) {
    }
    try {
        $db->exec("ALTER TABLE rentals ADD COLUMN security_deposit DECIMAL(10, 2) NOT NULL DEFAULT 0.00");
    } catch (Exception $e) {
    }
    try {
        $db->exec("ALTER TABLE rentals ADD COLUMN sent_to_maintenance TINYINT(1) NOT NULL DEFAULT 0");
    } catch (Exception $e) {
    }
    try {
        $db->exec("ALTER TABLE rentals ADD COLUMN maintenance_items_json LONGTEXT NULL");
    } catch (Exception $e) {
    }

    // 1.1 Tabela de migrações internas
    $db->exec("
        CREATE TABLE IF NOT EXISTS system_migrations (
            migration_key VARCHAR(191) PRIMARY KEY,
            executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");

    $calibratedCatalog = [
        ['id' => 'eq-001', 'name' => 'Sony a7III', 'category' => 'cameras', 'daily_rate' => 300, 'asset_value' => 8900, 'total_qty' => 8, 'rate_unit' => 'diária'],
        ['id' => 'eq-002', 'name' => 'Sony Fx30', 'category' => 'cameras', 'daily_rate' => 400, 'asset_value' => 10800, 'total_qty' => 6, 'rate_unit' => 'diária'],
        ['id' => 'eq-003', 'name' => 'Sony a7IV', 'category' => 'cameras', 'daily_rate' => 400, 'asset_value' => 13900, 'total_qty' => 3, 'rate_unit' => 'diária'],
        ['id' => 'eq-004', 'name' => 'Sony 6600', 'category' => 'cameras', 'daily_rate' => 200, 'asset_value' => 5400, 'total_qty' => 1, 'rate_unit' => 'diária'],
        ['id' => 'eq-005', 'name' => 'Canon eos RP', 'category' => 'cameras', 'daily_rate' => 200, 'asset_value' => 4700, 'total_qty' => 1, 'rate_unit' => 'diária'],
        ['id' => 'eq-006', 'name' => 'Canon eos 5D mark III', 'category' => 'cameras', 'daily_rate' => 100, 'asset_value' => 2800, 'total_qty' => 1, 'rate_unit' => 'diária'],
        ['id' => 'eq-007', 'name' => 'Sony HXR- NX5', 'category' => 'cameras', 'daily_rate' => 300, 'asset_value' => 3200, 'total_qty' => 4, 'rate_unit' => 'diária'],
        ['id' => 'eq-008', 'name' => 'Sony NX5 R', 'category' => 'cameras', 'daily_rate' => 300, 'asset_value' => 3600, 'total_qty' => 3, 'rate_unit' => 'diária'],
        ['id' => 'eq-009', 'name' => 'Sony PMW- EX3', 'category' => 'cameras', 'daily_rate' => 300, 'asset_value' => 3900, 'total_qty' => 1, 'rate_unit' => 'diária'],
        ['id' => 'eq-010', 'name' => 'Sony HXR- NX3', 'category' => 'cameras', 'daily_rate' => 300, 'asset_value' => 3400, 'total_qty' => 2, 'rate_unit' => 'diária'],
        ['id' => 'eq-011', 'name' => 'Sony PMW- EX1', 'category' => 'cameras', 'daily_rate' => 300, 'asset_value' => 3500, 'total_qty' => 1, 'rate_unit' => 'diária'],
        ['id' => 'eq-012', 'name' => 'GoPro 11 Black', 'category' => 'cameras', 'daily_rate' => 180, 'asset_value' => 1950, 'total_qty' => 1, 'rate_unit' => 'diária'],
        ['id' => 'eq-013', 'name' => 'GoPro 360', 'category' => 'cameras', 'daily_rate' => 400, 'asset_value' => 2450, 'total_qty' => 1, 'rate_unit' => 'diária'],
        ['id' => 'eq-014', 'name' => 'GoPro 8 Black', 'category' => 'cameras', 'daily_rate' => 150, 'asset_value' => 1150, 'total_qty' => 1, 'rate_unit' => 'diária'],
        ['id' => 'eq-015', 'name' => 'Sony 24/70 f4', 'category' => 'lenses', 'daily_rate' => 200, 'asset_value' => 2700, 'total_qty' => 5, 'rate_unit' => 'diária'],
        ['id' => 'eq-016', 'name' => 'Sony 50mm 1.8', 'category' => 'lenses', 'daily_rate' => 180, 'asset_value' => 1150, 'total_qty' => 4, 'rate_unit' => 'diária'],
        ['id' => 'eq-017', 'name' => 'Sony 35mm 1.8', 'category' => 'lenses', 'daily_rate' => 250, 'asset_value' => 2900, 'total_qty' => 3, 'rate_unit' => 'diária'],
        ['id' => 'eq-018', 'name' => 'Sony 70/200 2.8', 'category' => 'lenses', 'daily_rate' => 350, 'asset_value' => 12000, 'total_qty' => 3, 'rate_unit' => 'diária'],
        ['id' => 'eq-019', 'name' => 'Sony 18/105 f4', 'category' => 'lenses', 'daily_rate' => 200, 'asset_value' => 2500, 'total_qty' => 3, 'rate_unit' => 'diária'],
        ['id' => 'eq-020', 'name' => 'Sony 85mm 1.8', 'category' => 'lenses', 'daily_rate' => 200, 'asset_value' => 2800, 'total_qty' => 2, 'rate_unit' => 'diária'],
        ['id' => 'eq-021', 'name' => 'Sigma 16mm 1.4', 'category' => 'lenses', 'daily_rate' => 200, 'asset_value' => 2100, 'total_qty' => 2, 'rate_unit' => 'diária'],
        ['id' => 'eq-022', 'name' => 'Sony 24/70 2.8', 'category' => 'lenses', 'daily_rate' => 350, 'asset_value' => 9800, 'total_qty' => 1, 'rate_unit' => 'diária'],
        ['id' => 'eq-023', 'name' => 'Canon 24/70 2.8', 'category' => 'lenses', 'daily_rate' => 200, 'asset_value' => 4800, 'total_qty' => 1, 'rate_unit' => 'diária'],
        ['id' => 'eq-024', 'name' => 'Canon 35mm 1.4', 'category' => 'lenses', 'daily_rate' => 150, 'asset_value' => 3900, 'total_qty' => 1, 'rate_unit' => 'diária'],
        ['id' => 'eq-025', 'name' => 'Monitor Feelworld 5.5 POL', 'category' => 'video', 'daily_rate' => 150, 'asset_value' => 950, 'total_qty' => 5, 'rate_unit' => 'diária'],
        ['id' => 'eq-026', 'name' => 'Monitor Feelworld 7.0 POL', 'category' => 'video', 'daily_rate' => 200, 'asset_value' => 1450, 'total_qty' => 4, 'rate_unit' => 'diária'],
        ['id' => 'eq-027', 'name' => 'Transmissor cosmo c1 Hollyland', 'category' => 'video', 'daily_rate' => 300, 'asset_value' => 5100, 'total_qty' => 2, 'rate_unit' => 'diária'],
        ['id' => 'eq-028', 'name' => 'Transmissor mars 300 pro Hollyland', 'category' => 'video', 'daily_rate' => 200, 'asset_value' => 2350, 'total_qty' => 4, 'rate_unit' => 'diária'],
        ['id' => 'eq-029', 'name' => 'Mesa de corte switcher estudio 6+', 'category' => 'video', 'daily_rate' => 400, 'asset_value' => 4800, 'total_qty' => 1, 'rate_unit' => 'diária'],
        ['id' => 'eq-030', 'name' => 'Mesa de corte Blackmagic mini extreme live', 'category' => 'video', 'daily_rate' => 600, 'asset_value' => 6200, 'total_qty' => 1, 'rate_unit' => 'diária'],
        ['id' => 'eq-031', 'name' => 'Mesa de corte Blackmagic Atem mini Pro', 'category' => 'video', 'daily_rate' => 400, 'asset_value' => 2450, 'total_qty' => 1, 'rate_unit' => 'diária'],
        ['id' => 'eq-032', 'name' => 'Mesa de corte Neo iD Estudio 4+', 'category' => 'video', 'daily_rate' => 400, 'asset_value' => 3900, 'total_qty' => 1, 'rate_unit' => 'diária'],
        ['id' => 'eq-033', 'name' => 'Mesa de corte Atem 2 Blackmagic', 'category' => 'video', 'daily_rate' => 1200, 'asset_value' => 13500, 'total_qty' => 1, 'rate_unit' => 'diária'],
        ['id' => 'eq-034', 'name' => 'Placa de captura de videos HDMI', 'category' => 'video', 'daily_rate' => 150, 'asset_value' => 180, 'total_qty' => 5, 'rate_unit' => 'diária'],
        ['id' => 'eq-035', 'name' => 'NEO id tally', 'category' => 'video', 'daily_rate' => 250, 'asset_value' => 2400, 'total_qty' => 1, 'rate_unit' => 'diária'],
        ['id' => 'eq-036', 'name' => 'Teleprompter profissional', 'category' => 'video', 'daily_rate' => 600, 'asset_value' => 2700, 'total_qty' => 2, 'rate_unit' => 'diária'],
        ['id' => 'eq-037', 'name' => 'Teleprompter camera vídeo', 'category' => 'video', 'daily_rate' => 300, 'asset_value' => 950, 'total_qty' => 1, 'rate_unit' => 'diária'],
        ['id' => 'eq-038', 'name' => 'Microfone Takstar para camera', 'category' => 'audio', 'daily_rate' => 50, 'asset_value' => 180, 'total_qty' => 1, 'rate_unit' => 'diária'],
        ['id' => 'eq-039', 'name' => 'Microfone YOGA AT81', 'category' => 'audio', 'daily_rate' => 150, 'asset_value' => 290, 'total_qty' => 1, 'rate_unit' => 'diária'],
        ['id' => 'eq-040', 'name' => 'Microfone Sennheiser Mike 600', 'category' => 'audio', 'daily_rate' => 500, 'asset_value' => 2650, 'total_qty' => 1, 'rate_unit' => 'diária'],
        ['id' => 'eq-041', 'name' => 'Microfone Boya', 'category' => 'audio', 'daily_rate' => 150, 'asset_value' => 220, 'total_qty' => 1, 'rate_unit' => 'diária'],
        ['id' => 'eq-042', 'name' => 'Pricila + capsula BOOM', 'category' => 'audio', 'daily_rate' => 150, 'asset_value' => 780, 'total_qty' => 1, 'rate_unit' => 'diária'],
        ['id' => 'eq-043', 'name' => 'Zoom H5', 'category' => 'audio', 'daily_rate' => 200, 'asset_value' => 1750, 'total_qty' => 3, 'rate_unit' => 'diária'],
        ['id' => 'eq-044', 'name' => 'Mix de Áudio Rode Caster pro', 'category' => 'audio', 'daily_rate' => 400, 'asset_value' => 4500, 'total_qty' => 1, 'rate_unit' => 'diária'],
        ['id' => 'eq-045', 'name' => 'Lapela Hollyland lark m2 duo', 'category' => 'audio', 'daily_rate' => 200, 'asset_value' => 1050, 'total_qty' => 1, 'rate_unit' => 'diária'],
        ['id' => 'eq-046', 'name' => 'Lapela Hollayland Lark M2s', 'category' => 'audio', 'daily_rate' => 250, 'asset_value' => 1200, 'total_qty' => 1, 'rate_unit' => 'diária'],
        ['id' => 'eq-047', 'name' => 'Microfone Hollayland Lark 150 Duplo', 'category' => 'audio', 'daily_rate' => 150, 'asset_value' => 950, 'total_qty' => 1, 'rate_unit' => 'diária'],
        ['id' => 'eq-048', 'name' => 'Mesa de som Digital Soundcraft Ui24R', 'category' => 'audio', 'daily_rate' => 600, 'asset_value' => 5900, 'total_qty' => 2, 'rate_unit' => 'diária'],
        ['id' => 'eq-049', 'name' => 'Caixa de som JBL EON615', 'category' => 'audio', 'daily_rate' => 300, 'asset_value' => 3100, 'total_qty' => 4, 'rate_unit' => 'diária'],
        ['id' => 'eq-050', 'name' => 'Interface de Áudio Usb Behringer 4 canais', 'category' => 'audio', 'daily_rate' => 200, 'asset_value' => 1050, 'total_qty' => 1, 'rate_unit' => 'diária'],
        ['id' => 'eq-051', 'name' => 'Interface de áudio Behringer UMC204HD 2 canais', 'category' => 'audio', 'daily_rate' => 150, 'asset_value' => 750, 'total_qty' => 1, 'rate_unit' => 'diária'],
        ['id' => 'eq-052', 'name' => 'Interface de audio Behriger UM2 USB 1 CANAL', 'category' => 'audio', 'daily_rate' => 100, 'asset_value' => 380, 'total_qty' => 1, 'rate_unit' => 'diária'],
        ['id' => 'eq-053', 'name' => 'LED Soleste 1700 de camera', 'category' => 'lighting', 'daily_rate' => 150, 'asset_value' => 320, 'total_qty' => 3, 'rate_unit' => 'diária'],
        ['id' => 'eq-054', 'name' => 'LED Yongnuo YN600L II', 'category' => 'lighting', 'daily_rate' => 200, 'asset_value' => 750, 'total_qty' => 4, 'rate_unit' => 'diária'],
        ['id' => 'eq-055', 'name' => 'LED VL 49', 'category' => 'lighting', 'daily_rate' => 40, 'asset_value' => 75, 'total_qty' => 3, 'rate_unit' => 'diária'],
        ['id' => 'eq-056', 'name' => 'Yongnuo YN300- II', 'category' => 'lighting', 'daily_rate' => 150, 'asset_value' => 360, 'total_qty' => 1, 'rate_unit' => 'diária'],
        ['id' => 'eq-057', 'name' => 'Flash Godox V860 IIIC Bateria para sony', 'category' => 'lighting', 'daily_rate' => 300, 'asset_value' => 1450, 'total_qty' => 4, 'rate_unit' => 'diária'],
        ['id' => 'eq-058', 'name' => 'Flash Godox V350s Bateria para sony', 'category' => 'lighting', 'daily_rate' => 100, 'asset_value' => 920, 'total_qty' => 4, 'rate_unit' => 'diária'],
        ['id' => 'eq-059', 'name' => 'Flash Godox TT350s pilha para Sony', 'category' => 'lighting', 'daily_rate' => 50, 'asset_value' => 520, 'total_qty' => 3, 'rate_unit' => 'diária'],
        ['id' => 'eq-060', 'name' => 'Flash Godox TT600s pilha para Sony', 'category' => 'lighting', 'daily_rate' => 100, 'asset_value' => 460, 'total_qty' => 1, 'rate_unit' => 'diária'],
        ['id' => 'eq-061', 'name' => 'Flash Canon 580EXII', 'category' => 'lighting', 'daily_rate' => 100, 'asset_value' => 720, 'total_qty' => 1, 'rate_unit' => 'diária'],
        ['id' => 'eq-062', 'name' => 'Rádio Flash Godox Xpro S', 'category' => 'lighting', 'daily_rate' => 150, 'asset_value' => 460, 'total_qty' => 4, 'rate_unit' => 'diária'],
        ['id' => 'eq-063', 'name' => 'Rádio Flash Godox X3 S', 'category' => 'lighting', 'daily_rate' => 200, 'asset_value' => 620, 'total_qty' => 1, 'rate_unit' => 'diária'],
        ['id' => 'eq-064', 'name' => 'Led Rgb Sokani X25', 'category' => 'lighting', 'daily_rate' => 50, 'asset_value' => 420, 'total_qty' => 2, 'rate_unit' => 'diária'],
        ['id' => 'eq-065', 'name' => 'Softbox QR- P120', 'category' => 'lighting', 'daily_rate' => 200, 'asset_value' => 750, 'total_qty' => 2, 'rate_unit' => 'diária'],
        ['id' => 'eq-066', 'name' => 'Rebatedor', 'category' => 'lighting', 'daily_rate' => 80, 'asset_value' => 95, 'total_qty' => 4, 'rate_unit' => 'diária'],
        ['id' => 'eq-067', 'name' => 'Softbox Triopo 90cm', 'category' => 'lighting', 'daily_rate' => 100, 'asset_value' => 240, 'total_qty' => 3, 'rate_unit' => 'diária'],
        ['id' => 'eq-068', 'name' => 'Softbox Godox 90cm', 'category' => 'lighting', 'daily_rate' => 100, 'asset_value' => 420, 'total_qty' => 4, 'rate_unit' => 'diária'],
        ['id' => 'eq-069', 'name' => 'Softbox Godox 120cm', 'category' => 'lighting', 'daily_rate' => 120, 'asset_value' => 540, 'total_qty' => 1, 'rate_unit' => 'diária'],
        ['id' => 'eq-070', 'name' => 'Softbox Globo Balão Chines', 'category' => 'lighting', 'daily_rate' => 150, 'asset_value' => 420, 'total_qty' => 2, 'rate_unit' => 'diária'],
        ['id' => 'eq-071', 'name' => 'Tocha Sz200 Bi', 'category' => 'lighting', 'daily_rate' => 300, 'asset_value' => 2950, 'total_qty' => 2, 'rate_unit' => 'diária'],
        ['id' => 'eq-072', 'name' => 'Tocha Godox Fv200', 'category' => 'lighting', 'daily_rate' => 300, 'asset_value' => 2650, 'total_qty' => 4, 'rate_unit' => 'diária'],
        ['id' => 'eq-073', 'name' => 'Tocha AD600 pro II', 'category' => 'lighting', 'daily_rate' => 600, 'asset_value' => 6200, 'total_qty' => 2, 'rate_unit' => 'diária'],
        ['id' => 'eq-074', 'name' => 'Tocha SL 200 III Bi', 'category' => 'lighting', 'daily_rate' => 300, 'asset_value' => 2350, 'total_qty' => 4, 'rate_unit' => 'diária'],
        ['id' => 'eq-075', 'name' => 'Grua 8m', 'category' => 'accessories', 'daily_rate' => 1200, 'asset_value' => 8500, 'total_qty' => 1, 'rate_unit' => 'diária'],
        ['id' => 'eq-076', 'name' => 'Grua 3,50m', 'category' => 'accessories', 'daily_rate' => 600, 'asset_value' => 3800, 'total_qty' => 1, 'rate_unit' => 'diária'],
        ['id' => 'eq-077', 'name' => 'Tripe de camera Tr 688v', 'category' => 'accessories', 'daily_rate' => 100, 'asset_value' => 320, 'total_qty' => 10, 'rate_unit' => 'diária'],
        ['id' => 'eq-078', 'name' => 'tripe de camera nt777', 'category' => 'accessories', 'daily_rate' => 150, 'asset_value' => 720, 'total_qty' => 2, 'rate_unit' => 'diária'],
        ['id' => 'eq-079', 'name' => 'Tripe de camera Benro Kh26p', 'category' => 'accessories', 'daily_rate' => 150, 'asset_value' => 1450, 'total_qty' => 5, 'rate_unit' => 'diária'],
        ['id' => 'eq-080', 'name' => 'Estabilizador Weebill 3s', 'category' => 'drones', 'daily_rate' => 350, 'asset_value' => 2550, 'total_qty' => 2, 'rate_unit' => 'diária'],
        ['id' => 'eq-081', 'name' => 'Estabilizador Weebill S', 'category' => 'drones', 'daily_rate' => 150, 'asset_value' => 1550, 'total_qty' => 3, 'rate_unit' => 'diária'],
        ['id' => 'eq-082', 'name' => 'Impressora termica de fotos', 'category' => 'accessories', 'daily_rate' => 900, 'asset_value' => 5600, 'total_qty' => 1, 'rate_unit' => 'evento/hora'],
        ['id' => 'eq-083', 'name' => 'Comunicadores Hollyland 6s', 'category' => 'accessories', 'daily_rate' => 600, 'asset_value' => 4900, 'total_qty' => 1, 'rate_unit' => 'diária'],
        ['id' => 'eq-084', 'name' => 'Tripe de Luz', 'category' => 'accessories', 'daily_rate' => 150, 'asset_value' => 120, 'total_qty' => 9, 'rate_unit' => 'diária'],
        ['id' => 'eq-085', 'name' => 'Cabos de Hdmi 50m', 'category' => 'accessories', 'daily_rate' => 150, 'asset_value' => 220, 'total_qty' => 8, 'rate_unit' => 'diária'],
        ['id' => 'eq-086', 'name' => 'Comunicadores Hollyland Solidcom C1', 'category' => 'accessories', 'daily_rate' => 600, 'asset_value' => 5400, 'total_qty' => 1, 'rate_unit' => 'diária'],
    ];

    // 1.2 Migração: Sincronizar diárias exatas da tabela oficial MegaFilmes mantendo os valores patrimoniais dos produtos
    $migratedV4 = false;
    try {
        $resV4 = $db->query("SELECT COUNT(*) FROM system_migrations WHERE migration_key = 'sync_exact_daily_rates_20261114_v4'")->fetchColumn();
        $migratedV4 = ($resV4 > 0);
    } catch (Exception $e) {
    }

    if (!$migratedV4) {
        $updateStmt = $db->prepare("UPDATE equipment SET daily_rate = ?, asset_value = ? WHERE id = ? OR name = ?");
        foreach ($calibratedCatalog as $cItem) {
            $updateStmt->execute([
                $cItem['daily_rate'],
                $cItem['asset_value'],
                $cItem['id'],
                $cItem['name']
            ]);
        }
        try {
            $db->prepare("INSERT IGNORE INTO system_migrations (migration_key) VALUES ('sync_exact_daily_rates_20261114_v4')")->execute();
        } catch (Exception $e) {
        }
    }

    // Seed inicial dos 86 equipamentos se tabela estiver vazia
    $count = $db->query("SELECT COUNT(*) FROM equipment")->fetchColumn();
    if ($count == 0) {
        $stmt = $db->prepare("
            INSERT INTO equipment (id, name, category, daily_rate, asset_value, rate_unit, total_qty, available_qty, serial_number, description, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', '', 'available')
        ");

        foreach ($calibratedCatalog as $item) {
            $stmt->execute([
                $item['id'],
                $item['name'],
                $item['category'],
                $item['daily_rate'],
                $item['asset_value'],
                $item['rate_unit'],
                $item['total_qty'],
                $item['total_qty'],
            ]);
        }
    }

    // Auto-população de asset_value para equipamentos com valor zerado/nulo
    try {
        $stmtZero = $db->query("SELECT id, name, category, daily_rate FROM equipment WHERE asset_value IS NULL OR asset_value <= 0");
        if ($stmtZero) {
            $zeroItems = $stmtZero->fetchAll();
            $upStmt = $db->prepare("UPDATE equipment SET asset_value = ? WHERE id = ?");
            foreach ($zeroItems as $zi) {
                $benchmark = getBenchmarkAssetValue($zi['name'], $zi['category'], (float) $zi['daily_rate']);
                $upStmt->execute([$benchmark, $zi['id']]);
            }
        }
    } catch (Exception $e) {
    }

    // Auto-garantia de registro oficial do contrato LOC-202611-001
    try {
        $checkLoc = $db->query("SELECT COUNT(*) FROM rentals WHERE code = 'LOC-202611-001'")->fetchColumn();
        if ($checkLoc == 0) {
            $locItems = [
                [
                    'equipmentId' => 'eq-007',
                    'name' => 'Canon eos 5D mark III',
                    'category' => 'cameras',
                    'serialNumber' => 'Conferido no ato',
                    'quantity' => 1,
                    'dailyRate' => 150.00,
                    'rateUnit' => 'diária',
                    'itemTotal' => 150.00
                ],
                [
                    'equipmentId' => 'eq-024',
                    'name' => 'Canon 24/70 2.8',
                    'category' => 'lenses',
                    'serialNumber' => 'Conferido no ato',
                    'quantity' => 1,
                    'dailyRate' => 150.00,
                    'rateUnit' => 'diária',
                    'itemTotal' => 150.00
                ]
            ];
            $stmtInsert = $db->prepare("
                INSERT INTO rentals (
                    id, code, client_name, client_document, client_phone, client_email, client_address,
                    start_date, start_time, end_date, end_time, total_days,
                    subtotal, discount, total_amount, payment_method, payment_status, status,
                    notes, items_json, paid_amount, remaining_amount, security_deposit, created_by, auth_signature, created_at
                ) VALUES (
                    'rent-loc-202611-001', 'LOC-202611-001', 'Mikaele de Matos Carvalho Marques', '039.466.152-44', '', '', 'Boa Vista - RR',
                    '2026-12-27', '08:00', '2026-12-28', '18:00', 1,
                    300.00, 0.00, 300.00, 'PIX', 'Pago', 'active',
                    'Contrato oficial de locação emitido e autorizado pela gestão.', ?, 300.00, 0.00, 0.00, 'Mateus Henrique', 'AUTH-MF-540C32BD', '2026-11-16 10:00:00'
                )
            ");
            $stmtInsert->execute([json_encode($locItems, JSON_UNESCAPED_UNICODE)]);
        }
    } catch (Exception $e) {
    }
}

// Retorna valor patrimonial sugerido de mercado/reposição baseado em benchmark
function getBenchmarkAssetValue($name, $category, $dailyRate = 0)
{
    $n = mb_strtolower(trim($name), 'UTF-8');

    // Câmeras
    if (strpos($n, 'a7iv') !== false || strpos($n, 'a7 iv') !== false)
        return 13900.00;
    if (strpos($n, 'fx30') !== false)
        return 10800.00;
    if (strpos($n, 'a7iii') !== false || strpos($n, 'a7 iii') !== false)
        return 8900.00;
    if (strpos($n, '6600') !== false)
        return 5400.00;
    if (strpos($n, 'eos rp') !== false)
        return 4700.00;
    if (strpos($n, '5d mark iii') !== false)
        return 2800.00;
    if (strpos($n, 'nx5') !== false)
        return 3200.00;
    if (strpos($n, 'nx3') !== false)
        return 3400.00;
    if (strpos($n, 'pmw-ex3') !== false)
        return 3900.00;
    if (strpos($n, 'pmw-ex1') !== false)
        return 3500.00;
    if (strpos($n, 'gopro 11') !== false)
        return 1950.00;
    if (strpos($n, 'gopro 360') !== false)
        return 2450.00;
    if (strpos($n, 'gopro 8') !== false)
        return 1350.00;

    // Lentes
    if (strpos($n, '70/200') !== false || strpos($n, '70-200') !== false)
        return 11800.00;
    if (strpos($n, '24/70 2.8') !== false || strpos($n, '24-70 2.8') !== false)
        return 10200.00;
    if (strpos($n, 'canon 24/70') !== false)
        return 4600.00;
    if (strpos($n, '24/70 f4') !== false || strpos($n, '24-70 f4') !== false)
        return 2650.00;
    if (strpos($n, '50mm 1.8') !== false)
        return 1250.00;
    if (strpos($n, '35mm 1.8') !== false)
        return 2750.00;
    if (strpos($n, '35mm 1.4') !== false)
        return 3800.00;
    if (strpos($n, '85mm 1.8') !== false)
        return 2650.00;
    if (strpos($n, '18/105') !== false || strpos($n, '18-105') !== false)
        return 2550.00;
    if (strpos($n, 'sigma 16mm') !== false)
        return 2150.00;

    // Vídeo
    if (strpos($n, 'atem 2') !== false)
        return 13800.00;
    if (strpos($n, 'switcher') !== false)
        return 5900.00;
    if (strpos($n, 'extreme live') !== false)
        return 5400.00;
    if (strpos($n, 'neoid') !== false)
        return 4800.00;
    if (strpos($n, 'atem mini') !== false)
        return 2150.00;
    if (strpos($n, 'cosmo c1') !== false)
        return 4650.00;
    if (strpos($n, 'mars 300') !== false)
        return 2150.00;
    if (strpos($n, 'feelworld 7') !== false)
        return 1350.00;
    if (strpos($n, 'feelworld 5') !== false)
        return 890.00;
    if (strpos($n, 'teleprompter profissional') !== false)
        return 2650.00;
    if (strpos($n, 'teleprompter') !== false)
        return 1450.00;
    if (strpos($n, 'placa de captura') !== false)
        return 650.00;

    // Áudio
    if (strpos($n, 'soundcraft') !== false || strpos($n, 'ui24r') !== false)
        return 5900.00;
    if (strpos($n, 'rodecaster') !== false || strpos($n, 'rode caster') !== false)
        return 4350.00;
    if (strpos($n, 'eon615') !== false || strpos($n, 'jbl') !== false)
        return 2650.00;
    if (strpos($n, 'mkh 600') !== false || strpos($n, 'sennheiser') !== false)
        return 2850.00;
    if (strpos($n, 'zoom h5') !== false)
        return 1650.00;
    if (strpos($n, 'lark m2s') !== false)
        return 1150.00;
    if (strpos($n, 'lark m2') !== false || strpos($n, 'lark 150') !== false)
        return 980.00;
    if (strpos($n, 'vara boom') !== false)
        return 1100.00;
    if (strpos($n, 'behringer') !== false)
        return 750.00;
    if (strpos($n, 'takstar') !== false || strpos($n, 'boya') !== false)
        return 320.00;

    // Iluminação
    if (strpos($n, 'ad600') !== false)
        return 5400.00;
    if (strpos($n, 'sl 200') !== false || strpos($n, 'sz200') !== false)
        return 2250.00;
    if (strpos($n, 'fv200') !== false)
        return 1950.00;
    if (strpos($n, 'v860') !== false)
        return 1350.00;
    if (strpos($n, 'v350') !== false)
        return 780.00;
    if (strpos($n, 'tt350') !== false || strpos($n, 'tt600') !== false)
        return 480.00;
    if (strpos($n, 'xpro') !== false || strpos($n, 'x3 s') !== false)
        return 480.00;
    if (strpos($n, 'yn600') !== false || strpos($n, 'soleste') !== false)
        return 850.00;
    if (strpos($n, 'softbox') !== false)
        return 450.00;
    if (strpos($n, 'rebatedor') !== false)
        return 190.00;

    // Acessórios
    if (strpos($n, 'grua 8m') !== false)
        return 8500.00;
    if (strpos($n, 'grua 3') !== false)
        return 4200.00;
    if (strpos($n, 'solidcom c1') !== false)
        return 5400.00;
    if (strpos($n, 'hollyland 6s') !== false)
        return 4900.00;
    if (strpos($n, 'impressora') !== false)
        return 4900.00;
    if (strpos($n, 'weebill 3s') !== false)
        return 2550.00;
    if (strpos($n, 'weebill s') !== false)
        return 1550.00;
    if (strpos($n, 'benro') !== false)
        return 1250.00;
    if (strpos($n, 'tr 688v') !== false || strpos($n, 'nt777') !== false)
        return 480.00;
    if (strpos($n, 'tripé de luz') !== false)
        return 120.00;
    if (strpos($n, 'hdmi 50m') !== false)
        return 220.00;

    // Fallbacks inteligentes por categoria ou múltiplo da diária
    if ($dailyRate > 0)
        return max(200.00, round($dailyRate * 18, 2));
    switch ($category) {
        case 'cameras':
            return 4500.00;
        case 'lenses':
            return 2500.00;
        case 'video':
            return 2500.00;
        case 'audio':
            return 1200.00;
        case 'lighting':
            return 800.00;
        default:
            return 500.00;
    }
}

// Inicializa tabelas e seeds se necessário
ensureRentalsTables($db);

/**
 * Garante que a pasta de armazenamento público de fotos de vistoria exista.
 */
function ensureRentalStorage()
{
    $docRoot = !empty($_SERVER['DOCUMENT_ROOT']) ? rtrim($_SERVER['DOCUMENT_ROOT'], '/\\') : dirname(__DIR__);
    $targetDir = $docRoot . '/images/rentals';

    if (!is_dir($targetDir)) {
        @mkdir($targetDir, 0777, true);
    }
    @chmod($targetDir, 0777);

    return $targetDir;
}

/**
 * Calcula a assinatura sistêmica determinística idêntica ao JavaScript:
 * Simula int32 signed com Math.abs(hash) para garantir paridade absoluta.
 */
function calculateSystemicHash($str)
{
    $hash = 0;
    $len = strlen($str);
    for ($i = 0; $i < $len; $i++) {
        $hash = ($hash * 31 + ord($str[$i]));
        $hash = ((($hash + 2147483648) % 4294967296) + 4294967296) % 4294967296 - 2147483648;
    }
    $absHash = abs((int)$hash);
    return 'AUTH-MF-' . strtoupper(str_pad(dechex($absHash), 8, '0', STR_PAD_LEFT));
}

/**
 * Garante a pasta de fotos customizadas de equipamentos cadastrados
 */
function ensureEquipmentUploadStorage()
{
    $docRoot = !empty($_SERVER['DOCUMENT_ROOT']) ? rtrim($_SERVER['DOCUMENT_ROOT'], '/\\') : dirname(__DIR__);
    $targetDir = $docRoot . '/images/uploads/equipment';
    if (!is_dir($targetDir)) {
        @mkdir($targetDir, 0777, true);
    }
    @chmod($targetDir, 0777);
    return $targetDir;
}

// Processa fotos de vistoria (salva em disco em images/rentals ou preserva base64)
function processRentalPhotos($photos, $rentalCode, $type)
{
    if (!is_array($photos))
        return [];
    $processed = [];
    $targetDir = ensureRentalStorage();

    foreach ($photos as $idx => $p) {
        $url = $p['url'] ?? '';
        if (!empty($url) && strpos($url, 'data:image/') === 0) {
            $parts = explode(',', $url, 2);
            if (count($parts) === 2) {
                $imageData = base64_decode($parts[1]);
                if ($imageData !== false && strlen($imageData) > 0) {
                    $cleanCode = preg_replace('/[^a-zA-Z0-9_-]/', '', $rentalCode);
                    $cleanId = !empty($p['id']) ? preg_replace('/[^a-zA-Z0-9_-]/', '', $p['id']) : ('p' . ($idx + 1));
                    $filename = $cleanCode . '_' . $type . '_' . $cleanId . '_' . time() . '.jpg';
                    $destPath = $targetDir . '/' . $filename;

                    if (@file_put_contents($destPath, $imageData)) {
                        @chmod($destPath, 0644);
                        $url = '/images/rentals/' . $filename . '?t=' . time();
                    }
                }
            }
        }

        $processed[] = [
            'id' => $p['id'] ?? ('photo-' . bin2hex(random_bytes(4))),
            'url' => $url,
            'caption' => trim($p['caption'] ?? ''),
            'equipmentName' => trim($p['equipmentName'] ?? ''),
            'condition' => trim($p['condition'] ?? 'ok'), // 'ok' ou 'damage'
            'timestamp' => $p['timestamp'] ?? date('Y-m-d H:i:s'),
            'registeredBy' => trim($p['registeredBy'] ?? 'Operador')
        ];
    }
    return $processed;
}

$action = $_GET['action'] ?? '';

// ==============================================================================
// VISUALIZAÇÃO DIRETA DE FOTOS DE VISTORIA (GET action=view_photo | get_photo)
// Permite que navegadores carreguem <img> com segurança e auto-recuperação
// ==============================================================================
if ($method === 'GET' && ($action === 'view_photo' || $action === 'get_photo')) {
    $file = basename($_GET['file'] ?? $_GET['name'] ?? '');
    if (empty($file)) {
        http_response_code(400);
        exit('Arquivo não especificado.');
    }

    $targetDir = ensureRentalStorage();
    $candidatePaths = [
        $targetDir . '/' . $file,
        dirname(__DIR__) . '/images/rentals/' . $file,
        __DIR__ . '/../images/rentals/' . $file,
    ];

    $foundPath = null;
    foreach ($candidatePaths as $cp) {
        if (@is_file($cp)) {
            $foundPath = $cp;
            break;
        }
    }

    if ($foundPath) {
        if ($foundPath !== $targetDir . '/' . $file && is_dir($targetDir)) {
            @copy($foundPath, $targetDir . '/' . $file);
            @chmod($targetDir . '/' . $file, 0644);
        }

        $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
        $mime = 'image/jpeg';
        if ($ext === 'png') $mime = 'image/png';
        elseif ($ext === 'webp') $mime = 'image/webp';
        elseif ($ext === 'gif') $mime = 'image/gif';

        header('Content-Type: ' . $mime);
        header('Content-Length: ' . filesize($foundPath));
        header('Cache-Control: public, max-age=31536000');
        readfile($foundPath);
        exit;
    }

    http_response_code(404);
    exit('Foto não encontrada.');
}

// ==============================================================================
// VERIFICAÇÃO PÚBLICA DE AUTENTICIDADE DE DOCUMENTOS (SEM EXIGÊNCIA DE LOGIN)
// Qualquer pessoa pode apontar a câmera para o QR Code do documento e validar
// ==============================================================================
if ($method === 'GET' && $action === 'verify') {
    $code = trim($_GET['code'] ?? '');
    if (empty($code)) {
        jsonResponse([
            'success' => false,
            'valid' => false,
            'message' => 'Código de verificação do documento não fornecido.'
        ], 400);
    }

    $stmt = $db->prepare("SELECT * FROM rentals WHERE UPPER(TRIM(code)) = UPPER(TRIM(?)) OR UPPER(TRIM(auth_signature)) = UPPER(TRIM(?)) LIMIT 1");
    $stmt->execute([$code, $code]);
    $rental = $stmt->fetch();

    if (!$rental) {
        jsonResponse([
            'success' => true,
            'valid' => false,
            'message' => 'Documento não localizado na base oficial de locações da MegaFilmes.'
        ], 200);
    }

    $items = !empty($rental['items_json']) ? json_decode($rental['items_json'], true) : [];
    $safeItems = array_map(function ($it) {
        return [
            'name' => $it['name'] ?? 'Equipamento',
            'quantity' => (int) ($it['quantity'] ?? 1),
            'dailyRate' => (float) ($it['dailyRate'] ?? 0),
            'serialNumber' => $it['serialNumber'] ?? ''
        ];
    }, is_array($items) ? $items : []);

    // Mascaramento de dados sensíveis para conformidade com a LGPD
    $rawDoc = $rental['client_document'] ?? '';
    $maskedDoc = $rawDoc;
    $digits = preg_replace('/\D/', '', $rawDoc);
    if (strlen($digits) === 11) {
        $maskedDoc = '***.' . substr($digits, 3, 3) . '.' . substr($digits, 6, 3) . '-**';
    } elseif (strlen($digits) === 14) {
        $maskedDoc = substr($digits, 0, 2) . '.***.***/' . substr($digits, 8, 4) . '-**';
    }

    $rawPhone = $rental['client_phone'] ?? '';
    $phoneDigits = preg_replace('/\D/', '', $rawPhone);
    $maskedPhone = '';
    if (strlen($phoneDigits) >= 10) {
        $maskedPhone = '(' . substr($phoneDigits, 0, 2) . ') *****-' . substr($phoneDigits, -4);
    }

    $authorizer = !empty($rental['created_by']) ? $rental['created_by'] : 'Gestão MegaFilmes';
    $isReserved = ($rental['status'] === 'reserved');

    // Assinatura Sistêmica oficial ou calculada determinística idêntica
    if (!empty($rental['auth_signature'])) {
        $authSignature = $rental['auth_signature'];
    } else {
        $rawAmount = (float) $rental['total_amount'];
        $amtStr = ($rawAmount == (int) $rawAmount) ? (string) ((int) $rawAmount) : number_format($rawAmount, 2, '.', '');
        $strForHash = $rental['code'] . '-' . $amtStr . '-' . $rental['start_date'] . '-' . $authorizer;
        $authSignature = calculateSystemicHash($strForHash);
    }

    jsonResponse([
        'success' => true,
        'valid' => true,
        'document' => [
            'code' => $rental['code'],
            'type' => $isReserved ? 'Comprovante de Agendamento & Reserva' : 'Contrato de Locação & Termo de Responsabilidade',
            'status' => $rental['status'],
            'clientName' => $rental['client_name'],
            'clientDocumentMasked' => $maskedDoc,
            'clientPhoneMasked' => $maskedPhone,
            'startDate' => $rental['start_date'],
            'startTime' => $rental['start_time'] ?? '08:00',
            'endDate' => $rental['end_date'],
            'endTime' => $rental['end_time'] ?? '18:00',
            'totalDays' => (int) $rental['total_days'],
            'totalAmount' => (float) $rental['total_amount'],
            'paymentStatus' => $rental['payment_status'] ?? 'Pendente',
            'paymentMethod' => $rental['payment_method'] ?? 'PIX',
            'authorizedBy' => $authorizer,
            'authSignature' => $authSignature,
            'issuedAt' => $rental['created_at'],
            'items' => $safeItems,
            'legalFramework' => 'Lei Federal nº 10.406/2002 (Código Civil) e Lei Federal nº 14.063/2020',
            'issuer' => [
                'name' => 'Mega Filmes e Fotografia (RG DA SILVA - ME)',
                'cnpj' => '21.973.641/0001-00',
                'address' => 'Alameda dos Tatus, 155 - Dr. Silvio Leite, Boa Vista - RR',
                'system' => 'GestorMF'
            ]
        ]
    ]);
}

// Auth: apenas ADMIN e MANAGER têm acesso ao módulo de aluguel
$user = requireAuth(['ADMIN', 'MANAGER']);

// ==============================================================================
// 1. LISTAR CATÁLOGO & LOCAÇÕES (GET)
// ==============================================================================
if ($method === 'GET') {
    // Atualiza automaticamente status de locações vencidas para 'overdue' se aplicável
    $today = date('Y-m-d');
    $db->prepare("
        UPDATE rentals 
        SET status = 'overdue' 
        WHERE status = 'active' AND end_date < ?
    ")->execute([$today]);

    // Busca equipamentos
    $stmtEq = $db->query("SELECT * FROM equipment ORDER BY category ASC, name ASC");
    $rawEq = $stmtEq->fetchAll();

    // Mapeamento de alocações ativas em missões para cruzar com o acervo
    $missionAllocationsByEquipId = [];
    try {
        $stmtMissions = $db->query("
            SELECT id, code, description, date, end_date, departure_time, return_time_estimated, mission_status, equipment_allocations 
            FROM missions 
            WHERE mission_status IN ('Agendada', 'Em Deslocamento', 'Em Execução', 'Pendente')
              AND equipment_allocations IS NOT NULL 
              AND equipment_allocations != ''
        ");
        if ($stmtMissions) {
            $activeMissions = $stmtMissions->fetchAll();
            foreach ($activeMissions as $am) {
                $allocGroups = json_decode($am['equipment_allocations'], true);
                if (is_array($allocGroups)) {
                    foreach ($allocGroups as $grp) {
                        $collabName = $grp['collaboratorName'] ?? 'Geral / Coletivo';
                        $items = $grp['items'] ?? [];
                        if (is_array($items)) {
                            foreach ($items as $it) {
                                $eqId = $it['equipmentId'] ?? $it['id'] ?? '';
                                if (!empty($eqId)) {
                                    if (!isset($missionAllocationsByEquipId[$eqId])) {
                                        $missionAllocationsByEquipId[$eqId] = [];
                                    }
                                    $missionAllocationsByEquipId[$eqId][] = [
                                        'type' => 'mission',
                                        'missionId' => $am['id'],
                                        'missionCode' => $am['code'] ?? ('#' . $am['id']),
                                        'description' => $am['description'],
                                        'date' => $am['date'],
                                        'endDate' => $am['end_date'] ?? $am['date'],
                                        'departureTime' => $am['departure_time'],
                                        'returnTime' => $am['return_time_estimated'],
                                        'collaboratorName' => $collabName,
                                        'quantity' => (int) ($it['quantity'] ?? 1)
                                    ];
                                }
                            }
                        }
                    }
                }
            }
        }
    } catch (Exception $e) {
    }

    $equipment = array_map(function ($e) use ($missionAllocationsByEquipId) {
        $eqId = $e['id'];
        $assetVal = (float) ($e['asset_value'] ?? 0);
        if ($assetVal <= 0) {
            $assetVal = getBenchmarkAssetValue($e['name'], $e['category'], (float) $e['daily_rate']);
        }
        return [
            'id' => $eqId,
            'name' => $e['name'],
            'category' => $e['category'],
            'dailyRate' => (float) $e['daily_rate'],
            'rateUnit' => $e['rate_unit'] ?? 'diária',
            'assetValue' => $assetVal,
            'totalQty' => (int) $e['total_qty'],
            'availableQty' => (int) $e['available_qty'],
            'maintenanceQty' => (int) ($e['maintenance_qty'] ?? 0),
            'maintenanceNotes' => $e['maintenance_notes'] ?? '',
            'serialNumber' => $e['serial_number'] ?? '',
            'photoUrl' => $e['photo_url'] ?? '',
            'description' => $e['description'] ?? '',
            'status' => $e['status'] ?? 'available',
            'missionAllocations' => $missionAllocationsByEquipId[$eqId] ?? [],
            'createdAt' => $e['created_at'],
            'updatedAt' => $e['updated_at']
        ];
    }, $rawEq);

    // Busca locações
    $stmtRent = $db->query("SELECT * FROM rentals ORDER BY created_at DESC");
    $rawRent = $stmtRent->fetchAll();

    $rentals = array_map(function ($r) {
        $items = !empty($r['items_json']) ? json_decode($r['items_json'], true) : [];
        return [
            'id' => $r['id'],
            'code' => $r['code'],
            'clientName' => $r['client_name'],
            'clientDocument' => $r['client_document'] ?? '',
            'clientPhone' => $r['client_phone'] ?? '',
            'clientEmail' => $r['client_email'] ?? '',
            'clientAddress' => $r['client_address'] ?? '',
            'startDate' => $r['start_date'],
            'startTime' => $r['start_time'] ?? '08:00',
            'endDate' => $r['end_date'],
            'endTime' => $r['end_time'] ?? '18:00',
            'totalDays' => (int) $r['total_days'],
            'subtotal' => (float) $r['subtotal'],
            'discount' => (float) $r['discount'],
            'totalAmount' => (float) $r['total_amount'],
            'paymentMethod' => $r['payment_method'] ?? 'PIX',
            'paymentStatus' => $r['payment_status'] ?? 'Pendente',
            'status' => $r['status'] ?? 'active',
            'notes' => $r['notes'] ?? '',
            'items' => is_array($items) ? $items : [],
            'pickupPhotos' => !empty($r['pickup_photos_json']) ? json_decode($r['pickup_photos_json'], true) : [],
            'returnPhotos' => !empty($r['return_photos_json']) ? json_decode($r['return_photos_json'], true) : [],
            'pickupNotes' => $r['pickup_notes'] ?? '',
            'inspectionNotes' => $r['inspection_notes'] ?? '',
            'hasDamage' => !empty($r['has_damage']),
            'paidAmount' => (float) ($r['paid_amount'] ?? 0),
            'remainingAmount' => (float) ($r['remaining_amount'] ?? 0),
            'remainingDueTerms' => $r['remaining_due_terms'] ?? '',
            'remainingDueDate' => $r['remaining_due_date'] ?? null,
            'securityDeposit' => (float) ($r['security_deposit'] ?? 0),
            'authSignature' => $r['auth_signature'] ?? '',
            'createdBy' => $r['created_by'] ?? 'Sistema',
            'createdAt' => $r['created_at'],
            'updatedAt' => $r['updated_at'],
            'returnedAt' => $r['returned_at'],
            'returnNotes' => $r['return_notes'] ?? ''
        ];
    }, $rawRent);

    // Métricas para Dashboard & Consolidação Patrimonial
    $totalEquipments = array_sum(array_column($equipment, 'totalQty'));
    $availableEquipments = array_sum(array_column($equipment, 'availableQty'));
    $maintenanceEquipments = array_sum(array_column($equipment, 'maintenanceQty'));
    $rentedEquipments = max(0, $totalEquipments - $availableEquipments - $maintenanceEquipments);

    $totalAssetValue = 0.0;
    $patrimonyByCategory = [];
    foreach ($equipment as $eq) {
        $cat = $eq['category'] ?: 'accessories';
        $val = ((float) $eq['assetValue']) * ((int) $eq['totalQty']);
        $totalAssetValue += $val;

        if (!isset($patrimonyByCategory[$cat])) {
            $patrimonyByCategory[$cat] = [
                'category' => $cat,
                'totalAssetValue' => 0.0,
                'totalUnits' => 0,
                'itemsCount' => 0
            ];
        }
        $patrimonyByCategory[$cat]['totalAssetValue'] += $val;
        $patrimonyByCategory[$cat]['totalUnits'] += (int) $eq['totalQty'];
        $patrimonyByCategory[$cat]['itemsCount'] += 1;
    }

    $activeRentals = count(array_filter($rentals, fn($r) => $r['status'] === 'active'));
    $overdueRentals = count(array_filter($rentals, fn($r) => $r['status'] === 'overdue'));

    // Alertas de Devoluções Próximas (vence hoje ou amanhã)
    $todayStr = date('Y-m-d');
    $tomorrowStr = date('Y-m-d', strtotime('+1 day'));
    $dueSoonRentals = array_values(array_filter($rentals, function ($r) use ($todayStr, $tomorrowStr) {
        return ($r['status'] === 'active' || $r['status'] === 'overdue') &&
            ($r['endDate'] <= $tomorrowStr);
    }));

    jsonResponse([
        'success' => true,
        'equipment' => $equipment,
        'rentals' => $rentals,
        'patrimony' => [
            'totalAssetValue' => $totalAssetValue,
            'totalUnits' => $totalEquipments,
            'totalItems' => count($equipment),
            'byCategory' => array_values($patrimonyByCategory)
        ],
        'summary' => [
            'totalEquipments' => $totalEquipments,
            'availableEquipments' => $availableEquipments,
            'maintenanceEquipments' => $maintenanceEquipments,
            'rentedEquipments' => $rentedEquipments,
            'totalAssetValue' => $totalAssetValue,
            'activeRentals' => $activeRentals,
            'overdueRentals' => $overdueRentals,
            'dueSoonCount' => count($dueSoonRentals)
        ]
    ]);
}

// ==============================================================================
// 2. SALVAR OU EDITAR EQUIPAMENTO (POST com action=save_equipment)
// ==============================================================================
$action = $_GET['action'] ?? '';
$data = getJsonInput();

if ($method === 'POST' && $action === 'save_equipment') {
    $id = trim($data['id'] ?? '');
    if (empty($id)) {
        $id = 'eq-' . bin2hex(random_bytes(6));
    }

    $name = trim($data['name'] ?? '');
    $category = trim($data['category'] ?? 'accessories');
    $dailyRate = (float) ($data['dailyRate'] ?? $data['daily_rate'] ?? 0);
    $assetValue = (float) ($data['assetValue'] ?? $data['asset_value'] ?? 0);
    if ($assetValue <= 0) {
        $benchmark = getBenchmarkAssetValue($name, $category, $dailyRate);
        $assetValue = $benchmark;
    }
    $rateUnit = trim($data['rateUnit'] ?? 'diária');
    $totalQty = max(1, (int) ($data['totalQty'] ?? 1));
    $serialNumber = trim($data['serialNumber'] ?? '');
    $photoUrl = trim($data['photoUrl'] ?? $data['photo_url'] ?? '');
    $description = trim($data['description'] ?? '');

    if (empty($name)) {
        jsonResponse(['success' => false, 'error' => 'O nome do equipamento é obrigatório.'], 400);
    }

    // Processa upload de foto em base64 e salva como arquivo físico no servidor em pasta protegida contra deploy
    if (!empty($photoUrl) && strpos($photoUrl, 'data:image/') === 0) {
        $parts = explode(',', $photoUrl, 2);
        if (count($parts) === 2) {
            $imageData = base64_decode($parts[1]);
            if ($imageData !== false && strlen($imageData) > 0) {
                // Pasta de uploads protegida contra sobrescrita de deploy
                $targetDir = ensureEquipmentUploadStorage();
                $cleanId = preg_replace('/[^a-zA-Z0-9_-]/', '', $id);
                $uniqueFilename = 'custom_' . $cleanId . '_' . time() . '.jpg';
                $filePath = $targetDir . '/' . $uniqueFilename;

                if (@file_put_contents($filePath, $imageData)) {
                    @chmod($filePath, 0644);
                    $photoUrl = '/images/uploads/equipment/' . $uniqueFilename . '?t=' . time();
                    $saved = true;
                }
                // Se o arquivo físico falhar por permissão de pasta no servidor,
                // $photoUrl permanece o dataUrl (base64) e é salvo no LONGTEXT do banco,
                // garantindo que a foto NUNCA seja perdida mesmo se a pasta de disco falhar!
            }
        }
    }

    // Checa se já existe para manter coerência do available_qty
    $stmtCheck = $db->prepare("SELECT id, total_qty, available_qty, photo_url FROM equipment WHERE id = ?");
    $stmtCheck->execute([$id]);
    $existing = $stmtCheck->fetch();

    if ($existing && empty($photoUrl) && !empty($existing['photo_url'])) {
        $photoUrl = $existing['photo_url'];
    }

    try {
        if ($existing) {
            $diff = $totalQty - (int) $existing['total_qty'];
            $newAvailable = max(0, (int) $existing['available_qty'] + $diff);
            $status = $newAvailable > 0 ? 'available' : 'rented';

            $stmtUp = $db->prepare("
                UPDATE equipment 
                SET name = ?, category = ?, daily_rate = ?, rate_unit = ?, asset_value = ?, total_qty = ?, available_qty = ?, serial_number = ?, photo_url = ?, description = ?, status = ?
                WHERE id = ?
            ");
            $stmtUp->execute([
                $name,
                $category,
                $dailyRate,
                $rateUnit,
                $assetValue,
                $totalQty,
                $newAvailable,
                $serialNumber,
                $photoUrl,
                $description,
                $status,
                $id
            ]);
        } else {
            $stmtIns = $db->prepare("
                INSERT INTO equipment (id, name, category, daily_rate, rate_unit, asset_value, total_qty, available_qty, serial_number, photo_url, description, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available')
            ");
            $stmtIns->execute([
                $id,
                $name,
                $category,
                $dailyRate,
                $rateUnit,
                $assetValue,
                $totalQty,
                $totalQty,
                $serialNumber,
                $photoUrl,
                $description
            ]);
        }
    } catch (Exception $e) {
        jsonResponse(['success' => false, 'error' => 'Erro ao salvar no banco de dados: ' . $e->getMessage()], 500);
    }

    logAudit('SAVE_EQUIPMENT', 'EQUIPMENT', $id, "Equipamento {$name} salvo por {$user['name']}.", $user['id'], $user['name']);
    bumpSyncVersion('save_equipment');

    jsonResponse([
        'success' => true,
        'id' => $id,
        'photoUrl' => $photoUrl,
        'message' => 'Equipamento salvo com sucesso.'
    ]);
}

// ==============================================================================
// 2.1 ATUALIZAR APENAS A FOTO DO EQUIPAMENTO (POST action=update_equipment_photo)
// ==============================================================================
if ($method === 'POST' && $action === 'update_equipment_photo') {
    $id = trim($data['id'] ?? '');
    $photoUrl = trim($data['photoUrl'] ?? $data['photo_url'] ?? '');

    if (empty($id)) {
        jsonResponse(['success' => false, 'error' => 'ID do equipamento não informado.'], 400);
    }
    if (empty($photoUrl)) {
        jsonResponse(['success' => false, 'error' => 'Foto não informada.'], 400);
    }

    if (strpos($photoUrl, 'data:image/') === 0) {
        $parts = explode(',', $photoUrl, 2);
        if (count($parts) === 2) {
            $imageData = base64_decode($parts[1]);
            if ($imageData !== false && strlen($imageData) > 0) {
                $targetDir = ensureEquipmentUploadStorage();
                $cleanId = preg_replace('/[^a-zA-Z0-9_-]/', '', $id);
                $uniqueFilename = 'custom_' . $cleanId . '_' . time() . '.jpg';
                $filePath = $targetDir . '/' . $uniqueFilename;

                if (@file_put_contents($filePath, $imageData)) {
                    @chmod($filePath, 0644);
                    $photoUrl = '/images/uploads/equipment/' . $uniqueFilename . '?t=' . time();
                }
            }
        }
    }

    try {
        $stmtPhoto = $db->prepare("UPDATE equipment SET photo_url = ? WHERE id = ?");
        $stmtPhoto->execute([$photoUrl, $id]);
        bumpSyncVersion('update_equipment_photo');

        jsonResponse([
            'success' => true,
            'message' => 'Foto do equipamento atualizada com sucesso.',
            'photoUrl' => $photoUrl
        ]);
    } catch (Throwable $e) {
        jsonResponse(['success' => false, 'error' => $e->getMessage()], 400);
    }
}

// ==============================================================================
// 3. EXCLUIR EQUIPAMENTO (DELETE / POST action=delete_equipment)
// ==============================================================================
if (($method === 'DELETE' || ($method === 'POST' && $action === 'delete_equipment'))) {
    $id = trim($_GET['id'] ?? $data['id'] ?? '');
    if (empty($id)) {
        jsonResponse(['success' => false, 'error' => 'ID do equipamento não informado.'], 400);
    }

    // Verifica se está alugado no momento
    $stmtEq = $db->prepare("SELECT total_qty, available_qty, name FROM equipment WHERE id = ?");
    $stmtEq->execute([$id]);
    $eq = $stmtEq->fetch();

    if ($eq && (int) $eq['available_qty'] < (int) $eq['total_qty']) {
        jsonResponse([
            'success' => false,
            'error' => "Não é possível excluir '{$eq['name']}' pois existem unidades atualmente alugadas. Faça o check-in de devolução primeiro."
        ], 400);
    }

    $db->prepare("DELETE FROM equipment WHERE id = ?")->execute([$id]);
    logAudit('DELETE_EQUIPMENT', 'EQUIPMENT', $id, "Equipamento removido por {$user['name']}.", $user['id'], $user['name']);
    bumpSyncVersion('delete_equipment');

    jsonResponse(['success' => true, 'message' => 'Equipamento excluído com sucesso.']);
}

// ==============================================================================
// 4. CRIAR NOVA LOCAÇÃO (POST action=create_rental)
// ==============================================================================
if ($method === 'POST' && $action === 'create_rental') {
    $clientName = trim($data['clientName'] ?? '');
    $clientDocument = trim($data['clientDocument'] ?? '');
    $clientPhone = trim($data['clientPhone'] ?? '');
    $clientEmail = trim($data['clientEmail'] ?? '');
    $clientAddress = trim($data['clientAddress'] ?? '');

    $startDate = trim($data['startDate'] ?? date('Y-m-d'));
    $startTime = trim($data['startTime'] ?? '08:00');
    $endDate = trim($data['endDate'] ?? date('Y-m-d'));
    $endTime = trim($data['endTime'] ?? '18:00');

    $items = is_array($data['items'] ?? null) ? $data['items'] : [];

    if (empty($clientName)) {
        jsonResponse(['success' => false, 'error' => 'O nome do cliente/locatário é obrigatório.'], 400);
    }
    $cleanDoc = preg_replace('/\D/', '', $clientDocument);
    if (empty($cleanDoc) || (strlen($cleanDoc) !== 11 && strlen($cleanDoc) !== 14)) {
        jsonResponse(['success' => false, 'error' => 'O CPF ou CNPJ do cliente é obrigatório para emissão do contrato (informe 11 dígitos para CPF ou 14 dígitos para CNPJ).'], 400);
    }
    if (empty($items)) {
        jsonResponse(['success' => false, 'error' => 'Selecione ao menos um equipamento para locação.'], 400);
    }

    // Calcula dias de locação
    $startTs = strtotime($startDate);
    $endTs = strtotime($endDate);
    $diffDays = max(1, (int) round(($endTs - $startTs) / 86400));
    if ($diffDays < 1)
        $diffDays = 1;

    // Valida disponibilidade de cada item e calcula subtotal
    $subtotal = 0;
    $validatedItems = [];
    $todayStr = date('Y-m-d');
    $isImmediate = ($startDate <= $todayStr);

    $db->beginTransaction();

    try {
        foreach ($items as $it) {
            $eqId = $it['equipmentId'] ?? $it['id'] ?? '';
            $qty = max(1, (int) ($it['quantity'] ?? 1));

            $stmtCheck = $db->prepare("SELECT * FROM equipment WHERE id = ? FOR UPDATE");
            $stmtCheck->execute([$eqId]);
            $eq = $stmtCheck->fetch();

            if (!$eq) {
                throw new Exception("Equipamento não encontrado: " . ($it['name'] ?? $eqId));
            }

            if ($isImmediate && (int) $eq['available_qty'] < $qty) {
                throw new Exception("Estoque insuficiente para saída imediata de '{$eq['name']}'. Disponível hoje: {$eq['available_qty']} un, Solicitado: {$qty} un.");
            }
            if (!$isImmediate && (int) $eq['total_qty'] < $qty) {
                throw new Exception("O acervo total possui apenas {$eq['total_qty']} unidade(s) de '{$eq['name']}'. Não é possível reservar {$qty} un.");
            }

            $rate = (float) ($it['dailyRate'] ?? $eq['daily_rate']);
            $itemTotal = $rate * $qty * $diffDays;
            $subtotal += $itemTotal;

            // Baixa estoque disponível apenas se a locação for de início imediato
            if ($isImmediate) {
                $newAvailable = max(0, (int) $eq['available_qty'] - $qty);
                $newStatus = $newAvailable == 0 ? 'rented' : 'available';

                $stmtUp = $db->prepare("UPDATE equipment SET available_qty = ?, status = ? WHERE id = ?");
                $stmtUp->execute([$newAvailable, $newStatus, $eqId]);
            }

            $validatedItems[] = [
                'equipmentId' => $eqId,
                'name' => $eq['name'],
                'category' => $eq['category'],
                'serialNumber' => $eq['serial_number'] ?? '',
                'quantity' => $qty,
                'dailyRate' => $rate,
                'rateUnit' => $eq['rate_unit'] ?? 'diária',
                'itemTotal' => $itemTotal
            ];
        }

        $discount = (float) ($data['discount'] ?? 0);
        $totalAmount = max(0, $subtotal - $discount);
        $paymentMethod = trim($data['paymentMethod'] ?? 'PIX');
        $paymentStatus = trim($data['paymentStatus'] ?? 'Pendente');
        $notes = trim($data['notes'] ?? '');

        $paidAmount = max(0, (float) ($data['paidAmount'] ?? 0));
        $remainingAmount = max(0, (float) ($data['remainingAmount'] ?? ($totalAmount - $paidAmount)));
        $remainingDueTerms = trim($data['remainingDueTerms'] ?? '');
        $remainingDueDate = !empty($data['remainingDueDate']) ? trim($data['remainingDueDate']) : null;
        $securityDeposit = max(0, (float) ($data['securityDeposit'] ?? 0));

        if ($paymentStatus === 'Pago' && $paidAmount == 0) {
            $paidAmount = $totalAmount;
            $remainingAmount = 0;
        }

        // Define status: 'reserved' (Agendamento/Reserva) ou 'active' (Locação ativa)
        $status = trim($data['status'] ?? '');
        if (!in_array($status, ['active', 'reserved'])) {
            $status = ($paymentStatus === 'Pago') ? 'active' : 'reserved';
        }

        // Prefixo do código: RES- para reservas/agendamentos, LOC- para locações diretas
        $prefix = ($status === 'reserved') ? ('RES-' . date('Ym') . '-') : ('LOC-' . date('Ym') . '-');
        $stmtSeq = $db->query("SELECT COUNT(*) FROM rentals WHERE code LIKE '{$prefix}%'");
        $seq = (int) $stmtSeq->fetchColumn() + 1;
        $code = $prefix . str_pad($seq, 3, '0', STR_PAD_LEFT);

        $rentalId = 'rent-' . bin2hex(random_bytes(8));

        // Calcula assinatura sistêmica oficial idêntica ao front
        $rawAmount = (float) $totalAmount;
        $amtStr = ($rawAmount == (int) $rawAmount) ? (string) ((int) $rawAmount) : number_format($rawAmount, 2, '.', '');
        $authorizerName = !empty($user['name']) ? $user['name'] : 'Gestão MegaFilmes';
        $authSignature = calculateSystemicHash($code . '-' . $amtStr . '-' . $startDate . '-' . $authorizerName);

        $stmtRent = $db->prepare("
            INSERT INTO rentals (
                id, code, client_name, client_document, client_phone, client_email, client_address,
                start_date, start_time, end_date, end_time, total_days,
                subtotal, discount, total_amount, payment_method, payment_status, status,
                notes, items_json, paid_amount, remaining_amount, remaining_due_terms, remaining_due_date, security_deposit, created_by, auth_signature
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
        ");

        $stmtRent->execute([
            $rentalId,
            $code,
            $clientName,
            $clientDocument,
            $clientPhone,
            $clientEmail,
            $clientAddress,
            $startDate,
            $startTime,
            $endDate,
            $endTime,
            $diffDays,
            $subtotal,
            $discount,
            $totalAmount,
            $paymentMethod,
            $paymentStatus,
            $status,
            $notes,
            json_encode($validatedItems, JSON_UNESCAPED_UNICODE),
            $paidAmount,
            $remainingAmount,
            $remainingDueTerms,
            $remainingDueDate,
            $securityDeposit,
            $user['name'],
            $authSignature
        ]);

        $db->commit();

        $actionLabel = ($status === 'reserved') ? "Reserva/Agendamento" : "Locação";
        logAudit('CREATE_RENTAL', 'RENTALS', $rentalId, "{$actionLabel} {$code} para {$clientName} criada por {$user['name']}.", $user['id'], $user['name']);
        bumpSyncVersion('create_rental');

        jsonResponse([
            'success' => true,
            'rentalId' => $rentalId,
            'code' => $code,
            'status' => $status,
            'authSignature' => $authSignature,
            'message' => "{$actionLabel} {$code} gerada com sucesso!"
        ]);

    } catch (Exception $e) {
        $db->rollBack();
        jsonResponse(['success' => false, 'error' => $e->getMessage()], 400);
    }
}

// ==============================================================================
// 5. RECEBER DEVOLUÇÃO / CHECK-IN DE EQUIPAMENTOS (POST action=return_rental)
// ==============================================================================
if ($method === 'POST' && $action === 'return_rental') {
    $rentalId = trim($data['rentalId'] ?? $data['id'] ?? '');
    $returnNotes = trim($data['returnNotes'] ?? '');
    $sendToMaintenance = !empty($data['sendToMaintenance']);
    $maintenanceItemIds = is_array($data['maintenanceItemIds'] ?? null) ? $data['maintenanceItemIds'] : [];

    if (empty($rentalId)) {
        jsonResponse(['success' => false, 'error' => 'ID da locação não informado.'], 400);
    }

    $db->beginTransaction();

    try {
        $stmtR = $db->prepare("SELECT * FROM rentals WHERE id = ? FOR UPDATE");
        $stmtR->execute([$rentalId]);
        $rental = $stmtR->fetch();

        if (!$rental) {
            throw new Exception("Locação não encontrada.");
        }

        if ($rental['status'] === 'returned') {
            throw new Exception("Esta locação já foi finalizada e os equipamentos já foram devolvidos ao estoque.");
        }

        $items = !empty($rental['items_json']) ? json_decode($rental['items_json'], true) : [];
        $hasDamage = !empty($data['hasDamage']) || !empty($rental['has_damage']) || $sendToMaintenance ? 1 : 0;
        $maintenanceItemsRecord = [];

        // Devolve ou encaminha cada item para manutenção
        foreach ($items as $it) {
            $eqId = $it['equipmentId'] ?? $it['id'] ?? '';
            $qty = (int) ($it['quantity'] ?? 1);

            $stmtEq = $db->prepare("SELECT total_qty, available_qty, maintenance_qty, name FROM equipment WHERE id = ? FOR UPDATE");
            $stmtEq->execute([$eqId]);
            $eq = $stmtEq->fetch();

            if ($eq) {
                $itemSentToMaint = $sendToMaintenance || in_array($eqId, $maintenanceItemIds);

                if ($itemSentToMaint) {
                    // Vai para manutenção: NÃO entra no available_qty!
                    $newMaint = (int) ($eq['maintenance_qty'] ?? 0) + $qty;
                    $currentAvail = (int) $eq['available_qty'];
                    $status = $currentAvail > 0 ? 'available' : 'maintenance';
                    $maintNote = "Encaminhado para manutenção pós-locação {$rental['code']} em " . date('d/m/Y H:i') . ($returnNotes ? ": {$returnNotes}" : "");

                    $db->prepare("UPDATE equipment SET maintenance_qty = ?, status = ?, maintenance_notes = ? WHERE id = ?")
                        ->execute([$newMaint, $status, $maintNote, $eqId]);

                    $maintenanceItemsRecord[] = [
                        'equipmentId' => $eqId,
                        'name' => $eq['name'] ?? $it['name'] ?? 'Equipamento',
                        'quantity' => $qty,
                        'sentAt' => date('Y-m-d H:i:s')
                    ];
                } else {
                    // Devolve ao estoque disponível
                    $newAvailable = min((int) $eq['total_qty'], (int) $eq['available_qty'] + $qty);
                    $status = $newAvailable > 0 ? 'available' : 'rented';

                    $db->prepare("UPDATE equipment SET available_qty = ?, status = ? WHERE id = ?")
                        ->execute([$newAvailable, $status, $eqId]);
                }
            }
        }

        // Atualiza locação para returned
        $now = date('Y-m-d H:i:s');
        $returnPhotosInput = is_array($data['returnPhotos'] ?? null) ? $data['returnPhotos'] : null;
        $inspectionNotes = trim($data['inspectionNotes'] ?? '');

        $sqlReturn = "UPDATE rentals SET status = 'returned', returned_at = ?, return_notes = ?";
        $paramsReturn = [$now, $returnNotes];

        if ($returnPhotosInput !== null) {
            $processedReturnPhotos = processRentalPhotos($returnPhotosInput, $rental['code'], 'retorno');
            $sqlReturn .= ", return_photos_json = ?";
            $paramsReturn[] = json_encode($processedReturnPhotos, JSON_UNESCAPED_UNICODE);
            foreach ($processedReturnPhotos as $rp) {
                if (($rp['condition'] ?? '') === 'damage') {
                    $hasDamage = 1;
                    break;
                }
            }
        }

        if (!empty($inspectionNotes)) {
            $sqlReturn .= ", inspection_notes = ?";
            $paramsReturn[] = $inspectionNotes;
        }

        $sqlReturn .= ", has_damage = ?";
        $paramsReturn[] = $hasDamage;

        if ($sendToMaintenance || !empty($maintenanceItemsRecord)) {
            $sqlReturn .= ", sent_to_maintenance = 1, maintenance_items_json = ?";
            $paramsReturn[] = json_encode($maintenanceItemsRecord, JSON_UNESCAPED_UNICODE);
        }

        $sqlReturn .= " WHERE id = ?";
        $paramsReturn[] = $rentalId;

        $db->prepare($sqlReturn)->execute($paramsReturn);

        $db->commit();

        $logMsg = "Devolução da locação {$rental['code']} confirmada por {$user['name']}." . ($sendToMaintenance ? " Equipamento(s) encaminhado(s) para manutenção." : " Equipamentos liberados no estoque.");
        logAudit('RETURN_RENTAL', 'RENTALS', $rentalId, $logMsg, $user['id'], $user['name']);
        bumpSyncVersion('return_rental');

        $returnSuccessMsg = $sendToMaintenance
            ? "Devolução da locação {$rental['code']} registrada. Equipamento(s) com avaria encaminhado(s) para Manutenção Técnica com sucesso!"
            : "Devolução da locação {$rental['code']} registrada com sucesso. Equipamentos liberados no estoque!";

        jsonResponse([
            'success' => true,
            'message' => $returnSuccessMsg,
            'sentToMaintenance' => $sendToMaintenance,
            'maintenanceItems' => $maintenanceItemsRecord
        ]);

    } catch (Exception $e) {
        $db->rollBack();
        jsonResponse(['success' => false, 'error' => $e->getMessage()], 400);
    }
}

// ==============================================================================
// 5.1 UPLOAD INDIVIDUAL DE FOTO DE VISTORIA (POST action=upload_inspection_photo)
// ==============================================================================
if ($method === 'POST' && $action === 'upload_inspection_photo') {
    $rentalCode = trim($data['rentalCode'] ?? $data['code'] ?? 'vistoria');
    $type = trim($data['type'] ?? 'saida'); // 'saida' | 'retorno'
    $photoData = $data['photo'] ?? $data['url'] ?? '';

    if (empty($photoData) || strpos($photoData, 'data:image/') !== 0) {
        jsonResponse(['success' => false, 'error' => 'Imagem em formato base64 inválida ou ausente.'], 400);
    }

    $parts = explode(',', $photoData, 2);
    if (count($parts) !== 2) {
        jsonResponse(['success' => false, 'error' => 'Dados de imagem corrompidos.'], 400);
    }

    $binaryData = base64_decode($parts[1]);
    if ($binaryData === false || strlen($binaryData) === 0) {
        jsonResponse(['success' => false, 'error' => 'Falha ao decodificar imagem.'], 400);
    }

    $targetDir = ensureRentalStorage();
    $cleanCode = preg_replace('/[^a-zA-Z0-9_-]/', '', $rentalCode);
    $uniqueId = preg_replace('/[^a-zA-Z0-9_-]/', '', $data['id'] ?? ('p' . bin2hex(random_bytes(3))));
    $filename = $cleanCode . '_' . $type . '_' . $uniqueId . '_' . time() . '.jpg';
    $destPath = $targetDir . '/' . $filename;

    $saved = false;
    if (@file_put_contents($destPath, $binaryData)) {
        @chmod($destPath, 0644);
        $saved = true;
    }

    $finalUrl = $saved ? ('/images/rentals/' . $filename . '?t=' . time()) : $photoData;

    jsonResponse([
        'success' => true,
        'message' => 'Foto salva com sucesso na hospedagem.',
        'url' => $finalUrl,
        'filename' => $filename,
        'isStoredOnDisk' => $saved
    ]);
}

// ==============================================================================
// 5.2 CONCLUIR MANUTENÇÃO & RETORNAR AO ESTOQUE DISPONÍVEL (POST action=finish_maintenance)
// ==============================================================================
if ($method === 'POST' && $action === 'finish_maintenance') {
    $equipmentId = trim($data['equipmentId'] ?? $data['id'] ?? '');
    $qty = isset($data['qty']) ? max(1, (int) $data['qty']) : null;

    if (empty($equipmentId)) {
        jsonResponse(['success' => false, 'error' => 'ID do equipamento não informado.'], 400);
    }

    $db->beginTransaction();
    try {
        $stmt = $db->prepare("SELECT * FROM equipment WHERE id = ? FOR UPDATE");
        $stmt->execute([$equipmentId]);
        $eq = $stmt->fetch();
        if (!$eq) {
            throw new Exception("Equipamento não encontrado.");
        }

        $currentMaint = (int) ($eq['maintenance_qty'] ?? 0);
        if ($currentMaint <= 0) {
            throw new Exception("Este equipamento não possui unidades registradas em manutenção.");
        }

        $releaseQty = ($qty !== null && $qty <= $currentMaint) ? $qty : $currentMaint;
        $newMaint = max(0, $currentMaint - $releaseQty);
        $newAvail = min((int) $eq['total_qty'], (int) $eq['available_qty'] + $releaseQty);
        $newStatus = $newAvail > 0 ? 'available' : ($newMaint > 0 ? 'maintenance' : 'rented');

        $stmtUp = $db->prepare("UPDATE equipment SET available_qty = ?, maintenance_qty = ?, status = ?, maintenance_notes = NULL WHERE id = ?");
        $stmtUp->execute([$newAvail, $newMaint, $newStatus, $equipmentId]);

        $db->commit();
        logAudit('FINISH_MAINTENANCE', 'EQUIPMENT', $equipmentId, "Manutenção concluída para {$eq['name']} ({$releaseQty} un. devolvida ao estoque disponível) por {$user['name']}.", $user['id'], $user['name']);
        bumpSyncVersion('finish_maintenance');

        jsonResponse([
            'success' => true,
            'message' => "Manutenção finalizada com sucesso! {$releaseQty} unidade(s) de {$eq['name']} retornada(s) ao estoque disponível.",
            'availableQty' => $newAvail,
            'maintenanceQty' => $newMaint,
            'status' => $newStatus
        ]);
    } catch (Exception $e) {
        $db->rollBack();
        jsonResponse(['success' => false, 'error' => $e->getMessage()], 400);
    }
}

// ==============================================================================
// 5.1 SALVAR VISTORIA & FOTOS DE EQUIPAMENTOS (POST action=save_inspection)
// ==============================================================================
if ($method === 'POST' && $action === 'save_inspection') {
    $rentalId = trim($data['rentalId'] ?? $data['id'] ?? '');
    if (empty($rentalId)) {
        jsonResponse(['success' => false, 'error' => 'ID da locação não informado.'], 400);
    }

    $stmt = $db->prepare("SELECT * FROM rentals WHERE id = ?");
    $stmt->execute([$rentalId]);
    $rental = $stmt->fetch();
    if (!$rental) {
        jsonResponse(['success' => false, 'error' => 'Locação não encontrada.'], 404);
    }

    $rentalCode = $rental['code'];

    $pickupPhotos = null;
    if (isset($data['pickupPhotos']) && is_array($data['pickupPhotos'])) {
        $pickupPhotos = processRentalPhotos($data['pickupPhotos'], $rentalCode, 'saida');
    }

    $returnPhotos = null;
    if (isset($data['returnPhotos']) && is_array($data['returnPhotos'])) {
        $returnPhotos = processRentalPhotos($data['returnPhotos'], $rentalCode, 'retorno');
    }

    $pickupNotes = isset($data['pickupNotes']) ? trim($data['pickupNotes']) : null;
    $returnNotes = isset($data['returnNotes']) ? trim($data['returnNotes']) : null;
    $inspectionNotes = isset($data['inspectionNotes']) ? trim($data['inspectionNotes']) : null;
    $hasDamage = isset($data['hasDamage']) ? ($data['hasDamage'] ? 1 : 0) : null;

    if ($returnPhotos) {
        foreach ($returnPhotos as $rp) {
            if (($rp['condition'] ?? '') === 'damage') {
                $hasDamage = 1;
                break;
            }
        }
    }

    $fields = [];
    $params = [];

    if ($pickupPhotos !== null) {
        $fields[] = "pickup_photos_json = ?";
        $params[] = json_encode($pickupPhotos, JSON_UNESCAPED_UNICODE);
    }
    if ($returnPhotos !== null) {
        $fields[] = "return_photos_json = ?";
        $params[] = json_encode($returnPhotos, JSON_UNESCAPED_UNICODE);
    }
    if ($pickupNotes !== null) {
        $fields[] = "pickup_notes = ?";
        $params[] = $pickupNotes;
    }
    if ($returnNotes !== null) {
        $fields[] = "return_notes = ?";
        $params[] = $returnNotes;
    }
    if ($inspectionNotes !== null) {
        $fields[] = "inspection_notes = ?";
        $params[] = $inspectionNotes;
    }
    if ($hasDamage !== null) {
        $fields[] = "has_damage = ?";
        $params[] = $hasDamage;
    }

    if (!empty($fields)) {
        $params[] = $rentalId;
        $sql = "UPDATE rentals SET " . implode(", ", $fields) . " WHERE id = ?";
        $db->prepare($sql)->execute($params);
    }

    logAudit('SAVE_INSPECTION', 'RENTALS', $rentalId, "Vistoria e fotos atualizadas na locação {$rentalCode} por {$user['name']}.", $user['id'], $user['name']);
    bumpSyncVersion('save_inspection');

    $stmtUp = $db->prepare("SELECT * FROM rentals WHERE id = ?");
    $stmtUp->execute([$rentalId]);
    $updated = $stmtUp->fetch();

    jsonResponse([
        'success' => true,
        'message' => 'Vistoria e fotos de equipamentos salvas com sucesso!',
        'pickupPhotos' => !empty($updated['pickup_photos_json']) ? json_decode($updated['pickup_photos_json'], true) : [],
        'returnPhotos' => !empty($updated['return_photos_json']) ? json_decode($updated['return_photos_json'], true) : [],
        'pickupNotes' => $updated['pickup_notes'] ?? '',
        'returnNotes' => $updated['return_notes'] ?? '',
        'inspectionNotes' => $updated['inspection_notes'] ?? '',
        'hasDamage' => !empty($updated['has_damage'])
    ]);
}

// ==============================================================================
// 6. ATIVAR RESERVA / CONFIRMAR PAGAMENTO (POST action=activate_reservation)
// ==============================================================================
if ($method === 'POST' && $action === 'activate_reservation') {
    $rentalId = trim($data['rentalId'] ?? $data['id'] ?? '');
    $markPaid = !empty($data['markPaid']);

    if (empty($rentalId)) {
        jsonResponse(['success' => false, 'error' => 'ID da reserva não informado.'], 400);
    }

    $stmt = $db->prepare("SELECT * FROM rentals WHERE id = ?");
    $stmt->execute([$rentalId]);
    $rental = $stmt->fetch();

    if (!$rental) {
        jsonResponse(['success' => false, 'error' => 'Reserva/Locação não encontrada.'], 404);
    }

    $newPayStatus = $markPaid ? 'Pago' : $rental['payment_status'];
    $stmtUp = $db->prepare("UPDATE rentals SET status = 'active', payment_status = ? WHERE id = ?");
    $stmtUp->execute([$newPayStatus, $rentalId]);

    logAudit('ACTIVATE_RESERVATION', 'RENTALS', $rentalId, "Reserva {$rental['code']} confirmada e ativada como locação por {$user['name']}.", $user['id'], $user['name']);
    bumpSyncVersion('activate_reservation');

    jsonResponse([
        'success' => true,
        'message' => "Reserva {$rental['code']} confirmada com sucesso! Agora é uma locação ativa."
    ]);
}

// ==============================================================================
// 7. CANCELAR RESERVA OU LOCAÇÃO (POST action=cancel_rental)
// ==============================================================================
if ($method === 'POST' && $action === 'cancel_rental') {
    $rentalId = trim($data['rentalId'] ?? $data['id'] ?? '');
    $cancelReason = trim($data['cancelReason'] ?? 'Cancelado pelo operador');

    if (empty($rentalId)) {
        jsonResponse(['success' => false, 'error' => 'ID da reserva/locação não informado.'], 400);
    }

    $db->beginTransaction();
    try {
        $stmt = $db->prepare("SELECT * FROM rentals WHERE id = ? FOR UPDATE");
        $stmt->execute([$rentalId]);
        $rental = $stmt->fetch();

        if (!$rental) {
            throw new Exception("Registro não encontrado.");
        }

        if ($rental['status'] === 'cancelled') {
            throw new Exception("Este registro já se encontra cancelado.");
        }

        // Se estiver reservada ou ativa, devolve os itens de volta ao estoque disponível
        if ($rental['status'] === 'reserved' || $rental['status'] === 'active') {
            $items = !empty($rental['items_json']) ? json_decode($rental['items_json'], true) : [];
            foreach ($items as $it) {
                $eqId = $it['equipmentId'] ?? $it['id'] ?? '';
                $qty = (int) ($it['quantity'] ?? 1);

                $stmtEq = $db->prepare("SELECT total_qty, available_qty FROM equipment WHERE id = ? FOR UPDATE");
                $stmtEq->execute([$eqId]);
                $eq = $stmtEq->fetch();

                if ($eq) {
                    $newAvailable = min((int) $eq['total_qty'], (int) $eq['available_qty'] + $qty);
                    $status = $newAvailable > 0 ? 'available' : 'rented';

                    $db->prepare("UPDATE equipment SET available_qty = ?, status = ? WHERE id = ?")
                        ->execute([$newAvailable, $status, $eqId]);
                }
            }
        }

        $now = date('Y-m-d H:i:s');
        $stmtCancel = $db->prepare("UPDATE rentals SET status = 'cancelled', return_notes = ? WHERE id = ?");
        $stmtCancel->execute(["Cancelado em {$now}. Motivo: {$cancelReason}", $rentalId]);

        $db->commit();
        logAudit('CANCEL_RENTAL', 'RENTALS', $rentalId, "Reserva/Locação {$rental['code']} cancelada por {$user['name']}.", $user['id'], $user['name']);
        bumpSyncVersion('cancel_rental');

        jsonResponse([
            'success' => true,
            'message' => "Reserva/Locação {$rental['code']} cancelada com sucesso. Itens devolvidos ao estoque!"
        ]);
    } catch (Exception $e) {
        $db->rollBack();
        jsonResponse(['success' => false, 'error' => $e->getMessage()], 400);
    }
}

// ==============================================================================
// 8. EXCLUIR REGISTRO DO HISTÓRICO DE LOCAÇÕES / RESERVAS (POST action=delete_rental ou DELETE)
// Exclusivo para administradores
// ==============================================================================
if (($method === 'DELETE' || ($method === 'POST' && $action === 'delete_rental'))) {
    $rentalId = trim($_GET['id'] ?? $data['rentalId'] ?? $data['id'] ?? '');

    if (empty($rentalId)) {
        jsonResponse(['success' => false, 'error' => 'ID ou Código do registro não informado.'], 400);
    }

    try {
        // Busca o registro por ID ou por Código de Locação (ex: RES-202611-004)
        $stmt = $db->prepare("SELECT * FROM rentals WHERE id = ? OR code = ?");
        $stmt->execute([$rentalId, $rentalId]);
        $rental = $stmt->fetch();

        if (!$rental) {
            jsonResponse(['success' => false, 'error' => 'Registro não encontrado ou já excluído anteriormente.'], 404);
        }

        // Se ainda estiver ativa ou reservada, devolve os itens de volta ao estoque disponível
        if ($rental['status'] === 'reserved' || $rental['status'] === 'active' || $rental['status'] === 'overdue') {
            $items = !empty($rental['items_json']) ? json_decode($rental['items_json'], true) : [];
            if (is_array($items)) {
                foreach ($items as $it) {
                    $eqId = $it['equipmentId'] ?? $it['id'] ?? '';
                    $qty = (int) ($it['quantity'] ?? 1);

                    if (!empty($eqId)) {
                        $stmtEq = $db->prepare("SELECT total_qty, available_qty FROM equipment WHERE id = ?");
                        $stmtEq->execute([$eqId]);
                        $eq = $stmtEq->fetch();

                        if ($eq) {
                            $newAvailable = min((int) $eq['total_qty'], (int) $eq['available_qty'] + $qty);
                            $status = $newAvailable > 0 ? 'available' : 'rented';

                            $db->prepare("UPDATE equipment SET available_qty = ?, status = ? WHERE id = ?")
                                ->execute([$newAvailable, $status, $eqId]);
                        }
                    }
                }
            }
        }

        // Exclui o registro da tabela rentals (pelo id e pelo code)
        $stmtDel = $db->prepare("DELETE FROM rentals WHERE id = ? OR code = ?");
        $stmtDel->execute([$rental['id'], $rental['code']]);

        try {
            $adminName = $user['name'] ?? 'Administrador';
            $adminId = $user['id'] ?? 'admin';
            logAudit('DELETE_RENTAL', 'RENTALS', $rental['id'], "Reserva/Locação {$rental['code']} ({$rental['client_name']}) excluída permanentemente por {$adminName}.", $adminId, $adminName);
            bumpSyncVersion('delete_rental');
        } catch (Throwable $tAudit) {
            error_log('[GestorMF Audit Warning] ' . $tAudit->getMessage());
        }

        jsonResponse([
            'success' => true,
            'message' => "Registro {$rental['code']} excluído permanentemente do histórico com sucesso."
        ]);
    } catch (Throwable $e) {
        if ($db && $db->inTransaction()) {
            $db->rollBack();
        }
        error_log('[GestorMF Delete Rental Error] ' . $e->getMessage());
        jsonResponse(['success' => false, 'error' => 'Falha ao processar exclusão: ' . $e->getMessage()], 400);
    }
}

// Se nenhuma ação casar
jsonResponse(['success' => false, 'error' => 'Endpoint ou ação não suportada.'], 404);

