import React, { useState, useEffect, useMemo } from 'react';
import {
  DollarSign,
  Calendar,
  Clock,
  Compass,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  FileText,
  Printer,
  Share2,
  Search,
  Filter,
  Building,
  Edit2,
  Eye,
  Check,
  X,
  CreditCard,
  Copy,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  HelpCircle,
  TrendingUp,
  RotateCcw,
} from 'lucide-react';
import { apiGetPayouts, apiSavePayout } from '../utils/api';
import { alertDialog, confirmDialog } from '../utils/dialog';
import { calculateMissionOffHours } from '../utils/workHours';

// Formata data ISO para PT-BR (dd/mm/aaaa)
function formatDateBR(dateStr) {
  if (!dateStr) return '';
  const parts = String(dateStr).split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

// Formata moeda Real BRL
function formatBRL(val) {
  const n = Number(val) || 0;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Calcula duração em horas entre saída e retorno
function calculateMissionHours(depTime, retTime) {
  if (!depTime) return 4; // padrão 4h
  if (!retTime) return 4;
  try {
    const [h1, m1] = depTime.split(':').map(Number);
    const [h2, m2] = retTime.split(':').map(Number);
    let mins = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (mins < 0) mins += 24 * 60; // atravessou meia-noite
    const hrs = mins / 60;
    return hrs > 0 ? Number(hrs.toFixed(1)) : 4;
  } catch (e) {
    return 4;
  }
}

// Calcula dias entre datas para missões de longa duração (diárias operacionais inclusivas)
function calculateDaysBetween(startDateStr, endDateStr) {
  if (!startDateStr || !endDateStr) return 1;
  try {
    const [y1, m1, d1] = String(startDateStr).split('-').map(Number);
    const [y2, m2, d2] = String(endDateStr).split('-').map(Number);
    if (!y1 || !y2) return 1;
    const utc1 = Date.UTC(y1, m1 - 1, d1);
    const utc2 = Date.UTC(y2, m2 - 1, d2);
    // Dias inclusivos: 25/11 a 27/11 = 3 diárias (dias 25, 26 e 27)
    const diff = Math.round((utc2 - utc1) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 1;
  } catch (e) {
    return 1;
  }
}

export default function TeamPayoutsDashboard({
  members = [],
  missions = [],
  onUpdateMember,
}) {
  // Mês selecionado (YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Filtros
  const [companyFilter, setCompanyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all'); // all, pendente, pago
  const [searchTerm, setSearchTerm] = useState('');

  // Fechamentos de pagamento salvos no backend (memberId -> closure)
  const [closures, setClosures] = useState({});
  const [isLoadingClosures, setIsLoadingClosures] = useState(false);

  // Modais
  const [editingRatesMember, setEditingRatesMember] = useState(null);
  const [viewingStatementMember, setViewingStatementMember] = useState(null);
  const [copiedPixMemberId, setCopiedPixMemberId] = useState(null);

  // Form local de edição de taxas
  const [ratesForm, setRatesForm] = useState({
    rateModel: 'hourly',
    hourlyRate: 50,
    blockRate: 200,
    dailyRate: 200,
    pixKey: '',
  });

  // Carrega status de pagamentos para o mês selecionado
  useEffect(() => {
    let isMounted = true;
    setIsLoadingClosures(true);
    apiGetPayouts(selectedMonth)
      .then((res) => {
        if (isMounted && res.success && res.closures) {
          setClosures(res.closures);
        }
      })
      .catch((err) => console.warn('Erro ao carregar fechamentos:', err))
      .finally(() => {
        if (isMounted) setIsLoadingClosures(false);
      });

    return () => { isMounted = false; };
  }, [selectedMonth]);

  // Navegação de meses
  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const monthLabel = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const dateObj = new Date(y, m - 1, 1);
    const name = dateObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return name.charAt(0).toUpperCase() + name.slice(1);
  }, [selectedMonth]);

  // Próximo mês para dia 5
  const closingDeadlineLabel = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const nextDate = new Date(y, m, 1);
    const nextMonthName = nextDate.toLocaleDateString('pt-BR', { month: 'long' });
    return `Fechamento Oficial da Folha: Dia 05 de ${nextMonthName}`;
  }, [selectedMonth]);

  // --------------------------------------------------------------------------
  // APURAÇÃO DE HORAS, DIÁRIAS E VALORES POR COLABORADOR
  // --------------------------------------------------------------------------
  const memberPayouts = useMemo(() => {
    // 1. Filtra missões do mês
    const monthMissions = missions.filter((m) => {
      const mDate = m.date || '';
      return mDate.startsWith(selectedMonth);
    });

    return members.map((member) => {
      const memIdStr = String(member.id);
      const memNameNorm = member.name.trim().toLowerCase();

      // Configuração financeira individual
      const hourlyRate = Number(member.hourlyRate ?? member.hourly_rate ?? 50);
      const dailyRate = Number(member.dailyRate ?? member.daily_rate ?? 200);
      const rateModel = member.rateModel || member.rate_model || 'hourly';
      const blockRate = Number(member.blockRate ?? member.block_rate ?? (hourlyRate * 4 || 200));
      const pixKey = member.pixKey || member.pix_key || '';

      // Valores Homologados (Missões Concluídas / Efetivos para Pagamento)
      let totalHours = 0;
      let totalOffHoursAmount = 0;
      let totalTravelDays = 0;
      let totalDailyAmount = 0;
      let completedMissionCount = 0;
      let totalAmount = 0;

      // Valores Previstos / A Cumprir (Missões Agendadas / Não Homologadas)
      let plannedHours = 0;
      let plannedOffHoursAmount = 0;
      let plannedTravelDays = 0;
      let plannedDailyAmount = 0;
      let scheduledMissionCount = 0;
      let plannedTotalAmount = 0;

      const statementMissions = [];

      monthMissions.forEach((m) => {
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
        const inEditorIds = editorIds.includes(memIdStr);
        const inEditorDisplay = m.editorNamesDisplay && m.editorNamesDisplay.trim().toLowerCase().includes(memNameNorm);

        const participated = isDriver || inTeamIds || inTeamMembers || inTeamField || inEditorIds || inEditorDisplay;

        if (participated) {
          const mStatus = String(m.missionStatus || 'Agendada').trim().toLowerCase();
          const isCompleted = (mStatus === 'finalizada' || mStatus === 'finalizado' || mStatus === 'concluída' || mStatus === 'concluida');
          const isCancelled = (mStatus === 'cancelada' || mStatus === 'cancelado');

          // Missões canceladas são completamente desconsideradas
          if (isCancelled) return;

          if (isCompleted) {
            completedMissionCount++;
          } else {
            scheduledMissionCount++;
          }

          const isMDay = Boolean(m.isMultiDay || (m.endDate && m.endDate !== m.date));
          const missionHours = calculateMissionHours(m.departureTime, m.returnTimeEstimated);

          // Apuração de horas comerciais vs. fora do expediente (Banco de Horas)
          const offHoursInfo = calculateMissionOffHours(
            m.date,
            m.departureTime,
            m.endDate,
            m.returnTimeEstimated,
            isMDay
          );
          const offHoursWorked = offHoursInfo.offHours;
          const inHoursWorked = offHoursInfo.inHours;

          // Taxa personalizada na missão ou taxa padrão do perfil
          const customRate = (m.customRates && m.customRates[member.id] !== undefined && m.customRates[member.id] !== null && m.customRates[member.id] !== '')
            ? Number(m.customRates[member.id])
            : null;
          const effectiveHourlyRate = customRate !== null ? customRate : hourlyRate;
          const effectiveDailyRate = customRate !== null ? customRate : (dailyRate > 0 ? dailyRate : 200);

          let itemAmount = 0;
          let daysCount = 1;

          // Regra mandatória: se for mais de um dia OU configurada como Diária, calcula por Diária
          const isDailyRemuneration = Boolean(isMDay || m.remunerationType === 'daily');

          if (isDailyRemuneration) {
            daysCount = isMDay ? calculateDaysBetween(m.date, m.endDate) : 1;
            itemAmount = daysCount * effectiveDailyRate;

            if (isCompleted) {
              totalTravelDays += daysCount;
              totalDailyAmount += itemAmount;
              totalAmount += itemAmount;
            } else {
              plannedTravelDays += daysCount;
              plannedDailyAmount += itemAmount;
              plannedTotalAmount += itemAmount;
            }
          } else {
            // Banco de Horas: Horas fora do expediente + Horas extras aprovadas pela gestão
            const extraApproved = Number(m.extraHoursApproved) || 0;
            const totalMissionOffHours = offHoursWorked + extraApproved;

            if (totalMissionOffHours > 0) {
              if (rateModel === 'block_4h') {
                const ratePerHour = customRate !== null ? customRate : ((blockRate > 0 ? blockRate : 200) / 4);
                itemAmount = totalMissionOffHours * ratePerHour;
              } else {
                itemAmount = totalMissionOffHours * effectiveHourlyRate;
              }
            } else {
              itemAmount = 0;
            }

            if (isCompleted) {
              totalHours += totalMissionOffHours;
              totalOffHoursAmount += itemAmount;
              totalAmount += itemAmount;
            } else {
              plannedHours += totalMissionOffHours;
              plannedOffHoursAmount += itemAmount;
              plannedTotalAmount += itemAmount;
            }
          }

          statementMissions.push({
            id: m.id,
            code: m.code || `#${m.id}`,
            date: m.date,
            endDate: m.endDate,
            isMultiDay: isMDay,
            missionStatus: m.missionStatus || 'Agendada',
            isCompleted,
            remunerationType: isDailyRemuneration ? 'daily' : 'off_hours',
            daysCount,
            description: m.description || 'Missão sem título',
            locationName: m.locationName || 'Local de gravação',
            departureTime: m.departureTime || '--:--',
            returnTimeEstimated: m.returnTimeEstimated || '--:--',
            hoursWorked: missionHours,
            offHoursWorked,
            extraHoursApproved: Number(m.extraHoursApproved) || 0,
            inHoursWorked,
            isOffHours: offHoursInfo.isOffHours,
            offHoursSegments: offHoursInfo.offHoursSegments || [],
            effectiveHourlyRate,
            effectiveDailyRate,
            isCustomRate: customRate !== null,
            itemAmount,
            roleInMission: isDriver ? 'Motorista / Condutor' : (inEditorIds || inEditorDisplay) ? 'Editor / Pós-Produção' : 'Equipe de Campo',
          });
        }
      });

      // Fechamento salvo no backend (se houver)
      const closure = closures[member.id] || null;
      const status = closure?.status || 'Pendente';
      const paidAt = closure?.paidAt || null;
      const hoursCleared = closure?.hoursCleared ?? (status === 'Pago' ? Number(totalHours.toFixed(1)) : 0);
      const clearedAt = closure?.clearedAt || (status === 'Pago' ? paidAt : null);

      return {
        ...member,
        hourlyRate,
        dailyRate: dailyRate > 0 ? dailyRate : 200,
        rateModel,
        blockRate: blockRate > 0 ? blockRate : 200,
        pixKey,
        // Homologado (efetivo a pagar)
        totalHours: Number(totalHours.toFixed(1)),
        totalOffHoursAmount: Number(totalOffHoursAmount.toFixed(2)),
        totalTravelDays,
        totalDailyAmount: Number(totalDailyAmount.toFixed(2)),
        missionCount: completedMissionCount,
        totalAmount: Number(totalAmount.toFixed(2)),
        // A cumprir (previsto / não homologado)
        plannedHours: Number(plannedHours.toFixed(1)),
        plannedOffHoursAmount: Number(plannedOffHoursAmount.toFixed(2)),
        plannedTravelDays,
        plannedDailyAmount: Number(plannedDailyAmount.toFixed(2)),
        scheduledMissionCount,
        plannedTotalAmount: Number(plannedTotalAmount.toFixed(2)),
        totalAllMissionsCount: completedMissionCount + scheduledMissionCount,
        status,
        paidAt,
        hoursCleared,
        clearedAt,
        statementMissions: statementMissions.sort((a, b) => String(a.date).localeCompare(String(b.date))),
      };
    });
  }, [members, missions, selectedMonth, closures]);

  // --------------------------------------------------------------------------
  // FILTRAGEM E BUSCA NA LISTA
  // --------------------------------------------------------------------------
  const filteredPayouts = useMemo(() => {
    return memberPayouts.filter((m) => {
      if (companyFilter !== 'all' && m.company !== companyFilter) return false;
      if (statusFilter !== 'all' && m.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const inName = m.name.toLowerCase().includes(q);
        const inRole = m.role?.toLowerCase().includes(q);
        if (!inName && !inRole) return false;
      }
      return true;
    });
  }, [memberPayouts, companyFilter, statusFilter, searchTerm]);

  // Totais Executivos da Folha
  const summaryTotals = useMemo(() => {
    const totalFolha = memberPayouts.reduce((acc, m) => acc + m.totalAmount, 0);
    const totalHoras = memberPayouts.reduce((acc, m) => acc + m.totalHours, 0);
    const totalHorasValor = memberPayouts.reduce((acc, m) => acc + (m.totalOffHoursAmount || 0), 0);
    const totalViagens = memberPayouts.reduce((acc, m) => acc + m.totalTravelDays, 0);
    const totalDiariasValor = memberPayouts.reduce((acc, m) => acc + (m.totalDailyAmount || 0), 0);
    const totalPagos = memberPayouts.filter((m) => m.status === 'Pago').length;
    const totalPendentes = memberPayouts.filter((m) => m.status !== 'Pago' && m.totalAmount > 0).length;

    return {
      totalFolha,
      totalHoras: Number(totalHoras.toFixed(1)),
      totalHorasValor,
      totalViagens,
      totalDiariasValor,
      totalPagos,
      totalPendentes,
    };
  }, [memberPayouts]);

  // --------------------------------------------------------------------------
  // HANDLERS DE AÇÃO
  // --------------------------------------------------------------------------
  const handleOpenEditRates = (member) => {
    setEditingRatesMember(member);
    setRatesForm({
      rateModel: member.rateModel || member.rate_model || 'hourly',
      hourlyRate: member.hourlyRate ?? member.hourly_rate ?? 50,
      blockRate: member.blockRate ?? member.block_rate ?? 200,
      dailyRate: member.dailyRate ?? member.daily_rate ?? 200,
      pixKey: member.pixKey || member.pix_key || '',
    });
  };

  const handleSaveRates = async () => {
    if (!editingRatesMember) return;
    const updated = {
      ...editingRatesMember,
      rateModel: ratesForm.rateModel,
      rate_model: ratesForm.rateModel,
      hourlyRate: Number(ratesForm.hourlyRate) || 0,
      hourly_rate: Number(ratesForm.hourlyRate) || 0,
      blockRate: Number(ratesForm.blockRate) || 0,
      block_rate: Number(ratesForm.blockRate) || 0,
      dailyRate: Number(ratesForm.dailyRate) || 0,
      daily_rate: Number(ratesForm.dailyRate) || 0,
      pixKey: ratesForm.pixKey.trim(),
      pix_key: ratesForm.pixKey.trim(),
    };

    if (onUpdateMember) {
      await onUpdateMember(updated);
    }
    setEditingRatesMember(null);
  };

  // Quitar e Zerar Horas do Colaborador (ou reabrir saldo)
  const handleClearMemberHours = async (member) => {
    const isAlreadyPaid = member.status === 'Pago';

    if (isAlreadyPaid) {
      const reopen = await confirmDialog({
        title: 'Reabrir Banco de Horas',
        message: `O saldo de ${member.name} já consta como quitado (${formatBRL(member.totalAmount)}). Deseja reabrir este saldo para Pendente?`,
        confirmText: 'Reabrir Saldo',
        cancelText: 'Manter Quitado',
        variant: 'warning',
      });
      if (!reopen) return;

      try {
        const res = await apiSavePayout({
          monthKey: selectedMonth,
          memberId: member.id,
          status: 'Pendente',
          paidAmount: 0,
          hoursCleared: 0,
          clearedAt: null,
        });
        if (res.success && res.closure) {
          setClosures((prev) => ({
            ...prev,
            [member.id]: res.closure,
          }));
        }
      } catch (err) {
        await alertDialog({
          title: 'Erro',
          message: 'Não foi possível reabrir o saldo de horas.',
          variant: 'danger',
        });
      }
      return;
    }

    const confirmClear = await confirmDialog({
      title: 'Zerar Horas & Confirmar Pagamento',
      message: `Confirmar quitação e zerar saldo de horas de ${member.name}?`,
      description: `Valor apurado: ${formatBRL(member.totalAmount)} referente a ${member.totalHours}h no banco de horas (fora do expediente) e ${member.totalTravelDays} diárias de viagem. Ao confirmar, o saldo deste mês será marcado como Pago e zerado.`,
      confirmText: 'Zerar Horas (Quitar)',
      cancelText: 'Cancelar',
      variant: 'success',
    });
    if (!confirmClear) return;

    try {
      const res = await apiSavePayout({
        monthKey: selectedMonth,
        memberId: member.id,
        status: 'Pago',
        paidAmount: member.totalAmount,
        hoursCleared: member.totalHours,
        clearedAt: new Date().toISOString(),
      });
      if (res.success && res.closure) {
        setClosures((prev) => ({
          ...prev,
          [member.id]: res.closure,
        }));
      }
    } catch (err) {
      await alertDialog({
        title: 'Erro',
        message: 'Não foi possível zerar o saldo de horas no servidor.',
        variant: 'danger',
      });
    }
  };

  const handleTogglePaidStatus = async (member) => {
    return handleClearMemberHours(member);
  };

  // Compartilhar demonstrativo no WhatsApp do colaborador
  const handleShareWhatsApp = (member) => {
    const digitsPhone = member.phone ? member.phone.replace(/\D/g, '') : '';
    const isPaid = member.status === 'Pago';
    const lines = [
      `📋 *MegaGestão - Extrato de Diárias & Horas*`,
      `👤 *Colaborador:* ${member.name}`,
      `📅 *Mês de Referência:* ${monthLabel}`,
      `---------------------------------------`,
      `🎯 *Missões Concluídas:* ${member.missionCount}${member.scheduledMissionCount > 0 ? ` (+${member.scheduledMissionCount} agendadas)` : ''}`,
      `⏱️ *Horas Extras Homologadas:* ${member.totalHours}h (${formatBRL(member.totalOffHoursAmount)})`,
      `📅 *Diárias Homologadas:* ${member.totalTravelDays} diárias (${formatBRL(member.totalDailyAmount)})`,
      member.plannedHours > 0 ? `⏳ *Previsão em Pautas Agendadas (A Cumprir):* ${member.plannedHours}h (${formatBRL(member.plannedOffHoursAmount)}) - Não Homologadas` : null,
      `💰 *Total Líquido Homologado a Pagar:* ${formatBRL(member.totalAmount)}`,
      member.pixKey ? `💳 *Chave PIX:* ${member.pixKey}` : null,
      `---------------------------------------`,
      isPaid
        ? `Status: *✅ HORAS ZERADAS & PAGAS* (Quitado)`
        : `Status: *⏳ SALDO PENDENTE* (Fechamento dia 05)`,
      `MegaFilmes & Mega Print • Sistema Operacional`,
    ].filter(Boolean).join('\n');

    const encoded = encodeURIComponent(lines);
    const url = digitsPhone.length >= 10
      ? `https://wa.me/55${digitsPhone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;

    window.open(url, '_blank');
  };

  // Copiar chave PIX com feedback temporário
  const handleCopyPix = async (pixKey, memberId) => {
    if (!pixKey) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(pixKey);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = pixKey;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedPixMemberId(memberId);
      setTimeout(() => setCopiedPixMemberId(null), 2500);
    } catch (err) {
      console.warn('Erro ao copiar chave PIX:', err);
    }
  };

  // Imprimir relatório da folha
  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="team-payouts-dashboard">
      {/* ============================================================== */}
      {/* 1. BARRA SUPERIOR: SELETOR DE MÊS & CONTROLES EXECUTIVOS       */}
      {/* ============================================================== */}
      <div className="payouts-toolbar-panel">
        <div className="payouts-month-selector">
          <button
            type="button"
            className="payouts-month-nav-btn"
            onClick={handlePrevMonth}
            title="Mês Anterior"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="payouts-month-current">
            <Calendar size={18} className="text-amber" />
            <span className="payouts-month-title">{monthLabel}</span>
          </div>

          <button
            type="button"
            className="payouts-month-nav-btn"
            onClick={handleNextMonth}
            title="Próximo Mês"
          >
            <ChevronRight size={18} />
          </button>

          <span className="payouts-deadline-badge">{closingDeadlineLabel}</span>
        </div>

        <div className="payouts-toolbar-actions">
          <button
            type="button"
            className="btn-payout-print"
            onClick={handlePrintReport}
            title="Imprimir folha de pagamento do mês"
          >
            <Printer size={15} />
            <span>Imprimir Folha</span>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. CARDS DE RESUMO EXECUTIVO (TOTAL DA FOLHA DO MÊS)          */}
      {/* ============================================================== */}
      <div className="payouts-summary-grid">
        <div className="payout-summary-card card-total-value">
          <div className="psc-icon-wrap">
            <DollarSign size={24} />
          </div>
          <div className="psc-info">
            <span className="psc-label">Total a Pagar (Folha do Mês)</span>
            <strong className="psc-value">{formatBRL(summaryTotals.totalFolha)}</strong>
            <span className="psc-sub">Soma de todas as diárias e horas</span>
          </div>
        </div>

        <div className="payout-summary-card card-hours">
          <div className="psc-icon-wrap">
            <Clock size={24} />
          </div>
          <div className="psc-info">
            <span className="psc-label">Horas Extras ({summaryTotals.totalHoras}h)</span>
            <strong className="psc-value text-amber">{formatBRL(summaryTotals.totalHorasValor)}</strong>
            <span className="psc-sub">Fora do expediente comercial</span>
          </div>
        </div>

        <div className="payout-summary-card card-travel">
          <div className="psc-icon-wrap">
            <Compass size={24} />
          </div>
          <div className="psc-info">
            <span className="psc-label">Diárias ({summaryTotals.totalViagens} d)</span>
            <strong className="psc-value text-cyan">{formatBRL(summaryTotals.totalDiariasValor)}</strong>
            <span className="psc-sub">Viagens e diárias de campo</span>
          </div>
        </div>

        <div className="payout-summary-card card-status">
          <div className="psc-icon-wrap">
            <CheckCircle2 size={24} />
          </div>
          <div className="psc-info">
            <span className="psc-label">Status de Pagamento</span>
            <strong className="psc-value">
              <span className="text-green">{summaryTotals.totalPagos} Pagos</span> / <span className="text-amber">{summaryTotals.totalPendentes} Pendentes</span>
            </strong>
            <span className="psc-sub">Previsão de quitação até dia 05</span>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. FILTROS E BUSCA                                             */}
      {/* ============================================================== */}
      <div className="payouts-filters-bar">
        <div className="pf-left">
          <div className="pf-select-wrap">
            <Building size={14} />
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="pf-select"
            >
              <option value="all">Todas as Empresas</option>
              <option value="MegaFilmes">MegaFilmes</option>
              <option value="Mega Print">Mega Print</option>
            </select>
          </div>

          <div className="pf-select-wrap">
            <Filter size={14} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pf-select"
            >
              <option value="all">Todos os Status</option>
              <option value="pendente">⏳ Apenas Pendentes</option>
              <option value="pago">✅ Apenas Pagos</option>
            </select>
          </div>
        </div>

        <div className="pf-right">
          <div className="pf-search-wrap">
            <Search size={14} />
            <input
              type="text"
              placeholder="Buscar colaborador ou função..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pf-search-input"
            />
            {searchTerm && (
              <button className="pf-clear-btn" onClick={() => setSearchTerm('')}>
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 4. TABELA / CARDS DE FECHAMENTO POR COLABORADOR                */}
      {/* ============================================================== */}
      <div className="payouts-table-container">
        {filteredPayouts.length === 0 ? (
          <div className="payouts-empty-state">
            <DollarSign size={40} className="text-muted" />
            <h4>Nenhum colaborador encontrado</h4>
            <p>Ajuste os filtros de busca ou selecione outro mês acima.</p>
          </div>
        ) : (
          <div className="payouts-cards-list">
            {filteredPayouts.map((member) => {
              const isPaid = member.status === 'Pago';

              return (
                <div
                  key={member.id}
                  className={`payout-member-card ${isPaid ? 'is-paid' : 'is-pending'}`}
                >
                  {/* Avatar e Dados Básicos */}
                  <div className="pmc-col-profile">
                    <div className="pmc-avatar">
                      {member.photoUrl ? (
                        <img src={member.photoUrl} alt={member.name} />
                      ) : (
                        <div className="pmc-avatar-placeholder">
                          {member.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="pmc-profile-text">
                      <strong className="pmc-name">{member.name}</strong>
                      <span className="pmc-role">{member.role}</span>
                      <span className="pmc-company">{member.company}</span>
                    </div>
                  </div>

                  {/* Configuração de Remuneração Atual */}
                  <div className="pmc-col-rates">
                    <div className="pmc-rate-box" title="Regra de pagamento cadastrada para este colaborador">
                      <span className="pmc-rate-lbl">Taxa Individual:</span>
                      <strong className="pmc-rate-val">
                        {member.rateModel === 'block_4h'
                          ? `${formatBRL(member.blockRate)} / 4h (R$ ${(member.blockRate / 4).toFixed(0)}/h)`
                          : `${formatBRL(member.hourlyRate)} / hora`}
                      </strong>
                      <small className="pmc-rate-sub">
                        Viagem: {formatBRL(member.dailyRate)} / dia
                      </small>
                    </div>
                    <button
                      type="button"
                      className="btn-edit-rates"
                      onClick={() => handleOpenEditRates(member)}
                      title="Editar valores de remuneração deste colaborador"
                    >
                      <Edit2 size={12} /> Editar Taxas
                    </button>
                  </div>

                  {/* Produção Detalhada no Mês (Missões, Horas Extras e Diárias Homologadas) */}
                  <div className="pmc-col-production">
                    <div className="pmc-prod-metric" title="Missões concluídas no mês">
                      <span className="pmc-prod-val">{member.missionCount}</span>
                      <span className="pmc-prod-lbl">
                        Concluídas {member.scheduledMissionCount > 0 && <span className="pmc-scheduled-count">({member.scheduledMissionCount} agend.)</span>}
                      </span>
                    </div>
                    <div className="pmc-prod-metric" title="Horas extras de missões concluídas (Banco de Horas Homologado)">
                      <span className="pmc-prod-val text-amber">{member.totalHours} h</span>
                      <span className="pmc-prod-lbl">Extras ({formatBRL(member.totalOffHoursAmount)})</span>
                    </div>
                    <div className="pmc-prod-metric" title="Diárias de missões concluídas">
                      <span className="pmc-prod-val text-cyan">{member.totalTravelDays} d</span>
                      <span className="pmc-prod-lbl">Diárias ({formatBRL(member.totalDailyAmount)})</span>
                    </div>
                    {member.plannedHours > 0 && (
                      <div className="pmc-planned-strip" title="Horas extras previstas em missões agendadas que ainda não aconteceram">
                        <span>⏳ {member.plannedHours}h a cumprir</span>
                        <small>(Não homologadas)</small>
                      </div>
                    )}
                  </div>

                  {/* Chave PIX Evidenciada com Cópia Rápida */}
                  <div className="pmc-col-pix">
                    <span className="pmc-pix-header">
                      <CreditCard size={12} className="text-cyan" />
                      <span>CHAVE PIX</span>
                    </span>
                    {member.pixKey ? (
                      <div className="pmc-pix-box" title={`Chave PIX: ${member.pixKey}`}>
                        <span className="pmc-pix-key-text">{member.pixKey}</span>
                        <button
                          type="button"
                          className={`btn-copy-pix ${copiedPixMemberId === member.id ? 'is-copied' : ''}`}
                          onClick={() => handleCopyPix(member.pixKey, member.id)}
                          title="Copiar Chave PIX para a área de transferência"
                        >
                          {copiedPixMemberId === member.id ? (
                            <>
                              <Check size={12} />
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
                      <div className="pmc-pix-empty">
                        <span className="pmc-pix-empty-text">Sem chave PIX</span>
                        <button
                          type="button"
                          className="btn-add-pix-link"
                          onClick={() => handleOpenEditRates(member)}
                          title="Cadastrar chave PIX deste colaborador"
                        >
                          + Cadastrar
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Valor Total a Pagar / Quitado */}
                  <div className="pmc-col-total">
                    <span className="pmc-total-lbl">{isPaid ? 'Total Quitado:' : 'Total Apurado:'}</span>
                    <strong className={`pmc-total-val ${isPaid ? 'text-green' : 'text-gold'}`}>
                      {formatBRL(member.totalAmount)}
                    </strong>
                    {isPaid ? (
                      <span className="cleared-hours-badge" title={`Horas quitadas em ${formatDateBR(member.clearedAt)}`}>
                        <Check size={11} /> {member.hoursCleared || member.totalHours}h quitadas
                      </span>
                    ) : (
                      <span className="pmc-pending-tag">
                        ⏳ Saldo Pendente
                      </span>
                    )}
                  </div>

                  {/* Status de Pagamento & Ações com Botão Zerar Horas */}
                  <div className="pmc-col-actions">
                    <button
                      type="button"
                      className={`btn-clear-hours ${isPaid ? 'is-cleared' : ''}`}
                      onClick={() => handleClearMemberHours(member)}
                      title={isPaid ? 'Horas quitadas e zeradas. Clique para reabrir saldo se necessário.' : 'Pagar e zerar o saldo de horas deste colaborador'}
                    >
                      {isPaid ? <CheckCircle2 size={14} /> : <RotateCcw size={14} />}
                      <span>{isPaid ? 'Horas Zeradas' : 'Zerar Horas'}</span>
                    </button>

                    <div className="pmc-quick-action-buttons">
                      <button
                        type="button"
                        className="pmc-action-btn"
                        onClick={() => setViewingStatementMember(member)}
                        title="Ver espelho detalhado de todas as missões do mês"
                      >
                        <Eye size={14} /> Espelho
                      </button>

                      <button
                        type="button"
                        className="pmc-action-btn btn-wa-share"
                        onClick={() => handleShareWhatsApp(member)}
                        title="Enviar demonstrativo no WhatsApp do colaborador"
                      >
                        <MessageCircle size={14} /> WhatsApp
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* 5. MODAL: EDITAR TAXAS INDIVIDUAIS DO COLABORADOR              */}
      {/* ============================================================== */}
      {editingRatesMember && (
        <div className="modal-overlay" onClick={() => setEditingRatesMember(null)}>
          <div
            className="modal-box modal-edit-rates"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '500px' }}
          >
            <div className="modal-header">
              <h2>
                <DollarSign size={18} style={{ color: '#fbbf24', marginRight: 8 }} />
                Configurar Remuneração: {editingRatesMember.name}
              </h2>
              <button className="modal-close" onClick={() => setEditingRatesMember(null)}>✕</button>
            </div>

            <div className="modal-form">
              <p className="modal-form-explainer">
                Defina o valor da hora e das diárias de viagens para <strong>{editingRatesMember.name}</strong>. Os cálculos de fechamento do dia 05 utilizarão estes valores automaticamente.
              </p>

              {/* Modelo de Cobrança */}
              <div className="form-group">
                <label>Modelo de Pagamento em Eventos Locais</label>
                <div className="rate-model-segmented">
                  <button
                    type="button"
                    className={`rm-seg-btn ${ratesForm.rateModel === 'hourly' ? 'is-active' : ''}`}
                    onClick={() => setRatesForm({ ...ratesForm, rateModel: 'hourly' })}
                  >
                    Por Hora Exata (R$/h)
                  </button>
                  <button
                    type="button"
                    className={`rm-seg-btn ${ratesForm.rateModel === 'block_4h' ? 'is-active' : ''}`}
                    onClick={() => setRatesForm({ ...ratesForm, rateModel: 'block_4h' })}
                  >
                    Por Bloco de 4 Horas (Pacote)
                  </button>
                </div>
              </div>

              {ratesForm.rateModel === 'hourly' ? (
                <div className="form-group">
                  <label>Valor por Hora (R$)</label>
                  <input
                    type="number"
                    step="5"
                    min="0"
                    value={ratesForm.hourlyRate}
                    onChange={(e) => setRatesForm({ ...ratesForm, hourlyRate: e.target.value })}
                    placeholder="Ex: 50.00"
                  />
                  <small className="field-hint-sub">Ex: Gabriel e Cauan R$ 25/h; Cinegrafistas sênior R$ 50/h.</small>
                </div>
              ) : (
                <div className="form-group">
                  <label>Valor a cada 4 Horas de Evento (R$)</label>
                  <input
                    type="number"
                    step="10"
                    min="0"
                    value={ratesForm.blockRate}
                    onChange={(e) => setRatesForm({ ...ratesForm, blockRate: e.target.value })}
                    placeholder="Ex: 200.00"
                  />
                  <small className="field-hint-sub">
                    Ex: R$ 200 a cada 4h equivale a R$ {(Number(ratesForm.blockRate) / 4 || 50).toFixed(2)} por hora.
                  </small>
                </div>
              )}

              {/* Valor da Diária de Viagem de Longa Duração */}
              <div className="form-group">
                <label>Valor da Diária de Viagem de Campo (+1 Dia) (R$)</label>
                <input
                  type="number"
                  step="10"
                  min="0"
                  value={ratesForm.dailyRate}
                  onChange={(e) => setRatesForm({ ...ratesForm, dailyRate: e.target.value })}
                  placeholder="Ex: 200.00"
                />
                <small className="field-hint-sub">
                  Aplicado por cada dia de operação em viagens para o interior ou gravações de mais de um dia.
                </small>
              </div>

              {/* Chave PIX */}
              <div className="form-group">
                <label>Chave PIX do Colaborador (Opcional)</label>
                <input
                  type="text"
                  value={ratesForm.pixKey}
                  onChange={(e) => setRatesForm({ ...ratesForm, pixKey: e.target.value })}
                  placeholder="CPF, E-mail, Celular ou Chave Aleatória"
                />
                <small className="field-hint-sub">Facilita a conferência no dia do pagamento.</small>
              </div>

              <div className="modal-footer" style={{ marginTop: 16 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setEditingRatesMember(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleSaveRates}
                >
                  <Check size={15} /> Salvar Taxas
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 6. MODAL: ESPELHO / EXTRATO DE MISSÕES DO MÊS                  */}
      {/* ============================================================== */}
      {viewingStatementMember && (
        <div className="modal-overlay" onClick={() => setViewingStatementMember(null)}>
          <div
            className="modal-box modal-statement"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '750px' }}
          >
            <div className="modal-header">
              <div>
                <h2>Espelho de Diárias &amp; Horas</h2>
                <span className="statement-sub-header">
                  {viewingStatementMember.name} • {monthLabel}
                </span>
              </div>
              <button className="modal-close" onClick={() => setViewingStatementMember(null)}>✕</button>
            </div>

            <div className="modal-form statement-body">
              {/* Resumo do Colaborador */}
              <div className="statement-summary-banner">
                <div className="ssb-item">
                  <span className="ssb-lbl">Missões</span>
                  <strong className="ssb-val">{viewingStatementMember.missionCount}</strong>
                </div>
                <div className="ssb-item">
                  <span className="ssb-lbl">Horas Extras</span>
                  <strong className="ssb-val text-amber">{viewingStatementMember.totalHours} h</strong>
                  <small style={{ fontSize: '0.75rem', color: '#fbbf24', opacity: 0.85 }}>{formatBRL(viewingStatementMember.totalOffHoursAmount)}</small>
                </div>
                <div className="ssb-item">
                  <span className="ssb-lbl">Diárias</span>
                  <strong className="ssb-val text-cyan">{viewingStatementMember.totalTravelDays} d</strong>
                  <small style={{ fontSize: '0.75rem', color: '#38bdf8', opacity: 0.85 }}>{formatBRL(viewingStatementMember.totalDailyAmount)}</small>
                </div>
                <div className="ssb-item ssb-total">
                  <span className="ssb-lbl">{viewingStatementMember.status === 'Pago' ? 'Total Quitado' : 'Total Líquido'}</span>
                  <strong className={`ssb-val ${viewingStatementMember.status === 'Pago' ? 'text-green' : 'text-gold'}`}>
                    {formatBRL(viewingStatementMember.totalAmount)}
                  </strong>
                </div>
              </div>

              {viewingStatementMember.status === 'Pago' && (
                <div className="statement-cleared-banner">
                  <CheckCircle2 size={16} className="text-green" />
                  <span>
                    <strong>Horas Zeradas &amp; Saldo Quitado:</strong> Este fechamento foi marcado como pago e o banco de horas foi quitado {viewingStatementMember.clearedAt ? `em ${formatDateBR(viewingStatementMember.clearedAt)}` : ''}.
                  </span>
                </div>
              )}

              {/* Chave PIX Evidenciada no Extrato do Colaborador */}
              {viewingStatementMember.pixKey ? (
                <div className="statement-pix-banner">
                  <div className="spb-left">
                    <CreditCard size={18} className="text-cyan" />
                    <div>
                      <span className="spb-label">Chave PIX para Pagamento:</span>
                      <strong className="spb-key">{viewingStatementMember.pixKey}</strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`btn-copy-pix btn-copy-pix-large ${copiedPixMemberId === viewingStatementMember.id ? 'is-copied' : ''}`}
                    onClick={() => handleCopyPix(viewingStatementMember.pixKey, viewingStatementMember.id)}
                    title="Copiar chave PIX"
                  >
                    {copiedPixMemberId === viewingStatementMember.id ? (
                      <>
                        <Check size={14} />
                        <span>Chave Copiada!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        <span>Copiar Chave PIX</span>
                      </>
                    )}
                  </button>
                </div>
              ) : null}

              {/* Aviso de Horas e Valores Agendados a Cumprir (Não Homologados) */}
              {viewingStatementMember.plannedHours > 0 && (
                <div className="statement-planned-banner">
                  <Clock size={16} className="text-amber" />
                  <span>
                    <strong>Horas Agendadas Não Homologadas:</strong> Existem <strong>{viewingStatementMember.plannedHours}h extras ({formatBRL(viewingStatementMember.plannedOffHoursAmount)})</strong> previstas em pautas agendadas que ainda não foram realizadas. Elas <strong>NÃO</strong> constam no Total Líquido a pagar e só serão homologadas após a conclusão efetiva das missões.
                  </span>
                </div>
              )}

              {/* Lista Detalhada de Missões */}
              <div className="statement-missions-list">
                {viewingStatementMember.statementMissions.length === 0 ? (
                  <p className="statement-empty">Nenhuma missão realizada por este colaborador neste mês.</p>
                ) : (
                  viewingStatementMember.statementMissions.map((item) => (
                    <div key={item.id} className={`statement-item-row ${!item.isCompleted ? 'row-scheduled-pending' : ''}`}>
                      <div className="sir-left">
                        <div className="sir-code-date">
                          <span className="sir-code">{item.code}</span>
                          <span className="sir-date">
                            <Calendar size={12} /> {formatDateBR(item.date)}
                            {item.isMultiDay && item.endDate && ` a ${formatDateBR(item.endDate)}`}
                          </span>

                          {/* Badge de Homologação de Missão Concluída vs. Agendada */}
                          {item.isCompleted ? (
                            <span className="sir-badge-homologated">
                              ✅ Concluída (Homologada)
                            </span>
                          ) : (
                            <span className="sir-badge-unhomologated">
                              ⏳ Agendada (Aguardando Realização)
                            </span>
                          )}

                          {item.remunerationType === 'daily' ? (
                            <span className="sir-badge-multiday">
                              📅 Diária {item.isMultiDay ? `Viagem (${item.daysCount}d)` : 'Campo (1d)'}
                            </span>
                          ) : (item.offHoursWorked > 0 || item.extraHoursApproved > 0) ? (
                            <span className={`sir-badge-hours ${item.isCompleted ? 'sir-badge-offhours' : 'sir-badge-offhours-planned'}`} title={item.isCompleted ? "Horas fora do expediente homologadas no banco de horas" : "Horas extras previstas caso a missão seja realizada conforme agendado"}>
                              ⏱️ +{item.offHoursWorked + (item.extraHoursApproved || 0)}h Extras {item.isCompleted ? '' : '(A Cumprir)'}
                              {item.extraHoursApproved > 0 && ` (+${item.extraHoursApproved}h aprovadas)`}
                            </span>
                          ) : (
                            <span className="sir-badge-hours sir-badge-inhours" title="Missão realizada 100% dentro do expediente comercial normal">
                              🟢 Expediente Comercial (0h extra)
                            </span>
                          )}
                        </div>
                        <strong className="sir-desc">{item.description}</strong>
                        <span className="sir-loc">{item.locationName}</span>
                        {item.remunerationType === 'daily' ? (
                          <div className="sir-times-breakdown">
                            <span className="sir-times">
                              <Calendar size={11} /> Modalidade Diária: {item.daysCount} {item.daysCount === 1 ? 'diária' : 'diárias'}
                            </span>
                            <span className="sir-rate-applied">
                              • Valor da Diária: {formatBRL(item.effectiveDailyRate)}/dia {item.isCustomRate ? '(Definida na Missão)' : '(Padrão)'}
                            </span>
                          </div>
                        ) : (
                          <div className="sir-times-breakdown">
                            <span className="sir-times">
                              <Clock size={11} /> Saída: {item.departureTime} • Retorno: {item.returnTimeEstimated} ({item.hoursWorked}h de missão)
                            </span>
                            {(item.offHoursWorked > 0 || item.extraHoursApproved > 0) ? (
                              <span className="sir-rate-applied">
                                • Taxa: {formatBRL(item.effectiveHourlyRate)}/h {item.isCustomRate ? '(Definida na Missão)' : '(Padrão)'}
                                {!item.isCompleted && ' • (Não homologada até a realização)'}
                              </span>
                            ) : (
                              <span className="sir-rate-commercial">
                                • Horário comercial (08h às 18h)
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="sir-right">
                        <span className="sir-role">{item.roleInMission}</span>
                        {item.isCompleted ? (
                          <strong className={`sir-amount ${item.itemAmount > 0 ? 'text-gold' : 'text-muted'}`}>
                            {formatBRL(item.itemAmount)}
                          </strong>
                        ) : (
                          <div className="sir-amount-scheduled-wrap">
                            <strong className="sir-amount text-muted">
                              R$ 0,00
                            </strong>
                            <small className="sir-amount-planned-hint">
                              Previsto: {formatBRL(item.itemAmount)}
                            </small>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Rodapé do Modal */}
              <div className="modal-footer" style={{ marginTop: 16 }}>
                <button
                  type="button"
                  className={`btn-clear-hours-modal ${viewingStatementMember.status === 'Pago' ? 'is-cleared' : ''}`}
                  onClick={async () => {
                    await handleClearMemberHours(viewingStatementMember);
                    setViewingStatementMember((prev) => prev ? {
                      ...prev,
                      status: prev.status === 'Pago' ? 'Pendente' : 'Pago'
                    } : null);
                  }}
                >
                  {viewingStatementMember.status === 'Pago' ? (
                    <>
                      <CheckCircle2 size={15} />
                      <span>Horas Quitadas (Reabrir)</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw size={15} />
                      <span>Zerar Horas &amp; Quitar Saldo</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => handleShareWhatsApp(viewingStatementMember)}
                >
                  <MessageCircle size={15} /> Enviar no WhatsApp
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setViewingStatementMember(null)}
                >
                  Fechar Espelho
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
