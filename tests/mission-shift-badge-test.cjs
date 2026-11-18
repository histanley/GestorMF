const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'utils', 'workHours.js'), 'utf8');
const board = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'ServiceBoard.jsx'), 'utf8');

assert(src.includes('export function classifyMissionShift'), 'workHours.js deve exportar classifyMissionShift');
assert(board.includes('function ShiftBadge') && (board.match(/<ShiftBadge/g) || []).length >= 4,
  'ServiceBoard.jsx deve exibir o selo de turno na tabela, impressão, cartões mobile e ficha da missão');

// Execução real da função (ESM -> CJS simples)
const code = src.replace(/export function/g, 'function') +
  '\nmodule.exports = { classifyMissionShift };';
const m = { exports: {} };
new Function('module', 'exports', code)(m, m.exports);
const { classifyMissionShift } = m.exports;

// 2026-11-17 = terça; 2026-11-14 = sábado; 2026-11-15 = domingo
const k = (o) => classifyMissionShift({ missionStatus: 'Agendada', ...o }).kind;
assert.strictEqual(k({ date: '2026-11-17', eventStartTime: '09:00', eventEndTime: '12:00' }), 'in_hours');
assert.strictEqual(k({ date: '2026-11-17', eventStartTime: '19:00', eventEndTime: '22:00' }), 'off_night');
assert.strictEqual(k({ date: '2026-11-14', eventStartTime: '14:00', eventEndTime: '17:00' }), 'off_day');
assert.strictEqual(k({ date: '2026-11-15', eventStartTime: '10:00', eventEndTime: '14:00' }), 'off_day');
assert.strictEqual(k({ date: '2026-11-15', eventStartTime: '15:00', eventEndTime: '20:00' }), 'off_mixed');
assert.strictEqual(k({ date: '2026-11-17' }), 'unknown');
assert(classifyMissionShift({ date: '2026-11-17', eventStartTime: '16:00', eventEndTime: '20:00' }).partial,
  'missão que começa no expediente e termina à noite deve ser marcada como parcial');

console.log('✅ TESTE DE SINALIZAÇÃO DE TURNO (EXPEDIENTE / FORA DO EXPEDIENTE DIURNO OU NOTURNO) PASSOU!');
