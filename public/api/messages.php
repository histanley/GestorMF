<?php
// ==============================================================================
// GestorMF API - Sistema de Mensagens Internas & Comunicados Operacionais
// ==============================================================================
require_once __DIR__ . '/config.php';

$user = requireAuth();
$db = getDB();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? 'list';

// Garante a existência da tabela de mensagens
function ensureMessagesTable($db) {
    static $ready = false;
    if ($ready) return;
    try {
        $db->exec("
            CREATE TABLE IF NOT EXISTS system_messages (
                id VARCHAR(64) PRIMARY KEY,
                sender_id VARCHAR(64) NOT NULL,
                sender_name VARCHAR(150) NOT NULL,
                sender_role VARCHAR(50) NOT NULL,
                recipient_type ENUM('ALL', 'INDIVIDUAL') NOT NULL DEFAULT 'ALL',
                recipient_id VARCHAR(64) NULL,
                recipient_name VARCHAR(150) NULL,
                title VARCHAR(200) NOT NULL,
                message TEXT NOT NULL,
                priority ENUM('NORMAL', 'HIGH', 'URGENT') NOT NULL DEFAULT 'NORMAL',
                read_by JSON NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_msg_sender (sender_id),
                INDEX idx_msg_recipient (recipient_id),
                INDEX idx_msg_type (recipient_type),
                INDEX idx_msg_created (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");
        $ready = true;
    } catch (Exception $e) {
        error_log('[GestorMF Messages Schema Error] ' . $e->getMessage());
    }
}

ensureMessagesTable($db);

// ------------------------------------------------------------------------------
// LISTAR MENSAGENS DO USUÁRIO (GET)
// ------------------------------------------------------------------------------
if ($method === 'GET' && $action === 'list') {
    $userId = $user['id'];
    $role = strtoupper(trim($user['role'] ?? 'USER'));
    $userName = strtolower(trim($user['name'] ?? ''));

    // Descobre o ID de membro vinculado a este usuário, se houver
    $memberId = null;
    $stmtMem = $db->prepare("SELECT id FROM members WHERE user_id = ? LIMIT 1");
    $stmtMem->execute([$userId]);
    $mRow = $stmtMem->fetch();
    if ($mRow) {
        $memberId = $mRow['id'];
    }

    try {
        // Mensagens para todos (ALL) OU individuais para este usuário/membro OU enviadas por ele mesmo
        $sql = "
            SELECT * FROM system_messages
            WHERE recipient_type = 'ALL'
               OR recipient_id = :user_id
               " . ($memberId ? "OR recipient_id = :member_id" : "") . "
               " . (in_array($role, ['ADMIN', 'MANAGER']) ? "OR sender_id = :sender_id" : "") . "
            ORDER BY created_at DESC
            LIMIT 100
        ";

        $params = [':user_id' => $userId];
        if ($memberId) {
            $params[':member_id'] = $memberId;
        }
        if (in_array($role, ['ADMIN', 'MANAGER'])) {
            $params[':sender_id'] = $userId;
        }

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        $formatted = array_map(function($row) use ($userId) {
            $readList = !empty($row['read_by']) ? json_decode($row['read_by'], true) : [];
            $isRead = is_array($readList) && in_array($userId, $readList);

            return [
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
                'createdAt'     => $row['created_at'],
                'type'          => 'system_message'
            ];
        }, $rows);

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
    if ($recipientType === 'INDIVIDUAL' && empty($recipientId)) {
        jsonResponse(['success' => false, 'error' => 'Selecione o colaborador destinatário da mensagem individual.'], 400);
    }
    if (!in_array($priority, ['NORMAL', 'HIGH', 'URGENT'])) {
        $priority = 'NORMAL';
    }

    $msgId = 'msg-' . bin2hex(random_bytes(10));
    $senderRoleLabel = ($role === 'ADMIN') ? 'Administrador' : 'Gestor';

    try {
        $stmtIns = $db->prepare("
            INSERT INTO system_messages (
                id, sender_id, sender_name, sender_role, recipient_type, recipient_id, recipient_name, title, message, priority, read_by, created_at
            ) VALUES (
                :id, :sender_id, :sender_name, :sender_role, :recipient_type, :recipient_id, :recipient_name, :title, :message, :priority, '[]', NOW()
            )
        ");

        $stmtIns->execute([
            ':id'             => $msgId,
            ':sender_id'      => $user['id'],
            ':sender_name'    => $user['name'],
            ':sender_role'    => $senderRoleLabel,
            ':recipient_type' => $recipientType,
            ':recipient_id'   => $recipientId,
            ':recipient_name' => $recipientName,
            ':title'          => $title,
            ':message'        => $message,
            ':priority'       => $priority,
        ]);

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
// EXCLUIR MENSAGEM (POST / DELETE - Apenas autor ou Administrador)
// ------------------------------------------------------------------------------
if (($method === 'POST' || $method === 'DELETE') && $action === 'delete') {
    $data = getJsonInput();
    $msgId = trim($data['id'] ?? $data['messageId'] ?? $_GET['id'] ?? '');

    if (empty($msgId)) {
        jsonResponse(['success' => false, 'error' => 'ID da mensagem é obrigatório.'], 400);
    }

    $role = strtoupper(trim($user['role'] ?? 'USER'));

    try {
        $stmt = $db->prepare("SELECT id, sender_id, title FROM system_messages WHERE id = ?");
        $stmt->execute([$msgId]);
        $msg = $stmt->fetch();

        if (!$msg) {
            jsonResponse(['success' => false, 'error' => 'Mensagem não encontrada.'], 404);
        }

        if ($role !== 'ADMIN' && $msg['sender_id'] !== $user['id']) {
            jsonResponse(['success' => false, 'error' => 'Você não tem permissão para excluir esta mensagem.'], 403);
        }

        $stmtDel = $db->prepare("DELETE FROM system_messages WHERE id = ?");
        $stmtDel->execute([$msgId]);

        logAudit('DELETE_MESSAGE', 'COMMUNICATIONS', $msgId, "Mensagem excluída: '{$msg['title']}'", $user['id'], $user['name']);
        bumpSyncVersion("delete_msg_{$msgId}");

        jsonResponse(['success' => true, 'message' => 'Mensagem excluída com sucesso.']);
    } catch (Exception $e) {
        error_log('[GestorMF Delete Message Error] ' . $e->getMessage());
        jsonResponse(['success' => false, 'error' => 'Falha ao excluir mensagem.'], 500);
    }
}

jsonResponse(['error' => 'Ação de mensagens inválida.'], 400);
