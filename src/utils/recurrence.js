// ==============================================================================
// GestorMF - Utilitário de Missões Recorrentes (Agendamento Automático)
// ==============================================================================

export const RECURRENCE_DAYS = [
  { dow: 1, short: 'Seg', label: 'Segunda-feira' },
  { dow: 2, short: 'Ter', label: 'Terça-feira' },
  { dow: 3, short: 'Qua', label: 'Quarta-feira' },
  { dow: 4, short: 'Qui', label: 'Quinta-feira' },
  { dow: 5, short: 'Sex', label: 'Sexta-feira' },
  { dow: 6, short: 'Sáb', label: 'Sábado' },
  { dow: 0, short: 'Dom', label: 'Domingo' },
];

/**
 * Retorna o dia da semana (0=Dom, 1=Seg, ..., 6=Sáb) de uma data YYYY-MM-DD
 */
export function getDayOfWeekFromDate(dateStr) {
  if (!dateStr) return 1;
  const parts = String(dateStr).split('-').map(Number);
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return 1;
  }
  const dateObj = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
  return dateObj.getDay();
}

/**
 * Adiciona N semanas a uma data YYYY-MM-DD
 */
export function addWeeksToDate(dateStr, weeks = 4) {
  if (!dateStr) return '';
  const parts = String(dateStr).split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
  d.setDate(d.getDate() + weeks * 7);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Formata data no formato DD/MM (Dia) para preview rápido
 */
export function formatOccurrencePreview(dateStr) {
  if (!dateStr) return '';
  const parts = String(dateStr).split('-');
  if (parts.length < 3) return dateStr;
  const dow = getDayOfWeekFromDate(dateStr);
  const dayObj = RECURRENCE_DAYS.find((d) => d.dow === dow);
  const shortDow = dayObj ? dayObj.short : '';
  return `${parts[2]}/${parts[1]}${shortDow ? ` (${shortDow})` : ''}`;
}

/**
 * Gera lista de datas recorrentes entre a data inicial e final respeitando os dias selecionados
 * @param {string} startDateStr Data inicial YYYY-MM-DD
 * @param {number[]} selectedDows Array com os dias da semana selecionados [1, 2, ...]
 * @param {string} endDateStr Data limite YYYY-MM-DD
 * @param {number} maxCount Limite máximo de ocorrências de segurança (padrão 52)
 */
export function generateRecurrenceDates(startDateStr, selectedDows, endDateStr, maxCount = 52) {
  if (!startDateStr || !endDateStr || !Array.isArray(selectedDows) || selectedDows.length === 0) {
    return [];
  }

  const [sy, sm, sd] = startDateStr.split('-').map(Number);
  const [ey, em, ed] = endDateStr.split('-').map(Number);
  if (!sy || !sm || !sd || !ey || !em || !ed) return [];

  let cur = new Date(sy, sm - 1, sd, 12, 0, 0);
  const end = new Date(ey, em - 1, ed, 12, 0, 0);

  if (cur > end) return [];

  const dates = [];

  while (cur <= end && dates.length < maxCount) {
    const dow = cur.getDay();
    if (selectedDows.includes(dow)) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const d = String(cur.getDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${d}`);
    }
    cur.setDate(cur.getDate() + 1);
  }

  return dates;
}

/**
 * Retorna string amigável dos dias da semana (ex: "Ter, Qui")
 */
export function formatDaysDisplay(selectedDows) {
  if (!Array.isArray(selectedDows) || selectedDows.length === 0) return '';
  // Ordena a partir de Segunda (1) até Domingo (0)
  const order = [1, 2, 3, 4, 5, 6, 0];
  const sorted = [...selectedDows].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return sorted
    .map((dow) => {
      const d = RECURRENCE_DAYS.find((item) => item.dow === dow);
      return d ? d.short : '';
    })
    .filter(Boolean)
    .join(', ');
}

