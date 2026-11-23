import React, { useState, useEffect, useMemo } from 'react';
import {
  MapPin,
  Calendar,
  CalendarRange,
  Clock,
  Car,
  Users,
  Fuel,
  Navigation,
  Search,
  Check,
  Zap,
  RotateCcw,
  Plus,
  Trash2,
  AlertTriangle,
  Sparkles,
  FileText,
  Sliders,
  Film,
  UserPlus,
  X,
  Repeat,
  DollarSign,
  Briefcase,
  ShieldCheck,
  Lock,
  Ban,
  Package,
  Camera,
  HardDrive,
} from 'lucide-react';
import {
  OFFICIAL_COMPANY_ROLES,
  ROLE_ICONS_MAP,
  ROLE_COLORS_MAP,
  normalizeToOfficialRole,
} from '../utils/companyRoles';
import {
  calculateMissionOffHours,
  calculateEventOnlyOffHours,
  resolveEventTimes,
  calculateExtraHoursRemuneration,
  checkMemberExtraHoursAvailability
} from '../utils/workHours';
import {
  RECURRENCE_DAYS,
  getDayOfWeekFromDate,
  addWeeksToDate,
  formatOccurrencePreview,
  generateRecurrenceDates,
  formatDaysDisplay,
} from '../utils/recurrence';
import { getCurrentUser, normalizeRole, ROLES } from '../utils/auth';
import {
  fetchRouteOSRM,
  searchAddressNominatim,
  reverseGeocodeNominatim,
  parseCoordinatesFromText,
  formatAddressWithCoordinates,
  calculateFuelEstimate,
  calculateArrivalTime,
  calculateSuggestedDepartureTime,
  computeMissionAutoStatus,
  getLocalTodayStr,
  getMissionAllocations,
  computeVehicleFuelTelemetry,
  computeMissionVehicleFuelBreakdown,
  generateNextMissionCode,
  formatDateBR,
  isElectricVehicle,
  getFuelUnit,
  getFuelNoun,
  getFuelActionNoun,
  getFuelTypeIcon,
  getFuelTypeBadgeClass,
  hasMissionPostProduction,
} from '../utils/geo';
import { alertDialog, confirmDialog } from '../utils/dialog';
import { apiRequest } from '../utils/api';
import { CATEGORY_LABELS, formatCurrency } from '../utils/rentalsData';
import MissionMapPickerModal from './MissionMapPickerModal';

