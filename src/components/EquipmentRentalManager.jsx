import React, { useState, useEffect, useMemo } from 'react';
import {
  Package,
  Plus,
  Search,
  Filter,
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  FileText,
  Printer,
  Share2,
  Edit2,
  Trash2,
  DollarSign,
  Camera,
  Layers,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  X,
  Sparkles,
  Eye,
  Upload,
  Zap,
  ShoppingCart,
  Wrench,
  FileCheck,
  ExternalLink,
  Download,
  Paperclip,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
} from 'lucide-react';
import {
  CATEGORY_LABELS,
  INITIAL_EQUIPMENT_CATALOG,
  formatCurrency,
  formatDateBR,
  formatCpfCnpj,
  formatPhoneBR,
  getEquipPhotoUrl,
  compressImageFile,
  handleRentalPhotoError,
} from '../utils/rentalsData';
import { apiRequest } from '../utils/api';
import { confirmDialog, alertDialog } from '../utils/dialog';
import RentalContractModal from './RentalContractModal';
import EquipmentDetailModal from './EquipmentDetailModal';
import RentalInspectionModal from './RentalInspectionModal';

export default function EquipmentRentalManager({ currentUser, onClose = null }) {
  // Verificação de privilégios de administrador
  const isAdmin = Boolean(
    currentUser?.role === 'admin' ||
    currentUser?.role === 'ADMIN' ||
    currentUser?.accessLevel === 'admin' ||
    currentUser?.isAdmin ||
    currentUser?.username === 'admin' ||
    currentUser?.login === 'admin'
  );

  // Abas do Módulo: 'catalog' (Estoque), 'new_rental' (Nova Locação), 'rentals' (Locações Ativas & Histórico)
  const [activeTab, setActiveTab] = useState('catalog');

  // Dados do Catálogo e Locações
  const [equipmentList, setEquipmentList] = useState(() => {
    try {
      const saved = localStorage.getItem('gestormf_equipment_cache_v4');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((eq) => ({
            ...eq,
            photoUrl: eq.photoUrl || `/images/equipment/${eq.id}.jpg`,
          }));
        }
      }
    } catch { }
    return INITIAL_EQUIPMENT_CATALOG.map((eq) => ({
      ...eq,
      photoUrl: eq.photoUrl || `/images/equipment/${eq.id}.jpg`,
    }));
  });

  const [rentalsList, setRentalsList] = useState(() => {
    try {
      const saved = localStorage.getItem('gestormf_rentals_cache');
      if (saved) return JSON.parse(saved);
    } catch { }
    return [];
  });

  const [isLoading, setIsLoading] = useState(false);

  // Filtros de Catálogo
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Filtros de Locações
  const [rentalStatusFilter, setRentalStatusFilter] = useState('all'); // 'all', 'active', 'due_soon', 'overdue', 'returned'

  // Modais
  const [selectedRentalForContract, setSelectedRentalForContract] = useState(null);
  const [selectedRentalForInspection, setSelectedRentalForInspection] = useState(null); // Vistoria & Fotos de Avarias
  const [selectedDetailEquipment, setSelectedDetailEquipment] = useState(null); // Detalhes completos do equipamento
  const [editingEquipment, setEditingEquipment] = useState(null); // null ou objeto
  const [isNewEquipModalOpen, setIsNewEquipModalOpen] = useState(false);
  const [editEquipPhoto, setEditEquipPhoto] = useState('');
  const [editRateUnit, setEditRateUnit] = useState('diária');
  const [isPhotoLoading, setIsPhotoLoading] = useState(false);
  const [returningRental, setReturningRental] = useState(null); // null ou objeto
  const [sendToMaintenance, setSendToMaintenance] = useState(false);
  const [returnNotes, setReturnNotes] = useState('');
  const [returnDamageCost, setReturnDamageCost] = useState('');
  const [returnDamageType, setReturnDamageType] = useState('Avaria / Reparo Técnico');

  // Filtros e Estados do Painel Financeiro (Receitas & Prejuízos Total e por Período)
  const [financialPeriodType, setFinancialPeriodType] = useState('all'); // 'all' | 'month' | 'last_30' | 'year' | 'custom'
  const [selectedFinancialMonth, setSelectedFinancialMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [selectedFinancialYear, setSelectedFinancialYear] = useState(() => String(new Date().getFullYear()));
  const [customDateStart, setCustomDateStart] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [customDateEnd, setCustomDateEnd] = useState(() => new Date().toISOString().split('T')[0]);
  const [financialDateMode, setFinancialDateMode] = useState('rental_or_created'); // 'rental_or_created' | 'start_date' | 'created_at'
  const [filterRentalsListByPeriod, setFilterRentalsListByPeriod] = useState(false);

  // Modal de Lançamento / Ajuste de Prejuízo, Avaria ou Financeiro da Locação
  const [financialModalData, setFinancialModalData] = useState(null); // { rentalId, code, clientName, totalAmount, paymentStatus, paidAmount, damageCost, damageType, damageNotes, hasDamage, isSaving }

  // Estado do Carrinho / Formulário de Nova Locação
  const [rentalForm, setRentalForm] = useState({
    clientName: '',
    clientDocument: '',
    clientPhone: '',
    clientEmail: '',
    clientAddress: '',
    startDate: new Date().toISOString().split('T')[0],
    startTime: '08:00',
    endDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    endTime: '18:00',
    discount: 0,
    paymentMethod: 'PIX',
    paymentStatus: 'Pendente',
    paidAmount: '',
    remainingDueTerms: 'Na Devolução dos Equipamentos',
    remainingDueDate: '',
    securityDeposit: '',
    paymentReceiptUrl: '',
    paymentReceiptName: '',
    notes: '',
  });

  // Estado para visualização e anexo avulso de comprovante
  const [viewingReceipt, setViewingReceipt] = useState(null); // { url, code, client }
  const [attachingReceiptForRental, setAttachingReceiptForRental] = useState(null); // objeto rental
  const [newReceiptFile, setNewReceiptFile] = useState({ dataUrl: '', name: '', isUploading: false });

  // Utilitário para leitura de comprovantes (imagem comprimida ou PDF)
  const handleReceiptFileRead = async (file) => {
    if (!file) return null;
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ dataUrl: reader.result, name: file.name });
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    } else {
      const compressed = await compressImageFile(file, 1600, 0.85);
      return { dataUrl: compressed, name: file.name };
    }
  };

  const [cartItems, setCartItems] = useState([]); // [{ equipmentId, name, category, dailyRate, quantity, availableQty, serialNumber }]

  // 1. Carrega dados do backend API
  const fetchRentalsData = async () => {
    setIsLoading(true);
    try {
      const data = await apiRequest('/rentals.php');
      if (data && data.success) {
        if (Array.isArray(data.equipment) && data.equipment.length > 0) {
          const enriched = data.equipment.map((eq) => ({
            ...eq,
            photoUrl: eq.photoUrl || `/images/equipment/${eq.id}.jpg`,
          }));
          setEquipmentList(enriched);
          localStorage.setItem('gestormf_equipment_cache_v4', JSON.stringify(enriched));
        }
        if (Array.isArray(data.rentals)) {
          setRentalsList(data.rentals);
          localStorage.setItem('gestormf_rentals_cache', JSON.stringify(data.rentals));
        }
      }
    } catch (e) {
      console.warn('Usando catálogo local / cache:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRentalsData();
  }, []);

  // Salva no cache local sempre que houver alteração
  useEffect(() => {
    try {
      localStorage.setItem('gestormf_equipment_cache_v4', JSON.stringify(equipmentList));
      localStorage.setItem('gestormf_rentals_cache', JSON.stringify(rentalsList));
    } catch { }
  }, [equipmentList, rentalsList]);

  // Sincroniza foto e unidade de cobrança ao abrir modal de edição
  useEffect(() => {
    if (editingEquipment) {
      setEditEquipPhoto(editingEquipment.photoUrl || '');
      setEditRateUnit(editingEquipment.rateUnit || 'diária');
    } else {
      setEditEquipPhoto('');
      setEditRateUnit('diária');
    }
  }, [editingEquipment, isNewEquipModalOpen]);

  // Contadores Gerais & KPIs
  const kpiStats = useMemo(() => {
    const totalUnits = equipmentList.reduce((acc, it) => acc + (Number(it.totalQty) || 1), 0);
    const availableUnits = equipmentList.reduce((acc, it) => acc + (Number(it.availableQty) || 0), 0);
    const maintenanceUnits = equipmentList.reduce((acc, it) => acc + (Number(it.maintenanceQty) || 0), 0);
    const rentedUnits = Math.max(0, totalUnits - availableUnits - maintenanceUnits);

    const totalAssetValue = equipmentList.reduce((acc, it) => {
      let unitVal = Number(it.assetValue) > 0 ? Number(it.assetValue) : 0;
      if (unitVal <= 0) {
        const fallbackItem = INITIAL_EQUIPMENT_CATALOG.find((x) => x.id === it.id || x.name?.trim().toLowerCase() === it.name?.trim().toLowerCase());
        unitVal = fallbackItem?.assetValue || ((Number(it.dailyRate) || 0) * 18);
      }
      return acc + (unitVal * (Number(it.totalQty) || 1));
    }, 0);

    const categoryPatrimony = {};
    equipmentList.forEach((it) => {
      const cat = it.category || 'accessories';
      let unitVal = Number(it.assetValue) > 0 ? Number(it.assetValue) : 0;
      if (unitVal <= 0) {
        const fallbackItem = INITIAL_EQUIPMENT_CATALOG.find((x) => x.id === it.id || x.name?.trim().toLowerCase() === it.name?.trim().toLowerCase());
        unitVal = fallbackItem?.assetValue || ((Number(it.dailyRate) || 0) * 18);
      }
      const totalItemVal = unitVal * (Number(it.totalQty) || 1);
      if (!categoryPatrimony[cat]) {
        categoryPatrimony[cat] = { totalValue: 0, units: 0, itemsCount: 0 };
      }
      categoryPatrimony[cat].totalValue += totalItemVal;
      categoryPatrimony[cat].units += Number(it.totalQty) || 1;
      categoryPatrimony[cat].itemsCount += 1;
    });

    const todayStr = new Date().toISOString().split('T')[0];

    const activeRentals = rentalsList.filter((r) => r.status === 'active' || r.status === 'overdue');
    const reservedCount = rentalsList.filter((r) => r.status === 'reserved').length;
    const overdueCount = rentalsList.filter((r) => {
      return (r.status === 'active' || r.status === 'overdue') && r.endDate < todayStr;
    }).length;

    const dueTodayCount = rentalsList.filter((r) => {
      return (r.status === 'active' || r.status === 'overdue') && r.endDate === todayStr;
    }).length;

    const validRentalsAll = rentalsList.filter((r) => r.status !== 'cancelled');
    const totalRevenueAllTime = validRentalsAll.reduce((acc, r) => acc + (Number(r.totalAmount) || 0), 0);
    const totalLossAllTime = rentalsList.reduce((acc, r) => acc + (Number(r.damageCost) || 0), 0);

    return {
      totalUnits,
      availableUnits,
      maintenanceUnits,
      rentedUnits,
      totalAssetValue,
      categoryPatrimony,
      activeRentalsCount: activeRentals.length,
      reservedCount,
      overdueCount,
      dueTodayCount,
      totalRevenueAllTime,
      totalLossAllTime,
    };
  }, [equipmentList, rentalsList]);

  // Helpers de Formatação e Navegação de Período Financeiro
  const formatMonthLabelPT = (ym) => {
    if (!ym || !ym.includes('-')) return ym;
    const [y, m] = ym.split('-').map(Number);
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
    ];
    return `${months[(m - 1) % 12] || m} de ${y}`;
  };

  const handleChangeFinancialMonth = (delta) => {
    const [y, m] = (selectedFinancialMonth || '2026-11').split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    const nextYm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    setSelectedFinancialMonth(nextYm);
    setFinancialPeriodType('month');
  };

  // Verifica se uma locação pertence ao período financeiro selecionado
  const matchesSelectedPeriod = (r) => {
    if (financialPeriodType === 'all') return true;
    const startStr = (r.startDate || '').slice(0, 10);
    const createdStr = (r.createdAt || '').slice(0, 10) || startStr;

    const checkDateInRange = (dStr) => {
      if (!dStr) return false;
      if (financialPeriodType === 'month') {
        return dStr.startsWith(selectedFinancialMonth);
      }
      if (financialPeriodType === 'year') {
        return dStr.startsWith(selectedFinancialYear);
      }
      if (financialPeriodType === 'last_30') {
        const limit = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
        return dStr >= limit;
      }
      if (financialPeriodType === 'custom') {
        const fromOk = !customDateStart || dStr >= customDateStart;
        const toOk = !customDateEnd || dStr <= customDateEnd;
        return fromOk && toOk;
      }
      return true;
    };

    if (financialDateMode === 'start_date') return checkDateInRange(startStr);
    if (financialDateMode === 'created_at') return checkDateInRange(createdStr);
    return checkDateInRange(startStr) || checkDateInRange(createdStr);
  };

  // Inteligência Financeira Completa: Valores Obtidos & Prejuízos (Total Geral e Por Período)
  const financialAnalytics = useMemo(() => {
    const computeMetrics = (list) => {
      const validList = list.filter((r) => r.status !== 'cancelled');
      const cancelledList = list.filter((r) => r.status === 'cancelled');

      let grossRevenue = 0;
      let receivedRevenue = 0;
      let pendingRevenue = 0;
      let damageLosses = 0;
      let cancelledAmount = 0;
      let damagedContractsCount = 0;

      validList.forEach((r) => {
        const total = Number(r.totalAmount) || 0;
        const paid = r.paymentStatus === 'Pago'
          ? (Number(r.paidAmount) > 0 ? Number(r.paidAmount) : total)
          : (Number(r.paidAmount) || 0);
        const rem = Math.max(0, total - paid);

        grossRevenue += total;
        receivedRevenue += paid;
        pendingRevenue += rem;
      });

      cancelledList.forEach((r) => {
        cancelledAmount += Number(r.totalAmount) || 0;
      });

      list.forEach((r) => {
        const dmg = Number(r.damageCost) || 0;
        damageLosses += dmg;
        if (dmg > 0 || r.hasDamage || r.sentToMaintenance) {
          damagedContractsCount += 1;
        }
      });

      // Valor de patrimônio atualmente parado em manutenção técnica
      const maintenanceAssetExposure = equipmentList.reduce((acc, eq) => {
        const mQty = Number(eq.maintenanceQty) || 0;
        if (mQty <= 0) return acc;
        const uVal = Number(eq.assetValue) || ((Number(eq.dailyRate) || 0) * 18);
        return acc + uVal * mQty;
      }, 0);

      const netContracted = grossRevenue - damageLosses;
      const netCash = receivedRevenue - damageLosses;

      return {
        totalContracts: validList.length,
        cancelledCount: cancelledList.length,
        grossRevenue,
        receivedRevenue,
        pendingRevenue,
        damageLosses,
        cancelledAmount,
        damagedContractsCount,
        maintenanceAssetExposure,
        netContracted,
        netCash,
      };
    };

    const allTime = computeMetrics(rentalsList);
    const periodList = rentalsList.filter(matchesSelectedPeriod);
    const period = computeMetrics(periodList);

    // Quebra detalhada por Período (Mês a Mês)
    const monthsMap = {};
    const curYm = new Date().toISOString().slice(0, 7);
    monthsMap[curYm] = [];

    rentalsList.forEach((r) => {
      const refDate = financialDateMode === 'created_at'
        ? ((r.createdAt || '').slice(0, 7) || (r.startDate || '').slice(0, 7))
        : ((r.startDate || '').slice(0, 7) || (r.createdAt || '').slice(0, 7));
      const ym = refDate || curYm;
      if (!monthsMap[ym]) monthsMap[ym] = [];
      monthsMap[ym].push(r);
    });

    const byMonth = Object.keys(monthsMap)
      .sort((a, b) => b.localeCompare(a))
      .map((ym) => ({
        ym,
        label: formatMonthLabelPT(ym),
        ...computeMetrics(monthsMap[ym]),
      }));

    let periodLabel = 'Todo o Período (Acumulado Geral)';
    if (financialPeriodType === 'month') periodLabel = formatMonthLabelPT(selectedFinancialMonth);
    else if (financialPeriodType === 'year') periodLabel = `Ano de ${selectedFinancialYear}`;
    else if (financialPeriodType === 'last_30') periodLabel = 'Últimos 30 Dias';
    else if (financialPeriodType === 'custom') {
      periodLabel = `${formatDateBR(customDateStart)} até ${formatDateBR(customDateEnd)}`;
    }

    return {
      allTime,
      period,
      periodLabel,
      byMonth,
      periodListCount: periodList.length,
    };
  }, [
    rentalsList,
    equipmentList,
    financialPeriodType,
    selectedFinancialMonth,
    selectedFinancialYear,
    customDateStart,
    customDateEnd,
    financialDateMode,
  ]);

  // Catálogo Filtrado
  const filteredEquipment = useMemo(() => {
    return equipmentList.filter((item) => {
      const matchCat =
        selectedCategory === 'all'
          ? true
          : selectedCategory === 'maintenance'
          ? (item.maintenanceQty || 0) > 0
          : item.category === selectedCategory;
      const q = searchTerm.toLowerCase().trim();
      const matchSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q)) ||
        (item.serialNumber && item.serialNumber.toLowerCase().includes(q));
      return matchCat && matchSearch;
    });
  }, [equipmentList, selectedCategory, searchTerm]);

  // Locações Filtradas
  const filteredRentals = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const q = (searchTerm || '').toLowerCase().trim();

    return rentalsList.filter((r) => {
      let matchesStatus = true;
      if (rentalStatusFilter === 'reserved') matchesStatus = (r.status === 'reserved');
      else if (rentalStatusFilter === 'active') matchesStatus = (r.status === 'active');
      else if (rentalStatusFilter === 'overdue') matchesStatus = ((r.status === 'active' || r.status === 'overdue') && r.endDate < todayStr);
      else if (rentalStatusFilter === 'due_soon') matchesStatus = ((r.status === 'active' || r.status === 'overdue') && r.endDate === todayStr);
      else if (rentalStatusFilter === 'returned') matchesStatus = (r.status === 'returned');

      if (!matchesStatus) return false;

      if (filterRentalsListByPeriod && financialPeriodType !== 'all') {
        if (!matchesSelectedPeriod(r)) return false;
      }

      if (q) {
        const matchCode = (r.code || '').toLowerCase().includes(q);
        const matchClient = (r.clientName || '').toLowerCase().includes(q);
        const matchDoc = (r.clientDocument || '').toLowerCase().includes(q);
        const matchItems = (r.items || []).some((it) => (it.name || '').toLowerCase().includes(q));
        return matchCode || matchClient || matchDoc || matchItems;
      }

      return true;
    });
  }, [
    rentalsList,
    rentalStatusFilter,
    searchTerm,
    filterRentalsListByPeriod,
    financialPeriodType,
    selectedFinancialMonth,
    selectedFinancialYear,
    customDateStart,
    customDateEnd,
    financialDateMode,
  ]);

  // Cálculo de Dias do Formulário de Locação
  const rentalDays = useMemo(() => {
    if (!rentalForm.startDate || !rentalForm.endDate) return 1;
    const start = new Date(rentalForm.startDate).getTime();
    const end = new Date(rentalForm.endDate).getTime();
    const diff = Math.round((end - start) / 86400000);
    return Math.max(1, diff);
  }, [rentalForm.startDate, rentalForm.endDate]);

  // Totais do Carrinho
  const cartSubtotal = useMemo(() => {
    return cartItems.reduce((acc, item) => {
      return acc + (Number(item.dailyRate) || 0) * (Number(item.quantity) || 1) * rentalDays;
    }, 0);
  }, [cartItems, rentalDays]);

  const cartTotalAmount = Math.max(0, cartSubtotal - (Number(rentalForm.discount) || 0));

  // Ações do Carrinho
  const handleAddToCart = (equip) => {
    if (equip.availableQty <= 0) {
      alertDialog({
        title: 'Equipamento Indisponível',
        message: `Todas as unidades de "${equip.name}" estão atualmente alugadas.`,
        variant: 'warning',
      });
      return;
    }

    setCartItems((prev) => {
      const existing = prev.find((it) => it.equipmentId === equip.id);
      if (existing) {
        if (existing.quantity >= equip.availableQty) {
          alertDialog({
            title: 'Limite do Estoque',
            message: `Apenas ${equip.availableQty} unidade(s) disponíveis no momento.`,
            variant: 'warning',
          });
          return prev;
        }
        return prev.map((it) =>
          it.equipmentId === equip.id ? { ...it, quantity: it.quantity + 1 } : it
        );
      }
      return [
        ...prev,
        {
          equipmentId: equip.id,
          name: equip.name,
          category: equip.category,
          dailyRate: equip.dailyRate,
          rateUnit: equip.rateUnit || 'diária',
          photoUrl: equip.photoUrl || `/images/equipment/${equip.id}.jpg`,
          quantity: 1,
          availableQty: equip.availableQty,
          serialNumber: equip.serialNumber || '',
        },
      ];
    });
  };

  const handleUpdateCartQuantity = (equipmentId, delta) => {
    setCartItems((prev) =>
      prev
        .map((it) => {
          if (it.equipmentId === equipmentId) {
            const newQty = it.quantity + delta;
            if (newQty > it.availableQty) {
              alertDialog({
                title: 'Limite do Estoque',
                message: `Apenas ${it.availableQty} unidade(s) disponíveis no estoque.`,
                variant: 'warning',
              });
              return it;
            }
            return { ...it, quantity: newQty };
          }
          return it;
        })
        .filter((it) => it.quantity > 0)
    );
  };

  const handleRemoveFromCart = (equipmentId) => {
    setCartItems((prev) => prev.filter((it) => it.equipmentId !== equipmentId));
  };

  // Finalizar e Criar Locação
  // 4. Submeter Nova Locação ou Reserva/Agendamento
  const handleCreateRental = async (e, intendedStatus = null) => {
    if (e && e.preventDefault) e.preventDefault();

    if (!rentalForm.clientName.trim()) {
      alertDialog({
        title: 'Dados Incompletos',
        message: 'Por favor, informe o nome completo do cliente / locatário.',
        variant: 'warning',
      });
      return;
    }

    const cleanDoc = (rentalForm.clientDocument || '').replace(/\D/g, '');
    if (!cleanDoc || (cleanDoc.length !== 11 && cleanDoc.length !== 14)) {
      alertDialog({
        title: 'CPF ou CNPJ Obrigatório',
        message: 'Por favor, informe um CPF válido (11 dígitos) ou CNPJ válido (14 dígitos) do cliente / empresa. Este campo é obrigatório para a emissão do termo e autenticidade jurídica.',
        variant: 'warning',
      });
      return;
    }

    if (cartItems.length === 0) {
      alertDialog({
        title: 'Carrinho Vazio',
        message: 'Selecione ao menos um equipamento para criar a locação ou reserva.',
        variant: 'warning',
      });
      return;
    }

    // Validação de pagamento parcial
    if (rentalForm.paymentStatus === 'Caução Recebido') {
      if (rentalForm.paidAmount === '' || parseFloat(rentalForm.paidAmount) < 0) {
        alertDialog({
          title: 'Valor Pago Obrigatório',
          message: 'Como o status selecionado é "Caução / Parcial", informe o valor que já foi pago de entrada.',
          variant: 'warning',
        });
        return;
      }
      if (rentalForm.remainingDueTerms === 'Data Específica' && !rentalForm.remainingDueDate) {
        alertDialog({
          title: 'Data Limite Obrigatória',
          message: 'Por favor, informe a data limite para o pagamento do saldo faltante.',
          variant: 'warning',
        });
        return;
      }
    }

    const paidVal = parseFloat(rentalForm.paidAmount) || 0;
    const remainingVal = rentalForm.paymentStatus === 'Pago'
      ? 0
      : (rentalForm.paidAmount !== '' ? Math.max(0, cartTotalAmount - paidVal) : cartTotalAmount);

    const todayStr = new Date().toISOString().split('T')[0];
    const isFutureStartDate = rentalForm.startDate > todayStr;
    // Se a data de início for futura, é SEMPRE um Agendamento / Reserva ('reserved'),
    // independentemente do pagamento estar quitado. O item não sai do estoque físico de hoje.
    const statusToApply = isFutureStartDate ? 'reserved' : (intendedStatus || (rentalForm.paymentStatus === 'Pago' ? 'active' : 'reserved'));
    const isReservation = statusToApply === 'reserved';

    const payload = {
      ...rentalForm,
      paidAmount: paidVal,
      remainingAmount: remainingVal,
      remainingDueTerms: rentalForm.remainingDueTerms || 'Na Devolução dos Equipamentos',
      remainingDueDate: rentalForm.remainingDueDate || null,
      securityDeposit: parseFloat(rentalForm.securityDeposit) || 0,
      totalDays: rentalDays,
      subtotal: cartSubtotal,
      discount: Number(rentalForm.discount) || 0,
      totalAmount: cartTotalAmount,
      status: statusToApply,
      items: cartItems.map((it) => ({
        ...it,
        itemTotal: it.dailyRate * it.quantity * rentalDays,
      })),
      createdBy: currentUser?.name || 'Administrador',
    };

    try {
      const data = await apiRequest('/rentals.php?action=create_rental', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (data && data.success) {
        const prefix = isReservation ? 'RES-' : 'LOC-';
        const newCode = data.code || `${prefix}${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${String(rentalsList.length + 1).padStart(3, '0')}`;
        const newRentalObj = {
          id: data.rentalId || 'rent-' + Date.now(),
          code: newCode,
          authSignature: data.authSignature || '',
          paymentReceiptUrl: data.paymentReceiptUrl || payload.paymentReceiptUrl || '',
          ...payload,
          status: statusToApply,
          createdAt: new Date().toISOString(),
        };

        // Atualiza estado local imediatamente
        setRentalsList((prev) => [newRentalObj, ...prev]);

        // Sincroniza dados oficiais com o servidor em background
        fetchRentalsData();

        // Limpa carrinho e formulário
        setCartItems([]);
        setRentalForm({
          clientName: '',
          clientDocument: '',
          clientPhone: '',
          clientEmail: '',
          clientAddress: '',
          startDate: new Date().toISOString().split('T')[0],
          startTime: '08:00',
          endDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
          endTime: '18:00',
          discount: 0,
          paymentMethod: 'PIX',
          paymentStatus: 'Pendente',
          paidAmount: '',
          remainingDueTerms: 'Na Devolução dos Equipamentos',
          remainingDueDate: '',
          securityDeposit: '',
          paymentReceiptUrl: '',
          paymentReceiptName: '',
          notes: '',
        });

        // Abre imediatamente o Termo/Comprovante para impressão/envio
        setSelectedRentalForContract(newRentalObj);
        setActiveTab('rentals');

        if (isReservation) {
          alertDialog({
            title: '📅 Agendamento & Reserva Concluídos!',
            message: `Reserva ${newCode} registrada com sucesso! Os equipamentos foram bloqueados no estoque para o cliente. O comprovante está pronto na tela.`,
            variant: 'success',
          });
        } else {
          alertDialog({
            title: '🎉 Locação Criada com Sucesso!',
            message: `Contrato ${newCode} registrado. O termo de responsabilidade está pronto na tela para impressão ou compartilhamento.`,
            variant: 'success',
          });
        }
        return;
      } else {
        throw new Error(data?.error || 'Erro ao salvar registro no servidor.');
      }
    } catch (err) {
      console.warn('Fallback offline para locação/reserva:', err);
      const prefix = isReservation ? 'RES-' : 'LOC-';
      const newCode = `${prefix}${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${String(rentalsList.length + 1).padStart(3, '0')}`;
      const newRentalObj = {
        id: 'rent-' + Date.now(),
        code: newCode,
        ...payload,
        status: statusToApply,
        createdAt: new Date().toISOString(),
      };

      setEquipmentList((prev) =>
        prev.map((eq) => {
          const inCart = cartItems.find((c) => c.equipmentId === eq.id);
          if (inCart) {
            const newAvail = Math.max(0, eq.availableQty - inCart.quantity);
            return { ...eq, availableQty: newAvail, status: newAvail > 0 ? 'available' : 'rented' };
          }
          return eq;
        })
      );

      setRentalsList((prev) => [newRentalObj, ...prev]);
      setCartItems([]);
      setSelectedRentalForContract(newRentalObj);
      setActiveTab('rentals');

      alertDialog({
        title: isReservation ? '📅 Reserva Registrada' : 'Locação Registrada Localmente',
        message: `${isReservation ? 'Reserva' : 'Contrato'} ${newCode} gerado e salvo com sucesso!`,
        variant: 'success',
      });
    }
  };

  // Confirmar Retirada / Entregar Equipamento (Inicia Locação Oficial e dá baixa no estoque)
  const handleActivateReservation = async (rental) => {
    const confirmed = await confirmDialog({
      title: '📦 Confirmar Retirada & Entregar Equipamentos',
      message: `Deseja registrar a entrega e retirada física dos equipamentos para "${rental.clientName}" (${rental.code})?\n\nIsso atualizará a locação para "Em Andamento" e baixará os itens do estoque físico disponível.`,
      confirmLabel: 'Sim, Entregar Equipamento',
      cancelLabel: 'Voltar',
      variant: 'primary',
    });
    if (!confirmed) return;

    try {
      const res = await apiRequest('/rentals.php?action=activate_reservation', {
        method: 'POST',
        body: JSON.stringify({ rentalId: rental.id, markPaid: rental.paymentStatus === 'Pago' }),
      });
      if (res && res.success) {
        fetchRentalsData();
      }
    } catch (e) {
      console.warn('Ativando reserva localmente:', e);
    }

    const updated = { ...rental, status: 'active' };
    setRentalsList((prev) => prev.map((r) => (r.id === rental.id ? updated : r)));
    setSelectedRentalForContract(updated);

    alertDialog({
      title: '🚀 Retirada Confirmada com Sucesso!',
      message: `A locação ${rental.code} agora está Em Andamento. O termo oficial de responsabilidade está aberto para conferência.`,
      variant: 'success',
    });
  };

  // Cancelar Reserva ou Locação (Devolve itens ao estoque)
  const handleCancelRental = async (rental) => {
    const isRes = rental.status === 'reserved';
    const confirmed = await confirmDialog({
      title: isRes ? 'Cancelar Agendamento / Reserva' : 'Cancelar Locação',
      message: `Tem certeza que deseja cancelar ${isRes ? 'a reserva' : 'a locação'} "${rental.code}"? Todos os equipamentos retornarão imediatamente ao estoque disponível.`,
      confirmLabel: 'Sim, Cancelar',
      cancelLabel: 'Manter',
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      const res = await apiRequest('/rentals.php?action=cancel_rental', {
        method: 'POST',
        body: JSON.stringify({ rentalId: rental.id }),
      });
      if (res && res.success) {
        fetchRentalsData();
      }
    } catch (e) {
      console.warn('Cancelando localmente:', e);
    }

    // Libera os equipamentos de volta
    const returnedItems = rental.items || [];
    setEquipmentList((prev) =>
      prev.map((eq) => {
        const item = returnedItems.find((it) => it.equipmentId === eq.id);
        if (item) {
          const newAvail = Math.min(eq.totalQty, eq.availableQty + item.quantity);
          return { ...eq, availableQty: newAvail, status: newAvail > 0 ? 'available' : 'rented' };
        }
        return eq;
      })
    );

    setRentalsList((prev) =>
      prev.map((r) => (r.id === rental.id ? { ...r, status: 'cancelled' } : r))
    );

    alertDialog({
      title: 'Cancelamento Concluído',
      message: `${isRes ? 'Reserva' : 'Locação'} ${rental.code} foi cancelada e os equipamentos estão disponíveis no acervo.`,
      variant: 'info',
    });
  };

  // Excluir Definitivamente Registro do Histórico (Exclusivo Administrador)
  const handleDeleteRental = async (rental) => {
    const isRes = rental.status === 'reserved';
    const confirmed = await confirmDialog({
      title: 'Excluir do Histórico Permanentemente?',
      message: `Tem certeza que deseja excluir em definitivo ${isRes ? 'a reserva' : 'o contrato de locação'} "${rental.code}" (${rental.clientName}) do sistema? Esta ação é irreversível.`,
      description: (rental.status === 'active' || rental.status === 'reserved' || rental.status === 'overdue')
        ? '⚠️ Os equipamentos alocados retornarão imediatamente ao estoque disponível.'
        : 'O registro será removido permanentemente do banco de dados e do histórico.',
      confirmLabel: 'Sim, Excluir Definitivamente',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });

    if (!confirmed) return;

    try {
      const res = await apiRequest('/rentals.php?action=delete_rental', {
        method: 'POST',
        body: JSON.stringify({ rentalId: rental.id, code: rental.code }),
      });

      if (res && res.success) {
        setRentalsList((prev) => prev.filter((r) => r.id !== rental.id && r.code !== rental.code));
        await fetchRentalsData();
        alertDialog({
          title: 'Registro Excluído!',
          message: res.message || `Registro ${rental.code} excluído com sucesso do histórico.`,
          variant: 'success',
        });
      } else {
        alertDialog({
          title: 'Erro ao Excluir',
          message: res?.error || 'Falha ao excluir registro.',
          variant: 'danger',
        });
      }
    } catch (err) {
      alertDialog({
        title: 'Erro de Conexão',
        message: err.message || 'Falha ao se comunicar com o servidor.',
        variant: 'danger',
      });
    }
  };

  // Salvar Equipamento (Editar ou Novo)
  const handleSaveEquipment = async (equipData) => {
    let finalPhotoUrl = equipData.photoUrl;

    try {
      const data = await apiRequest('/rentals.php?action=save_equipment', {
        method: 'POST',
        body: JSON.stringify(equipData),
      });

      if (data && data.success) {
        if (data.photoUrl) {
          finalPhotoUrl = data.photoUrl;
        }
        await fetchRentalsData();
      } else {
        const errorMsg = data?.error || 'Não foi possível salvar o equipamento no servidor.';
        alertDialog({
          title: 'Erro ao Salvar Equipamento',
          message: errorMsg,
          variant: 'danger',
        });
        return;
      }
    } catch (e) {
      console.error('Erro ao conectar com api rentals:', e);
      alertDialog({
        title: 'Erro de Conexão',
        message: 'Falha de comunicação com o servidor: ' + (e.message || 'Erro desconhecido'),
        variant: 'danger',
      });
      return;
    }

    const payloadWithFinalPhoto = { ...equipData, photoUrl: finalPhotoUrl };

    // Atualização local imediata
    setEquipmentList((prev) => {
      const idx = prev.findIndex((e) => e.id === equipData.id);
      if (idx >= 0) {
        const updated = [...prev];
        const diff = (equipData.totalQty || 1) - (prev[idx].totalQty || 1);
        const newAvail = Math.max(0, (prev[idx].availableQty || 0) + diff);
        const merged = { ...prev[idx], ...payloadWithFinalPhoto, availableQty: newAvail, status: newAvail > 0 ? 'available' : 'rented' };
        updated[idx] = merged;
        if (selectedDetailEquipment && selectedDetailEquipment.id === equipData.id) {
          setSelectedDetailEquipment(merged);
        }
        return updated;
      } else {
        const newObj = {
          ...payloadWithFinalPhoto,
          id: equipData.id || 'eq-' + Date.now(),
          availableQty: equipData.totalQty,
          status: 'available',
        };
        return [newObj, ...prev];
      }
    });

    setEditingEquipment(null);
    setIsNewEquipModalOpen(false);
    alertDialog({
      title: 'Equipamento Salvo!',
      message: `Equipamento "${equipData.name}" e foto atualizados com sucesso no catálogo.`,
      variant: 'success',
    });
  };

  // Atualizar foto do equipamento diretamente (via modal de detalhes ou edição)
  const handleUpdateEquipmentPhoto = async (equipmentId, photoUrl) => {
    const equip = equipmentList.find((e) => e.id === equipmentId);
    if (!equip) return;

    try {
      const res = await apiRequest('/rentals.php?action=update_equipment_photo', {
        method: 'POST',
        body: JSON.stringify({ id: equipmentId, photoUrl }),
      });
      const finalUrl = (res && res.success && res.photoUrl) ? res.photoUrl : photoUrl;
      const finalBackup = (res && res.photoBackup) ? res.photoBackup : (photoUrl?.startsWith('data:image/') ? photoUrl : equip.photoBackup);
      const updated = { ...equip, photoUrl: finalUrl, photoBackup: finalBackup };
      setEquipmentList((prev) => prev.map((e) => (e.id === equipmentId ? updated : e)));
      if (selectedDetailEquipment && selectedDetailEquipment.id === equipmentId) {
        setSelectedDetailEquipment(updated);
      }
      await fetchRentalsData();
      alertDialog({
        title: 'Foto Atualizada!',
        message: 'A foto do equipamento foi salva e protegida com sucesso no servidor.',
        variant: 'success',
      });
    } catch (e) {
      console.warn('Fallback para salvamento completo de equipamento:', e);
      const updated = { ...equip, photoUrl };
      await handleSaveEquipment(updated);
    }
  };

  // Check-in / Devolução de Equipamentos
  const handleConfirmReturn = async () => {
    if (!returningRental) return;

    const parsedDamageCost = parseFloat(returnDamageCost) || (Number(returningRental.damageCost) || 0);
    const hasDmgFlag = sendToMaintenance || parsedDamageCost > 0 || Boolean(returningRental.hasDamage);

    try {
      const res = await apiRequest('/rentals.php?action=return_rental', {
        method: 'POST',
        body: JSON.stringify({
          rentalId: returningRental.id,
          returnNotes,
          sendToMaintenance,
          hasDamage: hasDmgFlag,
          damageCost: parsedDamageCost,
          damageType: hasDmgFlag ? returnDamageType : '',
          damageNotes: hasDmgFlag ? returnNotes : '',
        }),
      });
      if (res && res.success) {
        fetchRentalsData();
      }
    } catch (e) {
      console.warn('Registrando devolução localmente:', e);
    }

    // Libera ou encaminha quantidades para manutenção
    const returnedItems = returningRental.items || [];
    setEquipmentList((prev) =>
      prev.map((eq) => {
        const item = returnedItems.find((it) => it.equipmentId === eq.id);
        if (item) {
          if (sendToMaintenance) {
            const newMaint = (eq.maintenanceQty || 0) + item.quantity;
            const newAvail = eq.availableQty; // NÃO incrementa estoque disponível!
            const newStatus = newAvail > 0 ? 'available' : 'maintenance';
            return {
              ...eq,
              maintenanceQty: newMaint,
              status: newStatus,
              maintenanceNotes: `Encaminhado para manutenção após devolução ${returningRental.code}: ${returnNotes || 'Avaria identificada'}`,
            };
          } else {
            const newAvail = Math.min(eq.totalQty, eq.availableQty + item.quantity);
            return { ...eq, availableQty: newAvail, status: newAvail > 0 ? 'available' : 'rented' };
          }
        }
        return eq;
      })
    );

    // Marca como devolvida
    setRentalsList((prev) =>
      prev.map((r) =>
        r.id === returningRental.id
          ? {
            ...r,
            status: 'returned',
            returnedAt: new Date().toISOString(),
            returnNotes: returnNotes,
            hasDamage: hasDmgFlag,
            damageCost: parsedDamageCost,
            damageType: hasDmgFlag ? returnDamageType : (r.damageType || ''),
            damageNotes: hasDmgFlag ? returnNotes : (r.damageNotes || ''),
            sentToMaintenance: sendToMaintenance,
          }
          : r
      )
    );

    const rCode = returningRental.code;
    const sentMaint = sendToMaintenance;
    setReturningRental(null);
    setReturnNotes('');
    setReturnDamageCost('');
    setReturnDamageType('Avaria / Reparo Técnico');
    setSendToMaintenance(false);

    alertDialog({
      title: sentMaint ? '🛠️ Devolução Concluída & Item em Manutenção' : '✅ Devolução Registrada com Sucesso!',
      message: sentMaint
        ? `A locação ${rCode} foi finalizada. O equipamento com avaria foi encaminhado para Manutenção Técnica e NÃO estará disponível para novas locações até a conclusão do reparo.`
        : `A locação ${rCode} foi finalizada. Todos os equipamentos retornaram para o status DISPONÍVEL no estoque.`,
      variant: sentMaint ? 'warning' : 'success',
    });
  };

  // Abrir Modal de Registro / Ajuste de Prejuízo, Avaria ou Financeiro da Locação
  const handleOpenFinancialModal = (rental = null) => {
    const target = rental || rentalsList[0];
    if (!target) {
      alertDialog({
        title: 'Sem Locações Cadastradas',
        message: 'Cadastre ao menos uma locação para vincular receitas ou prejuízos.',
        variant: 'info',
      });
      return;
    }

    const total = Number(target.totalAmount) || 0;
    const paid = target.paymentStatus === 'Pago'
      ? (Number(target.paidAmount) > 0 ? Number(target.paidAmount) : total)
      : (Number(target.paidAmount) || 0);

    setFinancialModalData({
      rentalId: target.id,
      code: target.code,
      clientName: target.clientName,
      totalAmount: total,
      paymentStatus: target.paymentStatus || 'Pendente',
      paidAmount: String(paid),
      damageCost: target.damageCost !== undefined && Number(target.damageCost) > 0 ? String(target.damageCost) : '',
      damageType: target.damageType || 'Avaria / Reparo Técnico',
      damageNotes: target.damageNotes || target.returnNotes || '',
      hasDamage: Boolean(target.hasDamage || Number(target.damageCost) > 0),
      isSaving: false,
    });
  };

  // Salvar Prejuízo / Avaria / Financeiro da Locação
  const handleSaveFinancialModal = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!financialModalData) return;

    const dmgVal = Math.max(0, parseFloat(financialModalData.damageCost) || 0);
    const total = Number(financialModalData.totalAmount) || 0;
    const paidVal = financialModalData.paymentStatus === 'Pago'
      ? total
      : Math.max(0, parseFloat(financialModalData.paidAmount) || 0);
    const remVal = Math.max(0, total - paidVal);
    const hasDmg = dmgVal > 0 || Boolean(financialModalData.hasDamage);

    setFinancialModalData((prev) => ({ ...prev, isSaving: true }));

    try {
      await apiRequest('/rentals.php?action=update_rental_financial', {
        method: 'POST',
        body: JSON.stringify({
          rentalId: financialModalData.rentalId,
          damageCost: dmgVal,
          damageType: hasDmg ? financialModalData.damageType : '',
          damageNotes: financialModalData.damageNotes || '',
          hasDamage: hasDmg,
          paymentStatus: financialModalData.paymentStatus,
          paidAmount: paidVal,
          remainingAmount: remVal,
        }),
      });
    } catch (err) {
      console.warn('Atualizando financeiro localmente:', err);
    }

    setRentalsList((prev) =>
      prev.map((r) =>
        r.id === financialModalData.rentalId
          ? {
            ...r,
            damageCost: dmgVal,
            damageType: hasDmg ? financialModalData.damageType : '',
            damageNotes: financialModalData.damageNotes || '',
            hasDamage: hasDmg,
            paymentStatus: financialModalData.paymentStatus,
            paidAmount: paidVal,
            remainingAmount: remVal,
          }
          : r
      )
    );

    const code = financialModalData.code;
    setFinancialModalData(null);
    fetchRentalsData();

    alertDialog({
      title: '💰 Balanço Financeiro Atualizado!',
      message: `Os valores de receita e prejuízos da locação ${code} foram salvos e contabilizados no painel por período e total.`,
      variant: 'success',
    });
  };

  return (
    <div className="equipment-rental-manager">
      {/* 1. Header do Módulo de Aluguel */}
      <div className="erm-header">
        <div className="erm-header-glow-orb" />
        <div className="erm-header-main">
          <div className="erm-badge">
            <span className="erm-badge-dot" />
            <Camera size={13} />
            <span>Gestão de Estoque &amp; Locações Externas</span>
          </div>
          <h1 className="erm-title">
            Aluguel de Equipamentos <span className="erm-title-gradient">MegaFilmes</span>
          </h1>
          <p className="erm-desc">
            Controle de inventário em tempo real, geração automatizada de contratos e acompanhamento de locações externas.
          </p>
        </div>

        {/* Strip de Indicadores Rápidos */}
        <div className="erm-kpi-strip">
          <div className="erm-kpi-card kpi-total">
            <div className="erm-kpi-top">
              <div className="erm-kpi-icon-wrap icon-gold">
                <Package size={15} />
              </div>
              <span className="erm-kpi-lbl">Total Acervo</span>
            </div>
            <div className="erm-kpi-val text-gold">{kpiStats.totalUnits}</div>
            <span className="erm-kpi-sub">unidades no catálogo</span>
          </div>

          <div className="erm-kpi-card kpi-available">
            <div className="erm-kpi-top">
              <div className="erm-kpi-icon-wrap icon-emerald">
                <CheckCircle2 size={15} />
              </div>
              <span className="erm-kpi-lbl">Disponíveis</span>
            </div>
            <div className="erm-kpi-val text-emerald">{kpiStats.availableUnits}</div>
            <span className="erm-kpi-sub">prontos para locação</span>
          </div>

          <div className="erm-kpi-card kpi-patrimony">
            <div className="erm-kpi-top">
              <div className="erm-kpi-icon-wrap icon-purple">
                <Sparkles size={15} />
              </div>
              <span className="erm-kpi-lbl">Patrimônio Geral</span>
            </div>
            <div className="erm-kpi-val text-purple">{formatCurrency(kpiStats.totalAssetValue)}</div>
            <span className="erm-kpi-sub">ativo total em acervo</span>
          </div>

          <div className={`erm-kpi-card kpi-rented ${kpiStats.rentedUnits > 0 ? 'card-rented-highlight' : ''}`}>
            <div className="erm-kpi-top">
              <div className="erm-kpi-icon-wrap icon-cyan">
                <Clock size={15} />
              </div>
              <span className="erm-kpi-lbl">Em Locação</span>
            </div>
            <div className="erm-kpi-val text-cyan">{kpiStats.rentedUnits}</div>
            <span className="erm-kpi-sub">fora da sede</span>
          </div>

          {kpiStats.maintenanceUnits > 0 && (
            <div
              className="erm-kpi-card kpi-maintenance card-maint-highlight pointer-card"
              onClick={() => setSelectedCategory('maintenance')}
              title="Clique para filtrar apenas os equipamentos em manutenção técnica"
            >
              <div className="erm-kpi-top">
                <div className="erm-kpi-icon-wrap icon-amber">
                  <Wrench size={15} />
                </div>
                <span className="erm-kpi-lbl">Em Manutenção</span>
              </div>
              <div className="erm-kpi-val text-amber">{kpiStats.maintenanceUnits}</div>
              <span className="erm-kpi-sub">aguardando reparo</span>
            </div>
          )}

          <div className={`erm-kpi-card kpi-contracts ${kpiStats.overdueCount > 0 ? 'card-overdue-pulse' : ''}`}>
            <div className="erm-kpi-top">
              <div className={`erm-kpi-icon-wrap ${kpiStats.overdueCount > 0 ? 'icon-red' : 'icon-amber'}`}>
                <FileText size={15} />
              </div>
              <span className="erm-kpi-lbl">
                {kpiStats.overdueCount > 0 ? 'Atrasadas' : 'Locações Ativas'}
              </span>
            </div>
            <div className={`erm-kpi-val ${kpiStats.overdueCount > 0 ? 'text-red' : 'text-amber'}`}>
              {kpiStats.activeRentalsCount}
            </div>
            <span className="erm-kpi-sub">
              {kpiStats.overdueCount > 0 ? `🚨 ${kpiStats.overdueCount} em atraso` : 'contratos em curso'}
            </span>
          </div>

          <div
            className="erm-kpi-card kpi-revenue pointer-card"
            onClick={() => setActiveTab('rentals')}
            title="Clique para abrir o demonstrativo completo de receitas e prejuízos por período"
          >
            <div className="erm-kpi-top">
              <div className="erm-kpi-icon-wrap icon-emerald">
                <TrendingUp size={15} />
              </div>
              <span className="erm-kpi-lbl">Receita Total</span>
            </div>
            <div className="erm-kpi-val text-emerald">
              {formatCurrency(kpiStats.totalRevenueAllTime)}
            </div>
            <span className="erm-kpi-sub">
              {kpiStats.totalLossAllTime > 0
                ? `Líquido: ${formatCurrency(kpiStats.totalRevenueAllTime - kpiStats.totalLossAllTime)}`
                : 'obtido com locações'}
            </span>
          </div>

          <div
            className={`erm-kpi-card kpi-losses pointer-card ${kpiStats.totalLossAllTime > 0 ? 'card-overdue-pulse' : ''}`}
            onClick={() => setActiveTab('rentals')}
            title="Clique para ver o detalhamento de prejuízos e avarias por período"
          >
            <div className="erm-kpi-top">
              <div className="erm-kpi-icon-wrap icon-red">
                <TrendingDown size={15} />
              </div>
              <span className="erm-kpi-lbl">Prejuízos Total</span>
            </div>
            <div className={`erm-kpi-val ${kpiStats.totalLossAllTime > 0 ? 'text-red' : 'text-muted'}`}>
              {formatCurrency(kpiStats.totalLossAllTime)}
            </div>
            <span className="erm-kpi-sub">
              {financialAnalytics.allTime.damagedContractsCount > 0
                ? `${financialAnalytics.allTime.damagedContractsCount} ocorrência(s) de avaria`
                : 'sem avarias / perdas'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Barra de Navegação Interna do Módulo */}
      <div className="erm-tabs-bar">
        <div className="erm-tabs-group">
          <button
            type="button"
            className={`erm-tab-btn ${activeTab === 'catalog' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('catalog')}
          >
            <Package size={16} />
            <span>Estoque &amp; Catálogo</span>
            <span className="erm-tab-count">{equipmentList.length}</span>
          </button>

          <button
            type="button"
            className={`erm-tab-btn ${activeTab === 'new_rental' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('new_rental')}
          >
            <Plus size={16} />
            <span>Nova Locação</span>
            {cartItems.length > 0 && (
              <span className="erm-tab-count cart-badge">{cartItems.length}</span>
            )}
          </button>

          <button
            type="button"
            className={`erm-tab-btn ${activeTab === 'rentals' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('rentals')}
          >
            <FileText size={16} />
            <span>Locações &amp; Devoluções</span>
            {kpiStats.activeRentalsCount > 0 && (
              <span className={`erm-tab-count ${kpiStats.overdueCount > 0 ? 'badge-danger' : ''}`}>
                {kpiStats.activeRentalsCount}
              </span>
            )}
          </button>
        </div>

        <div className="erm-top-actions-right">
          {cartItems.length > 0 && (
            <button
              type="button"
              className="btn-cart-active-pulse"
              onClick={() => setActiveTab('new_rental')}
              title="Abrir cesta da locação e preencher dados do cliente"
            >
              <ShoppingCart size={17} className="cart-pulse-icon" />
              <div className="bcap-content">
                <span className="bcap-text">Locação saindo...</span>
                <span className="bcap-meta">
                  <strong>{cartItems.length} {cartItems.length === 1 ? 'item' : 'itens'}</strong> • {formatCurrency(cartTotalAmount)}
                </span>
              </div>
            </button>
          )}

          {activeTab === 'catalog' && (
            <button
              type="button"
              className="btn-primary erm-btn-add-equip"
              onClick={() => setIsNewEquipModalOpen(true)}
            >
              <Plus size={15} /> Novo Equipamento
            </button>
          )}
        </div>
      </div>

      {/* 3. CONTEÚDO DA ABA SELECIONADA */}
      <div className="erm-tab-content">
        {/* ================================================================== */}
        {/* ABA 1: CATÁLOGO & ESTOQUE                                          */}
        {/* ================================================================== */}
        {activeTab === 'catalog' && (
          <div className="erm-catalog-view">
            {/* Toolbar com Categorias e Busca */}
            <div className="erm-catalog-toolbar">
              <div className="erm-category-pills">
                {Object.entries(CATEGORY_LABELS).map(([catKey, catLabel]) => {
                  const count =
                    catKey === 'all'
                      ? equipmentList.length
                      : equipmentList.filter((e) => e.category === catKey).length;
                  return (
                    <button
                      key={catKey}
                      type="button"
                      className={`erm-cat-pill ${selectedCategory === catKey ? 'active' : ''}`}
                      onClick={() => setSelectedCategory(catKey)}
                    >
                      <span>{catLabel}</span>
                      <span className="erm-cat-badge">{count}</span>
                    </button>
                  );
                })}
                {kpiStats.maintenanceUnits > 0 && (
                  <button
                    type="button"
                    className={`erm-cat-pill pill-maint-tab ${selectedCategory === 'maintenance' ? 'active' : ''}`}
                    onClick={() => setSelectedCategory('maintenance')}
                  >
                    <span>🛠️ Em Manutenção</span>
                    <span className="erm-cat-badge badge-maint">{kpiStats.maintenanceUnits}</span>
                  </button>
                )}
              </div>

              <div className="erm-search-box">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Buscar equipamento, modelo ou número de série..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button type="button" className="clear-btn" onClick={() => setSearchTerm('')}>
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Painel Consolidado de Ativos & Patrimônio por Categoria */}
            {kpiStats.categoryPatrimony && Object.keys(kpiStats.categoryPatrimony).length > 0 && (
              <div className="erm-patrimony-dashboard-card">
                <div className="epdc-header">
                  <div className="epdc-title-group">
                    <Sparkles size={16} className="text-purple" />
                    <strong>Consolidação Patrimonial do Acervo</strong>
                    <span className="epdc-total-tag">
                      Montante Total: <strong>{formatCurrency(kpiStats.totalAssetValue)}</strong>
                    </span>
                  </div>
                  <small className="epdc-subtitle">
                    Valor total de reposição/mercado dos bens de propriedade da MegaFilmes
                  </small>
                </div>

                <div className="epdc-categories-grid">
                  {Object.entries(kpiStats.categoryPatrimony).map(([catKey, data]) => {
                    const label = CATEGORY_LABELS[catKey] || catKey;
                    const percent = kpiStats.totalAssetValue > 0
                      ? Math.round((data.totalValue / kpiStats.totalAssetValue) * 100)
                      : 0;
                    return (
                      <div key={catKey} className="epdc-cat-item">
                        <div className="epdc-cat-top">
                          <span className="epdc-cat-name">{label}</span>
                          <span className="epdc-cat-val">{formatCurrency(data.totalValue)}</span>
                        </div>
                        <div className="epdc-cat-meta">
                          <span>{data.itemsCount} itens • {data.units} un.</span>
                          <span className="text-muted">{percent}%</span>
                        </div>
                        <div className="epdc-cat-progress">
                          <div className="epdc-cat-bar" style={{ width: `${percent}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Grid de Equipamentos */}
            <div className="erm-equipment-grid">
              {filteredEquipment.length === 0 ? (
                <div className="erm-empty-state">
                  <Package size={40} className="text-muted" />
                  <h3>Nenhum equipamento encontrado</h3>
                  <p>Tente ajustar os filtros ou cadastrar um novo equipamento no acervo.</p>
                </div>
              ) : (
                filteredEquipment.map((equip) => {
                  const isFullyRented = equip.availableQty <= 0;
                  const isPartiallyRented = equip.availableQty < equip.totalQty && equip.availableQty > 0;

                  return (
                    <div
                      key={equip.id}
                      className={`erm-equip-card ${isFullyRented ? 'card-fully-rented' : isPartiallyRented ? 'card-partial-rented' : ''}`}
                    >
                      <div className="equip-card-top">
                        <span className="equip-cat-tag">
                          {CATEGORY_LABELS[equip.category] || equip.category}
                        </span>

                        <div className="equip-status-indicator">
                          {equip.maintenanceQty > 0 && equip.availableQty <= 0 ? (
                            <span className="status-pill pill-maintenance">
                              🛠️ {equip.maintenanceQty} em Manutenção
                            </span>
                          ) : isFullyRented ? (
                            <span className="status-pill pill-rented">
                              🔴 Alugado ({equip.totalQty}/{equip.totalQty})
                            </span>
                          ) : isPartiallyRented ? (
                            <span className="status-pill pill-partial">
                              🟡 {equip.availableQty} de {equip.totalQty} disp.
                            </span>
                          ) : (
                            <span className="status-pill pill-available">
                              🟢 {equip.availableQty} un. Disponível
                            </span>
                          )}
                          {equip.maintenanceQty > 0 && equip.availableQty > 0 && (
                            <span className="status-pill pill-maintenance-mini" title={`${equip.maintenanceQty} un. em manutenção técnica`}>
                              🛠️ {equip.maintenanceQty} em reparo
                            </span>
                          )}
                        </div>
                      </div>

                      {equip.photoUrl && (
                        <div
                          className="equip-card-thumb"
                          onClick={() => setSelectedDetailEquipment(equip)}
                          title="Clique para ver detalhes"
                        >
                          <img
                            src={getEquipPhotoUrl(equip.photoUrl, equip.id, equip.photoBackup)}
                            alt={equip.name}
                            onError={(e) => handleRentalPhotoError(e, equip.photoUrl, equip.id, equip.photoBackup)}
                          />
                        </div>
                      )}

                      <h3
                        className="equip-name pointer-title"
                        onClick={() => setSelectedDetailEquipment(equip)}
                        title="Ver detalhes do equipamento"
                      >
                        {equip.name}
                      </h3>
                      {equip.description && <p className="equip-desc">{equip.description}</p>}
                      {equip.serialNumber && (
                        <div className="equip-serial">
                          <small>Nº Série / Tag: {equip.serialNumber}</small>
                        </div>
                      )}

                      <div className="equip-pricing-bar">
                        <div className="equip-price">
                          <span className="price-val">{formatCurrency(equip.dailyRate)}</span>
                          <span className="price-unit">/{equip.rateUnit || 'diária'}</span>
                        </div>

                        <div className="equip-stock-info">
                          <span>Total: <strong>{equip.totalQty} un.</strong></span>
                        </div>
                      </div>

                      <div className="equip-asset-badge-bar">
                        <span className="equip-asset-pill" title="Valor do Bem / Custo de Reposição">
                          🛡️ Bem: {formatCurrency(equip.assetValue || (equip.dailyRate * 25))}
                        </span>
                        {equip.missionAllocations && equip.missionAllocations.length > 0 && (
                          <span className="equip-in-mission-pill" title={`Alocado na Missão ${equip.missionAllocations[0].missionCode}`}>
                            🎬 Em Missão ({equip.missionAllocations[0].collaboratorName})
                          </span>
                        )}
                      </div>

                      <div className="equip-card-actions">
                        <button
                          type="button"
                          className="btn-secondary btn-sm btn-detail-action"
                          onClick={() => setSelectedDetailEquipment(equip)}
                          title="Ver Ficha Completa e Detalhes do Equipamento"
                        >
                          <Eye size={13} /> Detalhes
                        </button>

                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          onClick={() => setEditingEquipment(equip)}
                          title="Alterar valor, quantidade ou informações"
                        >
                          <Edit2 size={13} /> Editar
                        </button>

                        <button
                          type="button"
                          className="btn-primary btn-sm btn-rent-action"
                          disabled={isFullyRented || equip.availableQty <= 0}
                          onClick={() => {
                            handleAddToCart(equip);
                            setActiveTab('new_rental');
                          }}
                          title={equip.availableQty <= 0 ? 'Nenhuma unidade disponível no momento (em locação ou manutenção)' : 'Adicionar à nova locação'}
                        >
                          <Plus size={14} /> Alugar
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* ABA 2: NOVA LOCAÇÃO (FORMULÁRIO & SELEÇÃO DE EQUIPAMENTOS)        */}
        {/* ================================================================== */}
        {activeTab === 'new_rental' && (
          <div className="erm-new-rental-view">
            <form onSubmit={handleCreateRental} className="rental-flow-layout">
              {/* Coluna Esquerda: Dados do Cliente & Prazos */}
              <div className="rental-form-pane">
                <div className="pane-section-header">
                  <div className="pane-section-step">1</div>
                  <div className="pane-section-title-box">
                    <h2>Dados do Locatário / Cliente</h2>
                    <span className="pane-section-sub">Informações cadastrais e contato oficial para emissão do contrato</span>
                  </div>
                </div>

                <div className="form-group-grid">
                  <div className="form-group span-2">
                    <label>
                      <User size={13} className="text-gold" />
                      <span>Nome Completo do Cliente / Empresa *</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: João da Silva / Produtora Aurora Ltda"
                      value={rentalForm.clientName}
                      onChange={(e) => setRentalForm({ ...rentalForm, clientName: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      <ShieldCheck size={13} className="text-gold" />
                      <span>CPF ou CNPJ *</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="000.000.000-00 ou 00.000.000/0000-00"
                      maxLength={18}
                      value={rentalForm.clientDocument}
                      onChange={(e) =>
                        setRentalForm({
                          ...rentalForm,
                          clientDocument: formatCpfCnpj(e.target.value),
                        })
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      <Phone size={13} className="text-gold" />
                      <span>Telefone / WhatsApp *</span>
                    </label>
                    <input
                      type="text"
                      placeholder="(95) 99111-2233"
                      maxLength={15}
                      value={rentalForm.clientPhone}
                      onChange={(e) =>
                        setRentalForm({
                          ...rentalForm,
                          clientPhone: formatPhoneBR(e.target.value),
                        })
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      <Mail size={13} className="text-gold" />
                      <span>E-mail do Cliente</span>
                    </label>
                    <input
                      type="email"
                      placeholder="cliente@produtora.com.br"
                      value={rentalForm.clientEmail}
                      onChange={(e) => setRentalForm({ ...rentalForm, clientEmail: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      <MapPin size={13} className="text-gold" />
                      <span>Endereço / Cidade</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Rua, Bairro, Cidade - UF"
                      value={rentalForm.clientAddress}
                      onChange={(e) => setRentalForm({ ...rentalForm, clientAddress: e.target.value })}
                    />
                  </div>
                </div>

                <div className="pane-section-header" style={{ marginTop: '28px' }}>
                  <div className="pane-section-step">2</div>
                  <div className="pane-section-title-box">
                    <h2>Período da Locação &amp; Prazos</h2>
                    <span className="pane-section-sub">Cronograma de retirada e devolução para apuração de diárias</span>
                  </div>
                </div>

                <div className="form-group-grid">
                  <div className="form-group">
                    <label>
                      <Calendar size={13} className="text-gold" />
                      <span>Data de Retirada *</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={rentalForm.startDate}
                      onChange={(e) => setRentalForm({ ...rentalForm, startDate: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      <Clock size={13} className="text-gold" />
                      <span>Horário de Retirada</span>
                    </label>
                    <input
                      type="time"
                      value={rentalForm.startTime}
                      onChange={(e) => setRentalForm({ ...rentalForm, startTime: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      <Calendar size={13} className="text-gold" />
                      <span>Data Limite de Devolução *</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={rentalForm.endDate}
                      onChange={(e) => setRentalForm({ ...rentalForm, endDate: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      <Clock size={13} className="text-gold" />
                      <span>Horário Limite de Devolução</span>
                    </label>
                    <input
                      type="time"
                      value={rentalForm.endTime}
                      onChange={(e) => setRentalForm({ ...rentalForm, endTime: e.target.value })}
                    />
                  </div>
                </div>

                <div className="rental-duration-banner">
                  <div className="rdb-left">
                    <Clock size={16} className="text-gold" />
                    <span>Duração Total Estimada:</span>
                  </div>
                  <div className="rdb-badge">
                    {rentalDays} {rentalDays === 1 ? 'diária' : 'diárias'}
                  </div>
                </div>

                <div className="pane-section-header" style={{ marginTop: '28px' }}>
                  <div className="pane-section-step">3</div>
                  <div className="pane-section-title-box">
                    <h2>Pagamento &amp; Observações</h2>
                    <span className="pane-section-sub">Condições comerciais, forma de quitação e caução retido</span>
                  </div>
                </div>

                <div className="form-group-grid">
                  <div className="form-group">
                    <label>
                      <DollarSign size={13} className="text-gold" />
                      <span>Forma de Pagamento</span>
                    </label>
                    <select
                      value={rentalForm.paymentMethod}
                      onChange={(e) => setRentalForm({ ...rentalForm, paymentMethod: e.target.value })}
                    >
                      <option value="PIX">PIX (À Vista)</option>
                      <option value="Cartão de Crédito">Cartão de Crédito</option>
                      <option value="Cartão de Débito">Cartão de Débito</option>
                      <option value="Dinheiro">Dinheiro em Espécie</option>
                      <option value="Transferência / DOC">Transferência Bancária</option>
                      <option value="Faturado / Boleto">Faturado / Boleto Bancário</option>
                    </select>
                  </div>

                  <div className="form-group span-2">
                    <label>
                      <Layers size={13} className="text-gold" />
                      <span>Status do Pagamento</span>
                    </label>
                    <select
                      value={rentalForm.paymentStatus}
                      onChange={(e) => setRentalForm({ ...rentalForm, paymentStatus: e.target.value })}
                    >
                      <option value="Pendente">Pendente (Não Pago / A Faturar)</option>
                      <option value="Pago">Pago (Quitado Total)</option>
                      <option value="Caução Recebido">Caução / Parcial (Sinal de Entrada + Saldo)</option>
                    </select>

                    {rentalForm.paymentStatus === 'Pendente' && (
                      <div className="payment-status-alert alert-pending">
                        <Calendar size={16} />
                        <span>
                          <strong>Pagamento não realizado:</strong> Você pode <u>Agendar / Reservar</u> para assegurar os equipamentos bloqueados para a data desejada, ou iniciar a locação imediatamente.
                        </span>
                      </div>
                    )}

                    {rentalForm.paymentStatus === 'Pago' && (
                      <div className="payment-status-alert alert-paid">
                        <CheckCircle2 size={16} />
                        <span>
                          <strong>Pagamento confirmado:</strong> O termo oficial de locação será emitido com quitação integral registrada no comprovante.
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Detalhamento Dinâmico de Pagamento Parcial & Caução */}
                  {rentalForm.paymentStatus === 'Caução Recebido' && (() => {
                    const remainingBalance = Math.max(
                      0,
                      cartTotalAmount - (parseFloat(rentalForm.paidAmount) || 0)
                    );
                    const isFullySettled = remainingBalance === 0;

                    return (
                      <div className="partial-payment-card span-2">
                        <div className="ppc-header">
                          <div className="ppc-icon-badge">
                            <DollarSign size={20} />
                          </div>
                          <div className="ppc-title-box">
                            <strong>Detalhamento de Pagamento Parcial &amp; Caução</strong>
                            <p>
                              Especifique o valor pago de entrada, o saldo que falta, o prazo de quitação e o valor do caução de garantia se exigido.
                            </p>
                          </div>
                        </div>

                        <div className="ppc-grid">
                          <div className="form-group">
                            <label>Valor Pago / Entrada (R$) *</label>
                            <div className="input-with-affix">
                              <span className="input-affix">R$</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                max={cartTotalAmount}
                                placeholder="0,00"
                                value={rentalForm.paidAmount}
                                onChange={(e) =>
                                  setRentalForm({ ...rentalForm, paidAmount: e.target.value })
                                }
                              />
                            </div>
                            <small className="form-tip">Valor recebido de entrada do cliente.</small>
                          </div>

                          <div className="form-group">
                            <label>Saldo Faltante a Pagar</label>
                            <div className={`ppc-remaining-box ${isFullySettled ? 'is-settled' : 'is-pending'}`}>
                              <div className="ppc-remaining-info">
                                <span className="ppc-remaining-val">
                                  {formatCurrency(remainingBalance)}
                                </span>
                                <span className="ppc-remaining-tag">
                                  {isFullySettled ? 'Quitado' : 'A Receber'}
                                </span>
                              </div>
                            </div>
                            <small className="form-tip">Calculado automaticamente (Total - Pago).</small>
                          </div>

                          <div className="form-group">
                            <label>Prazo para Quitar o Valor Faltante *</label>
                            <select
                              value={rentalForm.remainingDueTerms}
                              onChange={(e) =>
                                setRentalForm({
                                  ...rentalForm,
                                  remainingDueTerms: e.target.value,
                                })
                              }
                            >
                              <option value="Na Devolução dos Equipamentos">Na Devolução dos Equipamentos</option>
                              <option value="Na Retirada dos Equipamentos">Na Retirada dos Equipamentos</option>
                              <option value="Em até 7 dias">Em até 7 dias</option>
                              <option value="Em até 15 dias">Em até 15 dias</option>
                              <option value="Em até 30 dias">Em até 30 dias</option>
                              <option value="Data Específica">Data Específica</option>
                            </select>
                            <small className="form-tip">Condição acordada para quitação do restante.</small>
                          </div>

                          {rentalForm.remainingDueTerms === 'Data Específica' && (
                            <div className="form-group">
                              <label>Data Limite para Quitação *</label>
                              <input
                                type="date"
                                value={rentalForm.remainingDueDate}
                                onChange={(e) =>
                                  setRentalForm({
                                    ...rentalForm,
                                    remainingDueDate: e.target.value,
                                  })
                                }
                              />
                              <small className="form-tip">Data máxima estipulada em contrato.</small>
                            </div>
                          )}

                          <div className="form-group">
                            <label>Valor do Caução de Garantia (R$)</label>
                            <div className="input-with-affix">
                              <span className="input-affix">R$</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0,00"
                                value={rentalForm.securityDeposit}
                                onChange={(e) =>
                                  setRentalForm({
                                    ...rentalForm,
                                    securityDeposit: e.target.value,
                                  })
                                }
                              />
                            </div>
                            <small className="form-tip">
                              Depósito retido em garantia (restituído após devolução sem avarias).
                            </small>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Campo de Caução de Garantia se for Pago ou Pendente */}
                  {rentalForm.paymentStatus !== 'Caução Recebido' && (
                    <div className="form-group">
                      <label>Caução de Garantia (R$) (Opcional)</label>
                      <div className="input-with-affix">
                        <span className="input-affix">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0,00"
                          value={rentalForm.securityDeposit}
                          onChange={(e) => setRentalForm({ ...rentalForm, securityDeposit: e.target.value })}
                        />
                      </div>
                      <small className="form-tip">Caso a locação exija depósito em garantia.</small>
                    </div>
                  )}

                  <div className="form-group">
                    <label>Desconto Concedido (R$)</label>
                    <div className="input-with-affix">
                      <span className="input-affix">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0,00"
                        value={rentalForm.discount}
                        onChange={(e) => setRentalForm({ ...rentalForm, discount: e.target.value })}
                      />
                    </div>
                    <small className="form-tip">Abatimento aplicado sobre o subtotal.</small>
                  </div>

                  {/* Anexo de Comprovante de Pagamento (Foto ou PDF) */}
                  <div className="form-group span-2">
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>Comprovante de Pagamento (Foto ou PDF)</span>
                      {rentalForm.paymentReceiptUrl && (
                        <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>
                          ✓ Comprovante Anexado
                        </span>
                      )}
                    </label>

                    {rentalForm.paymentReceiptUrl ? (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        background: 'rgba(16, 185, 129, 0.08)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: 8,
                        gap: 12
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <CheckCircle2 size={18} className="text-emerald" style={{ flexShrink: 0 }} />
                          <span style={{ fontSize: '0.85rem', color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {rentalForm.paymentReceiptName || 'Comprovante anexado'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                            onClick={() => setViewingReceipt({ url: rentalForm.paymentReceiptUrl, code: 'NOVA-LOCACAO', client: rentalForm.clientName || 'Cliente' })}
                          >
                            <Eye size={13} /> Ver
                          </button>
                          <button
                            type="button"
                            className="btn-danger-outline btn-sm"
                            style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                            onClick={() => setRentalForm({ ...rentalForm, paymentReceiptUrl: '', paymentReceiptName: '' })}
                          >
                            <X size={13} /> Remover
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 14px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px dashed rgba(255, 255, 255, 0.2)',
                        borderRadius: 8,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}>
                        <Upload size={18} className="text-gold" />
                        <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                          📷 Anexar Foto do Recibo/PIX ou 📄 Arquivo PDF
                        </span>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          style={{ display: 'none' }}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                const res = await handleReceiptFileRead(file);
                                if (res) {
                                  setRentalForm((prev) => ({
                                    ...prev,
                                    paymentReceiptUrl: res.dataUrl,
                                    paymentReceiptName: res.name,
                                    paymentStatus: prev.paymentStatus === 'Pendente' ? 'Pago' : prev.paymentStatus,
                                  }));
                                }
                              } catch (err) {
                                console.error('Erro ao processar comprovante:', err);
                                alertDialog({
                                  title: 'Erro no arquivo',
                                  message: 'Não foi possível ler o arquivo selecionado.',
                                  variant: 'warning',
                                });
                              }
                            }
                          }}
                        />
                      </label>
                    )}
                    <small className="form-tip">
                      O comprovante será armazenado com segurança e vinculado ao termo oficial para consulta e validação.
                    </small>
                  </div>

                  <div className="form-group span-2">
                    <label>Observações / Acessórios Adicionais</label>
                    <input
                      type="text"
                      placeholder="Ex: Acompanha 2 baterias extras, cabos HDMI e case rígido..."
                      value={rentalForm.notes}
                      onChange={(e) => setRentalForm({ ...rentalForm, notes: e.target.value })}
                    />
                    <small className="form-tip">Itens extras inclusos ou instruções especiais.</small>
                  </div>
                </div>
              </div>

              {/* Coluna Direita: Seleção de Equipamentos & Carrinho */}
              <div className="rental-cart-pane">
                <div className="cart-header">
                  <div className="cart-title">
                    <div className="cart-icon-badge">
                      <Package size={18} />
                    </div>
                    <div>
                      <h2>Equipamentos Selecionados</h2>
                      <span className="cart-count-pill">
                        {cartItems.length} {cartItems.length === 1 ? 'item' : 'itens'} no pedido
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-explore-catalog"
                    onClick={() => setActiveTab('catalog')}
                  >
                    <Plus size={14} /> Explorar Catálogo
                  </button>
                </div>

                {cartItems.length === 0 ? (
                  <div className="cart-empty-box">
                    <div className="ce-icon-circle">
                      <Package size={36} className="text-muted" />
                    </div>
                    <p>Nenhum equipamento adicionado ainda</p>
                    <small>Escolha os equipamentos no catálogo ou adicione rapidamente abaixo.</small>
                  </div>
                ) : (
                  <div className="cart-items-list">
                    {cartItems.map((item) => (
                      <div key={item.equipmentId} className="cart-item-row">
                        <div className="cir-thumb">
                          {item.photoUrl ? (
                            <img
                              src={getEquipPhotoUrl(item.photoUrl, item.equipmentId, item.photoBackup)}
                              alt={item.name}
                              onError={(e) => handleRentalPhotoError(e, item.photoUrl, item.equipmentId, item.photoBackup)}
                            />
                          ) : (
                            <Package size={18} className="text-muted" />
                          )}
                        </div>

                        <div className="cir-info">
                          <strong className="cir-name">{item.name}</strong>
                          <span className="cir-meta">
                            <span className="cir-cat-badge">
                              {CATEGORY_LABELS[item.category] || item.category}
                            </span>
                            <span className="cir-rate">
                              {formatCurrency(item.dailyRate)}/{item.rateUnit || 'dia'}
                            </span>
                          </span>
                        </div>

                        <div className="cir-controls">
                          <button
                            type="button"
                            className="cir-btn-qty"
                            onClick={() => handleUpdateCartQuantity(item.equipmentId, -1)}
                            title="Diminuir quantidade"
                          >
                            -
                          </button>
                          <span className="cir-qty">{item.quantity}</span>
                          <button
                            type="button"
                            className="cir-btn-qty"
                            onClick={() => handleUpdateCartQuantity(item.equipmentId, 1)}
                            title="Aumentar quantidade"
                          >
                            +
                          </button>
                        </div>

                        <div className="cir-subtotal">
                          {formatCurrency(item.dailyRate * item.quantity * rentalDays)}
                        </div>

                        <button
                          type="button"
                          className="cir-remove-btn"
                          onClick={() => handleRemoveFromCart(item.equipmentId)}
                          title="Remover do carrinho"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Seleção Rápida de Adição de Itens */}
                <div className="quick-add-section">
                  <label>
                    <Plus size={13} className="text-gold" />
                    <span>Adicionar Rápido do Estoque:</span>
                  </label>
                  <select
                    onChange={(e) => {
                      const id = e.target.value;
                      if (!id) return;
                      const eq = equipmentList.find((x) => x.id === id);
                      if (eq) handleAddToCart(eq);
                      e.target.value = '';
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>
                      -- Selecione um equipamento disponível no acervo --
                    </option>
                    {equipmentList
                      .filter((e) => e.availableQty > 0)
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name} ({formatCurrency(e.dailyRate)}/dia) — {e.availableQty} disp.
                        </option>
                      ))}
                  </select>
                </div>

                {/* Resumo Financeiro & Botão de Criação */}
                <div className="cart-summary-box">
                  <div className="cs-header-title">
                    <FileText size={16} className="text-gold" />
                    <span>Resumo Financeiro da Locação</span>
                  </div>

                  <div className="cs-row">
                    <span>Subtotal ({rentalDays} {rentalDays === 1 ? 'diária' : 'diárias'}):</span>
                    <span className="cs-val">{formatCurrency(cartSubtotal)}</span>
                  </div>

                  {Number(rentalForm.discount) > 0 && (
                    <div className="cs-row discount">
                      <span>Desconto Especial Concedido:</span>
                      <span className="cs-val">- {formatCurrency(rentalForm.discount)}</span>
                    </div>
                  )}

                  {Number(rentalForm.securityDeposit) > 0 && (
                    <div className="cs-row cs-deposit">
                      <span>Caução Retido em Garantia:</span>
                      <span className="cs-val">{formatCurrency(rentalForm.securityDeposit)}</span>
                    </div>
                  )}

                  <div className="cs-row cs-total">
                    <span>VALOR TOTAL:</span>
                    <span className="cs-total-val">{formatCurrency(cartTotalAmount)}</span>
                  </div>

                  {rentalForm.startDate > new Date().toISOString().split('T')[0] ? (
                    <div className="reservation-action-group">
                      <button
                        type="button"
                        className="btn-primary btn-reserve-contract"
                        disabled={cartItems.length === 0}
                        onClick={(e) => handleCreateRental(e, 'reserved')}
                      >
                        <Calendar size={17} />
                        <span>Agendar / Reservar Equipamentos</span>
                      </button>
                      <p className="cs-future-note" style={{ fontSize: '0.74rem', color: '#fbbf24', textAlign: 'center', margin: '4px 0 0 0' }}>
                        📅 Data de retirada futura ({formatDateBR(rentalForm.startDate)}). O item fica agendado e só sai do estoque físico no dia da entrega.
                      </p>
                    </div>
                  ) : rentalForm.paymentStatus !== 'Pago' ? (
                    <div className="reservation-action-group">
                      <button
                        type="button"
                        className="btn-primary btn-reserve-contract"
                        disabled={cartItems.length === 0}
                        onClick={(e) => handleCreateRental(e, 'reserved')}
                      >
                        <Calendar size={17} />
                        <span>Agendar / Reservar Equipamentos</span>
                      </button>
                      <button
                        type="button"
                        className="btn-secondary btn-direct-rental"
                        disabled={cartItems.length === 0}
                        onClick={(e) => handleCreateRental(e, 'active')}
                        title="Inicia a locação imediatamente mesmo com pagamento pendente"
                      >
                        <Zap size={15} />
                        <span>Iniciar Locação Imediata (Pendente)</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="submit"
                      className="btn-primary btn-generate-contract"
                      disabled={cartItems.length === 0}
                      onClick={(e) => handleCreateRental(e, 'active')}
                    >
                      <FileText size={18} />
                      <span>Entregar no Balcão &amp; Emitir Termo</span>
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        )}

        {/* ================================================================== */}
        {/* ABA 3: LOCAÇÕES ATIVAS, ALERTAS & CHECK-IN                         */}
        {/* ================================================================== */}
        {activeTab === 'rentals' && (
          <div className="erm-rentals-view">
            {/* ============================================================== */}
            {/* PAINEL FINANCEIRO DE ALUGUÉIS & PREJUÍZOS (TOTAL E POR PERÍODO) */}
            {/* ============================================================== */}
            <div className="erm-financial-dashboard">
              <div className="efd-header">
                <div className="efd-title-block">
                  <div className="efd-badge">
                    <DollarSign size={13} />
                    <span>Balanço Financeiro de Aluguéis &amp; Prejuízos</span>
                  </div>
                  <h3>
                    Valores Obtidos &amp; Prejuízos — <span className="text-gold">{financialAnalytics.periodLabel}</span>
                  </h3>
                  <p>
                    Acompanhe o faturamento obtido com as locações, valores recebidos em caixa, saldo a receber e eventuais prejuízos ou avarias por período e no acumulado total.
                  </p>
                </div>

                <div className="efd-top-actions">
                  <button
                    type="button"
                    className="btn-secondary btn-sm efd-btn-register-loss"
                    onClick={() => handleOpenFinancialModal()}
                    title="Registrar ou editar prejuízo, avaria ou baixa financeira em uma locação"
                  >
                    <AlertTriangle size={14} className="text-red" />
                    <span>💸 Lançar / Editar Prejuízo ou Avaria</span>
                  </button>
                </div>
              </div>

              {/* Barra de Filtro de Período */}
              <div className="efd-period-bar">
                <div className="efd-period-pills">
                  <button
                    type="button"
                    className={`efd-period-pill ${financialPeriodType === 'all' ? 'active' : ''}`}
                    onClick={() => setFinancialPeriodType('all')}
                  >
                    Todo o Período (Total)
                  </button>
                  <button
                    type="button"
                    className={`efd-period-pill ${financialPeriodType === 'month' ? 'active' : ''}`}
                    onClick={() => setFinancialPeriodType('month')}
                  >
                    📅 Por Mês
                  </button>
                  <button
                    type="button"
                    className={`efd-period-pill ${financialPeriodType === 'last_30' ? 'active' : ''}`}
                    onClick={() => setFinancialPeriodType('last_30')}
                  >
                    ⏱️ Últimos 30 Dias
                  </button>
                  <button
                    type="button"
                    className={`efd-period-pill ${financialPeriodType === 'year' ? 'active' : ''}`}
                    onClick={() => setFinancialPeriodType('year')}
                  >
                    🗓️ Por Ano
                  </button>
                  <button
                    type="button"
                    className={`efd-period-pill ${financialPeriodType === 'custom' ? 'active' : ''}`}
                    onClick={() => setFinancialPeriodType('custom')}
                  >
                    🔍 Período Personalizado
                  </button>
                </div>

                {/* Seletores dinâmicos conforme o tipo de período */}
                <div className="efd-period-controls">
                  {financialPeriodType === 'month' && (
                    <div className="efd-month-stepper">
                      <button
                        type="button"
                        className="efd-step-btn"
                        onClick={() => handleChangeFinancialMonth(-1)}
                        title="Mês anterior"
                      >
                        <ChevronLeft size={15} />
                      </button>
                      <input
                        type="month"
                        value={selectedFinancialMonth}
                        onChange={(e) => setSelectedFinancialMonth(e.target.value)}
                        className="efd-month-input"
                      />
                      <span className="efd-month-label">{formatMonthLabelPT(selectedFinancialMonth)}</span>
                      <button
                        type="button"
                        className="efd-step-btn"
                        onClick={() => handleChangeFinancialMonth(1)}
                        title="Próximo mês"
                      >
                        <ChevronRight size={15} />
                      </button>
                    </div>
                  )}

                  {financialPeriodType === 'year' && (
                    <div className="efd-year-selector">
                      <select
                        value={selectedFinancialYear}
                        onChange={(e) => setSelectedFinancialYear(e.target.value)}
                        className="efd-select"
                      >
                        {['2024', '2025', '2026', '2027', '2028'].map((yr) => (
                          <option key={yr} value={yr}>Ano de {yr}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {financialPeriodType === 'custom' && (
                    <div className="efd-custom-dates">
                      <div className="efd-date-field">
                        <span>De:</span>
                        <input
                          type="date"
                          value={customDateStart}
                          onChange={(e) => setCustomDateStart(e.target.value)}
                        />
                      </div>
                      <div className="efd-date-field">
                        <span>Até:</span>
                        <input
                          type="date"
                          value={customDateEnd}
                          onChange={(e) => setCustomDateEnd(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  <div className="efd-criterion-group">
                    <select
                      value={financialDateMode}
                      onChange={(e) => setFinancialDateMode(e.target.value)}
                      className="efd-select efd-select-sm"
                      title="Critério de data para apuração do período"
                    >
                      <option value="rental_or_created">Critério: Contrato ou Execução</option>
                      <option value="start_date">Critério: Data da Locação</option>
                      <option value="created_at">Critério: Data da Emissão / Caixa</option>
                    </select>

                    {financialPeriodType !== 'all' && (
                      <label className="efd-filter-list-toggle" title="Filtrar também a listagem de contratos abaixo pelo período selecionado">
                        <input
                          type="checkbox"
                          checked={filterRentalsListByPeriod}
                          onChange={(e) => setFilterRentalsListByPeriod(e.target.checked)}
                        />
                        <span>Filtrar lista abaixo</span>
                      </label>
                    )}
                  </div>
                </div>
              </div>

              {/* 4 Cards Principais: No Período Selecionado vs. Total Geral Acumulado */}
              <div className="efd-cards-grid">
                {/* CARD 1: VALORES OBTIDOS COM ALUGUÉIS */}
                <div className="efd-metric-card card-revenue">
                  <div className="emc-top">
                    <span className="emc-label">Valores Obtidos (No Período)</span>
                    <div className="emc-icon icon-emerald">
                      <TrendingUp size={16} />
                    </div>
                  </div>
                  <div className="emc-main-val text-emerald">
                    {formatCurrency(financialAnalytics.period.grossRevenue)}
                  </div>
                  <div className="emc-breakdown">
                    <div className="emc-br-row">
                      <span>✅ Recebido / Quitado:</span>
                      <strong className="text-emerald">{formatCurrency(financialAnalytics.period.receivedRevenue)}</strong>
                    </div>
                    <div className="emc-br-row">
                      <span>⏳ Pendente a Receber:</span>
                      <strong className="text-amber">{formatCurrency(financialAnalytics.period.pendingRevenue)}</strong>
                    </div>
                    <div className="emc-br-row">
                      <span>📋 Contratos no Período:</span>
                      <strong>{financialAnalytics.period.totalContracts} locação(ões)</strong>
                    </div>
                  </div>
                  <div className="emc-total-footer">
                    <span>Total Geral Obtido (Acumulado):</span>
                    <strong className="text-emerald">{formatCurrency(financialAnalytics.allTime.grossRevenue)}</strong>
                  </div>
                </div>

                {/* CARD 2: PREJUÍZOS, AVARIAS & PERDAS */}
                <div className="efd-metric-card card-losses">
                  <div className="emc-top">
                    <span className="emc-label">Prejuízos &amp; Avarias (No Período)</span>
                    <div className="emc-icon icon-red">
                      <TrendingDown size={16} />
                    </div>
                  </div>
                  <div className={`emc-main-val ${financialAnalytics.period.damageLosses > 0 ? 'text-red' : 'text-muted'}`}>
                    {formatCurrency(financialAnalytics.period.damageLosses)}
                  </div>
                  <div className="emc-breakdown">
                    <div className="emc-br-row">
                      <span>🛠️ Ocorrências de Avaria:</span>
                      <strong className={financialAnalytics.period.damagedContractsCount > 0 ? 'text-red' : ''}>
                        {financialAnalytics.period.damagedContractsCount} registro(s)
                      </strong>
                    </div>
                    <div className="emc-br-row">
                      <span>❌ Locações Canceladas:</span>
                      <strong>
                        {financialAnalytics.period.cancelledCount} ({formatCurrency(financialAnalytics.period.cancelledAmount)})
                      </strong>
                    </div>
                    <div className="emc-br-row">
                      <span>🔧 Ativos em Manutenção:</span>
                      <strong className="text-amber">
                        {kpiStats.maintenanceUnits} un. ({formatCurrency(financialAnalytics.allTime.maintenanceAssetExposure)})
                      </strong>
                    </div>
                  </div>
                  <div className="emc-total-footer footer-danger">
                    <span>Prejuízo Total Acumulado:</span>
                    <strong className="text-red">{formatCurrency(financialAnalytics.allTime.damageLosses)}</strong>
                  </div>
                </div>

                {/* CARD 3: SALDO LÍQUIDO (VALORES OBTIDOS - PREJUÍZOS) */}
                <div className="efd-metric-card card-net">
                  <div className="emc-top">
                    <span className="emc-label">Resultado Líquido (No Período)</span>
                    <div className="emc-icon icon-gold">
                      <DollarSign size={16} />
                    </div>
                  </div>
                  <div className={`emc-main-val ${financialAnalytics.period.netContracted >= 0 ? 'text-gold' : 'text-red'}`}>
                    {formatCurrency(financialAnalytics.period.netContracted)}
                  </div>
                  <div className="emc-breakdown">
                    <div className="emc-br-row">
                      <span>💵 Caixa Líquido Realizado:</span>
                      <strong className={financialAnalytics.period.netCash >= 0 ? 'text-emerald' : 'text-red'}>
                        {formatCurrency(financialAnalytics.period.netCash)}
                      </strong>
                    </div>
                    <div className="emc-br-row">
                      <span>📈 Aproveitamento Líquido:</span>
                      <strong>
                        {financialAnalytics.period.grossRevenue > 0
                          ? `${Math.max(0, Math.round((financialAnalytics.period.netContracted / financialAnalytics.period.grossRevenue) * 100))}%`
                          : '100%'}
                      </strong>
                    </div>
                    <div className="emc-br-row">
                      <span>🛡️ Cauções Retidas:</span>
                      <strong className="text-cyan">
                        {formatCurrency(
                          rentalsList
                            .filter(matchesSelectedPeriod)
                            .reduce((acc, r) => acc + (Number(r.securityDeposit) || 0), 0)
                        )}
                      </strong>
                    </div>
                  </div>
                  <div className="emc-total-footer footer-gold">
                    <span>Saldo Líquido Total Geral:</span>
                    <strong className="text-gold">{formatCurrency(financialAnalytics.allTime.netContracted)}</strong>
                  </div>
                </div>

                {/* CARD 4: CONSOLIDAÇÃO GERAL (TOTAL HISTÓRICO COMPLETO) */}
                <div className="efd-metric-card card-alltime-summary">
                  <div className="emc-top">
                    <span className="emc-label">Resumo Total Acumulado</span>
                    <div className="emc-icon icon-purple">
                      <Sparkles size={16} />
                    </div>
                  </div>
                  <div className="emc-alltime-rows">
                    <div className="ear-item item-green">
                      <span>Total Obtido (Bruto):</span>
                      <strong>{formatCurrency(financialAnalytics.allTime.grossRevenue)}</strong>
                    </div>
                    <div className="ear-item item-cyan">
                      <span>Total Já Recebido (Caixa):</span>
                      <strong>{formatCurrency(financialAnalytics.allTime.receivedRevenue)}</strong>
                    </div>
                    <div className="ear-item item-amber">
                      <span>Total A Receber:</span>
                      <strong>{formatCurrency(financialAnalytics.allTime.pendingRevenue)}</strong>
                    </div>
                    <div className="ear-item item-red">
                      <span>Total de Prejuízos:</span>
                      <strong>{formatCurrency(financialAnalytics.allTime.damageLosses)}</strong>
                    </div>
                    <div className="ear-item item-net">
                      <span>Lucro Líquido Total:</span>
                      <strong>{formatCurrency(financialAnalytics.allTime.netContracted)}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quadro Demonstrativo por Período (Mês a Mês + Total Geral) */}
              {financialAnalytics.byMonth.length > 0 && (
                <div className="efd-periods-table-wrap">
                  <div className="ept-header">
                    <div className="ept-title">
                      <Calendar size={14} className="text-gold" />
                      <strong>Demonstrativo de Valores Obtidos &amp; Prejuízos por Período (Mês a Mês e Total)</strong>
                    </div>
                    <small className="text-muted">Clique em qualquer período abaixo para filtrar os indicadores</small>
                  </div>
                  <div className="ept-table-scroll">
                    <table className="ept-table">
                      <thead>
                        <tr>
                          <th>Período</th>
                          <th>Contratos</th>
                          <th>Valores Obtidos (Bruto)</th>
                          <th>Recebido em Caixa</th>
                          <th>A Receber</th>
                          <th>Prejuízos / Avarias</th>
                          <th>Saldo Líquido</th>
                        </tr>
                      </thead>
                      <tbody>
                        {financialAnalytics.byMonth.map((mRow) => {
                          const isSelectedMonth =
                            financialPeriodType === 'month' && selectedFinancialMonth === mRow.ym;
                          return (
                            <tr
                              key={mRow.ym}
                              className={`ept-row ${isSelectedMonth ? 'row-selected' : ''}`}
                              onClick={() => {
                                setSelectedFinancialMonth(mRow.ym);
                                setFinancialPeriodType('month');
                              }}
                              title={`Clique para focar em ${mRow.label}`}
                            >
                              <td>
                                <span className="ept-period-name">{mRow.label}</span>
                                {isSelectedMonth && <span className="ept-active-tag">Selecionado</span>}
                              </td>
                              <td>{mRow.totalContracts} locação(ões)</td>
                              <td className="text-emerald font-bold">{formatCurrency(mRow.grossRevenue)}</td>
                              <td className="text-cyan">{formatCurrency(mRow.receivedRevenue)}</td>
                              <td className="text-amber">{formatCurrency(mRow.pendingRevenue)}</td>
                              <td className={mRow.damageLosses > 0 ? 'text-red font-bold' : 'text-muted'}>
                                {formatCurrency(mRow.damageLosses)}
                                {mRow.damagedContractsCount > 0 && (
                                  <small className="ept-dmg-count"> ({mRow.damagedContractsCount} avaria)</small>
                                )}
                              </td>
                              <td className={mRow.netContracted >= 0 ? 'text-gold font-bold' : 'text-red font-bold'}>
                                {formatCurrency(mRow.netContracted)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr
                          className={`ept-total-row ${financialPeriodType === 'all' ? 'row-selected' : ''}`}
                          onClick={() => setFinancialPeriodType('all')}
                          title="Clique para ver Todo o Período (Total Geral)"
                        >
                          <td><strong>TOTAL GERAL ACUMULADO</strong></td>
                          <td><strong>{financialAnalytics.allTime.totalContracts} locação(ões)</strong></td>
                          <td className="text-emerald"><strong>{formatCurrency(financialAnalytics.allTime.grossRevenue)}</strong></td>
                          <td className="text-cyan"><strong>{formatCurrency(financialAnalytics.allTime.receivedRevenue)}</strong></td>
                          <td className="text-amber"><strong>{formatCurrency(financialAnalytics.allTime.pendingRevenue)}</strong></td>
                          <td className="text-red"><strong>{formatCurrency(financialAnalytics.allTime.damageLosses)}</strong></td>
                          <td className="text-gold"><strong>{formatCurrency(financialAnalytics.allTime.netContracted)}</strong></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Toolbar com Filtros de Status */}
            <div className="erm-rentals-toolbar">
              <div className="erm-filter-pills">
                <button
                  type="button"
                  className={`erm-pill-btn ${rentalStatusFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setRentalStatusFilter('all')}
                >
                  Todas ({rentalsList.length})
                </button>
                <button
                  type="button"
                  className={`erm-pill-btn ${rentalStatusFilter === 'reserved' ? 'active pill-highlight-reserved' : ''}`}
                  onClick={() => setRentalStatusFilter('reserved')}
                >
                  📅 Agendados &amp; Reservas ({kpiStats.reservedCount})
                </button>
                <button
                  type="button"
                  className={`erm-pill-btn ${rentalStatusFilter === 'active' ? 'active' : ''}`}
                  onClick={() => setRentalStatusFilter('active')}
                >
                  🟢 Em Andamento ({kpiStats.activeRentalsCount - kpiStats.overdueCount})
                </button>
                <button
                  type="button"
                  className={`erm-pill-btn ${rentalStatusFilter === 'due_soon' ? 'active' : ''}`}
                  onClick={() => setRentalStatusFilter('due_soon')}
                >
                  🟠 Vence Hoje ({kpiStats.dueTodayCount})
                </button>
                <button
                  type="button"
                  className={`erm-pill-btn ${rentalStatusFilter === 'overdue' ? 'active text-red' : ''}`}
                  onClick={() => setRentalStatusFilter('overdue')}
                >
                  🚨 Atrasadas ({kpiStats.overdueCount})
                </button>
                <button
                  type="button"
                  className={`erm-pill-btn ${rentalStatusFilter === 'returned' ? 'active' : ''}`}
                  onClick={() => setRentalStatusFilter('returned')}
                >
                  ⚪ Devolvidas ({rentalsList.filter((r) => r.status === 'returned').length})
                </button>
              </div>
            </div>

            {/* Lista de Locações */}
            <div className="erm-rentals-list">
              {filteredRentals.length === 0 ? (
                <div className="erm-empty-state">
                  <FileText size={40} className="text-muted" />
                  <h3>Nenhuma locação encontrada nesta categoria</h3>
                  <p>Inicie uma nova locação na aba "Nova Locação".</p>
                </div>
              ) : (
                filteredRentals.map((rental) => {
                  const todayStr = new Date().toISOString().split('T')[0];
                  const isReserved = rental.status === 'reserved';
                  const isCancelled = rental.status === 'cancelled';
                  const isOverdue =
                    !isReserved && !isCancelled &&
                    (rental.status === 'active' || rental.status === 'overdue') &&
                    rental.endDate < todayStr;
                  const isDueToday =
                    !isReserved && !isCancelled &&
                    (rental.status === 'active' || rental.status === 'overdue') &&
                    rental.endDate === todayStr;
                  const isReturned = rental.status === 'returned';

                  return (
                    <div
                      key={rental.id}
                      className={`erm-rental-card ${isReserved ? 'card-reserved' : isCancelled ? 'card-cancelled' : isOverdue ? 'card-overdue' : isDueToday ? 'card-due-today' : isReturned ? 'card-returned' : 'card-active'}`}
                    >
                      <div className="erc-header">
                        <div className="erc-code-row">
                          <span className="erc-code">{rental.code}</span>
                          <span
                            className={`erc-status-pill ${isReserved ? 'pill-reserved' : isCancelled ? 'pill-cancelled' : isOverdue ? 'pill-overdue' : isDueToday ? 'pill-due-today' : isReturned ? 'pill-returned' : 'pill-active'}`}
                          >
                            {isReserved
                              ? '📅 Agendado / Reserva Confirmada'
                              : isCancelled
                                ? '❌ Cancelada (Estoque Liberado)'
                                : isOverdue
                                  ? '🚨 Atrasada (Prazo Vencido)'
                                  : isDueToday
                                    ? '🟠 Devolução Prevista Para Hoje'
                                    : isReturned
                                      ? '✅ Devolução Concluída'
                                      : '🟢 Em Andamento (No Prazo)'}
                          </span>
                        </div>

                        <div className="erc-price-box">
                          <span className="erc-price">{formatCurrency(rental.totalAmount)}</span>
                          <span className="erc-pay-status">
                            {rental.paymentMethod} • {rental.paymentStatus || 'Pendente'}
                          </span>
                          {rental.paidAmount > 0 && rental.remainingAmount > 0 && (
                            <span className="erc-partial-badge">
                              Entrada: {formatCurrency(rental.paidAmount)} • Falta: {formatCurrency(rental.remainingAmount)} ({rental.remainingDueTerms || 'Na devolução'})
                            </span>
                          )}
                          {rental.securityDeposit > 0 && (
                            <span className="erc-deposit-badge">
                              🛡️ Caução: {formatCurrency(rental.securityDeposit)}
                            </span>
                          )}
                          {Number(rental.damageCost) > 0 && (
                            <span className="erc-loss-badge">
                              🚨 Prejuízo / Avaria: -{formatCurrency(rental.damageCost)} • Líquido: {formatCurrency((Number(rental.totalAmount) || 0) - (Number(rental.damageCost) || 0))}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="erc-client-row">
                        <div className="erc-client-info">
                          <User size={15} className="text-gold" />
                          <strong>{rental.clientName}</strong>
                          {rental.clientPhone && <span> • 📞 {rental.clientPhone}</span>}
                        </div>

                        <div className="erc-dates-info">
                          <Calendar size={14} />
                          <span>
                            {formatDateBR(rental.startDate)} ({rental.startTime || '08:00'}) ➜{' '}
                            <strong>{formatDateBR(rental.endDate)} ({rental.endTime || '18:00'})</strong>
                          </span>
                          <span className="erc-days-tag">{rental.totalDays} dia(s)</span>
                        </div>
                      </div>

                      {/* Itens Locados */}
                      <div className="erc-items-strip">
                        <span className="erc-items-lbl">Equipamentos:</span>
                        <div className="erc-items-chips">
                          {(rental.items || []).map((it, idx) => (
                            <span key={idx} className="erc-item-chip">
                              {it.quantity}x {it.name}
                            </span>
                          ))}
                        </div>
                      </div>

                      {isReturned && rental.returnedAt && (
                        <div className="erc-returned-box">
                          <CheckCircle2 size={14} className="text-emerald" />
                          <span>
                            Devolvido em {formatDateBR(rental.returnedAt.split('T')[0])} às {rental.returnedAt.split('T')[1]?.substring(0, 5) || ''}
                            {rental.returnNotes ? ` — Obs: "${rental.returnNotes}"` : ''}
                          </span>
                        </div>
                      )}

                      {/* Faixa Visual da Vistoria Fotográfica de Avarias */}
                      {((rental.pickupPhotos && rental.pickupPhotos.length > 0) || (rental.returnPhotos && rental.returnPhotos.length > 0)) && (
                        <div
                          className="erc-inspection-strip"
                          onClick={() => setSelectedRentalForInspection(rental)}
                          title="Clique para abrir o comparativo visual de avarias"
                        >
                          <div className="erc-is-left">
                            <div className="erc-is-badge">
                              <Camera size={13} />
                              <span>Vistoria Fotográfica:</span>
                            </div>
                            <div className="erc-is-thumbs">
                              {(rental.pickupPhotos || []).slice(0, 3).map((p, idx) => (
                                <img
                                  key={`p-${idx}`}
                                  src={p.url}
                                  alt="Saída"
                                  className="erc-mini-thumb pickup-thumb"
                                  title={`Saída: ${p.caption || p.equipmentName}`}
                                  onError={(e) => handleRentalPhotoError(e, p.url, p.equipmentId, p.backup)}
                                />
                              ))}
                              {(rental.returnPhotos || []).slice(0, 3).map((p, idx) => (
                                <img
                                  key={`r-${idx}`}
                                  src={p.url}
                                  alt="Retorno"
                                  className={`erc-mini-thumb return-thumb ${p.condition === 'damage' ? 'damaged-thumb' : ''}`}
                                  title={`Retorno: ${p.caption || p.equipmentName}`}
                                  onError={(e) => handleRentalPhotoError(e, p.url, p.equipmentId, p.backup)}
                                />
                              ))}
                              {((rental.pickupPhotos?.length || 0) + (rental.returnPhotos?.length || 0)) > 6 && (
                                <span className="erc-thumb-more">
                                  +{((rental.pickupPhotos?.length || 0) + (rental.returnPhotos?.length || 0)) - 6}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="erc-is-right">
                            {rental.hasDamage ? (
                              <span className="erc-damage-alert">
                                <AlertTriangle size={12} /> Avaria Registrada
                              </span>
                            ) : (
                              <span className="erc-ok-alert">
                                <CheckCircle2 size={12} /> Sem Avarias
                              </span>
                            )}
                            <span className="erc-compare-pill">Comparar Fotos ➜</span>
                          </div>
                        </div>
                      )}

                      {/* Ações da Locação */}
                      <div className="erc-actions-bar">
                        {/* Botão de Vistoria e Fotos (Sempre acessível para inspeção) */}
                        <button
                          type="button"
                          className={`btn-secondary btn-sm btn-inspection-trigger ${rental.hasDamage ? 'btn-has-damage' : ''}`}
                          onClick={() => setSelectedRentalForInspection(rental)}
                          title="Registrar fotos de saída e devolução e auditar avarias"
                        >
                          <Camera size={14} className={rental.hasDamage ? 'text-red' : 'text-gold'} />
                          <span>
                            📸 Vistoria &amp; Fotos ({(rental.pickupPhotos?.length || 0)} / {(rental.returnPhotos?.length || 0)})
                          </span>
                          {rental.hasDamage && <span className="erc-damage-badge">🚨 AVARIA</span>}
                        </button>

                        {/* Botão de Prejuízo / Avaria / Financeiro */}
                        <button
                          type="button"
                          className={`btn-secondary btn-sm ${Number(rental.damageCost) > 0 ? 'btn-has-damage' : ''}`}
                          onClick={() => handleOpenFinancialModal(rental)}
                          title="Registrar ou editar valor de prejuízo/avaria ou status de pagamento desta locação"
                        >
                          <DollarSign size={14} className={Number(rental.damageCost) > 0 ? 'text-red' : 'text-emerald'} />
                          <span>
                            {Number(rental.damageCost) > 0
                              ? `💸 Prejuízo (${formatCurrency(rental.damageCost)})`
                              : '💸 Prejuízo / Financeiro'}
                          </span>
                        </button>

                        {/* Botão de Comprovante de Pagamento (Visualizar ou Anexar) */}
                        {rental.paymentReceiptUrl ? (
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            onClick={() => setViewingReceipt({ url: rental.paymentReceiptUrl, code: rental.code, client: rental.clientName })}
                            title="Visualizar ou baixar comprovante de pagamento"
                            style={{ borderColor: 'rgba(16, 185, 129, 0.4)', color: '#34d399' }}
                          >
                            <FileCheck size={14} /> Ver Comprovante
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            onClick={() => {
                              setAttachingReceiptForRental(rental);
                              setNewReceiptFile({ dataUrl: '', name: '', isUploading: false });
                            }}
                            title="Anexar comprovante de pagamento a este contrato"
                          >
                            <Upload size={14} /> + Comprovante
                          </button>
                        )}

                        {isReserved ? (
                          <>
                            <button
                              type="button"
                              className="btn-primary btn-sm btn-activate-reservation"
                              onClick={() => handleActivateReservation(rental)}
                              title="Registra a retirada física do equipamento e altera status para Em Andamento"
                            >
                              <Package size={14} /> Confirmar Retirada / Entregar Equipamento
                            </button>
                            <button
                              type="button"
                              className="btn-secondary btn-sm"
                              onClick={() => setSelectedRentalForContract(rental)}
                            >
                              <FileText size={14} /> Comprovante de Reserva
                            </button>
                            <button
                              type="button"
                              className="btn-danger-outline btn-sm btn-cancel-reservation"
                              onClick={() => handleCancelRental(rental)}
                              title="Cancela reserva e devolve itens para o estoque"
                            >
                              <X size={14} /> Cancelar Reserva
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="btn-secondary btn-sm"
                              onClick={() => setSelectedRentalForContract(rental)}
                            >
                              <FileText size={14} /> Ver Termo &amp; Contrato
                            </button>

                            {!isReturned && !isCancelled && (
                              <>
                                <button
                                  type="button"
                                  className="btn-primary btn-sm btn-checkin"
                                  onClick={() => {
                                    const hasDmg = Boolean(
                                      rental.hasDamage ||
                                      rental.has_damage ||
                                      (rental.returnPhotos && rental.returnPhotos.some((p) => p.condition === 'damage'))
                                    );
                                    setReturningRental(rental);
                                    setReturnNotes(rental.returnNotes || (hasDmg ? 'Avaria constatada na devolução. Encaminhado para reparo.' : ''));
                                    setReturnDamageCost(rental.damageCost && Number(rental.damageCost) > 0 ? String(rental.damageCost) : '');
                                    setReturnDamageType(rental.damageType || 'Avaria / Reparo Técnico');
                                    setSendToMaintenance(hasDmg);
                                  }}
                                >
                                  <RotateCcw size={14} /> Registrar Devolução (Check-in)
                                </button>
                                <button
                                  type="button"
                                  className="btn-danger-outline btn-sm"
                                  onClick={() => handleCancelRental(rental)}
                                  title="Cancela locação e devolve equipamentos ao estoque"
                                >
                                  <X size={14} /> Cancelar
                                </button>
                              </>
                            )}
                          </>
                        )}

                        {/* Botão de Excluir do Histórico (Exclusivo Administrador) */}
                        {isAdmin && (
                          <button
                            type="button"
                            className="btn-danger-outline btn-sm erc-btn-delete"
                            onClick={() => handleDeleteRental(rental)}
                            title="Excluir Permanentemente do Histórico (Exclusivo Administrador)"
                          >
                            <Trash2 size={13} />
                            <span>Excluir</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* MODAL 1: TERMO DE RESPONSABILIDADE & CONTRATO EM PDF                */}
      {/* ==================================================================== */}
      {selectedRentalForContract && (
        <RentalContractModal
          rental={selectedRentalForContract}
          currentUser={currentUser}
          onClose={() => setSelectedRentalForContract(null)}
        />
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: EDITAR / NOVO EQUIPAMENTO NO ACERVO                        */}
      {/* ==================================================================== */}
      {(editingEquipment || isNewEquipModalOpen) && (
        <div
          className="modal-overlay"
          onClick={() => {
            setEditingEquipment(null);
            setIsNewEquipModalOpen(false);
          }}
        >
          <div className="modal-box equip-edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-text">
                <h2>{editingEquipment ? 'Editar Equipamento' : 'Novo Equipamento no Acervo'}</h2>
                <p>Ajuste o valor da diária, quantidade de unidades, foto ou especificações.</p>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => {
                  setEditingEquipment(null);
                  setIsNewEquipModalOpen(false);
                }}
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const equipData = {
                  id: editingEquipment ? editingEquipment.id : '',
                  name: formData.get('name'),
                  category: formData.get('category'),
                  dailyRate: Number(formData.get('dailyRate')) || 0,
                  assetValue: Number(formData.get('assetValue')) || 0,
                  rateUnit: editRateUnit || formData.get('rateUnit') || 'diária',
                  totalQty: Number(formData.get('totalQty')) || 1,
                  serialNumber: formData.get('serialNumber') || '',
                  description: formData.get('description') || '',
                  photoUrl: editEquipPhoto,
                };
                handleSaveEquipment(equipData);
              }}
              className="modal-form"
            >
              {/* Foto do Equipamento */}
              <div className="form-group equip-photo-group">
                <div className="equip-photo-label-row">
                  <label>Foto do Equipamento</label>
                  {editEquipPhoto ? (
                    <span className="photo-status-badge badge-active">
                      <Sparkles size={12} /> {editEquipPhoto.startsWith('data:') ? 'Nova foto pronta para gravar' : 'Foto cadastrada'}
                    </span>
                  ) : (
                    <span className="photo-status-badge badge-empty">Sem foto</span>
                  )}
                </div>

                <div className="equip-photo-edit-card">
                  {/* Prévia Visual */}
                  <div className="equip-photo-preview-wrap">
                    {editEquipPhoto ? (
                      <div className="equip-photo-preview-inner">
                        <img
                          src={getEquipPhotoUrl(editEquipPhoto, editingEquipment?.id, editingEquipment?.photoBackup)}
                          alt="Prévia do Equipamento"
                          className="equip-photo-img-contain"
                          onError={(e) => handleRentalPhotoError(e, editEquipPhoto, editingEquipment?.id, editingEquipment?.photoBackup)}
                        />
                        <button
                          type="button"
                          className="btn-danger-outline btn-xs photo-remove-btn"
                          onClick={() => setEditEquipPhoto('')}
                          title="Remover foto"
                        >
                          <Trash2 size={13} /> Remover Foto
                        </button>
                      </div>
                    ) : (
                      <div className="equip-photo-placeholder">
                        <Camera size={34} className="text-gold" />
                        <span>Sem foto selecionada</span>
                        <small>Clique ao lado para escolher</small>
                      </div>
                    )}
                  </div>

                  {/* Controles de Foto */}
                  <div className="equip-photo-controls">
                    <label className={`btn-primary btn-sm photo-picker-btn ${isPhotoLoading ? 'loading' : ''}`}>
                      <Upload size={16} />
                      <span>{isPhotoLoading ? 'Otimizando imagem...' : 'Escolher Foto do Computador / Celular'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        disabled={isPhotoLoading}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            try {
                              setIsPhotoLoading(true);
                              const compressed = await compressImageFile(file, 1200, 0.85);
                              setEditEquipPhoto(compressed);
                            } catch (err) {
                              console.error('Erro ao processar imagem:', err);
                              alertDialog({
                                title: 'Erro ao carregar imagem',
                                message: 'Não foi possível processar o arquivo de imagem selecionado.',
                                variant: 'warning',
                              });
                            } finally {
                              setIsPhotoLoading(false);
                            }
                          }
                        }}
                      />
                    </label>

                    <div className="photo-url-wrap">
                      <input
                        type="url"
                        placeholder="Ou cole o link direto da imagem (https://...)"
                        value={editEquipPhoto.startsWith('data:') ? '' : editEquipPhoto}
                        onChange={(e) => setEditEquipPhoto(e.target.value)}
                        className="photo-url-input"
                      />
                    </div>

                    <div className="photo-helper-text">
                      <Sparkles size={12} className="text-gold" />
                      <span>As imagens são comprimidas e preservadas em alta definição, sem cortes indesejados.</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>Nome / Modelo do Equipamento *</label>
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={editingEquipment?.name || ''}
                  placeholder="Ex: Sony FX3, Lente GM 24-70mm, Drone DJI Air 3..."
                />
              </div>

              <div className="form-group-grid">
                <div className="form-group">
                  <label>Categoria *</label>
                  <select name="category" defaultValue={editingEquipment?.category || 'accessories'}>
                    <option value="cameras">Câmeras</option>
                    <option value="lenses">Lentes</option>
                    <option value="lighting">Iluminação</option>
                    <option value="audio">Áudio</option>
                    <option value="drones">Estabilizadores &amp; Drones</option>
                    <option value="video">Vídeo &amp; Mesas</option>
                    <option value="accessories">Acessórios &amp; Suportes</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Quantidade Total no Acervo *</label>
                  <input
                    type="number"
                    name="totalQty"
                    min="1"
                    required
                    defaultValue={editingEquipment?.totalQty || 1}
                  />
                </div>

                <div className="form-group">
                  <label>Valor da Locação (R$) *</label>
                  <input
                    type="number"
                    name="dailyRate"
                    step="0.01"
                    min="0"
                    required
                    defaultValue={editingEquipment?.dailyRate || 100}
                  />
                </div>

                <div className="form-group">
                  <label>Valor Patrimonial / Custo de Mercado do Bem (R$)</label>
                  <input
                    type="number"
                    name="assetValue"
                    step="0.01"
                    min="0"
                    defaultValue={editingEquipment?.assetValue || (editingEquipment?.dailyRate ? editingEquipment.dailyRate * 25 : '')}
                    placeholder="Ex: 11000.00 (Valor de mercado / reposição do item)"
                  />
                  <small className="form-tip">
                    Custo de reposição do bem no mercado. Alimenta a consolidação de ativos da produtora e o termo de garantia.
                  </small>
                </div>

                <div className="form-group rate-unit-form-group">
                  <label>Unidade de Cobrança *</label>
                  <select
                    name="rateUnit"
                    value={editRateUnit}
                    onChange={(e) => setEditRateUnit(e.target.value)}
                    className="rate-unit-select"
                  >
                    <option value="diária">diária (padrão 24h)</option>
                    <option value="hora">hora (por hora)</option>
                    <option value="evento">evento / turno</option>
                    <option value="semana">semana (7 dias)</option>
                    <option value="mês">mês (30 dias)</option>
                  </select>

                  <div className="rate-unit-pills-row">
                    {[
                      { val: 'diária', label: '⚡ Diária' },
                      { val: 'hora', label: '⏱️ Por Hora' },
                      { val: 'evento', label: '🎬 Por Evento' },
                      { val: 'semana', label: '📅 Semanal' },
                      { val: 'mês', label: '🗓️ Mensal' },
                    ].map((pill) => (
                      <button
                        key={pill.val}
                        type="button"
                        className={`rate-pill-choice ${editRateUnit === pill.val ? 'active' : ''}`}
                        onClick={() => setEditRateUnit(pill.val)}
                      >
                        {pill.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>Número de Série ou Tag de Patrimônio</label>
                <input
                  type="text"
                  name="serialNumber"
                  defaultValue={editingEquipment?.serialNumber || ''}
                  placeholder="Ex: SN-8837192 (essencial para constar no termo e evitar troca de peças)"
                />
                <small className="form-tip">
                  Identificador obrigatório em contrato para segurança e conferência no check-in.
                </small>
              </div>

              <div className="form-group">
                <label>Descrição Breve / Acessórios Inclusos</label>
                <input
                  type="text"
                  name="description"
                  defaultValue={editingEquipment?.description || ''}
                  placeholder="Ex: Acompanha estojo rígido, 2 baterias e cabos..."
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setEditingEquipment(null);
                    setIsNewEquipModalOpen(false);
                  }}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Salvar Equipamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 3: CHECK-IN / CONFIRMAR DEVOLUÇÃO                             */}
      {/* ==================================================================== */}
      {returningRental && (
        <div className="modal-overlay" onClick={() => setReturningRental(null)}>
          <div className="modal-box checkin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-text">
                <h2>Receber Devolução de Equipamentos</h2>
                <p>Contrato: <strong>{returningRental.code}</strong> — Cliente: {returningRental.clientName}</p>
              </div>
              <button type="button" className="modal-close" onClick={() => setReturningRental(null)}>
                ✕
              </button>
            </div>

            <div className="modal-form">
              <div className="checkin-warning-box">
                <ShieldCheck size={20} className="text-emerald" />
                <div>
                  <strong>Conferência dos Equipamentos</strong>
                  <p>
                    Confirme se todos os itens abaixo foram devolvidos completos, limpos e com seus respectivos cabos e cases.
                  </p>
                </div>
              </div>

              <div className="checkin-items-list">
                {(returningRental.items || []).map((it, idx) => (
                  <div key={idx} className="checkin-item-row">
                    <CheckCircle2 size={16} className="text-emerald" />
                    <span><strong>{it.quantity}x</strong> {it.name}</span>
                  </div>
                ))}
              </div>

              {/* Acesso Direto à Vistoria Fotográfica no Check-in */}
              <div className="checkin-inspection-card">
                <div className="cic-left">
                  <Camera size={20} className="text-gold" />
                  <div>
                    <strong>Vistoria Fotográfica &amp; Auditoria de Avarias</strong>
                    <p>
                      {returningRental.pickupPhotos?.length > 0
                        ? `${returningRental.pickupPhotos.length} foto(s) de saída registradas para comparar com a devolução.`
                        : 'Fotografe os equipamentos devolvidos para registrar no histórico permanente.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-secondary btn-sm btn-open-inspection"
                  onClick={() => setSelectedRentalForInspection(returningRental)}
                >
                  <Camera size={14} /> Abrir Vistoria &amp; Comparativo
                </button>
              </div>

              <div className="form-group">
                <label>Observações da Devolução (Avarias, Falta de Cabos ou Inspeção OK):</label>
                <textarea
                  rows="3"
                  placeholder="Ex: Equipamentos conferidos e testados em perfeito estado."
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                />
              </div>

              {/* Decisão de Manutenção pós-devolução */}
              <div className={`checkin-maintenance-choice-card ${sendToMaintenance ? 'is-maintenance-active' : ''}`}>
                <div className="cmc-header">
                  <div className="cmc-icon-wrap">
                    <Wrench size={18} className={sendToMaintenance ? 'text-amber' : 'text-muted'} />
                  </div>
                  <div className="cmc-text">
                    <strong>Destino do Equipamento Devolvido:</strong>
                    <p>
                      {sendToMaintenance
                        ? '⚠️ Equipamento com avaria: será encaminhado para manutenção técnica e NÃO ficará disponível para novas locações até o retorno.'
                        : 'Equipamento íntegro e testado: retornará diretamente ao estoque disponível para novas locações.'}
                    </p>
                  </div>
                </div>

                <label className="cmc-toggle-row">
                  <input
                    type="checkbox"
                    checked={sendToMaintenance}
                    onChange={(e) => setSendToMaintenance(e.target.checked)}
                  />
                  <span>
                    <strong>🛠️ Encaminhar para Manutenção / Reparo Técnico</strong>
                    <small>Marque caso tenham ocorrido avarias, quebras, riscos severos ou necessidade de conserto pós-locação.</small>
                  </span>
                </label>

                <div className="checkin-loss-fields" style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="form-group-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.78rem', color: '#fca5a5' }}>💸 Valor do Prejuízo / Custo de Reparo (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0,00 (Opcional)"
                        value={returnDamageCost}
                        onChange={(e) => setReturnDamageCost(e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>Tipo de Ocorrência / Prejuízo</label>
                      <select
                        value={returnDamageType}
                        onChange={(e) => setReturnDamageType(e.target.value)}
                      >
                        <option value="Avaria / Reparo Técnico">🛠️ Avaria / Reparo Técnico</option>
                        <option value="Falta de Cabo / Acessório">🔌 Falta de Cabo / Acessório</option>
                        <option value="Quebra / Perda Total">💥 Quebra / Perda Total</option>
                        <option value="Extravio de Equipamento">🚨 Extravio de Equipamento</option>
                        <option value="Inadimplência / Desconto">💸 Inadimplência / Desconto</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setReturningRental(null)}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className={`btn-primary ${sendToMaintenance ? 'btn-confirm-maintenance' : 'btn-confirm-return'}`}
                  onClick={handleConfirmReturn}
                >
                  {sendToMaintenance ? (
                    <>
                      <Wrench size={16} /> Confirmar Devolução &amp; Enviar para Manutenção
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} /> Confirmar Devolução &amp; Liberar Estoque
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 4: DETALHES COMPLETOS DO EQUIPAMENTO                          */}
      {/* ==================================================================== */}
      {selectedDetailEquipment && (
        <EquipmentDetailModal
          equipment={selectedDetailEquipment}
          rentals={rentalsList}
          onClose={() => setSelectedDetailEquipment(null)}
          onEdit={(eq) => {
            setSelectedDetailEquipment(null);
            setEditingEquipment(eq);
          }}
          onRent={(eq) => {
            setSelectedDetailEquipment(null);
            handleAddToCart(eq);
            setActiveTab('new_rental');
          }}
          onUpdatePhoto={handleUpdateEquipmentPhoto}
          onEquipmentUpdated={(updatedEq) => {
            setEquipmentList((prev) =>
              prev.map((e) => (e.id === updatedEq.id ? updatedEq : e))
            );
            setSelectedDetailEquipment(updatedEq);
            fetchRentalsData();
          }}
        />
      )}

      {/* ==================================================================== */}
      {/* MODAL 5: VISTORIA & FOTOS DE RETIRADA / DEVOLUÇÃO                   */}
      {/* ==================================================================== */}
      {selectedRentalForInspection && (
        <RentalInspectionModal
          rental={selectedRentalForInspection}
          currentUser={currentUser}
          onClose={() => setSelectedRentalForInspection(null)}
          onUpdated={(updatedRental) => {
            setRentalsList((prev) =>
              prev.map((r) => (r.id === updatedRental.id ? updatedRental : r))
            );
            setSelectedRentalForInspection(updatedRental);
            setReturningRental((prev) => (prev && prev.id === updatedRental.id ? updatedRental : prev));
            const hasDmg = Boolean(
              updatedRental.hasDamage ||
              updatedRental.has_damage ||
              (updatedRental.returnPhotos && updatedRental.returnPhotos.some((p) => p.condition === 'damage'))
            );
            if (hasDmg) {
              setSendToMaintenance(true);
            }
          }}
        />
      )}

      {/* ==================================================================== */}
      {/* MODAL 6: VISUALIZAR COMPROVANTE DE PAGAMENTO                        */}
      {/* ==================================================================== */}
      {viewingReceipt && (
        <div className="modal-overlay" onClick={() => setViewingReceipt(null)} style={{ zIndex: 1200 }}>
          <div
            className="modal-box"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 720, width: '92%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
          >
            <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="modal-header-text">
                <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Comprovante de Pagamento</h2>
                <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
                  Contrato: <strong style={{ color: '#f59e0b' }}>{viewingReceipt.code}</strong> • Cliente: {viewingReceipt.client}
                </p>
              </div>
              <button type="button" className="modal-close" onClick={() => setViewingReceipt(null)}>
                ✕
              </button>
            </div>

            <div style={{ padding: 20, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              {viewingReceipt.url.includes('.pdf') || viewingReceipt.url.startsWith('data:application/pdf') ? (
                <div style={{ width: '100%', textAlign: 'center' }}>
                  <div style={{ padding: '30px 20px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px dashed rgba(255,255,255,0.15)', marginBottom: 16 }}>
                    <FileText size={48} style={{ color: '#10b981', margin: '0 auto 12px' }} />
                    <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#f8fafc' }}>Documento PDF Vinculado</div>
                    <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 4 }}>
                      O comprovante bancário ou de transferência está salvo em formato PDF oficial.
                    </p>
                  </div>
                  <a
                    href={viewingReceipt.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', textDecoration: 'none' }}
                  >
                    <ExternalLink size={16} /> Abrir / Baixar PDF em Nova Aba
                  </a>
                </div>
              ) : (
                <div style={{ width: '100%', textAlign: 'center' }}>
                  <img
                    src={viewingReceipt.url}
                    alt="Comprovante de Pagamento"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '65vh',
                      objectFit: 'contain',
                      borderRadius: 8,
                      boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                      border: '1px solid rgba(255,255,255,0.1)'
                    }}
                    onError={(e) => handleRentalPhotoError(e, viewingReceipt.url, '', viewingReceipt.backup)}
                  />
                  <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', gap: 12 }}>
                    <a
                      href={viewingReceipt.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
                    >
                      <ExternalLink size={14} /> Abrir Imagem Completa
                    </a>
                    <a
                      href={viewingReceipt.url}
                      download={`Comprovante_${viewingReceipt.code}.jpg`}
                      className="btn-primary btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
                    >
                      <Download size={14} /> Baixar Foto
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 7: ANEXAR COMPROVANTE A UMA LOCAÇÃO / RESERVA EXISTENTE        */}
      {/* ==================================================================== */}
      {attachingReceiptForRental && (
        <div className="modal-overlay" onClick={() => setAttachingReceiptForRental(null)} style={{ zIndex: 1200 }}>
          <div
            className="modal-box"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 520, width: '92%' }}
          >
            <div className="modal-header">
              <div className="modal-header-text">
                <h2>Anexar Comprovante de Pagamento</h2>
                <p>
                  Contrato: <strong>{attachingReceiptForRental.code}</strong> — Cliente: {attachingReceiptForRental.clientName}
                </p>
              </div>
              <button type="button" className="modal-close" onClick={() => setAttachingReceiptForRental(null)}>
                ✕
              </button>
            </div>

            <div className="modal-form" style={{ padding: 20 }}>
              <p style={{ fontSize: '0.85rem', color: '#cbd5e1', marginBottom: 16 }}>
                Selecione a foto (print do PIX, recibo bancário) ou arquivo PDF para vincular permanentemente a este contrato.
              </p>

              {newReceiptFile.dataUrl ? (
                <div style={{ padding: 14, background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 10, marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <CheckCircle2 size={20} className="text-emerald" />
                      <div>
                        <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f8fafc' }}>
                          {newReceiptFile.name || 'Arquivo selecionado'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#34d399' }}>Pronto para envio</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-danger-outline btn-sm"
                      onClick={() => setNewReceiptFile({ dataUrl: '', name: '', isUploading: false })}
                      style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                    >
                      Trocar
                    </button>
                  </div>
                  {!newReceiptFile.dataUrl.includes('application/pdf') && (
                    <div style={{ marginTop: 12, textAlign: 'center' }}>
                      <img
                        src={newReceiptFile.dataUrl}
                        alt="Pré-visualização"
                        style={{ maxHeight: 180, maxWidth: '100%', borderRadius: 6, objectFit: 'contain' }}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <label
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '30px 20px',
                    border: '2px dashed rgba(255,255,255,0.2)',
                    borderRadius: 12,
                    background: 'rgba(255,255,255,0.02)',
                    cursor: 'pointer',
                    marginBottom: 20,
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Upload size={32} style={{ color: '#f59e0b', marginBottom: 8 }} />
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#f1f5f9' }}>
                    Clique para selecionar Foto ou PDF
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 4 }}>
                    Suporta PNG, JPG, JPEG ou PDF (até 15MB)
                  </span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    style={{ display: 'none' }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        try {
                          setNewReceiptFile((prev) => ({ ...prev, isUploading: true }));
                          const res = await handleReceiptFileRead(file);
                          if (res) {
                            setNewReceiptFile({ dataUrl: res.dataUrl, name: res.name, isUploading: false });
                          }
                        } catch (err) {
                          console.error('Erro ao ler arquivo:', err);
                          alertDialog({
                            title: 'Erro ao ler arquivo',
                            message: 'Não foi possível carregar o arquivo selecionado.',
                            variant: 'warning',
                          });
                          setNewReceiptFile((prev) => ({ ...prev, isUploading: false }));
                        }
                      }
                    }}
                  />
                </label>
              )}

              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setAttachingReceiptForRental(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={!newReceiptFile.dataUrl || newReceiptFile.isUploading}
                  onClick={async () => {
                    try {
                      setNewReceiptFile((prev) => ({ ...prev, isUploading: true }));
                      const res = await apiRequest('/rentals.php?action=attach_receipt', {
                        method: 'POST',
                        body: JSON.stringify({
                          rentalId: attachingReceiptForRental.id,
                          paymentReceiptUrl: newReceiptFile.dataUrl,
                        }),
                      });
                      if (res && res.success) {
                        const savedUrl = res.paymentReceiptUrl || newReceiptFile.dataUrl;
                        setRentalsList((prev) =>
                          prev.map((r) =>
                            r.id === attachingReceiptForRental.id
                              ? { ...r, paymentReceiptUrl: savedUrl, paymentStatus: 'Pago' }
                              : r
                          )
                        );
                        alertDialog({
                          title: 'Comprovante Anexado!',
                          message: `Comprovante de pagamento vinculado com sucesso ao contrato ${attachingReceiptForRental.code}.`,
                          variant: 'success',
                        });
                        setAttachingReceiptForRental(null);
                        fetchRentalsData();
                      } else {
                        alertDialog({
                          title: 'Erro ao anexar',
                          message: res?.error || 'Não foi possível salvar o comprovante.',
                          variant: 'warning',
                        });
                      }
                    } catch (err) {
                      console.error('Erro ao anexar comprovante:', err);
                      alertDialog({
                        title: 'Erro de Comunicação',
                        message: 'Falha ao salvar comprovante no servidor.',
                        variant: 'warning',
                      });
                    } finally {
                      setNewReceiptFile((prev) => ({ ...prev, isUploading: false }));
                    }
                  }}
                >
                  {newReceiptFile.isUploading ? 'Salvando...' : 'Salvar e Vincular Comprovante'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 8: LANÇAR / EDITAR PREJUÍZO, AVARIA OU BAIXA FINANCEIRA        */}
      {/* ==================================================================== */}
      {financialModalData && (
        <div
          className="modal-overlay"
          onClick={() => setFinancialModalData(null)}
          style={{ zIndex: 1300 }}
        >
          <div
            className="modal-box"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 580, width: '94%' }}
          >
            <div className="modal-header">
              <div className="modal-header-text">
                <h2>💸 Registro de Prejuízos, Avarias &amp; Recebimento</h2>
                <p>
                  Atualize valores obtidos em caixa ou registre custos de reparo, avarias e perdas desta locação.
                </p>
              </div>
              <button type="button" className="modal-close" onClick={() => setFinancialModalData(null)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveFinancialModal} className="modal-form" style={{ padding: 20 }}>
              {/* Seletor de Contrato de Locação */}
              <div className="form-group">
                <label>Contrato / Locação de Referência *</label>
                <select
                  value={financialModalData.rentalId}
                  onChange={(e) => {
                    const selected = rentalsList.find((r) => r.id === e.target.value);
                    if (selected) {
                      handleOpenFinancialModal(selected);
                    }
                  }}
                >
                  {rentalsList.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.code} — {r.clientName} ({formatDateBR(r.startDate)} • {formatCurrency(r.totalAmount)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Bloco 1: Valores Obtidos / Recebimento */}
              <div
                style={{
                  padding: 14,
                  borderRadius: 10,
                  background: 'rgba(16, 185, 129, 0.06)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  marginBottom: 16,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <strong style={{ color: '#34d399', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <TrendingUp size={15} /> 1. Valores Obtidos na Locação
                  </strong>
                  <span style={{ fontSize: '0.82rem', color: '#f8fafc', fontWeight: 700 }}>
                    Valor do Contrato: {formatCurrency(financialModalData.totalAmount)}
                  </span>
                </div>

                <div className="form-group-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Status do Pagamento</label>
                    <select
                      value={financialModalData.paymentStatus}
                      onChange={(e) => {
                        const newSt = e.target.value;
                        setFinancialModalData((prev) => ({
                          ...prev,
                          paymentStatus: newSt,
                          paidAmount: newSt === 'Pago' ? String(prev.totalAmount) : prev.paidAmount,
                        }));
                      }}
                    >
                      <option value="Pago">✅ Pago (Quitado 100%)</option>
                      <option value="Caução Recebido">🟡 Parcial / Entrada Recebida</option>
                      <option value="Pendente">⏳ Pendente a Receber</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Valor Efetivamente Recebido (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={financialModalData.paymentStatus === 'Pago' ? financialModalData.totalAmount : financialModalData.paidAmount}
                      disabled={financialModalData.paymentStatus === 'Pago'}
                      onChange={(e) =>
                        setFinancialModalData((prev) => ({
                          ...prev,
                          paidAmount: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Bloco 2: Prejuízos, Avarias ou Perdas */}
              <div
                style={{
                  padding: 14,
                  borderRadius: 10,
                  background: 'rgba(239, 68, 68, 0.06)',
                  border: '1px solid rgba(239, 68, 68, 0.28)',
                  marginBottom: 16,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <strong style={{ color: '#f87171', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <TrendingDown size={15} /> 2. Prejuízos, Avarias &amp; Custos de Manutenção
                  </strong>
                  <span style={{ fontSize: '0.76rem', color: '#fca5a5' }}>
                    Abatido do saldo líquido do período
                  </span>
                </div>

                <div className="form-group-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Valor do Prejuízo / Reparo (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Ex: 150.00 (0 para sem prejuízo)"
                      value={financialModalData.damageCost}
                      onChange={(e) =>
                        setFinancialModalData((prev) => ({
                          ...prev,
                          damageCost: e.target.value,
                          hasDamage: parseFloat(e.target.value) > 0 ? true : prev.hasDamage,
                        }))
                      }
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Categoria do Prejuízo</label>
                    <select
                      value={financialModalData.damageType}
                      onChange={(e) =>
                        setFinancialModalData((prev) => ({
                          ...prev,
                          damageType: e.target.value,
                        }))
                      }
                    >
                      <option value="Avaria / Reparo Técnico">🛠️ Avaria / Reparo Técnico</option>
                      <option value="Falta de Cabo / Acessório">🔌 Falta de Cabo / Acessório</option>
                      <option value="Quebra / Perda Total">💥 Quebra / Perda Total</option>
                      <option value="Extravio de Equipamento">🚨 Extravio de Equipamento</option>
                      <option value="Inadimplência / Desconto">💸 Inadimplência / Desconto</option>
                      <option value="Outro Custo Operacional">📋 Outro Custo Operacional</option>
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: 12, marginBottom: 0 }}>
                  <label>Descrição / Observações do Prejuízo ou Avaria</label>
                  <textarea
                    rows="2"
                    placeholder="Ex: Reparo de conector HDMI danificado ou reposição de tampa de lente..."
                    value={financialModalData.damageNotes}
                    onChange={(e) =>
                      setFinancialModalData((prev) => ({
                        ...prev,
                        damageNotes: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              {/* Resumo Líquido Instantâneo do Contrato */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  marginBottom: 18,
                  fontSize: '0.85rem',
                }}
              >
                <span style={{ color: '#cbd5e1' }}>Resultado Líquido deste Contrato:</span>
                <strong
                  style={{
                    fontSize: '1rem',
                    color:
                      (Number(financialModalData.totalAmount) || 0) - (parseFloat(financialModalData.damageCost) || 0) >= 0
                        ? '#fbbf24'
                        : '#f87171',
                  }}
                >
                  {formatCurrency(
                    (Number(financialModalData.totalAmount) || 0) - (parseFloat(financialModalData.damageCost) || 0)
                  )}
                </strong>
              </div>

              <div className="modal-footer" style={{ padding: 0 }}>
                <button type="button" className="btn-secondary" onClick={() => setFinancialModalData(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={financialModalData.isSaving}>
                  {financialModalData.isSaving ? 'Salvando...' : 'Salvar Balanço Financeiro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

