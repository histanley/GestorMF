import React, { useState, useMemo, useRef } from 'react';
import {
  X,
  DollarSign,
  Calendar,
  CreditCard,
  Plus,
  Trash2,
  FileText,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  User,
  Clock,
  Sparkles,
  ShieldCheck,
  Paperclip,
  Upload,
  Download,
  Eye,
  FileCheck,
  Printer,
  ExternalLink,
} from 'lucide-react';
import { apiSaveSalaryAdvance, apiDeleteSalaryAdvance, apiAttachSalaryAdvanceReceipt } from '../utils/api';
import { confirmDialog, alertDialog } from '../utils/dialog';

// Formata moeda BRL
function formatBRL(val) {
  const n = Number(val) || 0;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Formata data ISO (AAAA-MM-DD) para PT-BR
function formatDateBR(dateStr) {
  if (!dateStr) return '';
  const parts = String(dateStr).split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

// Nome amigável do mês (YYYY-MM -> Novembro de 2026)
function formatMonthName(monthKey) {
  if (!monthKey || !monthKey.includes('-')) return monthKey || '';
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  const name = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export default function SalaryAdvancesModal({
  isOpen = true,
  onClose = () => {},
  member = null,
  members = [],
  monthKey = '',
  monthLabel = '',
  grossAmount = 0,
  advances = [],
  advancesMap = {},
  onRefresh = () => {},
  onAdvancesChanged = null,
  currentUser = null,
}) {
  const [selectedMemberId, setSelectedMemberId] = useState(() => {
    if (member?.id) return String(member.id);
    if (members && members.length > 0) return String(members[0].id);
    return '';
  });

  const [amountStr, setAmountStr] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('PIX');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Estados de Comprovante de Pagamento
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [receiptFileName, setReceiptFileName] = useState('');
  const [viewingReceipt, setViewingReceipt] = useState(null);
  const [attachingToAdvId, setAttachingToAdvId] = useState(null);

  const fileInputRef = useRef(null);
  const quickAttachInputRef = useRef(null);

  // Colaborador ativo (selecionado no dropdown ou passado diretamente da linha)
  const activeMember = useMemo(() => {
    if (member) return member;
    if (!members || members.length === 0) return null;
    return members.find((m) => String(m.id) === String(selectedMemberId)) || members[0] || null;
  }, [member, members, selectedMemberId]);

  // Lista de vales do colaborador ativo
  const activeAdvances = useMemo(() => {
    if (member && advances && advances.length > 0) {
      return advances;
    }
    if (activeMember && advancesMap) {
      const fromMap = advancesMap[String(activeMember.id)] || advancesMap[activeMember.id];
      if (Array.isArray(fromMap)) return fromMap;
    }
    return advances || [];
  }, [advances, advancesMap, activeMember, member]);

  // Valor bruto do colaborador ativo
  const activeGross = useMemo(() => {
    if (member) return Number(grossAmount) || 0;
    if (activeMember) return Number(activeMember.totalAmount || 0);
    return Number(grossAmount) || 0;
  }, [member, activeMember, grossAmount]);

  // Calcula totais
  const totalAdvances = useMemo(() => {
    return activeAdvances.reduce((acc, a) => acc + (Number(a.amount) || 0), 0);
  }, [activeAdvances]);

  const netBalance = useMemo(() => {
    const gross = Number(activeGross) || 0;
    return Math.max(0, gross - totalAdvances);
  }, [activeGross, totalAdvances]);

  const balanceDeficit = useMemo(() => {
    const gross = Number(activeGross) || 0;
    return totalAdvances > gross ? totalAdvances - gross : 0;
  }, [activeGross, totalAdvances]);

  if (!isOpen) return null;
  if (!activeMember) return null;

  // Lidar com digitação de moeda com máscara
  const handleAmountChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) {
      setAmountStr('');
      return;
    }
    const val = (Number(raw) / 100).toFixed(2);
    setAmountStr(val.replace('.', ','));
  };

  const getAmountNumber = () => {
    if (!amountStr) return 0;
    return Number(amountStr.replace(/\./g, '').replace(',', '.')) || 0;
  };

  // Upload de Comprovante no Formulário de Novo Vale
  const handleReceiptFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alertDialog({
        title: 'Arquivo Muito Grande',
        message: 'O comprovante deve ter no máximo 15 MB.',
        variant: 'warning',
      });
      return;
    }

    setReceiptFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setReceiptPreview(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveReceipt = () => {
    setReceiptPreview(null);
    setReceiptFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Anexar comprovante a vale existente
  const handleTriggerQuickAttach = (advId) => {
    setAttachingToAdvId(advId);
    if (quickAttachInputRef.current) {
      quickAttachInputRef.current.value = '';
      quickAttachInputRef.current.click();
    }
  };

  const handleQuickAttachFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !attachingToAdvId) return;

    if (file.size > 15 * 1024 * 1024) {
      await alertDialog({
        title: 'Arquivo Muito Grande',
        message: 'O comprovante deve ter no máximo 15 MB.',
        variant: 'warning',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const dataUrl = ev.target.result;
        const res = await apiAttachSalaryAdvanceReceipt(attachingToAdvId, dataUrl);
        if (res && res.success) {
          if (onRefresh) onRefresh();
          if (onAdvancesChanged) onAdvancesChanged();
          await alertDialog({
            title: '✅ Comprovante Anexado',
            message: 'O comprovante de pagamento foi salvo e vinculado ao vale com sucesso.',
            variant: 'success',
          });
        } else {
          await alertDialog({
            title: 'Erro ao Anexar',
            message: res?.error || 'Erro ao anexar comprovante no servidor.',
            variant: 'danger',
          });
        }
      } catch (err) {
        await alertDialog({
          title: 'Erro',
          message: err.message,
          variant: 'danger',
        });
      } finally {
        setAttachingToAdvId(null);
      }
    };
    reader.readAsDataURL(file);
  };

  // Submeter novo vale
  const handleCreateAdvance = async (e) => {
    e.preventDefault();
    const valNum = getAmountNumber();

    if (valNum <= 0) {
      await alertDialog({
        title: 'Valor Obrigatório',
        message: 'Informe um valor válido maior que zero para o vale.',
        variant: 'warning',
      });
      return;
    }

    if (!date) {
      await alertDialog({
        title: 'Data Obrigatória',
        message: 'Selecione a data de liberação do vale.',
        variant: 'warning',
      });
      return;
    }

    const desc = description.trim() || 'Adiantamento de Salário';

    const confirmed = await confirmDialog({
      title: 'Confirmar Lançamento de Vale',
      message: `Confirmar a liberação de um vale de ${formatBRL(valNum)} para ${activeMember.name}?`,
      description: `Forma de Pagamento: ${paymentMethod}\nData: ${formatDateBR(date)}\nMotivo: ${desc}${receiptPreview ? '\nComprovante: Anexado' : ''}\n\nEste valor será deduzido automaticamente dos créditos a receber do colaborador no fechamento.`,
      confirmText: 'Conceder Vale',
      cancelText: 'Cancelar',
      variant: 'success',
    });
    if (!confirmed) return;

    try {
      setIsSubmitting(true);
      const res = await apiSaveSalaryAdvance({
        memberId: activeMember.id,
        monthKey: monthKey || date.slice(0, 7),
        date,
        amount: valNum,
        description: desc,
        paymentMethod,
        receiptUrl: receiptPreview || '',
        registeredBy: currentUser?.name || 'Administração',
        registeredById: currentUser?.id || '',
      });

      if (res && res.success) {
        setAmountStr('');
        setDescription('');
        handleRemoveReceipt();
        setDate(new Date().toISOString().slice(0, 10));
        if (onRefresh) onRefresh();
        if (onAdvancesChanged) onAdvancesChanged();
        await alertDialog({
          title: '✅ Vale Concedido com Sucesso!',
          message: `O vale de ${formatBRL(valNum)} para ${activeMember.name} foi lançado no sistema e deduzido da folha de pagamento.`,
          variant: 'success',
        });
      } else {
        await alertDialog({
          title: 'Erro',
          message: res?.error || 'Erro ao registrar vale no servidor.',
          variant: 'danger',
        });
      }
    } catch (err) {
      await alertDialog({
        title: 'Erro',
        message: `Erro ao comunicar com o servidor: ${err.message}`,
        variant: 'danger',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Excluir / Estornar vale
  const handleDeleteAdvance = async (advance) => {
    const confirmed = await confirmDialog({
      title: 'Estornar Vale',
      message: `Deseja realmente estornar/excluir o vale de ${formatBRL(advance.amount)} concedido para ${activeMember.name}?`,
      description: `Data: ${formatDateBR(advance.date)}\nMotivo: ${advance.description || 'Adiantamento'}\n\nAo estornar, o valor voltará a compor os créditos a receber do colaborador no fechamento.`,
      confirmText: 'Estornar Vale',
      cancelText: 'Cancelar',
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      setDeletingId(advance.id);
      const res = await apiDeleteSalaryAdvance(advance.id);
      if (res && res.success) {
        if (onRefresh) onRefresh();
        if (onAdvancesChanged) onAdvancesChanged();
      } else {
        await alertDialog({
          title: 'Erro',
          message: res?.error || 'Erro ao estornar vale.',
          variant: 'danger',
        });
      }
    } catch (err) {
      await alertDialog({
        title: 'Erro',
        message: `Erro ao estornar vale: ${err.message}`,
        variant: 'danger',
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="advances-modal-overlay" onClick={onClose}>
      <div className="advances-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Input Oculto para Anexar Rápido a Vale Existente */}
        <input
          type="file"
          ref={quickAttachInputRef}
          accept="image/*,application/pdf"
          style={{ display: 'none' }}
          onChange={handleQuickAttachFile}
        />

        {/* Cabeçalho */}
        <div className="advances-modal-header">
          <div className="advances-header-left">
            <div className="advances-header-icon-box">
              <Receipt size={22} className="text-amber" />
            </div>
            <div className="advances-header-titles">
              <h3 className="advances-modal-title">Vales &amp; Adiantamentos de Salário</h3>
              <p className="advances-modal-subtitle">
                Colaborador: <strong>{activeMember.name}</strong> • Competência:{' '}
                <span className="text-cyan">{monthLabel || formatMonthName(monthKey)}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            className="advances-close-btn"
            onClick={onClose}
            title="Fechar janela"
          >
            <X size={18} />
          </button>
        </div>

        {/* Aviso de Permissão Exclusiva de Administrador */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          borderRadius: 8,
          padding: '8px 12px',
          fontSize: '0.78rem',
          color: '#fbbf24'
        }}>
          <ShieldCheck size={15} style={{ flexShrink: 0 }} />
          <span>
            <strong>Área Exclusiva da Diretoria &amp; Gestão:</strong> Apenas administradores têm permissão para lançar ou estornar vales. Os valores e comprovantes de transferência são deduzidos automaticamente e ficam visíveis em tempo real no "Meu Espaço" do colaborador.
          </span>
        </div>

        {/* Seletor de Colaborador (quando aberto pelo botão geral da barra de topo) */}
        {!member && members.length > 0 && (
          <div className="advances-member-selector-box" style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 10,
            padding: '12px 14px'
          }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <User size={14} className="text-amber" />
              Selecionar Colaborador para Lançar ou Consultar Vale:
            </label>
            <select
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              className="advances-select"
              style={{ width: '100%', fontSize: '0.9rem', padding: '9px 12px', borderRadius: 8 }}
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.role || 'Colaborador'}) • {m.company || 'MegaFilmes'}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Resumo Financeiro do Colaborador (Cálculo Oficial) */}
        <div className="advances-summary-grid">
          {/* Card 1: Total Apurado (Bruto) */}
          <div className="advances-kpi-card gross-card">
            <span className="advances-kpi-label">Total Apurado (Bruto)</span>
            <strong className="advances-kpi-value text-slate">{formatBRL(activeGross)}</strong>
            <small className="advances-kpi-sub">Horas extras + Diárias + Cachês</small>
          </div>

          {/* Card 2: Total em Vales Concedidos */}
          <div className="advances-kpi-card advance-card">
            <span className="advances-kpi-label">Vales Retirados no Mês</span>
            <strong className="advances-kpi-value text-amber">
              {totalAdvances > 0 ? `- ${formatBRL(totalAdvances)}` : formatBRL(0)}
            </strong>
            <small className="advances-kpi-sub">
              {activeAdvances.length === 1 ? '1 adiantamento registrado' : `${activeAdvances.length} adiantamentos registrados`}
            </small>
          </div>

          {/* Card 3: Saldo Líquido Restante */}
          <div className="advances-kpi-card net-card">
            <span className="advances-kpi-label">Saldo Líquido a Pagar</span>
            <strong className="advances-kpi-value text-emerald">{formatBRL(netBalance)}</strong>
            <small className="advances-kpi-sub">
              {balanceDeficit > 0 ? (
                <span className="text-red">⚠️ Vales excedem créditos em {formatBRL(balanceDeficit)}</span>
              ) : (
                'Valor final a transferir via PIX'
              )}
            </small>
          </div>
        </div>

        {/* Formulário de Novo Vale com Opção de Anexar Comprovante */}
        <div className="advances-form-box">
          <div className="advances-form-title-row">
            <Plus size={15} className="text-amber" />
            <span>Lançar Novo Vale / Adiantamento para {activeMember.name}</span>
          </div>

          <form onSubmit={handleCreateAdvance} className="advances-new-form">
            <div className="advances-form-row">
              {/* Campo: Valor */}
              <div className="advances-field-group val-field">
                <label className="advances-field-label">
                  Valor do Vale (R$) <span className="text-red">*</span>
                </label>
                <div className="advances-input-wrap">
                  <span className="advances-currency-prefix">R$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0,00"
                    value={amountStr}
                    onChange={handleAmountChange}
                    className="advances-input"
                    disabled={isSubmitting}
                    required
                  />
                </div>
              </div>

              {/* Campo: Data */}
              <div className="advances-field-group date-field">
                <label className="advances-field-label">
                  Data de Liberação <span className="text-red">*</span>
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="advances-input text-field"
                  disabled={isSubmitting}
                  required
                />
              </div>

              {/* Campo: Forma de Pagamento */}
              <div className="advances-field-group method-field">
                <label className="advances-field-label">Forma de Pagamento</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="advances-select"
                  disabled={isSubmitting}
                >
                  <option value="PIX">PIX (Transferência Instantânea)</option>
                  <option value="Dinheiro">Dinheiro em Espécie</option>
                  <option value="Transferência">Transferência Bancária / TED</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>
            </div>

            {/* Campo: Descrição / Motivo */}
            <div className="advances-form-row">
              <div className="advances-field-group desc-field">
                <label className="advances-field-label">Motivo / Justificativa do Vale</label>
                <input
                  type="text"
                  placeholder="Ex: Adiantamento pessoal, Ajuda de custo, Emergência..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="advances-input text-field"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Campo: Anexar Comprovante de Pagamento / Transferência (PIX) */}
            <div className="advances-receipt-upload-box">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*,application/pdf"
                style={{ display: 'none' }}
                onChange={handleReceiptFileChange}
                disabled={isSubmitting}
              />

              <div className="advances-receipt-left">
                <span className="advances-receipt-label">
                  <Paperclip size={14} className="text-cyan" />
                  Comprovante de Transferência / Pagamento:
                </span>
                <span className="advances-receipt-subtext">
                  Anexe o comprovante PIX ou recibo (JPG, PNG ou PDF até 15MB) para ficar registrado e disponível para consulta.
                </span>
              </div>

              <div className="advances-receipt-right">
                {receiptPreview ? (
                  <div className="advances-receipt-preview-badge">
                    <FileCheck size={16} className="text-emerald" />
                    <span className="receipt-name-txt" title={receiptFileName}>
                      {receiptFileName || 'Comprovante anexado'}
                    </span>
                    <button
                      type="button"
                      className="receipt-btn-remove"
                      onClick={handleRemoveReceipt}
                      title="Remover comprovante"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="advances-btn-attach-receipt"
                    onClick={() => fileInputRef.current && fileInputRef.current.click()}
                    disabled={isSubmitting}
                  >
                    <Upload size={14} />
                    <span>Anexar Comprovante / PIX</span>
                  </button>
                )}
              </div>
            </div>

            {/* Botão de Conceder Vale */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                type="submit"
                className="advances-submit-btn"
                disabled={isSubmitting}
                style={{ minWidth: 200 }}
              >
                <Plus size={16} />
                <span>{isSubmitting ? 'Registrando Vale...' : 'Conceder Vale'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Lista de Vales Registrados no Mês */}
        <div className="advances-list-section">
          <div className="advances-list-header">
            <h4>Histórico de Vales Concedidos em {monthLabel || formatMonthName(monthKey)}</h4>
            <span className="advances-count-pill">{activeAdvances.length} no mês</span>
          </div>

          {activeAdvances.length === 0 ? (
            <div className="advances-empty-box">
              <CheckCircle2 size={30} className="text-emerald" />
              <strong>Nenhum vale registrado para {activeMember.name} neste mês.</strong>
              <p>O colaborador receberá o valor integral dos seus créditos e horas extras sem deduções de adiantamento.</p>
            </div>
          ) : (
            <div className="advances-table-wrap">
              <table className="advances-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Valor</th>
                    <th>Forma</th>
                    <th>Motivo / Descrição</th>
                    <th>Comprovante</th>
                    <th>Liberado Por</th>
                    <th className="text-right">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {activeAdvances.map((adv) => (
                    <tr key={adv.id}>
                      <td className="adv-col-date">
                        <div className="adv-date-badge">
                          <Calendar size={12} className="text-cyan" />
                          <span>{formatDateBR(adv.date)}</span>
                        </div>
                      </td>
                      <td className="adv-col-amount">
                        <strong className="adv-amount-highlight text-amber">
                          {formatBRL(adv.amount)}
                        </strong>
                      </td>
                      <td className="adv-col-method">
                        <span className={`adv-method-pill pill-${String(adv.paymentMethod || 'PIX').toLowerCase()}`}>
                          {adv.paymentMethod || 'PIX'}
                        </span>
                      </td>
                      <td className="adv-col-desc">
                        <span className="adv-desc-txt">{adv.description || 'Adiantamento de Salário'}</span>
                      </td>
                      <td className="adv-col-receipt">
                        {adv.receiptUrl ? (
                          <button
                            type="button"
                            className="adv-btn-view-receipt"
                            onClick={() => setViewingReceipt(adv)}
                            title="Ver Comprovante de Pagamento / Transferência"
                          >
                            <FileText size={13} className="text-cyan" />
                            <span>Ver Comprovante</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="adv-btn-attach-quick"
                            onClick={() => handleTriggerQuickAttach(adv.id)}
                            title="Anexar comprovante a este vale"
                          >
                            <Paperclip size={12} />
                            <span>+ Anexar</span>
                          </button>
                        )}
                      </td>
                      <td className="adv-col-by">
                        <span className="adv-by-txt" title={`Registrado no sistema em ${adv.createdAt || ''}`}>
                          {adv.registeredBy || 'Administração'}
                        </span>
                      </td>
                      <td className="adv-col-actions text-right">
                        <button
                          type="button"
                          className="adv-btn-delete"
                          onClick={() => handleDeleteAdvance(adv)}
                          disabled={deletingId === adv.id}
                          title="Estornar / Excluir este vale"
                        >
                          <Trash2 size={14} />
                          <span>{deletingId === adv.id ? 'Estornando...' : 'Estornar'}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Rodapé Informativo */}
        <div className="advances-modal-footer">
          <div className="advances-footer-note">
            <AlertCircle size={14} className="text-cyan" />
            <span>
              Todos os vales lançados são deduzidos automaticamente da folha de pagamento e seus comprovantes ficam imediatamente disponíveis no <strong>Meu Espaço</strong> do colaborador.
            </span>
          </div>
          <button
            type="button"
            className="advances-btn-done"
            onClick={onClose}
          >
            Concluir
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* MODAL / LIGHTBOX: VISUALIZADOR DE COMPROVANTE DE PAGAMENTO     */}
      {/* ============================================================== */}
      {viewingReceipt && (
        <div
          className="receipt-lightbox-overlay"
          onClick={() => setViewingReceipt(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 8, 16, 0.92)',
            backdropFilter: 'blur(10px)',
            zIndex: 11000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            className="receipt-lightbox-card"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 760,
              maxHeight: '92vh',
              background: '#0d1527',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: 14,
              boxShadow: '0 25px 60px rgba(0,0,0,0.8), 0 0 30px rgba(56, 189, 248, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header do Comprovante */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 18px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(255, 255, 255, 0.02)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: 'rgba(56, 189, 248, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#38bdf8'
                }}>
                  <Receipt size={18} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#f8fafc' }}>
                    Comprovante de Transferência / Pagamento
                  </h4>
                  <small style={{ color: '#94a3b8', fontSize: '0.78rem' }}>
                    Vale de <strong>{formatBRL(viewingReceipt.amount)}</strong> para <strong>{activeMember.name}</strong> • {formatDateBR(viewingReceipt.date)}
                  </small>
                </div>
              </div>
              <button
                type="button"
                className="advances-close-btn"
                onClick={() => setViewingReceipt(null)}
                title="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            {/* Conteúdo do Comprovante */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#080d1a',
              minHeight: 360,
            }}>
              {viewingReceipt.receiptUrl.startsWith('data:application/pdf') || viewingReceipt.receiptUrl.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={viewingReceipt.receiptUrl}
                  title="Comprovante em PDF"
                  style={{ width: '100%', height: 480, border: 'none', borderRadius: 8 }}
                />
              ) : (
                <img
                  src={viewingReceipt.receiptUrl}
                  alt={`Comprovante do vale de ${activeMember.name}`}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '70vh',
                    objectFit: 'contain',
                    borderRadius: 8,
                    boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                  }}
                />
              )}
            </div>

            {/* Rodapé com Ações de Download e Fechar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 18px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(255, 255, 255, 0.02)',
            }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Liberado por: <strong>{viewingReceipt.registeredBy || 'Administração'}</strong> • Forma: <strong>{viewingReceipt.paymentMethod || 'PIX'}</strong>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <a
                  href={viewingReceipt.receiptUrl}
                  download={`comprovante_vale_${activeMember.name.replace(/\s+/g, '_')}_${viewingReceipt.date}.jpg`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="advances-btn-attach-receipt"
                  style={{ textDecoration: 'none' }}
                >
                  <Download size={14} />
                  <span>Baixar / Abrir</span>
                </a>
                <button
                  type="button"
                  className="advances-btn-done"
                  onClick={() => setViewingReceipt(null)}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
