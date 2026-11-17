import { isMemberEligibleForExtraHours } from './workHours.js';

// ==============================================================================
// 12 FUNÇÕES OFICIAIS DA EMPRESA (MEGA FILMES & MEGA GESTÃO)
// ==============================================================================

export const OFFICIAL_COMPANY_ROLES = [
  'Diretor(a) de Cena',
  'Cinegrafista',
  'Piloto de Drone',
  'Fotógrafo(a)',
  'Editor de Vídeo',
  'Operador de Totem',
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
  'Operador de Totem': '🖼️',
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
  'Operador de Totem': '#0ea5e9',
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
  'Diretor(a) de Cena': 35,       // Liderança de set e coordenação técnica
  'Piloto de Drone': 35,          // Operação aérea técnica homologada
  'Transmissão (Streamer)': 30,   // Operação de lives, link e switchers de streaming
  'Editor de Vídeo': 30,          // Pós-produção, montagem e finalização
  'Cinegrafista': 30,             // Captação de imagens e operação de câmeras
  'Fotógrafo(a)': 25,             // Cobertura fotográfica oficial / ensaios
  'Operador de Totem': 25,        // Operação técnica de totem fotográfico e impressão
  'Operador de Áudio': 25,        // Captação de áudio direto, estúdio e microfonação
  'Designer Gráfico': 25,         // Identidade visual, cartelas, artes e motions
  'Motorista / Produção': 20,     // Condução de viaturas e logística de set
  'Social Mídia': 20,             // Cobertura rápida e publicações em tempo real
  'Assistente Geral': 15,         // Apoio operacional, iluminação e montagem
};

