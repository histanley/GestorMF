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
  CreditCard,
  Briefcase,
  ChevronRight,
  Filter,
  Sparkles,
  Search,
} from 'lucide-react';
import TeamPayoutsDashboard from './TeamPayoutsDashboard';
import TeamPerformanceRanking from './TeamPerformanceRanking';

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
  reloadServerMissions = null,
}) {
  // Extrai todas as solicitações de horas extras de todas as missões
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

    // Ordena decrescente por data da solicitação
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

  // Sub-aba inicial: Se houver solicitações pendentes, abre nelas; senão, abre em Diárias & Fechamento
  const [adminTab, setAdminTab] = useState(() => {
    return pendingRequests.length > 0 ? 'approvals' : 'payouts';
  });

  // Filtro na aba de aprovações (pendentes vs histórico)
  const [approvalsSubView, setApprovalsSubView] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessingId, setIsProcessingId] = useState(null);

  const handleAction = async (missionId, requestId, decision) => {
    if (!onRespondExtraHours) return;
    setIsProcessingId(requestId);
    try {
      await onRespondExtraHours(missionId, requestId, decision);
    } finally {
      setIsProcessingId(null);
    }
  };

  // Estatísticas rápidas de topo
  const totalPendingHours = useMemo(() => {
    return pendingRequests.reduce((acc, r) => acc + (Number(r.hoursRequested) || 0), 0);
  }, [pendingRequests]);

  const totalApprovedHoursMonth = useMemo(() => {
    const now = new Date();
    const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return allExtraHoursRequests
      .filter((r) => r.status === 'APPROVED' && (r.missionDate || '').startsWith(curMonth))
      .reduce((acc, r) => acc + (Number(r.hoursRequested) || 0), 0);
  }, [allExtraHoursRequests]);

  // Lista filtrada para a visualização selecionada
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
            Central unificada para aprovação de horas extras de campo, apuração financeira de diárias e inteligência de performance.
          </p>
        </div>

        {/* Mini KPI Cards de Topo */}
        <div className="ach-kpi-strip">
          <div className={`ach-kpi-card ${pendingRequests.length > 0 ? 'kpi-warn-pulse' : ''}`}>
            <div className="ach-kpi-icon text-amber">
              <Clock size={18} />
            </div>
            <div className="ach-kpi-data">
              <span className="ach-kpi-num">{pendingRequests.length}</span>
              <span className="ach-kpi-lbl">Aprovações Pendentes</span>
            </div>
          </div>

          <div className="ach-kpi-card">
            <div className="ach-kpi-icon text-emerald">
              <CheckCircle2 size={18} />
            </div>
            <div className="ach-kpi-data">
              <span className="ach-kpi-num">+{totalApprovedHoursMonth}h</span>
              <span className="ach-kpi-lbl">Aprovadas no Mês</span>
            </div>
          </div>

          <div className="ach-kpi-card">
            <div className="ach-kpi-icon text-gold">
              <Briefcase size={18} />
            </div>
            <div className="ach-kpi-data">
              <span className="ach-kpi-num">{members.length}</span>
              <span className="ach-kpi-lbl">Colaboradores</span>
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
            className={`ac-tab-btn ${adminTab === 'approvals' ? 'is-active' : ''}`}
            onClick={() => setAdminTab('approvals')}
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
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. CONTEÚDO DAS SUB-ABAS                                       */}
      {/* ============================================================== */}
      <div className="admin-center-content">
        {/* ============================================================ */}
        {/* SUB-ABA 1: APROVAÇÕES DE HORAS EXTRAS                        */}
        {/* ============================================================ */}
        {adminTab === 'approvals' && (
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
                    : 'Nenhum histórico encontrado.'}
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
                  const isRejected = req.status === 'REJECTED';
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
        {/* SUB-ABA 2: DIÁRIAS & FECHAMENTO FINANCEIRO                  */}
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
        {/* SUB-ABA 3: INTELIGÊNCIA & RANKING                            */}
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
      </div>
    </div>
  );
}
