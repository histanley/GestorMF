/**
 * Utilitário de Cálculo de Horário Comercial vs. Banco de Horas (Horas Extras)
 * 
 * Regras do MegaGestão:
 * - Horário Comercial / Expediente Normal:
 *   - Segunda a Sexta: 08:00 às 18:00 (10 horas)
 *   - Sábado: 08:00 às 12:00 (4 horas)
 *   - Domingo: Sem expediente (o dia todo é considerado fora do expediente)
 * 
 * - Fora do Expediente (Banco de Horas):
 *   - Segunda a Sexta: antes das 08:00 e após as 18:00
 *   - Sábado: antes das 08:00 e após as 12:00
 *   - Domingo: 100% das horas (dia todo)
 */

/**
 * Resolve com precisão os horários de início e fim do evento no local,
 * desconsiderando o percurso de ida e volta da base.
 *
 * Regra MegaFilmes:
 * "Quero pagar apenas horário de início e fim do evento, não quero que seja
 * contabilizado o deslocamento da base até o evento e nem do evento até a base,
 * apenas o horário do evento."
 */
export function resolveEventTimes(data) {
  if (!data) return { startTime: null, endTime: null };

  // 1. Início do evento:
  // Prioridade: eventStartTime -> arrivalTimeEstimated -> departureTime
  const startTime = data.eventStartTime || data.arrivalTimeEstimated || data.departureTime || null;

  // 2. Término do evento:
  // Prioridade: eventEndTime -> se não preenchido, deduz subtraindo a viagem de volta do retorno à base
  let endTime = data.eventEndTime || null;
  if (!endTime && data.returnTimeEstimated) {
    const returnTime = data.returnTimeEstimated;
    const oneWayMin = Number(data.drivingDurationMinutes) || (Number(data.roundTripDurationMinutes) ? Math.round(Number(data.roundTripDurationMinutes) / 2) : 0);
    if (oneWayMin > 0 && String(returnTime).includes(':')) {
      const [rh, rm] = String(returnTime).split(':').map(Number);
      const retTotalMin = rh * 60 + rm;
      const endTotalMin = retTotalMin - oneWayMin;
      if (endTotalMin >= 0) {
        const eh = Math.floor(endTotalMin / 60);
        const em = endTotalMin % 60;
        endTime = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
      } else {
        endTime = returnTime;
      }
    } else {
      endTime = returnTime;
    }
  }

  return { startTime, endTime };
}

/**
 * Calcula as horas extras (fora do expediente) EXCLUSIVAMENTE sobre o período do evento
 * (Início do Evento até Fim do Evento), EXCLUINDO totalmente o deslocamento de ida/volta à base.
 */
export function calculateEventOnlyOffHours(missionOrData) {
  if (!missionOrData) {
    return {
      totalMinutes: 0,
      totalHours: 0,
      inHoursMinutes: 0,
      inHours: 0,
      offHoursMinutes: 0,
      offHours: 0,
      lunchOffHoursMinutes: 0,
      lunchOffHours: 0,
      hasLunchOffHours: false,
      breakMinutes: 0,
      breakHours: 0,
      isOffHours: false,
      offHoursSegments: [],
    };
  }

  const { startTime, endTime } = resolveEventTimes(missionOrData);
  const startDateStr = missionOrData.date;
  const endDateStr = missionOrData.endDate || missionOrData.date;
  const isMultiDay = Boolean(missionOrData.isMultiDay || (missionOrData.endDate && missionOrData.endDate !== missionOrData.date));

  // Identificação automática de missões contínuas ao vivo (ex: #202611242 TJRR Sessões Criminais)
  const codeStr = String(missionOrData.code || '');
  const descStr = String(missionOrData.description || '').toLowerCase();
  const isContinuousLive = codeStr.includes('202611242') || (descStr.includes('tjrr') && descStr.includes('sessoes'));

  let effectiveLunchOption = missionOrData.lunchBreakOption;
  let effectiveHasLunchBreak = missionOrData.hasLunchBreak;

  if (effectiveLunchOption === undefined && effectiveHasLunchBreak === undefined) {
    if (isContinuousLive) {
      effectiveLunchOption = 'no_break';
      effectiveHasLunchBreak = false;
    }
  }

  return calculateMissionOffHours(startDateStr, startTime, endDateStr, endTime, isMultiDay, {
    hasLunchBreak: effectiveHasLunchBreak,
    lunchBreakOption: effectiveLunchOption,
  });
}

/**
 * Determina se a missão já teve sua parte de campo/evento encerrada e equipe retornada à base,
 * estando 100% elegível para contabilização e pagamento de horas extras e diárias.
 *
 * Regra do Diretor:
 * "Sei que as missões que tem pós-produção não finalizam até os editores entregarem o material,
 * mas devemos contabilizar as horas extras do colaborador sem que isso dependa do final da missão,
 * sem que dependa do editor entregar o material. Quero que as horas extras sejam pagas assim que o evento terminar."
 */
