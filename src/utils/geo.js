// Utilitários de geolocalização, cálculo de rotas (OSRM), consumo e horários

// Distância em linha reta (Haversine) em km
export function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371; // Raio da Terra em km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(2));
}

// Busca rota real de trânsito pelas ruas via OSRM (gratuito, sem chave API)
// Calcula tanto o trecho de IDA quanto o trecho de VOLTA pelas vias reais
export async function fetchRouteOSRM(originLat, originLon, destLat, destLon) {
  const oLat = parseFloat(originLat);
  const oLon = parseFloat(originLon);
  const dLat = parseFloat(destLat);
  const dLon = parseFloat(destLon);

  // Endpoints OSRM públicos (primário + espelho de contingência)
  const endpoints = [
    `https://router.project-osrm.org/route/v1/driving/${oLon},${oLat};${dLon},${dLat};${oLon},${oLat}?overview=full&geometries=geojson&steps=true`,
    `https://routing.openstreetmap.de/routed-car/route/v1/driving/${oLon},${oLat};${dLon},${dLat};${oLon},${oLat}?overview=full&geometries=geojson&steps=true`,
  ];

  for (const url of endpoints) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(7000) });
      if (!response.ok) continue;
      const data = await response.json();

      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const legs = route.legs || [];

        // Leg 0 = Ida (Base -> Missão), Leg 1 = Volta (Missão -> Base)
        const outboundMeters = legs[0] ? legs[0].distance : route.distance / 2;
        const returnMeters = legs[1] ? legs[1].distance : outboundMeters;

        const distanceKm = parseFloat((outboundMeters / 1000).toFixed(2));
        const returnDistanceKm = parseFloat((returnMeters / 1000).toFixed(2));
        const totalRoundTripKm = parseFloat(((outboundMeters + returnMeters) / 1000).toFixed(2));

        // OSRM retorna tempo livre de semáforos; aplicamos fator urbano (1.32x) compatível com Google Maps/Waze
        const rawOutboundSec = legs[0] ? legs[0].duration : route.duration / 2;
        const durationMinutes = Math.max(2, Math.round((rawOutboundSec * 1.32) / 60));
        const roundTripDurationMinutes = durationMinutes * 2;

        // Extrai geometria detalhada rua a rua do trecho de Ida (e de Volta se disponível)
        let outboundCoords = [];
        let returnCoords = [];

        if (legs[0]?.steps?.length) {
          legs[0].steps.forEach((step) => {
            if (step.geometry?.coordinates) {
              step.geometry.coordinates.forEach((pt) => {
                outboundCoords.push([pt[1], pt[0]]);
              });
            }
          });
        }
        if (legs[1]?.steps?.length) {
          legs[1].steps.forEach((step) => {
            if (step.geometry?.coordinates) {
              step.geometry.coordinates.forEach((pt) => {
                returnCoords.push([pt[1], pt[0]]);
              });
            }
          });
        }

        // Caso steps não venha preenchido, usa a geometria completa da rota
        const fullCoordinates = route.geometry.coordinates.map((pt) => [pt[1], pt[0]]);
        const coordinates = outboundCoords.length > 2 ? outboundCoords : fullCoordinates;

        return {
          success: true,
          distanceKm,
          returnDistanceKm,
          totalRoundTripKm,
          durationMinutes,
          roundTripDurationMinutes,
          coordinates,
          returnCoordinates: returnCoords,
        };
      }
    } catch (err) {
      console.warn('Tentando próximo servidor de rotas OSRM:', err.message);
    }
  }

  // Fallback se o computador estiver sem internet
  const straightKm = calculateHaversineDistance(oLat, oLon, dLat, dLon);
  // Fator viário urbano médio (~1.38x distância reta) e velocidade urbana ~30 km/h com semáforos
  const estimatedRoadKm = parseFloat((straightKm * 1.38).toFixed(2));
  const estimatedMin = Math.max(5, Math.round((estimatedRoadKm / 30) * 60));

  return {
    success: false,
    distanceKm: estimatedRoadKm,
    returnDistanceKm: estimatedRoadKm,
    totalRoundTripKm: parseFloat((estimatedRoadKm * 2).toFixed(2)),
    durationMinutes: estimatedMin,
    roundTripDurationMinutes: estimatedMin * 2,
    coordinates: [
      [oLat, oLon],
      [dLat, dLon],
    ],
    returnCoordinates: [],
  };
}

