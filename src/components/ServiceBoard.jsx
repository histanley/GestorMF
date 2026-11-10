import React, { useState, useMemo } from 'react';
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
  Trash2,
  Navigation,
  Printer,
  Plus,
  Search,
  Eye,
  X,
  ExternalLink,
  Phone,
  Briefcase,
  FileText,
  Sparkles,
  Route,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  Hash,
  SunDim,
  Swords,
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
  HardDrive,
} from 'lucide-react';
import {
  getMissionTotalKm,
  getNavigationLinks,
  getMissionAllocations,
  computeVehicleFuelTelemetry,
  computeMissionVehicleFuelBreakdown,
  getMissionCode,
  isElectricVehicle,
  getFuelUnit,
  getFuelNoun,
  getFuelTypeIcon,
  getFuelTypeBadgeClass,
  calculateSuggestedDepartureTime,
} from '../utils/geo';
import { confirmDialog, alertDialog } from '../utils/dialog';
import MissionHistoryModal from './MissionHistoryModal';

// Formata YYYY-MM-DD para DD/MM/AAAA
function formatDateBR(dateStr) {
  if (!dateStr || !String(dateStr).includes('-')) return dateStr || '--/--/----';
  const parts = String(dateStr).split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

// Calcula horário 1h antes (Início do Preparo) e 30min depois (Encerramento Automático)
function addMinutesToTime(timeStr, deltaMinutes) {
  if (!timeStr || !String(timeStr).includes(':')) return '--:--';
  const [h, m] = String(timeStr).split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return '--:--';
  const total = ((h * 60 + m + deltaMinutes) % 1440 + 1440) % 1440;
  const nh = Math.floor(total / 60);
  const nm = total % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

export default function ServiceBoard({
  missions = [],
  vehicles = [],
  members = [],
  baseLocation,
  fuelPricePerLiter = 6.45,
  settings = null,
  userRole = 'admin',
  currentUser = null,
  onNewMission,
  onEditMission,
  onDeleteMission,
  onSelectMissionOnMap,
  onUpdateMissionStatus,
  onUpdateEditionStatus,
  onSaveMission,
}) {
  const fuelSettings = settings || (typeof fuelPricePerLiter === 'object' ? fuelPricePerLiter : { gasolinePricePerLiter: fuelPricePerLiter, dieselPricePerLiter: 6.89 });
  const canCreateMission = userRole === 'admin' || userRole === 'manager';
  const canEditMission = userRole === 'admin' || userRole === 'manager';
  const canDeleteMission = userRole === 'admin';
  const canViewFinancials = userRole === 'admin' || userRole === 'manager';
  const canAdminManageEdition = userRole === 'admin' || userRole === 'manager';
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMissionStatus, setFilterMissionStatus] = useState('ATIVAS');
  const [filterEditionStatus, setFilterEditionStatus] = useState('TODOS');
  const [selectedDetailMissionId, setSelectedDetailMissionId] = useState(null);
  const [selectedHistoryMission, setSelectedHistoryMission] = useState(null);
  const [reopenModal, setReopenModal] = useState({
    isOpen: false,
    mission: null,
    reason: '',
    hasNewDeadline: false,
    newDeadlineDate: '',
    newDeadlineTime: '18:00',
  });
  const [concludeModal, setConcludeModal] = useState({
    isOpen: false,
    mission: null,
    isLate: false,
    deadlineStr: '',
    serverFilePath: '',
    editorMessage: '',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Localiza o colaborador (membro) vinculado ao usuário atualmente logado
  const userMember = useMemo(() => {
    if (!currentUser) return null;
    return members.find(
      (m) =>
        (m.userId && (String(m.userId) === String(currentUser.id))) ||
        (m.id && (String(m.id) === String(currentUser.id))) ||
        (currentUser.email && m.email && m.email.toLowerCase() === currentUser.email.toLowerCase()) ||
        (currentUser.name && m.name && (
          m.name.toLowerCase() === currentUser.name.toLowerCase() ||
          m.name.toLowerCase().includes(currentUser.name.toLowerCase()) ||
          currentUser.name.toLowerCase().includes(m.name.toLowerCase())
        ))
    ) || null;
  }, [members, currentUser]);

  // Função robusta que valida se o usuário logado é o editor responsável pela missão
  const checkIsAssignedEditor = (mission) => {
    if (!currentUser || !mission) return false;
    const editorIds = Array.isArray(mission.editorIds) ? mission.editorIds.map(String) : [];
    const cId = String(currentUser.id);
    const mId = userMember ? String(userMember.id) : null;

    if (mission.editorId && (String(mission.editorId) === cId || (mId && String(mission.editorId) === mId))) {
      return true;
    }
    if (editorIds.includes(cId) || (mId && editorIds.includes(mId))) {
      return true;
    }

    const names = (mission.editorNamesDisplay || mission.editorName || '').toLowerCase();
    const uName = (currentUser.name || '').toLowerCase();
    const mName = (userMember?.name || '').toLowerCase();

    if (uName && names.includes(uName)) return true;
    if (mName && names.includes(mName)) return true;

    const uFirst = uName.split(' ')[0];
    const mFirst = mName.split(' ')[0];
    if (uFirst && uFirst.length >= 3 && names.includes(uFirst)) return true;
    if (mFirst && mFirst.length >= 3 && names.includes(mFirst)) return true;

    return false;
  };

  // Verifica dinamicamente se a missão possui pós-produção estipulada e se já está em atraso
  const checkIsMissionOverdue = (mission) => {
    if (!mission) return false;
    if (
      mission.missionStatus === 'Finalizada' ||
      mission.missionStatus === 'Finalizado' ||
      mission.missionStatus === 'Concluída'
    ) {
      return false;
    }
    if (mission.reopenReason || mission.isOverdue) return true;
    if (!mission.deliveryDeadlineDate) return false;

    const dateParts = String(mission.deliveryDeadlineDate).split('-').map(Number);
    if (dateParts.length < 3) return false;
    const timeParts = String(mission.deliveryDeadlineTime || '18:00').split(':').map(Number);
    const [y, m, d] = dateParts;
    const [h, min] = timeParts;
    const deadlineDate = new Date(y, m - 1, d, isNaN(h) ? 18 : h, isNaN(min) ? 0 : min, 0, 0);

    return Date.now() > deadlineDate.getTime();
  };

  // Ação: Concluir Pós-Produção (Validando pontualidade em relação ao prazo estipulado)
  // Ação: Concluir Pós-Produção (Abre modal de confirmação com suporte a mensagem do editor para gestão)
  const handleConcludeEdition = async (mission) => {
    const isAssignedEditor = checkIsAssignedEditor(mission);
    const canConclude = isAssignedEditor || canAdminManageEdition;

    if (!canConclude) {
      await alertDialog({
        title: 'Acesso Restrito',
        message: 'Somente o editor responsável designado para esta pós-produção (ou Administrador) pode dar esta tarefa como concluída.',
        variant: 'warning',
      });
      return;
    }

    const now = new Date();
    let isLate = false;
    let deadlineStr = '';
    if (mission.deliveryDeadlineDate) {
      const deadlineDateStr = `${mission.deliveryDeadlineDate}T${mission.deliveryDeadlineTime || '18:00'}:00`;
      const deadlineObj = new Date(deadlineDateStr);
      if (!isNaN(deadlineObj.getTime())) {
        isLate = now.getTime() > deadlineObj.getTime();
        deadlineStr = `${formatDateBR(mission.deliveryDeadlineDate)} às ${mission.deliveryDeadlineTime || '18:00'}`;
      }
    }

    setConcludeModal({
      isOpen: true,
      mission,
      isLate,
      deadlineStr,
      serverFilePath: mission.serverFilePath || '',
      editorMessage: '',
    });
  };

  const handleConfirmConclude = async () => {
    const mission = concludeModal.mission;
    if (!mission) return;

    const now = new Date();
    const isLate = concludeModal.isLate;
    const deadlineStr = concludeModal.deadlineStr;
    const serverFilePath = (concludeModal.serverFilePath || '').trim();
    const editorMessage = (concludeModal.editorMessage || '').trim();

    const deliveryStatus = isLate ? 'Fora do Prazo' : 'Dentro do Prazo';
    const descParts = [
      `Pós-produção entregue por ${currentUser?.name || 'Editor'}.`,
      serverFilePath ? `Local no Servidor: "${serverFilePath}".` : null,
      editorMessage ? `Mensagem do editor: "${editorMessage}".` : null,
      `Avaliação de pontualidade: ${deliveryStatus}.`
    ].filter(Boolean).join(' ');

    const newEvent = {
      id: 'h-' + Date.now(),
      type: 'COMPLETED',
      user: currentUser?.name || 'Editor Responsável',
      timestamp: now.toISOString(),
      title: `Edição Concluída (${deliveryStatus})`,
      description: descParts,
      status: deliveryStatus,
      isOverdue: isLate,
      deadline: deadlineStr,
      serverFilePath: serverFilePath || null,
      message: editorMessage || null,
    };

    const updatedHistory = Array.isArray(mission.editionHistory)
      ? [...mission.editionHistory, newEvent]
      : [newEvent];

    let updatedNotes = mission.notes || '';
    const noteItems = [];
    if (serverFilePath) noteItems.push(`Local no Servidor: ${serverFilePath}`);
    if (editorMessage) noteItems.push(editorMessage);
    if (noteItems.length > 0) {
      const authorTag = `[${currentUser?.name || 'Editor'} - ${formatDateBR(now)}]: `;
      const noteContent = authorTag + noteItems.join(' | ');
      updatedNotes = updatedNotes ? `${updatedNotes}\n${noteContent}` : noteContent;
    }

    const missionVer = (mission.version !== undefined && mission.version !== null) ? Number(mission.version) : 1;
    const updatedMission = {
      ...mission,
      editionStatus: 'Edição Concluída',
      missionStatus: 'Pendente',
      editionDeliveryStatus: deliveryStatus,
      serverFilePath: serverFilePath || mission.serverFilePath || null,
      editionCompletedAt: now.toISOString(),
      editionCompletedBy: currentUser?.name || 'Editor',
      isOverdue: isLate ? 1 : 0,
      reopenReason: '',
      notes: updatedNotes,
      editionHistory: updatedHistory,
      version: missionVer,
    };

    setConcludeModal({ isOpen: false, mission: null, isLate: false, deadlineStr: '', serverFilePath: '', editorMessage: '' });

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
      await alertDialog({
        title: '✅ Tarefa Concluída!',
        message: 'A entrega da pós-produção foi registrada com sucesso! O status agora é "Aguardando Confirmação" da gestão.',
        variant: 'success',
      });
    } else if (onUpdateEditionStatus) {
      onUpdateEditionStatus(mission.id, 'Edição Concluída');
    }
  };

  // Ação: Reabrir / Recusar serviço (Apenas Administradores / Gestores)
  const handleReopenClick = async (mission) => {
    if (!canAdminManageEdition) {
      await alertDialog({
        title: 'Acesso Restrito',
        message: 'Apenas Administradores e Gestores têm permissão para recusar serviços e solicitar retrabalho.',
        variant: 'warning',
      });
      return;
    }
    setReopenModal({
      isOpen: true,
      mission,
      reason: '',
      hasNewDeadline: false,
      newDeadlineDate: mission.deliveryDeadlineDate || mission.date || '',
      newDeadlineTime: mission.deliveryDeadlineTime || '18:00',
    });
  };

  const handleConfirmReopen = async () => {
    if (!reopenModal.reason.trim()) {
      await alertDialog({
        title: 'Motivo Obrigatório',
        message: 'Por favor, descreva os ajustes necessários ou o motivo da recusa do serviço.',
        variant: 'warning',
      });
      return;
    }
    const m = reopenModal.mission;
    const reason = reopenModal.reason.trim();
    const now = new Date();
    const hasNewDeadline = reopenModal.hasNewDeadline && reopenModal.newDeadlineDate;
    const newDeadlineStr = hasNewDeadline
      ? `${formatDateBR(reopenModal.newDeadlineDate)} às ${reopenModal.newDeadlineTime || '18:00'}`
      : (m.deliveryDeadlineDate ? `${formatDateBR(m.deliveryDeadlineDate)} às ${m.deliveryDeadlineTime || '18:00'}` : 'Não estipulado');

    const newEvent = {
      id: 'h-' + Date.now(),
      type: 'REOPENED',
      user: currentUser?.name || 'Administrador',
      timestamp: now.toISOString(),
      title: 'Material Rejeitado e Reaberto para Ajustes',
      description: `Motivo da rejeição / ajustes solicitados: "${reason}".` + (hasNewDeadline ? ` Novo prazo estipulado: ${newDeadlineStr}.` : ''),
      reason,
      newDeadline: hasNewDeadline ? newDeadlineStr : null,
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
      isOverdue: 1,
      reopenReason: reason,
      deliveryDeadlineDate: hasNewDeadline ? reopenModal.newDeadlineDate : m.deliveryDeadlineDate,
      deliveryDeadlineTime: hasNewDeadline ? (reopenModal.newDeadlineTime || '18:00') : m.deliveryDeadlineTime,
      editionHistory: updatedHistory,
      version: mVer,
    };

    if (onSaveMission) {
      const res = await onSaveMission(updatedMission);
      if (res && res.success === false) {
        await alertDialog({
          title: 'Erro ao Rejeitar',
          message: res.error || 'Não foi possível registrar a recusa do serviço.',
          variant: 'danger',
        });
        return;
      }
      await alertDialog({
        title: '↩️ Serviço Reaberto',
        message: `A missão "${m.description}" retornou para o status Pendente (Em Edição). Os editores foram notificados com as orientações.` + (hasNewDeadline ? ` Novo prazo: ${newDeadlineStr}.` : ''),
        variant: 'warning',
      });
    }
    setReopenModal({ isOpen: false, mission: null, reason: '', hasNewDeadline: false, newDeadlineDate: '', newDeadlineTime: '18:00' });
  };

  // Ação: Aprovar Entrega Final da Pós-Produção
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
      description: `Pós-produção aprovada para entrega final por ${currentUser?.name || 'Administrador'}. Serviço encerrado com sucesso.`,
      isOverdue: false,
    };

    const updatedHistory = Array.isArray(mission.editionHistory)
      ? [...mission.editionHistory, newEvent]
      : [newEvent];

    const mVer = (mission.version !== undefined && mission.version !== null) ? Number(mission.version) : 1;
    const updatedMission = {
      ...mission,
      editionStatus: 'Edição Concluída',
      missionStatus: 'Finalizada',
      isOverdue: 0,
      reopenReason: '',
      editionHistory: updatedHistory,
      version: mVer,
    };

    if (onSaveMission) {
      const res = await onSaveMission(updatedMission);
      if (res && res.success === false) {
        await alertDialog({
          title: 'Erro ao Concluir',
          message: res.error || 'Não foi possível aprovar a entrega da pós-produção.',
          variant: 'danger',
        });
        return;
      }
      await alertDialog({
        title: '⭐ Missão Finalizada!',
        message: `A entrega da pós-produção da pauta "${mission.description}" foi aprovada e a missão foi FINALIZADA e encerrada com sucesso!`,
        variant: 'success',
      });
    }
  };

  // Resolve o motorista de uma missão (por driverId, driverName ou 1º membro da equipe)
  const resolveMissionDriver = (mission) => {
    if (!mission) return { member: null, name: '' };
    if (mission.driverId) {
      const byId = members.find((m) => m.id === mission.driverId);
      if (byId) return { member: byId, name: byId.name };
    }
    if (mission.driverName) {
      const byName = members.find(
        (m) => m.name.toLowerCase() === mission.driverName.trim().toLowerCase()
      );
      return { member: byName || null, name: mission.driverName.trim() };
    }
    if (Array.isArray(mission.teamIds) && mission.teamIds.length > 0) {
      const firstMem = members.find((m) => m.id === mission.teamIds[0]);
      if (firstMem) return { member: firstMem, name: firstMem.name };
    }
    if (mission.teamNamesDisplay) {
      const firstName = mission.teamNamesDisplay.split(',')[0]?.trim();
      if (firstName) {
        const byFirst = members.find((m) => m.name.toLowerCase() === firstName.toLowerCase());
        return { member: byFirst || null, name: firstName };
      }
    }
    return { member: null, name: '' };
  };

  // Resolve a viatura alocada para a missão
  const resolveMissionVehicle = (mission) => {
    if (!mission) return null;
    return (
      vehicles.find((v) => v.id === mission.vehicleId) ||
      vehicles.find(
        (v) =>
          mission.vehicleNameDisplay &&
          (mission.vehicleNameDisplay.includes(v.plate) ||
            mission.vehicleNameDisplay.toLowerCase().includes(v.name.toLowerCase()))
      ) ||
      null
    );
  };

  // Verifica se um colaborador é motorista de alguma viatura da missão
  const isMemberMissionDriver = (mem, mission, allocations = [], driverInfo = null) => {
    if (!mem || !mission) return false;
    const dInfo = driverInfo || resolveMissionDriver(mission);
    return (
      allocations.some(
        (a) =>
          (a.driverId && a.driverId === mem.id) ||
          (a.driverName && a.driverName.toLowerCase() === mem.name.toLowerCase())
      ) ||
      (mission.driverId && mem.id === mission.driverId) ||
      (dInfo?.name && mem.name.toLowerCase() === dInfo.name.toLowerCase())
    );
  };

  // Resolve lista de objetos de membros escalados na missão (Motorista SEMPRE em 1º lugar!)
  const resolveMissionTeamMembers = (mission) => {
    if (!mission) return [];
    const result = [];
    const seen = new Set();

    if (Array.isArray(mission.teamIds)) {
      mission.teamIds.forEach((id) => {
        const mem = members.find((m) => m.id === id);
        if (mem && !seen.has(mem.id)) {
          seen.add(mem.id);
          result.push(mem);
        }
      });
    }

    if (mission.teamNamesDisplay) {
      mission.teamNamesDisplay.split(',').forEach((rawName) => {
        const trimmed = rawName.trim();
        if (!trimmed) return;
        const mem = members.find(
          (m) =>
            m.name.toLowerCase() === trimmed.toLowerCase() ||
            m.name.toLowerCase().split(' ')[0] === trimmed.toLowerCase()
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

    // Garante que o(s) motorista(s) alocado(s) também constem na lista e fiquem SEMPRE em 1º lugar
    const allocations = getMissionAllocations(mission, vehicles, members);
    const driverInfo = resolveMissionDriver(mission);

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

    // Ordena colocando todos os motoristas no topo (1º a aparecer)
    return result.sort((a, b) => {
      const aIsDrv = isMemberMissionDriver(a, mission, allocations, driverInfo) ? 1 : 0;
      const bIsDrv = isMemberMissionDriver(b, mission, allocations, driverInfo) ? 1 : 0;
      return bIsDrv - aIsDrv;
    });
  };

  // Resolve lista de editores responsáveis pela pós-produção
  const resolveMissionEditors = (mission) => {
    if (!mission) return [];
    const found = [];
    const seen = new Set();

    if (Array.isArray(mission.editorIds) && mission.editorIds.length > 0) {
      mission.editorIds.forEach((id) => {
        const mem = members.find((m) => m.id === id);
        if (mem && !seen.has(mem.id)) {
          seen.add(mem.id);
          found.push(mem);
        }
      });
    }

    if (mission.editorId) {
      const mem = members.find((m) => m.id === mission.editorId);
      if (mem && !seen.has(mem.id)) {
        seen.add(mem.id);
        found.push(mem);
      }
    }

    if (found.length === 0 && (mission.editorNamesDisplay || mission.editorName)) {
      const names = (mission.editorNamesDisplay || mission.editorName).split(',');
      names.forEach((n) => {
        const tr = n.trim();
        if (tr && !seen.has(tr.toLowerCase())) {
          seen.add(tr.toLowerCase());
          const byName = members.find((m) => m.name.toLowerCase() === tr.toLowerCase());
          found.push(byName || { id: `ed-${tr}`, name: tr, role: 'Editor de Vídeo', company: 'MegaFilmes' });
        }
      });
    }

    return found;
  };

  const filteredMissions = missions.filter((m) => {
    const driverInfo = resolveMissionDriver(m);
    const mCode = getMissionCode(m, missions);
    const q = searchTerm.toLowerCase().trim();
    const cleanQ = q.replace(/^#/, '');
    const matchesSearch =
      !q ||
      mCode.toLowerCase().includes(cleanQ) ||
      m.description?.toLowerCase().includes(q) ||
      m.locationName?.toLowerCase().includes(q) ||
      m.address?.toLowerCase().includes(q) ||
      m.teamNamesDisplay?.toLowerCase().includes(q) ||
      m.vehicleNameDisplay?.toLowerCase().includes(q) ||
      driverInfo.name?.toLowerCase().includes(q);

    const isFinalizada =
      m.missionStatus === 'Finalizada' ||
      m.missionStatus === 'Finalizado' ||
      m.missionStatus === 'Concluída';
    const matchesMissionStatus =
      (filterMissionStatus === 'ATIVAS' && !isFinalizada && m.missionStatus !== 'Cancelada') ||
      filterMissionStatus === 'TODOS' ||
      (filterMissionStatus === 'ANDAMENTO' &&
        (m.missionStatus === 'Em Execução' || m.missionStatus === 'Em Preparo')) ||
      (filterMissionStatus === 'Pendente' && m.missionStatus === 'Pendente') ||
      ((filterMissionStatus === 'Finalizado' || filterMissionStatus === 'Finalizada') && isFinalizada) ||
      m.missionStatus === filterMissionStatus;

    const matchesEditionStatus =
      filterEditionStatus === 'TODOS' || m.editionStatus === filterEditionStatus;

    return matchesSearch && matchesMissionStatus && matchesEditionStatus;
  });

  // Paginação (até 10 missões por página)
  const totalPages = Math.max(1, Math.ceil(filteredMissions.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
  const paginatedMissions = filteredMissions.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Estatísticas rápidas da tabela
  const countExec = missions.filter(
    (m) => m.missionStatus === 'Em Execução' || m.missionStatus === 'Em Preparo'
  ).length;
  const countAgendada = missions.filter(
    (m) => !m.missionStatus || m.missionStatus === 'Agendada'
  ).length;
  const countPendente = missions.filter(
    (m) => m.missionStatus === 'Pendente'
  ).length;
  const countOverdue = missions.filter(
    (m) => m.missionStatus === 'Pendente' && checkIsMissionOverdue(m)
  ).length;
  const countFinalizado = missions.filter(
    (m) =>
      m.missionStatus === 'Finalizada' ||
      m.missionStatus === 'Finalizado' ||
      m.missionStatus === 'Concluída'
  ).length;
  const totalKmFiltered = filteredMissions.reduce((acc, m) => acc + getMissionTotalKm(m), 0);
  const totalFuelFiltered = filteredMissions.reduce(
    (acc, m) => acc + (parseFloat(m.estimatedFuelCost) || 0),
    0
  );

  // Missão atualmente aberta no Card de Detalhes (sempre sincronizada em tempo real)
  const detailMission = selectedDetailMissionId
    ? missions.find((m) => m.id === selectedDetailMissionId) || null
    : null;

  // Rótulo legível do filtro atual para o cabeçalho de impressão
  const getFilterStatusLabel = () => {
    switch (filterMissionStatus) {
      case 'ATIVAS':
        return 'Missões Ativas (Agendadas, Em Preparo e Em Execução)';
      case 'ANDAMENTO':
        return 'Em Andamento (Em Preparo e Em Execução)';
      case 'Agendada':
        return 'Apenas Missões Agendadas';
      case 'Pendente':
        return 'Missões Pendentes de Pós-Produção';
      case 'Finalizado':
        return 'Histórico de Missões Finalizadas';
      default:
        return 'Todas as Missões';
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const emittedAtStr = new Date().toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="service-board-container">
      {/* =====================================================================
          RELATÓRIO EXECUTIVO DE IMPRESSÃO / ORDEM DE PAREDE (EXCLUSIVO PRINT)
          ===================================================================== */}
      <div className="print-wall-sheet">
        {/* Cabeçalho Institucional do Documento */}
        <header className="print-doc-header">
          <div className="print-brand-block">
            <div className="print-brand-mark">MF</div>
            <div className="print-brand-text">
              <span className="print-doc-kicker">MEGAFILMES &amp; MEGA PRINT • SISTEMA GESTORMF</span>
              <h1 className="print-doc-title">TABELA DE SERVIÇO &amp; ESCALA OPERACIONAL</h1>
              <p className="print-doc-subtitle">
                Ordem de parede de filmagens, impressões, equipes escaladas, viaturas, motoristas e combustível
              </p>
            </div>
          </div>

          <div className="print-meta-block">
            <div className="print-meta-row">
              <span>Emissão:</span>
              <strong>{emittedAtStr}</strong>
            </div>
            <div className="print-meta-row">
              <span>Recorte / Filtro:</span>
              <strong>{getFilterStatusLabel()}</strong>
            </div>
            {filterEditionStatus !== 'TODOS' && (
              <div className="print-meta-row">
                <span>Pós-Produção:</span>
                <strong>{filterEditionStatus}</strong>
              </div>
            )}
            <div className="print-meta-row">
              <span>Total Listado:</span>
              <strong>
                {filteredMissions.length} {filteredMissions.length === 1 ? 'pauta' : 'pautas'}
              </strong>
            </div>
          </div>
        </header>

        {/* Faixa Executiva de Indicadores (KPIs do Documento) */}
        <section className="print-summary-strip">
          <div className="print-summary-card">
            <span className="psc-label">PAUTAS NO DOCUMENTO</span>
            <strong className="psc-value">{filteredMissions.length} Missões</strong>
          </div>
          <div className="print-summary-card">
            <span className="psc-label">EM EXECUÇÃO / PREPARO</span>
            <strong className="psc-value psc-red">{countExec} Em Andamento</strong>
          </div>
          <div className="print-summary-card">
            <span className="psc-label">AGENDADAS</span>
            <strong className="psc-value psc-cyan">{countAgendada} Pautas</strong>
          </div>
          <div className="print-summary-card">
            <span className="psc-label">FINALIZADAS (HISTÓRICO)</span>
            <strong className="psc-value psc-green">{countFinalizado} Concluídas</strong>
          </div>
          <div className="print-summary-card psc-highlight">
            <span className="psc-label">PERCURSO &amp; COMBUSTÍVEL (FILTRO)</span>
            <strong className="psc-value psc-amber">
              {totalKmFiltered.toFixed(1)} km • R$ {totalFuelFiltered.toFixed(2)}
            </strong>
          </div>
        </section>

        {/* Tabela Oficial 100% Enquadrada (Sem Cortes Horizontais) */}
        <table className="print-schedule-table">
          <thead>
            <tr>
              <th className="pcol-desc">CÓDIGO &amp; DESCRIÇÃO DA MISSÃO</th>
              <th className="pcol-local">LOCAL &amp; PERCURSO</th>
              <th className="pcol-datetime">DATA &amp; HORÁRIOS</th>
              <th className="pcol-team">EQUIPE ESCALADA</th>
              <th className="pcol-status">STATUS &amp; PÓS-PRODUÇÃO</th>
              <th className="pcol-vehicle">VIATURA, MOTORISTA &amp; COMBUSTÍVEL</th>
            </tr>
          </thead>
          <tbody>
            {filteredMissions.length === 0 ? (
              <tr>
                <td colSpan="6" className="print-empty-row">
                  Nenhuma missão ou pauta encontrada para os filtros selecionados.
                </td>
              </tr>
            ) : (
              filteredMissions.map((mission) => {
                const missionCode = getMissionCode(mission, missions);
                const allocations = getMissionAllocations(mission, vehicles, members);
                const driverInfo = resolveMissionDriver(mission);
                const teamList = resolveMissionTeamMembers(mission);
                const totalKm = getMissionTotalKm(mission);
                const statusSlug = (mission.missionStatus || 'Agendada')
                  .toLowerCase()
                  .normalize('NFD')
                  .replace(/[\u0300-\u036f]/g, '')
                  .replace(/\s+/g, '-');

                return (
                  <tr key={`print-${mission.id}`} className={`print-row prow-${statusSlug}`}>
                    {/* 1. CÓDIGO & DESCRIÇÃO */}
                    <td className="pcol-desc">
                      <div className="pcell-desc">
                        <span className="print-code-badge">#{missionCode}</span>
                        {mission.isRecurring && (
                          <span className="print-rec-badge">🔁 {mission.recurrenceDays || 'Recorrente'}</span>
                        )}
                        <strong className="print-mission-title">{mission.description}</strong>
                        {mission.notes && <p className="print-mission-notes">{mission.notes}</p>}
                      </div>
                    </td>

                    {/* 2. LOCAL & PERCURSO */}
                    <td className="pcol-local">
                      <div className="pcell-local">
                        <strong className="print-loc-name">
                          {mission.locationName || 'Local não informado'}
                        </strong>
                        {mission.address && (
                          <span className="print-loc-addr">{mission.address}</span>
                        )}
                        {mission.distanceKm > 0 && (
                          <span className="print-km-badge">
                            Ida/Volta: {totalKm} km ({mission.distanceKm} km/trecho)
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 3. DATA & HORÁRIOS */}
                    <td className="pcol-datetime">
                      <div className="pcell-datetime">
                        <span className="print-date-badge">{formatDateBR(mission.date)}</span>
                        <div className="print-times-list">
                          <div>
                            <span>Saída:</span> <strong>{mission.departureTime || '--:--'}</strong>
                          </div>
                          <div>
                            <span>Chegada:</span>{' '}
                            <strong>{mission.arrivalTimeEstimated || '--:--'}</strong>
                          </div>
                          {mission.returnTimeEstimated && (
                            <div>
                              <span>Retorno:</span> <strong>{mission.returnTimeEstimated}</strong>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* 4. EQUIPE ESCALADA */}
                    <td className="pcol-team">
                      <div className="pcell-team">
                        {(teamList.length > 0 || (Array.isArray(mission.guests) && mission.guests.length > 0)) ? (
                          <>
                            {teamList.map((mem, i) => {
                              const isDriver =
                                allocations.some(
                                  (a) =>
                                    (a.driverId && a.driverId === mem.id) ||
                                    (a.driverName &&
                                      a.driverName.toLowerCase() === mem.name.toLowerCase())
                                ) ||
                                (mission.driverId && mem.id === mission.driverId) ||
                                (driverInfo.name &&
                                  mem.name.toLowerCase() === driverInfo.name.toLowerCase());
                              return (
                                <span
                                  key={`pmem-${mem.id || i}`}
                                  className={`print-member-chip ${isDriver ? 'is-driver' : ''}`}
                                >
                                  {mem.name}
                                  {isDriver ? ' (Motorista)' : ''}
                                </span>
                              );
                            })}
                            {Array.isArray(mission.guests) && mission.guests.map((g, gi) => {
                              const gName = typeof g === 'string' ? g : g.name;
                              return (
                                <span
                                  key={`pguest-${gi}`}
                                  className="print-member-chip is-guest"
                                >
                                  👤 {gName} (Convidado)
                                </span>
                              );
                            })}
                          </>
                        ) : (
                          <span className="print-muted">Sem equipe escalada</span>
                        )}
                      </div>
                    </td>

                    {/* 5. STATUS & PÓS-PRODUÇÃO */}
                    <td className="pcol-status">
                      <div className="pcell-status">
                        <span className={`print-status-pill pstatus-${statusSlug}`}>
                          {mission.missionStatus || 'Agendada'}
                        </span>
                        <span className="print-edition-box">
                          Pós-Prod.: <strong>{mission.editionStatus || 'Pendente'}</strong>
                        </span>
                      </div>
                    </td>

                    {/* 6. VIATURA, MOTORISTA & COMBUSTÍVEL */}
                    <td className="pcol-vehicle">
                      <div className="pcell-vehicle">
                        {allocations.length > 0 ? (
                          <>
                            {allocations.map((alloc, aIdx) => {
                              const vObj = alloc.vehicle;
                              const vTel = vObj
                                ? computeVehicleFuelTelemetry(vObj, missions, fuelSettings)
                                : null;
                              const mBd = vObj
                                ? computeMissionVehicleFuelBreakdown({
                                  vehicle: vObj,
                                  totalRoundTripKm: totalKm,
                                  currentTelemetry: vTel,
                                  fuelPricePerLiter: fuelSettings,
                                })
                                : null;

                              return (
                                <div key={`pveh-${aIdx}`} className="print-veh-block">
                                  <div className="print-veh-header">
                                    <strong>{vObj ? vObj.name : alloc.vehicleName}</strong>
                                    {vObj && <span className="print-veh-plate">{vObj.plate}</span>}
                                  </div>
                                  <div className="print-veh-driver">
                                    Motorista:{' '}
                                    <strong>
                                      {alloc.driverName || driverInfo.name || 'A definir'}
                                    </strong>
                                  </div>
                                  {vTel && (
                                    <div
                                      className={`print-veh-tank ${vTel.isReserveAlert ? 'tank-reserve' : 'tank-ok'
                                        }`}
                                    >
                                      Tanque: {vTel.currentPercent}% ({vTel.currentLiters}L /{' '}
                                      {vTel.tankCapacity}L)
                                    </div>
                                  )}
                                  {mBd && mBd.exceedsFullTankCapacity && (
                                    <div className="print-veh-excess">
                                      Excedente &gt; 1 Tanque: +{mBd.excessOverFullTankLiters}L (+R${' '}
                                      {Number(mBd.excessOverFullTankCost || 0).toFixed(2)})
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            <div className="print-fuel-summary">
                              Consumo Missão: <strong>-{mission.estimatedFuelLiters || 0}L</strong> •{' '}
                              <strong>R$ {Number(mission.estimatedFuelCost || 0).toFixed(2)}</strong>
                            </div>
                          </>
                        ) : (
                          <span className="print-muted">Sem viatura alocada</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Rodapé de Conferência e Assinatura de Parede */}
        <footer className="print-doc-footer">
          <div className="print-signatures">
            <div className="print-sig-line">
              <span>Coordenação de Operações / Pauta</span>
            </div>
            <div className="print-sig-line">
              <span>Controle de Frotas &amp; Viaturas</span>
            </div>
            <div className="print-sig-line">
              <span>Direção MegaFilmes &amp; Mega Print</span>
            </div>
          </div>
          <div className="print-footer-meta">
            <span>
              Documento gerado pelo sistema <strong>GestorMF — MegaFilmes &amp; Mega Print</strong>
            </span>
            <span>Emissão: {emittedAtStr}</span>
          </div>
        </footer>
      </div>

      {/* Cabeçalho da Tabela de Serviço (Tela Interativa) */}
      <div className="board-header screen-only-block">
        <div className="board-title-group">
          <div className="board-badge">DIGITAL &amp; INTEGRADA</div>
          <h1 className="board-main-title">TABELA DE SERVIÇO</h1>
          <p className="board-subtitle">
            Escala diária de filmagens, impressões, equipes e viaturas — clique em qualquer missão para abrir a ficha completa
          </p>
        </div>

        <div className="board-header-actions">
          <button className="btn-secondary" onClick={handlePrint} title="Imprimir versão para parede ou PDF">
            <Printer size={16} /> Imprimir / Parede
          </button>
          {canCreateMission && (
            <button className="btn-primary" onClick={onNewMission}>
              <Plus size={16} /> Nova Missão / Pauta
            </button>
          )}
        </div>
      </div>

      {/* Resumo Rápido (KPIs da Escala — Padrão: Ativas sem Finalizadas) */}
      <div className="board-kpi-strip">
        <div
          className={`board-kpi-chip ${filterMissionStatus === 'ATIVAS' ? 'active' : ''}`}
          onClick={() => {
            setFilterMissionStatus('ATIVAS');
            setCurrentPage(1);
          }}
          title="Padrão: Exibe Agendadas, Em Preparo e Em Execução"
        >
          <span className="bkpi-dot dot-all"></span>
          <div>
            <span className="bkpi-label">Missões Ativas (Padrão)</span>
            <strong className="bkpi-val">
              <span className="bkpi-num">{countAgendada + countExec}</span>
              <span className="bkpi-text">{(countAgendada + countExec) === 1 ? 'Disponível' : 'Disponíveis'}</span>
            </strong>
          </div>
        </div>

        <div
          className={`board-kpi-chip ${filterMissionStatus === 'ANDAMENTO' ? 'active' : ''}`}
          onClick={() => {
            setFilterMissionStatus(filterMissionStatus === 'ANDAMENTO' ? 'ATIVAS' : 'ANDAMENTO');
            setCurrentPage(1);
          }}
        >
          <span className="bkpi-dot dot-exec"></span>
          <div>
            <span className="bkpi-label">Em Execução / Preparo</span>
            <strong className="bkpi-val text-red">
              <span className="bkpi-num">{countExec}</span>
              <span className="bkpi-text">Em Andamento</span>
            </strong>
          </div>
        </div>

        <div
          className={`board-kpi-chip ${filterMissionStatus === 'Agendada' ? 'active' : ''}`}
          onClick={() => {
            setFilterMissionStatus(filterMissionStatus === 'Agendada' ? 'ATIVAS' : 'Agendada');
            setCurrentPage(1);
          }}
        >
          <span className="bkpi-dot dot-sched"></span>
          <div>
            <span className="bkpi-label">Agendadas</span>
            <strong className="bkpi-val text-cyan">
              <span className="bkpi-num">{countAgendada}</span>
              <span className="bkpi-text">{countAgendada === 1 ? 'Pauta' : 'Pautas'}</span>
            </strong>
          </div>
        </div>

        <div
          className={`board-kpi-chip ${filterMissionStatus === 'Pendente' ? 'active' : ''} ${countOverdue > 0 ? 'kpi-has-overdue' : ''}`}
          onClick={() => {
            setFilterMissionStatus(filterMissionStatus === 'Pendente' ? 'ATIVAS' : 'Pendente');
            setCurrentPage(1);
          }}
          title={countOverdue > 0 ? `${countOverdue} missão(ões) de pós-produção atrasadas!` : 'Clique para visualizar as missões pendentes de pós-produção'}
        >
          <span className={`bkpi-dot ${countOverdue > 0 ? 'dot-overdue' : 'dot-pendente'}`}></span>
          <div>
            <span className="bkpi-label">Pendentes (Pós-Prod.)</span>
            <strong className={`bkpi-val ${countOverdue > 0 ? 'text-red' : 'text-amber'}`}>
              <span className="bkpi-num">{countPendente}</span>
              <span className="bkpi-text">{countPendente === 1 ? 'Pendente' : 'Pendentes'}</span>
              {countOverdue > 0 && (
                <span className="bkpi-overdue-tag">
                  <span className="bkpi-sep">•</span>
                  <span className="bkpi-num">{countOverdue}</span>
                  <span className="bkpi-text">{countOverdue === 1 ? 'Atrasada' : 'Atrasadas'}</span>
                </span>
              )}
            </strong>
          </div>
        </div>

        <div
          className={`board-kpi-chip ${(filterMissionStatus === 'Finalizado' || filterMissionStatus === 'Finalizada') ? 'active' : ''}`}
          onClick={() => {
            setFilterMissionStatus(
              filterMissionStatus === 'Finalizado' || filterMissionStatus === 'Finalizada'
                ? 'ATIVAS'
                : 'Finalizada'
            );
            setCurrentPage(1);
          }}
          title="Clique para visualizar as missões finalizadas"
        >
          <span className="bkpi-dot dot-done"></span>
          <div>
            <span className="bkpi-label">Finalizadas (Histórico)</span>
            <strong className="bkpi-val text-green">
              <span className="bkpi-num">{countFinalizado}</span>
              <span className="bkpi-text">{countFinalizado === 1 ? 'Concluída' : 'Concluídas'}</span>
            </strong>
          </div>
        </div>

        {/* Resumo de Percurso & Combustível: Apenas Gestores e Administradores */}
        {canViewFinancials && (
          <div className="board-kpi-chip static-summary">
            <Route size={16} className="icon-accent" />
            <div>
              <span className="bkpi-label">Percurso &amp; Combustível (Filtro)</span>
              <strong className="bkpi-val gold">
                <span className="bkpi-num">{totalKmFiltered.toFixed(1)}</span>
                <span className="bkpi-text">km</span>
                <span className="bkpi-sep">•</span>
                <span className="bkpi-text">R$</span>
                <span className="bkpi-num">{totalFuelFiltered.toFixed(2)}</span>
              </strong>
            </div>
          </div>
        )}
      </div>

      {/* Barra de Filtros e Busca Rápida */}
      <div className="board-filter-toolbar">
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Buscar por código (ex: 202610281), pauta, equipe, motorista, local ou viatura..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="board-search-input"
          />
          {searchTerm && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => {
                setSearchTerm('');
                setCurrentPage(1);
              }}
              title="Limpar busca"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="filter-pills">
          <span className="filter-label">Pós-Produção:</span>
          {['TODOS', 'Pendente', 'Em Edição', 'Edição Concluída', 'Não se aplica'].map((status) => (
            <button
              key={status}
              className={`filter-pill ${filterEditionStatus === status ? 'active' : ''}`}
              onClick={() => {
                setFilterEditionStatus(status);
                setCurrentPage(1);
              }}
            >
              {status === 'TODOS' ? 'Todos' : status}
            </button>
          ))}
        </div>
      </div>

      {/* Grid da Tabela de Serviço (Design Compacto, Simétrico e Colorido por Status) */}
      <div className="table-responsive-wrapper">
        <table className="whiteboard-table compact-service-table">
          <thead>
            <tr>
              <th className="col-desc">CÓDIGO &amp; PAUTA DA MISSÃO</th>
              <th className="col-local">LOCAL &amp; PERCURSO</th>
              <th className="col-agenda">AGENDA &amp; HORÁRIOS</th>
              <th className="col-equipe">EQUIPE ESCALADA</th>
              <th className="col-edicao">STATUS &amp; EDIÇÃO</th>
              <th className="col-viatura">
                {canViewFinancials ? 'VIATURA, MOTORISTA & TANQUE' : 'VIATURA & MOTORISTA'}
              </th>
              <th className="col-acoes">AÇÕES</th>
            </tr>
          </thead>
          <tbody>
            {paginatedMissions.length === 0 ? (
              <tr>
                <td colSpan="7" className="empty-table-cell">
                  <div className="empty-state">
                    <Film size={36} className="empty-icon" />
                    <p>Nenhuma missão encontrada com os filtros selecionados.</p>
                    <button className="btn-primary-sm" onClick={onNewMission}>
                      Cadastrar Nova Missão
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedMissions.map((mission) => {
                const missionCode = getMissionCode(mission, missions);
                const allocations = getMissionAllocations(mission, vehicles, members);
                const driverInfo = resolveMissionDriver(mission);
                const teamList = resolveMissionTeamMembers(mission);
                const statusSlug = (mission.missionStatus || 'Agendada')
                  .toLowerCase()
                  .normalize('NFD')
                  .replace(/[\u0300-\u036f]/g, '')
                  .replace(/\s+/g, '-');
                const isSelectedRow = selectedDetailMissionId === mission.id;
                const isOverdueMission = checkIsMissionOverdue(mission);
                const isAssignedEditor = checkIsAssignedEditor(mission);
                const canConcludeThis = isAssignedEditor || canAdminManageEdition;

                return (
                  <tr
                    key={mission.id}
                    className={`whiteboard-row row-status-${statusSlug} ${isSelectedRow ? 'row-selected' : ''} ${isOverdueMission ? 'mission-row-overdue' : ''}`}
                    onClick={() => setSelectedDetailMissionId(mission.id)}
                    title="Clique para abrir a Ficha Completa da Missão"
                  >
                    {/* 1. CÓDIGO & DESCRIÇÃO COMPLETA E LEGÍVEL */}
                    <td className="col-desc">
                      <div className="desc-cell-compact">
                        <div className="desc-top-meta">
                          <span
                            className="mission-code-pill"
                            title={`Código da missão: ${missionCode} (Ano + Mês + Dia + Ordem do Dia)`}
                          >
                            #{missionCode}
                          </span>
                          <span className="row-ficha-badge">
                            <Eye size={10} /> Ver Ficha
                          </span>
                          {mission.isRecurring && (
                            <span
                              className="row-recurring-badge"
                              title={`Missão Recorrente ${mission.recurrenceDays ? `(${mission.recurrenceDays})` : ''}`}
                            >
                              <Repeat size={10} /> {mission.recurrenceDays || 'Recorrente'}
                            </span>
                          )}
                        </div>
                        <strong className="mission-name-compact">
                          {mission.description}
                        </strong>
                        {mission.notes && (
                          <span className="mission-notes-compact">
                            {mission.notes}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 2. LOCAL & PERCURSO SEM ABREVIAÇÃO */}
                    <td className="col-local">
                      <div className="local-cell-compact">
                        <div className="location-name-compact">
                          <MapPin size={13} className="pin-icon" />
                          <span>{mission.locationName || 'Local não informado'}</span>
                        </div>
                        {mission.address && (
                          <span className="location-address-compact">
                            {mission.address}
                          </span>
                        )}
                        {mission.distanceKm > 0 && (
                          <div className="location-distance-pill-compact">
                            <Navigation size={10} />
                            <span>
                              <strong>{getMissionTotalKm(mission)} km</strong> ida e volta ({mission.distanceKm} km/trecho)
                            </span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* 3. AGENDA & HORÁRIOS COMPLETOS (SEM ABREVIAÇÕES) */}
                    <td className="col-agenda">
                      <div className="agenda-compact-box">
                        <div className="agenda-date-header">
                          <Calendar size={12} className="date-icon" />
                          <strong>{formatDateBR(mission.date)}</strong>
                        </div>
                        <div className={`agenda-times-grid ${mission.eventStartTime ? 'has-event-slot' : ''}`}>
                          <div className="ag-time-item highlight">
                            <span>Saída</span>
                            <strong>{mission.departureTime || '--:--'}</strong>
                          </div>
                          <div className="ag-time-item cyan">
                            <span>Chegada</span>
                            <strong>{mission.arrivalTimeEstimated || '--:--'}</strong>
                          </div>
                          {mission.eventStartTime && (
                            <div className="ag-time-item amber">
                              <span>Evento</span>
                              <strong>{mission.eventStartTime}</strong>
                            </div>
                          )}
                          <div className="ag-time-item muted">
                            <span>Retorno</span>
                            <strong>{mission.returnTimeEstimated || '--:--'}</strong>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* 4. EQUIPE ESCALADA (MOTORISTA SEMPRE EM 1º LUGAR E EM DESTAQUE) */}
                    <td className="col-equipe">
                      <div className="equipe-cell-compact">
                        {(teamList.length > 0 || (Array.isArray(mission.guests) && mission.guests.length > 0)) ? (
                          <div className="equipe-compact-wrap">
                            {teamList.map((mem, i) => {
                              const isDriver = isMemberMissionDriver(
                                mem,
                                mission,
                                allocations,
                                driverInfo
                              );
                              return (
                                <span
                                  key={mem.id || i}
                                  className={`member-tag-compact ${isDriver ? 'is-driver-first' : ''}`}
                                  title={
                                    isDriver
                                      ? `${mem.name} (${mem.role}) — Motorista Responsável pela Viatura`
                                      : `${mem.name} (${mem.role})`
                                  }
                                >
                                  {isDriver ? (
                                    <span className="driver-badge-inline" title="Condutor da Viatura">
                                      🛞
                                    </span>
                                  ) : mem.photoUrl ? (
                                    <img
                                      src={mem.photoUrl}
                                      alt={mem.name}
                                      className="member-tag-avatar-sm"
                                    />
                                  ) : (
                                    <Users size={11} className="member-icon-sm" />
                                  )}
                                  <span className="member-name-full">{mem.name}</span>
                                  {isDriver && (
                                    <span className="driver-role-tag">Motorista</span>
                                  )}
                                </span>
                              );
                            })}
                            {Array.isArray(mission.guests) && mission.guests.map((g, gi) => {
                              const gName = typeof g === 'string' ? g : g.name;
                              return (
                                <span
                                  key={`guest-${gi}`}
                                  className="member-tag-compact is-guest-tag"
                                  title={`${gName} — Convidado Externo / Freelancer`}
                                >
                                  <span className="guest-badge-inline" title="Convidado / Freelancer">
                                    👤
                                  </span>
                                  <span className="member-name-full">{gName}</span>
                                  <span className="guest-role-tag">Convidado</span>
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="unassigned-badge">Sem equipe</span>
                        )}
                      </div>
                    </td>

                    {/* 5. STATUS & EDIÇÃO (Com identificação de editor, prazo, pontualidade e ações de conclusão/reabertura) */}
                    <td className="col-edicao" onClick={(e) => e.stopPropagation()}>
                      <div className="edicao-cell-compact">
                        <div
                          className={`board-mission-status-pill ${isOverdueMission && mission.missionStatus === 'Pendente' ? 'pill-atrasada' : `pill-${statusSlug}`}`}
                          onClick={() => setSelectedDetailMissionId(mission.id)}
                          style={{ cursor: 'pointer' }}
                          title={isOverdueMission ? 'Missão de pós-produção com entrega atrasada!' : 'Clique para ver os detalhes da missão'}
                        >
                          <span
                            className={`status-dot ${isOverdueMission && mission.missionStatus === 'Pendente' ? 'dot-atrasada' : `dot-${(mission.missionStatus || 'Agendada')
                              .toLowerCase()
                              .replace(/\s+/g, '-')}`}`}
                          ></span>
                          <span>{isOverdueMission && mission.missionStatus === 'Pendente' ? 'Atrasado' : (mission.missionStatus || 'Agendada')}</span>
                        </div>

                        {/* Bloco de Informações de Pós-Produção */}
                        <div className="postprod-compact-strip">
                          {/* Editor Designado */}
                          {mission.editorNamesDisplay || mission.editorName ? (
                            <div className="pp-badge pp-badge-editor" title={`Editor responsável: ${mission.editorNamesDisplay || mission.editorName}`}>
                              <Film size={11} />
                              <span>{mission.editorNamesDisplay || mission.editorName}</span>
                            </div>
                          ) : (
                            <div className="pp-badge pp-badge-unassigned" title="Sem editor designado">
                              <Film size={11} />
                              <em>Sem Editor</em>
                            </div>
                          )}

                          {/* Prazo de Entrega */}
                          {mission.deliveryDeadlineDate && (
                            <div className="pp-badge pp-badge-deadline" title={`Prazo estipulado: ${formatDateBR(mission.deliveryDeadlineDate)} às ${mission.deliveryDeadlineTime || '18:00'}`}>
                              <Clock size={11} />
                              <span>{formatDateBR(mission.deliveryDeadlineDate).slice(0, 5)} {mission.deliveryDeadlineTime || '18:00'}</span>
                            </div>
                          )}

                          {/* Alerta de Missão Reaberta / Em Atraso */}
                          {isOverdueMission && (
                            <div
                              className="pp-badge pp-badge-overdue"
                              title={mission.reopenReason ? `Retrabalho solicitado: ${mission.reopenReason}` : 'Prazo estipulado de entrega expirado'}
                            >
                              <AlertTriangle size={11} />
                              <span>{mission.reopenReason ? 'Ajustes Solicitados' : 'Atrasado'}</span>
                            </div>
                          )}

                          {/* Tag de Pontualidade se Concluída */}
                          {mission.editionDeliveryStatus && (
                            <div className={`pp-badge pp-badge-delivery ${mission.editionDeliveryStatus === 'Dentro do Prazo' ? 'ontime' : 'late'}`}>
                              {mission.editionDeliveryStatus === 'Dentro do Prazo' ? '✅ No Prazo' : '⚠️ Fora do Prazo'}
                            </div>
                          )}

                          {/* Caminho dos Arquivos no Servidor */}
                          {mission.serverFilePath && (
                            <div
                              className="pp-badge pp-badge-server-path"
                              title={`Local no Servidor: ${mission.serverFilePath} (Clique para copiar)`}
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
                              style={{ cursor: 'pointer', background: 'rgba(56, 189, 248, 0.12)', borderColor: 'rgba(56, 189, 248, 0.35)', color: '#38bdf8' }}
                            >
                              <Folder size={11} />
                              <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {mission.serverFilePath}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Botões Operacionais de Conclusão / Aprovação / Recusa */}
                        <div className="postprod-actions-row">
                          {/* 1. Tarefa de pós-produção pendente / em andamento */}
                          {mission.editionStatus !== 'Edição Concluída' && mission.editionStatus !== 'Entregue' && mission.editionStatus !== 'Não se aplica' && (
                            <>
                              {canConcludeThis ? (
                                <button
                                  type="button"
                                  className="btn-pp-conclude"
                                  onClick={() => handleConcludeEdition(mission)}
                                  title="Marcar tarefa de pós-produção como concluída e enviar para confirmação da gestão"
                                >
                                  <CheckCircle2 size={12} />
                                  <span>Concluir Tarefa</span>
                                </button>
                              ) : (
                                <span className={`status-static-tag ${isOverdueMission ? 'status-atrasado' : 'status-pendente'}`}>
                                  {isOverdueMission ? '⚠️ Atrasado' : `Edição: ${mission.editionStatus || 'Pendente'}`}
                                </span>
                              )}
                            </>
                          )}

                          {/* 2. Edição CONCLUÍDA pelo editor: Editor vê "Aguardando Confirmação", Gestor vê "Confirmar Finalização" e "Recusar" */}
                          {mission.editionStatus === 'Edição Concluída' && mission.missionStatus !== 'Finalizada' && (
                            <div className="pp-approval-flow-row">
                              {!canAdminManageEdition ? (
                                <div
                                  className="btn-pp-waiting"
                                  title="Material concluído e enviado pelo editor. Aguardando aceitação e confirmação da gestão."
                                >
                                  <Clock size={12} />
                                  <span>Aguardando Confirmação</span>
                                </div>
                              ) : (
                                <div className="pp-admin-buttons">
                                  <button
                                    type="button"
                                    className="btn-pp-reopen"
                                    onClick={() => handleReopenClick(mission)}
                                    title="Rejeitar material e solicitar ajustes / novo prazo para os editores"
                                  >
                                    <RotateCcw size={11} />
                                    <span>Rejeitar e Reabrir</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-pp-approve"
                                    onClick={() => handleApproveEdition(mission)}
                                    title="Confirmar finalização da missão e encerrar serviço"
                                  >
                                    <CheckCheck size={12} />
                                    <span>Confirmar Finalização</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {/* 3. Missão já finalizada */}
                          {mission.missionStatus === 'Finalizada' && (
                            <span className="pp-concluded-badge">
                              <Check size={11} /> Finalizada
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* 6. VIATURA, MOTORISTA & TANQUE (MODELO E DADOS 100% APARENTES) */}
                    <td className="col-viatura">
                      <div className="viatura-cell-compact">
                        {allocations.length > 0 ? (
                          <div className="veh-mini-cards-stack">
                            {allocations.map((alloc, aIdx) => {
                              const vObj = alloc.vehicle;
                              const vTel = vObj
                                ? computeVehicleFuelTelemetry(vObj, missions, fuelSettings)
                                : null;
                              const mTotalKm = getMissionTotalKm(mission);
                              const mBd = vObj
                                ? computeMissionVehicleFuelBreakdown({
                                  vehicle: vObj,
                                  totalRoundTripKm: mTotalKm,
                                  currentTelemetry: vTel,
                                  fuelPricePerLiter: fuelSettings,
                                })
                                : null;

                              const litersUsed =
                                mBd && mBd.litersNeeded > 0
                                  ? mBd.litersNeeded
                                  : Number(mission.estimatedFuelLiters || 0);
                              const costUsed =
                                mBd && mBd.totalCost > 0
                                  ? mBd.totalCost
                                  : Number(mission.estimatedFuelCost || 0);

                              return (
                                <div key={aIdx} className="veh-mini-card">
                                  {/* Linha 1: Modelo Completo da Viatura + Placa */}
                                  <div className="vmc-top-row">
                                    <div className="vmc-ident">
                                      <Car size={13} className="veh-car-icon" />
                                      <strong className="vmc-name-full">
                                        {vObj ? vObj.name : alloc.vehicleName}
                                      </strong>
                                    </div>
                                    {vObj && <span className="vmc-plate">{vObj.plate}</span>}
                                  </div>

                                  {/* Linha 2: Motorista Completo + Nível do Tanque */}
                                  <div className="vmc-middle-row">
                                    <div
                                      className="vmc-driver-chip"
                                      onClick={canEditMission ? (e) => {
                                        e.stopPropagation();
                                        onEditMission(mission);
                                      } : undefined}
                                      style={!canEditMission ? { cursor: 'default' } : undefined}
                                      title={canEditMission ? "Clique para alterar o motorista da viatura" : undefined}
                                    >
                                      <span className="veh-driver-wheel">🛞</span>
                                      <span className="vmc-driver-label">Motorista:</span>
                                      <strong className="vmc-driver-name-full">
                                        {alloc.driverName || driverInfo.name || 'Definir'}
                                      </strong>
                                    </div>

                                    {/* Nível do Tanque / Bateria: Apenas Gestores e Administradores */}
                                    {canViewFinancials && vTel && (() => {
                                      const isElecV = isElectricVehicle(vObj);
                                      const unitV = isElecV ? 'kWh' : 'L';
                                      const nounV = isElecV ? 'Bateria' : 'Tanque';
                                      const iconV = getFuelTypeIcon(vObj);
                                      return (
                                        <span
                                          className={`veh-tank-mini-pill ${vTel.isReserveAlert ? 'pill-reserve' : 'pill-ok'
                                            }`}
                                          title={`Nível atual da ${nounV.toLowerCase()}: ${vTel.currentLiters}${unitV} / ${vTel.tankCapacity}${unitV} (${vTel.currentPercent}%)`}
                                        >
                                          {iconV} {vTel.currentPercent}% ({vTel.currentLiters}{unitV})
                                        </span>
                                      );
                                    })()}
                                  </div>

                                  {/* Linha 3: Consumo da Missão e Custo em R$: Apenas Gestores e Administradores */}
                                  {canViewFinancials && (() => {
                                    const isElecV = isElectricVehicle(vObj);
                                    const unitV = isElecV ? 'kWh' : 'L';
                                    return (
                                      <div className="vmc-bottom-row">
                                        <div
                                          className="vmc-fuel-deduction"
                                          title="Combustível/Energia deduzido nesta missão (ida e volta)"
                                        >
                                          {isElecV ? <Zap size={11} className="text-green" /> : <Fuel size={11} />}
                                          <span>
                                            Consumo: <strong>-{litersUsed}{unitV}</strong> •{' '}
                                            <strong>R$ {Number(costUsed || 0).toFixed(2)}</strong>
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })()}

                                  {canViewFinancials && mBd && mBd.exceedsFullTankCapacity && (
                                    <div
                                      className="veh-excess-fuel-pill"
                                      title={`Ultrapassa 1 tanque (${mBd.maxTankRangeKm} km): +${mBd.excessOverFullTankKm} km | +${mBd.excessOverFullTankLiters}L | Excedente: +R$ ${mBd.excessOverFullTankCost.toFixed(2)}`}
                                    >
                                      ⚠️ Excedente &gt; 1 Tanque: +{mBd.excessOverFullTankLiters}L (+R${' '}
                                      {Number(mBd.excessOverFullTankCost || 0).toFixed(2)})
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="no-vehicle-pill">Sem viatura</span>
                        )}
                      </div>
                    </td>

                    {/* 7. AÇÕES COMPACTAS */}
                    <td className="col-acoes" onClick={(e) => e.stopPropagation()}>
                      <div className="acoes-cell-compact">
                        <button
                          className="action-btn-icon view-history"
                          title="Ver Histórico Completo da Missão (Pós-Produção, Prazos & Trilha de Auditoria)"
                          onClick={() => setSelectedHistoryMission(mission)}
                        >
                          <History size={14} />
                        </button>
                        <button
                          className="action-btn-icon view-details"
                          title="Abrir Ficha Completa da Missão"
                          onClick={() => setSelectedDetailMissionId(mission.id)}
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          className="action-btn-icon view-route"
                          title="Visualizar Rota no Mapa Interativo"
                          onClick={() => onSelectMissionOnMap(mission.id)}
                        >
                          <Navigation size={14} />
                        </button>
                        {canEditMission && (mission.missionStatus !== 'Finalizada' && mission.missionStatus !== 'Finalizado' && mission.missionStatus !== 'Concluída') ? (
                          <button
                            className="action-btn-icon edit"
                            title="Editar Missão / Pauta"
                            onClick={() => onEditMission(mission)}
                          >
                            <Edit2 size={14} />
                          </button>
                        ) : canEditMission ? (
                          <span
                            className="action-btn-icon locked"
                            title="Missão finalizada e encerrada (edição travada)"
                            style={{ opacity: 0.45, cursor: 'not-allowed', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Lock size={13} />
                          </span>
                        ) : null}
                        {canDeleteMission && (
                          <button
                            className="action-btn-icon delete"
                            title="Excluir Missão"
                            onClick={() => onDeleteMission(mission.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Contador de Páginas / Paginador (Exibido quando passar de 10 missões por página) */}
      {filteredMissions.length > ITEMS_PER_PAGE && (
        <div className="board-pagination-bar">
          <div className="pagination-info">
            Exibindo{' '}
            <strong>
              {startIndex + 1}–{Math.min(startIndex + ITEMS_PER_PAGE, filteredMissions.length)}
            </strong>{' '}
            de <strong>{filteredMissions.length}</strong> missões • Página{' '}
            <strong>{safeCurrentPage}</strong> de <strong>{totalPages}</strong>
          </div>

          <div className="pagination-controls">
            <button
              type="button"
              className="pagination-btn"
              disabled={safeCurrentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft size={15} /> Anterior
            </button>

            <div className="pagination-pages">
              {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pageNum) => (
                <button
                  key={pageNum}
                  type="button"
                  className={`pagination-page-num ${safeCurrentPage === pageNum ? 'active' : ''}`}
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="pagination-btn"
              disabled={safeCurrentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              Próxima <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL / CARD INTERATIVO DE DETALHES COMPLETOS DA MISSÃO
         ========================================================= */}
      {detailMission && (() => {
        const detailCode = getMissionCode(detailMission, missions);
        const detailAllocations = getMissionAllocations(detailMission, vehicles, members);
        const drv = resolveMissionDriver(detailMission);
        const teamMembers = resolveMissionTeamMembers(detailMission);
        const assignedEditors = resolveMissionEditors(detailMission);
        const isDetailOverdue = checkIsMissionOverdue(detailMission);
        const isDetailEditor = checkIsAssignedEditor(detailMission);
        const canConcludeDetail = isDetailEditor || canAdminManageEdition;
        const totalKm = getMissionTotalKm(detailMission);
        const oneWayKm = detailMission.distanceKm || 0;
        const returnKm = detailMission.returnDistanceKm || oneWayKm;
        const oneWayMin = detailMission.drivingDurationMinutes || 0;
        const totalMin = detailMission.roundTripDurationMinutes || oneWayMin * 2;
        const prepTimeStr = addMinutesToTime(detailMission.departureTime, -60);
        const autoEndStr = detailMission.returnTimeEstimated || detailMission.arrivalTimeEstimated || '--:--';
        const detailEventStartTime = detailMission.eventStartTime || null;
        const detailAntecedenceMin = detailMission.antecedenceMinutes ? Number(detailMission.antecedenceMinutes) : 30;
        const detailSuggestedDep = detailMission.suggestedDepartureTime || (
          detailEventStartTime
            ? calculateSuggestedDepartureTime(detailEventStartTime, oneWayMin, detailAntecedenceMin)
            : null
        );
        const navLinks =
          baseLocation?.lat && detailMission.lat
            ? getNavigationLinks(
              baseLocation.lat,
              baseLocation.lon,
              detailMission.lat,
              detailMission.lon
            )
            : null;
        const statusSlug = (detailMission.missionStatus || 'Agendada')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/\s+/g, '-');

        return (
          <div
            className="modal-overlay mission-detail-overlay"
            onClick={() => setSelectedDetailMissionId(null)}
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

                    <span className={`mdm-status-badge ${isDetailOverdue && detailMission.missionStatus === 'Pendente' ? 'pill-atrasada' : `pill-${statusSlug}`}`}>
                      <span
                        className={`status-dot ${isDetailOverdue && detailMission.missionStatus === 'Pendente' ? 'dot-atrasada' : `dot-${(detailMission.missionStatus || 'Agendada')
                          .toLowerCase()
                          .replace(/\s+/g, '-')}`}`}
                      ></span>
                      {isDetailOverdue && detailMission.missionStatus === 'Pendente' ? 'Atrasado' : (detailMission.missionStatus || 'Agendada')}
                    </span>

                    <span className="mdm-edition-badge">
                      Pós-Produção: <strong>{detailMission.editionStatus || 'Pendente'}</strong>
                    </span>

                    <span className="mdm-roundtrip-badge">
                      🔄 Ida e Volta à Base
                    </span>

                    {detailMission.isRecurring && (
                      <span className="mdm-recurring-badge" title={`Série Recorrente: ${detailMission.recurrenceDays || 'Semanal'}`}>
                        <Repeat size={12} /> Recorrente ({detailMission.recurrenceDays || 'Semanal'})
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    className="modal-close"
                    onClick={() => setSelectedDetailMissionId(null)}
                    title="Fechar Card"
                  >
                    ✕
                  </button>
                </div>

                <h2 className="mdm-title">{detailMission.description}</h2>

                <div className="mdm-location-bar">
                  <MapPin size={16} className="icon-accent" />
                  <div>
                    <strong>{detailMission.locationName || 'Local da Missão'}</strong>
                    {detailMission.address && <span> — {detailMission.address}</span>}
                  </div>
                </div>
              </div>

              {/* Corpo Rolável do Card */}
              <div className="mdm-body">
                {/* 1. LINHA DO TEMPO & HORÁRIOS AUTOMÁTICOS */}
                <div className="mdm-section">
                  <div className="mdm-section-title">
                    <Clock size={15} />
                    <span>Cronograma &amp; Automação de Horários ({formatDateBR(detailMission.date)})</span>
                  </div>

                  <div className={`mdm-timeline-grid ${detailEventStartTime ? 'has-event-slot-5' : ''}`}>
                    <div className="mdm-time-box">
                      <span className="t-label">Início do Preparo (-1h)</span>
                      <strong className="t-val text-amber">{prepTimeStr}</strong>
                      <small>Viatura e equipe ficam ocupadas</small>
                    </div>

                    <div className="mdm-time-box highlight-departure">
                      <span className="t-label">Saída da Base</span>
                      <strong className="t-val">{detailMission.departureTime || '--:--'}</strong>
                      <small>{detailSuggestedDep ? `Máx. Sugerido: ${detailSuggestedDep}` : 'Início da execução da missão'}</small>
                    </div>

                    <div className="mdm-time-box">
                      <span className="t-label">Chegada Estimada</span>
                      <strong className="t-val text-cyan">{detailMission.arrivalTimeEstimated || '--:--'}</strong>
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
                      <strong className="t-val text-green">{detailMission.returnTimeEstimated || '--:--'}</strong>
                      <small>Finalização automática no horário</small>
                    </div>
                  </div>

                  {/* BANNER / BADGE INFORMATIVO DE HORÁRIO SUGERIDO DE SAÍDA */}
                  {detailEventStartTime ? (
                    <div className="mdm-smart-schedule-badge">
                      <Sparkles size={14} className="text-amber" />
                      <div>
                        <span>
                          Horário Máximo Sugerido de Saída da Base: <strong>{detailSuggestedDep || detailMission.departureTime}</strong>
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
                      {detailMission.estimatedFuelLiters || 0} L (R${' '}
                      {Number(detailMission.estimatedFuelCost || 0).toFixed(2)})
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
                                  <button
                                    type="button"
                                    className="btn-link-inline"
                                    onClick={() => {
                                      setSelectedDetailMissionId(null);
                                      onEditMission(detailMission);
                                    }}
                                  >
                                    Definir agora
                                  </button>
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
                        {detailMission.lat && detailMission.lon
                          ? `${Number(detailMission.lat).toFixed(5)}, ${Number(detailMission.lon).toFixed(5)}`
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
                      {teamMembers.length + (Array.isArray(detailMission.guests) ? detailMission.guests.length : 0)} participante
                      {teamMembers.length + (Array.isArray(detailMission.guests) ? detailMission.guests.length : 0) !== 1 ? 's' : ''}
                      )
                    </span>
                  </div>

                  {teamMembers.length > 0 ? (
                    <div className="mdm-team-grid">
                      {teamMembers.map((mem, idx) => {
                        const isDriver =
                          (detailMission.driverId && mem.id === detailMission.driverId) ||
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
                  ) : (!Array.isArray(detailMission.guests) || detailMission.guests.length === 0) ? (
                    <div className="mdm-empty-box">Nenhum integrante escalado nesta pauta.</div>
                  ) : null}

                  {/* Convidados Externos / Freelancers */}
                  {Array.isArray(detailMission.guests) && detailMission.guests.length > 0 && (
                    <div className="mdm-guests-block">
                      <div className="mdm-guests-subtitle">
                        <UserPlus size={14} className="text-purple" />
                        <span>Convidados Externos &amp; Freelancers ({detailMission.guests.length})</span>
                      </div>
                      <div className="mdm-guests-grid">
                        {detailMission.guests.map((g, gIdx) => {
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
                    {detailMission.notes ? (
                      <p>{detailMission.notes}</p>
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
                          {detailMission.deliveryDeadlineDate ? (
                            <div>
                              <div className="mdm-deadline-time-row">
                                <Calendar size={13} className="icon-accent" />
                                <strong className="mdm-deadline-val">
                                  {formatDateBR(detailMission.deliveryDeadlineDate)} às {detailMission.deliveryDeadlineTime || '18:00'}
                                </strong>
                                {detailMission.editionDeliveryStatus && (
                                  <span className={`pp-badge pp-badge-delivery ${detailMission.editionDeliveryStatus === 'Dentro do Prazo' ? 'ontime' : 'late'}`}>
                                    {detailMission.editionDeliveryStatus === 'Dentro do Prazo' ? '✅ No Prazo' : '⚠️ Fora do Prazo'}
                                  </span>
                                )}
                              </div>
                              {(detailMission.isOverdue || detailMission.reopenReason) && (
                                <div className="mdm-overdue-alert">
                                  <AlertTriangle size={14} />
                                  <span>{detailMission.reopenReason ? `Retrabalho Solicitado: "${detailMission.reopenReason}"` : 'Entrega em Atraso'}</span>
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
                        <span className={`status-badge-inline status-${(detailMission.editionStatus || 'Pendente').toLowerCase().replace(/\s+/g, '-')}`}>
                          {detailMission.editionStatus || 'Pendente'}
                        </span>
                        {detailMission.editionCompletedAt && (
                          <small className="mdm-pp-completed-info">
                            Concluído em {formatDateBR(detailMission.editionCompletedAt.slice(0, 10))} às {detailMission.editionCompletedAt.slice(11, 16)} por {detailMission.editionCompletedBy || 'Editor'}
                          </small>
                        )}
                      </div>

                      <div className="mdm-pp-actions">
                        {/* Concluir Tarefa de Edição */}
                        {detailMission.editionStatus !== 'Edição Concluída' && detailMission.editionStatus !== 'Entregue' && detailMission.editionStatus !== 'Não se aplica' && (
                          <>
                            {canConcludeDetail ? (
                              <button
                                type="button"
                                className="btn-pp-conclude"
                                onClick={() => handleConcludeEdition(detailMission)}
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

                        {/* Ações após conclusão do material: Editor vê "Aguardando Confirmação", Gestor vê "Confirmar Finalização" e "Recusar" */}
                        {detailMission.editionStatus === 'Edição Concluída' && detailMission.missionStatus !== 'Finalizada' && (
                          <>
                            {!canAdminManageEdition ? (
                              <div
                                className="btn-pp-waiting"
                                title="Material entregue pelo editor. Aguardando aceitação e confirmação da gestão."
                              >
                                <Clock size={13} />
                                <span>Aguardando Confirmação</span>
                              </div>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="btn-pp-reopen"
                                  onClick={() => handleReopenClick(detailMission)}
                                  title="Rejeitar material e solicitar ajustes / novo prazo"
                                >
                                  <RotateCcw size={12} />
                                  <span>Rejeitar e Reabrir</span>
                                </button>
                                <button
                                  type="button"
                                  className="btn-pp-approve"
                                  onClick={() => handleApproveEdition(detailMission)}
                                  title="Confirmar finalização da missão e encerrar serviço"
                                >
                                  <CheckCheck size={13} />
                                  <span>Confirmar Finalização</span>
                                </button>
                              </>
                            )}
                          </>
                        )}

                        {detailMission.missionStatus === 'Finalizada' && (
                          <span className="pp-concluded-badge">
                            <Check size={12} /> Missão Finalizada
                          </span>
                        )}

                        {/* Exibição Destacada do Caminho no Servidor */}
                        {detailMission.serverFilePath && (
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
                                  {detailMission.serverFilePath}
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
                                  navigator.clipboard.writeText(detailMission.serverFilePath);
                                  alertDialog({
                                    title: 'Caminho Copiado!',
                                    message: `Caminho copiado para a área de transferência:\n\n${detailMission.serverFilePath}`,
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
                  </div>
                </div>
              </div>

              {/* Rodapé de Ações do Card */}
              <div className="mdm-footer">
                <div className="mdm-footer-left">
                  <label>Status de Edição:</label>
                  {canEditMission && detailMission.missionStatus !== 'Finalizada' && detailMission.missionStatus !== 'Finalizado' ? (
                    <select
                      className="status-dropdown"
                      value={detailMission.editionStatus || 'Pendente'}
                      onChange={(e) => onUpdateEditionStatus(detailMission.id, e.target.value)}
                    >
                      <option value="Pendente">Pendente</option>
                      <option value="Em Edição">Em Edição</option>
                      <option value="Edição Concluída">Edição Concluída</option>
                      <option value="Entregue">Entregue</option>
                      <option value="Não se aplica">Não se aplica</option>
                    </select>
                  ) : (
                    <span className="status-static-tag" style={{ marginLeft: 6 }}>
                      {detailMission.editionStatus || 'Não se aplica'}
                    </span>
                  )}
                </div>

                <div className="mdm-footer-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      const m = detailMission;
                      setSelectedHistoryMission(m);
                    }}
                    title="Ver Histórico Completo e Auditoria desta Missão"
                  >
                    <History size={15} /> Histórico Completo
                  </button>

                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      const id = detailMission.id;
                      setSelectedDetailMissionId(null);
                      onSelectMissionOnMap(id);
                    }}
                  >
                    <Navigation size={15} /> Ver Rota no Mapa
                  </button>

                  {canEditMission && (detailMission.missionStatus !== 'Finalizada' && detailMission.missionStatus !== 'Finalizado') ? (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => {
                        const m = detailMission;
                        setSelectedDetailMissionId(null);
                        onEditMission(m);
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
        );
      })()}

      {/* Modal de Histórico Completo e Auditoria da Missão */}
      <MissionHistoryModal
        isOpen={Boolean(selectedHistoryMission)}
        onClose={() => setSelectedHistoryMission(null)}
        mission={selectedHistoryMission}
        missions={missions}
        vehicles={vehicles}
        members={members}
        currentUser={currentUser}
        onSaveMission={onSaveMission}
      />

      {/* Modal Moderno para Informar Motivo de Rejeição / Reabertura de Edição */}
      {reopenModal.isOpen && (
        <div className="modal-overlay" onClick={() => setReopenModal({ isOpen: false, mission: null, reason: '', hasNewDeadline: false, newDeadlineDate: '', newDeadlineTime: '18:00' })}>
          <div className="modal-box modal-box-compact reopen-edition-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <RotateCcw size={20} className="text-danger-bright" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Rejeitar e Reabrir Serviço</h3>
                  <small style={{ color: 'var(--text-muted)' }}>
                    Pauta: #{getMissionCode(reopenModal.mission, missions)} — {reopenModal.mission?.description}
                  </small>
                </div>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setReopenModal({ isOpen: false, mission: null, reason: '', hasNewDeadline: false, newDeadlineDate: '', newDeadlineTime: '18:00' })}
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ padding: '16px' }}>
              <div className="reopen-warning-box">
                <AlertTriangle size={16} />
                <span>Esta ação rejeitará o material, retornará a missão para <strong>Pendente</strong> e notificará o editor responsável com as suas instruções.</span>
              </div>

              <div className="form-group" style={{ marginTop: '14px' }}>
                <label>
                  Motivo da Rejeição / Ajustes Solicitados: <span className="req-star">*</span>
                </label>
                <textarea
                  rows="3"
                  required
                  placeholder="Descreva com detalhes o que o editor precisa ajustar (ex: cortes, áudio, trilha sonora, vinheta)..."
                  value={reopenModal.reason}
                  onChange={(e) => setReopenModal((prev) => ({ ...prev, reason: e.target.value }))}
                  autoFocus
                />
              </div>

              {/* Opção de Novo Prazo de Entrega */}
              <div className="form-group reopen-deadline-toggle" style={{ marginTop: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={reopenModal.hasNewDeadline}
                    onChange={(e) => setReopenModal((prev) => ({ ...prev, hasNewDeadline: e.target.checked }))}
                  />
                  <span>Estipular novo prazo de entrega para os editores trabalharem</span>
                </label>
              </div>

              {reopenModal.hasNewDeadline && (
                <div className="reopen-deadline-fields" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '8px', padding: '10px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px' }}>
                  <div className="form-group">
                    <label style={{ fontSize: '0.8rem' }}>Nova Data Limite:</label>
                    <input
                      type="date"
                      value={reopenModal.newDeadlineDate}
                      onChange={(e) => setReopenModal((prev) => ({ ...prev, newDeadlineDate: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ fontSize: '0.8rem' }}>Novo Horário Limite:</label>
                    <input
                      type="time"
                      value={reopenModal.newDeadlineTime}
                      onChange={(e) => setReopenModal((prev) => ({ ...prev, newDeadlineTime: e.target.value }))}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setReopenModal({ isOpen: false, mission: null, reason: '', hasNewDeadline: false, newDeadlineDate: '', newDeadlineTime: '18:00' })}
              >
                Voltar
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleConfirmReopen}
              >
                <RotateCcw size={14} /> Rejeitar e Reabrir Pauta
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal para Conclusão de Tarefa pelo Editor com Mensagem Opcional */}
      {concludeModal.isOpen && (
        <div className="modal-overlay" onClick={() => setConcludeModal({ isOpen: false, mission: null, isLate: false, deadlineStr: '', editorMessage: '' })}>
          <div className="modal-box modal-box-compact reopen-edition-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {concludeModal.isLate ? (
                  <AlertTriangle size={20} className="text-warning-bright" />
                ) : (
                  <CheckCircle2 size={20} style={{ color: '#10b981' }} />
                )}
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
                    {concludeModal.isLate ? 'Concluir Pós-Produção Fora do Prazo' : 'Concluir Pós-Produção no Prazo'}
                  </h3>
                  <small style={{ color: 'var(--text-muted)' }}>
                    Pauta: #{getMissionCode(concludeModal.mission, missions)} — {concludeModal.mission?.description}
                  </small>
                </div>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setConcludeModal({ isOpen: false, mission: null, isLate: false, deadlineStr: '', editorMessage: '' })}
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ padding: '16px' }}>
              {concludeModal.isLate ? (
                <div className="reopen-warning-box" style={{ borderColor: 'rgba(245, 158, 11, 0.4)', background: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24' }}>
                  <AlertTriangle size={16} />
                  <span>
                    Atenção: O prazo estipulado para entrega era <strong>{concludeModal.deadlineStr || 'o combinado'}</strong> e já expirou. A conclusão será registrada como <strong>FORA DO PRAZO</strong> no histórico da missão.
                  </span>
                </div>
              ) : (
                <div className="reopen-warning-box" style={{ borderColor: 'rgba(16, 185, 129, 0.4)', background: 'rgba(16, 185, 129, 0.1)', color: '#34d399' }}>
                  <CheckCircle2 size={16} />
                  <span>
                    Parabéns pela pontualidade! Prazo limite: <strong>{concludeModal.deadlineStr || 'hoje'}</strong>. Sua entrega está <strong>DENTRO DO PRAZO</strong>.
                  </span>
                </div>
              )}

              {/* CAMINHO DO ARQUIVO GERADO NO SERVIDOR */}
              <div className="form-group" style={{ marginTop: '14px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                  <Folder size={15} style={{ color: '#38bdf8' }} />
                  <span>Local do Arquivo / Pasta no Servidor:</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: S:\MEGA FILMES\ANIVERSARIO\GISELE 50 ANOS\VIDEOS\Gisele 50"
                  value={concludeModal.serverFilePath}
                  onChange={(e) => setConcludeModal((prev) => ({ ...prev, serverFilePath: e.target.value }))}
                  style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                  autoFocus
                />
                <small className="field-hint-sub">Informe o caminho da pasta ou arquivo gerado no servidor de rede/armazenamento.</small>
              </div>

              <div className="form-group" style={{ marginTop: '12px' }}>
                <label>
                  Mensagem / Observações para a Gestão (opcional):
                </label>
                <textarea
                  rows="2"
                  placeholder="Ex: Vídeo finalizado com trilha sonora e artes inseridas..."
                  value={concludeModal.editorMessage}
                  onChange={(e) => setConcludeModal((prev) => ({ ...prev, editorMessage: e.target.value }))}
                />
                <small className="field-hint-sub">Esta mensagem será enviada ao Administrador e registrada no histórico da missão.</small>
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setConcludeModal({ isOpen: false, mission: null, isLate: false, deadlineStr: '', serverFilePath: '', editorMessage: '' })}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-pp-conclude"
                onClick={handleConfirmConclude}
                style={{ padding: '8px 16px', fontSize: '0.85rem' }}
              >
                <CheckCircle2 size={14} />
                <span>{concludeModal.isLate ? 'Confirmar Conclusão com Atraso' : 'Confirmar Conclusão no Prazo'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
