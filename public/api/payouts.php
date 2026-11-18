<?php
// ==============================================================================
// GestorMF API - Fechamento de Diárias, Banco de Horas e Folha (Admin)
// ==============================================================================
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();

// Garante tabela de fechamentos de pagamentos mensais via migração versionada (DB-01)
function ensurePayoutsTable($db) {
    runVersionedMigration($db, 'schema_payout_closures_v2', function($pdo) {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS payout_closures (
                id VARCHAR(64) PRIMARY KEY,
                month_key VARCHAR(7) NOT NULL,
                member_id VARCHAR(64) NOT NULL,
                status VARCHAR(20) DEFAULT 'Pendente',
                paid_at DATETIME NULL,
                paid_amount DECIMAL(10,2) DEFAULT 0.00,
                hours_cleared DECIMAL(6,1) DEFAULT 0.0,
                cleared_at DATETIME NULL,
                notes TEXT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_month_member (month_key, member_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");
        try { $pdo->exec("ALTER TABLE payout_closures ADD COLUMN hours_cleared DECIMAL(6,1) DEFAULT 0.0"); } catch (Exception $e) {}
        try { $pdo->exec("ALTER TABLE payout_closures ADD COLUMN cleared_at DATETIME NULL"); } catch (Exception $e) {}
    });
}
ensurePayoutsTable($db);

// GET /api/payouts.php?month=YYYY-MM (SEG-03: Isolamento financeiro por perfil)
if ($method === 'GET') {
    $user = requireAuth();
    $monthKey = trim($_GET['month'] ?? date('Y-m'));
    if (!preg_match('/^\d{4}-\d{2}$/', $monthKey)) {
        jsonResponse(['success' => false, 'error' => 'Formato de mês inválido. Use YYYY-MM.'], 400);
    }

    $role = strtoupper(trim($user['role'] ?? 'USER'));
    $requestedMemberId = trim($_GET['memberId'] ?? $_GET['member_id'] ?? '');

    if (in_array($role, ['ADMIN', 'MANAGER'], true)) {
        if (!empty($requestedMemberId)) {
            $stmt = $db->prepare("SELECT * FROM payout_closures WHERE month_key = ? AND member_id = ?");
            $stmt->execute([$monthKey, $requestedMemberId]);
        } else {
            $stmt = $db->prepare("SELECT * FROM payout_closures WHERE month_key = ?");
            $stmt->execute([$monthKey]);
        }
        $rows = $stmt->fetchAll();
    } else {
        // Colaborador comum: acessa EXCLUSIVAMENTE seu próprio registro vinculado por user_id
        $myMember = resolveAuthenticatedMember($db, $user);
        $myMemberId = $myMember ? $myMember['id'] : null;

        if (!empty($requestedMemberId) && $requestedMemberId !== $myMemberId) {
            jsonResponse(['success' => false, 'error' => 'Acesso negado: você só pode consultar seu próprio fechamento financeiro.'], 403);
        }

        if (!$myMemberId) {
            jsonResponse([
                'success'  => true,
                'month'    => $monthKey,
                'closures' => new stdClass()
            ]);
        }

        $stmt = $db->prepare("SELECT * FROM payout_closures WHERE month_key = ? AND member_id = ?");
        $stmt->execute([$monthKey, $myMemberId]);
        $rows = $stmt->fetchAll();
    }

    $closures = [];
    foreach ($rows as $r) {
        $closures[$r['member_id']] = [
            'id'           => $r['id'],
            'monthKey'     => $r['month_key'],
            'memberId'     => $r['member_id'],
            'status'       => $r['status'] ?? 'Pendente',
            'paidAt'       => $r['paid_at'],
            'paidAmount'   => (float)($r['paid_amount'] ?? 0),
            'hoursCleared' => (float)($r['hours_cleared'] ?? 0),
            'clearedAt'    => $r['cleared_at'],
            'notes'        => $r['notes'] ?? '',
            'updatedAt'    => $r['updated_at']
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
    $hoursCleared = isset($data['hoursCleared']) ? (float)$data['hoursCleared'] : 0.0;
    $clearedAt = !empty($data['clearedAt']) ? $data['clearedAt'] : ($status === 'Pago' ? date('Y-m-d H:i:s') : null);
    $notes = trim($data['notes'] ?? '');

    if (empty($memberId)) {
        jsonResponse(['error' => 'Identificador do colaborador não fornecido.'], 400);
    }

    $closureId = "pay-{$monthKey}-{$memberId}";
    $paidAt = $status === 'Pago' ? ($data['paidAt'] ?? date('Y-m-d H:i:s')) : null;

    $stmt = $db->prepare("
        INSERT INTO payout_closures (id, month_key, member_id, status, paid_at, paid_amount, hours_cleared, cleared_at, notes)
        VALUES (:id, :month_key, :member_id, :status, :paid_at, :paid_amount, :hours_cleared, :cleared_at, :notes)
        ON DUPLICATE KEY UPDATE
            status = VALUES(status),
            paid_at = VALUES(paid_at),
            paid_amount = VALUES(paid_amount),
            hours_cleared = VALUES(hours_cleared),
            cleared_at = VALUES(cleared_at),
            notes = VALUES(notes)
    ");

    $stmt->execute([
        ':id'            => $closureId,
        ':month_key'     => $monthKey,
        ':member_id'     => $memberId,
        ':status'        => $status,
        ':paid_at'       => $paidAt,
        ':paid_amount'   => $paidAmount,
        ':hours_cleared' => $hoursCleared,
        ':cleared_at'    => $clearedAt,
        ':notes'         => $notes
    ]);

    logAudit('PAYOUT_CLOSURE', 'FINANCE', $closureId, "Fechamento de diárias de {$memberId} para {$monthKey}: status={$status}, horas_zeradas={$hoursCleared}.", $user['id'], $user['name']);

    jsonResponse([
        'success' => true,
        'closure' => [
            'id'           => $closureId,
            'monthKey'     => $monthKey,
            'memberId'     => $memberId,
            'status'       => $status,
            'paidAt'       => $paidAt,
            'paidAmount'   => $paidAmount,
            'hoursCleared' => $hoursCleared,
            'clearedAt'    => $clearedAt,
            'notes'        => $notes
        ]
    ]);
}

jsonResponse(['error' => 'Método não suportado.'], 405);

