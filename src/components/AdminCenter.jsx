import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  Clock,
  DollarSign,
  Trophy,
  Shield,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Check,
  X,
  Calendar,
  MapPin,
  Car,
  User,
  Users,
  CreditCard,
  Briefcase,
  ChevronRight,
  Filter,
  Sparkles,
  Search,
  Film,
  RotateCcw,
  CheckCheck,
  AlertTriangle,
  History,
  HardDrive,
  Copy,
  ExternalLink,
  Camera,
  MessageSquare,
  Compass,
  LayoutGrid,
  List,
  Kanban,
} from 'lucide-react';
import TeamPayoutsDashboard from './TeamPayoutsDashboard';
import TeamPerformanceRanking from './TeamPerformanceRanking';
import MissionHistoryModal from './MissionHistoryModal';
import EquipmentRentalManager from './EquipmentRentalManager';
import RejectPostProductionModal from './RejectPostProductionModal';
import { confirmDialog, alertDialog } from '../utils/dialog';
import { getMissionCode } from '../utils/geo';
import { clearPostProductionNotification } from '../utils/notifications';
import { apiRequest } from '../utils/api';
import {
  resolveMissionEditors,
  getMissionEditionDeliverySummary,
  getMissionEditorsDeliveryMap,
  formatDeliveryDateTimeBR,
} from '../utils/postProduction';