// Busca de endereços via OpenStreetMap Nominatim
export async function searchAddressNominatim(query) {
  if (!query || query.trim().length < 3) return [];
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      query
    )}&limit=5&countrycodes=br&addressdetails=1`;
    const response = await fetch(url, {
      headers: {
        'Accept-Language': 'pt-BR',
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.map((item) => ({
      name: item.display_name,
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      shortName: item.address
        ? `${item.address.road || ''} ${item.address.house_number || ''}, ${item.address.suburb || item.address.city || item.address.town || ''
          }`.trim().replace(/^,\s*/, '')
        : item.display_name.split(',')[0],
    }));
  } catch (e) {
    console.warn('Erro ao buscar endereço:', e);
    return [];
  }
}

// Calcula consumo e custos de combustível (Sempre Ida e Volta à Base, suportando 1 ou múltiplas viaturas e preços Gasolina/Diesel)
export function calculateFuelEstimate({
  distanceKm,
  totalRoundTripKm = null,
  autonomyKmPerLiter = 11,
  autonomies = null,
  fuelPricePerLiter = 6.45,
  vehicleBreakdowns = null,
}) {
  const totalKm =
    totalRoundTripKm && totalRoundTripKm > 0 ? totalRoundTripKm : (parseFloat(distanceKm) || 0) * 2;

  let litersNeeded = 0;
  let estimatedCost = 0;

  if (Array.isArray(vehicleBreakdowns) && vehicleBreakdowns.length > 0) {
    vehicleBreakdowns.forEach((item) => {
      const aut = (item.autonomy && item.autonomy > 0) ? item.autonomy : 11;
      const liters = totalKm / aut;
      litersNeeded += liters;
      const price = getFuelPriceForVehicle(item.vehicle, fuelPricePerLiter);
      estimatedCost += liters * price;
    });
  } else if (Array.isArray(autonomies) && autonomies.length > 0) {
    litersNeeded = autonomies.reduce((sum, aut) => {
      const validAut = aut > 0 ? aut : 11;
      return sum + totalKm / validAut;
    }, 0);
    const price =
      typeof fuelPricePerLiter === 'number'
        ? fuelPricePerLiter
        : (parseFloat(fuelPricePerLiter?.gasolinePricePerLiter || fuelPricePerLiter?.fuelPricePerLiter) || 6.45);
    estimatedCost = litersNeeded * price;
  } else {
    const autonomy = autonomyKmPerLiter > 0 ? autonomyKmPerLiter : 11;
    litersNeeded = totalKm / autonomy;
    const price =
      typeof fuelPricePerLiter === 'number'
        ? fuelPricePerLiter
        : (parseFloat(fuelPricePerLiter?.gasolinePricePerLiter || fuelPricePerLiter?.fuelPricePerLiter) || 6.45);
    estimatedCost = litersNeeded * price;
  }

  litersNeeded = parseFloat(litersNeeded.toFixed(2));
  estimatedCost = parseFloat(estimatedCost.toFixed(2));

  return {
    totalKm: parseFloat(totalKm.toFixed(2)),
    litersNeeded,
    estimatedCost,
  };
}

// Helper para obter a distância total real de uma missão (Sempre Ida e Volta à Base)
export function getMissionTotalKm(mission) {
  if (!mission) return 0;
  const oneWay = parseFloat(mission.distanceKm) || 0;
  if (mission.totalDistanceKm && mission.totalDistanceKm > oneWay) {
    return parseFloat(parseFloat(mission.totalDistanceKm).toFixed(1));
  }
  return parseFloat((oneWay * 2).toFixed(1));
}

// Retorna a data local no formato YYYY-MM-DD (evita fuso UTC do toISOString)
export function getLocalTodayStr(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Formata YYYY-MM-DD para DD/MM/AAAA
export function formatDateBR(dateStr) {
  if (!dateStr || !String(dateStr).includes('-')) return dateStr || '--/--/----';
  const parts = String(dateStr).split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

// Gera ou resolve o código único da missão no formato AAAAMMDD + Ordem do Dia (Ex: 202610261)
export function getMissionCode(mission, allMissions = []) {
  if (!mission) return '';
  const rawDate = mission.date || getLocalTodayStr();
  const cleanDate = String(rawDate).replace(/\D/g, '');
  const datePrefix = cleanDate.length >= 8 ? cleanDate.slice(0, 8) : getLocalTodayStr().replace(/\D/g, '');

  if (mission.code && String(mission.code).startsWith(datePrefix)) {
    return String(mission.code);
  }

  // Filtra missões da mesma data e ordena por horário de saída / ordem de cadastro
  const sameDayMissions = (allMissions || [])
    .filter((m) => m && m.date === mission.date)
    .slice()
    .sort((a, b) => {
      const timeA = a.departureTime || '00:00';
      const timeB = b.departureTime || '00:00';
      if (timeA !== timeB) return timeA.localeCompare(timeB);
      return String(a.id || '').localeCompare(String(b.id || ''));
    });

  const idx = sameDayMissions.findIndex((m) => m.id === mission.id);
  const orderNum = idx >= 0 ? idx + 1 : sameDayMissions.length + 1;
  return `${datePrefix}${orderNum}`;
}

// Calcula o próximo código de missão disponível para uma data (usado ao criar/editar missão)
export function generateNextMissionCode(dateStr, allMissions = [], editingMission = null) {
  const rawDate = dateStr || getLocalTodayStr();
  const cleanDate = String(rawDate).replace(/\D/g, '');
  const datePrefix = cleanDate.length >= 8 ? cleanDate.slice(0, 8) : getLocalTodayStr().replace(/\D/g, '');

  // Se estiver editando e a data não mudou, preserva o código já atribuído
  if (editingMission && editingMission.date === dateStr) {
    return getMissionCode(editingMission, allMissions);
  }

  const sameDayOtherMissions = (allMissions || []).filter(
    (m) => m && m.date === dateStr && (!editingMission || m.id !== editingMission.id)
  );

  let maxOrder = sameDayOtherMissions.length;
  sameDayOtherMissions.forEach((m) => {
    const c = getMissionCode(m, allMissions);
    if (c.startsWith(datePrefix)) {
      const suffix = parseInt(c.slice(8), 10);
      if (!isNaN(suffix) && suffix > maxOrder) {
        maxOrder = suffix;
      }
    }
  });

  return `${datePrefix}${maxOrder + 1}`;
}

// Calcula automaticamente o status da missão:
// - 1 hora antes do início: 'Em Preparo' (viatura e participantes já ficam ocupados)
// - A partir do horário de início: 'Em Execução'
// - No momento em que atingir o horário de retorno/término: Imediatamente 'Finalizada'
export function computeMissionAutoStatus(mission, now = new Date(), forceRecompute = false) {
  if (!mission || !mission.date || !mission.departureTime) {
    return mission?.missionStatus || 'Agendada';
  }
  const currentStatus = mission.missionStatus || 'Agendada';
  if (currentStatus === 'Cancelada') return 'Cancelada';

  // Verifica se a missão possui pós-produção (vídeo/edição que exige aprovação da gestão)
  const hasPostProd = hasMissionPostProduction(mission);

  const history = Array.isArray(mission.editionHistory) ? mission.editionHistory : [];
  const isApprovedByAdmin = history.some((h) => h.type === 'APPROVED');

  if (!forceRecompute && (currentStatus === 'Finalizada' || currentStatus === 'Finalizado' || currentStatus === 'Concluída')) {
    if (hasPostProd && !isApprovedByAdmin) {
      return 'Pendente';
    }
    return 'Finalizada';
  }

  if (!forceRecompute && currentStatus === 'Pendente') {
    return 'Pendente';
  }

  const dateParts = String(mission.date).split('-').map(Number);
  const depParts = String(mission.departureTime).split(':').map(Number);
  if (dateParts.length < 3 || depParts.length < 2 || isNaN(depParts[0]) || isNaN(depParts[1])) {
    return currentStatus;
  }

  const [year, month, day] = dateParts;
  const [depH, depM] = depParts;
  const startTime = new Date(year, month - 1, day, depH, depM, 0, 0);
  // 1 hora antes da saída entra em "Em Preparo"
  const prepTime = new Date(startTime.getTime() - 60 * 60 * 1000);

  let endTime;
  const returnCandidate = mission.returnTimeEstimated || mission.arrivalTimeEstimated;
  if (returnCandidate && String(returnCandidate).includes(':')) {
    const [retH, retM] = String(returnCandidate).split(':').map(Number);
    if (!isNaN(retH) && !isNaN(retM)) {
      endTime = new Date(year, month - 1, day, retH, retM, 0, 0);
      if (endTime <= startTime) {
        endTime.setDate(endTime.getDate() + 1);
      }
    }
  }
  if (!endTime) {
    // Fallback: 2 horas de duração caso não tenha horário de retorno definido
    endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000);
  }

  // EXIGÊNCIA DO CLIENTE: Chegou no horário previsto de término da ida a campo:
  // Se tem pós-produção e não foi aprovada pelo admin -> Permanece como 'Pendente' até confirmação explícita da gestão
  // Se não tem pós-produção -> Imediatamente 'Finalizada'
  if (now >= endTime) {
    if (hasPostProd && !isApprovedByAdmin) {
      return 'Pendente';
    }
    return 'Finalizada';
  }
  if (now >= startTime && now < endTime) {
    return 'Em Execução';
  }
  if (now >= prepTime && now < startTime) {
    return 'Em Preparo';
  }
  return 'Agendada';
}

// Verifica se uma missão está ativa ou em fase de preparo (ocupando viatura e participantes)
export function isMissionActiveOrPrep(mission) {
  if (!mission) return false;
  return (
    mission.missionStatus === 'Em Execução' ||
    mission.missionStatus === 'Em Preparo' ||
    mission.missionStatus === 'Saiu'
  );
}

/**
 * Retorna o peso numérico de prioridade de exibição da missão por status:
 * 1º lugar: Em Execução / Em Andamento / Em Preparo / Saiu / Em Deslocamento
 * 2º lugar: Pendente (pautas realizadas aguardando pós-produção ou validação)
 * 3º lugar: Agendada (missões futuras planejadas)
 * 4º lugar: Finalizada / Concluída
 * 5º lugar: Cancelada / Outros
 */
export function getMissionStatusPriority(mission) {
  if (!mission) return 99;
  const status = (mission.missionStatus || 'Agendada').toLowerCase().trim();

  // 1º lugar: Em Execução e variações de campo ativo
  if (
    status === 'em execução' ||
    status === 'em execucao' ||
    status === 'em andamento' ||
    status === 'em preparo' ||
    status === 'saiu' ||
    status === 'em deslocamento'
  ) {
    return 1;
  }

  // 2º lugar: Pendente (Pós-Produção)
  if (status === 'pendente') {
    return 2;
  }

  // 3º lugar: Agendadas
  if (status === 'agendada' || status === 'agendado') {
    return 3;
  }

  // 4º lugar: Finalizadas / Concluídas
  if (
    status === 'finalizada' ||
    status === 'finalizado' ||
    status === 'concluída' ||
    status === 'concluida'
  ) {
    return 4;
  }

  // 5º lugar: Canceladas
  if (status === 'cancelada' || status === 'cancelado') {
    return 5;
  }

  return 6;
}

export function isMissionFinalizada(m) {
  if (!m) return false;
  const s = (m.missionStatus || '').toLowerCase();
  return (
    s === 'finalizada' ||
    s === 'finalizado' ||
    s === 'concluída' ||
    s === 'concluida'
  );
}

/**
 * Ordena a lista de missões priorizando rigorosamente:
 * 1. Missões Em Execução / Em Andamento (acontecendo no momento imediato na rua)
 * 2. Ordem de acontecimento cronológico estrito (o que vai acontecer logo aparece primeiro: date ASC)
 * 3. No mesmo dia: horário de saída crescente (departureTime ASC)
 * 4. Missões Finalizadas / Canceladas (ficam ao final; entre si, ordenadas por mais recentes primeiro: date DESC)
 */
export function sortMissionsByStatusPriority(missions = []) {
  if (!Array.isArray(missions)) return [];
  return [...missions].sort((a, b) => {
    const isFinA = isMissionFinalizada(a) || a.missionStatus === 'Cancelada';
    const isFinB = isMissionFinalizada(b) || b.missionStatus === 'Cancelada';

    // Missões ativas sempre vêm antes de missões finalizadas/canceladas
    if (!isFinA && isFinB) return -1;
    if (isFinA && !isFinB) return 1;

    // Se ambas forem finalizadas/canceladas: mais recentes primeiro (data DESC, hora DESC)
    if (isFinA && isFinB) {
      const dateComp = String(b.date || '').localeCompare(String(a.date || ''));
      if (dateComp !== 0) return dateComp;
      const timeComp = String(b.departureTime || '00:00').localeCompare(String(a.departureTime || '00:00'));
      if (timeComp !== 0) return timeComp;
      return String(b.id || '').localeCompare(String(a.id || ''));
    }

    // Ambas são ativas:
    // 1º lugar: Missão na Reta Final Crítica (Urgente) ou Acontecendo Agora tem prioridade máxima imediata
    const progA = getMissionLiveProgress(a);
    const progB = getMissionLiveProgress(b);

    if (progA.isUrgentEnd && !progB.isUrgentEnd) return -1;
    if (!progA.isUrgentEnd && progB.isUrgentEnd) return 1;

    if (progA.isHappeningNow && !progB.isHappeningNow) return -1;
    if (!progA.isHappeningNow && progB.isHappeningNow) return 1;

    const isExecA = a.missionStatus === 'Em Execução' || a.missionStatus === 'Em Andamento';
    const isExecB = b.missionStatus === 'Em Execução' || b.missionStatus === 'Em Andamento';
    if (isExecA && !isExecB) return -1;
    if (!isExecA && isExecB) return 1;

    // 2º lugar: Ordem de acontecimento cronológico estrito (o que vai acontecer logo aparece primeiro)
    const dateA = String(a.date || '9999-99-99');
    const dateB = String(b.date || '9999-99-99');
    const dateComp = dateA.localeCompare(dateB);
    if (dateComp !== 0) return dateComp;

    // 3º lugar: No mesmo dia, o horário de saída mais cedo vem primeiro
    const timeA = String(a.departureTime || a.eventStartTime || '99:99');
    const timeB = String(b.departureTime || b.eventStartTime || '99:99');
    const timeComp = timeA.localeCompare(timeB);
    if (timeComp !== 0) return timeComp;

    // 4º lugar: Prioridade de status (Pendente vs Agendada)
    const pA = getMissionStatusPriority(a);
    const pB = getMissionStatusPriority(b);
    if (pA !== pB) return pA - pB;

    // 5º lugar: ID crescente (código mais antigo / menor código primeiro)
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
}

// Normaliza a lista de alocações (Viatura + Motorista) de uma missão (compatível com 1 ou N viaturas)
export function getMissionAllocations(mission, vehicles = [], members = []) {
  if (!mission) return [];

  const resolveVeh = (vId, nameHint = '') => {
    if (vId) {
      const found = vehicles.find((v) => v.id === vId);
      if (found) return found;
    }
    if (nameHint) {
      const hintLower = nameHint.toLowerCase();
      return (
        vehicles.find(
          (v) =>
            (v.plate && hintLower.includes(v.plate.toLowerCase())) ||
            (v.name && hintLower.includes(v.name.toLowerCase()))
        ) || null
      );
    }
    return null;
  };

  const resolveDrv = (dId, nameHint = '', fallbackTeamId = '') => {
    if (dId) {
      const found = members.find((m) => m.id === dId);
      if (found) return { member: found, name: found.name, id: found.id };
    }
    if (nameHint) {
      const trimmed = nameHint.trim();
      const found = members.find((m) => m.name.toLowerCase() === trimmed.toLowerCase());
      return { member: found || null, name: found ? found.name : trimmed, id: found?.id || dId || '' };
    }
    if (fallbackTeamId) {
      const found = members.find((m) => m.id === fallbackTeamId);
      if (found) return { member: found, name: found.name, id: found.id };
    }
    return { member: null, name: '', id: '' };
  };

  if (Array.isArray(mission.vehicleAllocations) && mission.vehicleAllocations.length > 0) {
    return mission.vehicleAllocations
      .filter((a) => a && (a.vehicleId || a.vehicleName))
      .map((a, idx) => {
        const veh = resolveVeh(a.vehicleId, a.vehicleName || '');
        const drv = resolveDrv(a.driverId, a.driverName || '', mission.teamIds?.[idx] || '');
        return {
          vehicleId: veh?.id || a.vehicleId || '',
          vehicle: veh,
          vehicleName: veh ? `${veh.name} (${veh.plate})` : a.vehicleName || 'Viatura',
          driverId: drv.id,
          driverMember: drv.member,
          driverName: drv.name,
        };
      });
  }

  // Fallback para missões antigas com apenas 1 vehicleId
  if (mission.vehicleId || (mission.vehicleNameDisplay && mission.vehicleNameDisplay !== 'Não alocada')) {
    const veh = resolveVeh(mission.vehicleId, mission.vehicleNameDisplay || '');
    const drv = resolveDrv(mission.driverId, mission.driverName || '', mission.teamIds?.[0] || '');
    if (veh || mission.vehicleId) {
      return [
        {
          vehicleId: veh?.id || mission.vehicleId || '',
          vehicle: veh,
          vehicleName: veh ? `${veh.name} (${veh.plate})` : mission.vehicleNameDisplay || 'Viatura',
          driverId: drv.id,
          driverMember: drv.member,
          driverName: drv.name,
        },
      ];
    }
  }

  return [];
}

// Localiza missão ativa ('Em Execução' ou 'Em Preparo') vinculada a uma viatura (suporta múltiplas viaturas por missão)
export function getActiveMissionForVehicle(vehicle, missions = []) {
  if (!vehicle || !Array.isArray(missions)) return null;
  const matches = missions.filter((m) => {
    if (!isMissionActiveOrPrep(m)) return false;
    if (m.vehicleId && m.vehicleId === vehicle.id) return true;
    if (Array.isArray(m.vehicleIds) && m.vehicleIds.includes(vehicle.id)) return true;
    if (
      Array.isArray(m.vehicleAllocations) &&
      m.vehicleAllocations.some((a) => a.vehicleId === vehicle.id)
    ) {
      return true;
    }
    if (m.vehicleNameDisplay) {
      const disp = m.vehicleNameDisplay.toLowerCase();
      if (vehicle.plate && disp.includes(vehicle.plate.toLowerCase())) return true;
      if (vehicle.name && disp.includes(vehicle.name.toLowerCase())) return true;
    }
    return false;
  });
  return (
    matches.find((m) => m.missionStatus === 'Em Execução') ||
    matches.find((m) => m.missionStatus === 'Em Preparo') ||
    matches[0] ||
    null
  );
}

// Localiza missão ativa ('Em Execução' ou 'Em Preparo') vinculada a um colaborador (equipe ou motorista de qualquer viatura)
export function getActiveMissionForMember(member, missions = []) {
  if (!member || !Array.isArray(missions)) return null;
  const memNameLower = (member.name || '').trim().toLowerCase();
  const memFirstName = memNameLower.split(' ')[0];

  const matches = missions.filter((m) => {
    if (!isMissionActiveOrPrep(m)) return false;
    if (Array.isArray(m.teamIds) && m.teamIds.includes(member.id)) return true;
    if (m.driverId && m.driverId === member.id) return true;
    if (Array.isArray(m.driverIds) && m.driverIds.includes(member.id)) return true;
    if (
      Array.isArray(m.vehicleAllocations) &&
      m.vehicleAllocations.some(
        (a) =>
          a.driverId === member.id ||
          (a.driverName && a.driverName.trim().toLowerCase() === memNameLower)
      )
    ) {
      return true;
    }
    if (m.driverName && m.driverName.toLowerCase().includes(memNameLower)) return true;
    if (m.teamNamesDisplay && memNameLower) {
      const names = m.teamNamesDisplay
        .toLowerCase()
        .split(',')
        .map((s) => s.trim());
      if (names.includes(memNameLower) || (memFirstName && names.includes(memFirstName))) {
        return true;
      }
    }
    return false;
  });

  return (
    matches.find((m) => m.missionStatus === 'Em Execução') ||
    matches.find((m) => m.missionStatus === 'Em Preparo') ||
    matches[0] ||
    null
  );
}

// Calcula horário de chegada estimado somando minutos de deslocamento ao horário de saída
export function calculateArrivalTime(departureTimeStr, durationMinutes) {
  if (!departureTimeStr) return '--:--';
  const parts = departureTimeStr.split(':');
  if (parts.length < 2) return '--:--';
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return '--:--';

  const totalMin = hours * 60 + minutes + durationMinutes;
  const newHours = Math.floor(totalMin / 60) % 24;
  const newMin = Math.round(totalMin % 60);

  return `${String(newHours).padStart(2, '0')}:${String(newMin).padStart(2, '0')}`;
}

/**
 * Sugere o horário máximo de saída da base baseado no horário de início do evento,
 * tempo de deslocamento até o local e margem de antecedência para montagem/preparo no local.
 * Exemplo: Evento às 18:00, 5 min de deslocamento, 30 min de antecedência:
 * Saída máxima da base = 18:00 - 30m - 5m = 17:25.
 */
export function calculateSuggestedDepartureTime(eventStartTimeStr, durationMinutes = 0, antecedenceMinutes = 30) {
  if (!eventStartTimeStr || typeof eventStartTimeStr !== 'string' || !eventStartTimeStr.includes(':')) {
    return null;
  }
  const parts = eventStartTimeStr.split(':');
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return null;

  const eventMin = hours * 60 + minutes;
  const driveMin = Math.max(0, Math.round(Number(durationMinutes) || 0));
  const antecMin = Math.max(0, Math.round(Number(antecedenceMinutes) || 0));
  const totalOffset = driveMin + antecMin;

  let depMin = eventMin - totalOffset;
  depMin = ((depMin % 1440) + 1440) % 1440;

  const depHours = Math.floor(depMin / 60);
  const depMinutes = depMin % 60;

  return `${String(depHours).padStart(2, '0')}:${String(depMinutes).padStart(2, '0')}`;
}

// Gera link de navegação rápida para Google Maps e Waze
export function getNavigationLinks(originLat, originLon, destLat, destLon) {
  return {
    googleMaps: `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLon}&destination=${destLat},${destLon}&travelmode=driving`,
    waze: `https://waze.com/ul?ll=${destLat},${destLon}&navigate=yes`,
  };
}

