import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import TeamPayoutsDashboard from './TeamPayoutsDashboard';
import TeamPerformanceRanking from './TeamPerformanceRanking';
import MissionHistoryModal from './MissionHistoryModal';
import EquipmentRentalManager from './EquipmentRentalManager';
import { confirmDialog, alertDialog } from '../utils/dialog';
import { getMissionCode } from '../utils/geo';
import { clearPostProductionNotification } from '../utils/notifications';

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
  closures = {},
  onUpdateMember = null,
  onRespondExtraHours = null,
  onSaveMission = null,
  reloadServerMissions = null,
}) {
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
  const pendingEditions = useMemo(() => {
    return missions.filter(
      (m) => m.editionStatus === 'Edição Concluída' && m.missionStatus !== 'Finalizada'
    );
  }, [missions]);

  const historyEditions = useMemo(() => {
    return missions.filter(
      (m) => m.missionStatus === 'Finalizada' && m.editionStatus === 'Edição Concluída'
    );
  }, [missions]);

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
          title: 'Erro ao Finalizar',
          message: res.error || 'Não foi possível confirmar a finalização da missão.',
          variant: 'danger',
        });
        return;
      }
      clearPostProductionNotification(mission.id);
      await alertDialog({
        title: '🎉 Missão Finalizada com Sucesso',
        message: `A pauta "${mission.description}" foi aprovada e finalizada com sucesso!`,
        variant: 'success',
      });
    }
  };

  // Ação: Rejeitar e Reabrir Serviço
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
      description: `Ajustes solicitados pela Diretoria na Central do Administrador: "${reason}".` + (hasNewDeadline ? ` Novo prazo: ${newDeadlineStr}.` : ''),
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
          title: 'Erro ao Reabrir',
          message: res.error || 'Não foi possível registrar a recusa do serviço.',
          variant: 'danger',
        });
        return;
      }
      clearPostProductionNotification(m.id);
      await alertDialog({
        title: '↩️ Serviço Reaberto',
        message: `A missão "${m.description}" retornou para o status Pendente (Em Edição). Os editores foram notificados com as orientações.` + (hasNewDeadline ? ` Novo prazo: ${newDeadlineStr}.` : ''),
        variant: 'warning',
      });
    }
    setReopenModal({ isOpen: false, mission: null, reason: '', hasNewDeadline: false, newDeadlineDate: '', newDeadlineTime: '18:00' });
  };

  // Copiar caminho do servidor
  const handleCopyServerPath = (path, missionId) => {
    if (!path) return;
    navigator.clipboard.writeText(path);
    setCopiedPathId(missionId);
    setTimeout(() => setCopiedPathId(null), 2000);
  };

  // Estatísticas de Topo
  const totalApprovedHoursMonth = useMemo(() => {
    const now = new Date();
    const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return allExtraHoursRequests
      .filter((r) => r.status === 'APPROVED' && (r.missionDate || '').startsWith(curMonth))
      .reduce((acc, r) => acc + (Number(r.hoursRequested) || 0), 0);
  }, [allExtraHoursRequests]);

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

        {/* Mini KPI Cards de Topo */}
        <div className="ach-kpi-strip">
          <div className={`ach-kpi-card ${pendingEditions.length > 0 || pendingRequests.length > 0 ? 'kpi-warn-pulse' : ''}`}>
            <div className="ach-kpi-icon text-amber">
              <Clock size={18} />
            </div>
            <div className="ach-kpi-data">
              <span className="ach-kpi-num">{pendingEditions.length + pendingRequests.length}</span>
              <span className="ach-kpi-lbl">Aprovações Pendentes</span>
              <small style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                {pendingEditions.length} Pós-Produção • {pendingRequests.length} Horas
              </small>
            </div>
          </div>

          <div className="ach-kpi-card">
            <div className="ach-kpi-icon text-emerald">
              <CheckCircle2 size={18} />
            </div>
            <div className="ach-kpi-data">
              <span className="ach-kpi-num">+{totalApprovedHoursMonth}h</span>
              <span className="ach-kpi-lbl">Horas Aprovadas</span>
              <small style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                Mês Vigente
              </small>
            </div>
          </div>

          <div className="ach-kpi-card">
            <div className="ach-kpi-icon text-gold">
              <Briefcase size={18} />
            </div>
            <div className="ach-kpi-data">
              <span className="ach-kpi-num">{members.length}</span>
              <span className="ach-kpi-lbl">Colaboradores</span>
              <small style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                Equipe Ativa
              </small>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. BARRA DE NAVEGAÇÃO DE SUB-ABAS DA CENTRAL                   */}
      {/* ============================================================== */}
      <div className="admin-center-tabs-bar">
        <div className="admin-center-tabs-group">
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
            <span className="ac-tab-count-badge">FOLHA</span>
          </button>

          <button
            type="button"
            className={`ac-tab-btn ${adminTab === 'ranking' ? 'is-active' : ''}`}
            onClick={() => setAdminTab('ranking')}
          >
            <Trophy size={16} />
            <span>Inteligência &amp; Ranking</span>
            <span className="ac-tab-count-badge">PERFORMANCE</span>
          </button>

          <button
            type="button"
            className={`ac-tab-btn ${adminTab === 'rentals' ? 'is-active' : ''}`}
            onClick={() => setAdminTab('rentals')}
          >
            <Camera size={16} />
            <span>Aluguel &amp; Equipamentos</span>
            <span className="ac-tab-count-badge">ESTOQUE</span>
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

            {/* Lista de Missões de Pós-Produção */}
            {displayedEditions.length === 0 ? (
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
            ) : (
              <div className="ac-requests-grid ac-pp-grid">
                {displayedEditions.map((mission) => {
                  const mCode = getMissionCode(mission, missions);
                  const isPending = mission.editionStatus === 'Edição Concluída' && mission.missionStatus !== 'Finalizada';
                  const editorName = mission.editionCompletedBy || mission.editorNamesDisplay || mission.editorName || 'Jonathan Jordan';
                  const isOverdue = Boolean(mission.isOverdue || mission.editionDeliveryStatus === 'Atrasado');

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
                      </div>

                      {/* Descrição / Pauta e Local */}
                      <div className="ac-rc-mission-box ac-pp-mission-box">
                        <h4 className="ac-rc-mission-title ac-pp-title">
                          {mission.description}
                        </h4>
                        <div className="ac-rc-mission-loc ac-pp-loc">
                          <MapPin size={14} className="text-amber" />
                          <span>{mission.locationName || mission.address || 'Local não definido'}</span>
                        </div>
                      </div>

                      {/* Painel Moderno de Pós-Produção */}
                      <div className="ac-pp-details-panel">
                        {/* Linha com Editor e Prazo em Cards Lado a Lado */}
                        <div className="ac-pp-two-col-row">
                          {/* Editor Responsável */}
                          <div className="ac-pp-mini-card">
                            <span className="ac-pp-mini-label">Editor Responsável:</span>
                            <div className="ac-pp-user-row">
                              <div className="ac-pp-avatar-circle">
                                {editorName.slice(0, 2).toUpperCase()}
                              </div>
                              <strong className="ac-pp-user-name">{editorName}</strong>
                            </div>
                          </div>

                          {/* Prazo de Entrega */}
                          <div className="ac-pp-mini-card">
                            <span className="ac-pp-mini-label">Prazo de Entrega:</span>
                            <div className="ac-pp-deadline-row">
                              <div className="ac-pp-deadline-info">
                                <Clock size={13} className="text-muted" />
                                <span>
                                  {mission.deliveryDeadlineDate ? `${formatDateBR(mission.deliveryDeadlineDate)} às ${mission.deliveryDeadlineTime || '18:00'}` : 'Não estipulado'}
                                </span>
                              </div>
                              <span className={`ac-pp-status-badge ${isOverdue ? 'overdue' : 'ontime'}`}>
                                {isOverdue ? '⚠️ Atrasado' : '✅ No Prazo'}
                              </span>
                            </div>
                          </div>
                        </div>

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
                            <span className="ac-pp-section-label">Observações da Entrega pelo Editor:</span>
                            <div className="ac-pp-message-box">
                              "{editorMessage}"
                            </div>
                          </div>
                        )}

                        {/* Equipe de Campo */}
                        <div className="ac-pp-section-block">
                          <span className="ac-pp-section-label">Equipe de Gravação em Campo:</span>
                          <div className="ac-pp-team-chips">
                            {mission.vehicleNameDisplay && (
                              <span className="ac-team-chip">
                                <Car size={13} className="text-rose" />
                                <span>{mission.vehicleNameDisplay}</span>
                              </span>
                            )}
                            {mission.driverName && (
                              <span className="ac-team-chip">
                                <User size={13} className="text-amber" />
                                <span>Motorista: {mission.driverName}</span>
                              </span>
                            )}
                            {mission.teamNamesDisplay && (
                              <span className="ac-team-chip">
                                <Users size={13} className="text-indigo" />
                                <span>{mission.teamNamesDisplay}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Botões de Ação para o Administrador - Perfeitamente Proporcionais */}
                      {isPending && (
                        <div className="ac-rc-actions-row ac-pp-actions-footer">
                          <button
                            type="button"
                            className="ac-btn-reject ac-pp-btn-action"
                            onClick={() => setReopenModal({
                              isOpen: true,
                              mission,
                              reason: '',
                              hasNewDeadline: false,
                              newDeadlineDate: mission.deliveryDeadlineDate || '',
                              newDeadlineTime: mission.deliveryDeadlineTime || '18:00',
                            })}
                            title="Rejeitar material e solicitar ajustes com novo prazo"
                          >
                            <RotateCcw size={16} />
                            <span>Rejeitar e Reabrir</span>
                          </button>

                          <button
                            type="button"
                            className="ac-btn-approve ac-pp-btn-action"
                            onClick={() => handleApproveEdition(mission)}
                            title="Confirmar finalização da missão e encerrar serviço"
                          >
                            <CheckCheck size={17} />
                            <span>Confirmar Finalização</span>
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
              members={members}
              missions={missions}
              onUpdateMember={onUpdateMember}
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
      {/* 4. MODAL: REJEITAR E REABRIR PÓS-PRODUÇÃO                      */}
      {/* ============================================================== */}
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
                <span>Esta ação rejeitará o material, retornará a missão para <strong>Pendente (Em Edição)</strong> e notificará os editores com suas orientações de ajuste.</span>
              </div>

              <div className="form-group" style={{ marginTop: '14px' }}>
                <label>
                  Motivo da Rejeição / Ajustes Solicitados: <span className="req-star">*</span>
                </label>
                <textarea
                  rows="3"
                  required
                  placeholder="Descreva com detalhes o que o editor precisa ajustar (ex: cortes, áudio, trilha sonora, vinheta, cor)..."
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
                  <span>Estipular novo prazo limite de entrega para os editores</span>
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

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '12px 16px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setReopenModal({ isOpen: false, mission: null, reason: '', hasNewDeadline: false, newDeadlineDate: '', newDeadlineTime: '18:00' })}
              >
                Cancelar
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