export function isMissionEligibleForPayout(mission, referenceNow = new Date()) {
  if (!mission) return false;
  const status = String(mission.missionStatus || 'Agendada').trim().toLowerCase();

  // Missões canceladas nunca geram remuneração
  if (status === 'cancelada' || status === 'cancelado') return false;

  // Se já está Finalizada ou Concluída
  if (status === 'finalizada' || status === 'finalizado' || status === 'concluída' || status === 'concluida') return true;

  // Se está 'Pendente' (status onde o campo já foi realizado e aguarda edição/aprovação de vídeo)
  if (status === 'pendente') return true;

  // Se o retorno da missão ou o evento já aconteceu no tempo
  const dateStr = mission.endDate || mission.date;
  const timeStr = mission.returnTimeEstimated || mission.eventEndTime || mission.arrivalTimeEstimated || '23:59';
  if (dateStr) {
    try {
      const [y, m, d] = String(dateStr).split('-').map(Number);
      const [h, min] = String(timeStr).split(':').map(Number);
      const missionEnd = new Date(y, m - 1, d, h || 0, min || 0, 0, 0);
      if (missionEnd <= referenceNow) {
        return true;
      }
    } catch (e) {}
  }

  return false;
}

/**
 * Verifica se um colaborador é elegível para receber horas extras em uma missão.
 *
 * REGRA OFICIAL MEGAFILMES:
 * "Os editores que ficam na pós-produção não devem receber horas extras."
 *
 * Horas extras fora do expediente são devidas estritamente à equipe operacional
 * que atuou presencialmente em campo no local do evento (membros de campo e condutores).
 * Quem participou exclusivamente na pós-produção/edição não recebe horas extras.
 */
export function isMemberEligibleForExtraHours(member, mission) {
  if (!member || !mission) return false;
  const memIdStr = String(member.id);
  const memNameNorm = String(member.name || '').trim().toLowerCase();

  // Caso específico missão #202611144 (Fotos SESI Terceirão):
  // Diretriz expressa da Diretoria: Mateus Henrique é estritamente editor da pós-produção e não foi a campo.
  // Editores de pós-produção não recebem horas extras.
  const codeClean = String(mission.code || '');
  const idClean = String(mission.id || '');
  const descClean = String(mission.description || '').toLowerCase();
  const isSesi202611144 =
    codeClean.includes('202611144') ||
    idClean.includes('202611144') ||
    (descClean.includes('sesi') && descClean.includes('terceir'));
  if (isSesi202611144 && memNameNorm.includes('mateus')) {
    return false;
  }

  // 1. Checa se o colaborador é editor designado da missão (pós-produção)
  const editorIds = Array.isArray(mission.editorIds) ? mission.editorIds.map(String) : [];
  const inEditorIds = editorIds.includes(memIdStr) || (mission.editorId && String(mission.editorId) === memIdStr);
  const inEditorDisplay = mission.editorNamesDisplay && mission.editorNamesDisplay.trim().toLowerCase().includes(memNameNorm);
  const inEditorName = mission.editorName && String(mission.editorName).trim().toLowerCase().includes(memNameNorm);
  const inEditorsDelivery = Boolean(
    mission.editorsDelivery &&
    (mission.editorsDelivery[memIdStr] ||
     mission.editorsDelivery[member.name] ||
     (memNameNorm && Object.keys(mission.editorsDelivery).some((k) => k.toLowerCase().includes(memNameNorm))))
  );
  const isAssignedEditor = inEditorIds || inEditorDisplay || inEditorName || inEditorsDelivery;

  // 2. Checa se o colaborador foi condutor/motorista em campo
  const allocations = Array.isArray(mission.vehicleAllocations) ? mission.vehicleAllocations : [];
  const isDriver = allocations.some(
    (a) => (a.driverId && String(a.driverId) === memIdStr) ||
           (a.driverName && String(a.driverName).trim().toLowerCase() === memNameNorm)
  ) || (mission.driverId && String(mission.driverId) === memIdStr) ||
       (mission.driverName && String(mission.driverName).trim().toLowerCase() === memNameNorm);

  // 3. Checa funções explícitas atribuídas no evento de campo
  const explicitRoles = mission.memberRoles?.[member.id] || mission.memberRoles?.[memIdStr];
  const roleArray = Array.isArray(explicitRoles) ? explicitRoles : (typeof explicitRoles === 'string' && explicitRoles.trim() ? [explicitRoles] : []);

  const hasFieldRole = roleArray.some((r) => {
    const rNorm = String(r).trim().toLowerCase();
    return !rNorm.includes('editor') && !rNorm.includes('pós-produção') && !rNorm.includes('pos-producao') && !rNorm.includes('designer');
  });

  const isOnlyEditorRole = roleArray.length > 0 && !hasFieldRole;

  // REGRA OFICIAL MEGAFILMES:
  // "Os editores que ficam na pós-produção não devem receber horas extras."
  // Se o colaborador está designado como editor de pós-produção ou sua função atribuída for de editor:
  // Ele NUNCA recebe horas extras a menos que tenha ido a campo comprovadamente como motorista com papel de campo.
  if (isAssignedEditor || isOnlyEditorRole) {
    if (!isDriver || !hasFieldRole) {
      return false; // É editor de estúdio/ilha de edição, NÃO recebe horas extras!
    }
  }

  if (isDriver && !isAssignedEditor && !isOnlyEditorRole) return true;

  // 4. Checa se esteve escalado na equipe presencial de campo
  const teamIds = Array.isArray(mission.teamIds) ? mission.teamIds.map(String) : [];
  const inTeamIds = teamIds.includes(memIdStr);
  const inTeamMembers = Array.isArray(mission.teamMembers) &&
    mission.teamMembers.some((tm) => String(tm.id) === memIdStr || String(tm.name || '').trim().toLowerCase() === memNameNorm);
  const inTeamField = Array.isArray(mission.team) &&
    mission.team.some((t) => String(t) === memIdStr || String(t).trim().toLowerCase() === memNameNorm);

  if ((inTeamIds || inTeamMembers || inTeamField || hasFieldRole) && !isAssignedEditor && !isOnlyEditorRole) {
    return true;
  }

  // Se o colaborador atuou apenas como editor de pós-produção (sem ir a campo), NÃO é elegível a horas extras
  return false;
}

