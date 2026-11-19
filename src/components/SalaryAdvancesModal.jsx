import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { apiSaveSalaryAdvance, apiDeleteSalaryAdvance } from '../utils/api';
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
  isOpen = false,
  onClose = () => {},
  member = null,
  monthKey = '',
  grossAmount = 0,
  advances = [],
  onRefresh = () => {},
  currentUser = null,
}) {
  const [amountStr, setAmountStr] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('PIX');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Calcula totais
  const totalAdvances = useMemo(() => {
    return advances.reduce((acc, a) => acc + (Number(a.amount) || 0), 0);
  }, [advances]);

  const netBalance = useMemo(() => {
    const gross = Number(grossAmount) || 0;
    return Math.max(0, gross - totalAdvances);
  }, [grossAmount, totalAdvances]);

  const balanceDeficit = useMemo(() => {
    const gross = Number(grossAmount) || 0;
    return totalAdvances > gross ? totalAdvances - gross : 0;
  }, [grossAmount, totalAdvances]);

  if (!isOpen || !member) return null;

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

  // Submeter novo vale
  const handleCreateAdvance = async (e) => {
    e.preventDefault();
    const valNum = getAmountNumber();

    if (valNum <= 0) {
      await alertDialog('Informe um valor válido maior que zero para o vale.', 'Valor Obrigatório');
      return;
    }

    if (!date) {
      await alertDialog('Selecione a data de liberação do vale.', 'Data Obrigatória');
      return;
    }

    const desc = description.trim() || 'Adiantamento de Salário';

    const confirmed = await confirmDialog(
      `Confirmar a liberação de um vale de ${formatBRL(valNum)} para ${member.name} via ${paymentMethod} em ${formatDateBR(date)}?\n\nEste valor será deduzido automaticamente dos créditos a receber do colaborador.`,
      'Confirmar Lançamento de Vale'
    );
    if (!confirmed) return;

    try {
      setIsSubmitting(true);
      const res = await apiSaveSalaryAdvance({
        memberId: member.id,
        monthKey: monthKey || date.slice(0, 7),
        date,
        amount: valNum,
        description: desc,
        paymentMethod,
        registeredBy: currentUser?.name || 'Administração',
        registeredById: currentUser?.id || '',
      });

      if (res && res.success) {
        setAmountStr('');
        setDescription('');
        setDate(new Date().toISOString().slice(0, 10));
        onRefresh();
      } else {
        await alertDialog(res?.error || 'Erro ao registrar vale no servidor.', 'Erro');
      }
    } catch (err) {
      await alertDialog(`Erro ao comunicar com o servidor: ${err.message}`, 'Erro');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Excluir / Estornar vale
  const handleDeleteAdvance = async (advance) => {
    const confirmed = await confirmDialog(
      `Deseja realmente estornar/excluir o vale de ${formatBRL(advance.amount)} concedido em ${formatDateBR(advance.date)}?\n\nMotivo: ${advance.description}`,
      'Estornar Vale'
    );
    if (!confirmed) return;

    try {
      setDeletingId(advance.id);
      const res = await apiDeleteSalaryAdvance(advance.id);
      if (res && res.success) {
        onRefresh();
      } else {
        await alertDialog(res?.error || 'Erro ao estornar vale.', 'Erro');
      }
    } catch (err) {
      await alertDialog(`Erro ao estornar vale: ${err.message}`, 'Erro');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="advances-modal-overlay">
      <div className="advances-modal-card">
        {/* Cabeçalho */}
        <div className="advances-modal-header">
          <div className="advances-header-left">
            <div className="advances-header-icon-box">
              <Receipt size={22} className="text-amber" />
            </div>
            <div className="advances-header-titles">
              <h3 className="advances-modal-title">Vales &amp; Adiantamentos de Salário</h3>
              <p className="advances-modal-subtitle">
                Colaborador: <strong>{member.name}</strong> • Competência:{' '}
                <span className="text-cyan">{formatMonthName(monthKey)}</span>
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

        {/* Resumo Financeiro do Colaborador (Cálculo Oficial) */}
        <div className="advances-summary-grid">
          {/* Card 1: Total Apurado (Bruto) */}
          <div className="advances-kpi-card gross-card">
            <span className="advances-kpi-label">Total Apurado (Bruto)</span>
            <strong className="advances-kpi-value text-slate">{formatBRL(grossAmount)}</strong>
            <small className="advances-kpi-sub">Horas extras + Diárias + Cachês</small>
          </div>

          {/* Card 2: Total em Vales Concedidos */}
          <div className="advances-kpi-card advance-card">
            <span className="advances-kpi-label">Vales Retirados no Mês</span>
            <strong className="advances-kpi-value text-amber">
              {totalAdvances > 0 ? `- ${formatBRL(totalAdvances)}` : formatBRL(0)}
            </strong>
            <small className="advances-kpi-sub">
              {advances.length === 1 ? '1 adiantamento registrado' : `${advances.length} adiantamentos registrados`}
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

        {/* Formulário de Novo Vale */}
        <div className="advances-form-box">
          <div className="advances-form-title-row">
            <Plus size={15} className="text-amber" />
            <span>Lançar Novo Vale / Adiantamento</span>
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

              <div className="advances-field-group btn-field">
                <label className="advances-field-label">&nbsp;</label>
                <button
                  type="submit"
                  className="advances-submit-btn"
                  disabled={isSubmitting}
                >
                  <Plus size={15} />
                  <span>{isSubmitting ? 'Registrando...' : 'Conceder Vale'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Lista de Vales Registrados no Mês */}
        <div className="advances-list-section">
          <div className="advances-list-header">
            <h4>Histórico de Vales Concedidos em {formatMonthName(monthKey)}</h4>
            <span className="advances-count-pill">{advances.length} no mês</span>
          </div>

          {advances.length === 0 ? (
            <div className="advances-empty-box">
              <CheckCircle2 size={30} className="text-emerald" />
              <strong>Nenhum vale registrado para {member.name} neste mês.</strong>
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
                    <th>Liberado Por</th>
                    <th className="text-right">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {advances.map((adv) => (
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
              Todos os vales lançados são deduzidos automaticamente da folha de pagamento e ficam imediatamente visíveis no extrato do colaborador em seu <strong>Meu Espaço</strong>.
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
    </div>
  );
}