// Verifica se uma viatura está alocada em uma determinada missão (suporta 1 ou N viaturas)
export function isVehicleInMission(vehicle, mission) {
  if (!vehicle || !mission || mission.missionStatus === 'Cancelada') return false;
  if (mission.vehicleId && mission.vehicleId === vehicle.id) return true;
  if (Array.isArray(mission.vehicleIds) && mission.vehicleIds.includes(vehicle.id)) return true;
  if (
    Array.isArray(mission.vehicleAllocations) &&
    mission.vehicleAllocations.some((a) => a && a.vehicleId === vehicle.id)
  ) {
    return true;
  }
  if (mission.vehicleNameDisplay) {
    const disp = mission.vehicleNameDisplay.toLowerCase();
    if (vehicle.plate && disp.includes(vehicle.plate.toLowerCase())) return true;
    if (vehicle.name && disp.includes(vehicle.name.toLowerCase())) return true;
  }
  return false;
}

// ============================================================================
// TELEMETRIA MINUCIOSA DO TANQUE / BATERIA DA VIATURA (Gasolina, Diesel e Elétrico)
// - Deduz automaticamente o consumo (km ida e volta / autonomia) de cada missão
// - Acrescenta automaticamente os litros / kWh de cada novo abastecimento ou recarga
// - Emite alerta de reserva/bateria quando o nível fica <= 10% da capacidade total
// ============================================================================

