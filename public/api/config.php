<?php
// ==============================================================================
// GestorMF API - Configuração de Banco de Dados e Utilitários de Segurança
// ==============================================================================

// Forçar captura de erros e converter para JSON limpo
ini_set('display_errors', 0);
error_reporting(E_ALL);

set_exception_handler(function($e) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    error_log('[GestorMF Exception] ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    echo json_encode([
        'success' => false,
        'error'   => 'Erro interno do servidor. Ocorrência registrada no log.'
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit();
});

register_shutdown_function(function() {
    $error = error_get_last();
    if ($error && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        error_log('[GestorMF Fatal] ' . $error['message'] . ' in ' . $error['file'] . ':' . $error['line']);
        if (!headers_sent()) {
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
        }
        echo json_encode([
            'success' => false,
            'error'   => 'Erro crítico do servidor.'
        ], JSON_UNESCAPED_UNICODE);
    }
});

// Cabeçalhos HTTP para API REST, Segurança e Anti-Cache
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('Referrer-Policy: strict-origin-when-cross-origin');

// Fallback robusto para getallheaders em qualquer ambiente PHP
if (!function_exists('getallheaders')) {
    function getallheaders() {
        $headers = [];
        foreach ($_SERVER as $name => $value) {
            if (substr($name, 0, 5) == 'HTTP_') {
                $headers[str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($name, 5)))))] = $value;
            }
        }
        return $headers;
    }
}

// Restrição de Origem e Proteção CSRF / Cross-Origin
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$serverName = $_SERVER['SERVER_NAME'] ?? '';
$httpHost = $_SERVER['HTTP_HOST'] ?? '';

// Em ambiente de produção (gestormf.shop), validação estrita sem subdomínios arbitrários (P1-02)
$rawHost = strtolower($httpHost ?: $serverName);
$hostOnly = explode(':', $rawHost)[0];
$isProd = in_array($hostOnly, ['gestormf.shop', 'www.gestormf.shop'], true);

$allowedHosts = $isProd
    ? ['gestormf.shop', 'www.gestormf.shop']
    : ['gestormf.shop', 'www.gestormf.shop', 'localhost', '127.0.0.1'];

// Permite conexões do próprio domínio (gestormf.shop) ou ambiente local dev
if (!empty($origin)) {
    $parsedOrigin = parse_url($origin);
    $originHost = $parsedOrigin['host'] ?? '';
    if (in_array($originHost, $allowedHosts)) {
        header("Access-Control-Allow-Origin: {$origin}");
        header('Access-Control-Allow-Credentials: true');
    }
}
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-CSRF-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Validação Anti-CSRF para métodos de escrita (POST, PUT, DELETE)
$requestMethod = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if (in_array($requestMethod, ['POST', 'PUT', 'DELETE'])) {
    $allHeaders = getallheaders();
    $requestedWith = $allHeaders['X-Requested-With'] ?? $allHeaders['x-requested-with'] ?? '';

    // Permite chamadas internas da aplicação (fetch com X-Requested-With)
    if (empty($requestedWith) || !in_array($requestedWith, ['XMLHttpRequest', 'GestorMF-App'])) {
        // Se a chamada vier de um formulário externo sem o cabeçalho customizado, rejeita
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Acesso negado: proteção CSRF ativa.'], JSON_UNESCAPED_UNICODE);
        exit();
    }

    if (!empty($origin)) {
        $parsedOrigin = parse_url($origin);
        $originHost = $parsedOrigin['host'] ?? '';
        if (!in_array($originHost, $allowedHosts)) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Origem não autorizada.'], JSON_UNESCAPED_UNICODE);
            exit();
        }
    }
}