// Calcula a quantidade de dias (diárias) entre a data de início e a data final (intervalo operacional inclusivo)
export function calculateDaysBetween(startDateStr, endDateStr) {
  if (!startDateStr || !endDateStr) return 1;
  try {
    const [y1, m1, d1] = String(startDateStr).split('-').map(Number);
    const [y2, m2, d2] = String(endDateStr).split('-').map(Number);
    if (!y1 || !y2) return 1;
    const utc1 = Date.UTC(y1, m1 - 1, d1);
    const utc2 = Date.UTC(y2, m2 - 1, d2);
    // Dias inclusivos: 25/11 a 27/11 = 3 diárias (dia 25, 26 e 27)
    const diff = Math.round((utc2 - utc1) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 1;
  } catch (e) {
    return 1;
  }
}

// Função utilitária para identificação em tempo real de conflitos de horário com viaturas e colaboradores
export function getScheduleConflicts(formData, missions = [], editingMissionId = null) {
  const result = {
    vehicleConflicts: {}, // vehicleId -> { missionId, code, description, timeRange }
    memberConflicts: {},  // memberId -> { missionId, code, description, timeRange, role }
  };

  const formDate = formData?.date;
  const formDep = formData?.departureTime;
  if (!formDate || !formDep) return result;

  const parseTime = (dateStr, timeStr) => {
    if (!timeStr) return null;
    const [h, m] = String(timeStr).split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return null;
    const [y, mo, d] = String(dateStr).split('-').map(Number);
    if (!y || !mo || !d) return null;
    return new Date(y, mo - 1, d, h, m, 0, 0);
  };

  const targetStart = parseTime(formDate, formDep);
  if (!targetStart) return result;

  const targetEndDate = formData?.isMultiDay && formData?.endDate ? formData.endDate : formDate;
  let targetEnd = parseTime(targetEndDate, formData.returnTimeEstimated || formData.eventEndTime || formData.arrivalTimeEstimated);
  if (!targetEnd || targetEnd <= targetStart) {
    if (formData?.isMultiDay && formData?.endDate && formData.endDate > formDate) {
      targetEnd = parseTime(formData.endDate, '23:59:59');
    } else if (targetEnd && targetEnd <= targetStart) {
      targetEnd.setDate(targetEnd.getDate() + 1);
    } else {
      targetEnd = new Date(targetStart.getTime() + 90 * 60 * 1000);
    }
  }

  for (const m of missions) {
    if (m.id === editingMissionId) continue;
    const status = m.missionStatus || 'Agendada';
    if (status === 'Finalizada' || status === 'Finalizado' || status === 'Concluída' || status === 'Cancelada') {
      continue;
    }

    const mDate = m.date || formDate;
    const mEndDate = m.isMultiDay && m.endDate ? m.endDate : mDate;
    const mDep = m.departureTime;
    if (!mDep) continue;

    const mStart = parseTime(mDate, mDep);
    if (!mStart) continue;

    let mEnd = parseTime(mEndDate, m.returnTimeEstimated || m.eventEndTime || m.arrivalTimeEstimated);
    if (!mEnd || mEnd <= mStart) {
      if (m.isMultiDay && m.endDate && m.endDate > mDate) {
        mEnd = parseTime(m.endDate, '23:59:59');
      } else if (mEnd && mEnd <= mStart) {
        mEnd.setDate(mEnd.getDate() + 1);
      } else {
        mEnd = new Date(mStart.getTime() + 90 * 60 * 1000);
      }
    }

    // Sobreposição temporal exata: max(A, C) < min(B, D)
    const hasOverlap = Math.max(targetStart.getTime(), mStart.getTime()) < Math.min(targetEnd.getTime(), mEnd.getTime());
    if (!hasOverlap) continue;

    const timeRangeStr = `${m.departureTime} às ${m.returnTimeEstimated || m.arrivalTimeEstimated || '??:??'}`;
    const missionDesc = m.description || 'Missão sem título';
    const missionCode = m.code ? `#${m.code}` : '';

    // Coleta veículos desta missão conflitante
    const mVehicles = [];
    if (Array.isArray(m.vehicleAllocations)) {
      m.vehicleAllocations.forEach((a) => {
        if (a?.vehicleId) mVehicles.push(a.vehicleId);
      });
    }
    if (m.vehicleId) mVehicles.push(m.vehicleId);

    for (const vId of mVehicles) {
      if (!result.vehicleConflicts[vId]) {
        result.vehicleConflicts[vId] = {
          missionId: m.id,
          code: missionCode,
          description: missionDesc,
          timeRange: timeRangeStr,
        };
      }
    }

    // Coleta motoristas desta missão conflitante
    const mDrivers = [];
    if (Array.isArray(m.vehicleAllocations)) {
      m.vehicleAllocations.forEach((a) => {
        if (a?.driverId) mDrivers.push(a.driverId);
      });
    }
    if (m.driverId) mDrivers.push(m.driverId);

    for (const dId of mDrivers) {
      if (!result.memberConflicts[dId]) {
        result.memberConflicts[dId] = {
          missionId: m.id,
          code: missionCode,
          description: missionDesc,
          timeRange: timeRangeStr,
          role: 'Motorista',
        };
      }
    }

    // Coleta equipe escalada nesta missão conflitante
    const mTeam = Array.isArray(m.teamIds) ? m.teamIds : [];
    for (const memId of mTeam) {
      if (!result.memberConflicts[memId]) {
        result.memberConflicts[memId] = {
          missionId: m.id,
          code: missionCode,
          description: missionDesc,
          timeRange: timeRangeStr,
          role: 'Equipe de Campo',
        };
      }
    }
  }

  return result;
}

export default function MissionModal({
  isOpen,
  onClose,
  onSaveMission,
  editingMission,
  initialCoords,
  baseLocation,
  fuelPricePerLiter,
  settings = null,
  vehicles = [],
  members = [],
  missions = [],
  currentUser = null,
  userRole = 'user',
}) {
  const effectiveUser = currentUser || getCurrentUser();
  const effectiveRole = normalizeRole(userRole || effectiveUser?.role);
  // REGRA ESTRITA: Apenas Administradores podem ajustar valores de hora extra e remuneração
  const isAdmin = effectiveRole === ROLES.ADMIN;
  const fuelSettings = settings || (typeof fuelPricePerLiter === 'object' ? fuelPricePerLiter : { gasolinePricePerLiter: fuelPricePerLiter || 6.45, dieselPricePerLiter: 6.89 });
  const [formData, setFormData] = useState({
    description: '',
    locationName: '',
    address: '',
    lat: '',
    lon: '',
    date: getLocalTodayStr(),
    eventStartTime: '',
    eventEndTime: '',
    antecedenceMinutes: 30,
    suggestedDepartureTime: '',
    departureTime: '',
    arrivalTimeEstimated: '',
    returnTimeEstimated: '',
    vehicleAllocations: [{ vehicleId: '', driverId: '' }],
    teamIds: [],
    guests: [],
    editionStatus: 'Pendente',
    editorIds: [],
    editorNamesDisplay: '',
    deliveryDeadlineDate: getLocalTodayStr(),
    deliveryDeadlineTime: '18:00',
    editionDeliveryStatus: '',
    isOverdue: 0,
    reopenReason: '',
    missionStatus: 'Agendada',
    isRoundTrip: true,
    notes: '',
    serverFilePath: '',
    equipmentAllocations: [],
    isMultiDay: false,
    endDate: '',
    remunerationType: 'off_hours',
    memberRemunerationTypes: {},
    memberRoles: {},
    customRates: {},
    memberNotes: {},
  });

  const [searchResults, setSearchResults] = useState([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);
  const [searchNoResultsPrompt, setSearchNoResultsPrompt] = useState(false);
  const [guestInput, setGuestInput] = useState('');
  const [guestRoleInput, setGuestRoleInput] = useState('');
  // Recursos forçados/compartilhados (viaturas e colaboradores com autorização de sobreposição)
  const [forcedResources, setForcedResources] = useState(() => new Set());
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [routeInfo, setRouteInfo] = useState({
    distanceKm: 0,
    returnDistanceKm: 0,
    totalRoundTripKm: 0,
    durationMinutes: 0,
    roundTripDurationMinutes: 0,
    coordinates: [],
    returnCoordinates: [],
    estimatedFuelLiters: 0,
    estimatedFuelCost: 0,
  });

  // Estado de Missão de Múltiplos Dias (Mais de um dia / Viagens de Longa Duração)
  const [isMultiDay, setIsMultiDay] = useState(false);

  // Estado de Missão Recorrente (Agendamento Automático de Rotinas / Sessões Semanais)
  const [isRecurring, setIsRecurring] = useState(false);
  const [selectedDows, setSelectedDows] = useState([2, 4]); // Padrão: Terça e Quinta (2x por semana)
  const [recurrenceWeeks, setRecurrenceWeeks] = useState(4); // 4 semanas (1 mês) por padrão
  const [recurrenceEndDate, setRecurrenceEndDate] = useState(() => addWeeksToDate(getLocalTodayStr(), 4));
  const [updateSeries, setUpdateSeries] = useState(false);

  // Estado e Carregamento do Acervo de Equipamentos da Produtora
  const [equipmentList, setEquipmentList] = useState([]);
  const [selectedEquipByPerson, setSelectedEquipByPerson] = useState({});

  useEffect(() => {
    if (isOpen) {
      apiRequest('/rentals.php')
        .then((res) => {
          if (res && res.success && Array.isArray(res.equipment)) {
            setEquipmentList(res.equipment);
          }
        })
        .catch((err) => console.error('Erro ao carregar equipamentos no modal de missão:', err));
    }
  }, [isOpen]);

  const handleAddEquipmentToPerson = (collaboratorId, collaboratorName, role, equipId) => {
    if (!equipId) return;
    const equip = equipmentList.find((e) => e.id === equipId);
    if (!equip) return;

    setFormData((prev) => {
      const currentAllocations = Array.isArray(prev.equipmentAllocations)
        ? JSON.parse(JSON.stringify(prev.equipmentAllocations))
        : [];
      let personGroup = currentAllocations.find((g) => g.collaboratorId === collaboratorId);

      if (!personGroup) {
        personGroup = {
          collaboratorId,
          collaboratorName,
          role,
          items: []
        };
        currentAllocations.push(personGroup);
      }

      const existingItem = personGroup.items.find((it) => it.equipmentId === equip.id);
      if (existingItem) {
        existingItem.quantity = (Number(existingItem.quantity) || 1) + 1;
      } else {
        personGroup.items.push({
          equipmentId: equip.id,
          name: equip.name,
          category: equip.category,
          dailyRate: equip.dailyRate,
          assetValue: equip.assetValue || (equip.dailyRate * 25),
          quantity: 1,
          serialNumber: equip.serialNumber || '',
          notes: ''
        });
      }

      return {
        ...prev,
        equipmentAllocations: currentAllocations
      };
    });

    setSelectedEquipByPerson((prev) => ({ ...prev, [collaboratorId]: '' }));
  };

  const handleRemoveEquipmentFromPerson = (collaboratorId, equipId) => {
    setFormData((prev) => {
      const currentAllocations = (prev.equipmentAllocations || []).map((g) => {
        if (g.collaboratorId === collaboratorId) {
          return {
            ...g,
            items: (g.items || []).filter((it) => it.equipmentId !== equipId)
          };
        }
        return g;
      }).filter((g) => (g.items && g.items.length > 0) || (g.customNotes && g.customNotes.trim()) || g.collaboratorId === 'general');

      return {
        ...prev,
        equipmentAllocations: currentAllocations
      };
    });
  };

  const handleUpdateEquipmentQuantity = (collaboratorId, equipId, delta) => {
    setFormData((prev) => {
      const currentAllocations = (prev.equipmentAllocations || []).map((g) => {
        if (g.collaboratorId === collaboratorId) {
          return {
            ...g,
            items: (g.items || []).map((it) => {
              if (it.equipmentId === equipId) {
                const nextQ = Math.max(1, (Number(it.quantity) || 1) + delta);
                return { ...it, quantity: nextQ };
              }
              return it;
            })
          };
        }
        return g;
      });

      return {
        ...prev,
        equipmentAllocations: currentAllocations
      };
    });
  };

  const handleUpdateEquipmentNote = (collaboratorId, equipId, note) => {
    setFormData((prev) => {
      const currentAllocations = (prev.equipmentAllocations || []).map((g) => {
        if (g.collaboratorId === collaboratorId) {
          return {
            ...g,
            items: (g.items || []).map((it) => {
              if (it.equipmentId === equipId) {
                return { ...it, notes: note };
              }
              return it;
            })
          };
        }
        return g;
      });

      return {
        ...prev,
        equipmentAllocations: currentAllocations
      };
    });
  };

  const handleUpdatePersonCustomNotes = (collaboratorId, collaboratorName, role, customNotes) => {
    setFormData((prev) => {
      const currentAllocations = Array.isArray(prev.equipmentAllocations)
        ? JSON.parse(JSON.stringify(prev.equipmentAllocations))
        : [];
      let personGroup = currentAllocations.find((g) => g.collaboratorId === collaboratorId);

      const roleStr = typeof role === 'string' ? role : (Array.isArray(role) ? role.join(' • ') : 'Colaborador');

      if (!personGroup) {
        personGroup = {
          collaboratorId,
          collaboratorName: collaboratorName || 'Colaborador',
          role: roleStr,
          customNotes: customNotes,
          items: []
        };
        currentAllocations.push(personGroup);
      } else {
        personGroup.customNotes = customNotes;
        if (collaboratorName) personGroup.collaboratorName = collaboratorName;
        if (roleStr) personGroup.role = roleStr;
      }

      const nextMemberNotes = { ...(prev.memberNotes || {}), [collaboratorId]: customNotes };

      return {
        ...prev,
        memberNotes: nextMemberNotes,
        equipmentAllocations: currentAllocations
      };
    });
  };

  // Filtros rápidos e busca da Equipe de Campo (Passo 5)
  const [teamSearchQuery, setTeamSearchQuery] = useState('');
  const [teamFilterTab, setTeamFilterTab] = useState('ALL'); // 'ALL' | 'SELECTED' | company | 'DRIVERS'

  // Extrai autonomias de todas as viaturas alocadas para somar o consumo total
  const getAutonomiesFromAllocations = (allocations = []) => {
    const validAllocs = allocations.filter((a) => a && a.vehicleId);
    if (validAllocs.length === 0) return [12];
    return validAllocs.map((a) => {
      const v = vehicles.find((veh) => veh.id === a.vehicleId);
      return v?.autonomyKmPerLiter || 12;
    });
  };

  // Extrai detalhamento por viatura para cálculo diferenciado de Gasolina / Diesel
  const getVehicleBreakdownsFromAllocations = (allocations = []) => {
    const validAllocs = allocations.filter((a) => a && a.vehicleId);
    return validAllocs.map((a) => {
      const v = vehicles.find((veh) => veh.id === a.vehicleId);
      return {
        vehicle: v,
        autonomy: v?.autonomyKmPerLiter || 12,
      };
    });
  };

  // Inicializa dados ao abrir para edição ou com coordenada inicial
  useEffect(() => {
    if (!isOpen) return;
    if (editingMission) {
      const normalizedAllocs = getMissionAllocations(editingMission, vehicles, members);
      const initialAllocations =
        normalizedAllocs.length > 0
          ? normalizedAllocs.map((a) => ({
            vehicleId: a.vehicleId || '',
            driverId: a.driverId || '',
          }))
          : [
            {
              vehicleId: vehicles[0]?.id || '',
              driverId: editingMission.driverId || editingMission.teamIds?.[0] || '',
            },
          ];

      const initialEditorIds = editingMission.editorIds || (editingMission.editorId ? [editingMission.editorId] : []);

      // Se notes contiver a injeção automática de servidor ("... Servidor: ..."), separa para não poluir o briefing de campo:
      let cleanedNotes = editingMission.notes || '';
      let extractedServerPath = editingMission.serverFilePath || '';

      if (cleanedNotes.includes('Servidor:')) {
        const lines = cleanedNotes.split('\n');
        const validLines = [];
        for (const line of lines) {
          if (line.includes('Servidor:') && (line.includes('GMT') || line.includes('/') || line.includes('['))) {
            const match = line.match(/Servidor:\s*(.+)$/i);
            if (match && match[1] && !extractedServerPath) {
              extractedServerPath = match[1].trim();
            }
          } else {
            validLines.push(line);
          }
        }
        cleanedNotes = validLines.join('\n').trim();
      }

      setFormData({
        ...editingMission,
        notes: cleanedNotes,
        serverFilePath: editingMission.serverFilePath || extractedServerPath || '',
        eventStartTime: editingMission.eventStartTime || '',
        eventEndTime: editingMission.eventEndTime || '',
        antecedenceMinutes: editingMission.antecedenceMinutes !== undefined && editingMission.antecedenceMinutes !== null ? Number(editingMission.antecedenceMinutes) : 30,
        suggestedDepartureTime: editingMission.suggestedDepartureTime || '',
        lat: editingMission.lat || '',
        lon: editingMission.lon || '',
        vehicleAllocations: initialAllocations,
        teamIds: editingMission.teamIds || [],
        guests: Array.isArray(editingMission.guests) ? editingMission.guests : [],
        editorIds: initialEditorIds,
        editorNamesDisplay: editingMission.editorNamesDisplay || editingMission.editorName || '',
        deliveryDeadlineDate: editingMission.deliveryDeadlineDate || editingMission.date || getLocalTodayStr(),
        deliveryDeadlineTime: editingMission.deliveryDeadlineTime || '18:00',
        editionDeliveryStatus: editingMission.editionDeliveryStatus || '',
        isOverdue: editingMission.isOverdue || 0,
        reopenReason: editingMission.reopenReason || '',
        isRoundTrip: true,
        equipmentAllocations: Array.isArray(editingMission.equipmentAllocations) ? editingMission.equipmentAllocations : [],
        isMultiDay: Boolean(editingMission.isMultiDay || (editingMission.endDate && editingMission.endDate !== editingMission.date)),
        endDate: editingMission.endDate || '',
        remunerationType: !isAdmin
          ? 'off_hours'
          : (editingMission.remunerationType
            ? editingMission.remunerationType
            : (Boolean(editingMission.isMultiDay || (editingMission.endDate && editingMission.endDate !== editingMission.date)) ? 'daily' : 'off_hours')),
        memberRemunerationTypes: !isAdmin ? {} : (editingMission.memberRemunerationTypes || {}),
        memberRoles: editingMission.memberRoles || {},
        customRates: !isAdmin ? {} : (editingMission.customRates || {}),
        memberNotes: (() => {
          const mNotes = { ...(editingMission.memberNotes || {}) };
          if (Array.isArray(editingMission.equipmentAllocations)) {
            editingMission.equipmentAllocations.forEach((g) => {
              if (g && g.collaboratorId && g.customNotes && !mNotes[g.collaboratorId]) {
                mNotes[g.collaboratorId] = g.customNotes;
              }
            });
          }
          return mNotes;
        })(),
        isRecurring: Boolean(editingMission.isRecurring || editingMission.recurrenceId),
        recurrenceId: editingMission.recurrenceId || null,
        recurrenceRule: editingMission.recurrenceRule || 'weekly',
        recurrenceDays: editingMission.recurrenceDays || '',
      });

      const isMDay = Boolean(editingMission.isMultiDay || (editingMission.endDate && editingMission.endDate !== editingMission.date));
      setIsMultiDay(isMDay);

      const isRec = Boolean(editingMission.isRecurring || editingMission.recurrenceId);
      setIsRecurring(isRec);
      setUpdateSeries(false);
      const baseDow = getDayOfWeekFromDate(editingMission.date);
      if (editingMission.recurrenceDays) {
        const found = [];
        RECURRENCE_DAYS.forEach((d) => {
          if (editingMission.recurrenceDays.includes(d.short)) {
            found.push(d.dow);
          }
        });
        setSelectedDows(found.length > 0 ? found : [baseDow]);
      } else {
        setSelectedDows([baseDow]);
      }
      setRecurrenceWeeks(4);
      setRecurrenceEndDate(addWeeksToDate(editingMission.date || getLocalTodayStr(), 4));
      setRouteInfo({
        distanceKm: editingMission.distanceKm || 0,
        returnDistanceKm: editingMission.returnDistanceKm || editingMission.distanceKm || 0,
        totalRoundTripKm: editingMission.totalDistanceKm || (editingMission.distanceKm || 0) * 2,
        durationMinutes: editingMission.drivingDurationMinutes || 0,
        roundTripDurationMinutes:
          editingMission.roundTripDurationMinutes || (editingMission.drivingDurationMinutes || 0) * 2,
        coordinates: editingMission.routeCoordinates || [],
        returnCoordinates: editingMission.returnCoordinates || [],
        estimatedFuelLiters: editingMission.estimatedFuelLiters || 0,
        estimatedFuelCost: editingMission.estimatedFuelCost || 0,
      });
    } else {
      const defaultVehicle = vehicles[0]?.id || '';

      setFormData({
        description: '',
        locationName: '',
        address: '',
        lat: initialCoords ? initialCoords.lat : '',
        lon: initialCoords ? initialCoords.lon : '',
        date: getLocalTodayStr(),
        eventStartTime: '',
        eventEndTime: '',
        antecedenceMinutes: 30,
        suggestedDepartureTime: '',
        departureTime: '',
        arrivalTimeEstimated: '',
        returnTimeEstimated: '',
        vehicleAllocations: [{ vehicleId: defaultVehicle, driverId: '' }],
        teamIds: [],
        guests: [],
        editionStatus: 'Pendente',
        editorIds: [],
        editorNamesDisplay: '',
        deliveryDeadlineDate: getLocalTodayStr(),
        deliveryDeadlineTime: '18:00',
        editionDeliveryStatus: '',
        isOverdue: 0,
        reopenReason: '',
        missionStatus: 'Agendada',
        isRoundTrip: true,
        notes: '',
        serverFilePath: '',
        equipmentAllocations: [],
        isMultiDay: false,
        endDate: '',
        remunerationType: 'off_hours',
        memberRemunerationTypes: {},
        memberRoles: {},
        customRates: {},
        isRecurring: false,
        recurrenceId: null,
        recurrenceRule: 'weekly',
        recurrenceDays: '',
      });

      setIsMultiDay(false);
      setIsRecurring(false);
      setUpdateSeries(false);
      const baseDate = initialCoords?.date || getLocalTodayStr();
      const baseDow = getDayOfWeekFromDate(baseDate);
      // Sugere o dia base + um dia complementar (ex: Terça e Quinta para 2x por semana)
      const pairedDow = (baseDow === 2) ? 4 : (baseDow === 4) ? 2 : (baseDow === 1) ? 3 : (baseDow === 3) ? 1 : ((baseDow + 2) % 7);
      setSelectedDows([baseDow, pairedDow]);
      setRecurrenceWeeks(4);
      setRecurrenceEndDate(addWeeksToDate(baseDate, 4));
    }
    setTeamSearchQuery('');
    setTeamFilterTab('ALL');
  }, [isOpen, editingMission, initialCoords]);

  // Manipuladores de Missão de Múltiplos Dias (Mais de um dia / Longa Duração)
  const handleToggleMultiDay = (checked) => {
    setIsMultiDay(checked);
    setFormData((prev) => {
      let nextEndDate = prev.endDate;
      if (checked && (!nextEndDate || nextEndDate < prev.date)) {
        try {
          const [y, m, d] = (prev.date || getLocalTodayStr()).split('-').map(Number);
          const dt = new Date(Date.UTC(y, m - 1, d + 1));
          const yyyy = dt.getUTCFullYear();
          const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
          const dd = String(dt.getUTCDate()).padStart(2, '0');
          nextEndDate = `${yyyy}-${mm}-${dd}`;
        } catch (e) {
          nextEndDate = prev.date;
        }
      }
      return {
        ...prev,
        isMultiDay: checked,
        endDate: checked ? nextEndDate : '',
        remunerationType: checked
          ? (isAdmin ? 'daily' : 'off_hours')
          : (prev.remunerationType || 'off_hours'),
      };
    });
  };

  // Manipuladores de Missão Recorrente
  const handleToggleRecurrence = (checked) => {
    setIsRecurring(checked);
    if (checked) {
      const baseDow = getDayOfWeekFromDate(formData.date || getLocalTodayStr());
      if (!selectedDows.includes(baseDow)) {
        setSelectedDows((prev) => [...prev, baseDow]);
      }
      if (!recurrenceEndDate) {
        setRecurrenceEndDate(addWeeksToDate(formData.date || getLocalTodayStr(), recurrenceWeeks || 4));
      }
    }
  };

  const handleToggleDow = (dow) => {
    setSelectedDows((prev) => {
      if (prev.includes(dow)) {
        if (prev.length === 1) return prev; // Garante que pelo menos 1 dia fique selecionado
        return prev.filter((d) => d !== dow);
      } else {
        return [...prev, dow];
      }
    });
  };

  const handleSetRecurrenceWeeks = (weeks) => {
    setRecurrenceWeeks(weeks);
    setRecurrenceEndDate(addWeeksToDate(formData.date || getLocalTodayStr(), weeks));
  };

  // Calcula dinamicamente as datas do ciclo recorrente (Data inicial até Data limite)
  const calculatedRecurrenceDates = useMemo(() => {
    if (!isRecurring || !formData.date || !recurrenceEndDate) return [];
    return generateRecurrenceDates(formData.date, selectedDows, recurrenceEndDate, 40);
  }, [isRecurring, formData.date, selectedDows, recurrenceEndDate]);

  // Lista das ocorrências futuras geradas (excluindo a missão base de hoje)
  const futureOccurrenceDates = useMemo(() => {
    if (!isRecurring) return [];
    return calculatedRecurrenceDates.filter((d) => d !== formData.date);
  }, [isRecurring, calculatedRecurrenceDates, formData.date]);

  // Recalcula rota e combustível quando lat/lon ou viaturas alocadas mudam
  const updateRouteCalculations = async (destLat, destLon, allocationsOverride = null) => {
    if (!destLat || !destLon || !baseLocation?.lat) return;

    setIsCalculatingRoute(true);
    try {
      const routeRes = await fetchRouteOSRM(
        baseLocation.lat,
        baseLocation.lon,
        parseFloat(destLat),
        parseFloat(destLon)
      );

      const activeAllocs = allocationsOverride || formData.vehicleAllocations;
      const autonomies = getAutonomiesFromAllocations(activeAllocs);
      const breakdowns = getVehicleBreakdownsFromAllocations(activeAllocs);

      const fuelRes = calculateFuelEstimate({
        distanceKm: routeRes.distanceKm,
        totalRoundTripKm: routeRes.totalRoundTripKm,
        vehicleBreakdowns: breakdowns.length > 0 ? breakdowns : null,
        autonomies,
        fuelPricePerLiter: fuelSettings,
      });

      const arrivalTime = formData.departureTime
        ? calculateArrivalTime(formData.departureTime, routeRes.durationMinutes)
        : '';

      setRouteInfo({
        distanceKm: routeRes.distanceKm,
        returnDistanceKm: routeRes.returnDistanceKm || routeRes.distanceKm,
        totalRoundTripKm:
          routeRes.totalRoundTripKm || parseFloat((routeRes.distanceKm * 2).toFixed(2)),
        durationMinutes: routeRes.durationMinutes,
        roundTripDurationMinutes:
          routeRes.roundTripDurationMinutes || routeRes.durationMinutes * 2,
        coordinates: routeRes.coordinates,
        returnCoordinates: routeRes.returnCoordinates || [],
        estimatedFuelLiters: fuelRes.litersNeeded,
        estimatedFuelCost: fuelRes.estimatedCost,
      });

      setFormData((prev) => ({
        ...prev,
        arrivalTimeEstimated: arrivalTime,
      }));
    } catch (e) {
      console.warn('Erro ao atualizar rota:', e);
    } finally {
      setIsCalculatingRoute(false);
    }
  };

  // Atualiza consumo instantaneamente quando a lista de viaturas ou horário de saída muda
  useEffect(() => {
    if (!routeInfo.distanceKm && (!formData.lat || !formData.lon)) return;

    if (routeInfo.distanceKm > 0) {
      const autonomies = getAutonomiesFromAllocations(formData.vehicleAllocations);
      const breakdowns = getVehicleBreakdownsFromAllocations(formData.vehicleAllocations);
      const fuelRes = calculateFuelEstimate({
        distanceKm: routeInfo.distanceKm,
        totalRoundTripKm: routeInfo.totalRoundTripKm,
        vehicleBreakdowns: breakdowns.length > 0 ? breakdowns : null,
        autonomies,
        fuelPricePerLiter: fuelSettings,
      });
      const arrivalTime = formData.departureTime
        ? calculateArrivalTime(formData.departureTime, routeInfo.durationMinutes)
        : '';

      setRouteInfo((prev) => ({
        ...prev,
        estimatedFuelLiters: fuelRes.litersNeeded,
        estimatedFuelCost: fuelRes.estimatedCost,
      }));
      setFormData((prev) => ({
        ...prev,
        arrivalTimeEstimated: arrivalTime,
      }));
    } else if (formData.lat && formData.lon) {
      updateRouteCalculations(formData.lat, formData.lon, formData.vehicleAllocations);
    }
  }, [JSON.stringify(formData.vehicleAllocations), formData.departureTime]);

  // Busca de endereço Nominatim com suporte a coordenadas diretas e busca no mapa
  const handleAddressSearch = async () => {
    const query = (formData.address || formData.locationName || '').trim();
    if (!query) return;

    // 1. Verifica se o usuário digitou ou colou coordenadas diretamente no campo
    const parsedCoords = parseCoordinatesFromText(query);
    if (parsedCoords) {
      setIsSearchingAddress(true);
      const latFixed = parsedCoords.lat.toFixed(6);
      const lonFixed = parsedCoords.lon.toFixed(6);
      const rev = await reverseGeocodeNominatim(latFixed, lonFixed);
      const cleanAddr = rev?.shortName || query;
      const formatted = formatAddressWithCoordinates(cleanAddr, latFixed, lonFixed);

      setFormData((prev) => ({
        ...prev,
        lat: latFixed,
        lon: lonFixed,
        address: formatted,
        locationName: prev.locationName || rev?.shortName || 'Local Personalizado',
      }));
      setSearchResults([]);
      setSearchNoResultsPrompt(false);
      updateRouteCalculations(latFixed, lonFixed, formData.vehicleAllocations);
      setIsSearchingAddress(false);
      return;
    }

    // 2. Busca textual normal no Nominatim
    setIsSearchingAddress(true);
    const results = await searchAddressNominatim(query);
    setSearchResults(results);
    setSearchNoResultsPrompt(results.length === 0);
    setIsSearchingAddress(false);
  };

  const handleSelectSearchResult = (res) => {
    const latFixed = Number(res.lat).toFixed(6);
    const lonFixed = Number(res.lon).toFixed(6);
    const formattedAddress = formatAddressWithCoordinates(res.name, latFixed, lonFixed);

    setFormData((prev) => ({
      ...prev,
      address: formattedAddress,
      locationName: prev.locationName || res.shortName,
      lat: latFixed,
      lon: lonFixed,
    }));
    setSearchResults([]);
    setSearchNoResultsPrompt(false);
    updateRouteCalculations(latFixed, lonFixed, formData.vehicleAllocations);
  };

  const handleConfirmMapPicker = ({ lat, lon, address, shortName }) => {
    setFormData((prev) => ({
      ...prev,
      lat,
      lon,
      address,
      locationName: prev.locationName || shortName,
    }));
    setSearchResults([]);
    setSearchNoResultsPrompt(false);
    updateRouteCalculations(lat, lon, formData.vehicleAllocations);
  };

  // ---- Cálculo Inteligente de Horário Máximo de Saída ----
  const dynamicSuggestedDeparture = useMemo(() => {
    if (!formData.eventStartTime) return null;
    return calculateSuggestedDepartureTime(
      formData.eventStartTime,
      routeInfo.durationMinutes,
      formData.antecedenceMinutes || 30
    );
  }, [formData.eventStartTime, routeInfo.durationMinutes, formData.antecedenceMinutes]);

  const handleEventStartTimeChange = (val) => {
    const sug = calculateSuggestedDepartureTime(
      val,
      routeInfo.durationMinutes,
      formData.antecedenceMinutes || 30
    );
    setFormData((prev) => {
      const updated = {
        ...prev,
        eventStartTime: val,
        suggestedDepartureTime: sug || prev.suggestedDepartureTime,
      };
      if (sug && (prev.departureTime === '08:00' || !prev.departureTime)) {
        updated.departureTime = sug;
        updated.arrivalTimeEstimated = calculateArrivalTime(sug, routeInfo.durationMinutes);
      }
      return updated;
    });
  };

  const handleEventEndTimeChange = (val) => {
    setFormData((prev) => {
      const updated = {
        ...prev,
        eventEndTime: val,
      };
      const dur = routeInfo.durationMinutes || 0;
      if (val && dur > 0) {
        const estReturn = calculateArrivalTime(val, dur);
        if (estReturn && (!prev.returnTimeEstimated || prev.returnTimeEstimated === '18:00')) {
          updated.returnTimeEstimated = estReturn;
        }
      }
      return updated;
    });
  };

  const handleAntecedenceChange = (mins) => {
    const sug = calculateSuggestedDepartureTime(
      formData.eventStartTime,
      routeInfo.durationMinutes,
      mins
    );
    setFormData((prev) => ({
      ...prev,
      antecedenceMinutes: mins,
      suggestedDepartureTime: sug || prev.suggestedDepartureTime,
    }));
  };

  const applySuggestedDepartureTime = (sugTime) => {
    if (!sugTime) return;
    const arrival = calculateArrivalTime(sugTime, routeInfo.durationMinutes);
    setFormData((prev) => ({
      ...prev,
      departureTime: sugTime,
      arrivalTimeEstimated: arrival,
      suggestedDepartureTime: sugTime,
    }));
  };

  // ---- Gerenciamento de Convidados Externos / Freelancers com Funções Oficiais ----
  const handleAddGuest = (e) => {
    if (e) e.preventDefault();
    const trimmed = (guestInput || '').trim();
    if (!trimmed) return;
    const currentGuests = Array.isArray(formData.guests) ? formData.guests : [];
    const exists = currentGuests.some(
      (g) => (typeof g === 'string' ? g : g.name).toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      setGuestInput('');
      setGuestRoleInput('');
      return;
    }
    const newGuest = {
      name: trimmed,
      role: guestRoleInput || '',
      roles: guestRoleInput ? [guestRoleInput] : [],
    };
    setFormData((prev) => ({
      ...prev,
      guests: [...(Array.isArray(prev.guests) ? prev.guests : []), newGuest],
    }));
    setGuestInput('');
    setGuestRoleInput('');
  };

  const handleRemoveGuest = (indexToRemove) => {
    setFormData((prev) => ({
      ...prev,
      guests: (Array.isArray(prev.guests) ? prev.guests : []).filter((_, idx) => idx !== indexToRemove),
    }));
  };

  const handleAddGuestRole = (guestIndex, roleToAdd) => {
    if (!roleToAdd) return;
    setFormData((prev) => {
      const currentGuests = Array.isArray(prev.guests) ? [...prev.guests] : [];
      const targetGuest = currentGuests[guestIndex];
      if (!targetGuest) return prev;

      const guestObj = typeof targetGuest === 'string'
        ? { name: targetGuest, role: '', roles: [] }
        : { ...targetGuest };

      const prevRoles = Array.isArray(guestObj.roles)
        ? [...guestObj.roles]
        : (guestObj.role ? [guestObj.role] : []);

      if (!prevRoles.includes(roleToAdd)) {
        prevRoles.push(roleToAdd);
      }
      guestObj.roles = prevRoles;
      guestObj.role = prevRoles[0] || '';

      currentGuests[guestIndex] = guestObj;
      return {
        ...prev,
        guests: currentGuests,
      };
    });
  };

  const handleRemoveGuestRole = (guestIndex, roleToRemove) => {
    setFormData((prev) => {
      const currentGuests = Array.isArray(prev.guests) ? [...prev.guests] : [];
      const targetGuest = currentGuests[guestIndex];
      if (!targetGuest) return prev;

      const guestObj = typeof targetGuest === 'string'
        ? { name: targetGuest, role: '', roles: [] }
        : { ...targetGuest };

      const prevRoles = Array.isArray(guestObj.roles)
        ? guestObj.roles.filter((r) => r !== roleToRemove)
        : (guestObj.role === roleToRemove ? [] : [guestObj.role]);

      guestObj.roles = prevRoles;
      guestObj.role = prevRoles[0] || '';

      currentGuests[guestIndex] = guestObj;
      return {
        ...prev,
        guests: currentGuests,
      };
    });
  };

  // ---- Gerenciamento de Múltiplas Viaturas & Motoristas ----
  const handleAddVehicleAllocation = () => {
    setFormData((prev) => {
      const usedVehicleIds = prev.vehicleAllocations.map((a) => a.vehicleId);
      const usedDriverIds = prev.vehicleAllocations.map((a) => a.driverId);
      const nextAvailableVehicle =
        vehicles.find((v) => !usedVehicleIds.includes(v.id))?.id || vehicles[0]?.id || '';
      // Dá prioridade aos membros habilitados (com CNH) que ainda não foram alocados
      const nextAvailableDriver =
        members.find((m) => Boolean(m.canDrive ?? m.hasCnh) && prev.teamIds.includes(m.id) && !usedDriverIds.includes(m.id))?.id ||
        members.find((m) => Boolean(m.canDrive ?? m.hasCnh) && !usedDriverIds.includes(m.id))?.id ||
        members.find((m) => prev.teamIds.includes(m.id) && !usedDriverIds.includes(m.id))?.id ||
        members.find((m) => !usedDriverIds.includes(m.id))?.id ||
        '';
      const nextTeam =
        nextAvailableDriver && !prev.teamIds.includes(nextAvailableDriver)
          ? [...prev.teamIds, nextAvailableDriver]
          : prev.teamIds;

      return {
        ...prev,
        vehicleAllocations: [
          ...prev.vehicleAllocations,
          { vehicleId: nextAvailableVehicle, driverId: nextAvailableDriver },
        ],
        teamIds: nextTeam,
      };
    });
  };

  const handleRemoveVehicleAllocation = (indexToRemove) => {
    setFormData((prev) => {
      const nextAllocs = prev.vehicleAllocations.filter((_, idx) => idx !== indexToRemove);
      return {
        ...prev,
        vehicleAllocations:
          nextAllocs.length > 0 ? nextAllocs : [{ vehicleId: '', driverId: '' }],
      };
    });
  };

  const handleChangeAllocationVehicle = async (index, newVehicleId) => {
    if (!newVehicleId) {
      setFormData((prev) => {
        const copy = [...prev.vehicleAllocations];
        copy[index] = { ...copy[index], vehicleId: '' };
        return { ...prev, vehicleAllocations: copy };
      });
      return;
    }

    const vConflict = scheduleConflicts.vehicleConflicts[newVehicleId];
    if (vConflict) {
      const veh = vehicles.find((v) => v.id === newVehicleId);
      const vehLabel = veh ? `${veh.name} (${veh.plate})` : 'Viatura selecionada';
      const proceed = await confirmDialog({
        title: '⚠️ Viatura Ocupada em Outra Missão',
        message: `A viatura ${vehLabel} já está designada para a missão ${vConflict.code} "${vConflict.description}" no horário de ${vConflict.timeRange}.\n\nVocê concorda que este veículo participe também desta missão simultaneamente?\n(Ex: apoio conjunto a serviços próximos ou atendimento sequencial de campo sem retorno à base).`,
        confirmText: 'Sim, Concordo e Forçar Viatura',
        cancelText: 'Escolher Outra Viatura',
        variant: 'warning',
      });
      if (!proceed) return;
      setForcedResources((prev) => new Set(prev).add(`vehicle-${newVehicleId}`));
    }

    setFormData((prev) => {
      const copy = [...prev.vehicleAllocations];
      copy[index] = { ...copy[index], vehicleId: newVehicleId };
      return { ...prev, vehicleAllocations: copy };
    });
  };

  const handleChangeAllocationDriver = async (index, newDriverId) => {
    if (!newDriverId) {
      setFormData((prev) => {
        const copy = [...prev.vehicleAllocations];
        copy[index] = { ...copy[index], driverId: '' };
        return { ...prev, vehicleAllocations: copy };
      });
      return;
    }

    const dConflict = scheduleConflicts.memberConflicts[newDriverId];
    if (dConflict) {
      const drv = members.find((m) => m.id === newDriverId);
      const drvLabel = drv ? drv.name : 'Colaborador';
      const proceed = await confirmDialog({
        title: '⚠️ Motorista Escalado em Outra Missão',
        message: `O colaborador/condutor ${drvLabel} já está escalado na missão ${dConflict.code} "${dConflict.description}" no horário de ${dConflict.timeRange}.\n\nVocê concorda que este condutor participe também desta outra missão?\n(Ex: deslocamento direto de campo ou atuação simultânea).`,
        confirmText: 'Sim, Concordo e Forçar Motorista',
        cancelText: 'Escolher Outro Condutor',
        variant: 'warning',
      });
      if (!proceed) return;
      setForcedResources((prev) => new Set(prev).add(`member-${newDriverId}`));
    }

    setFormData((prev) => {
      const copy = [...prev.vehicleAllocations];
      copy[index] = { ...copy[index], driverId: newDriverId };
      const nextTeam =
        newDriverId && !prev.teamIds.includes(newDriverId)
          ? [...prev.teamIds, newDriverId]
          : prev.teamIds;
      return { ...prev, vehicleAllocations: copy, teamIds: nextTeam };
    });
  };

  // Toggle membros da equipe (SEMPRE LIVRE, INDEPENDENTE DE PÓS-PRODUÇÃO)
  const toggleTeamMember = async (memberId) => {
    const exists = formData.teamIds.includes(memberId);
    if (!exists) {
      const member = members.find((m) => m.id === memberId);
      if (member) {
        // 1. Verificação de sobreposição com outra missão no mesmo horário
        const mConflict = scheduleConflicts.memberConflicts[memberId];
        if (mConflict) {
          const proceedConflict = await confirmDialog({
            title: '⚠️ Colaborador Escalado em Outra Missão',
            message: `${member.name} já faz parte da equipe na missão ${mConflict.code} "${mConflict.description}" no horário de ${mConflict.timeRange}.\n\nVocê concorda que este colaborador participe também desta missão simultaneamente?\n(Ex: eventos próximos, deslocamento direto sem retorno à base ou cobertura compartilhada).`,
            confirmText: 'Sim, Concordo e Forçar Participação',
            cancelText: 'Voltar (Não Escalar)',
            variant: 'warning',
          });
          if (!proceedConflict) return;
          setForcedResources((prev) => new Set(prev).add(`member-${memberId}`));
        }

        // 2. Verificação de indisponibilidade declarada para horas extras
        const availCheck = checkMemberExtraHoursAvailability(
          member,
          formData.date,
          formData.departureTime,
          formData.returnTimeEstimated || formData.returnTime,
          formData.isMultiDay,
          formData.endDate
        );
        if (availCheck.isUnavailable) {
          const proceed = await confirmDialog({
            title: '🚫 Colaborador Indisponível para Horas Extras',
            message: `${member.name} declarou no Meu Espaço que NÃO estará disponível para atividades fora do expediente regular neste horário.`,
            description: `Motivo informado pelo colaborador: "${availCheck.reason}" (${availCheck.periodLabel || 'Período fora do expediente'}).\n\nDeseja forçar a inclusão na equipe mesmo assim?`,
            confirmText: 'Forçar Inclusão Excepcional',
            cancelText: 'Voltar (Não Escalar)',
            variant: 'danger',
          });
          if (!proceed) return;
        }
      }
    }

    setFormData((prev) => {
      const existsNow = prev.teamIds.includes(memberId);
      const newTeam = existsNow
        ? prev.teamIds.filter((id) => id !== memberId)
        : [...prev.teamIds, memberId];

      // Se removeu da equipe alguém que estava como motorista, limpa ou passa para outro
      const updatedAllocs = prev.vehicleAllocations.map((alloc) => {
        if (existsNow && alloc.driverId === memberId) {
          return { ...alloc, driverId: newTeam[0] || '' };
        }
        return alloc;
      });

      return { ...prev, teamIds: newTeam, vehicleAllocations: updatedAllocs };
    });
  };

  // Toggle editores designados para a pós-produção
  const toggleEditor = (memberId) => {
    if (formData.editionStatus === 'Não se aplica') return;
    setFormData((prev) => {
      const current = prev.editorIds || [];
      const exists = current.includes(memberId);
      const next = exists ? current.filter((id) => id !== memberId) : [...current, memberId];
      return { ...prev, editorIds: next };
    });
  };

  // Botão rápido "Motorista" no card do colaborador: atribui à 1ª viatura sem motorista (ou alterna)
  const handleToggleMemberAsDriver = async (memberId) => {
    const existingIndex = formData.vehicleAllocations.findIndex((a) => a.driverId === memberId);
    if (existingIndex < 0) {
      const member = members.find((m) => m.id === memberId);
      if (member) {
        const availCheck = checkMemberExtraHoursAvailability(
          member,
          formData.date,
          formData.departureTime,
          formData.returnTimeEstimated || formData.returnTime,
          formData.isMultiDay,
          formData.endDate
        );
        if (availCheck.isUnavailable) {
          const proceed = await confirmDialog({
            title: '🚫 Motorista Indisponível para Horas Extras',
            message: `${member.name} declarou no Meu Espaço que NÃO estará disponível para atividades fora do expediente regular neste horário.`,
            description: `Motivo informado: "${availCheck.reason}" (${availCheck.periodLabel || 'Período fora do expediente'}).\n\nDeseja escalar como condutor mesmo assim?`,
            confirmText: 'Forçar Escalação',
            cancelText: 'Cancelar',
            variant: 'danger',
          });
          if (!proceed) return;
        }
      }
    }

    setFormData((prev) => {
      const existingIdx = prev.vehicleAllocations.findIndex((a) => a.driverId === memberId);
      const copy = [...prev.vehicleAllocations];

      if (existingIdx >= 0) {
        copy[existingIdx] = { ...copy[existingIdx], driverId: '' };
        return { ...prev, vehicleAllocations: copy };
      }

      const emptySlotIndex = copy.findIndex((a) => !a.driverId);
      const targetIndex = emptySlotIndex >= 0 ? emptySlotIndex : 0;
      copy[targetIndex] = { ...copy[targetIndex], driverId: memberId };

      const nextTeam = !prev.teamIds.includes(memberId)
        ? [...prev.teamIds, memberId]
        : prev.teamIds;

      return { ...prev, vehicleAllocations: copy, teamIds: nextTeam };
    });
  };

  const currentTotalRoundTripKm =
    routeInfo.totalRoundTripKm || parseFloat(((routeInfo.distanceKm || 0) * 2).toFixed(2));
  const pricePerLiterVal = fuelSettings;

  // Calcula o impacto detalhado no tanque e eventual excedente (> 1 tanque) para cada viatura alocada
  const allocBreakdowns = formData.vehicleAllocations.map((alloc) => {
    const veh = vehicles.find((v) => v.id === alloc.vehicleId) || null;
    if (!veh) return null;
    const currentTelemetry = computeVehicleFuelTelemetry(
      veh,
      missions,
      pricePerLiterVal,
      editingMission?.id || null
    );
    return {
      vehicle: veh,
      currentTelemetry,
      breakdown: computeMissionVehicleFuelBreakdown({
        vehicle: veh,
        totalRoundTripKm: currentTotalRoundTripKm,
        currentTelemetry,
        fuelPricePerLiter: pricePerLiterVal,
      }),
    };
  });

  const validBreakdowns = allocBreakdowns.filter(Boolean);
  const anyExceedsFullTank = validBreakdowns.some((b) => b.breakdown.exceedsFullTankCapacity);
  const totalExcessOverFullTankLiters = parseFloat(
    validBreakdowns
      .reduce((acc, b) => acc + (b.breakdown.excessOverFullTankLiters || 0), 0)
      .toFixed(2)
  );
  const totalExcessOverFullTankCost = parseFloat(
    validBreakdowns
      .reduce((acc, b) => acc + (b.breakdown.excessOverFullTankCost || 0), 0)
      .toFixed(2)
  );

  // Identificação proativa e em tempo real de conflitos com viaturas e colaboradores
  const scheduleConflicts = useMemo(
    () => getScheduleConflicts(formData, missions, editingMission?.id),
    [formData.date, formData.departureTime, formData.returnTimeEstimated, formData.arrivalTimeEstimated, missions, editingMission?.id]
  );

  const activeTeamConflicts = useMemo(() => {
    return (formData.teamIds || [])
      .map((mId) => {
        const mem = members.find((x) => x.id === mId);
        const conf = scheduleConflicts.memberConflicts[mId];
        return conf ? { id: mId, name: mem?.name || 'Colaborador', conflict: conf } : null;
      })
      .filter(Boolean);
  }, [formData.teamIds, scheduleConflicts, members]);

  // Cálculo inteligente em tempo real de horas fora do expediente comercial (Banco de Horas)
  // Regras: Seg-Sex 08h às 18h e Sáb 08h às 12h = Comercial normal; resto = Banco de Horas
  // Regra Oficial do Diretor: Horas extras computadas estritamente no intervalo do evento,
  // excluindo tempo de deslocamento da base até o local e de retorno.
  const missionOffHours = useMemo(() => {
    return calculateEventOnlyOffHours({
      ...formData,
      drivingDurationMinutes: routeInfo.durationMinutes || formData.drivingDurationMinutes,
      roundTripDurationMinutes: routeInfo.durationMinutes ? routeInfo.durationMinutes * 2 : formData.roundTripDurationMinutes,
    });
  }, [
    formData.date,
    formData.eventStartTime,
    formData.eventEndTime,
    formData.departureTime,
    formData.arrivalTimeEstimated,
    formData.returnTimeEstimated,
    formData.endDate,
    routeInfo.durationMinutes,
    formData.drivingDurationMinutes,
    formData.roundTripDurationMinutes,
    isMultiDay,
  ]);

  const handleCustomRateChange = (memberId, value) => {
    if (!isAdmin) {
      alertDialog({
        title: 'Acesso Restrito à Administração',
        message: 'Apenas Administradores possuem autorização para alterar ou personalizar valores de remuneração e hora extra.',
        variant: 'warning',
      });
      return;
    }
    setFormData((prev) => {
      const prevRates = { ...(prev.customRates || {}) };
      if (value === '' || value === null || isNaN(value)) {
        delete prevRates[memberId];
      } else {
        prevRates[memberId] = Number(value);
      }
      return { ...prev, customRates: prevRates };
    });
  };

  const handleMemberRoleChange = (memberId, roleName) => {
    setFormData((prev) => ({
      ...prev,
      memberRoles: {
        ...(prev.memberRoles || {}),
        [memberId]: Array.isArray(roleName) ? roleName : [roleName],
      },
    }));
  };

  const handleAddMemberRole = (memberId, roleName) => {
    if (!roleName) return;
    setFormData((prev) => {
      const mem = members.find((m) => String(m.id) === String(memberId));
      const fallback = normalizeToOfficialRole(mem?.role || 'Cinegrafista');
      const existing = prev.memberRoles?.[memberId];
      let currentList = [];
      if (Array.isArray(existing)) {
        currentList = [...existing];
      } else if (typeof existing === 'string' && existing.trim()) {
        currentList = existing.includes(',')
          ? existing.split(',').map((r) => r.trim()).filter(Boolean)
          : [existing.trim()];
      } else {
        currentList = [fallback];
      }

      if (!currentList.includes(roleName)) {
        currentList.push(roleName);
      }

      return {
        ...prev,
        memberRoles: {
          ...(prev.memberRoles || {}),
          [memberId]: currentList,
        },
      };
    });
  };

  const handleRemoveMemberRole = (memberId, roleName) => {
    setFormData((prev) => {
      const mem = members.find((m) => String(m.id) === String(memberId));
      const fallback = normalizeToOfficialRole(mem?.role || 'Cinegrafista');
      const existing = prev.memberRoles?.[memberId];
      let currentList = [];
      if (Array.isArray(existing)) {
        currentList = [...existing];
      } else if (typeof existing === 'string' && existing.trim()) {
        currentList = existing.includes(',')
          ? existing.split(',').map((r) => r.trim()).filter(Boolean)
          : [existing.trim()];
      } else {
        currentList = [fallback];
      }

      if (currentList.length <= 1) return prev;
      const nextList = currentList.filter((r) => r !== roleName);

      return {
        ...prev,
        memberRoles: {
          ...(prev.memberRoles || {}),
          [memberId]: nextList,
        },
      };
    });
  };

  const handleMemberRemunerationTypeChange = (memberId, type) => {
    if (type !== 'off_hours' && !isAdmin) {
      alertDialog({
        title: 'Acesso Restrito à Administração',
        message: 'Apenas Administradores possuem autorização para definir modalidades de remuneração além de Hora Extra (Diária ou Personalizada).',
        variant: 'warning',
      });
      return;
    }
    setFormData((prev) => ({
      ...prev,
      memberRemunerationTypes: {
        ...(prev.memberRemunerationTypes || {}),
        [memberId]: type,
      },
    }));
  };

  const handleRemunerationTypeChange = (type) => {
    if (type !== 'off_hours' && !isAdmin) {
      alertDialog({
        title: 'Acesso Restrito à Administração',
        message: 'Apenas Administradores possuem autorização para definir modalidades de remuneração além de Hora Extra (Diária ou Personalizada).',
        variant: 'warning',
      });
      return;
    }
    setFormData((prev) => ({
      ...prev,
      remunerationType: type,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.description) {
      await alertDialog({
        title: 'Campo Obrigatório',
        message: 'Por favor, informe a descrição do serviço/missão para continuar.',
        variant: 'warning',
      });
      return;
    }

    // Filtra viaturas válidas alocadas
    const validAllocations = formData.vehicleAllocations
      .filter((a) => a && a.vehicleId)
      .map((a) => {
        const veh = vehicles.find((v) => v.id === a.vehicleId);
        const drv = members.find((m) => m.id === a.driverId);
        return {
          vehicleId: a.vehicleId,
          vehicleName: veh ? `${veh.name} (${veh.plate})` : 'Viatura',
          driverId: a.driverId || '',
          driverName: drv ? drv.name : '',
        };
      });

    // Verificação proativa de conflitos antes de submeter
    const conflictingVehicles = validAllocations
      .filter((a) => scheduleConflicts.vehicleConflicts[a.vehicleId])
      .map((a) => {
        const c = scheduleConflicts.vehicleConflicts[a.vehicleId];
        return `• Viatura ${a.vehicleName}: Já ocupada na missão ${c.code} "${c.description}" (${c.timeRange})`;
      });

    const conflictingDrivers = validAllocations
      .filter((a) => a.driverId && scheduleConflicts.memberConflicts[a.driverId])
      .map((a) => {
        const c = scheduleConflicts.memberConflicts[a.driverId];
        return `• Condutor ${a.driverName}: Já escalado na missão ${c.code} "${c.description}" (${c.timeRange})`;
      });

    const conflictingTeam = (formData.teamIds || [])
      .filter((mId) => scheduleConflicts.memberConflicts[mId] && !validAllocations.some((a) => a.driverId === mId))
      .map((mId) => {
        const mObj = members.find((x) => x.id === mId);
        const c = scheduleConflicts.memberConflicts[mId];
        return `• Colaborador ${mObj?.name || 'Membro'}: Já escalado na missão ${c.code} "${c.description}" (${c.timeRange})`;
      });

    let hasSharedOverrides = forcedResources.size > 0;
    const allConflictMsgs = [...conflictingVehicles, ...conflictingDrivers, ...conflictingTeam];
    if (allConflictMsgs.length > 0) {
      const proceed = await confirmDialog({
        title: '⚠️ Aviso de Escala Compartilhada / Sobreposição',
        message: `Foram detectadas sobreposições de escala com outra missão:\n\n${allConflictMsgs.join('\n')}\n\nVocê concorda em autorizar a participação simultânea / deslocamento direto deste(s) recurso(s)?`,
        confirmText: 'Sim, Concordo e Salvar Missão',
        cancelText: 'Revisar Escala',
        variant: 'warning',
      });
      if (!proceed) return;
      hasSharedOverrides = true;
    }

    const primaryAlloc = validAllocations[0] || null;
    const vehicleNamesDisplay =
      validAllocations.length > 0
        ? validAllocations.map((a) => a.vehicleName).join(' • ')
        : 'Não alocada';
    const driverNamesDisplay = validAllocations
      .map((a) => a.driverName)
      .filter(Boolean)
      .join(', ');

    const assignedMembers = members.filter((m) => formData.teamIds.includes(m.id));
    const teamNamesDisplay = assignedMembers.map((m) => m.name).join(', ');

    const isNotApp = !hasMissionPostProduction(formData);
    const finalEditorIds = isNotApp ? [] : (formData.editorIds || []);
    const assignedEditors = members.filter((m) => finalEditorIds.includes(m.id));
    const editorNamesDisplay = isNotApp ? '' : (assignedEditors.map((m) => m.name).join(', ') || (formData.editorName || ''));
    const primaryEditor = assignedEditors[0] || null;
    const primaryEditorId = isNotApp ? '' : (primaryEditor ? primaryEditor.id : (formData.editorId || ''));
    const primaryEditorName = isNotApp ? '' : (primaryEditor ? primaryEditor.name : (formData.editorName || ''));

    // Inicializa ou atualiza o histórico da missão
    const activeLoggedUser = getCurrentUser();
    const creatorName = editingMission?.createdByName || activeLoggedUser?.name || 'Administrador';
    const creatorId = editingMission?.createdBy || activeLoggedUser?.id || null;

    const currentHistory = Array.isArray(editingMission?.editionHistory) ? [...editingMission.editionHistory] : [];
    if (!editingMission) {
      currentHistory.push({
        id: 'h-' + Date.now(),
        type: 'CREATED',
        user: creatorName,
        timestamp: new Date().toISOString(),
        title: 'Missão Criada e Publicada',
        description: isNotApp
          ? `Missão "${formData.description}" cadastrada sem pós-produção necessária.`
          : `Missão "${formData.description}" cadastrada com prazo de edição para ${formatDateBR(formData.deliveryDeadlineDate || formData.date)} às ${formData.deliveryDeadlineTime || '18:00'}.`,
        deadline: isNotApp ? null : `${formatDateBR(formData.deliveryDeadlineDate || formData.date)} às ${formData.deliveryDeadlineTime || '18:00'}`,
      });
      if (editorNamesDisplay) {
        currentHistory.push({
          id: 'h-' + (Date.now() + 1),
          type: 'ASSIGNED',
          user: 'Gestão de Produção',
          timestamp: new Date().toISOString(),
          title: 'Editor(es) Designado(s) para Pós-Produção',
          description: `Editor responsável: ${editorNamesDisplay}. Prazo estipulado: ${formatDateBR(formData.deliveryDeadlineDate || formData.date)} às ${formData.deliveryDeadlineTime || '18:00'}.`,
          deadline: `${formatDateBR(formData.deliveryDeadlineDate || formData.date)} às ${formData.deliveryDeadlineTime || '18:00'}`,
        });
      }
    } else if (editorNamesDisplay && editorNamesDisplay !== editingMission.editorNamesDisplay) {
      currentHistory.push({
        id: 'h-' + Date.now(),
        type: 'ASSIGNED',
        user: 'Gestão de Produção',
        timestamp: new Date().toISOString(),
        title: 'Responsável pela Edição Atualizado',
        description: `Novo(s) editor(es) atribuído(s): ${editorNamesDisplay}. Prazo: ${formatDateBR(formData.deliveryDeadlineDate || formData.date)} às ${formData.deliveryDeadlineTime || '18:00'}.`,
        deadline: `${formatDateBR(formData.deliveryDeadlineDate || formData.date)} às ${formData.deliveryDeadlineTime || '18:00'}`,
      });
    }

    // Registro histórico de convidados externos / freelancers
    const guestsList = Array.isArray(formData.guests) ? formData.guests : [];
    const guestsStr = guestsList.map((g) => {
      if (typeof g === 'string') return g;
      const gRoles = Array.isArray(g.roles) && g.roles.length > 0 ? g.roles : (g.role ? [g.role] : []);
      return gRoles.length > 0 ? `${g.name} (${gRoles.join(', ')})` : g.name;
    }).join(', ');
    if (!editingMission) {
      if (guestsStr) {
        currentHistory.push({
          id: 'h-guest-' + Date.now(),
          type: 'GUEST_ADDED',
          user: 'Gestão de Produção',
          timestamp: new Date().toISOString(),
          title: 'Convidado(s) / Freelancer(s) Adicionado(s)',
          description: `Participante(s) externo(s) adicionado(s) à escala de campo: ${guestsStr}. (Profissionais sem acesso direto ao sistema / sem rastreamento GPS).`,
        });
      }
    } else {
      const prevGuests = (editingMission.guests || []).map((g) => typeof g === 'string' ? g : g.name).join(', ');
      if (guestsStr !== prevGuests) {
        currentHistory.push({
          id: 'h-guest-' + Date.now(),
          type: 'GUEST_UPDATED',
          user: 'Gestão de Produção',
          timestamp: new Date().toISOString(),
          title: 'Equipe de Campo: Convidados / Freelancers Atualizados',
          description: `Escala de convidados externos atualizada: ${guestsStr || 'Nenhum convidado'}.`,
        });
      }
    }

    if (isMultiDay && formData.endDate && formData.endDate < formData.date) {
      alertDialog({
        title: 'Data Inválida',
        message: 'A Data Final da missão de múltiplos dias deve ser igual ou posterior à Data de Início.',
        variant: 'warning',
      });
      return;
    }

    const isAlreadyFinalized = editingMission && ['Finalizada', 'Finalizado', 'Concluída'].includes(editingMission.missionStatus);
    const computedStatus = isAlreadyFinalized
      ? editingMission.missionStatus
      : computeMissionAutoStatus(formData, new Date(), true);
    const generatedCode = generateNextMissionCode(formData.date, missions, editingMission);

    // Higienização de Permissão: Apenas Administradores podem salvar valores de hora extra personalizados ou modalidades alternativas
    let finalCustomRates = { ...(formData.customRates || {}) };
    let finalMemberRemunTypes = { ...(formData.memberRemunerationTypes || {}) };
    let finalRemunType = formData.remunerationType || 'off_hours';

    if (!isAdmin) {
      finalRemunType = 'off_hours';
      finalMemberRemunTypes = {};
      finalCustomRates = {};
    }

    const missionPayload = {
      id: editingMission ? editingMission.id : 'mis-' + Date.now(),
      version: editingMission?.version ?? 1,
      ...formData,
      remunerationType: finalRemunType,
      memberRemunerationTypes: finalMemberRemunTypes,
      customRates: finalCustomRates,
      code: generatedCode,
      eventStartTime: formData.eventStartTime || null,
      eventEndTime: formData.eventEndTime || null,
      antecedenceMinutes: formData.antecedenceMinutes ? Number(formData.antecedenceMinutes) : 30,
      suggestedDepartureTime: dynamicSuggestedDeparture || formData.suggestedDepartureTime || null,
      isRoundTrip: true,
      missionStatus: computedStatus,
      // Missão de Múltiplos Dias
      isMultiDay: isMultiDay,
      endDate: isMultiDay ? (formData.endDate || formData.date) : null,
      vehicleAllocations: validAllocations,
      guests: guestsList,
      vehicleIds: validAllocations.map((a) => a.vehicleId),
      driverIds: validAllocations.map((a) => a.driverId).filter(Boolean),
      // Pós-Produção e Edição
      editorId: primaryEditorId,
      editorName: primaryEditorName,
      editorIds: finalEditorIds,
      editorNamesDisplay: editorNamesDisplay,
      deliveryDeadlineDate: isNotApp ? null : (formData.deliveryDeadlineDate || formData.date),
      deliveryDeadlineTime: isNotApp ? null : (formData.deliveryDeadlineTime || '18:00'),
      editionHistory: currentHistory,
      editionDeliveryStatus: isNotApp ? '' : (formData.editionDeliveryStatus || editingMission?.editionDeliveryStatus || ''),
      serverFilePath: isNotApp ? null : (formData.serverFilePath || editingMission?.serverFilePath || null),
      isOverdue: isNotApp ? 0 : (formData.isOverdue ?? editingMission?.isOverdue ?? 0),
      reopenReason: isNotApp ? '' : (formData.reopenReason ?? editingMission?.reopenReason ?? ''),
      // Campos legados para compatibilidade total
      vehicleId: primaryAlloc ? primaryAlloc.vehicleId : '',
      driverId: primaryAlloc ? primaryAlloc.driverId : '',
      driverName: driverNamesDisplay,
      vehicleNameDisplay: vehicleNamesDisplay,
      teamNamesDisplay: teamNamesDisplay || 'Sem equipe',
      lat: formData.lat ? parseFloat(formData.lat) : null,
      lon: formData.lon ? parseFloat(formData.lon) : null,
      distanceKm: routeInfo.distanceKm,
      returnDistanceKm: routeInfo.returnDistanceKm || routeInfo.distanceKm,
      totalDistanceKm: currentTotalRoundTripKm,
      drivingDurationMinutes: routeInfo.durationMinutes,
      roundTripDurationMinutes:
        routeInfo.roundTripDurationMinutes || (routeInfo.durationMinutes || 0) * 2,
      routeCoordinates: routeInfo.coordinates,
      returnCoordinates: routeInfo.returnCoordinates || [],
      estimatedFuelLiters: routeInfo.estimatedFuelLiters,
      estimatedFuelCost: routeInfo.estimatedFuelCost,
      exceedsFullTank: anyExceedsFullTank,
      excessFuelLiters: totalExcessOverFullTankLiters,
      excessFuelCost: totalExcessOverFullTankCost,
      // Recorrência da Missão
      isRecurring: isRecurring,
      recurrenceId: formData.recurrenceId || (isRecurring ? (editingMission?.recurrenceId || 'rec-' + Date.now()) : null),
      recurrenceRule: isRecurring ? (formData.recurrenceRule || 'weekly') : null,
      recurrenceDays: isRecurring ? formatDaysDisplay(selectedDows) : null,
      recurringDates: isRecurring && !editingMission ? futureOccurrenceDates : [],
      updateSeries: Boolean(editingMission && isRecurring && updateSeries),
      // Banco de Horas, Modalidade e Taxas Personalizadas da Missão
      offHours: isMultiDay ? 0 : (missionOffHours.offHours || 0),
      remunerationType: finalRemunType,
      memberRemunerationTypes: finalMemberRemunTypes,
      memberRoles: formData.memberRoles || {},
      equipmentAllocations: formData.equipmentAllocations || [],
      memberNotes: formData.memberNotes || {},
      extraHoursPlanned: isMultiDay ? 0 : (missionOffHours.offHours || 0),
      extraHoursApproved: editingMission?.extraHoursApproved || 0,
      extraHoursRequests: editingMission?.extraHoursRequests || [],
      customRates: finalCustomRates,
      createdBy: creatorId,
      createdByName: creatorName,
      createdAt: editingMission?.createdAt || new Date().toISOString(),
      ignoreConflicts: hasSharedOverrides,
      forceSharedResources: hasSharedOverrides,
      overrideReason: hasSharedOverrides ? 'Participação compartilhada de viatura/colaborador forçada e autorizada pelo gestor' : undefined,
    };

    const res = await onSaveMission(missionPayload);
    if (res && !res.success) {
      if (res.hasConflict || res.status === 422 || (res.error && String(res.error).toLowerCase().includes('conflito de escala'))) {
        const rawMsg = res.conflictMessage || res.error || 'Conflito de escala ou sobreposição de horários detectada.';
        const cleanMsg = rawMsg.replace(/^Conflito de Escala:\s*/i, '');
        const proceed = await confirmDialog({
          title: '⚠️ Conflito de Escala Detectado',
          message: cleanMsg,
          description: 'Deseja autorizar a participação compartilhada e salvar a missão mesmo com essa sobreposição de horários nesta data?',
          confirmText: 'Salvar Mesmo Assim',
          cancelText: 'Revisar Escala',
          variant: 'warning',
        });
        if (proceed) {
          const resForce = await onSaveMission({
            ...missionPayload,
            ignoreConflicts: true,
            forceSharedResources: true,
            overrideReason: 'Conflito de escala analisado e aprovado pelo gestor: ' + cleanMsg
          });
          if (resForce && resForce.success) {
            onClose();
          } else if (resForce && !resForce.success) {
            await alertDialog({
              title: 'Erro ao Salvar',
              message: resForce.error || 'Falha ao salvar missão.',
              variant: 'danger',
            });
          }
        }
        return;
      }

      if (res.conflict) {
        const proceed = await confirmDialog({
          title: '⚠️ Conflito de Edição Simultânea',
          message: res.error,
          description: 'Deseja forçar a gravação dos seus dados ou cancelar para recarregar a versão mais recente?',
          confirmText: 'Forçar Gravação',
          cancelText: 'Cancelar e Recarregar',
          variant: 'danger',
        });
        if (proceed) {
          const resForce = await onSaveMission({ ...missionPayload, forceOverwrite: true });
          if (resForce && resForce.success) {
            onClose();
          }
        }
        return;
      }

      await alertDialog({
        title: 'Erro ao Salvar',
        message: res.error || 'Não foi possível salvar a missão no servidor.',
        variant: 'danger',
      });
      return;
    }

    onClose();
  };

  if (!isOpen) return null;

  const activeVehiclesCount = formData.vehicleAllocations.filter((a) => a.vehicleId).length;
  const previewMissionCode = generateNextMissionCode(formData.date, missions, editingMission);

  return (
    <div className="modal-overlay" style={{ zIndex: 3000 }}>
      <div className="modal-box modal-box-large mm-modal-container">
        {/* ---- Cabeçalho Moderno e Alinhado ---- */}
        <div className="modal-header mm-modal-header">
          <div className="mm-header-brand">
            <div className="mm-icon-badge">
              <Sparkles size={20} />
            </div>
            <div>
              <h2>{editingMission ? 'Editar Missão / Pauta' : 'Nova Missão & Escala Operacional'}</h2>
              <p>Planejamento de rotas, equipes e viaturas com cálculo inteligente de combustível</p>
            </div>
          </div>

          <div className="mm-header-controls">
            <div className="mission-code-badge-modal" title="Código automático: Ano + Mês + Dia + Ordem do Dia">
              <strong>#{previewMissionCode}</strong>
            </div>
            <button type="button" className="modal-close" onClick={onClose} title="Fechar modal">✕</button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="modal-form-scrollable mm-form-body">
          {/* ============================================================== */}
          {/* PASSO 1: INFORMAÇÕES DA MISSÃO                                 */}
          {/* ============================================================== */}
          <div className="mm-card-panel">
            <div className="mm-card-header">
              <span className="mm-step-pill">1</span>
              <div>
                <h3 className="mm-card-title">Informações do Serviço</h3>
                <p className="mm-card-subtitle">Pauta, data da execução e previsão dos horários de base</p>
              </div>
            </div>

            <div className="form-group">
              <label>
                Descrição do Serviço / Nome da Pauta <span className="req-star">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Gravação Comercial Teresa, Fachada Loja Centro, Cobertura Drone..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            {/* PAINEL DE CRONOGRAMA & HORÁRIOS OPERACIONAIS */}
            <div className="mm-schedule-timeline-container">
              {/* Faixa de Categorias / Agrupamento Visual */}
              <div className={`mm-schedule-categories-bar ${isMultiDay ? 'is-multiday' : ''}`}>
                <div className="mm-cat-pill mm-cat-date">
                  <Calendar size={12} />
                  <span>Data da Missão</span>
                </div>
                <div className="mm-cat-pill mm-cat-event">
                  <Film size={12} />
                  <span>No Local do Evento (Cliente)</span>
                </div>
                <div className="mm-cat-pill mm-cat-base">
                  <Car size={12} />
                  <span>Deslocamento &amp; Base (Viatura)</span>
                </div>
              </div>

              {/* Grid Principal dos Campos */}
              <div className={`mm-schedule-grid ${isMultiDay ? 'is-multiday' : ''}`}>
                {/* 1. DATA DA MISSÃO */}
                <div className="mm-sched-col mm-sched-date">
                  <label className="mm-sched-label">
                    <Calendar size={13} className="text-amber" />
                    <span>{isMultiDay ? 'Data de Início' : 'Data da Missão'}</span>
                    <span className="req-star">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    className="mm-sched-input"
                    value={formData.date}
                    onChange={(e) => {
                      const newDate = e.target.value;
                      setFormData((prev) => {
                        const shouldSyncDeadline = !prev.deliveryDeadlineDate || prev.deliveryDeadlineDate === prev.date;
                        return {
                          ...prev,
                          date: newDate,
                          ...(shouldSyncDeadline && hasMissionPostProduction(prev) ? { deliveryDeadlineDate: newDate } : {}),
                        };
                      });
                    }}
                  />
                  <small className="mm-sched-hint">Dia da execução</small>
                </div>

                {/* 2. INÍCIO DO EVENTO */}
                <div className="mm-sched-col mm-sched-event-start">
                  <label className="mm-sched-label" title="Horário em que a equipe deve estar posicionada ou início do evento no local">
                    <Clock size={13} className="text-sky" />
                    <span>Início no Local</span>
                  </label>
                  <input
                    type="time"
                    className="mm-sched-input"
                    placeholder="Ex: 18:00"
                    value={formData.eventStartTime || ''}
                    onChange={(e) => handleEventStartTimeChange(e.target.value)}
                    title="Horário em que o evento começa ou que a equipe já deve estar posicionada no local"
                  />
                  <small className="mm-sched-hint">Início da cobertura</small>
                </div>

                {/* 3. TÉRMINO DO EVENTO */}
                <div className="mm-sched-col mm-sched-event-end">
                  <label className="mm-sched-label" title="Horário oficial de término do evento no local (base para horas extras)">
                    <Clock size={13} className="text-sky" />
                    <span>Término no Local</span>
                  </label>
                  <input
                    type="time"
                    className="mm-sched-input"
                    placeholder="Ex: 22:00"
                    value={formData.eventEndTime || ''}
                    onChange={(e) => handleEventEndTimeChange(e.target.value)}
                    title="Horário oficial de término do evento no local (base exclusiva para o cálculo de horas extras)"
                  />
                  <small className="mm-sched-hint">Fim no local</small>
                </div>

                {/* 4. SAÍDA DA BASE */}
                <div className="mm-sched-col mm-sched-base-dep">
                  <label className="mm-sched-label" title="Horário de partida da viatura e equipe da sede da produtora">
                    <Clock size={13} className="text-emerald" />
                    <span>Saída da Base</span>
                    <span className="req-star">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    className="mm-sched-input"
                    value={formData.departureTime || ''}
                    onChange={(e) => setFormData({ ...formData, departureTime: e.target.value })}
                  />
                  <small className="mm-sched-hint">Partida da viatura</small>
                </div>

                {/* 5. PREVISÃO DE RETORNO */}
                {!isMultiDay && (
                  <div className="mm-sched-col mm-sched-base-ret">
                    <label className="mm-sched-label" title="Horário previsto de término da missão e chegada da viatura à base">
                      <Clock size={13} className="text-emerald" />
                      <span>Retorno à Base</span>
                    </label>
                    <input
                      type="time"
                      className="mm-sched-input"
                      value={formData.returnTimeEstimated || ''}
                      onChange={(e) => setFormData({ ...formData, returnTimeEstimated: e.target.value })}
                    />
                    <small className="mm-sched-hint">Término na base</small>
                  </div>
                )}
              </div>
            </div>

            {/* BOX DE SUGESTÃO INTELIGENTE DE SAÍDA (ANTECEDÊNCIA + TRAJETO) */}
            {dynamicSuggestedDeparture && (
              <div className="smart-departure-suggestion-box">
                <div className="sdsb-left">
                  <div className="sdsb-icon">
                    <Sparkles size={18} />
                  </div>
                  <div className="sdsb-content">
                    <div className="sdsb-title">
                      <span>Sugestão Inteligente de Saída da Base</span>
                      <strong className="sdsb-badge-time">{dynamicSuggestedDeparture}</strong>
                    </div>
                    <p className="sdsb-desc">
                      Para chegar às <strong>{formData.eventStartTime}</strong> com <strong>{formData.antecedenceMinutes || 30} min de antecedência</strong> e <strong>~{routeInfo.durationMinutes || 0} min de percurso</strong>, a viatura deve sair no máximo às <strong>{dynamicSuggestedDeparture}</strong>.
                    </p>
                  </div>
                </div>

                <div className="sdsb-right">
                  <div className="sdsb-antecedence-control">
                    <span className="sdsb-label">Antecedência no local:</span>
                    <select
                      value={formData.antecedenceMinutes || 30}
                      onChange={(e) => handleAntecedenceChange(Number(e.target.value))}
                      className="sdsb-select"
                    >
                      <option value={15}>15 minutos</option>
                      <option value={30}>30 min (Recomendado)</option>
                      <option value={45}>45 minutos</option>
                      <option value={60}>60 min (1 hora)</option>
                    </select>
                  </div>

                  {formData.departureTime !== dynamicSuggestedDeparture ? (
                    <button
                      type="button"
                      className="btn-apply-suggested-time"
                      onClick={() => applySuggestedDepartureTime(dynamicSuggestedDeparture)}
                      title="Clique para definir o horário de saída da base como o horário sugerido"
                    >
                      <Sparkles size={14} />
                      <span>Aplicar Saída ({dynamicSuggestedDeparture})</span>
                    </button>
                  ) : (
                    <div className="sdsb-applied-pill">
                      <Check size={14} />
                      <span>Saída aplicada ({dynamicSuggestedDeparture})</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ALERTA EM TEMPO REAL: FORA DO EXPEDIENTE COMERCIAL */}
            {missionOffHours.isOffHours && (
              <div className="mm-offhours-warning-banner">
                <div className="mm-offhours-banner-icon">
                  <Clock size={20} />
                </div>
                <div className="mm-offhours-banner-body">
                  <div className="mm-offhours-banner-title">
                    <strong className="text-amber">⚠️ Missão Fora do Horário de Expediente</strong>
                    <span className="mm-offhours-badge">
                      +{missionOffHours.offHours}h no Banco de Horas
                    </span>
                  </div>
                  <p className="mm-offhours-banner-desc">
                    Esta missão se inicia ou ultrapassa o horário comercial da empresa (Seg a Sex das 08h às 18h, Sáb até 12h e Domingos). Os colaboradores escalados estarão fora do expediente e as <strong>{missionOffHours.offHours}h excedentes</strong> serão acrescidas ao Banco de Horas / Folha com seus respectivos valores.
                  </p>
                  {missionOffHours.offHoursSegments && missionOffHours.offHoursSegments.length > 0 && (
                    <div className="mm-offhours-segments-chips">
                      {missionOffHours.offHoursSegments.map((seg, idx) => (
                        <span key={idx} className="mm-offhours-seg-chip">
                          🕒 {seg.date ? `${seg.date.slice(8, 10)}/${seg.date.slice(5, 7)}: ` : ''}{seg.label} ({seg.hours}h)
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ============================================================== */}
            {/* MISSÃO DE MÚLTIPLOS DIAS (Mais de um dia / Longa Duração)     */}
            {/* ============================================================== */}
            <div className={`mm-recurrence-box mm-multiday-box ${isMultiDay ? 'is-active' : ''}`}>
              <div className="mm-rec-header">
                <div className="mm-rec-info">
                  <div className={`mm-rec-icon ${isMultiDay ? 'active' : ''}`}>
                    <CalendarRange size={18} />
                  </div>
                  <div>
                    <div className="mm-rec-title-row">
                      <strong className="mm-rec-title">Missão de Mais de um Dia (Longa Duração)</strong>
                      {isMultiDay && formData.date && formData.endDate && (
                        <span className="mm-rec-badge-active mm-multiday-badge">
                          {calculateDaysBetween(formData.date, formData.endDate)} {calculateDaysBetween(formData.date, formData.endDate) === 1 ? 'Dia' : 'Dias'} de Operação
                        </span>
                      )}
                    </div>
                    <p className="mm-rec-desc">
                      Ative para missões que iniciam em um dia e terminam em outro (ex: viagens ou gravações que iniciam no dia 25/11 e terminam no dia 28/11).
                    </p>
                  </div>
                </div>

                <label className="mm-rec-switch-wrapper" title="Ativar duração de múltiplos dias para esta missão">
                  <input
                    type="checkbox"
                    checked={isMultiDay}
                    onChange={(e) => handleToggleMultiDay(e.target.checked)}
                  />
                  <span className="mm-rec-switch-slider"></span>
                </label>
              </div>

              {isMultiDay && (
                <div className="mm-rec-body mm-multiday-body">
                  <div className="form-row mm-multiday-row" style={{ alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
                    <div className="form-group flex-1" style={{ minWidth: '180px' }}>
                      <label>
                        <CalendarRange size={13} /> Data Final / Retorno à Base <span className="req-star">*</span>
                      </label>
                      <input
                        type="date"
                        required={isMultiDay}
                        min={formData.date || getLocalTodayStr()}
                        value={formData.endDate || ''}
                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      />
                      <small className="field-hint-sub">Data prevista de retorno da viatura e encerramento</small>
                    </div>

                    <div className="form-group flex-1" style={{ minWidth: '150px' }}>
                      <label>
                        <Clock size={13} /> Previsão de Retorno
                      </label>
                      <input
                        type="time"
                        value={formData.returnTimeEstimated || ''}
                        onChange={(e) => setFormData({ ...formData, returnTimeEstimated: e.target.value })}
                      />
                      <small className="field-hint-sub">Horário previsto de chegada na base</small>
                    </div>

                    {formData.date && formData.endDate && (
                      <div className="mm-multiday-calc-card">
                        <span className="mm-multiday-calc-label">Período de Duração:</span>
                        <strong className="mm-multiday-calc-val">
                          {calculateDaysBetween(formData.date, formData.endDate)} {calculateDaysBetween(formData.date, formData.endDate) === 1 ? 'dia' : 'dias'} de missão
                        </strong>
                        <small className="mm-multiday-calc-dates">
                          De {formData.date.slice(8, 10)}/{formData.date.slice(5, 7)} até {formData.endDate.slice(8, 10)}/{formData.endDate.slice(5, 7)}
                        </small>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ============================================================== */}
            {/* RECORRÊNCIA DA MISSÃO (Agendamento Automático de Rotinas)      */}
            {/* ============================================================== */}
            <div className={`mm-recurrence-box ${isRecurring ? 'is-active' : ''}`}>
              <div className="mm-rec-header">
                <div className="mm-rec-info">
                  <div className={`mm-rec-icon ${isRecurring ? 'active' : ''}`}>
                    <Repeat size={18} />
                  </div>
                  <div>
                    <div className="mm-rec-title-row">
                      <strong className="mm-rec-title">Missão Recorrente (Repetir Pauta)</strong>
                      {isRecurring && (
                        <span className="mm-rec-badge-active">
                          {calculatedRecurrenceDates.length > 0 ? `${calculatedRecurrenceDates.length} Ocorrências` : 'Ativa'}
                        </span>
                      )}
                    </div>
                    <p className="mm-rec-desc">
                      Configure missões rotineiras (ex: duas vezes por semana, sessões do TJ, programas fixos ou cultos).
                    </p>
                  </div>
                </div>

                <label className="mm-rec-switch-wrapper" title="Ativar repetição periódica para esta missão">
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(e) => handleToggleRecurrence(e.target.checked)}
                  />
                  <span className="mm-rec-switch-slider"></span>
                </label>
              </div>

              {isRecurring && (
                <div className="mm-rec-body">
                  {/* 1. SELEÇÃO DE DIAS DA SEMANA */}
                  <div className="mm-rec-section">
                    <label className="mm-rec-label">
                      <span>Dias da Semana em que a Missão Ocorre:</span>
                      <span className="mm-rec-label-hint">Selecione 1 ou mais dias (ex: Terça e Quinta)</span>
                    </label>

                    <div className="mm-rec-days-row">
                      {RECURRENCE_DAYS.map((d) => {
                        const isSelected = selectedDows.includes(d.dow);
                        return (
                          <button
                            type="button"
                            key={d.dow}
                            className={`btn-dow-chip ${isSelected ? 'selected' : ''}`}
                            onClick={() => handleToggleDow(d.dow)}
                            title={`${d.label} (${isSelected ? 'Selecionado - Clique para remover' : 'Clique para adicionar'})`}
                          >
                            <span className="dow-check">{isSelected ? '✓' : ''}</span>
                            <span className="dow-name">{d.short}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Atalhos Rápidos de Frequência */}
                    <div className="mm-rec-presets-row">
                      <span className="rec-preset-label">Atalhos rápidos:</span>
                      <button
                        type="button"
                        className="btn-rec-preset"
                        onClick={() => setSelectedDows([2, 4])}
                        title="Terça e Quinta (2x por semana)"
                      >
                        2x / sem (Ter e Qui)
                      </button>
                      <button
                        type="button"
                        className="btn-rec-preset"
                        onClick={() => setSelectedDows([1, 3])}
                        title="Segunda e Quarta (2x por semana)"
                      >
                        2x / sem (Seg e Qua)
                      </button>
                      <button
                        type="button"
                        className="btn-rec-preset"
                        onClick={() => setSelectedDows([1, 3, 5])}
                        title="Segunda, Quarta e Sexta (3x por semana)"
                      >
                        3x / sem (Seg, Qua, Sex)
                      </button>
                      <button
                        type="button"
                        className="btn-rec-preset"
                        onClick={() => setSelectedDows([1, 2, 3, 4, 5])}
                        title="Segunda a Sexta (Dias Úteis)"
                      >
                        Segunda a Sexta
                      </button>
                    </div>
                  </div>

                  {/* 2. DURAÇÃO / DATA LIMITE */}
                  <div className="mm-rec-section">
                    <label className="mm-rec-label">
                      <span>Repetir Até Quando?</span>
                      <span className="mm-rec-label-hint">Escolha a duração do ciclo de agendamentos</span>
                    </label>

                    <div className="mm-rec-duration-row">
                      <div className="mm-rec-duration-presets">
                        {[
                          { weeks: 4, label: '4 semanas (1 mês)' },
                          { weeks: 8, label: '8 semanas (2 meses)' },
                          { weeks: 12, label: '12 semanas (3 meses)' },
                          { weeks: 24, label: '6 meses' },
                        ].map((p) => (
                          <button
                            type="button"
                            key={p.weeks}
                            className={`btn-rec-duration-chip ${recurrenceWeeks === p.weeks ? 'active' : ''}`}
                            onClick={() => handleSetRecurrenceWeeks(p.weeks)}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>

                      <div className="mm-rec-custom-date">
                        <span className="mrcd-label">Data Limite:</span>
                        <input
                          type="date"
                          className="mrcd-input"
                          value={recurrenceEndDate}
                          min={formData.date || getLocalTodayStr()}
                          onChange={(e) => {
                            setRecurrenceEndDate(e.target.value);
                            setRecurrenceWeeks(null);
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 3. RESUMO VISUAL DOS AGENDAMENTOS */}
                  <div className="mm-rec-summary-card">
                    <div className="mrs-header">
                      <Calendar size={15} />
                      <strong>Resumo da Recorrência:</strong>
                      {calculatedRecurrenceDates.length > 0 ? (
                        <span className="mrs-count-badge">
                          {calculatedRecurrenceDates.length} missões agendadas ({formatDaysDisplay(selectedDows)})
                        </span>
                      ) : (
                        <span className="mrs-count-badge warning">Nenhum dia selecionado</span>
                      )}
                    </div>

                    {calculatedRecurrenceDates.length > 0 ? (
                      <>
                        <p className="mrs-desc">
                          {editingMission
                            ? 'Esta missão e suas ocorrências mantêm a mesma rota, equipe e viatura:'
                            : `Ao salvar, serão criadas automaticamente ${calculatedRecurrenceDates.length} missões com a mesma viatura, rota e equipe:`}
                        </p>
                        <div className="mrs-dates-list">
                          {calculatedRecurrenceDates.map((dStr, idx) => (
                            <span
                              key={dStr}
                              className={`mrs-date-pill ${dStr === formData.date ? 'is-first' : ''}`}
                              title={dStr === formData.date ? 'Missão Base principal' : `Ocorrência #${idx + 1}`}
                            >
                              {dStr === formData.date && <span className="mrs-pill-dot" />}
                              {formatOccurrencePreview(dStr)}
                              {dStr === formData.date ? ' (Base)' : ''}
                            </span>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="mrs-empty-hint">
                        Selecione ao menos um dia da semana para gerar as ocorrências automáticas.
                      </p>
                    )}
                  </div>

                  {/* 4. ESCOPO DE EDIÇÃO (CASO ESTEJA EDITANDO UMA MISSÃO JÁ EXISTENTE) */}
                  {editingMission && (editingMission.isRecurring || editingMission.recurrenceId) && (
                    <div className="mm-rec-edit-scope-box">
                      <div className="mres-title">
                        <AlertTriangle size={15} />
                        <span>Escopo da Atualização:</span>
                      </div>
                      <div className="mres-options">
                        <label className="mres-option">
                          <input
                            type="radio"
                            name="recurrenceScope"
                            checked={!updateSeries}
                            onChange={() => setUpdateSeries(false)}
                          />
                          <span>Alterar apenas este agendamento ({formatDateBR(formData.date)})</span>
                        </label>
                        <label className="mres-option">
                          <input
                            type="radio"
                            name="recurrenceScope"
                            checked={updateSeries}
                            onChange={() => setUpdateSeries(true)}
                          />
                          <span>Aplicar alterações a este e a todos os próximos agendamentos desta série</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ============================================================== */}
          {/* PASSO 2: DESTINO, COORDENADAS & CÁLCULO DE ROTA               */}
          {/* ============================================================== */}
          <div className="mm-card-panel">
            <div className="mm-card-header">
              <span className="mm-step-pill">2</span>
              <div>
                <h3 className="mm-card-title">Destino &amp; Coordenadas GPS</h3>
                <p className="mm-card-subtitle">Local do evento e busca automática no mapa para cálculo de rota</p>
              </div>
            </div>

            <div className="form-row mm-two-cols">
              <div className="form-group flex-1">
                <label>Nome do Local / Cliente</label>
                <input
                  type="text"
                  placeholder="Ex: Espaço Jardim, Shopping Center, Estúdio 2..."
                  value={formData.locationName}
                  onChange={(e) => setFormData({ ...formData, locationName: e.target.value })}
                />
              </div>
              <div className="form-group flex-2">
                <label>Endereço Completo</label>
                <div className="mm-address-search-box">
                  <input
                    type="text"
                    placeholder="Rua, Número, Bairro, Cidade ou Coordenadas..."
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddressSearch(); } }}
                  />
                  <button
                    type="button"
                    className="btn-search-coords"
                    onClick={handleAddressSearch}
                    disabled={isSearchingAddress}
                    title="Buscar Coordenadas por Endereço ou Texto"
                  >
                    <Search size={14} />
                    <span>{isSearchingAddress ? 'Buscando...' : 'Buscar GPS'}</span>
                  </button>
                  <button
                    type="button"
                    className="btn-map-picker"
                    onClick={() => setIsMapPickerOpen(true)}
                    title="Personalizar, apontar no mapa interativo e fixar coordenadas"
                  >
                    <MapPin size={14} />
                    <span>Marcar no Mapa</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Banner de Aviso e Atalho quando a Busca Textual não encontrar endereço */}
            {searchNoResultsPrompt && (
              <div className="mm-no-search-results-banner">
                <div className="banner-left">
                  <AlertTriangle size={15} className="text-amber" />
                  <span>Endereço não localizado com precisão na pesquisa textual. Deseja apontar o ponto no mapa?</span>
                </div>
                <button
                  type="button"
                  className="btn-open-picker-prompt"
                  onClick={() => {
                    setSearchNoResultsPrompt(false);
                    setIsMapPickerOpen(true);
                  }}
                >
                  <MapPin size={13} />
                  <span>Personalizar e Marcar no Mapa</span>
                </button>
              </div>
            )}

            {/* Sugestões de Busca do Nominatim */}
            {searchResults.length > 0 && (
              <div className="search-results-dropdown">
                <div className="results-title">Locais encontrados (clique para aplicar coordenadas):</div>
                {searchResults.map((res, i) => (
                  <div
                    key={i}
                    className="search-result-item"
                    onClick={() => handleSelectSearchResult(res)}
                  >
                    <MapPin size={13} className="pin-accent" />
                    <span className="res-text">{res.name}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Indicador de Coordenadas GPS Fixadas com Atalho Rápido para o Mapa */}
            {Boolean(formData.lat && formData.lon) && (
              <div className="mm-coords-status-strip">
                <span className="coords-chip">
                  <MapPin size={12} className="text-emerald" />
                  GPS Fixado: <strong>{formData.lat}, {formData.lon}</strong>
                </span>
                <button
                  type="button"
                  className="btn-edit-on-map"
                  onClick={() => setIsMapPickerOpen(true)}
                  title="Ajustar ou conferir localização no mapa interativo"
                >
                  <MapPin size={12} />
                  <span>Ajustar no Mapa</span>
                </button>
              </div>
            )}

            <div className="form-row mm-three-cols" style={{ marginTop: '4px' }}>
              <div className="form-group flex-1">
                <label>Latitude</label>
                <input
                  type="number"
                  step="0.000001"
                  placeholder="Ex: 2.825358"
                  value={formData.lat}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData((prev) => {
                      const nextAddr = (val && prev.lon) ? formatAddressWithCoordinates(prev.address, val, prev.lon) : prev.address;
                      return { ...prev, lat: val, address: nextAddr };
                    });
                    if (val && formData.lon) updateRouteCalculations(val, formData.lon);
                  }}
                />
              </div>
              <div className="form-group flex-1">
                <label>Longitude</label>
                <input
                  type="number"
                  step="0.000001"
                  placeholder="Ex: -60.731062"
                  value={formData.lon}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData((prev) => {
                      const nextAddr = (prev.lat && val) ? formatAddressWithCoordinates(prev.address, prev.lat, val) : prev.address;
                      return { ...prev, lon: val, address: nextAddr };
                    });
                    if (formData.lat && val) updateRouteCalculations(formData.lat, val);
                  }}
                />
              </div>
              <div className="form-group flex-1">
                <label>Formato do Trajeto</label>
                <div className="mm-roundtrip-badge" title="Toda viatura sai da base e retorna à base automaticamente">
                  <RotateCcw size={14} className="icon-accent" />
                  <span>Ida e Volta à Base (Automático)</span>
                </div>
              </div>
            </div>

            {/* Banner de Rota e Cálculo Automático */}
            <div className="route-calculation-banner mm-integrated-calc">
              <div className="calc-banner-header">
                <div className="calc-tag">
                  <Zap size={14} />
                  <span>
                    Cálculo Automático de Deslocamento &amp; Combustível (Ida e Volta
                    {activeVehiclesCount > 1 ? ` • ${activeVehiclesCount} Viaturas` : ''})
                  </span>
                </div>
                {isCalculatingRoute && <span className="calc-loading">Traçando melhor rota...</span>}
              </div>

              <div className="calc-metrics-row">
                <div className="calc-metric-box">
                  <span className="c-label"><Navigation size={12} /> Distância Total</span>
                  <strong className="c-value">
                    {routeInfo.totalRoundTripKm || ((routeInfo.distanceKm || 0) * 2).toFixed(1)} km
                  </strong>
                  <small>
                    Ida: {routeInfo.distanceKm || 0} km • Volta: {routeInfo.returnDistanceKm || routeInfo.distanceKm || 0} km
                  </small>
                </div>

                <div className="calc-metric-box">
                  <span className="c-label"><Clock size={12} /> Tempo Estimado</span>
                  <strong className="c-value">
                    ~{routeInfo.roundTripDurationMinutes || (routeInfo.durationMinutes || 0) * 2} min
                  </strong>
                  <small>
                    Ida: ~{routeInfo.durationMinutes || 0} min • Chegada: {formData.arrivalTimeEstimated || '--:--'}
                  </small>
                  {dynamicSuggestedDeparture && (
                    <small className="c-sug-dep-hint">
                      ⚡ Saída Máx: <strong>{dynamicSuggestedDeparture}</strong>
                    </small>
                  )}
                </div>

                <div className="calc-metric-box">
                  <span className="c-label"><Fuel size={12} /> Consumo Previsto</span>
                  <strong className="c-value">{routeInfo.estimatedFuelLiters || 0} Litros</strong>
                  <small>
                    {activeVehiclesCount > 1
                      ? `Soma das ${activeVehiclesCount} viaturas alocadas`
                      : 'Deduzido automaticamente do tanque'}
                  </small>
                </div>

                <div className="calc-metric-box highlight-cost">
                  <span className="c-label">Custo Estimado</span>
                  <strong className="c-value">R$ {routeInfo.estimatedFuelCost || '0,00'}</strong>
                  <small>
                    Gasolina R$ {fuelSettings?.gasolinePricePerLiter || 6.45} • Diesel R$ {fuelSettings?.dieselPricePerLiter || 6.89} • Eletricidade R$ {fuelSettings?.electricPricePerKwh || 0.95}/kWh
                  </small>
                </div>
              </div>

              {/* ALERTA & CÁLCULO DE COMBUSTÍVEL / ENERGIA EXCEDENTE */}
              {anyExceedsFullTank && (
                <div className="excess-fuel-tank-banner">
                  <div className="eft-header">
                    <AlertTriangle size={16} />
                    <strong>
                      ⚠️ MISSÃO ULTRAPASSA A CAPACIDADE DE 1 TANQUE/BATERIA — CÁLCULO DE EXCEDENTE
                    </strong>
                  </div>
                  <div className="eft-body">
                    {validBreakdowns
                      .filter((b) => b.breakdown.exceedsFullTankCapacity)
                      .map(({ vehicle: vObj, breakdown: bd }, bIdx) => {
                        const isElecBd = isElectricVehicle(vObj);
                        const unitBd = isElecBd ? 'kWh' : 'L';
                        const nounBd = isElecBd ? 'Bateria' : 'Tanque';
                        return (
                          <div key={bIdx} className="eft-vehicle-row">
                            <div className="eft-veh-title">
                              <strong>{vObj.name}</strong> ({vObj.plate}) • 1 {nounBd} Cheio(a) ={' '}
                              <strong>
                                {bd.tankCapacity} {unitBd} ({bd.maxTankRangeKm} km • R$ {Number(bd.fullTankCost || 0).toFixed(2)})
                              </strong>
                            </div>
                            <div className="eft-metrics-grid">
                              <div className="eft-metric">
                                <span>Distância Excedente (&gt; 1 {nounBd})</span>
                                <strong>+{bd.excessOverFullTankKm} km</strong>
                                <small>Total: {bd.km} km ({bd.tanksRequired} {nounBd.toLowerCase()}s)</small>
                              </div>
                              <div className="eft-metric">
                                <span>{isElecBd ? 'Energia Excedente' : 'Combustível Excedente'} (&gt; 1 {nounBd})</span>
                                <strong>
                                  +{bd.excessOverFullTankLiters} {unitBd} (+{bd.excessOverFullTankPercent}% de {nounBd.toLowerCase()})
                                </strong>
                                <small>
                                  1 {nounBd.toLowerCase()} ({bd.tankCapacity}{unitBd}) + {bd.excessOverFullTankLiters}{unitBd} extras = {bd.litersNeeded}{unitBd}
                                </small>
                              </div>
                              <div className="eft-metric eft-metric-cost">
                                <span>Valor Excedente</span>
                                <strong>+R$ {Number(bd.excessOverFullTankCost || 0).toFixed(2)}</strong>
                                <small>
                                  1 {nounBd.toLowerCase()} (R$ {Number(bd.fullTankCost || 0).toFixed(2)}) + Excedente = R$ {Number(bd.totalCost || 0).toFixed(2)}
                                </small>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ============================================================== */}
          {/* PASSO 3: ALOCAÇÃO DE VIATURAS & MOTORISTAS                     */}
          {/* ============================================================== */}
          <div className="mm-card-panel">
            <div className="mm-card-header">
              <span className="mm-step-pill">3</span>
              <div style={{ flex: 1 }}>
                <h3 className="mm-card-title">Alocação de Viaturas &amp; Condutores</h3>
                <p className="mm-card-subtitle">Selecione os veículos da frota e os motoristas designados</p>
              </div>
              <button
                type="button"
                className="btn-add-vehicle-slot"
                onClick={handleAddVehicleAllocation}
                title="Adicionar mais uma viatura e motorista para esta mesma missão"
              >
                <Plus size={14} />
                <span>Adicionar Viatura</span>
              </button>
            </div>

            <div className="multi-vehicles-list">
              {(() => {
                const habilitados = members.filter((m) => Boolean(m.canDrive ?? m.hasCnh));
                const demaisMembros = members.filter((m) => !Boolean(m.canDrive ?? m.hasCnh));

                return formData.vehicleAllocations.map((alloc, idx) => {
                  const selectedDriverObj = members.find((m) => m.id === alloc.driverId);
                  const canRemove = formData.vehicleAllocations.length > 1;
                  const allocFuelData = allocBreakdowns[idx];
                  const bd = allocFuelData?.breakdown || null;
                  const vehObj = allocFuelData?.vehicle || null;
                  const vConflict = alloc.vehicleId ? scheduleConflicts.vehicleConflicts[alloc.vehicleId] : null;
                  const dConflict = alloc.driverId ? scheduleConflicts.memberConflicts[alloc.driverId] : null;

                  return (
                    <div key={idx} className={`vehicle-allocation-card ${vConflict || dConflict ? 'has-vac-conflict' : ''}`}>
                      <div className="vac-header">
                        <div className="vac-badge">
                          <Car size={14} />
                          <span>Viatura #{idx + 1}</span>
                        </div>

                        <div className="vac-header-right">
                          {selectedDriverObj && (
                            <div className="vac-driver-header-pill">
                              <span className="vdhp-label">Condutor:</span>
                              <strong className="vdhp-name">{selectedDriverObj.name}</strong>
                              {Boolean(selectedDriverObj.canDrive ?? selectedDriverObj.hasCnh) ? (
                                <span className="vdhp-cnh-tag">🚗 CNH {selectedDriverObj.cnhCategory || 'B'}</span>
                              ) : (
                                <span className="vdhp-cnh-tag no-cnh">Sem CNH</span>
                              )}
                            </div>
                          )}

                          {canRemove && (
                            <button
                              type="button"
                              className="btn-remove-vehicle-slot"
                              onClick={() => handleRemoveVehicleAllocation(idx)}
                              title="Remover esta viatura da missão"
                            >
                              <Trash2 size={13} />
                              <span>Remover</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* DISPOSIÇÃO PERFEITAMENTE SIMÉTRICA E ALINHADA */}
                      <div className="vac-controls-grid">
                        <div className="form-group flex-1">
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Car size={13} className="text-accent" />
                            <span>Viatura Designada #{idx + 1}</span>
                          </label>
                          <select
                            value={alloc.vehicleId}
                            onChange={(e) => handleChangeAllocationVehicle(idx, e.target.value)}
                            className={`vac-select-control ${vConflict ? 'vac-select-conflict' : ''}`}
                          >
                            <option value="">
                              {vehicles.length === 0 ? 'Nenhuma viatura cadastrada no sistema' : '-- Selecione a viatura --'}
                            </option>
                            {vehicles.map((v) => {
                              const vTel = computeVehicleFuelTelemetry(
                                v,
                                missions,
                                pricePerLiterVal,
                                editingMission?.id || null
                              );
                              const usedElsewhere = formData.vehicleAllocations.some(
                                (other, oIdx) => oIdx !== idx && other.vehicleId === v.id
                              );
                              const conflict = scheduleConflicts.vehicleConflicts[v.id];
                              const isElecV = isElectricVehicle(v);
                              const unitV = isElecV ? 'kWh' : 'L';
                              const nounV = isElecV ? 'Bateria' : 'Tanque';
                              const labelV = isElecV
                                ? '⚡ Elétrico'
                                : (v.fuelType || 'Gasolina').toLowerCase() === 'diesel'
                                  ? '🛢️ Diesel'
                                  : '⛽ Gasolina';
                              return (
                                <option
                                  key={v.id}
                                  value={v.id}
                                  style={conflict ? { color: '#f87171', fontWeight: 600 } : undefined}
                                >
                                  {conflict ? '⚠️ [EM USO] ' : ''}{v.name} ({v.plate})
                                  {conflict ? ` — Ocupada na missão ${conflict.code} (${conflict.timeRange})` : ''}
                                  {!conflict ? ` • ${labelV} — ${nounV}: ${vTel.currentLiters}${unitV}/${vTel.tankCapacity}${unitV} (${vTel.currentPercent}%)` : ''}
                                  {vTel.isReserveAlert ? (isElecV ? ' ⚠️ BATERIA BAIXA' : ' ⚠️ RESERVA') : ''}
                                  {usedElsewhere ? ' (Em uso acima)' : ''}
                                </option>
                              );
                            })}
                          </select>

                          {vConflict && (
                            <div className="mm-conflict-banner mm-conflict-vehicle" style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.35)', borderRadius: '6px', padding: '8px 12px', marginTop: '6px' }}>
                              <div className="mcb-icon" style={{ color: '#fbbf24' }}>
                                <AlertTriangle size={15} />
                              </div>
                              <div className="mcb-content">
                                <strong className="mcb-title" style={{ color: '#fbbf24' }}>Viatura em Escala Compartilhada / Forçada</strong>
                                <p className="mcb-desc" style={{ color: '#cbd5e1' }}>
                                  A viatura selecionada também atende à missão <strong>{vConflict.code} "{vConflict.description}"</strong> ({vConflict.timeRange}). Participação compartilhada autorizada pelo gestor.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="form-group flex-1">
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Users size={13} className="text-cyan-bright" />
                            <span>Condutor / Motorista #{idx + 1}</span>
                          </label>
                          <select
                            value={alloc.driverId}
                            onChange={(e) => handleChangeAllocationDriver(idx, e.target.value)}
                            className={`vac-select-control driver-main-select ${dConflict ? 'vac-select-conflict' : ''}`}
                          >
                            <option value="">
                              {members.length === 0 ? 'Nenhum colaborador cadastrado' : '-- Selecione o condutor --'}
                            </option>

                            {habilitados.length > 0 && (
                              <optgroup label="⭐ Motoristas Habilitados (Com CNH)">
                                {habilitados.map((m) => {
                                  const dConf = scheduleConflicts.memberConflicts[m.id];
                                  return (
                                    <option
                                      key={m.id}
                                      value={m.id}
                                      style={dConf ? { color: '#fbbf24', fontWeight: 600 } : undefined}
                                    >
                                      {dConf ? '⚠️ [OCUPADO] ' : ''}🚗 {m.name} — {m.role} ({m.company}) [CNH {m.cnhCategory || 'B'}]
                                      {dConf ? ` (${dConf.role} na missão ${dConf.code} - ${dConf.timeRange})` : ''}
                                    </option>
                                  );
                                })}
                              </optgroup>
                            )}

                            <optgroup label={habilitados.length > 0 ? "Demais Membros da Equipe" : "Todos os Colaboradores"}>
                              {demaisMembros.map((m) => {
                                const dConf = scheduleConflicts.memberConflicts[m.id];
                                return (
                                  <option
                                    key={m.id}
                                    value={m.id}
                                    style={dConf ? { color: '#fbbf24', fontWeight: 600 } : undefined}
                                  >
                                    {dConf ? '⚠️ [OCUPADO] ' : ''}{m.name} — {m.role} ({m.company})
                                    {dConf ? ` (${dConf.role} na missão ${dConf.code} - ${dConf.timeRange})` : ''}
                                  </option>
                                );
                              })}
                            </optgroup>
                          </select>

                          {dConflict && (
                            <div className="mm-conflict-banner mm-conflict-driver" style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.35)', borderRadius: '6px', padding: '8px 12px', marginTop: '6px' }}>
                              <div className="mcb-icon" style={{ color: '#fbbf24' }}>
                                <AlertTriangle size={15} />
                              </div>
                              <div className="mcb-content">
                                <strong className="mcb-title" style={{ color: '#fbbf24' }}>Condutor em Escala Compartilhada / Forçada</strong>
                                <p className="mcb-desc" style={{ color: '#cbd5e1' }}>
                                  O colaborador selecionado também faz parte da missão <strong>{dConflict.code} "{dConflict.description}"</strong> ({dConflict.timeRange}). Atuação compartilhada autorizada pelo gestor.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* TELEMETRIA MINUCIOSA DO TANQUE / BATERIA DESTA VIATURA NA MISSÃO */}
                      {vehObj && bd && (() => {
                        const isElecAlloc = isElectricVehicle(vehObj);
                        const unitAlloc = isElecAlloc ? 'kWh' : 'L';
                        const nounAlloc = isElecAlloc ? 'Bateria' : 'Tanque';
                        const actionAlloc = isElecAlloc ? 'recarregar' : 'abastecer';

                        return (
                          <div
                            className={`vac-fuel-telemetry-box ${bd.triggersReserveAlert ? 'vac-fuel-reserve-danger' : ''
                              }`}
                          >
                            <div className="vft-top-row">
                              <div className="vft-metric">
                                <span>{nounAlloc} Antes da Missão</span>
                                <strong>
                                  {bd.litersBefore} {unitAlloc} / {bd.tankCapacity} {unitAlloc} ({bd.percentBefore}%)
                                </strong>
                                <small>Alcance máx 1 {nounAlloc.toLowerCase()}: {bd.maxTankRangeKm} km</small>
                              </div>

                              <div className="vft-metric vft-deduction">
                                <span>Dedução desta Missão ({bd.km} km)</span>
                                <strong>
                                  -{bd.litersNeeded} {unitAlloc} (-{bd.percentOfTankUsed}%)
                                </strong>
                                <small>Custo: R$ {bd.totalCost.toFixed(2)}</small>
                              </div>

                              <div className="vft-metric">
                                <span>{nounAlloc} Após a Missão</span>
                                <strong
                                  className={
                                    bd.triggersReserveAlert ? 'text-danger-bright' : 'text-green-bright'
                                  }
                                >
                                  {bd.litersAfter} {unitAlloc} / {bd.tankCapacity} {unitAlloc} ({bd.percentAfter}%)
                                </strong>
                                <small>Autonomia restante: ~{bd.remainingRangeAfterKm} km</small>
                              </div>
                            </div>

                            {/* Barra Visual Antes -> Depois com Marcador de Reserva (10%) */}
                            <div className="fuel-progress-bg" style={{ marginTop: 8 }}>
                              <div
                                className="fuel-reserve-marker"
                                style={{ left: '10%' }}
                                title={`Reserva / Bateria Crítica (10%)`}
                              />
                              <div
                                className={`fuel-progress-fill ${bd.triggersReserveAlert ? 'fill-danger reserve-pulse' : 'fill-good'
                                  }`}
                                style={{ width: `${Math.min(100, Math.max(0, bd.percentAfter))}%` }}
                              />
                            </div>

                            {/* Alertas */}
                            {bd.exceedsCurrentAvailableFuel && (
                              <div className="vft-deficit-alert">
                                <AlertTriangle size={14} />
                                <span>
                                  <strong>{isElecAlloc ? 'Carga da bateria insuficiente para concluir sem recarregar:' : 'Combustível atual insuficiente para concluir sem abastecer:'}</strong>{' '}
                                  Esta missão consome <strong>{bd.litersNeeded} {unitAlloc}</strong> e a viatura possui{' '}
                                  <strong>{bd.litersBefore} {unitAlloc}</strong> no {nounAlloc.toLowerCase()}. Será necessário {actionAlloc} pelo menos{' '}
                                  <strong>+{bd.deficitFromCurrentLiters} {unitAlloc}</strong> (Valor adicional:{' '}
                                  <strong>+R$ {Number(bd.deficitFromCurrentCost || 0).toFixed(2)}</strong>).
                                </span>
                              </div>
                            )}

                            {bd.exceedsFullTankCapacity && (
                              <div className="vft-excess-tank-alert">
                                <Fuel size={14} />
                                <span>
                                  <strong>Ultrapassa 1 {nounAlloc.toLowerCase()} completo(a) ({bd.maxTankRangeKm} km):</strong>{' '}
                                  Excedente além de 1 {nounAlloc.toLowerCase()}: <strong>+{bd.excessOverFullTankKm} km</strong> •{' '}
                                  <strong>+{bd.excessOverFullTankLiters} {unitAlloc} (+{bd.excessOverFullTankPercent}% de 1 {nounAlloc.toLowerCase()})</strong> •{' '}
                                  Valor Excedente: <strong>+R$ {Number(bd.excessOverFullTankCost || 0).toFixed(2)}</strong>.
                                </span>
                              </div>
                            )}

                            {bd.triggersReserveAlert && (
                              <div className="vft-reserve-alert">
                                <AlertTriangle size={14} />
                                <span>
                                  <strong>{isElecAlloc ? '⚡ ALERTA DE BATERIA BAIXA (≤ 10%):' : '🚨 ALERTA DE RESERVA DE COMBUSTÍVEL (≤ 10%):'}</strong> Após esta missão, {isElecAlloc ? 'a bateria' : 'o tanque'} ficará em{' '}
                                  <strong>{bd.percentAfter}% ({bd.litersAfter} {unitAlloc})</strong> — sinalizando{' '}
                                  <strong>{isElecAlloc ? 'recarga imediata' : 'abastecimento imediato'}</strong> da viatura!
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      <div className="driver-quick-chips">
                        <span className="driver-chips-label">Atribuição Rápida de Condutor:</span>
                        {[...habilitados, ...demaisMembros].map((m) => {
                          const isThisDriver = alloc.driverId === m.id;
                          const isHabilitado = Boolean(m.canDrive ?? m.hasCnh);
                          return (
                            <button
                              key={m.id}
                              type="button"
                              className={`driver-quick-chip ${isThisDriver ? 'active' : ''} ${isHabilitado ? 'chip-habilitado' : ''}`}
                              onClick={() =>
                                handleChangeAllocationDriver(idx, isThisDriver ? '' : m.id)
                              }
                              title={isHabilitado ? `Habilitado a conduzir • CNH ${m.cnhCategory || 'B'}` : 'Sem CNH registrada'}
                            >
                              <Car size={11} className={isHabilitado ? 'text-cyan-bright' : ''} />
                              <span>{m.name}</span>
                              {isHabilitado && <small className="chip-cnh-tag">CNH {m.cnhCategory || 'B'}</small>}
                              {isThisDriver && <Check size={11} />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* ============================================================== */}
          {/* PASSO 4: PÓS-PRODUÇÃO                                          */}
          {/* ============================================================== */}
          {(() => {
            const isEditionNotApplicable = !hasMissionPostProduction(formData);
            return (
              <div
                className={`mm-card-panel ${isEditionNotApplicable ? 'step-not-applicable' : ''}`}
                style={
                  isEditionNotApplicable
                    ? {
                      border: '1px solid rgba(234, 179, 8, 0.35)',
                      transition: 'all 0.3s ease',
                    }
                    : { transition: 'all 0.3s ease' }
                }
              >
                <div className="mm-card-header">
                  <span
                    className="mm-step-pill"
                    style={
                      isEditionNotApplicable
                        ? { opacity: 0.7, background: '#eab308', color: '#000' }
                        : {}
                    }
                  >
                    4
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <h3 className="mm-card-title">Pós-Produção</h3>
                      {isEditionNotApplicable && (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '999px',
                            background: 'rgba(234, 179, 8, 0.15)',
                            color: '#facc15',
                            border: '1px solid rgba(234, 179, 8, 0.35)',
                          }}
                        >
                          🔒 Desativado (Não se aplica)
                        </span>
                      )}
                    </div>
                    <p className="mm-card-subtitle">
                      {isEditionNotApplicable
                        ? 'Pós-produção desativada porque o status está como "Não se aplica". Altere o status abaixo para reativar.'
                        : 'Defina o status de edição, prazos de entrega e designe os editores responsáveis'}
                    </p>
                  </div>
                </div>

                {/* CONTEÚDO DE PÓS-PRODUÇÃO */}
                <div
                  className="mm-postprod-box"
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    padding: '14px',
                    borderRadius: '10px',
                    border: isEditionNotApplicable
                      ? '1px solid rgba(234, 179, 8, 0.2)'
                      : '1px solid var(--border-subtle)',
                    transition: 'all 0.3s ease',
                  }}
                >
                  <div className="form-row mm-three-cols" style={{ marginBottom: '14px' }}>
                    {/* Campo Status da Edição: SEMPRE INTERATIVO E NORMAL */}
                    <div className="form-group flex-1" style={{ position: 'relative', zIndex: 10 }}>
                      <label><Sliders size={13} /> Status da Edição</label>
                      <select
                        value={formData.editionStatus}
                        onChange={(e) => {
                          const val = e.target.value;
                          const isValNotApp = !hasMissionPostProduction({ editionStatus: val });
                          setFormData((prev) => ({
                            ...prev,
                            editionStatus: val,
                            ...(isValNotApp
                              ? {
                                editorIds: [],
                                deliveryDeadlineDate: '',
                                deliveryDeadlineTime: '',
                                isOverdue: 0,
                                editionDeliveryStatus: '',
                              }
                              : {
                                deliveryDeadlineDate: prev.deliveryDeadlineDate || prev.date || getLocalTodayStr(),
                                deliveryDeadlineTime: prev.deliveryDeadlineTime || '18:00',
                              }),
                          }));
                        }}
                        style={{
                          colorScheme: 'dark',
                          color: '#ffffff',
                          ...(isEditionNotApplicable
                            ? {
                              borderColor: 'rgba(234, 179, 8, 0.7)',
                              background: '#111827',
                              fontWeight: 600,
                              boxShadow: '0 0 10px rgba(234, 179, 8, 0.2)',
                            }
                            : {}),
                        }}
                      >
                        <option value="Pendente" style={{ backgroundColor: '#0f172a', color: '#f8fafc' }}>
                          Pendente
                        </option>
                        <option value="Em Edição" style={{ backgroundColor: '#0f172a', color: '#f8fafc' }}>
                          Em Edição
                        </option>
                        <option value="Edição Concluída" style={{ backgroundColor: '#0f172a', color: '#f8fafc' }}>
                          Edição Concluída
                        </option>
                        <option value="Entregue" style={{ backgroundColor: '#0f172a', color: '#f8fafc' }}>
                          Entregue ao Cliente
                        </option>
                        <option value="Não se aplica" style={{ backgroundColor: '#0f172a', color: '#f8fafc' }}>
                          Não se aplica (Mega Print / Instalação)
                        </option>
                      </select>
                    </div>

                    {/* Data Limite: Opaco e sem interação quando Não se aplica */}
                    <div
                      className="form-group flex-1"
                      style={{
                        transition: 'opacity 0.25s ease',
                        ...(isEditionNotApplicable
                          ? { opacity: 0.28, pointerEvents: 'none', filter: 'grayscale(0.8)', userSelect: 'none' }
                          : {}),
                      }}
                    >
                      <label><Calendar size={13} /> Data Limite de Entrega</label>
                      <input
                        type="date"
                        disabled={isEditionNotApplicable}
                        value={isEditionNotApplicable ? '' : (formData.deliveryDeadlineDate || formData.date)}
                        onChange={(e) =>
                          setFormData({ ...formData, deliveryDeadlineDate: e.target.value })
                        }
                      />
                    </div>

                    {/* Horário Limite: Opaco e sem interação quando Não se aplica */}
                    <div
                      className="form-group flex-1"
                      style={{
                        transition: 'opacity 0.25s ease',
                        ...(isEditionNotApplicable
                          ? { opacity: 0.28, pointerEvents: 'none', filter: 'grayscale(0.8)', userSelect: 'none' }
                          : {}),
                      }}
                    >
                      <label><Clock size={13} /> Horário Limite de Entrega</label>
                      <input
                        type="time"
                        disabled={isEditionNotApplicable}
                        value={isEditionNotApplicable ? '' : (formData.deliveryDeadlineTime || '18:00')}
                        onChange={(e) =>
                          setFormData({ ...formData, deliveryDeadlineTime: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  {/* SELEÇÃO DO EDITOR DESIGNADO: Opaco e sem interação quando Não se aplica */}
                  <div
                    className="form-group"
                    style={{
                      marginBottom: 0,
                      transition: 'opacity 0.25s ease',
                      ...(isEditionNotApplicable
                        ? { opacity: 0.28, pointerEvents: 'none', filter: 'grayscale(0.8)', userSelect: 'none' }
                        : {}),
                    }}
                  >
                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                        <Film size={14} className="text-cyan-bright" />
                        Editor(es) Designado(s) para Pós-Produção:
                      </span>
                      <small style={{ fontWeight: 400, opacity: 0.75 }}>
                        {isEditionNotApplicable
                          ? '(Desativado)'
                          : '(O editor receberá notificação direta desta tarefa)'}
                      </small>
                    </label>

                    {(() => {
                      const isEditorRole = (m) => {
                        const rolesToCheck = [
                          m?.role,
                          ...(Array.isArray(m?.secondaryRoles) ? m.secondaryRoles : []),
                        ].filter(Boolean);

                        return rolesToCheck.some((rawRole) => {
                          const r = String(rawRole)
                            .toLowerCase()
                            .normalize('NFD')
                            .replace(/[\u0300-\u036f]/g, '');
                          return (
                            r.includes('editor') ||
                            r.includes('edicao') ||
                            r.includes('designer') ||
                            r.includes('pos') ||
                            r.includes('video') ||
                            r.includes('arte') ||
                            r.includes('motion')
                          );
                        });
                      };

                      const editorMembers = members
                        .filter(isEditorRole)
                        .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));

                      const otherMembers = members
                        .filter((m) => !isEditorRole(m))
                        .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));

                      return (
                        <div className="post-prod-chips-wrapper">
                          {/* GRUPO 1: EDITORES E DESIGNERS EM DESTAQUE NO TOPO DA LISTA */}
                          {editorMembers.length > 0 && (
                            <div className="editor-group-block">
                              <div className="editor-group-header">
                                <Sparkles size={13} className="text-cyan-bright" />
                                <span className="editor-group-title">
                                  Editores & Designers de Pós-Produção ({editorMembers.length})
                                </span>
                                <span className="editor-group-badge">Destaque</span>
                              </div>
                              <div className="driver-quick-chips">
                                {editorMembers.map((m) => {
                                  const isEditor = (formData.editorIds || []).includes(m.id);
                                  return (
                                    <button
                                      key={m.id}
                                      type="button"
                                      disabled={isEditionNotApplicable}
                                      className={`driver-quick-chip is-editor-role ${isEditor ? 'active' : ''}`}
                                      onClick={() => toggleEditor(m.id)}
                                      title={`Designar ${m.name} (${m.role})`}
                                    >
                                      <Film size={12} className="chip-editor-icon" />
                                      <span className="chip-editor-name">{m.name}</span>
                                      <span className="chip-editor-role-tag">{m.role}</span>
                                      {isEditor && <Check size={12} className="chip-editor-check" />}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* GRUPO 2: DEMAIS COLABORADORES */}
                          {otherMembers.length > 0 && (
                            <div className="editor-group-block other-members-block">
                              <div className="editor-group-header other-header">
                                <Users size={12} />
                                <span className="editor-group-title other-title">
                                  Demais Colaboradores da Equipe ({otherMembers.length})
                                </span>
                              </div>
                              <div className="driver-quick-chips">
                                {otherMembers.map((m) => {
                                  const isEditor = (formData.editorIds || []).includes(m.id);
                                  return (
                                    <button
                                      key={m.id}
                                      type="button"
                                      disabled={isEditionNotApplicable}
                                      className={`driver-quick-chip ${isEditor ? 'active' : ''}`}
                                      onClick={() => toggleEditor(m.id)}
                                      title={`Designar ${m.name}`}
                                    >
                                      <Users size={11} />
                                      <span>{m.name}</span>
                                      {m.role && <small style={{ opacity: 0.65 }}>({m.role})</small>}
                                      {isEditor && <Check size={11} />}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {members.length === 0 && (
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0' }}>
                              Nenhum membro da equipe cadastrado no sistema.
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* CAMPO DEDICADO: LOCAL DOS ARQUIVOS / PASTA NO SERVIDOR (PÓS-PRODUÇÃO) */}
                  {!isEditionNotApplicable && (
                    <div
                      className="form-group"
                      style={{
                        marginTop: '16px',
                        marginBottom: 0,
                        padding: '12px 14px',
                        background: 'rgba(2, 132, 199, 0.05)',
                        border: '1px solid rgba(56, 189, 248, 0.2)',
                        borderRadius: '10px',
                      }}
                    >
                      <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.84rem' }}>
                          <HardDrive size={14} className="text-amber" />
                          <span>Local do Arquivo / Pasta no Servidor (Pós-Produção):</span>
                        </span>
                        {formData.serverFilePath && (
                          <button
                            type="button"
                            className="btn-text-action"
                            style={{
                              fontSize: '0.73rem',
                              color: '#38bdf8',
                              background: 'rgba(56, 189, 248, 0.12)',
                              border: '1px solid rgba(56, 189, 248, 0.25)',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              padding: '2px 8px',
                            }}
                            onClick={() => {
                              navigator.clipboard.writeText(formData.serverFilePath);
                              alertDialog({
                                title: 'Caminho Copiado',
                                message: 'Caminho copiado para a área de transferência!',
                                variant: 'info',
                              });
                            }}
                          >
                            📋 Copiar Caminho
                          </button>
                        )}
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Ex: S:\MEGA FILMES\FORMATURAS\2026\TERCEIRÃO SESI 14.11\EXTERNA\LR"
                        value={formData.serverFilePath || ''}
                        onChange={(e) => setFormData({ ...formData, serverFilePath: e.target.value })}
                        style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}
                      />
                      <small style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '4px', display: 'block' }}>
                        Diretório onde o editor depositou os materiais finalizados. Fica registrado no histórico da missão de forma separada, sem alterar o briefing da equipe.
                      </small>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ============================================================== */}
          {/* PASSO 5: EQUIPE DE CAMPO                                       */}
          {/* ============================================================== */}
          {(() => {
            const teamAvailableCompanies = (() => {
              const set = new Set();
              members.forEach((m) => {
                if (m.company && m.company.trim()) set.add(m.company.trim());
              });
              return Array.from(set);
            })();

            const filteredTeamMembers = members.filter((m) => {
              const q = teamSearchQuery.trim().toLowerCase();
              if (q) {
                const name = (m.name || '').toLowerCase();
                const role = (m.role || '').toLowerCase();
                const secRoles = Array.isArray(m.secondaryRoles) ? m.secondaryRoles.join(' ').toLowerCase() : '';
                const comp = (m.company || '').toLowerCase();
                if (!name.includes(q) && !role.includes(q) && !secRoles.includes(q) && !comp.includes(q)) {
                  return false;
                }
              }

              if (teamFilterTab === 'SELECTED') {
                return formData.teamIds.includes(m.id);
              }
              if (teamFilterTab === 'DRIVERS') {
                return Boolean(m.canDrive ?? m.hasCnh);
              }
              if (teamFilterTab !== 'ALL') {
                return m.company === teamFilterTab;
              }
              return true;
            });

            return (
              <div className="mm-card-panel">
                <div className="mm-card-header" style={{ alignItems: 'flex-start' }}>
                  <span className="mm-step-pill">5</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                      <h3 className="mm-card-title">Equipe de Campo</h3>
                      <div className="mm-team-counter-badge" title="Total de colaboradores escalados nesta missão">
                        <Users size={12} />
                        <span>
                          <strong>{formData.teamIds.length}</strong> de {members.length} escalado{formData.teamIds.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <p className="mm-card-subtitle">Escale os cinegrafistas, assistentes e profissionais que irão a campo</p>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  {activeTeamConflicts.length > 0 && (
                    <div className="mm-conflict-banner mm-conflict-team" style={{ marginBottom: 14 }}>
                      <div className="mcb-icon">
                        <AlertTriangle size={18} />
                      </div>
                      <div className="mcb-content">
                        <strong className="mcb-title">Atenção: Colaborador(es) em Conflito de Horário!</strong>
                        <p className="mcb-desc" style={{ marginBottom: 4 }}>
                          Os seguintes participantes selecionados já estão escalados em outra missão neste horário:
                        </p>
                        <ul className="mcb-list">
                          {activeTeamConflicts.map((c) => (
                            <li key={c.id}>
                              <strong>{c.name}</strong>: Escalado na missão <strong>{c.conflict.code} {c.conflict.description}</strong> ({c.conflict.timeRange}).
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* BARRA SUPERIOR DINÂMICA: BUSCA + ABAS DE FILTRO */}
                  <div className="mm-team-toolbar">
                    <div className="mm-team-search-wrap">
                      <Search size={14} className="mm-team-search-icon" />
                      <input
                        type="text"
                        className="mm-team-search-input"
                        placeholder="Buscar colaborador por nome, cargo ou empresa..."
                        value={teamSearchQuery}
                        onChange={(e) => setTeamSearchQuery(e.target.value)}
                      />
                      {teamSearchQuery && (
                        <button
                          type="button"
                          className="mm-team-search-clear"
                          onClick={() => setTeamSearchQuery('')}
                          title="Limpar busca"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>

                    <div className="mm-team-filter-tabs">
                      <button
                        type="button"
                        className={`mm-team-tab-btn ${teamFilterTab === 'ALL' ? 'active' : ''}`}
                        onClick={() => setTeamFilterTab('ALL')}
                      >
                        <span>Todos</span>
                        <span className="tab-pill-count">{members.length}</span>
                      </button>

                      <button
                        type="button"
                        className={`mm-team-tab-btn tab-highlight-selected ${teamFilterTab === 'SELECTED' ? 'active' : ''}`}
                        onClick={() => setTeamFilterTab('SELECTED')}
                      >
                        <Check size={12} />
                        <span>Escalados</span>
                        <span className="tab-pill-count">{formData.teamIds.length}</span>
                      </button>

                      {teamAvailableCompanies.map((comp) => {
                        const count = members.filter((m) => m.company === comp).length;
                        return (
                          <button
                            key={comp}
                            type="button"
                            className={`mm-team-tab-btn ${teamFilterTab === comp ? 'active' : ''}`}
                            onClick={() => setTeamFilterTab(comp)}
                          >
                            <span>{comp}</span>
                            <span className="tab-pill-count">{count}</span>
                          </button>
                        );
                      })}

                      {members.some((m) => Boolean(m.canDrive ?? m.hasCnh)) && (
                        <button
                          type="button"
                          className={`mm-team-tab-btn ${teamFilterTab === 'DRIVERS' ? 'active' : ''}`}
                          onClick={() => setTeamFilterTab('DRIVERS')}
                        >
                          <Car size={12} />
                          <span>Motoristas</span>
                          <span className="tab-pill-count">
                            {members.filter((m) => Boolean(m.canDrive ?? m.hasCnh)).length}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* BARRA DE RESUMO E ATALHOS */}
                  <div className="mm-team-status-strip">
                    <span className="mm-team-status-text">
                      Exibindo <strong>{filteredTeamMembers.length}</strong> de {members.length} colaboradores
                      {teamSearchQuery && <em> • Busca: "{teamSearchQuery}"</em>}
                      {teamFilterTab !== 'ALL' && (
                        <em> • Filtro: {teamFilterTab === 'SELECTED' ? 'Escalados' : teamFilterTab === 'DRIVERS' ? 'Motoristas CNH' : teamFilterTab}</em>
                      )}
                    </span>

                    <div className="mm-team-status-actions">
                      {formData.teamIds.length > 0 && (
                        <button
                          type="button"
                          className="mm-btn-clear-selection"
                          onClick={() => {
                            const driverIds = formData.vehicleAllocations.map((a) => a.driverId).filter(Boolean);
                            setFormData((prev) => ({ ...prev, teamIds: driverIds }));
                          }}
                          title="Desmarcar equipe (preserva condutores alocados no passo 3)"
                        >
                          Limpar Seleção
                        </button>
                      )}
                      {filteredTeamMembers.length > 0 && formData.teamIds.length < members.length && (
                        <button
                          type="button"
                          className="mm-btn-select-all"
                          onClick={() => {
                            const combined = Array.from(new Set([...formData.teamIds, ...filteredTeamMembers.map((m) => m.id)]));
                            setFormData((prev) => ({ ...prev, teamIds: combined }));
                          }}
                          title="Adicionar todos os colaboradores visíveis à equipe"
                        >
                          + Selecionar Visíveis
                        </button>
                      )}
                    </div>
                  </div>

                  {/* GRADE DE COLABORADORES FLUIDA E ELEGANTE (SEM BARRA DE ROLAGEM PRESA) */}
                  <div className="mm-team-grid">
                    {members.length === 0 ? (
                      <div className="mm-team-empty-state">
                        Nenhum colaborador cadastrado ainda. Cadastre sua equipe na aba "Equipes".
                      </div>
                    ) : filteredTeamMembers.length === 0 ? (
                      <div className="mm-team-empty-state">
                        <span>Nenhum colaborador encontrado para os filtros atuais.</span>
                        <button
                          type="button"
                          className="mm-btn-reset-filters"
                          onClick={() => {
                            setTeamSearchQuery('');
                            setTeamFilterTab('ALL');
                          }}
                        >
                          Limpar Filtros e Busca
                        </button>
                      </div>
                    ) : (
                      filteredTeamMembers.map((m) => {
                        const isSelected = formData.teamIds.includes(m.id);
                        const driverSlotIndex = formData.vehicleAllocations.findIndex(
                          (a) => a.driverId === m.id
                        );
                        const isDriver = driverSlotIndex >= 0;
                        const memConflict = scheduleConflicts.memberConflicts[m.id];
                        const isHabilitado = Boolean(m.canDrive ?? m.hasCnh);
                        const extraAvailCheck = checkMemberExtraHoursAvailability(
                          m,
                          formData.date,
                          formData.departureTime,
                          formData.returnTimeEstimated || formData.returnTime,
                          formData.isMultiDay,
                          formData.endDate
                        );

                        return (
                          <div
                            key={m.id}
                            className={`mm-member-card ${isSelected ? 'selected' : ''} ${isDriver ? 'is-driver' : ''
                              } ${memConflict ? 'has-conflict' : ''} ${extraAvailCheck.isUnavailable ? 'has-extra-unavail' : ''}`}
                            onClick={() => toggleTeamMember(m.id)}
                          >
                            <div className="mm-member-card-body">
                              {/* AVATAR + STATUS INDICATOR */}
                              <div className="mm-member-avatar-col">
                                <div className={`mm-member-avatar ${isSelected ? 'avatar-active' : ''} ${isDriver ? 'avatar-driver' : ''}`}>
                                  {m.photoUrl ? (
                                    <img src={m.photoUrl} alt={m.name} />
                                  ) : (
                                    <span>{m.name.slice(0, 2).toUpperCase()}</span>
                                  )}
                                </div>
                                {isDriver && (
                                  <span className="mm-avatar-driver-tag" title="Motorista designado">
                                    <Car size={9} />
                                  </span>
                                )}
                              </div>

                              {/* INFORMAÇÕES DO COLABORADOR */}
                              <div className="mm-member-details-col">
                                <div className="mm-member-name-row">
                                  <strong className="mm-member-name" title={m.name}>{m.name}</strong>
                                  <div className={`mm-checkbox ${isSelected ? 'checked' : ''}`}>
                                    {isSelected && <Check size={12} strokeWidth={3} />}
                                  </div>
                                </div>

                                <div className="mm-member-badges-row">
                                  <span className="mm-role-badge" title={m.role}>{m.role || 'Geral'}</span>
                                  {m.company && (
                                    <span className={`mm-company-badge ${m.company.toLowerCase().includes('print') ? 'comp-print' : 'comp-filmes'}`}>
                                      {m.company}
                                    </span>
                                  )}
                                  {isHabilitado && (
                                    <span className="mm-cnh-tag" title={`Habilitado com CNH ${m.cnhCategory || 'B'}`}>
                                      CNH {m.cnhCategory || 'B'}
                                    </span>
                                  )}
                                </div>

                                {extraAvailCheck.isUnavailable && (
                                  <div
                                    className="mm-member-unavail-badge"
                                    title={`Indisponível fora do expediente: ${extraAvailCheck.reason} (${extraAvailCheck.periodLabel || 'Fora do horário regular'})`}
                                  >
                                    <Ban size={11} />
                                    <span>Indisponível p/ Horas Extras ({extraAvailCheck.reason})</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* RODAPÉ DO CARD COM AÇÃO DE MOTORISTA E CONFLITO */}
                            <div className="mm-member-card-footer" onClick={(e) => e.stopPropagation()}>
                              {memConflict ? (
                                <span
                                  className="mm-conflict-pill"
                                  title={`Ocupado na missão ${memConflict.code}: ${memConflict.timeRange}. Clique no card para forçar participação compartilhada.`}
                                  style={isSelected ? { background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.35)', fontWeight: 700 } : undefined}
                                >
                                  <AlertTriangle size={11} />
                                  <span>{isSelected ? `🔄 Escala Compartilhada (${memConflict.code})` : `Ocupado (${memConflict.timeRange})`}</span>
                                </span>
                              ) : isHabilitado || isDriver ? (
                                <button
                                  type="button"
                                  className={`btn-driver-pill ${isDriver ? 'active' : ''}`}
                                  onClick={() => handleToggleMemberAsDriver(m.id)}
                                  title={
                                    isDriver
                                      ? `Motorista da Viatura #${driverSlotIndex + 1} (Clique para desatribuir)`
                                      : 'Definir como motorista de uma viatura'
                                  }
                                >
                                  <Car size={11} />
                                  <span>{isDriver ? `Motorista #${driverSlotIndex + 1}` : 'Escalar Motorista'}</span>
                                </button>
                              ) : (
                                <span className="mm-no-driver-pill">Sem CNH</span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* CONFIGURAÇÃO DE FUNÇÕES & REMUNERAÇÃO DA EQUIPE DE CAMPO */}
                  {formData.teamIds.length > 0 && (
                    <div className="mm-offhours-rates-section">
                      <div className="mm-offhours-rates-header">
                        <div className="mm-offhours-rates-title-wrap">
                          <Briefcase size={16} className="text-amber" />
                          <strong>Funções nesta Missão &amp; Remuneração da Equipe</strong>
                          {isMultiDay ? (
                            <span className="mm-offhours-rates-badge" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                              <Lock size={11} style={{ marginRight: 4, display: 'inline' }} />
                              Obrigatório: Diária de Viagem ({calculateDaysBetween(formData.date, formData.endDate)} {calculateDaysBetween(formData.date, formData.endDate) === 1 ? 'dia' : 'dias'})
                            </span>
                          ) : missionOffHours.isOffHours ? (
                            <span className="mm-offhours-rates-badge">
                              +{missionOffHours.offHours}h fora do expediente
                            </span>
                          ) : (
                            <span className="mm-offhours-rates-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                              Expediente Comercial
                            </span>
                          )}
                        </div>
                        <p className="mm-offhours-rates-subtitle">
                          {isMultiDay
                            ? 'Como esta missão é uma viagem com mais de um dia fora, a modalidade de remuneração é obrigatoriamente por Diária. Especifique a função desempenhada por cada colaborador e ajuste as diárias se necessário.'
                            : 'Defina a função específica exercida por cada colaborador nesta missão (essencial para as métricas e ranking da empresa) e selecione a modalidade de remuneração.'}
                        </p>

                        {/* SELETOR DE MODALIDADE DE REMUNERAÇÃO DA MISSÃO (3 MODALIDADES OFICIAIS) */}
                        <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>Modalidade Padrão:</span>
                          <button
                            type="button"
                            onClick={() => handleRemunerationTypeChange('off_hours')}
                            className={`btn-rate-mode ${(formData.remunerationType === 'off_hours' || (!formData.remunerationType && !isMultiDay)) ? 'active' : ''}`}
                            style={{
                              padding: '5px 12px',
                              borderRadius: '8px',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              border: (formData.remunerationType === 'off_hours' || (!formData.remunerationType && !isMultiDay)) ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.1)',
                              background: (formData.remunerationType === 'off_hours' || (!formData.remunerationType && !isMultiDay)) ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.03)',
                              color: (formData.remunerationType === 'off_hours' || (!formData.remunerationType && !isMultiDay)) ? '#fbbf24' : '#94a3b8',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <Clock size={13} />
                            1. Hora Extra
                          </button>

                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => handleRemunerationTypeChange('daily')}
                              className={`btn-rate-mode ${(formData.remunerationType === 'daily' || (!formData.remunerationType && isMultiDay)) ? 'active' : ''}`}
                              style={{
                                padding: '5px 12px',
                                borderRadius: '8px',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                border: (formData.remunerationType === 'daily' || (!formData.remunerationType && isMultiDay)) ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)',
                                background: (formData.remunerationType === 'daily' || (!formData.remunerationType && isMultiDay)) ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.03)',
                                color: (formData.remunerationType === 'daily' || (!formData.remunerationType && isMultiDay)) ? '#60a5fa' : '#94a3b8',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                            >
                              <CalendarRange size={13} />
                              2. Diária {isMultiDay ? '(Viagem)' : ''}
                            </button>
                          )}

                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => handleRemunerationTypeChange('custom')}
                              className={`btn-rate-mode ${formData.remunerationType === 'custom' ? 'active' : ''}`}
                              style={{
                                padding: '5px 12px',
                                borderRadius: '8px',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                border: formData.remunerationType === 'custom' ? '1px solid #a855f7' : '1px solid rgba(255,255,255,0.1)',
                                background: formData.remunerationType === 'custom' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255,255,255,0.03)',
                                color: formData.remunerationType === 'custom' ? '#c084fc' : '#94a3b8',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                              title="Definir valores e cachês personalizados (Exclusivo Administrador)"
                            >
                              <Sparkles size={13} />
                              3. Personalizada
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="mm-offhours-rates-grid">
                        {formData.teamIds.map((mId) => {
                          const mem = members.find((x) => x.id === mId);
                          if (!mem) return null;

                          // Modalidade ativa deste colaborador: para o gestor é sempre Hora Extra com valores oficiais
                          const memberMode = !isAdmin
                            ? 'off_hours'
                            : (formData.memberRemunerationTypes?.[mId] || formData.remunerationType || (isMultiDay ? 'daily' : 'off_hours'));
                          const isDailyMode = memberMode === 'daily';
                          const isCustomMode = memberMode === 'custom';

                          const defaultDailyRate = Number(mem.dailyRate ?? mem.daily_rate ?? 200);
                          const defaultHourlyRate = Number(mem.hourlyRate ?? mem.hourly_rate ?? 50);

                          const currentVal = formData.customRates && formData.customRates[mId] !== undefined
                            ? formData.customRates[mId]
                            : '';

                          // Apenas administradores podem aplicar taxas customizadas; gestores sempre seguem o valor padrão fixado
                          const effectiveRate = (!isAdmin || currentVal === '')
                            ? (isDailyMode ? defaultDailyRate : isCustomMode ? 0 : defaultHourlyRate)
                            : Number(currentVal);

                          const travelDays = isMultiDay ? calculateDaysBetween(formData.date, formData.endDate) : 1;
                          const extraRemun = calculateExtraHoursRemuneration(
                            missionOffHours.offHours,
                            effectiveRate
                          );

                          let estimatedSubtotal = '0.00';
                          let subtotalLabel = '';
                          if (isDailyMode) {
                            estimatedSubtotal = (effectiveRate * travelDays).toFixed(2);
                            subtotalLabel = `Total (${travelDays} diária${travelDays !== 1 ? 's' : ''}):`;
                          } else if (isCustomMode) {
                            estimatedSubtotal = effectiveRate.toFixed(2);
                            subtotalLabel = 'Total Acordado (Cachê):';
                          } else {
                            estimatedSubtotal = missionOffHours.isOffHours ? extraRemun.amount.toFixed(2) : '0.00';
                            subtotalLabel = missionOffHours.isOffHours
                              ? `Total (${missionOffHours.offHours}h extra${missionOffHours.offHours !== 1 ? 's' : ''}):`
                              : 'Expediente Normal:';
                          }

                          const rawMemberRole = formData.memberRoles?.[mId];
                          const selectedRoles = Array.isArray(rawMemberRole)
                            ? (rawMemberRole.length > 0 ? rawMemberRole : [normalizeToOfficialRole(mem.role)])
                            : (typeof rawMemberRole === 'string' && rawMemberRole.trim()
                              ? (rawMemberRole.includes(',') ? rawMemberRole.split(',').map((s) => s.trim()).filter(Boolean) : [rawMemberRole.trim()])
                              : [normalizeToOfficialRole(mem.role)]);

                          return (
                            <div key={mId} className="mm-offhours-rate-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.75rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                                <div className="mori-left">
                                  <div className="mori-avatar">
                                    {mem.photoUrl ? (
                                      <img src={mem.photoUrl} alt={mem.name} />
                                    ) : (
                                      <span>{mem.name.slice(0, 2).toUpperCase()}</span>
                                    )}
                                  </div>
                                  <div className="mori-info">
                                    <strong className="mori-name">{mem.name}</strong>
                                    <span className="mori-role">{mem.company || 'MegaFilmes'}</span>
                                  </div>
                                </div>

                                {/* SELETOR DE FUNÇÕES ACUMULATIVAS NESTA MISSÃO (12 FUNÇÕES OFICIAIS) */}
                                <div style={{ minWidth: '240px', flex: '1 1 260px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                                    <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 600 }}>
                                      🎯 Funções nesta Missão:
                                    </label>
                                    <span style={{ fontSize: '0.7rem', color: selectedRoles.length > 1 ? '#38bdf8' : '#94a3b8', fontWeight: 600 }}>
                                      {selectedRoles.length} {selectedRoles.length === 1 ? 'função' : 'funções acumuladas'}
                                    </span>
                                  </div>

                                  {/* Badges das Funções Selecionadas com botão de remoção */}
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                                    {selectedRoles.map((r) => {
                                      const color = ROLE_COLORS_MAP[r] || '#3b82f6';
                                      const icon = ROLE_ICONS_MAP[r] || '💼';
                                      return (
                                        <span
                                          key={r}
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '5px',
                                            padding: '4px 8px',
                                            background: 'rgba(15, 23, 42, 0.9)',
                                            border: `1px solid ${color}`,
                                            borderRadius: '6px',
                                            fontSize: '0.76rem',
                                            fontWeight: 600,
                                            color: '#f8fafc',
                                            boxShadow: `0 2px 8px ${color}22`
                                          }}
                                        >
                                          <span>{icon} {r}</span>
                                          {selectedRoles.length > 1 && (
                                            <button
                                              type="button"
                                              onClick={() => handleRemoveMemberRole(mId, r)}
                                              style={{
                                                background: 'transparent',
                                                border: 'none',
                                                color: '#94a3b8',
                                                cursor: 'pointer',
                                                padding: '0 2px',
                                                fontSize: '0.85rem',
                                                lineHeight: 1,
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                marginLeft: '2px'
                                              }}
                                              title={`Remover função ${r}`}
                                            >
                                              ✕
                                            </button>
                                          )}
                                        </span>
                                      );
                                    })}
                                  </div>

                                  {/* Seletor para adicionar/acumular outra função */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <select
                                      value=""
                                      onChange={(e) => {
                                        if (e.target.value) {
                                          handleAddMemberRole(mId, e.target.value);
                                        }
                                      }}
                                      style={{
                                        width: '100%',
                                        padding: '6px 10px',
                                        background: '#0f172a',
                                        border: '1px dashed rgba(255,255,255,0.25)',
                                        borderRadius: '8px',
                                        color: '#cbd5e1',
                                        fontSize: '0.78rem',
                                        fontWeight: 500,
                                        cursor: 'pointer'
                                      }}
                                    >
                                      <option value="">+ Acumular outra função (Fotógrafo, Totem, Drone, Áudio...)</option>
                                      {OFFICIAL_COMPANY_ROLES.filter((r) => !selectedRoles.includes(r)).map((r) => (
                                        <option key={r} value={r}>
                                          + {ROLE_ICONS_MAP[r] || '💼'} {r}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                              </div>

                              {/* SELETOR INDIVIDUAL DE MODALIDADE DO COLABORADOR */}
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', background: 'rgba(255,255,255,0.02)', padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <span style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 600 }}>Modalidade deste Colaborador:</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleMemberRemunerationTypeChange(mId, 'off_hours')}
                                    style={{
                                      padding: '3px 8px',
                                      borderRadius: '6px',
                                      fontSize: '0.73rem',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      border: memberMode === 'off_hours' ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.08)',
                                      background: memberMode === 'off_hours' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255,255,255,0.03)',
                                      color: memberMode === 'off_hours' ? '#fbbf24' : '#94a3b8',
                                    }}
                                    title="Remuneração por Hora Extra (Pacote base até 4h + valor hora a partir da 5ª)"
                                  >
                                    ⏱️ Hora Extra
                                  </button>
                                  {isAdmin && (
                                    <button
                                      type="button"
                                      onClick={() => handleMemberRemunerationTypeChange(mId, 'daily')}
                                      style={{
                                        padding: '3px 8px',
                                        borderRadius: '6px',
                                        fontSize: '0.73rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        border: memberMode === 'daily' ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.08)',
                                        background: memberMode === 'daily' ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255,255,255,0.03)',
                                        color: memberMode === 'daily' ? '#60a5fa' : '#94a3b8',
                                      }}
                                      title="Remuneração por Diária fechada de campo ou viagem"
                                    >
                                      📅 Diária
                                    </button>
                                  )}
                                  {isAdmin && (
                                    <button
                                      type="button"
                                      onClick={() => handleMemberRemunerationTypeChange(mId, 'custom')}
                                      style={{
                                        padding: '3px 8px',
                                        borderRadius: '6px',
                                        fontSize: '0.73rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        border: memberMode === 'custom' ? '1px solid #a855f7' : '1px solid rgba(255,255,255,0.08)',
                                        background: memberMode === 'custom' ? 'rgba(168, 85, 247, 0.25)' : 'rgba(255,255,255,0.03)',
                                        color: memberMode === 'custom' ? '#c084fc' : '#94a3b8',
                                      }}
                                      title="Remuneração Personalizada com valor total fixo acordado (Cachê) - Exclusivo Administrador"
                                    >
                                      🎯 Personalizada
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* PARTE FINANCEIRA: VALOR DA TAXA / CACHÊ */}
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.75rem', gap: '1rem', flexWrap: 'wrap' }}>
                                <div className="rate-currency-field" style={{ flex: '1 1 240px' }}>
                                  <div className="rcf-label-row">
                                    <span className="rcf-label">
                                      {isDailyMode
                                        ? '📅 Valor da Diária (por dia):'
                                        : isCustomMode
                                          ? '🎯 Valor Fixo Acordado / Cachê (R$ Total):'
                                          : '⏱️ Valor da Hora Extra (por hora):'}
                                    </span>
                                    {isAdmin && currentVal !== '' && (
                                      <button
                                        type="button"
                                        className="rcf-btn-reset"
                                        onClick={() => handleCustomRateChange(mId, '')}
                                        title="Restaurar valor padrão do perfil"
                                      >
                                        <X size={11} /> Restaurar Padrão
                                      </button>
                                    )}
                                  </div>

                                  {isAdmin ? (
                                    <div className="rcf-input-group">
                                      <span className="rcf-prefix">R$</span>
                                      <input
                                        type="number"
                                        step={isDailyMode ? '10' : isCustomMode ? '25' : '5'}
                                        min="0"
                                        placeholder={
                                          isDailyMode
                                            ? defaultDailyRate.toFixed(2)
                                            : isCustomMode
                                              ? '0.00'
                                              : defaultHourlyRate.toFixed(2)
                                        }
                                        value={currentVal}
                                        onChange={(e) => handleCustomRateChange(mId, e.target.value)}
                                        className="rcf-input"
                                      />
                                      <button
                                        type="button"
                                        className="rcf-btn-step"
                                        onClick={() => {
                                          const cur = currentVal !== ''
                                            ? Number(currentVal)
                                            : (isDailyMode ? defaultDailyRate : isCustomMode ? 0 : defaultHourlyRate);
                                          const step = isDailyMode ? 10 : isCustomMode ? 25 : 5;
                                          handleCustomRateChange(mId, Math.max(0, cur - step));
                                        }}
                                        title="Diminuir"
                                      >
                                        -
                                      </button>
                                      <button
                                        type="button"
                                        className="rcf-btn-step"
                                        onClick={() => {
                                          const cur = currentVal !== ''
                                            ? Number(currentVal)
                                            : (isDailyMode ? defaultDailyRate : isCustomMode ? 0 : defaultHourlyRate);
                                          const step = isDailyMode ? 10 : isCustomMode ? 25 : 5;
                                          handleCustomRateChange(mId, cur + step);
                                        }}
                                        title="Aumentar"
                                      >
                                        +
                                      </button>
                                    </div>
                                  ) : (
                                    /* GESTOR: Totalmente travado e protegido contra alterações nos valores das horas extras */
                                    <div className="rcf-locked-display" title="Valor fixado pelo Administrador para este colaborador">
                                      <div className="rcf-locked-pill">
                                        <Lock size={13} className="text-amber" />
                                        <span className="rcf-locked-prefix">R$</span>
                                        <span className="rcf-locked-val">
                                          {defaultHourlyRate.toFixed(2)}
                                        </span>
                                        <span className="rcf-locked-unit">
                                          / hora extra
                                        </span>
                                      </div>
                                      <span className="rcf-locked-notice">
                                        🔒 Tabela Oficial fixada pelo Administrador
                                      </span>
                                    </div>
                                  )}
                                </div>

                                <div className="rcf-subtotal-card">
                                  <span className="rcf-subtotal-lbl">
                                    {subtotalLabel}
                                  </span>
                                  <strong className="rcf-subtotal-val">R$ {estimatedSubtotal}</strong>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* SUBSEÇÃO: CONVIDADOS EXTERNOS & FREELANCERS */}
                  <div className="mm-guests-section">
                    <div className="mm-guests-header">
                      <div className="mm-guests-title-wrap">
                        <UserPlus size={16} className="text-purple" />
                        <strong>Convidados Externos &amp; Freelancers</strong>
                        <span className="mm-guests-count-badge">
                          {(formData.guests || []).length} adicionado{(formData.guests || []).length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <small className="mm-guests-subtitle">
                        Pessoas de fora da empresa, convidados ou freelancers. Não possuem login no sistema, não recebem notificações e não transmitem GPS, mas ficam registrados na ficha e no histórico da missão.
                      </small>
                    </div>

                    <div className="mm-guest-input-row" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <div className="mm-guest-input-wrap" style={{ flex: '1 1 240px' }}>
                        <input
                          type="text"
                          className="mm-guest-input"
                          placeholder="Digite o nome do convidado ou freelancer (ex: Carlos Silva, Roberto Câmera...)"
                          value={guestInput}
                          onChange={(e) => setGuestInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddGuest();
                            }
                          }}
                        />
                      </div>
                      <select
                        className="mm-guest-role-select-inline"
                        value={guestRoleInput}
                        onChange={(e) => setGuestRoleInput(e.target.value)}
                        style={{
                          flex: '0 1 220px',
                          height: '38px',
                          padding: '0 10px',
                          borderRadius: '8px',
                          background: 'rgba(15, 23, 42, 0.75)',
                          border: '1.5px solid rgba(255, 255, 255, 0.12)',
                          color: guestRoleInput ? '#fbbf24' : '#94a3b8',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          outline: 'none',
                        }}
                      >
                        <option value="">+ Função (Opcional)...</option>
                        {OFFICIAL_COMPANY_ROLES.map((r) => (
                          <option key={r} value={r}>
                            + {ROLE_ICONS_MAP[r] || '💼'} {r}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn-add-guest"
                        onClick={handleAddGuest}
                        disabled={!guestInput.trim()}
                        title="Adicionar convidado à escala de campo"
                      >
                        <Plus size={15} />
                        <span>Adicionar Convidado</span>
                      </button>
                    </div>

                    {/* Lista de convidados adicionados */}
                    {(formData.guests || []).length > 0 ? (
                      <div className="mm-guests-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
                        {(formData.guests || []).map((guest, idx) => {
                          const guestName = typeof guest === 'string' ? guest : guest.name;
                          const guestRoles = Array.isArray(guest?.roles)
                            ? guest.roles
                            : (guest?.role ? [guest.role] : []);

                          return (
                            <div key={idx} className="mm-guest-chip" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px 12px', borderRadius: '10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', width: '100%' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span className="mgc-avatar">
                                    {guestName.slice(0, 2).toUpperCase()}
                                  </span>
                                  <div className="mgc-info">
                                    <strong className="mgc-name">{guestName}</strong>
                                    <span className="mgc-badge">Freelancer / Externo</span>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  className="btn-remove-guest"
                                  onClick={() => handleRemoveGuest(idx)}
                                  title={`Remover ${guestName}`}
                                >
                                  <X size={14} />
                                </button>
                              </div>

                              {/* Funções do Convidado / Freelancer */}
                              <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '6px', width: '100%' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                  <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>
                                    🎯 Função nesta Missão:
                                  </span>
                                  <span style={{ fontSize: '0.68rem', color: '#c084fc', fontWeight: 700 }}>
                                    {guestRoles.length} {guestRoles.length === 1 ? 'função' : 'funções'}
                                  </span>
                                </div>

                                {guestRoles.length > 0 && (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '6px' }}>
                                    {guestRoles.map((r) => {
                                      const color = ROLE_COLORS_MAP[r] || '#a855f7';
                                      const icon = ROLE_ICONS_MAP[r] || '💼';
                                      return (
                                        <span
                                          key={r}
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '2px 7px',
                                            borderRadius: '6px',
                                            fontSize: '0.72rem',
                                            fontWeight: 700,
                                            background: `${color}22`,
                                            border: `1px solid ${color}50`,
                                            color: color,
                                          }}
                                        >
                                          <span>{icon}</span>
                                          <span>{r}</span>
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveGuestRole(idx, r)}
                                            style={{
                                              background: 'transparent',
                                              border: 'none',
                                              color: 'inherit',
                                              cursor: 'pointer',
                                              padding: 0,
                                              marginLeft: '3px',
                                              display: 'flex',
                                              alignItems: 'center',
                                              opacity: 0.8,
                                            }}
                                            title={`Remover função ${r}`}
                                          >
                                            <X size={11} />
                                          </button>
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}

                                <select
                                  value=""
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      handleAddGuestRole(idx, e.target.value);
                                    }
                                  }}
                                  style={{
                                    width: '100%',
                                    height: '30px',
                                    padding: '0 8px',
                                    borderRadius: '6px',
                                    background: 'rgba(15, 23, 42, 0.75)',
                                    border: '1px dashed rgba(168, 85, 247, 0.4)',
                                    color: '#c084fc',
                                    fontSize: '0.73rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    outline: 'none',
                                  }}
                                >
                                  <option value="">
                                    {guestRoles.length === 0
                                      ? '+ Definir função (Cinegrafista, Drone, Fotógrafo...)'
                                      : '+ Acumular outra função (Fotógrafo, Totem, Drone, Áudio...)'}
                                  </option>
                                  {OFFICIAL_COMPANY_ROLES.filter((r) => !guestRoles.includes(r)).map((r) => (
                                    <option key={r} value={r}>
                                      + {ROLE_ICONS_MAP[r] || '💼'} {r}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="mm-guests-empty-hint">
                        Nenhum convidado ou freelancer adicionado. Digite o nome acima e pressione Enter ou clique em "Adicionar Convidado".
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ============================================================== */}
          {/* PASSO 6: BRIEFING, ROTEIRO & INSTRUÇÕES DE GRAVAÇÃO            */}
          {/* ============================================================== */}
          <div className="mm-card-panel">
            <div className="mm-card-header">
              <span className="mm-step-pill">6</span>
              <div>
                <h3 className="mm-card-title">Briefing, Roteiro &amp; Instruções de Gravação</h3>
                <p className="mm-card-subtitle">Diretrizes da pauta, roteiro, recomendações do cliente e observações gerais de campo</p>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <textarea
                rows="2"
                placeholder="Ex: Foco em depoimentos na primeira hora; atenção ao áudio de lapela no palestrante; traje esporte fino..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              ></textarea>
            </div>
          </div>

          {/* ============================================================== */}
          {/* PASSO 7: EQUIPAMENTOS & KITS DE PRODUÇÃO (POR PESSOA)          */}
          {/* ============================================================== */}
          <div className="mm-card-panel mm-equip-allocation-panel">
            <div className="mm-card-header">
              <span className="mm-step-pill">7</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <h3 className="mm-card-title">Equipamentos &amp; Kit de Produção (Por Pessoa Escalada)</h3>
                  <span className="mm-equip-count-chip">
                    <Package size={13} />{' '}
                    {(formData.equipmentAllocations || []).reduce((acc, g) => acc + (g.items || []).reduce((sum, it) => sum + (Number(it.quantity) || 1), 0), 0)} un. escaladas
                  </span>
                </div>
                <p className="mm-card-subtitle">
                  Especifique os equipamentos de campo que cada colaborador levará sob sua responsabilidade, além dos itens coletivos da van.
                </p>
              </div>
            </div>

            {/* Aviso se nenhum colaborador foi escalado no passo 5 */}
            {formData.teamIds.length === 0 && (
              <div className="mm-equip-empty-team-alert">
                <Users size={16} className="text-amber" />
                <div>
                  <strong>Nenhum profissional escalado na Equipe de Campo ainda.</strong>
                  <p>Retorne ao Passo 5 para selecionar cinegrafistas, fotógrafos ou operadores para vincular seus respectivos kits de equipamentos.</p>
                </div>
              </div>
            )}

            {/* Blocos Individuais de Equipamentos por Pessoa Escalada */}
            <div className="mm-equip-persons-container">
              {formData.teamIds.map((mId) => {
                const mem = members.find((x) => x.id === mId);
                const roleName = formData.memberRoles?.[mId] || mem?.role || 'Membro de Campo';
                const roleDisplay = Array.isArray(roleName) ? roleName.join(' • ') : roleName;
                const personGroup = (formData.equipmentAllocations || []).find((g) => g.collaboratorId === mId) || { items: [] };
                const itemsCount = (personGroup.items || []).reduce((sum, it) => sum + (Number(it.quantity) || 1), 0);
                const selectedEquipId = selectedEquipByPerson[mId] || '';
                const customNotesVal = personGroup.customNotes || formData.memberNotes?.[mId] || '';
                const hasCustomNotes = Boolean(customNotesVal && customNotesVal.trim());

                return (
                  <div key={mId} className="mm-equip-person-card">
                    <div className="mepc-header">
                      <div className="mepc-user-info">
                        <div className="mepc-avatar">
                          {mem?.name ? mem.name.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div>
                          <strong className="mepc-name">{mem?.name || 'Colaborador'}</strong>
                          <span className="mepc-role-badge">{roleDisplay}</span>
                        </div>
                      </div>

                      <span className={`mepc-items-badge ${itemsCount > 0 || hasCustomNotes ? 'has-items' : ''}`}>
                        {itemsCount === 0
                          ? (hasCustomNotes ? '📝 Com itens manuais' : 'Nenhum equipamento')
                          : `${itemsCount} ${itemsCount === 1 ? 'equipamento' : 'equipamentos'}${hasCustomNotes ? ' (+ manual)' : ''}`}
                      </span>
                    </div>

                    {/* Lista de Itens do Colaborador */}
                    {(!personGroup.items || personGroup.items.length === 0) ? (
                      <div className="mepc-empty-list">
                        <span>Nenhum equipamento associado a este colaborador. Selecione abaixo para montar o kit.</span>
                      </div>
                    ) : (
                      <div className="mepc-items-list">
                        {personGroup.items.map((it) => (
                          <div key={it.equipmentId} className="mepc-item-row">
                            <div className="mepc-item-left">
                              <span className="mepc-item-icon"><Camera size={14} /></span>
                              <div className="mepc-item-titles">
                                <strong>{it.name}</strong>
                                <span className="mepc-item-cat">
                                  {CATEGORY_LABELS[it.category] || it.category}
                                  {it.serialNumber ? ` • Nº: ${it.serialNumber}` : ''}
                                </span>
                              </div>
                            </div>

                            <div className="mepc-item-controls">
                              <div className="mepc-qty-selector">
                                <button
                                  type="button"
                                  className="mepc-qty-btn"
                                  onClick={() => handleUpdateEquipmentQuantity(mId, it.equipmentId, -1)}
                                  title="Diminuir quantidade"
                                >
                                  -
                                </button>
                                <span className="mepc-qty-display">{it.quantity || 1}</span>
                                <button
                                  type="button"
                                  className="mepc-qty-btn"
                                  onClick={() => handleUpdateEquipmentQuantity(mId, it.equipmentId, 1)}
                                  title="Aumentar quantidade"
                                >
                                  +
                                </button>
                              </div>

                              <input
                                type="text"
                                className="mepc-item-notes-input"
                                placeholder="Acessórios (ex: 2 baterias, na maleta preta)..."
                                value={it.notes || ''}
                                onChange={(e) => handleUpdateEquipmentNote(mId, it.equipmentId, e.target.value)}
                              />

                              <button
                                type="button"
                                className="mepc-remove-btn"
                                onClick={() => handleRemoveEquipmentFromPerson(mId, it.equipmentId)}
                                title="Remover item do kit deste colaborador"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Observações Manuais & Itens Fora da Lista do Acervo */}
                    <div className="mepc-custom-notes-block">
                      <div className="mepc-custom-notes-header">
                        <FileText size={13} className="text-amber" />
                        <span>Itens &amp; Observações Manuais deste Colaborador (fora da lista):</span>
                      </div>
                      <textarea
                        rows={2}
                        className="mepc-custom-notes-textarea"
                        placeholder='Ex: Levar monitor 24", computador / notebook, cabos de força, leitor de cartão SD...'
                        value={personGroup.customNotes || formData.memberNotes?.[mId] || ''}
                        onChange={(e) => handleUpdatePersonCustomNotes(mId, mem?.name || 'Colaborador', roleDisplay, e.target.value)}
                      />
                    </div>

                    {/* Seletor para Adicionar Equipamento ao Kit deste Colaborador */}
                    <div className="mepc-add-bar">
                      <select
                        className="mepc-select"
                        value={selectedEquipId}
                        onChange={(e) => setSelectedEquipByPerson((prev) => ({ ...prev, [mId]: e.target.value }))}
                      >
                        <option value="">Selecione um equipamento do acervo para adicionar ao kit...</option>
                        {['cameras', 'lenses', 'lighting', 'audio', 'video', 'accessories'].map((catKey) => {
                          const catEquips = equipmentList.filter((e) => e.category === catKey);
                          if (catEquips.length === 0) return null;
                          return (
                            <optgroup key={catKey} label={CATEGORY_LABELS[catKey] || catKey}>
                              {catEquips.map((eq) => {
                                const isOut = Number(eq.availableQty) <= 0;
                                return (
                                  <option key={eq.id} value={eq.id}>
                                    {eq.name} {isOut ? '(🔴 Alugado / Esgotado)' : `(Disp: ${eq.availableQty} un.)`}
                                  </option>
                                );
                              })}
                            </optgroup>
                          );
                        })}
                      </select>

                      <button
                        type="button"
                        className="btn-secondary mepc-add-btn"
                        disabled={!selectedEquipId}
                        onClick={() => handleAddEquipmentToPerson(mId, mem?.name || 'Colaborador', roleName, selectedEquipId)}
                      >
                        <Plus size={14} /> Adicionar ao Kit
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Blocos de Equipamentos para Convidados Externos / Freelancers */}
              {Array.isArray(formData.guests) && formData.guests.map((guest, gIdx) => {
                const guestName = typeof guest === 'string' ? guest : (guest.name || `Convidado ${gIdx + 1}`);
                const guestRoles = Array.isArray(guest?.roles) ? guest.roles : (guest?.role ? [guest.role] : []);
                const guestId = `guest-${gIdx}-${guestName.replace(/\s+/g, '-').toLowerCase()}`;
                const roleDisplay = guestRoles.length > 0 ? `${guestRoles.join(', ')} • Freelancer` : 'Convidado / Freelancer Externo';
                const personGroup = (formData.equipmentAllocations || []).find((g) => g.collaboratorId === guestId) || { items: [] };
                const itemsCount = (personGroup.items || []).reduce((sum, it) => sum + (Number(it.quantity) || 1), 0);
                const selectedEquipId = selectedEquipByPerson[guestId] || '';
                const customNotesVal = personGroup.customNotes || formData.memberNotes?.[guestId] || '';
                const hasCustomNotes = Boolean(customNotesVal && customNotesVal.trim());

                return (
                  <div key={guestId} className="mm-equip-person-card mepc-guest-card">
                    <div className="mepc-header">
                      <div className="mepc-user-info">
                        <div className="mepc-avatar guest-avatar" style={{ background: '#7c3aed', color: '#fff' }}>
                          <UserPlus size={16} />
                        </div>
                        <div>
                          <strong className="mepc-name">{guestName}</strong>
                          <span className="mepc-role-badge guest-badge" style={{ background: 'rgba(124, 58, 237, 0.15)', color: '#c4b5fd', borderColor: 'rgba(124, 58, 237, 0.3)' }}>{roleDisplay}</span>
                        </div>
                      </div>

                      <span className={`mepc-items-badge ${itemsCount > 0 || hasCustomNotes ? 'has-items' : ''}`}>
                        {itemsCount === 0
                          ? (hasCustomNotes ? '📝 Com itens manuais' : 'Nenhum equipamento')
                          : `${itemsCount} ${itemsCount === 1 ? 'equipamento' : 'equipamentos'}${hasCustomNotes ? ' (+ manual)' : ''}`}
                      </span>
                    </div>

                    {(!personGroup.items || personGroup.items.length === 0) ? (
                      <div className="mepc-empty-list">
                        <span>Nenhum equipamento do acervo associado a este convidado. Você pode selecionar do acervo ou registrar itens manuais abaixo.</span>
                      </div>
                    ) : (
                      <div className="mepc-items-list">
                        {personGroup.items.map((it) => (
                          <div key={it.equipmentId} className="mepc-item-row">
                            <div className="mepc-item-left">
                              <span className="mepc-item-icon"><Camera size={14} /></span>
                              <div className="mepc-item-titles">
                                <strong>{it.name}</strong>
                                <span className="mepc-item-cat">
                                  {CATEGORY_LABELS[it.category] || it.category}
                                  {it.serialNumber ? ` • Nº: ${it.serialNumber}` : ''}
                                </span>
                              </div>
                            </div>

                            <div className="mepc-item-controls">
                              <div className="mepc-qty-selector">
                                <button
                                  type="button"
                                  className="mepc-qty-btn"
                                  onClick={() => handleUpdateEquipmentQuantity(guestId, it.equipmentId, -1)}
                                  title="Diminuir quantidade"
                                >
                                  -
                                </button>
                                <span className="mepc-qty-display">{it.quantity || 1}</span>
                                <button
                                  type="button"
                                  className="mepc-qty-btn"
                                  onClick={() => handleUpdateEquipmentQuantity(guestId, it.equipmentId, 1)}
                                  title="Aumentar quantidade"
                                >
                                  +
                                </button>
                              </div>

                              <input
                                type="text"
                                className="mepc-item-notes-input"
                                placeholder="Acessórios (ex: 2 baterias)..."
                                value={it.notes || ''}
                                onChange={(e) => handleUpdateEquipmentNote(guestId, it.equipmentId, e.target.value)}
                              />

                              <button
                                type="button"
                                className="mepc-remove-btn"
                                onClick={() => handleRemoveEquipmentFromPerson(guestId, it.equipmentId)}
                                title="Remover item do kit deste convidado"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Observações Manuais & Itens Fora da Lista do Acervo */}
                    <div className="mepc-custom-notes-block">
                      <div className="mepc-custom-notes-header">
                        <FileText size={13} className="text-amber" />
                        <span>Itens &amp; Observações Manuais deste Convidado (fora da lista):</span>
                      </div>
                      <textarea
                        rows={2}
                        className="mepc-custom-notes-textarea"
                        placeholder='Ex: Trazer câmera própria, monitor 24", computador / notebook, tripé pesado...'
                        value={personGroup.customNotes || formData.memberNotes?.[guestId] || ''}
                        onChange={(e) => handleUpdatePersonCustomNotes(guestId, guestName, roleDisplay, e.target.value)}
                      />
                    </div>

                    <div className="mepc-add-bar">
                      <select
                        className="mepc-select"
                        value={selectedEquipId}
                        onChange={(e) => setSelectedEquipByPerson((prev) => ({ ...prev, [guestId]: e.target.value }))}
                      >
                        <option value="">Selecione um equipamento do acervo para adicionar ao kit...</option>
                        {['cameras', 'lenses', 'lighting', 'audio', 'video', 'accessories'].map((catKey) => {
                          const catEquips = equipmentList.filter((e) => e.category === catKey);
                          if (catEquips.length === 0) return null;
                          return (
                            <optgroup key={catKey} label={CATEGORY_LABELS[catKey] || catKey}>
                              {catEquips.map((eq) => {
                                const isOut = Number(eq.availableQty) <= 0;
                                return (
                                  <option key={eq.id} value={eq.id}>
                                    {eq.name} {isOut ? '(🔴 Alugado / Esgotado)' : `(Disp: ${eq.availableQty} un.)`}
                                  </option>
                                );
                              })}
                            </optgroup>
                          );
                        })}
                      </select>

                      <button
                        type="button"
                        className="btn-secondary mepc-add-btn"
                        disabled={!selectedEquipId}
                        onClick={() => handleAddEquipmentToPerson(guestId, guestName, roleDisplay, selectedEquipId)}
                      >
                        <Plus size={14} /> Adicionar ao Kit
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Bloco Coletivo: Equipamentos Gerais / Kit Compartilhado da Missão */}
              {(() => {
                const generalGroup = (formData.equipmentAllocations || []).find((g) => g.collaboratorId === 'general') || { items: [] };
                const generalCount = (generalGroup.items || []).reduce((sum, it) => sum + (Number(it.quantity) || 1), 0);
                const generalEquipId = selectedEquipByPerson['general'] || '';
                const genCustomNotes = generalGroup.customNotes || formData.memberNotes?.['general'] || '';
                const hasGenNotes = Boolean(genCustomNotes && genCustomNotes.trim());

                return (
                  <div className="mm-equip-person-card mepc-general-card">
                    <div className="mepc-header">
                      <div className="mepc-user-info">
                        <div className="mepc-avatar general-avatar">
                          <Package size={17} />
                        </div>
                        <div>
                          <strong className="mepc-name">Kit Geral &amp; Itens Coletivos da Missão</strong>
                          <span className="mepc-role-badge general-badge">Uso Compartilhado / Van</span>
                        </div>
                      </div>

                      <span className={`mepc-items-badge ${generalCount > 0 || hasGenNotes ? 'has-items' : ''}`}>
                        {generalCount === 0
                          ? (hasGenNotes ? '📝 Com itens manuais' : 'Nenhum equipamento')
                          : `${generalCount} ${generalCount === 1 ? 'equipamento' : 'equipamentos'}${hasGenNotes ? ' (+ manual)' : ''}`}
                      </span>
                    </div>

                    {(!generalGroup.items || generalGroup.items.length === 0) ? (
                      <div className="mepc-empty-list">
                        <span>Nenhum equipamento coletivo alocado (ex: tripés de luz, cabos HDMI 50m, gerador, tenda, rebatedores).</span>
                      </div>
                    ) : (
                      <div className="mepc-items-list">
                        {generalGroup.items.map((it) => (
                          <div key={it.equipmentId} className="mepc-item-row">
                            <div className="mepc-item-left">
                              <span className="mepc-item-icon"><Package size={14} /></span>
                              <div className="mepc-item-titles">
                                <strong>{it.name}</strong>
                                <span className="mepc-item-cat">
                                  {CATEGORY_LABELS[it.category] || it.category}
                                  {it.serialNumber ? ` • Nº: ${it.serialNumber}` : ''}
                                </span>
                              </div>
                            </div>

                            <div className="mepc-item-controls">
                              <div className="mepc-qty-selector">
                                <button
                                  type="button"
                                  className="mepc-qty-btn"
                                  onClick={() => handleUpdateEquipmentQuantity('general', it.equipmentId, -1)}
                                  title="Diminuir quantidade"
                                >
                                  -
                                </button>
                                <span className="mepc-qty-display">{it.quantity || 1}</span>
                                <button
                                  type="button"
                                  className="mepc-qty-btn"
                                  onClick={() => handleUpdateEquipmentQuantity('general', it.equipmentId, 1)}
                                  title="Aumentar quantidade"
                                >
                                  +
                                </button>
                              </div>

                              <input
                                type="text"
                                className="mepc-item-notes-input"
                                placeholder="Notas (ex: no porta-malas, kit reserva)..."
                                value={it.notes || ''}
                                onChange={(e) => handleUpdateEquipmentNote('general', it.equipmentId, e.target.value)}
                              />

                              <button
                                type="button"
                                className="mepc-remove-btn"
                                onClick={() => handleRemoveEquipmentFromPerson('general', it.equipmentId)}
                                title="Remover item coletivo"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Observações Manuais & Itens Coletivos da Missão */}
                    <div className="mepc-custom-notes-block">
                      <div className="mepc-custom-notes-header">
                        <Package size={13} className="text-amber" />
                        <span>Itens &amp; Observações Coletivas da Missão (fora da lista):</span>
                      </div>
                      <textarea
                        rows={2}
                        className="mepc-custom-notes-textarea"
                        placeholder="Ex: Levar mesa dobrável da van, tenda pantográfica, filtro de linha 20A, fita gaffer..."
                        value={generalGroup.customNotes || formData.memberNotes?.['general'] || ''}
                        onChange={(e) => handleUpdatePersonCustomNotes('general', 'Kit Geral & Itens Coletivos', 'Uso Compartilhado / Van', e.target.value)}
                      />
                    </div>

                    <div className="mepc-add-bar">
                      <select
                        className="mepc-select"
                        value={generalEquipId}
                        onChange={(e) => setSelectedEquipByPerson((prev) => ({ ...prev, general: e.target.value }))}
                      >
                        <option value="">Selecione um equipamento para o kit coletivo da missão...</option>
                        {['accessories', 'lighting', 'audio', 'video', 'cameras', 'lenses'].map((catKey) => {
                          const catEquips = equipmentList.filter((e) => e.category === catKey);
                          if (catEquips.length === 0) return null;
                          return (
                            <optgroup key={catKey} label={CATEGORY_LABELS[catKey] || catKey}>
                              {catEquips.map((eq) => {
                                const isOut = Number(eq.availableQty) <= 0;
                                return (
                                  <option key={eq.id} value={eq.id}>
                                    {eq.name} {isOut ? '(🔴 Alugado / Esgotado)' : `(Disp: ${eq.availableQty} un.)`}
                                  </option>
                                );
                              })}
                            </optgroup>
                          );
                        })}
                      </select>

                      <button
                        type="button"
                        className="btn-secondary mepc-add-btn"
                        disabled={!generalEquipId}
                        onClick={() => handleAddEquipmentToPerson('general', 'Kit Coletivo da Missão', 'Geral', generalEquipId)}
                      >
                        <Plus size={14} /> Adicionar Coletivo
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Rodapé com Ações */}
          <div className="modal-footer mm-modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              <Check size={16} />
              <span>{editingMission ? 'Salvar Alterações' : 'Confirmar e Publicar na Tabela'}</span>
            </button>
          </div>
        </form>

        {/* Modal Interativo para Buscar no Mapa, Inserir Marcador e Fixar Coordenadas */}
        <MissionMapPickerModal
          isOpen={isMapPickerOpen}
          onClose={() => setIsMapPickerOpen(false)}
          initialLat={formData.lat}
          initialLon={formData.lon}
          initialAddress={formData.address}
          initialLocationName={formData.locationName}
          baseLocation={baseLocation}
          onConfirmCoordinates={handleConfirmMapPicker}
        />
      </div>
    </div>
  );
}
