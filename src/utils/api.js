// ==============================================================================
// GestorMF - Cliente de Conexão com a API HostGator (MySQL + Tempo Real)
// ==============================================================================
import { normalizeRole } from './auth';

const PROD_API_ORIGIN = 'https://gestormf.shop';
const API_BASE = (typeof window !== 'undefined' && (window.location.origin.includes('localhost') || window.location.protocol.startsWith('capacitor') || window.location.protocol.startsWith('file')))
  ? `${PROD_API_ORIGIN}/api`
  : '/api';

// Limpeza de tokens legados expostos em navegadores
try {
  localStorage.removeItem('gestormf_token');
} catch (e) {}

export function getAuthToken() {
  return '';
}

export function setAuthToken() {
  try {
    localStorage.removeItem('gestormf_token');
  } catch (e) {}
}

let currentCsrfToken = '';

function getCsrfFromCookie() {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/gestormf_csrf=([^;]+)/);
  return match ? match[1] : '';
}

export function setCsrfToken(token) {
  if (token) currentCsrfToken = token;
}

export function getCsrfToken() {
  return currentCsrfToken || getCsrfFromCookie();
}

async function apiRequest(endpoint, options = {}) {
  // Adiciona timestamp único para quebrar qualquer cache de disco de navegadores móveis (Safari/Chrome Mobile)
  const sep = endpoint.includes('?') ? '&' : '?';
  const url = `${API_BASE}${endpoint}${sep}_t=${Date.now()}`;
  const csrf = getCsrfToken();

  const headers = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    ...(options.headers || {})
  };

  try {
    const res = await fetch(url, {
      ...options,
      credentials: 'include',
      cache: 'no-store',
      headers
    });
    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch (e) {
      // resposta não é JSON
    }

    if (!res.ok) {
      let errorMsg = data?.error;
      if (!errorMsg) {
        if (text && text.length < 200 && !text.includes('<!DOCTYPE') && !text.includes('<html')) {
          errorMsg = text;
        } else if (res.status === 500) {
          errorMsg = 'Erro no servidor ao processar requisição. Verifique os logs de erro ou contate o administrador.';
        } else if (res.status === 401) {
          errorMsg = 'Sessão expirada ou não autenticada. Faça login novamente.';
        } else {
          errorMsg = `Erro HTTP ${res.status}`;
        }
      }
      return { success: false, error: errorMsg, status: res.status, rawText: text };
    }

    return data || { success: true };
  } catch (err) {
    console.warn(`[API] Erro ao conectar com ${url}:`, err.message);
    return { success: false, error: err.message, networkError: true };
  }
}

// ------------------------------------------------------------------------------
// 1. AUTENTICAÇÃO SEGURA (BCRYPT + SESSÕES SEGURAS)
// ------------------------------------------------------------------------------
export async function apiLogin(email, password) {
  const body = { email: (email || '').trim().toLowerCase(), password };
  const res = await apiRequest('/auth.php?action=login', {
    method: 'POST',
    body: JSON.stringify(body)
  });

  if (res.success && res.csrfToken) {
    setCsrfToken(res.csrfToken);
  }

  if (res.success && res.user) {
    res.user.role = normalizeRole(res.user.role);
    localStorage.setItem('gestormf_current_user', JSON.stringify(res.user));
  }
  return res;
}

export async function apiGetCurrentUser() {
  const res = await apiRequest('/auth.php?action=me');
  if (res.success && res.csrfToken) {
    setCsrfToken(res.csrfToken);
  }
  if (res.success && res.user) {
    res.user.role = normalizeRole(res.user.role);
    localStorage.setItem('gestormf_current_user', JSON.stringify(res.user));
  }
  return res;
}

export async function apiUpdateProfile(profileData) {
  return await apiRequest('/auth.php?action=update_profile', {
    method: 'POST',
    body: JSON.stringify(profileData)
  });
}

export async function apiChangePassword(currentPassword, newPassword) {
  return await apiRequest('/auth.php?action=change_password', {
    method: 'POST',
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword
    })
  });
}