// ==============================================================================
// CARREGAMENTO SEGURO DE SEGREDOS FORA DE PUBLIC_HTML
// ==============================================================================
function loadAppSecrets() {
    static $secrets = null;
    if ($secrets !== null) return $secrets;

    // Busca o arquivo gestormf-secrets.php estritamente fora da raiz pública (public_html)
    $possiblePaths = [
        '/home1/gestormf/gestormf-secrets.php',                    // Caminho absoluto direto do cPanel HostGator
        '/home/gestormf/gestormf-secrets.php',                     // Alias comum no cPanel
        dirname(__DIR__, 2) . '/gestormf-secrets.php',             // 1 nível acima de public_html (relativo dinâmico)
        dirname(__DIR__, 3) . '/gestormf-secrets.php',             // 2 níveis acima
        dirname(__DIR__, 1) . '/gestormf-secrets.php'              // Na raiz do projeto em ambiente local (ignorado pelo git)
    ];

    foreach ($possiblePaths as $path) {
        if (file_exists($path)) {
            $loaded = require $path;
            if (is_array($loaded)) {
                $secrets = $loaded;
                return $secrets;
            }
        }
    }

    // Se arquivo externo não existir, tenta variáveis de ambiente (sem segredos em texto puro no código)
    $appSecret = getenv('GESTORMF_APP_SECRET') ?: '';
    if (empty($appSecret)) {
        error_log('[GestorMF Security Alert] Chave app_secret ausente nas configurações e variáveis de ambiente.');
    }

    $secrets = [
        'db_name'    => getenv('GESTORMF_DB_NAME') ?: 'gestormf_gestor',
        'db_user'    => getenv('GESTORMF_DB_USER') ?: 'gestormf_admin',
        'db_pass'    => getenv('GESTORMF_DB_PASS') ?: '',
        'db_host'    => getenv('GESTORMF_DB_HOST') ?: 'localhost',
        'db_charset' => 'utf8mb4',
        'app_secret' => $appSecret
    ];

    return $secrets;
}

// Conexão com PDO
function getDB() {
    static $pdo = null;
    if ($pdo === null) {
        $sec = loadAppSecrets();
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];

        $hosts = [$sec['db_host'] ?: 'localhost', '127.0.0.1'];
        $lastError = null;

        foreach ($hosts as $host) {
            try {
                $dsn = "mysql:host={$host};dbname={$sec['db_name']};charset={$sec['db_charset']}";
                $pdo = new PDO($dsn, $sec['db_user'], $sec['db_pass'], $options);
                break;
            } catch (PDOException $e) {
                $lastError = $e;
            }
        }

        if (!$pdo) {
            http_response_code(500);
            error_log('[GestorMF DB Error] Falha de conexao MySQL: ' . ($lastError ? $lastError->getMessage() : 'Desconhecida'));
            echo json_encode([
                'success' => false,
                'error'   => 'E-mail ou senha incorretos.'
            ], JSON_UNESCAPED_UNICODE);
            exit();
        }

        ensureDatabaseCore($pdo);
    }
    return $pdo;
}

