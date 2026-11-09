<?php
// ==============================================================================
// GestorMF - Arquivo de Segredos e Credenciais (Fora de public_html)
// Localização exata no servidor HostGator: /home1/gestormf/gestormf-secrets.php
//
// ⚠️ IMPORTANTE DE SEGURANÇA:
// Este arquivo deve ficar em /home1/gestormf/gestormf-secrets.php,
// isto é, UM NÍVEL ACIMA de public_html.
// Dessa forma, nenhum visitante da internet consegue acessar suas credenciais!
// ==============================================================================

return [
    // 1. Credenciais do Banco MySQL (HostGator cPanel)
    'db_name'    => 'gestormf_gestor',
    'db_user'    => 'gestormf_admin',
    'db_pass'    => 'SUA_NOVA_SENHA_DO_BANCO_AQUI', // Cole aqui a nova senha que você definiu no cPanel
    'db_host'    => 'localhost',
    'db_charset' => 'utf8mb4',

    // 2. Chave Mestra de Assinatura Criptográfica das Sessões do GestorMF
    'app_secret' => '8f92a1d47c6e03b584e9102c7f53942a1b6d8e0f2c4a79b13579bdf02468ace1',

    // 3. Chave de Segurança para Rotina de Cron Job de Backup Automático
    'cron_key'   => 'gestormf_cron_sec_87413_histanley',
];