// Identifica se a viatura é 100% elétrica
export function isElectricVehicle(vehicle) {
  const ft = (typeof vehicle === 'string' ? vehicle : vehicle?.fuelType || '').toLowerCase().trim();
  return (
    ft.includes('elétr') ||
    ft.includes('eletr') ||
    ft.includes('electric') ||
    ft === 'ev' ||
    ft === 'bev'
  );
}

// Retorna a unidade de energia correspondente (kWh para elétricos, L para combustão)
export function getFuelUnit(vehicle) {
  return isElectricVehicle(vehicle) ? 'kWh' : 'L';
}

// Retorna o substantivo de armazenamento (Bateria para elétricos, Tanque para combustão)
export function getFuelNoun(vehicle) {
  return isElectricVehicle(vehicle) ? 'Bateria' : 'Tanque';
}

// Retorna a ação correspondente (Recarga para elétricos, Abastecimento para combustão)
export function getFuelActionNoun(vehicle) {
  return isElectricVehicle(vehicle) ? 'Recarga' : 'Abastecimento';
}

// Retorna o verbo correspondente (recarregar para elétricos, abastecer para combustão)
export function getFuelVerb(vehicle) {
  return isElectricVehicle(vehicle) ? 'recarregar' : 'abastecer';
}

// Retorna o ícone do tipo de propulsão/combustível
export function getFuelTypeIcon(vehicleOrFuelType) {
  const ft = (typeof vehicleOrFuelType === 'string' ? vehicleOrFuelType : vehicleOrFuelType?.fuelType || '').toLowerCase().trim();
  if (ft.includes('elétr') || ft.includes('eletr') || ft.includes('electric')) return '⚡';
  if (ft === 'diesel') return '🛢️';
  return '⛽';
}

