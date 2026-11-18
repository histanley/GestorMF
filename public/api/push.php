<?php
// ==============================================================================
// GestorMF API - Gerenciamento de Inscrições de Web Push Notifications (PWA)
// ==============================================================================
require_once __DIR__ . '/config.php';

$user = requireAuth();
$db = getDB();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? 'subscribe';

// ------------------------------------------------------------------------------
// SALVAR OU ATUALIZAR INSCRIÇÃO PUSH (POST)
// ------------------------------------------------------------------------------
if ($method === 'POST' && $action === 'subscribe') {
    $data = getJsonInput();
    $endpoint = trim($data['endpoint'] ?? '');
    $keys = $data['keys'] ?? [];
    $p256dh = trim($keys['p256dh'] ?? $data['p256dh'] ?? '');
    $authKey = trim($keys['auth'] ?? $data['auth'] ?? '');
    $ua = substr($_SERVER['HTTP_USER_AGENT'] ?? 'Unknown', 0, 255);

    if (empty($endpoint) || !filter_var($endpoint, FILTER_VALIDATE_URL) || stripos($endpoint, 'https://') !== 0) {
        jsonResponse(['success' => false, 'error' => 'Endpoint HTTPS de subscrição Push válido é obrigatório.'], 400);
    }
    if (empty($p256dh) || empty($authKey)) {
        jsonResponse(['success' => false, 'error' => 'Chaves criptográficas da assinatura Push (p256dh e auth) são obrigatórias.'], 400);
    }

    try {
        // SEG-09: Verifica posse do endpoint e protege contra reassociação arbitrária entre contas
        $stmtCheck = $db->prepare("SELECT id, user_id, p256dh, auth FROM push_subscriptions WHERE endpoint = ? LIMIT 1");
        $stmtCheck->execute([$endpoint]);
        $existing = $stmtCheck->fetch();

        if ($existing) {
            if ($existing['user_id'] !== $user['id']) {
                // Exige prova criptográfica de posse do Subscription (mesmo par p256dh/auth emitido pelo navegador)
                if (!hash_equals((string)$existing['p256dh'], $p256dh) || !hash_equals((string)$existing['auth'], $authKey)) {
                    logAudit('PUSH_REBIND_BLOCKED', 'NOTIFICATIONS', $user['id'], "Tentativa bloqueada de reassociação de endpoint Push pertencente a outra conta sem prova de chaves.", $user['id'], $user['name']);
                    jsonResponse(['success' => false, 'error' => 'Assinatura Push vinculada a outra sessão com chaves divergentes. Gere uma nova inscrição no navegador.'], 403);
                }
                logAudit('PUSH_DEVICE_REASSIGNED', 'NOTIFICATIONS', $user['id'], "Inscrição Push transferida de {$existing['user_id']} para {$user['id']} mediante comprovação de chaves do dispositivo.", $user['id'], $user['name']);
            }

            $stmtUp = $db->prepare("
                UPDATE push_subscriptions
                SET user_id = ?, p256dh = ?, auth = ?, user_agent = ?, updated_at = NOW()
                WHERE id = ?
            ");
            $stmtUp->execute([$user['id'], $p256dh, $authKey, $ua, $existing['id']]);
        } else {
            $stmtIns = $db->prepare("
                INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, NOW(), NOW())
            ");
            $stmtIns->execute([$user['id'], $endpoint, $p256dh, $authKey, $ua]);
        }

        logAudit('PUSH_SUBSCRIBE', 'NOTIFICATIONS', $user['id'], "Dispositivo inscrito para notificações Web Push.", $user['id'], $user['name']);

        jsonResponse([
            'success' => true,
            'message' => 'Dispositivo registrado com sucesso para notificações Push em tempo real.'
        ]);
    } catch (Exception $e) {
        error_log('[GestorMF Push Error] ' . $e->getMessage());
        jsonResponse(['success' => false, 'error' => 'Falha ao salvar inscrição de notificação Push no servidor.'], 500);
    }
}

// ------------------------------------------------------------------------------
// REMOVER INSCRIÇÃO PUSH (POST / DELETE)
// ------------------------------------------------------------------------------
if (($method === 'POST' || $method === 'DELETE') && $action === 'unsubscribe') {
    $data = getJsonInput();
    $endpoint = trim($data['endpoint'] ?? '');

    if (!empty($endpoint)) {
        $stmt = $db->prepare("DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?");
        $stmt->execute([$endpoint, $user['id']]);
    } else {
        $stmt = $db->prepare("DELETE FROM push_subscriptions WHERE user_id = ?");
        $stmt->execute([$user['id']]);
    }

    jsonResponse(['success' => true, 'message' => 'Inscrição de notificações removida com sucesso.']);
}

// ------------------------------------------------------------------------------
// STATUS DA INSCRIÇÃO DO USUÁRIO (GET)
// ------------------------------------------------------------------------------
if ($method === 'GET' && $action === 'status') {
    $stmt = $db->prepare("SELECT COUNT(*) AS active_devices FROM push_subscriptions WHERE user_id = ?");
    $stmt->execute([$user['id']]);
    $res = $stmt->fetch();

    jsonResponse([
        'success'       => true,
        'activeDevices' => (int)($res['active_devices'] ?? 0)
    ]);
}

jsonResponse(['error' => 'Ação de push inválida.'], 400);