function formatDateBR(dateStr) {
  if (!dateStr) return '';
  const parts = String(dateStr).split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

export default function AdminCenter({
  currentUser,
  members = [],
  missions = [],
  vehicles = [],
  reserveAlertVehicles = [],
  rentals: initialRentals = [],
  baseLocation = null,
  closures = {},
  onUpdateMember = null,
  onRespondExtraHours = null,
  onSaveMission = null,
  onEditMission = null,
  reloadServerMissions = null,
  onNavigateTab = null,
}) {
  // Sincronização e consulta de aluguéis para métricas de devolução e atrasos
  const [rentalsList, setRentalsList] = useState(initialRentals);

  useEffect(() => {
    if (Array.isArray(initialRentals) && initialRentals.length > 0) {
      setRentalsList(initialRentals);
    } else {
      let isMounted = true;
      apiRequest('/rentals.php')
        .then((res) => {
          if (isMounted && res && res.success && Array.isArray(res.rentals)) {
            setRentalsList(res.rentals);
          }
        })
        .catch(() => {});
      return () => {
        isMounted = false;
      };
    }
  }, [initialRentals]);
  // 1. Extrai todas as solicitações de horas extras de todas as missões
  const allExtraHoursRequests = useMemo(() => {
    const list = [];
    missions.forEach((m) => {
      const reqs = Array.isArray(m.extraHoursRequests) ? m.extraHoursRequests : [];
      reqs.forEach((r) => {
        const mem = members.find((mb) => String(mb.id) === String(r.memberId) || mb.name?.toLowerCase() === r.memberName?.toLowerCase());
        list.push({
          ...r,
          missionId: m.id,
          missionTitle: m.description,
          missionCode: m.code,
          missionDate: m.date,
          missionEndDate: m.endDate,
          departureTime: m.departureTime,
          returnTimeEstimated: m.returnTimeEstimated,
          locationName: m.locationName,
          vehiclePlate: m.vehiclePlate,
          memberPhoto: mem?.photoUrl || null,
          memberRole: mem?.role || 'Colaborador',
          memberPix: mem?.pixKey || '',
          memberCompany: mem?.company || 'MegaFilmes',
        });
      });
    });

    return list.sort((a, b) => {
      const tA = new Date(a.createdAt || a.missionDate || 0).getTime();
      const tB = new Date(b.createdAt || b.missionDate || 0).getTime();
      return tB - tA;
    });
  }, [missions, members]);

  const pendingRequests = useMemo(() => {
    return allExtraHoursRequests.filter((r) => r.status === 'PENDING');
  }, [allExtraHoursRequests]);

  const historyRequests = useMemo(() => {
    return allExtraHoursRequests.filter((r) => r.status !== 'PENDING');
  }, [allExtraHoursRequests]);

  // 2. Extrai missões de Pós-Produção que precisam de aprovação da Diretoria
  // Regra Estrita: Quando todos os editores escalados (1 ou mais) entregaram suas partes,
  // ou quando o status de edição for Edição Concluída / Entregue, a missão entra imediatamente na fila de decisão!
  const pendingEditions = useMemo(() => {
    return missions.filter((m) => {
      const isFinished = m.missionStatus === 'Finalizada' || m.missionStatus === 'Finalizado' || m.missionStatus === 'Concluída';
      if (isFinished) return false;

      const summary = getMissionEditionDeliverySummary(m, members);
      if (!summary.hasPostProduction) return false;

      // Se houver múltiplos editores, SÓ entra para aprovação final da diretoria se TODOS concluírem!
      if (summary.hasMultipleEditors) {
        return summary.isFullyDelivered;
      }

      // Se houver 1 editor designado e ele já entregou (ou o status for Edição Concluída / Entregue)
      if (summary.total === 1 && summary.isFullyDelivered) {
        return true;
      }

      return m.editionStatus === 'Edição Concluída' || m.editionStatus === 'Entregue';
    });
  }, [missions, members]);

  const historyEditions = useMemo(() => {
    const list = missions.filter((m) => {
      const isFinished = m.missionStatus === 'Finalizada' || m.missionStatus === 'Finalizado' || m.missionStatus === 'Concluída';
      if (!isFinished) return false;
      const summary = getMissionEditionDeliverySummary(m, members);
      return summary.hasPostProduction || m.editionStatus === 'Edição Concluída' || m.editionStatus === 'Entregue';
    });

    // Ordena pelas aprovações mais recentes no topo
    return list.sort((a, b) => {
      const appA = Array.isArray(a.editionHistory)
        ? [...a.editionHistory].reverse().find((ev) => ev && ev.type === 'APPROVED')
        : null;
      const appB = Array.isArray(b.editionHistory)
        ? [...b.editionHistory].reverse().find((ev) => ev && ev.type === 'APPROVED')
        : null;
      const tA = new Date(appA?.timestamp || a.updatedAt || a.editionCompletedAt || a.date || 0).getTime();
      const tB = new Date(appB?.timestamp || b.updatedAt || b.editionCompletedAt || b.date || 0).getTime();
      return tB - tA;
    });
  }, [missions, members]);

  // Sub-aba inicial: Se houver pós-produção pendente abre nela; se houver hora extra pendente abre nela; senão, fechamento
  const [adminTab, setAdminTab] = useState(() => {
    if (pendingEditions.length > 0) return 'approvals_pp';
    if (pendingRequests.length > 0) return 'approvals_hours';
    return 'payouts';
  });

  // Filtros internos
  const [approvalsSubView, setApprovalsSubView] = useState('pending');
  const [ppSubView, setPpSubView] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessingId, setIsProcessingId] = useState(null);

  // Modo de visualização de Pós-Produção: 'cards' | 'list' | 'kanban'
  const [ppViewMode, setPpViewMode] = useState(() => {
    try {
      return localStorage.getItem('gestormf_admin_pp_view_mode') || 'cards';
    } catch {
      return 'cards';
    }
  });

  const handleSetPpViewMode = (mode) => {
    setPpViewMode(mode);
    try {
      localStorage.setItem('gestormf_admin_pp_view_mode', mode);
    } catch {}
  };

  // Estados de modais e ações
  const [reopenModal, setReopenModal] = useState({
    isOpen: false,
    mission: null,
    reason: '',
    hasNewDeadline: false,
    newDeadlineDate: '',
    newDeadlineTime: '18:00',
  });
  const [selectedHistoryMission, setSelectedHistoryMission] = useState(null);
  const [copiedPathId, setCopiedPathId] = useState(null);

  // Ação de Horas Extras
  const handleAction = async (missionId, requestId, decision) => {
    if (!onRespondExtraHours) return;
    setIsProcessingId(requestId);
    try {
      await onRespondExtraHours(missionId, requestId, decision);
    } finally {
      setIsProcessingId(null);
    }
  };

  // Ação: Confirmar Finalização da Missão / Pós-Produção
  const handleApproveEdition = async (mission) => {
    const confirmed = await confirmDialog({
      title: '⭐ Confirmar Finalização e Encerrar Missão',
      message: `Deseja aprovar a pós-produção da pauta "${mission.description}" como concluída?`,
      description: 'Ao confirmar, a missão será FINALIZADA e travada para novas edições, concluindo o ciclo do serviço.',
      variant: 'success',
      confirmText: 'Confirmar Finalização',
      cancelText: 'Cancelar',
    });
    if (!confirmed) return;

    const now = new Date();
    const newEvent = {
      id: 'h-' + Date.now(),
      type: 'APPROVED',
      user: currentUser?.name || 'Administrador',
      timestamp: now.toISOString(),
      title: 'Material Aprovado e Missão Finalizada',
      description: `Pós-produção aprovada para entrega final por ${currentUser?.name || 'Administrador'} na Central do Administrador. Serviço encerrado com sucesso.`,
      isOverdue: false,
    };

    const updatedHistory = Array.isArray(mission.editionHistory)
      ? [...mission.editionHistory, newEvent]
      : [newEvent];

    const deliveryMap = getMissionEditorsDeliveryMap(mission, members);
    const finalizedDelivery = { ...deliveryMap };
    Object.keys(finalizedDelivery).forEach((k) => {
      finalizedDelivery[k] = {
        ...finalizedDelivery[k],
        status: 'delivered',
        deliveredAt: finalizedDelivery[k]?.deliveredAt || now.toISOString(),
      };
    });

    const mVer = (mission.version !== undefined && mission.version !== null) ? Number(mission.version) : 1;
    const updatedMission = {
      ...mission,
      editionStatus: 'Edição Concluída',
      missionStatus: 'Finalizada',
      isOverdue: 0,
      reopenReason: '',
      editorsDelivery: finalizedDelivery,
      editionHistory: updatedHistory,
      version: mVer,
      forceOverwrite: true,
      ignoreConflicts: true,
    };

    if (onSaveMission) {
      const res = await onSaveMission(updatedMission);
      if (res && res.success === false) {
        await alertDialog({
          title: 'Erro ao Finalizar',
          message: res.error || 'Não foi possível confirmar a finalização da missão.',
          variant: 'danger',
        });
        return;
      }
      clearPostProductionNotification(mission.id);
      if (reloadServerMissions) {
        reloadServerMissions().catch(() => {});
      }
      await alertDialog({
        title: '🎉 Missão Finalizada com Sucesso',
        message: `A pauta "${mission.description}" foi aprovada e finalizada com sucesso!`,
        variant: 'success',
      });
    }
  };

  // Ação: Rejeitar e Reabrir Serviço
  const handleConfirmReopen = async ({
    mission: m,
    reason,
    targetEditorId,
    hasNewDeadline,
    newDeadlineDate,
    newDeadlineTime,
  }) => {
    const now = new Date();
    const hasDeadlineVal = Boolean(hasNewDeadline && newDeadlineDate);
    const newDeadlineStr = hasDeadlineVal
      ? `${formatDateBR(newDeadlineDate)} às ${newDeadlineTime || '18:00'}`
      : (m.deliveryDeadlineDate ? `${formatDateBR(m.deliveryDeadlineDate)} às ${m.deliveryDeadlineTime || '18:00'}` : 'Não estipulado');

    const assignedEditors = resolveMissionEditors(m, members);
    const deliveryMap = getMissionEditorsDeliveryMap(m, members);
    const updatedDelivery = { ...deliveryMap };

    let targetDesc = 'todos os editores';
    if (targetEditorId && targetEditorId !== 'ALL') {
      const targetEd = assignedEditors.find((e) => String(e.id) === String(targetEditorId));
      targetDesc = targetEd ? targetEd.name : `Editor #${targetEditorId}`;
      const existingTarget = updatedDelivery[String(targetEditorId)] || {};
      updatedDelivery[String(targetEditorId)] = {
        ...existingTarget,
        editorId: String(targetEditorId),
        editorName: targetDesc,
        status: 'pending',
        deliveredAt: null,
        reopenReason: reason,
        reopenedAt: now.toISOString(),
      };
    } else {
      // Reabre para todos os editores
      assignedEditors.forEach((ed) => {
        const k = String(ed.id);
        updatedDelivery[k] = {
          ...(updatedDelivery[k] || {}),
          editorId: k,
          editorName: ed.name,
          status: 'pending',
          deliveredAt: null,
          reopenReason: reason,
          reopenedAt: now.toISOString(),
        };
      });
      Object.keys(updatedDelivery).forEach((k) => {
        updatedDelivery[k] = {
          ...updatedDelivery[k],
          status: 'pending',
          deliveredAt: null,
          reopenReason: reason,
          reopenedAt: now.toISOString(),
        };
      });
    }

    const newEvent = {
      id: 'h-' + Date.now(),
      type: 'REOPENED',
      user: currentUser?.name || 'Administrador',
      timestamp: now.toISOString(),
      title: `Missão Reaberta para Pós-Produção (${targetDesc})`,
      description: `Ajustes solicitados pela Diretoria: "${reason}". Devolução direcionada para: ${targetDesc}.` + (hasDeadlineVal ? ` Novo prazo: ${newDeadlineStr}.` : ''),
      reason,
      targetEditorId: targetEditorId || 'ALL',
      newDeadline: hasDeadlineVal ? newDeadlineStr : null,
      isOverdue: true,
    };

    const updatedHistory = Array.isArray(m.editionHistory)
      ? [...m.editionHistory, newEvent]
      : [newEvent];

    const mVer = (m.version !== undefined && m.version !== null) ? Number(m.version) : 1;
    const updatedMission = {
      ...m,
      editionStatus: 'Em Edição',
      missionStatus: 'Pendente',
      editionCompletedAt: null,
      editionCompletedBy: null,
      isOverdue: 1,
      reopenReason: reason,
      deliveryDeadlineDate: hasDeadlineVal ? newDeadlineDate : m.deliveryDeadlineDate,
      deliveryDeadlineTime: hasDeadlineVal ? (newDeadlineTime || '18:00') : m.deliveryDeadlineTime,
      editorsDelivery: updatedDelivery,
      editionHistory: updatedHistory,
      version: mVer,
      forceOverwrite: true,
      ignoreConflicts: true,
    };

    if (onSaveMission) {
      const res = await onSaveMission(updatedMission);
      if (res && res.success === false) {
        await alertDialog({
          title: 'Erro ao Reabrir',
          message: res.error || 'Não foi possível registrar a recusa do serviço.',
          variant: 'danger',
        });
        return;
      }
      clearPostProductionNotification(m.id);
      await alertDialog({
        title: '↩️ Serviço Reaberto',
        message: `A missão "${m.description}" retornou para o status Pendente (Em Edição). Orientações enviadas para ${targetDesc}.` + (hasDeadlineVal ? ` Novo prazo: ${newDeadlineStr}.` : ''),
        variant: 'warning',
      });
    }
    setReopenModal({ isOpen: false, mission: null });
  };

  // Copiar caminho do servidor
  const handleCopyServerPath = (path, missionId) => {
    if (!path) return;
    navigator.clipboard.writeText(path);
    setCopiedPathId(missionId);
    setTimeout(() => setCopiedPathId(null), 2000);
  };

  // Estatísticas de Gestão Operacional & Decisão (Atenção para Administradores)
  const totalPendingApprovals = pendingEditions.length + pendingRequests.length;

  const editionDeadlinesStats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    let overdue = 0;
    let dueToday = 0;
    let inProgress = 0;

    missions.forEach((m) => {
      const isFinished = m.missionStatus === 'Finalizada' || m.missionStatus === 'Finalizado' || m.missionStatus === 'Concluída';
      if (isFinished) return;

      const summary = getMissionEditionDeliverySummary(m, members);
      if (!summary.hasPostProduction) return;

      if (!summary.isFullyDelivered && m.editionStatus !== 'Edição Concluída' && m.editionStatus !== 'Entregue') {
        inProgress++;
        if (m.deliveryDeadlineDate) {
          if (m.deliveryDeadlineDate < todayStr) {
            overdue++;
          } else if (m.deliveryDeadlineDate === todayStr) {
            dueToday++;
          }
        }
      }
    });

    return { overdue, dueToday, inProgress, totalAlerts: overdue + dueToday };
  }, [missions, members]);

  const rentalStats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    let overdue = 0;
    let dueToday = 0;
    let active = 0;

    (rentalsList || []).forEach((r) => {
      if (!r || r.status === 'returned' || r.status === 'cancelled') return;
      active++;
      if (r.status === 'overdue' || (r.endDate && r.endDate < todayStr)) {
        overdue++;
      } else if (r.endDate === todayStr) {
        dueToday++;
      }
    });

    return { overdue, dueToday, active, totalAlerts: overdue + dueToday };
  }, [rentalsList]);

  const computedReserveVehicles = useMemo(() => {
    if (Array.isArray(reserveAlertVehicles) && reserveAlertVehicles.length > 0) {
      return reserveAlertVehicles;
    }
    return (vehicles || []).filter((v) => {
      const fl = String(v.fuelLevel || v.fuel_level || '').toLowerCase();
      return fl === 'reserva' || fl === 'crítico' || fl === 'critico' || (Number(v.fuelPercent) > 0 && Number(v.fuelPercent) <= 15);
    });
  }, [reserveAlertVehicles, vehicles]);

  const payoutsStats = useMemo(() => {
    let pendingCount = 0;
    let paidCount = 0;
    (members || []).forEach((mem) => {
      const status = closures[mem.id]?.status || 'Pendente';
      if (status === 'Pago') {
        paidCount++;
      } else {
        pendingCount++;
      }
    });
    return { pendingCount, paidCount };
  }, [members, closures]);

  const activeFieldMissions = useMemo(() => {
    return (missions || []).filter((m) => {
      const s = m.missionStatus;
      return s === 'Em Deslocamento' || s === 'Em Execução' || s === 'Em Rota';
    });
  }, [missions]);

  // Ações de Fácil Acesso ao Clicar nos Cards de Topo
  const handleGoToApprovals = () => {
    if (pendingEditions.length > 0) {
      setAdminTab('approvals_pp');
      setPpSubView('pending');
    } else {
      setAdminTab('approvals_hours');
      setApprovalsSubView('pending');
    }
  };

  const handleGoToDeadlines = () => {
    setAdminTab('approvals_pp');
    setPpSubView('pending');
  };

  const handleGoToRentals = () => {
    setAdminTab('rentals');
  };

  const handleGoToFleet = async () => {
    if (onNavigateTab) {
      onNavigateTab('vehicles');
      return;
    }
    if (computedReserveVehicles.length > 0) {
      const names = computedReserveVehicles
        .map((item) => {
          const v = item.vehicle || item;
          return `• ${v.name || 'Viatura'} (${v.plate || 'S/ placa'})`;
        })
        .join('\n');
      await alertDialog({
        title: '⚠️ Viaturas em Reserva de Combustível',
        message: `As seguintes viaturas atingiram o nível de reserva ou crítico:\n\n${names}\n\nAcesse o menu "Viaturas & Combustível" para autorizar o abastecimento.`,
        variant: 'warning',
      });
    } else {
      await alertDialog({
        title: '⛽ Frota Operacional',
        message: `Todas as ${vehicles.length} viaturas cadastradas estão com nível de combustível adequado.`,
        variant: 'info',
      });
    }
  };

  const handleGoToPayouts = () => {
    setAdminTab('payouts');
  };

  const handleGoToField = async () => {
    if (onNavigateTab) {
      onNavigateTab('map');
      return;
    }
    if (activeFieldMissions.length > 0) {
      const list = activeFieldMissions
        .map((m) => `• ${m.code || 'MISSÃO'}: ${m.description} (${m.missionStatus})`)
        .join('\n');
      await alertDialog({
        title: '📍 Missões em Campo Agora',
        message: `Equipes em atividade na rua:\n\n${list}`,
        variant: 'info',
      });
    } else {
      await alertDialog({
        title: '📍 Operação de Campo',
        message: 'Nenhuma equipe está em deslocamento ou execução no momento.',
        variant: 'info',
      });
    }
  };

  // Lista filtrada para Horas Extras
  const displayedRequests = useMemo(() => {
    const base = approvalsSubView === 'pending' ? pendingRequests : historyRequests;
    if (!searchTerm.trim()) return base;
    const q = searchTerm.toLowerCase();
    return base.filter(
      (r) =>
        r.memberName?.toLowerCase().includes(q) ||
        r.missionTitle?.toLowerCase().includes(q) ||
        r.missionCode?.toLowerCase().includes(q) ||
        r.reason?.toLowerCase().includes(q)
    );
  }, [approvalsSubView, pendingRequests, historyRequests, searchTerm]);

  // Lista filtrada para Pós-Produção
  const displayedEditions = useMemo(() => {
    const base = ppSubView === 'pending' ? pendingEditions : historyEditions;
    if (!searchTerm.trim()) return base;
    const q = searchTerm.toLowerCase();
    return base.filter(
      (m) =>
        m.description?.toLowerCase().includes(q) ||
        m.code?.toLowerCase().includes(q) ||
        m.locationName?.toLowerCase().includes(q) ||
        m.editorNamesDisplay?.toLowerCase().includes(q) ||
        m.editionCompletedBy?.toLowerCase().includes(q) ||
        m.serverFilePath?.toLowerCase().includes(q)
    );
  }, [ppSubView, pendingEditions, historyEditions, searchTerm]);

  // Colunas organizadas para o Quadro Kanban de Pós-Produção (Fluxo / Pipeline)
  const kanbanColumns = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const filterFn = (m) => {
      if (!q) return true;
      return (
        m.description?.toLowerCase().includes(q) ||
        m.code?.toLowerCase().includes(q) ||
        m.locationName?.toLowerCase().includes(q) ||
        m.editorNamesDisplay?.toLowerCase().includes(q) ||
        m.editionCompletedBy?.toLowerCase().includes(q) ||
        m.serverFilePath?.toLowerCase().includes(q)
      );
    };

    // 1. Em Edição (Em produção pelos editores, não entregue e não finalizada)
    const inProduction = missions.filter((m) => {
      const isFin = m.missionStatus === 'Finalizada' || m.missionStatus === 'Finalizado' || m.missionStatus === 'Concluída';
      if (isFin) return false;
      const summary = getMissionEditionDeliverySummary(m, members);
      if (!summary.hasPostProduction) return false;
      const hasRecentReopen = Array.isArray(m.editionHistory) && m.editionHistory.slice(-1)[0]?.type === 'REOPENED';
      if (hasRecentReopen) return false;
      return !summary.isFullyDelivered && m.editionStatus !== 'Edição Concluída' && m.editionStatus !== 'Entregue';
    }).filter(filterFn);

    // 2. Aguardando Decisão da Diretoria (Todos entregaram ou status entregue)
    const awaitingDecision = pendingEditions.filter(filterFn);

    // 3. Reabertas / Ajustes Solicitados
    const reopened = missions.filter((m) => {
      const isFin = m.missionStatus === 'Finalizada' || m.missionStatus === 'Finalizado' || m.missionStatus === 'Concluída';
      if (isFin) return false;
      const hasRecentReopen = Array.isArray(m.editionHistory) && m.editionHistory.some((ev) => ev && ev.type === 'REOPENED');
      return hasRecentReopen && m.editionStatus === 'Em Edição';
    }).filter(filterFn);

    // 4. Aprovadas & Finalizadas
    const approved = historyEditions.filter(filterFn);

    return {
      inProduction,
      awaitingDecision,
      reopened,
      approved,
    };
  }, [missions, members, pendingEditions, historyEditions, searchTerm]);

  // Renderizador de Card individual para o Quadro Kanban de Pós-Produção
  const renderKanbanCard = (mission, colKey) => {
    const mCode = getMissionCode(mission, missions);
    const assignedEditors = resolveMissionEditors(mission, members);
    const deliverySummary = getMissionEditionDeliverySummary(mission, members);
    const lastConcludeEvent = Array.isArray(mission.editionHistory)
      ? [...mission.editionHistory].reverse().find((ev) => ev.type === 'CONCLUDED' || ev.serverFilePath || ev.message)
      : null;
    const serverPath = mission.serverFilePath || lastConcludeEvent?.serverFilePath || null;
    const todayStr = new Date().toISOString().split('T')[0];
    const isOverdue = mission.deliveryDeadlineDate && mission.deliveryDeadlineDate < todayStr;
    const isDueToday = mission.deliveryDeadlineDate === todayStr;

    return (
      <div key={mission.id} className="ac-pp-kcard">
        <div className="ac-pp-kcard-top">
          <span className="ac-rc-code">#{mCode}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span className="ac-meta-chip" style={{ fontSize: '0.68rem', padding: '2px 6px' }}>
              <Calendar size={11} className="text-amber" />
              <span>{formatDateBR(mission.date)}</span>
            </span>
            <button
              type="button"
              className="ac-btn-history-sm"
              onClick={() => setSelectedHistoryMission(mission)}
              title="Auditoria"
              style={{ padding: '3px 6px' }}
            >
              <History size={11} />
            </button>
          </div>
        </div>

        <div>
          <h5 className="ac-pp-kcard-title">{mission.description}</h5>
          <div className="ac-pp-kcard-loc">
            <MapPin size={11} className="text-amber" />
            <span>{mission.locationName || mission.address || 'Local não definido'}</span>
          </div>
        </div>

        {/* Editores e Entregas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.72rem' }}>
          {assignedEditors.map((ed) => {
            const edDeliv = deliverySummary.deliveryMap[String(ed.id)];
            const isDone = edDeliv && edDeliv.status === 'delivered';
            return (
              <div key={ed.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>{ed.name}</span>
                <span className={`ac-deliv-badge ${isDone ? 'done' : 'pending'}`}>
                  {isDone ? '✅ Entregue' : '⏳ Pendente'}
                </span>
              </div>
            );
          })}
        </div>

        {/* Prazo */}
        {mission.deliveryDeadlineDate && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.68rem', paddingTop: '4px' }}>
            <span style={{ color: '#94a3b8' }}>Prazo: {formatDateBR(mission.deliveryDeadlineDate)} às {mission.deliveryDeadlineTime || '18:00'}</span>
            <span className={`ac-deadline-chip ${isOverdue ? 'overdue' : (isDueToday ? 'today' : 'ontime')}`}>
              {isOverdue ? '⚠️ Atrasado' : (isDueToday ? '⏰ Hoje' : '✅ No Prazo')}
            </span>
          </div>
        )}

        {/* Servidor */}
        {serverPath && (
          <div className="aphl-server-box" style={{ marginTop: '2px' }}>
            <code className="aphl-server-code" title={serverPath} style={{ fontSize: '0.68rem' }}>
              {serverPath}
            </code>
            <button
              type="button"
              className="ac-btn-copy-path"
              onClick={() => handleCopyServerPath(serverPath, `kb-${mission.id}`)}
              title="Copiar caminho"
            >
              {copiedPathId === `kb-${mission.id}` ? (
                <Check size={11} className="text-emerald" />
              ) : (
                <Copy size={11} />
              )}
            </button>
          </div>
        )}

        {/* Ações por Coluna */}
        {colKey === 'awaiting_decision' && (
          <div className="ac-pp-kcard-actions">
            <button
              type="button"
              className="ac-btn-action-approve-sm"
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={() => handleApproveEdition(mission)}
            >
              <Check size={12} />
              <span>Aprovar</span>
            </button>
            <button
              type="button"
              className="ac-btn-action-reject-sm"
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={() => setReopenModal({
                isOpen: true,
                mission,
                reason: '',
                hasNewDeadline: false,
                newDeadlineDate: mission.deliveryDeadlineDate || '',
                newDeadlineTime: mission.deliveryDeadlineTime || '18:00',
              })}
            >
              <RotateCcw size={12} />
              <span>Rejeitar</span>
            </button>
          </div>
        )}

        {colKey === 'reopened' && (
          <div style={{ marginTop: '4px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <small style={{ color: '#fca5a5', display: 'block', fontSize: '0.68rem', marginBottom: '6px' }}>
              ⚠️ {mission.reopenReason || 'Ajustes solicitados pela diretoria'}
            </small>
            <button
              type="button"
              className="ac-btn-reject aphl-btn-reopen"
              style={{ width: '100%', justifyContent: 'center', padding: '5px' }}
              onClick={() => setReopenModal({
                isOpen: true,
                mission,
                reason: mission.reopenReason || '',
                hasNewDeadline: false,
                newDeadlineDate: mission.deliveryDeadlineDate || '',
                newDeadlineTime: mission.deliveryDeadlineTime || '18:00',
              })}
            >
              <RotateCcw size={12} />
              <span>Alterar Ajustes / Prazo</span>
            </button>
          </div>
        )}

        {colKey === 'approved' && (
          <div className="ac-pp-kcard-actions">
            <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle2 size={13} /> Finalizada
            </span>
            <button
              type="button"
              className="ac-btn-reject aphl-btn-reopen"
              style={{ marginLeft: 'auto', padding: '4px 8px', fontSize: '0.7rem' }}
              onClick={() => setReopenModal({
                isOpen: true,
                mission,
                reason: '',
                hasNewDeadline: false,
                newDeadlineDate: mission.deliveryDeadlineDate || '',
                newDeadlineTime: mission.deliveryDeadlineTime || '18:00',
              })}
            >
              <RotateCcw size={11} />
              <span>Reabrir</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="admin-center-container">
      {/* ============================================================== */}
      {/* 1. CABEÇALHO DA CENTRAL DO ADMINISTRADOR                       */}
      {/* ============================================================== */}
      <div className="admin-center-header">
        <div className="ach-left">
          <div className="ach-badge">
            <ShieldCheck size={14} /> CENTRAL ADMINISTRATIVA &amp; DIRETORIA
          </div>
          <h1 className="ach-title">Painel de Gestão &amp; Decisão</h1>
          <p className="ach-desc">
            Central unificada para aprovação de materiais de pós-produção, horas extras de campo, apuração de diárias e inteligência de performance.
          </p>
        </div>

        {/* Mini KPI Cards de Topo: Informações Críticas com Acesso Fácil */}
        <div className="ach-kpi-strip">
          {/* CARD 1: APROVAÇÕES PENDENTES */}
          <div
            className={`ach-kpi-card ${totalPendingApprovals > 0 ? 'kpi-warn-pulse' : ''} ${adminTab === 'approvals_pp' || adminTab === 'approvals_hours' ? 'is-active-tab' : ''}`}
            onClick={handleGoToApprovals}
            title="Clique para ir direto às aprovações da diretoria"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && handleGoToApprovals()}
          >
            <div className="ach-kpi-head">
              <div className="ach-kpi-icon text-amber">
                <Clock size={14} />
              </div>
              <span className="ach-kpi-lbl">Aprovações Pendentes</span>
            </div>
            <div className="ach-kpi-mid-row">
              <span className="ach-kpi-num">{totalPendingApprovals}</span>
              {totalPendingApprovals > 0 ? (
                <span className="ach-kpi-tag tag-warning">Decisão</span>
              ) : (
                <span className="ach-kpi-tag tag-success">Em Dia</span>
              )}
            </div>
            <div className="ach-kpi-sub">
              {pendingEditions.length} Pós-Produção • {pendingRequests.length} Horas Extras
            </div>
          </div>

          {/* CARD 2: PRAZOS DE EDIÇÃO */}
          <div
            className={`ach-kpi-card ${editionDeadlinesStats.overdue > 0 ? 'kpi-danger-pulse' : (editionDeadlinesStats.dueToday > 0 ? 'kpi-warn-pulse' : 'kpi-success-subtle')} ${adminTab === 'approvals_pp' ? 'is-active-tab' : ''}`}
            onClick={handleGoToDeadlines}
            title="Clique para verificar os prazos de entrega dos editores"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && handleGoToDeadlines()}
          >
            <div className="ach-kpi-head">
              <div className={`ach-kpi-icon ${editionDeadlinesStats.overdue > 0 ? 'text-rose' : (editionDeadlinesStats.dueToday > 0 ? 'text-amber' : 'text-emerald')}`}>
                {editionDeadlinesStats.overdue > 0 ? <AlertTriangle size={14} /> : <Film size={14} />}
              </div>
              <span className="ach-kpi-lbl">Prazos de Edição</span>
            </div>
            <div className="ach-kpi-mid-row">
              <span className={`ach-kpi-num ${editionDeadlinesStats.overdue > 0 ? 'text-rose' : (editionDeadlinesStats.dueToday > 0 ? 'text-amber' : 'text-emerald')}`}>
                {editionDeadlinesStats.overdue > 0
                  ? editionDeadlinesStats.overdue
                  : (editionDeadlinesStats.dueToday > 0 ? editionDeadlinesStats.dueToday : 0)}
              </span>
              {editionDeadlinesStats.overdue > 0 ? (
                <span className="ach-kpi-tag tag-danger">Atraso</span>
              ) : editionDeadlinesStats.dueToday > 0 ? (
                <span className="ach-kpi-tag tag-warning">Vence Hoje</span>
              ) : (
                <span className="ach-kpi-tag tag-success">No Prazo</span>
              )}
            </div>
            <div className="ach-kpi-sub">
              {editionDeadlinesStats.overdue > 0
                ? `${editionDeadlinesStats.overdue} ${editionDeadlinesStats.overdue === 1 ? 'edição expirada' : 'edições expiradas'}`
                : (editionDeadlinesStats.dueToday > 0
                  ? `${editionDeadlinesStats.dueToday} ${editionDeadlinesStats.dueToday === 1 ? 'entrega prevista hoje' : 'entregas previstas hoje'}`
                  : `${editionDeadlinesStats.inProgress} em produção • Em dia`)}
            </div>
          </div>

          {/* CARD 3: ALUGUÉIS & DEVOLUÇÕES */}
          <div
            className={`ach-kpi-card ${rentalStats.overdue > 0 ? 'kpi-danger-pulse' : (rentalStats.dueToday > 0 ? 'kpi-warn-pulse' : '')} ${adminTab === 'rentals' ? 'is-active-tab' : ''}`}
            onClick={handleGoToRentals}
            title="Clique para acessar o módulo de Aluguel & Equipamentos"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && handleGoToRentals()}
          >
            <div className="ach-kpi-head">
              <div className={`ach-kpi-icon ${rentalStats.overdue > 0 ? 'text-rose' : (rentalStats.dueToday > 0 ? 'text-amber' : 'text-cyan')}`}>
                <Camera size={14} />
              </div>
              <span className="ach-kpi-lbl">Aluguéis &amp; Devoluções</span>
            </div>
            <div className="ach-kpi-mid-row">
              <span className={`ach-kpi-num ${rentalStats.totalAlerts > 0 ? 'text-rose' : 'text-cyan'}`}>
                {rentalStats.totalAlerts > 0 ? rentalStats.totalAlerts : rentalStats.active}
              </span>
              {rentalStats.overdue > 0 ? (
                <span className="ach-kpi-tag tag-danger">Atraso</span>
              ) : rentalStats.dueToday > 0 ? (
                <span className="ach-kpi-tag tag-warning">Hoje</span>
              ) : rentalStats.active > 0 ? (
                <span className="ach-kpi-tag tag-info">Ativos</span>
              ) : (
                <span className="ach-kpi-tag tag-success">Livre</span>
              )}
            </div>
            <div className="ach-kpi-sub">
              {rentalStats.totalAlerts > 0
                ? `${rentalStats.overdue} atrasada(s) • ${rentalStats.dueToday} hoje`
                : (rentalStats.active > 0
                  ? `${rentalStats.active} ${rentalStats.active === 1 ? 'locação em andamento' : 'locações em andamento'}`
                  : 'Nenhum equipamento alugado')}
            </div>
          </div>

          {/* CARD 4: FROTA & COMBUSTÍVEL CRÍTICO */}
          <div
            className={`ach-kpi-card ${computedReserveVehicles.length > 0 ? 'kpi-danger-pulse' : 'kpi-success-subtle'}`}
            onClick={handleGoToFleet}
            title="Clique para gerenciar viaturas e autorizar abastecimentos"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && handleGoToFleet()}
          >
            <div className="ach-kpi-head">
              <div className={`ach-kpi-icon ${computedReserveVehicles.length > 0 ? 'text-rose' : 'text-emerald'}`}>
                <Car size={14} />
              </div>
              <span className="ach-kpi-lbl">Frota &amp; Combustível</span>
            </div>
            <div className="ach-kpi-mid-row">
              <span className={`ach-kpi-num ${computedReserveVehicles.length > 0 ? 'text-rose' : 'text-emerald'}`}>
                {computedReserveVehicles.length > 0 ? computedReserveVehicles.length : vehicles.length}
              </span>
              {computedReserveVehicles.length > 0 ? (
                <span className="ach-kpi-tag tag-danger">Reserva</span>
              ) : (
                <span className="ach-kpi-tag tag-success">OK</span>
              )}
            </div>
            <div className="ach-kpi-sub">
              {computedReserveVehicles.length > 0
                ? 'Atenção ao abastecimento urgente'
                : `${vehicles.length} viaturas • Nível regular`}
            </div>
          </div>

          {/* CARD 5: FECHAMENTO & SALDO DA FOLHA */}
          <div
            className={`ach-kpi-card ${payoutsStats.pendingCount > 0 ? 'kpi-warn-pulse' : 'kpi-success-subtle'} ${adminTab === 'payouts' ? 'is-active-tab' : ''}`}
            onClick={handleGoToPayouts}
            title="Clique para ir ao Fechamento Financeiro e Folha de Pagamento"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && handleGoToPayouts()}
          >
            <div className="ach-kpi-head">
              <div className="ach-kpi-icon text-emerald">
                <DollarSign size={14} />
              </div>
              <span className="ach-kpi-lbl">Fechamento do Mês</span>
            </div>
            <div className="ach-kpi-mid-row">
              <span className={`ach-kpi-num ${payoutsStats.pendingCount > 0 ? 'text-amber' : 'text-emerald'}`}>
                {payoutsStats.pendingCount > 0 ? payoutsStats.pendingCount : 0}
              </span>
              {payoutsStats.pendingCount > 0 ? (
                <span className="ach-kpi-tag tag-warning">A Quitar</span>
              ) : (
                <span className="ach-kpi-tag tag-success">100% Pago</span>
              )}
            </div>
            <div className="ach-kpi-sub">
              {payoutsStats.pendingCount > 0
                ? `${payoutsStats.pendingCount} pendentes • Quitação dia 05`
                : 'Folha do mês 100% quitada'}
            </div>
          </div>

          {/* CARD 6: MISSÕES EM CAMPO AGORA */}
          <div
            className="ach-kpi-card"
            onClick={handleGoToField}
            title="Clique para acompanhar equipes e missões em campo"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && handleGoToField()}
          >
            <div className="ach-kpi-head">
              <div className="ach-kpi-icon text-gold">
                <Compass size={14} />
              </div>
              <span className="ach-kpi-lbl">Missões em Campo</span>
            </div>
            <div className="ach-kpi-mid-row">
              <span className="ach-kpi-num text-gold">{activeFieldMissions.length}</span>
              {activeFieldMissions.length > 0 ? (
                <span className="ach-kpi-tag tag-info">Em Campo</span>
              ) : (
                <span className="ach-kpi-tag tag-success">Base</span>
              )}
            </div>
            <div className="ach-kpi-sub">
              {activeFieldMissions.length > 0
                ? `${activeFieldMissions.length} ${activeFieldMissions.length === 1 ? 'equipe em campo' : 'equipes em campo'}`
                : 'Todas as equipes na base'}
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. BARRA DE NAVEGAÇÃO DE SUB-ABAS DA CENTRAL                   */}
      {/* ============================================================== */}
      <div className="admin-center-tabs-bar" style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
        <div className="admin-center-tabs-group" style={{ margin: '0 auto' }}>
          <button
            type="button"
            className={`ac-tab-btn ${adminTab === 'approvals_pp' ? 'is-active' : ''}`}
            onClick={() => setAdminTab('approvals_pp')}
          >
            <Film size={16} />
            <span>Aprovações de Pós-Produção</span>
            {pendingEditions.length > 0 && (
              <span className="ac-tab-count-badge badge-pending-pulse">
                {pendingEditions.length}
              </span>
            )}
          </button>

          <button
            type="button"
            className={`ac-tab-btn ${adminTab === 'approvals_hours' ? 'is-active' : ''}`}
            onClick={() => setAdminTab('approvals_hours')}
          >
            <Clock size={16} />
            <span>Aprovações de Horas Extras</span>
            {pendingRequests.length > 0 && (
              <span className="ac-tab-count-badge badge-pending">
                {pendingRequests.length}
              </span>
            )}
          </button>

          <button
            type="button"
            className={`ac-tab-btn ${adminTab === 'payouts' ? 'is-active' : ''}`}
            onClick={() => setAdminTab('payouts')}
          >
            <DollarSign size={16} />
            <span>Diárias &amp; Fechamento Financeiro</span>
          </button>

          <button
            type="button"
            className={`ac-tab-btn ${adminTab === 'ranking' ? 'is-active' : ''}`}
            onClick={() => setAdminTab('ranking')}
          >
            <Trophy size={16} />
            <span>Inteligência &amp; Ranking</span>
          </button>

          <button
            type="button"
            className={`ac-tab-btn ${adminTab === 'rentals' ? 'is-active' : ''}`}
            onClick={() => setAdminTab('rentals')}
          >
            <Camera size={16} />
            <span>Aluguel &amp; Equipamentos</span>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. CONTEÚDO DAS SUB-ABAS                                       */}
      {/* ============================================================== */}
      <div className="admin-center-content">
        {/* ============================================================ */}
        {/* SUB-ABA 1: APROVAÇÕES DE PÓS-PRODUÇÃO (MATERIAIS E VÍDEOS)   */}
        {/* ============================================================ */}
        {adminTab === 'approvals_pp' && (
          <div className="ac-approvals-view">
            {/* Header com Filtros de Pendentes vs Histórico */}
            <div className="ac-approvals-toolbar">
              <div className="ac-filter-pills">
                <button
                  type="button"
                  className={`ac-pill-btn ${ppSubView === 'pending' ? 'active' : ''}`}
                  onClick={() => setPpSubView('pending')}
                >
                  <Clock size={14} />
                  <span>Pendentes de Decisão ({pendingEditions.length})</span>
                </button>
                <button
                  type="button"
                  className={`ac-pill-btn ${ppSubView === 'history' ? 'active' : ''}`}
                  onClick={() => setPpSubView('history')}
                >
                  <CheckCircle2 size={14} />
                  <span>Histórico Finalizado ({historyEditions.length})</span>
                </button>
              </div>

              {/* Seletor de Modo de Visualização: Cards | Tabela / Lista | Kanban */}
              <div className="ac-view-mode-toggle" role="group" aria-label="Modo de visualização">
                <button
                  type="button"
                  className={`ac-vm-btn ${ppViewMode === 'cards' ? 'active' : ''}`}
                  onClick={() => handleSetPpViewMode('cards')}
                  title="Visualização em Cards Detalhados"
                >
                  <LayoutGrid size={14} />
                  <span>Cards</span>
                </button>
                <button
                  type="button"
                  className={`ac-vm-btn ${ppViewMode === 'list' ? 'active' : ''}`}
                  onClick={() => handleSetPpViewMode('list')}
                  title="Visualização em Lista / Tabela Executiva"
                >
                  <List size={14} />
                  <span>Lista</span>
                </button>
                <button
                  type="button"
                  className={`ac-vm-btn ${ppViewMode === 'kanban' ? 'active' : ''}`}
                  onClick={() => handleSetPpViewMode('kanban')}
                  title="Visualização em Fluxo / Quadro Kanban"
                >
                  <Kanban size={14} />
                  <span>Kanban</span>
                </button>
              </div>

              {/* Barra de Pesquisa */}
              <div className="ac-search-box">
                <Search size={14} className="ac-search-icon" />
                <input
                  type="text"
                  placeholder="Buscar por pauta, código, editor ou local..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="ac-search-input"
                />
                {searchTerm && (
                  <button type="button" onClick={() => setSearchTerm('')} className="ac-search-clear">
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Visualização em Quadro Kanban Completo */}
            {ppViewMode === 'kanban' ? (
              <div className="ac-pp-kanban-board">
                {/* 1. Em Edição */}
                <div className="ac-pp-kanban-col">
                  <div className="ac-pp-kanban-header">
                    <span className="ac-pp-kanban-title">
                      <Clock size={14} className="text-cyan" />
                      <span>1. Em Edição</span>
                    </span>
                    <span className="ac-pp-kanban-badge">{kanbanColumns.inProduction.length}</span>
                  </div>
                  <div className="ac-pp-kanban-cards">
                    {kanbanColumns.inProduction.length === 0 ? (
                      <div className="ac-empty-col">Nenhuma edição em andamento</div>
                    ) : (
                      kanbanColumns.inProduction.map((m) => renderKanbanCard(m, 'in_production'))
                    )}
                  </div>
                </div>

                {/* 2. Aguardando Decisão */}
                <div className="ac-pp-kanban-col">
                  <div className="ac-pp-kanban-header" style={{ borderLeftColor: '#f59e0b' }}>
                    <span className="ac-pp-kanban-title">
                      <AlertCircle size={14} className="text-amber" />
                      <span>2. Aguardando Decisão</span>
                    </span>
                    <span className="ac-pp-kanban-badge" style={{ background: 'rgba(245, 158, 11, 0.25)', color: '#fde68a' }}>
                      {kanbanColumns.awaitingDecision.length}
                    </span>
                  </div>
                  <div className="ac-pp-kanban-cards">
                    {kanbanColumns.awaitingDecision.length === 0 ? (
                      <div className="ac-empty-col">Nenhuma aguardando decisão</div>
                    ) : (
                      kanbanColumns.awaitingDecision.map((m) => renderKanbanCard(m, 'awaiting_decision'))
                    )}
                  </div>
                </div>

                {/* 3. Ajustes / Reabertas */}
                <div className="ac-pp-kanban-col">
                  <div className="ac-pp-kanban-header" style={{ borderLeftColor: '#ef4444' }}>
                    <span className="ac-pp-kanban-title">
                      <RotateCcw size={14} className="text-red" />
                      <span>3. Ajustes Solicitados</span>
                    </span>
                    <span className="ac-pp-kanban-badge" style={{ background: 'rgba(239, 68, 68, 0.25)', color: '#fca5a5' }}>
                      {kanbanColumns.reopened.length}
                    </span>
                  </div>
                  <div className="ac-pp-kanban-cards">
                    {kanbanColumns.reopened.length === 0 ? (
                      <div className="ac-empty-col">Nenhum ajuste pendente</div>
                    ) : (
                      kanbanColumns.reopened.map((m) => renderKanbanCard(m, 'reopened'))
                    )}
                  </div>
                </div>

                {/* 4. Aprovadas & Finalizadas */}
                <div className="ac-pp-kanban-col">
                  <div className="ac-pp-kanban-header" style={{ borderLeftColor: '#10b981' }}>
                    <span className="ac-pp-kanban-title">
                      <CheckCircle2 size={14} className="text-emerald" />
                      <span>4. Aprovadas</span>
                    </span>
                    <span className="ac-pp-kanban-badge" style={{ background: 'rgba(16, 185, 129, 0.25)', color: '#a7f3d0' }}>
                      {kanbanColumns.approved.length}
                    </span>
                  </div>
                  <div className="ac-pp-kanban-cards">
                    {kanbanColumns.approved.length === 0 ? (
                      <div className="ac-empty-col">Nenhuma aprovada</div>
                    ) : (
                      kanbanColumns.approved.map((m) => renderKanbanCard(m, 'approved'))
                    )}
                  </div>
                </div>
              </div>
            ) : displayedEditions.length === 0 ? (
              <div className="ac-empty-card">
                <div className="ac-empty-icon-box">
                  {ppSubView === 'pending' ? <CheckCircle2 size={42} className="text-emerald" /> : <Film size={42} className="text-muted" />}
                </div>
                <h3>
                  {ppSubView === 'pending'
                    ? 'Nenhuma Pós-Produção Pendente de Aprovação!'
                    : 'Nenhum histórico de pós-produção encontrado.'}
                </h3>
                <p>
                  {ppSubView === 'pending'
                    ? 'Todas as filmagens concluídas em campo cujos materiais foram entregues pelos editores já foram avaliadas.'
                    : 'Nenhuma missão finalizada corresponde aos filtros informados.'}
                </p>
              </div>
            ) : ppSubView === 'history' ? (
              /* ============================================================ */
              /* HISTÓRICO DE APROVAÇÃO EM LISTA COM DIA E HORA DA APROVAÇÃO  */
              /* ============================================================ */
              <div className="ac-pp-history-list-wrap">
                <div className="ac-pp-history-list-header">
                  <div className="aphl-col aphl-col-mission">Missão &amp; Pauta</div>
                  <div className="aphl-col aphl-col-editors">Editores &amp; Entregas (Dia e Hora)</div>
                  <div className="aphl-col aphl-col-approval">Aprovação da Diretoria (Dia e Hora)</div>
                  <div className="aphl-col aphl-col-server">Pasta no Servidor</div>
                  <div className="aphl-col aphl-col-actions">Ações</div>
                </div>

                <div className="ac-pp-history-list-rows">
                  {displayedEditions.map((mission) => {
                    const mCode = getMissionCode(mission, missions);
                    const isOverdue = Boolean(mission.isOverdue || mission.editionDeliveryStatus === 'Atrasado' || mission.editionDeliveryStatus === 'Fora do Prazo');
                    const assignedEditors = resolveMissionEditors(mission, members);
                    const deliverySummary = getMissionEditionDeliverySummary(mission, members);

                    // Encontra o último evento APPROVED no editionHistory
                    const lastApprovedEvent = Array.isArray(mission.editionHistory)
                      ? [...mission.editionHistory].reverse().find((ev) => ev && ev.type === 'APPROVED')
                      : null;

                    const approvedAtRaw = lastApprovedEvent?.timestamp || mission.updatedAt || mission.editionCompletedAt || null;
                    const approvedAtStr = formatDeliveryDateTimeBR(approvedAtRaw);
                    const approvedByStr = lastApprovedEvent?.user || 'Administrador';

                    // Extrai caminho principal do servidor
                    const lastConcludeEvent = Array.isArray(mission.editionHistory)
                      ? [...mission.editionHistory].reverse().find((ev) => ev && (ev.type === 'CONCLUDED' || ev.type === 'COMPLETED' || ev.serverFilePath))
                      : null;
                    const firstEditorWithPath = assignedEditors
                      .map((ed) => deliverySummary.deliveryMap[String(ed.id)]?.serverFilePath)
                      .find(Boolean);
                    const serverPath = mission.serverFilePath || firstEditorWithPath || lastConcludeEvent?.serverFilePath || null;

                    return (
                      <div key={mission.id} className="ac-pp-history-row">
                        {/* 1. Missão & Pauta */}
                        <div className="aphl-cell aphl-col-mission">
                          <div className="aphl-mission-top">
                            <span className="ac-rc-code">#{mCode}</span>
                            <span className="ac-rc-status-pill status-approved">
                              <span className="ac-status-dot" />
                              Missão Finalizada
                            </span>
                            <span className={`ac-pp-status-badge ${isOverdue ? 'overdue' : 'ontime'}`} style={{ fontSize: '0.68rem', padding: '2px 7px' }}>
                              {isOverdue ? '⚠️ Fora do Prazo' : '✅ No Prazo'}
                            </span>
                          </div>
                          <strong className="aphl-mission-title">{mission.description}</strong>
                          <div className="aphl-mission-meta">
                            <span>
                              <Calendar size={12} className="text-amber" /> {formatDateBR(mission.date)}
                              {mission.departureTime ? ` (${mission.departureTime})` : ''}
                            </span>
                            <span>
                              <MapPin size={12} className="text-amber" /> {mission.locationName || mission.address || 'Local não definido'}
                            </span>
                          </div>
                        </div>

                        {/* 2. Editores & Entregas (Dia e Hora) */}
                        <div className="aphl-cell aphl-col-editors">
                          {assignedEditors.length > 0 ? (
                            <div className="aphl-editors-stack">
                              {assignedEditors.map((ed) => {
                                const edDeliv = deliverySummary.deliveryMap[String(ed.id)];
                                const isDone = edDeliv && edDeliv.status === 'delivered';
                                const delivStr = formatDeliveryDateTimeBR(
                                  edDeliv?.deliveredAt || mission.editionCompletedAt || lastConcludeEvent?.timestamp
                                );
                                return (
                                  <div key={ed.id} className="aphl-editor-item">
                                    <div className="aphl-editor-name-row">
                                      <div className="ac-pp-avatar-circle" style={{ width: '20px', height: '20px', fontSize: '0.62rem' }}>
                                        {ed.name.slice(0, 2).toUpperCase()}
                                      </div>
                                      <strong>{ed.name}</strong>
                                      <span className={`aphl-ed-badge ${isDone ? 'done' : 'pending'}`}>
                                        {isDone ? '✅ Entregou' : '⏳ Pendente'}
                                      </span>
                                    </div>
                                    {delivStr && (
                                      <div className="aphl-editor-time">
                                        <Clock size={11} />
                                        <span>Entregue em: <strong>{delivStr}</strong></span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-muted" style={{ fontSize: '0.78rem' }}>
                              {mission.editionCompletedBy || mission.editorNamesDisplay || 'Editor Responsável'}
                            </span>
                          )}
                        </div>

                        {/* 3. Aprovação da Diretoria (Dia e Hora) */}
                        <div className="aphl-cell aphl-col-approval">
                          <div className="aphl-approval-badge-box">
                            <div className="aphl-approval-status-line">
                              <CheckCircle2 size={14} className="text-emerald" />
                              <strong>Aprovada e Finalizada</strong>
                            </div>
                            <div className="aphl-approval-datetime">
                              <Clock size={12} className="text-cyan" />
                              <span>
                                Dia e Hora: <strong>{approvedAtStr || formatDateBR(mission.date)}</strong>
                              </span>
                            </div>
                            <div className="aphl-approval-by">
                              <ShieldCheck size={12} className="text-amber" />
                              <span>Por: <strong>{approvedByStr}</strong></span>
                            </div>
                          </div>
                        </div>

                        {/* 4. Pasta no Servidor */}
                        <div className="aphl-cell aphl-col-server">
                          {serverPath ? (
                            <div className="aphl-server-box">
                              <code className="aphl-server-code" title={serverPath}>
                                {serverPath}
                              </code>
                              <button
                                type="button"
                                className="ac-btn-copy-path"
                                onClick={() => handleCopyServerPath(serverPath, `hist-${mission.id}`)}
                                title="Copiar caminho da pasta no servidor"
                              >
                                {copiedPathId === `hist-${mission.id}` ? (
                                  <>
                                    <Check size={12} className="text-emerald" />
                                    <span>Copiado!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy size={12} />
                                    <span>Copiar</span>
                                  </>
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="text-muted" style={{ fontSize: '0.76rem' }}>Não informado</span>
                          )}
                        </div>

                        {/* 5. Ações (Auditoria & Reabrir) */}
                        <div className="aphl-cell aphl-col-actions">
                          <button
                            type="button"
                            className="ac-btn-history"
                            onClick={() => setSelectedHistoryMission(mission)}
                            title="Ver histórico e auditoria completa da missão"
                          >
                            <History size={13} />
                            <span>Auditoria</span>
                          </button>

                          <button
                            type="button"
                            className="ac-btn-reject aphl-btn-reopen"
                            onClick={() => setReopenModal({
                              isOpen: true,
                              mission,
                              reason: '',
                              hasNewDeadline: false,
                              newDeadlineDate: mission.deliveryDeadlineDate || '',
                              newDeadlineTime: mission.deliveryDeadlineTime || '18:00',
                            })}
                            title="Reabrir esta missão finalizada e deixar em aberto novamente as entregas da pós-produção"
                          >
                            <RotateCcw size={13} />
                            <span>Reabrir</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : ppViewMode === 'list' ? (
              /* ============================================================ */
              /* VISUALIZAÇÃO EM LISTA / TABELA EXECUTIVA                      */
              /* ============================================================ */
              <div className="ac-pp-table-wrap">
                <table className="ac-pp-table">
                  <thead>
                    <tr>
                      <th style={{ width: '130px' }}>Código &amp; Status</th>
                      <th>Pauta &amp; Local</th>
                      <th style={{ width: '130px' }}>Data da Pauta</th>
                      <th style={{ minWidth: '220px' }}>Editores &amp; Entregas</th>
                      <th style={{ width: '170px' }}>Prazo de Entrega</th>
                      <th style={{ minWidth: '200px' }}>Servidor / Pasta</th>
                      <th style={{ width: '190px', textAlign: 'center' }}>Ações de Decisão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedEditions.map((mission) => {
                      const mCode = getMissionCode(mission, missions);
                      const isPending = mission.missionStatus !== 'Finalizada' && mission.missionStatus !== 'Finalizado' && mission.missionStatus !== 'Concluída';
                      const isOverdue = Boolean(mission.isOverdue || mission.editionDeliveryStatus === 'Atrasado');
                      const todayStr = new Date().toISOString().split('T')[0];
                      const isDueToday = mission.deliveryDeadlineDate === todayStr;

                      const assignedEditors = resolveMissionEditors(mission, members);
                      const deliverySummary = getMissionEditionDeliverySummary(mission, members);

                      const lastConcludeEvent = Array.isArray(mission.editionHistory)
                        ? [...mission.editionHistory].reverse().find((ev) => ev.type === 'CONCLUDED' || ev.serverFilePath || ev.message)
                        : null;
                      const firstEditorWithPath = assignedEditors
                        .map((ed) => deliverySummary.deliveryMap[String(ed.id)]?.serverFilePath)
                        .find(Boolean);
                      const serverPath = mission.serverFilePath || firstEditorWithPath || lastConcludeEvent?.serverFilePath || null;

                      return (
                        <tr key={mission.id}>
                          {/* Código & Status */}
                          <td>
                            <div className="ac-pp-code-box">
                              <span className="ac-rc-code">#{mCode}</span>
                              <span className="ac-status-badge-pending">
                                {isPending ? 'Aguardando' : 'Finalizada'}
                              </span>
                            </div>
                          </td>

                          {/* Pauta & Local */}
                          <td>
                            <strong className="ac-pp-row-title">{mission.description}</strong>
                            <div className="ac-pp-row-sub">
                              <MapPin size={12} className="text-amber" />
                              <span>{mission.locationName || mission.address || 'Local não definido'}</span>
                            </div>
                          </td>

                          {/* Data da Pauta */}
                          <td>
                            <div className="ac-pp-row-date">
                              <Calendar size={13} className="text-amber" />
                              <span>{formatDateBR(mission.date)}</span>
                            </div>
                            {mission.departureTime && (
                              <div className="ac-pp-row-sub" style={{ fontSize: '0.7rem' }}>
                                <Clock size={11} className="text-cyan" />
                                <span>Saída: {mission.departureTime}</span>
                              </div>
                            )}
                          </td>

                          {/* Editores & Entregas */}
                          <td>
                            {assignedEditors.length > 0 ? (
                              <div className="ac-pp-row-editors-list">
                                {assignedEditors.map((ed) => {
                                  const edDeliv = deliverySummary.deliveryMap[String(ed.id)];
                                  const isDone = edDeliv && edDeliv.status === 'delivered';
                                  const delivTimeStr = isDone && edDeliv?.deliveredAt
                                    ? formatDeliveryDateTimeBR(edDeliv.deliveredAt)
                                    : '';
                                  return (
                                    <div key={ed.id} className="ac-pp-row-editor-item">
                                      <div className="ac-pp-avatar-circle" style={{ width: '18px', height: '18px', fontSize: '0.6rem' }}>
                                        {ed.name.slice(0, 2).toUpperCase()}
                                      </div>
                                      <span className="ac-editor-name">{ed.name}</span>
                                      <span className={`ac-deliv-badge ${isDone ? 'done' : 'pending'}`}>
                                        {isDone ? '✅ Entregue' : '⏳ Pendente'}
                                      </span>
                                      {delivTimeStr && (
                                        <span className="ac-deliv-time" title={`Entregue em ${delivTimeStr}`}>
                                          ({delivTimeStr})
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <span className="text-muted" style={{ fontSize: '0.78rem' }}>Sem editores vinculados</span>
                            )}
                          </td>

                          {/* Prazo de Entrega */}
                          <td>
                            {mission.deliveryDeadlineDate ? (
                              <div>
                                <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                                  {formatDateBR(mission.deliveryDeadlineDate)} às {mission.deliveryDeadlineTime || '18:00'}
                                </div>
                                <span className={`ac-deadline-chip ${isOverdue ? 'overdue' : (isDueToday ? 'today' : 'ontime')}`} style={{ marginTop: '3px' }}>
                                  {isOverdue ? '⚠️ Atrasado' : (isDueToday ? '⏰ Hoje' : '✅ No Prazo')}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted" style={{ fontSize: '0.75rem' }}>Não estipulado</span>
                            )}
                          </td>

                          {/* Servidor / Pasta */}
                          <td>
                            {serverPath ? (
                              <div className="aphl-server-box">
                                <code className="aphl-server-code" title={serverPath}>
                                  {serverPath}
                                </code>
                                <button
                                  type="button"
                                  className="ac-btn-copy-path"
                                  onClick={() => handleCopyServerPath(serverPath, `table-${mission.id}`)}
                                  title="Copiar caminho da pasta no servidor"
                                >
                                  {copiedPathId === `table-${mission.id}` ? (
                                    <>
                                      <Check size={11} className="text-emerald" />
                                      <span>Copiado!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy size={11} />
                                      <span>Copiar</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            ) : (
                              <span className="text-muted" style={{ fontSize: '0.76rem' }}>Não informado</span>
                            )}
                          </td>

                          {/* Ações de Decisão */}
                          <td>
                            <div className="ac-pp-table-actions">
                              <button
                                type="button"
                                className="ac-btn-action-approve-sm"
                                onClick={() => handleApproveEdition(mission)}
                                title="Aprovar entrega e finalizar pós-produção"
                              >
                                <Check size={13} />
                                <span>Aprovar</span>
                              </button>

                              <button
                                type="button"
                                className="ac-btn-action-reject-sm"
                                onClick={() => setReopenModal({
                                  isOpen: true,
                                  mission,
                                  reason: '',
                                  hasNewDeadline: false,
                                  newDeadlineDate: mission.deliveryDeadlineDate || '',
                                  newDeadlineTime: mission.deliveryDeadlineTime || '18:00',
                                })}
                                title="Rejeitar e solicitar ajustes aos editores"
                              >
                                <RotateCcw size={13} />
                                <span>Rejeitar</span>
                              </button>

                              <button
                                type="button"
                                className="ac-btn-history-sm"
                                onClick={() => setSelectedHistoryMission(mission)}
                                title="Auditoria completa da missão"
                              >
                                <History size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="ac-requests-grid ac-pp-grid">
                {displayedEditions.map((mission) => {
                  const mCode = getMissionCode(mission, missions);
                  const isPending = mission.missionStatus !== 'Finalizada' && mission.missionStatus !== 'Finalizado' && mission.missionStatus !== 'Concluída';
                  const isOverdue = Boolean(mission.isOverdue || mission.editionDeliveryStatus === 'Atrasado');

                  const assignedEditors = resolveMissionEditors(mission, members);
                  const deliverySummary = getMissionEditionDeliverySummary(mission, members);
                  const hasMultipleEditors = assignedEditors.length > 1;

                  const editorName = mission.editionCompletedBy || mission.editorNamesDisplay || mission.editorName || (assignedEditors[0]?.name) || 'Editor Responsável';

                  // Extrai a última mensagem do editor deixada no histórico
                  const lastConcludeEvent = Array.isArray(mission.editionHistory)
                    ? [...mission.editionHistory].reverse().find((ev) => ev.type === 'CONCLUDED' || ev.serverFilePath || ev.message)
                    : null;
                  const editorMessage = lastConcludeEvent?.message || mission.editorMessage || null;
                  const serverPath = mission.serverFilePath || lastConcludeEvent?.serverFilePath || null;

                  return (
                    <div
                      key={mission.id}
                      className={`ac-request-card ac-pp-card ${isPending ? 'card-pending-pp' : 'card-approved'}`}
                    >
                      {/* Topo do Card: Código, Status e Ações Rápidas */}
                      <div className="ac-rc-header ac-pp-header">
                        <div className="ac-rc-header-left">
                          <span className="ac-rc-code">#{mCode}</span>
                          <span className={`ac-rc-status-pill ${isPending ? 'status-pending-gold' : 'status-approved'}`}>
                            <span className="ac-status-dot" />
                            {isPending ? 'Aguardando Confirmação' : 'Missão Finalizada'}
                          </span>
                        </div>

                        <div className="ac-rc-actions-quick">
                          <button
                            type="button"
                            className="ac-btn-history"
                            onClick={() => setSelectedHistoryMission(mission)}
                            title="Ver histórico e auditoria completa da missão"
                          >
                            <History size={13} />
                            <span>Auditoria</span>
                          </button>
                        </div>
                      </div>

                      {/* Sub-header com Data e Saída em chips elegantes */}
                      <div className="ac-rc-meta-chips">
                        <span className="ac-meta-chip">
                          <Calendar size={13} className="text-amber" />
                          <span>{formatDateBR(mission.date)}</span>
                        </span>
                        {mission.departureTime && (
                          <span className="ac-meta-chip">
                            <Clock size={13} className="text-cyan" />
                            <span>Saída: {mission.departureTime}</span>
                          </span>
                        )}
                        {hasMultipleEditors && (
                          <span className="ac-meta-chip ac-meta-chip-editors">
                            <Users size={12} />
                            <span>{assignedEditors.length} Editores • {deliverySummary.isFullyDelivered ? `${assignedEditors.length}/${assignedEditors.length} Entregues` : `${deliverySummary.deliveredCount}/${assignedEditors.length} Entregues`}</span>
                          </span>
                        )}
                      </div>

                      {/* Descrição / Pauta e Local */}
                      <div className="ac-rc-mission-box ac-pp-mission-box">
                        <h4 className="ac-rc-mission-title ac-pp-title">
                          {mission.description}
                        </h4>
                        <div className="ac-rc-mission-loc ac-pp-loc">
                          <MapPin size={14} className="text-amber" />
                          <span className="ac-pp-loc-name">{mission.locationName || mission.address || 'Local não definido'}</span>
                        </div>
                      </div>

                      {/* Painel Moderno de Pós-Produção */}
                      <div className="ac-pp-details-panel">
                        {/* Faixa Executiva Unificada de Prazo de Entrega */}
                        <div className="ac-pp-deadline-banner">
                          <div className="ac-pp-deadline-col-info">
                            <span className="ac-pp-deadline-sub">Prazo de Entrega da Edição:</span>
                            <div className="ac-pp-deadline-time-row">
                              <Calendar size={13} className="text-amber" />
                              <strong className="ac-pp-deadline-date">
                                {mission.deliveryDeadlineDate ? `${formatDateBR(mission.deliveryDeadlineDate)} às ${mission.deliveryDeadlineTime || '18:00'}` : 'Não estipulado'}
                              </strong>
                            </div>
                          </div>

                          <div className="ac-pp-deadline-col-badges">
                            <span className={`ac-pp-status-badge ${isOverdue ? 'overdue' : 'ontime'}`}>
                              {isOverdue ? '⚠️ Atrasado' : '✅ No Prazo'}
                            </span>
                            {!hasMultipleEditors && editorName && (
                              <div className="ac-pp-single-editor-pill">
                                <div className="ac-pp-avatar-circle" style={{ width: '22px', height: '22px', fontSize: '0.65rem' }}>
                                  {editorName.slice(0, 2).toUpperCase()}
                                </div>
                                <span className="ac-pp-user-name" style={{ fontSize: '0.8rem' }}>{editorName}</span>
                              </div>
                            )}
                            {hasMultipleEditors && (
                              <span className="ac-pp-editors-summary-pill">
                                <Users size={12} className="text-cyan" />
                                <span>{assignedEditors.length} Editores ({deliverySummary.isFullyDelivered ? `${assignedEditors.length}/${assignedEditors.length} Entregue` : `${deliverySummary.deliveredCount}/${assignedEditors.length}`})</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Entregas Detalhadas por Editor quando Múltiplos */}
                        {hasMultipleEditors ? (
                          <div className="ac-pp-multiple-deliveries-list">
                            {assignedEditors.map((ed) => {
                              const edDeliv = deliverySummary.deliveryMap[String(ed.id)];
                              const isDone = edDeliv && edDeliv.status === 'delivered';
                              const edPath = edDeliv?.serverFilePath || serverPath;
                              const edNote = edDeliv?.notes || (ed.name.toLowerCase().includes('mateus') ? editorMessage : null);
                              const deliveredFullStr = isDone && edDeliv?.deliveredAt
                                ? formatDeliveryDateTimeBR(edDeliv.deliveredAt)
                                : '';

                              if (!isDone && !edPath && !edNote) return null;

                              return (
                                <div key={ed.id} className="ac-pp-editor-delivery-card">
                                  <div className="ac-pp-delivery-card-header">
                                    <div className="ac-pp-delivery-editor-title">
                                      <div className="ac-pp-avatar-circle" style={{ width: '24px', height: '24px', fontSize: '0.68rem' }}>
                                        {ed.name.slice(0, 2).toUpperCase()}
                                      </div>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        <span>Entrega: <strong>{ed.name}</strong></span>
                                        {deliveredFullStr && (
                                          <small style={{ fontSize: '0.72rem', color: '#6ee7b7', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                                            <Clock size={11} />
                                            <span>Entregue em {deliveredFullStr}</span>
                                          </small>
                                        )}
                                      </div>
                                    </div>
                                    <span className={`ac-pp-delivery-done-tag ${isDone ? 'tag-done' : 'tag-pending'}`}>
                                      {isDone ? (
                                        <>
                                          <CheckCircle2 size={12} />
                                          <span>Concluído</span>
                                        </>
                                      ) : (
                                        <>
                                          <Clock size={12} />
                                          <span>Pendente</span>
                                        </>
                                      )}
                                    </span>
                                  </div>

                                  {edPath && (
                                    <div className="ac-pp-server-path-box">
                                      <div className="ac-pp-path-left">
                                        <HardDrive size={14} className="text-amber icon-shrink" />
                                        <code className="ac-pp-path-text" title={edPath}>{edPath}</code>
                                      </div>
                                      <button
                                        type="button"
                                        className="ac-btn-copy-path"
                                        onClick={() => handleCopyServerPath(edPath, `${mission.id}-${ed.id}`)}
                                        title="Copiar caminho da pasta"
                                      >
                                        {copiedPathId === `${mission.id}-${ed.id}` ? (
                                          <>
                                            <Check size={12} className="text-emerald" />
                                            <span>Copiado!</span>
                                          </>
                                        ) : (
                                          <>
                                            <Copy size={12} />
                                            <span>Copiar</span>
                                          </>
                                        )}
                                      </button>
                                    </div>
                                  )}

                                  {edNote && (
                                    <div className="ac-pp-message-bubble">
                                      <div className="ac-pp-msg-label">
                                        <MessageSquare size={12} className="text-amber" />
                                        <span>Observação do Editor:</span>
                                      </div>
                                      <p className="ac-pp-msg-content">"{edNote}"</p>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <>
                            {/* Data e Hora de Entrega (Editor Único) */}
                            {(() => {
                              const singleEd = assignedEditors[0];
                              const singleDeliv = singleEd ? deliverySummary.deliveryMap[String(singleEd.id)] : null;
                              const singleTimeStr = formatDeliveryDateTimeBR(
                                singleDeliv?.deliveredAt || mission.editionCompletedAt || lastConcludeEvent?.timestamp
                              );
                              if (!singleTimeStr) return null;
                              return (
                                <div className="ac-pp-section-block">
                                  <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '7px',
                                    padding: '7px 11px',
                                    borderRadius: '7px',
                                    background: 'rgba(16, 185, 129, 0.08)',
                                    border: '1px solid rgba(16, 185, 129, 0.25)',
                                    fontSize: '0.78rem',
                                    color: '#a7f3d0',
                                  }}>
                                    <Clock size={13} style={{ color: '#34d399', flexShrink: 0 }} />
                                    <span>
                                      Material entregue em: <strong style={{ color: '#ecfdf5' }}>{singleTimeStr}</strong>
                                    </span>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Caminho dos Arquivos no Servidor */}
                            {serverPath && (
                              <div className="ac-pp-section-block">
                                <span className="ac-pp-section-label">Local dos Arquivos no Servidor:</span>
                                <div className="ac-pp-server-path-box">
                                  <div className="ac-pp-path-left">
                                    <HardDrive size={15} className="text-amber icon-shrink" />
                                    <code className="ac-pp-path-text" title={serverPath}>{serverPath}</code>
                                  </div>
                                  <button
                                    type="button"
                                    className="ac-btn-copy-path"
                                    onClick={() => handleCopyServerPath(serverPath, mission.id)}
                                    title="Copiar caminho da pasta"
                                  >
                                    {copiedPathId === mission.id ? (
                                      <>
                                        <Check size={13} className="text-emerald" />
                                        <span>Copiado!</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy size={13} />
                                        <span>Copiar</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Mensagem / Observações do Editor */}
                            {editorMessage && (
                              <div className="ac-pp-section-block">
                                <div className="ac-pp-message-bubble">
                                  <div className="ac-pp-msg-label">
                                    <MessageSquare size={12} className="text-amber" />
                                    <span>Observação do Editor:</span>
                                  </div>
                                  <p className="ac-pp-msg-content">"{editorMessage}"</p>
                                </div>
                              </div>
                            )}
                          </>
                        )}

                        {/* Equipe de Campo */}
                        <div className="ac-pp-section-block ac-pp-field-team-section">
                          <span className="ac-pp-section-label">Equipe de Gravação em Campo:</span>
                          <div className="ac-pp-team-chips">
                            {(mission.vehicleNameDisplay || mission.driverName) && (
                              <span className="ac-team-chip ac-team-chip-veh">
                                {mission.vehicleNameDisplay && (
                                  <>
                                    <Car size={13} className="text-rose" />
                                    <strong>{mission.vehicleNameDisplay}</strong>
                                  </>
                                )}
                                {mission.vehicleNameDisplay && mission.driverName && (
                                  <span className="chip-dot-sep">•</span>
                                )}
                                {mission.driverName && (
                                  <>
                                    <User size={13} className="text-amber" />
                                    <span>Motorista: <strong>{mission.driverName}</strong></span>
                                  </>
                                )}
                              </span>
                            )}
                            {mission.teamNamesDisplay && (
                              <span className="ac-team-chip ac-team-chip-crew">
                                <Users size={13} className="text-indigo" />
                                <span>{mission.teamNamesDisplay}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Botões de Ação para o Administrador - Ultra Expressivos e Decisivos */}
                      {isPending ? (
                        <div className="ac-rc-actions-row ac-pp-actions-footer">
                          <button
                            type="button"
                            className="ac-pp-btn-action ac-pp-btn-reject"
                            onClick={() => setReopenModal({
                              isOpen: true,
                              mission,
                              reason: '',
                              hasNewDeadline: false,
                              newDeadlineDate: mission.deliveryDeadlineDate || '',
                              newDeadlineTime: mission.deliveryDeadlineTime || '18:00',
                            })}
                            title="Rejeitar material e solicitar ajustes com novo prazo aos editores"
                          >
                            <div className="ac-btn-icon-circle reject">
                              <RotateCcw size={18} />
                            </div>
                            <div className="ac-btn-text-group">
                              <strong className="ac-btn-main-title">Rejeitar e Reabrir</strong>
                              <span className="ac-btn-sub-title">Solicitar ajustes com novo prazo</span>
                            </div>
                            <ChevronRight size={17} className="ac-btn-arrow-icon" />
                          </button>

                          <button
                            type="button"
                            className="ac-pp-btn-action ac-pp-btn-approve"
                            onClick={() => handleApproveEdition(mission)}
                            title="Confirmar finalização da missão e aprovar material entregue"
                          >
                            <div className="ac-btn-icon-circle approve">
                              <CheckCheck size={20} />
                            </div>
                            <div className="ac-btn-text-group">
                              <strong className="ac-btn-main-title">Confirmar Finalização</strong>
                              <span className="ac-btn-sub-title">Aprovar entrega e concluir</span>
                            </div>
                            <ChevronRight size={17} className="ac-btn-arrow-icon" />
                          </button>
                        </div>
                      ) : (
                        <div className="ac-rc-actions-row ac-pp-actions-footer">
                          <button
                            type="button"
                            className="ac-pp-btn-action ac-pp-btn-reject"
                            style={{ width: '100%', justifyContent: 'center' }}
                            onClick={() => setReopenModal({
                              isOpen: true,
                              mission,
                              reason: '',
                              hasNewDeadline: false,
                              newDeadlineDate: mission.deliveryDeadlineDate || '',
                              newDeadlineTime: mission.deliveryDeadlineTime || '18:00',
                            })}
                            title="Reabrir esta missão finalizada e deixar em aberto novamente as entregas da pós-produção"
                          >
                            <div className="ac-btn-icon-circle reject">
                              <RotateCcw size={17} />
                            </div>
                            <div className="ac-btn-text-group" style={{ textAlign: 'center' }}>
                              <strong className="ac-btn-main-title">Reabrir Missão &amp; Pós-Produção</strong>
                              <span className="ac-btn-sub-title">Liberar entregas para nova edição</span>
                            </div>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* SUB-ABA 2: APROVAÇÕES DE HORAS EXTRAS                        */}
        {/* ============================================================ */}
        {adminTab === 'approvals_hours' && (
          <div className="ac-approvals-view">
            {/* Header com Filtros de Pendentes vs Histórico */}
            <div className="ac-approvals-toolbar">
              <div className="ac-filter-pills">
                <button
                  type="button"
                  className={`ac-pill-btn ${approvalsSubView === 'pending' ? 'active' : ''}`}
                  onClick={() => setApprovalsSubView('pending')}
                >
                  <Clock size={14} />
                  <span>Pendentes de Decisão ({pendingRequests.length})</span>
                </button>
                <button
                  type="button"
                  className={`ac-pill-btn ${approvalsSubView === 'history' ? 'active' : ''}`}
                  onClick={() => setApprovalsSubView('history')}
                >
                  <CheckCircle2 size={14} />
                  <span>Histórico Avaliado ({historyRequests.length})</span>
                </button>
              </div>

              {/* Barra de Pesquisa */}
              <div className="ac-search-box">
                <Search size={14} className="ac-search-icon" />
                <input
                  type="text"
                  placeholder="Buscar por colaborador, pauta ou missão..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="ac-search-input"
                />
                {searchTerm && (
                  <button type="button" onClick={() => setSearchTerm('')} className="ac-search-clear">
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Lista de Solicitações */}
            {displayedRequests.length === 0 ? (
              <div className="ac-empty-card">
                <div className="ac-empty-icon-box">
                  {approvalsSubView === 'pending' ? <CheckCircle2 size={42} className="text-emerald" /> : <Clock size={42} className="text-muted" />}
                </div>
                <h3>
                  {approvalsSubView === 'pending'
                    ? 'Nenhuma Solicitação de Hora Extra Pendente!'
                    : 'Nenhum histórico de horas extras encontrado.'}
                </h3>
                <p>
                  {approvalsSubView === 'pending'
                    ? 'Todas as horas extras solicitadas pelos colaboradores em campo foram avaliadas.'
                    : 'Nenhuma solicitação aprovada ou recusada corresponde aos filtros.'}
                </p>
              </div>
            ) : (
              <div className="ac-requests-grid">
                {displayedRequests.map((req) => {
                  const isPending = req.status === 'PENDING';
                  const isApproved = req.status === 'APPROVED';
                  const isProcessing = isProcessingId === req.id;

                  return (
                    <div
                      key={req.id || `${req.missionId}-${req.memberId}`}
                      className={`ac-request-card ${isPending ? 'card-pending' : isApproved ? 'card-approved' : 'card-rejected'}`}
                    >
                      {/* Topo do Card: Colaborador e Status */}
                      <div className="ac-rc-header">
                        <div className="ac-rc-member">
                          <div className="ac-rc-avatar">
                            {req.memberPhoto ? (
                              <img src={req.memberPhoto} alt={req.memberName} />
                            ) : (
                              <span>{(req.memberName || 'C').slice(0, 2).toUpperCase()}</span>
                            )}
                          </div>
                          <div className="ac-rc-member-info">
                            <strong className="ac-rc-name">{req.memberName}</strong>
                            <div className="ac-rc-meta">
                              <span className="ac-rc-role">💼 {req.memberRole}</span>
                              <span className="ac-rc-company">{req.memberCompany}</span>
                              {req.memberPix && (
                                <span className="ac-rc-pix" title="Chave PIX">
                                  🔑 PIX: {req.memberPix}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Badge de Horas e Status */}
                        <div className="ac-rc-status-box">
                          <span className="ac-rc-hours-badge">
                            +{req.hoursRequested}h
                          </span>
                          <span className={`ac-rc-status-pill status-${(req.status || 'PENDING').toLowerCase()}`}>
                            {isPending ? 'Aguardando Aprovação' : isApproved ? 'Aprovada' : 'Recusada'}
                          </span>
                        </div>
                      </div>

                      {/* Informações da Missão Vinculada */}
                      <div className="ac-rc-mission-box">
                        <div className="ac-rc-mission-top">
                          <span className="ac-rc-code">{req.missionCode || `#${req.missionId}`}</span>
                          <span className="ac-rc-date">
                            📅 {req.missionDate ? formatDateBR(req.missionDate) : '--'}
                          </span>
                          {req.departureTime && (
                            <span className="ac-rc-time">
                              🕒 {req.departureTime} às {req.returnTimeEstimated || '--:--'}
                            </span>
                          )}
                          {req.vehiclePlate && (
                            <span className="ac-rc-veh">
                              🚗 {req.vehiclePlate}
                            </span>
                          )}
                        </div>
                        <strong className="ac-rc-mission-title">
                          {req.missionTitle}
                        </strong>
                        {req.locationName && (
                          <div className="ac-rc-mission-loc">
                            <MapPin size={12} /> {req.locationName}
                          </div>
                        )}
                      </div>

                      {/* Justificativa do Colaborador */}
                      <div className="ac-rc-reason-box">
                        <span className="ac-rc-reason-lbl">Justificativa do Colaborador:</span>
                        <p className="ac-rc-reason-text">
                          "{req.reason || 'Sem justificativa detalhada.'}"
                        </p>
                        {req.createdAt && (
                          <small className="ac-rc-created-at">
                            Solicitado em {new Date(req.createdAt).toLocaleString('pt-BR')}
                          </small>
                        )}
                      </div>

                      {/* Feedback de Resposta no Histórico */}
                      {!isPending && (
                        <div className={`ac-rc-history-feedback ${isApproved ? 'approved' : 'rejected'}`}>
                          <span>
                            {isApproved ? '✅ Aprovada' : '❌ Recusada'} por <strong>{req.respondedBy || 'Administrador'}</strong>
                            {req.respondedAt && ` em ${new Date(req.respondedAt).toLocaleString('pt-BR')}`}
                          </span>
                        </div>
                      )}

                      {/* Botões de Decisão (Apenas quando pendente) */}
                      {isPending && (
                        <div className="ac-rc-actions-row">
                          <button
                            type="button"
                            className="ac-btn-approve"
                            disabled={isProcessing}
                            onClick={() => handleAction(req.missionId, req.id, 'APPROVE')}
                          >
                            <Check size={15} />
                            <span>Aprovar +{req.hoursRequested}h</span>
                          </button>
                          <button
                            type="button"
                            className="ac-btn-reject"
                            disabled={isProcessing}
                            onClick={() => handleAction(req.missionId, req.id, 'REJECT')}
                          >
                            <X size={15} />
                            <span>Recusar</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* SUB-ABA 3: DIÁRIAS & FECHAMENTO FINANCEIRO                  */}
        {/* ============================================================ */}
        {adminTab === 'payouts' && (
          <div className="ac-payouts-view">
            <TeamPayoutsDashboard
              currentUser={currentUser}
              members={members}
              missions={missions}
              vehicles={vehicles}
              baseLocation={baseLocation}
              onUpdateMember={onUpdateMember}
              onEditMission={onEditMission}
            />
          </div>
        )}

        {/* ============================================================ */}
        {/* SUB-ABA 4: INTELIGÊNCIA & RANKING                            */}
        {/* ============================================================ */}
        {adminTab === 'ranking' && (
          <div className="ac-ranking-view">
            <TeamPerformanceRanking
              members={members}
              missions={missions}
              onOpenEditMember={null}
            />
          </div>
        )}

        {/* ============================================================ */}
        {/* SUB-ABA 5: ALUGUEL & ESTOQUE DE EQUIPAMENTOS                 */}
        {/* ============================================================ */}
        {adminTab === 'rentals' && (
          <div className="ac-rentals-view">
            <EquipmentRentalManager currentUser={currentUser} />
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* 4. MODAL: REJEITAR E REABRIR PÓS-PRODUÇÃO (MODERNO & SELETIVO) */}
      {/* ============================================================== */}
      <RejectPostProductionModal
        isOpen={Boolean(reopenModal.isOpen)}
        onClose={() => setReopenModal({ isOpen: false, mission: null })}
        mission={reopenModal.mission}
        missions={missions}
        members={members}
        currentUser={currentUser}
        onConfirmReopen={handleConfirmReopen}
      />

      {/* ============================================================== */}
      {/* 5. MODAL: HISTÓRICO COMPLETO DA MISSÃO                         */}
      {/* ============================================================== */}
      {selectedHistoryMission && (
        <MissionHistoryModal
          isOpen={Boolean(selectedHistoryMission)}
          onClose={() => setSelectedHistoryMission(null)}
          mission={selectedHistoryMission}
          missions={missions}
        />
      )}
    </div>
  );
}
