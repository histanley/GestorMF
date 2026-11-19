<?php
// ==============================================================================
// GestorMF API - Vales e Adiantamentos Salariais de Colaboradores (FIN-05)
// ==============================================================================
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();

// Garante tabela de vales e adiantamentos salariais via migração versionada (DB-01)
function ensureSalaryAdvancesTable($db)
{
    runVersionedMigration($db, 'schema_salary_advances_v1', function ($pdo) {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS salary_advances (
                id VARCHAR(64) PRIMARY KEY,
                member_id VARCHAR(64) NOT NULL,
                month_key VARCHAR(7) NOT NULL,
                date DATE NOT NULL,
                amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                description VARCHAR(255) NULL,
                payment_method VARCHAR(50) DEFAULT 'PIX',
                registered_by VARCHAR(100) NULL,
                registered_by_id VARCHAR(64) NULL,
                receipt_url TEXT NULL,
                status VARCHAR(20) DEFAULT 'Concedido',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_adv_month_member (month_key, member_id),
                INDEX idx_adv_member (member_id),
                INDEX idx_adv_date (date)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");
    });
}
ensureSalaryAdvancesTable($db);

// Garante diretório seguro para armazenamento físico de comprovantes de pagamento (PIX / Transferência)
function ensureAdvancesStorage()
{
    $dir = dirname(__DIR__) . '/images/advances';
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    return $dir;
}

// Processa o comprovante enviado (base64 data URL ou URL pública) e grava no storage físico
function processReceiptFile($receiptInput, $advanceId)
{
    if (empty($receiptInput))
        return null;
    $trimmed = trim($receiptInput);
    if (strpos($trimmed, 'http://') === 0 || strpos($trimmed, 'https://') === 0 || strpos($trimmed, '/images/') === 0) {
        return $trimmed;
    }
    if (strpos($trimmed, 'data:') === 0) {
        $parts = explode(',', $trimmed, 2);
        if (count($parts) === 2) {
            $isPdf = strpos($parts[0], 'application/pdf') !== false;
            $ext = $isPdf ? 'pdf' : 'jpg';
            if (strpos($parts[0], 'image/png') !== false)
                $ext = 'png';
            if (strpos($parts[0], 'image/webp') !== false)
                $ext = 'webp';
            $binary = base64_decode($parts[1], true);
            if ($binary !== false && strlen($binary) > 0) {
                if (strlen($binary) > 15728640) {
                    throw new Exception('Comprovante excede o limite máximo permitido de 15 MB.');
                }
                $dir = ensureAdvancesStorage();
                $cleanId = preg_replace('/[^a-zA-Z0-9_-]/', '', $advanceId);
                $filename = $cleanId . '_comprovante_' . time() . '.' . $ext;
                $dest = $dir . '/' . $filename;
                if (@file_put_contents($dest, $binary)) {
                    @chmod($dest, 0644);
                    return '/images/advances/' . $filename;
                }
            }
        }
    }
    return $trimmed;
}

// ------------------------------------------------------------------------------
// 1. GET /api/advances.php?month=YYYY-MM[&memberId=...][&startDate=...&endDate=...]
// ------------------------------------------------------------------------------
if ($method === 'GET') {
    $user = requireAuth();
    $role = strtoupper(trim($user['role'] ?? 'USER'));
    $monthKey = trim($_GET['month'] ?? '');
    $startDate = trim($_GET['startDate'] ?? $_GET['start_date'] ?? '');
    $endDate = trim($_GET['endDate'] ?? $_GET['end_date'] ?? '');
    $requestedMemberId = trim($_GET['memberId'] ?? $_GET['member_id'] ?? '');

    // Se nenhum filtro foi informado, assume o mês vigente padrão
    if (empty($monthKey) && empty($startDate) && empty($endDate)) {
        $monthKey = date('Y-m');
    }

    if (!empty($monthKey) && $monthKey !== 'all' && empty($startDate)) {
        if (!preg_match('/^\d{4}-\d{2}$/', $monthKey)) {
            jsonResponse(['success' => false, 'error' => 'Formato de mês inválido. Use YYYY-MM ou "all".'], 400);
        }
    }

    if (in_array($role, ['ADMIN', 'MANAGER'], true)) {
        // Administrador/Gestor: pode consultar de todos ou filtrar por período/colaborador
        $where = [];
        $params = [];

        if (!empty($startDate) && !empty($endDate)) {
            $where[] = "date BETWEEN ? AND ?";
            $params[] = $startDate;
            $params[] = $endDate;
        } elseif (!empty($monthKey) && $monthKey !== 'all') {
            $where[] = "month_key = ?";
            $params[] = $monthKey;
        }

        if (!empty($requestedMemberId) && $requestedMemberId !== 'all') {
            $where[] = "member_id = ?";
            $params[] = $requestedMemberId;
        }

        $whereClause = !empty($where) ? 'WHERE ' . implode(' AND ', $where) : '';
        $stmt = $db->prepare("SELECT * FROM salary_advances {$whereClause} ORDER BY date DESC, created_at DESC");
        $stmt->execute($params);
        $rows = $stmt->fetchAll();
    } else {
        // Colaborador comum: acessa EXCLUSIVAMENTE seus próprios vales vinculados por user_id
        $myMember = resolveAuthenticatedMember($db, $user);
        $myMemberId = $myMember ? $myMember['id'] : null;

        if (!empty($requestedMemberId) && $requestedMemberId !== $myMemberId) {
            jsonResponse(['success' => false, 'error' => 'Acesso negado: você só pode consultar seus próprios vales.'], 403);
        }

        if (!$myMemberId) {
            jsonResponse([
                'success' => true,
                'month' => $monthKey ?: date('Y-m'),
                'advances' => []
            ]);
        }

        $where = ["member_id = ?"];
        $params = [$myMemberId];

        if (!empty($startDate) && !empty($endDate)) {
            $where[] = "date BETWEEN ? AND ?";
            $params[] = $startDate;
            $params[] = $endDate;
        } elseif (!empty($monthKey) && $monthKey !== 'all') {
            $where[] = "month_key = ?";
            $params[] = $monthKey;
        }

        $whereClause = 'WHERE ' . implode(' AND ', $where);
        $stmt = $db->prepare("SELECT * FROM salary_advances {$whereClause} ORDER BY date DESC, created_at DESC");
        $stmt->execute($params);
        $rows = $stmt->fetchAll();
    }

    $advances = [];
    foreach ($rows as $r) {
        $advances[] = [
            'id' => $r['id'],
            'memberId' => $r['member_id'],
            'monthKey' => $r['month_key'],
            'date' => $r['date'],
            'amount' => (float) ($r['amount'] ?? 0),
            'description' => $r['description'] ?? '',
            'paymentMethod' => $r['payment_method'] ?? 'PIX',
            'registeredBy' => $r['registered_by'] ?? '',
            'registeredById' => $r['registered_by_id'] ?? '',
            'receiptUrl' => $r['receipt_url'] ?? '',
            'status' => $r['status'] ?? 'Concedido',
            'createdAt' => $r['created_at'],
            'updatedAt' => $r['updated_at']
        ];
    }

    jsonResponse([
        'success' => true,
        'month' => $monthKey,
        'advances' => $advances
    ]);
}

// ------------------------------------------------------------------------------
// 2. POST /api/advances.php (Conceder ou Atualizar Vale - Apenas Admin/Manager)
// ------------------------------------------------------------------------------
if ($method === 'POST') {
    $user = requireAuth(['ADMIN', 'MANAGER']);
    $data = getJsonInput();

    // Suporte para anexar/atualizar comprovante a um vale existente
    if (!empty($data['action']) && $data['action'] === 'attach_receipt') {
        $advId = trim($data['id'] ?? '');
        $rawReceipt = trim($data['receiptUrl'] ?? $data['receipt_url'] ?? '');
        if (empty($advId) || empty($rawReceipt)) {
            jsonResponse(['success' => false, 'error' => 'Identificador do vale ou comprovante não informado.'], 400);
        }
        $savedUrl = processReceiptFile($rawReceipt, $advId);
        $stmtUp = $db->prepare("UPDATE salary_advances SET receipt_url = ? WHERE id = ?");
        $stmtUp->execute([$savedUrl, $advId]);

        logAudit(
            'SALARY_ADVANCE_RECEIPT',
            'FINANCE',
            $advId,
            "Comprovante de pagamento anexado ao vale {$advId} por {$user['name']}.",
            $user['id'],
            $user['name']
        );

        jsonResponse(['success' => true, 'receiptUrl' => $savedUrl]);
    }

    $memberId = trim($data['memberId'] ?? $data['member_id'] ?? '');
    $amount = isset($data['amount']) ? (float) $data['amount'] : 0.00;
    $date = trim($data['date'] ?? date('Y-m-d'));
    $monthKey = trim($data['monthKey'] ?? $data['month_key'] ?? substr($date, 0, 7));
    $description = trim($data['description'] ?? $data['reason'] ?? 'Adiantamento de Salário');
    $paymentMethod = trim($data['paymentMethod'] ?? $data['payment_method'] ?? 'PIX');
    $receiptUrl = trim($data['receiptUrl'] ?? $data['receipt_url'] ?? '');
    $status = trim($data['status'] ?? 'Concedido');

    if (empty($memberId)) {
        jsonResponse(['success' => false, 'error' => 'Identificador do colaborador não fornecido.'], 400);
    }
    if ($amount <= 0) {
        jsonResponse(['success' => false, 'error' => 'O valor do vale deve ser maior que zero.'], 400);
    }
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        jsonResponse(['success' => false, 'error' => 'Data inválida. Use AAAA-MM-DD.'], 400);
    }
    if (!preg_match('/^\d{4}-\d{2}$/', $monthKey)) {
        $monthKey = substr($date, 0, 7);
    }

    // Busca nome do colaborador para registro detalhado
    $stmtMem = $db->prepare("SELECT name FROM members WHERE id = ?");
    $stmtMem->execute([$memberId]);
    $memRow = $stmtMem->fetch();
    $memberName = $memRow ? $memRow['name'] : "Colaborador #{$memberId}";

    $advanceId = !empty($data['id']) ? trim($data['id']) : 'adv-' . $monthKey . '-' . bin2hex(random_bytes(6));
    $registeredBy = trim($user['name'] ?? 'Administração');
    $registeredById = trim($user['id'] ?? '');

    // Processa e armazena arquivo de comprovante (se fornecido)
    if (!empty($receiptUrl)) {
        $receiptUrl = processReceiptFile($receiptUrl, $advanceId);
    }

    $stmt = $db->prepare("
        INSERT INTO salary_advances (id, member_id, month_key, date, amount, description, payment_method, registered_by, registered_by_id, receipt_url, status)
        VALUES (:id, :member_id, :month_key, :date, :amount, :description, :payment_method, :registered_by, :registered_by_id, :receipt_url, :status)
        ON DUPLICATE KEY UPDATE
            date = VALUES(date),
            amount = VALUES(amount),
            description = VALUES(description),
            payment_method = VALUES(payment_method),
            receipt_url = VALUES(receipt_url),
            status = VALUES(status)
    ");

    $stmt->execute([
        ':id' => $advanceId,
        ':member_id' => $memberId,
        ':month_key' => $monthKey,
        ':date' => $date,
        ':amount' => $amount,
        ':description' => $description,
        ':payment_method' => $paymentMethod,
        ':registered_by' => $registeredBy,
        ':registered_by_id' => $registeredById,
        ':receipt_url' => $receiptUrl,
        ':status' => $status
    ]);

    logAudit(
        'SALARY_ADVANCE',
        'FINANCE',
        $advanceId,
        "Vale/Adiantamento concedido a {$memberName} ({$memberId}) no valor de R$ " . number_format($amount, 2, ',', '.') . " via {$paymentMethod} para {$monthKey}. Motivo: {$description}",
        $user['id'],
        $user['name']
    );

    jsonResponse([
        'success' => true,
        'advance' => [
            'id' => $advanceId,
            'memberId' => $memberId,
            'monthKey' => $monthKey,
            'date' => $date,
            'amount' => $amount,
            'description' => $description,
            'paymentMethod' => $paymentMethod,
            'registeredBy' => $registeredBy,
            'registeredById' => $registeredById,
            'receiptUrl' => $receiptUrl,
            'status' => $status
        ]
    ]);
}

// ------------------------------------------------------------------------------
// 3. DELETE /api/advances.php?id=X (Excluir/Estornar Vale - Apenas Admin)
// ------------------------------------------------------------------------------
if ($method === 'DELETE') {
    $user = requireAuth(['ADMIN']);
    $advanceId = trim($_GET['id'] ?? '');

    if (empty($advanceId)) {
        jsonResponse(['success' => false, 'error' => 'Identificador do vale não informado.'], 400);
    }

    $stmtFind = $db->prepare("SELECT * FROM salary_advances WHERE id = ?");
    $stmtFind->execute([$advanceId]);
    $adv = $stmtFind->fetch();

    if (!$adv) {
        jsonResponse(['success' => false, 'error' => 'Vale não encontrado no sistema.'], 404);
    }

    $stmtDel = $db->prepare("DELETE FROM salary_advances WHERE id = ?");
    $stmtDel->execute([$advanceId]);

    logAudit(
        'SALARY_ADVANCE_DELETE',
        'FINANCE',
        $advanceId,
        "Vale/Adiantamento {$advanceId} de R$ " . number_format((float) $adv['amount'], 2, ',', '.') . " do colaborador {$adv['member_id']} foi excluído/estornado por {$user['name']}.",
        $user['id'],
        $user['name']
    );

    jsonResponse([
        'success' => true,
        'message' => 'Vale estornado com sucesso.'
    ]);
}

jsonResponse(['error' => 'Método HTTP não suportado.'], 405);
