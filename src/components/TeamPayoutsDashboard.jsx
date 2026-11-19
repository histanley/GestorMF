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
  Briefcase,
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
  Zap,
  ExternalLink,
  ArrowUpDown,
  Plus,
  Receipt,
  Wallet,
} from 'lucide-react';
import MissionDetailModal from './MissionDetailModal';
import SalaryAdvancesModal from './SalaryAdvancesModal';
import FinancialOfficialStatementModal from './FinancialOfficialStatementModal';
import PayrollOfficialStatementModal from './PayrollOfficialStatementModal';
import { apiGetPayouts, apiSavePayout, apiGetSalaryAdvances } from '../utils/api';
import { alertDialog, confirmDialog } from '../utils/dialog';
import {
  calculateMissionOffHours,
  calculateEventOnlyOffHours,
  isMissionEligibleForPayout,
  isMemberEligibleForExtraHours,
  calculateExtraHoursRemuneration
} from '../utils/workHours';

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
  vehicles = [],
  baseLocation = null,
  currentUser = null,
  onUpdateMember,
  onEditMission = null,
}) {
  // Mês selecionado (YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Filtros e Ordenação
  const [companyFilter, setCompanyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all'); // all, pendente, pago
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('balance_desc'); // balance_desc (padrão com saldo no topo), name_asc, name_desc, hours_desc, daily_desc, missions_desc, planned_desc

  // Fechamentos de pagamento salvos no backend (memberId -> closure)
  const [closures, setClosures] = useState({});
  const [isLoadingClosures, setIsLoadingClosures] = useState(false);

  // Vales e Adiantamentos Salariais (FIN-05: memberId -> array de vales)
  const [advancesMap, setAdvancesMap] = useState({});
  const [advancesModalMember, setAdvancesModalMember] = useState(null);
  const [advancesModalOpen, setAdvancesModalOpen] = useState(false);
  const [isLoadingAdvances, setIsLoadingAdvances] = useState(false);

  // Modais e Raio-X
  const [editingRatesMember, setEditingRatesMember] = useState(null);
  const [viewingStatementMember, setViewingStatementMember] = useState(null);
  const [officialStatementMember, setOfficialStatementMember] = useState(null);
  const [isPayrollOfficialModalOpen, setIsPayrollOfficialModalOpen] = useState(false);
  const [statementFilter, setStatementFilter] = useState('all'); // 'all' | 'extra_hours' | 'daily' | 'commercial' | 'scheduled'
  const [copiedPixMemberId, setCopiedPixMemberId] = useState(null);
  const [selectedMissionForDetail, setSelectedMissionForDetail] = useState(null);

  const handleOpenMissionDetail = (missionItem) => {
    if (!missionItem) return;
    const fullMission = missions.find(
      (m) => String(m.id) === String(missionItem.id) ||
             (m.code && missionItem.code && String(m.code).trim() === String(missionItem.code).trim())
    ) || missionItem.rawMission || missionItem;
    setSelectedMissionForDetail(fullMission);
  };

  const handleOpenStatement = (member, filter = 'all') => {
    setStatementFilter(filter);
    setViewingStatementMember(member);
  };

  // Form local de edição de taxas
  const [ratesForm, setRatesForm] = useState({
    rateModel: 'hourly',
    hourlyRate: 50,
    blockRate: 200,
    dailyRate: 200,
    pixKey: '',
  });

  const loadAdvances = () => {
    setIsLoadingAdvances(true);
    apiGetSalaryAdvances(selectedMonth)
      .then((res) => {
        if (res && res.success && Array.isArray(res.advances)) {
          const map = {};
          res.advances.forEach((adv) => {
            const memId = String(adv.memberId);
            if (!map[memId]) map[memId] = [];
            map[memId].push(adv);
          });
          setAdvancesMap(map);
        }
      })
      .catch((err) => console.warn('Erro ao carregar vales:', err))
      .finally(() => setIsLoadingAdvances(false));
  };

  // Carrega status de pagamentos e vales para o mês selecionado
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

    loadAdvances();

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
      let totalCustomCount = 0;
      let totalCustomAmount = 0;
      let completedMissionCount = 0;
      let totalAmount = 0;

      // Valores Previstos / A Cumprir (Missões Agendadas / Não Homologadas)
      let plannedHours = 0;
      let plannedOffHoursAmount = 0;
      let plannedTravelDays = 0;
      let plannedDailyAmount = 0;
      let plannedCustomCount = 0;
      let plannedCustomAmount = 0;
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
          const isCancelled = (mStatus === 'cancelada' || mStatus === 'cancelado');

          // Missões canceladas são completamente desconsideradas
          if (isCancelled) return;

          // Regra Oficial MegaFilmes: Horas extras e diárias de campo são pagas assim que a missão retorna/evento termina,
          // independente do material de pós-produção estar ainda em edição pelo editor.
          const isCompleted = isMissionEligibleForPayout(m);

          if (isCompleted) {
            completedMissionCount++;
          } else {
            scheduledMissionCount++;
          }

          const isMDay = Boolean(m.isMultiDay || (m.endDate && m.endDate !== m.date));
          const missionHours = calculateMissionHours(m.departureTime, m.returnTimeEstimated);

          // Apuração de horas fora do expediente estritamente sobre o evento (sem deslocamento de ida/volta à base)
          const offHoursInfo = calculateEventOnlyOffHours(m);
          const offHoursWorked = offHoursInfo.offHours;
          const inHoursWorked = offHoursInfo.inHours;

          // Modalidade de remuneração (individual do colaborador ou padrão da missão)
          const memberRemunType = (m.memberRemunerationTypes && m.memberRemunerationTypes[member.id])
            || m.remunerationType
            || (isMDay ? 'daily' : 'off_hours');

          // Taxa personalizada na missão ou taxa padrão do perfil
          const customRate = (m.customRates && m.customRates[member.id] !== undefined && m.customRates[member.id] !== null && m.customRates[member.id] !== '')
            ? Number(m.customRates[member.id])
            : null;
          const effectiveHourlyRate = customRate !== null ? customRate : hourlyRate;
          const effectiveDailyRate = customRate !== null ? customRate : (dailyRate > 0 ? dailyRate : 200);

          let itemAmount = 0;
          let daysCount = 1;
          let extraFormulaText = '';

          if (memberRemunType === 'custom') {
            // Modalidade 3: Personalizada (Cachê ou valor fechado acordado diretamente)
            itemAmount = customRate !== null ? customRate : 0;
            extraFormulaText = `Cachê / Valor fixo acordado: R$ ${itemAmount.toFixed(2)}`;

            if (isCompleted) {
              totalCustomCount += 1;
              totalCustomAmount += itemAmount;
              totalAmount += itemAmount;
            } else {
              plannedCustomCount += 1;
              plannedCustomAmount += itemAmount;
              plannedTotalAmount += itemAmount;
            }
          } else if (memberRemunType === 'daily') {
            // Modalidade 2: Diária de Campo ou Viagem
            daysCount = isMDay ? calculateDaysBetween(m.date, m.endDate) : 1;
            itemAmount = daysCount * effectiveDailyRate;
            extraFormulaText = `${daysCount} diária(s) × R$ ${effectiveDailyRate.toFixed(2)}`;

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
            // Modalidade 1: Hora Extra (Banco de Horas)
            // REGRA OFICIAL MEGAFILMES:
            // "Os editores que ficam na pós-produção não devem receber horas extras."
            // Horas extras fora do expediente são devidas estritamente à equipe presencial de campo.
            const descClean = String(m.description || '').toLowerCase();
            const codeClean = String(m.code || m.id || '');
            const isSesi202611144 = codeClean.includes('202611144') || (descClean.includes('sesi') && descClean.includes('terceir'));
            const isMateusSesi202611144 = isSesi202611144 && memNameNorm.includes('mateus');

            const inEditorsDelivery = Boolean(
              m.editorsDelivery &&
              (m.editorsDelivery[memIdStr] ||
               m.editorsDelivery[member.name] ||
               Object.keys(m.editorsDelivery).some((k) => k.toLowerCase().includes(memNameNorm)))
            );
            const isAssignedEditor = inEditorIds || inEditorDisplay || inEditorsDelivery || isMateusSesi202611144;

            const isEligibleForExtras = !isMateusSesi202611144 && isMemberEligibleForExtraHours(member, m);

            if (!isEligibleForExtras || isAssignedEditor) {
              itemAmount = 0;
              extraFormulaText = 'Editor na Pós-Produção (Sem Horas Extras - exclusivo para campo)';
            } else {
              const extraApproved = Number(m.extraHoursApproved) || 0;
              const totalMissionOffHours = offHoursWorked + extraApproved;

              if (totalMissionOffHours > 0) {
                const extraRemun = calculateExtraHoursRemuneration(
                  totalMissionOffHours,
                  effectiveHourlyRate
                );
                itemAmount = extraRemun.amount;
                extraFormulaText = extraRemun.formulaText;
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
          }

          const descCleanPost = String(m.description || '').toLowerCase();
          const codeCleanPost = String(m.code || m.id || '');
          const isSesi202611144Post = codeCleanPost.includes('202611144') || (descCleanPost.includes('sesi') && descCleanPost.includes('terceir'));
          const isMateusSesi202611144Post = isSesi202611144Post && memNameNorm.includes('mateus');

          const inEditorsDeliveryPost = Boolean(
            m.editorsDelivery &&
            (m.editorsDelivery[memIdStr] ||
             m.editorsDelivery[member.name] ||
             Object.keys(m.editorsDelivery).some((k) => k.toLowerCase().includes(memNameNorm)))
          );
          const isAssignedEditorPost = inEditorIds || inEditorDisplay || inEditorsDeliveryPost || isMateusSesi202611144Post;

          const isEligibleForExtras = !isMateusSesi202611144Post && isMemberEligibleForExtraHours(member, m);
          const isOnlyEditor = isMateusSesi202611144Post || isAssignedEditorPost || (!isEligibleForExtras && (inEditorIds || inEditorDisplay));

          statementMissions.push({
            id: m.id,
            rawMission: m,
            code: m.code || `#${m.id}`,
            date: m.date,
            endDate: m.endDate,
            isMultiDay: isMDay,
            missionStatus: m.missionStatus || 'Agendada',
            isCompleted,
            isOnlyEditor,
            isEligibleForExtras,
            remunerationType: memberRemunType,
            daysCount,
            description: m.description || 'Missão sem título',
            locationName: m.locationName || 'Local de gravação',
            departureTime: m.departureTime || '--:--',
            returnTimeEstimated: m.returnTimeEstimated || '--:--',
            hoursWorked: missionHours,
            offHoursWorked: isEligibleForExtras ? offHoursWorked : 0,
            extraHoursApproved: isEligibleForExtras ? (Number(m.extraHoursApproved) || 0) : 0,
            inHoursWorked,
            isOffHours: offHoursInfo.isOffHours,
            offHoursSegments: offHoursInfo.offHoursSegments || [],
            effectiveHourlyRate,
            effectiveDailyRate,
            formulaText: extraFormulaText,
            isCustomRate: customRate !== null,
            itemAmount,
            roleInMission: (() => {
              if (isOnlyEditor || isAssignedEditorPost || isMateusSesi202611144Post) {
                return 'Editor / Pós-Produção';
              }
              const explicitRoles = m.memberRoles?.[member.id] || m.memberRoles?.[String(member.id)];
              if (Array.isArray(explicitRoles) && explicitRoles.length > 0) {
                return explicitRoles.join(' • ');
              }
              if (typeof explicitRoles === 'string' && explicitRoles.trim()) {
                return explicitRoles;
              }
              return isDriver ? 'Motorista / Condutor' : (inEditorIds || inEditorDisplay) ? 'Editor / Pós-Produção' : 'Equipe de Campo';
            })(),
          });
        }
      });

      // Fechamento salvo no backend (se houver)
      const closure = closures[member.id] || null;
      const status = closure?.status || 'Pendente';
      const paidAt = closure?.paidAt || null;
      const hoursCleared = closure?.hoursCleared ?? (status === 'Pago' ? Number(totalHours.toFixed(1)) : 0);
      const clearedAt = closure?.clearedAt || (status === 'Pago' ? paidAt : null);

      // Vales e Adiantamentos Salariais (FIN-05)
      const memberAdvances = advancesMap[memIdStr] || advancesMap[member.id] || [];
      const totalAdvancesAmount = Number(
        memberAdvances.reduce((acc, a) => acc + (Number(a.amount) || 0), 0).toFixed(2)
      );
      const advancesCount = memberAdvances.length;
      // Saldo líquido = Bruto homologado - Vales concedidos
      const netAmount = Number(Math.max(0, totalAmount - totalAdvancesAmount).toFixed(2));
      const plannedNetAmount = Number(Math.max(0, (totalAmount + plannedTotalAmount) - totalAdvancesAmount).toFixed(2));

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
        totalCustomCount,
        totalCustomAmount: Number(totalCustomAmount.toFixed(2)),
        missionCount: completedMissionCount,
        totalAmount: Number(totalAmount.toFixed(2)),
        // Vales e Adiantamentos
        advances: memberAdvances,
        advancesCount,
        totalAdvancesAmount,
        netAmount,
        plannedNetAmount,
        // A cumprir (previsto / não homologado)
        plannedHours: Number(plannedHours.toFixed(1)),
        plannedOffHoursAmount: Number(plannedOffHoursAmount.toFixed(2)),
        plannedTravelDays,
        plannedDailyAmount: Number(plannedDailyAmount.toFixed(2)),
        plannedCustomCount,
        plannedCustomAmount: Number(plannedCustomAmount.toFixed(2)),
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
  }, [members, missions, selectedMonth, closures, advancesMap]);

  // --------------------------------------------------------------------------
  // FILTRAGEM, BUSCA E ORDENAÇÃO NA LISTA
  // --------------------------------------------------------------------------
  const filteredPayouts = useMemo(() => {
    const list = memberPayouts.filter((m) => {
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

    // Ordenação com regra padrão: colaboradores com saldo a receber pendente no topo absoluto
    return list.sort((a, b) => {
      if (sortBy === 'balance_desc') {
        const aHasBalance = a.status !== 'Pago' && (a.totalAmount || 0) > 0;
        const bHasBalance = b.status !== 'Pago' && (b.totalAmount || 0) > 0;
        // Quem tem saldo a receber pendente fica no topo absoluto
        if (aHasBalance && !bHasBalance) return -1;
        if (!aHasBalance && bHasBalance) return 1;
        // Entre os que têm saldo a receber, maior saldo primeiro
        if (b.totalAmount !== a.totalAmount) {
          return (b.totalAmount || 0) - (a.totalAmount || 0);
        }
        // Desempate por mais horas extras
        if (b.totalHours !== a.totalHours) {
          return (b.totalHours || 0) - (a.totalHours || 0);
        }
        return a.name.localeCompare(b.name, 'pt-BR');
      }

      if (sortBy === 'name_asc') {
        return a.name.localeCompare(b.name, 'pt-BR');
      }

      if (sortBy === 'name_desc') {
        return b.name.localeCompare(a.name, 'pt-BR');
      }

      if (sortBy === 'hours_desc') {
        const diff = (b.totalHours || 0) - (a.totalHours || 0);
        if (diff !== 0) return diff;
        return (b.totalAmount || 0) - (a.totalAmount || 0);
      }

      if (sortBy === 'daily_desc') {
        const diff = (b.totalTravelDays || 0) - (a.totalTravelDays || 0);
        if (diff !== 0) return diff;
        return (b.totalAmount || 0) - (a.totalAmount || 0);
      }

      if (sortBy === 'missions_desc') {
        const diff = (b.missionCount || 0) - (a.missionCount || 0);
        if (diff !== 0) return diff;
        return a.name.localeCompare(b.name, 'pt-BR');
      }

      if (sortBy === 'planned_desc') {
        const diff = (b.plannedHours || 0) - (a.plannedHours || 0);
        if (diff !== 0) return diff;
        return (b.totalAmount || 0) - (a.totalAmount || 0);
      }

      return 0;
    });
  }, [memberPayouts, companyFilter, statusFilter, searchTerm, sortBy]);

  // Totais Executivos da Folha
  const summaryTotals = useMemo(() => {
    const totalFolha = memberPayouts.reduce((acc, m) => acc + m.totalAmount, 0);
    const totalVales = memberPayouts.reduce((acc, m) => acc + (m.totalAdvancesAmount || 0), 0);
    const totalFolhaLiquida = memberPayouts.reduce((acc, m) => acc + (m.netAmount !== undefined ? m.netAmount : m.totalAmount), 0);
    const totalHoras = memberPayouts.reduce((acc, m) => acc + m.totalHours, 0);
    const totalHorasValor = memberPayouts.reduce((acc, m) => acc + (m.totalOffHoursAmount || 0), 0);
    const totalViagens = memberPayouts.reduce((acc, m) => acc + m.totalTravelDays, 0);
    const totalDiariasValor = memberPayouts.reduce((acc, m) => acc + (m.totalDailyAmount || 0), 0);
    const totalCustoms = memberPayouts.reduce((acc, m) => acc + (m.totalCustomCount || 0), 0);
    const totalCustomsValor = memberPayouts.reduce((acc, m) => acc + (m.totalCustomAmount || 0), 0);
    const totalPagos = memberPayouts.filter((m) => m.status === 'Pago').length;
    const totalPendentes = memberPayouts.filter((m) => m.status !== 'Pago' && (m.netAmount > 0 || m.totalAmount > 0)).length;

    return {
      totalFolha,
      totalVales: Number(totalVales.toFixed(2)),
      totalFolhaLiquida: Number(totalFolhaLiquida.toFixed(2)),
      totalHoras: Number(totalHoras.toFixed(1)),
      totalHorasValor,
      totalViagens,
      totalDiariasValor,
      totalCustoms,
      totalCustomsValor,
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

    const hasAdvances = (member.totalAdvancesAmount || 0) > 0;
    const confirmClear = await confirmDialog({
      title: 'Zerar Horas & Confirmar Pagamento',
      message: `Confirmar quitação e zerar saldo de horas de ${member.name}?`,
      description: hasAdvances
        ? `Total Bruto Apurado: ${formatBRL(member.totalAmount)} (${member.totalHours}h extras + ${member.totalTravelDays} diárias)\n(-) Vales/Adiantamentos: -${formatBRL(member.totalAdvancesAmount)} (${member.advancesCount} vale(s))\n(=) Total Líquido Quitado: ${formatBRL(member.netAmount)}\n\nAo confirmar, o saldo deste mês será marcado como Pago e quitado.`
        : `Valor apurado: ${formatBRL(member.totalAmount)} referente a ${member.totalHours}h no banco de horas (fora do expediente) e ${member.totalTravelDays} diárias de viagem. Ao confirmar, o saldo deste mês será marcado como Pago e zerado.`,
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
        paidAmount: member.netAmount !== undefined ? member.netAmount : member.totalAmount,
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
    const hasAdvances = (member.totalAdvancesAmount || 0) > 0;
    const lines = [
      `📋 *MegaGestão - Extrato de Diárias & Horas*`,
      `👤 *Colaborador:* ${member.name}`,
      `📅 *Mês de Referência:* ${monthLabel}`,
      `---------------------------------------`,
      `🎯 *Missões Concluídas:* ${member.missionCount}${member.scheduledMissionCount > 0 ? ` (+${member.scheduledMissionCount} agendadas)` : ''}`,
      `⏱️ *Horas Extras Homologadas:* ${member.totalHours}h (${formatBRL(member.totalOffHoursAmount)})`,
      `📅 *Diárias Homologadas:* ${member.totalTravelDays} diárias (${formatBRL(member.totalDailyAmount)})`,
      member.totalCustomCount > 0 ? `🎯 *Remunerações Personalizadas / Cachês:* ${member.totalCustomCount} missões (${formatBRL(member.totalCustomAmount)})` : null,
      member.plannedHours > 0 ? `⏳ *Previsão em Pautas Agendadas (A Cumprir):* ${member.plannedHours}h (${formatBRL(member.plannedOffHoursAmount)}) - Não Homologadas` : null,
      `💼 *Total Bruto de Créditos:* ${formatBRL(member.totalAmount)}`,
      hasAdvances ? `🎟️ *(-) Vales / Adiantamentos:* -${formatBRL(member.totalAdvancesAmount)} (${member.advancesCount} vale${member.advancesCount === 1 ? '' : 's'})` : null,
      `💰 *Total Líquido a Pagar:* ${formatBRL(member.netAmount !== undefined ? member.netAmount : member.totalAmount)}`,
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

  // Imprimir relatório geral da folha
  const handlePrintReport = () => {
    window.print();
  };

  // Imprimir Raio-X / Extrato Individual de Fechamento do Colaborador (A4 / PDF)
  const handlePrintStatement = () => {
    document.body.classList.add('printing-statement-xray');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('printing-statement-xray');
    }, 1500);
  };

  // Dados estruturados para o Documento Timbrado Oficial (A4 / PDF / WhatsApp)
  const officialStatementData = useMemo(() => {
    if (!officialStatementMember) return null;
    const m = officialStatementMember;
    const allMissions = m.statementMissions || [];
    const entries = [];

    allMissions.forEach((mis) => {
      if (mis.remunerationType === 'custom') {
        entries.push({
          id: `mis-${mis.id}`,
          date: mis.date,
          type: 'credit',
          category: 'custom',
          categoryLabel: 'Cachê / Fixo',
          missionCode: mis.code || mis.id,
          title: mis.title || mis.description || 'Missão com Remuneração Fixa',
          detail: 'Cachê acordado individualmente para esta missão',
          amount: Number(mis.subtotal || 0),
        });
      } else if (mis.remunerationType === 'daily') {
        entries.push({
          id: `mis-${mis.id}`,
          date: mis.date,
          type: 'credit',
          category: 'daily',
          categoryLabel: 'Diária de Campo',
          missionCode: mis.code || mis.id,
          title: mis.title || mis.description || 'Missão em Campo / Viagem',
          detail: `${mis.daysCount || 1} diária(s) @ R$ ${mis.dailyRate || 200}/dia`,
          amount: Number(mis.subtotal || 0),
        });
      } else if (mis.remunerationType === 'off_hours' && (mis.offHoursWorked > 0 || (mis.extraHoursApproved || 0) > 0)) {
        const totalH = (mis.offHoursWorked || 0) + (mis.extraHoursApproved || 0);
        entries.push({
          id: `mis-${mis.id}`,
          date: mis.date,
          type: 'credit',
          category: 'hours',
          categoryLabel: 'Horas Extras',
          missionCode: mis.code || mis.id,
          title: mis.title || mis.description || 'Atuação Fora do Expediente',
          detail: `${totalH.toFixed(1)}h extras @ R$ ${mis.hourlyRate || 50}/hora`,
          amount: Number(mis.subtotal || 0),
        });
      }
    });

    const advList = advancesMap[String(m.id)] || advancesMap[m.id] || m.advances || [];
    advList.forEach((adv) => {
      entries.push({
        id: `adv-${adv.id}`,
        date: adv.date,
        type: 'debit',
        category: 'advance',
        categoryLabel: 'Vale / Adiantamento',
        missionCode: `VALE #${String(adv.id).slice(-4)}`,
        title: adv.reason || adv.description || 'Adiantamento salarial concedido',
        detail: `Forma: ${adv.paymentMethod || adv.payment_method || 'PIX'} • Concedido pela Diretoria`,
        amount: Number(adv.amount || 0),
        receiptUrl: adv.receiptUrl || adv.receipt_url || null,
      });
    });

    entries.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    const grossTotal = Number(m.totalAmount || 0);
    const totalAdvancesVal = Number(m.advancesTotal || 0);
    const netTotal = Number(m.finalPayout !== undefined ? m.finalPayout : Math.max(0, grossTotal - totalAdvancesVal));

    return {
      collaborator: m,
      monthKey: selectedMonth,
      monthLabel,
      financialSummary: {
        grossTotal,
        totalHours: m.extraHoursCount || 0,
        totalHoursVal: m.extraHoursTotal || 0,
        totalDays: m.diariasCount || 0,
        totalDaysVal: m.diariasTotal || 0,
        totalCustomCount: m.cachesCount || 0,
        totalCustomVal: m.cachesTotal || 0,
        totalAdvancesVal,
        advancesCount: advList.length,
        netTotal,
        isPaid: m.status === 'Pago',
      },
      financialEntries: entries,
    };
  }, [officialStatementMember, selectedMonth, monthLabel, advancesMap]);

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
            className="btn-payout-add-advance"
            onClick={() => {
              setAdvancesModalMember(null);
              setAdvancesModalOpen(true);
            }}
            title="Lançar um novo vale ou adiantamento salarial para qualquer colaborador"
          >
            <Receipt size={15} />
            <span>+ Lançar Vale</span>
          </button>

          <button
            type="button"
            className="btn-payout-print"
            onClick={() => setIsPayrollOfficialModalOpen(true)}
            title="Abrir folha de pagamento consolidada timbrada com download em PDF e WhatsApp"
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
            <span className="psc-label">Líquido a Pagar (Folha do Mês)</span>
            <strong className="psc-value">{formatBRL(summaryTotals.totalFolhaLiquida)}</strong>
            <span className="psc-sub">
              {summaryTotals.totalVales > 0
                ? `Bruto: ${formatBRL(summaryTotals.totalFolha)} • Vales: -${formatBRL(summaryTotals.totalVales)}`
                : 'Soma de todas as diárias e horas'}
            </span>
          </div>
        </div>

        <div
          className="payout-summary-card card-advances is-clickable"
          onClick={() => {
            setAdvancesModalMember(null);
            setAdvancesModalOpen(true);
          }}
          title="Clique para lançar ou auditar vales e adiantamentos salariais"
          style={{ cursor: 'pointer' }}
        >
          <div className="psc-icon-wrap" style={{ background: 'rgba(244, 63, 94, 0.15)', color: '#fb7185' }}>
            <Receipt size={24} />
          </div>
          <div className="psc-info">
            <span className="psc-label">Vales / Adiantamentos</span>
            <strong className="psc-value text-rose">{formatBRL(summaryTotals.totalVales)}</strong>
            <span className="psc-sub">Adiantamentos deduzidos da folha</span>
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
          <div className="psc-info psc-info-status">
            <span className="psc-label">Status de Pagamento</span>
            <div className="psc-status-stacked">
              <div className="psc-status-row is-paid">
                <span className="psc-status-dot is-paid" />
                <span className="psc-status-num">{summaryTotals.totalPagos}</span>
                <span className="psc-status-text">Pagos</span>
              </div>
              <div className="psc-status-row is-pending">
                <span className="psc-status-dot is-pending" />
                <span className="psc-status-num">{summaryTotals.totalPendentes}</span>
                <span className="psc-status-text">Pendentes</span>
              </div>
            </div>
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

          <div className="pf-select-wrap pf-sort-wrap" title="Ordenar lista de colaboradores">
            <ArrowUpDown size={14} className="text-amber" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="pf-select pf-select-sort"
            >
              <option value="balance_desc">💰 Saldo a Receber (Padrão)</option>
              <option value="name_asc">🔤 Ordem Alfabética (A → Z)</option>
              <option value="name_desc">🔤 Ordem Alfabética (Z → A)</option>
              <option value="hours_desc">⚡ Mais Horas Extras</option>
              <option value="daily_desc">📅 Mais Diárias de Campo</option>
              <option value="missions_desc">🎯 Mais Missões Concluídas</option>
              <option value="planned_desc">⏳ Mais Horas a Cumprir</option>
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
                    <div className="pmc-rate-box" title="Regra de remuneração cadastrada para este colaborador">
                      <span className="pmc-rate-lbl">Taxa Individual:</span>
                      <strong className="pmc-rate-val">
                        {formatBRL(member.hourlyRate || 50)} / hora
                      </strong>
                      <small className="pmc-rate-sub" title="Valor padrão da diária de campo">
                        Diária: {formatBRL(member.dailyRate || 200)} / dia
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

                  {/* Produção Detalhada no Mês (Missões, Horas Extras e Diárias Homologadas com Acesso ao Raio-X) */}
                  <div className="pmc-col-production">
                    <div
                      className="pmc-prod-metric pmc-prod-interactive"
                      onClick={() => handleOpenStatement(member, 'all')}
                      title="Ver todas as missões deste colaborador no mês"
                    >
                      <span className="pmc-prod-val">{member.missionCount}</span>
                      <span className="pmc-prod-lbl">
                        Concluídas {member.scheduledMissionCount > 0 && <span className="pmc-scheduled-count">({member.scheduledMissionCount}&nbsp;agend.)</span>}
                      </span>
                    </div>

                    <div
                      className={`pmc-prod-metric pmc-prod-interactive ${member.totalHours > 0 ? 'has-extras-highlight' : ''}`}
                      onClick={() => handleOpenStatement(member, 'extra_hours')}
                      title="⚡ Raio-X: Clique para ver todas as missões que geraram hora extra para este colaborador"
                    >
                      <span className="pmc-prod-val text-amber">{member.totalHours}h</span>
                      <span className="pmc-prod-lbl">Extras&nbsp;({formatBRL(member.totalOffHoursAmount)})</span>
                      <span className="pmc-xray-chip" title="Abrir Raio-X de Horas Extras">
                        <Zap size={10} />&nbsp;Raio-X
                      </span>
                    </div>

                    <div
                      className={`pmc-prod-metric pmc-prod-interactive ${member.totalTravelDays > 0 ? 'has-daily-highlight' : ''}`}
                      onClick={() => handleOpenStatement(member, 'daily')}
                      title="📅 Raio-X: Clique para ver todas as viagens e missões com diária deste colaborador"
                    >
                      <span className="pmc-prod-val text-cyan">{member.totalTravelDays}d</span>
                      <span className="pmc-prod-lbl">Diárias&nbsp;({formatBRL(member.totalDailyAmount)})</span>
                      <span className="pmc-xray-chip chip-cyan" title="Abrir Raio-X de Diárias">
                        <Calendar size={10} />&nbsp;Raio-X
                      </span>
                    </div>

                    {member.totalCustomCount > 0 && (
                      <div
                        className="pmc-prod-metric pmc-prod-interactive has-custom-highlight"
                        onClick={() => handleOpenStatement(member, 'custom')}
                        title="🎯 Raio-X: Clique para ver todas as missões com remuneração personalizada/cachê deste colaborador"
                      >
                        <span className="pmc-prod-val text-purple">{member.totalCustomCount}</span>
                        <span className="pmc-prod-lbl">Cachês&nbsp;({formatBRL(member.totalCustomAmount)})</span>
                        <span className="pmc-xray-chip chip-purple" title="Abrir Raio-X de Personalizadas">
                          <Sparkles size={10} />&nbsp;Raio-X
                        </span>
                      </div>
                    )}

                    {member.totalAdvancesAmount > 0 && (
                      <div
                        className="pmc-prod-metric pmc-prod-interactive has-advances-highlight"
                        onClick={() => setAdvancesModalMember(member)}
                        title={`🎟️ Vales/Adiantamentos: ${member.advancesCount} vale(s) totalizando ${formatBRL(member.totalAdvancesAmount)}. Clique para gerenciar.`}
                      >
                        <span className="pmc-prod-val text-rose">-{formatBRL(member.totalAdvancesAmount)}</span>
                        <span className="pmc-prod-lbl">Vales ({member.advancesCount})</span>
                        <span className="pmc-xray-chip chip-rose" title="Gerenciar Vales do Colaborador">
                          <Receipt size={10} />&nbsp;Vales
                        </span>
                      </div>
                    )}

                    {member.plannedHours > 0 && (
                      <div
                        className="pmc-planned-strip pmc-prod-interactive"
                        onClick={() => handleOpenStatement(member, 'scheduled')}
                        title="Horas extras previstas em missões agendadas que ainda não aconteceram. Clique para ver."
                      >
                        <span>⏳&nbsp;{member.plannedHours}h a cumprir</span>
                        <small>(Não&nbsp;homologadas)</small>
                      </div>
                    )}
                  </div>

                  {/* Chave PIX Evidenciada com Botão de Cópia Embaixo */}
                  <div className="pmc-col-pix">
                    <span className="pmc-pix-header">
                      <CreditCard size={12} className="text-cyan" />
                      <span>CHAVE PIX</span>
                    </span>
                    {member.pixKey ? (
                      <div className="pmc-pix-card-vertical" title={`Chave PIX: ${member.pixKey}`}>
                        <div className="pmc-pix-key-val">
                          {member.pixKey}
                        </div>
                        <button
                          type="button"
                          className={`btn-copy-pix-full ${copiedPixMemberId === member.id ? 'is-copied' : ''}`}
                          onClick={() => handleCopyPix(member.pixKey, member.id)}
                          title="Copiar Chave PIX para a área de transferência"
                        >
                          {copiedPixMemberId === member.id ? (
                            <>
                              <Check size={12} />
                              <span>Chave Copiada!</span>
                            </>
                          ) : (
                            <>
                              <Copy size={12} />
                              <span>Copiar Chave PIX</span>
                            </>
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="pmc-pix-empty-vertical">
                        <span className="pmc-pix-empty-text">Sem chave cadastrada</span>
                        <button
                          type="button"
                          className="btn-add-pix-full"
                          onClick={() => handleOpenEditRates(member)}
                          title="Cadastrar chave PIX deste colaborador"
                        >
                          <Plus size={12} /> Cadastrar Chave
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Valor Total a Pagar / Quitado (com abatimento de Vales em tempo real) */}
                  <div className="pmc-col-total">
                    <span className="pmc-total-lbl">{isPaid ? 'Total Quitado:' : (member.totalAdvancesAmount > 0 ? 'Saldo Líquido a Pagar:' : 'Total a Pagar:')}</span>
                    <strong className={`pmc-total-val ${isPaid ? 'text-green' : 'text-gold'}`}>
                      {formatBRL(member.netAmount !== undefined ? member.netAmount : member.totalAmount)}
                    </strong>
                    {member.totalAdvancesAmount > 0 && (
                      <div
                        className="pmc-advances-breakdown is-clickable"
                        onClick={() => {
                          setAdvancesModalMember(member);
                          setAdvancesModalOpen(true);
                        }}
                        title={`Bruto: ${formatBRL(member.totalAmount)} - Vales: ${formatBRL(member.totalAdvancesAmount)}. Clique para gerenciar.`}
                        style={{ cursor: 'pointer' }}
                      >
                        <span className="pmc-gross-hint">Bruto: {formatBRL(member.totalAmount)}</span>
                        <span className="pmc-adv-hint text-rose">🎟️ Vales: -{formatBRL(member.totalAdvancesAmount)} ({member.advancesCount})</span>
                      </div>
                    )}
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
                        className="pmc-action-btn btn-advances"
                        onClick={() => {
                          setAdvancesModalMember(member);
                          setAdvancesModalOpen(true);
                        }}
                        title={`Lançar novo vale ou gerenciar adiantamentos de ${member.name} (${member.advancesCount || 0} cadastrado(s))` }
                      >
                        <Plus size={12} className="text-rose" />
                        <span>Vale{member.advancesCount > 0 ? ` (${member.advancesCount})` : ''}</span>
                      </button>

                      <button
                        type="button"
                        className="pmc-action-btn btn-xray"
                        onClick={() => handleOpenStatement(member, 'all')}
                        title="Ver Raio-X e Espelho detalhado de todas as missões do mês"
                      >
                        <Zap size={13} className="text-amber" /> <span>Raio-X</span>
                      </button>

                      <button
                        type="button"
                        className="pmc-action-btn btn-wa-share"
                        onClick={() => handleShareWhatsApp(member)}
                        title="Enviar demonstrativo no WhatsApp do colaborador"
                      >
                        <MessageCircle size={14} /> <span>WhatsApp</span>
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
              <div className="xray-banner-context extras" style={{ marginBottom: 16 }}>
                <Zap size={18} className="text-amber" />
                <div style={{ fontSize: '0.82rem' }}>
                  <strong>Regra MegaFilmes:</strong> Remuneração organizada estritamente em 3 modalidades: <strong>Hora Extra</strong> (multiplicada proporcionalmente pelas horas trabalhadas), <strong>Diária</strong> (valor integral da diária) ou <strong>Personalizada</strong> (definida diretamente na missão).
                </div>
              </div>

              {/* Valor por Hora Extra */}
              <div className="form-group">
                <label>Valor da Hora Extra (R$/h)</label>
                <input
                  type="number"
                  step="5"
                  min="0"
                  value={ratesForm.hourlyRate}
                  onChange={(e) => setRatesForm({ ...ratesForm, hourlyRate: e.target.value })}
                  placeholder="Ex: 50.00"
                />
                <small className="field-hint-sub">
                  Valor pago por cada hora extra trabalhada (fora do expediente comercial ou adicional aprovado). Padrão: R$ 50,00/h.
                </small>
              </div>

              {/* Valor da Diária de Campo */}
              <div className="form-group">
                <label>Valor da Diária de Campo (R$/dia)</label>
                <input
                  type="number"
                  step="10"
                  min="0"
                  value={ratesForm.dailyRate}
                  onChange={(e) => setRatesForm({ ...ratesForm, dailyRate: e.target.value })}
                  placeholder="Ex: 200.00"
                />
                <small className="field-hint-sub">
                  Remuneração de 24h para o dia todo em operações na modalidade diária ou viagens de campo (Padrão: R$ 200,00/dia).
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
      {/* ============================================================== */}
      {/* 6. MODAL: RAIO-X & ESPELHO DE MISSÕES, HORAS EXTRAS & DIÁRIAS   */}
      {/* ============================================================== */}
      {viewingStatementMember && (() => {
        const allMissions = viewingStatementMember.statementMissions || [];
        const missionsWithExtras = allMissions.filter(
          (m) => m.remunerationType === 'off_hours' && (m.offHoursWorked > 0 || (m.extraHoursApproved || 0) > 0)
        );
        const missionsWithDaily = allMissions.filter(
          (m) => m.remunerationType === 'daily'
        );
        const missionsWithCustom = allMissions.filter(
          (m) => m.remunerationType === 'custom'
        );
        const missionsCommercial = allMissions.filter(
          (m) => m.remunerationType === 'off_hours' && m.offHoursWorked === 0 && (m.extraHoursApproved || 0) === 0
        );
        const missionsScheduled = allMissions.filter(
          (m) => !m.isCompleted
        );

        const displayedMissions = allMissions.filter((item) => {
          if (statementFilter === 'extra_hours') {
            return item.remunerationType === 'off_hours' && (item.offHoursWorked > 0 || (item.extraHoursApproved || 0) > 0);
          }
          if (statementFilter === 'daily') {
            return item.remunerationType === 'daily';
          }
          if (statementFilter === 'custom') {
            return item.remunerationType === 'custom';
          }
          if (statementFilter === 'commercial') {
            return item.remunerationType === 'off_hours' && item.offHoursWorked === 0 && (item.extraHoursApproved || 0) === 0;
          }
          if (statementFilter === 'scheduled') {
            return !item.isCompleted;
          }
          return true;
        });

        return (
          <div className="modal-overlay statement-modal-overlay" onClick={() => setViewingStatementMember(null)}>
            <div
              className="modal-box modal-statement modal-xray-box printable-statement-sheet"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: '840px' }}
            >
              <div className="modal-header">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Zap size={22} className="text-amber" />
                    <h2>Raio-X de Horas Extras &amp; Diárias</h2>
                  </div>
                  <span className="statement-sub-header">
                    {viewingStatementMember.name} • {viewingStatementMember.role || 'Colaborador'} • {monthLabel}
                  </span>
                </div>
                <div className="statement-header-actions no-print" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn-statement-print-top"
                    onClick={handlePrintStatement}
                    title="Imprimir Raio-X / Extrato do Colaborador (A4 / PDF)"
                  >
                    <Printer size={15} />
                    <span>Imprimir</span>
                  </button>
                  <button className="modal-close" onClick={() => setViewingStatementMember(null)} title="Fechar Janela">✕</button>
                </div>
              </div>

              <div className="modal-form statement-body">
                {/* Cabeçalho Corporativo Oficial para Impressão Timbrada (visível somente na impressão A4) */}
                <div className="statement-print-header">
                  <div className="sph-brand">
                    <img
                      src="/logo.png"
                      alt="Mega Filmes"
                      className="sph-logo"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                    <div>
                      <h1 className="sph-company-name">MEGA FILMES &amp; PRODUÇÕES</h1>
                      <div className="sph-doc-title">Extrato Operacional Oficial • Raio-X de Horas Extras &amp; Diárias</div>
                    </div>
                  </div>
                  <div className="sph-meta-box">
                    <div><strong>Competência:</strong> {monthLabel}</div>
                    <div><strong>Colaborador:</strong> {viewingStatementMember.name} ({viewingStatementMember.role || 'Produção'})</div>
                    {viewingStatementMember.pixKey && <div><strong>Chave PIX:</strong> {viewingStatementMember.pixKey}</div>}
                    <div><strong>Emissão:</strong> {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                    <div><strong>Situação:</strong> {viewingStatementMember.status === 'Pago' ? 'QUITADO / PAGO' : 'PENDENTE DE QUITAÇÃO'}</div>
                  </div>
                </div>

                {/* Resumo do Colaborador com cliques interativos */}
                <div className="statement-summary-banner">
                  <div
                    className={`ssb-item ssb-clickable ${statementFilter === 'all' ? 'is-selected' : ''}`}
                    onClick={() => setStatementFilter('all')}
                    title="Ver todas as missões"
                  >
                    <span className="ssb-lbl">Total Missões</span>
                    <strong className="ssb-val">{viewingStatementMember.missionCount}</strong>
                    <small style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Ver todas</small>
                  </div>
                  <div
                    className={`ssb-item ssb-clickable ${statementFilter === 'extra_hours' ? 'is-selected' : ''}`}
                    onClick={() => setStatementFilter('extra_hours')}
                    title="Filtrar apenas missões que geraram horas extras"
                  >
                    <span className="ssb-lbl">⚡ Horas Extras</span>
                    <strong className="ssb-val text-amber">{viewingStatementMember.totalHours} h</strong>
                    <small style={{ fontSize: '0.75rem', color: '#fbbf24', opacity: 0.9 }}>{formatBRL(viewingStatementMember.totalOffHoursAmount)}</small>
                  </div>
                  <div
                    className={`ssb-item ssb-clickable ${statementFilter === 'daily' ? 'is-selected' : ''}`}
                    onClick={() => setStatementFilter('daily')}
                    title="Filtrar apenas missões com diárias"
                  >
                    <span className="ssb-lbl">📅 Diárias</span>
                    <strong className="ssb-val text-cyan">{viewingStatementMember.totalTravelDays} d</strong>
                    <small style={{ fontSize: '0.75rem', color: '#38bdf8', opacity: 0.9 }}>{formatBRL(viewingStatementMember.totalDailyAmount)}</small>
                  </div>
                  {viewingStatementMember.totalCustomCount > 0 && (
                    <div
                      className={`ssb-item ssb-clickable ${statementFilter === 'custom' ? 'is-selected' : ''}`}
                      onClick={() => setStatementFilter('custom')}
                      title="Filtrar apenas missões com remuneração personalizada/cachê"
                    >
                      <span className="ssb-lbl">🎯 Personalizada</span>
                      <strong className="ssb-val text-purple">{viewingStatementMember.totalCustomCount}</strong>
                      <small style={{ fontSize: '0.75rem', color: '#c084fc', opacity: 0.9 }}>{formatBRL(viewingStatementMember.totalCustomAmount)}</small>
                    </div>
                  )}
                  {viewingStatementMember.totalAdvancesAmount > 0 && (
                    <div
                      className="ssb-item ssb-clickable"
                      onClick={() => setAdvancesModalMember(viewingStatementMember)}
                      title="Clique para gerenciar ou auditar os vales deste colaborador"
                    >
                      <span className="ssb-lbl">🎟️ Vales Concedidos</span>
                      <strong className="ssb-val text-rose">-{formatBRL(viewingStatementMember.totalAdvancesAmount)}</strong>
                      <small style={{ fontSize: '0.75rem', color: '#fb7185' }}>{viewingStatementMember.advancesCount} vale(s) deduzido(s)</small>
                    </div>
                  )}
                  <div className="ssb-item ssb-total">
                    <span className="ssb-lbl">{viewingStatementMember.status === 'Pago' ? 'Total Quitado' : (viewingStatementMember.totalAdvancesAmount > 0 ? 'Saldo Líquido a Pagar' : 'Total Líquido')}</span>
                    <strong className={`ssb-val ${viewingStatementMember.status === 'Pago' ? 'text-green' : 'text-gold'}`}>
                      {formatBRL(viewingStatementMember.netAmount !== undefined ? viewingStatementMember.netAmount : viewingStatementMember.totalAmount)}
                    </strong>
                    <small style={{ fontSize: '0.72rem', color: '#a7f3d0' }}>
                      {viewingStatementMember.totalAdvancesAmount > 0 ? `Bruto: ${formatBRL(viewingStatementMember.totalAmount)}` : 'Folha do Mês'}
                    </small>
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

                {/* BARRA DE NAVEGAÇÃO / FILTROS DO RAIO-X */}
                <div className="statement-xray-filter-bar">
                  <button
                    type="button"
                    className={`xray-filter-tab ${statementFilter === 'all' ? 'is-active' : ''}`}
                    onClick={() => setStatementFilter('all')}
                  >
                    <FileText size={13} />
                    <span>Todas as Missões ({allMissions.length})</span>
                  </button>
                  <button
                    type="button"
                    className={`xray-filter-tab tab-extras ${statementFilter === 'extra_hours' ? 'is-active' : ''}`}
                    onClick={() => setStatementFilter('extra_hours')}
                  >
                    <Zap size={13} className="text-amber" />
                    <span>🔥 Geraram Horas Extras ({missionsWithExtras.length})</span>
                  </button>
                  <button
                    type="button"
                    className={`xray-filter-tab tab-daily ${statementFilter === 'daily' ? 'is-active' : ''}`}
                    onClick={() => setStatementFilter('daily')}
                  >
                    <Calendar size={13} className="text-cyan" />
                    <span>📅 Geraram Diárias ({missionsWithDaily.length})</span>
                  </button>
                  <button
                    type="button"
                    className={`xray-filter-tab tab-custom ${statementFilter === 'custom' ? 'is-active' : ''}`}
                    onClick={() => setStatementFilter('custom')}
                  >
                    <Sparkles size={13} className="text-purple" />
                    <span>🎯 Personalizadas ({missionsWithCustom.length})</span>
                  </button>
                  <button
                    type="button"
                    className={`xray-filter-tab tab-commercial ${statementFilter === 'commercial' ? 'is-active' : ''}`}
                    onClick={() => setStatementFilter('commercial')}
                  >
                    <CheckCircle2 size={13} className="text-green" />
                    <span>🟢 Expediente Normal (0h) ({missionsCommercial.length})</span>
                  </button>
                  {missionsScheduled.length > 0 && (
                    <button
                      type="button"
                      className={`xray-filter-tab tab-scheduled ${statementFilter === 'scheduled' ? 'is-active' : ''}`}
                      onClick={() => setStatementFilter('scheduled')}
                    >
                      <Clock size={13} />
                      <span>⏳ Agendadas ({missionsScheduled.length})</span>
                    </button>
                  )}
                </div>

                {/* Banner de Contexto do Filtro de Raio-X */}
                {statementFilter === 'extra_hours' && (
                  <div className="xray-banner-context extras">
                    <Zap size={16} className="text-amber" />
                    <div>
                      <strong>Raio-X de Missões com Hora Extra ({missionsWithExtras.length} missão{missionsWithExtras.length === 1 ? '' : 'ões'}):</strong>
                      <span> Exibindo detalhadamente todas as missões que geraram horas extras (saída antes das 08h, retorno após as 18h, trabalho aos fins de semana ou adicionais de pauta autorizados pela gestão).</span>
                    </div>
                  </div>
                )}

                {statementFilter === 'daily' && (
                  <div className="xray-banner-context daily">
                    <Calendar size={16} className="text-cyan" />
                    <div>
                      <strong>Raio-X de Missões com Diária ({missionsWithDaily.length} missão{missionsWithDaily.length === 1 ? '' : 'ões'}):</strong>
                      <span> Exibindo viagens e pautas de campo remuneradas pela modalidade diária integral.</span>
                    </div>
                  </div>
                )}

                {statementFilter === 'custom' && (
                  <div className="xray-banner-context custom" style={{ borderLeft: '3px solid #a855f7', background: 'rgba(168, 85, 247, 0.1)', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '8px' }}>
                    <Sparkles size={16} className="text-purple" />
                    <div>
                      <strong>Raio-X de Remunerações Personalizadas ({missionsWithCustom.length} missão{missionsWithCustom.length === 1 ? '' : 'ões'}):</strong>
                      <span> Exibindo missões com cachê fixo ou remuneração acordada especificamente para este colaborador.</span>
                    </div>
                  </div>
                )}

                {statementFilter === 'scheduled' && (
                  <div className="xray-banner-context scheduled" style={{ borderLeft: '3px solid #38bdf8', background: 'rgba(56, 189, 248, 0.1)', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '8px' }}>
                    <Clock size={16} className="text-cyan" />
                    <div>
                      <strong>Raio-X de Missões Agendadas / Não Homologadas ({missionsScheduled.length} missão{missionsScheduled.length === 1 ? '' : 'ões'}):</strong>
                      <span> Exibindo pautas agendadas que ainda não foram finalizadas. As horas extras destas missões são estimativas e só serão homologadas para pagamento após a conclusão do serviço em campo.</span>
                    </div>
                  </div>
                )}

                {/* Lista Detalhada de Missões com Raio-X */}
                <div className="statement-missions-list">
                  {displayedMissions.length === 0 ? (
                    <div className="statement-empty-xray">
                      <Zap size={32} className="empty-xray-icon text-amber" />
                      <strong>Nenhuma missão encontrada para este filtro.</strong>
                      <p>
                        {statementFilter === 'extra_hours'
                          ? 'Este colaborador não possui missões que geraram horas extras neste mês. Todas as missões registradas ocorreram dentro do expediente comercial normal (08h às 18h).'
                          : statementFilter === 'daily'
                            ? 'Nenhuma missão de viagem ou na modalidade diária registrada para este colaborador neste mês.'
                            : statementFilter === 'commercial'
                              ? 'Todas as missões realizadas neste mês geraram horas extras ou foram por diária.'
                              : statementFilter === 'scheduled'
                                ? 'Este colaborador não possui missões agendadas pendentes de realização neste mês.'
                                : 'Nenhuma missão registrada para este colaborador neste mês.'}
                      </p>
                    </div>
                  ) : (
                    displayedMissions.map((item) => {
                      const isCustom = item.remunerationType === 'custom';
                      const isDaily = item.remunerationType === 'daily';
                      const hasExtra = item.remunerationType === 'off_hours' && (item.offHoursWorked > 0 || (item.extraHoursApproved || 0) > 0);
                      const totalExtraHours = (item.offHoursWorked || 0) + (item.extraHoursApproved || 0);

                      return (
                        <div
                          key={item.id}
                          className={`statement-item-row ${!item.isCompleted ? 'row-scheduled-pending' : ''} ${hasExtra ? 'row-has-extras' : ''} ${isDaily ? 'row-has-daily' : ''} ${isCustom ? 'row-has-custom' : ''}`}
                        >
                          <div className="sir-left">
                            <div className="sir-code-date">
                              <span
                                className="sir-code sir-clickable"
                                onClick={() => handleOpenMissionDetail(item)}
                                title="🔍 Clique para ver os detalhes completos desta missão"
                                role="button"
                                tabIndex={0}
                              >
                                {item.code}
                                <ExternalLink size={10} className="sir-link-icon" />
                              </span>
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

                              {isCustom ? (
                                <span className="sir-badge-custom" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700 }}>
                                  🎯 Personalizada (Cachê)
                                </span>
                              ) : isDaily ? (
                                <span className="sir-badge-multiday">
                                  📅 Diária {item.isMultiDay ? `Viagem (${item.daysCount}d)` : 'Campo (1d)'}
                                </span>
                              ) : item.isOnlyEditor ? (
                                <span className="sir-badge-hours" style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.35)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700 }} title="Editores na pós-produção não recebem horas extras">
                                  🎬 Pós-Produção (Sem Horas Extras)
                                </span>
                              ) : hasExtra ? (
                                <span className={`sir-badge-hours ${item.isCompleted ? 'sir-badge-offhours' : 'sir-badge-offhours-planned'}`} title={item.isCompleted ? "Horas extras homologadas no banco de horas" : "Horas extras previstas"}>
                                  ⏱️ +{totalExtraHours}h Extras {item.isCompleted ? '' : '(A Cumprir)'}
                                </span>
                              ) : (
                                <span className="sir-badge-hours sir-badge-inhours" title="Missão realizada 100% dentro do expediente comercial normal">
                                  🟢 Expediente Comercial (0h extra)
                                </span>
                              )}
                            </div>

                            <strong
                              className="sir-desc sir-clickable"
                              onClick={() => handleOpenMissionDetail(item)}
                              title="🔍 Clique para ver os detalhes completos desta missão"
                              role="button"
                              tabIndex={0}
                            >
                              {item.description}
                            </strong>
                            <span className="sir-loc">{item.locationName}</span>

                            {/* RAIO-X EXPLICATIVO DA MISSÃO */}
                            {item.isOnlyEditor && !isCustom && !isDaily ? (
                              <div className="sir-xray-box" style={{ borderLeft: '3px solid #38bdf8', background: 'rgba(56, 189, 248, 0.08)', padding: '8px 12px', borderRadius: '6px', marginTop: '6px' }}>
                                <div className="sxb-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div className="sxb-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Briefcase size={13} className="text-cyan" />
                                    <span>Raio-X de Pós-Produção:</span>
                                    <strong style={{ color: '#38bdf8' }}>Edição em Ilha / Estúdio</strong>
                                  </div>
                                  <strong className="sxb-amount" style={{ color: '#94a3b8' }}>R$ 0,00</strong>
                                </div>
                                <div className="sxb-body" style={{ marginTop: '4px', fontSize: '0.78rem', color: '#cbd5e1' }}>
                                  <div className="sxb-line">
                                    <span>Conforme as diretrizes oficiais da MegaFilmes, horas extras são destinadas estritamente à equipe que atua presencialmente em campo fora do expediente regular. Os editores que atuam na pós-produção não recebem horas extras.</span>
                                  </div>
                                </div>
                              </div>
                            ) : isCustom ? (
                              <div className="sir-xray-box xray-custom-box" style={{ borderLeft: '3px solid #a855f7', background: 'rgba(168, 85, 247, 0.08)', padding: '8px 12px', borderRadius: '6px', marginTop: '6px' }}>
                                <div className="sxb-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div className="sxb-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Sparkles size={13} style={{ color: '#c084fc' }} />
                                    <span>Raio-X de Remuneração:</span>
                                    <strong style={{ color: '#c084fc' }}>Personalizada (Cachê / Valor Acordado)</strong>
                                  </div>
                                  <strong className="sxb-amount text-gold">+{formatBRL(item.itemAmount)}</strong>
                                </div>
                                <div className="sxb-body" style={{ marginTop: '4px', fontSize: '0.78rem', color: '#cbd5e1' }}>
                                  <div className="sxb-line">
                                    <span>Remuneração direta acordada para este colaborador nesta missão.</span>
                                  </div>
                                  <div className="sxb-calc" style={{ marginTop: '2px', color: '#94a3b8' }}>
                                    {item.formulaText || `Cálculo: Valor fixo da pauta = ${formatBRL(item.itemAmount)}`}
                                  </div>
                                </div>
                              </div>
                            ) : hasExtra ? (
                              <div className="sir-xray-box xray-extra-box">
                                <div className="sxb-header">
                                  <div className="sxb-title">
                                    <Zap size={13} className="text-amber" />
                                    <span>Raio-X da Hora Extra:</span>
                                    <strong className="text-amber">+{totalExtraHours}h extras geradas</strong>
                                  </div>
                                  <strong className="sxb-amount text-gold">+{formatBRL(item.itemAmount)}</strong>
                                </div>
                                <div className="sxb-body">
                                  {item.offHoursWorked > 0 && (
                                    <div className="sxb-line">
                                      <Clock size={11} className="text-amber" />
                                      <span>
                                        <strong>{item.offHoursWorked}h</strong> fora do expediente normal (seg-sex 08h-18h / sáb 08h-12h). Saída às <strong>{item.departureTime}</strong> e retorno às <strong>{item.returnTimeEstimated}</strong>.
                                      </span>
                                    </div>
                                  )}
                                  {item.extraHoursApproved > 0 && (
                                    <div className="sxb-line">
                                      <Sparkles size={11} className="text-gold" />
                                      <span>
                                        <strong>+{item.extraHoursApproved}h</strong> extras adicionais autorizadas pela gestão na pauta.
                                      </span>
                                    </div>
                                  )}
                                  <div className="sxb-calc">
                                    {item.formulaText ? (
                                      <span>{item.formulaText} {item.isCustomRate ? '(com taxa personalizada na pauta)' : ''}</span>
                                    ) : (
                                      <span>Cálculo: {totalExtraHours}h × {formatBRL(item.effectiveHourlyRate)}/h = <strong>{formatBRL(item.itemAmount)}</strong></span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ) : isDaily ? (
                              <div className="sir-xray-box xray-daily-box">
                                <div className="sxb-header">
                                  <div className="sxb-title">
                                    <Calendar size={13} className="text-cyan" />
                                    <span>Raio-X da Diária:</span>
                                    <strong className="text-cyan">{item.daysCount} diária(s) de viagem/campo</strong>
                                  </div>
                                  <strong className="sxb-amount text-cyan">+{formatBRL(item.itemAmount)}</strong>
                                </div>
                                <div className="sxb-body">
                                  <div className="sxb-line">
                                    <Compass size={11} className="text-cyan" />
                                    <span>
                                      Deslocamento de <strong>{formatDateBR(item.date)}</strong> {item.isMultiDay && item.endDate ? `até ${formatDateBR(item.endDate)}` : ''} ({item.daysCount} {item.daysCount === 1 ? 'dia integral' : 'dias integrais'}).
                                    </span>
                                  </div>
                                  <div className="sxb-calc">
                                    Cálculo: {item.daysCount} d × {formatBRL(item.effectiveDailyRate)}/dia {item.isCustomRate ? '(Taxa personalizada na pauta)' : '(Padrão)'} = <strong>{formatBRL(item.itemAmount)}</strong>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="sir-xray-box xray-normal-box">
                                <div className="sxb-line">
                                  <CheckCircle2 size={11} className="text-green" />
                                  <span>Missão das <strong>{item.departureTime}</strong> às <strong>{item.returnTimeEstimated}</strong> realizada 100% no horário comercial. <strong>Não gerou horas extras.</strong></span>
                                </div>
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
                      );
                    })
                  )}
                </div>

                {/* Seção de Vales e Adiantamentos Salariais do Mês */}
                {viewingStatementMember.totalAdvancesAmount > 0 && (
                  <div className="statement-advances-section" style={{ marginTop: 20 }}>
                    <div className="sas-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Receipt size={16} className="text-rose" />
                        <strong style={{ fontSize: '0.95rem' }}>Vales e Adiantamentos Salariais Concedidos no Mês ({viewingStatementMember.advancesCount})</strong>
                      </div>
                      <span className="text-rose" style={{ fontWeight: 800, fontSize: '0.95rem' }}>
                        Total Deduzido: -{formatBRL(viewingStatementMember.totalAdvancesAmount)}
                      </span>
                    </div>

                    <div className="statement-advances-table-wrap">
                      <table className="statement-advances-table">
                        <thead>
                          <tr>
                            <th>Data</th>
                            <th>Valor</th>
                            <th>Forma de Pgto</th>
                            <th>Motivo / Justificativa</th>
                            <th>Autorizado Por</th>
                          </tr>
                        </thead>
                        <tbody>
                          {viewingStatementMember.advances.map((adv) => (
                            <tr key={adv.id}>
                              <td>{formatDateBR(adv.date)}</td>
                              <td className="text-rose" style={{ fontWeight: 700 }}>-{formatBRL(adv.amount)}</td>
                              <td>{adv.paymentMethod || 'PIX'}</td>
                              <td>{adv.reason || 'Adiantamento salarial'}</td>
                              <td>{adv.authorizedBy || 'Gestão'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Resumo Consolidado de Créditos e Débitos */}
                    <div className="statement-totals-reconciliation" style={{
                      marginTop: 12,
                      padding: '12px 16px',
                      background: 'rgba(255,255,255,0.03)',
                      borderRadius: 8,
                      border: '1px solid rgba(255,255,255,0.08)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Total de Créditos (Bruto): </span>
                        <strong style={{ color: '#fbbf24' }}>{formatBRL(viewingStatementMember.totalAmount)}</strong>
                        <span style={{ margin: '0 8px', color: '#64748b' }}>•</span>
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Vales Concedidos: </span>
                        <strong className="text-rose">-{formatBRL(viewingStatementMember.totalAdvancesAmount)}</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.85rem', color: '#e2e8f0', marginRight: 8 }}>Saldo Líquido Final:</span>
                        <strong style={{ fontSize: '1.1rem', color: '#4ade80' }}>{formatBRL(viewingStatementMember.netAmount)}</strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* Rodapé Oficial Timbrado para Impressão com Linhas de Assinatura (visível apenas na impressão) */}
                <div className="statement-print-footer">
                  <div className="spf-sign-col">
                    <div className="spf-sign-line" />
                    <strong>{viewingStatementMember.name}</strong>
                    <span>Colaborador • {viewingStatementMember.role || 'Produção'}</span>
                  </div>
                  <div className="spf-sign-col">
                    <div className="spf-sign-line" />
                    <strong>Diretoria Executiva / Gestão</strong>
                    <span>Mega Filmes &amp; Fotografia</span>
                  </div>
                </div>

                {/* Rodapé do Modal com Ações */}
                <div className="modal-footer statement-footer no-print" style={{ marginTop: 16 }}>
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
                    className="btn-secondary btn-statement-print cs-btn-detalhes-fin"
                    onClick={() => setOfficialStatementMember(viewingStatementMember)}
                    title="Abrir detalhamento financeiro oficial com termo timbrado, PDF e WhatsApp"
                  >
                    <FileText size={15} />
                    <span>Detalhamento Financeiro</span>
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
                    Fechar Raio-X
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal de Detalhes da Missão acionado pelo Raio-X */}
      {selectedMissionForDetail && (
        <MissionDetailModal
          isOpen={Boolean(selectedMissionForDetail)}
          mission={selectedMissionForDetail}
          missions={missions}
          vehicles={vehicles}
          members={members}
          baseLocation={baseLocation}
          userRole="admin"
          onClose={() => setSelectedMissionForDetail(null)}
          onEditMission={(m) => {
            setSelectedMissionForDetail(null);
            if (onEditMission) onEditMission(m);
          }}
        />
      )}

      {/* Modal de Lançamento e Gestão de Vales e Adiantamentos Salariais (FIN-05) */}
      {advancesModalOpen && (
        <SalaryAdvancesModal
          isOpen={true}
          member={advancesModalMember}
          members={members}
          monthKey={selectedMonth}
          monthLabel={monthLabel}
          grossAmount={advancesModalMember?.totalAmount || 0}
          advances={advancesModalMember ? (advancesMap[String(advancesModalMember.id)] || advancesMap[advancesModalMember.id] || []) : []}
          advancesMap={advancesMap}
          currentUser={currentUser}
          onClose={() => {
            setAdvancesModalMember(null);
            setAdvancesModalOpen(false);
          }}
          onRefresh={() => {
            loadAdvances();
          }}
          onAdvancesChanged={() => {
            loadAdvances();
          }}
        />
      )}

      {/* Modal Oficial de Detalhamento & Fechamento Financeiro Timbrado (A4 / PDF / WhatsApp) */}
      {officialStatementData && (
        <FinancialOfficialStatementModal
          collaborator={officialStatementData.collaborator}
          monthKey={officialStatementData.monthKey}
          monthLabel={officialStatementData.monthLabel}
          financialSummary={officialStatementData.financialSummary}
          financialEntries={officialStatementData.financialEntries}
          currentUser={currentUser}
          onClose={() => setOfficialStatementMember(null)}
        />
      )}

      {/* Modal Oficial de Fechamento Consolidado da Folha Timbrado (A4 / PDF / WhatsApp) */}
      {isPayrollOfficialModalOpen && (
        <PayrollOfficialStatementModal
          monthKey={selectedMonth}
          monthLabel={monthLabel}
          summaryTotals={summaryTotals}
          memberPayouts={memberPayouts}
          currentUser={currentUser}
          onClose={() => setIsPayrollOfficialModalOpen(false)}
        />
      )}
    </div>
  );
}
