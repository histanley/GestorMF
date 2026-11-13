<?php
// ==============================================================================
// GestorMF API - Autenticação Segura (Bcrypt + Sessões Revogáveis no Servidor)
// ==============================================================================
require_once __DIR__ . '/config.php';

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();
$ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';

// ------------------------------------------------------------------------------
// LOGIN
// ------------------------------------------------------------------------------
if ($method === 'POST' && $action === 'login') {
    $input = getJsonInput();
    $email = strtolower(trim($input['email'] ?? ''));
    $password = $input['password'] ?? '';

    if (empty($email) || empty($password)) {
        jsonResponse(['success' => false, 'error' => 'Informe e-mail e senha de acesso.'], 400);
    }

    // Rate Limiting anti-brute-force (5 tentativas por IP/Email)
    $rlCheck = checkRateLimit($db, 'login_' . md5($email), $ip, 5, 15);
    if (!$rlCheck['allowed']) {
        jsonResponse(['success' => false, 'error' => $rlCheck['error']], 429);
    }

    try {
        $stmt = $db->prepare("SELECT * FROM users WHERE LOWER(email) = ?");
        $stmt->execute([$email]);
        $user = $stmt->fetch();
    } catch (Exception $e) {
        error_log('[GestorMF Login DB Error] ' . $e->getMessage());
        jsonResponse(['success' => false, 'error' => 'Falha ao autenticar no banco de dados.'], 500);
    }

    if (!$user || !password_verify($password, $user['password_hash'])) {
        recordRateLimitAttempt($db, 'login_' . md5($email), $ip);
        logAudit('LOGIN_FAILED', 'AUTH', $email, 'Tentativa de login inválida.', null, $email);
        jsonResponse(['success' => false, 'error' => 'E-mail ou senha incorretos.'], 401);
    }

    // Sucesso: limpa tentativas de rate limiting
    clearRateLimit($db, 'login_' . md5($email), $ip);

    // Cria sessão segura revogável no banco MySQL e emite cookie HttpOnly
    $token = createUserSession($db, $user['id']);

    logAudit('LOGIN_SUCCESS', 'AUTH', $user['id'], 'Login efetuado com sucesso.', $user['id'], $user['name']);

    $csrfToken = generateCsrfToken($token);
    unset($user['password_hash']);
    jsonResponse([
        'success'   => true,
        'user'      => $user,
        'csrfToken' => $csrfToken
    ]);
}

