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
 * Calcula os minutos totais, minutos em expediente e minutos fora do expediente (banco de horas)
 * entre o horário de partida e retorno de uma missão.
 * 
 * @param {string} startDateStr - Data inicial no formato YYYY-MM-DD
 * @param {string} departureTime - Horário de saída no formato HH:mm
 * @param {string} endDateStr - Data final no formato YYYY-MM-DD (se for missão de múltiplos dias)
 * @param {string} returnTime - Horário de retorno no formato HH:mm
 * @param {boolean} isMultiDay - Se é missão de múltiplos dias
 * @returns {object} Resumo com totalMinutes, inHoursMinutes, offHoursMinutes, offHours, inHours, isOffHours
 */
export function calculateMissionOffHours(
  startDateStr,
  departureTime,
  endDateStr,
  returnTime,
  isMultiDay = false
) {
  if (!startDateStr || !departureTime || !returnTime) {
    return {
      totalMinutes: 0,
      totalHours: 0,
      inHoursMinutes: 0,
      inHours: 0,
      offHoursMinutes: 0,
      offHours: 0,
      isOffHours: false,
      offHoursSegments: [],
    };
  }

  const effectiveEndDateStr = (isMultiDay && endDateStr) ? endDateStr : startDateStr;

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
      isOffHours: false,
      offHoursSegments: [],
    };
  }

  const totalMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
  let offHoursMinutes = 0;
  let inHoursMinutes = 0;

  // Percorre minuto a minuto
  const cur = new Date(start.getTime());
  while (cur < end) {
    const dayOfWeek = cur.getDay(); // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
    const curHour = cur.getHours();
    const curMinute = cur.getMinutes();
    const minuteOfDay = curHour * 60 + curMinute;

    let isWorkHour = false;

    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      // Segunda a Sexta: 08:00 (480 min) às 18:00 (1080 min)
      if (minuteOfDay >= 480 && minuteOfDay < 1080) {
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

    if (isWorkHour) {
      inHoursMinutes++;
    } else {
      offHoursMinutes++;
    }

    cur.setMinutes(cur.getMinutes() + 1);
  }

  const offHours = Number((offHoursMinutes / 60).toFixed(1));
  const inHours = Number((inHoursMinutes / 60).toFixed(1));
  const totalHours = Number((totalMinutes / 60).toFixed(1));

  return {
    totalMinutes,
    totalHours,
    inHoursMinutes,
    inHours,
    offHoursMinutes,
    offHours,
    isOffHours: offHoursMinutes > 0,
  };
}

/**
 * Retorna uma mensagem amigável explicando o detalhamento das horas fora do expediente
 */
export function getOffHoursWarningText(offHoursResult) {
  if (!offHoursResult || !offHoursResult.isOffHours) return null;

  const { offHours, inHours, totalHours } = offHoursResult;
  return `Atenção: Esta missão possui ${offHours}h fora do horário de expediente comercial (Seg a Sex após 18h, Sáb após 12h ou Dom o dia todo). As ${offHours} horas excedentes serão acrescidas automaticamente no banco de horas do colaborador com seus respectivos valores.`;
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


