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
  'Fotógrafo(a)': '📸',
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

// ==============================================================================
// PESOS DE PONTUAÇÃO (XP CORPORATIVO) FIÉIS POR FUNÇÃO E ATIVIDADE
// ==============================================================================

export const ROLE_XP_POINTS = {
  'Diretor(a) de Cena': 25,       // Liderança de set e coordenação técnica
  'Piloto de Drone': 25,          // Operação aérea técnica homologada
  'Transmissão (Streamer)': 25,   // Operação de lives, link e switchers de streaming
  'Editor de Vídeo': 25,          // Pós-produção, montagem e finalização
  'Cinegrafista': 20,             // Captação de imagens e operação de câmeras
  'Fotógrafo(a)': 20,             // Cobertura fotográfica oficial / ensaios
  'Operador de Áudio': 20,        // Captação de áudio direto, estúdio e microfonação
  'Designer Gráfico': 20,         // Identidade visual, cartelas, artes e motions
  'Motorista / Produção': 15,     // Condução de viaturas e logística de set
  'Social Mídia': 15,             // Cobertura rápida e publicações em tempo real
  'Assistente Geral': 15,         // Apoio operacional, iluminação e montagem
};

export const ACTIVITY_XP_POINTS = {
  missionBase: 10,                // Pela presença e participação operacional confirmada
  multiDayExpedition: 30,         // Viagens e expedições de longa duração (+1 dia / diária fora)
  drivingKmPer10: 1,              // Bônus de quilometragem: +1 XP a cada 10 km rodados como condutor
  extraHourApproved: 10,          // Por hora extra de campo dedicada e aprovada
  missionCompleted: 10,           // Bônus por entrega com êxito (missão finalizada)
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
  if (clean.includes('cinegraf') || clean.includes('camera') || clean.includes('cam')) return 'Cinegrafista';
  if (clean.includes('foto')) return 'Fotógrafo(a)';
  if (clean.includes('editor') || clean.includes('pos-prod') || clean.includes('edicao')) return 'Editor de Vídeo';
  if (clean.includes('motorista') || clean.includes('condutor') || clean.includes('producao')) return 'Motorista / Produção';
  if (clean.includes('design') || clean.includes('motion')) return 'Designer Gráfico';
  if (clean.includes('audio') || clean.includes('som') || clean.includes('microfone') || clean.includes('locuc')) return 'Operador de Áudio';
  if (clean.includes('social') || clean.includes('midia') || clean.includes('media') || clean.includes('stories')) return 'Social Mídia';
  if (clean.includes('stream') || clean.includes('transmiss') || clean.includes('ao vivo') || clean.includes('live')) return 'Transmissão (Streamer)';
  if (clean.includes('assistente') || clean.includes('tecnico') || clean.includes('ilumin') || clean.includes('geral')) return 'Assistente Geral';

  // Correspondência exata insensível
  for (const official of OFFICIAL_COMPANY_ROLES) {
    if (official.toLowerCase() === roleStr.trim().toLowerCase()) {
      return official;
    }
  }

  return 'Assistente Geral';
}

/**
 * Normaliza texto para comparações
 */
