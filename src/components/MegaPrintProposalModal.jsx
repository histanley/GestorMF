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
  Package,
  QrCode as QrIcon,
  Loader,
  Phone,
  Mail,
  Building,
  CreditCard,
  Layers,
  Sparkles
} from 'lucide-react';
import QRCode from 'qrcode';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { alertDialog } from '../utils/dialog';

function formatDateBR(dateStr) {
  if (!dateStr) return '';
  const parts = String(dateStr).split('T')[0].split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

function formatCurrency(val) {
  const num = Number(val) || 0;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function MegaPrintProposalModal({ quote, currentUser, onClose }) {
  if (!quote) return null;

  const authorizerName = currentUser?.name || quote.seller_name || 'Rodrigo Guedes';
  const rawRole = (currentUser?.role || '').toUpperCase();
  const authorizerRole = rawRole === 'ADMIN'
    ? 'Diretor Comercial & Produção'
    : 'Consultor Comercial Especializado';

  // Hash determinístico de integridade do orçamento
  const quoteHash = useMemo(() => {
    if (!quote) return 'AUTH-MP-000000';
    const totalNum = Number(quote.total) || 0;
    const str = `${quote.code || 'MP'}-${totalNum.toFixed(2)}-${quote.issue_date || ''}-${authorizerName}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return 'AUTH-MP-' + Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
  }, [quote, authorizerName]);

  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const sheetRef = useRef(null);

  useEffect(() => {
    if (sheetRef.current) {
      sheetRef.current.scrollTop = 0;
    }
  }, [quote]);

  useEffect(() => {
    if (!quote) return;

    // URL pública direta para conferência ou dados de autenticidade
    const verifyUrl = `https://gestormf.shop/validar.php?code=${encodeURIComponent(quote.code || 'MP')}&type=quote`;

    QRCode.toDataURL(verifyUrl, {
      width: 200,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => setQrCodeDataUrl(url))
      .catch((e) => console.warn('Erro ao gerar QRCode do Orçamento:', e));
  }, [quote]);

  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const handlePrint = () => {
    if (!sheetRef.current) return;

    // Aplica classe de impressão no body para isolar apenas o documento
    document.body.classList.add('printing-rental-contract');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('printing-rental-contract');
    }, 1500);
  };

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

      const cleanCode = (quote.code || 'MP-0000').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `Orcamento_MegaPrint_${cleanCode}.pdf`;

      pdf.save(filename);

      alertDialog({
        title: 'PDF Baixado com Sucesso!',
        message: `O arquivo ${filename} foi gerado e baixado no seu dispositivo.`,
        variant: 'success',
      });
    } catch (err) {
      console.error('Erro na exportação para PDF:', err);
      window.print();
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleCopyWhatsApp = async () => {
    const itemsList = (quote.items || [])
      .map((it, idx) => {
        const dimStr = it.calc_type === 'm2' ? ` [${it.width}m × ${it.height}m = ${it.m2}m²]` : '';
        const finishStr = it.finishing ? ` (Acabamento: ${it.finishing})` : '';
        return `  ${idx + 1}. *${it.name}* (${it.quantity}x)${dimStr}${finishStr} — ${formatCurrency(it.total)}`;
      })
      .join('\n');

    let text = `🖨️ *MEGA PRINT COMUNICAÇÃO VISUAL — PROPOSTA COMERCIAL*
📄 *Orçamento Nº:* #${quote.code}
👤 *Cliente:* ${quote.client_name}
📞 *Telefone:* ${quote.client_phone || 'Não informado'}
${quote.client_document ? `📑 *CPF/CNPJ:* ${quote.client_document}\n` : ''}
📅 *Emissão:* ${formatDateBR(quote.issue_date)}
⏳ *Validade da Proposta:* até ${formatDateBR(quote.expiry_date)}

📦 *Itens do Orçamento:*
${itemsList}

💰 *Subtotal:* ${formatCurrency(quote.subtotal || quote.total)}`;

    if (Number(quote.discount) > 0) {
      text += `\n🏷️ *Desconto Especial:* - ${formatCurrency(quote.discount)}`;
    }

    text += `\n💎 *VALOR TOTAL:* *${formatCurrency(quote.total)}*

💳 *Condição de Pagamento:* ${quote.payment_method || '50% entrada + 50% na retirada'}
🚚 *Prazo de Produção / Entrega:* ${quote.delivery_deadline || '2 a 3 dias úteis'}
${quote.notes ? `\n📝 *Observações:* ${quote.notes}` : ''}

🔐 *Autenticação Sistêmica Digital:*
• *Responsável:* ${authorizerName} (${authorizerRole})
• *Selo Digital:* ${quoteHash}
• *QR Code:* Integrado ao documento PDF

_Mega Print Comunicação Visual & Gráfica Rápida_
_Alameda dos Tatus 155 Dr. Silvio Leite - Boa Vista / RR_
_WhatsApp Comercial: (95) 99815-1738_`;

    try {
      await navigator.clipboard.writeText(text);

      const rawPhone = (quote.client_phone || '').replace(/\D/g, '');
      const whatsappUrl = rawPhone.length >= 10
        ? `https://api.whatsapp.com/send?phone=55${rawPhone}&text=${encodeURIComponent(text)}`
        : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;

      alertDialog({
        title: 'Copiado para o WhatsApp!',
        message: 'Orçamento comercial copiado com sucesso! Abrindo o WhatsApp para envio ao cliente...',
        variant: 'success',
      });

      setTimeout(() => {
        window.open(whatsappUrl, '_blank');
      }, 700);
    } catch {
      alertDialog({
        title: 'Erro ao copiar',
        message: 'Não foi possível copiar automaticamente para a área de transferência.',
        variant: 'warning',
      });
    }
  };

  return (
    <div className="modal-overlay rental-contract-overlay" onClick={onClose}>
      <div className="rental-contract-modal" onClick={(e) => e.stopPropagation()}>
        {/* Barra Superior de Ações com Design Padronizado do Sistema */}
        <div className="rc-modal-topbar no-print">
          <div className="rc-topbar-left">
            <div className="rc-topbar-brand-badge">
              <FileText size={16} className="text-gold" />
              <span>Orçamento Comercial</span>
            </div>
            <span className="rc-topbar-status-chip">
              {quote.status === 'Aprovado' ? 'Proposta Aprovada' : (quote.status === 'Vencido' ? 'Proposta Vencida' : 'Proposta Aberta')}
            </span>
          </div>

          <div className="rc-topbar-actions">
            <button
              type="button"
              className="rc-action-btn rc-action-whatsapp"
              onClick={handleCopyWhatsApp}
              title="Copiar proposta e abrir WhatsApp com o cliente"
            >
              <Share2 size={15} />
              <span>WhatsApp</span>
            </button>
            <button
              type="button"
              className="rc-action-btn rc-action-download"
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              title="Baixar Proposta Oficial em PDF"
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
              title="Imprimir Orçamento (A4)"
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

        {/* Folha do Documento A4 Timbrada & Autenticada */}
        <div className="rc-document-sheet" ref={sheetRef}>
          {/* Cabeçalho Corporativo Oficial Timbrado com Logo Mega Print */}
          <div className="rc-doc-header-official">
            <div className="rc-header-logo-col">
              <img
                src="/assets/megaprint-logo.png"
                alt="Mega Print Comunicação Visual"
                className="rc-header-logo-img"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = '/logo.png';
                }}
              />
            </div>

            <div className="rc-header-center-info">
              <div className="rc-header-company-text">
                <div className="rc-ci-row rc-ci-main">MEGA PRINT COMUNICAÇÃO VISUAL</div>
                <div className="rc-ci-row">RG DA SILVA - ME : CNPJ: 21.973.641/0001-00</div>
                <div className="rc-ci-row">Alameda dos Tatus 155 Dr. Silvio Leite - Boa Vista / RR</div>
                <div className="rc-ci-row">Fone / WhatsApp: (95) 99815-1738 • (95) 98124-7389</div>
                <div className="rc-ci-row rc-ci-email">megaprint.bv@gmail.com • megafilmesefotografia@gmail.com</div>
              </div>
            </div>

            <div className="rc-header-meta-col">
              <div className="rc-contract-meta-card">
                <span className="rc-meta-type-tag">ORÇAMENTO COMERCIAL</span>
                <strong className="rc-meta-code-val">#{quote.code}</strong>
                <span className="rc-meta-legal-ref">Proposta Comercial Formal</span>
                <span className="rc-meta-issue-date">
                  Emissão: {formatDateBR(quote.issue_date || new Date().toISOString().split('T')[0])}
                </span>
                <span className="rc-meta-date" style={{ color: '#d97706', fontWeight: 600 }}>
                  Válido até: {formatDateBR(quote.expiry_date)}
                </span>
              </div>
            </div>
          </div>

          <div className="rc-title-bar">
            <h2>PROPOSTA COMERCIAL DE FORNECIMENTO &amp; SERVIÇOS GRÁFICOS</h2>
          </div>

          {/* Dados das Partes (2 Colunas Compactas e Elegantes) */}
          <div className="rc-parties-grid">
            <div className="rc-party-card">
              <h3 className="rc-card-title">
                <Building size={13} /> EMPRESA FORNECEDORA
              </h3>
              <p><strong>Razão:</strong> RG DA SILVA - ME (Mega Print Comunicação Visual)</p>
              <p><strong>Sede:</strong> Alameda dos Tatus, 155 - Dr. Silvio Leite - Boa Vista, RR</p>
              <p><strong>Vendedor / Consultor:</strong> {authorizerName} ({authorizerRole})</p>
            </div>

            <div className="rc-party-card">
              <h3 className="rc-card-title">
                <User size={13} /> CLIENTE / CONTRATANTE
              </h3>
              <p><strong>Nome / Razão:</strong> {quote.client_name}</p>
              <p>
                <strong>CPF / CNPJ:</strong> {quote.client_document || 'Não informado'} •{' '}
                <strong>Telefone:</strong> {quote.client_phone || 'Não informado'}
              </p>
              {quote.client_email && <p><strong>E-mail:</strong> {quote.client_email}</p>}
            </div>
          </div>

          {/* Faixa de Condições & Prazos Comerciais */}
          <div className="rc-schedule-strip">
            <div className="rc-sched-box">
              <span className="rc-sched-lbl">FORMA DE PAGAMENTO</span>
              <span className="rc-sched-val">
                <CreditCard size={13} /> {quote.payment_method || '50% entrada + 50% na retirada'}
              </span>
            </div>

            <div className="rc-sched-box highlight">
              <span className="rc-sched-lbl">PRAZO DE PRODUÇÃO / ENTREGA</span>
              <span className="rc-sched-val">
                <Clock size={13} /> {quote.delivery_deadline || '2 a 3 dias úteis'}
              </span>
            </div>

            <div className="rc-sched-box duration">
              <span className="rc-sched-lbl">VALIDADE DA PROPOSTA</span>
              <span className="rc-sched-val">
                <Calendar size={13} /> {formatDateBR(quote.expiry_date)}
              </span>
            </div>
          </div>

          {/* Tabela de Produtos & Serviços */}
          <div className="rc-items-section">
            <table className="rc-items-table">
              <thead>
                <tr>
                  <th style={{ width: '42%' }}>Item / Especificações do Produto ou Serviço</th>
                  <th style={{ width: '22%' }}>Dimensões / Modo</th>
                  <th style={{ width: '8%', textAlign: 'center' }}>Qtd</th>
                  <th style={{ width: '13%', textAlign: 'right' }}>Valor Unit./m²</th>
                  <th style={{ width: '15%', textAlign: 'right' }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {(quote.items || []).map((it, idx) => (
                  <tr key={idx}>
                    <td>
                      <strong>{it.name}</strong>
                      {it.category && <span className="rc-table-cat"> • {it.category}</span>}
                      {it.finishing && (
                        <div className="rc-table-asset-sub">
                          Acabamento: {it.finishing}
                        </div>
                      )}
                    </td>
                    <td>
                      {it.calc_type === 'm2' ? (
                        <span>{it.width}m × {it.height}m <strong>({it.m2} m²)</strong></span>
                      ) : (
                        <span>Unidade / Peça</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>{it.quantity} un</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(it.unit_price)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <strong>{formatCurrency(it.total)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Observações da Proposta (se houver) */}
          {quote.notes && (
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '10px 14px',
              marginTop: '12px',
              fontSize: '0.76rem',
              color: '#334155'
            }}>
              <strong style={{ display: 'block', color: '#0f172a', marginBottom: '4px' }}>
                📝 Observações Gerais &amp; Especificações Técnicas:
              </strong>
              <div style={{ whiteSpace: 'pre-wrap' }}>{quote.notes}</div>
            </div>
          )}

          {/* Resumo Financeiro & Chave Pix */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#f1f5f9',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            padding: '12px 18px',
            marginTop: '12px',
            gap: '16px'
          }}>
            <div style={{ fontSize: '0.76rem', color: '#334155' }}>
              <strong style={{ color: '#0f172a' }}>Dados para Pagamento / Sinal via Pix:</strong>
              <div>Chave Pix: <strong>95998151738</strong> (Telefone) ou <strong>21.973.641/0001-00</strong> (CNPJ)</div>
              <div>Beneficiário: RG DA SILVA - ME (Mega Print)</div>
            </div>

            <div style={{ textAlign: 'right', minWidth: '220px' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Subtotal: <strong>{formatCurrency(quote.subtotal || quote.total)}</strong>
              </div>
              {Number(quote.discount) > 0 && (
                <div style={{ fontSize: '0.8rem', color: '#16a34a' }}>
                  Desconto Especial: <strong>- {formatCurrency(quote.discount)}</strong>
                </div>
              )}
              <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>
                TOTAL: <span style={{ color: '#16a34a' }}>{formatCurrency(quote.total)}</span>
              </div>
            </div>
          </div>

          {/* Cláusulas e Condições Comerciais */}
          <div className="rc-terms-box" style={{ marginTop: '12px' }}>
            <h4 className="rc-terms-title">CONDIÇÕES GERAIS DE FORNECIMENTO &amp; PRODUÇÃO GRÁFICA</h4>
            <ol className="rc-terms-list">
              <li><strong>APROVAÇÃO DA ARTE:</strong> A produção somente será iniciada após aprovação formal do layout/arte digital pelo cliente e confirmação do pagamento do sinal/entrada acordado.</li>
              <li><strong>FIDELIDADE DE CORES:</strong> Pequenas variações de tonalidade (até 10%) podem ocorrer entre a visualização em telas RGB e a impressão real em CMYK, o que é inerente ao processo gráfico industrial.</li>
              <li><strong>DIREITOS &amp; RESPONSABILIDADE:</strong> O cliente declara possuir os direitos de uso das marcas, imagens e logotipos fornecidos para reprodução nos materiais encomendados.</li>
              <li><strong>RETIRADA &amp; INSTALAÇÃO:</strong> O prazo de entrega informado passa a contar a partir do dia útil subsequente à aprovação final da arte e confirmação financeira.</li>
            </ol>
          </div>

          {/* Campo de Assinaturas com Autenticação Digital Sistêmica e QR Code */}
          <div className="rc-signatures-grid-v2" style={{ marginTop: '14px' }}>
            <div className="rc-sig-client-box">
              <div className="rc-sig-line"></div>
              <span className="rc-sig-name">{quote.client_name}</span>
              <span className="rc-sig-role">CLIENTE / DE ACORDO COM A PROPOSTA</span>
              <span className="rc-sig-doc">CPF/CNPJ: {quote.client_document || '_______________'}</span>
              <small className="rc-sig-subtext">Aceite comercial e autorização de produção</small>
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
                <span className="rc-systemic-role">{authorizerRole} • Mega Print</span>
                <span className="rc-systemic-hash">Registro: <code>{quoteHash}</code></span>
                <span className="rc-systemic-validity">Válido eletronicamente conforme Lei 14.063/20</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