export async function apiLogout() {
  await apiRequest('/auth.php?action=logout', { method: 'POST' });
  setAuthToken(null);
  localStorage.removeItem('gestormf_current_user');
}

export async function apiListUsers() {
  return await apiRequest('/auth.php?action=list_users');
}

export async function apiSyncUsers(users) {
  return await apiRequest('/auth.php?action=sync_users', {
    method: 'POST',
    body: JSON.stringify({ users })
  });
}

export async function apiCreateUser(userData) {
  return await apiRequest('/auth.php?action=create_user', {
    method: 'POST',
    body: JSON.stringify(userData)
  });
}

export async function apiDeleteUser(userId) {
  return await apiRequest('/auth.php?action=delete_user', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId })
  });
}

export async function apiUpdateUserAvatar(userId, avatar) {
  return await apiRequest('/auth.php?action=update_avatar', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, avatar })
  });
}

export async function apiUpdateUser(userId, userData) {
  return await apiRequest('/auth.php?action=update_user', {
    method: 'POST',
    body: JSON.stringify({ id: userId, ...userData })
  });
}

// ------------------------------------------------------------------------------
// 2. MISSÕES (CRUD + AUDITORIA)
// ------------------------------------------------------------------------------
export async function apiGetMissions() {
  return await apiRequest('/missions.php');
}

export async function apiSaveMission(mission) {
  return await apiRequest('/missions.php', {
    method: 'POST',
    body: JSON.stringify(mission)
  });
}

export async function apiDeleteMission(missionId, deleteSeries = false) {
  const query = deleteSeries ? '&deleteSeries=true' : '';
  return await apiRequest(`/missions.php?id=${encodeURIComponent(missionId)}${query}`, {
    method: 'DELETE'
  });
}

// ------------------------------------------------------------------------------
// 3. VIATURAS (CRUD + AUDITORIA)
// ------------------------------------------------------------------------------
export async function apiGetVehicles() {
  return await apiRequest('/vehicles.php');
}

export async function apiSaveVehicle(vehicle) {
  return await apiRequest('/vehicles.php', {
    method: 'POST',
    body: JSON.stringify(vehicle)
  });
}

export async function apiDeleteVehicle(vehicleId) {
  return await apiRequest(`/vehicles.php?id=${encodeURIComponent(vehicleId)}`, {
    method: 'DELETE'
  });
}

// ------------------------------------------------------------------------------
// 4. COLABORADORES & EQUIPES
// ------------------------------------------------------------------------------
export async function apiGetMembers() {
  return await apiRequest('/members.php');
}

export async function apiSaveMember(member) {
  return await apiRequest('/members.php', {
    method: 'POST',
    body: JSON.stringify(member)
  });
}

export async function apiDeleteMember(memberId) {
  return await apiRequest(`/members.php?id=${encodeURIComponent(memberId)}`, {
    method: 'DELETE'
  });
}

// ------------------------------------------------------------------------------
// 5. CONFIGURAÇÕES DA EMPRESA & SEDE
// ------------------------------------------------------------------------------
export async function apiGetSettings() {
  return await apiRequest('/settings.php');
}

export async function apiSaveSettings(settings, roles = null) {
  return await apiRequest('/settings.php', {
    method: 'POST',
    body: JSON.stringify({ settings, roles })
  });
}

// ------------------------------------------------------------------------------
// 6. TRILHA DE AUDITORIA (AUDIT LOGS)
// ------------------------------------------------------------------------------
export async function apiGetAuditLogs(module = '', search = '', limit = 60) {
  const query = new URLSearchParams({ module, search, limit }).toString();
  return await apiRequest(`/audit.php?${query}`);
}

// ------------------------------------------------------------------------------
// 7. LOCALIZAÇÃO GPS CONSENTIDO EM TEMPO REAL
// ------------------------------------------------------------------------------
export async function apiSendGpsLocation(locationData) {
  return await apiRequest('/gps.php?action=update', {
    method: 'POST',
    body: JSON.stringify(locationData)
  });
}