// Retorna a classe CSS do badge de combustível
export function getFuelTypeBadgeClass(vehicleOrFuelType) {
  const ft = (typeof vehicleOrFuelType === 'string' ? vehicleOrFuelType : vehicleOrFuelType?.fuelType || '').toLowerCase().trim();
  if (ft.includes('elétr') || ft.includes('eletr') || ft.includes('electric')) return 'fuel-eletrico';
  if (ft === 'diesel') return 'fuel-diesel';
  return 'fuel-gasolina';
}

// Retorna o preço da unidade apropriada para a viatura (Gasolina R$/L, Diesel R$/L ou Eletricidade R$/kWh)
export function getFuelPriceForVehicle(vehicle, fuelPriceSetting = 6.45) {
  const isElectric = isElectricVehicle(vehicle);
  const isDiesel = (vehicle?.fuelType || '').toLowerCase() === 'diesel';

  if (typeof fuelPriceSetting === 'number') {
    return fuelPriceSetting;
  }
  if (fuelPriceSetting && typeof fuelPriceSetting === 'object') {
    if (isElectric) {
      return parseFloat(
        fuelPriceSetting.electricPricePerKwh ??
        fuelPriceSetting.electricPrice ??
        fuelPriceSetting.electric ??
        0.95
      );
    }
    if (isDiesel) {
      return parseFloat(
        fuelPriceSetting.dieselPricePerLiter ??
        fuelPriceSetting.diesel ??
        fuelPriceSetting.fuelPricePerLiter ??
        6.89
      );
    }
    return parseFloat(
      fuelPriceSetting.gasolinePricePerLiter ??
      fuelPriceSetting.gasoline ??
      fuelPriceSetting.fuelPricePerLiter ??
      6.45
    );
  }
  if (isElectric) return 0.95;
  return isDiesel ? 6.89 : 6.45;
}

