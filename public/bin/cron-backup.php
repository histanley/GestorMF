<?php
// ==============================================================================
// GestorMF - Script de Backup Automático para Cron Job (Exclusivamente CLI)
// ==============================================================================
// Como configurar no cPanel > Tarefas Cron (Cron Jobs):
// Minuto: 0 | Hora: 2 | Dia: * | Mês: * | Dia da Semana: * (Todo dia às 02:00)
// Comando: php /home1/gestormf/public_html/bin/cron-backup.php
// ==============================================================================

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    die("Acesso negado. Este script deve ser executado exclusivamente via linha de comando (CLI).\n");
}

$candidates = [
    dirname(__DIR__) . '/api',                   // Produção: public_html/bin -> public_html/api
    dirname(__DIR__, 2) . '/public_html/api',    // Fora de public_html: /home1/gestormf/bin -> /home1/gestormf/public_html/api
    dirname(__DIR__) . '/public/api',            // Desenvolvimento local: GestorMF/public/bin -> GestorMF/public/api
    '/home1/gestormf/public_html/api'            // Caminho absoluto cPanel HostGator
];

$apiDir = null;
foreach ($candidates as $dir) {
    if (file_exists($dir . '/config.php')) {
        $apiDir = $dir;
        break;
    }
}

if (!$apiDir) {
    die("Erro: Não foi possível localizar o diretório da API do GestorMF.\n");
}

require_once $apiDir . '/config.php';
require_once $apiDir . '/backup.php';

