import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Car,
  Fuel,
  Film,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Navigation,
  ExternalLink,
  Phone,
  FileText,
  Sparkles,
  UserCheck,
  History,
  RotateCcw,
  AlertTriangle,
  Check,
  Repeat,
  UserPlus,
  CheckCheck,
  Zap,
  Lock,
  Folder,
} from 'lucide-react';
import {
  getMissionTotalKm,
  getNavigationLinks,
  getMissionAllocations,
  computeVehicleFuelTelemetry,
  computeMissionVehicleFuelBreakdown,
  getMissionCode,
  isElectricVehicle,
  getFuelTypeBadgeClass,
  calculateSuggestedDepartureTime,
  hasMissionPostProduction,
  checkIsMissionOverdue,
} from '../utils/geo';
import { alertDialog } from '../utils/dialog';
import { normalizeRole } from '../utils/auth';
import MissionHistoryModal from './MissionHistoryModal';

function formatDateBR(dateStr) {
  if (!dateStr) return '';
  const parts = String(dateStr).split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function addMinutesToTime(timeStr, deltaMinutes) {
  if (!timeStr || !String(timeStr).includes(':')) return '--:--';
  const [h, m] = String(timeStr).split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return '--:--';
  const total = ((h * 60 + m + deltaMinutes) % 1440 + 1440) % 1440;
  const nh = Math.floor(total / 60);
  const nm = total % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

export default function MissionDetailModal({
  isOpen = false,
  mission = null,
  missions = [],
  vehicles = [],
  members = [],
  baseLocation = null,
  fuelPricePerLiter = 6.45,
  settings = null,
  userRole = 'user',
  currentUser = null,
  onClose = () => {},
  onEditMission = null,
  onSelectMissionOnMap = null,
  onUpdateEditionStatus = null,
  onConcludeEdition = null,
  onApproveEdition = null,
  onReopenEdition = null,
}) {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  if (!isOpen || !mission) return null;

  const fuelSettings = settings || (typeof fuelPricePerLiter === 'object' ? fuelPricePerLiter : { gasolinePricePerLiter: fuelPricePerLiter, dieselPricePerLiter: 6.89 });
  const effectiveRole = normalizeRole(userRole || currentUser?.role);
  const canEditMission = effectiveRole === 'admin' || effectiveRole === 'manager';
  const canAdminManageEdition = effectiveRole === 'admin';

  // Verifica se o usuário atual é o editor responsável
  const isAssignedEditor = (() => {
    if (!currentUser || !mission) return false;
    const editorIds = Array.isArray(mission.editorIds) ? mission.editorIds.map(String) : [];
    const cId = String(currentUser.id || '');
    const userMember = members.find(
      (m) => String(m.userId) === cId || (m.name && m.name.toLowerCase() === currentUser?.name?.toLowerCase())
    );
    const mId = userMember ? String(userMember.id) : null;

    if (mission.editorId && (String(mission.editorId) === cId || (mId && String(mission.editorId) === mId))) {
      return true;
    }
    if (editorIds.includes(cId) || (mId && editorIds.includes(mId))) {
      return true;
    }
    return false;
  })();

  const canConcludeDetail = isAssignedEditor || canAdminManageEdition;

  // Resoluções de equipe e viatura
  const resolveMissionDriver = (mis) => {
    if (!mis) return { member: null, name: '' };
    if (mis.driverId) {
      const byId = members.find((m) => m.id === mis.driverId);
      if (byId) return { member: byId, name: byId.name };
    }
    if (mis.driverName) {
      const byName = members.find(
        (m) => m.name && m.name.toLowerCase() === mis.driverName.trim().toLowerCase()
      );
      return { member: byName || null, name: mis.driverName.trim() };
    }
    if (Array.isArray(mis.teamIds) && mis.teamIds.length > 0) {
      const firstMem = members.find((m) => m.id === mis.teamIds[0]);
      if (firstMem) return { member: firstMem, name: firstMem.name };
    }
    if (mis.teamNamesDisplay) {
      const firstName = mis.teamNamesDisplay.split(',')[0]?.trim();
      if (firstName) {
        const byFirst = members.find((m) => m.name && m.name.toLowerCase() === firstName.toLowerCase());
        return { member: byFirst || null, name: firstName };
      }
    }
    return { member: null, name: '' };
  };

  const isMemberMissionDriver = (mem, mis, allocations = [], driverInfo = null) => {
    if (!mem || !mis) return false;
    const dInfo = driverInfo || resolveMissionDriver(mis);
    return (
      allocations.some(
        (a) =>
          (a.driverId && a.driverId === mem.id) ||
          (a.driverName && a.driverName.toLowerCase() === mem.name.toLowerCase())
      ) ||
      (mis.driverId && mem.id === mis.driverId) ||
      (dInfo?.name && mem.name.toLowerCase() === dInfo.name.toLowerCase())
    );
  };

  const resolveMissionTeamMembers = (mis) => {
    if (!mis) return [];
    const result = [];
    const seen = new Set();

    if (Array.isArray(mis.teamIds)) {
      mis.teamIds.forEach((id) => {
        const mem = members.find((m) => m.id === id);
        if (mem && !seen.has(mem.id)) {
          seen.add(mem.id);
          result.push(mem);
        }
      });
    }

    if (mis.teamNamesDisplay) {
      mis.teamNamesDisplay.split(',').forEach((rawName) => {
        const trimmed = rawName.trim();
        if (!trimmed) return;
        const mem = members.find(
          (m) =>
            m.name &&
            (m.name.toLowerCase() === trimmed.toLowerCase() ||
              m.name.toLowerCase().split(' ')[0] === trimmed.toLowerCase())
        );
        if (mem && !seen.has(mem.id)) {
          seen.add(mem.id);
          result.push(mem);
        } else if (!mem && !seen.has(trimmed.toLowerCase())) {
          seen.add(trimmed.toLowerCase());
          result.push({ id: `temp-${trimmed}`, name: trimmed, role: 'Equipe Escalada', company: 'MegaFilmes' });
        }
      });
    }

    const allocations = getMissionAllocations(mis, vehicles, members);
    const driverInfo = resolveMissionDriver(mis);

    allocations.forEach((alloc) => {
      if (alloc.driverMember && !seen.has(alloc.driverMember.id)) {
        seen.add(alloc.driverMember.id);
        result.unshift(alloc.driverMember);
      } else if (alloc.driverName) {
        const alreadyIn = result.some(
          (r) => r.name.toLowerCase() === alloc.driverName.toLowerCase()
        );
        if (!alreadyIn) {
          result.unshift({
            id: `drv-${alloc.driverName}`,
            name: alloc.driverName,
            role: 'Motorista Escalado',
            company: 'MegaFilmes',
          });
        }
      }
    });

    if (driverInfo.member && !seen.has(driverInfo.member.id)) {
      seen.add(driverInfo.member.id);
      result.unshift(driverInfo.member);
    }

    return result.sort((a, b) => {
      const aIsDrv = isMemberMissionDriver(a, mis, allocations, driverInfo) ? 1 : 0;
      const bIsDrv = isMemberMissionDriver(b, mis, allocations, driverInfo) ? 1 : 0;
      return bIsDrv - aIsDrv;
    });
  };

  const resolveMissionEditors = (mis) => {
    if (!mis) return [];
    const found = [];
    const seen = new Set();

    if (Array.isArray(mis.editorIds) && mis.editorIds.length > 0) {
      mis.editorIds.forEach((id) => {
        const mem = members.find((m) => m.id === id);
        if (mem && !seen.has(mem.id)) {
          seen.add(mem.id);
          found.push(mem);
        }
      });
    }

    if (mis.editorId) {
      const mem = members.find((m) => m.id === mis.editorId);
      if (mem && !seen.has(mem.id)) {
        seen.add(mem.id);
        found.push(mem);
      }
    }

    if (found.length === 0 && (mis.editorNamesDisplay || mis.editorName)) {
      const names = (mis.editorNamesDisplay || mis.editorName).split(',');
      names.forEach((n) => {
        const tr = n.trim();
        if (tr && !seen.has(tr.toLowerCase())) {
          seen.add(tr.toLowerCase());
          const byName = members.find((m) => m.name && m.name.toLowerCase() === tr.toLowerCase());
          found.push(byName || { id: `ed-${tr}`, name: tr, role: 'Editor de Vídeo', company: 'MegaFilmes' });
        }
      });
    }

    return found;
  };

  const detailCode = getMissionCode(mission, missions);
  const detailAllocations = getMissionAllocations(mission, vehicles, members);
  const drv = resolveMissionDriver(mission);
  const teamMembers = resolveMissionTeamMembers(mission);
  const assignedEditors = resolveMissionEditors(mission);
  const isDetailOverdue = checkIsMissionOverdue(mission);
  const totalKm = getMissionTotalKm(mission);
  const oneWayKm = mission.distanceKm || 0;
  const returnKm = mission.returnDistanceKm || oneWayKm;
  const oneWayMin = mission.drivingDurationMinutes || 0;
  const totalMin = mission.roundTripDurationMinutes || oneWayMin * 2;
  const prepTimeStr = addMinutesToTime(mission.departureTime, -60);
  const detailEventStartTime = mission.eventStartTime || null;
  const detailAntecedenceMin = mission.antecedenceMinutes ? Number(mission.antecedenceMinutes) : 30;
  const detailSuggestedDep = mission.suggestedDepartureTime || (
    detailEventStartTime
      ? calculateSuggestedDepartureTime(detailEventStartTime, oneWayMin, detailAntecedenceMin)
      : null
  );

  const navLinks =
    baseLocation?.lat && mission.lat
      ? getNavigationLinks(
          baseLocation.lat,
          baseLocation.lon,
          mission.lat,
          mission.lon
        )
      : null;

  const statusSlug = (mission.missionStatus || 'Agendada')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-');

  return (
    <>
      <div
        className="modal-overlay mission-detail-overlay"
        onClick={onClose}
      >
        <div
          className={`mission-detail-modal card-border-${statusSlug}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Cabeçalho do Card da Missão */}
          <div className="mdm-header">
            <div className="mdm-header-top">
              <div className="mdm-badges-row">
                <span className="mission-code-pill mdm-code-pill" title="Código único da missão">
                  #{detailCode}
                </span>

                <span className={`mdm-status-badge ${isDetailOverdue && mission.missionStatus === 'Pendente' ? 'pill-atrasada' : `pill-${statusSlug}`}`}>
                  <span
                    className={`status-dot ${isDetailOverdue && mission.missionStatus === 'Pendente' ? 'dot-atrasada' : `dot-${(mission.missionStatus || 'Agendada')
                      .toLowerCase()
                      .replace(/\s+/g, '-')}`}`}
                  ></span>
                  {isDetailOverdue && mission.missionStatus === 'Pendente' ? 'Atrasado' : (mission.missionStatus || 'Agendada')}
                </span>

                <span className="mdm-edition-badge">
                  Pós-Produção: <strong>{mission.editionStatus || 'Pendente'}</strong>
                </span>

                <span className="mdm-roundtrip-badge">
                  🔄 Ida e Volta à Base
                </span>

                {mission.isRecurring && (
                  <span className="mdm-recurring-badge" title={`Série Recorrente: ${mission.recurrenceDays || 'Semanal'}`}>
                    <Repeat size={12} /> Recorrente ({mission.recurrenceDays || 'Semanal'})
                  </span>
                )}
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={onClose}
                title="Fechar Card"
              >
                ✕
              </button>
            </div>

            <h2 className="mdm-title">{mission.description}</h2>

            <div className="mdm-location-bar">
              <MapPin size={16} className="icon-accent" />
              <div>
                <strong>{mission.locationName || 'Local da Missão'}</strong>
                {mission.address && <span> — {mission.address}</span>}
              </div>
            </div>
          </div>

          {/* Corpo Rolável do Card */}
          <div className="mdm-body">
            {/* 1. LINHA DO TEMPO & HORÁRIOS AUTOMÁTICOS */}
            <div className="mdm-section">
              <div className="mdm-section-title">
                <Clock size={15} />
                <span>
                  Cronograma &amp; Automação de Horários ({Boolean(mission.isMultiDay && mission.endDate && mission.endDate !== mission.date) ? `${formatDateBR(mission.date)} a ${formatDateBR(mission.endDate)}` : formatDateBR(mission.date)})
                </span>
              </div>

              <div className={`mdm-timeline-grid ${detailEventStartTime ? 'has-event-slot-5' : ''}`}>
                <div className="mdm-time-box">
                  <span className="t-label">Início do Preparo (-1h)</span>
                  <strong className="t-val text-amber">{prepTimeStr}</strong>
                  <small>Viatura e equipe ficam ocupadas</small>
                </div>

                <div className="mdm-time-box highlight-departure">
                  <span className="t-label">Saída da Base</span>
                  <strong className="t-val">{mission.departureTime || '--:--'}</strong>
                  <small>{detailSuggestedDep ? `Máx. Sugerido: ${detailSuggestedDep}` : 'Início da execução da missão'}</small>
                </div>

                <div className="mdm-time-box">
                  <span className="t-label">Chegada Estimada</span>
                  <strong className="t-val text-cyan">{mission.arrivalTimeEstimated || '--:--'}</strong>
                  <small>~{oneWayMin} min de deslocamento (ida)</small>
                </div>

                {detailEventStartTime && (
                  <div className="mdm-time-box highlight-event">
                    <span className="t-label">Início do Evento</span>
                    <strong className="t-val text-amber">{detailEventStartTime}</strong>
                    <small>{detailAntecedenceMin} min de antecedência no local</small>
                  </div>
                )}

                <div className="mdm-time-box">
                  <span className="t-label">Retorno &amp; Encerramento</span>
                  <strong className="t-val text-green">{mission.returnTimeEstimated || '--:--'}</strong>
                  <small>Finalização automática no horário</small>
                </div>
              </div>

              {/* BANNER / BADGE INFORMATIVO DE HORÁRIO SUGERIDO DE SAÍDA */}
              {detailEventStartTime ? (
                <div className="mdm-smart-schedule-badge">
                  <Sparkles size={14} className="text-amber" />
                  <div>
                    <span>
                      Horário Máximo Sugerido de Saída da Base: <strong>{detailSuggestedDep || mission.departureTime}</strong>
                    </span>
                    <span className="mdm-smart-schedule-desc">
                      (Início do evento às <strong>{detailEventStartTime}</strong> − <strong>{detailAntecedenceMin} min</strong> de antecedência no local − <strong>~{oneWayMin} min</strong> de trajeto de ida = <strong>{detailSuggestedDep}</strong>)
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mdm-smart-schedule-badge mdm-badge-info">
                  <Sparkles size={14} className="text-cyan" />
                  <div>
                    <span>
                      Deslocamento estimado até o cliente: <strong>~{oneWayMin} min</strong>
                    </span>
                    <span className="mdm-smart-schedule-desc">
                      Para eventos com 30 min de antecedência na montagem, saia da base no máximo <strong>~{oneWayMin + 30} min</strong> antes do horário marcado com o cliente.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 2. VIATURAS DESIGNADAS & MOTORISTAS RESPONSÁVEIS */}
            <div className="mdm-section">
              <div className="mdm-section-title">
                <Car size={15} />
                <span>
                  Viaturas Alocadas &amp; Motoristas ({detailAllocations.length} viatura
                  {detailAllocations.length !== 1 ? 's' : ''}) — Consumo Total:{' '}
                  {mission.estimatedFuelLiters || 0} L (R${' '}
                  {Number(mission.estimatedFuelCost || 0).toFixed(2)})
                </span>
              </div>

              {detailAllocations.length > 0 ? (
                <div className="mdm-allocations-list">
                  {detailAllocations.map((alloc, aIdx) => {
                    const v = alloc.vehicle;
                    const vTel = v
                      ? computeVehicleFuelTelemetry(v, missions, fuelSettings)
                      : null;
                    const vBd = v
                      ? computeMissionVehicleFuelBreakdown({
                          vehicle: v,
                          totalRoundTripKm: totalKm,
                          currentTelemetry: vTel,
                          fuelPricePerLiter: fuelSettings,
                        })
                      : null;

                    return (
                      <div key={aIdx} className="mdm-two-col">
                        {/* Card da Viatura */}
                        <div className="mdm-info-card">
                          <div className="mdm-section-title" style={{ marginBottom: 8 }}>
                            <Car size={14} />
                            <span>Viatura #{aIdx + 1}</span>
                          </div>
                          {v ? (
                            <div className="mdm-vehicle-box">
                              {(() => {
                                const isElecDetail = isElectricVehicle(v);
                                const unitDetail = isElecDetail ? 'kWh' : 'L';
                                const nounDetail = isElecDetail ? 'Bateria' : 'Tanque';
                                return (
                                  <>
                                    <div className="mdm-veh-main">
                                      <div>
                                        <h4 className="mdm-veh-name">{v.name}</h4>
                                        <div className="mdm-veh-tags">
                                          <span className="veh-plate-mono">{v.plate}</span>
                                          <span className="mdm-company-pill">{v.company}</span>
                                          {v.type && <span className="mdm-veh-type">{v.type}</span>}
                                          <span className={`veh-fuel-badge ${getFuelTypeBadgeClass(v)}`} style={{ fontSize: '0.72rem', padding: '2px 6px', borderRadius: 4 }}>
                                            {isElecDetail ? '⚡ Elétrico' : (v.fuelType || 'Gasolina').toLowerCase() === 'diesel' ? '🛢️ Diesel' : '⛽ Gasolina'}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="mdm-veh-metrics">
                                      <div>
                                        <span>Autonomia</span>
                                        <strong>{v.autonomyKmPerLiter} {isElecDetail ? 'km/kWh' : 'km/L'}</strong>
                                      </div>
                                      <div>
                                        <span>Dedução Missão</span>
                                        <strong style={{ color: 'var(--accent-gold)' }}>
                                          -{vBd ? vBd.litersNeeded : 0}{unitDetail} (-{vBd ? vBd.percentOfTankUsed : 0}%)
                                        </strong>
                                      </div>
                                      <div>
                                        <span>{nounDetail} Atual</span>
                                        <strong
                                          className={
                                            vTel?.isReserveAlert
                                              ? 'text-danger-bright'
                                              : 'text-green-bright'
                                          }
                                        >
                                          {vTel ? `${vTel.currentLiters}${unitDetail} (${vTel.currentPercent}%)` : `${v.currentFuelPercent || 75}%`}
                                        </strong>
                                      </div>
                                    </div>

                                    {vBd && vBd.exceedsFullTankCapacity && (
                                      <div className="vft-excess-tank-alert" style={{ marginTop: 8 }}>
                                        {isElecDetail ? <Zap size={13} className="text-green" /> : <Fuel size={13} />}
                                        <span>
                                          <strong>Excedente (&gt; 1 {nounDetail} de {vBd.maxTankRangeKm} km):</strong>{' '}
                                          +{vBd.excessOverFullTankKm} km • +{vBd.excessOverFullTankLiters}{unitDetail} •{' '}
                                          <strong>Valor Excedente: +R$ {Number(vBd.excessOverFullTankCost || 0).toFixed(2)}</strong>
                                        </span>
                                      </div>
                                    )}

                                    {vTel?.isReserveAlert && (
                                      <div className="vft-reserve-alert" style={{ marginTop: 8 }}>
                                        {isElecDetail ? <Zap size={13} className="text-green" /> : <AlertCircle size={13} />}
                                        <span>
                                          <strong>{isElecDetail ? '⚡ Bateria Baixa (≤ 10%):' : '🚨 Reserva de Combustível (≤ 10%):'}</strong>{' '}
                                          {isElecDetail ? 'Recarga imediata da bateria necessária!' : 'Abastecimento imediato necessário!'}
                                        </span>
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          ) : (
                            <div className="mdm-empty-box">{alloc.vehicleName}</div>
                          )}
                        </div>

                        {/* Card do Motorista desta Viatura */}
                        <div className="mdm-info-card mdm-driver-card">
                          <div className="mdm-section-title" style={{ marginBottom: 8 }}>
                            <UserCheck size={14} />
                            <span>Motorista da Viatura #{aIdx + 1}</span>
                          </div>
                          {alloc.driverName ? (
                            <div className="mdm-driver-box">
                              <div className="mdm-driver-avatar">
                                {alloc.driverMember?.photoUrl ? (
                                  <img
                                    src={alloc.driverMember.photoUrl}
                                    alt={alloc.driverName}
                                  />
                                ) : (
                                  <span>{alloc.driverName.slice(0, 2).toUpperCase()}</span>
                                )}
                              </div>
                              <div className="mdm-driver-details">
                                <div className="mdm-driver-tag">
                                  🛞 Condutor Responsável (Ida e Volta)
                                </div>
                                <h4>{alloc.driverName}</h4>
                                <span>
                                  {alloc.driverMember?.role || 'Integrante Escalado'}
                                </span>
                                {alloc.driverMember?.phone && (
                                  <small className="mdm-driver-phone">
                                    <Phone size={11} /> {alloc.driverMember.phone}
                                  </small>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="mdm-empty-box">
                              Nenhum motorista definido.{' '}
                              {canEditMission && (
                                <button
                                  type="button"
                                  className="btn-link-inline"
                                  onClick={() => {
                                    onClose();
                                    if (onEditMission) onEditMission(mission);
                                  }}
                                >
                                  Definir agora
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mdm-empty-box">Nenhuma viatura alocada para esta missão.</div>
              )}
            </div>

            {/* 3. ROTA E DESLOCAMENTO (IDA E VOLTA) */}
            <div className="mdm-section">
              <div className="mdm-section-title">
                <Navigation size={15} />
                <span>Dados da Rota e Deslocamento (Ida e Volta à Sede)</span>
              </div>

              <div className="mdm-route-strip">
                <div className="mdm-route-stat">
                  <span>Distância Total (Ida e Volta)</span>
                  <strong>{totalKm} km</strong>
                  <small>
                    Ida: {oneWayKm} km • Volta: {returnKm} km
                  </small>
                </div>

                <div className="mdm-route-stat">
                  <span>Tempo Total de Direção</span>
                  <strong>~{totalMin} min</strong>
                  <small>~{oneWayMin} min por trecho</small>
                </div>

                <div className="mdm-route-stat">
                  <span>Coordenadas GPS do Destino</span>
                  <strong className="mono-sm">
                    {mission.lat && mission.lon
                      ? `${Number(mission.lat).toFixed(5)}, ${Number(mission.lon).toFixed(5)}`
                      : 'Não informadas'}
                  </strong>
                  <small>Trajeto viário OSRM calculado</small>
                </div>

                {navLinks && (
                  <div className="mdm-route-actions">
                    <a
                      href={navLinks.googleMaps}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-nav-external google-maps"
                    >
                      <ExternalLink size={13} /> Google Maps
                    </a>
                    <a
                      href={navLinks.waze}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-nav-external waze"
                    >
                      <ExternalLink size={13} /> Waze
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* 4. EQUIPE ESCALADA COMPLETA */}
            <div className="mdm-section">
              <div className="mdm-section-title">
                <Users size={15} />
                <span>
                  Equipe Escalada na Missão (
                  {teamMembers.length + (Array.isArray(mission.guests) ? mission.guests.length : 0)} participante
                  {teamMembers.length + (Array.isArray(mission.guests) ? mission.guests.length : 0) !== 1 ? 's' : ''}
                  )
                </span>
              </div>

              {teamMembers.length > 0 ? (
                <div className="mdm-team-grid">
                  {teamMembers.map((mem, idx) => {
                    const isDriver =
                      (mission.driverId && mem.id === mission.driverId) ||
                      (drv.name && mem.name.toLowerCase() === drv.name.toLowerCase());
                    return (
                      <div
                        key={mem.id || idx}
                        className={`mdm-team-member-card ${isDriver ? 'is-driver' : ''}`}
                      >
                        <div className="mdm-tm-avatar">
                          {mem.photoUrl ? (
                            <img src={mem.photoUrl} alt={mem.name} />
                          ) : (
                            <span>{mem.name.slice(0, 2).toUpperCase()}</span>
                          )}
                        </div>
                        <div className="mdm-tm-info">
                          <div className="mdm-tm-name-row">
                            <strong>{mem.name}</strong>
                            {isDriver && <span className="mdm-tm-driver-pill">🛞 Motorista</span>}
                          </div>
                          <span className="mdm-tm-role">{mem.role || 'Profissional'}</span>
                          {mem.phone && (
                            <small className="mdm-tm-phone">
                              <Phone size={10} /> {mem.phone}
                            </small>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (!Array.isArray(mission.guests) || mission.guests.length === 0) ? (
                <div className="mdm-empty-box">Nenhum integrante escalado nesta pauta.</div>
              ) : null}

              {/* Convidados Externos / Freelancers */}
              {Array.isArray(mission.guests) && mission.guests.length > 0 && (
                <div className="mdm-guests-block">
                  <div className="mdm-guests-subtitle">
                    <UserPlus size={14} className="text-purple" />
                    <span>Convidados Externos &amp; Freelancers ({mission.guests.length})</span>
                  </div>
                  <div className="mdm-guests-grid">
                    {mission.guests.map((g, gIdx) => {
                      const gName = typeof g === 'string' ? g : g.name;
                      return (
                        <div key={`mdm-guest-${gIdx}`} className="mdm-guest-card">
                          <div className="mgc-avatar-circle">
                            {gName.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="mgc-details">
                            <div className="mgc-name-row">
                              <strong>{gName}</strong>
                              <span className="mgc-pill">Freelancer / Externo</span>
                            </div>
                            <small className="mgc-note">Sem acesso ao sistema • Sem rastreamento GPS</small>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 5. BRIEFING / EQUIPAMENTOS / OBSERVAÇÕES & STATUS DE EDIÇÃO */}
            <div className="mdm-section">
              <div className="mdm-section-title">
                <FileText size={15} />
                <span>Briefing, Equipamentos &amp; Observações da Pauta</span>
              </div>

              <div className="mdm-notes-box">
                {mission.notes ? (
                  <p>{mission.notes}</p>
                ) : (
                  <p className="text-muted">Nenhuma observação ou lista de equipamentos registrada para esta missão.</p>
                )}
              </div>
            </div>

            {/* 6. PÓS-PRODUÇÃO, EDIÇÃO & PRAZOS DE ENTREGA */}
            <div className="mdm-section mdm-postprod-section">
              <div className="mdm-section-title">
                <Film size={15} />
                <span>🎬 Pós-Produção, Edição &amp; Prazos de Entrega</span>
              </div>

              <div className="mdm-postprod-card">
                {!hasMissionPostProduction(mission) ? (
                  <div
                    style={{
                      padding: '16px',
                      background: 'rgba(148, 163, 184, 0.08)',
                      borderRadius: '8px',
                      border: '1px solid rgba(148, 163, 184, 0.2)',
                      color: '#94a3b8',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                  >
                    <CheckCircle2 size={20} style={{ color: '#10b981', flexShrink: 0 }} />
                    <div>
                      <strong style={{ display: 'block', color: 'var(--text-primary, #f8fafc)', fontSize: '0.92rem', marginBottom: '2px' }}>
                        Pós-Produção Desativada
                      </strong>
                      <span style={{ fontSize: '0.82rem' }}>
                        Esta missão não demanda edição ou pós-produção ({mission.editionStatus || 'Não se aplica'}). Prazos e cobrança de entrega não se aplicam.
                      </span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mdm-pp-grid">
                      {/* Editores Responsáveis */}
                      <div className="mdm-pp-block">
                        <label className="mdm-pp-label">
                          <Users size={12} /> Editores Responsáveis Designados
                        </label>
                        {assignedEditors.length > 0 ? (
                          <div className="mdm-editor-tags">
                            {assignedEditors.map((ed, idx) => (
                              <div key={ed.id || idx} className="mdm-editor-tag">
                                <span className="mdm-editor-avatar">
                                  {ed.photoUrl ? (
                                    <img src={ed.photoUrl} alt={ed.name} />
                                  ) : (
                                    <span>{ed.name.slice(0, 2).toUpperCase()}</span>
                                  )}
                                </span>
                                <div className="mdm-editor-info">
                                  <strong>{ed.name}</strong>
                                  <small>{ed.role || 'Editor de Vídeo'}</small>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="mdm-pp-empty">
                            <em>Nenhum editor designado para esta pauta.</em>
                          </div>
                        )}
                      </div>

                      {/* Prazo Limite de Entrega & Pontualidade */}
                      <div className="mdm-pp-block">
                        <label className="mdm-pp-label">
                          <Clock size={12} /> Prazo Limite de Entrega
                        </label>
                        <div className="mdm-pp-deadline-box">
                          {mission.deliveryDeadlineDate ? (
                            <div>
                              <div className="mdm-deadline-time-row">
                                <Calendar size={13} className="icon-accent" />
                                <strong className="mdm-deadline-val">
                                  {formatDateBR(mission.deliveryDeadlineDate)} às {mission.deliveryDeadlineTime || '18:00'}
                                </strong>
                                {mission.editionDeliveryStatus && (
                                  <span className={`pp-badge pp-badge-delivery ${mission.editionDeliveryStatus === 'Dentro do Prazo' ? 'ontime' : 'late'}`}>
                                    {mission.editionDeliveryStatus === 'Dentro do Prazo' ? '✅ No Prazo' : '⚠️ Fora do Prazo'}
                                  </span>
                                )}
                              </div>
                              {(mission.isOverdue || mission.reopenReason) && (
                                <div className="mdm-overdue-alert">
                                  <AlertTriangle size={14} />
                                  <span>{mission.reopenReason ? `Retrabalho Solicitado: "${mission.reopenReason}"` : 'Entrega em Atraso'}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted">Prazo limite não estipulado para esta missão.</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Barra de Status e Ações de Pós-Produção */}
                    <div className="mdm-pp-status-bar">
                      <div className="mdm-pp-status-left">
                        <span className="mdm-pp-label-sm">Situação da Pós-Produção:</span>
                        <span className={`status-badge-inline status-${(mission.editionStatus || 'Pendente').toLowerCase().replace(/\s+/g, '-')}`}>
                          {mission.editionStatus || 'Pendente'}
                        </span>
                        {mission.editionCompletedAt && (
                          <small className="mdm-pp-completed-info">
                            Concluído em {formatDateBR(mission.editionCompletedAt.slice(0, 10))} às {mission.editionCompletedAt.slice(11, 16)} por {mission.editionCompletedBy || 'Editor'}
                          </small>
                        )}
                      </div>

                      <div className="mdm-pp-actions">
                        {/* Concluir Tarefa de Edição */}
                        {mission.editionStatus !== 'Edição Concluída' && mission.editionStatus !== 'Entregue' && mission.editionStatus !== 'Não se aplica' && (
                          <>
                            {canConcludeDetail && onConcludeEdition ? (
                              <button
                                type="button"
                                className="btn-pp-conclude"
                                onClick={() => onConcludeEdition(mission)}
                                title="Concluir tarefa de edição e enviar para confirmação da gestão"
                              >
                                <CheckCircle2 size={13} />
                                <span>Concluir Tarefa de Edição</span>
                              </button>
                            ) : (
                              <span className="status-badge-inline status-pendente">
                                {isDetailOverdue ? '⚠️ Edição Atrasada' : 'Edição Pendente'}
                              </span>
                            )}
                          </>
                        )}

                        {/* Ações após conclusão do material: Apenas Administradores podem aceitar ou rejeitar */}
                        {mission.editionStatus === 'Edição Concluída' && mission.missionStatus !== 'Finalizada' && (
                          <>
                            {!canAdminManageEdition ? (
                              <div
                                className="btn-pp-waiting"
                                title="Material entregue pelo editor. Aguardando aceitação e confirmação pelo Administrador."
                              >
                                <Clock size={13} />
                                <span>Aguardando Confirmação</span>
                              </div>
                            ) : (
                              <>
                                {onReopenEdition && (
                                  <button
                                    type="button"
                                    className="btn-pp-reopen"
                                    onClick={() => onReopenEdition(mission)}
                                    title="Rejeitar material e solicitar ajustes / novo prazo"
                                  >
                                    <RotateCcw size={12} />
                                    <span>Rejeitar e Reabrir</span>
                                  </button>
                                )}
                                {onApproveEdition && (
                                  <button
                                    type="button"
                                    className="btn-pp-approve"
                                    onClick={() => onApproveEdition(mission)}
                                    title="Confirmar finalização da missão e encerrar serviço"
                                  >
                                    <CheckCheck size={13} />
                                    <span>Confirmar Finalização</span>
                                  </button>
                                )}
                              </>
                            )}
                          </>
                        )}

                        {mission.missionStatus === 'Finalizada' && (
                          <span className="pp-concluded-badge">
                            <Check size={12} /> Missão Finalizada
                          </span>
                        )}

                        {/* Exibição Destacada do Caminho no Servidor */}
                        {mission.serverFilePath && (
                          <div
                            style={{
                              marginTop: '10px',
                              padding: '8px 12px',
                              background: 'rgba(56, 189, 248, 0.08)',
                              border: '1px solid rgba(56, 189, 248, 0.25)',
                              borderRadius: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '10px'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                              <Folder size={16} style={{ color: '#38bdf8', flexShrink: 0 }} />
                              <div style={{ overflow: 'hidden' }}>
                                <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>
                                  Local do Arquivo no Servidor
                                </div>
                                <code style={{ fontSize: '0.82rem', color: '#38bdf8', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {mission.serverFilePath}
                                </code>
                              </div>
                            </div>
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ padding: '3px 8px', fontSize: '0.72rem', flexShrink: 0 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (navigator.clipboard) {
                                  navigator.clipboard.writeText(mission.serverFilePath);
                                  alertDialog({
                                    title: 'Caminho Copiado!',
                                    message: `Caminho copiado para a área de transferência:\n\n${mission.serverFilePath}`,
                                    variant: 'info'
                                  });
                                }
                              }}
                            >
                              Copiar
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Rodapé de Ações do Card */}
          <div className="mdm-footer">
            <div className="mdm-footer-left">
              <label>Status de Edição:</label>
              {canEditMission && onUpdateEditionStatus && mission.missionStatus !== 'Finalizada' && mission.missionStatus !== 'Finalizado' ? (
                <select
                  className="status-dropdown"
                  value={mission.editionStatus || 'Pendente'}
                  onChange={(e) => onUpdateEditionStatus(mission.id, e.target.value)}
                >
                  <option value="Pendente">Pendente</option>
                  <option value="Em Edição">Em Edição</option>
                  <option value="Edição Concluída">Edição Concluída</option>
                  <option value="Entregue">Entregue</option>
                  <option value="Não se aplica">Não se aplica</option>
                </select>
              ) : (
                <span className="status-static-tag" style={{ marginLeft: 6 }}>
                  {mission.editionStatus || 'Não se aplica'}
                </span>
              )}
            </div>

            <div className="mdm-footer-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setIsHistoryOpen(true)}
                title="Ver Histórico Completo e Auditoria desta Missão"
              >
                <History size={15} /> Histórico Completo
              </button>

              {onSelectMissionOnMap && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    const id = mission.id;
                    onClose();
                    onSelectMissionOnMap(id);
                  }}
                  title="Ver Trajeto e Viatura no Mapa"
                >
                  <Navigation size={15} /> Ver Rota no Mapa
                </button>
              )}

              {canEditMission && (mission.missionStatus !== 'Finalizada' && mission.missionStatus !== 'Finalizado') ? (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    const m = mission;
                    onClose();
                    if (onEditMission) onEditMission(m);
                  }}
                >
                  <Edit2 size={15} /> Editar Missão
                </button>
              ) : canEditMission ? (
                <span
                  className="btn-secondary"
                  style={{ opacity: 0.5, cursor: 'not-allowed', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  title="Missão finalizada e concluída (edição bloqueada)"
                >
                  <Lock size={14} /> Missão Encerrada
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Histórico e Auditoria Completa */}
      {isHistoryOpen && (
        <MissionHistoryModal
          isOpen={isHistoryOpen}
          mission={mission}
          onClose={() => setIsHistoryOpen(false)}
        />
      )}
    </>
  );
}