/**
 * Calcula os minutos totais, minutos em expediente e minutos fora do expediente (banco de horas)
 * entre dois horários em determinada(s) data(s).
 */
export function calculateMissionOffHours(
  startDateStr,
  departureTime,
  endDateStr,
  returnTime,
  isMultiDay = false,
  options = {}
) {
  let effectiveMultiDay = isMultiDay;
  let effectiveOptions = options;
  if (typeof isMultiDay === 'object' && isMultiDay !== null) {
    effectiveOptions = isMultiDay;
    effectiveMultiDay = Boolean(effectiveOptions.isMultiDay);
  }

  if (!startDateStr || !departureTime || !returnTime) {
    return {
      totalMinutes: 0,
      totalHours: 0,
      inHoursMinutes: 0,
      inHours: 0,
      offHoursMinutes: 0,
      offHours: 0,
      lunchOffHoursMinutes: 0,
      lunchOffHours: 0,
      hasLunchOffHours: false,
      breakMinutes: 0,
      breakHours: 0,
      isOffHours: false,
      offHoursSegments: [],
    };
  }

  const effectiveEndDateStr = (effectiveMultiDay && endDateStr) ? endDateStr : startDateStr;

  const [y1, m1, d1] = String(startDateStr).split('-').map(Number);
  const [h1, min1] = String(departureTime).split(':').map(Number);

  const [y2, m2, d2] = String(effectiveEndDateStr).split('-').map(Number);
  const [h2, min2] = String(returnTime).split(':').map(Number);

  if (!y1 || !m1 || !d1 || isNaN(h1) || isNaN(min1) || !y2 || !m2 || !d2 || isNaN(h2) || isNaN(min2)) {
    return {
      totalMinutes: 0,
      totalHours: 0,
      inHoursMinutes: 0,
      inHours: 0,
      offHoursMinutes: 0,
      offHours: 0,
      lunchOffHoursMinutes: 0,
      lunchOffHours: 0,
      hasLunchOffHours: false,
      breakMinutes: 0,
      breakHours: 0,
      isOffHours: false,
      offHoursSegments: [],
    };
  }

  const start = new Date(y1, m1 - 1, d1, h1, min1, 0, 0);
  let end = new Date(y2, m2 - 1, d2, h2, min2, 0, 0);

  // Se o retorno for menor ou igual à saída na mesma data, significa que atravessou a meia-noite
  if (end <= start && startDateStr === effectiveEndDateStr) {
    end = new Date(y2, m2 - 1, d2 + 1, h2, min2, 0, 0);
  }

  if (end <= start) {
    return {
      totalMinutes: 0,
      totalHours: 0,
      inHoursMinutes: 0,
      inHours: 0,
      offHoursMinutes: 0,
      offHours: 0,
      lunchOffHoursMinutes: 0,
      lunchOffHours: 0,
      hasLunchOffHours: false,
      breakMinutes: 0,
      breakHours: 0,
      isOffHours: false,
      offHoursSegments: [],
    };
  }

  const totalMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
  let offHoursMinutes = 0;
  let inHoursMinutes = 0;
  let lunchOffHoursMinutes = 0;
  let breakMinutes = 0;

  const {
    hasLunchBreak,
    lunchBreakOption,
    treatLunchAsOffHours,
  } = effectiveOptions || {};

  // Determina a política de almoço da missão:
  // - 'no_break' / hasLunchBreak === false: Trabalho contínuo sem pausa! Das 12h às 14h é HORA EXTRA.
  // - 'with_break' / hasLunchBreak === true: Equipe pausa para almoçar. Das 12h às 14h é intervalo não remunerado.
  // - Se não informado explicitamente: por padrão, se cruzar o almoço sem opção definida, mantém comercial para compatibilidade legado
  const isLunchContinuous = lunchBreakOption === 'no_break' || hasLunchBreak === false || treatLunchAsOffHours === true;
  const isLunchWithBreak = lunchBreakOption === 'with_break' || hasLunchBreak === true;

  // Percorre minuto a minuto
  const cur = new Date(start.getTime());
  while (cur < end) {
    const dayOfWeek = cur.getDay(); // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
    const curHour = cur.getHours();
    const curMinute = cur.getMinutes();
    const minuteOfDay = curHour * 60 + curMinute;

    let isWorkHour = false;
    let isLunchTime = false;

    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      // Segunda a Sexta:
      // Manhã: 08:00 (480 min) às 12:00 (720 min)
      // Almoço: 12:00 (720 min) às 14:00 (840 min)
      // Tarde: 14:00 (840 min) às 18:00 (1080 min)
      if (minuteOfDay >= 480 && minuteOfDay < 720) {
        isWorkHour = true;
      } else if (minuteOfDay >= 720 && minuteOfDay < 840) {
        isLunchTime = true;
        if (isLunchContinuous) {
          // Trabalho contínuo sem intervalo de almoço: o período vira HORA EXTRA!
          isWorkHour = false;
        } else if (isLunchWithBreak) {
          // Com intervalo de almoço: pausa não remunerada
          isWorkHour = false;
        } else {
          // Padrão legado se não especificado
          isWorkHour = true;
        }
      } else if (minuteOfDay >= 840 && minuteOfDay < 1080) {
        isWorkHour = true;
      }
    } else if (dayOfWeek === 6) {
      // Sábado: 08:00 (480 min) às 12:00 (720 min)
      if (minuteOfDay >= 480 && minuteOfDay < 720) {
        isWorkHour = true;
      }
    } else {
      // Domingo: 100% fora do expediente
      isWorkHour = false;
    }

    if (isLunchTime && isLunchWithBreak) {
      breakMinutes++;
    } else if (isLunchTime && isLunchContinuous) {
      lunchOffHoursMinutes++;
      offHoursMinutes++;
    } else if (isWorkHour) {
      inHoursMinutes++;
    } else {
      offHoursMinutes++;
    }

    cur.setMinutes(cur.getMinutes() + 1);
  }

  const offHours = Number((offHoursMinutes / 60).toFixed(1));
  const lunchOffHours = Number((lunchOffHoursMinutes / 60).toFixed(1));
  const inHours = Number((inHoursMinutes / 60).toFixed(1));
  const breakHours = Number((breakMinutes / 60).toFixed(1));
  const totalHours = Number((totalMinutes / 60).toFixed(1));

  const offHoursSegments = [];
  if (lunchOffHoursMinutes > 0) {
    offHoursSegments.push({
      label: 'Intervalo de Almoço Trabalhado (12h às 14h)',
      hours: lunchOffHours,
      minutes: lunchOffHoursMinutes,
      type: 'lunch',
    });
  }
  const standardOffMinutes = offHoursMinutes - lunchOffHoursMinutes;
  if (standardOffMinutes > 0) {
    offHoursSegments.push({
      label: 'Fora do Expediente Comercial',
      hours: Number((standardOffMinutes / 60).toFixed(1)),
      minutes: standardOffMinutes,
      type: 'standard',
    });
  }

  return {
    totalMinutes,
    totalHours,
    inHoursMinutes,
    inHours,
    offHoursMinutes,
    offHours,
    lunchOffHoursMinutes,
    lunchOffHours,
    hasLunchOffHours: lunchOffHoursMinutes > 0,
    breakMinutes,
    breakHours,
    isOffHours: offHoursMinutes > 0,
    offHoursSegments,
    lunchBreakOption: isLunchContinuous ? 'no_break' : (isLunchWithBreak ? 'with_break' : 'default'),
  };
}

