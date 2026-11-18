import React, { useState, useEffect, useMemo } from 'react';
import { MessageCircle, Copy, Check, ExternalLink, X, Send, Phone, User, Info } from 'lucide-react';
import { formatMissionWhatsAppText, buildWhatsAppShareUrl } from '../utils/whatsappMissionShare';
import { getMissionCode } from '../utils/geo';

export default function MissionWhatsAppShareModal({
  isOpen,
  onClose,
  mission,
  missions = [],
  vehicles = [],
  members = [],
  currentUser = null,
}) {
  const [recipientPhone, setRecipientPhone] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [copied, setCopied] = useState(false);

  // Inicializa o texto da mensagem sempre que a missão mudar ou a modal abrir
  useEffect(() => {
    if (isOpen && mission) {
      const generated = formatMissionWhatsAppText(mission, { missions, vehicles, members });
      setMessageContent(generated);
      setRecipientPhone('');
      setCopied(false);
    }
  }, [isOpen, mission, missions, vehicles, members]);

  // Lista de membros associados à missão com telefone cadastrado para sugestão rápida
  const quickMemberContacts = useMemo(() => {
    if (!mission || !Array.isArray(members)) return [];
    const list = [];
    const seen = new Set();

    // 1. Motorista
    if (mission.driverId) {
      const d = members.find((m) => String(m.id) === String(mission.driverId));
      if (d && d.phone && !seen.has(d.id)) {
        seen.add(d.id);
        list.push({ ...d, roleBadge: 'Motorista' });
      }
    }

    // 2. Equipe de campo
    if (Array.isArray(mission.teamIds)) {
      mission.teamIds.forEach((id) => {
        const m = members.find((mem) => String(mem.id) === String(id));
        if (m && m.phone && !seen.has(m.id)) {
          seen.add(m.id);
          list.push({ ...m, roleBadge: 'Equipe' });
        }
      });
    }

    // 3. Editores
    if (Array.isArray(mission.editorIds)) {
      mission.editorIds.forEach((id) => {
        const m = members.find((mem) => String(mem.id) === String(id));
        if (m && m.phone && !seen.has(m.id)) {
          seen.add(m.id);
          list.push({ ...m, roleBadge: 'Editor' });
        }
      });
    }

    return list;
  }, [mission, members]);

  if (!isOpen || !mission) return null;

  const missionCode = getMissionCode(mission, missions) || mission.code || mission.id || 'N/A';
  const missionTitle = mission.title || mission.pauta || mission.description || 'Missão Sem Título';

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(messageContent);
      } else {
        // Fallback legado
        const textArea = document.createElement('textarea');
        textArea.value = messageContent;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Falha ao copiar texto:', err);
    }
  };

  const handleSendWhatsApp = () => {
    const url = buildWhatsAppShareUrl(recipientPhone, messageContent);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleApplyQuickContact = (phone) => {
    setRecipientPhone(phone || '');
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1250 }}>
      <div
        className="modal-container mission-whatsapp-share-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '640px', width: '95%' }}
      >
        {/* CABEÇALHO */}
        <div className="modal-header whatsapp-theme-header">
          <div className="mwa-header-info">
            <div className="mwa-icon-badge">
              <MessageCircle size={22} color="#ffffff" />
            </div>
            <div>
              <h3 className="mwa-title">Compartilhar Missão via WhatsApp</h3>
              <p className="mwa-subtitle">
                Envie dados completos para freelancers, convidados ou grupos
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn-close-modal"
            onClick={onClose}
            title="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* CORPO */}
        <div className="modal-body mwa-modal-body">
          {/* IDENTIFICAÇÃO DA PAUTA */}
          <div className="mwa-pauta-banner">
            <span className="mwa-code-pill">#{missionCode}</span>
            <span className="mwa-pauta-name">{missionTitle}</span>
          </div>

          {/* TELEFONE DESTINATÁRIO (OPCIONAL) */}
          <div className="mwa-form-group">
            <label className="mwa-label">
              <Phone size={14} /> Telefone do Destinatário (Freelancer, Convidado ou Contato)
            </label>
            <div className="mwa-phone-input-wrap">
              <input
                type="text"
                className="form-control mwa-phone-input"
                placeholder="(95) 99999-9999 ou deixe em branco para escolher no WhatsApp"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
              />
              {recipientPhone && (
                <button
                  type="button"
                  className="mwa-clear-phone"
                  onClick={() => setRecipientPhone('')}
                  title="Limpar telefone"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <span className="mwa-hint">
              <Info size={12} /> Se deixar em branco, o WhatsApp abrirá diretamente para você selecionar o contato ou grupo.
            </span>
          </div>

          {/* CHIPS RÁPIDOS DE CONTATOS DA MISSÃO */}
          {quickMemberContacts.length > 0 && (
            <div className="mwa-quick-contacts">
              <span className="mwa-qc-title">Contatos rápidos da missão:</span>
              <div className="mwa-qc-chips">
                {quickMemberContacts.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`mwa-qc-chip ${recipientPhone === c.phone ? 'active' : ''}`}
                    onClick={() => handleApplyQuickContact(c.phone)}
                    title={`Preencher telefone de ${c.name} (${c.phone})`}
                  >
                    <User size={12} />
                    <span>{c.name.split(' ')[0]} ({c.roleBadge})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* PRÉ-VISUALIZAÇÃO / EDIÇÃO DO TEXTO */}
          <div className="mwa-form-group" style={{ marginTop: '12px' }}>
            <div className="mwa-preview-header">
              <label className="mwa-label" style={{ marginBottom: 0 }}>
                Texto da Mensagem (Você pode editar antes de enviar):
              </label>
              <button
                type="button"
                className={`mwa-btn-copy-preview ${copied ? 'copied' : ''}`}
                onClick={handleCopy}
                title="Copiar texto para a área de transferência"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                <span>{copied ? 'Copiado!' : 'Copiar Texto'}</span>
              </button>
            </div>
            <textarea
              className="form-control mwa-textarea-preview"
              rows={11}
              value={messageContent}
              onChange={(e) => setMessageContent(e.target.value)}
              placeholder="Carregando mensagem da missão..."
            />
          </div>
        </div>

        {/* RODAPÉ */}
        <div className="modal-footer mwa-modal-footer">
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
          >
            Fechar
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleCopy}
            title="Copiar para a Área de Transferência"
          >
            {copied ? <Check size={15} color="#25d366" /> : <Copy size={15} />}
            <span>{copied ? 'Mensagem Copiada!' : 'Copiar Mensagem'}</span>
          </button>
          <button
            type="button"
            className="btn-primary mwa-btn-send-whatsapp"
            onClick={handleSendWhatsApp}
            title="Abrir no WhatsApp Web ou App"
          >
            <Send size={15} />
            <span>Enviar no WhatsApp</span>
            <ExternalLink size={13} style={{ opacity: 0.8 }} />
          </button>
        </div>
      </div>
    </div>
  );
}