const SEED_FUEL_LOG_IDS = new Set(['f-1', 'f-2', 'f-3']);

export function computeVehicleFuelTelemetry(
  vehicle,
  missions = [],
  fuelPricePerLiter = 6.45,
  excludeMissionId = null
) {
  const effectiveFuelPrice = getFuelPriceForVehicle(vehicle, fuelPricePerLiter);
  if (!vehicle) {
    return {
      tankCapacity: 50,
      autonomy: 12,
      maxRangeKm: 600,
      baseLiters: 40,
      refuelLitersAdded: 0,
      missionsCount: 0,
      totalMissionsKm: 0,
      totalMissionsLitersConsumed: 0,
      currentLiters: 40,
      fuelLiters: 40,
      currentPercent: 80,
      currentFuelPercent: 80,
      remainingRangeKm: 480,
      isReserveAlert: false,
      isLowWarning: false,
      reserveThresholdLiters: 5,
      litersToFullTank: 10,
      costToFullTank: parseFloat((10 * effectiveFuelPrice).toFixed(2)),
      effectiveOdometerKm: 0,
    };
  }

  const tankCapacity = parseFloat(vehicle.tankCapacity) > 0 ? parseFloat(vehicle.tankCapacity) : 50;
  const autonomy =
    parseFloat(vehicle.autonomyKmPerLiter) > 0 ? parseFloat(vehicle.autonomyKmPerLiter) : 12;
  const maxRangeKm = parseFloat((tankCapacity * autonomy).toFixed(1));

  // Nível base inicial do tanque (definido no cadastro/edição da viatura)
  const rawBasePercent = parseFloat(
    vehicle.baseFuelPercent !== undefined ? vehicle.baseFuelPercent : (vehicle.currentFuelPercent ?? 80)
  );
  const basePercent =
    vehicle.baseFuelPercent !== undefined
      ? (isNaN(rawBasePercent) ? 80 : rawBasePercent)
      : Math.max(0, Math.min(100, isNaN(rawBasePercent) ? 80 : rawBasePercent));
  const baseLiters = (basePercent / 100) * tankCapacity;

  // Litros adicionados em abastecimentos posteriores à calibração base
  const refuelLitersAdded = (vehicle.fuelLogs || [])
    .filter((f) => !f.accountedInBase && !SEED_FUEL_LOG_IDS.has(f.id))
    .reduce((acc, f) => acc + (parseFloat(f.liters) || 0), 0);

  // Missões vinculadas a esta viatura (exceto canceladas ou missão em edição se excludeMissionId informado)
  const vehicleMissions = (missions || []).filter(
    (m) => m.id !== excludeMissionId && isVehicleInMission(vehicle, m)
  );

  let totalMissionsKm = 0;
  let totalMissionsLitersConsumed = 0;

  vehicleMissions.forEach((m) => {
    const mKm = getMissionTotalKm(m);
    if (mKm > 0) {
      totalMissionsKm += mKm;
      totalMissionsLitersConsumed += mKm / autonomy;
    }
  });

  totalMissionsKm = parseFloat(totalMissionsKm.toFixed(2));
  totalMissionsLitersConsumed = parseFloat(totalMissionsLitersConsumed.toFixed(2));

  // Nível líquido atual no tanque (oscila com abastecimentos e missões)
  const rawLiters = baseLiters + refuelLitersAdded - totalMissionsLitersConsumed;
  const currentLiters = parseFloat(Math.max(0, Math.min(tankCapacity, rawLiters)).toFixed(2));
  const currentPercent = parseFloat(((currentLiters / tankCapacity) * 100).toFixed(1));
  const remainingRangeKm = parseFloat((currentLiters * autonomy).toFixed(1));

  // Alerta crítico de reserva de combustível: igual ou abaixo de 10% da capacidade total
  const isReserveAlert = currentPercent <= 10;
  const isLowWarning = currentPercent > 10 && currentPercent <= 25;
  const reserveThresholdLiters = parseFloat((tankCapacity * 0.1).toFixed(2));

  const litersToFullTank = parseFloat(Math.max(0, tankCapacity - currentLiters).toFixed(2));
  const costToFullTank = parseFloat((litersToFullTank * effectiveFuelPrice).toFixed(2));
  const effectiveOdometerKm = parseFloat(
    ((parseFloat(vehicle.currentKm) || 0) + totalMissionsKm).toFixed(1)
  );

  return {
    tankCapacity,
    autonomy,
    maxRangeKm,
    basePercent,
    baseLiters: parseFloat(baseLiters.toFixed(2)),
    refuelLitersAdded: parseFloat(refuelLitersAdded.toFixed(2)),
    missionsCount: vehicleMissions.length,
    totalMissionsKm,
    totalMissionsLitersConsumed,
    currentLiters,
    fuelLiters: currentLiters,
    currentPercent,
    currentFuelPercent: currentPercent,
    remainingRangeKm,
    isReserveAlert,
    isLowWarning,
    reserveThresholdLiters,
    litersToFullTank,
    costToFullTank,
    effectiveOdometerKm,
  };
}

