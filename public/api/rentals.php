<?php
// ==============================================================================
// GestorMF API - Sistema de Aluguel e Estoque de Equipamentos (MegaFilmes)
// ==============================================================================
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();

// 1. Garantir tabelas de Aluguel e Equipamentos
function ensureRentalsTables($db) {
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
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_equip_cat (category),
            INDEX idx_equip_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    try {
        $db->exec("ALTER TABLE equipment ADD COLUMN photo_url LONGTEXT NULL");
    } catch (Exception $e) {}
    try {
        $db->exec("ALTER TABLE equipment MODIFY photo_url LONGTEXT NULL");
    } catch (Exception $e) {}

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

    // Seed inicial dos 86 equipamentos se tabela estiver vazia
    $count = $db->query("SELECT COUNT(*) FROM equipment")->fetchColumn();
    if ($count == 0) {
        $initialEquipment = [
            // Câmeras (14 itens)
            ['name' => 'Sony a7III', 'category' => 'cameras', 'daily_rate' => 300, 'total_qty' => 8, 'rate_unit' => 'diária'],
            ['name' => 'Sony Fx30', 'category' => 'cameras', 'daily_rate' => 400, 'total_qty' => 6, 'rate_unit' => 'diária'],
            ['name' => 'Sony a7IV', 'category' => 'cameras', 'daily_rate' => 400, 'total_qty' => 3, 'rate_unit' => 'diária'],
            ['name' => 'Sony 6600', 'category' => 'cameras', 'daily_rate' => 200, 'total_qty' => 1, 'rate_unit' => 'diária'],
            ['name' => 'Canon eos RP', 'category' => 'cameras', 'daily_rate' => 200, 'total_qty' => 1, 'rate_unit' => 'diária'],
            ['name' => 'Canon eos 5D mark III', 'category' => 'cameras', 'daily_rate' => 100, 'total_qty' => 1, 'rate_unit' => 'diária'],
            ['name' => 'Sony HXR-NX5', 'category' => 'cameras', 'daily_rate' => 300, 'total_qty' => 4, 'rate_unit' => 'diária'],
            ['name' => 'Sony NX5 R', 'category' => 'cameras', 'daily_rate' => 300, 'total_qty' => 3, 'rate_unit' => 'diária'],
            ['name' => 'Sony PMW-EX3', 'category' => 'cameras', 'daily_rate' => 300, 'total_qty' => 1, 'rate_unit' => 'diária'],
            ['name' => 'Sony HXR-NX3', 'category' => 'cameras', 'daily_rate' => 300, 'total_qty' => 2, 'rate_unit' => 'diária'],
            ['name' => 'Sony PMW-EX1', 'category' => 'cameras', 'daily_rate' => 300, 'total_qty' => 1, 'rate_unit' => 'diária'],
            ['name' => 'GoPro 11 Black', 'category' => 'cameras', 'daily_rate' => 180, 'total_qty' => 1, 'rate_unit' => 'diária'],
            ['name' => 'GoPro 360', 'category' => 'cameras', 'daily_rate' => 400, 'total_qty' => 1, 'rate_unit' => 'diária'],
            ['name' => 'GoPro 8 Black', 'category' => 'cameras', 'daily_rate' => 150, 'total_qty' => 1, 'rate_unit' => 'diária'],

            // Lentes (10 itens)
            ['name' => 'Sony 24/70 f4', 'category' => 'lenses', 'daily_rate' => 200, 'total_qty' => 5, 'rate_unit' => 'diária'],
            ['name' => 'Sony 50mm 1.8', 'category' => 'lenses', 'daily_rate' => 180, 'total_qty' => 4, 'rate_unit' => 'diária'],
            ['name' => 'Sony 35mm 1.8', 'category' => 'lenses', 'daily_rate' => 250, 'total_qty' => 3, 'rate_unit' => 'diária'],
            ['name' => 'Sony 70/200 2.8', 'category' => 'lenses', 'daily_rate' => 350, 'total_qty' => 3, 'rate_unit' => 'diária'],
            ['name' => 'Sony 18/105 f4', 'category' => 'lenses', 'daily_rate' => 200, 'total_qty' => 3, 'rate_unit' => 'diária'],
            ['name' => 'Sony 85mm 1.8', 'category' => 'lenses', 'daily_rate' => 200, 'total_qty' => 2, 'rate_unit' => 'diária'],
            ['name' => 'Sigma 16mm 1.4', 'category' => 'lenses', 'daily_rate' => 200, 'total_qty' => 2, 'rate_unit' => 'diária'],
            ['name' => 'Sony 24/70 2.8', 'category' => 'lenses', 'daily_rate' => 350, 'total_qty' => 1, 'rate_unit' => 'diária'],
            ['name' => 'Canon 24/70 2.8', 'category' => 'lenses', 'daily_rate' => 200, 'total_qty' => 1, 'rate_unit' => 'diária'],
            ['name' => 'Canon 35mm 1.4', 'category' => 'lenses', 'daily_rate' => 150, 'total_qty' => 1, 'rate_unit' => 'diária'],

            // Vídeo (13 itens)
            ['name' => 'Monitor Feelworld 5.5 POL', 'category' => 'video', 'daily_rate' => 150, 'total_qty' => 5, 'rate_unit' => 'diária'],
            ['name' => 'Monitor Feelworld 7.0 POL', 'category' => 'video', 'daily_rate' => 200, 'total_qty' => 4, 'rate_unit' => 'diária'],
            ['name' => 'Transmissor Cosmo C1 Hollyland', 'category' => 'video', 'daily_rate' => 300, 'total_qty' => 2, 'rate_unit' => 'diária'],
            ['name' => 'Transmissor Mars 300 Pro Hollyland', 'category' => 'video', 'daily_rate' => 200, 'total_qty' => 4, 'rate_unit' => 'diária'],
            ['name' => 'Mesa de corte Switcher Estúdio 6+', 'category' => 'video', 'daily_rate' => 400, 'total_qty' => 1, 'rate_unit' => 'diária'],
            ['name' => 'Mesa de corte Blackmagic Mini Extreme Live', 'category' => 'video', 'daily_rate' => 600, 'total_qty' => 1, 'rate_unit' => 'diária'],
            ['name' => 'Mesa de corte Blackmagic ATEM Mini Pro', 'category' => 'video', 'daily_rate' => 400, 'total_qty' => 1, 'rate_unit' => 'diária'],
            ['name' => 'Mesa de corte NeoID Estúdio 4+', 'category' => 'video', 'daily_rate' => 400, 'total_qty' => 1, 'rate_unit' => 'diária'],
            ['name' => 'Mesa de corte ATEM 2 Blackmagic', 'category' => 'video', 'daily_rate' => 1200, 'total_qty' => 1, 'rate_unit' => 'diária'],
            ['name' => 'Placa de captura de vídeos HDMI', 'category' => 'video', 'daily_rate' => 150, 'total_qty' => 5, 'rate_unit' => 'diária'],
            ['name' => 'NeoID Tally', 'category' => 'video', 'daily_rate' => 250, 'total_qty' => 1, 'rate_unit' => 'diária'],
            ['name' => 'Teleprompter Profissional', 'category' => 'video', 'daily_rate' => 600, 'total_qty' => 2, 'rate_unit' => 'diária'],
            ['name' => 'Teleprompter Câmera Vídeo', 'category' => 'video', 'daily_rate' => 300, 'total_qty' => 1, 'rate_unit' => 'diária'],

            // Áudio (15 itens)
            ['name' => 'Microfone Takstar para câmera', 'category' => 'audio', 'daily_rate' => 50, 'total_qty' => 1, 'rate_unit' => 'diária'],
            ['name' => 'Microfone YOGA AT81', 'category' => 'audio', 'daily_rate' => 150, 'total_qty' => 1, 'rate_unit' => 'diária'],
            ['name' => 'Microfone Sennheiser MKH 600', 'category' => 'audio', 'daily_rate' => 500, 'total_qty' => 1, 'rate_unit' => 'diária'],
            ['name' => 'Microfone Boya', 'category' => 'audio', 'daily_rate' => 150, 'total_qty' => 1, 'rate_unit' => 'diária'],
            ['name' => 'Vara BOOM + Cápsula (Pricila)', 'category' => 'audio', 'daily_rate' => 150, 'total_qty' => 1, 'rate_unit' => 'diária'],
            ['name' => 'Gravador Zoom H5', 'category' => 'audio', 'daily_rate' => 200, 'total_qty' => 3, 'rate_unit' => 'diária'],
            ['name' => 'Mixer de Áudio Rode Caster Pro', 'category' => 'audio', 'daily_rate' => 400, 'total_qty' => 1, 'rate_unit' => 'diária'],
            ['name' => 'Lapela Hollyland Lark M2 Duo', 'category' => 'audio', 'daily_rate' => 200, 'total_qty' => 1, 'rate_unit' => 'diária'],
            ['name' => 'Lapela Hollyland Lark M2s', 'category' => 'audio', 'daily_rate' => 250, 'total_qty' => 1, 'rate_unit' => 'diária'],
            ['name' => 'Microfone Hollyland Lark 150 Duplo', 'category' => 'audio', 'daily_rate' => 150, 'total_qty' => 1, 'rate_unit' => 'diária'],
            ['name' => 'Mesa de som Digital Soundcraft Ui24R', 'category' => 'audio', 'daily_rate' => 600, 'total_qty' => 2, 'rate_unit' => 'diária'],
            ['name' => 'Caixa de som JBL EON615', 'category' => 'audio', 'daily_rate' => 300, 'total_qty' => 4, 'rate_unit' => 'diária'],
            ['name' => 'Interface de Áudio USB Behringer 4 canais', 'category' => 'audio', 'daily_rate' => 200, 'total_qty' => 1, 'rate_unit' => 'diária'],
            ['name' => 'Interface de áudio Behringer UMC204HD 2 canais', 'category' => 'audio', 'daily_rate' => 150, 'total_qty' => 1, 'rate_unit' => 'diária'],
            ['name' => 'Interface de áudio Behringer UM2 USB 1 canal', 'category' => 'audio', 'daily_rate' => 100, 'total_qty' => 1, 'rate_unit' => 'diária'],

            // Luz / Iluminação (22 itens)
            ['name' => 'LED Soleste 1700 de câmera', 'category' => 'lighting', 'daily_rate' => 150, 'total_qty' => 3, 'rate_unit' => 'diária'],
            ['name' => 'LED Yongnuo YN600L II', 'category' => 'lighting', 'daily_rate' => 200, 'total_qty' => 4, 'rate_unit' => 'diária'],
            ['name' => 'LED VL 49', 'category' => 'lighting', 'daily_rate' => 40, 'total_qty' => 3, 'rate_unit' => 'diária'],
            ['name' => 'LED Yongnuo YN300-II', 'category' => 'lighting', 'daily_rate' => 150, 'total_qty' => 1, 'rate_unit' => 'diária'],
            ['name' => 'Flash Godox V860 IIIC Bateria para Sony', 'category' => 'lighting', 'daily_rate' => 300, 'total_qty' => 4, 'rate_unit' => 'diária'],
            ['name' => 'Flash Godox V350s Bateria para Sony', 'category' => 'lighting', 'daily_rate' => 100, 'total_qty' => 4, 'rate_unit' => 'diária'],
            ['name' => 'Flash Godox TT350s Pilha para Sony', 'category' => 'lighting', 'daily_rate' => 50, 'total_qty' => 3, 'rate_unit' => 'diária'],
            ['name' => 'Flash Godox TT600s Pilha para Sony', 'category' => 'lighting', 'daily_rate' => 100, 'total_qty' => 1, 'rate_unit' => 'diária'],
            ['name' => 'Flash Canon 580EX II', 'category' => 'lighting', 'daily_rate' => 100, 'total_qty' => 1, 'rate_unit' => 'diária'],
            ['name' => 'Rádio Flash Godox Xpro S', 'category' => 'lighting', 'daily_rate' => 150, 'total_qty' => 4, 'rate_unit' => 'diária'],
            ['name' => 'Rádio Flash Godox X3 S', 'category' => 'lighting', 'daily_rate' => 200, 'total_qty' => 1, 'rate_unit' => 'diária'],
            ['name' => 'LED RGB Sokani X25', 'category' => 'lighting', 'daily_rate' => 50, 'total_qty' => 2, 'rate_unit' => 'diária'],
            ['name' => 'Softbox QR-P120', 'category' => 'lighting', 'daily_rate' => 200, 'total_qty' => 2, 'rate_unit' => 'diária'],
            ['name' => 'Rebatedor', 'category' => 'lighting', 'daily_rate' => 80, 'total_qty' => 4, 'rate_unit' => 'diária'],
            ['name' => 'Softbox Triopo 90cm', 'category' => 'lighting', 'daily_rate' => 100, 'total_qty' => 3, 'rate_unit' => 'diária'],
            ['name' => 'Softbox Godox 90cm', 'category' => 'lighting', 'daily_rate' => 100, 'total_qty' => 4, 'rate_unit' => 'diária'],
            ['name' => 'Softbox Godox 120cm', 'category' => 'lighting', 'daily_rate' => 120, 'total_qty' => 1, 'rate_unit' => 'diária'],
            ['name' => 'Softbox Globo Balão Chinês', 'category' => 'lighting', 'daily_rate' => 150, 'total_qty' => 2, 'rate_unit' => 'diária'],
            ['name' => 'Tocha SZ200 Bi', 'category' => 'lighting', 'daily_rate' => 300, 'total_qty' => 2, 'rate_unit' => 'diária'],
            ['name' => 'Tocha Godox FV200', 'category' => 'lighting', 'daily_rate' => 300, 'total_qty' => 4, 'rate_unit' => 'diária'],
            ['name' => 'Tocha AD600 Pro II', 'category' => 'lighting', 'daily_rate' => 600, 'total_qty' => 2, 'rate_unit' => 'diária'],
            ['name' => 'Tocha SL 200 III Bi', 'category' => 'lighting', 'daily_rate' => 300, 'total_qty' => 4, 'rate_unit' => 'diária'],

            // Acessórios (12 itens)
            ['name' => 'Grua 8m', 'category' => 'accessories', 'daily_rate' => 1200, 'total_qty' => 1, 'rate_unit' => 'diária'],
            ['name' => 'Grua 3,50m', 'category' => 'accessories', 'daily_rate' => 600, 'total_qty' => 1, 'rate_unit' => 'diária'],
            ['name' => 'Tripé de câmera TR 688V', 'category' => 'accessories', 'daily_rate' => 100, 'total_qty' => 10, 'rate_unit' => 'diária'],
            ['name' => 'Tripé de câmera NT777', 'category' => 'accessories', 'daily_rate' => 150, 'total_qty' => 2, 'rate_unit' => 'diária'],
            ['name' => 'Tripé de câmera Benro KH26P', 'category' => 'accessories', 'daily_rate' => 150, 'total_qty' => 5, 'rate_unit' => 'diária'],
            ['name' => 'Estabilizador Weebill 3S', 'category' => 'accessories', 'daily_rate' => 350, 'total_qty' => 2, 'rate_unit' => 'diária'],
            ['name' => 'Estabilizador Weebill S', 'category' => 'accessories', 'daily_rate' => 150, 'total_qty' => 3, 'rate_unit' => 'diária'],
            ['name' => 'Impressora térmica de fotos', 'category' => 'accessories', 'daily_rate' => 900, 'total_qty' => 1, 'rate_unit' => 'evento/hora'],
            ['name' => 'Comunicadores Hollyland 6S', 'category' => 'accessories', 'daily_rate' => 600, 'total_qty' => 1, 'rate_unit' => 'diária'],
            ['name' => 'Tripé de Luz', 'category' => 'accessories', 'daily_rate' => 150, 'total_qty' => 9, 'rate_unit' => 'diária'],
            ['name' => 'Cabos HDMI 50m', 'category' => 'accessories', 'daily_rate' => 150, 'total_qty' => 8, 'rate_unit' => 'diária'],
            ['name' => 'Comunicadores Hollyland Solidcom C1', 'category' => 'accessories', 'daily_rate' => 600, 'total_qty' => 1, 'rate_unit' => 'diária'],
        ];

        $stmt = $db->prepare("
            INSERT INTO equipment (id, name, category, daily_rate, rate_unit, total_qty, available_qty, serial_number, description, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, '', '', 'available')
        ");

        $i = 1;
        foreach ($initialEquipment as $item) {
            $id = 'eq-' . str_pad($i++, 3, '0', STR_PAD_LEFT);
            $stmt->execute([
                $id,
                $item['name'],
                $item['category'],
                $item['daily_rate'],
                $item['rate_unit'],
                $item['total_qty'],
                $item['total_qty'],
            ]);
        }
    }
}

// Inicializa tabelas e seeds se necessário
ensureRentalsTables($db);

$action = $_GET['action'] ?? '';

// ==============================================================================
// VERIFICAÇÃO PÚBLICA DE AUTENTICIDADE DE DOCUMENTOS (SEM EXIGÊNCIA DE LOGIN)
// Qualquer pessoa pode apontar a câmera para o QR Code do documento e validar
// ==============================================================================
if ($method === 'GET' && $action === 'verify') {
    $code = trim($_GET['code'] ?? '');
    if (empty($code)) {
        jsonResponse([
            'success' => false,
            'valid'   => false,
            'message' => 'Código de verificação do documento não fornecido.'
        ], 400);
    }

    $stmt = $db->prepare("SELECT * FROM rentals WHERE code = ? LIMIT 1");
    $stmt->execute([$code]);
    $rental = $stmt->fetch();

    if (!$rental) {
        jsonResponse([
            'success' => true,
            'valid'   => false,
            'message' => 'Documento não localizado na base oficial de locações da MegaFilmes.'
        ], 200);
    }

    $items = !empty($rental['items_json']) ? json_decode($rental['items_json'], true) : [];
    $safeItems = array_map(function($it) {
        return [
            'name'         => $it['name'] ?? 'Equipamento',
            'quantity'     => (int)($it['quantity'] ?? 1),
            'dailyRate'    => (float)($it['dailyRate'] ?? 0),
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

    // Hash determinístico de autenticidade
    $strForHash = $rental['code'] . '-' . $rental['total_amount'] . '-' . $rental['start_date'] . '-' . $authorizer;
    $hash = 0;
    for ($i = 0; $i < strlen($strForHash); $i++) {
        $hash = ($hash * 31 + ord($strForHash[$i])) % 4294967296;
    }
    $authSignature = 'AUTH-MF-' . strtoupper(str_pad(dechex($hash), 8, '0', STR_PAD_LEFT));

    jsonResponse([
        'success'  => true,
        'valid'    => true,
        'document' => [
            'code'                 => $rental['code'],
            'type'                 => $isReserved ? 'Comprovante de Agendamento & Reserva' : 'Contrato de Locação & Termo de Responsabilidade',
            'status'               => $rental['status'],
            'clientName'           => $rental['client_name'],
            'clientDocumentMasked' => $maskedDoc,
            'clientPhoneMasked'    => $maskedPhone,
            'startDate'            => $rental['start_date'],
            'startTime'            => $rental['start_time'] ?? '08:00',
            'endDate'              => $rental['end_date'],
            'endTime'              => $rental['end_time'] ?? '18:00',
            'totalDays'            => (int)$rental['total_days'],
            'totalAmount'          => (float)$rental['total_amount'],
            'paymentStatus'        => $rental['payment_status'] ?? 'Pendente',
            'paymentMethod'        => $rental['payment_method'] ?? 'PIX',
            'authorizedBy'         => $authorizer,
            'authSignature'        => $authSignature,
            'issuedAt'             => $rental['created_at'],
            'items'                => $safeItems,
            'legalFramework'       => 'Lei Federal nº 10.406/2002 (Código Civil) e Lei Federal nº 14.063/2020',
            'issuer'               => [
                'name'    => 'Mega Filmes e Fotografia (RG DA SILVA - ME)',
                'cnpj'    => '21.973.641/0001-00',
                'address' => 'Alameda dos Tatus, 155 - Dr. Silvio Leite, Boa Vista - RR',
                'system'  => 'GestorMF'
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

    $equipment = array_map(function($e) {
        return [
            'id'           => $e['id'],
            'name'         => $e['name'],
            'category'     => $e['category'],
            'dailyRate'    => (float)$e['daily_rate'],
            'rateUnit'     => $e['rate_unit'] ?? 'diária',
            'totalQty'     => (int)$e['total_qty'],
            'availableQty' => (int)$e['available_qty'],
            'serialNumber' => $e['serial_number'] ?? '',
            'photoUrl'     => $e['photo_url'] ?? '',
            'description'  => $e['description'] ?? '',
            'status'       => $e['status'] ?? 'available',
            'createdAt'    => $e['created_at'],
            'updatedAt'    => $e['updated_at']
        ];
    }, $rawEq);

    // Busca locações
    $stmtRent = $db->query("SELECT * FROM rentals ORDER BY created_at DESC");
    $rawRent = $stmtRent->fetchAll();

    $rentals = array_map(function($r) {
        $items = !empty($r['items_json']) ? json_decode($r['items_json'], true) : [];
        return [
            'id'             => $r['id'],
            'code'           => $r['code'],
            'clientName'     => $r['client_name'],
            'clientDocument' => $r['client_document'] ?? '',
            'clientPhone'    => $r['client_phone'] ?? '',
            'clientEmail'    => $r['client_email'] ?? '',
            'clientAddress'  => $r['client_address'] ?? '',
            'startDate'      => $r['start_date'],
            'startTime'      => $r['start_time'] ?? '08:00',
            'endDate'        => $r['end_date'],
            'endTime'        => $r['end_time'] ?? '18:00',
            'totalDays'      => (int)$r['total_days'],
            'subtotal'       => (float)$r['subtotal'],
            'discount'       => (float)$r['discount'],
            'totalAmount'    => (float)$r['total_amount'],
            'paymentMethod'  => $r['payment_method'] ?? 'PIX',
            'paymentStatus'  => $r['payment_status'] ?? 'Pendente',
            'status'         => $r['status'] ?? 'active',
            'notes'          => $r['notes'] ?? '',
            'items'          => is_array($items) ? $items : [],
            'createdBy'      => $r['created_by'] ?? 'Sistema',
            'createdAt'      => $r['created_at'],
            'updatedAt'      => $r['updated_at'],
            'returnedAt'     => $r['returned_at'],
            'returnNotes'    => $r['return_notes'] ?? ''
        ];
    }, $rawRent);

    // Métricas para Dashboard
    $totalEquipments = array_sum(array_column($equipment, 'totalQty'));
    $availableEquipments = array_sum(array_column($equipment, 'availableQty'));
    $rentedEquipments = $totalEquipments - $availableEquipments;

    $activeRentals = count(array_filter($rentals, fn($r) => $r['status'] === 'active'));
    $overdueRentals = count(array_filter($rentals, fn($r) => $r['status'] === 'overdue'));

    // Alertas de Devoluções Próximas (vence hoje ou amanhã)
    $todayStr = date('Y-m-d');
    $tomorrowStr = date('Y-m-d', strtotime('+1 day'));
    $dueSoonRentals = array_values(array_filter($rentals, function($r) use ($todayStr, $tomorrowStr) {
        return ($r['status'] === 'active' || $r['status'] === 'overdue') && 
               ($r['endDate'] <= $tomorrowStr);
    }));

    jsonResponse([
        'success'   => true,
        'equipment' => $equipment,
        'rentals'   => $rentals,
        'summary'   => [
            'totalEquipments'     => $totalEquipments,
            'availableEquipments' => $availableEquipments,
            'rentedEquipments'    => $rentedEquipments,
            'activeRentals'       => $activeRentals,
            'overdueRentals'      => $overdueRentals,
            'dueSoonCount'        => count($dueSoonRentals)
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
    $dailyRate = (float)($data['dailyRate'] ?? $data['daily_rate'] ?? 0);
    $rateUnit = trim($data['rateUnit'] ?? 'diária');
    $totalQty = max(1, (int)($data['totalQty'] ?? 1));
    $serialNumber = trim($data['serialNumber'] ?? '');
    $photoUrl = trim($data['photoUrl'] ?? $data['photo_url'] ?? '');
    $description = trim($data['description'] ?? '');

    if (empty($name)) {
        jsonResponse(['success' => false, 'error' => 'O nome do equipamento é obrigatório.'], 400);
    }

    // Processa upload de foto em base64 e salva como arquivo físico no servidor
    if (!empty($photoUrl) && strpos($photoUrl, 'data:image/') === 0) {
        $parts = explode(',', $photoUrl, 2);
        if (count($parts) === 2) {
            $imageData = base64_decode($parts[1]);
            if ($imageData !== false && strlen($imageData) > 0) {
                // Tenta múltiplos caminhos possíveis na hospedagem para garantir gravação física
                $possibleDirs = [
                    __DIR__ . '/../images/equipment',
                    dirname(__DIR__) . '/images/equipment',
                    dirname(__DIR__, 2) . '/images/equipment',
                    ($_SERVER['DOCUMENT_ROOT'] ?? '') . '/images/equipment',
                ];
                $saved = false;
                foreach ($possibleDirs as $equipDir) {
                    if (empty($equipDir)) continue;
                    if (!is_dir($equipDir)) {
                        @mkdir($equipDir, 0777, true);
                    }
                    if (is_dir($equipDir)) {
                        $cleanId = preg_replace('/[^a-zA-Z0-9_-]/', '', $id);
                        $filename = $cleanId . '.jpg';
                        $filePath = $equipDir . '/' . $filename;
                        if (@file_put_contents($filePath, $imageData)) {
                            $photoUrl = '/images/equipment/' . $filename . '?t=' . time();
                            $saved = true;
                            break;
                        }
                    }
                }
                // Se o arquivo físico falhar por permissão de pasta no servidor,
                // $photoUrl permanece o dataUrl (base64) e é salvo no LONGTEXT do banco,
                // garantindo que a foto NUNCA seja perdida!
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
            $diff = $totalQty - (int)$existing['total_qty'];
            $newAvailable = max(0, (int)$existing['available_qty'] + $diff);
            $status = $newAvailable > 0 ? 'available' : 'rented';

            $stmtUp = $db->prepare("
                UPDATE equipment 
                SET name = ?, category = ?, daily_rate = ?, rate_unit = ?, total_qty = ?, available_qty = ?, serial_number = ?, photo_url = ?, description = ?, status = ?
                WHERE id = ?
            ");
            $stmtUp->execute([
                $name, $category, $dailyRate, $rateUnit, $totalQty, $newAvailable, $serialNumber, $photoUrl, $description, $status, $id
            ]);
        } else {
            $stmtIns = $db->prepare("
                INSERT INTO equipment (id, name, category, daily_rate, rate_unit, total_qty, available_qty, serial_number, photo_url, description, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available')
            ");
            $stmtIns->execute([
                $id, $name, $category, $dailyRate, $rateUnit, $totalQty, $totalQty, $serialNumber, $photoUrl, $description
            ]);
        }
    } catch (Exception $e) {
        jsonResponse(['success' => false, 'error' => 'Erro ao salvar no banco de dados: ' . $e->getMessage()], 500);
    }

    logAudit('SAVE_EQUIPMENT', 'EQUIPMENT', $id, "Equipamento {$name} salvo por {$user['name']}.", $user['id'], $user['name']);
    bumpSyncVersion('save_equipment');

    jsonResponse([
        'success'  => true,
        'id'       => $id,
        'photoUrl' => $photoUrl,
        'message'  => 'Equipamento salvo com sucesso.'
    ]);
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

    if ($eq && (int)$eq['available_qty'] < (int)$eq['total_qty']) {
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
    if (empty($items)) {
        jsonResponse(['success' => false, 'error' => 'Selecione ao menos um equipamento para locação.'], 400);
    }

    // Calcula dias de locação
    $startTs = strtotime($startDate);
    $endTs = strtotime($endDate);
    $diffDays = max(1, (int)round(($endTs - $startTs) / 86400));
    if ($diffDays < 1) $diffDays = 1;

    // Valida disponibilidade de cada item e calcula subtotal
    $subtotal = 0;
    $validatedItems = [];

    $db->beginTransaction();

    try {
        foreach ($items as $it) {
            $eqId = $it['equipmentId'] ?? $it['id'] ?? '';
            $qty = max(1, (int)($it['quantity'] ?? 1));

            $stmtCheck = $db->prepare("SELECT * FROM equipment WHERE id = ? FOR UPDATE");
            $stmtCheck->execute([$eqId]);
            $eq = $stmtCheck->fetch();

            if (!$eq) {
                throw new Exception("Equipamento não encontrado: " . ($it['name'] ?? $eqId));
            }

            if ((int)$eq['available_qty'] < $qty) {
                throw new Exception("Estoque insuficiente para '{$eq['name']}'. Disponível: {$eq['available_qty']} un, Solicitado: {$qty} un.");
            }

            $rate = (float)($it['dailyRate'] ?? $eq['daily_rate']);
            $itemTotal = $rate * $qty * $diffDays;
            $subtotal += $itemTotal;

            // Baixa estoque disponível
            $newAvailable = (int)$eq['available_qty'] - $qty;
            $newStatus = $newAvailable == 0 ? 'rented' : 'available';

            $stmtUp = $db->prepare("UPDATE equipment SET available_qty = ?, status = ? WHERE id = ?");
            $stmtUp->execute([$newAvailable, $newStatus, $eqId]);

            $validatedItems[] = [
                'equipmentId'  => $eqId,
                'name'         => $eq['name'],
                'category'     => $eq['category'],
                'serialNumber' => $eq['serial_number'] ?? '',
                'quantity'     => $qty,
                'dailyRate'    => $rate,
                'rateUnit'     => $eq['rate_unit'] ?? 'diária',
                'itemTotal'    => $itemTotal
            ];
        }

        $discount = (float)($data['discount'] ?? 0);
        $totalAmount = max(0, $subtotal - $discount);
        $paymentMethod = trim($data['paymentMethod'] ?? 'PIX');
        $paymentStatus = trim($data['paymentStatus'] ?? 'Pendente');
        $notes = trim($data['notes'] ?? '');

        // Define status: 'reserved' (Agendamento/Reserva) ou 'active' (Locação ativa)
        $status = trim($data['status'] ?? '');
        if (!in_array($status, ['active', 'reserved'])) {
            $status = ($paymentStatus === 'Pago') ? 'active' : 'reserved';
        }

        // Prefixo do código: RES- para reservas/agendamentos, LOC- para locações diretas
        $prefix = ($status === 'reserved') ? ('RES-' . date('Ym') . '-') : ('LOC-' . date('Ym') . '-');
        $stmtSeq = $db->query("SELECT COUNT(*) FROM rentals WHERE code LIKE '{$prefix}%'");
        $seq = (int)$stmtSeq->fetchColumn() + 1;
        $code = $prefix . str_pad($seq, 3, '0', STR_PAD_LEFT);

        $rentalId = 'rent-' . bin2hex(random_bytes(8));

        $stmtRent = $db->prepare("
            INSERT INTO rentals (
                id, code, client_name, client_document, client_phone, client_email, client_address,
                start_date, start_time, end_date, end_time, total_days,
                subtotal, discount, total_amount, payment_method, payment_status, status,
                notes, items_json, created_by
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?
            )
        ");

        $stmtRent->execute([
            $rentalId, $code, $clientName, $clientDocument, $clientPhone, $clientEmail, $clientAddress,
            $startDate, $startTime, $endDate, $endTime, $diffDays,
            $subtotal, $discount, $totalAmount, $paymentMethod, $paymentStatus, $status,
            $notes, json_encode($validatedItems, JSON_UNESCAPED_UNICODE), $user['name']
        ]);

        $db->commit();

        $actionLabel = ($status === 'reserved') ? "Reserva/Agendamento" : "Locação";
        logAudit('CREATE_RENTAL', 'RENTALS', $rentalId, "{$actionLabel} {$code} para {$clientName} criada por {$user['name']}.", $user['id'], $user['name']);
        bumpSyncVersion('create_rental');

        jsonResponse([
            'success'   => true,
            'rentalId'  => $rentalId,
            'code'      => $code,
            'status'    => $status,
            'message'   => "{$actionLabel} {$code} gerada com sucesso!"
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

        // Devolve cada item ao estoque
        foreach ($items as $it) {
            $eqId = $it['equipmentId'] ?? $it['id'] ?? '';
            $qty = (int)($it['quantity'] ?? 1);

            $stmtEq = $db->prepare("SELECT total_qty, available_qty FROM equipment WHERE id = ? FOR UPDATE");
            $stmtEq->execute([$eqId]);
            $eq = $stmtEq->fetch();

            if ($eq) {
                $newAvailable = min((int)$eq['total_qty'], (int)$eq['available_qty'] + $qty);
                $status = $newAvailable > 0 ? 'available' : 'rented';

                $db->prepare("UPDATE equipment SET available_qty = ?, status = ? WHERE id = ?")
                   ->execute([$newAvailable, $status, $eqId]);
            }
        }

        // Atualiza locação para returned
        $now = date('Y-m-d H:i:s');
        $db->prepare("
            UPDATE rentals 
            SET status = 'returned', returned_at = ?, return_notes = ?
            WHERE id = ?
        ")->execute([$now, $returnNotes, $rentalId]);

        $db->commit();

        logAudit('RETURN_RENTAL', 'RENTALS', $rentalId, "Devolução da locação {$rental['code']} confirmada por {$user['name']}.", $user['id'], $user['name']);
        bumpSyncVersion('return_rental');

        jsonResponse([
            'success' => true,
            'message' => "Devolução da locação {$rental['code']} registrada com sucesso. Equipamentos liberados no estoque!"
        ]);

    } catch (Exception $e) {
        $db->rollBack();
        jsonResponse(['success' => false, 'error' => $e->getMessage()], 400);
    }
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
                $qty = (int)($it['quantity'] ?? 1);

                $stmtEq = $db->prepare("SELECT total_qty, available_qty FROM equipment WHERE id = ? FOR UPDATE");
                $stmtEq->execute([$eqId]);
                $eq = $stmtEq->fetch();

                if ($eq) {
                    $newAvailable = min((int)$eq['total_qty'], (int)$eq['available_qty'] + $qty);
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

// Se nenhuma ação casar
jsonResponse(['success' => false, 'error' => 'Endpoint ou ação não suportada.'], 404);

