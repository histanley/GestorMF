<?php
// ==============================================================================
// GestorMF API - Sistema de Mensagens Internas & Comunicados Operacionais
// ==============================================================================
require_once __DIR__ . '/config.php';

$user = requireAuth();
$db = getDB();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? 'list';

// Garante a existência da tabela de mensagens via migração versionada controlada (DB-01)
function getSystemMessagesColumns($db) {
    static $cols = null;
    if ($cols !== null) return $cols;

    runVersionedMigration($db, 'schema_system_messages_v2', function($pdo) {
        $pdo->exec("
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
            $pdo->exec("ALTER TABLE system_messages ADD COLUMN recipient_user_id VARCHAR(64) NULL AFTER recipient_id");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE system_messages ADD COLUMN dismissed_by JSON NULL AFTER read_by");
        } catch (Exception $e) {}
    });

    $cols = [
        'id' => true,
        'sender_id' => true,
        'recipient_id' => true,
        'recipient_user_id' => true,
        'dismissed_by' => true,
        'title' => true,
        'message' => true
    ];
    return $cols;
}

getSystemMessagesColumns($db);

// ------------------------------------------------------------------------------
// LISTAR MENSAGENS DO USUÁRIO (GET - Somente Leitura e Vínculo Estrito por ID)
// ------------------------------------------------------------------------------
if ($method === 'GET' && $action === 'list') {
    $userId = $user['id'];
    $role = strtoupper(trim($user['role'] ?? 'USER'));

    // SEG-01 & DB-05: Reconhecimento estrito exclusivamente por members.user_id = users.id (somente leitura)
    $mRow = resolveAuthenticatedMember($db, $user);
    $memberId = $mRow ? $mRow['id'] : null;

    $cols = getSystemMessagesColumns($db);
    $hasRecUserCol = isset($cols['recipient_user_id']);

    try {
        $sql = "
            SELECT * FROM system_messages
            WHERE (
                recipient_type = 'ALL'
                OR recipient_id = :user_id_1
                " . ($hasRecUserCol ? "OR recipient_user_id = :user_id_2" : "") . "
                " . ($memberId ? "OR recipient_id = :member_id_1 " . ($hasRecUserCol ? "OR recipient_user_id = :member_id_2" : "") : "") . "
                " . (in_array($role, ['ADMIN', 'MANAGER']) ? "OR sender_id = :sender_id" : "") . "
            )
            ORDER BY created_at DESC
            LIMIT 100
        ";

        $params = [':user_id_1' => $userId];
        if ($hasRecUserCol) {
            $params[':user_id_2'] = $userId;
        }
        if ($memberId) {
            $params[':member_id_1'] = $memberId;
            if ($hasRecUserCol) {
                $params[':member_id_2'] = $memberId;
            }
        }
        if (in_array($role, ['ADMIN', 'MANAGER'])) {
            $params[':sender_id'] = $userId;
        }

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        $formatted = [];
        foreach ($rows as $row) {
            // Verifica se o usuário atual já dispensou/apagou esta mensagem de sua tela (por ID autenticado)
            $dismissedList = !empty($row['dismissed_by']) ? json_decode($row['dismissed_by'], true) : [];
            if (!is_array($dismissedList)) $dismissedList = [];
            $isDismissed = in_array($userId, $dismissedList, true) ||
                           ($memberId && in_array($memberId, $dismissedList, true));
            if ($isDismissed) {
                continue;
            }

            $readList = !empty($row['read_by']) ? json_decode($row['read_by'], true) : [];
            $isRead = is_array($readList) && (in_array($userId, $readList, true) || ($memberId && in_array($memberId, $readList, true)));

            $formatted[] = [
                'id'            => $row['id'],
                'senderId'      => $row['sender_id'],
                'senderName'    => $row['sender_name'],
                'senderRole'    => $row['sender_role'],
                'recipientType' => $row['recipient_type'],
                'recipientId'   => $row['recipient_id'],
                'recipientName' => $row['recipient_name'],
                'title'         => $row['title'],
                'message'       => $row['message'],
                'priority'      => $row['priority'],
                'isRead'        => $isRead,
                'isSender'      => ($row['sender_id'] === $userId),
                'createdAt'     => $row['created_at'],
                'type'          => 'system_message'
            ];
        }

        jsonResponse(['success' => true, 'messages' => $formatted]);
    } catch (Exception $e) {
        error_log('[GestorMF Messages List Error] ' . $e->getMessage());
        jsonResponse(['success' => false, 'error' => 'Falha ao consultar mensagens internas.'], 500);
    }
}

