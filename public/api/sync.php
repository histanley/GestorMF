<?php
// ==============================================================================
// GestorMF API - Engine de Sincronização em Tempo Real (SSE & Polling Inteligente)
// ==============================================================================
require_once __DIR__ . '/config.php';

$streamMode = isset($_GET['stream']) && $_GET['stream'] == '1';
$clientVersion = isset($_GET['version']) ? (int)$_GET['version'] : null;

// Exige autenticação de sessão ativa
$user = requireAuth();
$db = getDB();

// ------------------------------------------------------------------------------
// MODO SERVER-SENT EVENTS (SSE) - CONEXÃO CONTÍNUA LEVE
// ------------------------------------------------------------------------------
if ($streamMode) {
    header('Content-Type: text/event-stream; charset=utf-8');
    header('Cache-Control: no-cache');
    header('Connection: keep-alive');
    header('X-Accel-Buffering: no'); // Para LiteSpeed e Nginx

    // Desativa buffer de saída do PHP
    while (ob_get_level() > 0) {
        ob_end_flush();
    }
    flush();

    $lastSentVersion = $clientVersion ?? 0;
    $startTime = time();
    $maxDuration = 25; // Reinicia suavemente a cada 25s para respeitar timeouts da HostGator

    while (time() - $startTime < $maxDuration) {
        if (connection_aborted()) break;

        try {
            $stmt = $db->query("SELECT version, UNIX_TIMESTAMP(last_updated) AS updated_ts FROM system_sync WHERE id = 1");
            $sync = $stmt->fetch();
            $currentVersion = $sync ? (int)$sync['version'] : 1;

            if ($currentVersion !== $lastSentVersion) {
                echo "data: " . json_encode([
                    'changed'   => true,
                    'version'   => $currentVersion,
                    'timestamp' => $sync['updated_ts']
                ]) . "\n\n";
                $lastSentVersion = $currentVersion;
                flush();
            } else {
                // Heartbeat para manter conexão viva
                echo ": ping\n\n";
                flush();
            }
        } catch (Exception $e) {
            break;
        }

        sleep(2);
    }
    exit();
}

// ------------------------------------------------------------------------------
// MODO POLLING RÁPIDO (RESPOSTA EM 3ms)
// ------------------------------------------------------------------------------
$stmt = $db->query("SELECT version, UNIX_TIMESTAMP(last_updated) AS updated_ts FROM system_sync WHERE id = 1");
$sync = $stmt->fetch();
$currentVersion = $sync ? (int)$sync['version'] : 1;

if ($clientVersion !== null && $clientVersion === $currentVersion) {
    jsonResponse([
        'changed'   => false,
        'version'   => $currentVersion,
        'timestamp' => $sync ? (int)$sync['updated_ts'] : time()
    ]);
}

jsonResponse([
    'changed'   => true,
    'version'   => $currentVersion,
    'timestamp' => $sync ? (int)$sync['updated_ts'] : time()
]);

