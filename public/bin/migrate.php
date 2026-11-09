<?php
// ==============================================================================
// GestorMF - Execução de Migrações de Banco de Dados via CLI
// ==============================================================================
if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    echo "Acesso negado: migrações de banco só podem ser executadas via terminal CLI.\n";
    exit(1);
}

define('GESTORMF_RUN_MIGRATIONS', true);
require_once dirname(__DIR__) . '/api/config.php';
require_once dirname(__DIR__) . '/api/schema.php';

echo "=== GestorMF • Migrador de Estrutura de Banco de Dados ===\n";

try {
    $db = getDB();
    echo "1. Conexão com banco de dados estabelecida.\n";

    echo "2. Executando tabelas centrais de segurança (sessões e rate limits)...\n";
    ensureDatabaseCore($db);
    echo "   [OK] Tabelas centrais configuradas.\n";

    echo "3. Executando schema operacional e migrações versionadas...\n";
    runDatabaseInstallation($db);
    echo "   [OK] Schema e tabelas operacionais sincronizados com sucesso.\n";

    echo "=== Migração concluída com 100% de sucesso! ===\n";
    exit(0);
} catch (Exception $e) {
    echo "ERRO AO EXECUTAR MIGRAÇÃO: " . $e->getMessage() . "\n";
    exit(1);
}

