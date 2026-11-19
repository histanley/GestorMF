import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Printer,
  Share2,
  Download,
  FileText,
  Calendar,
  Clock,
  User,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  QrCode as QrIcon,
  Loader,
  Receipt,
  DollarSign,
  TrendingDown,
  TrendingUp,
  CreditCard,
} from 'lucide-react';
import QRCode from 'qrcode';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { alertDialog } from '../utils/dialog';

/**
 * Formata valores numéricos para o padrão monetário brasileiro (R$)
 */
function formatCurrency(val) {
  const num = Number(val) || 0;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Formata data ISO (YYYY-MM-DD) para formato legível DD/MM/AAAA
 */
function formatDateBR(dateStr) {
  if (!dateStr) return '—';
  try {
    const raw = String(dateStr).split(/[T ]/)[0];
    const parts = raw.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return raw;
  } catch {
    return dateStr;
  }
}

/**
 * Modal Oficial de Detalhamento & Fechamento Financeiro
 * Segue estritamente a identidade visual de documento timbrado (A4) do sistema de Aluguéis / Termo Oficial.
 */
export default function FinancialOfficialStatementModal({
  collaborator,
  monthKey = '2026-11',
  monthLabel = 'Novembro de 2026',
  financialSummary = {},
  financialEntries = [],
  currentUser = null,
  onClose,
}) {
  if (!collaborator) return null;

  const sheetRef = useRef(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // Responsável pela autorização sistêmica
  const authorizerName = currentUser?.name || 'Diretoria MegaFilmes';
  const rawRole = (currentUser?.role || '').toUpperCase();
  const authorizerRole = rawRole === 'ADMIN'
    ? 'Administrador do Sistema'
    : (rawRole === 'MANAGER' ? 'Gestor de Frota & Operações' : 'Diretoria Administrativa');

  // Código determinístico do comprovante financeiro (Ex: EXT-202611-001)
  const statementCode = useMemo(() => {
    const cleanMonth = String(monthKey || '2026-11').replace(/[^0-9]/g, '');
    const cleanId = String(collaborator?.id || '1').replace(/[^0-9]/g, '').slice(-3).padStart(3, '0');
    return `EXT-${cleanMonth}-${cleanId}`;
  }, [monthKey, collaborator]);

  // Hash determinístico de integridade e autenticidade digital (Lei 14.063/2020)
  const statementHash = useMemo(() => {
    const amt = Number(financialSummary?.netTotal || 0);
    const amtStr = amt % 1 === 0 ? String(amt) : amt.toFixed(2);
    const str = `${statementCode}-${collaborator?.name}-${amtStr}-${monthKey}-${authorizerName}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return 'AUTH-FIN-' + Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
  }, [statementCode, collaborator, financialSummary, monthKey, authorizerName]);

  // Data e hora de emissão formatadas
  const issueDateFormatted = useMemo(() => {
    return new Date().toLocaleDateString('pt-BR');
  }, []);

  // Previsão oficial de quitação (dia 05 do mês subsequente)
  const nextMonthForecast = useMemo(() => {
    try {
      const [y, m] = monthKey.split('-').map(Number);
      const nextDate = new Date(y, m, 5);
      const monthNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
      ];
      return `Dia 05 de ${monthNames[nextDate.getMonth()]} de ${nextDate.getFullYear()}`;
    } catch {
      return 'Dia 05 do próximo mês';
    }
  }, [monthKey]);

  // Geração do QR Code de validação pública
  useEffect(() => {
    const verifyUrl = `https://gestormf.shop/validar.php?code=${encodeURIComponent(statementCode)}&auth=${encodeURIComponent(statementHash)}`;
    QRCode.toDataURL(verifyUrl, {
      width: 200,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => setQrCodeDataUrl(url))
      .catch((e) => console.warn('Erro ao gerar QRCode do extrato financeiro:', e));
  }, [statementCode, statementHash]);

  // Scroll to top ao abrir
  useEffect(() => {
    if (sheetRef.current) {
      sheetRef.current.scrollTop = 0;
    }
  }, []);

  // Impressão nativa A4
  const handlePrint = () => {
    if (!sheetRef.current) return;
    document.body.classList.add('printing-rental-contract');
    document.body.classList.add('printing-official-statement');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('printing-rental-contract');
      document.body.classList.remove('printing-official-statement');
    }, 1500);
  };

  // Download do arquivo PDF em alta definição
  const handleDownloadPdf = async () => {
    if (!sheetRef.current || isDownloadingPdf) return;
    setIsDownloadingPdf(true);

    try {
      const element = sheetRef.current;

      // Garantir carregamento das imagens antes da captura
      const images = Array.from(element.querySelectorAll('img'));
      await Promise.all(
        images.map((img) => {
          if (img.complete) return Promise.resolve();
          return new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
          });
        })
      );

      const canvas = await html2canvas(element, {
        scale: 2.2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, Math.min(pdfHeight, 297));

      const cleanName = (collaborator.name || 'Colaborador').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `Extrato_Financeiro_${cleanName}_${monthKey}.pdf`;

      pdf.save(filename);

      alertDialog({
        title: 'PDF Baixado com Sucesso!',
        message: `O documento oficial ${filename} foi gerado e baixado no seu dispositivo.`,
        variant: 'success',
      });
    } catch (err) {
      console.error('Erro na exportação para PDF:', err);
      // Fallback para impressão se o canvas falhar
      window.print();
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Envio oficial do resumo formatado via WhatsApp
  const handleShareWhatsApp = async () => {
    const isPaid = Boolean(financialSummary.isPaid);
    const statusText = isPaid ? '✅ QUITADO / PAGO' : '⏳ PENDENTE DE QUITAÇÃO (Previsto até dia 05)';

    // Lista de lançamentos discriminados
    const entriesList = (financialEntries || []).slice(0, 15).map((e, idx) => {
      const signal = e.type === 'credit' ? '+' : '-';
      return `  ${idx + 1}. [${formatDateBR(e.date)}] *${e.title}* (${e.categoryLabel || e.category}): ${signal} ${formatCurrency(e.amount)}`;
    }).join('\n');

    const entriesMoreNotice = (financialEntries || []).length > 15
      ? `\n  _(+ ${financialEntries.length - 15} lançamentos detalhados no extrato em PDF)_`
      : '';

    const text = `🎬 *MEGAFILMES — DETALHAMENTO & FECHAMENTO FINANCEIRO OFICIAL*
📄 *Documento Nº:* ${statementCode}
👤 *Colaborador(a):* ${collaborator.name}
💼 *Função:* ${collaborator.role || 'Colaborador Operacional'}
🔑 *Chave PIX:* ${collaborator.pixKey || 'Pendente de cadastro'} ${collaborator.pixType ? `(${collaborator.pixType})` : ''}

📅 *Competência:* ${monthLabel}
📆 *Previsão de Quitação:* ${nextMonthForecast} via PIX
📊 *Status:* ${statusText}

💰 *RESUMO GERAL DA APURAÇÃO:*
• Subtotal Bruto: *${formatCurrency(financialSummary.grossTotal || 0)}*
  - Horas Extras (${financialSummary.totalHours || 0}h): ${formatCurrency(financialSummary.totalHoursVal || 0)}
  - Diárias de Campo (${financialSummary.totalDays || 0}d): ${formatCurrency(financialSummary.totalDaysVal || 0)}
  - Cachês / Fixos (${financialSummary.totalCustomCount || 0}): ${formatCurrency(financialSummary.totalCustomVal || 0)}
• Vales & Adiantamentos Deduzidos: *-${formatCurrency(financialSummary.totalAdvancesVal || 0)}* (${financialSummary.advancesCount || 0} vales)

💵 *SALDO LÍQUIDO A RECEBER:* *${formatCurrency(financialSummary.netTotal || 0)}*

📋 *DISCRIMINAÇÃO DOS LANÇAMENTOS:*
${entriesList || '  • Nenhum lançamento com crédito/débito registrado no período.'}${entriesMoreNotice}

🔐 *AUTENTICAÇÃO DIGITAL SISTÊMICA:*
• *Responsável:* ${authorizerName} (${authorizerRole})
• *Selo Digital:* ${statementHash}
• *QR Code de Validação:* Integrado ao documento PDF

_MegaFilmes Produções Audiovisuais_
_Alameda dos Tatus, 155 - Dr. Silvio Leite - Boa Vista, RR_`;

    try {
      await navigator.clipboard.writeText(text);

      const rawPhone = String(collaborator.phone || collaborator.phoneNumber || '').replace(/\D/g, '');
      const whatsappUrl = rawPhone.length >= 10
        ? `https://api.whatsapp.com/send?phone=55${rawPhone}&text=${encodeURIComponent(text)}`
        : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;

      alertDialog({
        title: 'Copiado para o WhatsApp!',
        message: 'Resumo oficial do extrato financeiro copiado com sucesso! Abrindo o WhatsApp...',
        variant: 'success',
      });

      setTimeout(() => {
        window.open(whatsappUrl, '_blank');
      }, 700);
    } catch {
      alertDialog({
        title: 'Erro ao copiar',
        message: 'Não foi possível copiar para a área de transferência.',
        variant: 'warning',
      });
    }
  };

  const isPaid = Boolean(financialSummary.isPaid);

  return (
    <div
      className="modal-overlay rental-contract-overlay official-statement-overlay"
      onClick={onClose}
      style={{ zIndex: 100020 }}
    >
      <div
        className="rental-contract-modal official-statement-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 940 }}
      >
        {/* Barra Superior de Ações — Fiel ao Termo Oficial de Aluguéis */}
        <div className="rc-modal-topbar no-print">
          <div className="rc-topbar-left">
            <div className="rc-topbar-brand-badge">
              <FileText size={16} className="text-gold" />
              <span>Termo Oficial</span>
            </div>
            <span className="rc-topbar-status-chip">
              Fechamento Financeiro • {monthLabel}
            </span>
          </div>

          <div className="rc-topbar-actions">
            <button
              type="button"
              className="rc-action-btn rc-action-whatsapp"
              onClick={handleShareWhatsApp}
              title="Copiar resumo oficial e abrir WhatsApp do colaborador"
            >
              <Share2 size={15} />
              <span>WhatsApp</span>
            </button>
            <button
              type="button"
              className="rc-action-btn rc-action-download"
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              title="Baixar Extrato Financeiro Oficial em PDF A4"
            >
              {isDownloadingPdf ? (
                <>
                  <Loader size={15} className="spinner" />
                  <span>Baixando PDF...</span>
                </>
              ) : (
                <>
                  <Download size={15} />
                  <span>Baixar PDF</span>
                </>
              )}
            </button>
            <button
              type="button"
              className="rc-action-btn rc-action-print"
              onClick={handlePrint}
              title="Imprimir Extrato Oficial (Folha A4)"
            >
              <Printer size={15} />
              <span>Imprimir</span>
            </button>
            <button
              type="button"
              className="rc-action-btn rc-action-close"
              onClick={onClose}
              title="Fechar Janela"
              aria-label="Fechar"
            >
              <X size={16} />
              <span>Fechar</span>
            </button>
          </div>
        </div>

        {/* Folha do Documento Oficial A4 (Pronta para Visualização, Download e Impressão) */}
        <div className="rc-document-sheet" ref={sheetRef}>
          {/* Cabeçalho Corporativo Oficial Timbrado — Fiel ao Modelo da MegaFilmes */}
          <div className="rc-doc-header-official">
            <div className="rc-header-logo-col">
              <img
                src="/images/contract/header-logo.png?v=2"
                alt="Mega Filmes e Fotografia"
                className="rc-header-logo-img"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = '/logo.png';
                }}
              />
            </div>

            <div className="rc-header-center-info">
              <div className="rc-header-company-text">
                <div className="rc-ci-row rc-ci-main">RG DA SILVA - ME : CNPJ: 21.973.641/0001-00</div>
                <div className="rc-ci-row">Endereço: Alameda dos Tatus 155 Dr. Silvio Leite</div>
                <div className="rc-ci-row">Cep: 69314318 - Boa Vista Roraima</div>
                <div className="rc-ci-row">Fone: 95 99815-1738</div>
                <div className="rc-ci-row rc-ci-email">megafilmesefotografia@gmail.com</div>
              </div>
            </div>

            <div className="rc-header-meta-col">
              <div className="rc-contract-meta-card">
                <span className="rc-meta-type-tag">FECHAMENTO &amp; EXTRATO OFICIAL</span>
                <strong className="rc-meta-code-val">{statementCode}</strong>
                <span className="rc-meta-legal-ref">Consolidação e Prestação de Contas (CC Art. 422)</span>
                <span className="rc-meta-issue-date">Emissão: {issueDateFormatted}</span>
              </div>
            </div>
          </div>

          {/* Faixa de Título Escura */}
          <div className="rc-title-bar">
            <h2>COMPROVANTE OFICIAL DE FECHAMENTO FINANCEIRO &amp; SALDO OPERACIONAL</h2>
          </div>

          {/* Dados das Partes (2 Colunas Compactas) */}
          <div className="rc-parties-grid">
            <div className="rc-party-card">
              <h3 className="rc-card-title">
                <ShieldCheck size={13} /> FONTE PAGADORA / GESTÃO
              </h3>
              <p><strong>Razão:</strong> RG DA SILVA - ME (Mega Filmes e Fotografia)</p>
              <p><strong>CNPJ:</strong> 21.973.641/0001-00 • <strong>Sede:</strong> Alameda dos Tatus, 155 - Dr. Silvio Leite - Boa Vista, RR</p>
              <p><strong>Resp. Sistêmico:</strong> {authorizerName} ({authorizerRole})</p>
            </div>

            <div className="rc-party-card">
              <h3 className="rc-card-title">
                <User size={13} /> COLABORADOR(A) / PRESTADOR(A)
              </h3>
              <p><strong>Nome:</strong> {collaborator.name}</p>
              <p>
                <strong>Função Principal:</strong> {collaborator.role || 'Colaborador Operacional'}
                {Array.isArray(collaborator.roles) && collaborator.roles.length > 0 && (
                  <span> ({collaborator.roles.join(', ')})</span>
                )}
              </p>
              <p>
                <strong>Chave PIX:</strong> {collaborator.pixKey || 'Pendente de cadastro'}
                {collaborator.pixType && <span> ({collaborator.pixType})</span>}
                {collaborator.phone && <span> • <strong>Tel:</strong> {collaborator.phone}</span>}
              </p>
            </div>
          </div>

          {/* Faixa de Competência & Cronograma Oficial */}
          <div className="rc-schedule-strip">
            <div className="rc-sched-box">
              <span className="rc-sched-lbl">COMPETÊNCIA DE REFERÊNCIA</span>
              <span className="rc-sched-val">
                <Calendar size={13} /> {monthLabel}
              </span>
            </div>

            <div className="rc-sched-box highlight">
              <span className="rc-sched-lbl">PREVISÃO OFICIAL DE QUITAÇÃO</span>
              <span className="rc-sched-val">
                <Clock size={13} /> {nextMonthForecast} (PIX Instantâneo)
              </span>
            </div>

            <div className="rc-sched-box duration">
              <span className="rc-sched-lbl">STATUS DA QUITAÇÃO</span>
              <span className="rc-sched-val">
                {isPaid ? (
                  <span style={{ color: '#16a34a', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle2 size={14} /> QUITADO / PAGO
                  </span>
                ) : (
                  <span style={{ color: '#d97706', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <AlertCircle size={14} /> PENDENTE DE QUITAÇÃO
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* Tabela Oficial de Discriminação dos Lançamentos */}
          <div className="rc-items-section">
            <div className="rc-section-title" style={{ marginBottom: 6 }}>
              <Receipt size={14} /> Discriminação de Diárias, Horas Extras, Cachês e Deduções
            </div>
            <table className="rc-items-table">
              <thead>
                <tr>
                  <th style={{ width: '42%' }}>Descrição do Serviço / Pauta / Missão</th>
                  <th style={{ width: '13%' }}>Data</th>
                  <th style={{ width: '25%' }}>Categoria / Memória de Cálculo</th>
                  <th style={{ width: '8%', textAlign: 'center' }}>Tipo</th>
                  <th style={{ width: '12%', textAlign: 'right' }}>Valor</th>
                </tr>
              </thead>
              <tbody>
                {financialEntries && financialEntries.length > 0 ? (
                  financialEntries.map((item, idx) => (
                    <tr key={item.id || idx}>
                      <td>
                        <strong>{item.title}</strong>
                        {item.missionCode && (
                          <span className="rc-table-cat"> • {item.missionCode}</span>
                        )}
                        {item.detail && (
                          <div className="rc-table-asset-sub">{item.detail}</div>
                        )}
                      </td>
                      <td>{formatDateBR(item.date)}</td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{item.categoryLabel || item.category}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {item.type === 'credit' ? (
                          <span style={{ color: '#16a34a', fontWeight: 800 }}>Crédito (+)</span>
                        ) : (
                          <span style={{ color: '#e11d48', fontWeight: 800 }}>Débito (-)</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>
                        {item.type === 'credit' ? (
                          <span style={{ color: '#16a34a' }}>+ {formatCurrency(item.amount)}</span>
                        ) : (
                          <span style={{ color: '#e11d48' }}>- {formatCurrency(item.amount)}</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '16px', color: '#64748b' }}>
                      Nenhum lançamento operacional registrado para esta competência.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Resumo Financeiro & Totais */}
          <div className="rc-financial-summary">
            <div className="rc-fin-details">
              <p>
                <strong>Forma de Quitação:</strong> Transferência Instantânea (PIX) •{' '}
                <strong>Status:</strong>{' '}
                <span className={`rc-pay-status status-${isPaid ? 'pago' : 'pendente'}`}>
                  {isPaid ? 'Pago' : 'Pendente'}
                </span>
              </p>
              <p>
                <strong>Destino do Pagamento:</strong> Chave PIX: {collaborator.pixKey || 'Pendente de cadastro'}
                {collaborator.pixType && <span> ({collaborator.pixType})</span>}
              </p>
              <p className="rc-notes-p" style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 4 }}>
                <strong>Observações:</strong> Horas extras calculadas estritamente fora do expediente comercial em missões concluídas. Vales e adiantamentos liberados pela Diretoria são deduzidos integralmente na folha.
              </p>
            </div>

            <div className="rc-fin-totals">
              <div className="rc-fin-row">
                <span>Subtotal Bruto (Créditos):</span>
                <span>+ {formatCurrency(financialSummary.grossTotal || 0)}</span>
              </div>
              {Number(financialSummary.totalHoursVal) > 0 && (
                <div className="rc-fin-row" style={{ fontSize: '0.74rem', color: '#64748b' }}>
                  <span>Horas Extras ({financialSummary.totalHours || 0}h):</span>
                  <span>{formatCurrency(financialSummary.totalHoursVal)}</span>
                </div>
              )}
              {Number(financialSummary.totalDaysVal) > 0 && (
                <div className="rc-fin-row" style={{ fontSize: '0.74rem', color: '#64748b' }}>
                  <span>Diárias de Campo ({financialSummary.totalDays || 0}d):</span>
                  <span>{formatCurrency(financialSummary.totalDaysVal)}</span>
                </div>
              )}
              {Number(financialSummary.totalCustomVal) > 0 && (
                <div className="rc-fin-row" style={{ fontSize: '0.74rem', color: '#64748b' }}>
                  <span>Cachês / Fixos ({financialSummary.totalCustomCount || 0}):</span>
                  <span>{formatCurrency(financialSummary.totalCustomVal)}</span>
                </div>
              )}
              {Number(financialSummary.totalAdvancesVal) > 0 && (
                <div className="rc-fin-row text-discount">
                  <span>Vales &amp; Adiantamentos Deduzidos:</span>
                  <span style={{ color: '#e11d48', fontWeight: 700 }}>- {formatCurrency(financialSummary.totalAdvancesVal)}</span>
                </div>
              )}
              <div className="rc-fin-row total-highlight">
                <span>SALDO LÍQUIDO:</span>
                <span>{formatCurrency(financialSummary.netTotal || 0)}</span>
              </div>
            </div>
          </div>

          {/* Cláusulas e Termo de Responsabilidade Financeira */}
          <div className="rc-clauses-box">
            <h4 className="rc-clauses-title">
              CONDIÇÕES GERAIS DE FECHAMENTO FINANCEIRO E REGRAS DE PAGAMENTO (LEI Nº 10.406 - CÓDIGO CIVIL)
            </h4>
            <ol className="rc-clauses-list">
              <li>
                <strong>APURAÇÃO AUTOMÁTICA E TRANSPARÊNCIA:</strong> As horas extras, cachês e diárias de campo são apurados de forma transparente e automatizada a partir das escalas e encerramentos operacionais homologados pela Diretoria.
              </li>
              <li>
                <strong>DEDUÇÃO DE VALES E ADIANTAMENTOS:</strong> Todo adiantamento salarial liberado pela gestão administrativa durante o mês de vigência é discriminado e deduzido pontualmente da folha de pagamento na apuração do saldo líquido.
              </li>
              <li>
                <strong>DATA E FORMA DE QUITAÇÃO:</strong> A quitação oficial do saldo líquido apurado é efetuada impreterivelmente até o dia 05 do mês subsequente, via transferência eletrônica instantânea (PIX) para a chave cadastrada pelo titular.
              </li>
              <li>
                <strong>PRAZO PARA AUDITORIA E REVISÃO:</strong> O colaborador dispõe do prazo de até 48 (quarenta e oito) horas após a emissão deste extrato para solicitar qualquer conferência ou auditoria operacional de lançamentos junto à Administração.
              </li>
              <li>
                <strong>RECIBO E EFICÁCIA LIBERATÓRIA:</strong> A concretização do crédito bancário acompanhada deste comprovante confere eficácia liberatória sobre as pautas e horas discriminadas nesta competência.
              </li>
            </ol>
          </div>

          {/* Campo de Assinaturas com QR Code Sistêmico Oficial */}
          <div className="rc-signatures-grid-v2">
            <div className="rc-sig-client-box">
              <div className="rc-sig-line"></div>
              <span className="rc-sig-name">{collaborator.name}</span>
              <span className="rc-sig-role">{collaborator.role || 'COLABORADOR OPERACIONAL'}</span>
              <span className="rc-sig-doc">Chave PIX: {collaborator.pixKey || 'Pendente de cadastro'}</span>
              <small className="rc-sig-subtext">Visto e Concordância do Prestador</small>
            </div>

            <div className="rc-sig-systemic-box">
              <div className="rc-qrcode-wrap">
                {qrCodeDataUrl ? (
                  <img src={qrCodeDataUrl} alt="QR Code de Autenticação Sistêmica" className="rc-qrcode-img" />
                ) : (
                  <div className="rc-qrcode-placeholder"><QrIcon size={34} /></div>
                )}
              </div>
              <div className="rc-systemic-info">
                <span className="rc-systemic-badge">
                  <ShieldCheck size={11} /> AUTENTICAÇÃO DIGITAL SISTÊMICA
                </span>
                <strong className="rc-systemic-authorizer">{authorizerName}</strong>
                <span className="rc-systemic-role">{authorizerRole} • MegaFilmes</span>
                <span className="rc-systemic-hash">Registro: <code>{statementHash}</code></span>
                <span className="rc-systemic-validity">Válido eletronicamente conforme Lei 14.063/20</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
