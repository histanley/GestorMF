import React, { useState } from 'react';
import {
  Send,
  X,
  Users,
  User,
  AlertTriangle,
  Info,
  Flame,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { apiSendMessage } from '../utils/api';

const QUICK_TITLES = [
  '📢 Aviso Operacional',
  '📅 Alteração de Escala',
  '🚨 Pauta Urgente',
  '🏢 Reunião na Base',
  '🚗 Instrução de Viatura'
];

export default function SendMessageModal({
  isOpen,
  onClose,
  members = [],
  onMessageSent,
  alertDialog
}) {
  const [recipientType, setRecipientType] = useState('ALL'); // 'ALL' | 'INDIVIDUAL'
  const [recipientId, setRecipientId] = useState('');
  const [priority, setPriority] = useState('NORMAL'); // 'NORMAL' | 'HIGH' | 'URGENT'
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  // Filtra apenas membros ativos
  const activeMembers = (members || []).filter((m) => m.active !== false && m.active !== 0);

  const selectedMember = activeMembers.find((m) => String(m.id) === String(recipientId));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      if (alertDialog) {
        alertDialog({
          title: 'Título Obrigatório',
          message: 'Por favor, informe o título ou assunto do comunicado.',
          variant: 'warning'
        });
      }
      return;
    }
    if (!message.trim()) {
      if (alertDialog) {
        alertDialog({
          title: 'Mensagem Obrigatória',
          message: 'Por favor, digite o conteúdo da mensagem a ser enviada.',
          variant: 'warning'
        });
      }
      return;
    }
    if (recipientType === 'INDIVIDUAL' && !recipientId) {
      if (alertDialog) {
        alertDialog({
          title: 'Selecione o Destinatário',
          message: 'Selecione um colaborador da lista para receber a mensagem individual.',
          variant: 'warning'
        });
      }
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        recipientType,
        recipientId: recipientType === 'INDIVIDUAL' ? recipientId : null,
        recipientUserId: recipientType === 'INDIVIDUAL' ? (selectedMember?.userId || selectedMember?.user_id || null) : null,
        recipientName: recipientType === 'INDIVIDUAL' ? (selectedMember?.name || '') : null,
        priority,
        title: title.trim(),
        message: message.trim()
      };

      const res = await apiSendMessage(payload);
      if (res && res.success !== false) {
        if (alertDialog) {
          await alertDialog({
            title: 'Mensagem Enviada',
            message: recipientType === 'ALL'
              ? 'O comunicado foi transmitido para toda a equipe com sucesso.'
              : `Mensagem enviada com sucesso para ${selectedMember?.name || 'o colaborador'}.`,
            variant: 'success'
          });
        }
        if (onMessageSent) onMessageSent();
        onClose();
      } else {
        if (alertDialog) {
          alertDialog({
            title: 'Erro ao Enviar',
            message: res?.error || 'Não foi possível entregar a mensagem. Tente novamente.',
            variant: 'warning'
          });
        }
      }
    } catch (err) {
      if (alertDialog) {
        alertDialog({
          title: 'Erro de Conexão',
          message: 'Falha de comunicação com o servidor ao enviar a mensagem.',
          variant: 'warning'
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal-container send-message-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '580px', width: '92%' }}
      >
        {/* Cabeçalho */}
        <div className="modal-header">
          <div className="modal-title-with-icon">
            <div className="modal-icon-badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
              <Send size={18} />
            </div>
            <div>
              <h3>Nova Mensagem / Comunicado</h3>
              <p className="modal-subtitle">Envie avisos operacionais para toda a equipe ou diretamente para um colaborador.</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {/* Tipo de Destinatário */}
          <div className="form-group">
            <label className="form-label">Destinatário do Comunicado *</label>
            <div className="msg-recipient-toggle">
              <button
                type="button"
                className={`msg-toggle-btn ${recipientType === 'ALL' ? 'active' : ''}`}
                onClick={() => {
                  setRecipientType('ALL');
                  setRecipientId('');
                }}
              >
                <Users size={16} />
                <span>📢 Toda a Equipe (Todos)</span>
              </button>
              <button
                type="button"
                className={`msg-toggle-btn ${recipientType === 'INDIVIDUAL' ? 'active' : ''}`}
                onClick={() => setRecipientType('INDIVIDUAL')}
              >
                <User size={16} />
                <span>👤 Individual (Colaborador)</span>
              </button>
            </div>
          </div>

          {/* Seletor de Colaborador (se Individual) */}
          {recipientType === 'INDIVIDUAL' && (
            <div className="form-group">
              <label className="form-label" htmlFor="msg-select-collab">Selecione o Colaborador *</label>
              <select
                id="msg-select-collab"
                className="form-input form-select"
                value={recipientId}
                onChange={(e) => setRecipientId(e.target.value)}
                required
              >
                <option value="">-- Escolha um colaborador da equipe --</option>
                {activeMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.role || 'Colaborador'}{m.company ? ` • ${m.company}` : ''})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Prioridade da Mensagem */}
          <div className="form-group">
            <label className="form-label">Nível de Prioridade</label>
            <div className="msg-priority-chips">
              <button
                type="button"
                className={`msg-prio-chip prio-normal ${priority === 'NORMAL' ? 'active' : ''}`}
                onClick={() => setPriority('NORMAL')}
              >
                <Info size={14} />
                <span>Normal</span>
              </button>
              <button
                type="button"
                className={`msg-prio-chip prio-high ${priority === 'HIGH' ? 'active' : ''}`}
                onClick={() => setPriority('HIGH')}
              >
                <AlertTriangle size={14} />
                <span>Alta Prioridade</span>
              </button>
              <button
                type="button"
                className={`msg-prio-chip prio-urgent ${priority === 'URGENT' ? 'active' : ''}`}
                onClick={() => setPriority('URGENT')}
              >
                <Flame size={14} />
                <span>🚨 Urgente</span>
              </button>
            </div>
          </div>

          {/* Sugestões Rápidas de Título */}
          <div className="form-group" style={{ marginBottom: '8px' }}>
            <label className="form-label">Assunto / Título *</label>
            <div className="msg-quick-titles">
              {QUICK_TITLES.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="msg-quick-chip"
                  onClick={() => setTitle(t.replace(/^[^\w\s]+/, '').trim())}
                >
                  {t}
                </button>
              ))}
            </div>
            <input
              type="text"
              className="form-input"
              placeholder="Ex: Pauta urgente no Tribunal de Justiça às 14h..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={150}
              required
            />
          </div>

          {/* Conteúdo da Mensagem */}
          <div className="form-group">
            <label className="form-label">Conteúdo da Mensagem *</label>
            <textarea
              className="form-input form-textarea"
              rows={4}
              placeholder="Digite o texto detalhado da mensagem ou orientação operacional para a equipe..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
            />
            <div style={{ textAlign: 'right', fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)', marginTop: '4px' }}>
              {message.length} caracteres
            </div>
          </div>

          {/* Rodapé de Ações */}
          <div className="modal-actions" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="button"
              className="msg-btn-cancel"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={`msg-btn-submit prio-${priority.toLowerCase()}`}
              disabled={isSubmitting}
            >
              <Send size={15} className={isSubmitting ? 'msg-icon-sending' : ''} />
              <span>{isSubmitting ? 'Transmitindo...' : recipientType === 'ALL' ? 'Enviar para Todos' : 'Enviar Mensagem'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