// ============================================================================
// CÁLCULO DETALHADO DE IMPACTO DA MISSÃO NO TANQUE & COMBUSTÍVEL EXCEDENTE
// - Calcula quantos litros e % do tanque a missão irá deduzir da viatura
// - Detecta se a missão ultrapassa a quilometragem de 1 tanque cheio da viatura
//   e calcula exatamente quanto a mais de 1 tanque (litros, km, % e R$ excedentes) será necessário
// - Detecta também se o nível atual do tanque ficará <= 10% (Reserva) ou insuficiente
// ============================================================================
export function computeMissionVehicleFuelBreakdown({
  vehicle,
  totalRoundTripKm = 0,
  currentTelemetry = null,
  fuelPricePerLiter = 6.45,
}) {
  const price = getFuelPriceForVehicle(vehicle, fuelPricePerLiter);
  const tankCapacity = parseFloat(vehicle?.tankCapacity) > 0 ? parseFloat(vehicle.tankCapacity) : 50;
  const autonomy =
    parseFloat(vehicle?.autonomyKmPerLiter) > 0 ? parseFloat(vehicle.autonomyKmPerLiter) : 12;
  const maxTankRangeKm = parseFloat((tankCapacity * autonomy).toFixed(1));
  const fullTankCost = parseFloat((tankCapacity * price).toFixed(2));

  const km = Math.max(0, parseFloat(totalRoundTripKm) || 0);
  const litersNeeded = parseFloat((km / autonomy).toFixed(2));
  const totalCost = parseFloat((litersNeeded * price).toFixed(2));
  const percentOfTankUsed = parseFloat(((litersNeeded / tankCapacity) * 100).toFixed(1));
  const tanksRequired = parseFloat((litersNeeded / tankCapacity).toFixed(2));

  // 1. Verifica se a missão ultrapassa a quilometragem máxima de 1 tanque cheio da viatura
  const exceedsFullTankCapacity = km > maxTankRangeKm;
  const excessOverFullTankKm = exceedsFullTankCapacity
    ? parseFloat((km - maxTankRangeKm).toFixed(2))
    : 0;
  const excessOverFullTankLiters = exceedsFullTankCapacity
    ? parseFloat((litersNeeded - tankCapacity).toFixed(2))
    : 0;
  const excessOverFullTankPercent = exceedsFullTankCapacity
    ? parseFloat(((excessOverFullTankLiters / tankCapacity) * 100).toFixed(1))
    : 0;
  const excessOverFullTankCost = exceedsFullTankCapacity
    ? parseFloat((excessOverFullTankLiters * price).toFixed(2))
    : 0;

  // 2. Impacto sobre o combustível disponível atualmente no tanque da viatura
  const litersBefore = currentTelemetry
    ? currentTelemetry.currentLiters
    : parseFloat((((vehicle?.currentFuelPercent ?? 80) / 100) * tankCapacity).toFixed(2));
  const percentBefore = currentTelemetry
    ? currentTelemetry.currentPercent
    : parseFloat((vehicle?.currentFuelPercent ?? 80).toFixed(1));

  const exceedsCurrentAvailableFuel = litersNeeded > litersBefore;
  const deficitFromCurrentLiters = exceedsCurrentAvailableFuel
    ? parseFloat((litersNeeded - litersBefore).toFixed(2))
    : 0;
  const deficitFromCurrentCost = exceedsCurrentAvailableFuel
    ? parseFloat((deficitFromCurrentLiters * price).toFixed(2))
    : 0;

  const litersAfter = parseFloat(Math.max(0, litersBefore - litersNeeded).toFixed(2));
  const percentAfter = parseFloat(((litersAfter / tankCapacity) * 100).toFixed(1));
  const remainingRangeAfterKm = parseFloat((litersAfter * autonomy).toFixed(1));
  const triggersReserveAlert = percentAfter <= 10;

  return {
    tankCapacity,
    autonomy,
    maxTankRangeKm,
    fullTankCost,
    km,
    litersNeeded,
    totalCost,
    percentOfTankUsed,
    tanksRequired,
    // Excedente além da capacidade de 1 tanque completo
    exceedsFullTankCapacity,
    excessOverFullTankKm,
    excessOverFullTankLiters,
    excessOverFullTankPercent,
    excessOverFullTankCost,
    // Impacto no tanque atual da viatura
    litersBefore,
    percentBefore,
    litersAfter,
    percentAfter,
    remainingRangeAfterKm,
    exceedsCurrentAvailableFuel,
    deficitFromCurrentLiters,
    deficitFromCurrentCost,
    triggersReserveAlert,
  };
}

/**
 * Determina se uma missão possui pós-produção ativa que demanda edição/aprovação.
 * Retorna false se o status for "Não se aplica", sem pós-produção ou desativada.
 */
export function hasMissionPostProduction(mission) {
  if (!mission) return false;
  if (mission.hasPostProduction === false) return false;
  const edition = String(mission.editionStatus || '').trim().toLowerCase();
  if (!edition) return false;
  if (
    edition === 'não se aplica' ||
    edition === 'nao se aplica' ||
    edition.startsWith('não se aplica') ||
    edition.startsWith('nao se aplica') ||
    edition === 'sem pós-produção' ||
    edition === 'sem pos-producao' ||
    edition === 'desativado'
  ) {
    return false;
  }
  return true;
}

/**
 * Determina com precisão e segurança se uma missão está com a pós-produção atrasada.
 * Regras estritas:
 * 1. Se NÃO tem pós-produção (ex: "Não se aplica"): NUNCA está atrasada (retorna false).
 * 2. Se a missão está Finalizada, Concluída ou Cancelada: NUNCA está atrasada (retorna false).
 * 3. Se a edição já foi concluída, entregue ou aprovada: NUNCA está atrasada (retorna false).
 * 4. Se a missão é futura e ainda está Agendada (o evento/gravação ainda não aconteceu): NUNCA está atrasada (retorna false).
 * 5. Se não há prazo limite de entrega configurado: NUNCA está atrasada (retorna false).
 * 6. Só é considerada atrasada se a missão já ocorreu ou está em andamento/pendente e a data/hora limite foi ultrapassada.
 */
export function checkIsMissionOverdue(mission) {
  if (!mission) return false;

  // 1. Sem pós-produção -> Nunca atrasada
  if (!hasMissionPostProduction(mission)) {
    return false;
  }

  // 2. Missão finalizada ou cancelada
  const mStatus = mission.missionStatus || 'Agendada';
  if (
    mStatus === 'Finalizada' ||
    mStatus === 'Finalizado' ||
    mStatus === 'Concluída' ||
    mStatus === 'Cancelada'
  ) {
    return false;
  }

  // 3. Edição já concluída ou entregue
  const edStatus = String(mission.editionStatus || '').trim();
  if (
    edStatus === 'Edição Concluída' ||
    edStatus === 'Entregue' ||
    edStatus === 'Aprovado' ||
    mission.editionDeliveryStatus === 'Dentro do Prazo'
  ) {
    return false;
  }

  // 4. Se a missão ainda é futura e está Agendada (o evento ainda não ocorreu)
  if (mStatus === 'Agendada' && mission.date) {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (mission.date > todayStr) {
      return false;
    }
    if (mission.date === todayStr && mission.departureTime) {
      const [depH, depM] = String(mission.departureTime).split(':').map(Number);
      if (!isNaN(depH) && !isNaN(depM)) {
        const missionStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), depH, depM, 0, 0);
        if (now.getTime() < missionStart.getTime()) {
          return false;
        }
      }
    }
  }

  // 5. Validação da data e horário limite de entrega
  if (!mission.deliveryDeadlineDate) {
    return false;
  }

  const dateParts = String(mission.deliveryDeadlineDate).split('-').map(Number);
  if (dateParts.length < 3) return false;
  const timeParts = String(mission.deliveryDeadlineTime || '18:00').split(':').map(Number);
  const [y, m, d] = dateParts;
  const [h, min] = timeParts;
  const deadlineDate = new Date(y, m - 1, d, isNaN(h) ? 18 : h, isNaN(min) ? 0 : min, 0, 0);

  return Date.now() > deadlineDate.getTime();
}

