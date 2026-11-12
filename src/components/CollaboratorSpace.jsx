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
} from 'lucide-react';
import {
  OFFICIAL_COMPANY_ROLES,
  ROLE_ICONS_MAP,
  ROLE_COLORS_MAP,
  normalizeToOfficialRole,
  computeMemberRoleCounts,
} from '../utils/companyRoles';
import { apiRequestExtraHours } from '../utils/api';
import { alertDialog } from '../utils/dialog';
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
      <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
        Carregando informações do colaborador...
      </div>
    );
  }

  return (
    <div className="collaborator-space-container" style={{ padding: '1rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* ============================================================== */}
      {/* 1. HERO BANNER DO COLABORADOR                                  */}
      {/* ============================================================== */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1.25rem',
          marginBottom: '1.5rem',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', minWidth: '260px' }}>
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              overflow: 'hidden',
              border: '3px solid #f59e0b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#1e293b',
              flexShrink: 0,
            }}
          >
            {myMember.photoUrl ? (
              <img src={myMember.photoUrl} alt={myMember.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc' }}>
                {myMember.name.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#f8fafc', fontWeight: 700 }}>{myMember.name}</h2>
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  background: 'rgba(59, 130, 246, 0.2)',
                  color: '#60a5fa',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  fontWeight: 600,
                }}
              >
                {myMember.company || 'MegaFilmes'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
              <span style={{ color: '#f59e0b', fontSize: '0.9rem', fontWeight: 600 }}>
                💼 {myMember.role || 'Colaborador'}
              </span>
              {myMember.canDrive && (
                <span style={{ fontSize: '0.78rem', color: '#38bdf8' }}>
                  🚗 CNH {myMember.cnhCategory || 'AB'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Chave PIX rápida com cópia */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Chave PIX Cadastrada
            </span>
            <strong style={{ fontSize: '0.92rem', color: '#f8fafc' }}>
              {myMember.pixKey || 'Não cadastrada'}
            </strong>
          </div>
          {myMember.pixKey && (
            <button
              type="button"
              onClick={handleCopyPix}
              style={{
                background: copiedPix ? '#10b981' : 'rgba(245, 158, 11, 0.2)',
                border: copiedPix ? '1px solid #10b981' : '1px solid rgba(245, 158, 11, 0.4)',
                color: copiedPix ? '#ffffff' : '#fbbf24',
                padding: '6px 10px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.78rem',
                fontWeight: 600,
                transition: 'all 0.2s',
              }}
            >
              {copiedPix ? <Check size={14} /> : <Copy size={14} />}
              <span>{copiedPix ? 'Copiado!' : 'Copiar'}</span>
            </button>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. RESUMO FINANCEIRO DO MÊS (EXTRATO PESSOAL)                   */}
      {/* ============================================================== */}
      <div style={{ marginBottom: '1.75rem' }}>
        <h3 style={{ fontSize: '1.05rem', color: '#f8fafc', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <DollarSign size={18} className="text-amber" />
          Meu Fechamento &amp; Saldo do Mês
        </h3>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem',
          }}
        >
          {/* Card Horas Extras */}
          <div
            style={{
              background: 'rgba(30, 41, 59, 0.7)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              borderRadius: '12px',
              padding: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Horas Extras ({financialSummary.totalHours}h)</span>
              <Clock size={18} className="text-amber" />
            </div>
            <strong style={{ fontSize: '1.5rem', color: '#fbbf24', display: 'block' }}>
              {formatBRL(financialSummary.totalHoursVal)}
            </strong>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
              Taxa base: {formatBRL(myMember.hourlyRate || 50)}/h
            </span>
          </div>

          {/* Card Diárias */}
          <div
            style={{
              background: 'rgba(30, 41, 59, 0.7)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: '12px',
              padding: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Diárias ({financialSummary.totalDays} dias)</span>
              <Compass size={18} className="text-cyan" />
            </div>
            <strong style={{ fontSize: '1.5rem', color: '#38bdf8', display: 'block' }}>
              {formatBRL(financialSummary.totalDaysVal)}
            </strong>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
              Taxa diária: {formatBRL(myMember.dailyRate || 200)}/dia
            </span>
          </div>

          {/* Card Total a Receber / Quitado */}
          <div
            style={{
              background: 'rgba(30, 41, 59, 0.7)',
              border: financialSummary.isPaid ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(234, 179, 8, 0.3)',
              borderRadius: '12px',
              padding: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                {financialSummary.isPaid ? 'Total Quitado' : 'Total Apurado (Pendente)'}
              </span>
              {financialSummary.isPaid ? <CheckCircle2 size={18} className="text-green" /> : <DollarSign size={18} className="text-gold" />}
            </div>
            <strong style={{ fontSize: '1.5rem', color: financialSummary.isPaid ? '#34d399' : '#f59e0b', display: 'block' }}>
              {formatBRL(financialSummary.total)}
            </strong>
            <span style={{ fontSize: '0.75rem', color: financialSummary.isPaid ? '#34d399' : '#fbbf24', marginTop: '4px', display: 'block' }}>
              {financialSummary.isPaid ? '✅ Saldo já quitado e zerado' : '⏳ Previsão de quitação até dia 05'}
            </span>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. ATUAÇÃO FIEL PELAS 11 FUNÇÕES DA EMPRESA                    */}
      {/* ============================================================== */}
      <div style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '8px' }}>
          <h3 style={{ fontSize: '1.05rem', color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Briefcase size={18} className="text-amber" />
            Minhas Atuações por Função na Empresa (11 Funções Oficiais)
          </h3>
          <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
            Rastreamento fiel e pontuação das funções cumpridas
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '0.75rem',
          }}
        >
          {OFFICIAL_COMPANY_ROLES.map((roleName) => {
            const count = roleCounts[roleName] || 0;
            const isMainRole = normalizeToOfficialRole(myMember.role) === roleName;
            const isSecRole = Array.isArray(myMember.secondaryRoles) &&
              myMember.secondaryRoles.map(normalizeToOfficialRole).includes(roleName);
            const icon = ROLE_ICONS_MAP[roleName] || '💼';

            return (
              <div
                key={roleName}
                style={{
                  background: count > 0 ? 'rgba(30, 41, 59, 0.85)' : 'rgba(30, 41, 59, 0.4)',
                  border: count > 0 ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <span style={{ fontSize: '1.4rem' }}>{icon}</span>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: count > 0 ? '#f8fafc' : '#64748b',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={roleName}
                    >
                      {roleName}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: isMainRole ? '#fbbf24' : isSecRole ? '#38bdf8' : '#64748b' }}>
                      {isMainRole ? 'Minha Função Principal' : isSecRole ? 'Função Secundária' : count > 0 ? 'Cumprida em Missões' : 'Ainda não exercida'}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    padding: '4px 10px',
                    borderRadius: '999px',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    background: count > 0 ? '#f59e0b' : 'rgba(255, 255, 255, 0.05)',
                    color: count > 0 ? '#0f172a' : '#64748b',
                    flexShrink: 0,
                  }}
                >
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
      <div style={{ marginBottom: '1.75rem' }}>
        <h3 style={{ fontSize: '1.05rem', color: '#f8fafc', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={18} className="text-amber" />
          Minhas Missões &amp; Solicitação de Horas Extras
        </h3>

        {myMissions.length === 0 ? (
          <div
            style={{
              padding: '2rem',
              textAlign: 'center',
              background: 'rgba(30, 41, 59, 0.4)',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              color: '#94a3b8',
            }}
          >
            Você ainda não possui missões registradas nesta base.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {myMissions.slice(0, 10).map((m) => {
              const isMDay = Boolean(m.isMultiDay || (m.endDate && m.endDate !== m.date));
              const requests = Array.isArray(m.extraHoursRequests) ? m.extraHoursRequests : [];
              const myRequests = requests.filter((r) => String(r.memberId) === String(myMember.id));
              const isClosed = m.missionStatus === 'Finalizada';

              return (
                <div
                  key={m.id}
                  style={{
                    background: 'rgba(30, 41, 59, 0.7)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    padding: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '1rem',
                  }}
                >
                  <div style={{ flex: '1 1 300px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700 }}>{m.code || `#${m.id}`}</span>
                      <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
                        📅 {formatDateBR(m.date)} {isMDay && m.endDate ? ` a ${formatDateBR(m.endDate)}` : ''}
                      </span>
                      {isMDay ? (
                        <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8' }}>
                          🏕️ Viagem (+1d)
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24' }}>
                          🕒 {m.departureTime || '--:--'} às {m.returnTimeEstimated || '--:--'}
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: '0.7rem',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: isClosed ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                          color: isClosed ? '#34d399' : '#60a5fa',
                        }}
                      >
                        {m.missionStatus || 'Agendada'}
                      </span>
                    </div>

                    <strong style={{ fontSize: '0.98rem', color: '#f8fafc', display: 'block', marginBottom: '2px' }}>
                      {m.description}
                    </strong>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>📍 {m.locationName}</span>

                    {/* Histórico de solicitações de horas extras nesta missão */}
                    {myRequests.length > 0 && (
                      <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {myRequests.map((req, rIdx) => {
                          const isPending = req.status === 'PENDING';
                          const isApproved = req.status === 'APPROVED';
                          return (
                            <span
                              key={rIdx}
                              style={{
                                fontSize: '0.72rem',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                background: isPending ? 'rgba(234, 179, 8, 0.15)' : isApproved ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                color: isPending ? '#fbbf24' : isApproved ? '#34d399' : '#f87171',
                                border: isPending ? '1px solid rgba(234, 179, 8, 0.3)' : isApproved ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
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
                      style={{
                        background: 'rgba(245, 158, 11, 0.15)',
                        border: '1px solid #f59e0b',
                        color: '#fbbf24',
                        padding: '8px 14px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        whiteSpace: 'nowrap',
                      }}
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
                <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                  {requestModalMission.code} • {requestModalMission.description}
                </span>
              </div>
              <button className="modal-close" onClick={() => setRequestModalMission(null)}>✕</button>
            </div>

            <form onSubmit={handleSubmitExtraHoursRequest} className="modal-form">
              <p style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.4' }}>
                Informe a quantidade de horas adicionais necessárias em campo e a justificativa para que a administração possa analisar e aprovar.
              </p>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                  Quantidade de Horas Extras Adicionais:
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[0.5, 1.0, 1.5, 2.0, 3.0, 4.0].map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setRequestedHours(h)}
                      style={{
                        flex: 1,
                        padding: '8px 0',
                        borderRadius: '8px',
                        background: requestedHours === h ? '#f59e0b' : 'rgba(255, 255, 255, 0.05)',
                        color: requestedHours === h ? '#0f172a' : '#f8fafc',
                        border: requestedHours === h ? '1px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.1)',
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                      }}
                    >
                      +{h}h
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                  Motivo / Justificativa da Prorrogação:
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Ex: Pauta atrasou devido ao cliente; necessário captar mais cenas ao pôr do sol..."
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    background: '#0f172a',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#f8fafc',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
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
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
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

