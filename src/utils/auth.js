// Utilitário de Autenticação e Controle de Acesso (RBAC) do GestorMF

export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  USER: 'user',
};

// Normalizador seguro de cargos (suporta maiúsculas do banco 'ADMIN', 'MANAGER', 'USER' e variações)
export function normalizeRole(role) {
  if (!role) return ROLES.USER;
  const val = String(role).trim().toLowerCase();
  if (val === 'admin' || val === 'administrador') return ROLES.ADMIN;
  if (val === 'manager' || val === 'gestor') return ROLES.MANAGER;
  return ROLES.USER;
}

const ADMIN_CFG = {
  label: 'Administrador',
  badgeClass: 'role-badge-admin',
  color: '#8b5cf6',
  accentBg: 'rgba(139, 92, 246, 0.15)',
  accentBorder: 'rgba(139, 92, 246, 0.4)',
  description: 'Acesso total e irrestrito a todas as funções, configurações e cadastros do sistema.',
};

const MANAGER_CFG = {
  label: 'Gestor',
  badgeClass: 'role-badge-manager',
  color: '#0ea5e9',
  accentBg: 'rgba(14, 165, 233, 0.15)',
  accentBorder: 'rgba(14, 165, 233, 0.4)',
  description: 'Gestão de frotas, equipes, lançamento de abastecimentos, correção de combustível e missões.',
};

const USER_CFG = {
  label: 'Usuário',
  badgeClass: 'role-badge-user',
  color: '#10b981',
  accentBg: 'rgba(16, 185, 129, 0.15)',
  accentBorder: 'rgba(16, 185, 129, 0.4)',
  description: 'Consulta operacional de escalas e monitoramento de rotas em tempo real.',
};

export const ROLE_CONFIG = {
  [ROLES.ADMIN]: ADMIN_CFG,
  [ROLES.MANAGER]: MANAGER_CFG,
  [ROLES.USER]: USER_CFG,
  // Chaves em maiúsculas para compatibilidade direta com ENUM do MySQL
  ADMIN: ADMIN_CFG,
  MANAGER: MANAGER_CFG,
  USER: USER_CFG,
};

export const INITIAL_SYSTEM_USERS = [];

// Carrega usuários do LocalStorage ou inicializa
export function getStoredUsers() {
  try {
    const data = localStorage.getItem('gestormf_users');
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Remove contas fictícias legadas de teste se existirem
        return parsed.filter(
          (u) => !['admin@megagestao.com', 'gestor@megagestao.com', 'usuario@megagestao.com'].includes(u.email)
        );
      }
    }
  } catch (e) {
    console.error('Erro ao ler usuários:', e);
  }
  return [];
}

// Salva lista de usuários (sem nunca persistir senhas em texto puro)
export function saveStoredUsers(users) {
  const sanitized = (users || []).map((u) => {
    if (!u) return u;
    const { password, ...safe } = u;
    return safe;
  });
  localStorage.setItem('gestormf_users', JSON.stringify(sanitized));
}

// Carrega usuário atualmente logado
export function getCurrentUser() {
  try {
    const data = localStorage.getItem('gestormf_current_user');
    if (data) {
      const parsed = JSON.parse(data);
      if (parsed) {
        delete parsed.password;
        parsed.role = normalizeRole(parsed.role);
        return parsed;
      }
    }
  } catch (e) {
    console.error('Erro ao carregar usuário atual:', e);
  }
  return null;
}

// Salva usuário autenticado (nunca salva senhas no navegador)
export function setCurrentUser(user) {
  if (!user) {
    localStorage.removeItem('gestormf_current_user');
  } else {
    const clone = { ...user, role: normalizeRole(user.role) };
    delete clone.password;
    localStorage.setItem('gestormf_current_user', JSON.stringify(clone));
  }
}

// Autenticação migrada para o backend seguro
export function authenticateUser(email, password) {
  return { success: false, message: 'Autenticação deve ser realizada diretamente pelo servidor seguro.' };
}

// ==========================================================
// Gestão de contas de acesso (criadas pelo Administrador)
// ==========================================================
const normalizeEmail = (email) => (email || '').trim().toLowerCase();

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((email || '').trim());
}

