const assert = require('assert');

// Simular as funções exportadas por geo.js
function getMultiDayProgress(startDateStr, endDateStr, referenceDate = new Date()) {
  if (!startDateStr) return null;
  const effectiveEndStr = endDateStr || startDateStr;

  const startYMD = String(startDateStr).slice(0, 10);
  const endYMD = String(effectiveEndStr).slice(0, 10);

  const [sYear, sMonth, sDay] = startYMD.split('-').map(Number);
  const [eYear, eMonth, eDay] = endYMD.split('-').map(Number);

  if (isNaN(sYear) || isNaN(eYear)) return null;

  const dStart = new Date(Date.UTC(sYear, sMonth - 1, sDay));
  const dEnd = new Date(Date.UTC(eYear, eMonth - 1, eDay));

  const msPerDay = 24 * 60 * 60 * 1000;
  const totalDays = Math.max(1, Math.round((dEnd.getTime() - dStart.getTime()) / msPerDay) + 1);

  let refYMD;
  if (typeof referenceDate === 'string') {
    refYMD = referenceDate.slice(0, 10);
  } else if (referenceDate instanceof Date) {
    const rY = referenceDate.getFullYear();
    const rM = String(referenceDate.getMonth() + 1).padStart(2, '0');
    const rD = String(referenceDate.getDate()).padStart(2, '0');
    refYMD = `${rY}-${rM}-${rD}`;
  } else {
    refYMD = startYMD;
  }

  const [rYear, rMonth, rDay] = refYMD.split('-').map(Number);
  const dRef = new Date(Date.UTC(rYear, rMonth - 1, rDay));

  const diffDays = Math.round((dRef.getTime() - dStart.getTime()) / msPerDay);
  const currentDayNumber = diffDays + 1;

  const isMultiDay = totalDays > 1 || startYMD !== endYMD;

  let status = 'in_progress';
  let badgeText = '';

  if (currentDayNumber < 1) {
    status = 'upcoming';
  } else if (currentDayNumber > totalDays) {
    status = 'completed';
  } else {
    status = 'in_progress';
    badgeText = `${currentDayNumber}º Dia de Missão`;
  }

  return {
    isMultiDay,
    totalDays,
    currentDayNumber: Math.max(1, Math.min(totalDays, currentDayNumber)),
    status,
    badgeText
  };
}

function getMultiDayRestStatus(mission, now = new Date()) {
  if (!mission) {
    return { isMultiDay: false, inPeriod: false, isResting: false, isActivity: false, badgeText: null, icon: null };
  }

  const isMultiDay = Boolean(
    mission.isMultiDay ||
    (mission.endDate && mission.endDate !== mission.date)
  );

  if (!isMultiDay) {
    return {
      isMultiDay: false,
      inPeriod: false,
      isResting: false,
      isActivity: false,
      badgeText: null,
      icon: null
    };
  }

  const startDateStr = mission.date;
  const endDateStr = mission.endDate || mission.date;
  const progress = getMultiDayProgress(startDateStr, endDateStr, now);

  const statusLower = (mission.missionStatus || '').toLowerCase();
  const isCanceled = statusLower === 'cancelada';
  const isFinalizada = statusLower === 'finalizada' || statusLower === 'finalizado' || statusLower === 'concluída';

  const inPeriod = Boolean(progress && progress.status === 'in_progress');

  if (!inPeriod || isCanceled || isFinalizada) {
    return {
      isMultiDay: true,
      inPeriod,
      isResting: false,
      isActivity: false,
      progress,
      badgeText: null,
      icon: null
    };
  }

  const refDate = now instanceof Date ? now : new Date(now);
  const rY = refDate.getFullYear();
  const rM = String(refDate.getMonth() + 1).padStart(2, '0');
  const rD = String(refDate.getDate()).padStart(2, '0');
  const todayYMD = `${rY}-${rM}-${rD}`;

  let startTime = mission.dailyEventStartTime || mission.eventStartTime || '08:00';
  let endTime = mission.dailyEventEndTime || mission.eventEndTime || '18:00';

  let dailyScheds = mission.dailyEventSchedules;
  if (typeof dailyScheds === 'string') {
    try {
      dailyScheds = JSON.parse(dailyScheds);
    } catch {
      dailyScheds = null;
    }
  }

  if (Array.isArray(dailyScheds) && dailyScheds.length > 0) {
    const todayItem = dailyScheds.find(
      (s) => s.date === todayYMD || Number(s.dayNumber) === Number(progress?.currentDayNumber)
    );
    if (todayItem) {
      if (todayItem.startTime) startTime = todayItem.startTime;
      if (todayItem.endTime) endTime = todayItem.endTime;
    }
  }

  const nowMinutes = refDate.getHours() * 60 + refDate.getMinutes();
  const [sH, sM] = String(startTime).split(':').map(Number);
  const startM = (isNaN(sH) ? 8 : sH) * 60 + (isNaN(sM) ? 0 : sM);
  const [eH, eM] = String(endTime).split(':').map(Number);
  const endM = (isNaN(eH) ? 18 : eH) * 60 + (isNaN(eM) ? 0 : eM);

  let isActivity = false;
  let isResting = false;

  if (startM < endM) {
    if (nowMinutes >= startM && nowMinutes < endM) {
      isActivity = true;
      isResting = false;
    } else {
      isActivity = false;
      isResting = true;
    }
  } else {
    if (nowMinutes >= startM || nowMinutes < endM) {
      isActivity = true;
      isResting = false;
    } else {
      isActivity = false;
      isResting = true;
    }
  }

  const badgeText = isResting ? 'Em Descanso' : 'Em Atividade';
  const shortBadge = isResting ? 'Descanso' : 'Atividade';
  const icon = isResting ? '🛌' : '⚡';
  const description = isResting
    ? `Equipe em descanso (${endTime} às ${startTime}). Retorna às atividades às ${startTime}.`
    : `Equipe em atividade no evento (${startTime} às ${endTime}).`;

  return {
    isMultiDay: true,
    inPeriod: true,
    isResting,
    isActivity,
    badgeText,
    shortBadge,
    icon,
    statusClass: isResting ? 'resting' : 'activity',
    startTime,
    endTime,
    currentDayNumber: progress ? progress.currentDayNumber : 1,
    totalDays: progress ? progress.totalDays : 1,
    progress,
    description
  };
}