// ------------------------------------------------------------------------------
// OBTER PERFIL ATUAL (ME)
// ------------------------------------------------------------------------------
if ($method === 'GET' && $action === 'me') {
    $auth = requireAuth();
    // Auto-recuperação da coluna pix_key em users
    try {
        $chk = $db->query("SHOW COLUMNS FROM users LIKE 'pix_key'")->fetch();
        if (!$chk) {
            $db->exec("ALTER TABLE users ADD COLUMN pix_key VARCHAR(100) NULL AFTER phone");
        }
    } catch (Exception $e) {}

    $stmt = $db->prepare("
        SELECT u.id, u.name, u.email, u.role, u.title, u.department, u.phone, u.avatar, u.pix_key, u.created_at,
               m.pix_key AS member_pix_key
        FROM users u
        LEFT JOIN members m ON (m.user_id = u.id OR LOWER(TRIM(m.name)) = LOWER(TRIM(u.name)))
        WHERE u.id = ?
        LIMIT 1
    ");
    $stmt->execute([$auth['id']]);
    $user = $stmt->fetch();

    if (!$user) {
        jsonResponse(['success' => false, 'error' => 'Usuário não encontrado.'], 404);
    }

    $effectivePix = !empty($user['member_pix_key']) ? $user['member_pix_key'] : ($user['pix_key'] ?? '');
    $user['pixKey'] = $effectivePix;

    $sessionToken = getBearerOrCookieToken();
    $csrfToken = generateCsrfToken($sessionToken);
    jsonResponse(['success' => true, 'user' => $user, 'csrfToken' => $csrfToken]);
}

// ------------------------------------------------------------------------------
// ATUALIZAR PERFIL (NOME, FONE, DEPTO, FOTO, PIX)
// ------------------------------------------------------------------------------
if ($method === 'POST' && $action === 'update_profile') {
    $auth = requireAuth();
    $input = getJsonInput();

    // Auto-recuperação da coluna pix_key em users
    try {
        $chk = $db->query("SHOW COLUMNS FROM users LIKE 'pix_key'")->fetch();
        if (!$chk) {
            $db->exec("ALTER TABLE users ADD COLUMN pix_key VARCHAR(100) NULL AFTER phone");
        }
    } catch (Exception $e) {}

    $name = trim($input['name'] ?? '');
    $phone = trim($input['phone'] ?? '');
    $department = trim($input['department'] ?? '');
    $avatar = $input['avatar'] ?? null;
    $hasPix = isset($input['pixKey']) || isset($input['pix_key']);
    $pixKey = $hasPix ? trim($input['pixKey'] ?? ($input['pix_key'] ?? '')) : null;

    if (empty($name)) {
        jsonResponse(['success' => false, 'error' => 'O nome completo é obrigatório.'], 400);
    }

    $stmt = $db->prepare("
        UPDATE users
        SET name = ?, phone = ?, department = ?, avatar = COALESCE(?, avatar)" . ($hasPix ? ", pix_key = ?" : "") . "
        WHERE id = ?
    ");
    $params = [$name, $phone, $department, $avatar];
    if ($hasPix) $params[] = $pixKey ?: null;
    $params[] = $auth['id'];
    $stmt->execute($params);

    // Sincroniza foto, telefone e PIX na tabela members (reflete imediatamente na gestão de equipes e missões na Web)
    try {
        $updateFields = [
            'phone = COALESCE(NULLIF(?, ""), phone)',
            'user_id = COALESCE(user_id, ?)'
        ];
        $memParams = [$phone, $auth['id']];

        if (!empty($avatar)) {
            array_unshift($updateFields, 'photo_url = ?');
            array_unshift($memParams, $avatar);
        }
        if ($hasPix) {
            $updateFields[] = 'pix_key = ?';
            $memParams[] = $pixKey ?: null;
        }

        $memParams[] = $auth['id'];
        $memParams[] = $name;

        $sqlMem = "UPDATE members SET " . implode(', ', $updateFields) . " WHERE user_id = ? OR LOWER(TRIM(name)) = LOWER(TRIM(?))";
        $db->prepare($sqlMem)->execute($memParams);

        bumpSyncVersion("members");
    } catch (Exception $e) {
        error_log("[GestorMF Profile Sync Error] " . $e->getMessage());
    }

    logAudit('UPDATE_PROFILE', 'USERS', $auth['id'], [
        'name' => $name,
        'phone' => $phone,
        'department' => $department,
        'pixKey' => $pixKey
    ], $auth['id'], $name);

    $stmtGet = $db->prepare("
        SELECT u.id, u.name, u.email, u.role, u.title, u.department, u.phone, u.avatar, u.pix_key,
               m.pix_key AS member_pix_key
        FROM users u
        LEFT JOIN members m ON (m.user_id = u.id OR LOWER(TRIM(m.name)) = LOWER(TRIM(u.name)))
        WHERE u.id = ?
        LIMIT 1
    ");
    $stmtGet->execute([$auth['id']]);
    $updatedUser = $stmtGet->fetch();
    if ($updatedUser) {
        $updatedUser['pixKey'] = !empty($updatedUser['member_pix_key']) ? $updatedUser['member_pix_key'] : ($updatedUser['pix_key'] ?? '');
    }

    jsonResponse([
        'success' => true,
        'message' => 'Perfil atualizado com sucesso.',
        'user'    => $updatedUser
    ]);
}

// ------------------------------------------------------------------------------
// ATUALIZAR, CADASTRAR OU EXCLUIR CHAVE PIX (DIRETAMENTE PELO COLABORADOR OU ADMIN)
// ------------------------------------------------------------------------------
if ($method === 'POST' && $action === 'update_pix') {
    $auth = requireAuth();
    $input = getJsonInput();
    $pixKey = trim($input['pixKey'] ?? ($input['pix_key'] ?? ''));

    // Auto-recuperação da coluna pix_key em users
    try {
        $chk = $db->query("SHOW COLUMNS FROM users LIKE 'pix_key'")->fetch();
        if (!$chk) {
            $db->exec("ALTER TABLE users ADD COLUMN pix_key VARCHAR(100) NULL AFTER phone");
        }
    } catch (Exception $e) {}

    $val = $pixKey !== '' ? $pixKey : null;

    $db->prepare("UPDATE users SET pix_key = ? WHERE id = ?")->execute([$val, $auth['id']]);
    $db->prepare("
        UPDATE members
        SET pix_key = ?, user_id = COALESCE(user_id, ?)
        WHERE user_id = ? OR LOWER(TRIM(name)) = LOWER(TRIM(?))
    ")->execute([$val, $auth['id'], $auth['id'], $auth['name']]);

    bumpSyncVersion("members");
    logAudit('UPDATE_PIX', 'MEMBERS', $auth['id'], ($pixKey ? "Chave PIX atualizada para '{$pixKey}'" : "Chave PIX removida") . " por {$auth['name']}.", $auth['id'], $auth['name']);

    jsonResponse(['success' => true, 'pixKey' => $pixKey]);
}

// ------------------------------------------------------------------------------
// ATUALIZAR DISPONIBILIDADE PARA HORAS EXTRAS (COLABORADOR OU ADMIN)
// ------------------------------------------------------------------------------
if ($method === 'POST' && $action === 'update_availability') {
    $auth = requireAuth();
    $input = getJsonInput();
    $availability = $input['availability'] ?? null;
    $targetMemberId = trim($input['memberId'] ?? ($input['id'] ?? ''));

    // Garante que a coluna extra_hours_availability exista na tabela members
    try {
        $chk = $db->query("SHOW COLUMNS FROM members LIKE 'extra_hours_availability'")->fetch();
        if (!$chk) {
            $db->exec("ALTER TABLE members ADD COLUMN extra_hours_availability LONGTEXT NULL AFTER pix_key");
        }
    } catch (Exception $e) {}

    $availJson = !empty($availability) ? (is_string($availability) ? $availability : json_encode($availability, JSON_UNESCAPED_UNICODE)) : null;

    if (!empty($targetMemberId) && ($auth['role'] === 'ADMIN' || $auth['role'] === 'MANAGER')) {
        $db->prepare("UPDATE members SET extra_hours_availability = ? WHERE id = ?")->execute([$availJson, $targetMemberId]);
    } else {
        $db->prepare("
            UPDATE members
            SET extra_hours_availability = ?, user_id = COALESCE(user_id, ?)
            WHERE user_id = ? OR LOWER(TRIM(name)) = LOWER(TRIM(?))
        ")->execute([$availJson, $auth['id'], $auth['id'], $auth['name']]);
    }

    bumpSyncVersion("members");
    $statusVal = is_array($availability) ? ($availability['status'] ?? 'available') : 'available';
    logAudit('UPDATE_AVAILABILITY', 'MEMBERS', $targetMemberId ?: $auth['id'], "Disponibilidade de horas extras alterada para '{$statusVal}' por {$auth['name']}.", $auth['id'], $auth['name']);

    jsonResponse(['success' => true, 'extraHoursAvailability' => $availability]);
}

// ------------------------------------------------------------------------------
// ATUALIZAR AVATAR/FOTO DIRETAMENTE (ADMIN OU PRÓPRIO USUÁRIO)
// ------------------------------------------------------------------------------
if ($method === 'POST' && $action === 'update_avatar') {
    $auth = requireAuth();
    $input = getJsonInput();
    $targetUserId = trim($input['user_id'] ?? $auth['id']);
    $avatar = $input['avatar'] ?? null;

    if ($targetUserId !== $auth['id'] && $auth['role'] !== 'ADMIN') {
        jsonResponse(['success' => false, 'error' => 'Apenas Administradores podem alterar a foto de outros usuários.'], 403);
    }

    // Impede que não-ADMIN altere foto de conta ADMIN
    $targetStmt = $db->prepare("SELECT role FROM users WHERE id = ?");
    $targetStmt->execute([$targetUserId]);
    $targetUserRole = $targetStmt->fetchColumn();
    if ($targetUserRole === 'ADMIN' && $auth['role'] !== 'ADMIN') {
        jsonResponse(['success' => false, 'error' => 'Gestores não têm permissão para alterar a foto de Administradores.'], 403);
    }

    $db->prepare("UPDATE users SET avatar = ? WHERE id = ?")->execute([$avatar, $targetUserId]);
    $db->prepare("UPDATE members SET photo_url = ? WHERE user_id = ?")->execute([$avatar, $targetUserId]);
    bumpSyncVersion("members");

    jsonResponse(['success' => true, 'avatar' => $avatar]);
}

// ------------------------------------------------------------------------------
// ALTERAR SENHA
// ------------------------------------------------------------------------------
if ($method === 'POST' && $action === 'change_password') {
    $auth = requireAuth();
    $input = getJsonInput();

    $currentPass = $input['current_password'] ?? '';
    $newPass = $input['new_password'] ?? '';

    $passErr = validatePasswordStrength($newPass);
    if ($passErr) {
        jsonResponse(['success' => false, 'error' => $passErr], 400);
    }

    $stmt = $db->prepare("SELECT password_hash FROM users WHERE id = ?");
    $stmt->execute([$auth['id']]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($currentPass, $user['password_hash'])) {
        logAudit('CHANGE_PASSWORD_FAIL', 'AUTH', $auth['id'], 'Tentativa com senha atual incorreta.', $auth['id'], $auth['name']);
        jsonResponse(['success' => false, 'error' => 'A senha atual está incorreta.'], 400);
    }

    $newHash = password_hash($newPass, PASSWORD_BCRYPT, ['cost' => 11]);
    $stmtUp = $db->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
    $stmtUp->execute([$newHash, $auth['id']]);

    // Revoga todas as sessões anteriores por segurança, mantendo apenas a atual
    $currentSessionId = $auth['session_id'] ?? '';
    $db->prepare("DELETE FROM user_sessions WHERE user_id = ? AND id != ?")->execute([$auth['id'], $currentSessionId]);

    logAudit('CHANGE_PASSWORD_SUCCESS', 'AUTH', $auth['id'], 'Senha alterada com sucesso.', $auth['id'], $auth['name']);

    jsonResponse([
        'success' => true,
        'message' => 'Senha alterada com sucesso.'
    ]);
}

// ------------------------------------------------------------------------------
// LOGOUT
// ------------------------------------------------------------------------------
if ($method === 'POST' && $action === 'logout') {
    $token = getBearerOrCookieToken();
    if ($token) {
        destroyUserSession($db, $token);
    }
    jsonResponse(['success' => true, 'message' => 'Sessão encerrada com sucesso.']);
}

// ------------------------------------------------------------------------------
// LISTAR USUÁRIOS DO SISTEMA (Admin & Manager)
// ------------------------------------------------------------------------------
if ($method === 'GET' && $action === 'list_users') {
    $auth = requireAuth(['ADMIN', 'MANAGER']);
    // Apenas ADMIN pode visualizar a listagem com outros ADMINS
    if ($auth['role'] === 'ADMIN') {
        $stmt = $db->query("SELECT id, name, email, role, title, department, phone, avatar, created_at FROM users ORDER BY role ASC, name ASC");
    } else {
        $stmt = $db->query("SELECT id, name, email, role, title, department, phone, avatar, created_at FROM users WHERE role != 'ADMIN' ORDER BY role ASC, name ASC");
    }
    $users = $stmt->fetchAll();
    jsonResponse(['success' => true, 'users' => $users]);
}

// ------------------------------------------------------------------------------
// CRIAR USUÁRIO DO SISTEMA (Admin & Manager - com restrição estrita)
// ------------------------------------------------------------------------------
if ($method === 'POST' && $action === 'create_user') {
    $auth = requireAuth(['ADMIN', 'MANAGER']);
    $input = getJsonInput();

    $name = trim($input['name'] ?? '');
    $email = strtolower(trim($input['email'] ?? ''));
    $password = $input['password'] ?? '';
    $role = strtoupper(trim($input['role'] ?? 'USER'));
    $title = trim($input['title'] ?? '');
    $department = trim($input['department'] ?? '');
    $phone = trim($input['phone'] ?? '');

    if (empty($name) || empty($email)) {
        jsonResponse(['success' => false, 'error' => 'Nome e e-mail são obrigatórios.'], 400);
    }

    if (!in_array($role, ['ADMIN', 'MANAGER', 'USER'])) {
        $role = 'USER';
    }

    // REGRA DE SEGURANÇA: Apenas ADMIN pode criar outro ADMIN
    if ($role === 'ADMIN' && $auth['role'] !== 'ADMIN') {
        jsonResponse(['success' => false, 'error' => 'Gestores não têm permissão para criar contas de Administrador.'], 403);
    }

    $stmtCheck = $db->prepare("SELECT id FROM users WHERE LOWER(email) = ?");
    $stmtCheck->execute([$email]);
    if ($stmtCheck->fetch()) {
        jsonResponse(['success' => false, 'error' => 'Já existe um usuário cadastrado com este e-mail.'], 400);
    }

    $passErr = validatePasswordStrength($password);
    if ($passErr) {
        jsonResponse(['success' => false, 'error' => $passErr], 400);
    }

    $id = 'usr-' . bin2hex(random_bytes(8));
    $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 11]);

    $stmt = $db->prepare("
        INSERT INTO users (id, name, email, password_hash, role, title, department, phone, avatar)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
    ");
    $stmt->execute([$id, $name, $email, $hash, $role, $title, $department, $phone]);

    logAudit('CREATE_USER', 'USERS', $id, "Criou o usuário {$name} ({$email}) com nível {$role}.", $auth['id'], $auth['name']);
    bumpSyncVersion();

    jsonResponse([
        'success' => true,
        'message' => 'Usuário criado com sucesso.',
        'user' => [
            'id' => $id,
            'name' => $name,
            'email' => $email,
            'role' => $role,
            'title' => $title,
            'department' => $department,
            'phone' => $phone,
        ]
    ]);
}

// ------------------------------------------------------------------------------
// ATUALIZAR USUÁRIO DO SISTEMA (Admin & Manager)
// ------------------------------------------------------------------------------
if ($method === 'POST' && $action === 'update_user') {
    $auth = requireAuth(['ADMIN', 'MANAGER']);
    $input = getJsonInput();
    $targetId = trim($input['id'] ?? $input['user_id'] ?? '');

    if (empty($targetId)) {
        jsonResponse(['success' => false, 'error' => 'ID do usuário não fornecido.'], 400);
    }

    $stmt = $db->prepare("SELECT id, name, email, role FROM users WHERE id = ?");
    $stmt->execute([$targetId]);
    $target = $stmt->fetch();
    if (!$target) {
        jsonResponse(['success' => false, 'error' => 'Usuário não encontrado.'], 404);
    }

    $name = trim($input['name'] ?? $target['name']);
    $title = trim($input['title'] ?? '');
    $department = trim($input['department'] ?? '');
    $phone = trim($input['phone'] ?? '');
    $password = $input['password'] ?? '';
    $requestedRole = strtoupper(trim($input['role'] ?? $target['role']));
    if (!in_array($requestedRole, ['ADMIN', 'MANAGER', 'USER'])) $requestedRole = $target['role'];

    // REGRA DE SEGURANÇA: Gestor não pode editar Admin nem promover para Admin
    if ($auth['role'] !== 'ADMIN') {
        if ($target['role'] === 'ADMIN') {
            jsonResponse(['success' => false, 'error' => 'Gestores não podem alterar contas de Administrador.'], 403);
        }
        if ($requestedRole === 'ADMIN') {
            jsonResponse(['success' => false, 'error' => 'Gestores não podem promover contas para Administrador.'], 403);
        }
    }

    // Impede rebaixar o último Administrador mestre
    $roleToSet = $requestedRole;
    if ($target['role'] === 'ADMIN' && $requestedRole !== 'ADMIN') {
        $count = $db->query("SELECT COUNT(*) FROM users WHERE role = 'ADMIN'")->fetchColumn();
        if ($count <= 1) {
            $roleToSet = 'ADMIN';
        }
    }

    if (!empty($password)) {
        $passErr = validatePasswordStrength($password);
        if ($passErr) {
            jsonResponse(['success' => false, 'error' => $passErr], 400);
        }
        $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 11]);
        $stmtUp = $db->prepare("UPDATE users SET name = ?, password_hash = ?, role = ?, title = ?, department = ?, phone = ? WHERE id = ?");
        $stmtUp->execute([$name, $hash, $roleToSet, $title, $department, $phone, $targetId]);
        // Revoga sessões antigas deste usuário ao ter a senha resetada
        revokeAllUserSessions($db, $targetId);
    } else {
        $stmtUp = $db->prepare("UPDATE users SET name = ?, role = ?, title = ?, department = ?, phone = ? WHERE id = ?");
        $stmtUp->execute([$name, $roleToSet, $title, $department, $phone, $targetId]);
    }

    logAudit('UPDATE_USER', 'USERS', $targetId, "Atualizou dados do usuário {$name}.", $auth['id'], $auth['name']);
    bumpSyncVersion();

    jsonResponse([
        'success' => true,
        'message' => 'Dados do usuário atualizados com sucesso.'
    ]);
}

// ------------------------------------------------------------------------------
// EXCLUIR USUÁRIO (Apenas Admin)
// ------------------------------------------------------------------------------
if ($method === 'POST' && $action === 'delete_user') {
    $auth = requireAuth(['ADMIN']);
    $input = getJsonInput();
    $targetId = trim($input['user_id'] ?? '');

    if (empty($targetId)) {
        jsonResponse(['success' => false, 'error' => 'ID do usuário não fornecido.'], 400);
    }

    if ($targetId === $auth['id']) {
        jsonResponse(['success' => false, 'error' => 'Operação de segurança: você não pode excluir a sua própria conta ativa.'], 400);
    }

    $stmt = $db->prepare("SELECT id, name, email, role FROM users WHERE id = ?");
    $stmt->execute([$targetId]);
    $targetUser = $stmt->fetch();

    if (!$targetUser) {
        jsonResponse(['success' => false, 'error' => 'Usuário não encontrado no sistema.'], 404);
    }

    if ($targetUser['role'] === 'ADMIN') {
        $stmtCount = $db->prepare("SELECT COUNT(*) as count FROM users WHERE role = 'ADMIN' AND id != ?");
        $stmtCount->execute([$targetId]);
        $rowCount = $stmtCount->fetch();
        if (($rowCount['count'] ?? 0) < 1) {
            jsonResponse(['success' => false, 'error' => 'Ação bloqueada: o sistema precisa manter ao menos um Administrador mestre ativo.'], 400);
        }
    }

    revokeAllUserSessions($db, $targetId);

    $stmtDel = $db->prepare("DELETE FROM users WHERE id = ?");
    $stmtDel->execute([$targetId]);

    logAudit('DELETE_USER', 'USERS', $targetId, "Excluiu o usuário {$targetUser['name']} ({$targetUser['email']}).", $auth['id'], $auth['name']);
    bumpSyncVersion();

    jsonResponse([
        'success' => true,
        'message' => "Usuário {$targetUser['name']} excluído com sucesso."
    ]);
}

jsonResponse(['error' => 'Ação de autenticação não reconhecida.'], 404);
