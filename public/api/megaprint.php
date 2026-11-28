<?php
// ==============================================================================
// GestorMF API - Sistema Comercial Mega Print (Orçamentos, Vendas e Produtos)
// ==============================================================================
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();

// 1. Garantir tabelas do módulo Mega Print via migração versionada
function ensureMegaPrintTables($db)
{
    runVersionedMigration($db, 'schema_megaprint_v1', function ($db) {
        // Tabela de Clientes da Mega Print
        $db->exec("
            CREATE TABLE IF NOT EXISTS megaprint_clients (
                id VARCHAR(64) PRIMARY KEY,
                name VARCHAR(191) NOT NULL,
                cpf_cnpj VARCHAR(64) NULL,
                phone VARCHAR(64) NULL,
                email VARCHAR(191) NULL,
                address TEXT NULL,
                notes TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_mp_client_name (name)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");

        // Tabela de Produtos e Serviços Gráficos (suporta m² e unidade)
        $db->exec("
            CREATE TABLE IF NOT EXISTS megaprint_items (
                id VARCHAR(64) PRIMARY KEY,
                name VARCHAR(191) NOT NULL,
                type VARCHAR(32) NOT NULL DEFAULT 'product',
                calc_type VARCHAR(32) NOT NULL DEFAULT 'unit',
                category VARCHAR(64) NOT NULL DEFAULT 'Impressão',
                price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
                cost DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
                unit_label VARCHAR(32) NOT NULL DEFAULT 'un',
                min_m2 DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
                description TEXT NULL,
                stock_qty INT NOT NULL DEFAULT 0,
                active TINYINT(1) NOT NULL DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_mp_items_cat (category),
                INDEX idx_mp_items_type (type)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");

        // Tabela de Orçamentos
        $db->exec("
            CREATE TABLE IF NOT EXISTS megaprint_quotes (
                id VARCHAR(64) PRIMARY KEY,
                code VARCHAR(32) NOT NULL UNIQUE,
                client_id VARCHAR(64) NULL,
                client_name VARCHAR(191) NOT NULL,
                client_phone VARCHAR(64) NULL,
                client_email VARCHAR(191) NULL,
                client_document VARCHAR(64) NULL,
                seller_id VARCHAR(64) NULL,
                seller_name VARCHAR(191) NULL,
                issue_date DATE NOT NULL,
                expiry_date DATE NOT NULL,
                items_json LONGTEXT NOT NULL,
                subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
                discount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
                total DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
                status VARCHAR(32) NOT NULL DEFAULT 'Pendente',
                sale_id VARCHAR(64) NULL,
                payment_method VARCHAR(64) NULL,
                delivery_deadline VARCHAR(64) NULL,
                notes TEXT NULL,
                created_by VARCHAR(64) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_mp_quote_status (status),
                INDEX idx_mp_quote_date (issue_date)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");

        // Tabela de Vendas e Pedidos em Produção
        $db->exec("
            CREATE TABLE IF NOT EXISTS megaprint_sales (
                id VARCHAR(64) PRIMARY KEY,
                code VARCHAR(32) NOT NULL UNIQUE,
                quote_id VARCHAR(64) NULL,
                client_id VARCHAR(64) NULL,
                client_name VARCHAR(191) NOT NULL,
                client_phone VARCHAR(64) NULL,
                seller_name VARCHAR(191) NULL,
                sale_date DATE NOT NULL,
                delivery_date DATE NULL,
                items_json LONGTEXT NOT NULL,
                total DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
                paid_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
                payment_status VARCHAR(32) NOT NULL DEFAULT 'Pendente',
                production_status VARCHAR(32) NOT NULL DEFAULT 'Em Produção',
                sale_type VARCHAR(32) NOT NULL DEFAULT 'Sob Encomenda',
                notes TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_mp_sale_prod (production_status),
                INDEX idx_mp_sale_pay (payment_status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");

        // Seed inicial de itens essenciais caso tabela vazia
        $cnt = (int)$db->query("SELECT COUNT(*) FROM megaprint_items")->fetchColumn();
        if ($cnt === 0) {
            $seeds = [
                ['mp-item-1', 'Lona Frontlight 440g (Banner / Fachada)', 'product', 'm2', 'Lonas & Banners', 55.00, 22.00, 'm²', 0.5, 'Impressão digital em lona alta gramatura com acabamento bastão/ilhós'],
                ['mp-item-2', 'Adesivo Vinil Brilho / Fosco', 'product', 'm2', 'Adesivos', 68.00, 25.00, 'm²', 0.2, 'Vinil adesivo automotivo e promocional com corte reto ou contorno'],
                ['mp-item-3', 'Adesivo Perfurado p/ Vidro', 'product', 'm2', 'Adesivos', 85.00, 35.00, 'm²', 0.5, 'Película perfurada com visão unilateral para veículos e vitrines'],
                ['mp-item-4', 'Placa Rígida em PS / PVC 2mm', 'product', 'm2', 'Placas & Sinalização', 140.00, 50.00, 'm²', 0.25, 'Placa de sinalização interna e externa com adesivo impresso laminado'],
                ['mp-item-5', 'Placa em ACM com Adesivo Laminado', 'product', 'm2', 'Fachadas', 280.00, 110.00, 'm²', 0.5, 'Painel em Alumínio Composto para fachadas comerciais'],
                ['mp-item-6', 'Cartão de Visita 4x4 Couchê 300g (1.000 un)', 'product', 'unit', 'Impressos Gráficos', 95.00, 40.00, 'milheiro', 0, 'Cartão couchê 300g com verniz total frente'],
                ['mp-item-7', 'Panfleto 10x14cm Couchê 90g (2.500 un)', 'product', 'unit', 'Impressos Gráficos', 210.00, 90.00, 'pacote', 0, 'Panfletos promocionais coloridos frente e verso'],
                ['mp-item-8', 'Criação / Ajuste de Arte Gráfica', 'service', 'unit', 'Serviços de Design', 60.00, 0.00, 'un', 0, 'Desenvolvimento profissional de layout e fechamento para impressão'],
                ['mp-item-9', 'Instalação e Aplicação de Adesivo / Lona', 'service', 'unit', 'Serviços de Campo', 120.00, 30.00, 'serviço', 0, 'Equipe de campo para aplicação no local do cliente'],
                ['mp-item-10', 'Totem Fotográfico (Estrutura e Personalização)', 'product', 'unit', 'Totens & Eventos', 350.00, 120.00, 'un', 0, 'Impressão e adesivagem personalizada de totem para eventos'],
            ];

            $stmtIns = $db->prepare("INSERT INTO megaprint_items (id, name, type, calc_type, category, price, cost, unit_label, min_m2, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            foreach ($seeds as $s) {
                $stmtIns->execute($s);
            }
        }
    });
}

ensureMegaPrintTables($db);

$action = $_GET['action'] ?? '';

// 2. BOOTSTRAP / LISTAR DADOS GERAIS
if ($method === 'GET' && ($action === '' || $action === 'bootstrap')) {
    $user = requireAuth();

    // Orçamentos
    $stmtQ = $db->query("SELECT * FROM megaprint_quotes ORDER BY issue_date DESC, created_at DESC LIMIT 500");
    $quotes = $stmtQ->fetchAll(PDO::FETCH_ASSOC);
    foreach ($quotes as &$q) {
        $q['items'] = json_decode($q['items_json'] ?? '[]', true) ?: [];
        $q['subtotal'] = (float)$q['subtotal'];
        $q['discount'] = (float)$q['discount'];
        $q['total'] = (float)$q['total'];
    }

    // Vendas
    $stmtS = $db->query("SELECT * FROM megaprint_sales ORDER BY sale_date DESC, created_at DESC LIMIT 500");
    $sales = $stmtS->fetchAll(PDO::FETCH_ASSOC);
    foreach ($sales as &$s) {
        $s['items'] = json_decode($s['items_json'] ?? '[]', true) ?: [];
        $s['total'] = (float)$s['total'];
        $s['paid_amount'] = (float)$s['paid_amount'];
    }

    // Itens (Produtos & Serviços)
    $stmtI = $db->query("SELECT * FROM megaprint_items WHERE active = 1 ORDER BY category ASC, name ASC");
    $items = $stmtI->fetchAll(PDO::FETCH_ASSOC);
    foreach ($items as &$it) {
        $it['price'] = (float)$it['price'];
        $it['cost'] = (float)$it['cost'];
        $it['min_m2'] = (float)$it['min_m2'];
        $it['stock_qty'] = (int)$it['stock_qty'];
        $it['active'] = (bool)$it['active'];
    }

    // Clientes
    $stmtC = $db->query("SELECT * FROM megaprint_clients ORDER BY name ASC LIMIT 1000");
    $clients = $stmtC->fetchAll(PDO::FETCH_ASSOC);

    jsonResponse([
        'success' => true,
        'quotes' => $quotes,
        'sales' => $sales,
        'items' => $items,
        'clients' => $clients,
    ]);
}

// 3. SALVAR OU ATUALIZAR ORÇAMENTO (POST ?action=save_quote)
if ($method === 'POST' && $action === 'save_quote') {
    $user = requireAuth();
    $data = json_decode(file_get_contents('php://input'), true);

    if (!$data || empty($data['client_name'])) {
        jsonError('Nome do cliente é obrigatório.', 422);
    }

    $id = !empty($data['id']) ? $data['id'] : 'mpq-' . round(microtime(true) * 1000);
    $items = is_array($data['items'] ?? null) ? $data['items'] : [];
    $itemsJson = json_encode($items, JSON_UNESCAPED_UNICODE);

    $issueDate = !empty($data['issue_date']) ? $data['issue_date'] : date('Y-m-d');
    $expiryDate = !empty($data['expiry_date']) ? $data['expiry_date'] : date('Y-m-d', strtotime('+30 days'));

    $subtotal = 0;
    foreach ($items as $it) {
        $subtotal += (float)($it['total'] ?? $it['subtotal'] ?? 0);
    }
    $discount = (float)($data['discount'] ?? 0);
    $total = max(0, $subtotal - $discount);

    // Gerar código único se não existir
    $code = !empty($data['code']) ? $data['code'] : null;
    if (!$code) {
        $prefix = 'MP-' . date('Ym', strtotime($issueDate));
        $stmtSeq = $db->prepare("SELECT COUNT(*) FROM megaprint_quotes WHERE code LIKE ?");
        $stmtSeq->execute(["{$prefix}%"]);
        $seq = (int)$stmtSeq->fetchColumn() + 1;
        $code = sprintf("%s-%03d", $prefix, $seq);
    }

    // Upsert
    $stmt = $db->prepare("
        INSERT INTO megaprint_quotes (
            id, code, client_id, client_name, client_phone, client_email, client_document,
            seller_id, seller_name, issue_date, expiry_date, items_json,
            subtotal, discount, total, status, payment_method, delivery_deadline, notes, created_by
        ) VALUES (
            :id, :code, :client_id, :client_name, :client_phone, :client_email, :client_document,
            :seller_id, :seller_name, :issue_date, :expiry_date, :items_json,
            :subtotal, :discount, :total, :status, :payment_method, :delivery_deadline, :notes, :created_by
        )
        ON DUPLICATE KEY UPDATE
            client_id = VALUES(client_id),
            client_name = VALUES(client_name),
            client_phone = VALUES(client_phone),
            client_email = VALUES(client_email),
            client_document = VALUES(client_document),
            seller_id = VALUES(seller_id),
            seller_name = VALUES(seller_name),
            issue_date = VALUES(issue_date),
            expiry_date = VALUES(expiry_date),
            items_json = VALUES(items_json),
            subtotal = VALUES(subtotal),
            discount = VALUES(discount),
            total = VALUES(total),
            status = VALUES(status),
            payment_method = VALUES(payment_method),
            delivery_deadline = VALUES(delivery_deadline),
            notes = VALUES(notes)
    ");

    $stmt->execute([
        ':id' => $id,
        ':code' => $code,
        ':client_id' => $data['client_id'] ?? null,
        ':client_name' => trim($data['client_name']),
        ':client_phone' => $data['client_phone'] ?? null,
        ':client_email' => $data['client_email'] ?? null,
        ':client_document' => $data['client_document'] ?? null,
        ':seller_id' => $data['seller_id'] ?? $user['id'] ?? null,
        ':seller_name' => $data['seller_name'] ?? $user['name'] ?? 'Mega Print',
        ':issue_date' => $issueDate,
        ':expiry_date' => $expiryDate,
        ':items_json' => $itemsJson,
        ':subtotal' => $subtotal,
        ':discount' => $discount,
        ':total' => $total,
        ':status' => $data['status'] ?? 'Pendente',
        ':payment_method' => $data['payment_method'] ?? 'À Vista / Pix',
        ':delivery_deadline' => $data['delivery_deadline'] ?? '2 a 3 dias úteis',
        ':notes' => $data['notes'] ?? '',
        ':created_by' => $user['id'] ?? null,
    ]);

    // Se cliente tiver nome e ainda não existir no cadastro, salvar automaticamente
    if (!empty($data['client_name'])) {
        $stmtChkCl = $db->prepare("SELECT id FROM megaprint_clients WHERE LOWER(name) = ? LIMIT 1");
        $stmtChkCl->execute([strtolower(trim($data['client_name']))]);
        if (!$stmtChkCl->fetchColumn()) {
            $clId = 'mpc-' . round(microtime(true) * 1000);
            $stmtNewCl = $db->prepare("INSERT INTO megaprint_clients (id, name, cpf_cnpj, phone, email) VALUES (?, ?, ?, ?, ?)");
            $stmtNewCl->execute([
                $clId,
                trim($data['client_name']),
                $data['client_document'] ?? null,
                $data['client_phone'] ?? null,
                $data['client_email'] ?? null
            ]);
        }
    }

    jsonResponse([
        'success' => true,
        'id' => $id,
        'code' => $code,
        'message' => 'Orçamento salvo com sucesso!'
    ]);
}

// 4. CONVERTER ORÇAMENTO EM VENDA / PEDIDO (POST ?action=convert_to_sale)
if ($method === 'POST' && $action === 'convert_to_sale') {
    $user = requireAuth();
    $data = json_decode(file_get_contents('php://input'), true);

    $quoteId = $data['quote_id'] ?? '';
    if (!$quoteId) {
        jsonError('ID do orçamento não informado.', 422);
    }

    $stmtQ = $db->prepare("SELECT * FROM megaprint_quotes WHERE id = ? LIMIT 1");
    $stmtQ->execute([$quoteId]);
    $quote = $stmtQ->fetch(PDO::FETCH_ASSOC);

    if (!$quote) {
        jsonError('Orçamento não encontrado.', 404);
    }

    // Criar Venda vinculada
    $saleId = 'mps-' . round(microtime(true) * 1000);
    $prefix = 'VND-' . date('Ym');
    $stmtSeq = $db->prepare("SELECT COUNT(*) FROM megaprint_sales WHERE code LIKE ?");
    $stmtSeq->execute(["{$prefix}%"]);
    $seq = (int)$stmtSeq->fetchColumn() + 1;
    $saleCode = sprintf("%s-%03d", $prefix, $seq);

    $stmtInsS = $db->prepare("
        INSERT INTO megaprint_sales (
            id, code, quote_id, client_id, client_name, client_phone, seller_name,
            sale_date, delivery_date, items_json, total, paid_amount, payment_status,
            production_status, sale_type, notes
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
    ");

    $deliveryDate = !empty($data['delivery_date']) ? $data['delivery_date'] : date('Y-m-d', strtotime('+3 days'));
    $paidAmount = isset($data['paid_amount']) ? (float)$data['paid_amount'] : (float)$quote['total'];
    $paymentStatus = $paidAmount >= (float)$quote['total'] ? 'Pago' : ($paidAmount > 0 ? 'Parcial' : 'Pendente');

    $stmtInsS->execute([
        $saleId,
        $saleCode,
        $quoteId,
        $quote['client_id'],
        $quote['client_name'],
        $quote['client_phone'],
        $quote['seller_name'],
        date('Y-m-d'),
        $deliveryDate,
        $quote['items_json'],
        (float)$quote['total'],
        $paidAmount,
        $paymentStatus,
        'Em Produção',
        'Sob Encomenda',
        "Gerado a partir do Orçamento #{$quote['code']}. " . ($quote['notes'] ?? '')
    ]);

    // Atualizar Orçamento para Aprovado e linkar com a venda
    $stmtUpdQ = $db->prepare("UPDATE megaprint_quotes SET status = 'Aprovado', sale_id = ? WHERE id = ?");
    $stmtUpdQ->execute([$saleId, $quoteId]);

    jsonResponse([
        'success' => true,
        'sale_id' => $saleId,
        'sale_code' => $saleCode,
        'message' => "Orçamento aprovado com sucesso! Pedido de Venda #{$saleCode} gerado e enviado para a produção."
    ]);
}

// 5. EXCLUIR ORÇAMENTO (POST ?action=delete_quote)
if ($method === 'POST' && $action === 'delete_quote') {
    $user = requireAuth();
    $data = json_decode(file_get_contents('php://input'), true);
    $id = $data['id'] ?? '';
    if (!$id) jsonError('ID não informado', 422);

    $stmt = $db->prepare("DELETE FROM megaprint_quotes WHERE id = ?");
    $stmt->execute([$id]);

    jsonResponse(['success' => true, 'message' => 'Orçamento excluído com sucesso.']);
}

// 6. ATUALIZAR STATUS DE PRODUÇÃO / PAGAMENTO DA VENDA (POST ?action=update_sale_status)
if ($method === 'POST' && $action === 'update_sale_status') {
    $user = requireAuth();
    $data = json_decode(file_get_contents('php://input'), true);
    $id = $data['id'] ?? '';
    if (!$id) jsonError('ID não informado', 422);

    $updates = [];
    $params = [];

    if (isset($data['production_status'])) {
        $updates[] = "production_status = ?";
        $params[] = $data['production_status'];
    }
    if (isset($data['payment_status'])) {
        $updates[] = "payment_status = ?";
        $params[] = $data['payment_status'];
    }
    if (isset($data['paid_amount'])) {
        $updates[] = "paid_amount = ?";
        $params[] = (float)$data['paid_amount'];
    }

    if (!empty($updates)) {
        $params[] = $id;
        $sql = "UPDATE megaprint_sales SET " . implode(', ', $updates) . " WHERE id = ?";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
    }

    jsonResponse(['success' => true, 'message' => 'Venda atualizada com sucesso.']);
}

// 7. EXCLUIR VENDA (POST ?action=delete_sale)
if ($method === 'POST' && $action === 'delete_sale') {
    $user = requireAuth();
    $data = json_decode(file_get_contents('php://input'), true);
    $id = $data['id'] ?? '';
    if (!$id) jsonError('ID não informado', 422);

    $stmt = $db->prepare("DELETE FROM megaprint_sales WHERE id = ?");
    $stmt->execute([$id]);

    jsonResponse(['success' => true, 'message' => 'Venda excluída com sucesso.']);
}

// 8. SALVAR ITEM (PRODUTO / SERVIÇO) (POST ?action=save_item)
if ($method === 'POST' && $action === 'save_item') {
    $user = requireAuth();
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data || empty($data['name'])) jsonError('Nome do item é obrigatório.', 422);

    $id = !empty($data['id']) ? $data['id'] : 'mpi-' . round(microtime(true) * 1000);

    $stmt = $db->prepare("
        INSERT INTO megaprint_items (
            id, name, type, calc_type, category, price, cost, unit_label, min_m2, description, stock_qty, active
        ) VALUES (
            :id, :name, :type, :calc_type, :category, :price, :cost, :unit_label, :min_m2, :description, :stock_qty, :active
        )
        ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            type = VALUES(type),
            calc_type = VALUES(calc_type),
            category = VALUES(category),
            price = VALUES(price),
            cost = VALUES(cost),
            unit_label = VALUES(unit_label),
            min_m2 = VALUES(min_m2),
            description = VALUES(description),
            stock_qty = VALUES(stock_qty),
            active = VALUES(active)
    ");

    $stmt->execute([
        ':id' => $id,
        ':name' => trim($data['name']),
        ':type' => $data['type'] ?? 'product',
        ':calc_type' => $data['calc_type'] ?? 'unit',
        ':category' => $data['category'] ?? 'Impressão',
        ':price' => (float)($data['price'] ?? 0),
        ':cost' => (float)($data['cost'] ?? 0),
        ':unit_label' => $data['unit_label'] ?? 'un',
        ':min_m2' => (float)($data['min_m2'] ?? 0),
        ':description' => $data['description'] ?? '',
        ':stock_qty' => (int)($data['stock_qty'] ?? 0),
        ':active' => isset($data['active']) ? (int)$data['active'] : 1
    ]);

    jsonResponse(['success' => true, 'id' => $id, 'message' => 'Item salvo com sucesso!']);
}

// 9. EXCLUIR ITEM (POST ?action=delete_item)
if ($method === 'POST' && $action === 'delete_item') {
    $user = requireAuth();
    $data = json_decode(file_get_contents('php://input'), true);
    $id = $data['id'] ?? '';
    if (!$id) jsonError('ID não informado', 422);

    $stmt = $db->prepare("UPDATE megaprint_items SET active = 0 WHERE id = ?");
    $stmt->execute([$id]);

    jsonResponse(['success' => true, 'message' => 'Item desativado com sucesso.']);
}

// 10. SALVAR CLIENTE (POST ?action=save_client)
if ($method === 'POST' && $action === 'save_client') {
    $user = requireAuth();
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data || empty($data['name'])) jsonError('Nome do cliente é obrigatório.', 422);

    $id = !empty($data['id']) ? $data['id'] : 'mpc-' . round(microtime(true) * 1000);

    $stmt = $db->prepare("
        INSERT INTO megaprint_clients (id, name, cpf_cnpj, phone, email, address, notes)
        VALUES (:id, :name, :cpf_cnpj, :phone, :email, :address, :notes)
        ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            cpf_cnpj = VALUES(cpf_cnpj),
            phone = VALUES(phone),
            email = VALUES(email),
            address = VALUES(address),
            notes = VALUES(notes)
    ");

    $stmt->execute([
        ':id' => $id,
        ':name' => trim($data['name']),
        ':cpf_cnpj' => $data['cpf_cnpj'] ?? null,
        ':phone' => $data['phone'] ?? null,
        ':email' => $data['email'] ?? null,
        ':address' => $data['address'] ?? null,
        ':notes' => $data['notes'] ?? null
    ]);

    jsonResponse(['success' => true, 'id' => $id, 'message' => 'Cliente salvo com sucesso!']);
}

// Se nenhuma ação coincidir
jsonError('Ação inválida ou não suportada.', 400);
