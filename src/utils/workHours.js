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
