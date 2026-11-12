// ==============================================================================
// 11 FUNÇÕES OFICIAIS DA EMPRESA (MEGA FILMES & MEGA GESTÃO)
// ==============================================================================

export const OFFICIAL_COMPANY_ROLES = [
  'Diretor(a) de Cena',
  'Cinegrafista',
  'Piloto de Drone',
  'Fotógrafo(a)',
  'Editor de Vídeo',
  'Motorista / Produção',
  'Assistente Geral',
  'Designer Gráfico',
  'Operador de Áudio',
  'Social Mídia',
  'Transmissão (Streamer)',
];

export const ROLE_ICONS_MAP = {
  'Diretor(a) de Cena': '🎬',
  'Cinegrafista': '🎥',
  'Piloto de Drone': '🚁',
  'Fotógrafo(a)': '📷',
  'Editor de Vídeo': '✂️',
  'Motorista / Produção': '🚗',
  'Assistente Geral': '🛠️',
  'Designer Gráfico': '🎨',
  'Operador de Áudio': '🎙️',
  'Social Mídia': '📱',
  'Transmissão (Streamer)': '📡',
};

export const ROLE_COLORS_MAP = {
  'Diretor(a) de Cena': '#f59e0b',
  'Cinegrafista': '#3b82f6',
  'Piloto de Drone': '#06b6d4',
  'Fotógrafo(a)': '#ec4899',
  'Editor de Vídeo': '#8b5cf6',
  'Motorista / Produção': '#10b981',
  'Assistente Geral': '#64748b',
  'Designer Gráfico': '#f43f5e',
  'Operador de Áudio': '#eab308',
  'Social Mídia': '#a855f7',
  'Transmissão (Streamer)': '#14b8a6',
};

/**
 * Normaliza qualquer variante ou apelido de cargo para uma das 11 funções oficiais
 */
export function normalizeToOfficialRole(roleStr) {
  if (!roleStr) return 'Assistente Geral';
  const clean = String(roleStr)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (clean.includes('diretor')) return 'Diretor(a) de Cena';
  if (clean.includes('drone') || clean.includes('piloto')) return 'Piloto de Drone';
  if (clean.includes('cinegraf') || clean.includes('camera')) return 'Cinegrafista';
  if (clean.includes('foto')) return 'Fotógrafo(a)';
  if (clean.includes('editor') || clean.includes('pos-prod')) return 'Editor de Vídeo';
  if (clean.includes('motorista') || clean.includes('condutor') || clean.includes('producao')) return 'Motorista / Produção';
  if (clean.includes('design')) return 'Designer Gráfico';
  if (clean.includes('audio') || clean.includes('som') || clean.includes('microfone')) return 'Operador de Áudio';
  if (clean.includes('social') || clean.includes('midia') || clean.includes('media')) return 'Social Mídia';
  if (clean.includes('stream') || clean.includes('transmiss') || clean.includes('ao vivo')) return 'Transmissão (Streamer)';
  if (clean.includes('assistente') || clean.includes('tecnico') || clean.includes('geral')) return 'Assistente Geral';

  // Correspondência exata insensível
  for (const official of OFFICIAL_COMPANY_ROLES) {
    if (official.toLowerCase() === roleStr.trim().toLowerCase()) {
      return official;
    }
  }

  return 'Assistente Geral';
}

/**
 * Computa contagem fiel das 11 funções exercidas por um colaborador em um conjunto de missões
 */
export function computeMemberRoleCounts(member, missions) {
  const counts = {};
  OFFICIAL_COMPANY_ROLES.forEach((r) => { counts[r] = 0; });

  const memIdStr = String(member.id);
  const memNameNorm = String(member.name || '').trim().toLowerCase();

  missions.forEach((m) => {
    const allocations = Array.isArray(m.vehicleAllocations) ? m.vehicleAllocations : [];
    const isDriver = allocations.some(
      (a) => (a.driverId && String(a.driverId) === memIdStr) ||
             (a.driverName && a.driverName.trim().toLowerCase() === memNameNorm)
    ) || (m.driverId && String(m.driverId) === memIdStr) ||
         (m.driverName && m.driverName.trim().toLowerCase() === memNameNorm);

    const teamIds = Array.isArray(m.teamIds) ? m.teamIds.map(String) : [];
    const inTeamIds = teamIds.includes(memIdStr);
    const inTeamMembers = Array.isArray(m.teamMembers) &&
      m.teamMembers.some((tm) => String(tm.id) === memIdStr || tm.name?.trim().toLowerCase() === memNameNorm);
    const inTeamField = Array.isArray(m.team) &&
      m.team.some((t) => String(t) === memIdStr || String(t).trim().toLowerCase() === memNameNorm);

    const editorIds = Array.isArray(m.editorIds) ? m.editorIds.map(String) : [];
    const inEditorIds = editorIds.includes(memIdStr);
    const inEditorDisplay = m.editorNamesDisplay && m.editorNamesDisplay.trim().toLowerCase().includes(memNameNorm);

    const isEditor = inEditorIds || inEditorDisplay;

    // Se participou na equipe de campo
    if (inTeamIds || inTeamMembers || inTeamField) {
      // Prioridade 1: Papel designado especificamente para esta missão
      let missionRole = null;
      if (m.memberRoles && m.memberRoles[member.id]) {
        missionRole = m.memberRoles[member.id];
      } else if (m.memberRoles && m.memberRoles[memIdStr]) {
        missionRole = m.memberRoles[memIdStr];
      }

      // Se não houver papel específico na missão, usa o cargo principal do membro
      if (!missionRole) {
        missionRole = member.role || 'Assistente Geral';
      }

      const official = normalizeToOfficialRole(missionRole);
      counts[official] = (counts[official] || 0) + 1;
    }

    // Se atuou como motorista da viatura nesta missão
    if (isDriver && !inTeamIds && !inTeamMembers && !inTeamField) {
      counts['Motorista / Produção'] = (counts['Motorista / Produção'] || 0) + 1;
    }

    // Se atuou como editor de vídeo / pós-produção
    if (isEditor && !inTeamIds && !inTeamMembers && !inTeamField) {
      counts['Editor de Vídeo'] = (counts['Editor de Vídeo'] || 0) + 1;
    }
  });

  return counts;
}