// ------------------------------------------------------------------------------
// ENVIAR NOVA MENSAGEM (POST - Apenas Administradores e Gestores)
// ------------------------------------------------------------------------------
if ($method === 'POST' && $action === 'send') {
    $role = strtoupper(trim($user['role'] ?? 'USER'));
    if (!in_array($role, ['ADMIN', 'MANAGER'])) {
        jsonResponse(['success' => false, 'error' => 'Acesso negado: apenas Administradores e Gestores podem enviar mensagens e comunicados.'], 403);
    }

    $data = getJsonInput();
    $title = trim($data['title'] ?? '');
    $message = trim($data['message'] ?? '');
    $recipientType = strtoupper(trim($data['recipientType'] ?? 'ALL'));
    $recipientId = !empty($data['recipientId']) ? trim($data['recipientId']) : null;
    $recipientUserId = !empty($data['recipientUserId']) ? trim($data['recipientUserId']) : null;
    $recipientName = !empty($data['recipientName']) ? trim($data['recipientName']) : null;
    $priority = strtoupper(trim($data['priority'] ?? 'NORMAL'));

    if (empty($title)) {
        jsonResponse(['success' => false, 'error' => 'O título do comunicado é obrigatório.'], 400);
    }
    if (empty($message)) {
        jsonResponse(['success' => false, 'error' => 'O conteúdo da mensagem é obrigatório.'], 400);
    }
    if ($recipientType !== 'ALL' && $recipientType !== 'INDIVIDUAL') {
        $recipientType = 'ALL';
    }
    if ($recipientType === 'INDIVIDUAL' && empty($recipientId) && empty($recipientName)) {
        jsonResponse(['success' => false, 'error' => 'Selecione o colaborador destinatário da mensagem individual.'], 400);
    }
    if (!in_array($priority, ['NORMAL', 'HIGH', 'URGENT'])) {
        $priority = 'NORMAL';
    }

    // Se recipientUserId ainda não veio preenchido, resolve estritamente por ID na tabela members
    if ($recipientType === 'INDIVIDUAL' && empty($recipientUserId) && !empty($recipientId)) {
        $stmtFindUser = $db->prepare("SELECT user_id, name FROM members WHERE id = ? OR user_id = ? LIMIT 1");
        $stmtFindUser->execute([$recipientId, $recipientId]);
        $foundM = $stmtFindUser->fetch();
        if ($foundM) {
            $recipientUserId = $foundM['user_id'];
            if (empty($recipientName)) $recipientName = $foundM['name'];
        }
    }

    $msgId = 'msg-' . bin2hex(random_bytes(10));
    $senderRoleLabel = ($role === 'ADMIN') ? 'Administrador' : 'Gestor';

    $cols = getSystemMessagesColumns($db);
    $hasRecUserCol = isset($cols['recipient_user_id']);
    $hasDismissedCol = isset($cols['dismissed_by']);

    try {
        if ($hasRecUserCol && $hasDismissedCol) {
            $stmtIns = $db->prepare("
                INSERT INTO system_messages (
                    id, sender_id, sender_name, sender_role, recipient_type, recipient_id, recipient_user_id, recipient_name, title, message, priority, read_by, dismissed_by, created_at
                ) VALUES (
                    :id, :sender_id, :sender_name, :sender_role, :recipient_type, :recipient_id, :recipient_user_id, :recipient_name, :title, :message, :priority, '[]', '[]', NOW()
                )
            ");
            $stmtIns->execute([
                ':id'                => $msgId,
                ':sender_id'         => $user['id'],
                ':sender_name'       => $user['name'],
                ':sender_role'       => $senderRoleLabel,
                ':recipient_type'    => $recipientType,
                ':recipient_id'      => $recipientId,
                ':recipient_user_id' => $recipientUserId,
                ':recipient_name'    => $recipientName,
                ':title'             => $title,
                ':message'           => $message,
                ':priority'          => $priority,
            ]);
        } elseif ($hasRecUserCol) {
            $stmtIns = $db->prepare("
                INSERT INTO system_messages (
                    id, sender_id, sender_name, sender_role, recipient_type, recipient_id, recipient_user_id, recipient_name, title, message, priority, read_by, created_at
                ) VALUES (
                    :id, :sender_id, :sender_name, :sender_role, :recipient_type, :recipient_id, :recipient_user_id, :recipient_name, :title, :message, :priority, '[]', NOW()
                )
            ");
            $stmtIns->execute([
                ':id'                => $msgId,
                ':sender_id'         => $user['id'],
                ':sender_name'       => $user['name'],
                ':sender_role'       => $senderRoleLabel,
                ':recipient_type'    => $recipientType,
                ':recipient_id'      => $recipientId,
                ':recipient_user_id' => $recipientUserId,
                ':recipient_name'    => $recipientName,
                ':title'             => $title,
                ':message'           => $message,
                ':priority'          => $priority,
            ]);
        } else {
            $stmtIns = $db->prepare("
                INSERT INTO system_messages (
                    id, sender_id, sender_name, sender_role, recipient_type, recipient_id, recipient_name, title, message, priority, read_by, created_at
                ) VALUES (
                    :id, :sender_id, :sender_name, :sender_role, :recipient_type, :recipient_id, :recipient_name, :title, :message, :priority, '[]', NOW()
                )
            ");
            $stmtIns->execute([
                ':id'                => $msgId,
                ':sender_id'         => $user['id'],
                ':sender_name'       => $user['name'],
                ':sender_role'       => $senderRoleLabel,
                ':recipient_type'    => $recipientType,
                ':recipient_id'      => $recipientId,
                ':recipient_name'    => $recipientName,
                ':title'             => $title,
                ':message'           => $message,
                ':priority'          => $priority,
            ]);
        }

        $auditDetail = ($recipientType === 'ALL')
            ? "Comunicado geral enviado para toda a equipe: '{$title}'"
            : "Mensagem individual enviada para {$recipientName}: '{$title}'";

        logAudit('SEND_MESSAGE', 'COMMUNICATIONS', $msgId, $auditDetail, $user['id'], $user['name']);
        bumpSyncVersion("message_{$msgId}");

        jsonResponse([
            'success' => true,
            'message' => 'Mensagem enviada com sucesso.',
            'messageId' => $msgId
        ]);
    } catch (Exception $e) {
        error_log('[GestorMF Send Message Error] ' . $e->getMessage());
        jsonResponse(['success' => false, 'error' => 'Falha interna ao registrar mensagem no servidor.'], 500);
    }
}

// ------------------------------------------------------------------------------
// MARCAR MENSAGEM COMO LIDA (POST)
// ------------------------------------------------------------------------------
if ($method === 'POST' && $action === 'mark_read') {
    $data = getJsonInput();
    $msgId = trim($data['id'] ?? $data['messageId'] ?? '');

    if (empty($msgId)) {
        jsonResponse(['success' => false, 'error' => 'ID da mensagem é obrigatório.'], 400);
    }

    try {
        $stmt = $db->prepare("SELECT id, read_by FROM system_messages WHERE id = ?");
        $stmt->execute([$msgId]);
        $row = $stmt->fetch();

        if ($row) {
            $readList = !empty($row['read_by']) ? json_decode($row['read_by'], true) : [];
            if (!is_array($readList)) $readList = [];

            if (!in_array($user['id'], $readList)) {
                $readList[] = $user['id'];
                $stmtUp = $db->prepare("UPDATE system_messages SET read_by = ? WHERE id = ?");
                $stmtUp->execute([json_encode($readList), $msgId]);
            }
        }

        jsonResponse(['success' => true, 'message' => 'Mensagem marcada como lida.']);
    } catch (Exception $e) {
        error_log('[GestorMF Mark Read Error] ' . $e->getMessage());
        jsonResponse(['success' => false, 'error' => 'Falha ao atualizar status de leitura.'], 500);
    }
}

// ------------------------------------------------------------------------------
// EXCLUIR / DISPENSAR MENSAGEM (POST / DELETE)
// Se for o autor ou Administrador e solicitar exclusão global -> apaga permanentemente do banco
// Se for destinatário -> adiciona o usuário em dismissed_by para sumir definitivamente da sua tela!
// ------------------------------------------------------------------------------
if (($method === 'POST' || $method === 'DELETE') && $action === 'delete') {
    $data = getJsonInput();
    $msgId = trim($data['id'] ?? $data['messageId'] ?? $_GET['id'] ?? '');

    if (empty($msgId)) {
        jsonResponse(['success' => false, 'error' => 'ID da mensagem é obrigatório.'], 400);
    }

    $role = strtoupper(trim($user['role'] ?? 'USER'));

    try {
        $stmt = $db->prepare("SELECT id, sender_id, title, dismissed_by FROM system_messages WHERE id = ?");
        $stmt->execute([$msgId]);
        $msg = $stmt->fetch();

        if (!$msg) {
            jsonResponse(['success' => true, 'message' => 'Mensagem já não existe.']);
        }

        $canPermanentlyDelete = ($role === 'ADMIN' || $msg['sender_id'] === $user['id']);
        $forceGlobal = !empty($data['global']);

        if ($canPermanentlyDelete && ($forceGlobal || $msg['sender_id'] === $user['id'])) {
            // Exclusão definitiva pelo criador da mensagem ou Administrador Geral
            $stmtDel = $db->prepare("DELETE FROM system_messages WHERE id = ?");
            $stmtDel->execute([$msgId]);

            logAudit('DELETE_MESSAGE', 'COMMUNICATIONS', $msgId, "Mensagem excluída definitivamente: '{$msg['title']}'", $user['id'], $user['name']);
            bumpSyncVersion("delete_msg_{$msgId}");
            jsonResponse(['success' => true, 'message' => 'Mensagem excluída definitivamente do sistema.']);
        } else {
            // O usuário atual (destinatário) está apagando a notificação da SUA central (estritamente por ID)
            $dismissed = !empty($msg['dismissed_by']) ? json_decode($msg['dismissed_by'], true) : [];
            if (!is_array($dismissed)) $dismissed = [];

            if (!in_array($user['id'], $dismissed, true)) {
                $dismissed[] = $user['id'];
            }
            $mRow = resolveAuthenticatedMember($db, $user);
            if ($mRow && !empty($mRow['id']) && !in_array($mRow['id'], $dismissed, true)) {
                $dismissed[] = $mRow['id'];
            }

            $stmtUp = $db->prepare("UPDATE system_messages SET dismissed_by = ? WHERE id = ?");
            $stmtUp->execute([json_encode($dismissed), $msgId]);

            jsonResponse(['success' => true, 'message' => 'Notificação removida da sua central com sucesso.']);
        }
    } catch (Exception $e) {
        error_log('[GestorMF Delete Message Error] ' . $e->getMessage());
        jsonResponse(['success' => false, 'error' => 'Falha ao processar exclusão da mensagem.'], 500);
    }
}

// ------------------------------------------------------------------------------
// DISPENSAR TODAS AS MENSAGENS ATUAIS DO USUÁRIO (POST)
// ------------------------------------------------------------------------------
if ($method === 'POST' && $action === 'dismiss_all') {
    $userId = $user['id'];
    $mRow = resolveAuthenticatedMember($db, $user);
    $memberId = $mRow ? $mRow['id'] : null;

    try {
        $stmtAll = $db->prepare("
            SELECT id, dismissed_by FROM system_messages
            WHERE recipient_type = 'ALL' OR recipient_id = ? OR recipient_user_id = ? OR (? IS NOT NULL AND (recipient_id = ? OR recipient_user_id = ?))
        ");
        $stmtAll->execute([$userId, $userId, $memberId, $memberId, $memberId]);
        $allMsgs = $stmtAll->fetchAll();

        foreach ($allMsgs as $m) {
            $dismissed = !empty($m['dismissed_by']) ? json_decode($m['dismissed_by'], true) : [];
            if (!is_array($dismissed)) $dismissed = [];
            if (!in_array($userId, $dismissed, true)) {
                $dismissed[] = $userId;
                $stmtUp = $db->prepare("UPDATE system_messages SET dismissed_by = ? WHERE id = ?");
                $stmtUp->execute([json_encode($dismissed), $m['id']]);
            }
        }

        jsonResponse(['success' => true, 'message' => 'Todas as mensagens foram removidas da sua central.']);
    } catch (Exception $e) {
        error_log('[GestorMF Dismiss All Error] ' . $e->getMessage());
        jsonResponse(['success' => false, 'error' => 'Falha ao limpar mensagens.'], 500);
    }
}

jsonResponse(['error' => 'Ação de mensagens inválida.'], 400);