export const ACTIVITY_XP_POINTS = {
  missionBase: 15,                // Pela presença e participação operacional confirmada
  missionCompleted: 15,           // Bônus por entrega com êxito (missão finalizada)
  multiDayExpedition: 50,         // Viagens e expedições de longa duração (+1 dia / diária fora)
  drivingMissionBonus: 10,        // Bônus fixo por missão exercida como condutor
  drivingKmPer5: 1,               // Bônus de quilometragem: +1 XP a cada 5 km rodados ao volante
  extraHourApproved: 10,          // Por hora extra de campo dedicada e aprovada
  polyvalentBonus: 15,            // Bônus por polivalência técnica (2+ funções na mesma missão)
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
  if (clean.includes('totem') || clean.includes('toten') || clean.includes('cabine') || clean.includes('impressora')) return 'Operador de Totem';
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
      if (Array.isArray(explicitRole)) {
        explicitRole.forEach((r) => {
          if (r) exercisedRoles.add(normalizeToOfficialRole(r));
        });
      } else if (typeof explicitRole === 'string' && explicitRole.includes(',')) {
        explicitRole.split(',').forEach((r) => {
          if (r.trim()) exercisedRoles.add(normalizeToOfficialRole(r.trim()));
        });
      } else {
        exercisedRoles.add(normalizeToOfficialRole(explicitRole));
      }
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
  if (
    s === 'finalizada' ||
    s === 'finalizado' ||
    s === 'concluída' ||
    s === 'concluida' ||
    s === 'pendente'
  ) {
    return true;
  }
  // Se o retorno ou o evento já aconteceu no tempo, o trabalho operacional de campo já foi exercido
  const dateStr = m.endDate || m.date;
  const timeStr = m.returnTimeEstimated || m.eventEndTime || m.arrivalTimeEstimated || '23:59';
  if (dateStr) {
    try {
      const [y, mo, d] = String(dateStr).split('-').map(Number);
      const [h, min] = String(timeStr).split(':').map(Number);
      const missionEnd = new Date(y, mo - 1, d, h || 0, min || 0, 0, 0);
      if (missionEnd <= new Date()) {
        return true;
      }
    } catch (e) {}
  }
  return false;
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
  let polyvalentCount = 0;
  const missionHistory = [];

  // FILTRO ESTRITO: Apenas missões que foram realmente concluídas/finalizadas
  const completedMissions = missions.filter(isMissionCompleted);

  completedMissions.forEach((m) => {
    const rolesExercised = getRolesExercisedInMission(member, m);

    if (rolesExercised.length > 0) {
      totalMissions++;
      completedCount++;

      // Bônus de polivalência: exerceu 2 ou mais especialidades distintas na mesma missão
      if (rolesExercised.length >= 2) {
        polyvalentCount++;
      }

      // Atualiza contagem e pontos das funções exercidas nesta missão concluída
      rolesExercised.forEach((r) => {
        roleCounts[r] = (roleCounts[r] || 0) + 1;
        rolePoints[r] = (rolePoints[r] || 0) + (ROLE_XP_POINTS[r] || 20);
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

      // Horas extras aprovadas nesta missão (exclusivas para quem atuou presencialmente em campo; editores na pós não recebem horas extras)
      const isEligibleForExtras = isMemberEligibleForExtraHours(member, m);
      const extraH = isEligibleForExtras ? Number(m.extraHoursApproved || 0) : 0;
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

  // Cálculo Discriminado e Balanceado do Score XP (Escala Rumo a 10.000 XP):
  // 1. Pontos diretos das especialidades oficiais exercidas
  const rolesTotalXP = Object.values(rolePoints).reduce((acc, pts) => acc + pts, 0);

  // 2. Pontos base por participação operacional em missão concluída (+15 XP por escala)
  const missionBaseXP = totalMissions * ACTIVITY_XP_POINTS.missionBase;

  // 3. Bônus de entrega por missões concluídas com êxito (+15 XP por entrega)
  const completedBonusXP = completedCount * ACTIVITY_XP_POINTS.missionCompleted;

  // 4. Bônus por condução de viatura: +10 XP por missão ao volante + 1 XP a cada 5 km guiados
  const drivingMissionXP = drivingCount * ACTIVITY_XP_POINTS.drivingMissionBonus;
  const drivingKmXP = Math.round(estimatedDistanceKm * 0.2);
  const totalDrivingXP = drivingMissionXP + drivingKmXP;

  // 5. Pontos por expedições de longa duração (+1 dia / diária fora: +50 XP)
  const multiDayXP = multiDayCount * ACTIVITY_XP_POINTS.multiDayExpedition;

  // 6. Pontos por horas extras aprovadas e cumpridas em campo (+10 XP / hora)
  const extraHoursXP = Math.round(totalApprovedExtraHours * ACTIVITY_XP_POINTS.extraHourApproved);

  // 7. Bônus de polivalência técnica (+15 XP por missão com 2+ funções simultâneas)
  const polyvalentXP = polyvalentCount * ACTIVITY_XP_POINTS.polyvalentBonus;

  // SCORE FINAL TOTAL REAL
  const score = rolesTotalXP + missionBaseXP + completedBonusXP + totalDrivingXP + multiDayXP + extraHoursXP + polyvalentXP;

  // Funções ativas distintas exercidas
  const distinctRolesCount = Object.values(roleCounts).filter((c) => c > 0).length;

  // --------------------------------------------------------------------------
  // SISTEMA COMPLETO DE CONQUISTAS & INSÍGNIAS (MEGAFILMES ACHIEVEMENTS)
  // --------------------------------------------------------------------------
  const allAchievements = [
    {
      id: 'cine-gold',
      icon: '🎥',
      name: 'Lente de Ouro',
      category: 'Câmera',
      rarity: 'Rara',
      color: '#38bdf8',
      desc: 'Atuar como Cinegrafista em missões de campo concluídas com sucesso',
      requirement: '3x missões como Cinegrafista',
      current: roleCounts['Cinegrafista'] || 0,
      target: 3,
      isUnlocked: (roleCounts['Cinegrafista'] || 0) >= 3,
    },
    {
      id: 'editor-gold',
      icon: '✂️',
      name: 'Mestre da Ilha',
      category: 'Pós-Produção',
      rarity: 'Rara',
      color: '#ec4899',
      desc: 'Concluir a pós-produção de vídeos e pautas com aprovação formal',
      requirement: '2x pautas de pós-produção finalizadas',
      current: roleCounts['Editor de Vídeo'] || 0,
      target: 2,
      isUnlocked: (roleCounts['Editor de Vídeo'] || 0) >= 2,
    },
    {
      id: 'driver-gold',
      icon: '🚗',
      name: 'Ás da Frota',
      category: 'Logística',
      rarity: 'Rara',
      color: '#10b981',
      desc: 'Conduzir viaturas com segurança em missões da produtora',
      requirement: '3x missões ao volante',
      current: drivingCount,
      target: 3,
      isUnlocked: drivingCount >= 3,
    },
    {
      id: 'drone-gold',
      icon: '🚁',
      name: 'Soberano dos Ares',
      category: 'Aéreo',
      rarity: 'Épica',
      color: '#a855f7',
      desc: 'Operar drone em missões de cobertura aérea técnica com êxito',
      requirement: '1x voo de drone concluído',
      current: roleCounts['Piloto de Drone'] || 0,
      target: 1,
      isUnlocked: (roleCounts['Piloto de Drone'] || 0) >= 1,
    },
    {
      id: 'photo-gold',
      icon: '📸',
      name: 'Foco Perfeito',
      category: 'Fotografia',
      rarity: 'Rara',
      color: '#f59e0b',
      desc: 'Realizar coberturas fotográficas oficiais e ensaios com excelência',
      requirement: '2x coberturas fotográficas concluídas',
      current: roleCounts['Fotógrafo(a)'] || 0,
      target: 2,
      isUnlocked: (roleCounts['Fotógrafo(a)'] || 0) >= 2,
    },
    {
      id: 'stream-gold',
      icon: '📡',
      name: 'Voz & Sinal',
      category: 'Streaming',
      rarity: 'Épica',
      color: '#06b6d4',
      desc: 'Operar transmissões ao vivo, lives e switchers sem interrupção',
      requirement: '1x transmissão ao vivo entregue',
      current: roleCounts['Transmissão (Streamer)'] || 0,
      target: 1,
      isUnlocked: (roleCounts['Transmissão (Streamer)'] || 0) >= 1,
    },
    {
      id: 'totem-gold',
      icon: '🖼️',
      name: 'Mestre do Totem',
      category: 'Eventos',
      rarity: 'Comum',
      color: '#6366f1',
      desc: 'Operar totem fotográfico interativo e impressões em eventos sociais',
      requirement: '1x operação de totem concluída',
      current: roleCounts['Operador de Totem'] || 0,
      target: 1,
      isUnlocked: (roleCounts['Operador de Totem'] || 0) >= 1,
    },
    {
      id: 'dir-gold',
      icon: '🎬',
      name: 'Direção Geral',
      category: 'Direção',
      rarity: 'Lendária',
      color: '#e11d48',
      desc: 'Comandar a direção de cena em sets comerciais, campanhas ou institucionais',
      requirement: '1x set dirigido com êxito',
      current: roleCounts['Diretor(a) de Cena'] || 0,
      target: 1,
      isUnlocked: (roleCounts['Diretor(a) de Cena'] || 0) >= 1,
    },
    {
      id: 'explorer-gold',
      icon: '🧭',
      name: 'Desbravador',
      category: 'Expedição',
      rarity: 'Épica',
      color: '#d97706',
      desc: 'Participar de missões e viagens de longa duração (+1 dia fora de sede)',
      requirement: '1x viagem de campo realizada (+1 dia)',
      current: multiDayCount,
      target: 1,
      isUnlocked: multiDayCount >= 1,
    },
    {
      id: 'extra-gold',
      icon: '⚡',
      name: 'Plantão de Elite',
      category: 'Dedicação',
      rarity: 'Rara',
      color: '#eab308',
      desc: 'Cumprir horas extras operacionais em missões de alta demanda',
      requirement: '2h extras aprovadas em campo',
      current: totalApprovedExtraHours,
      target: 2,
      isUnlocked: totalApprovedExtraHours >= 2,
    },
    {
      id: 'poly-gold',
      icon: '🛡️',
      name: 'Polivalente / Camaleão',
      category: 'Versatilidade',
      rarity: 'Épica',
      color: '#14b8a6',
      desc: 'Exercer atuações em 3 ou mais especialidades oficiais distintas',
      requirement: 'Atuação em 3 especialidades distintas',
      current: distinctRolesCount,
      target: 3,
      isUnlocked: distinctRolesCount >= 3,
    },
    {
      id: 'vet-gold',
      icon: '⭐',
      name: 'Veterano de Campo',
      category: 'Carreira',
      rarity: 'Comum',
      color: '#3b82f6',
      desc: 'Alcançar a marca de 5 missões operacionais concluídas com sucesso',
      requirement: '5 missões concluídas com sucesso',
      current: totalMissions,
      target: 5,
      isUnlocked: totalMissions >= 5,
    },
    {
      id: 'elite-gold',
      icon: '🔥',
      name: 'Constância de Elite',
      category: 'Carreira',
      rarity: 'Épica',
      color: '#f97316',
      desc: 'Alcançar a expressiva marca de 15 missões concluídas na produtora',
      requirement: '15 missões concluídas com sucesso',
      current: totalMissions,
      target: 15,
      isUnlocked: totalMissions >= 15,
    },
    {
      id: 'pillar-gold',
      icon: '💎',
      name: 'Pilar da Produtora',
      category: 'Carreira',
      rarity: 'Lendária',
      color: '#8b5cf6',
      desc: 'Histórico consagrado de 30 missões concluídas com excelência',
      requirement: '30 missões concluídas com sucesso',
      current: totalMissions,
      target: 30,
      isUnlocked: totalMissions >= 30,
    },
    {
      id: 'highway-gold',
      icon: '🛣️',
      name: 'Estrada Infinita',
      category: 'Logística',
      rarity: 'Rara',
      color: '#059669',
      desc: 'Acumular mais de 100 km rodados guiando viaturas em missões',
      requirement: '100 km conduzidos ao volante',
      current: Math.round(estimatedDistanceKm),
      target: 100,
      isUnlocked: estimatedDistanceKm >= 100,
    },
    {
      id: 'master-gold',
      icon: '👑',
      name: 'Patente de Ouro',
      category: 'Gamificação',
      rarity: 'Lendária',
      color: '#eab308',
      desc: 'Superar o marco de 1.200 XP e alcançar a patente Especialista Ouro',
      requirement: 'Alcançar 1.200 XP acumulados',
      current: score,
      target: 1200,
      isUnlocked: score >= 1200,
    },
  ];

  // Apenas as conquistas desbloqueadas para badges rápidos
  const badges = allAchievements
    .filter((a) => a.isUnlocked)
    .map((a) => ({
      id: a.id,
      icon: a.icon,
      name: a.name,
      desc: a.desc,
      color: a.color,
      rarity: a.rarity,
    }));

  const unlockedCount = badges.length;
  const totalAchievementsCount = allAchievements.length;

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
    polyvalentCount,
    score,
    rolesTotalXP,
    missionBaseXP,
    completedBonusXP,
    drivingMissionXP,
    drivingKmXP,
    totalDrivingXP,
    multiDayXP,
    extraHoursXP,
    polyvalentXP,
    breakdown: {
      rolesTotalXP,
      missionBaseXP,
      completedBonusXP,
      drivingMissionXP,
      drivingKmXP,
      totalDrivingXP,
      multiDayXP,
      extraHoursXP,
      polyvalentXP,
    },
    badges,
    allAchievements,
    unlockedCount,
    totalAchievementsCount,
    distinctRolesCount,
    missionHistory: missionHistory.sort((a, b) => String(b.date).localeCompare(String(a.date))),
  };
}

// ==============================================================================
// PATENTES DE CARREIRA, NÍVEIS E PROGRESSÃO GAMIFICADA (MEGAFILMES - 10.000 XP)
// ==============================================================================

export const MAX_CAREER_XP = 10000;

export const CAREER_TIERS = [
  {
    level: 1,
    min: 0,
    max: 250,
    title: 'Recruta Operacional',
    color: '#94a3b8',
    icon: '🌱',
    insigniaClass: 'insignia-recruta',
    badgeLabel: 'Nível 1 • Integração e Campo',
    description: 'Início da jornada na MegaFilmes. Fase de ambientação técnica, conhecimento dos processos da produtora, pontualidade nas escalas e primeiros registros operacionais de campo.',
    overcomeMessage: 'Você superou com sucesso o período de integração inicial! Provou disciplina, pontualidade e primeiros registros operacionais com afinco.',
    skillsDemonstrated: 'Pontualidade em escalas, zelo pelos equipamentos e adaptação rápida ao fluxo de trabalho.',
  },
  {
    level: 2,
    min: 250,
    max: 600,
    title: 'Operador Bronze',
    color: '#cd7f32',
    icon: '⚡',
    insigniaClass: 'insignia-bronze',
    badgeLabel: 'Nível 2 • Autonomia de Campo',
    description: 'Autonomia e agilidade operacional. Cumpre pautas de rotina com desenvoltura, cuida dos kits de gravação e demonstra firmeza e prontidão nas escalas diárias.',
    overcomeMessage: 'Você superou o estágio de operador bronze! Conquistou independência operacional e consistência nas saídas de rotina da produtora.',
    skillsDemonstrated: 'Autonomia em pautas diárias, dinamismo de set e postura confiável.',
  },
  {
    level: 3,
    min: 600,
    max: 1200,
    title: 'Operador Prata',
    color: '#38bdf8',
    icon: '🥈',
    insigniaClass: 'insignia-prata',
    badgeLabel: 'Nível 3 • Firmeza Técnica',
    description: 'Firmeza técnica e rapidez de resposta. Domina os equipamentos da produtora, soluciona imprevistos com velocidade e mantém estabilidade sob prazos apertados.',
    overcomeMessage: 'Patente prata superada com louvor! Você provou constância técnica e capacidade de entrega sob pressão.',
    skillsDemonstrated: 'Agilidade de set, resolução prática de problemas e qualidade técnica consistente.',
  },
  {
    level: 4,
    min: 1200,
    max: 2000,
    title: 'Especialista Ouro',
    color: '#fbbf24',
    icon: '🥇',
    insigniaClass: 'insignia-ouro',
    badgeLabel: 'Nível 4 • Alta Performance & Polivalência',
    description: 'Maturidade profissional consolidada e polivalência. Domínio em mais de uma especialidade (Câmera, Edição, Direção ou Condução), entregas de alto padrão e precisão estética.',
    overcomeMessage: 'Patente de ouro superada com mérito! Você se consolidou entre os especialistas de alta performance da MegaFilmes.',
    skillsDemonstrated: 'Polivalência em múltiplas funções, rigor estético, pontualidade britânica e resolução rápida.',
  },
  {
    level: 5,
    min: 2000,
    max: 3200,
    title: 'Técnico Platina',
    color: '#2dd4bf',
    icon: '💎',
    insigniaClass: 'insignia-platina',
    badgeLabel: 'Nível 5 • Precisão & Zero Refação',
    description: 'Precisão milimétrica e zero retrabalho. Confiabilidade absoluta para gravações exigentes, coberturas institucionais críticas e transmissões sem margem de erro.',
    overcomeMessage: 'Patente de platina superada! Seu rigor operacional e padrão visual são referências de excelência na produtora.',
    skillsDemonstrated: 'Perfeição técnica, entregas de primeira sem refação e controle rigoroso de qualidade.',
  },
  {
    level: 6,
    min: 3200,
    max: 4600,
    title: 'Mestre Diamante',
    color: '#a855f7',
    icon: '🔮',
    insigniaClass: 'insignia-diamante',
    badgeLabel: 'Nível 6 • Elite de Produção',
    description: 'Elite técnica e referência para a equipe. Assume coberturas de alta complexidade com serenidade, soluciona impasses de set sob pressão e auxilia os operadores mais novos.',
    overcomeMessage: 'Patente de diamante superada! Reconhecimento consolidado como uma das maiores referências técnicas da produtora.',
    skillsDemonstrated: 'Coberturas de alta complexidade, precisão sob pressão e mentoria prática aos colegas.',
  },
  {
    level: 7,
    min: 4600,
    max: 6200,
    title: 'Comandante de Set',
    color: '#f43f5e',
    icon: '🎖️',
    insigniaClass: 'insignia-comandante',
    badgeLabel: 'Nível 7 • Liderança Operacional',
    description: 'Liderança operacional de grandes coberturas. Lidera equipes no campo, gerencia a logística e a sintonia de múltiplos profissionais em tempo real com firmeza e calma.',
    overcomeMessage: 'Liderança de set superada! Você comanda operações complexas de ponta a ponta com respeito unânime.',
    skillsDemonstrated: 'Coordenação de equipes, gestão de crises em tempo real e visão estratégica de set.',
  },
  {
    level: 8,
    min: 6200,
    max: 7800,
    title: 'Guardião Audiovisual',
    color: '#ec4899',
    icon: '🛡️',
    insigniaClass: 'insignia-guardiao',
    badgeLabel: 'Nível 8 • Pilar Estratégico',
    description: 'Pilar de confiança máxima da Diretoria. Responsável pelas maiores contas e pautas de maior responsabilidade institucional, comercial e artística da produtora.',
    overcomeMessage: 'Guardião superado! Sua trajetória é sinônimo de solidez, lealdade e sucesso para a MegaFilmes.',
    skillsDemonstrated: 'Visão de negócio, liderança exemplar e execução impecável nas contas mais estratégicas.',
  },
  {
    level: 9,
    min: 7800,
    max: 9500,
    title: 'Grão-Mestre da Produtora',
    color: '#eab308',
    icon: '👑',
    insigniaClass: 'insignia-graomestre',
    badgeLabel: 'Nível 9 • Notório Saber & Maestria',
    description: 'Notório saber em todas as etapas da cadeia audiovisual: pré-produção, captação cinematográfica, switcher ao vivo, pós e entrega de grandes obras.',
    overcomeMessage: 'Grão-Mestre superado! Você está a um passo da consagração eterna no Hall da Fama da MegaFilmes.',
    skillsDemonstrated: 'Mestria completa da cadeia audiovisual, inovação e prestígio consolidado.',
  },
  {
    level: 10,
    min: 9500,
    max: 1000000,
    title: 'Lenda Viva MegaFilmes',
    color: '#10b981',
    icon: '🏆',
    insigniaClass: 'insignia-lenda',
    badgeLabel: 'Nível 10 • Hall da Fama & Consagração Máxima',
    description: 'O topo supremo e definitivo do audiovisual. História gravada nos anais da produtora, centenas de grandes produções entregues com louvor e respeito unânime de toda a equipe e diretoria.',
    overcomeMessage: 'O topo absoluto da carreira na MegaFilmes! Você é uma lenda viva do audiovisual.',
    skillsDemonstrated: 'Legado permanente, mestria inquestionável e consagração máxima da carreira.',
  },
];

/**
 * Calcula a progressão completa de carreira com níveis superados, nível atual e próximos marcos.
 * Escala voltada para 10.000 XP com 10 patentes operacionais.
 */
export function getCareerProgression(score = 0) {
  const s = Math.max(0, Number(score) || 0);
  const currentTier = CAREER_TIERS.find((t) => s >= t.min && s < t.max) || CAREER_TIERS[CAREER_TIERS.length - 1];
  const span = Math.max(1, currentTier.max - currentTier.min);
  const currentLevelXP = Math.max(0, s - currentTier.min);
  const isMaxTier = currentTier.level >= 10;
  const remainingForNext = isMaxTier ? 0 : Math.max(0, currentTier.max - s);
  const progressPercent = isMaxTier ? 100 : Math.min(100, Math.max(0, Math.round((currentLevelXP / span) * 100)));
  const overallPercent = Math.min(100, Math.max(0, Math.round((s / MAX_CAREER_XP) * 100)));

  const tiersWithStatus = CAREER_TIERS.map((tier) => {
    let status = 'locked'; // 'completed' | 'current' | 'locked'
    if (tier.level < currentTier.level) {
      status = 'completed';
    } else if (tier.level === currentTier.level) {
      status = 'current';
    }
    return {
      ...tier,
      status,
      isCompleted: status === 'completed',
      isCurrent: status === 'current',
      isLocked: status === 'locked',
    };
  });

  const completedTiers = tiersWithStatus.filter((t) => t.isCompleted);
  const nextTier = tiersWithStatus.find((t) => t.level === currentTier.level + 1) || null;

  return {
    currentTier,
    level: currentTier.level,
    title: currentTier.title,
    color: currentTier.color,
    icon: currentTier.icon,
    insigniaClass: currentTier.insigniaClass,
    badgeLabel: currentTier.badgeLabel,
    description: currentTier.description,
    score: s,
    currentLevelXP,
    neededForNextLevel: span,
    remainingForNext,
    progressPercent,
    overallPercent,
    overallMaxXP: MAX_CAREER_XP,
    tiers: tiersWithStatus,
    completedTiers,
    nextTier,
  };
}
