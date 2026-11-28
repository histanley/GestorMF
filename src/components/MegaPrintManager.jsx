import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Printer,
  Plus,
  Search,
  Filter,
  FileText,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  Calendar,
  User,
  Phone,
  Mail,
  MapPin,
  Trash2,
  Edit,
  Eye,
  Share2,
  Download,
  ArrowRight,
  Package,
  Layers,
  Sparkles,
  Maximize2,
  RefreshCw,
  ShoppingBag,
  Send,
  X,
  CreditCard,
  Percent,
  Calculator,
  Sliders,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import {
  apiGetMegaPrintData,
  apiSaveMegaPrintQuote,
  apiDeleteMegaPrintQuote,
  apiConvertQuoteToSale,
  apiUpdateSaleStatus,
  apiDeleteMegaPrintSale,
  apiSaveMegaPrintItem,
  apiDeleteMegaPrintItem,
  apiSaveMegaPrintClient
} from '../utils/api';
import { alertDialog, confirmDialog } from '../utils/dialog';

function formatDateBR(dateStr) {
  if (!dateStr) return '';
  const parts = String(dateStr).split('T')[0].split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

export default function MegaPrintManager({ currentUser, members = [] }) {
  // Sub-abas do Módulo Comercial
  const [activeSubTab, setActiveSubTab] = useState('quotes'); // 'quotes' | 'sales' | 'items' | 'clients'
  
  // Modos de visualização para Orçamentos: 'table' | 'cards' | 'list'
  const [viewMode, setViewMode] = useState('table');

  // Estados principais de dados
  const [quotes, setQuotes] = useState([]);
  const [sales, setSales] = useState([]);
  const [items, setItems] = useState([]);
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filtros e busca
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'Pendente' | 'Aprovado' | 'Vencido'

  // Modal de Criação / Edição de Orçamento
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState(null);

  // Modal de Visualização & Impressão do Orçamento
  const [previewQuote, setPreviewQuote] = useState(null);

  // Modal de Cadastro de Item (Produto / Serviço)
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Formulário do Orçamento
  const [quoteForm, setQuoteForm] = useState({
    id: '',
    client_name: '',
    client_phone: '',
    client_email: '',
    client_document: '',
    seller_name: currentUser?.name || 'Vendedor Mega Print',
    issue_date: new Date().toISOString().split('T')[0],
    expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    payment_method: '50% entrada + 50% na retirada',
    delivery_deadline: '2 a 3 dias úteis após aprovação da arte',
    notes: '',
    discount: 0,
    items: []
  });

  // Formulário de Item em edição dentro do orçamento
  const [newItemRow, setNewItemRow] = useState({
    item_id: '',
    name: '',
    category: 'Impressão',
    calc_type: 'm2', // 'm2' | 'unit'
    width: '', // metros
    height: '', // metros
    m2: 0,
    quantity: 1,
    unit_price: 0,
    finishing: '', // Acabamento: Ilhós, Bainha, Laminação, etc.
    total: 0
  });

  // Formulário de Cadastro de Produto / Serviço
  const [itemForm, setItemForm] = useState({
    id: '',
    name: '',
    type: 'product',
    calc_type: 'm2',
    category: 'Lonas & Banners',
    price: 0,
    cost: 0,
    unit_label: 'm²',
    min_m2: 0,
    description: '',
    stock_qty: 0
  });

  // Carrega dados iniciais
  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await apiGetMegaPrintData();
      if (res && res.success) {
        setQuotes(res.quotes || []);
        setSales(res.sales || []);
        setItems(res.items || []);
        setClients(res.clients || []);
      }
    } catch (err) {
      console.warn('Erro ao carregar dados Mega Print:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // -------------------------------------------------------------
  // Cálculos de KPIs
  // -------------------------------------------------------------
  const metrics = useMemo(() => {
    const totalQuotes = quotes.length;
    const pendingQuotes = quotes.filter((q) => q.status === 'Pendente');
    const approvedQuotes = quotes.filter((q) => q.status === 'Aprovado');
    const expiredQuotes = quotes.filter((q) => {
      if (q.status === 'Aprovado' || q.status === 'Cancelado') return false;
      if (!q.expiry_date) return false;
      return q.expiry_date < new Date().toISOString().split('T')[0];
    });

    const totalPotential = quotes.reduce((acc, q) => acc + (q.total || 0), 0);
    const approvedRevenue = sales.reduce((acc, s) => acc + (s.total || 0), 0);
    const inProductionCount = sales.filter((s) => s.production_status === 'Em Produção' || s.production_status === 'Acabamento').length;

    return {
      totalQuotes,
      pendingCount: pendingQuotes.length,
      approvedCount: approvedQuotes.length,
      expiredCount: expiredQuotes.length,
      totalPotential,
      approvedRevenue,
      inProductionCount
    };
  }, [quotes, sales]);

  // Filtro de Orçamentos
  const filteredQuotes = useMemo(() => {
    return quotes.filter((q) => {
      const qText = `${q.code || ''} ${q.client_name || ''} ${q.client_phone || ''} ${q.notes || ''}`.toLowerCase();
      const matchesSearch = !searchQuery || qText.includes(searchQuery.toLowerCase());
      
      let matchesStatus = true;
      if (statusFilter === 'Pendente') matchesStatus = q.status === 'Pendente';
      else if (statusFilter === 'Aprovado') matchesStatus = q.status === 'Aprovado';
      else if (statusFilter === 'Vencido') {
        matchesStatus = q.status !== 'Aprovado' && q.expiry_date && q.expiry_date < new Date().toISOString().split('T')[0];
      }

      return matchesSearch && matchesStatus;
    });
  }, [quotes, searchQuery, statusFilter]);

  // Agrupamento para modo Lista (Últimos 7 dias, Este mês, Mais antigos)
  const groupedQuotes = useMemo(() => {
    const today = new Date();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];

    const last7 = [];
    const thisMonth = [];
    const older = [];

    filteredQuotes.forEach((q) => {
      const d = q.issue_date || '';
      if (d >= sevenDaysAgo) {
        last7.push(q);
      } else if (d >= firstDayOfMonth) {
        thisMonth.push(q);
      } else {
        older.push(q);
      }
    });

    return { last7, thisMonth, older };
  }, [filteredQuotes]);

  // -------------------------------------------------------------
  // Handlers do Formulário de Orçamento & Itens
  // -------------------------------------------------------------
  const handleOpenNewQuote = (quoteToEdit = null) => {
    if (quoteToEdit) {
      setEditingQuote(quoteToEdit);
      setQuoteForm({
        id: quoteToEdit.id,
        code: quoteToEdit.code,
        client_name: quoteToEdit.client_name || '',
        client_phone: quoteToEdit.client_phone || '',
        client_email: quoteToEdit.client_email || '',
        client_document: quoteToEdit.client_document || '',
        seller_name: quoteToEdit.seller_name || currentUser?.name || 'Mega Print',
        issue_date: quoteToEdit.issue_date || new Date().toISOString().split('T')[0],
        expiry_date: quoteToEdit.expiry_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        payment_method: quoteToEdit.payment_method || '50% entrada + 50% na retirada',
        delivery_deadline: quoteToEdit.delivery_deadline || '2 a 3 dias úteis',
        notes: quoteToEdit.notes || '',
        discount: quoteToEdit.discount || 0,
        items: Array.isArray(quoteToEdit.items) ? [...quoteToEdit.items] : []
      });
    } else {
      setEditingQuote(null);
      setQuoteForm({
        id: '',
        client_name: '',
        client_phone: '',
        client_email: '',
        client_document: '',
        seller_name: currentUser?.name || 'Mega Print',
        issue_date: new Date().toISOString().split('T')[0],
        expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        payment_method: '50% entrada + 50% na retirada',
        delivery_deadline: '2 a 3 dias úteis após aprovação da arte',
        notes: '',
        discount: 0,
        items: []
      });
    }

    // Reseta linha de novo item
    setNewItemRow({
      item_id: '',
      name: '',
      category: 'Impressão',
      calc_type: 'm2',
      width: '',
      height: '',
      m2: 0,
      quantity: 1,
      unit_price: 0,
      finishing: '',
      total: 0
    });

    setIsQuoteModalOpen(true);
  };

  // Ao selecionar um produto/serviço no dropdown rápido
  const handleSelectCatalogItem = (itemId) => {
    const it = items.find((x) => x.id === itemId);
    if (!it) return;

    const calcType = it.calc_type || 'unit';
    const unitPrice = Number(it.price || 0);

    setNewItemRow((prev) => {
      const qty = prev.quantity || 1;
      let total = 0;
      let m2 = 0;

      if (calcType === 'm2') {
        const w = parseFloat(prev.width) || 0;
        const h = parseFloat(prev.height) || 0;
        m2 = parseFloat((w * h).toFixed(2));
        const effectiveM2 = it.min_m2 && m2 < it.min_m2 ? it.min_m2 : m2;
        total = parseFloat((effectiveM2 * unitPrice * qty).toFixed(2));
      } else {
        total = parseFloat((qty * unitPrice).toFixed(2));
      }

      return {
        ...prev,
        item_id: it.id,
        name: it.name,
        category: it.category,
        calc_type: calcType,
        unit_price: unitPrice,
        m2,
        total
      };
    });
  };

  // Recalcula o item quando medidas ou quantidade mudam
  const handleItemDimChange = (field, val) => {
    setNewItemRow((prev) => {
      const next = { ...prev, [field]: val };
      const qty = parseFloat(field === 'quantity' ? val : next.quantity) || 1;
      const unitPrice = parseFloat(field === 'unit_price' ? val : next.unit_price) || 0;

      if (next.calc_type === 'm2') {
        const w = parseFloat(field === 'width' ? val : next.width) || 0;
        const h = parseFloat(field === 'height' ? val : next.height) || 0;
        const m2 = parseFloat((w * h).toFixed(2));
        next.m2 = m2;
        next.total = parseFloat((m2 * unitPrice * qty).toFixed(2));
      } else {
        next.total = parseFloat((qty * unitPrice).toFixed(2));
      }

      return next;
    });
  };

  // Adicionar item à tabela do orçamento
  const handleAddItemToQuote = () => {
    if (!newItemRow.name.trim()) {
      alertDialog({ title: 'Atenção', message: 'Informe a descrição ou selecione um produto/serviço.', variant: 'warning' });
      return;
    }
    if (newItemRow.calc_type === 'm2' && (!newItemRow.width || !newItemRow.height)) {
      alertDialog({ title: 'Medidas Obrigatórias', message: 'Para itens em m², informe a Largura e a Altura em metros.', variant: 'warning' });
      return;
    }

    const itemToAdd = {
      ...newItemRow,
      id: 'it-' + Date.now() + Math.random().toString(36).substr(2, 4),
      quantity: Number(newItemRow.quantity) || 1,
      unit_price: Number(newItemRow.unit_price) || 0,
      total: Number(newItemRow.total) || 0,
      m2: Number(newItemRow.m2) || 0
    };

    setQuoteForm((prev) => ({
      ...prev,
      items: [...prev.items, itemToAdd]
    }));

    // Limpa campos para o próximo item
    setNewItemRow({
      item_id: '',
      name: '',
      category: 'Impressão',
      calc_type: 'm2',
      width: '',
      height: '',
      m2: 0,
      quantity: 1,
      unit_price: 0,
      finishing: '',
      total: 0
    });
  };

  const handleRemoveItemFromQuote = (index) => {
    setQuoteForm((prev) => {
      const nextItems = [...prev.items];
      nextItems.splice(index, 1);
      return { ...prev, items: nextItems };
    });
  };

  // Subtotal e Total Geral do Orçamento em edição
  const quoteSubtotal = useMemo(() => {
    return quoteForm.items.reduce((acc, it) => acc + (Number(it.total) || 0), 0);
  }, [quoteForm.items]);

  const quoteTotal = useMemo(() => {
    const disc = Number(quoteForm.discount) || 0;
    return Math.max(0, quoteSubtotal - disc);
  }, [quoteSubtotal, quoteForm.discount]);

  // Salvar Orçamento
  const handleSaveQuote = async (e) => {
    e.preventDefault();
    if (!quoteForm.client_name.trim()) {
      await alertDialog({ title: 'Campo Obrigatório', message: 'Por favor, informe o nome do cliente.', variant: 'warning' });
      return;
    }
    if (quoteForm.items.length === 0) {
      await alertDialog({ title: 'Adicione Itens', message: 'O orçamento precisa ter pelo menos 1 produto ou serviço adicionado.', variant: 'warning' });
      return;
    }

    try {
      const payload = {
        ...quoteForm,
        subtotal: quoteSubtotal,
        total: quoteTotal
      };
      const res = await apiSaveMegaPrintQuote(payload);
      if (res && res.success) {
        setIsQuoteModalOpen(false);
        loadData();
      } else {
        alertDialog({ title: 'Erro', message: res?.error || 'Não foi possível salvar o orçamento.', variant: 'danger' });
      }
    } catch (err) {
      alertDialog({ title: 'Erro de Conexão', message: 'Falha ao salvar orçamento no servidor.', variant: 'danger' });
    }
  };

  // Excluir Orçamento
  const handleDeleteQuote = async (quote) => {
    const ok = await confirmDialog({
      title: 'Excluir Orçamento',
      message: `Tem certeza que deseja excluir o orçamento #${quote.code} de ${quote.client_name}?`,
      confirmText: 'Sim, Excluir',
      cancelText: 'Cancelar',
      variant: 'danger'
    });
    if (!ok) return;

    try {
      const res = await apiDeleteMegaPrintQuote(quote.id);
      if (res && res.success) {
        loadData();
      }
    } catch (err) {
      alertDialog({ title: 'Erro', message: 'Falha ao excluir orçamento.', variant: 'danger' });
    }
  };

  // Converter Orçamento em Venda / Pedido
  const handleConvertToSale = async (quote) => {
    const ok = await confirmDialog({
      title: 'Aprovar Orçamento & Enviar para Produção',
      message: `Deseja aprovar o orçamento #${quote.code} de ${quote.client_name} (R$ ${Number(quote.total).toFixed(2)}) e gerar a Ordem de Venda/Produção?`,
      confirmText: 'Aprovar e Gerar Pedido',
      cancelText: 'Cancelar',
      variant: 'primary'
    });
    if (!ok) return;

    try {
      const res = await apiConvertQuoteToSale(quote.id, {
        delivery_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        paid_amount: quote.total
      });
      if (res && res.success) {
        if (previewQuote) setPreviewQuote(null);
        await alertDialog({
          title: 'Orçamento Aprovado!',
          message: res.message || 'Pedido gerado com sucesso e encaminhado para a equipe de produção!',
          variant: 'success'
        });
        loadData();
        setActiveSubTab('sales');
      } else {
        alertDialog({ title: 'Erro', message: res?.error || 'Não foi possível converter em venda.', variant: 'danger' });
      }
    } catch (err) {
      alertDialog({ title: 'Erro de Conexão', message: 'Falha ao converter orçamento.', variant: 'danger' });
    }
  };

  // Compartilhar Orçamento no WhatsApp
  const handleShareQuoteWhatsApp = (quote) => {
    const phone = (quote.client_phone || '').replace(/\D/g, '');
    let text = `*ORÇAMENTO MEGA PRINT — #${quote.code}*\n`;
    text += `Olá, *${quote.client_name}*! Segue a proposta comercial solicitada:\n\n`;

    (quote.items || []).forEach((it, idx) => {
      text += `*${idx + 1}. ${it.name}*\n`;
      if (it.calc_type === 'm2') {
        text += `   Medidas: ${it.width}m x ${it.height}m (${it.m2}m²)\n`;
      }
      text += `   Qtd: ${it.quantity} un | Subtotal: R$ ${Number(it.total).toFixed(2)}\n`;
      if (it.finishing) text += `   Acabamento: ${it.finishing}\n`;
    });

    if (quote.discount > 0) {
      text += `\nSubtotal: R$ ${Number(quote.subtotal).toFixed(2)}`;
      text += `\nDesconto Especial: -R$ ${Number(quote.discount).toFixed(2)}`;
    }
    text += `\n*VALOR TOTAL: R$ ${Number(quote.total).toFixed(2)}*\n\n`;
    text += `💳 Condições: ${quote.payment_method || 'À vista Pix'}\n`;
    text += `⏱️ Prazo de Entrega: ${quote.delivery_deadline || '2 a 3 dias úteis'}\n`;
    text += `📅 Validade da Proposta: até ${formatDateBR(quote.expiry_date)}\n\n`;
    text += `Ficamos à disposição para fecharmos o pedido! Equipe Mega Print.`;

    const encoded = encodeURI(text);
    const url = phone ? `https://wa.me/55${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank');
  };

  // -------------------------------------------------------------
  // Renderização de Badges de Status
  // -------------------------------------------------------------
  const renderStatusBadge = (status, expiryDate) => {
    const isExpired = status !== 'Aprovado' && status !== 'Cancelado' && expiryDate && expiryDate < new Date().toISOString().split('T')[0];
    
    if (isExpired) {
      return (
        <span className="mp-badge mp-badge-expired">
          <Clock size={12} /> Vencido ({formatDateBR(expiryDate)})
        </span>
      );
    }
    if (status === 'Aprovado') {
      return (
        <span className="mp-badge mp-badge-approved">
          <CheckCircle size={12} /> Aprovado / Venda
        </span>
      );
    }
    if (status === 'Recusado' || status === 'Cancelado') {
      return (
        <span className="mp-badge mp-badge-cancelled">
          <XCircle size={12} /> Cancelado
        </span>
      );
    }
    return (
      <span className="mp-badge mp-badge-pending">
        <Clock size={12} /> Ativo / Pendente
      </span>
    );
  };

  return (
    <div className="megaprint-container">
      {/* CABEÇALHO DO MÓDULO COMERCIAL MEGA PRINT */}
      <div className="megaprint-header">
        <div className="mp-header-left">
          <div className="mp-brand-chip">
            <Printer size={20} className="text-orange" />
            <div className="mp-brand-titles">
              <div className="mp-brand-main">
                <strong>MEGA PRINT</strong>
                <span className="mp-tag">Comunicação Visual &amp; Gráfica</span>
              </div>
              <span className="mp-sub">Módulo Integrado de Vendas, Orçamentos e Pedidos</span>
            </div>
          </div>
        </div>

        <div className="mp-header-right">
          <button
            type="button"
            className="mp-btn-action-primary"
            onClick={() => handleOpenNewQuote()}
          >
            <Plus size={16} />
            <span>Novo Orçamento</span>
          </button>
        </div>
      </div>

      {/* KPI STATS CARDS (Inspirados nos prints do usuário) */}
      <div className="mp-kpi-grid">
        <div className="mp-kpi-card mp-kpi-active" onClick={() => setStatusFilter('ALL')}>
          <div className="mp-kpi-num">{metrics.totalQuotes}</div>
          <div className="mp-kpi-lbl">
            <CheckCircle size={15} /> Total Emitidos
          </div>
        </div>
        <div className="mp-kpi-card mp-kpi-pending" onClick={() => setStatusFilter('Pendente')}>
          <div className="mp-kpi-num">{metrics.pendingCount}</div>
          <div className="mp-kpi-lbl">
            <Clock size={15} /> Pendentes
          </div>
        </div>
        <div className="mp-kpi-card mp-kpi-expired" onClick={() => setStatusFilter('Vencido')}>
          <div className="mp-kpi-num">{metrics.expiredCount}</div>
          <div className="mp-kpi-lbl">
            <XCircle size={15} /> Vencidos
          </div>
        </div>
        <div className="mp-kpi-card mp-kpi-finalized" onClick={() => setStatusFilter('Aprovado')}>
          <div className="mp-kpi-num">{metrics.approvedCount}</div>
          <div className="mp-kpi-lbl">
            <ShoppingBag size={15} /> Aprovados (Vendas)
          </div>
        </div>
      </div>

      {/* NAVEGAÇÃO ENTRE SUB-ABAS (ORÇAMENTOS, VENDAS, PRODUTOS, CLIENTES) */}
      <div className="mp-nav-toolbar">
        <div className="mp-nav-tabs">
          <button
            type="button"
            className={`mp-nav-tab ${activeSubTab === 'quotes' ? 'is-active' : ''}`}
            onClick={() => setActiveSubTab('quotes')}
          >
            <FileText size={15} />
            <span>Orçamentos</span>
            <span className="mp-tab-pill">{quotes.length}</span>
          </button>

          <button
            type="button"
            className={`mp-nav-tab ${activeSubTab === 'sales' ? 'is-active' : ''}`}
            onClick={() => setActiveSubTab('sales')}
          >
            <ShoppingBag size={15} />
            <span>Vendas &amp; Produção</span>
            <span className="mp-tab-pill">{sales.length}</span>
          </button>

          <button
            type="button"
            className={`mp-nav-tab ${activeSubTab === 'items' ? 'is-active' : ''}`}
            onClick={() => setActiveSubTab('items')}
          >
            <Layers size={15} />
            <span>Produtos &amp; Serviços</span>
            <span className="mp-tab-pill">{items.length}</span>
          </button>

          <button
            type="button"
            className={`mp-nav-tab ${activeSubTab === 'clients' ? 'is-active' : ''}`}
            onClick={() => setActiveSubTab('clients')}
          >
            <User size={15} />
            <span>Clientes</span>
            <span className="mp-tab-pill">{clients.length}</span>
          </button>
        </div>

        {/* CONTROLES DE VISUALIZAÇÃO (TABELA, CARDS, LISTA) - APENAS NA ABA ORÇAMENTOS */}
        {activeSubTab === 'quotes' && (
          <div className="mp-view-toggles">
            <button
              type="button"
              className={`mp-view-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
              title="Visualização em Tabela"
            >
              Tabela
            </button>
            <button
              type="button"
              className={`mp-view-btn ${viewMode === 'cards' ? 'active' : ''}`}
              onClick={() => setViewMode('cards')}
              title="Visualização em Cards"
            >
              Card
            </button>
            <button
              type="button"
              className={`mp-view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="Visualização em Lista Agrupada"
            >
              Lista
            </button>
          </div>
        )}
      </div>

      {/* BARRA DE FILTRO & BUSCA RÁPIDA */}
      <div className="mp-filter-bar">
        <div className="mp-search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder="Buscar por cliente, código (#MP...), telefone ou detalhes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery('')} className="mp-clear-search">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="mp-filter-chips">
          <button
            type="button"
            className={`mp-chip ${statusFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => setStatusFilter('ALL')}
          >
            Todos ({quotes.length})
          </button>
          <button
            type="button"
            className={`mp-chip ${statusFilter === 'Pendente' ? 'active' : ''}`}
            onClick={() => setStatusFilter('Pendente')}
          >
            Pendentes ({metrics.pendingCount})
          </button>
          <button
            type="button"
            className={`mp-chip ${statusFilter === 'Aprovado' ? 'active' : ''}`}
            onClick={() => setStatusFilter('Aprovado')}
          >
            Aprovados ({metrics.approvedCount})
          </button>
          <button
            type="button"
            className={`mp-chip ${statusFilter === 'Vencido' ? 'active' : ''}`}
            onClick={() => setStatusFilter('Vencido')}
          >
            Vencidos ({metrics.expiredCount})
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* CONTEÚDO PRINCIPAL: ORÇAMENTOS                                  */}
      {/* ============================================================== */}
      {activeSubTab === 'quotes' && (
        <div className="mp-quotes-section">
          {isLoading ? (
            <div className="mp-loading-state">
              <RefreshCw size={24} className="spin" />
              <span>Carregando orçamentos da Mega Print...</span>
            </div>
          ) : filteredQuotes.length === 0 ? (
            <div className="mp-empty-state">
              <FileText size={48} className="text-muted" />
              <h3>Nenhum orçamento encontrado</h3>
              <p>Cadastre um novo orçamento comercial ou ajuste os filtros de busca.</p>
              <button
                type="button"
                className="mp-btn-action-primary"
                onClick={() => handleOpenNewQuote()}
              >
                <Plus size={16} /> Criar Primeiro Orçamento
              </button>
            </div>
          ) : (
            <>
              {/* MODO 1: TABELA */}
              {viewMode === 'table' && (
                <div className="mp-table-responsive">
                  <table className="mp-table">
                    <thead>
                      <tr>
                        <th>ID / Código</th>
                        <th>Cliente</th>
                        <th>Emissão</th>
                        <th>Validade</th>
                        <th>Telefone</th>
                        <th>Itens</th>
                        <th>Valor Total</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredQuotes.map((q) => {
                        const totalItems = (q.items || []).length;
                        return (
                          <tr key={q.id}>
                            <td className="mp-td-code">
                              <strong>#{q.code}</strong>
                            </td>
                            <td>
                              <div className="mp-client-info">
                                <span className="mp-client-name">{q.client_name}</span>
                                {q.client_document && <small className="mp-client-doc">{q.client_document}</small>}
                              </div>
                            </td>
                            <td>{formatDateBR(q.issue_date)}</td>
                            <td>{formatDateBR(q.expiry_date)}</td>
                            <td>{q.client_phone || '—'}</td>
                            <td>
                              <span className="mp-item-count-badge">
                                {totalItems} {totalItems === 1 ? 'item' : 'itens'}
                              </span>
                            </td>
                            <td className="mp-td-val">
                              <strong>R$ {Number(q.total).toFixed(2)}</strong>
                            </td>
                            <td>{renderStatusBadge(q.status, q.expiry_date)}</td>
                            <td style={{ textAlign: 'right' }}>
                              <div className="mp-actions-cluster">
                                <button
                                  type="button"
                                  className="mp-btn-icon"
                                  title="Visualizar e Imprimir Proposta em PDF"
                                  onClick={() => setPreviewQuote(q)}
                                >
                                  <Eye size={15} />
                                </button>
                                <button
                                  type="button"
                                  className="mp-btn-icon text-green"
                                  title="Enviar no WhatsApp do Cliente"
                                  onClick={() => handleShareQuoteWhatsApp(q)}
                                >
                                  <Share2 size={15} />
                                </button>
                                {q.status !== 'Aprovado' && (
                                  <button
                                    type="button"
                                    className="mp-btn-icon text-orange"
                                    title="Aprovar e Enviar para Produção"
                                    onClick={() => handleConvertToSale(q)}
                                  >
                                    <CheckCircle size={15} />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="mp-btn-icon"
                                  title="Editar Orçamento"
                                  onClick={() => handleOpenNewQuote(q)}
                                >
                                  <Edit size={15} />
                                </button>
                                <button
                                  type="button"
                                  className="mp-btn-icon text-danger"
                                  title="Excluir Orçamento"
                                  onClick={() => handleDeleteQuote(q)}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* MODO 2: CARDS (Inspirado no print 6) */}
              {viewMode === 'cards' && (
                <div className="mp-cards-grid">
                  {filteredQuotes.map((q) => {
                    const initials = (q.client_name || 'MP')
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase();

                    return (
                      <div key={q.id} className="mp-quote-card">
                        <div className="mp-card-top">
                          <div className="mp-avatar-circle">{initials}</div>
                          <div className="mp-card-client-wrap">
                            <strong className="mp-card-client-name" title={q.client_name}>
                              {q.client_name}
                            </strong>
                            <span className="mp-card-code">Orçamento #{q.code}</span>
                          </div>
                          {renderStatusBadge(q.status, q.expiry_date)}
                        </div>

                        <div className="mp-card-metrics-box">
                          <div className="mp-cm-item">
                            <span className="mp-cm-lbl">Total:</span>
                            <strong className="mp-cm-val text-green">R$ {Number(q.total).toFixed(2)}</strong>
                          </div>
                          {q.discount > 0 && (
                            <div className="mp-cm-item">
                              <span className="mp-cm-lbl">Desconto:</span>
                              <span className="mp-cm-disc">R$ {Number(q.discount).toFixed(2)}</span>
                            </div>
                          )}
                        </div>

                        <div className="mp-card-footer-info">
                          <span>📅 Emissão: {formatDateBR(q.issue_date)}</span>
                          <span>⏳ Validade: {formatDateBR(q.expiry_date)}</span>
                          <span>📦 Itens: {(q.items || []).length} un</span>
                        </div>

                        <div className="mp-card-actions">
                          <button
                            type="button"
                            className="mp-btn-card-action"
                            onClick={() => setPreviewQuote(q)}
                            title="Ver Proposta Completa"
                          >
                            <Eye size={14} /> Ver
                          </button>
                          <button
                            type="button"
                            className="mp-btn-card-action text-green"
                            onClick={() => handleShareQuoteWhatsApp(q)}
                            title="WhatsApp"
                          >
                            <Share2 size={14} /> WhatsApp
                          </button>
                          {q.status !== 'Aprovado' && (
                            <button
                              type="button"
                              className="mp-btn-card-action text-orange"
                              onClick={() => handleConvertToSale(q)}
                              title="Aprovar e Vender"
                            >
                              <CheckCircle size={14} /> Aprovar
                            </button>
                          )}
                          <button
                            type="button"
                            className="mp-btn-card-action"
                            onClick={() => handleOpenNewQuote(q)}
                            title="Editar"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            type="button"
                            className="mp-btn-card-action text-danger"
                            onClick={() => handleDeleteQuote(q)}
                            title="Excluir"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* MODO 3: LISTA AGRUPADA (Inspirado no print 5) */}
              {viewMode === 'list' && (
                <div className="mp-list-groups">
                  {/* GRUPO 1: Últimos 7 dias */}
                  {groupedQuotes.last7.length > 0 && (
                    <div className="mp-list-group">
                      <div className="mp-list-group-header">
                        <span className="mp-group-indicator orange" />
                        <strong>Últimos 7 dias</strong>
                        <small className="mp-group-count">({groupedQuotes.last7.length} orçamentos)</small>
                      </div>
                      <div className="mp-list-items">
                        {groupedQuotes.last7.map((q) => (
                          <QuoteListItem
                            key={q.id}
                            quote={q}
                            onPreview={() => setPreviewQuote(q)}
                            onWhatsApp={() => handleShareQuoteWhatsApp(q)}
                            onConvert={() => handleConvertToSale(q)}
                            onEdit={() => handleOpenNewQuote(q)}
                            onDelete={() => handleDeleteQuote(q)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* GRUPO 2: Este mês */}
                  {groupedQuotes.thisMonth.length > 0 && (
                    <div className="mp-list-group">
                      <div className="mp-list-group-header">
                        <span className="mp-group-indicator blue" />
                        <strong>Este mês</strong>
                        <small className="mp-group-count">({groupedQuotes.thisMonth.length} orçamentos)</small>
                      </div>
                      <div className="mp-list-items">
                        {groupedQuotes.thisMonth.map((q) => (
                          <QuoteListItem
                            key={q.id}
                            quote={q}
                            onPreview={() => setPreviewQuote(q)}
                            onWhatsApp={() => handleShareQuoteWhatsApp(q)}
                            onConvert={() => handleConvertToSale(q)}
                            onEdit={() => handleOpenNewQuote(q)}
                            onDelete={() => handleDeleteQuote(q)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* GRUPO 3: Anteriores */}
                  {groupedQuotes.older.length > 0 && (
                    <div className="mp-list-group">
                      <div className="mp-list-group-header">
                        <span className="mp-group-indicator purple" />
                        <strong>Anteriores / Histórico</strong>
                        <small className="mp-group-count">({groupedQuotes.older.length} orçamentos)</small>
                      </div>
                      <div className="mp-list-items">
                        {groupedQuotes.older.map((q) => (
                          <QuoteListItem
                            key={q.id}
                            quote={q}
                            onPreview={() => setPreviewQuote(q)}
                            onWhatsApp={() => handleShareQuoteWhatsApp(q)}
                            onConvert={() => handleConvertToSale(q)}
                            onEdit={() => handleOpenNewQuote(q)}
                            onDelete={() => handleDeleteQuote(q)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* CONTEÚDO: VENDAS & PEDIDOS EM PRODUÇÃO                          */}
      {/* ============================================================== */}
      {activeSubTab === 'sales' && (
        <div className="mp-sales-section">
          <div className="mp-section-intro">
            <div>
              <h3>Vendas &amp; Ordens de Produção</h3>
              <p>Acompanhe os pedidos aprovados e o fluxo de acabamento da Mega Print.</p>
            </div>
          </div>

          {sales.length === 0 ? (
            <div className="mp-empty-state">
              <ShoppingBag size={48} className="text-muted" />
              <h3>Nenhuma venda registrada ainda</h3>
              <p>Ao aprovar um orçamento na aba "Orçamentos", o pedido é criado automaticamente aqui.</p>
            </div>
          ) : (
            <div className="mp-table-responsive">
              <table className="mp-table">
                <thead>
                  <tr>
                    <th>Código da Venda</th>
                    <th>Cliente</th>
                    <th>Data da Venda</th>
                    <th>Previsão Entrega</th>
                    <th>Valor Total</th>
                    <th>Status Pagamento</th>
                    <th>Etapa da Produção</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((s) => (
                    <tr key={s.id}>
                      <td className="mp-td-code">
                        <strong>#{s.code}</strong>
                        {s.quote_id && <small className="mp-sale-ref">Ref. Orçamento</small>}
                      </td>
                      <td>
                        <strong>{s.client_name}</strong>
                        {s.client_phone && <small className="mp-client-doc">{s.client_phone}</small>}
                      </td>
                      <td>{formatDateBR(s.sale_date)}</td>
                      <td>{formatDateBR(s.delivery_date)}</td>
                      <td className="mp-td-val">
                        <strong>R$ {Number(s.total).toFixed(2)}</strong>
                      </td>
                      <td>
                        <span className={`mp-badge ${s.payment_status === 'Pago' ? 'mp-badge-approved' : s.payment_status === 'Parcial' ? 'mp-badge-pending' : 'mp-badge-expired'}`}>
                          {s.payment_status || 'Pendente'}
                        </span>
                      </td>
                      <td>
                        <select
                          className="mp-status-select"
                          value={s.production_status || 'Em Produção'}
                          onChange={async (e) => {
                            const newStatus = e.target.value;
                            await apiUpdateSaleStatus(s.id, { production_status: newStatus });
                            loadData();
                          }}
                        >
                          <option value="Aguardando Arte">🎨 Aguardando Arte / Arquivo</option>
                          <option value="Em Produção">🖨️ Em Produção / Impressão</option>
                          <option value="Acabamento">✂️ Acabamento / Refile / Ilhós</option>
                          <option value="Pronto para Retirada">📦 Pronto para Retirada</option>
                          <option value="Entregue">✅ Entregue / Concluído</option>
                        </select>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="mp-btn-icon text-danger"
                          title="Excluir Venda"
                          onClick={async () => {
                            const ok = await confirmDialog({
                              title: 'Excluir Venda',
                              message: `Deseja excluir a venda #${s.code}?`,
                              confirmText: 'Excluir',
                              variant: 'danger'
                            });
                            if (ok) {
                              await apiDeleteMegaPrintSale(s.id);
                              loadData();
                            }
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* CONTEÚDO: CATÁLOGO DE PRODUTOS & SERVIÇOS                       */}
      {/* ============================================================== */}
      {activeSubTab === 'items' && (
        <div className="mp-items-section">
          <div className="mp-section-intro">
            <div>
              <h3>Catálogo de Produtos &amp; Serviços Gráficos</h3>
              <p>Cadastre materiais com precificação por metro quadrado (m²) ou unidade para agilizar seus orçamentos.</p>
            </div>
            <button
              type="button"
              className="mp-btn-action-primary"
              onClick={() => {
                setEditingItem(null);
                setItemForm({
                  id: '',
                  name: '',
                  type: 'product',
                  calc_type: 'm2',
                  category: 'Lonas & Banners',
                  price: 0,
                  cost: 0,
                  unit_label: 'm²',
                  min_m2: 0,
                  description: '',
                  stock_qty: 0
                });
                setIsItemModalOpen(true);
              }}
            >
              <Plus size={16} /> Cadastrar Produto / Serviço
            </button>
          </div>

          <div className="mp-table-responsive">
            <table className="mp-table">
              <thead>
                <tr>
                  <th>Nome do Material / Serviço</th>
                  <th>Tipo</th>
                  <th>Cálculo</th>
                  <th>Categoria</th>
                  <th>Preço de Venda</th>
                  <th>Custo Estimado</th>
                  <th>Mínimo (m²)</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id}>
                    <td>
                      <strong>{it.name}</strong>
                      {it.description && <small className="mp-client-doc">{it.description}</small>}
                    </td>
                    <td>
                      <span className={`mp-badge ${it.type === 'service' ? 'mp-badge-pending' : 'mp-badge-approved'}`}>
                        {it.type === 'service' ? 'Serviço' : 'Produto'}
                      </span>
                    </td>
                    <td>
                      <span className="mp-badge mp-badge-calc">
                        {it.calc_type === 'm2' ? '📐 Metro Quadrado (m²)' : '📦 Unidade / Quantidade'}
                      </span>
                    </td>
                    <td>{it.category}</td>
                    <td className="mp-td-val">
                      <strong>R$ {Number(it.price).toFixed(2)}</strong> /{it.unit_label || 'un'}
                    </td>
                    <td>R$ {Number(it.cost).toFixed(2)}</td>
                    <td>{it.calc_type === 'm2' && it.min_m2 > 0 ? `${it.min_m2} m²` : '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="mp-actions-cluster">
                        <button
                          type="button"
                          className="mp-btn-icon"
                          onClick={() => {
                            setEditingItem(it);
                            setItemForm({ ...it });
                            setIsItemModalOpen(true);
                          }}
                        >
                          <Edit size={15} />
                        </button>
                        <button
                          type="button"
                          className="mp-btn-icon text-danger"
                          onClick={async () => {
                            const ok = await confirmDialog({
                              title: 'Desativar Item',
                              message: `Deseja desativar o item "${it.name}"?`,
                              confirmText: 'Desativar',
                              variant: 'danger'
                            });
                            if (ok) {
                              await apiDeleteMegaPrintItem(it.id);
                              loadData();
                            }
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* CONTEÚDO: CADASTRO DE CLIENTES                                  */}
      {/* ============================================================== */}
      {activeSubTab === 'clients' && (
        <div className="mp-clients-section">
          <div className="mp-section-intro">
            <div>
              <h3>Clientes da Mega Print</h3>
              <p>Base de contatos, empresas e clientes frequentes.</p>
            </div>
          </div>

          <div className="mp-table-responsive">
            <table className="mp-table">
              <thead>
                <tr>
                  <th>Nome / Razão Social</th>
                  <th>Telefone / WhatsApp</th>
                  <th>E-mail</th>
                  <th>CPF / CNPJ</th>
                  <th>Endereço</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.name}</strong></td>
                    <td>{c.phone || '—'}</td>
                    <td>{c.email || '—'}</td>
                    <td>{c.cpf_cnpj || '—'}</td>
                    <td>{c.address || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: CRIAR / EDITAR ORÇAMENTO (COM CALCULADOR M² E UNIDADE) */}
      {/* ============================================================== */}
      {isQuoteModalOpen && (
        <div className="mp-modal-overlay" onClick={() => setIsQuoteModalOpen(false)}>
          <div className="mp-modal-card mp-quote-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="mp-modal-header">
              <div className="mp-modal-title">
                <Printer size={20} className="text-orange" />
                <div>
                  <strong>{editingQuote ? `Editar Orçamento #${editingQuote.code}` : 'Novo Orçamento Comercial'}</strong>
                  <span className="mp-modal-sub">Mega Print Comunicação Visual</span>
                </div>
              </div>
              <button type="button" className="mp-btn-close" onClick={() => setIsQuoteModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveQuote} className="mp-quote-form">
              {/* BLOCO 1: DADOS DO CLIENTE & PROPOSTA */}
              <div className="mp-form-fieldset">
                <div className="mp-fs-legend">
                  <User size={15} /> 1. Dados do Cliente &amp; Proposta
                </div>

                <div className="mp-form-grid-3">
                  <div className="mp-form-group">
                    <label>Nome do Cliente / Empresa *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Tribunal de Justiça, Loja Silva..."
                      value={quoteForm.client_name}
                      onChange={(e) => setQuoteForm({ ...quoteForm, client_name: e.target.value })}
                    />
                  </div>

                  <div className="mp-form-group">
                    <label>WhatsApp / Telefone</label>
                    <input
                      type="text"
                      placeholder="(95) 99999-9999"
                      value={quoteForm.client_phone}
                      onChange={(e) => setQuoteForm({ ...quoteForm, client_phone: e.target.value })}
                    />
                  </div>

                  <div className="mp-form-group">
                    <label>CPF / CNPJ</label>
                    <input
                      type="text"
                      placeholder="00.000.000/0001-00"
                      value={quoteForm.client_document}
                      onChange={(e) => setQuoteForm({ ...quoteForm, client_document: e.target.value })}
                    />
                  </div>
                </div>

                <div className="mp-form-grid-3">
                  <div className="mp-form-group">
                    <label>Vendedor Responsável</label>
                    <input
                      type="text"
                      value={quoteForm.seller_name}
                      onChange={(e) => setQuoteForm({ ...quoteForm, seller_name: e.target.value })}
                    />
                  </div>

                  <div className="mp-form-group">
                    <label>Data de Emissão</label>
                    <input
                      type="date"
                      value={quoteForm.issue_date}
                      onChange={(e) => setQuoteForm({ ...quoteForm, issue_date: e.target.value })}
                    />
                  </div>

                  <div className="mp-form-group">
                    <label>Validade da Proposta</label>
                    <input
                      type="date"
                      value={quoteForm.expiry_date}
                      onChange={(e) => setQuoteForm({ ...quoteForm, expiry_date: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* BLOCO 2: ADIÇÃO INTELIGENTE DE ITENS (COM CALCULADOR M² / UNIDADE) */}
              <div className="mp-form-fieldset">
                <div className="mp-fs-legend">
                  <Calculator size={15} /> 2. Itens do Orçamento (Produtos e Serviços)
                </div>

                {/* ADICIONADOR DE NOVO ITEM */}
                <div className="mp-add-item-box">
                  <div className="mp-form-grid-4">
                    <div className="mp-form-group mp-col-span-2">
                      <label>Catálogo Rápido (Selecione um Produto ou Serviço)</label>
                      <select
                        value={newItemRow.item_id}
                        onChange={(e) => handleSelectCatalogItem(e.target.value)}
                      >
                        <option value="">+ Selecionar do Catálogo ou digitar avulso...</option>
                        {items.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.name} — R$ {Number(it.price).toFixed(2)} ({it.calc_type === 'm2' ? 'por m²' : 'por un'})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="mp-form-group">
                      <label>Modo de Cálculo</label>
                      <select
                        value={newItemRow.calc_type}
                        onChange={(e) => handleItemDimChange('calc_type', e.target.value)}
                      >
                        <option value="m2">📐 Metro Quadrado (m²)</option>
                        <option value="unit">📦 Unidade / Quantidade</option>
                      </select>
                    </div>

                    <div className="mp-form-group">
                      <label>Preço Unitário / m² (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={newItemRow.unit_price}
                        onChange={(e) => handleItemDimChange('unit_price', e.target.value)}
                      />
                    </div>
                  </div>

                  {/* SE FOR CÁLCULO EM M²: MOSTRA LARGURA X ALTURA E ÁREA CALCULADA */}
                  {newItemRow.calc_type === 'm2' ? (
                    <div className="mp-m2-calculator-row">
                      <div className="mp-form-group">
                        <label>Largura (metros)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Ex: 2.50"
                          value={newItemRow.width}
                          onChange={(e) => handleItemDimChange('width', e.target.value)}
                        />
                      </div>

                      <span className="mp-calc-x">×</span>

                      <div className="mp-form-group">
                        <label>Altura (metros)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Ex: 1.20"
                          value={newItemRow.height}
                          onChange={(e) => handleItemDimChange('height', e.target.value)}
                        />
                      </div>

                      <span className="mp-calc-equal">=</span>

                      <div className="mp-form-group mp-m2-preview">
                        <label>Área Calculada</label>
                        <strong>{newItemRow.m2 || 0} m²</strong>
                      </div>

                      <div className="mp-form-group">
                        <label>Quantidade</label>
                        <input
                          type="number"
                          min="1"
                          value={newItemRow.quantity}
                          onChange={(e) => handleItemDimChange('quantity', e.target.value)}
                        />
                      </div>

                      <div className="mp-form-group mp-subtotal-preview">
                        <label>Subtotal do Item</label>
                        <strong className="text-green">R$ {Number(newItemRow.total || 0).toFixed(2)}</strong>
                      </div>
                    </div>
                  ) : (
                    /* SE FOR POR UNIDADE: QUANTIDADE X PREÇO */
                    <div className="mp-unit-calculator-row">
                      <div className="mp-form-group" style={{ flex: '1 1 120px' }}>
                        <label>Quantidade</label>
                        <input
                          type="number"
                          min="1"
                          value={newItemRow.quantity}
                          onChange={(e) => handleItemDimChange('quantity', e.target.value)}
                        />
                      </div>

                      <div className="mp-form-group mp-subtotal-preview" style={{ flex: '1 1 150px' }}>
                        <label>Subtotal do Item</label>
                        <strong className="text-green">R$ {Number(newItemRow.total || 0).toFixed(2)}</strong>
                      </div>
                    </div>
                  )}

                  <div className="mp-form-grid-item-finish">
                    <div className="mp-form-group" style={{ flex: '1 1 300px' }}>
                      <label>Acabamento / Observações do Item (Opcional)</label>
                      <input
                        type="text"
                        placeholder="Ex: Ilhós a cada 30cm, reforço, laminação fosca, corte especial..."
                        value={newItemRow.finishing}
                        onChange={(e) => setNewItemRow({ ...newItemRow, finishing: e.target.value })}
                      />
                    </div>

                    <button
                      type="button"
                      className="mp-btn-add-item"
                      onClick={handleAddItemToQuote}
                    >
                      <Plus size={16} /> Inserir Item no Orçamento
                    </button>
                  </div>
                </div>

                {/* TABELA DE ITENS ADICIONADOS */}
                {quoteForm.items.length > 0 && (
                  <div className="mp-table-responsive" style={{ marginTop: '1rem' }}>
                    <table className="mp-table mp-items-added-table">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Dimensões / Área</th>
                          <th>Qtd</th>
                          <th>Valor Unitário</th>
                          <th>Subtotal</th>
                          <th style={{ width: 50 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {quoteForm.items.map((it, idx) => (
                          <tr key={it.id || idx}>
                            <td>
                              <strong>{it.name}</strong>
                              {it.finishing && <small className="mp-client-doc">{it.finishing}</small>}
                            </td>
                            <td>
                              {it.calc_type === 'm2'
                                ? `${it.width}m × ${it.height}m (${it.m2} m²)`
                                : '—'}
                            </td>
                            <td>{it.quantity}</td>
                            <td>R$ {Number(it.unit_price).toFixed(2)}</td>
                            <td><strong className="text-green">R$ {Number(it.total).toFixed(2)}</strong></td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                className="mp-btn-icon text-danger"
                                onClick={() => handleRemoveItemFromQuote(idx)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* BLOCO 3: FECHAMENTO, CONDIÇÕES & TOTAIS */}
              <div className="mp-form-fieldset">
                <div className="mp-fs-legend">
                  <CreditCard size={15} /> 3. Condições de Pagamento &amp; Totais
                </div>

                <div className="mp-form-grid-3">
                  <div className="mp-form-group">
                    <label>Forma de Pagamento</label>
                    <input
                      type="text"
                      placeholder="Ex: 50% no pedido + 50% na retirada, Cartão 3x..."
                      value={quoteForm.payment_method}
                      onChange={(e) => setQuoteForm({ ...quoteForm, payment_method: e.target.value })}
                    />
                  </div>

                  <div className="mp-form-group">
                    <label>Prazo de Produção / Entrega</label>
                    <input
                      type="text"
                      placeholder="Ex: 2 a 3 dias úteis..."
                      value={quoteForm.delivery_deadline}
                      onChange={(e) => setQuoteForm({ ...quoteForm, delivery_deadline: e.target.value })}
                    />
                  </div>

                  <div className="mp-form-group">
                    <label>Desconto Especial (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={quoteForm.discount}
                      onChange={(e) => setQuoteForm({ ...quoteForm, discount: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div className="mp-quote-summary-bar">
                  <div className="mp-qs-col">
                    <span>Subtotal:</span>
                    <strong>R$ {quoteSubtotal.toFixed(2)}</strong>
                  </div>
                  <div className="mp-qs-col">
                    <span>Desconto:</span>
                    <span className="text-muted">- R$ {Number(quoteForm.discount || 0).toFixed(2)}</span>
                  </div>
                  <div className="mp-qs-col mp-qs-total">
                    <span>Total da Proposta:</span>
                    <strong>R$ {quoteTotal.toFixed(2)}</strong>
                  </div>
                </div>
              </div>

              <div className="mp-modal-actions">
                <button
                  type="button"
                  className="mp-btn-cancel"
                  onClick={() => setIsQuoteModalOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="mp-btn-action-primary"
                >
                  Salvar Orçamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: PROPOSTA COMERCIAL & IMPRESSÃO EM PDF                 */}
      {/* ============================================================== */}
      {previewQuote && (
        <div className="mp-modal-overlay" onClick={() => setPreviewQuote(null)}>
          <div className="mp-modal-card mp-preview-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="mp-preview-actions-bar no-print">
              <div className="mp-pa-left">
                <strong>Orçamento #{previewQuote.code}</strong>
                {renderStatusBadge(previewQuote.status, previewQuote.expiry_date)}
              </div>

              <div className="mp-pa-right">
                <button
                  type="button"
                  className="mp-btn-print"
                  onClick={() => window.print()}
                >
                  <Printer size={15} /> Imprimir / PDF
                </button>
                <button
                  type="button"
                  className="mp-btn-print text-green"
                  onClick={() => handleShareQuoteWhatsApp(previewQuote)}
                >
                  <Share2 size={15} /> WhatsApp
                </button>
                {previewQuote.status !== 'Aprovado' && (
                  <button
                    type="button"
                    className="mp-btn-action-primary"
                    onClick={() => handleConvertToSale(previewQuote)}
                  >
                    <CheckCircle size={15} /> Aprovar Orçamento
                  </button>
                )}
                <button
                  type="button"
                  className="mp-btn-close"
                  onClick={() => setPreviewQuote(null)}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* DOCUMENTO OFICIAL PARA IMPRESSÃO / PDF */}
            <div className="mp-printable-sheet">
              {/* CABEÇALHO MEGA PRINT */}
              <div className="mp-sheet-header">
                <div className="mp-sheet-brand">
                  <div className="mp-sheet-logo-box">
                    <Printer size={32} />
                  </div>
                  <div>
                    <h2 className="mp-sheet-title">MEGA PRINT</h2>
                    <p className="mp-sheet-subtitle">COMUNICAÇÃO VISUAL &amp; GRÁFICA RÁPIDA</p>
                    <small className="mp-sheet-contact">
                      CNPJ: 00.000.000/0001-00 • R. Sardinha, 1061 - Tancredo Neves, Boa Vista - RR
                      <br />Telefone / WhatsApp: (95) 99999-9999 • contato@megaprint.com.br
                    </small>
                  </div>
                </div>

                <div className="mp-sheet-number-box">
                  <span className="mp-snb-label">PROPOSTA COMERCIAL</span>
                  <strong className="mp-snb-code">#{previewQuote.code}</strong>
                  <span className="mp-snb-date">Emissão: {formatDateBR(previewQuote.issue_date)}</span>
                  <span className="mp-snb-date">Validade: {formatDateBR(previewQuote.expiry_date)}</span>
                </div>
              </div>

              {/* DADOS DO CLIENTE */}
              <div className="mp-sheet-section">
                <div className="mp-sheet-section-title">DADOS DO CLIENTE</div>
                <div className="mp-sheet-client-grid">
                  <div><strong>Cliente:</strong> {previewQuote.client_name}</div>
                  <div><strong>Telefone:</strong> {previewQuote.client_phone || 'Não informado'}</div>
                  <div><strong>CPF/CNPJ:</strong> {previewQuote.client_document || 'Não informado'}</div>
                  <div><strong>Vendedor:</strong> {previewQuote.seller_name || 'Mega Print'}</div>
                </div>
              </div>

              {/* TABELA DE ITENS */}
              <div className="mp-sheet-section">
                <div className="mp-sheet-section-title">ITENS &amp; ESPECIFICAÇÕES TÉCNICAS</div>
                <table className="mp-sheet-table">
                  <thead>
                    <tr>
                      <th style={{ width: '4%' }}>Item</th>
                      <th style={{ width: '46%' }}>Descrição do Material / Serviço</th>
                      <th style={{ width: '18%' }}>Dimensões</th>
                      <th style={{ width: '8%', textAlign: 'center' }}>Qtd</th>
                      <th style={{ width: '12%', textAlign: 'right' }}>Unitário</th>
                      <th style={{ width: '12%', textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(previewQuote.items || []).map((it, idx) => (
                      <tr key={idx}>
                        <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                        <td>
                          <strong>{it.name}</strong>
                          {it.finishing && <div className="mp-sheet-finish">Acabamento: {it.finishing}</div>}
                        </td>
                        <td>
                          {it.calc_type === 'm2'
                            ? `${it.width}m × ${it.height}m (${it.m2} m²)`
                            : '—'}
                        </td>
                        <td style={{ textAlign: 'center' }}>{it.quantity}</td>
                        <td style={{ textAlign: 'right' }}>R$ {Number(it.unit_price).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}><strong>R$ {Number(it.total).toFixed(2)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* CONDIÇÕES E TOTAIS */}
              <div className="mp-sheet-footer-grid">
                <div className="mp-sheet-terms">
                  <div className="mp-sheet-terms-title">CONDIÇÕES COMERCIAIS &amp; PRODUÇÃO</div>
                  <p><strong>Forma de Pagamento:</strong> {previewQuote.payment_method || 'À vista Pix'}</p>
                  <p><strong>Prazo de Entrega:</strong> {previewQuote.delivery_deadline || '2 a 3 dias úteis após aprovação'}</p>
                  <p><strong>Validade da Proposta:</strong> até {formatDateBR(previewQuote.expiry_date)}</p>
                  {previewQuote.notes && (
                    <p className="mp-sheet-notes"><strong>Observações:</strong> {previewQuote.notes}</p>
                  )}
                  <div className="mp-sheet-pix-box">
                    <strong>Chave Pix para Sinal / Pagamento:</strong> (95) 99999-9999 (Mega Print)
                  </div>
                </div>

                <div className="mp-sheet-totals-box">
                  <div className="mp-st-row">
                    <span>Subtotal:</span>
                    <span>R$ {Number(previewQuote.subtotal).toFixed(2)}</span>
                  </div>
                  {previewQuote.discount > 0 && (
                    <div className="mp-st-row mp-st-disc">
                      <span>Desconto Especial:</span>
                      <span>- R$ {Number(previewQuote.discount).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="mp-st-row mp-st-grand">
                    <span>VALOR TOTAL:</span>
                    <strong>R$ {Number(previewQuote.total).toFixed(2)}</strong>
                  </div>
                </div>
              </div>

              {/* LINHAS DE ASSINATURA */}
              <div className="mp-sheet-signatures">
                <div className="mp-sig-box">
                  <div className="mp-sig-line" />
                  <span>MEGA PRINT COMUNICAÇÃO VISUAL</span>
                </div>
                <div className="mp-sig-box">
                  <div className="mp-sig-line" />
                  <span>DE ACORDO: {previewQuote.client_name}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: CADASTRO / EDIÇÃO DE PRODUTO OU SERVIÇO               */}
      {/* ============================================================== */}
      {isItemModalOpen && (
        <div className="mp-modal-overlay" onClick={() => setIsItemModalOpen(false)}>
          <div className="mp-modal-card" style={{ maxWidth: 550 }} onClick={(e) => e.stopPropagation()}>
            <div className="mp-modal-header">
              <div className="mp-modal-title">
                <Layers size={18} className="text-orange" />
                <strong>{editingItem ? 'Editar Item' : 'Novo Produto ou Serviço'}</strong>
              </div>
              <button type="button" className="mp-btn-close" onClick={() => setIsItemModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const res = await apiSaveMegaPrintItem(itemForm);
                if (res && res.success) {
                  setIsItemModalOpen(false);
                  loadData();
                }
              }}
              className="mp-item-form"
            >
              <div className="mp-form-group">
                <label>Nome do Produto ou Serviço *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Lona Frontlight 440g, Adesivo Vinil..."
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                />
              </div>

              <div className="mp-form-grid-2">
                <div className="mp-form-group">
                  <label>Tipo</label>
                  <select
                    value={itemForm.type}
                    onChange={(e) => setItemForm({ ...itemForm, type: e.target.value })}
                  >
                    <option value="product">Produto Físico</option>
                    <option value="service">Serviço de Campo / Mão de Obra</option>
                  </select>
                </div>

                <div className="mp-form-group">
                  <label>Modo de Cálculo Principal</label>
                  <select
                    value={itemForm.calc_type}
                    onChange={(e) => setItemForm({ ...itemForm, calc_type: e.target.value })}
                  >
                    <option value="m2">📐 Metro Quadrado (m²)</option>
                    <option value="unit">📦 Unidade / Quantidade</option>
                  </select>
                </div>
              </div>

              <div className="mp-form-grid-2">
                <div className="mp-form-group">
                  <label>Categoria</label>
                  <input
                    type="text"
                    placeholder="Ex: Lonas, Adesivos, Fachadas..."
                    value={itemForm.category}
                    onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                  />
                </div>

                <div className="mp-form-group">
                  <label>Preço de Venda (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={itemForm.price}
                    onChange={(e) => setItemForm({ ...itemForm, price: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="mp-form-grid-2">
                <div className="mp-form-group">
                  <label>Custo Estimado (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={itemForm.cost}
                    onChange={(e) => setItemForm({ ...itemForm, cost: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                <div className="mp-form-group">
                  <label>Área Mínima (m²)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="0.0"
                    value={itemForm.min_m2}
                    onChange={(e) => setItemForm({ ...itemForm, min_m2: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="mp-form-group">
                <label>Descrição / Especificações Técnicas</label>
                <textarea
                  rows={2}
                  placeholder="Detalhes do material, gramatura, acabamentos suportados..."
                  value={itemForm.description}
                  onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                />
              </div>

              <div className="mp-modal-actions">
                <button type="button" className="mp-btn-cancel" onClick={() => setIsItemModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="mp-btn-action-primary">
                  Salvar Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Subcomponente de Item na visualização em Lista (Inspirado no print 5)
function QuoteListItem({ quote, onPreview, onWhatsApp, onConvert, onEdit, onDelete }) {
  const initials = (quote.client_name || 'MP')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const totalItems = (quote.items || []).length;

  return (
    <div className="mp-list-item-row">
      <div className="mp-lir-avatar">{initials}</div>
      <div className="mp-lir-client">
        <strong className="mp-lir-name">{quote.client_name}</strong>
        <span className="mp-lir-sub">
          Nº {quote.code} • Emissão: {formatDateBR(quote.issue_date)} • Validade: {formatDateBR(quote.expiry_date)}
        </span>
      </div>

      <div className="mp-lir-metric">
        <span className="mp-lir-lbl">TOTAL</span>
        <strong className="mp-lir-val">R$ {Number(quote.total).toFixed(2)}</strong>
      </div>

      <div className="mp-lir-items">
        <span className="mp-lir-lbl">ITENS</span>
        <span className="mp-lir-items-tag">{totalItems} ({totalItems}P / 0S)</span>
      </div>

      <div className="mp-lir-status">
        <span className={`mp-badge ${quote.status === 'Aprovado' ? 'mp-badge-approved' : 'mp-badge-pending'}`}>
          {quote.status}
        </span>
      </div>

      <div className="mp-lir-actions">
        <button type="button" className="mp-btn-icon" onClick={onPreview} title="Ver Proposta">
          <Eye size={15} />
        </button>
        <button type="button" className="mp-btn-icon text-green" onClick={onWhatsApp} title="WhatsApp">
          <Share2 size={15} />
        </button>
        {quote.status !== 'Aprovado' && (
          <button type="button" className="mp-btn-icon text-orange" onClick={onConvert} title="Aprovar">
            <CheckCircle size={15} />
          </button>
        )}
        <button type="button" className="mp-btn-icon" onClick={onEdit} title="Editar">
          <Edit size={15} />
        </button>
        <button type="button" className="mp-btn-icon text-danger" onClick={onDelete} title="Excluir">
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}
