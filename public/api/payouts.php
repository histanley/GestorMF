<?php
// ==============================================================================
// GestorMF API - Fechamento de Diárias, Banco de Horas e Folha (Admin)
// ==============================================================================
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();

// Garante tabela de fechamentos de pagamentos mensais
function ensurePayoutsTable($db) {
    try {
        $db->exec("
            CREATE TABLE IF NOT EXISTS payout_closures (
                id VARCHAR(64) PRIMARY KEY,
                month_key VARCHAR(7) NOT NULL,
                member_id VARCHAR(64) NOT NULL,
                status VARCHAR(20) DEFAULT 'Pendente',
                paid_at DATETIME NULL,
                paid_amount DECIMAL(10,2) DEFAULT 0.00,
                notes TEXT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_month_member (month_key, member_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");
    } catch (Exception $e) {}
}
ensurePayoutsTable($db);

// GET /api/payouts.php?month=YYYY-MM
if ($method === 'GET') {
    $user = requireAuth();
    $monthKey = trim($_GET['month'] ?? date('Y-m'));

    $stmt = $db->prepare("SELECT * FROM payout_closures WHERE month_key = ?");
    $stmt->execute([$monthKey]);
    $rows = $stmt->fetchAll();

    $closures = [];
    foreach ($rows as $r) {
        $closures[$r['member_id']] = [
            'id'         => $r['id'],
            'monthKey'   => $r['month_key'],
            'memberId'   => $r['member_id'],
            'status'     => $r['status'] ?? 'Pendente',
            'paidAt'     => $r['paid_at'],
            'paidAmount' => (float)($r['paid_amount'] ?? 0),
            'notes'      => $r['notes'] ?? '',
            'updatedAt'  => $r['updated_at']
        ];
    }

    jsonResponse([
        'success'  => true,
        'month'    => $monthKey,
        'closures' => $closures
    ]);
}

// POST /api/payouts.php (Apenas Admin)
if ($method === 'POST') {
    $user = requireAuth(['ADMIN']);
    $data = getJsonInput();

    $monthKey = trim($data['monthKey'] ?? ($data['month'] ?? date('Y-m')));
    $memberId = trim($data['memberId'] ?? '');
    $status = trim($data['status'] ?? 'Pendente');
    $paidAmount = isset($data['paidAmount']) ? (float)$data['paidAmount'] : 0.00;
    $notes = trim($data['notes'] ?? '');

    if (empty($memberId)) {
        jsonResponse(['error' => 'Identificador do colaborador não fornecido.'], 400);
    }

    $closureId = "pay-{$monthKey}-{$memberId}";
    $paidAt = $status === 'Pago' ? ($data['paidAt'] ?? date('Y-m-d H:i:s')) : null;

    $stmt = $db->prepare("
        INSERT INTO payout_closures (id, month_key, member_id, status, paid_at, paid_amount, notes)
        VALUES (:id, :month_key, :member_id, :status, :paid_at, :paid_amount, :notes)
        ON DUPLICATE KEY UPDATE
            status = VALUES(status),
            paid_at = VALUES(paid_at),
            paid_amount = VALUES(paid_amount),
            notes = VALUES(notes)
    ");

    $stmt->execute([
        ':id'          => $closureId,
        ':month_key'   => $monthKey,
        ':member_id'   => $memberId,
        ':status'      => $status,
        ':paid_at'     => $paidAt,
        ':paid_amount' => $paidAmount,
        ':notes'       => $notes
    ]);

    logAudit('PAYOUT_CLOSURE', 'FINANCE', $closureId, "Fechamento de diárias de {$memberId} para {$monthKey}: status alterado para {$status}.", $user['id'], $user['name']);

    jsonResponse([
        'success' => true,
        'closure' => [
            'id'         => $closureId,
            'monthKey'   => $monthKey,
            'memberId'   => $memberId,
            'status'     => $status,
            'paidAt'     => $paidAt,
            'paidAmount' => $paidAmount,
            'notes'      => $notes
        ]
    ]);
}

jsonResponse(['error' => 'Método não suportado.'], 405);

