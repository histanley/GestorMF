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
} from '../utils/rentalsData';
import { apiRequest } from '../utils/api';
import { confirmDialog, alertDialog } from '../utils/dialog';
import RentalContractModal from './RentalContractModal';
import EquipmentDetailModal from './EquipmentDetailModal';
import RentalInspectionModal from './RentalInspectionModal';

export default function EquipmentRentalManager({ currentUser, onClose = null }) {
  // Abas do Módulo: 'catalog' (Estoque), 'new_rental' (Nova Locação), 'rentals' (Locações Ativas & Histórico)
  const [activeTab, setActiveTab] = useState('catalog');

  // Dados do Catálogo e Locações
  const [equipmentList, setEquipmentList] = useState(() => {
    try {
      const saved = localStorage.getItem('gestormf_equipment_cache');
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
  const [returnNotes, setReturnNotes] = useState('');

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
    notes: '',
  });

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
          localStorage.setItem('gestormf_equipment_cache', JSON.stringify(enriched));
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
      localStorage.setItem('gestormf_equipment_cache', JSON.stringify(equipmentList));
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
    const rentedUnits = Math.max(0, totalUnits - availableUnits);

    const todayStr = new Date().toISOString().split('T')[0];

    const activeRentals = rentalsList.filter((r) => r.status === 'active' || r.status === 'overdue');
    const reservedCount = rentalsList.filter((r) => r.status === 'reserved').length;
    const overdueCount = rentalsList.filter((r) => {
      return (r.status === 'active' || r.status === 'overdue') && r.endDate < todayStr;
    }).length;

    const dueTodayCount = rentalsList.filter((r) => {
      return (r.status === 'active' || r.status === 'overdue') && r.endDate === todayStr;
    }).length;

    return {
      totalUnits,
      availableUnits,
      rentedUnits,
      activeRentalsCount: activeRentals.length,
      reservedCount,
      overdueCount,
      dueTodayCount,
    };
  }, [equipmentList, rentalsList]);

  // Catálogo Filtrado
  const filteredEquipment = useMemo(() => {
    return equipmentList.filter((item) => {
      const matchCat = selectedCategory === 'all' || item.category === selectedCategory;
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
    return rentalsList.filter((r) => {
      if (rentalStatusFilter === 'reserved') return r.status === 'reserved';
      if (rentalStatusFilter === 'active') return r.status === 'active' && r.endDate >= todayStr;
      if (rentalStatusFilter === 'overdue') return (r.status === 'active' || r.status === 'overdue') && r.endDate < todayStr;
      if (rentalStatusFilter === 'due_soon') return (r.status === 'active' || r.status === 'overdue') && r.endDate === todayStr;
      if (rentalStatusFilter === 'returned') return r.status === 'returned';
      return true;
    });
  }, [rentalsList, rentalStatusFilter]);

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

    if (cartItems.length === 0) {
      alertDialog({
        title: 'Carrinho Vazio',
        message: 'Selecione ao menos um equipamento para criar a locação ou reserva.',
        variant: 'warning',
      });
      return;
    }

    // Se o usuário selecionou status explicitamente ou se paymentStatus não for 'Pago', permite 'reserved' (Agendamento/Reserva)
    const statusToApply = intendedStatus || (rentalForm.paymentStatus === 'Pago' ? 'active' : 'reserved');
    const isReservation = statusToApply === 'reserved';

    const payload = {
      ...rentalForm,
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
          ...payload,
          status: statusToApply,
          createdAt: new Date().toISOString(),
        };

          // Baixa localmente estoque disponível (itens ficam reservados)
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

  // Ativar Reserva (Confirmar Pagamento e Iniciar Locação Oficial)
  const handleActivateReservation = async (rental) => {
    const confirmed = await confirmDialog({
      title: 'Confirmar Pagamento & Iniciar Locação',
      message: `Deseja ativar a reserva "${rental.code}" para o cliente "${rental.clientName}"? O status será alterado para Locação Ativa (Em Andamento) e o pagamento será marcado como "Pago".`,
      confirmLabel: 'Sim, Iniciar Locação',
      cancelLabel: 'Voltar',
      variant: 'primary',
    });
    if (!confirmed) return;

    try {
      const res = await apiRequest('/rentals.php?action=activate_reservation', {
        method: 'POST',
        body: JSON.stringify({ rentalId: rental.id, markPaid: true }),
      });
      if (res && res.success) {
        fetchRentalsData();
      }
    } catch (e) {
      console.warn('Ativando reserva localmente:', e);
    }

    const updated = { ...rental, status: 'active', paymentStatus: 'Pago' };
    setRentalsList((prev) => prev.map((r) => (r.id === rental.id ? updated : r)));
    setSelectedRentalForContract(updated);

    alertDialog({
      title: '🚀 Locação Ativada com Sucesso!',
      message: `Reserva ${rental.code} foi confirmada e iniciada. O termo oficial de responsabilidade está aberto para assinatura.`,
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
    const updated = { ...equip, photoUrl };
    await handleSaveEquipment(updated);
  };

  // Check-in / Devolução de Equipamentos
  const handleConfirmReturn = async () => {
    if (!returningRental) return;

    try {
      const res = await apiRequest('/rentals.php?action=return_rental', {
        method: 'POST',
        body: JSON.stringify({ rentalId: returningRental.id, returnNotes }),
      });
      if (res && res.success) {
        fetchRentalsData();
      }
    } catch (e) {
      console.warn('Registrando devolução localmente:', e);
    }

    // Libera quantidades de volta no catálogo
    const returnedItems = returningRental.items || [];
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

    // Marca como devolvida
    setRentalsList((prev) =>
      prev.map((r) =>
        r.id === returningRental.id
          ? {
            ...r,
            status: 'returned',
            returnedAt: new Date().toISOString(),
            returnNotes: returnNotes,
          }
          : r
      )
    );

    const rCode = returningRental.code;
    setReturningRental(null);
    setReturnNotes('');

    alertDialog({
      title: 'Devolução Registrada com Sucesso!',
      message: `A locação ${rCode} foi finalizada. Todos os equipamentos retornaram para o status DISPONÍVEL no estoque.`,
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
                          {isFullyRented ? (
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
                        </div>
                      </div>

                      {equip.photoUrl && (
                        <div
                          className="equip-card-thumb"
                          onClick={() => setSelectedDetailEquipment(equip)}
                          title="Clique para ver detalhes"
                        >
                          <img src={getEquipPhotoUrl(equip.photoUrl)} alt={equip.name} />
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
                          disabled={isFullyRented}
                          onClick={() => {
                            handleAddToCart(equip);
                            setActiveTab('new_rental');
                          }}
                          title={isFullyRented ? 'Todas as unidades já estão alugadas' : 'Adicionar à nova locação'}
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
                  <User size={16} className="text-gold" />
                  <h2>1. Dados do Locatário / Cliente</h2>
                </div>

                <div className="form-group-grid">
                  <div className="form-group span-2">
                    <label>Nome Completo do Cliente / Empresa *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: João da Silva / Produtora X"
                      value={rentalForm.clientName}
                      onChange={(e) => setRentalForm({ ...rentalForm, clientName: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>CPF ou CNPJ</label>
                    <input
                      type="text"
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
                    <label>Telefone / WhatsApp *</label>
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
                    <label>E-mail do Cliente</label>
                    <input
                      type="email"
                      placeholder="cliente@email.com"
                      value={rentalForm.clientEmail}
                      onChange={(e) => setRentalForm({ ...rentalForm, clientEmail: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Endereço / Cidade</label>
                    <input
                      type="text"
                      placeholder="Rua, Bairro, Cidade"
                      value={rentalForm.clientAddress}
                      onChange={(e) => setRentalForm({ ...rentalForm, clientAddress: e.target.value })}
                    />
                  </div>
                </div>

                <div className="pane-section-header" style={{ marginTop: '24px' }}>
                  <Calendar size={16} className="text-gold" />
                  <h2>2. Período da Locação &amp; Prazos</h2>
                </div>

                <div className="form-group-grid">
                  <div className="form-group">
                    <label>Data de Retirada</label>
                    <input
                      type="date"
                      required
                      value={rentalForm.startDate}
                      onChange={(e) => setRentalForm({ ...rentalForm, startDate: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Horário de Retirada</label>
                    <input
                      type="time"
                      value={rentalForm.startTime}
                      onChange={(e) => setRentalForm({ ...rentalForm, startTime: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Data Limite de Devolução *</label>
                    <input
                      type="date"
                      required
                      value={rentalForm.endDate}
                      onChange={(e) => setRentalForm({ ...rentalForm, endDate: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Horário Limite de Devolução</label>
                    <input
                      type="time"
                      value={rentalForm.endTime}
                      onChange={(e) => setRentalForm({ ...rentalForm, endTime: e.target.value })}
                    />
                  </div>
                </div>

                <div className="rental-duration-banner">
                  <Clock size={16} className="text-gold" />
                  <span>Duração Total Estimada: <strong>{rentalDays} diária(s)</strong></span>
                </div>

                <div className="pane-section-header" style={{ marginTop: '24px' }}>
                  <DollarSign size={16} className="text-gold" />
                  <h2>3. Pagamento &amp; Observações</h2>
                </div>

                <div className="form-group-grid">
                  <div className="form-group">
                    <label>Forma de Pagamento</label>
                    <select
                      value={rentalForm.paymentMethod}
                      onChange={(e) => setRentalForm({ ...rentalForm, paymentMethod: e.target.value })}
                    >
                      <option value="PIX">PIX (À Vista)</option>
                      <option value="Cartão de Crédito">Cartão de Crédito</option>
                      <option value="Cartão de Débito">Cartão de Débito</option>
                      <option value="Dinheiro">Dinheiro</option>
                      <option value="Transferência / DOC">Transferência Bancária</option>
                      <option value="Faturado / Boleto">Faturado / Boleto</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Status do Pagamento</label>
                    <select
                      value={rentalForm.paymentStatus}
                      onChange={(e) => setRentalForm({ ...rentalForm, paymentStatus: e.target.value })}
                    >
                      <option value="Pendente">Pendente (Não Pago)</option>
                      <option value="Pago">Pago (Quitado)</option>
                      <option value="Caução Recebido">Caução / Parcial</option>
                    </select>

                    {rentalForm.paymentStatus !== 'Pago' ? (
                      <div className="payment-status-alert alert-pending">
                        <Calendar size={15} />
                        <span>
                          <strong>Pagamento não realizado:</strong> Você pode <u>Agendar / Reservar</u> para garantir o equipamento bloqueado para a data desejada, ou iniciar a locação direta.
                        </span>
                      </div>
                    ) : (
                      <div className="payment-status-alert alert-paid">
                        <CheckCircle2 size={15} />
                        <span>
                          <strong>Pagamento confirmado:</strong> O termo oficial de locação será emitido com quitação registrada.
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Desconto Concedido (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={rentalForm.discount}
                      onChange={(e) => setRentalForm({ ...rentalForm, discount: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Observações / Acessórios Adicionais</label>
                    <input
                      type="text"
                      placeholder="Ex: Acompanha 2 baterias extras e carregador..."
                      value={rentalForm.notes}
                      onChange={(e) => setRentalForm({ ...rentalForm, notes: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Coluna Direita: Seleção de Equipamentos & Carrinho */}
              <div className="rental-cart-pane">
                <div className="cart-header">
                  <div className="cart-title">
                    <Package size={18} className="text-gold" />
                    <h2>Equipamentos Selecionados ({cartItems.length})</h2>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() => setActiveTab('catalog')}
                  >
                    + Explorar Catálogo
                  </button>
                </div>

                {cartItems.length === 0 ? (
                  <div className="cart-empty-box">
                    <Package size={36} className="text-muted" />
                    <p>Nenhum equipamento adicionado ainda.</p>
                    <small>Escolha os equipamentos no catálogo ou selecione abaixo.</small>
                  </div>
                ) : (
                  <div className="cart-items-list">
                    {cartItems.map((item) => (
                      <div key={item.equipmentId} className="cart-item-row">
                        <div className="cir-info">
                          <strong className="cir-name">{item.name}</strong>
                          <span className="cir-meta">
                            {formatCurrency(item.dailyRate)}/{item.rateUnit || 'dia'} • {CATEGORY_LABELS[item.category] || item.category}
                          </span>
                        </div>

                        <div className="cir-controls">
                          <button
                            type="button"
                            className="cir-btn-qty"
                            onClick={() => handleUpdateCartQuantity(item.equipmentId, -1)}
                          >
                            -
                          </button>
                          <span className="cir-qty">{item.quantity}</span>
                          <button
                            type="button"
                            className="cir-btn-qty"
                            onClick={() => handleUpdateCartQuantity(item.equipmentId, 1)}
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
                  <label>Adicionar Rápido do Estoque:</label>
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
                      -- Selecione um equipamento disponível --
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
                  <div className="cs-row">
                    <span>Subtotal ({rentalDays} diárias):</span>
                    <span>{formatCurrency(cartSubtotal)}</span>
                  </div>

                  {Number(rentalForm.discount) > 0 && (
                    <div className="cs-row discount">
                      <span>Desconto:</span>
                      <span>- {formatCurrency(rentalForm.discount)}</span>
                    </div>
                  )}

                  <div className="cs-row cs-total">
                    <span>VALOR TOTAL:</span>
                    <span>{formatCurrency(cartTotalAmount)}</span>
                  </div>

                  {rentalForm.paymentStatus !== 'Pago' ? (
                    <div className="reservation-action-group">
                      <button
                        type="button"
                        className="btn-primary btn-reserve-contract"
                        disabled={cartItems.length === 0}
                        onClick={(e) => handleCreateRental(e, 'reserved')}
                      >
                        <Calendar size={17} />
                        <span>📅 Agendar / Reservar Equipamentos</span>
                      </button>
                      <button
                        type="button"
                        className="btn-secondary btn-direct-rental"
                        disabled={cartItems.length === 0}
                        onClick={(e) => handleCreateRental(e, 'active')}
                        title="Inicia a locação imediatamente mesmo com pagamento pendente"
                      >
                        <Zap size={15} />
                        <span>⚡ Iniciar Locação Imediata (Pendente)</span>
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
                      <span>🚀 Gerar Locação &amp; Emitir Termo</span>
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
                                />
                              ))}
                              {(rental.returnPhotos || []).slice(0, 3).map((p, idx) => (
                                <img
                                  key={`r-${idx}`}
                                  src={p.url}
                                  alt="Retorno"
                                  className={`erc-mini-thumb return-thumb ${p.condition === 'damage' ? 'damaged-thumb' : ''}`}
                                  title={`Retorno: ${p.caption || p.equipmentName}`}
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

                        {isReserved ? (
                          <>
                            <button
                              type="button"
                              className="btn-primary btn-sm btn-activate-reservation"
                              onClick={() => handleActivateReservation(rental)}
                              title="Confirma pagamento e transforma a reserva em locação ativa"
                            >
                              <CheckCircle2 size={14} /> Confirmar Pagamento &amp; Iniciar Locação
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
                                    setReturningRental(rental);
                                    setReturnNotes('');
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
                          src={getEquipPhotoUrl(editEquipPhoto)}
                          alt="Prévia do Equipamento"
                          className="equip-photo-img-contain"
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

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setReturningRental(null)}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn-primary btn-confirm-return"
                  onClick={handleConfirmReturn}
                >
                  <CheckCircle2 size={16} /> Confirmar Devolução &amp; Liberar Estoque
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
          }}
        />
      )}
    </div>
  );
}