// Retorna a conta de acesso vinculada a um colaborador (ou null)
export function findUserByMemberId(memberId, memberName = '') {
  if (!memberId && !memberName) return null;
  const users = getStoredUsers();
  if (memberId) {
    const byId = users.find((u) => u.memberId === memberId);
    if (byId) return byId;
  }
  if (memberName) {
    const norm = memberName.trim().toLowerCase();
    const byName = users.find((u) => (u.name || '').trim().toLowerCase() === norm);
    if (byName) return byName;
  }
  return null;
}

// Valida dados de acesso. Retorna mensagem de erro ou null.
export function validateAccountData({ email, password, requirePassword, ignoreUserId }) {
  if (!isValidEmail(email)) return 'Informe um e-mail válido.';
  const normalized = normalizeEmail(email);
  const duplicated = getStoredUsers().some(
    (u) => normalizeEmail(u.email) === normalized && u.id !== ignoreUserId
  );
  if (duplicated) return 'Já existe um usuário cadastrado com este e-mail.';
  if (requirePassword && (!password || password.length < 6)) {
    return 'A senha deve ter no mínimo 6 caracteres.';
  }
  if (!requirePassword && password && password.length < 6) {
    return 'A nova senha deve ter no mínimo 6 caracteres.';
  }
  return null;
}

// Cria ou atualiza a conta vinculada a um colaborador (sem persistir senha no navegador)
export function saveMemberAccount(member, { email, role }) {
  const users = getStoredUsers();
  const existing = users.find((u) => u.memberId === member.id);
  let saved;

  if (existing) {
    saved = {
      ...existing,
      name: member.name,
      email: email.trim(),
      role,
      phone: member.phone || existing.phone,
      avatar: member.photoUrl || existing.avatar,
      title: member.role || existing.title,
    };
    delete saved.password;
    saveStoredUsers(users.map((u) => (u.id === existing.id ? saved : u)));
  } else {
    saved = {
      id: 'usr-' + Date.now(),
      memberId: member.id,
      name: member.name,
      email: email.trim(),
      role,
      title: member.role || '',
      department: member.company || '',
      phone: member.phone || '',
      avatar: member.photoUrl || '',
      createdAt: new Date().toISOString().slice(0, 10),
      notificationsEnabled: true,
      compactMode: false,
    };
    saveStoredUsers([...users, saved]);
  }

  // Mantém a sessão atual sincronizada se o próprio usuário foi alterado
  const current = getCurrentUser();
  if (current && current.id === saved.id) setCurrentUser(saved);
  return saved;
}

// Remove a conta de acesso vinculada a um colaborador
export function removeMemberAccount(memberId) {
  const users = getStoredUsers();
  const target = users.find((u) => u.memberId === memberId);
  if (!target) return;
  saveStoredUsers(users.filter((u) => u.id !== target.id));
}

// Logout do sistema
export function logoutUser() {
  setCurrentUser(null);
}

// Verificação de permissões do nível de acesso
export function checkPermission(user, action) {
  if (!user) return false;
  const role = normalizeRole(user.role);

  switch (action) {
    // 1. Configurações Globais da Empresa, Sede e Sistema
    case 'manage_settings':
    case 'manage_system_users':
    case 'reset_database':
    case 'view_audit_logs':
      return role === ROLES.ADMIN;

    // 2. Exclusões Críticas (Viaturas, Colaboradores, Histórico)
    case 'delete_vehicle':
    case 'delete_team_member':
    case 'delete_mission':
      return role === ROLES.ADMIN;

    // 3. Gestão Operacional de Equipes e Colaboradores
    case 'create_team_member':
    case 'edit_team_member':
    case 'manage_roles':
      return role === ROLES.ADMIN || role === ROLES.MANAGER;

    // 4. Gestão de Frotas, Abastecimentos e Combustível
    case 'create_vehicle':
    case 'edit_vehicle':
    case 'add_refueling':
    case 'calibrate_tank':
    case 'correct_odometer':
      return role === ROLES.ADMIN || role === ROLES.MANAGER;

    // 5. Agendamento e Criação de Missões
    case 'create_mission':
    case 'edit_mission':
      return role === ROLES.ADMIN || role === ROLES.MANAGER;

    // 6. Visualização dos Módulos Estratégicos (Viaturas & Equipes)
    case 'view_vehicles':
    case 'view_teams':
      return role === ROLES.ADMIN || role === ROLES.MANAGER;

    // 7. Atualização de Status da Missão em Andamento (Operacional)
    case 'update_mission_status':
    case 'view_dashboard':
    case 'view_map':
    case 'view_board':
      return true; // Todos os níveis autenticados

    default:
      return role === ROLES.ADMIN;
  }
}