console.log('--- Testando getMultiDayRestStatus ---');

const testMissionRorainopolis = {
  id: 'mis-202611251',
  code: '202611251',
  description: 'VIAGEM TJ RORAINOPOLIS',
  date: '2026-11-25',
  endDate: '2026-11-27',
  isMultiDay: true,
  dailyEventStartTime: '08:00',
  dailyEventEndTime: '18:00',
  missionStatus: 'Em Execução'
};

// Teste 1: Durante o horário do evento (ex: 26/11/2026 às 14:30)
const dateAt1430 = new Date('2026-11-26T14:30:00');
const res1 = getMultiDayRestStatus(testMissionRorainopolis, dateAt1430);
console.log('Teste 1 (14:30):', res1.badgeText, res1.icon);
assert.strictEqual(res1.isMultiDay, true);
assert.strictEqual(res1.inPeriod, true);
assert.strictEqual(res1.isActivity, true);
assert.strictEqual(res1.isResting, false);
assert.strictEqual(res1.badgeText, 'Em Atividade');
assert.strictEqual(res1.icon, '⚡');

// Teste 2: À noite fora do horário do evento (ex: 26/11/2026 às 18:35)
const dateAt1835 = new Date('2026-11-26T18:35:00');
const res2 = getMultiDayRestStatus(testMissionRorainopolis, dateAt1835);
console.log('Teste 2 (18:35):', res2.badgeText, res2.icon);
assert.strictEqual(res2.isMultiDay, true);
assert.strictEqual(res2.inPeriod, true);
assert.strictEqual(res2.isActivity, false);
assert.strictEqual(res2.isResting, true);
assert.strictEqual(res2.badgeText, 'Em Descanso');
assert.strictEqual(res2.icon, '🛌');

// Teste 3: De madrugada antes do início das atividades (ex: 27/11/2026 às 06:15)
const dateAt0615 = new Date('2026-11-27T06:15:00');
const res3 = getMultiDayRestStatus(testMissionRorainopolis, dateAt0615);
console.log('Teste 3 (06:15):', res3.badgeText, res3.icon);
assert.strictEqual(res3.isResting, true);
assert.strictEqual(res3.badgeText, 'Em Descanso');
assert.strictEqual(res3.icon, '🛌');

// Teste 4: Missão com cronograma personalizado por dia (ex: dia 3 encerra às 16:00)
const testCustomSched = {
  ...testMissionRorainopolis,
  dailyEventSchedules: [
    { date: '2026-11-27', dayNumber: 3, startTime: '08:00', endTime: '16:00' }
  ]
};
const dateAt1630Day3 = new Date('2026-11-27T16:30:00');
const res4 = getMultiDayRestStatus(testCustomSched, dateAt1630Day3);
console.log('Teste 4 (Dia 3 às 16:30 com fim às 16:00):', res4.badgeText, res4.icon);
assert.strictEqual(res4.isResting, true);
assert.strictEqual(res4.badgeText, 'Em Descanso');

// Teste 5: Missão de 1 dia simples (não deve ser tratada como descanso de multi-dia)
const testSingleDay = {
  id: 'mis-1',
  date: '2026-11-26',
  isMultiDay: false,
  missionStatus: 'Em Execução'
};
const res5 = getMultiDayRestStatus(testSingleDay, dateAt1835);
console.log('Teste 5 (1 dia): isMultiDay =', res5.isMultiDay, 'badgeText =', res5.badgeText);
assert.strictEqual(res5.isMultiDay, false);
assert.strictEqual(res5.badgeText, null);

console.log('✅ TODOS OS TESTES PASSARAM COM SUCESSO!');