export async function apiStopGpsLocation(memberId) {
  return await apiRequest('/gps.php?action=stop', {
    method: 'POST',
    body: JSON.stringify({ memberId, isActive: false })
  });
}

export async function apiGetActiveGpsLocations() {
  return await apiRequest('/gps.php?action=active');
}

// ------------------------------------------------------------------------------
// 8. BACKUP E RESTAURAÇÃO TESTADA
// ------------------------------------------------------------------------------
export async function apiRestoreBackup(backupJsonData) {
  return await apiRequest('/backup.php?action=restore', {
    method: 'POST',
    body: JSON.stringify(backupJsonData)
  });
}

export async function apiDownloadBackup() {
  const headers = {
    'X-Requested-With': 'XMLHttpRequest'
  };

  const res = await fetch(`${API_BASE}/backup.php?action=download`, {
    credentials: 'include',
    headers
  });

  if (!res.ok) {
    throw new Error('Falha ao baixar backup. Verifique se possui permissão de Administrador.');
  }

  const blob = await res.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = `gestormf_backup_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(blobUrl);
}

export function getBackupDownloadUrl() {
  return `${API_BASE}/backup.php?action=download`;
}

// ------------------------------------------------------------------------------
// 10. WEB PUSH NOTIFICATIONS (PWA)
// ------------------------------------------------------------------------------
export async function apiRegisterPushSubscription(subscription) {
  const subData = subscription.toJSON ? subscription.toJSON() : subscription;
  return await apiRequest('/push.php?action=subscribe', {
    method: 'POST',
    body: JSON.stringify({
      endpoint: subData.endpoint,
      keys: subData.keys || {}
    })
  });
}

export async function apiUnsubscribePush(endpoint) {
  return await apiRequest('/push.php?action=unsubscribe', {
    method: 'POST',
    body: JSON.stringify({ endpoint })
  });
}

// ------------------------------------------------------------------------------
// 9. ATUALIZAÇÃO EM TEMPO REAL ULTRA-RÁPIDA (POLLING INTELIGENTE SEM F5)
// ------------------------------------------------------------------------------
export function subscribeToRealtimeSync(onUpdate) {
  let isSubscribed = true;
  let currentVersion = 0;
  let pollInterval = null;

  const checkSync = async () => {
    if (!isSubscribed) return;
    try {
      const res = await apiRequest(`/sync.php?version=${currentVersion}`);
      if (res && res.changed && res.version !== currentVersion) {
        currentVersion = res.version;
        onUpdate(res);
      }
    } catch (e) {
      // network silence
    }
  };

  // 1. Checagem imediata inicial
  checkSync();

  // 2. Loop de polling leve a cada 3 segundos (resposta de 3ms na HostGator)
  pollInterval = setInterval(checkSync, 3000);

  // 3. Ao reativar a aba no celular (destravar tela ou trocar de app), checa na mesma fração de segundo!
  const handleVisibility = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      checkSync();
    }
  };
  const handleFocus = () => {
    checkSync();
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);
  }

  return () => {
    isSubscribed = false;
    if (pollInterval) {
      clearInterval(pollInterval);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    }
  };
}

// ==============================================================================
// 12. SISTEMA DE COMUNICADOS E MENSAGENS INTERNAS (ADMIN / GESTOR -> TODOS OU INDIVIDUAL)
// ==============================================================================
export async function apiGetMessages() {
  return await apiRequest('/messages.php?action=list');
}

export async function apiSendMessage(messageData) {
  return await apiRequest('/messages.php?action=send', {
    method: 'POST',
    body: JSON.stringify(messageData),
  });
}

export async function apiMarkMessageRead(messageId) {
  return await apiRequest('/messages.php?action=mark_read', {
    method: 'POST',
    body: JSON.stringify({ messageId }),
  });
}

export async function apiDeleteMessage(messageId) {
  return await apiRequest(`/messages.php?action=delete&id=${encodeURIComponent(messageId)}`, {
    method: 'POST',
    body: JSON.stringify({ messageId }),
  });
}


