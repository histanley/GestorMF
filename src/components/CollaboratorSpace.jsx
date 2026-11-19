import React, { useState, useEffect, useMemo } from 'react';
import {
  Trophy,
  Award,
  Clock,
  Compass,
  DollarSign,
  Calendar,
  Briefcase,
  Copy,
  Check,
  Plus,
  Send,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Sparkles,
  MapPin,
  Car,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Shield,
  CreditCard,
  MessageCircle,
  Edit2,
  Trash2,
  X,
  Lock,
  AlertTriangle,
  Zap,
  CalendarOff,
  Ban,
  HelpCircle,
  Film,
  Star,
  TrendingUp,
  Target,
  ShieldCheck,
  Printer,
  Receipt,
  Wallet,
  FileText,
  ExternalLink,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import ConcludePostProductionModal from './ConcludePostProductionModal';
import {
  resolveMissionEditors,
  getMissionEditionDeliverySummary,
  getMissionEditorsDeliveryMap,
  formatDeliveryDateTimeBR,
} from '../utils/postProduction';
import {
  OFFICIAL_COMPANY_ROLES,
  ROLE_ICONS_MAP,
  ROLE_COLORS_MAP,
  ROLE_XP_POINTS,
  ACTIVITY_XP_POINTS,
  normalizeToOfficialRole,
  computeMemberRoleCounts,
  calculateMemberPerformanceProfile,
  CAREER_TIERS,
  getCareerProgression,
} from '../utils/companyRoles';
import { apiRequestExtraHours, apiExtendMissionReturnTime, apiUpdatePixKey, apiGetSalaryAdvances } from '../utils/api';
import { alertDialog, confirmDialog } from '../utils/dialog';
import {
  calculateMissionOffHours,
  calculateEventOnlyOffHours,
  isMissionEligibleForPayout,
  isMemberEligibleForExtraHours,
  calculateExtraHoursRemuneration,
  evaluateMissionExtension,
  isOffHoursTime
} from '../utils/workHours';
import { sortMissionsByStatusPriority, getMissionLiveProgress, getMissionCode } from '../utils/geo';
import { sendPushNotification, requestNotificationPermission } from '../utils/notifications';

// Formata data ISO para PT-BR
function formatDateBR(dateStr) {
  if (!dateStr) return '';
  const parts = String(dateStr).split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

// Formata moeda BRL
function formatBRL(val) {
  const n = Number(val) || 0;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function CollaboratorSpace({
  currentUser = null,
  members = [],
  missions = [],
  closures = {},
  onReloadMissions = null,
  onUpdatePixKey = null,
  onUpdateMember = null,
  onUpdateAvailability = null,
  onSaveMission = null,
}) {
  const [concludeModal, setConcludeModal] = useState({ isOpen: false, mission: null });
  // Identifica o colaborador correspondente ao usuário logado
  const myMember = useMemo(() => {
    if (!currentUser) return members[0] || null;
    const curId = String(currentUser.id || '');
    const curName = String(currentUser.name || '').trim().toLowerCase();

    return (
      members.find((m) => String(m.id) === curId || String(m.userId) === curId) ||
      members.find((m) => m.name && m.name.trim().toLowerCase() === curName) ||
      members[0] ||
      null
    );
  }, [currentUser, members]);

  // Estado de cópia de PIX
  const [copiedPix, setCopiedPix] = useState(false);

  // Estados de Cadastro / Edição / Exclusão de Chave PIX
  const [isEditingPix, setIsEditingPix] = useState(false);
  const [pixInput, setPixInput] = useState('');
  const [isSavingPix, setIsSavingPix] = useState(false);

  // ============================================================================
  // DISPONIBILIDADE DO COLABORADOR PARA HORAS EXTRAS FORA DO EXPEDIENTE
  // ============================================================================
  const [localAvail, setLocalAvail] = useState(() => myMember?.extraHoursAvailability || { status: 'available' });

  useEffect(() => {
    if (myMember?.extraHoursAvailability) {
      setLocalAvail(myMember.extraHoursAvailability);
    }
  }, [myMember?.extraHoursAvailability]);

  const curAvail = localAvail?.status ? localAvail : (myMember?.extraHoursAvailability || { status: 'available' });
  const isUnavailableNow = curAvail.status === 'unavailable';

  const [isEditingAvail, setIsEditingAvail] = useState(false);
  const [availScope, setAvailScope] = useState(curAvail.scope || 'always_offhours');
  const [availStartDate, setAvailStartDate] = useState(curAvail.startDate || new Date().toISOString().slice(0, 10));
  const [availStartTime, setAvailStartTime] = useState(curAvail.startTime || '18:00');
  const [availEndDate, setAvailEndDate] = useState(curAvail.endDate || new Date().toISOString().slice(0, 10));
  const [availEndTime, setAvailEndTime] = useState(curAvail.endTime || '23:59');
  const [availPresetReason, setAvailPresetReason] = useState(curAvail.presetReason || 'Faculdade / Estudos');
  const [availCustomReason, setAvailCustomReason] = useState(curAvail.reason || '');
  const [isSavingAvail, setIsSavingAvail] = useState(false);

  // Presets criativos e rápidos de justificativa
  const PRESET_REASONS = [
    { id: 'faculdade', icon: '🎓', label: 'Faculdade / Estudos', defaultText: 'Aulas ou provas presenciais no período noturno' },
    { id: 'familia', icon: '👨‍👩‍👧', label: 'Compromisso Familiar', defaultText: 'Compromisso familiar particular inadiável' },
    { id: 'saude', icon: '🩺', label: 'Consulta / Saúde', defaultText: 'Consulta médica ou tratamento de saúde programado' },
    { id: 'transporte', icon: '🚗', label: 'Sem Transporte Noturno', defaultText: 'Sem condução / transporte público disponível fora do expediente' },
    { id: 'descanso', icon: '🏃', label: 'Descanso / Limite Físico', defaultText: 'Descanso e recuperação física' },
    { id: 'outro', icon: '✏️', label: 'Outro Motivo', defaultText: '' },
  ];

  const handleStartEditAvailability = () => {
    setAvailScope(curAvail.scope || 'always_offhours');
    setAvailStartDate(curAvail.startDate || new Date().toISOString().slice(0, 10));
    setAvailStartTime(curAvail.startTime || '18:00');
    setAvailEndDate(curAvail.endDate || new Date().toISOString().slice(0, 10));
    setAvailEndTime(curAvail.endTime || '23:59');
    setAvailPresetReason(curAvail.presetReason || 'Faculdade / Estudos');
    setAvailCustomReason(curAvail.reason || '');
    setIsEditingAvail(true);
  };

  const handleMakeAvailable = async () => {
    setIsSavingAvail(true);
    const newAvail = {
      status: 'available',
      scope: 'always_offhours',
      updatedAt: new Date().toISOString(),
    };
    setLocalAvail(newAvail);

    try {
      if (onUpdateAvailability && myMember?.id) {
        await onUpdateAvailability(myMember.id, newAvail);
      } else if (onUpdateMember) {
        await onUpdateMember({
          ...myMember,
          extraHoursAvailability: newAvail,
        });
      }
      setIsEditingAvail(false);
      await alertDialog({
        title: '✅ Disponibilidade Atualizada',
        message: 'Você voltou a ficar disponível para horas extras! Os administradores poderão contar com você para escalas fora do expediente regular.',
        variant: 'success',
      });
    } catch (e) {
      await alertDialog({
        title: 'Erro ao Atualizar',
        message: 'Não foi possível atualizar sua disponibilidade no momento.',
        variant: 'danger',
      });
    } finally {
      setIsSavingAvail(false);
    }
  };

  const handleSaveUnavailable = async () => {
    const finalReason = availCustomReason.trim() || availPresetReason;
    if (!finalReason) {
      await alertDialog({
        title: 'Motivo Obrigatório',
        message: 'Por favor, informe uma justificativa ou selecione um dos motivos rápidos para que a gestão compreenda sua indisponibilidade.',
        variant: 'warning',
      });
      return;
    }

    setIsSavingAvail(true);
    const newAvail = {
      status: 'unavailable',
      scope: availScope,
      startDate: availStartDate,
      startTime: availStartTime,
      endDate: availEndDate,
      endTime: availEndTime,
      presetReason: availPresetReason,
      reason: finalReason,
      updatedAt: new Date().toISOString(),
    };
    setLocalAvail(newAvail);
    setIsEditingAvail(false);

    try {
      if (onUpdateAvailability && myMember?.id) {
        await onUpdateAvailability(myMember.id, newAvail);
      } else if (onUpdateMember) {
        await onUpdateMember({
          ...myMember,
          extraHoursAvailability: newAvail,
        });
      }
      await alertDialog({
        title: '🚫 Indisponibilidade Registrada',
        message: 'Sua indisponibilidade para horas extras foi registrada com sucesso! Os administradores serão alertados na lista de colaboradores ao planejar missões fora do expediente.',
        variant: 'info',
      });
    } catch (e) {
      await alertDialog({
        title: 'Erro ao Salvar',
        message: 'Não foi possível salvar sua indisponibilidade no momento.',
        variant: 'danger',
      });
    } finally {
      setIsSavingAvail(false);
    }
  };

  // Modal / Form de Solicitação de Horas Extras Adicionais
  const [requestModalMission, setRequestModalMission] = useState(null);
  const [requestedHours, setRequestedHours] = useState(1.0);
  const [requestReason, setRequestReason] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  // Monitor em tempo real: atualiza a cada 20s para verificar reta final das missões
  const [liveTick, setLiveTick] = useState(0);

  useEffect(() => {
    // Solicita permissão de notificações em segundo plano
    requestNotificationPermission().catch(() => { });

    const interval = setInterval(() => {
      setLiveTick((t) => t + 1);
    }, 20000);
    return () => clearInterval(interval);
  }, []);

  // Filtro de mês atual (YYYY-MM)
  const currentMonthKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const monthLabel = useMemo(() => {
    try {
      const [year, month] = currentMonthKey.split('-');
      const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
      return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    } catch (e) {
      return currentMonthKey;
    }
  }, [currentMonthKey]);

  // Vales e Adiantamentos Salariais do Colaborador (FIN-05)
  const [myAdvances, setMyAdvances] = useState([]);
  const [isLoadingAdvances, setIsLoadingAdvances] = useState(false);
  const [showAdvancesHistoryModal, setShowAdvancesHistoryModal] = useState(false);

  // Extrato Financeiro Transparente do Mês (Semelhante a Ver Extrato de XP)
  const [isFinancialModalOpen, setIsFinancialModalOpen] = useState(false);
  const [financialTabFilter, setFinancialTabFilter] = useState('all'); // 'all' | 'credits' | 'debits'
  const [viewingReceipt, setViewingReceipt] = useState(null);
  const previewReceiptUrl = typeof viewingReceipt === 'string' ? viewingReceipt : viewingReceipt?.receiptUrl || viewingReceipt;
  const setPreviewReceiptUrl = setViewingReceipt;

  useEffect(() => {
    if (!myMember?.id) return;
    setIsLoadingAdvances(true);
    apiGetSalaryAdvances(currentMonthKey, myMember.id)
      .then((res) => {
        if (res && res.success && Array.isArray(res.advances)) {
          setMyAdvances(res.advances);
        }
      })
      .catch((err) => console.warn('Erro ao carregar vales do colaborador:', err))
      .finally(() => setIsLoadingAdvances(false));
  }, [currentMonthKey, myMember?.id]);

  // Missões do colaborador
  const myMissions = useMemo(() => {
    if (!myMember) return [];
    const memIdStr = String(myMember.id);
    const memNameNorm = myMember.name.trim().toLowerCase();

    return missions.filter((m) => {
      const allocations = Array.isArray(m.vehicleAllocations) ? m.vehicleAllocations : [];
      const isDriver = allocations.some(
        (a) => (a.driverId && String(a.driverId) === memIdStr) ||
          (a.driverName && a.driverName.trim().toLowerCase() === memNameNorm)
      ) || (m.driverId && String(m.driverId) === memIdStr) ||
        (m.driverName && m.driverName.trim().toLowerCase() === memNameNorm);

      const teamIds = Array.isArray(m.teamIds) ? m.teamIds.map(String) : [];
      const inTeamIds = teamIds.includes(memIdStr);
      const inTeamMembers = Array.isArray(m.teamMembers) &&
        m.teamMembers.some((tm) => String(tm.id) === memIdStr || tm.name?.trim().toLowerCase() === memNameNorm);
      const inTeamField = Array.isArray(m.team) &&
        m.team.some((t) => String(t) === memIdStr || String(t).trim().toLowerCase() === memNameNorm);

      const editorIds = Array.isArray(m.editorIds) ? m.editorIds.map(String) : [];
      const inEditor = editorIds.includes(memIdStr) || (m.editorNamesDisplay && m.editorNamesDisplay.toLowerCase().includes(memNameNorm));

      return isDriver || inTeamIds || inTeamMembers || inTeamField || inEditor;
    });
  }, [myMember, missions]);

  // Identifica se há alguma missão ativa na reta final crítica (restam <= 30 min)
  // Regra Oficial MegaFilmes: Notificação de reta final e horas extras é exclusiva para quem está em campo (não aplicável a editores na pós)
  const urgentMissionNow = useMemo(() => {
    return myMissions.find((m) => {
      if (!isMemberEligibleForExtraHours(myMember, m)) return false;
      const prog = getMissionLiveProgress(m);
      return prog.isUrgentEnd;
    }) || null;
  }, [myMissions, liveTick, myMember]);

  // Disparo inteligente de Notificação Push e Alerta Sonoro para o colaborador quando em reta final
  useEffect(() => {
    if (!urgentMissionNow) return;

    const notifKey = `notified_urgent_${urgentMissionNow.id}_${urgentMissionNow.extraHoursApproved || 0}`;
    const alreadyNotified = sessionStorage.getItem(notifKey);

    if (!alreadyNotified) {
      sessionStorage.setItem(notifKey, 'true');
      const prog = getMissionLiveProgress(urgentMissionNow);
      const remText = prog.remainingMinutes > 0
        ? `Restam apenas ${prog.remainingMinutes} minutos para o término previsto.`
        : 'Horário limite atingido!';

      sendPushNotification(`🚨 Atenção: Reta Final de Serviço!`, {
        body: `${urgentMissionNow.description}: ${remText} Solicite mais horas extras se precisar estender a gravação.`,
        tag: `urgent-mission-${urgentMissionNow.id}`,
      });
    }
  }, [urgentMissionNow]);

  // Contagem fiel de cada uma das 11 funções oficiais
  const roleCounts = useMemo(() => {
    if (!myMember) return {};
    return computeMemberRoleCounts(myMember, myMissions);
  }, [myMember, myMissions]);

  // Quantidade adicional de missões concluídas exibidas via botão "Mostrar mais" (+10 a cada clique)
  const [additionalConcluded, setAdditionalConcluded] = useState(0);

  // Modal de Detalhamento Completo do XP e Gamificação
  const [isXpModalOpen, setIsXpModalOpen] = useState(false);

  // Perfil completo de performance e XP do colaborador
  const performanceProfile = useMemo(() => {
    if (!myMember) return null;
    return calculateMemberPerformanceProfile(myMember, missions);
  }, [myMember, missions]);

  // Nível gamificado calculado com base no Score de XP
  const userLevel = useMemo(() => {
    return getCareerProgression(performanceProfile?.score || 0);
  }, [performanceProfile?.score]);

  // Lista ordenada de funções que estão gerando pontos ativamente
  const activeScoringRoles = useMemo(() => {
    if (!performanceProfile?.rolePoints) return [];
    return OFFICIAL_COMPANY_ROLES
      .filter((r) => (performanceProfile.rolePoints[r] || 0) > 0)
      .map((r) => ({
        role: r,
        points: performanceProfile.rolePoints[r],
        count: performanceProfile.roleCounts[r] || 0,
      }))
      .sort((a, b) => b.points - a.points);
  }, [performanceProfile]);

  // Missões ordenadas estritamente por ordem de acontecimento (o que vai acontecer logo aparece primeiro)
  const sortedMyMissions = useMemo(() => {
    return sortMissionsByStatusPriority(myMissions);
  }, [myMissions, liveTick]);

  // Separação de missões ativas/em campo das missões já concluídas/passadas
  // Regra de Exibição: Inicialmente apenas 5 missões no total na tela (priorizando ativas/em campo);
  // O botão "Mostrar mais" exibe de 10 em 10 as missões já concluídas.
  const { activeMissions, concludedMissions, displayedConcluded, displayedMissions } = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const active = [];
    const concluded = [];

    sortedMyMissions.forEach((m) => {
      const mStatus = String(m.missionStatus || 'Agendada').trim().toLowerCase();
      const isPastDate = Boolean(m.date && (m.endDate || m.date) < todayStr);
      const isConcludedStatus = (
        mStatus === 'finalizada' ||
        mStatus === 'finalizado' ||
        mStatus === 'concluída' ||
        mStatus === 'concluida' ||
        mStatus === 'concluída (homologada)' ||
        mStatus === 'concluida (homologada)' ||
        mStatus === 'pendente' ||
        mStatus === 'pendente (pós-prod.)' ||
        mStatus === 'cancelada' ||
        mStatus === 'cancelado'
      );

      // Missão concluída, cancelada ou de data anterior a hoje (e não em execução)
      if (isConcludedStatus || (isPastDate && mStatus !== 'em execução' && mStatus !== 'em andamento')) {
        concluded.push(m);
      } else {
        active.push(m);
      }
    });

    // Limite estrito de no máximo 5 missões iniciais na tela
    const displayedActive = active.slice(0, 5);
    const initialConcludedSlots = Math.max(0, 5 - displayedActive.length);
    const totalConcludedToShow = initialConcludedSlots + additionalConcluded;
    const dispConcluded = concluded.slice(0, totalConcludedToShow);

    return {
      activeMissions: active,
      concludedMissions: concluded,
      displayedConcluded: dispConcluded,
      displayedMissions: [...displayedActive, ...dispConcluded],
    };
  }, [sortedMyMissions, additionalConcluded]);

  // Resumo financeiro do mês
  const financialSummary = useMemo(() => {
    if (!myMember) return { totalHours: 0, totalHoursVal: 0, totalDays: 0, totalDaysVal: 0, total: 0, isPaid: false };
    const monthMissions = myMissions.filter((m) => (m.date || '').startsWith(currentMonthKey));

    const hourlyRate = Number(myMember.hourlyRate ?? myMember.hourly_rate ?? 50);
    const dailyRate = Number(myMember.dailyRate ?? myMember.daily_rate ?? 200);

    let totalHours = 0;
    let totalHoursVal = 0;
    let totalDays = 0;
    let totalDaysVal = 0;
    let totalCustomCount = 0;
    let totalCustomVal = 0;

    monthMissions.forEach((m) => {
      // Regra Oficial MegaFilmes: Horas extras e diárias são contabilizadas assim que a missão retorna/evento termina,
      // sem depender da entrega ou conclusão da pós-produção/edição.
      const isEligible = isMissionEligibleForPayout(m);
      if (!isEligible) return;

      const isMDay = Boolean(m.isMultiDay || (m.endDate && m.endDate !== m.date));
      const customRate = (m.customRates && m.customRates[myMember.id] !== undefined && m.customRates[myMember.id] !== null && m.customRates[myMember.id] !== '')
        ? Number(m.customRates[myMember.id])
        : null;

      const memberMode = (m.memberRemunerationTypes && m.memberRemunerationTypes[myMember.id])
        || m.remunerationType
        || (isMDay ? 'daily' : 'off_hours');

      if (memberMode === 'custom') {
        const val = customRate !== null ? customRate : 0;
        totalCustomCount += 1;
        totalCustomVal += val;
      } else if (memberMode === 'daily') {
        let days = 1;
        if (isMDay && m.date && m.endDate) {
          try {
            const [y1, m1, d1] = m.date.split('-').map(Number);
            const [y2, m2, d2] = m.endDate.split('-').map(Number);
            const diff = Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / (1000 * 60 * 60 * 24)) + 1;
            days = diff > 0 ? diff : 1;
          } catch (e) { days = 1; }
        }
        totalDays += days;
        const rate = customRate !== null ? customRate : dailyRate;
        totalDaysVal += days * rate;
      } else {
        // Regra Oficial MegaFilmes: Horas extras calculadas estritamente entre o Início e Término do Evento
        // (deslocamento ida e volta da base não é contabilizado)
        // REGRA IMPORTANTE: Os editores que ficam na pós-produção NÃO devem receber horas extras!
        const memNameNorm = String(myMember?.name || '').trim().toLowerCase();
        const codeClean = String(m.code || m.id || '');
        const descClean = String(m.description || '').toLowerCase();
        const isSesi202611144 = codeClean.includes('202611144') || (descClean.includes('sesi') && descClean.includes('terceir'));
        const isMateusSesi202611144 = isSesi202611144 && memNameNorm.includes('mateus');

        const isEligibleForExtras = !isMateusSesi202611144 && isMemberEligibleForExtraHours(myMember, m);
        if (isEligibleForExtras) {
          const offHoursInfo = calculateEventOnlyOffHours(m);
          const approvedExtra = Number(m.extraHoursApproved) || 0;
          const offHoursTotal = (offHoursInfo.offHours || 0) + approvedExtra;
          totalHours += offHoursTotal;
          if (offHoursTotal > 0) {
            const rate = customRate !== null ? customRate : hourlyRate;
            const remun = calculateExtraHoursRemuneration(offHoursTotal, rate);
            totalHoursVal += remun.amount;
          }
        }
      }
    });

    const closure = closures[myMember.id] || null;
    const isPaid = closure?.status === 'Pago';

    const grossTotal = Number((totalHoursVal + totalDaysVal + totalCustomVal).toFixed(2));
    const totalAdvancesVal = Number(
      myAdvances.reduce((acc, a) => acc + (Number(a.amount) || 0), 0).toFixed(2)
    );
    const netTotal = Number(Math.max(0, grossTotal - totalAdvancesVal).toFixed(2));

    return {
      totalHours: Number(totalHours.toFixed(1)),
      totalHoursVal: Number(totalHoursVal.toFixed(2)),
      totalDays,
      totalDaysVal: Number(totalDaysVal.toFixed(2)),
      totalCustomCount,
      totalCustomVal: Number(totalCustomVal.toFixed(2)),
      grossTotal,
      totalAdvancesVal,
      advancesCount: myAdvances.length,
      advances: myAdvances,
      netTotal,
      total: isPaid ? grossTotal : netTotal,
      isPaid,
      clearedAt: closure?.clearedAt || null,
    };
  }, [myMember, myMissions, currentMonthKey, closures, myAdvances]);

  // Previsão de pagamento do mês seguinte (Dia 05 oficial)
  const nextMonthForecast = useMemo(() => {
    try {
      const [y, m] = currentMonthKey.split('-').map(Number);
      const nextDate = new Date(y, m, 5);
      const monthNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
      ];
      return `Dia 05 de ${monthNames[nextDate.getMonth()]} de ${nextDate.getFullYear()}`;
    } catch (e) {
      return 'Dia 05 do próximo mês';
    }
  }, [currentMonthKey]);

  // Extrato Financeiro Transparente: Lista cronológica de todos os lançamentos do mês (créditos e débitos)
  const financialEntries = useMemo(() => {
    if (!myMember) return [];
    const entries = [];

    // 1. Missões elegíveis do mês (Créditos)
    const monthMissions = myMissions.filter((m) => (m.date || '').startsWith(currentMonthKey));
    const hourlyRate = Number(myMember.hourlyRate ?? myMember.hourly_rate ?? 50);
    const dailyRate = Number(myMember.dailyRate ?? myMember.daily_rate ?? 200);

    monthMissions.forEach((m) => {
      if (!isMissionEligibleForPayout(m)) return;
      const isMDay = Boolean(m.isMultiDay || (m.endDate && m.endDate !== m.date));
      const customRate = (m.customRates && m.customRates[myMember.id] !== undefined && m.customRates[myMember.id] !== null && m.customRates[myMember.id] !== '')
        ? Number(m.customRates[myMember.id])
        : null;

      const memberMode = (m.memberRemunerationTypes && m.memberRemunerationTypes[myMember.id])
        || m.remunerationType
        || (isMDay ? 'daily' : 'off_hours');

      if (memberMode === 'custom') {
        const val = customRate !== null ? customRate : 0;
        entries.push({
          id: `m-custom-${m.id}`,
          date: m.date,
          type: 'credit',
          category: 'custom',
          categoryLabel: 'Cachê / Fixo',
          badgeColor: '#a855f7',
          missionCode: getMissionCode(m),
          title: m.title || m.description || 'Missão com Remuneração Personalizada',
          detail: 'Cachê acordado individualmente para esta missão',
          amount: val,
          rawMission: m,
        });
      } else if (memberMode === 'daily') {
        let days = 1;
        if (isMDay && m.date && m.endDate) {
          try {
            const [y1, m1, d1] = m.date.split('-').map(Number);
            const [y2, m2, d2] = m.endDate.split('-').map(Number);
            const diff = Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / (1000 * 60 * 60 * 24)) + 1;
            days = diff > 0 ? diff : 1;
          } catch (e) { days = 1; }
        }
        const rate = customRate !== null ? customRate : dailyRate;
        const val = days * rate;
        entries.push({
          id: `m-daily-${m.id}`,
          date: m.date,
          type: 'credit',
          category: 'daily',
          categoryLabel: 'Diária de Campo',
          badgeColor: '#06b6d4',
          missionCode: getMissionCode(m),
          title: m.title || m.description || 'Missão em Campo / Viagem',
          detail: `${days} ${days > 1 ? 'diárias' : 'diária'} @ ${formatBRL(rate)}/dia`,
          amount: val,
          rawMission: m,
        });
      } else {
        const memNameNorm = String(myMember?.name || '').trim().toLowerCase();
        const codeClean = String(m.code || m.id || '');
        const descClean = String(m.description || '').toLowerCase();
        const isSesi202611144 = codeClean.includes('202611144') || (descClean.includes('sesi') && descClean.includes('terceir'));
        const isMateusSesi202611144 = isSesi202611144 && memNameNorm.includes('mateus');

        const isEligibleForExtras = !isMateusSesi202611144 && isMemberEligibleForExtraHours(myMember, m);
        if (isEligibleForExtras) {
          const offHoursInfo = calculateEventOnlyOffHours(m);
          const approvedExtra = Number(m.extraHoursApproved) || 0;
          const offHoursTotal = (offHoursInfo.offHours || 0) + approvedExtra;
          if (offHoursTotal > 0) {
            const rate = customRate !== null ? customRate : hourlyRate;
            const remun = calculateExtraHoursRemuneration(offHoursTotal, rate);
            entries.push({
              id: `m-hours-${m.id}`,
              date: m.date,
              type: 'credit',
              category: 'hours',
              categoryLabel: 'Horas Extras',
              badgeColor: '#f59e0b',
              missionCode: getMissionCode(m),
              title: m.title || m.description || 'Atuação Fora do Expediente',
              detail: `${offHoursTotal.toFixed(1)}h extras @ ${formatBRL(rate)}/hora extra`,
              amount: remun.amount,
              rawMission: m,
            });
          }
        }
      }
    });

    // 2. Vales Concedidos no Mês (Débitos)
    myAdvances.forEach((adv) => {
      entries.push({
        id: `adv-${adv.id}`,
        date: adv.date,
        type: 'debit',
        category: 'advance',
        categoryLabel: 'Vale / Adiantamento',
        badgeColor: '#f43f5e',
        missionCode: `VALE #${String(adv.id).slice(-4)}`,
        title: adv.reason || adv.description || 'Adiantamento salarial concedido',
        detail: `Forma: ${adv.paymentMethod || adv.payment_method || 'PIX'} • Concedido pela Diretoria`,
        amount: Number(adv.amount) || 0,
        receiptUrl: adv.receiptUrl || adv.receipt_url || null,
        rawAdvance: adv,
      });
    });

    // Ordenar cronologicamente por data decrescente (mais recentes primeiro)
    entries.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    return entries;
  }, [myMember, myMissions, currentMonthKey, myAdvances]);

  const filteredFinancialEntries = useMemo(() => {
    if (financialTabFilter === 'credits') {
      return financialEntries.filter((e) => e.type === 'credit');
    }
    if (financialTabFilter === 'debits') {
      return financialEntries.filter((e) => e.type === 'debit');
    }
    return financialEntries;
  }, [financialEntries, financialTabFilter]);

  // Copia PIX
  const handleCopyPix = () => {
    if (!myMember?.pixKey) return;
    navigator.clipboard.writeText(myMember.pixKey);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 2000);
  };

  // Iniciar cadastro / edição de PIX
  const handleStartEditPix = () => {
    setPixInput(myMember?.pixKey || '');
    setIsEditingPix(true);
  };

  const handleCancelEditPix = () => {
    setIsEditingPix(false);
    setPixInput('');
  };

  const handleSavePix = async () => {
    const trimmed = pixInput.trim();
    setIsSavingPix(true);
    try {
      if (onUpdatePixKey && myMember?.id) {
        await onUpdatePixKey(myMember.id, trimmed);
      } else {
        await apiUpdatePixKey(trimmed);
      }
      setIsEditingPix(false);
      await alertDialog({
        title: 'Chave PIX Salva',
        message: trimmed ? 'Sua chave PIX foi atualizada com sucesso!' : 'Sua chave PIX foi removida.',
        variant: 'success',
      });
    } catch (e) {
      await alertDialog({
        title: 'Erro ao Salvar PIX',
        message: 'Não foi possível salvar a chave PIX no momento. Tente novamente.',
        variant: 'danger',
      });
    } finally {
      setIsSavingPix(false);
    }
  };

  const handleDeletePix = async () => {
    const confirmed = await confirmDialog({
      title: 'Excluir Chave PIX',
      message: 'Tem certeza que deseja excluir sua chave PIX cadastrada?',
      confirmText: 'Excluir Chave',
      cancelText: 'Cancelar',
      variant: 'danger',
    });
    if (!confirmed) return;

    setIsSavingPix(true);
    try {
      if (onUpdatePixKey && myMember?.id) {
        await onUpdatePixKey(myMember.id, '');
      } else {
        await apiUpdatePixKey('');
      }
      setIsEditingPix(false);
      setPixInput('');
      await alertDialog({
        title: 'Chave PIX Excluída',
        message: 'Sua chave PIX foi removida com sucesso.',
        variant: 'success',
      });
    } catch (e) {
      await alertDialog({
        title: 'Erro ao Excluir PIX',
        message: 'Não foi possível excluir a chave PIX.',
        variant: 'danger',
      });
    } finally {
      setIsSavingPix(false);
    }
  };

  // Avaliação em tempo real da extensão selecionada no modal (dentro vs. fora do expediente)
  const modalExtEval = useMemo(() => {
    if (!requestModalMission) return null;
    const baseReturn = requestModalMission.returnTimeEstimated || requestModalMission.arrivalTimeEstimated || '18:00';
    return evaluateMissionExtension(requestModalMission.date, baseReturn, requestedHours);
  }, [requestModalMission, requestedHours]);

  // Enviar solicitação de hora extra ou confirmação de prorrogação de pauta
  const handleSubmitExtraHoursRequest = async (e) => {
    e.preventDefault();
    if (!requestModalMission) return;
    setIsSubmittingRequest(true);
    try {
      const baseReturn = requestModalMission.returnTimeEstimated || requestModalMission.arrivalTimeEstimated || '18:00';
      const extEval = evaluateMissionExtension(requestModalMission.date, baseReturn, requestedHours);

      // Se a prorrogação for 100% dentro do expediente comercial regular (não gera horas extras):
      if (extEval.isFullInHours) {
        const res = await apiExtendMissionReturnTime({
          missionId: requestModalMission.id,
          newReturnTime: extEval.newEndTimeStr,
          hoursAdded: requestedHours,
          reason: requestReason.trim() || 'Prorrogação de tempo em campo dentro do expediente comercial regular.',
          memberId: myMember?.id,
          memberName: myMember?.name,
        });

        if (res.success) {
          await alertDialog({
            title: '⏱️ Prorrogação Confirmada',
            message: `O retorno da pauta foi estendido para as ${extEval.newEndTimeStr} com sucesso dentro do expediente regular. A equipe e a viatura já estão atualizadas na escala do dia.`,
            variant: 'success',
          });
          setRequestModalMission(null);
          setRequestReason('');
          setRequestedHours(1.0);
          if (onReloadMissions) onReloadMissions();
        } else {
          await alertDialog({
            title: 'Atenção',
            message: res.error || 'Não foi possível registrar a prorrogação.',
            variant: 'danger',
          });
        }
      } else {
        // Se a prorrogação atinge ou ultrapassa o horário de expediente comercial (gera horas extras financeiras):
        const res = await apiRequestExtraHours({
          missionId: requestModalMission.id,
          hoursRequested: requestedHours,
          reason: requestReason.trim() || 'Necessário tempo adicional de trabalho fora do expediente regular.',
          memberId: myMember?.id,
          memberName: myMember?.name,
        });

        if (res.success) {
          await alertDialog({
            title: '⚡ Solicitação de Hora Extra Enviada',
            message: `Sua solicitação de +${requestedHours}h fora do expediente foi enviada para aprovação do administrador.`,
            variant: 'success',
          });
          setRequestModalMission(null);
          setRequestReason('');
          setRequestedHours(1.0);
          if (onReloadMissions) onReloadMissions();
        } else {
          await alertDialog({
            title: 'Atenção',
            message: res.error || 'Não foi possível registrar a solicitação.',
            variant: 'danger',
          });
        }
      }
    } catch (err) {
      await alertDialog({
        title: 'Erro de Conexão',
        message: 'Ocorreu uma falha ao enviar sua solicitação.',
        variant: 'danger',
      });
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const handleConfirmConcludeEditorPart = async ({
    mission,
    editorId,
    editorName,
    serverFilePath,
    editorMessage,
    isLate,
  }) => {
    if (!mission) return;
    const now = new Date();
    const deliveryStatus = isLate ? 'Fora do Prazo' : 'Dentro do Prazo';

    const assignedEditors = resolveMissionEditors(mission, members);
    const existingDelivery = getMissionEditorsDeliveryMap(mission, members);

    const edKey = String(editorId || myMember?.id || assignedEditors[0]?.id || 'editor');
    const edName = editorName || myMember?.name || 'Editor';

    const updatedDelivery = {
      ...existingDelivery,
      [edKey]: {
        editorId: edKey,
        editorName: edName,
        status: 'delivered',
        deliveredAt: now.toISOString(),
        serverFilePath: serverFilePath || null,
        notes: editorMessage || null,
        isLate,
      },
    };

    const pendingRemaining = assignedEditors.filter((e) => {
      const d = updatedDelivery[String(e.id)];
      return !d || d.status !== 'delivered';
    });
    const isAllFinished = assignedEditors.length > 0 && pendingRemaining.length === 0;

    const descParts = [
      `Entrega de pós-produção registrada por ${edName}.`,
      serverFilePath ? `Local no Servidor: "${serverFilePath}".` : null,
      editorMessage ? `Mensagem: "${editorMessage}".` : null,
      `Pontualidade: ${deliveryStatus}.`,
      isAllFinished ? 'Todos os editores concluíram.' : `Aguardando ${pendingRemaining.map((e) => e.name).join(', ')}.`,
    ].filter(Boolean).join(' ');

    const newEvent = {
      id: 'h-' + Date.now(),
      type: isAllFinished ? 'COMPLETED' : 'PARTIAL_COMPLETED',
      user: edName,
      timestamp: now.toISOString(),
      title: isAllFinished ? `Edição Totalmente Concluída (${deliveryStatus})` : `Parte Entregue por ${edName} (${deliveryStatus})`,
      description: descParts,
      status: deliveryStatus,
      isOverdue: isLate,
      serverFilePath: serverFilePath || null,
      message: editorMessage || null,
    };

    const updatedHistory = Array.isArray(mission.editionHistory)
      ? [...mission.editionHistory, newEvent]
      : [newEvent];

    // Preserva intacto o Briefing/Roteiro da missão (notes), registrando a entrega nos campos dedicados (serverFilePath e editionHistory)
    const missionVer = (mission.version !== undefined && mission.version !== null) ? Number(mission.version) : 1;
    const updatedMission = {
      ...mission,
      editionStatus: isAllFinished ? 'Edição Concluída' : 'Em Edição',
      missionStatus: 'Pendente',
      editionDeliveryStatus: deliveryStatus,
      serverFilePath: serverFilePath || mission.serverFilePath || null,
      editionCompletedAt: isAllFinished ? now.toISOString() : (mission.editionCompletedAt || now.toISOString()),
      editionCompletedBy: isAllFinished ? edName : mission.editionCompletedBy,
      isOverdue: isLate ? 1 : 0,
      reopenReason: '',
      notes: mission.notes || '',
      editorsDelivery: updatedDelivery,
      editionHistory: updatedHistory,
      version: missionVer,
    };

    setConcludeModal({ isOpen: false, mission: null });

    if (onSaveMission) {
      const res = await onSaveMission(updatedMission);
      if (res && res.success === false) {
        await alertDialog({
          title: 'Não foi possível concluir',
          message: res.error || 'Erro ao registrar a conclusão da tarefa de pós-produção.',
          variant: 'danger',
        });
        return;
      }

      if (isAllFinished) {
        sendPushNotification(`🎬 Pós-Produção Pronta para Avaliação! (#${mission.code || mission.id})`, {
          body: `Todos os editores (${assignedEditors.map(e => e.name).join(', ')}) concluíram a pauta "${mission.description}".`,
          tag: `pp-pending-${mission.id}`,
          data: { missionId: mission.id, type: 'post_production_approval' },
        });
        await alertDialog({
          title: '🎉 Edição Concluída!',
          message: 'Todos os editores finalizaram suas etapas! A pauta foi enviada para avaliação e aprovação final da diretoria.',
          variant: 'success',
        });
      } else {
        await alertDialog({
          title: '✅ Sua Parte Foi Entregue!',
          message: `Sua etapa da pós-produção foi registrada com sucesso! A pauta permanecerá em edição aguardando ${pendingRemaining.map(e => e.name).join(', ')}.`,
          variant: 'success',
        });
      }
      if (onReloadMissions) onReloadMissions();
    }
  };

  if (!myMember) {
    return (
      <div className="cs-loading-notice">
        Carregando informações do colaborador...
      </div>
    );
  }

  return (
    <div className="collaborator-space-container">
      {/* ============================================================== */}
      {/* 1. CARD UNIFICADO: PASSE DE IDENTIDADE OPERACIONAL & CARREIRA  */}
      {/* Visual moderno, elegante e sem caixas aninhadas (uma só janela)*/}
      {/* ============================================================== */}
      <div className="cs-unified-profile-card">
        {/* Glow de iluminação de fundo sutil conforme o nível */}
        <div
          className="cs-upc-ambient-glow"
          style={{
            background: `radial-gradient(circle at 50% -20%, ${userLevel.color ? userLevel.color + '26' : 'rgba(56, 189, 248, 0.16)'} 0%, transparent 70%)`
          }}
        />

        {/* 1. SEÇÃO SUPERIOR: IDENTIDADE, FUNÇÕES E CHAVE PIX */}
        <div className="cs-upc-top-grid">
          {/* Avatar com Halo Épico e Insígnia Oficial de Patente */}
          <div className="cs-upc-avatar-wrap">
            <div
              className={`cs-upc-avatar ${userLevel.insigniaClass || ''}`}
              style={{
                borderColor: userLevel.color || '#f59e0b',
                boxShadow: `0 0 28px ${userLevel.color ? userLevel.color + '55' : 'rgba(245, 158, 11, 0.45)'}`,
              }}
            >
              {myMember.photoUrl ? (
                <img src={myMember.photoUrl} alt={myMember.name} />
              ) : (
                <span>{myMember.name.slice(0, 2).toUpperCase()}</span>
              )}
            </div>
            
            {/* Insígnia Flutuante Sobre o Avatar com Ícone */}
            <div
              className="cs-upc-avatar-insignia"
              title={`${userLevel.icon || '🎖️'} ${userLevel.title}`}
              style={{
                borderColor: userLevel.color || '#f59e0b',
                background: `linear-gradient(135deg, #1e293b 0%, #0f172a 100%)`,
                boxShadow: `0 4px 14px ${userLevel.color ? userLevel.color + '70' : 'rgba(0,0,0,0.5)'}`,
              }}
            >
              <span className="cs-insignia-icon">{userLevel.icon || '🎖️'}</span>
            </div>
          </div>

          {/* Nome, Empresa e Tags de Funções Oficiais */}
          <div className="cs-upc-identity">
            <div className="cs-upc-name-row">
              <h2 className="cs-upc-name">{myMember.name}</h2>
              <span className="cs-upc-company-pill">
                <Sparkles size={11} className="text-cyan-bright" />
                {myMember.company || 'MegaFilmes'}
              </span>
            </div>

            {/* Funções do Colaborador (Principal + Adicionais + CNH) */}
            <div className="cs-upc-roles-wrap">
              <span className="cs-upc-role-main" title="Função Principal na Empresa">
                💼 {myMember.role || 'Colaborador'}
                <span className="cs-upc-role-tag main">Principal</span>
              </span>

              {Array.isArray(myMember.secondaryRoles) && myMember.secondaryRoles.map((secRole) => (
                <span key={secRole} className="cs-upc-role-sec" title="Função Adicional habilitada na Empresa">
                  🎯 {secRole}
                  <span className="cs-upc-role-tag sec">Adicional</span>
                </span>
              ))}

              {myMember.canDrive && (
                <span className="cs-upc-cnh-pill" title="Habilitação ativa para condução de frotas">
                  🚗 CNH {myMember.cnhCategory || 'AB'}
                </span>
              )}
            </div>
          </div>

          {/* Chave PIX Integrada em Linha Limpa */}
          <div className="cs-upc-pix-box">
            {isEditingPix ? (
              <div className="cs-upc-pix-edit">
                <input
                  type="text"
                  className="cs-upc-pix-input"
                  placeholder="Chave PIX (CPF, celular, e-mail...)"
                  value={pixInput}
                  autoFocus
                  onChange={(e) => setPixInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSavePix();
                    }
                    if (e.key === 'Escape') handleCancelEditPix();
                  }}
                />
                <button
                  type="button"
                  className="cs-upc-pix-btn save"
                  onClick={handleSavePix}
                  disabled={isSavingPix}
                  title="Salvar Chave PIX"
                >
                  <Check size={13} />
                </button>
                <button
                  type="button"
                  className="cs-upc-pix-btn cancel"
                  onClick={handleCancelEditPix}
                  disabled={isSavingPix}
                  title="Cancelar"
                >
                  <X size={13} />
                </button>
              </div>
            ) : (
              <div className="cs-upc-pix-display">
                <div className="cs-upc-pix-header">
                  <CreditCard size={12} className="text-cyan-bright" />
                  <span>CHAVE PIX</span>
                </div>
                <div className="cs-upc-pix-body">
                  <strong className={`cs-upc-pix-val ${!myMember?.pixKey ? 'empty' : ''}`} title={myMember?.pixKey || 'Nenhuma chave cadastrada'}>
                    {myMember?.pixKey || 'Não cadastrada'}
                  </strong>
                  {myMember?.pixKey ? (
                    <div className="cs-upc-pix-actions">
                      <button
                        type="button"
                        onClick={handleCopyPix}
                        className={`cs-upc-pix-action-btn copy ${copiedPix ? 'copied' : ''}`}
                        title="Copiar Chave PIX"
                      >
                        {copiedPix ? <Check size={11} /> : <Copy size={11} />}
                        <span>{copiedPix ? 'Copiado!' : 'Copiar'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleStartEditPix}
                        className="cs-upc-pix-action-btn edit"
                        title="Editar Chave PIX"
                      >
                        <Edit2 size={11} />
                      </button>
                      <button
                        type="button"
                        onClick={handleDeletePix}
                        className="cs-upc-pix-action-btn delete"
                        title="Excluir Chave PIX"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStartEditPix}
                      className="cs-upc-pix-add-btn"
                    >
                      <Plus size={11} /> Cadastrar PIX
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Separador Orgânico com Efeito de Luz */}
        <div className="cs-upc-divider" />

        {/* 2. SEÇÃO DE GAMIFICAÇÃO & PATENTE INTEGRADA NA MESMA JANELA */}
        <div className="cs-upc-gamification">
          <div className="cs-upc-tier-row">
            {/* Bloco Esquerda: Patente & Descrição */}
            <div className="cs-upc-tier-lead">
              <div className="cs-upc-tier-badge">
                <span className="cs-upc-tier-pill" style={{ color: userLevel.color || '#f59e0b', borderColor: userLevel.color ? userLevel.color + '45' : 'rgba(245, 158, 11, 0.4)' }}>
                  NÍVEL {userLevel.level} • {userLevel.title.toUpperCase()}
                </span>
                <span className="cs-upc-tier-sub">Patente Operacional</span>
              </div>
              <h3 className="cs-upc-tier-heading" style={{ color: userLevel.color || '#f59e0b' }}>
                {userLevel.title}
              </h3>
              {userLevel.description && (
                <p className="cs-upc-tier-desc">{userLevel.description}</p>
              )}
            </div>

            {/* Bloco Direita: Contador de XP e Botão Ver Extrato */}
            <div className="cs-upc-score-lead">
              <div className="cs-upc-score-display">
                <Sparkles size={20} className="text-amber" />
                <span className="cs-upc-score-val">{userLevel.score}</span>
                <span className="cs-upc-score-unit">XP</span>
              </div>
              <button
                type="button"
                className="cs-upc-extrato-btn"
                onClick={() => setIsXpModalOpen(true)}
                title="Abrir Extrato Completo de Pontuação, Horas e Funções"
              >
                <span>Ver Extrato</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* Barra de Progresso com Glow Neon */}
          <div className="cs-upc-progress-section">
            <div className="cs-upc-progress-track">
              <div
                className="cs-upc-progress-bar"
                style={{
                  width: `${userLevel.progressPercent}%`,
                  background: `linear-gradient(90deg, #06b6d4 0%, ${userLevel.color || '#f59e0b'} 100%)`,
                  boxShadow: `0 0 14px ${userLevel.color ? userLevel.color + '70' : 'rgba(245, 158, 11, 0.5)'}`,
                }}
              />
            </div>
            <div className="cs-upc-progress-labels">
              <span className="cs-upc-progress-pct">
                <Zap size={12} className="text-cyan-bright" />
                {userLevel.progressPercent}% no Nível {userLevel.level} • {userLevel.overallPercent}% rumo a 10.000 XP
              </span>
              <span className="cs-upc-progress-rem">
                {userLevel.level >= 10
                  ? '🌟 Patente Lendária Máxima da MegaFilmes (Hall da Fama)'
                  : `Faltam ${userLevel.remainingForNext} XP para o Nível ${userLevel.level + 1} (${userLevel.nextTier?.title || ''})`}
              </span>
            </div>
          </div>

          {/* Timeline de Níveis Superados */}
          {userLevel.completedTiers && userLevel.completedTiers.length > 0 && (
            <div className="cs-upc-timeline-row">
              <span className="cs-upc-timeline-label">
                <CheckCircle2 size={13} className="text-emerald" />
                <span>Níveis superados:</span>
              </span>
              <div className="cs-upc-timeline-chips">
                {userLevel.completedTiers.map((t) => (
                  <span key={t.level} className="cs-upc-timeline-chip">
                    {t.icon} Nível {t.level} ({t.title})
                  </span>
                ))}
                <span className="cs-upc-timeline-current-chip" style={{ color: userLevel.color || '#f59e0b', borderColor: userLevel.color ? userLevel.color + '50' : 'rgba(245, 158, 11, 0.4)' }}>
                  👑 Nível {userLevel.level} (Atual)
                </span>
              </div>
            </div>
          )}

          {/* Funções em que está pontuando ativamente */}
          <div className="cs-upc-roles-scoring">
            <span className="cs-upc-roles-scoring-label">
              <Target size={13} className="text-amber" />
              <span>Pontuando em:</span>
            </span>
            <div className="cs-upc-roles-scoring-list">
              {activeScoringRoles.length > 0 ? (
                activeScoringRoles.map(({ role, points, count }) => (
                  <button
                    key={role}
                    type="button"
                    className="cs-upc-role-chip"
                    onClick={() => setIsXpModalOpen(true)}
                    title={`${role}: ${count}x missões concluídas gerando ${points} XP.`}
                  >
                    <span className="chip-ico">{ROLE_ICONS_MAP[role] || '💼'}</span>
                    <span className="chip-txt">{role}</span>
                    <strong className="chip-pts">+{points} XP</strong>
                  </button>
                ))
              ) : (
                <span className="cs-upc-role-empty">
                  🚀 Participe de missões de campo e entregas para computar XP nas suas funções!
                </span>
              )}
            </div>
          </div>

          {/* Vitrine de Conquistas & Insígnias */}
          {performanceProfile?.allAchievements && (
            <div className="cs-upc-achievements-tray">
              <div className="cs-upc-achievements-header">
                <div className="cs-upc-achievements-title">
                  <Award size={15} className="text-amber" />
                  <span>Conquistas &amp; Insígnias</span>
                  <span className="cs-upc-achievements-count">
                    ({performanceProfile.unlockedCount} de {performanceProfile.totalAchievementsCount} desbloqueadas)
                  </span>
                </div>
                <button
                  type="button"
                  className="cs-upc-achievements-see-all"
                  onClick={() => setIsXpModalOpen(true)}
                  title="Ver todas as 16 conquistas e requisitos"
                >
                  <span>Ver Todos os Desafios</span>
                  <ChevronRight size={13} />
                </button>
              </div>

              <div className="cs-upc-achievements-grid">
                {performanceProfile.allAchievements.map((ach) => (
                  <div
                    key={ach.id}
                    className={`cs-upc-ach-badge ${ach.isUnlocked ? 'is-unlocked' : 'is-locked'}`}
                    title={`${ach.name} (${ach.rarity}): ${ach.desc}. Progresso: ${ach.current}/${ach.target}`}
                    onClick={() => setIsXpModalOpen(true)}
                  >
                    <span className="cs-ach-icon">{ach.icon}</span>
                    <div className="cs-ach-info">
                      <strong className="cs-ach-name">{ach.name}</strong>
                      <span className="cs-ach-status">
                        {ach.isUnlocked ? (
                          <span className="ach-unlocked-lbl" style={{ color: ach.color }}>
                            ✅ Conquistado
                          </span>
                        ) : (
                          <span className="ach-locked-lbl">
                            🔒 {ach.current}/{ach.target}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. RESUMO FINANCEIRO DO MÊS (EXTRATO PESSOAL)                   */}
      {/* ============================================================== */}
      <div className="cs-section-block">
        <div className="cs-section-header-row">
          <div>
            <h3 className="cs-section-heading">
              <DollarSign size={18} className="text-amber" />
              Meu Fechamento &amp; Saldo do Mês
            </h3>
            <span className="cs-section-header-sub">
              Apuração oficial e transparente de horas extras, diárias, cachês e vales salariais
            </span>
          </div>

          <button
            type="button"
            className="cs-btn-view-xp-extrato cs-btn-view-financial-extrato"
            onClick={() => {
              setFinancialTabFilter('all');
              setIsFinancialModalOpen(true);
            }}
            title="Abrir Extrato Financeiro Transparente do Mês"
          >
            <Receipt size={14} className="text-green" />
            <span>Ver Extrato Financeiro</span>
          </button>
        </div>

        <div className="cs-summary-grid">
          {/* Card Horas Extras */}
          <div
            className="cs-summary-card cs-card-hours is-clickable"
            onClick={() => {
              setFinancialTabFilter('credits');
              setIsFinancialModalOpen(true);
            }}
            title="Clique para ver o extrato detalhado de horas extras"
            style={{ cursor: 'pointer' }}
          >
            <div className="cs-card-header">
              <span className="cs-card-lbl">Horas Extras ({financialSummary.totalHours}h)</span>
              <Clock size={18} className="text-amber" />
            </div>
            <strong className="cs-card-val text-amber">
              {formatBRL(financialSummary.totalHoursVal)}
            </strong>
            <span className="cs-card-sub" title="Taxa individual por hora extra">
              Taxa: {formatBRL(myMember.hourlyRate || 50)} / hora extra
            </span>
          </div>

          {/* Card Diárias */}
          <div
            className="cs-summary-card cs-card-travel is-clickable"
            onClick={() => {
              setFinancialTabFilter('credits');
              setIsFinancialModalOpen(true);
            }}
            title="Clique para ver o extrato detalhado de diárias"
            style={{ cursor: 'pointer' }}
          >
            <div className="cs-card-header">
              <span className="cs-card-lbl">Diárias ({financialSummary.totalDays} dias)</span>
              <Compass size={18} className="text-cyan" />
            </div>
            <strong className="cs-card-val text-cyan">
              {formatBRL(financialSummary.totalDaysVal)}
            </strong>
            <span className="cs-card-sub">
              Taxa diária: {formatBRL(myMember.dailyRate || 200)}/dia
            </span>
          </div>

          {/* Card Personalizadas (Cachês) */}
          {financialSummary.totalCustomCount > 0 && (
            <div
              className="cs-summary-card cs-card-custom is-clickable"
              onClick={() => {
                setFinancialTabFilter('credits');
                setIsFinancialModalOpen(true);
              }}
              title="Clique para ver os cachês das missões personalizadas"
              style={{ borderLeft: '3px solid #a855f7', background: 'rgba(168, 85, 247, 0.08)', cursor: 'pointer' }}
            >
              <div className="cs-card-header">
                <span className="cs-card-lbl">Personalizadas ({financialSummary.totalCustomCount} missões)</span>
                <Sparkles size={18} className="text-purple" />
              </div>
              <strong className="cs-card-val text-purple">
                {formatBRL(financialSummary.totalCustomVal)}
              </strong>
              <span className="cs-card-sub">
                Cachês e valores fixos acordados
              </span>
            </div>
          )}

          {/* Card Vales e Adiantamentos Concedidos */}
          <div
            className="cs-summary-card cs-card-advances is-clickable"
            onClick={() => {
              setFinancialTabFilter('debits');
              setIsFinancialModalOpen(true);
            }}
            style={{
              borderLeft: '3px solid #f43f5e',
              background: (financialSummary.totalAdvancesVal > 0) ? 'rgba(244, 63, 94, 0.08)' : 'rgba(255, 255, 255, 0.02)',
              cursor: 'pointer'
            }}
            title="Clique para ver o extrato detalhado dos seus vales e adiantamentos salariais"
          >
            <div className="cs-card-header">
              <span className="cs-card-lbl">
                Vales &amp; Adiantamentos
                {financialSummary.advancesCount > 0 && ` (${financialSummary.advancesCount})`}
              </span>
              <Receipt size={18} className="text-rose" />
            </div>
            <strong className={`cs-card-val ${(financialSummary.totalAdvancesVal > 0) ? 'text-rose' : 'text-muted'}`}>
              {(financialSummary.totalAdvancesVal > 0)
                ? `-${formatBRL(financialSummary.totalAdvancesVal)}`
                : 'R$ 0,00'}
            </strong>
            <span className="cs-card-sub" style={{ color: (financialSummary.totalAdvancesVal > 0) ? '#fda4af' : '#94a3b8' }}>
              {(financialSummary.totalAdvancesVal > 0)
                ? 'Deduzido do saldo bruto • Ver comprovantes ↗'
                : 'Nenhum vale no mês • Ver extrato ↗'}
            </span>
          </div>

          {/* Card Total a Receber / Quitado */}
          <div
            className={`cs-summary-card cs-card-total is-clickable ${financialSummary.isPaid ? 'is-paid' : 'is-pending'}`}
            onClick={() => {
              setFinancialTabFilter('all');
              setIsFinancialModalOpen(true);
            }}
            title="Clique para abrir o extrato financeiro completo"
            style={{ cursor: 'pointer' }}
          >
            <div className="cs-card-header">
              <span className="cs-card-lbl">
                {financialSummary.isPaid ? 'Total Quitado' : (financialSummary.totalAdvancesVal > 0 ? 'Total Líquido a Receber' : 'Total Apurado (Pendente)')}
              </span>
              {financialSummary.isPaid ? <CheckCircle2 size={18} className="text-green" /> : <DollarSign size={18} className="text-gold" />}
            </div>
            <strong className={`cs-card-val ${financialSummary.isPaid ? 'text-green' : 'text-gold'}`}>
              {formatBRL(financialSummary.total)}
            </strong>
            <span className="cs-card-sub">
              {financialSummary.isPaid
                ? '✅ Saldo já quitado e zerado'
                : (financialSummary.totalAdvancesVal > 0
                    ? `Bruto: ${formatBRL(financialSummary.grossTotal)} • Vales: -${formatBRL(financialSummary.totalAdvancesVal)}`
                    : '⏳ Previsão de quitação até dia 05')}
            </span>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. ATUAÇÃO FIEL PELAS 12 FUNÇÕES DA EMPRESA                    */}
      {/* ============================================================== */}
      <div className="cs-section-block">
        <div className="cs-section-header-row">
          <div>
            <h3 className="cs-section-heading">
              <Briefcase size={18} className="text-amber" />
              Minhas Atuações por Função na Empresa ({OFFICIAL_COMPANY_ROLES.length} Funções Oficiais)
            </h3>
            <span className="cs-section-header-sub">
              Rastreamento fiel e pontuação das funções cumpridas em missões
            </span>
          </div>

          <button
            type="button"
            className="cs-btn-view-xp-extrato"
            onClick={() => setIsXpModalOpen(true)}
            title="Abrir Extrato Completo de Pontuação de XP"
          >
            <Trophy size={14} className="text-amber" />
            <span>Ver Extrato de XP</span>
          </button>
        </div>

        <div className="cs-roles-grid">
          {OFFICIAL_COMPANY_ROLES.map((roleName) => {
            const count = roleCounts[roleName] || 0;
            const pts = performanceProfile?.rolePoints?.[roleName] || 0;
            const isMainRole = normalizeToOfficialRole(myMember.role) === roleName;
            const isSecRole = Array.isArray(myMember.secondaryRoles) &&
              myMember.secondaryRoles.map(normalizeToOfficialRole).includes(roleName);
            const icon = ROLE_ICONS_MAP[roleName] || '💼';

            return (
              <div
                key={roleName}
                className={`cs-role-item ${count > 0 ? 'has-count' : 'no-count'} ${isMainRole ? 'role-card-main' : isSecRole ? 'role-card-sec' : ''}`}
              >
                <div className="cs-role-item-left">
                  <span className="cs-role-icon">{icon}</span>
                  <div className="cs-role-info">
                    <div className="cs-role-name" title={roleName}>
                      {roleName}
                    </div>
                    <div className={`cs-role-status ${isMainRole ? 'is-main' : isSecRole ? 'is-sec' : count > 0 ? 'is-done' : ''}`}>
                      {isMainRole ? '⭐ Função Principal' : isSecRole ? '🎯 Função Adicional' : count > 0 ? '✅ Exercida em Missões' : 'Ainda não exercida'}
                    </div>
                  </div>
                </div>

                <div className="cs-role-counts-col">
                  <div className={`cs-role-count-badge ${count > 0 ? 'active' : ''}`} title={`${count} missões exercidas`}>
                    {count}x
                  </div>
                  {pts > 0 && (
                    <div className="cs-role-xp-mini-badge" title={`${pts} XP gerados nesta função`}>
                      +{pts} XP
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ============================================================== */}
      {/* 4. DISPONIBILIDADE DO COLABORADOR PARA HORAS EXTRAS            */}
      {/* ============================================================== */}
      <div className="cs-section-block cs-availability-block">
        <div className="cs-section-header-row">
          <h3 className="cs-section-heading">
            <Shield size={18} className="text-amber" />
            Minha Disponibilidade para Horas Extras &amp; Fora do Expediente
          </h3>
          <span className="cs-section-header-sub">
            Sinalize aos administradores se você estará disponível para escalas fora do horário comercial
          </span>
        </div>

        {!isEditingAvail ? (
          // VISUALIZAÇÃO ATUAL DO STATUS DE DISPONIBILIDADE
          <div className={`cs-avail-status-card ${isUnavailableNow ? 'is-blocked' : 'is-ready'}`}>
            <div className="cs-avail-status-left">
              <div className={`cs-avail-icon-circle ${isUnavailableNow ? 'icon-blocked' : 'icon-ready'}`}>
                {isUnavailableNow ? <Ban size={22} strokeWidth={2.5} /> : <CheckCircle2 size={22} strokeWidth={2.5} />}
              </div>
              <div className="cs-avail-status-info">
                <div className="cs-avail-status-tag-row">
                  <span className={`cs-avail-status-pill ${isUnavailableNow ? 'pill-blocked' : 'pill-ready'}`}>
                    <span className={`cs-avail-status-dot ${isUnavailableNow ? 'dot-blocked' : 'dot-ready'}`} />
                    {isUnavailableNow ? 'INDISPONÍVEL PARA HORAS EXTRAS' : 'DISPONÍVEL PARA HORAS EXTRAS'}
                  </span>
                  {isUnavailableNow && (
                    <span className="cs-avail-scope-badge">
                      {curAvail.scope === 'specific_period'
                        ? `📅 Período: ${formatDateBR(curAvail.startDate)} ${curAvail.startTime || '18:00'} às ${formatDateBR(curAvail.endDate || curAvail.startDate)} ${curAvail.endTime || '23:59'}`
                        : '🌙 Todo o período fora do expediente'}
                    </span>
                  )}
                </div>

                <h4 className="cs-avail-headline">
                  {isUnavailableNow
                    ? 'Você informou que não estará disponível para horas extras.'
                    : 'Você está disponível para missões fora do expediente regular.'}
                </h4>

                {isUnavailableNow ? (
                  <div className="cs-avail-blocked-reason-box">
                    <span className="cs-avail-reason-lbl">Motivo Informado:</span>
                    <strong className="cs-avail-reason-val">
                      "{curAvail.reason || curAvail.presetReason || 'Compromisso particular'}"
                    </strong>
                    <span className="cs-avail-hint-text">
                      Os administradores são sinalizados com este aviso na lista de colaboradores ao planejar missões fora do expediente.
                    </span>
                  </div>
                ) : (
                  <p className="cs-avail-desc">
                    Os administradores podem contar com você para escalas noturnas, fins de semana ou horas extras estendidas quando houver necessidade na empresa.
                  </p>
                )}
              </div>
            </div>

            <div className="cs-avail-status-actions">
              {isUnavailableNow ? (
                <>
                  <button
                    type="button"
                    className="cs-btn-avail-toggle ready-btn"
                    onClick={handleMakeAvailable}
                    disabled={isSavingAvail}
                    title="Voltar a ficar disponível para horas extras"
                  >
                    <CheckCircle2 size={16} />
                    <span>Voltar a Ficar Disponível</span>
                  </button>
                  <button
                    type="button"
                    className="cs-btn-avail-edit"
                    onClick={handleStartEditAvailability}
                    title="Alterar período ou motivo da indisponibilidade"
                  >
                    <Edit2 size={14} />
                    <span>Alterar Período / Motivo</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="cs-btn-avail-toggle block-btn"
                  onClick={handleStartEditAvailability}
                  title="Declarar que não poderá fazer horas extras"
                >
                  <Ban size={16} />
                  <span>Declarar Indisponibilidade</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          // FORMULÁRIO INTERATIVO DE DECLARAÇÃO DE INDISPONIBILIDADE
          <div className="cs-avail-edit-card">
            <div className="cs-avail-edit-header">
              <div className="cs-avail-edit-title-group">
                <CalendarOff size={20} className="text-amber" />
                <div>
                  <h4 className="cs-avail-edit-title">Informar Indisponibilidade para Horas Extras</h4>
                  <p className="cs-avail-edit-subtitle">
                    Defina o período e o motivo para que a gestão não conte com você em escalas fora do expediente.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="cs-btn-close-edit"
                onClick={() => setIsEditingAvail(false)}
                title="Fechar formulário"
              >
                <X size={16} />
              </button>
            </div>

            <div className="cs-avail-edit-form">
              {/* 1. Escolha da Abrangência */}
              <div className="cs-avail-form-group">
                <label className="cs-avail-form-label">
                  1. Qual é o período em que você NÃO estará disponível?
                </label>
                <div className="cs-avail-scope-choices">
                  <button
                    type="button"
                    className={`cs-avail-scope-choice-btn ${availScope === 'always_offhours' ? 'active' : ''}`}
                    onClick={() => setAvailScope('always_offhours')}
                  >
                    <div className="cs-scope-choice-header">
                      <span className="cs-scope-icon">🌙</span>
                      <strong>Todo o Período Fora do Expediente</strong>
                    </div>
                    <span className="cs-scope-choice-desc">
                      Seg a Sex após 18h / antes das 8h, Sábados após 12h e Domingos inteiros.
                    </span>
                  </button>

                  <button
                    type="button"
                    className={`cs-avail-scope-choice-btn ${availScope === 'specific_period' ? 'active' : ''}`}
                    onClick={() => setAvailScope('specific_period')}
                  >
                    <div className="cs-scope-choice-header">
                      <span className="cs-scope-icon">⏱️</span>
                      <strong>Em Data e Horário Específico</strong>
                    </div>
                    <span className="cs-scope-choice-desc">
                      Apenas em um momento determinado (ex: hoje à noite, fim de semana ou dia específico).
                    </span>
                  </button>
                </div>
              </div>

              {/* Se for período específico: seletores de data e hora */}
              {availScope === 'specific_period' && (
                <div className="cs-avail-period-grid">
                  <div className="cs-avail-datetime-field">
                    <label className="cs-avail-mini-lbl">Data de Início:</label>
                    <input
                      type="date"
                      value={availStartDate}
                      onChange={(e) => setAvailStartDate(e.target.value)}
                      className="cs-avail-input"
                    />
                  </div>

                  <div className="cs-avail-datetime-field">
                    <label className="cs-avail-mini-lbl">A partir das (Hora):</label>
                    <input
                      type="time"
                      value={availStartTime}
                      onChange={(e) => setAvailStartTime(e.target.value)}
                      className="cs-avail-input"
                    />
                  </div>

                  <div className="cs-avail-datetime-field">
                    <label className="cs-avail-mini-lbl">Data de Término:</label>
                    <input
                      type="date"
                      value={availEndDate}
                      onChange={(e) => setAvailEndDate(e.target.value)}
                      className="cs-avail-input"
                    />
                  </div>

                  <div className="cs-avail-datetime-field">
                    <label className="cs-avail-mini-lbl">Até às (Hora):</label>
                    <input
                      type="time"
                      value={availEndTime}
                      onChange={(e) => setAvailEndTime(e.target.value)}
                      className="cs-avail-input"
                    />
                  </div>
                </div>
              )}

              {/* 2. Motivo da Indisponibilidade */}
              <div className="cs-avail-form-group">
                <label className="cs-avail-form-label">
                  2. Motivo da Indisponibilidade (Selecione uma opção rápida ou personalize):
                </label>
                <div className="cs-avail-preset-chips">
                  {PRESET_REASONS.map((preset) => {
                    const isSel = availPresetReason === preset.label;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        className={`cs-avail-preset-btn ${isSel ? 'selected' : ''}`}
                        onClick={() => {
                          setAvailPresetReason(preset.label);
                          if (preset.defaultText && !availCustomReason.trim()) {
                            setAvailCustomReason(preset.defaultText);
                          }
                        }}
                      >
                        <span>{preset.icon}</span>
                        <span>{preset.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="cs-avail-textarea-wrap">
                  <textarea
                    rows={2}
                    value={availCustomReason}
                    onChange={(e) => setAvailCustomReason(e.target.value)}
                    placeholder="Descreva o motivo ou detalhe seu compromisso para os administradores (ex: Prova da faculdade das 19h às 22h, compromisso familiar, etc.)..."
                    className="cs-avail-textarea"
                  />
                </div>
              </div>

              {/* Botões do Formulário */}
              <div className="cs-avail-form-actions">
                <button
                  type="button"
                  className="cs-btn-cancel-edit"
                  onClick={() => setIsEditingAvail(false)}
                  disabled={isSavingAvail}
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  className="cs-btn-submit-avail"
                  onClick={handleSaveUnavailable}
                  disabled={isSavingAvail}
                >
                  <Ban size={15} />
                  <span>{isSavingAvail ? 'Gravando...' : 'Confirmar Indisponibilidade'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* 5. MISSÕES ATIVAS COM SOLICITAÇÃO DE HORAS EXTRAS OU PRORROGAÇÃO */}
      {/* ============================================================== */}
      <div className="cs-section-block">
        {/* Banner de Urgência em Destaque no Topo quando uma missão estiver na reta final */}
        {urgentMissionNow && (() => {
          const uProg = getMissionLiveProgress(urgentMissionNow);
          const isOffHours = uProg.isUrgentOffHours;
          return (
            <div className={`cs-urgent-banner ${isOffHours ? 'banner-offhours' : 'banner-inhours'}`}>
              <div className="cs-urgent-banner-left">
                <div className={`cs-urgent-icon-pulse ${isOffHours ? 'pulse-offhours' : 'pulse-inhours'}`}>
                  {isOffHours ? <AlertTriangle size={22} /> : <Clock size={22} />}
                </div>
                <div>
                  <h4 className="cs-urgent-title">
                    {isOffHours
                      ? `🚨 Reta Final de Horas Extras: ${urgentMissionNow.description}`
                      : `⏱️ Reta Final da Pauta em Campo: ${urgentMissionNow.description}`
                    }
                  </h4>
                  <p className="cs-urgent-desc">
                    {isOffHours
                      ? `O horário previsto desta missão está nos minutos finais (${uProg.remainingMinutes > 0 ? `restam ${uProg.remainingMinutes} min até às ${uProg.effectiveEndTimeStr}` : `horário limite ${uProg.effectiveEndTimeStr} atingido`}). Por estar fora do expediente regular, caso precise de mais tempo solicite horas extras agora para o administrador.`
                      : `O horário previsto de retorno da equipe está nos minutos finais (${uProg.remainingMinutes > 0 ? `restam ${uProg.remainingMinutes} min até às ${uProg.effectiveEndTimeStr}` : `horário previsto ${uProg.effectiveEndTimeStr} atingido`}). Esta missão ocorre dentro do expediente comercial. Se precisar estender o tempo de gravação, confirme a prorrogação de retorno.`
                    }
                  </p>
                </div>
              </div>
              <button
                type="button"
                className={`cs-urgent-banner-btn ${isOffHours ? 'btn-urgent-offhours' : 'btn-urgent-inhours'}`}
                onClick={() => setRequestModalMission(urgentMissionNow)}
              >
                {isOffHours ? (
                  <>
                    <Zap size={16} />
                    <span>Pedir Horas Extras Agora</span>
                  </>
                ) : (
                  <>
                    <Clock size={16} />
                    <span>Prorrogar Retorno de Pauta</span>
                  </>
                )}
              </button>
            </div>
          );
        })()}

        <h3 className="cs-section-heading">
          <Sparkles size={18} className="text-amber" />
          Minhas Missões &amp; Prorrogações de Horário
        </h3>

        {sortedMyMissions.length === 0 ? (
          <div className="cs-empty-notice">
            <Calendar size={28} className="cs-empty-icon" />
            <span>Você ainda não possui missões registradas nesta base.</span>
          </div>
        ) : (
          <>
            <div className="cs-missions-list">
              {displayedMissions.map((m) => {
                const isMDay = Boolean(m.isMultiDay || (m.endDate && m.endDate !== m.date));
                const memberMode = (m.memberRemunerationTypes && m.memberRemunerationTypes[myMember.id])
                  || m.remunerationType
                  || (isMDay ? 'daily' : 'off_hours');
                const requests = Array.isArray(m.extraHoursRequests) ? m.extraHoursRequests : [];
                const myRequests = requests.filter((r) => String(r.memberId) === String(myMember.id));
                const mStatus = String(m.missionStatus || 'Agendada').trim().toLowerCase();
                const isClosed = (
                  mStatus === 'finalizada' ||
                  mStatus === 'finalizado' ||
                  mStatus === 'concluída' ||
                  mStatus === 'concluida' ||
                  mStatus === 'concluída (homologada)' ||
                  mStatus === 'concluida (homologada)' ||
                  mStatus === 'pendente' ||
                  mStatus === 'pendente (pós-prod.)' ||
                  mStatus === 'cancelada' ||
                  mStatus === 'cancelado' ||
                  Boolean(m.date && (m.endDate || m.date) < new Date().toISOString().slice(0, 10) && mStatus !== 'em execução' && mStatus !== 'em andamento')
                );
                const progress = getMissionLiveProgress(m);

                return (
                  <div
                    key={m.id}
                    className={`cs-mission-card ${progress.isUrgentOffHours ? 'card-urgent-final-hours' : progress.isUrgentInHours ? 'card-urgent-inhours' : progress.isHappeningNow ? 'card-happening-now' : ''}`}
                  >
                    {/* Faixa Superior de Destaque em Tempo Real */}
                    {progress.isUrgentOffHours ? (
                      <div className="cs-urgent-top-badge badge-offhours">
                        <AlertTriangle size={14} className="icon-pulse-urgent" />
                        <span>
                          🚨 RETA FINAL DO HORÁRIO • {progress.remainingMinutes > 0 ? `Restam apenas ${progress.remainingMinutes} min (Até ${progress.effectiveEndTimeStr})` : `Horário limite atingido (${progress.effectiveEndTimeStr})!`}
                        </span>
                      </div>
                    ) : progress.isUrgentInHours ? (
                      <div className="cs-urgent-top-badge badge-inhours">
                        <Clock size={14} className="icon-pulse-inhours" />
                        <span>
                          ⏱️ RETA FINAL DA PAUTA • {progress.remainingMinutes > 0 ? `Restam apenas ${progress.remainingMinutes} min (Até ${progress.effectiveEndTimeStr})` : `Horário previsto atingido (${progress.effectiveEndTimeStr})`}
                        </span>
                      </div>
                    ) : progress.isHappeningNow ? (
                      <div className="cs-live-top-badge">
                        <span className="cs-live-dot" />
                        <span>🟢 Acontecendo Agora (Em Campo) • Retorno previsto às {progress.effectiveEndTimeStr}</span>
                      </div>
                    ) : null}

                    <div className="cs-mission-card-content">
                      <div className="cs-mission-card-left">
                        <div className="cs-mission-meta-row">
                          <span className="cs-mission-code">{m.code || `#${m.id}`}</span>
                          <span className="cs-mission-date">
                            📅 {formatDateBR(m.date)} {isMDay && m.endDate ? ` a ${formatDateBR(m.endDate)}` : ''}
                          </span>
                          {memberMode === 'custom' ? (
                            <span className="cs-badge-custom" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700 }}>
                              🎯 Personalizada
                            </span>
                          ) : isMDay ? (
                            <span className="cs-badge-mday">
                              🏕️ Viagem (+1d)
                            </span>
                          ) : memberMode === 'daily' ? (
                            <span className="cs-badge-mday" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                              📅 Diária
                            </span>
                          ) : (
                            <span className={`cs-badge-hours ${progress.isUrgentOffHours ? 'badge-hours-urgent' : progress.isUrgentInHours ? 'badge-hours-inhours' : ''}`}>
                              🕒 {m.departureTime || '--:--'} às {progress.effectiveEndTimeStr || m.returnTimeEstimated || '--:--'}
                              {progress.approvedExtraHours > 0 && ` (+${progress.approvedExtraHours}h extras)`}
                            </span>
                          )}
                          <span className={`cs-badge-status ${isClosed ? 'closed' : progress.isUrgentOffHours ? 'urgent' : progress.isUrgentInHours ? 'inhours-urgent' : progress.isHappeningNow ? 'live' : 'open'}`}>
                            {progress.isUrgentOffHours ? '🚨 Reta Final (H.E.)' : progress.isUrgentInHours ? '⏱️ Reta Final da Pauta' : progress.isHappeningNow ? '🟢 Em Campo' : (m.missionStatus || 'Agendada')}
                          </span>
                        </div>

                        <strong className="cs-mission-title">
                          {m.description}
                        </strong>
                        <span className="cs-mission-loc">📍 {m.locationName}</span>

                        {/* Bloco Operacional de Pós-Produção para o Editor Responsável */}
                        {(() => {
                          const deliverySummary = getMissionEditionDeliverySummary(m, members);
                          if (!deliverySummary.hasPostProduction) return null;

                          const myMemIdStr = myMember ? String(myMember.id) : '';
                          const myMemNameNorm = myMember?.name ? myMember.name.trim().toLowerCase() : '';
                          const isMyEdition = deliverySummary.assignedEditors.some(
                            (ed) => String(ed.id) === myMemIdStr || ed.name?.toLowerCase().includes(myMemNameNorm)
                          );
                          if (!isMyEdition) return null;

                          const matchedEditorObj = deliverySummary.assignedEditors.find(
                            (ed) => String(ed.id) === myMemIdStr || ed.name?.toLowerCase().includes(myMemNameNorm)
                          );
                          const edKey = matchedEditorObj ? String(matchedEditorObj.id) : myMemIdStr;
                          const myDeliv = deliverySummary.deliveryMap[edKey];
                          const isMyPartDone = myDeliv && myDeliv.status === 'delivered';
                          const isMissionApprovedOrDone = (
                            mStatus === 'finalizada' ||
                            mStatus === 'finalizado' ||
                            mStatus === 'concluída' ||
                            mStatus === 'concluida' ||
                            m.post_production_status === 'approved' ||
                            m.editionStatus === 'Aprovado'
                          );

                          return (
                            <div className="cs-pp-edition-block" style={{ marginTop: '10px', padding: '10px 12px', background: 'rgba(56, 189, 248, 0.06)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <Film size={15} style={{ color: '#38bdf8' }} />
                                  <strong style={{ fontSize: '0.84rem', color: '#f8fafc' }}>
                                    Sua Atuação nesta Pauta: Pós-Produção & Edição
                                  </strong>
                                </div>
                                <span style={{ fontSize: '0.74rem', padding: '2px 8px', borderRadius: '4px', background: isMyPartDone ? 'rgba(16, 185, 129, 0.18)' : 'rgba(245, 158, 11, 0.18)', color: isMyPartDone ? '#34d399' : '#fbbf24', border: `1px solid ${isMyPartDone ? 'rgba(16, 185, 129, 0.35)' : 'rgba(245, 158, 11, 0.35)'}`, fontWeight: 700 }}>
                                  {isMyPartDone ? '✅ Sua Parte Entregue' : '⏳ Sua Parte Pendente'}
                                </span>
                              </div>

                              {deliverySummary.hasMultipleEditors && (
                                <div style={{ marginTop: '6px', fontSize: '0.76rem', color: '#94a3b8' }}>
                                  👥 Status da Equipe: <strong>{deliverySummary.summaryBadgeText}</strong>
                                </div>
                              )}

                              {isMyPartDone ? (
                                <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  {myDeliv?.deliveredAt && (
                                    <div style={{ fontSize: '0.75rem', color: '#6ee7b7', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                                      <Clock size={12} />
                                      <span>Entregue em: <strong>{formatDeliveryDateTimeBR(myDeliv.deliveredAt)}</strong></span>
                                    </div>
                                  )}
                                  <small style={{ color: '#34d399', fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <CheckCircle2 size={13} />
                                    <span>
                                      {isMissionApprovedOrDone
                                        ? '🏆 Pós-produção finalizada e aprovada pela Diretoria.'
                                        : deliverySummary.isFullyDelivered
                                          ? '🎉 Todos os editores entregaram! A pauta está na fila de aprovação da Diretoria.'
                                          : '✅ Sua parte foi entregue com sucesso! Aguardando a conclusão dos demais editores.'}
                                    </span>
                                  </small>
                                </div>
                              ) : isMissionApprovedOrDone ? (
                                <div style={{ marginTop: '6px' }}>
                                  <small style={{ color: '#94a3b8', fontSize: '0.76rem' }}>
                                    Missão finalizada pela gestão.
                                  </small>
                                </div>
                              ) : (
                                <div style={{ marginTop: '8px' }}>
                                  <button
                                    type="button"
                                    onClick={() => setConcludeModal({ isOpen: true, mission: m })}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: '1px solid rgba(16, 185, 129, 0.5)', borderRadius: '8px', color: '#ffffff', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)' }}
                                  >
                                    <CheckCircle2 size={14} />
                                    <span>Entregar Minha Parte da Edição</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Histórico de solicitações de horas extras nesta missão */}
                        {myRequests.length > 0 && (
                          <div className="cs-requests-chips">
                            {myRequests.map((req, rIdx) => {
                              const isPending = req.status === 'PENDING';
                              const isApproved = req.status === 'APPROVED';
                              return (
                                <span
                                  key={rIdx}
                                  className={`cs-req-chip ${isPending ? 'pending' : isApproved ? 'approved' : 'rejected'}`}
                                >
                                  {isPending ? <Clock size={11} /> : isApproved ? <Check size={11} /> : <XCircle size={11} />}
                                  +{req.hoursRequested}h {isPending ? 'Aguardando Aprovação' : isApproved ? 'Aprovada' : 'Recusada'}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Ação: Solicitar Horas Extras ou Prorrogar Retorno
                        Regra Oficial: Exclusivo para equipe em campo e SOMENTE quando a missão estiver acontecendo
                        e prestes a finalizar (15 min antes de finalizar).
                        Missões que já aconteceram ou que ainda irão acontecer NÃO exibem este botão.
                    */}
                      {!isClosed && progress.isUrgentEnd && isMemberEligibleForExtraHours(myMember, m) && (
                        <button
                          type="button"
                          onClick={() => setRequestModalMission(m)}
                          className={`cs-btn-request-extra ${progress.isUrgentOffHours ? 'btn-urgent-extra' : 'btn-inhours-extend'}`}
                        >
                          {progress.isUrgentOffHours ? (
                            <>
                              <Zap size={14} />
                              <span>⚡ Solicitar Hora Extra (+1h, +2h)</span>
                            </>
                          ) : (
                            <>
                              <Clock size={14} />
                              <span>⏱️ Prorrogar Horário de Retorno</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Paginação: Mostrar mais de 10 em 10 missões já concluídas */}
            {concludedMissions.length > 0 && (
              <div className="cs-show-more-missions-wrap">
                {displayedConcluded.length < concludedMissions.length ? (
                  <button
                    type="button"
                    className="cs-btn-show-more-missions"
                    onClick={() => setAdditionalConcluded((prev) => prev + 10)}
                  >
                    <ChevronDown size={16} />
                    <span>Mostrar mais (+10 missões concluídas)</span>
                    <span className="cs-show-more-count-pill">
                      Exibindo {displayedConcluded.length} de {concludedMissions.length} concluídas
                    </span>
                  </button>
                ) : (
                  <div className="cs-all-missions-shown-badge">
                    <CheckCircle2 size={14} className="text-emerald" />
                    <span>Todas as {concludedMissions.length} missões concluídas estão visíveis</span>
                  </div>
                )}

                {additionalConcluded > 0 && (
                  <button
                    type="button"
                    className="cs-btn-collapse-missions"
                    onClick={() => setAdditionalConcluded(0)}
                    title="Recolher lista para as 5 missões iniciais"
                  >
                    <ChevronUp size={14} />
                    <span>Recolher para 5 missões</span>
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ============================================================== */}
      {/* 5. MODAL DINÂMICO: PRORROGAÇÃO DE PAUTA OU HORAS EXTRAS         */}
      {/* ============================================================== */}
      {requestModalMission && (() => {
        const isFullInHours = modalExtEval?.isFullInHours ?? true;
        const newEndTime = modalExtEval?.newEndTimeStr || '--:--';
        const currentEndTime = requestModalMission.returnTimeEstimated || requestModalMission.arrivalTimeEstimated || '--:--';

        return (
          <div className="modal-overlay cs-modal-overlay" onClick={() => setRequestModalMission(null)}>
            <div className={`modal-box cs-extra-hours-modal ${isFullInHours ? 'modal-theme-inhours' : 'modal-theme-offhours'}`} onClick={(e) => e.stopPropagation()}>
              {/* Header Moderno com Badge e Fechar */}
              <div className="cs-modal-header">
                <div className="cs-modal-header-info">
                  <div className={`cs-modal-icon-badge ${isFullInHours ? 'badge-icon-inhours' : 'badge-icon-offhours'}`}>
                    {isFullInHours ? <Clock size={20} /> : <Zap size={20} />}
                  </div>
                  <div>
                    <h3 className="cs-modal-title">
                      {isFullInHours ? 'Prorrogar Retorno de Pauta' : 'Solicitar Horas Extras de Campo'}
                    </h3>
                    <div className="cs-modal-sub-row">
                      <span className="cs-modal-sub-code">#{requestModalMission.code}</span>
                      <span className="cs-modal-sub-desc" title={requestModalMission.description}>
                        {requestModalMission.description}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="cs-modal-close-btn"
                  onClick={() => setRequestModalMission(null)}
                  title="Fechar janela"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmitExtraHoursRequest} className="cs-modal-form">
                {/* Box Informativo Inteligente */}
                <div className={`cs-modal-hint-box ${isFullInHours ? 'hint-inhours' : 'hint-offhours'}`}>
                  <div className="cs-modal-hint-header">
                    <span className={`cs-modal-scope-tag ${isFullInHours ? 'scope-inhours' : 'scope-offhours'}`}>
                      {isFullInHours ? '🌿 Expediente Comercial Regular (Sem Hora Extra)' : '⚡ Fora do Expediente • Gera Hora Extra (R$ 50/h)'}
                    </span>
                    <span className="cs-modal-time-preview">
                      Retorno: <strong>{currentEndTime}</strong> ➔ <strong className="new-time-highlight">{newEndTime}</strong>
                    </span>
                  </div>
                  <p className="cs-modal-hint-text">
                    {isFullInHours
                      ? `Esta prorrogação estende a gravação dentro do horário comercial regular (até 18:00). A previsão de retorno da viatura e da equipe para a base será atualizada para as ${newEndTime}, mantendo a escala do dia sincronizada.`
                      : `Esta prorrogação ultrapassa o expediente regular (18:00) e estende o término até às ${newEndTime}. A solicitação será enviada para aprovação do administrador e computada na folha do colaborador.`
                    }
                  </p>
                </div>

                {/* Seletor de Horas em Grade Moderna */}
                <div className="cs-modal-group">
                  <label className="cs-modal-label">
                    <Clock size={13} className={isFullInHours ? 'text-cyan' : 'text-amber'} />
                    <span>
                      {isFullInHours ? 'Tempo Adicional em Campo:' : 'Quantidade de Horas Extras Adicionais:'}
                    </span>
                  </label>
                  <div className="cs-hours-btn-grid">
                    {[0.5, 1.0, 1.5, 2.0, 3.0, 4.0].map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setRequestedHours(h)}
                        className={`cs-hour-choice-btn ${requestedHours === h ? (isFullInHours ? 'active-inhours' : 'active-offhours') : ''}`}
                      >
                        <span className="cs-h-plus">+</span>
                        <span className="cs-h-val">{h === 0.5 ? '30' : h}</span>
                        <span className="cs-h-unit">{h === 0.5 ? 'min' : 'h'}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Justificativa / Motivo */}
                <div className="cs-modal-group">
                  <label className="cs-modal-label">
                    <span>
                      {isFullInHours ? 'Motivo da Prorrogação de Retorno:' : 'Motivo / Justificativa da Hora Extra:'}
                    </span>
                    <span className="cs-modal-req">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder={isFullInHours
                      ? "Ex: Pauta estendida a pedido do cliente; gravação de depoimentos adicionais..."
                      : "Ex: Gravação noturna estendida; pauta ultrapassou o horário regular..."
                    }
                    value={requestReason}
                    onChange={(e) => setRequestReason(e.target.value)}
                    className="cs-modal-textarea"
                  />
                </div>

                {/* Botões de Ação Simétricos e Elegantes */}
                <div className="cs-modal-actions-row">
                  <button
                    type="button"
                    className="cs-modal-btn cs-modal-btn-cancel"
                    onClick={() => setRequestModalMission(null)}
                    disabled={isSubmittingRequest}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className={`cs-modal-btn ${isFullInHours ? 'cs-modal-btn-inhours' : 'cs-modal-btn-submit'}`}
                    disabled={isSubmittingRequest || !requestReason.trim()}
                  >
                    {isFullInHours ? <CheckCircle2 size={15} /> : <Send size={15} />}
                    <span>
                      {isSubmittingRequest
                        ? 'Processando...'
                        : isFullInHours
                          ? `Confirmar Prorrogação (até ${newEndTime})`
                          : `Enviar Solicitação (+${requestedHours}h)`
                      }
                    </span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Modal de Conclusão de Pós-Produção */}
      <ConcludePostProductionModal
        isOpen={Boolean(concludeModal.isOpen)}
        onClose={() => setConcludeModal({ isOpen: false, mission: null })}
        mission={concludeModal.mission}
        missions={missions}
        members={members}
        currentUser={currentUser}
        onConfirmConclude={handleConfirmConcludeEditorPart}
      />

      {/* ============================================================== */}
      {/* MODAL DETALHADO DE EXTRATO DE XP & CONQUISTAS                 */}
      {/* ============================================================== */}
      {isXpModalOpen && performanceProfile && (
        <div className="cs-modal-backdrop" onClick={() => setIsXpModalOpen(false)}>
          <div className="cs-xp-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="cs-xp-modal-header">
              <div className="cs-xp-modal-header-left">
                <div
                  className="cs-xp-modal-icon-badge"
                  style={{
                    borderColor: userLevel.color || '#f59e0b',
                    color: userLevel.color || '#f59e0b',
                  }}
                >
                  <Trophy size={22} />
                </div>
                <div>
                  <div className="cs-xp-modal-tag-row">
                    <span
                      className="cs-xp-modal-tag"
                      style={{
                        borderColor: userLevel.color || '#f59e0b',
                        color: userLevel.color || '#f59e0b',
                      }}
                    >
                      Nível {userLevel.level} • {userLevel.title}
                    </span>
                    <span className="cs-xp-modal-subtag">Gamificação &amp; Carreira</span>
                  </div>
                  <h3 className="cs-xp-modal-title">Extrato de Pontuação de XP &amp; Funções</h3>
                </div>
              </div>

              <button
                type="button"
                className="cs-xp-modal-close"
                onClick={() => setIsXpModalOpen(false)}
                title="Fechar Extrato"
              >
                <X size={20} />
              </button>
            </div>

            <div className="cs-xp-modal-body">
              {/* Card Hero do Modal: Patente Atual & Progresso */}
              <div className="cs-xp-modal-hero-card">
                <div className="cs-xp-modal-hero-top">
                  <div className="cs-xp-modal-score-big">
                    <span className="cs-xp-modal-score-num">{userLevel.score}</span>
                    <span className="cs-xp-modal-score-lbl">XP TOTAL ACUMULADO</span>
                  </div>

                  <div className="cs-xp-modal-tier-badge-box">
                    <span className="cs-xp-modal-tier-name" style={{ color: userLevel.color || '#f59e0b' }}>
                      {userLevel.title}
                    </span>
                    <p className="cs-xp-modal-tier-phrase">
                      {userLevel.level >= 10
                        ? 'Parabéns! Você alcançou o nível lendário de consagração e excelência máxima na MegaFilmes (Hall da Fama).'
                        : `Você já conquistou ${userLevel.currentLevelXP} XP nesta patente. Faltam ${userLevel.remainingForNext} XP para o próximo nível.`}
                    </p>
                  </div>
                </div>

                <div className="cs-xp-modal-bar-wrap">
                  <div className="cs-xp-progress-bar-bg large">
                    <div
                      className="cs-xp-progress-fill"
                      style={{
                        width: `${userLevel.progressPercent}%`,
                        background: `linear-gradient(90deg, #06b6d4 0%, ${userLevel.color || '#f59e0b'} 100%)`,
                      }}
                    />
                  </div>
                  <div className="cs-xp-progress-meta">
                    <span>{userLevel.progressPercent}% no Nível {userLevel.level} • {userLevel.overallPercent}% do Hall da Fama (10.000 XP)</span>
                    <span>
                      {userLevel.level >= 10
                        ? '🌟 Nível Máximo (Hall da Fama)'
                        : `${userLevel.score} / ${userLevel.score + userLevel.remainingForNext} XP`}
                    </span>
                  </div>
                </div>

                {/* Box Explicativo Didático da Patente Atual */}
                <div className="cs-xp-current-tier-explainer">
                  <div className="cs-xp-current-tier-explainer-top">
                    <span className="cs-xp-current-tier-icon">{userLevel.icon || '🎖️'}</span>
                    <div className="cs-xp-current-tier-info">
                      <div className="cs-xp-current-tier-tags">
                        <strong className="cs-xp-current-tier-name" style={{ color: userLevel.color || '#f59e0b' }}>
                          Nível {userLevel.level} • {userLevel.title}
                        </strong>
                        <span className="cs-xp-current-tier-badge">{userLevel.badgeLabel}</span>
                      </div>
                      <span className="cs-xp-current-tier-skills-summary">
                        <strong>Competências em destaque:</strong> {userLevel.currentTier?.skillsDemonstrated}
                      </span>
                    </div>
                  </div>
                  <p className="cs-xp-current-tier-text">
                    {userLevel.description}
                  </p>
                </div>
              </div>

              {/* Grid de KPIs de Fontes de XP */}
              <div className="cs-xp-kpi-grid">
                <div className="cs-xp-kpi-card">
                  <div className="cs-xp-kpi-header">
                    <span className="cs-xp-kpi-title">Funções Oficiais</span>
                    <Briefcase size={16} className="text-amber" />
                  </div>
                  <strong className="cs-xp-kpi-value text-amber">
                    +{performanceProfile.rolesTotalXP} XP
                  </strong>
                  <span className="cs-xp-kpi-desc">
                    Pontos pelas 12 especialidades exercidas
                  </span>
                </div>

                <div className="cs-xp-kpi-card">
                  <div className="cs-xp-kpi-header">
                    <span className="cs-xp-kpi-title">Presença &amp; Êxito</span>
                    <CheckCircle2 size={16} className="text-emerald" />
                  </div>
                  <strong className="cs-xp-kpi-value text-emerald">
                    +{performanceProfile.missionBaseXP + performanceProfile.completedBonusXP} XP
                  </strong>
                  <span className="cs-xp-kpi-desc">
                    {performanceProfile.totalMissions} missões finalizadas com sucesso
                  </span>
                </div>

                <div className="cs-xp-kpi-card">
                  <div className="cs-xp-kpi-header">
                    <span className="cs-xp-kpi-title">Dedicação Extra</span>
                    <Clock size={16} className="text-cyan" />
                  </div>
                  <strong className="cs-xp-kpi-value text-cyan">
                    +{performanceProfile.extraHoursXP} XP
                  </strong>
                  <span className="cs-xp-kpi-desc">
                    {performanceProfile.totalApprovedExtraHours}h extras aprovadas em campo
                  </span>
                </div>

                <div className="cs-xp-kpi-card">
                  <div className="cs-xp-kpi-header">
                    <span className="cs-xp-kpi-title">Condução de Viatura</span>
                    <Car size={16} className="text-blue" />
                  </div>
                  <strong className="cs-xp-kpi-value text-blue">
                    +{performanceProfile.drivingKmXP} XP
                  </strong>
                  <span className="cs-xp-kpi-desc">
                    {performanceProfile.drivingCount}x ao volante ({Math.round(performanceProfile.estimatedDistanceKm)} km)
                  </span>
                </div>
              </div>

              {/* Trilha de Carreira & Níveis Superados */}
              <div className="cs-xp-career-journey-section">
                <div className="cs-xp-section-title-row">
                  <div>
                    <h4 className="cs-xp-modal-heading">
                      <Trophy size={18} className="text-amber" />
                      Sua Jornada de Carreira &amp; Níveis Superados
                    </h4>
                    <span className="cs-xp-modal-heading-sub">
                      Entenda o que representa cada patente, veja por onde você já passou com êxito e os próximos marcos
                    </span>
                  </div>
                  {userLevel.completedTiers && userLevel.completedTiers.length > 0 && (
                    <span className="cs-xp-journey-counter-badge">
                      <CheckCircle2 size={14} className="text-emerald" />
                      <span>{userLevel.completedTiers.length} de {userLevel.tiers.length} patentes superadas</span>
                    </span>
                  )}
                </div>

                {/* Banner de Celebração de Patentes Superadas */}
                {userLevel.completedTiers && userLevel.completedTiers.length > 0 && (
                  <div className="cs-xp-overcome-banner">
                    <div className="cs-xp-overcome-banner-icon">
                      <Sparkles size={20} />
                    </div>
                    <div className="cs-xp-overcome-banner-body">
                      <strong className="cs-xp-overcome-banner-title">
                        Parabéns pela sua evolução profissional!
                      </strong>
                      <p className="cs-xp-overcome-banner-desc">
                        Você já superou com louvor {userLevel.completedTiers.length === 1 ? 'o nível de' : 'as patentes de'}{' '}
                        <strong>
                          {userLevel.completedTiers.map((t) => `${t.icon} Nível ${t.level} • ${t.title}`).join(' e ')}
                        </strong>
                        . Sua consistência operacional e técnica comprova que você está apto a desafios cada vez maiores na produtora!
                      </p>
                    </div>
                  </div>
                )}

                {/* Grid dos Níveis de Carreira */}
                <div className="cs-xp-career-tiers-list">
                  {userLevel.tiers.map((tier) => {
                    const isCompleted = tier.isCompleted;
                    const isCurrent = tier.isCurrent;
                    const isLocked = tier.isLocked;

                    return (
                      <div
                        key={tier.level}
                        className={`cs-xp-career-card ${isCompleted ? 'is-completed' : ''} ${isCurrent ? 'is-current' : ''} ${isLocked ? 'is-locked' : ''}`}
                        style={{ '--tier-color': tier.color }}
                      >
                        <div className="cs-xp-career-card-top">
                          <div className="cs-xp-career-card-identity">
                            <span className="cs-xp-career-card-icon">{tier.icon}</span>
                            <div>
                              <div className="cs-xp-career-card-meta">
                                <span className="cs-xp-career-card-level" style={{ color: tier.color }}>
                                  NÍVEL {tier.level}
                                </span>
                                <span className="cs-xp-career-card-range">
                                  {tier.level === 10 ? `${tier.min}+ XP` : `${tier.min} a ${tier.max} XP`}
                                </span>
                                <span className="cs-xp-career-card-subtag">{tier.badgeLabel}</span>
                              </div>
                              <strong className="cs-xp-career-card-title" style={{ color: tier.color }}>
                                {tier.title}
                              </strong>
                            </div>
                          </div>

                          <div className="cs-xp-career-card-badge-wrap">
                            {isCompleted && (
                              <span className="cs-career-pill completed">
                                <CheckCircle2 size={13} />
                                <span>Já Superado com Êxito</span>
                              </span>
                            )}
                            {isCurrent && (
                              <span className="cs-career-pill current" style={{ borderColor: tier.color, color: tier.color }}>
                                <Sparkles size={13} />
                                <span>Seu Nível Atual ({userLevel.progressPercent}%)</span>
                              </span>
                            )}
                            {isLocked && (
                              <span className="cs-career-pill locked">
                                <Lock size={12} />
                                <span>Próximo Objetivo</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* O que é o nível / Descrição didática */}
                        <p className="cs-xp-career-card-desc">
                          {tier.description}
                        </p>

                        {/* Bloco contextual do status */}
                        {isCompleted && (
                          <div className="cs-career-status-box completed">
                            <div className="cs-career-status-header">
                              <CheckCircle2 size={14} className="text-emerald" />
                              <strong className="text-emerald">Etapa Concluída &amp; Superada:</strong>
                            </div>
                            <p className="cs-career-status-text">{tier.overcomeMessage}</p>
                            <span className="cs-career-status-skills">
                              <strong>Competências consolidadas:</strong> {tier.skillsDemonstrated}
                            </span>
                          </div>
                        )}

                        {isCurrent && (
                          <div className="cs-career-status-box current">
                            <div className="cs-career-status-header">
                              <Target size={14} style={{ color: tier.color }} />
                              <strong style={{ color: tier.color }}>O que você representa neste patamar:</strong>
                            </div>
                            <span className="cs-career-status-skills">
                              <strong>Habilidades exercidas no dia a dia:</strong> {tier.skillsDemonstrated}
                            </span>
                            <div className="cs-career-status-next-step">
                              {userLevel.remainingForNext > 0 ? (
                                <span>
                                  Você já possui <strong>{userLevel.score} XP</strong>. Faltam <strong>{userLevel.remainingForNext} XP</strong> para alcançar o <strong>Nível {tier.level + 1} ({userLevel.nextTier?.title})</strong>.
                                </span>
                              ) : (
                                <span>Você atingiu a pontuação máxima desta patente!</span>
                              )}
                            </div>
                          </div>
                        )}

                        {isLocked && (
                          <div className="cs-career-status-box locked">
                            <div className="cs-career-status-header">
                              <Lock size={13} />
                              <span>
                                Requer <strong>{tier.min} XP</strong> acumulados (faltam {Math.max(0, tier.min - userLevel.score)} XP).
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Grid Discriminado por Função Oficial */}
              <div className="cs-xp-section-title-row">
                <h4 className="cs-xp-modal-heading">
                  <Target size={18} className="text-amber" />
                  Detalhamento de Pontos pelas 12 Funções Oficiais
                </h4>
                <span className="cs-xp-modal-heading-sub">
                  Cada especialidade técnica possui seu valor de pontuação por missão concluída
                </span>
              </div>

              <div className="cs-xp-roles-detailed-grid">
                {OFFICIAL_COMPANY_ROLES.map((roleName) => {
                  const count = performanceProfile.roleCounts[roleName] || 0;
                  const pts = performanceProfile.rolePoints[roleName] || 0;
                  const isMainRole = normalizeToOfficialRole(myMember.role) === roleName;
                  const isSecRole = Array.isArray(myMember.secondaryRoles) &&
                    myMember.secondaryRoles.map(normalizeToOfficialRole).includes(roleName);
                  const icon = ROLE_ICONS_MAP[roleName] || '💼';
                  const xpRate = ROLE_XP_POINTS[roleName] || 15;

                  return (
                    <div
                      key={roleName}
                      className={`cs-xp-role-card ${pts > 0 ? 'has-points' : ''} ${isMainRole ? 'is-main' : isSecRole ? 'is-sec' : ''}`}
                    >
                      <div className="cs-xp-role-card-top">
                        <span className="cs-xp-role-card-icon">{icon}</span>
                        <div className="cs-xp-role-card-meta">
                          {isMainRole && <span className="cs-role-badge main">Principal</span>}
                          {isSecRole && <span className="cs-role-badge sec">Adicional</span>}
                          <span className="cs-role-rate-badge">{xpRate} XP/missão</span>
                        </div>
                      </div>

                      <div className="cs-xp-role-card-body">
                        <strong className="cs-xp-role-card-name">{roleName}</strong>
                        <span className="cs-xp-role-card-sub">
                          {count > 0 ? `${count} missão(ões) realizada(s)` : 'Ainda não realizada'}
                        </span>
                      </div>

                      <div className="cs-xp-role-card-footer">
                        <span className="cs-xp-role-card-label">Pontuação Total:</span>
                        <strong className={`cs-xp-role-card-score ${pts > 0 ? 'text-amber' : ''}`}>
                          {pts > 0 ? `+${pts} XP` : '0 XP'}
                        </strong>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Galeria Completa de Conquistas & Insígnias */}
              {performanceProfile.allAchievements && performanceProfile.allAchievements.length > 0 && (
                <div className="cs-xp-badges-wrapper">
                  <div className="cs-xp-section-title-row">
                    <div>
                      <h4 className="cs-xp-modal-heading">
                        <Award size={18} className="text-amber" />
                        Galeria de Conquistas &amp; Insígnias ({performanceProfile.unlockedCount} de {performanceProfile.totalAchievementsCount} Desbloqueadas)
                      </h4>
                      <span className="cs-xp-modal-heading-sub">
                        Cumpra pautas operacionais, dirija viaturas e atue com excelência para desbloquear todas as insígnias
                      </span>
                    </div>
                  </div>
                  <div className="cs-xp-badges-grid">
                    {performanceProfile.allAchievements.map((b) => (
                      <div
                        key={b.id}
                        className={`cs-xp-badge-card ${b.isUnlocked ? 'is-unlocked' : 'is-locked'}`}
                        style={{ borderColor: b.isUnlocked ? (b.color || '#f59e0b') : 'rgba(255, 255, 255, 0.08)' }}
                      >
                        <div className="cs-xp-badge-card-top-row">
                          <span className="cs-xp-badge-card-icon">{b.icon || '🏅'}</span>
                          <span
                            className="cs-badge-rarity-pill"
                            style={{
                              borderColor: b.color ? `${b.color}40` : 'rgba(255,255,255,0.1)',
                              color: b.color || '#94a3b8',
                              background: b.color ? `${b.color}15` : 'transparent',
                            }}
                          >
                            {b.rarity} • {b.category}
                          </span>
                        </div>
                        <div className="cs-xp-badge-card-content">
                          <strong className="cs-xp-badge-card-title" style={{ color: b.isUnlocked ? (b.color || '#f59e0b') : '#94a3b8' }}>
                            {b.name}
                          </strong>
                          <p className="cs-xp-badge-card-desc">{b.desc}</p>
                          <div className="cs-badge-progress-wrap">
                            <div className="cs-badge-progress-track">
                              <div
                                className="cs-badge-progress-fill"
                                style={{
                                  width: `${Math.min(100, Math.round(((b.current || 0) / b.target) * 100))}%`,
                                  background: b.isUnlocked ? (b.color || '#10b981') : '#38bdf8',
                                }}
                              />
                            </div>
                            <span className="cs-badge-progress-text">
                              {b.isUnlocked ? '✅ Conquistado' : `Progresso: ${b.current || 0} / ${b.target}`}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="cs-xp-modal-footer">
              <button
                type="button"
                className="cs-btn-print-xp-modal"
                onClick={() => window.print()}
                title="Imprimir Extrato de XP e Pontuações"
              >
                <Printer size={16} />
                <span>Imprimir Extrato</span>
              </button>
              <button
                type="button"
                className="cs-btn-close-xp-modal"
                onClick={() => setIsXpModalOpen(false)}
                title="Fechar janela de extrato"
              >
                <X size={16} />
                <span>Fechar Extrato</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal / Extrato Detalhado de Vales do Colaborador (FIN-05) */}
      {showAdvancesHistoryModal && (
        <div className="advances-modal-overlay" onClick={() => setShowAdvancesHistoryModal(false)}>
          <div className="advances-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 660 }}>
            <div className="advances-modal-header">
              <div>
                <h3 className="advances-modal-title">
                  <Receipt size={18} className="text-rose" />
                  Meus Vales &amp; Adiantamentos Salariais
                </h3>
                <span className="advances-modal-sub">
                  {monthLabel} • Extrato oficial de adiantamentos salariais deduzidos
                </span>
              </div>
              <button
                type="button"
                className="advances-modal-close"
                onClick={() => setShowAdvancesHistoryModal(false)}
                title="Fechar"
              >
                ✕
              </button>
            </div>

            {/* Aviso de Concessão Exclusiva da Administração */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: 8,
              fontSize: '0.8rem',
              color: '#bae6fd'
            }}>
              <ShieldCheck size={18} className="text-cyan" style={{ flexShrink: 0 }} />
              <span>
                <strong>Gestão Centralizada:</strong> Os vales e adiantamentos salariais são liberados e lançados exclusivamente pela Diretoria / Administração Geral. Você pode consultar aqui em tempo real cada comprovante, data e valor deduzido do seu fechamento.
              </span>
            </div>

            <div className="advances-summary-grid">
              <div className="adv-kpi-card kpi-gross">
                <span className="adv-kpi-lbl">Total de Créditos (Bruto)</span>
                <strong className="adv-kpi-val text-amber">{formatBRL(financialSummary.grossTotal)}</strong>
                <span className="adv-kpi-sub">Horas extras + diárias + cachês</span>
              </div>
              <div className="adv-kpi-card kpi-advances">
                <span className="adv-kpi-lbl">Vales Recebidos</span>
                <strong className="adv-kpi-val text-rose">
                  {financialSummary.totalAdvancesVal > 0 ? `-${formatBRL(financialSummary.totalAdvancesVal)}` : 'R$ 0,00'}
                </strong>
                <span className="adv-kpi-sub">{financialSummary.advancesCount} adiantamento(s)</span>
              </div>
              <div className="adv-kpi-card kpi-net">
                <span className="adv-kpi-lbl">Saldo Líquido a Receber</span>
                <strong className="adv-kpi-val text-green">{formatBRL(financialSummary.netTotal)}</strong>
                <span className="adv-kpi-sub">Líquido final via PIX</span>
              </div>
            </div>

            <div className="advances-history-wrap" style={{ marginTop: 18 }}>
              <h4 style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Wallet size={14} className="text-rose" />
                Comprovantes de Vales Concedidos neste Mês
              </h4>

              {financialSummary.advances && financialSummary.advances.length > 0 ? (
                <div className="advances-table-wrap">
                  <table className="advances-table">
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Valor</th>
                        <th>Forma</th>
                        <th>Motivo / Descrição</th>
                        <th>Autorizado Por</th>
                      </tr>
                    </thead>
                    <tbody>
                      {financialSummary.advances.map((adv) => (
                        <tr key={adv.id}>
                          <td>{formatDateBR(adv.date)}</td>
                          <td className="text-rose" style={{ fontWeight: 800 }}>-{formatBRL(adv.amount)}</td>
                          <td><span className="adv-badge-method">{adv.paymentMethod || 'PIX'}</span></td>
                          <td>{adv.reason || 'Adiantamento salarial'}</td>
                          <td>{adv.authorizedBy || 'Gestão'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '24px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px dashed rgba(255,255,255,0.08)' }}>
                  <Receipt size={28} className="text-rose" style={{ opacity: 0.5, marginBottom: 8, display: 'inline-block' }} />
                  <strong style={{ display: 'block', fontSize: '0.9rem', color: '#e2e8f0' }}>Nenhum vale registrado para você em {monthLabel}</strong>
                  <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                    Você receberá o valor integral dos seus créditos e diárias no fechamento mensal sem deduções de adiantamento.
                  </p>
                </div>
              )}
            </div>

            <div className="advances-modal-actions" style={{ marginTop: 22, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setShowAdvancesHistoryModal(false)}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL DETALHADO DE EXTRATO FINANCEIRO (SEMELHANTE A EXTRATO DE XP) */}
      {/* ============================================================== */}
      {isFinancialModalOpen && (
        <div className="cs-modal-backdrop" onClick={() => setIsFinancialModalOpen(false)}>
          <div className="cs-xp-modal-container cs-fin-modal-container" onClick={(e) => e.stopPropagation()}>
            {/* Cabeçalho do Extrato Financeiro */}
            <div className="cs-xp-modal-header">
              <div className="cs-xp-modal-header-left">
                <div
                  className="cs-xp-modal-icon-badge"
                  style={{
                    borderColor: '#10b981',
                    color: '#34d399',
                    background: 'rgba(16, 185, 129, 0.1)',
                  }}
                >
                  <DollarSign size={22} />
                </div>
                <div>
                  <div className="cs-xp-modal-tag-row">
                    <span
                      className="cs-xp-modal-tag"
                      style={{
                        borderColor: '#10b981',
                        color: '#34d399',
                        background: 'rgba(16, 185, 129, 0.15)',
                      }}
                    >
                      {monthLabel}
                    </span>
                    <span className="cs-xp-modal-subtag">Fechamento &amp; Saldo Oficial</span>
                  </div>
                  <h3 className="cs-xp-modal-title">Extrato Financeiro Transparente</h3>
                </div>
              </div>

              <button
                type="button"
                className="cs-xp-modal-close"
                onClick={() => setIsFinancialModalOpen(false)}
                title="Fechar Extrato Financeiro"
              >
                <X size={20} />
              </button>
            </div>

            <div className="cs-xp-modal-body">
              {/* Card Hero do Fechamento Salarial */}
              <div className="cs-xp-modal-hero-card cs-fin-hero-card">
                <div className="cs-xp-modal-hero-top">
                  <div className="cs-xp-modal-score-big">
                    <span className="cs-fin-hero-amount" style={{ color: financialSummary.isPaid ? '#34d399' : '#fbbf24' }}>
                      {formatBRL(financialSummary.total)}
                    </span>
                    <span className="cs-xp-modal-score-lbl">
                      {financialSummary.isPaid
                        ? 'TOTAL SALARIAL QUITADO EM FOLHA'
                        : (financialSummary.totalAdvancesVal > 0 ? 'SALDO LÍQUIDO A RECEBER VIA PIX' : 'TOTAL APURADO (PENDENTE DE QUITAÇÃO)')}
                    </span>
                  </div>

                  <div className="cs-fin-hero-status-box">
                    <div className="cs-fin-status-pill-wrap">
                      {financialSummary.isPaid ? (
                        <span className="cs-fin-status-pill is-paid">
                          <CheckCircle2 size={13} />
                          <span>Quitado em {financialSummary.clearedAt ? formatDateBR(financialSummary.clearedAt) : 'Folha'}</span>
                        </span>
                      ) : (
                        <span className="cs-fin-status-pill is-pending">
                          <Clock size={13} />
                          <span>Previsão: {nextMonthForecast}</span>
                        </span>
                      )}
                    </div>

                    <div className="cs-fin-pix-destination-card">
                      <div className="cs-fin-pix-info">
                        <span className="cs-fin-pix-lbl">Chave PIX Cadastrada:</span>
                        <strong className="cs-fin-pix-val">
                          {myMember.pixKey ? myMember.pixKey : 'Nenhuma chave cadastrada'}
                        </strong>
                      </div>
                      {myMember.pixKey && (
                        <button
                          type="button"
                          className="cs-fin-btn-copy-pix"
                          onClick={handleCopyPix}
                          title="Copiar chave PIX"
                        >
                          {copiedPix ? <Check size={13} className="text-green" /> : <Copy size={13} />}
                          <span>{copiedPix ? 'Copiada!' : 'Copiar'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Barra Visual de Proporção: Total Bruto x Vales x Líquido */}
                <div className="cs-xp-modal-bar-wrap">
                  <div className="cs-fin-ratio-bar">
                    <div
                      className="cs-fin-ratio-fill net"
                      style={{
                        width: `${financialSummary.grossTotal > 0 ? Math.min(100, Math.max(0, (financialSummary.netTotal / financialSummary.grossTotal) * 100)) : 100}%`
                      }}
                      title={`Líquido a Receber: ${formatBRL(financialSummary.netTotal)}`}
                    />
                    {financialSummary.totalAdvancesVal > 0 && (
                      <div
                        className="cs-fin-ratio-fill advance"
                        style={{
                          width: `${Math.min(100, Math.max(0, (financialSummary.totalAdvancesVal / financialSummary.grossTotal) * 100))}%`
                        }}
                        title={`Vales Deduzidos: -${formatBRL(financialSummary.totalAdvancesVal)}`}
                      />
                    )}
                  </div>
                  <div className="cs-xp-progress-meta">
                    <span>
                      Bruto Apurado: <strong>{formatBRL(financialSummary.grossTotal)}</strong>
                      {financialSummary.totalAdvancesVal > 0 && (
                        <> • Vales Deduzidos: <strong className="text-rose">-{formatBRL(financialSummary.totalAdvancesVal)}</strong></>
                      )}
                    </span>
                    <span>
                      Líquido Final: <strong className="text-green">{formatBRL(financialSummary.netTotal)}</strong>
                    </span>
                  </div>
                </div>

                {/* Box Explicativo Didático da Regra de Fechamento */}
                <div className="cs-fin-explainer-box">
                  <ShieldCheck size={18} className="text-cyan" style={{ flexShrink: 0 }} />
                  <p className="cs-fin-explainer-text">
                    <strong>Regra Oficial de Fechamento MegaFilmes:</strong> Horas extras e diárias de campo são computadas automaticamente assim que a missão é finalizada ou a equipe retorna à base. Os adiantamentos salariais (vales) liberados pela Diretoria são deduzidos do saldo bruto em tempo real. O pagamento do saldo líquido é creditado pontualmente até o dia 05 via transferência PIX.
                  </p>
                </div>
              </div>

              {/* Grid de 4 KPIs Financeiros */}
              <div className="cs-xp-kpi-grid">
                <div className="cs-xp-kpi-card" style={{ borderLeft: '3px solid #f59e0b' }}>
                  <div className="cs-xp-kpi-header">
                    <span>Horas Extras ({financialSummary.totalHours}h)</span>
                    <Clock size={16} className="text-amber" />
                  </div>
                  <strong className="cs-xp-kpi-value text-amber">
                    {formatBRL(financialSummary.totalHoursVal)}
                  </strong>
                  <span className="cs-xp-kpi-desc">
                    Taxa contratada: {formatBRL(myMember.hourlyRate || 50)} / hora extra
                  </span>
                </div>

                <div className="cs-xp-kpi-card" style={{ borderLeft: '3px solid #06b6d4' }}>
                  <div className="cs-xp-kpi-header">
                    <span>Diárias de Campo ({financialSummary.totalDays}d)</span>
                    <Compass size={16} className="text-cyan" />
                  </div>
                  <strong className="cs-xp-kpi-value text-cyan">
                    {formatBRL(financialSummary.totalDaysVal)}
                  </strong>
                  <span className="cs-xp-kpi-desc">
                    Taxa diária: {formatBRL(myMember.dailyRate || 200)} / dia
                  </span>
                </div>

                <div className="cs-xp-kpi-card" style={{ borderLeft: '3px solid #a855f7' }}>
                  <div className="cs-xp-kpi-header">
                    <span>Cachês / Personalizadas</span>
                    <Sparkles size={16} className="text-purple" />
                  </div>
                  <strong className="cs-xp-kpi-value text-purple">
                    {formatBRL(financialSummary.totalCustomVal)}
                  </strong>
                  <span className="cs-xp-kpi-desc">
                    {financialSummary.totalCustomCount} missão(ões) com cachê fixo
                  </span>
                </div>

                <div className="cs-xp-kpi-card" style={{ borderLeft: '3px solid #f43f5e' }}>
                  <div className="cs-xp-kpi-header">
                    <span>Vales &amp; Adiantamentos</span>
                    <Receipt size={16} className="text-rose" />
                  </div>
                  <strong className="cs-xp-kpi-value text-rose">
                    {financialSummary.totalAdvancesVal > 0 ? `-${formatBRL(financialSummary.totalAdvancesVal)}` : 'R$ 0,00'}
                  </strong>
                  <span className="cs-xp-kpi-desc">
                    {financialSummary.advancesCount} adiantamento(s) no mês
                  </span>
                </div>
              </div>

              {/* Tabela / Lista Cronológica Analítica de Lançamentos */}
              <div className="cs-fin-entries-section">
                <div className="cs-fin-entries-header">
                  <div>
                    <h4 className="cs-xp-modal-heading">
                      <Receipt size={17} className="text-emerald" />
                      Lançamentos &amp; Memória de Cálculo do Mês
                    </h4>
                    <span className="cs-xp-modal-heading-sub">
                      Rastreamento transparente de cada missão cumprida e adiantamento concedido
                    </span>
                  </div>

                  {/* Tabs de Filtro */}
                  <div className="cs-fin-tabs-group">
                    <button
                      type="button"
                      className={`cs-fin-tab-btn ${financialTabFilter === 'all' ? 'active' : ''}`}
                      onClick={() => setFinancialTabFilter('all')}
                    >
                      Todos ({financialEntries.length})
                    </button>
                    <button
                      type="button"
                      className={`cs-fin-tab-btn ${financialTabFilter === 'credits' ? 'active' : ''}`}
                      onClick={() => setFinancialTabFilter('credits')}
                    >
                      Créditos ({financialEntries.filter(e => e.type === 'credit').length})
                    </button>
                    <button
                      type="button"
                      className={`cs-fin-tab-btn ${financialTabFilter === 'debits' ? 'active' : ''}`}
                      onClick={() => setFinancialTabFilter('debits')}
                    >
                      Vales ({financialEntries.filter(e => e.type === 'debit').length})
                    </button>
                  </div>
                </div>

                {/* Lista de Itens */}
                {filteredFinancialEntries.length > 0 ? (
                  <div className="cs-fin-entries-table-wrap">
                    <table className="cs-fin-entries-table">
                      <thead>
                        <tr>
                          <th>Data</th>
                          <th>Categoria</th>
                          <th>Referência / Pauta</th>
                          <th>Memória de Cálculo</th>
                          <th className="text-right">Valor</th>
                          <th className="text-center">Comprovante</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredFinancialEntries.map((item) => (
                          <tr key={item.id} className={`cs-fin-row ${item.type}`}>
                            <td className="cs-fin-cell-date">
                              <span className="cs-fin-date-badge">
                                <Calendar size={11} />
                                {formatDateBR(item.date)}
                              </span>
                            </td>
                            <td className="cs-fin-cell-cat">
                              <span
                                className="cs-fin-cat-pill"
                                style={{
                                  borderColor: `${item.badgeColor}40`,
                                  background: `${item.badgeColor}15`,
                                  color: item.badgeColor
                                }}
                              >
                                {item.categoryLabel}
                              </span>
                            </td>
                            <td className="cs-fin-cell-ref">
                              <strong className="cs-fin-item-title">{item.title}</strong>
                              <span className="cs-fin-item-code">{item.missionCode}</span>
                            </td>
                            <td className="cs-fin-cell-detail">
                              <span className="cs-fin-calc-detail">{item.detail}</span>
                            </td>
                            <td className="cs-fin-cell-amount text-right">
                              <strong className={`cs-fin-amount ${item.type === 'credit' ? 'text-green' : 'text-rose'}`}>
                                {item.type === 'credit' ? `+${formatBRL(item.amount)}` : `-${formatBRL(item.amount)}`}
                              </strong>
                            </td>
                            <td className="cs-fin-cell-receipt text-center">
                              {item.receiptUrl ? (
                                <button
                                  type="button"
                                  className="cs-fin-btn-receipt adv-btn-view-receipt"
                                  onClick={() => setPreviewReceiptUrl(item.receiptUrl)}
                                  title="Visualizar comprovante de transferência anexado"
                                >
                                  <FileText size={13} />
                                  <span>Ver Anexo</span>
                                </button>
                              ) : (
                                <span className="text-muted" style={{ fontSize: '0.72rem' }}>—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="cs-fin-empty-state">
                    <Receipt size={32} className="text-muted" style={{ opacity: 0.4, marginBottom: 8 }} />
                    <strong>Nenhum lançamento financeiro encontrado para este filtro.</strong>
                    <p>Suas diárias, horas extras e vales do mês aparecerão detalhados aqui.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Rodapé do Modal com Ações */}
            <div className="cs-xp-modal-footer">
              <div className="cs-fin-footer-summary">
                <span>Bruto: <strong className="text-amber">+{formatBRL(financialSummary.grossTotal)}</strong></span>
                <span>•</span>
                <span>Vales: <strong className="text-rose">-{formatBRL(financialSummary.totalAdvancesVal)}</strong></span>
                <span>•</span>
                <span>Líquido: <strong className="text-green">={formatBRL(financialSummary.netTotal)}</strong></span>
              </div>

              <div className="cs-fin-footer-btns">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => window.print()}
                  title="Imprimir extrato financeiro"
                >
                  <Printer size={15} />
                  <span>Imprimir Extrato</span>
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setIsFinancialModalOpen(false)}
                >
                  Concluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Pré-visualização de Comprovante de Pagamento */}
      {previewReceiptUrl && (
        <div className="advances-modal-overlay" onClick={() => setPreviewReceiptUrl(null)} style={{ zIndex: 100010 }}>
          <div className="advances-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 620 }}>
            <div className="advances-modal-header">
              <h3 className="advances-modal-title" style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Receipt size={17} className="text-rose" />
                Comprovante de Transferência do Vale
              </h3>
              <button
                type="button"
                className="advances-modal-close"
                onClick={() => setPreviewReceiptUrl(null)}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: '16px 0', textAlign: 'center' }}>
              <img
                src={previewReceiptUrl}
                alt="Comprovante de Transferência"
                style={{ maxWidth: '100%', maxHeight: '65vh', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
              <a
                href={previewReceiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem' }}
              >
                <ExternalLink size={13} />
                <span>Abrir Original</span>
              </a>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setPreviewReceiptUrl(null)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
