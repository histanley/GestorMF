import React from 'react';
import {
  X,
  Printer,
  Share2,
  CheckCircle,
  FileText,
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  MapPin,
  ShieldCheck,
  Package,
} from 'lucide-react';
import { formatCurrency, formatDateBR } from '../utils/rentalsData';
import { alertDialog } from '../utils/dialog';

export default function RentalContractModal({ rental, onClose }) {
  if (!rental) return null;

  const isReserved = rental.status === 'reserved';

  const handlePrint = () => {
    window.print();
  };

  const handleCopyWhatsApp = async () => {
    const itemsList = (rental.items || [])
      .map((it, idx) => `  ${idx + 1}. *${it.name}* (${it.quantity}x) — ${formatCurrency(it.dailyRate)}/dia`)
      .join('\n');

    const headerTitle = isReserved
      ? `🎬 *MEGAFILMES — COMPROVANTE DE AGENDAMENTO & RESERVA*`
      : `🎬 *MEGAFILMES — COMPROVANTE & TERMO DE LOCAÇÃO*`;

    const statusNote = isReserved
      ? `⚠️ *Importante:* Agendamento confirmado com reserva de estoque. A liberação e retirada dos equipamentos fica condicionada à quitação do pagamento acordado.`
      : `⚠️ *Importante:* A devolução deve ocorrer até o horário limite estipulado, com todos os cabos e acessórios em perfeito estado de conservação.`;

    const text = `${headerTitle}
📄 *Código:* ${rental.code}
👤 *Cliente:* ${rental.clientName}
📞 *Contato:* ${rental.clientPhone || 'Não informado'}

📅 *Período Agendado:*
• *Retirada:* ${formatDateBR(rental.startDate)} às ${rental.startTime || '08:00'}
• *Devolução:* ${formatDateBR(rental.endDate)} às ${rental.endTime || '18:00'}
• *Duração:* ${rental.totalDays} dia(s)

📦 *Equipamentos Reservados:*
${itemsList}

💰 *Valor Total:* *${formatCurrency(rental.totalAmount)}*
💳 *Pagamento:* ${rental.paymentMethod || 'PIX'} (${rental.paymentStatus || 'Pendente'})

${statusNote}

_MegaFilmes Produções Audiovisuais_`;

    try {
      await navigator.clipboard.writeText(text);
      alertDialog({
        title: 'Copiado para o WhatsApp!',
        message: 'O resumo formatado da locação/reserva foi copiado para a área de transferência. Basta colar na conversa com o cliente.',
        variant: 'success',
      });
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
        {/* Barra Superior de Ações (Oculta na Impressão) */}
        <div className="rc-modal-topbar no-print">
          <div className="rc-topbar-title">
            <FileText size={18} className="text-gold" />
            <span>{isReserved ? 'Comprovante de Agendamento & Reserva de Equipamentos' : 'Termo de Responsabilidade & Contrato de Locação'}</span>
            <span className="rc-code-badge">{rental.code}</span>
          </div>

          <div className="rc-topbar-actions">
            <button
              type="button"
              className="btn-secondary rc-btn-whatsapp"
              onClick={handleCopyWhatsApp}
              title="Copiar resumo para WhatsApp"
            >
              <Share2 size={15} /> WhatsApp
            </button>
            <button
              type="button"
              className="btn-primary rc-btn-print"
              onClick={handlePrint}
              title="Imprimir ou Salvar em PDF"
            >
              <Printer size={15} /> Imprimir / PDF
            </button>
            <button
              type="button"
              className="modal-close rc-close-btn"
              onClick={onClose}
              title="Fechar Janela"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Folha do Documento (Pronta para Visualização e Impressão A4) */}
        <div className="rc-document-sheet">
          {/* Cabeçalho Corporativo Timbrado */}
          <div className="rc-doc-header">
            <div className="rc-doc-brand">
              <h1 className="rc-brand-name">MEGAFILMES</h1>
              <span className="rc-brand-sub">PRODUÇÕES AUDIOVISUAIS &amp; LOCAÇÕES</span>
              <p className="rc-brand-info">
                Sede: R. Sardinha, 1061 - Tancredo Neves, Boa Vista - RR<br />
                Telefone/WhatsApp: (95) 99112-0000 • contato@megafilmes.com.br
              </p>
            </div>

            <div className="rc-doc-meta">
              <div className="rc-meta-box">
                <span className="rc-meta-lbl">{isReserved ? 'RESERVA / AGENDAMENTO Nº' : 'TERMO DE LOCAÇÃO Nº'}</span>
                <span className="rc-meta-code">{rental.code}</span>
                <span className="rc-meta-date">Emissão: {formatDateBR(rental.createdAt ? rental.createdAt.split('T')[0] : rental.startDate)}</span>
              </div>
            </div>
          </div>

          <div className="rc-divider"></div>

          {/* Dados das Partes */}
          <div className="rc-parties-grid">
            <div className="rc-party-card">
              <h3 className="rc-card-title">
                <ShieldCheck size={14} /> LOCADORA
              </h3>
              <p><strong>Razão Social:</strong> MegaFilmes Produções Audiovisuais</p>
              <p><strong>Endereço:</strong> Boa Vista, Roraima</p>
              <p><strong>Responsável:</strong> {rental.createdBy || 'Gestão MegaFilmes'}</p>
            </div>

            <div className="rc-party-card">
              <h3 className="rc-card-title">
                <User size={14} /> LOCATÁRIO(A) / CLIENTE
              </h3>
              <p><strong>Nome Completo:</strong> {rental.clientName}</p>
              <p><strong>CPF / CNPJ:</strong> {rental.clientDocument || 'Não informado'}</p>
              <p><strong>Telefone:</strong> {rental.clientPhone || 'Não informado'}</p>
              {rental.clientEmail && <p><strong>E-mail:</strong> {rental.clientEmail}</p>}
              {rental.clientAddress && <p><strong>Endereço:</strong> {rental.clientAddress}</p>}
            </div>
          </div>

          {/* Período da Locação */}
          <div className="rc-schedule-strip">
            <div className="rc-sched-box">
              <span className="rc-sched-lbl">DATA E HORA DE RETIRADA</span>
              <span className="rc-sched-val">
                <Calendar size={14} /> {formatDateBR(rental.startDate)} às {rental.startTime || '08:00'}
              </span>
            </div>

            <div className="rc-sched-box highlight">
              <span className="rc-sched-lbl">DATA E HORA LIMITE DE DEVOLUÇÃO</span>
              <span className="rc-sched-val">
                <Clock size={14} /> {formatDateBR(rental.endDate)} às {rental.endTime || '18:00'}
              </span>
            </div>

            <div className="rc-sched-box">
              <span className="rc-sched-lbl">DURAÇÃO TOTAL</span>
              <span className="rc-sched-val">{rental.totalDays} dia(s)</span>
            </div>
          </div>

          {/* Tabela de Equipamentos */}
          <div className="rc-items-section">
            <h3 className="rc-section-title">
              <Package size={15} /> RELAÇÃO DISCRIMINADA DE EQUIPAMENTOS E ACESSÓRIOS
            </h3>

            <table className="rc-items-table">
              <thead>
                <tr>
                  <th style={{ width: '45%' }}>Equipamento / Modelo</th>
                  <th style={{ width: '18%' }}>Nº de Série / Tag</th>
                  <th style={{ width: '10%', textAlign: 'center' }}>Qtd</th>
                  <th style={{ width: '13%', textAlign: 'right' }}>Valor Diária</th>
                  <th style={{ width: '14%', textAlign: 'right' }}>Subtotal</th>
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
              <p><strong>Forma de Pagamento:</strong> {rental.paymentMethod || 'PIX'}</p>
              <p>
                <strong>Status do Pagamento:</strong>{' '}
                <span className={`rc-pay-status status-${(rental.paymentStatus || 'pendente').toLowerCase()}`}>
                  {rental.paymentStatus || 'Pendente'}
                </span>
              </p>
              {rental.notes && <p><strong>Observações:</strong> {rental.notes}</p>}
            </div>

            <div className="rc-fin-totals">
              <div className="rc-fin-row">
                <span>Subtotal ({rental.totalDays} diárias):</span>
                <span>{formatCurrency(rental.subtotal || rental.totalAmount)}</span>
              </div>
              {rental.discount > 0 && (
                <div className="rc-fin-row text-discount">
                  <span>Desconto:</span>
                  <span>- {formatCurrency(rental.discount)}</span>
                </div>
              )}
              <div className="rc-fin-row total-highlight">
                <span>VALOR TOTAL:</span>
                <span>{formatCurrency(rental.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Cláusulas e Termo de Responsabilidade */}
          <div className="rc-clauses-box">
            <h4 className="rc-clauses-title">
              {isReserved ? 'CONDIÇÕES GERAIS DE AGENDAMENTO E RESERVA DE EQUIPAMENTOS' : 'CLÁUSULAS CONTRATUAIS E TERMO DE RESPONSABILIDADE'}
            </h4>
            <ol className="rc-clauses-list">
              {isReserved ? (
                <>
                  <li>
                    <strong>BLOQUEIO E RESERVA DE ESTOQUE:</strong> A emissão deste comprovante garante a pré-reserva e o bloqueio físico dos equipamentos descritos durante o período acordado, impedindo a locação para terceiros.
                  </li>
                  <li>
                    <strong>LIBERAÇÃO E RETIRADA:</strong> A liberação e entrega dos equipamentos na sede da LOCADORA fica estritamente condicionada à confirmação do pagamento e à assinatura do Termo Oficial de Responsabilidade no ato da retirada.
                  </li>
                  <li>
                    <strong>CANCELAMENTO E REAGENDAMENTO:</strong> O cancelamento ou alteração de datas deve ser comunicado com antecedência mínima de 24 horas para desimpedimento dos itens no acervo.
                  </li>
                  <li>
                    <strong>TOLERÂNCIA DE RETIRADA:</strong> Caso os equipamentos não sejam retirados dentro do prazo acordado sem aviso prévio, a reserva poderá ser cancelada e os itens liberados para nova locação.
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <strong>RECEBIMENTO E CONFERÊNCIA:</strong> O(A) LOCATÁRIO(A) declara haver inspecionado e testado previamente todos os equipamentos, cabos e acessórios relacionados neste termo, recebendo-os em perfeito estado de conservação, limpeza e pleno funcionamento técnico.
                  </li>
                  <li>
                    <strong>USO E GUARDA:</strong> O(A) LOCATÁRIO(A) assume a responsabilidade integral pela guarda, zelo e conservação dos bens, utilizando-os estritamente para os fins a que se destinam, sendo expressamente vedada a sublocação, cessão ou empréstimo a terceiros sem prévia anuência da LOCADORA.
                  </li>
                  <li>
                    <strong>AVARIAS, DANOS OU EXTRAVIO:</strong> Qualquer dano, avaria estética, quebra mecânica, dano por líquido/queda, furto ou roubo ocorrido durante o período de locação será de inteira e exclusiva responsabilidade do(a) LOCATÁRIO(A), que se obriga a arcar integralmente com os custos de reparo em assistência autorizada ou ressarcir o valor de reposição imediata de item novo similar, além de arcar com as diárias paradas durante a indisponibilidade do bem.
                  </li>
                  <li>
                    <strong>DEVOLUÇÃO E HORÁRIO LIMITE:</strong> Os equipamentos deverão ser devolvidos rigorosamente limpos e organizados até a data e hora limites estipuladas. Atrasos na entrega acarretarão a cobrança de nova diária integral por dia ou fração excedente.
                  </li>
                </>
              )}
            </ol>
          </div>

          {/* Campo de Assinaturas */}
          <div className="rc-signatures-grid">
            <div className="rc-sig-box">
              <div className="rc-sig-line"></div>
              <span className="rc-sig-name">{rental.clientName}</span>
              <span className="rc-sig-role">{isReserved ? 'CLIENTE / SOLICITANTE DA RESERVA' : 'LOCATÁRIO(A) / RESPONSÁVEL'}</span>
              <span className="rc-sig-doc">CPF/CNPJ: {rental.clientDocument || '_______________'}</span>
            </div>

            <div className="rc-sig-box">
              <div className="rc-sig-line"></div>
              <span className="rc-sig-name">MegaFilmes Produções Audiovisuais</span>
              <span className="rc-sig-role">{isReserved ? 'RESPONSÁVEL PELO AGENDAMENTO' : 'LOCADORA / RESPONSÁVEL TÉCNICO'}</span>
              <span className="rc-sig-doc">{isReserved ? 'Confirmação de Agendamento' : 'Visto de Entrega & Liberação'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

