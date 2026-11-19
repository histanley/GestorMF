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
  Building,
  Users,
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
 * Modal Oficial de Fechamento Consolidado da Folha de Pagamento
 * Segue estritamente a identidade visual de documento timbrado (A4) do sistema de Aluguéis / Termo Oficial.
 */
export default function PayrollOfficialStatementModal({
  monthKey = '2026-11',
  monthLabel = 'Novembro de 2026',
  summaryTotals = {},
  memberPayouts = [],
  currentUser = null,
  onClose,
}) {
  const sheetRef = useRef(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // Responsável pela autorização sistêmica
  const authorizerName = currentUser?.name || 'Diretoria MegaFilmes';
  const rawRole = (currentUser?.role || '').toUpperCase();
  const authorizerRole = rawRole === 'ADMIN'
    ? 'Administrador do Sistema'
    : (rawRole === 'MANAGER' ? 'Gestor de Frota & Operações' : 'Diretoria Administrativa');

  // Código determinístico do comprovante da folha (Ex: FOLHA-202611-MF)
  const statementCode = useMemo(() => {
    const cleanMonth = String(monthKey || '2026-11').replace(/[^0-9]/g, '');
    return `FOLHA-${cleanMonth}-MF`;
  }, [monthKey]);

  // Hash determinístico de integridade e autenticidade digital (Lei 14.063/2020)
  const statementHash = useMemo(() => {
    const amt = Number(summaryTotals?.totalFolhaLiquida || 0);
    const amtStr = amt % 1 === 0 ? String(amt) : amt.toFixed(2);
    const str = `${statementCode}-${amtStr}-${monthKey}-${authorizerName}-${memberPayouts.length}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return 'AUTH-FOLHA-' + Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
  }, [statementCode, summaryTotals, monthKey, authorizerName, memberPayouts]);

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
      .catch((e) => console.warn('Erro ao gerar QRCode da folha:', e));
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

      const filename = `Folha_Consolidada_MegaFilmes_${monthKey}.pdf`;
      pdf.save(filename);

      alertDialog({
        title: 'PDF Baixado com Sucesso!',
        message: `O documento oficial ${filename} foi gerado e baixado no seu dispositivo.`,
        variant: 'success',
      });
    } catch (err) {
      console.error('Erro na exportação para PDF:', err);
      window.print();
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Compartilhamento executivo via WhatsApp
  const handleShareWhatsApp = async () => {
    const isAllPaid = summaryTotals.totalPendentes === 0 && (summaryTotals.totalPagos || 0) > 0;
    const statusText = isAllPaid
      ? '✅ FOLHA 100% QUITADA'
      : `⏳ EM ANDAMENTO (${summaryTotals.totalPagos || 0} Pagos • ${summaryTotals.totalPendentes || 0} Pendentes)`;

    // Lista dos colaboradores com valores
    const membersList = (memberPayouts || []).map((m, idx) => {
      const statusIcon = m.status === 'Pago' ? '✅' : '⏳';
      return `  ${idx + 1}. *${m.name}* (${m.role || 'Produção'}): Líquido *${formatCurrency(m.netAmount !== undefined ? m.netAmount : m.totalAmount)}* [${statusIcon} ${m.status || 'Pendente'}]`;
    }).join('\n');

    const text = `🎬 *MEGAFILMES — FECHAMENTO GERAL DA FOLHA CONSOLIDADA*
📄 *Documento Nº:* ${statementCode}
📅 *Competência:* ${monthLabel}
📆 *Previsão de Quitação:* ${nextMonthForecast} via PIX
📊 *Situação Geral:* ${statusText}

💰 *CONSOLIDAÇÃO FINANCEIRA DA FOLHA:*
• *Subtotal Bruto:* *${formatCurrency(summaryTotals.totalFolha || 0)}*
  - Horas Extras (${summaryTotals.totalHoras || 0}h): ${formatCurrency(summaryTotals.totalHorasValor || 0)}
  - Diárias de Campo (${summaryTotals.totalViagens || 0}d): ${formatCurrency(summaryTotals.totalDiariasValor || 0)}
  - Cachês / Fixos (${summaryTotals.totalCustoms || 0}): ${formatCurrency(summaryTotals.totalCustomsValor || 0)}
• *Vales & Adiantamentos Deduzidos:* *-${formatCurrency(summaryTotals.totalVales || 0)}*

💵 *TOTAL LÍQUIDO A DESEMBOLSAR:* *${formatCurrency(summaryTotals.totalFolhaLiquida || 0)}*

👥 *QUADRO CONSOLIDADO (${memberPayouts.length} Colaboradores):*
${membersList || '  • Nenhum colaborador registrado nesta competência.'}

🔐 *AUTENTICAÇÃO DIGITAL SISTÊMICA:*
• *Responsável:* ${authorizerName} (${authorizerRole})
• *Selo Digital:* ${statementHash}
• *QR Code de Validação:* Integrado ao documento PDF

_MegaFilmes Produções Audiovisuais_
_Alameda dos Tatus, 155 - Dr. Silvio Leite - Boa Vista, RR_`;

    try {
      await navigator.clipboard.writeText(text);

      alertDialog({
        title: 'Copiado para o WhatsApp!',
        message: 'Resumo executivo da folha consolidada copiado com sucesso! Abrindo o WhatsApp...',
        variant: 'success',
      });

      const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
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

  const isAllPaid = summaryTotals.totalPendentes === 0 && (summaryTotals.totalPagos || 0) > 0;

  return (
    <div
      className="modal-overlay rental-contract-overlay official-statement-overlay"
      onClick={onClose}
      style={{ zIndex: 100020 }}
    >
      <div
        className="rental-contract-modal official-statement-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 960 }}
      >
        {/* Barra Superior de Ações — Fiel ao Termo Oficial de Aluguéis */}
        <div className="rc-modal-topbar no-print">
          <div className="rc-topbar-left">
            <div className="rc-topbar-brand-badge">
              <FileText size={16} className="text-gold" />
              <span>Termo Oficial</span>
            </div>
            <span className="rc-topbar-status-chip">
              Folha Consolidada • {monthLabel}
            </span>
          </div>

          <div className="rc-topbar-actions">
            <button
              type="button"
              className="rc-action-btn rc-action-whatsapp"
              onClick={handleShareWhatsApp}
              title="Copiar resumo executivo e abrir WhatsApp"
            >
              <Share2 size={15} />
              <span>WhatsApp</span>
            </button>
            <button
              type="button"
              className="rc-action-btn rc-action-download"
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              title="Baixar Folha de Pagamento Consolidada em PDF A4"
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
              title="Imprimir Folha Consolidada (A4)"
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
                <span className="rc-meta-type-tag">FECHAMENTO CONSOLIDADO DA FOLHA</span>
                <strong className="rc-meta-code-val">{statementCode}</strong>
                <span className="rc-meta-legal-ref">Consolidação e Prestação de Contas (CC Art. 422)</span>
                <span className="rc-meta-issue-date">Emissão: {issueDateFormatted}</span>
              </div>
            </div>
          </div>

          {/* Faixa de Título Escura */}
          <div className="rc-title-bar">
            <h2>RELATÓRIO CONSOLIDADO DE FECHAMENTO FINANCEIRO &amp; FOLHA OPERACIONAL</h2>
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
                <Users size={13} /> CONTROLE OPERACIONAL DA COMPETÊNCIA
              </h3>
              <p><strong>Mês de Competência:</strong> {monthLabel}</p>
              <p><strong>Quadro de Pessoal:</strong> {memberPayouts.length} colaboradores apurados</p>
              <p>
                <strong>Situação da Quitação:</strong>{' '}
                <span style={{ color: '#16a34a', fontWeight: 700 }}>{summaryTotals.totalPagos || 0} Quitados</span> •{' '}
                <span style={{ color: '#d97706', fontWeight: 700 }}>{summaryTotals.totalPendentes || 0} Pendentes</span>
              </p>
            </div>
          </div>

          {/* Faixa de Indicadores Consolidados */}
          <div className="rc-schedule-strip">
            <div className="rc-sched-box">
              <span className="rc-sched-lbl">SUBTOTAL BRUTO APURADO</span>
              <span className="rc-sched-val">
                + {formatCurrency(summaryTotals.totalFolha || 0)}
              </span>
            </div>

            <div className="rc-sched-box">
              <span className="rc-sched-lbl">VALES DEDUZIDOS NA FOLHA</span>
              <span className="rc-sched-val" style={{ color: '#e11d48' }}>
                - {formatCurrency(summaryTotals.totalVales || 0)}
              </span>
            </div>

            <div className="rc-sched-box highlight">
              <span className="rc-sched-lbl">SALDO LÍQUIDO A DESEMBOLSAR</span>
              <span className="rc-sched-val" style={{ color: '#047857' }}>
                = {formatCurrency(summaryTotals.totalFolhaLiquida || 0)}
              </span>
            </div>

            <div className="rc-sched-box duration">
              <span className="rc-sched-lbl">PREVISÃO DE QUITAÇÃO</span>
              <span className="rc-sched-val" style={{ fontSize: '0.8rem' }}>
                <Clock size={12} /> {nextMonthForecast}
              </span>
            </div>
          </div>

          {/* Tabela de Colaboradores da Folha */}
          <div className="rc-items-section">
            <div className="rc-section-title" style={{ marginBottom: 6 }}>
              <Receipt size={14} /> Discriminação Individual por Colaborador / Credenciado
            </div>
            <table className="rc-items-table">
              <thead>
                <tr>
                  <th style={{ width: '25%' }}>Colaborador / Função</th>
                  <th style={{ width: '13%', textAlign: 'right' }}>Horas Extras</th>
                  <th style={{ width: '13%', textAlign: 'right' }}>Diárias / Cachês</th>
                  <th style={{ width: '13%', textAlign: 'right' }}>Bruto Apurado</th>
                  <th style={{ width: '11%', textAlign: 'right' }}>Vales Ded.</th>
                  <th style={{ width: '13%', textAlign: 'right' }}>Líquido Final</th>
                  <th style={{ width: '12%', textAlign: 'center' }}>Status / PIX</th>
                </tr>
              </thead>
              <tbody>
                {memberPayouts && memberPayouts.length > 0 ? (
                  memberPayouts.map((m) => {
                    const isPaid = m.status === 'Pago';
                    const netVal = m.netAmount !== undefined ? m.netAmount : m.totalAmount;
                    const horasSub = Number(m.totalOffHoursAmount || 0);
                    const diariasSub = Number(m.totalDailyAmount || 0) + Number(m.totalCustomAmount || 0);
                    const valesSub = Number(m.totalAdvancesAmount || 0);

                    return (
                      <tr key={m.id}>
                        <td>
                          <strong>{m.name}</strong>
                          <div className="rc-table-cat">{m.role || 'Produção'} {m.company ? `• ${m.company}` : ''}</div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div>{formatCurrency(horasSub)}</div>
                          {m.totalHours > 0 && (
                            <small style={{ color: '#64748b', fontSize: '0.66rem' }}>({m.totalHours}h extras)</small>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div>{formatCurrency(diariasSub)}</div>
                          {(m.totalTravelDays > 0 || m.totalCustomCount > 0) && (
                            <small style={{ color: '#64748b', fontSize: '0.66rem' }}>
                              {m.totalTravelDays > 0 ? `${m.totalTravelDays}d` : ''}
                              {m.totalTravelDays > 0 && m.totalCustomCount > 0 ? ' • ' : ''}
                              {m.totalCustomCount > 0 ? `${m.totalCustomCount}c` : ''}
                            </small>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          + {formatCurrency(m.totalAmount)}
                        </td>
                        <td style={{ textAlign: 'right', color: valesSub > 0 ? '#e11d48' : '#64748b', fontWeight: valesSub > 0 ? 700 : 400 }}>
                          {valesSub > 0 ? `- ${formatCurrency(valesSub)}` : '—'}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                          {formatCurrency(netVal)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`rc-pay-status status-${isPaid ? 'pago' : 'pendente'}`}>
                            {isPaid ? 'Pago' : 'Pendente'}
                          </span>
                          {m.pixKey && (
                            <div style={{ fontSize: '0.64rem', color: '#64748b', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 100, margin: '2px auto 0' }} title={`Chave PIX: ${m.pixKey}`}>
                              PIX: {m.pixKey}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '16px', color: '#64748b' }}>
                      Nenhum colaborador registrado nesta competência.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr style={{ background: '#f8fafc', fontWeight: 800, borderTop: '2px solid #cbd5e1' }}>
                  <td>TOTAL GERAL DA FOLHA</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(summaryTotals.totalHorasValor || 0)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency((summaryTotals.totalDiariasValor || 0) + (summaryTotals.totalCustomsValor || 0))}</td>
                  <td style={{ textAlign: 'right' }}>+ {formatCurrency(summaryTotals.totalFolha || 0)}</td>
                  <td style={{ textAlign: 'right', color: '#e11d48' }}>- {formatCurrency(summaryTotals.totalVales || 0)}</td>
                  <td style={{ textAlign: 'right', color: '#047857', fontSize: '0.85rem' }}>{formatCurrency(summaryTotals.totalFolhaLiquida || 0)}</td>
                  <td style={{ textAlign: 'center', fontSize: '0.72rem' }}>{summaryTotals.totalPagos || 0}P / {summaryTotals.totalPendentes || 0}A</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Resumo Financeiro & Totais */}
          <div className="rc-financial-summary">
            <div className="rc-fin-details">
              <p>
                <strong>Modalidade de Quitação:</strong> Transferência Eletrônica Instantânea (PIX) para chaves titulares cadastradas.
              </p>
              <p>
                <strong>Previsão de Quitação:</strong> Impreterivelmente até o 5º dia útil do mês subsequente ({nextMonthForecast}).
              </p>
              <p className="rc-notes-p" style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 4 }}>
                <strong>Observações Gerais:</strong> Horas extras calculadas estritamente entre o Início e Término do Evento (campo operacional). Os editores da pós-produção não recebem horas extras. Todos os vales e adiantamentos liberados pela Diretoria foram deduzidos pontualmente.
              </p>
            </div>

            <div className="rc-fin-totals">
              <div className="rc-fin-row">
                <span>Subtotal Bruto (Créditos):</span>
                <span>+ {formatCurrency(summaryTotals.totalFolha || 0)}</span>
              </div>
              <div className="rc-fin-row" style={{ fontSize: '0.74rem', color: '#64748b' }}>
                <span>Horas Extras ({summaryTotals.totalHoras || 0}h):</span>
                <span>{formatCurrency(summaryTotals.totalHorasValor || 0)}</span>
              </div>
              <div className="rc-fin-row" style={{ fontSize: '0.74rem', color: '#64748b' }}>
                <span>Diárias de Campo ({summaryTotals.totalViagens || 0}d):</span>
                <span>{formatCurrency(summaryTotals.totalDiariasValor || 0)}</span>
              </div>
              <div className="rc-fin-row" style={{ fontSize: '0.74rem', color: '#64748b' }}>
                <span>Cachês / Fixos ({summaryTotals.totalCustoms || 0}):</span>
                <span>{formatCurrency(summaryTotals.totalCustomsValor || 0)}</span>
              </div>
              <div className="rc-fin-row text-discount">
                <span>Vales &amp; Adiantamentos Deduzidos:</span>
                <span style={{ color: '#e11d48', fontWeight: 700 }}>- {formatCurrency(summaryTotals.totalVales || 0)}</span>
              </div>
              <div className="rc-fin-row total-highlight">
                <span>TOTAL LÍQUIDO A PAGAR:</span>
                <span>{formatCurrency(summaryTotals.totalFolhaLiquida || 0)}</span>
              </div>
            </div>
          </div>

          {/* Cláusulas e Diretrizes de Fechamento da Folha */}
          <div className="rc-clauses-box">
            <h4 className="rc-clauses-title">
              DIRETRIZES CORPORATIVAS DE FECHAMENTO E HOMOLOGAÇÃO DA FOLHA (LEI Nº 10.406 - CÓDIGO CIVIL)
            </h4>
            <ol className="rc-clauses-list">
              <li>
                <strong>CONSOLIDAÇÃO DE ORDENS DE SERVIÇO:</strong> A apuração desta folha consolida todas as missões operacionais, coberturas e escalas efetivamente cumpridas e homologadas durante a competência.
              </li>
              <li>
                <strong>DEDUÇÃO INTEGRAL DE ADIANTAMENTOS:</strong> Todo valor concedido a título de vale, adiantamento salarial ou ajuda de custo no período é deduzido integralmente na apuração líquida individual.
              </li>
              <li>
                <strong>DATA LIMITE E FORMA DE QUITAÇÃO:</strong> A liquidação financeira dos valores líquidos apurados é efetuada até o 5º dia útil do mês subsequente (dia 05) via PIX para as chaves cadastradas.
              </li>
              <li>
                <strong>CONFORMIDADE E AUDITORIA:</strong> Esta folha é arquivada eletronicamente para fins de auditoria interna, conciliação contábil e prestação de contas, dotada de assinatura digital e hash de integridade.
              </li>
              <li>
                <strong>HOMOLOGAÇÃO DA DIRETORIA:</strong> A emissão deste relatório autoriza o processamento e a programação bancária das transferências pela Diretoria Executiva da produtora.
              </li>
            </ol>
          </div>

          {/* Campo de Assinaturas com QR Code Sistêmico Oficial */}
          <div className="rc-signatures-grid-v2">
            <div className="rc-sig-client-box">
              <div className="rc-sig-line"></div>
              <span className="rc-sig-name">{authorizerName}</span>
              <span className="rc-sig-role">DIRETORIA EXECUTIVA &amp; RH</span>
              <span className="rc-sig-doc">MegaFilmes Produções Audiovisuais</span>
              <small className="rc-sig-subtext">Homologação e Autorização de Pagamento</small>
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
