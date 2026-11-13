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
} from 'lucide-react';
import {
  OFFICIAL_COMPANY_ROLES,
  ROLE_ICONS_MAP,
  ROLE_COLORS_MAP,
  normalizeToOfficialRole,
  computeMemberRoleCounts,
} from '../utils/companyRoles';
import { apiRequestExtraHours, apiExtendMissionReturnTime, apiUpdatePixKey } from '../utils/api';
import { alertDialog, confirmDialog } from '../utils/dialog';
import { calculateMissionOffHours, evaluateMissionExtension, isOffHoursTime } from '../utils/workHours';
import { sortMissionsByStatusPriority, getMissionLiveProgress } from '../utils/geo';
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

  // ============================================================================
  // DISPONIBILIDADE DO COLABORADOR PARA HORAS EXTRAS FORA DO EXPEDIENTE
  // ============================================================================
  const curAvail = myMember?.extraHoursAvailability || { status: 'available' };
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
    try {
      const updatedMember = {
        ...myMember,
        extraHoursAvailability: {
          status: 'available',
          scope: 'always_offhours',
          updatedAt: new Date().toISOString(),
        },
      };
      if (onUpdateMember) {
        await onUpdateMember(updatedMember);
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
    try {
      const updatedMember = {
        ...myMember,
        extraHoursAvailability: {
          status: 'unavailable',
          scope: availScope,
          startDate: availStartDate,
          startTime: availStartTime,
          endDate: availEndDate,
          endTime: availEndTime,
          presetReason: availPresetReason,
          reason: finalReason,
          updatedAt: new Date().toISOString(),
        },
      };
      if (onUpdateMember) {
        await onUpdateMember(updatedMember);
      }
      setIsEditingAvail(false);
      await alertDialog({
        title: '🚫 Indisponibilidade Registrada',
        message: 'Sua indisponibilidade para horas extras foi registrada! Os administradores serão alertados na lista de colaboradores ao criar missões fora do expediente.',
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
    requestNotificationPermission().catch(() => {});

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
  const urgentMissionNow = useMemo(() => {
    return myMissions.find((m) => {
      const prog = getMissionLiveProgress(m);
      return prog.isUrgentEnd;
    }) || null;
  }, [myMissions, liveTick]);

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

  // Missões ordenadas estritamente por ordem de acontecimento (o que vai acontecer logo aparece primeiro)
  const sortedMyMissions = useMemo(() => {
    return sortMissionsByStatusPriority(myMissions);
  }, [myMissions, liveTick]);

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

        {/* Divisor Visual Sutil para Harmonia Central */}
        <div className="cs-hero-divider" />

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

                <div className={`cs-role-count-badge ${count > 0 ? 'active' : ''}`}>
                  {count}x
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
            Você ainda não possui missões registradas nesta base.
          </div>
        ) : (
          <div className="cs-missions-list">
            {sortedMyMissions.slice(0, 15).map((m) => {
              const isMDay = Boolean(m.isMultiDay || (m.endDate && m.endDate !== m.date));
              const requests = Array.isArray(m.extraHoursRequests) ? m.extraHoursRequests : [];
              const myRequests = requests.filter((r) => String(r.memberId) === String(myMember.id));
              const isClosed = m.missionStatus === 'Finalizada';
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
                        {isMDay ? (
                          <span className="cs-badge-mday">
                            🏕️ Viagem (+1d)
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

                    {/* Ação: Solicitar Horas Extras ou Prorrogar Retorno */}
                    {!isClosed && (
                      <button
                        type="button"
                        onClick={() => setRequestModalMission(m)}
                        className={`cs-btn-request-extra ${progress.isUrgentOffHours ? 'btn-urgent-extra' : progress.isUrgentInHours ? 'btn-inhours-extend' : progress.isHappeningNow ? 'btn-live-extra' : ''}`}
                      >
                        {progress.isUrgentOffHours ? (
                          <>
                            <Zap size={15} />
                            <span>⚡ Solicitar Mais Horas Extras (+1h, +2h)</span>
                          </>
                        ) : progress.isUrgentInHours ? (
                          <>
                            <Clock size={15} />
                            <span>⏱️ Prorrogar Retorno (+30m, +1h)</span>
                          </>
                        ) : progress.isOffHoursEnd ? (
                          <>
                            <Zap size={14} />
                            <span>Solicitar Hora Extra (+1h, +2h)</span>
                          </>
                        ) : (
                          <>
                            <Clock size={14} />
                            <span>Prorrogar Horário de Retorno</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
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
    </div>
  );
}