// P1-07: Criação e migração de tabelas isolada de requisições normais de produção
function ensureDatabaseCore($pdo) {
    // Em produção normal HTTP, não executa consultas DDL para não degradar performance nem exigir permissões DDL
    if (php_sapi_name() !== 'cli' && !defined('GESTORMF_RUN_MIGRATIONS')) {
        return;
    }

    static $checked = false;
    if ($checked) return;
    $checked = true;

    try {
        // Tabela de Sessões de Usuário (Tokens opacos revogáveis e protegidos por hash)
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS user_sessions (
                id VARCHAR(64) PRIMARY KEY,
                user_id VARCHAR(64) NOT NULL,
                token_hash VARCHAR(64) NOT NULL UNIQUE,
                ip_address VARCHAR(45) NULL,
                user_agent VARCHAR(255) NULL,
                last_activity TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME NOT NULL,
                INDEX idx_sess_user (user_id),
                INDEX idx_sess_token (token_hash),
                INDEX idx_sess_exp (expires_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");

        // Tabela de Rate Limiting (Controle de tentativas de login por IP e e-mail)
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS rate_limits (
                id INT AUTO_INCREMENT PRIMARY KEY,
                action_key VARCHAR(100) NOT NULL,
                ip_address VARCHAR(45) NOT NULL,
                attempts INT NOT NULL DEFAULT 1,
                first_attempt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                last_attempt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                blocked_until DATETIME NULL,
                UNIQUE KEY uq_action_ip (action_key, ip_address),
                INDEX idx_rl_blocked (blocked_until)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");
    } catch (Exception $e) {
        error_log('[GestorMF Core Schema Error] ' . $e->getMessage());
    }
}

// Resposta JSON padronizada
function jsonResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit();
}

// Validação de Política de Senhas Fortes (Mínimo 8 caracteres e anti-senhas fracas)
function validatePasswordStrength($password) {
    if (empty($password)) {
        return 'A senha não pode estar em branco.';
    }
    if (strlen($password) < 8) {
        return 'A senha deve conter no mínimo 8 caracteres (recomenda-se o uso de frases-senha longas).';
    }
    $trivial = ['12345678', 'password', 'senha123', 'megagestao', 'admin123', 'mudar123', 'qwertyui', '123456789', 'abcdefgh'];
    if (in_array(strtolower($password), $trivial)) {
        return 'Senha considerada fraca ou trivial. Escolha uma senha mais complexa ou frase-senha segura.';
    }
    return null;
}

// Leitura do payload JSON de requisições POST/PUT
function getJsonInput() {
    $raw = file_get_contents('php://input');
    if (empty($raw)) return [];
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

// ==============================================================================
// SISTEMA DE SESSÕES REVOGÁVEIS NO SERVIDOR & PROTEÇÃO CSRF
// Regra acordada: 12 horas de inatividade / 7 dias de validade máxima
// ==============================================================================
const SESSION_INACTIVITY_LIMIT = 43200; // 12 horas em segundos
const SESSION_MAX_LIFETIME = 604800;    // 7 dias em segundos

function generateCsrfToken($sessionToken) {
    $sec = loadAppSecrets();
    $key = $sec['app_secret'] ?? '';
    if (empty($key)) {
        error_log('[GestorMF Security Error] Chave app_secret ausente nas configuracoes.');
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Configuração de segurança do servidor incompleta.'], JSON_UNESCAPED_UNICODE);
        exit();
    }
    return hash_hmac('sha256', (string)$sessionToken, (string)$key);
}

function validateCsrfToken($sessionToken, $providedCsrf) {
    if (empty($sessionToken) || empty($providedCsrf)) return false;
    $expected = generateCsrfToken($sessionToken);
    return hash_equals($expected, (string)$providedCsrf);
}

function createUserSession($pdo, $userId) {
    ensureDatabaseCore($pdo);
    $tokenBytes = random_bytes(32);
    $plainToken = bin2hex($tokenBytes);
    $tokenHash = hash('sha256', $plainToken);

    $sessionId = 'sess-' . bin2hex(random_bytes(16));
    $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
    $ua = substr($_SERVER['HTTP_USER_AGENT'] ?? 'Unknown', 0, 255);
    $expiresAt = date('Y-m-d H:i:s', time() + SESSION_MAX_LIFETIME);

    try {
        $stmt = $pdo->prepare("
            INSERT INTO user_sessions (id, user_id, token_hash, ip_address, user_agent, expires_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$sessionId, $userId, $tokenHash, $ip, $ua, $expiresAt]);
    } catch (Exception $e) {
        error_log('[GestorMF Create Session Error] ' . $e->getMessage());
        ensureDatabaseCore($pdo);
        $stmt = $pdo->prepare("
            INSERT INTO user_sessions (id, user_id, token_hash, ip_address, user_agent, expires_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$sessionId, $userId, $tokenHash, $ip, $ua, $expiresAt]);
    }

    $isHttps = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ||
               (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');

    // Define cookie seguro HttpOnly, Secure, SameSite=Lax
    setcookie('gestormf_session', $plainToken, [
        'expires'  => time() + SESSION_MAX_LIFETIME,
        'path'     => '/',
        'secure'   => $isHttps,
        'httponly' => true,
        'samesite' => 'Lax'
    ]);

    // Define cookie CSRF legível por JS para o padrão Double-Submit Cookie
    $csrf = generateCsrfToken($plainToken);
    setcookie('gestormf_csrf', $csrf, [
        'expires'  => time() + SESSION_MAX_LIFETIME,
        'path'     => '/',
        'secure'   => $isHttps,
        'httponly' => false,
        'samesite' => 'Lax'
    ]);

    return $plainToken;
}

function destroyUserSession($pdo, $token = null) {
    if (!$token) {
        $token = getBearerOrCookieToken();
    }
    if ($token) {
        $tokenHash = hash('sha256', $token);
        $stmt = $pdo->prepare("DELETE FROM user_sessions WHERE token_hash = ?");
        $stmt->execute([$tokenHash]);
    }

    $isHttps = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ||
               (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');

    setcookie('gestormf_session', '', [
        'expires' => time() - 3600,
        'path'    => '/',
        'secure'  => $isHttps,
        'httponly'=> true,
        'samesite'=> 'Lax'
    ]);

    setcookie('gestormf_csrf', '', [
        'expires' => time() - 3600,
        'path'    => '/',
        'secure'  => $isHttps,
        'httponly'=> false,
        'samesite'=> 'Lax'
    ]);
}

function revokeAllUserSessions($pdo, $userId) {
    $stmt = $pdo->prepare("DELETE FROM user_sessions WHERE user_id = ?");
    $stmt->execute([$userId]);
}

function getBearerOrCookieToken() {
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    if (preg_match('/Bearer\s+([a-f0-9]+)/i', $authHeader, $matches)) {
        return $matches[1];
    }
    if (isset($_COOKIE['gestormf_session'])) {
        return $_COOKIE['gestormf_session'];
    }
    return null;
}

// Middleware de Autenticação Segura: consulta o banco MySQL em TODA requisição
function requireAuth($allowedRoles = []) {
    $token = getBearerOrCookieToken();
    if (!$token) {
        jsonResponse(['success' => false, 'error' => 'Acesso não autenticado. Por favor, faça login.'], 401);
    }

    $db = getDB();
    $tokenHash = hash('sha256', $token);

    try {
        $stmt = $db->prepare("
            SELECT s.id AS session_id, s.user_id, s.last_activity, s.expires_at,
                   u.id, u.name, u.email, u.role, u.title, u.department, u.phone, u.avatar
            FROM user_sessions s
            INNER JOIN users u ON u.id = s.user_id
            WHERE s.token_hash = ?
            LIMIT 1
        ");
        $stmt->execute([$tokenHash]);
        $session = $stmt->fetch();
    } catch (Exception $e) {
        error_log('[GestorMF Session Check Error] ' . $e->getMessage());
        destroyUserSession($db, $token);
        jsonResponse(['success' => false, 'error' => 'Sessão inválida. Faça login novamente.'], 401);
    }

    if (!$session) {
        jsonResponse(['success' => false, 'error' => 'Sessão inválida ou expirada. Faça login novamente.'], 401);
    }

    // Validação de tempo de inatividade (12 horas) e expiração máxima (7 dias)
    $lastActivityTs = strtotime($session['last_activity']);
    $expiresAtTs = strtotime($session['expires_at']);
    $now = time();

    if ($now > $expiresAtTs || ($now - $lastActivityTs > SESSION_INACTIVITY_LIMIT)) {
        destroyUserSession($db, $token);
        jsonResponse(['success' => false, 'error' => 'Sessão expirada por inatividade. Faça login novamente.'], 401);
    }

    // Validação rigorosa de CSRF em requisições de escrita (POST, PUT, DELETE)
    $reqMethod = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (in_array($reqMethod, ['POST', 'PUT', 'DELETE'])) {
        $hdrs = getallheaders();
        $csrfCandidate = $hdrs['X-CSRF-Token'] ?? $hdrs['x-csrf-token'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
        if (!validateCsrfToken($token, $csrfCandidate)) {
            jsonResponse(['success' => false, 'error' => 'Acesso negado: validação de token CSRF falhou.'], 403);
        }
    }

    // Atualiza last_activity
    $db->prepare("UPDATE user_sessions SET last_activity = NOW() WHERE id = ?")->execute([$session['session_id']]);

    // Checagem de permissão de cargo (RBAC)
    if (!empty($allowedRoles)) {
        $userRole = strtoupper($session['role'] ?? 'USER');
        $allowed = array_map('strtoupper', $allowedRoles);
        if (!in_array($userRole, $allowed)) {
            jsonResponse(['success' => false, 'error' => 'Acesso negado. Privilégios insuficientes para esta operação.'], 403);
        }
    }

    return [
        'id'         => $session['id'],
        'name'       => $session['name'],
        'email'      => $session['email'],
        'role'       => strtoupper($session['role']),
        'title'      => $session['title'],
        'department' => $session['department'],
        'phone'      => $session['phone'],
        'avatar'     => $session['avatar'],
        'session_id' => $session['session_id']
    ];
}

// ==============================================================================
// CONTROLE DE RATE LIMITING (ANTI-BRUTE-FORCE)
// ==============================================================================
function checkRateLimit($db, $actionKey, $ip, $maxAttempts = 5, $blockMinutes = 15) {
    try {
        $stmt = $db->prepare("SELECT attempts, blocked_until, first_attempt FROM rate_limits WHERE action_key = ? AND ip_address = ?");
        $stmt->execute([$actionKey, $ip]);
        $row = $stmt->fetch();

        $now = time();
        if ($row) {
            if ($row['blocked_until'] && strtotime($row['blocked_until']) > $now) {
                $rem = ceil((strtotime($row['blocked_until']) - $now) / 60);
                return [
                    'allowed' => false,
                    'error'   => "Muitas tentativas incorretas. Tente novamente em {$rem} minuto(s)."
                ];
            }

            // Janela de 15 minutos expirada: reinicia contagem
            if ($now - strtotime($row['first_attempt']) > ($blockMinutes * 60)) {
                $db->prepare("UPDATE rate_limits SET attempts = 1, first_attempt = NOW(), blocked_until = NULL WHERE action_key = ? AND ip_address = ?")
                   ->execute([$actionKey, $ip]);
                return ['allowed' => true];
            }

            if ($row['attempts'] >= $maxAttempts) {
                $blockTime = date('Y-m-d H:i:s', $now + ($blockMinutes * 60));
                $db->prepare("UPDATE rate_limits SET blocked_until = ? WHERE action_key = ? AND ip_address = ?")
                   ->execute([$blockTime, $actionKey, $ip]);
                return [
                    'allowed' => false,
                    'error'   => "Muitas tentativas incorretas. Acesso bloqueado por {$blockMinutes} minutos."
                ];
            }
        }
    } catch (Exception $e) {
        error_log('[GestorMF RateLimit Error] ' . $e->getMessage());
    }
    return ['allowed' => true];
}

function recordRateLimitAttempt($db, $actionKey, $ip) {
    try {
        $db->prepare("
            INSERT INTO rate_limits (action_key, ip_address, attempts, first_attempt, last_attempt)
            VALUES (?, ?, 1, NOW(), NOW())
            ON DUPLICATE KEY UPDATE attempts = attempts + 1, last_attempt = NOW()
        ")->execute([$actionKey, $ip]);
    } catch (Exception $e) {}
}

function clearRateLimit($db, $actionKey, $ip) {
    try {
        $db->prepare("DELETE FROM rate_limits WHERE action_key = ? AND ip_address = ?")->execute([$actionKey, $ip]);
    } catch (Exception $e) {}
}

// ==============================================================================
// TRILHA DE AUDITORIA & SYNC VERSION
// ==============================================================================
function logAudit($action, $module, $entityId, $details, $userId = null, $userName = null) {
    try {
        $db = getDB();
        $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
        $detailsJson = is_string($details) ? $details : json_encode($details, JSON_UNESCAPED_UNICODE);

        $stmt = $db->prepare("
            INSERT INTO audit_logs (user_id, user_name, action, module, entity_id, details, ip_address, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
        ");
        $stmt->execute([
            $userId ?? 'system',
            $userName ?? 'Sistema',
            $action,
            $module,
            $entityId,
            $detailsJson,
            $ip
        ]);
    } catch (Exception $e) {
        error_log('[GestorMF Audit Error] ' . $e->getMessage());
    }
}

function bumpSyncVersion($reason = '') {
    try {
        $db = getDB();
        $db->query("
            INSERT INTO system_sync (id, version, last_updated)
            VALUES (1, 1, NOW())
            ON DUPLICATE KEY UPDATE version = version + 1, last_updated = NOW()
        ");
    } catch (Exception $e) {
        error_log('[GestorMF Sync Error] ' . $e->getMessage());
    }
}