/**
 * Calcula o andamento em tempo real de uma missão em campo:
 * - isHappeningNow: se a missão está acontecendo hoje e já iniciou a saída da base.
 * - isUrgentEnd: se a missão está acontecendo e está a 30 minutos ou menos do término previsto
 *   (considerando também as horas extras aprovadas).
 * - remainingMinutes: quantos minutos faltam para o fim do horário previsto (negativo se passou).
 * - effectiveEndTimeStr: horário final formatado HH:MM considerando horas extras aprovadas.
 */
export function getMissionLiveProgress(mission) {
  if (!mission || !mission.date || !mission.departureTime) {
    return {
      isHappeningNow: false,
      isUrgentEnd: false,
      remainingMinutes: null,
      effectiveEndTimeStr: '--:--',
      approvedExtraHours: 0,
      startTimeStr: mission?.departureTime || '--:--',
    };
  }

  const mStatus = String(mission.missionStatus || 'Agendada').trim().toLowerCase();
  if (
    mStatus === 'finalizada' ||
    mStatus === 'finalizado' ||
    mStatus === 'concluída' ||
    mStatus === 'cancelada'
  ) {
    return {
      isHappeningNow: false,
      isUrgentEnd: false,
      remainingMinutes: null,
      effectiveEndTimeStr: '--:--',
      approvedExtraHours: 0,
      startTimeStr: mission.departureTime,
    };
  }

  const now = new Date();
  const dateParts = String(mission.date).split('-').map(Number);
  const depParts = String(mission.departureTime).split(':').map(Number);
  if (dateParts.length < 3 || depParts.length < 2 || isNaN(depParts[0]) || isNaN(depParts[1])) {
    return {
      isHappeningNow: false,
      isUrgentEnd: false,
      remainingMinutes: null,
      effectiveEndTimeStr: '--:--',
      approvedExtraHours: 0,
      startTimeStr: mission.departureTime,
    };
  }

  const [y, m, d] = dateParts;
  const [depH, depM] = depParts;
  const startTime = new Date(y, m - 1, d, depH, depM, 0, 0);

  // Horário previsto de retorno base
  let endTime;
  const returnCandidate = mission.returnTimeEstimated || mission.arrivalTimeEstimated;
  if (returnCandidate && String(returnCandidate).includes(':')) {
    const [retH, retM] = String(returnCandidate).split(':').map(Number);
    if (!isNaN(retH) && !isNaN(retM)) {
      endTime = new Date(y, m - 1, d, retH, retM, 0, 0);
      if (endTime <= startTime) {
        endTime.setDate(endTime.getDate() + 1);
      }
    }
  }
  if (!endTime) {
    endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000); // 2h padrão
  }

  // Horas extras aprovadas somadas ao horário final
  const approvedExtraHours = Number(mission.extraHoursApproved || 0);
  const effectiveEndTime = new Date(endTime.getTime() + approvedExtraHours * 60 * 60 * 1000);

  const endH = String(effectiveEndTime.getHours()).padStart(2, '0');
  const endMin = String(effectiveEndTime.getMinutes()).padStart(2, '0');
  const effectiveEndTimeStr = `${endH}:${endMin}`;

  const isToday = (
    now.getFullYear() === y &&
    now.getMonth() === (m - 1) &&
    now.getDate() === d
  );

  const diffMs = effectiveEndTime.getTime() - now.getTime();
  const remainingMinutes = Math.round(diffMs / (60 * 1000));

  // Missão acontecendo no momento:
  // - Marcada explicitamente como "Em Execução" ou "Em Andamento"
  // OU
  // - É hoje, já passou da saída e ainda não estourou 90 minutos após o término previsto sem ser finalizada
  const isHappeningNow = (
    mStatus === 'em execução' ||
    mStatus === 'em execucao' ||
    mStatus === 'em andamento' ||
    (isToday && now.getTime() >= startTime.getTime() && diffMs > -90 * 60 * 1000)
  );

  // Urgência / Reta final:
  // Quando a missão está em andamento e faltam 30 minutos ou menos (ou acabou de atingir o limite previsto)
  const isUrgentEnd = isHappeningNow && remainingMinutes <= 30;

  // Verifica se o término previsto está fora do expediente comercial regular
  // Expediente: Seg a Sex 08:00 às 18:00, Sáb 08:00 às 12:00, Dom dia todo fora
  const dayOfWeek = effectiveEndTime.getDay();
  const minuteOfDay = effectiveEndTime.getHours() * 60 + effectiveEndTime.getMinutes();
  let isOffHoursEnd = false;
  if (dayOfWeek >= 1 && dayOfWeek <= 5) {
    isOffHoursEnd = minuteOfDay < 480 || minuteOfDay > 1080;
  } else if (dayOfWeek === 6) {
    isOffHoursEnd = minuteOfDay < 480 || minuteOfDay > 720;
  } else {
    isOffHoursEnd = true;
  }

  // Reta final FORA do expediente -> Hora extra financeira real
  const isUrgentOffHours = isUrgentEnd && isOffHoursEnd;
  // Reta final DENTRO do expediente -> Prorrogação de retorno de pauta operacional
  const isUrgentInHours = isUrgentEnd && !isOffHoursEnd;

  return {
    isHappeningNow,
    isUrgentEnd,
    isUrgentOffHours,
    isUrgentInHours,
    isOffHoursEnd,
    remainingMinutes,
    effectiveEndTimeStr,
    approvedExtraHours,
    startTimeStr: mission.departureTime,
  };
}
