import React, { useState, useMemo } from 'react';
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
  Shield,
  CreditCard,
  MessageCircle,
  Edit2,
  Trash2,
  X,
  Lock,
} from 'lucide-react';
import {
  OFFICIAL_COMPANY_ROLES,
  ROLE_ICONS_MAP,
  ROLE_COLORS_MAP,
  normalizeToOfficialRole,
  computeMemberRoleCounts,
} from '../utils/companyRoles';
import { apiRequestExtraHours, apiUpdatePixKey } from '../utils/api';
import { alertDialog, confirmDialog } from '../utils/dialog';
import { calculateMissionOffHours } from '../utils/workHours';

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
}) {
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

  // Modal / Form de Solicitação de Horas Extras Adicionais
  const [requestModalMission, setRequestModalMission] = useState(null);
  const [requestedHours, setRequestedHours] = useState(1.0);
  const [requestReason, setRequestReason] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  // Filtro de mês atual (YYYY-MM)
  const currentMonthKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

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

  // Contagem fiel de cada uma das 11 funções oficiais
  const roleCounts = useMemo(() => {
    if (!myMember) return {};
    return computeMemberRoleCounts(myMember, myMissions);
  }, [myMember, myMissions]);

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

    monthMissions.forEach((m) => {
      const isMDay = Boolean(m.isMultiDay || (m.endDate && m.endDate !== m.date));
      const customRate = (m.customRates && m.customRates[myMember.id] !== undefined)
        ? Number(m.customRates[myMember.id])
        : null;

      const isDaily = isMDay || m.remunerationType === 'daily';
      if (isDaily) {
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
        const offHoursInfo = calculateMissionOffHours(m.date, m.departureTime, m.endDate, m.returnTimeEstimated, false);
        const approvedExtra = Number(m.extraHoursApproved) || 0;
        const offHoursTotal = (offHoursInfo.offHours || 0) + approvedExtra;
        totalHours += offHoursTotal;
        const rate = customRate !== null ? customRate : hourlyRate;
        totalHoursVal += offHoursTotal * rate;
      }
    });

    const closure = closures[myMember.id] || null;
    const isPaid = closure?.status === 'Pago';

    return {
      totalHours: Number(totalHours.toFixed(1)),
      totalHoursVal: Number(totalHoursVal.toFixed(2)),
      totalDays,
      totalDaysVal: Number(totalDaysVal.toFixed(2)),
      total: Number((totalHoursVal + totalDaysVal).toFixed(2)),
      isPaid,
      clearedAt: closure?.clearedAt || null,
    };
  }, [myMember, myMissions, currentMonthKey, closures]);

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

  // Enviar solicitação de hora extra
  const handleSubmitExtraHoursRequest = async (e) => {
    e.preventDefault();
    if (!requestModalMission) return;
    setIsSubmittingRequest(true);
    try {
      const res = await apiRequestExtraHours({
        missionId: requestModalMission.id,
        hoursRequested: requestedHours,
        reason: requestReason.trim() || 'Necessário tempo adicional para conclusão das atividades da pauta.',
        memberId: myMember?.id,
        memberName: myMember?.name,
      });

      if (res.success) {
        await alertDialog({
          title: '✅ Solicitação Enviada',
          message: `Sua solicitação de +${requestedHours}h foi enviada para aprovação da administração.`,
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
      {/* 1. HERO BANNER DO COLABORADOR                                  */}
      {/* ============================================================== */}
      <div className="cs-hero-card">
        <div className="cs-hero-profile-wrap">
          <div className="cs-hero-avatar">
            {myMember.photoUrl ? (
              <img src={myMember.photoUrl} alt={myMember.name} />
            ) : (
              <span>{myMember.name.slice(0, 2).toUpperCase()}</span>
            )}
          </div>

          <div className="cs-hero-text">
            <div className="cs-hero-name-row">
              <h2 className="cs-hero-name">{myMember.name}</h2>
              <span className="cs-company-pill">
                {myMember.company || 'MegaFilmes'}
              </span>
            </div>
            <div className="cs-hero-badges-row">
              <span className="cs-hero-role" title="Função Principal na Empresa (Somente Leitura)">
                💼 {myMember.role || 'Colaborador'}
                <span className="cs-role-tag-badge">Principal</span>
              </span>
              {Array.isArray(myMember.secondaryRoles) && myMember.secondaryRoles.map((secRole) => (
                <span key={secRole} className="cs-hero-role-secondary" title="Função Adicional habilitada na Empresa (Somente Leitura)">
                  🎯 {secRole}
                  <span className="cs-role-tag-badge sec">Adicional</span>
                </span>
              ))}
              {myMember.canDrive && (
                <span className="cs-hero-cnh">
                  🚗 CNH {myMember.cnhCategory || 'AB'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Chave PIX com Cadastro, Edição e Exclusão */}
        <div className="cs-pix-box">
          {isEditingPix ? (
            <div className="cs-pix-edit-wrap">
              <span className="cs-pix-edit-title">
                {myMember?.pixKey ? '✏️ Editar Chave PIX' : '➕ Cadastrar Chave PIX'}
              </span>
              <div className="cs-pix-edit-row">
                <input
                  type="text"
                  className="cs-pix-input"
                  placeholder="CPF, celular, e-mail ou aleatória..."
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
                  className="cs-btn-pix-save"
                  onClick={handleSavePix}
                  disabled={isSavingPix}
                  title="Salvar Chave PIX"
                >
                  <Check size={13} />
                  <span>Salvar</span>
                </button>
                <button
                  type="button"
                  className="cs-btn-pix-cancel"
                  onClick={handleCancelEditPix}
                  disabled={isSavingPix}
                  title="Cancelar"
                >
                  <X size={13} />
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="cs-pix-info">
                <span className="cs-pix-label">Chave PIX Cadastrada</span>
                <strong className={`cs-pix-value ${!myMember?.pixKey ? 'is-empty' : ''}`}>
                  {myMember?.pixKey || 'Não cadastrada'}
                </strong>
              </div>

              <div className="cs-pix-actions">
                {myMember?.pixKey ? (
                  <>
                    <button
                      type="button"
                      onClick={handleCopyPix}
                      className={`cs-btn-copy-pix ${copiedPix ? 'copied' : ''}`}
                      title="Copiar Chave PIX"
                    >
                      {copiedPix ? <Check size={13} /> : <Copy size={13} />}
                      <span>{copiedPix ? 'Copiado!' : 'Copiar'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleStartEditPix}
                      className="cs-btn-pix-action btn-edit"
                      title="Editar Chave PIX"
                    >
                      <Edit2 size={13} />
                      <span>Editar</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDeletePix}
                      className="cs-btn-pix-action btn-delete"
                      title="Excluir Chave PIX"
                    >
                      <Trash2 size={13} />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartEditPix}
                    className="cs-btn-pix-add"
                    title="Cadastrar Chave PIX para recebimentos"
                  >
                    <Plus size={13} />
                    <span>Cadastrar PIX</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. RESUMO FINANCEIRO DO MÊS (EXTRATO PESSOAL)                   */}
      {/* ============================================================== */}
      <div className="cs-section-block">
        <h3 className="cs-section-heading">
          <DollarSign size={18} className="text-amber" />
          Meu Fechamento &amp; Saldo do Mês
        </h3>

        <div className="cs-summary-grid">
          {/* Card Horas Extras */}
          <div className="cs-summary-card cs-card-hours">
            <div className="cs-card-header">
              <span className="cs-card-lbl">Horas Extras ({financialSummary.totalHours}h)</span>
              <Clock size={18} className="text-amber" />
            </div>
            <strong className="cs-card-val text-amber">
              {formatBRL(financialSummary.totalHoursVal)}
            </strong>
            <span className="cs-card-sub">
              Taxa base: {formatBRL(myMember.hourlyRate || 50)}/h
            </span>
          </div>

          {/* Card Diárias */}
          <div className="cs-summary-card cs-card-travel">
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

          {/* Card Total a Receber / Quitado */}
          <div className={`cs-summary-card cs-card-total ${financialSummary.isPaid ? 'is-paid' : 'is-pending'}`}>
            <div className="cs-card-header">
              <span className="cs-card-lbl">
                {financialSummary.isPaid ? 'Total Quitado' : 'Total Apurado (Pendente)'}
              </span>
              {financialSummary.isPaid ? <CheckCircle2 size={18} className="text-green" /> : <DollarSign size={18} className="text-gold" />}
            </div>
            <strong className={`cs-card-val ${financialSummary.isPaid ? 'text-green' : 'text-gold'}`}>
              {formatBRL(financialSummary.total)}
            </strong>
            <span className="cs-card-sub">
              {financialSummary.isPaid ? '✅ Saldo já quitado e zerado' : '⏳ Previsão de quitação até dia 05'}
            </span>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. ATUAÇÃO FIEL PELAS 11 FUNÇÕES DA EMPRESA                    */}
      {/* ============================================================== */}
      <div className="cs-section-block">
        <div className="cs-section-header-row">
          <h3 className="cs-section-heading">
            <Briefcase size={18} className="text-amber" />
            Minhas Atuações por Função na Empresa (11 Funções Oficiais)
          </h3>
          <span className="cs-section-header-sub">
            Rastreamento fiel e pontuação das funções cumpridas
          </span>
        </div>

        <div className="cs-roles-grid">
          {OFFICIAL_COMPANY_ROLES.map((roleName) => {
            const count = roleCounts[roleName] || 0;
            const isMainRole = normalizeToOfficialRole(myMember.role) === roleName;
            const isSecRole = Array.isArray(myMember.secondaryRoles) &&
              myMember.secondaryRoles.map(normalizeToOfficialRole).includes(roleName);
            const icon = ROLE_ICONS_MAP[roleName] || '💼';

            return (
              <div
                key={roleName}
                className={`cs-role-item ${count > 0 ? 'has-count' : 'no-count'}`}
              >
                <div className="cs-role-item-left">
                  <span className="cs-role-icon">{icon}</span>
                  <div className="cs-role-info">
                    <div className="cs-role-name" title={roleName}>
                      {roleName}
                    </div>
                    <div className={`cs-role-status ${isMainRole ? 'is-main' : isSecRole ? 'is-sec' : count > 0 ? 'is-done' : ''}`}>
                      {isMainRole ? 'Minha Função Principal' : isSecRole ? 'Função Secundária' : count > 0 ? 'Cumprida em Missões' : 'Ainda não exercida'}
                    </div>
                  </div>
                </div>

                <div className={`cs-role-count-badge ${count > 0 ? 'active' : ''}`}>
                  {count}x
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ============================================================== */}
      {/* 4. MISSÕES ATIVAS COM SOLICITAÇÃO DE HORAS EXTRAS              */}
      {/* ============================================================== */}
      <div className="cs-section-block">
        <h3 className="cs-section-heading">
          <Sparkles size={18} className="text-amber" />
          Minhas Missões &amp; Solicitação de Horas Extras
        </h3>

        {myMissions.length === 0 ? (
          <div className="cs-empty-notice">
            Você ainda não possui missões registradas nesta base.
          </div>
        ) : (
          <div className="cs-missions-list">
            {myMissions.slice(0, 10).map((m) => {
              const isMDay = Boolean(m.isMultiDay || (m.endDate && m.endDate !== m.date));
              const requests = Array.isArray(m.extraHoursRequests) ? m.extraHoursRequests : [];
              const myRequests = requests.filter((r) => String(r.memberId) === String(myMember.id));
              const isClosed = m.missionStatus === 'Finalizada';

              return (
                <div key={m.id} className="cs-mission-card">
                  <div className="cs-mission-card-left">
                    <div className="cs-mission-meta-row">
                      <span className="cs-mission-code">{m.code || `#${m.id}`}</span>
                      <span className="cs-mission-date">
                        📅 {formatDateBR(m.date)} {isMDay && m.endDate ? ` a ${formatDateBR(m.endDate)}` : ''}
                      </span>
                      {isMDay ? (
                        <span className="cs-badge-mday">
                          🏕️ Viagem (+1d)
                        </span>
                      ) : (
                        <span className="cs-badge-hours">
                          🕒 {m.departureTime || '--:--'} às {m.returnTimeEstimated || '--:--'}
                        </span>
                      )}
                      <span className={`cs-badge-status ${isClosed ? 'closed' : 'open'}`}>
                        {m.missionStatus || 'Agendada'}
                      </span>
                    </div>

                    <strong className="cs-mission-title">
                      {m.description}
                    </strong>
                    <span className="cs-mission-loc">📍 {m.locationName}</span>

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

                  {/* Ação: Solicitar Horas Extras */}
                  {!isClosed && (
                    <button
                      type="button"
                      onClick={() => setRequestModalMission(m)}
                      className="cs-btn-request-extra"
                    >
                      <Plus size={14} /> Solicitar Hora Extra (+1h, +2h)
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* 5. MODAL DE SOLICITAÇÃO DE HORA EXTRA                          */}
      {/* ============================================================== */}
      {requestModalMission && (
        <div className="modal-overlay" onClick={() => setRequestModalMission(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <div>
                <h2>⏱️ Solicitar Hora Extra</h2>
                <span className="modal-sub">
                  {requestModalMission.code} • {requestModalMission.description}
                </span>
              </div>
              <button className="modal-close" onClick={() => setRequestModalMission(null)}>✕</button>
            </div>

            <form onSubmit={handleSubmitExtraHoursRequest} className="modal-form">
              <p className="cs-modal-desc">
                Informe a quantidade de horas adicionais necessárias em campo e a justificativa para que a administração possa analisar e aprovar.
              </p>

              <div className="cs-modal-group">
                <label className="cs-modal-label">
                  Quantidade de Horas Extras Adicionais:
                </label>
                <div className="cs-hours-btn-grid">
                  {[0.5, 1.0, 1.5, 2.0, 3.0, 4.0].map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setRequestedHours(h)}
                      className={`cs-hour-choice-btn ${requestedHours === h ? 'active' : ''}`}
                    >
                      +{h}h
                    </button>
                  ))}
                </div>
              </div>

              <div className="cs-modal-group">
                <label className="cs-modal-label">
                  Motivo / Justificativa da Prorrogação:
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Ex: Pauta atrasou devido ao cliente; necessário captar mais cenas ao pôr do sol..."
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  className="cs-modal-textarea"
                />
              </div>

              <div className="modal-actions-end">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setRequestModalMission(null)}
                  disabled={isSubmittingRequest}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isSubmittingRequest || !requestReason.trim()}
                >
                  <Send size={14} />
                  <span>{isSubmittingRequest ? 'Enviando...' : `Confirmar Solicitação (+${requestedHours}h)`}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