function cleanText(txt) {
  return String(txt || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Identifica com precisão as funções cumpridas por um colaborador em uma missão específica.
 * Retorna uma lista de papéis oficiais exercidos (um colaborador pode atuar em mais de uma função,
 * como dirigir a viatura e ao mesmo tempo atuar como cinegrafista ou editor).
 */
export function getRolesExercisedInMission(member, mission) {
  const exercisedRoles = new Set();
  const memIdStr = String(member.id);
  const memNameNorm = cleanText(member.name);

  // 1. Condução de Viatura / Motorista
  const allocations = Array.isArray(mission.vehicleAllocations) ? mission.vehicleAllocations : [];
  const isDriver = allocations.some(
    (a) => (a.driverId && String(a.driverId) === memIdStr) ||
           (a.driverName && cleanText(a.driverName) === memNameNorm)
  ) || (mission.driverId && String(mission.driverId) === memIdStr) ||
       (mission.driverName && cleanText(mission.driverName) === memNameNorm);

  if (isDriver) {
    exercisedRoles.add('Motorista / Produção');
  }

  // 2. Pós-Produção / Edição de Vídeo
  const editorIds = Array.isArray(mission.editorIds) ? mission.editorIds.map(String) : [];
  const inEditorIds = editorIds.includes(memIdStr);
  const inEditorDisplay = mission.editorNamesDisplay && cleanText(mission.editorNamesDisplay).includes(memNameNorm);
  if (inEditorIds || inEditorDisplay) {
    exercisedRoles.add('Editor de Vídeo');
  }

  // 3. Atuação em Campo (Escalado na Equipe)
  const teamIds = Array.isArray(mission.teamIds) ? mission.teamIds.map(String) : [];
  const inTeamIds = teamIds.includes(memIdStr);
  const inTeamMembers = Array.isArray(mission.teamMembers) &&
    mission.teamMembers.some((tm) => String(tm.id) === memIdStr || cleanText(tm.name) === memNameNorm);
  const inTeamField = Array.isArray(mission.team) &&
    mission.team.some((t) => String(t) === memIdStr || cleanText(String(t)) === memNameNorm);

  if (inTeamIds || inTeamMembers || inTeamField) {
    // 3.1. Papel explícito na missão
    let explicitRole = null;
    if (mission.memberRoles && mission.memberRoles[member.id]) {
      explicitRole = mission.memberRoles[member.id];
    } else if (mission.memberRoles && mission.memberRoles[memIdStr]) {
      explicitRole = mission.memberRoles[memIdStr];
    }

    if (explicitRole) {
      exercisedRoles.add(normalizeToOfficialRole(explicitRole));
    } else {
      // 3.2. Inferência contextual baseada na pauta da missão e habilidades do colaborador
      const pauta = cleanText(`${mission.description || ''} ${mission.title || ''} ${mission.locationName || ''} ${mission.notes || ''}`);
      const memberAllRoles = [
        member.role,
        ...(Array.isArray(member.secondaryRoles) ? member.secondaryRoles : []),
      ].filter(Boolean).map(normalizeToOfficialRole);

      let matchedRole = null;

      if (memberAllRoles.includes('Transmissão (Streamer)') && (pauta.includes('transmiss') || pauta.includes('live') || pauta.includes('stream') || pauta.includes('ao vivo') || pauta.includes('pleno') || pauta.includes('sessao'))) {
        matchedRole = 'Transmissão (Streamer)';
      } else if (memberAllRoles.includes('Piloto de Drone') && (pauta.includes('drone') || pauta.includes('aerea') || pauta.includes('voo'))) {
        matchedRole = 'Piloto de Drone';
      } else if (memberAllRoles.includes('Fotógrafo(a)') && (pauta.includes('foto') || pauta.includes('ensaio') || pauta.includes('retrato'))) {
        matchedRole = 'Fotógrafo(a)';
      } else if (memberAllRoles.includes('Operador de Áudio') && (pauta.includes('audio') || pauta.includes('som') || pauta.includes('podcast') || pauta.includes('microfon'))) {
        matchedRole = 'Operador de Áudio';
      } else if (memberAllRoles.includes('Diretor(a) de Cena') && (pauta.includes('direcao') || pauta.includes('comercial') || pauta.includes('campanha') || pauta.includes('clipe'))) {
        matchedRole = 'Diretor(a) de Cena';
      } else if (memberAllRoles.includes('Designer Gráfico') && (pauta.includes('design') || pauta.includes('layout') || pauta.includes('arte') || pauta.includes('motion'))) {
        matchedRole = 'Designer Gráfico';
      } else if (memberAllRoles.includes('Social Mídia') && (pauta.includes('social') || pauta.includes('stories') || pauta.includes('reels') || pauta.includes('cobertura'))) {
        matchedRole = 'Social Mídia';
      } else if (memberAllRoles.includes('Cinegrafista') && (pauta.includes('video') || pauta.includes('gravac') || pauta.includes('camera') || pauta.includes('criminal') || pauta.includes('sessao') || pauta.includes('audiencia'))) {
        matchedRole = 'Cinegrafista';
      }

      if (matchedRole) {
        exercisedRoles.add(matchedRole);
      } else {
        // Usa o cargo principal
        exercisedRoles.add(normalizeToOfficialRole(member.role));
      }
    }
  }

  return Array.from(exercisedRoles);
}

/**
 * Verifica se a missão está formalmente finalizada / concluída
 */
export function isMissionCompleted(m) {
  if (!m) return false;
  const s = String(m.missionStatus || m.status || '').toLowerCase().trim();
  return (
    s === 'finalizada' ||
    s === 'finalizado' ||
    s === 'concluída' ||
    s === 'concluida'
  );
}

/**
 * Computa contagem fiel das 11 funções exercidas por um colaborador em missões concluídas
 */
export function computeMemberRoleCounts(member, missions = []) {
  const counts = {};
  OFFICIAL_COMPANY_ROLES.forEach((r) => { counts[r] = 0; });

  if (!member || !Array.isArray(missions)) return counts;

  // Computa apenas missões finalizadas/concluídas para refletir dados 100% reais executados
  const completedMissions = missions.filter(isMissionCompleted);

  completedMissions.forEach((mission) => {
    const rolesInMission = getRolesExercisedInMission(member, mission);
    rolesInMission.forEach((role) => {
      counts[role] = (counts[role] || 0) + 1;
    });
  });

  return counts;
}

/**
 * CÁLCULO COMPLETO E FIEL DO SCORE XP OPERACIONAL DO COLABORADOR
 * Computa ESTRITAMENTE missões CONCLUÍDAS / FINALIZADAS.
 * Missões agendadas, em andamento ou canceladas NÃO pontuam para garantir valores reais.
 */
export function calculateMemberPerformanceProfile(member, missions = []) {
  const memIdStr = String(member.id);
  const memNameNorm = cleanText(member.name);

  // Inicializa contagens e pontos de cada função
  const roleCounts = {};
  const rolePoints = {};
  OFFICIAL_COMPANY_ROLES.forEach((r) => {
    roleCounts[r] = 0;
    rolePoints[r] = 0;
  });

  let totalMissions = 0;
  let drivingCount = 0;
  let estimatedDistanceKm = 0;
  let multiDayCount = 0;
  let totalApprovedExtraHours = 0;
  let completedCount = 0;
  const missionHistory = [];

  // FILTRO ESTRITO: Apenas missões que foram realmente concluídas/finalizadas
  const completedMissions = missions.filter(isMissionCompleted);

  completedMissions.forEach((m) => {
    const rolesExercised = getRolesExercisedInMission(member, m);

    if (rolesExercised.length > 0) {
      totalMissions++;
      completedCount++;

      // Atualiza contagem e pontos das funções exercidas nesta missão concluída
      rolesExercised.forEach((r) => {
        roleCounts[r] = (roleCounts[r] || 0) + 1;
        rolePoints[r] = (rolePoints[r] || 0) + (ROLE_XP_POINTS[r] || 15);
      });

      // Checa motorista
      const isDriver = rolesExercised.includes('Motorista / Produção');
      if (isDriver) {
        drivingCount++;
        const dist = Number(m.routeInfo?.distanceKm || m.distanceKm || 0);
        if (dist > 0) estimatedDistanceKm += dist;
      }

      // Checa viagem de longa duração (+1 dia / diária fora)
      const isMultiDay = Boolean(m.isMultiDay || (m.endDate && m.endDate !== m.date));
      if (isMultiDay) {
        multiDayCount++;
      }

      // Horas extras aprovadas nesta missão
      const extraH = Number(m.extraHoursApproved || 0);
      if (extraH > 0) {
        totalApprovedExtraHours += extraH;
      }

      // Registra histórico detalhado da missão
      missionHistory.push({
        id: m.id,
        code: m.code || `#${m.id}`,
        date: m.date,
        endDate: m.endDate,
        isMultiDay,
        description: m.description || 'Missão Operacional',
        locationName: m.locationName || 'Local de Campo',
        rolesExercised,
        isDriver,
        distanceKm: Number(m.routeInfo?.distanceKm || m.distanceKm || 0),
        status: m.missionStatus || 'Finalizada',
        extraHours: extraH,
      });
    }
  });

  // Cálculo Discriminado do Score XP:
  // 1. Pontos diretos das 11 funções oficiais exercidas em missões concluídas
  const rolesTotalXP = Object.values(rolePoints).reduce((acc, pts) => acc + pts, 0);

  // 2. Pontos base por participação operacional em missão concluída
  const missionBaseXP = totalMissions * ACTIVITY_XP_POINTS.missionBase;

  // 3. Pontos por expedições de longa duração (+1 dia) realizadas
  const multiDayXP = multiDayCount * ACTIVITY_XP_POINTS.multiDayExpedition;

  // 4. Bônus por quilometragem rodada ao volante (+1 XP a cada 10 km)
  const drivingKmXP = Math.round(estimatedDistanceKm * 0.1);

  // 5. Pontos por horas extras aprovadas e cumpridas em campo
  const extraHoursXP = Math.round(totalApprovedExtraHours * ACTIVITY_XP_POINTS.extraHourApproved);

  // 6. Bônus de entrega por missões concluídas com sucesso
  const completedBonusXP = completedCount * ACTIVITY_XP_POINTS.missionCompleted;

  // SCORE FINAL TOTAL REAL
  const score = rolesTotalXP + missionBaseXP + multiDayXP + drivingKmXP + extraHoursXP + completedBonusXP;

  // Badges e Reconhecimentos Oficiais
  const badges = [];
  if (roleCounts['Cinegrafista'] >= 3) {
    badges.push({ id: 'cine-gold', icon: '🎥', name: 'Lente de Ouro', desc: `${roleCounts['Cinegrafista']}x atuações como Cinegrafista em missões concluídas` });
  }
  if (roleCounts['Motorista / Produção'] >= 3) {
    badges.push({ id: 'driver-gold', icon: '🚗', name: 'Ás da Frota', desc: `${roleCounts['Motorista / Produção']}x ao volante (${Math.round(estimatedDistanceKm)} km guiados em missões concluídas)` });
  }
  if (roleCounts['Editor de Vídeo'] >= 2) {
    badges.push({ id: 'editor-gold', icon: '✂️', name: 'Mestre da Ilha', desc: `${roleCounts['Editor de Vídeo']}x pautas de pós-produção finalizadas` });
  }
  if (roleCounts['Transmissão (Streamer)'] >= 1) {
    badges.push({ id: 'stream-gold', icon: '📡', name: 'Voz & Sinal', desc: `${roleCounts['Transmissão (Streamer)']}x coberturas ao vivo transmitidas e concluídas` });
  }
  if (roleCounts['Piloto de Drone'] >= 1) {
    badges.push({ id: 'drone-gold', icon: '🚁', name: 'Ás dos Ares', desc: `${roleCounts['Piloto de Drone']}x voos aéreos concluídos` });
  }
  if (roleCounts['Fotógrafo(a)'] >= 2) {
    badges.push({ id: 'photo-gold', icon: '📸', name: 'Foco Perfeito', desc: `${roleCounts['Fotógrafo(a)']}x ensaios e coberturas concluídas` });
  }
  if (roleCounts['Diretor(a) de Cena'] >= 1) {
    badges.push({ id: 'dir-gold', icon: '🎬', name: 'Direção Geral', desc: `${roleCounts['Diretor(a) de Cena']}x sets dirigidos com êxito` });
  }
  if (multiDayCount >= 1) {
    badges.push({ id: 'explorer-gold', icon: '🧭', name: 'Desbravador', desc: `${multiDayCount}x viagens de campo realizadas (+1 dia / diárias)` });
  }
  if (totalApprovedExtraHours >= 2) {
    badges.push({ id: 'extra-gold', icon: '⚡', name: 'Guardião da Pauta', desc: `${totalApprovedExtraHours}h extras cumpridas em missões concluídas` });
  }
  if (totalMissions >= 5) {
    badges.push({ id: 'vet-gold', icon: '⭐', name: 'Veterano de Campo', desc: `${totalMissions} missões operacionais concluídas com sucesso` });
  }

  // Lista de funções oficiais que o colaborador realmente exerceu em missões concluídas
  const activeRolesSummary = OFFICIAL_COMPANY_ROLES
    .filter((r) => roleCounts[r] > 0)
    .map((r) => ({
      role: r,
      count: roleCounts[r],
      points: rolePoints[r],
      icon: ROLE_ICONS_MAP[r] || '💼',
      color: ROLE_COLORS_MAP[r] || '#3b82f6',
    }))
    .sort((a, b) => b.count - a.count || b.points - a.points);

  return {
    ...member,
    allRoles: [
      member.role,
      ...(Array.isArray(member.secondaryRoles) ? member.secondaryRoles : []),
    ].filter(Boolean),
    roleCounts,
    rolePoints,
    activeRolesSummary,
    totalMissions,
    drivingCount,
    estimatedDistanceKm: Math.round(estimatedDistanceKm),
    multiDayCount,
    totalApprovedExtraHours,
    completedCount,
    score,
    breakdown: {
      rolesTotalXP,
      missionBaseXP,
      multiDayXP,
      drivingKmXP,
      extraHoursXP,
      completedBonusXP,
    },
    badges,
    missionHistory: missionHistory.sort((a, b) => String(b.date).localeCompare(String(a.date))),
  };
}