/**
 * Retorna uma mensagem amigável explicando o detalhamento das horas fora do expediente
 */
export function getOffHoursWarningText(offHoursResult) {
  if (!offHoursResult || !offHoursResult.isOffHours) return null;

  const { offHours, lunchOffHours } = offHoursResult;
  let lunchDetail = '';
  if (lunchOffHours && lunchOffHours > 0) {
    lunchDetail = ` (sendo ${lunchOffHours}h pelo intervalo de almoço das 12h às 14h trabalhado de forma contínua)`;
  }
  return `Atenção: Esta missão possui ${offHours}h fora do horário de expediente comercial${lunchDetail}. As ${offHours} horas excedentes serão acrescidas automaticamente no banco de horas do colaborador com seus respectivos valores.`;
}

/**
 * Formata data YYYY-MM-DD para DD/MM/AAAA
 */
function formatSimpleDateBR(dateStr) {
  if (!dateStr) return '';
  const parts = String(dateStr).split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

/**
 * Verifica se uma determinada data e horário estão fora do expediente comercial regular.
 * Expediente regular:
 * - Segunda a Sexta: 08:00 às 18:00
 * - Sábado: 08:00 às 12:00
 * - Domingo: Fora de expediente o dia todo
 * 
 * @param {Date|string} dateInput - Objeto Date ou string YYYY-MM-DD
 * @param {string} timeStr - Horário HH:mm (opcional se dateInput for Date)
 * @returns {boolean} true se estiver fora do expediente
 */
export function isOffHoursTime(dateInput, timeStr = null) {
  let dateObj;
  if (dateInput instanceof Date) {
    dateObj = dateInput;
  } else if (typeof dateInput === 'string' && timeStr) {
    const [y, m, d] = dateInput.split('-').map(Number);
    const [h, min] = timeStr.split(':').map(Number);
    dateObj = new Date(y, m - 1, d, h || 0, min || 0, 0, 0);
  } else if (typeof dateInput === 'string' && dateInput.includes('T')) {
    dateObj = new Date(dateInput);
  } else {
    return false;
  }

  const dayOfWeek = dateObj.getDay(); // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
  const minuteOfDay = dateObj.getHours() * 60 + dateObj.getMinutes();

  if (dayOfWeek >= 1 && dayOfWeek <= 5) {
    // Segunda a Sexta: 08:00 (480 min) às 18:00 (1080 min)
    return minuteOfDay < 480 || minuteOfDay > 1080;
  } else if (dayOfWeek === 6) {
    // Sábado: 08:00 (480 min) às 12:00 (720 min)
    return minuteOfDay < 480 || minuteOfDay > 720;
  } else {
    // Domingo: 100% fora do expediente
    return true;
  }
}

/**
 * Avalia uma extensão de horário de uma missão (ex: +30min, +1h, +2h).
 * Informa se o novo horário permanece integralmente no expediente ou se gera horas extras.
 * 
 * @param {string} missionDate - YYYY-MM-DD
 * @param {string} currentEndTimeStr - HH:mm
 * @param {number} extensionHours - Horas adicionais (ex: 0.5, 1, 2)
 * @returns {object} Detalhes da extensão
 */
export function evaluateMissionExtension(missionDate, currentEndTimeStr, extensionHours = 1.0) {
  if (!currentEndTimeStr) {
    return {
      isFullInHours: true,
      isOffHours: false,
      newEndTimeStr: '--:--',
      offHoursDeltaMinutes: 0,
    };
  }

  const [retH, retM] = String(currentEndTimeStr).split(':').map(Number);
  const dateParts = String(missionDate || new Date().toISOString().slice(0, 10)).split('-').map(Number);
  const baseEnd = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], retH || 0, retM || 0, 0, 0);

  const extensionMs = Math.round(Number(extensionHours || 1.0) * 60) * 60 * 1000;
  const extendedEnd = new Date(baseEnd.getTime() + extensionMs);

  const newEndH = String(extendedEnd.getHours()).padStart(2, '0');
  const newEndMin = String(extendedEnd.getMinutes()).padStart(2, '0');
  const newEndTimeStr = `${newEndH}:${newEndMin}`;

  const currentIsOffHours = isOffHoursTime(baseEnd);
  const extendedIsOffHours = isOffHoursTime(extendedEnd);

  // Calcula minuto a minuto o trecho estendido
  let inHoursExtensionMinutes = 0;
  let offHoursExtensionMinutes = 0;
  const cur = new Date(baseEnd.getTime());
  while (cur < extendedEnd) {
    if (isOffHoursTime(cur)) {
      offHoursExtensionMinutes++;
    } else {
      inHoursExtensionMinutes++;
    }
    cur.setMinutes(cur.getMinutes() + 1);
  }

  const isFullInHours = offHoursExtensionMinutes === 0 && !currentIsOffHours;
  const isOffHours = offHoursExtensionMinutes > 0 || currentIsOffHours;

  return {
    isFullInHours,
    isOffHours,
    currentIsOffHours,
    extendedIsOffHours,
    newEndTimeStr,
    inHoursExtensionMinutes,
    offHoursExtensionMinutes,
    offHoursExtensionHours: Number((offHoursExtensionMinutes / 60).toFixed(1)),
  };
}

