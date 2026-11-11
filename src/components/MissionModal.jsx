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
} from 'lucide-react';
import {
  RECURRENCE_DAYS,
  getDayOfWeekFromDate,
  addWeeksToDate,
  formatOccurrencePreview,
  generateRecurrenceDates,
  formatDaysDisplay,
} from '../utils/recurrence';
import {
  fetchRouteOSRM,
  searchAddressNominatim,
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
} from '../utils/geo';
import { alertDialog, confirmDialog } from '../utils/dialog';

// Calcula a quantidade de dias entre a data de início e a data final (intervalo operacional)
export function calculateDaysBetween(startDateStr, endDateStr) {
  if (!startDateStr || !endDateStr) return 1;
  try {
    const [y1, m1, d1] = String(startDateStr).split('-').map(Number);
    const [y2, m2, d2] = String(endDateStr).split('-').map(Number);
    if (!y1 || !y2) return 1;
    const utc1 = Date.UTC(y1, m1 - 1, d1);
    const utc2 = Date.UTC(y2, m2 - 1, d2);
    const diff = Math.round((utc2 - utc1) / (1000 * 60 * 60 * 24));
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
  let targetEnd = parseTime(targetEndDate, formData.returnTimeEstimated || formData.arrivalTimeEstimated);
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

    let mEnd = parseTime(mEndDate, m.returnTimeEstimated || m.arrivalTimeEstimated);
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
}) {
  const fuelSettings = settings || (typeof fuelPricePerLiter === 'object' ? fuelPricePerLiter : { gasolinePricePerLiter: fuelPricePerLiter || 6.45, dieselPricePerLiter: 6.89 });
  const [formData, setFormData] = useState({
    description: '',
    locationName: '',
    address: '',
    lat: '',
    lon: '',
    date: getLocalTodayStr(),
    eventStartTime: '',
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
    isMultiDay: false,
    endDate: '',
  });

  const [searchResults, setSearchResults] = useState([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [guestInput, setGuestInput] = useState('');
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
      setFormData({
        ...editingMission,
        eventStartTime: editingMission.eventStartTime || '',
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
        isMultiDay: Boolean(editingMission.isMultiDay || (editingMission.endDate && editingMission.endDate !== editingMission.date)),
        endDate: editingMission.endDate || '',
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
      // Encontra primeiro membro habilitado para ser o motorista preferencial
      const preferredDriver = members.find((m) => Boolean(m.canDrive ?? m.hasCnh))?.id || members[0]?.id || '';
      const defaultTeam = preferredDriver
        ? [preferredDriver, ...members.filter((m) => m.id !== preferredDriver).slice(0, 1).map((m) => m.id)]
        : members.slice(0, 2).map((m) => m.id);

      // Sugere os editores da equipe por padrão se houver algum com papel de 'Editor' ou 'Designer'
      const defaultEditors = members
        .filter((m) => {
          const r = (m.role || '').toLowerCase();
          return r.includes('editor') || r.includes('edição') || r.includes('designer');
        })
        .slice(0, 1)
        .map((m) => m.id);

      setFormData({
        description: '',
        locationName: '',
        address: '',
        lat: initialCoords ? initialCoords.lat : '',
        lon: initialCoords ? initialCoords.lon : '',
        date: getLocalTodayStr(),
        eventStartTime: '',
        antecedenceMinutes: 30,
        suggestedDepartureTime: '',
        departureTime: '',
        arrivalTimeEstimated: '',
        returnTimeEstimated: '',
        vehicleAllocations: [{ vehicleId: defaultVehicle, driverId: preferredDriver }],
        teamIds: defaultTeam,
        guests: [],
        editionStatus: 'Pendente',
        editorIds: defaultEditors,
        editorNamesDisplay: '',
        deliveryDeadlineDate: getLocalTodayStr(),
        deliveryDeadlineTime: '18:00',
        editionDeliveryStatus: '',
        isOverdue: 0,
        reopenReason: '',
        missionStatus: 'Agendada',
        isRoundTrip: true,
        notes: '',
        isMultiDay: false,
        endDate: '',
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

  // Busca de endereço Nominatim
  const handleAddressSearch = async () => {
    const query = formData.address || formData.locationName;
    if (!query) return;
    setIsSearchingAddress(true);
    const results = await searchAddressNominatim(query);
    setSearchResults(results);
    setIsSearchingAddress(false);
  };

  const handleSelectSearchResult = (res) => {
    setFormData((prev) => ({
      ...prev,
      address: res.name,
      locationName: prev.locationName || res.shortName,
      lat: res.lat,
      lon: res.lon,
    }));
    setSearchResults([]);
    updateRouteCalculations(res.lat, res.lon, formData.vehicleAllocations);
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

  // ---- Gerenciamento de Convidados Externos / Freelancers ----
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
      return;
    }
    setFormData((prev) => ({
      ...prev,
      guests: [...(Array.isArray(prev.guests) ? prev.guests : []), trimmed],
    }));
    setGuestInput('');
  };

  const handleRemoveGuest = (indexToRemove) => {
    setFormData((prev) => ({
      ...prev,
      guests: (Array.isArray(prev.guests) ? prev.guests : []).filter((_, idx) => idx !== indexToRemove),
    }));
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

  const handleChangeAllocationVehicle = (index, newVehicleId) => {
    setFormData((prev) => {
      const copy = [...prev.vehicleAllocations];
      copy[index] = { ...copy[index], vehicleId: newVehicleId };
      return { ...prev, vehicleAllocations: copy };
    });
  };

  const handleChangeAllocationDriver = (index, newDriverId) => {
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
  const toggleTeamMember = (memberId) => {
    setFormData((prev) => {
      const exists = prev.teamIds.includes(memberId);
      const newTeam = exists
        ? prev.teamIds.filter((id) => id !== memberId)
        : [...prev.teamIds, memberId];

      // Se removeu da equipe alguém que estava como motorista, limpa ou passa para outro
      const updatedAllocs = prev.vehicleAllocations.map((alloc) => {
        if (exists && alloc.driverId === memberId) {
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
  const handleToggleMemberAsDriver = (memberId) => {
    setFormData((prev) => {
      const existingIndex = prev.vehicleAllocations.findIndex((a) => a.driverId === memberId);
      const copy = [...prev.vehicleAllocations];

      if (existingIndex >= 0) {
        copy[existingIndex] = { ...copy[existingIndex], driverId: '' };
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

    const allConflictMsgs = [...conflictingVehicles, ...conflictingDrivers, ...conflictingTeam];
    if (allConflictMsgs.length > 0) {
      await alertDialog({
        title: 'Conflito de Escala Detectado',
        message: `Não é possível salvar a missão devido a conflitos de horário com outra escala ativa:\n\n${allConflictMsgs.join('\n')}\n\nPor favor, escolha veículos e colaboradores disponíveis ou altere o horário da missão.`,
        variant: 'danger',
      });
      return;
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

    const isNotApp = formData.editionStatus === 'Não se aplica';
    const finalEditorIds = isNotApp ? [] : (formData.editorIds || []);
    const assignedEditors = members.filter((m) => finalEditorIds.includes(m.id));
    const editorNamesDisplay = isNotApp ? '' : (assignedEditors.map((m) => m.name).join(', ') || (formData.editorName || ''));
    const primaryEditor = assignedEditors[0] || null;
    const primaryEditorId = isNotApp ? '' : (primaryEditor ? primaryEditor.id : (formData.editorId || ''));
    const primaryEditorName = isNotApp ? '' : (primaryEditor ? primaryEditor.name : (formData.editorName || ''));

    // Inicializa ou atualiza o histórico da missão
    const currentHistory = Array.isArray(editingMission?.editionHistory) ? [...editingMission.editionHistory] : [];
    if (!editingMission) {
      currentHistory.push({
        id: 'h-' + Date.now(),
        type: 'CREATED',
        user: 'Administrador / Gestor',
        timestamp: new Date().toISOString(),
        title: 'Missão Criada e Publicada',
        description: `Missão "${formData.description}" cadastrada com prazo de edição para ${formatDateBR(formData.deliveryDeadlineDate || formData.date)} às ${formData.deliveryDeadlineTime || '18:00'}.`,
        deadline: `${formatDateBR(formData.deliveryDeadlineDate || formData.date)} às ${formData.deliveryDeadlineTime || '18:00'}`,
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
    const guestsStr = guestsList.map((g) => typeof g === 'string' ? g : g.name).join(', ');
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

    const computedStatus = computeMissionAutoStatus(formData, new Date(), true);
    const generatedCode = generateNextMissionCode(formData.date, missions, editingMission);

    const missionPayload = {
      id: editingMission ? editingMission.id : 'mis-' + Date.now(),
      version: editingMission?.version ?? 1,
      ...formData,
      code: generatedCode,
      eventStartTime: formData.eventStartTime || null,
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
      deliveryDeadlineDate: formData.deliveryDeadlineDate || formData.date,
      deliveryDeadlineTime: formData.deliveryDeadlineTime || '18:00',
      editionHistory: currentHistory,
      editionDeliveryStatus: formData.editionDeliveryStatus || editingMission?.editionDeliveryStatus || '',
      isOverdue: formData.isOverdue ?? editingMission?.isOverdue ?? 0,
      reopenReason: formData.reopenReason ?? editingMission?.reopenReason ?? '',
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
    };

    const res = await onSaveMission(missionPayload);
    if (res && !res.success) {
      if (res.hasConflict) {
        const proceed = await confirmDialog({
          title: '⚠️ Conflito de Escala Detectado',
          message: res.conflictMessage,
          description: 'Deseja salvar a missão mesmo com essa sobreposição de horários nesta data?',
          confirmText: 'Salvar Mesmo Assim',
          cancelText: 'Revisar Escala',
          variant: 'warning',
        });
        if (proceed) {
          const resForce = await onSaveMission({
            ...missionPayload,
            ignoreConflicts: true,
            overrideReason: 'Conflito de escala analisado e aprovado pelo gestor'
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
    <div className="modal-overlay">
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

            <div className="form-row mm-four-cols">
              <div className="form-group flex-1">
                <label><Calendar size={13} /> {isMultiDay ? 'Data de Início da Missão' : 'Data da Missão'} <span className="req-star">*</span></label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
              <div className="form-group flex-1">
                <label><Clock size={13} /> Início do Evento / No Local</label>
                <input
                  type="time"
                  placeholder="Ex: 18:00"
                  value={formData.eventStartTime || ''}
                  onChange={(e) => handleEventStartTimeChange(e.target.value)}
                  title="Horário em que o evento começa ou que a equipe já deve estar posicionada no local"
                />
                <small className="field-hint-sub">Horário do evento/gravação</small>
              </div>
              <div className="form-group flex-1">
                <label><Clock size={13} /> Saída da Base <span className="req-star">*</span></label>
                <input
                  type="time"
                  required
                  value={formData.departureTime || ''}
                  onChange={(e) => setFormData({ ...formData, departureTime: e.target.value })}
                />
                <small className="field-hint-sub">Partida da viatura</small>
              </div>
              {!isMultiDay && (
                <div className="form-group flex-1">
                  <label><Clock size={13} /> Previsão de Retorno</label>
                  <input
                    type="time"
                    value={formData.returnTimeEstimated || ''}
                    onChange={(e) => setFormData({ ...formData, returnTimeEstimated: e.target.value })}
                  />
                  <small className="field-hint-sub">Término na base</small>
                </div>
              )}
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
                    placeholder="Rua, Número, Bairro, Cidade..."
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddressSearch(); } }}
                  />
                  <button
                    type="button"
                    className="btn-search-coords"
                    onClick={handleAddressSearch}
                    disabled={isSearchingAddress}
                    title="Buscar Coordenadas por Endereço"
                  >
                    <Search size={14} />
                    <span>{isSearchingAddress ? 'Buscando...' : 'Buscar GPS'}</span>
                  </button>
                </div>
              </div>
            </div>

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
                    setFormData({ ...formData, lat: val });
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
                    setFormData({ ...formData, lon: val });
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
                            <div className="mm-conflict-banner mm-conflict-vehicle">
                              <div className="mcb-icon">
                                <AlertTriangle size={15} />
                              </div>
                              <div className="mcb-content">
                                <strong className="mcb-title">Viatura em Uso no Mesmo Horário!</strong>
                                <p className="mcb-desc">
                                  A viatura selecionada já está escalada na missão <strong>{vConflict.code} {vConflict.description}</strong> no horário de <strong>{vConflict.timeRange}</strong>.
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
                            <div className="mm-conflict-banner mm-conflict-driver">
                              <div className="mcb-icon">
                                <AlertTriangle size={15} />
                              </div>
                              <div className="mcb-content">
                                <strong className="mcb-title">Condutor Escalado em Outra Missão!</strong>
                                <p className="mcb-desc">
                                  O colaborador selecionado já está escalado na missão <strong>{dConflict.code} {dConflict.description}</strong> ({dConflict.timeRange}).
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
            const isEditionNotApplicable = formData.editionStatus === 'Não se aplica';
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
                          setFormData((prev) => ({
                            ...prev,
                            editionStatus: val,
                            ...(val === 'Não se aplica' ? { editorIds: [] } : {}),
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
                        value={formData.deliveryDeadlineDate || formData.date}
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
                        value={formData.deliveryDeadlineTime || '18:00'}
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

                        return (
                          <div
                            key={m.id}
                            className={`mm-member-card ${isSelected ? 'selected' : ''} ${
                              isDriver ? 'is-driver' : ''
                            } ${memConflict ? 'has-conflict' : ''}`}
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
                              </div>
                            </div>

                            {/* RODAPÉ DO CARD COM AÇÃO DE MOTORISTA E CONFLITO */}
                            <div className="mm-member-card-footer" onClick={(e) => e.stopPropagation()}>
                              {memConflict ? (
                                <span
                                  className="mm-conflict-pill"
                                  title={`Ocupado na missão ${memConflict.code}: ${memConflict.timeRange}`}
                                >
                                  <AlertTriangle size={11} />
                                  <span>Ocupado ({memConflict.timeRange})</span>
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

                <div className="mm-guest-input-row">
                  <div className="mm-guest-input-wrap">
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
                  <div className="mm-guests-list">
                    {(formData.guests || []).map((guest, idx) => {
                      const guestName = typeof guest === 'string' ? guest : guest.name;
                      return (
                        <div key={idx} className="mm-guest-chip">
                          <span className="mgc-avatar">
                            {guestName.slice(0, 2).toUpperCase()}
                          </span>
                          <div className="mgc-info">
                            <strong className="mgc-name">{guestName}</strong>
                            <span className="mgc-badge">Freelancer / Externo</span>
                          </div>
                          <button
                            type="button"
                            className="btn-remove-guest"
                            onClick={() => handleRemoveGuest(idx)}
                            title={`Remover ${guestName}`}
                          >
                            <X size={13} />
                          </button>
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
          {/* PASSO 6: BRIEFING & OBSERVAÇÕES                                */}
          {/* ============================================================== */}
          <div className="mm-card-panel">
            <div className="mm-card-header">
              <span className="mm-step-pill">6</span>
              <div>
                <h3 className="mm-card-title">Briefing &amp; Observações</h3>
                <p className="mm-card-subtitle">Instruções aos cinegrafistas, equipamentos a levar ou avisos gerais</p>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <textarea
                rows="2"
                placeholder="Ex: Levar lentes 50mm e 24-70mm, kit de baterias extras, autorização de entrada..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              ></textarea>
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
      </div>
    </div>
  );
}
