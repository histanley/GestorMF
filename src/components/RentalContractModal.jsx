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
  Sparkles,
  Loader,
} from 'lucide-react';
import QRCode from 'qrcode';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { formatCurrency, formatDateBR } from '../utils/rentalsData';
import { alertDialog } from '../utils/dialog';

export default function RentalContractModal({ rental, currentUser = null, onClose }) {
  if (!rental) return null;

  const isReserved = rental.status === 'reserved';

  const authorizerName = currentUser?.name || rental.createdBy || 'Gestão MegaFilmes';
  const rawRole = (currentUser?.role || '').toUpperCase();
  const authorizerRole = rawRole === 'ADMIN'
    ? 'Administrador do Sistema'
    : (rawRole === 'MANAGER' ? 'Gestor de Frota & Equipamentos' : 'Gestor Autorizado');

  // Hash determinístico de integridade do contrato
  const contractHash = useMemo(() => {
    if (!rental) return 'AUTH-MF-0000';
    const str = `${rental.code}-${rental.totalAmount}-${rental.startDate}-${authorizerName}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return 'AUTH-MF-' + Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
  }, [rental, authorizerName]);

  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const sheetRef = useRef(null);

  useEffect(() => {
    if (sheetRef.current) {
      sheetRef.current.scrollTop = 0;
    }
  }, [rental]);

  useEffect(() => {
    if (!rental) return;

    // URL pública direta para escaneamento via smartphone (abre no navegador sem exigir login)
    const verifyUrl = `https://gestormf.shop/validar.php?code=${encodeURIComponent(rental.code)}`;

    QRCode.toDataURL(verifyUrl, {
      width: 200,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => setQrCodeDataUrl(url))
      .catch((e) => console.warn('Erro ao gerar QRCode:', e));
  }, [rental]);

  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const handlePrint = () => {
    window.print();
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

      const cleanCode = (rental.code || 'DOC').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = isReserved
        ? `Reserva_${cleanCode}.pdf`
        : `Contrato_Locacao_${cleanCode}.pdf`;

      pdf.save(filename);

      alertDialog({
        title: 'PDF Baixado com Sucesso!',
        message: `O arquivo ${filename} foi gerado e baixado no seu dispositivo.`,
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

  const handleCopyWhatsApp = async () => {
    const itemsList = (rental.items || [])
      .map((it, idx) => `  ${idx + 1}. *${it.name}* (${it.quantity}x) — ${formatCurrency(it.dailyRate)}/dia`)
      .join('\n');

    const headerTitle = isReserved
      ? `🎬 *MEGAFILMES — COMPROVANTE DE AGENDAMENTO & RESERVA*`
      : `🎬 *MEGAFILMES — CONTRATO & TERMO DE LOCAÇÃO*`;

    const statusNote = isReserved
      ? `⚠️ *Importante:* Agendamento confirmado com reserva prévia de estoque. A liberação dos equipamentos fica condicionada à quitação do pagamento acordado.`
      : `⚠️ *Importante:* Devolução impreterível no horário acordado, com cabos e acessórios em perfeito estado técnico e de conservação.`;

    const text = `${headerTitle}
📄 *Contrato Nº:* ${rental.code}
👤 *Cliente:* ${rental.clientName}
📞 *Telefone:* ${rental.clientPhone || 'Não informado'}

📅 *Período da Locação:*
• *Retirada:* ${formatDateBR(rental.startDate)} às ${rental.startTime || '08:00'}
• *Devolução:* ${formatDateBR(rental.endDate)} às ${rental.endTime || '18:00'}
• *Duração:* ${rental.totalDays} dia(s)

📦 *Equipamentos Relacionados:*
${itemsList}

💰 *Valor Total:* *${formatCurrency(rental.totalAmount)}*
💳 *Pagamento:* ${rental.paymentMethod || 'PIX'} (${rental.paymentStatus || 'Pendente'})

🔐 *Autenticação Sistêmica Digital:*
• *Responsável:* ${authorizerName} (${authorizerRole})
• *Selo Digital:* ${contractHash}
• *QR Code:* Integrado ao documento PDF

${statusNote}

_MegaFilmes Produções Audiovisuais_
_R. Sardinha, 1061 - Tancredo Neves, Boa Vista - RR_`;

    try {
      await navigator.clipboard.writeText(text);

      const rawPhone = (rental.clientPhone || '').replace(/\D/g, '');
      const whatsappUrl = rawPhone.length >= 10
        ? `https://api.whatsapp.com/send?phone=55${rawPhone}&text=${encodeURIComponent(text)}`
        : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;

      alertDialog({
        title: 'Copiado para o WhatsApp!',
        message: 'Resumo oficial copiado com sucesso! Abrindo o WhatsApp para envio ao cliente...',
        variant: 'success',
      });

      setTimeout(() => {
        window.open(whatsappUrl, '_blank');
      }, 700);
    } catch {
      alertDialog({
        title: 'Erro ao copiar',
        message: 'Não foi possível copiar automaticamente.',
        variant: 'warning',
      });
    }
  };

  return (
    <div className="modal-overlay rental-contract-overlay" onClick={onClose}>
      <div className="rental-contract-modal" onClick={(e) => e.stopPropagation()}>
        {/* Barra Superior de Ações — Limpa, Moderna e Sem Quebras de Linha */}
        <div className="rc-modal-topbar no-print">
          <div className="rc-topbar-left">
            <div className="rc-topbar-brand-badge">
              <FileText size={16} className="text-gold" />
              <span>Termo Oficial</span>
            </div>
            <span className="rc-topbar-status-chip">
              {isReserved ? 'Reserva & Agendamento' : 'Locação Ativa'}
            </span>
          </div>

          <div className="rc-topbar-actions">
            <button
              type="button"
              className="rc-action-btn rc-action-whatsapp"
              onClick={handleCopyWhatsApp}
              title="Copiar resumo oficial e abrir WhatsApp"
            >
              <Share2 size={15} />
              <span>WhatsApp</span>
            </button>
            <button
              type="button"
              className="rc-action-btn rc-action-download"
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              title="Baixar / Salvar Contrato em PDF diretamente"
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
              title="Imprimir Contrato (A4)"
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

        {/* Folha do Documento (Pronta para Visualização e Impressão A4 - 1 Página) */}
        <div className="rc-document-sheet" ref={sheetRef}>
          {/* Cabeçalho Corporativo Oficial Timbrado — Fiel ao Modelo Print 2 / 4 / 5 */}
          <div className="rc-doc-header-official">
            <div className="rc-header-brand-side">
              <img
                src="/images/contract/header-logo.png"
                alt="Mega Filmes e Fotografia"
                className="rc-header-logo-img"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = '/logo.png';
                }}
              />
              <img
                src="/images/contract/header-banner.png"
                alt="RG DA SILVA - ME"
                className="rc-header-text-img"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>

            <div className="rc-header-meta-side">
              <div className="rc-contract-meta-card">
                <span className="rc-meta-type-tag">
                  {isReserved ? 'AGENDAMENTO & RESERVA' : 'CONTRATO DE LOCAÇÃO'}
                </span>
                <strong className="rc-meta-code-val">{rental.code}</strong>
                <span className="rc-meta-legal-ref">Lei Federal nº 10.406 (Código Civil)</span>
                <span className="rc-meta-issue-date">
                  Emissão: {formatDateBR(rental.createdAt ? rental.createdAt.split('T')[0] : rental.startDate)}
                </span>
              </div>
            </div>
          </div>

          <div className="rc-title-bar">
            <h2>{isReserved ? 'COMPROVANTE DE AGENDAMENTO E RESERVA DE EQUIPAMENTOS' : 'INSTRUMENTO PARTICULAR DE CONTRATO DE LOCAÇÃO DE BENS MÓVEIS'}</h2>
          </div>

          {/* Dados das Partes (2 Colunas Compactas) */}
          <div className="rc-parties-grid">
            <div className="rc-party-card">
              <h3 className="rc-card-title">
                <ShieldCheck size={13} /> LOCADORA
              </h3>
              <p><strong>Razão:</strong> RG DA SILVA - ME (Mega Filmes e Fotografia)</p>
              <p><strong>Sede:</strong> Alameda dos Tatus, 155 - Dr. Silvio Leite - Boa Vista, RR</p>
              <p><strong>Resp. Sistêmico:</strong> {authorizerName} ({authorizerRole})</p>
            </div>

            <div className="rc-party-card">
              <h3 className="rc-card-title">
                <User size={13} /> LOCATÁRIO(A) / CLIENTE
              </h3>
              <p><strong>Nome / Razão:</strong> {rental.clientName}</p>
              <p><strong>CPF / CNPJ:</strong> {rental.clientDocument || 'Não informado'} • <strong>Telefone:</strong> {rental.clientPhone || 'Não informado'}</p>
              {rental.clientAddress && <p><strong>Endereço:</strong> {rental.clientAddress}</p>}
            </div>
          </div>

          {/* Período da Locação */}
          <div className="rc-schedule-strip">
            <div className="rc-sched-box">
              <span className="rc-sched-lbl">DATA E HORA DE RETIRADA</span>
              <span className="rc-sched-val">
                <Calendar size={13} /> {formatDateBR(rental.startDate)} às {rental.startTime || '08:00'}
              </span>
            </div>

            <div className="rc-sched-box highlight">
              <span className="rc-sched-lbl">DATA E HORA LIMITE DE DEVOLUÇÃO</span>
              <span className="rc-sched-val">
                <Clock size={13} /> {formatDateBR(rental.endDate)} às {rental.endTime || '18:00'}
              </span>
            </div>

            <div className="rc-sched-box duration">
              <span className="rc-sched-lbl">DURAÇÃO</span>
              <span className="rc-sched-val">{rental.totalDays} diária(s)</span>
            </div>
          </div>

          {/* Tabela de Equipamentos */}
          <div className="rc-items-section">
            <table className="rc-items-table">
              <thead>
                <tr>
                  <th style={{ width: '42%' }}>Equipamento / Modelo</th>
                  <th style={{ width: '22%' }}>Nº de Série / Patrimônio</th>
                  <th style={{ width: '8%', textAlign: 'center' }}>Qtd</th>
                  <th style={{ width: '13%', textAlign: 'right' }}>Valor Diária</th>
                  <th style={{ width: '15%', textAlign: 'right' }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {(rental.items || []).map((it, idx) => (
                  <tr key={idx}>
                    <td>
                      <strong>{it.name}</strong>
                      {it.category && <span className="rc-table-cat"> • {it.category}</span>}
                    </td>
                    <td>{it.serialNumber || 'Conferido no ato'}</td>
                    <td style={{ textAlign: 'center' }}>{it.quantity} un</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(it.dailyRate)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <strong>{formatCurrency(it.itemTotal || (it.dailyRate * it.quantity * (rental.totalDays || 1)))}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Resumo Financeiro */}
          <div className="rc-financial-summary">
            <div className="rc-fin-details">
              <p>
                <strong>Forma de Pagamento:</strong> {rental.paymentMethod || 'PIX'} •{' '}
                <strong>Status:</strong>{' '}
                <span className={`rc-pay-status status-${(rental.paymentStatus || 'pendente').toLowerCase()}`}>
                  {rental.paymentStatus || 'Pendente'}
                </span>
              </p>
              {rental.notes && <p className="rc-notes-p"><strong>Observações:</strong> {rental.notes}</p>}
            </div>

            <div className="rc-fin-totals">
              <div className="rc-fin-row">
                <span>Subtotal ({rental.totalDays} diárias):</span>
                <span>{formatCurrency(rental.subtotal || rental.totalAmount)}</span>
              </div>
              {rental.discount > 0 && (
                <div className="rc-fin-row text-discount">
                  <span>Desconto Aplicado:</span>
                  <span>- {formatCurrency(rental.discount)}</span>
                </div>
              )}
              <div className="rc-fin-row total-highlight">
                <span>VALOR TOTAL:</span>
                <span>{formatCurrency(rental.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Cláusulas e Termo de Responsabilidade Sintético */}
          <div className="rc-clauses-box">
            <h4 className="rc-clauses-title">
              {isReserved
                ? 'CONDIÇÕES GERAIS DE AGENDAMENTO E RESERVA DE ESTOQUE'
                : 'CLÁUSULAS CONTRATUAIS E TERMO DE RESPONSABILIDADE (LEI Nº 10.406 - CÓDIGO CIVIL)'}
            </h4>
            <ol className="rc-clauses-list">
              {isReserved ? (
                <>
                  <li><strong>BLOQUEIO DE ESTOQUE:</strong> A emissão deste comprovante reserva previamente os equipamentos descritos no período estipulado, garantindo a sua disponibilidade.</li>
                  <li><strong>RETIRADA &amp; QUITAÇÃO:</strong> A liberação e entrega dos equipamentos na sede da LOCADORA fica estritamente condicionada à quitação integral do pagamento acordado.</li>
                  <li><strong>CANCELAMENTO:</strong> Cancelamentos ou reagendamentos devem ser solicitados com no mínimo 24h de antecedência para desimpedimento do acervo.</li>
                  <li><strong>TOLERÂNCIA:</strong> O não comparecimento para retirada até 4h após o horário agendado sem aviso faculta à LOCADORA o cancelamento da reserva e liberação dos bens.</li>
                </>
              ) : (
                <>
                  <li><strong>VISTORIA &amp; RECEBIMENTO:</strong> O(A) LOCATÁRIO(A) declara inspecionar e testar previamente os bens, cabos e acessórios relacionados, recebendo-os em perfeito estado de funcionamento e conservação.</li>
                  <li><strong>GUARDA &amp; DESTINAÇÃO:</strong> O(A) LOCATÁRIO(A) responde integralmente pela guarda, zelo e conservação dos bens, utilizando-os para os fins a que se destinam, vedada sublocação, cessão ou empréstimo.</li>
                  <li><strong>AVARIAS, DANOS E EXTRAVIO:</strong> Qualquer avaria estética, quebra mecânica, dano por líquido/queda, furto ou roubo será de inteira responsabilidade do(a) LOCATÁRIO(A), que arcará com o conserto em autorizada ou reposição de item novo similar, além das diárias paradas.</li>
                  <li><strong>DEVOLUÇÃO &amp; MORA:</strong> Os equipamentos deverão ser devolvidos rigorosamente limpos e funcionais até a data e hora limites. Atrasos na entrega acarretarão cobrança de nova diária integral e penalidades do Art. 575 do Código Civil.</li>
                </>
              )}
            </ol>
          </div>

          {/* Campo de Assinaturas com QR Code Sistêmico */}
          <div className="rc-signatures-grid-v2">
            <div className="rc-sig-client-box">
              <div className="rc-sig-line"></div>
              <span className="rc-sig-name">{rental.clientName}</span>
              <span className="rc-sig-role">{isReserved ? 'CLIENTE / SOLICITANTE DA RESERVA' : 'LOCATÁRIO(A) / RESPONSÁVEL'}</span>
              <span className="rc-sig-doc">CPF/CNPJ: {rental.clientDocument || '_______________'}</span>
              <small className="rc-sig-subtext">Aceite formal e visto de conferência</small>
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
                <span className="rc-systemic-hash">Registro: <code>{contractHash}</code></span>
                <span className="rc-systemic-validity">Válido eletronicamente conforme Lei 14.063/20</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