/**
 * Avalia se um colaborador declarou indisponibilidade para horas extras
 * e se a missão atual conflita com esse bloqueio.
 */
export function checkMemberExtraHoursAvailability(
  member,
  missionDate,
  departureTime,
  returnTime,
  isMultiDay = false,
  endDate = null
) {
  if (!member || !member.extraHoursAvailability) {
    return { isUnavailable: false };
  }

  const {
    status,
    scope = 'always_offhours',
    startDate,
    startTime = '18:00',
    endDate: unavailEndDate,
    endTime = '23:59',
    reason = '',
    presetReason = '',
  } = member.extraHoursAvailability;

  // Se o colaborador está disponível, sem bloqueio
  if (status !== 'unavailable') {
    return { isUnavailable: false };
  }

  // Calcula se a missão proposta tem horas fora do expediente
  const offHoursData = calculateMissionOffHours(
    missionDate,
    departureTime,
    endDate,
    returnTime,
    isMultiDay
  );

  // Se a missão ocorre 100% no horário comercial normal, a indisponibilidade de hora extra não afeta
  if (!offHoursData.isOffHours) {
    return { isUnavailable: false };
  }

  const fullReason = reason || presetReason || 'Não disponível para horas extras fora do expediente';

  // 1. Bloqueio Completo: Sempre indisponível para qualquer hora extra fora do expediente
  if (scope === 'always_offhours') {
    return {
      isUnavailable: true,
      scope: 'always_offhours',
      reason: fullReason,
      badgeText: '🚫 Indisponível p/ Horas Extras',
      offHours: offHoursData.offHours,
      periodLabel: 'Todo o período fora do expediente',
    };
  }

  // 2. Bloqueio em Período Específico (Data e Horário)
  if (scope === 'specific_period' && startDate && startTime) {
    try {
      const effEndDate = unavailEndDate || startDate;
      const effEndTime = endTime || '23:59';

      const [uy1, um1, ud1] = startDate.split('-').map(Number);
      const [uh1, umin1] = startTime.split(':').map(Number);
      const unavailStart = new Date(uy1, um1 - 1, ud1, uh1, umin1, 0, 0);

      const [uy2, um2, ud2] = effEndDate.split('-').map(Number);
      const [uh2, umin2] = effEndTime.split(':').map(Number);
      const unavailEnd = new Date(uy2, um2 - 1, ud2, uh2, umin2, 0, 0);

      if (missionDate && departureTime && returnTime) {
        const [my1, mm1, md1] = missionDate.split('-').map(Number);
        const [mh1, mmin1] = departureTime.split(':').map(Number);
        const missionStart = new Date(my1, mm1 - 1, md1, mh1, mmin1, 0, 0);

        const effMissionEndDate = (isMultiDay && endDate) ? endDate : missionDate;
        const [my2, mm2, md2] = effMissionEndDate.split('-').map(Number);
        const [mh2, mmin2] = returnTime.split(':').map(Number);
        let missionEnd = new Date(my2, mm2 - 1, md2, mh2, mmin2, 0, 0);
        if (missionEnd <= missionStart && missionDate === effMissionEndDate) {
          missionEnd = new Date(my2, mm2 - 1, md2 + 1, mh2, mmin2, 0, 0);
        }

        // Checa se os intervalos se sobrepõem
        const overlaps = (missionStart < unavailEnd) && (missionEnd > unavailStart);

        if (overlaps) {
          const periodLabel = `${formatSimpleDateBR(startDate)} ${startTime} até ${formatSimpleDateBR(effEndDate)} ${effEndTime}`;
          return {
            isUnavailable: true,
            scope: 'specific_period',
            reason: fullReason,
            periodLabel,
            badgeText: `🚫 Indisponível (${startTime} - ${effEndTime})`,
            offHours: offHoursData.offHours,
          };
        }
      }
    } catch (e) {
      console.warn('Erro ao checar intervalo de indisponibilidade:', e);
    }
  }

  return { isUnavailable: false };
}

