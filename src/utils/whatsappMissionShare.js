// Utilitário para formatação e compartilhamento de ordens de serviço / missões via WhatsApp
import { formatDateBR, getMissionCode } from './geo';
import { classifyMissionShift } from './workHours';

/**
 * Monta o texto oficial e humanizado de uma missão para envio via WhatsApp.
 * Ideal para repassar a freelancers, convidados, motoristas ou colaboradores externos.
 */
export function formatMissionWhatsAppText(mission, { missions = [], vehicles = [], members = [] } = {}) {
  if (!mission) return '';

  const mCode = getMissionCode(mission, missions) || mission.code || mission.id || 'N/A';
  const title = mission.title || mission.pauta || mission.description || 'Missão Operacional';
  const description = mission.description && mission.description !== title ? mission.description : '';

  // Data
  const dateFormatted = mission.date ? formatDateBR(mission.date) : 'A definir';

  // Turno / Expediente
  let shiftInfo = '';
  try {
    const shift = classifyMissionShift(mission);
    if (shift && shift.label && shift.kind !== 'unknown') {
      shiftInfo = `${shift.icon} ${shift.label}`;
    }
  } catch (err) {
    console.warn('Erro ao classificar turno para WhatsApp:', err);
  }

  // Horários
  const times = [];
  if (mission.departureTime) times.push(`• *Saída da Base:* ${mission.departureTime}`);
  if (mission.arrivalTime) times.push(`• *Chegada no Local:* ${mission.arrivalTime}`);
  if (mission.eventStartTime) {
    const eventTimeStr = mission.eventEndTime
      ? `${mission.eventStartTime} às ${mission.eventEndTime}`
      : mission.eventStartTime;
    times.push(`• *Horário do Evento:* ${eventTimeStr}`);
  }
  if (mission.returnTimeEstimated || mission.returnTime) {
    times.push(`• *Retorno Previsto:* ${mission.returnTimeEstimated || mission.returnTime}`);
  }

  // Local & Endereço
  const locationLines = [];
  if (mission.locationName) locationLines.push(`• *Local:* ${mission.locationName}`);
  if (mission.address) locationLines.push(`• *Endereço:* ${mission.address}`);
  if (mission.distanceKm) {
    const roundTrip = mission.isRoundTrip !== false;
    locationLines.push(`• *Deslocamento:* ${mission.distanceKm} km (${roundTrip ? 'ida e volta' : 'apenas ida'})`);
  }

  // Link Google Maps
  let mapsUrl = '';
  if (mission.destinationLat && mission.destinationLng) {
    mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mission.destinationLat},${mission.destinationLng}`;
  } else if (mission.address || mission.locationName) {
    const query = encodeURIComponent(`${mission.locationName ? mission.locationName + ', ' : ''}${mission.address || ''}, Boa Vista - RR`);
    mapsUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
  }

  // Motorista & Viatura
  let driverName = mission.driverName || '';
  if (!driverName && mission.driverId) {
    const dMem = members.find((m) => String(m.id) === String(mission.driverId));
    if (dMem) driverName = dMem.name;
  }
  if (!driverName && Array.isArray(mission.teamIds) && mission.teamIds.length > 0) {
    const firstMem = members.find((m) => String(m.id) === String(mission.teamIds[0]));
    if (firstMem) driverName = firstMem.name;
  }

  let vehicleInfo = mission.vehicleNameDisplay || '';
  if (!vehicleInfo && mission.vehicleId) {
    const v = vehicles.find((veh) => String(veh.id) === String(mission.vehicleId));
    if (v) vehicleInfo = `${v.name} (${v.plate || 'Sem placa'})`;
  }

  // Equipe de Campo
  const teamNames = mission.teamNamesDisplay || '';

  // Pós-Produção & Edição
  const editorNames = mission.editorNamesDisplay || mission.editorName || '';
  const postDeadline = mission.postDeadline || mission.editingDeadline;
  let deadlineStr = '';
  if (postDeadline) {
    deadlineStr = formatDateBR(postDeadline.split('T')[0] || postDeadline.split(' ')[0]);
    const timePart = postDeadline.includes('T')
      ? postDeadline.split('T')[1]?.slice(0, 5)
      : postDeadline.split(' ')[1]?.slice(0, 5);
    if (timePart) deadlineStr += ` às ${timePart}`;
  }

  // Kits / Equipamentos
  const kits = mission.kitsDisplay || mission.equipmentDisplay || '';

  // Observações
  const notes = mission.notes || '';

  // Montagem do texto WhatsApp
  const lines = [
    `🎬 *MEGAFILMES & MEGA PRINT | ORDEM DE SERVIÇO*`,
    `📋 *Pauta:* #${mCode} — *${title}*`,
  ];

  if (description) {
    lines.push(`ℹ️ _${description}_`);
  }

  lines.push('');
  lines.push(`📅 *Data:* ${dateFormatted}${shiftInfo ? ` (${shiftInfo})` : ''}`);

  if (times.length > 0) {
    lines.push(`⏰ *Cronograma de Horários:*`);
    times.forEach((t) => lines.push(t));
  }

  if (locationLines.length > 0) {
    lines.push('');
    lines.push(`📍 *Local & Percurso:*`);
    locationLines.forEach((l) => lines.push(l));
  }

  if (mapsUrl) {
    lines.push(`🗺️ *Abrir GPS / Google Maps:*`);
    lines.push(mapsUrl);
  }

  lines.push('');
  lines.push(`👥 *Equipe & Logística:*`);
  if (driverName) lines.push(`• 🚗 *Motorista:* ${driverName}`);
  if (vehicleInfo) lines.push(`• 🚙 *Viatura:* ${vehicleInfo}`);
  if (teamNames) lines.push(`• 🎥 *Equipe de Campo:* ${teamNames}`);
  if (editorNames) {
    lines.push(`• 💻 *Pós-Produção / Edição:* ${editorNames}${deadlineStr ? ` (Prazo: ${deadlineStr})` : ''}`);
  }

  if (kits) {
    lines.push('');
    lines.push(`🎒 *Kits & Equipamentos:*`);
    lines.push(`• ${kits}`);
  }

  if (notes) {
    lines.push('');
    lines.push(`📝 *Observações & Orientações:*`);
    lines.push(`${notes}`);
  }

  lines.push('');
  lines.push(`_MegaGestão • MegaFilmes Audiovisual_`);

  return lines.join('\n');
}

/**
 * Sanitiza número de telefone e gera a URL de envio do WhatsApp.
 * Suporta formatos brasileiros com DDD, e se vazio abre para escolher contato/grupo.
 */
export function buildWhatsAppShareUrl(phoneNumber = '', messageText = '') {
  const cleanPhone = String(phoneNumber || '').replace(/\D/g, '');
  const encodedText = encodeURIComponent(messageText || '');

  if (!cleanPhone) {
    // Abre tela para escolher contato ou grupo
    return `https://api.whatsapp.com/send?text=${encodedText}`;
  }

  // Validação DDI 55 Brasil
  let finalPhone = cleanPhone;
  if (!finalPhone.startsWith('55') && (finalPhone.length === 10 || finalPhone.length === 11)) {
    finalPhone = `55${finalPhone}`;
  }

  return `https://api.whatsapp.com/send?phone=${finalPhone}&text=${encodedText}`;
}
