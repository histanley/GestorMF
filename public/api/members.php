<?php
// ==============================================================================
// GestorMF API - Gestão de Colaboradores e Equipes (com Auditoria & Tempo Real)
// ==============================================================================
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();

function ensureMembersColumns($db) {
    try {
        $stmt = $db->query("SHOW COLUMNS FROM members LIKE 'secondary_roles'");
        if (!$stmt || !$stmt->fetch()) {
            $db->exec("ALTER TABLE members ADD COLUMN secondary_roles LONGTEXT NULL AFTER role");
        }
    } catch (Exception $e) {}

    try {
        $stmt = $db->query("SHOW COLUMNS FROM members LIKE 'hourly_rate'");
        if (!$stmt || !$stmt->fetch()) {
            $db->exec("ALTER TABLE members ADD COLUMN hourly_rate DECIMAL(10,2) DEFAULT 0.00 AFTER cnh_category");
            $db->exec("ALTER TABLE members ADD COLUMN daily_rate DECIMAL(10,2) DEFAULT 0.00 AFTER hourly_rate");
            $db->exec("ALTER TABLE members ADD COLUMN rate_model VARCHAR(30) DEFAULT 'hourly' AFTER daily_rate");
            $db->exec("ALTER TABLE members ADD COLUMN block_rate DECIMAL(10,2) DEFAULT 0.00 AFTER rate_model");
            $db->exec("ALTER TABLE members ADD COLUMN pix_key VARCHAR(100) NULL AFTER block_rate");
        }
    } catch (Exception $e) {}

    try {
        $stmt = $db->query("SHOW COLUMNS FROM members LIKE 'extra_hours_availability'");
        if (!$stmt || !$stmt->fetch()) {
            $db->exec("ALTER TABLE members ADD COLUMN extra_hours_availability LONGTEXT NULL AFTER pix_key");
        }
    } catch (Exception $e) {}

    // Sincronização automática e contínua de fotos de perfil de usuários para colaboradores
    try {
        $db->exec("
            UPDATE members m
            INNER JOIN users u ON (u.id = m.user_id OR LOWER(TRIM(u.name)) = LOWER(TRIM(m.name)))
            SET m.photo_url = u.avatar,
                m.user_id = COALESCE(m.user_id, u.id)
            WHERE u.avatar IS NOT NULL AND u.avatar != ''
        ");
    } catch (Exception $e) {}
}
ensureMembersColumns($db);

// LISTAR COLABORADORES (GET)
if ($method === 'GET') {
    $user = requireAuth();
    $stmt = $db->query("
        SELECT m.*, u.avatar AS user_avatar
        FROM members m
        LEFT JOIN users u ON (u.id = m.user_id OR LOWER(TRIM(u.name)) = LOWER(TRIM(m.name)))
        ORDER BY m.name ASC
    ");
    $raw = $stmt->fetchAll();

    $members = array_map(function($m) {
        $secRoles = [];
        if (!empty($m['secondary_roles'])) {
            $decoded = is_array($m['secondary_roles']) ? $m['secondary_roles'] : json_decode($m['secondary_roles'], true);
            if (is_array($decoded)) $secRoles = $decoded;
        }
        $extraAvail = null;
        if (!empty($m['extra_hours_availability'])) {
            $decodedAvail = is_array($m['extra_hours_availability']) ? $m['extra_hours_availability'] : json_decode($m['extra_hours_availability'], true);
            if (is_array($decodedAvail)) $extraAvail = $decodedAvail;
        }
        // Prioriza a foto atualizada do usuário (app móvel/perfil); fallback para photo_url do membro
        $resolvedPhoto = !empty($m['user_avatar']) ? $m['user_avatar'] : (!empty($m['photo_url']) ? $m['photo_url'] : null);
        return [
            'id'                     => $m['id'],
            'name'                   => $m['name'],
            'role'                   => $m['role'],
            'secondaryRoles'         => $secRoles,
            'company'                => $m['company'],
            'phone'                  => $m['phone'],
            'photoUrl'               => $resolvedPhoto,
            'canDrive'               => (bool)($m['can_drive'] ?? false),
            'cnhCategory'            => $m['cnh_category'] ?? 'B',
            'hourlyRate'             => isset($m['hourly_rate']) ? (float)$m['hourly_rate'] : 0.0,
            'dailyRate'              => isset($m['daily_rate']) ? (float)$m['daily_rate'] : 0.0,
            'rateModel'              => $m['rate_model'] ?? 'hourly',
            'blockRate'              => isset($m['block_rate']) ? (float)$m['block_rate'] : 0.0,
            'pixKey'                 => $m['pix_key'] ?? '',
            'extraHoursAvailability' => $extraAvail,
            'userId'                 => $m['user_id'] ?? null,
            'active'                 => (bool)$m['active'],
            'createdAt'              => $m['created_at'],
            'updatedAt'              => $m['updated_at']
        ];
    }, $raw);

    jsonResponse(['success' => true, 'members' => $members]);
}

// SALVAR OU ATUALIZAR COLABORADOR (POST / PUT)
if ($method === 'POST' || $method === 'PUT') {
    $inputData = getJsonInput();
    $action = $_GET['action'] ?? ($inputData['action'] ?? '');

    // Rota Rápida: Atualizar Disponibilidade para Horas Extras (Próprio Colaborador ou Admin)
    if ($action === 'update_availability' || (isset($inputData['extraHoursAvailability']) && count($inputData) <= 3 && isset($inputData['id']))) {
        $user = requireAuth(); // Qualquer perfil autenticado (USER, MANAGER, ADMIN)
        $targetId = trim($inputData['id'] ?? ($inputData['memberId'] ?? ''));
        $avail = $inputData['extraHoursAvailability'] ?? ($inputData['availability'] ?? null);
        $availJson = !empty($avail) ? (is_string($avail) ? $avail : json_encode($avail, JSON_UNESCAPED_UNICODE)) : null;

        // Permissão: Admin, Manager ou o próprio colaborador vinculado
        $canEdit = ($user['role'] === 'ADMIN' || $user['role'] === 'MANAGER');
        if (!$canEdit && !empty($targetId)) {
            $stmtOwner = $db->prepare("SELECT id, name, user_id FROM members WHERE id = ?");
            $stmtOwner->execute([$targetId]);
            $owner = $stmtOwner->fetch();
            if ($owner && ($owner['user_id'] === $user['id'] || strtolower(trim($owner['name'])) === strtolower(trim($user['name'])))) {
                $canEdit = true;
            }
        }
        if (!$canEdit && empty($targetId)) {
            $canEdit = true; // Edita a si próprio
        }

        if (!$canEdit) {
            jsonResponse(['success' => false, 'error' => 'Acesso negado para alterar disponibilidade deste colaborador.'], 403);
        }

        if (!empty($targetId)) {
            $db->prepare("UPDATE members SET extra_hours_availability = ? WHERE id = ?")->execute([$availJson, $targetId]);
        } else {
            $db->prepare("
                UPDATE members
                SET extra_hours_availability = ?, user_id = COALESCE(user_id, ?)
                WHERE user_id = ? OR LOWER(TRIM(name)) = LOWER(TRIM(?))
            ")->execute([$availJson, $user['id'], $user['id'], $user['name']]);
        }

        bumpSyncVersion("members");
        $statusVal = is_array($avail) ? ($avail['status'] ?? 'available') : 'available';
        logAudit('UPDATE_AVAILABILITY', 'TEAMS', $targetId ?: $user['id'], "Disponibilidade de horas extras alterada para '{$statusVal}' por {$user['name']}.", $user['id'], $user['name']);

        jsonResponse(['success' => true, 'message' => 'Disponibilidade atualizada com sucesso!', 'extraHoursAvailability' => $avail]);
    }

    $user = requireAuth(['ADMIN', 'MANAGER']);
    $data = $inputData;

    $id = trim($data['id'] ?? '');
    if (empty($id)) {
        $id = 'm-' . bin2hex(random_bytes(8));
    }

    $name = trim($data['name'] ?? '');
    $role = trim($data['role'] ?? '');

    if (empty($name) || empty($role)) {
        jsonResponse(['success' => false, 'error' => 'Nome e função do colaborador são obrigatórios.'], 400);
    }

    $stmtCheck = $db->prepare("SELECT id, name, user_id FROM members WHERE id = ?");
    $stmtCheck->execute([$id]);
    $existing = $stmtCheck->fetch();

    $canDrive = !empty($data['canDrive']) || !empty($data['hasCnh']) ? 1 : 0;
    $cnhCategory = trim($data['cnhCategory'] ?? 'B');

    // Validação de Conta de Acesso antes de iniciar a transação
    $acc = $data['account'] ?? null;
    $accEmail = strtolower(trim($acc['email'] ?? $data['email'] ?? ''));
    $accPassword = $acc['password'] ?? $data['password'] ?? '';
    $accRole = strtoupper(trim($acc['role'] ?? $data['accessRole'] ?? 'USER'));
    if (!in_array($accRole, ['ADMIN', 'MANAGER', 'USER'])) $accRole = 'USER';

    // Gestor (MANAGER) NUNCA pode promover conta para ADMIN
    if ($accRole === 'ADMIN' && $user['role'] !== 'ADMIN') {
        jsonResponse(['success' => false, 'error' => 'Apenas Administradores podem definir ou promover contas para Administrador.'], 403);
    }

    // Inicia transação atômica
    $db->beginTransaction();

    try {
        // P0-01: NUNCA aceita user_id arbitrário enviado pelo cliente.
        // O vínculo é derivado estritamente do vínculo existente ou da conta autenticada/criada.
        $assignedUserId = $existing ? ($existing['user_id'] ?? null) : null;

        // P1-06 & P0-01: Tratamento estrito do vínculo de conta de acesso por ID
        if (!empty($accEmail)) {
            $stmtUserCheck = $db->prepare("SELECT id, name, email, role FROM users WHERE LOWER(email) = ?");
            $stmtUserCheck->execute([$accEmail]);
            $existingUser = $stmtUserCheck->fetch();

            if ($existingUser) {
                // Impede que uma conta já pertencente a OUTRO colaborador seja roubada ou sobrescrita
                $stmtOther = $db->prepare("SELECT id, name FROM members WHERE user_id = ? AND id != ? LIMIT 1");
                $stmtOther->execute([$existingUser['id'], $id]);
                $otherMem = $stmtOther->fetch();
                if ($otherMem) {
                    $db->rollBack();
                    jsonResponse([
                        'success' => false,
                        'error'   => "A conta de e-mail '{$accEmail}' já pertence ao colaborador '{$otherMem['name']}' (#{$otherMem['id']}). Não é permitida a apropriação indevida ou duplicidade de vínculos."
                    ], 409);
                }

                // Se a conta for de ADMIN e quem edita não for ADMIN, bloqueia
                if (strtoupper($existingUser['role']) === 'ADMIN' && $user['role'] !== 'ADMIN') {
                    $db->rollBack();
                    jsonResponse(['success' => false, 'error' => 'Acesso negado: apenas Administradores podem modificar dados de contas de Administrador.'], 403);
                }

                // Se está associando uma conta preexistente que não estava vinculada a este colaborador, exige ADMIN
                if ($assignedUserId !== $existingUser['id'] && $user['role'] !== 'ADMIN') {
                    $db->rollBack();
                    jsonResponse([
                        'success' => false,
                        'error'   => 'Apenas Administradores têm permissão para vincular contas existentes a colaboradores.'
                    ], 403);
                }

                $assignedUserId = $existingUser['id'];

                if (!empty($accPassword)) {
                    $passErr = validatePasswordStrength($accPassword);
                    if ($passErr) {
                        $db->rollBack();
                        jsonResponse(['success' => false, 'error' => $passErr], 400);
                    }
                    $hash = password_hash($accPassword, PASSWORD_BCRYPT, ['cost' => 11]);
                    $db->prepare("
                        UPDATE users
                        SET name = ?, password_hash = ?, role = ?, title = ?, department = ?, phone = ?, avatar = COALESCE(?, avatar)
                        WHERE id = ?
                    ")->execute([$name, $hash, $accRole, $role, $data['company'] ?? 'MegaFilmes', $data['phone'] ?? '', $data['photoUrl'] ?? null, $assignedUserId]);

                    // Revoga sessões antigas para forçar re-login com nova senha
                    revokeAllUserSessions($db, $assignedUserId);
                } else {
                    $db->prepare("
                        UPDATE users
                        SET name = ?, role = ?, title = ?, department = ?, phone = ?, avatar = COALESCE(?, avatar)
                        WHERE id = ?
                    ")->execute([$name, $accRole, $role, $data['company'] ?? 'MegaFilmes', $data['phone'] ?? '', $data['photoUrl'] ?? null, $assignedUserId]);

                    // Se mudou de papel, revoga sessões para forçar atualização de permissões
                    if ($existingUser['role'] !== $accRole) {
                        revokeAllUserSessions($db, $assignedUserId);
                    }
                }
            } else {
                // Provisionamento de nova conta segura (Item 04: validação forte de senha)
                if (empty($accPassword)) {
                    $db->rollBack();
                    jsonResponse(['success' => false, 'error' => 'A senha é obrigatória para criar a conta de acesso do colaborador.'], 400);
                }
                $passErr = validatePasswordStrength($accPassword);
                if ($passErr) {
                    $db->rollBack();
                    jsonResponse(['success' => false, 'error' => $passErr], 400);
                }

                $newUserId = 'usr-' . bin2hex(random_bytes(8));
                $hash = password_hash($accPassword, PASSWORD_BCRYPT, ['cost' => 11]);
                $db->prepare("
                    INSERT INTO users (id, name, email, password_hash, role, title, department, phone, avatar)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ")->execute([$newUserId, $name, $accEmail, $hash, $accRole, $role, $data['company'] ?? 'MegaFilmes', $data['phone'] ?? '', $data['photoUrl'] ?? null]);

                $assignedUserId = $newUserId;
                logAudit('CREATE_USER', 'USERS', $newUserId, "Conta de acesso de {$name} ({$accEmail}) criada via Gestão de Equipes.", $user['id'], $user['name']);
            }
        }

        $secRolesInput = $data['secondaryRoles'] ?? $data['secondary_roles'] ?? null;
        $secondaryRolesJson = !empty($secRolesInput) && is_array($secRolesInput)
            ? json_encode(array_values(array_unique(array_filter($secRolesInput))), JSON_UNESCAPED_UNICODE)
            : null;

        $hourlyRate = isset($data['hourlyRate']) ? (float)$data['hourlyRate'] : (isset($data['hourly_rate']) ? (float)$data['hourly_rate'] : 0.00);
        $dailyRate = isset($data['dailyRate']) ? (float)$data['dailyRate'] : (isset($data['daily_rate']) ? (float)$data['daily_rate'] : 0.00);
        $rateModel = trim($data['rateModel'] ?? ($data['rate_model'] ?? 'hourly'));
        $blockRate = isset($data['blockRate']) ? (float)$data['blockRate'] : (isset($data['block_rate']) ? (float)$data['block_rate'] : 0.00);
        $pixKey = trim($data['pixKey'] ?? ($data['pix_key'] ?? ''));

        $extraHoursAvailInput = $data['extraHoursAvailability'] ?? ($data['extra_hours_availability'] ?? null);
        $extraHoursAvailJson = !empty($extraHoursAvailInput)
            ? (is_string($extraHoursAvailInput) ? $extraHoursAvailInput : json_encode($extraHoursAvailInput, JSON_UNESCAPED_UNICODE))
            : null;

        $sql = "
            INSERT INTO members (id, name, role, secondary_roles, company, phone, photo_url, user_id, can_drive, cnh_category, hourly_rate, daily_rate, rate_model, block_rate, pix_key, extra_hours_availability, active)
            VALUES (:id, :name, :role, :secondary_roles, :company, :phone, :photo_url, :user_id, :can_drive, :cnh_category, :hourly_rate, :daily_rate, :rate_model, :block_rate, :pix_key, :extra_hours_availability, :active)
            ON DUPLICATE KEY UPDATE
                name = VALUES(name),
                role = VALUES(role),
                secondary_roles = VALUES(secondary_roles),
                company = VALUES(company),
                phone = VALUES(phone),
                photo_url = VALUES(photo_url),
                user_id = VALUES(user_id),
                can_drive = VALUES(can_drive),
                cnh_category = VALUES(cnh_category),
                hourly_rate = VALUES(hourly_rate),
                daily_rate = VALUES(daily_rate),
                rate_model = VALUES(rate_model),
                block_rate = VALUES(block_rate),
                pix_key = VALUES(pix_key),
                extra_hours_availability = VALUES(extra_hours_availability),
                active = VALUES(active)
        ";

        $stmtSave = $db->prepare($sql);
        $stmtSave->execute([
            ':id'                       => $id,
            ':name'                     => $name,
            ':role'                     => $role,
            ':secondary_roles'          => $secondaryRolesJson,
            ':company'                  => $data['company'] ?? 'MegaFilmes',
            ':phone'                    => $data['phone'] ?? '',
            ':photo_url'                => $data['photoUrl'] ?? null,
            ':user_id'                  => $assignedUserId,
            ':can_drive'                => $canDrive,
            ':cnh_category'             => $cnhCategory,
            ':hourly_rate'              => $hourlyRate,
            ':daily_rate'               => $dailyRate,
            ':rate_model'               => $rateModel,
            ':block_rate'               => $blockRate,
            ':pix_key'                  => $pixKey,
            ':extra_hours_availability' => $extraHoursAvailJson,
            ':active'                   => isset($data['active']) && !$data['active'] ? 0 : 1
        ]);

        // Sincroniza foto no usuário vinculado caso definida
        if (!empty($data['photoUrl']) && !empty($assignedUserId)) {
            try {
                $db->prepare("UPDATE users SET avatar = ? WHERE id = ?")->execute([$data['photoUrl'], $assignedUserId]);
            } catch (Exception $e) {}
        }

        $db->commit();
    } catch (Exception $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        error_log('[GestorMF Member Error] ' . $e->getMessage());
        jsonResponse(['success' => false, 'error' => 'Falha ao salvar dados do colaborador no banco de dados.'], 500);
    }

    $actionName = $existing ? 'UPDATE_MEMBER' : 'CREATE_MEMBER';
    $auditMsg = "Colaborador '{$name}' ({$role}) salvo por {$user['name']}.";
    logAudit($actionName, 'TEAMS', $id, $auditMsg, $user['id'], $user['name']);
    bumpSyncVersion("member_{$id}");

    jsonResponse(['success' => true, 'message' => 'Colaborador salvo com sucesso!', 'id' => $id]);
}

// EXCLUIR COLABORADOR (DELETE - Apenas Administrador)
if ($method === 'DELETE') {
    $user = requireAuth(['ADMIN']);
    $id = $_GET['id'] ?? '';
    if (empty($id)) {
        $input = getJsonInput();
        $id = $input['id'] ?? '';
    }

    if (empty($id)) {
        jsonResponse(['success' => false, 'error' => 'ID do colaborador não informado.'], 400);
    }

    $stmtGet = $db->prepare("SELECT name FROM members WHERE id = ?");
    $stmtGet->execute([$id]);
    $mem = $stmtGet->fetch();

    $stmtDel = $db->prepare("DELETE FROM members WHERE id = ?");
    $stmtDel->execute([$id]);

    $label = $mem ? $mem['name'] : $id;
    logAudit('DELETE_MEMBER', 'TEAMS', $id, "Colaborador '{$label}' removido.", $user['id'], $user['name']);
    bumpSyncVersion("delete_member_{$id}");

    jsonResponse(['success' => true, 'message' => 'Colaborador excluído com sucesso.']);
}

jsonResponse(['error' => 'Método não suportado.'], 405);