/**
 * Calcula a remuneração de Hora Extra segundo as regras oficiais da MegaFilmes:
 * - Ao ser chamado fora do expediente, o colaborador fecha automaticamente um pacote base de até 4 horas (R$ 200,00).
 * - A partir da 4ª hora (5ª hora em diante), cada hora adicional é somada hora a hora pelo valor da taxa horária do colaborador (padrão R$ 50/h).
 * 
 * Exemplos práticos:
 * - Ficou 1h extra: Pacote de chamada (até 4h) = R$ 200,00
 * REGRA OFICIAL MEGAFILMES:
 * Remuneração direta e proporcional por hora extra trabalhada: horas × taxa individual.
 * Sem combo obrigatório de 4 horas.
 *
 * @param {number} hours - Quantidade de horas extras (fora do expediente + aprovadas)
 * @param {number} hourlyRate - Taxa da hora extra individual (padrão 50)
 * @returns {object} { amount, hoursCount, formulaText }
 */
export function calculateExtraHoursRemuneration(hours, hourlyRate = 50) {
  const h = Number(hours) || 0;
  if (h <= 0) {
    return {
      amount: 0,
      hoursCount: 0,
      formulaText: 'Sem horas extras',
    };
  }

  const rate = Number(hourlyRate > 0 ? hourlyRate : 50);
  const amount = Number((h * rate).toFixed(2));

  return {
    amount,
    hoursCount: h,
    formulaText: `${h}h extra(s) × R$ ${rate.toFixed(2).replace('.', ',')}/h = R$ ${amount.toFixed(2).replace('.', ',')}`,
  };
}

/**
 * Classifica o turno e regime de horário da missão:
 * - 'in_hours': Dentro do Expediente Comercial · Diurna
 * - 'off_day': Fora do Expediente · Diurna (ex: sáb tarde, dom diurno, antes das 8h)
 * - 'off_night': Fora do Expediente · Noturna (ex: após 18h ou antes das 6h)
 * - 'off_mixed': Fora do Expediente · Diurna e Noturna
 * - 'unknown': Sem horários definidos
 */
export function classifyMissionShift(missionOrData) {
  if (!missionOrData) {
    return {
      kind: 'unknown',
      label: 'Horário Indefinido',
      short: 'Indefinido',
      icon: '⏱️',
      detail: 'Sem horários definidos para apuração',
      partial: false,
      inHoursMinutes: 0,
      offDayMinutes: 0,
      offNightMinutes: 0,
      totalMinutes: 0,
    };
  }

  const { startTime, endTime } = resolveEventTimes(missionOrData);
  const startDateStr = missionOrData.date;
  const endDateStr = (missionOrData.isMultiDay && missionOrData.endDate) ? missionOrData.endDate : startDateStr;

  if (!startDateStr || !startTime || !endTime) {
    return {
      kind: 'unknown',
      label: 'Horário Indefinido',
      short: 'Indefinido',
      icon: '⏱️',
      detail: 'Sem horários suficientes para apuração',
      partial: false,
      inHoursMinutes: 0,
      offDayMinutes: 0,
      offNightMinutes: 0,
      totalMinutes: 0,
    };
  }

  const [y1, m1, d1] = String(startDateStr).split('-').map(Number);
  const [h1, min1] = String(startTime).split(':').map(Number);
  const [y2, m2, d2] = String(endDateStr).split('-').map(Number);
  const [h2, min2] = String(endTime).split(':').map(Number);

  if (!y1 || !m1 || !d1 || isNaN(h1) || isNaN(min1) || !y2 || !m2 || !d2 || isNaN(h2) || isNaN(min2)) {
    return {
      kind: 'unknown',
      label: 'Horário Inválido',
      short: 'Inválido',
      icon: '⚠️',
      detail: 'Formato de data ou hora inválido',
      partial: false,
      inHoursMinutes: 0,
      offDayMinutes: 0,
      offNightMinutes: 0,
      totalMinutes: 0,
    };
  }

  const start = new Date(y1, m1 - 1, d1, h1, min1, 0, 0);
  let end = new Date(y2, m2 - 1, d2, h2, min2, 0, 0);

  if (end <= start && startDateStr === endDateStr) {
    end = new Date(y2, m2 - 1, d2 + 1, h2, min2, 0, 0);
  }

  if (end <= start) {
    return {
      kind: 'unknown',
      label: 'Horário Incoerente',
      short: 'Incoerente',
      icon: '⚠️',
      detail: 'Horário final anterior ao inicial',
      partial: false,
      inHoursMinutes: 0,
      offDayMinutes: 0,
      offNightMinutes: 0,
      totalMinutes: 0,
    };
  }

  let inHoursMin = 0;
  let offDayMin = 0;
  let offNightMin = 0;
  let lunchMin = 0;

  const codeStr = String(missionOrData.code || '');
  const descStr = String(missionOrData.description || '').toLowerCase();
  const isContinuousLive = codeStr.includes('202611242') || (descStr.includes('tjrr') && descStr.includes('sessoes'));

  let effectiveLunchOption = missionOrData.lunchBreakOption;
  let effectiveHasLunchBreak = missionOrData.hasLunchBreak;
  if (effectiveLunchOption === undefined && effectiveHasLunchBreak === undefined && isContinuousLive) {
    effectiveLunchOption = 'no_break';
    effectiveHasLunchBreak = false;
  }
  const isLunchContinuous = effectiveLunchOption === 'no_break' || effectiveHasLunchBreak === false;
  const isLunchWithBreak = effectiveLunchOption === 'with_break' || effectiveHasLunchBreak === true;

  const cur = new Date(start.getTime());
  while (cur < end) {
    const dayOfWeek = cur.getDay(); // 0 = Domingo, 1 = Segunda ... 6 = Sábado
    const curHour = cur.getHours();
    const curMinute = cur.getMinutes();
    const minuteOfDay = curHour * 60 + curMinute;

    let isWorkHour = false;
    let isLunchTime = false;

    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      // Seg a Sex: 08:00 às 12:00 e 14:00 às 18:00
      if (minuteOfDay >= 480 && minuteOfDay < 720) {
        isWorkHour = true;
      } else if (minuteOfDay >= 720 && minuteOfDay < 840) {
        isLunchTime = true;
        if (isLunchContinuous) {
          isWorkHour = false;
        } else if (isLunchWithBreak) {
          isWorkHour = false;
        } else {
          isWorkHour = true;
        }
      } else if (minuteOfDay >= 840 && minuteOfDay < 1080) {
        isWorkHour = true;
      }
    } else if (dayOfWeek === 6) {
      // Sábado: 08:00 às 12:00
      if (minuteOfDay >= 480 && minuteOfDay < 720) {
        isWorkHour = true;
      }
    } else {
      // Domingo: 100% fora
      isWorkHour = false;
    }

    if (isLunchTime && isLunchWithBreak) {
      // Pausa de almoço (intervalo não trabalhado)
    } else if (isLunchTime && isLunchContinuous) {
      lunchMin++;
      offDayMin++;
    } else if (isWorkHour) {
      inHoursMin++;
    } else {
      // Fora do expediente comercial: diurno (06:00 às 18:00) vs noturno (18:00 às 06:00)
      if (minuteOfDay >= 360 && minuteOfDay < 1080) {
        offDayMin++;
      } else {
        offNightMin++;
      }
    }

    cur.setMinutes(cur.getMinutes() + 1);
  }

  const totalMin = inHoursMin + offDayMin + offNightMin;
  const offTotalMin = offDayMin + offNightMin;
  const partial = inHoursMin > 0 && offTotalMin > 0;

  const lunchOffH = Number((lunchMin / 60).toFixed(1));
  const hasLunchExtra = lunchMin > 0;

  if (offTotalMin === 0) {
    return {
      kind: 'in_hours',
      label: 'Dentro do Expediente · Diurna',
      short: 'Expediente (Diurna)',
      icon: '☀️',
      detail: 'Horário 100% dentro do expediente comercial da produtora',
      partial: false,
      inHoursMinutes: inHoursMin,
      offDayMinutes: offDayMin,
      offNightMinutes: offNightMin,
      lunchMinutes: lunchMin,
      lunchOffHours: lunchOffH,
      hasLunchExtra,
      totalMinutes: totalMin,
    };
  }

  if (offDayMin > 0 && offNightMin === 0) {
    const lunchText = hasLunchExtra ? ` (inclui ${lunchOffH}h de almoço trabalhado)` : '';
    return {
      kind: 'off_day',
      label: partial ? `Mista · Expediente e Fora (Diurna)${lunchText}` : `Fora do Expediente · Diurna${lunchText}`,
      short: partial ? (hasLunchExtra ? 'Expediente + Almoço Extra' : 'Expediente + Fora Diurna') : 'Fora Exp. (Diurna)',
      icon: hasLunchExtra ? '🍱' : '🌤️',
      detail: partial
        ? `Possui ${Math.round(inHoursMin / 60)}h em expediente e ${(offDayMin / 60).toFixed(1)}h fora do expediente em período diurno${lunchText}`
        : `Horário realizado fora do expediente comercial em período diurno${lunchText}`,
      partial,
      inHoursMinutes: inHoursMin,
      offDayMinutes: offDayMin,
      offNightMinutes: offNightMin,
      lunchMinutes: lunchMin,
      lunchOffHours: lunchOffH,
      hasLunchExtra,
      totalMinutes: totalMin,
    };
  }

  if (offNightMin > 0 && offDayMin === 0) {
    return {
      kind: 'off_night',
      label: partial ? 'Mista · Expediente e Noturna' : 'Fora do Expediente · Noturna',
      short: partial ? 'Expediente + Noturna' : 'Fora Exp. (Noturna)',
      icon: '🌙',
      detail: partial
        ? `Possui ${Math.round(inHoursMin / 60)}h em expediente e ${(offNightMin / 60).toFixed(1)}h fora do expediente em período noturno`
        : 'Horário realizado fora do expediente comercial em período noturno (após 18h ou madrugada)',
      partial,
      inHoursMinutes: inHoursMin,
      offDayMinutes: offDayMin,
      offNightMinutes: offNightMin,
      lunchMinutes: lunchMin,
      lunchOffHours: lunchOffH,
      hasLunchExtra,
      totalMinutes: totalMin,
    };
  }

  const lunchText = hasLunchExtra ? ` (inclui ${lunchOffH}h de almoço trabalhado)` : '';
  return {
    kind: 'off_mixed',
    label: partial ? `Mista · Expediente, Diurna e Noturna${lunchText}` : `Fora do Expediente · Diurna e Noturna${lunchText}`,
    short: hasLunchExtra ? 'Fora Exp. (Almoço + Noturna)' : 'Fora Exp. (Mista)',
    icon: '🌗',
    detail: `Horário fora do expediente abrangendo períodos diurnos (${(offDayMin / 60).toFixed(1)}h) e noturnos (${(offNightMin / 60).toFixed(1)}h)${lunchText}`,
    partial,
    inHoursMinutes: inHoursMin,
    offDayMinutes: offDayMin,
    offNightMinutes: offNightMin,
    lunchMinutes: lunchMin,
    lunchOffHours: lunchOffH,
    hasLunchExtra,
    totalMinutes: totalMin,
  };
}


