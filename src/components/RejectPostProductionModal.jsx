// ==============================================================================
// GestorMF - Modal Moderno: Rejeitar e Reabrir Serviço de Pós-Produção
// Design refinado, suporte a múltiplos editores e devolução seletiva de pautas.
// ==============================================================================

import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  AlertTriangle,
  Calendar,
  Clock,
  User,
  Users,
  CheckCircle2,
  X,
  FileEdit,
  Sparkles,
} from 'lucide-react';
import { getMissionCode, formatDateBR } from '../utils/geo';
import { resolveMissionEditors, getMissionEditionDeliverySummary } from '../utils/postProduction';

export default function RejectPostProductionModal({
  isOpen,
  onClose,
  mission,
  missions = [],
  members = [],
  currentUser = null,
  onConfirmReopen = null,
}) {
  const [reason, setReason] = useState('');
  const [hasNewDeadline, setHasNewDeadline] = useState(false);
  const [newDeadlineDate, setNewDeadlineDate] = useState('');
  const [newDeadlineTime, setNewDeadlineTime] = useState('18:00');
  const [targetEditorId, setTargetEditorId] = useState('ALL'); // 'ALL' ou id do editor específico
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (mission && isOpen) {
      setReason(mission.reopenReason || '');
      setHasNewDeadline(false);
      setNewDeadlineDate(mission.deliveryDeadlineDate || mission.date || '');
      setNewDeadlineTime(mission.deliveryDeadlineTime || '18:00');
      setTargetEditorId('ALL');
      setIsSubmitting(false);
    }
  }, [mission, isOpen]);

  if (!isOpen || !mission) return null;

  const mCode = getMissionCode(mission, missions);
  const assignedEditors = resolveMissionEditors(mission, members);
  const hasMultipleEditors = assignedEditors.length > 1;
  const deliverySummary = getMissionEditionDeliverySummary(mission, members);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!reason.trim()) {
      return;
    }
    setIsSubmitting(true);
    try {
      if (onConfirmReopen) {
        await onConfirmReopen({
          mission,
          reason: reason.trim(),
          targetEditorId,
          hasNewDeadline,
          newDeadlineDate: hasNewDeadline ? newDeadlineDate : null,
          newDeadlineTime: hasNewDeadline ? newDeadlineTime : null,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay reopen-modal-backdrop" onClick={onClose}>
      <div
        className="modal-box modal-box-compact modern-reopen-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* CABEÇALHO ELEGANTE COM GLOW SUAVE */}
        <div className="modern-reopen-header">
          <div className="mrh-left">
            <div className="mrh-icon-badge">
              <RotateCcw size={18} className="mrh-rotate-icon" />
            </div>
            <div className="mrh-title-box">
              <div className="mrh-title-row">
                <h3 className="mrh-title">Rejeitar e Reabrir Serviço</h3>
                <span className="mrh-code-badge">#{mCode}</span>
              </div>
              <p className="mrh-desc" title={mission.description}>
                {mission.description}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="mrh-close-btn"
            onClick={onClose}
            aria-label="Fechar"
            disabled={isSubmitting}
          >
            <X size={18} />
          </button>
        </div>

        {/* CORPO DO MODAL */}
        <form onSubmit={handleSubmit} className="modern-reopen-body">
          {/* Card de Aviso / Instrução Diretoria */}
          <div className="mrh-warning-card">
            <div className="mrh-wc-icon">
              <AlertTriangle size={18} />
            </div>
            <div className="mrh-wc-text">
              <span>
                Esta ação rejeitará o material e retornará a pauta para{' '}
                <strong className="text-warning-highlight">Pendente (Em Edição)</strong>. Os editores serão
                notificados com suas observações técnicas.
              </span>
            </div>
          </div>

          {/* SELETOR DE DESTINATÁRIO CASO A MISSÃO TENHA MÚLTIPLOS EDITORES */}
          {hasMultipleEditors && (
            <div className="mrh-section-box">
              <label className="mrh-section-label">
                <Users size={14} className="text-cyan-bright" />
                <span>Aplicar Reabertura / Ajustes para:</span>
              </label>
              <div className="mrh-target-pills">
                <button
                  type="button"
                  className={`mrh-target-pill ${targetEditorId === 'ALL' ? 'active' : ''}`}
                  onClick={() => setTargetEditorId('ALL')}
                >
                  <Users size={13} />
                  <span>Todos os Editores ({assignedEditors.length})</span>
                </button>
                {assignedEditors.map((ed) => {
                  const edDeliv = deliverySummary.deliveryMap[String(ed.id)];
                  const isDone = edDeliv && edDeliv.status === 'delivered';
                  const isSelected = targetEditorId === String(ed.id);
                  return (
                    <button
                      key={ed.id}
                      type="button"
                      className={`mrh-target-pill ${isSelected ? 'active' : ''}`}
                      onClick={() => setTargetEditorId(String(ed.id))}
                      title={isDone ? `Já entregou sua parte. Clique para solicitar ajustes especificamente a ele.` : `Ainda pendente.`}
                    >
                      <User size={13} />
                      <span>Apenas {ed.name}</span>
                      {isDone ? (
                        <span className="mrh-pill-tag done" title="Parte entregue">
                          ✅ Entregue
                        </span>
                      ) : (
                        <span className="mrh-pill-tag pending" title="Parte pendente">
                          ⏳ Pendente
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <small className="mrh-hint">
                {targetEditorId === 'ALL'
                  ? 'Todos os editores terão suas etapas reabertas para revisão conjunta.'
                  : `Apenas a etapa do editor selecionado será reaberta; as entregas dos demais permanecem salvas.`}
              </small>
            </div>
          )}

          {/* CAMPO DE MOTIVO / AJUSTES SOLICITADOS */}
          <div className="mrh-form-field">
            <div className="mrh-field-header">
              <label htmlFor="reopen-reason-input" className="mrh-field-label">
                <FileEdit size={14} className="text-amber" />
                <span>Motivo da Rejeição / Ajustes Solicitados:</span>
                <span className="mrh-req-tag">Obrigatório</span>
              </label>
              <span className="mrh-char-count">{reason.length} caracteres</span>
            </div>
            <div className="mrh-textarea-wrapper">
              <textarea
                id="reopen-reason-input"
                rows="3"
                required
                className="mrh-textarea"
                placeholder="Descreva com clareza o que precisa ser ajustado (ex: cortes, áudio, trilha sonora, vinheta, cor, fotos pendentes)..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          {/* SWITCH MODERNO: NOVO PRAZO LIMITE */}
          <div className="mrh-deadline-section">
            <div
              className={`mrh-deadline-toggle-card ${hasNewDeadline ? 'checked' : ''}`}
              onClick={() => setHasNewDeadline(!hasNewDeadline)}
            >
              <div className="mrh-dtc-left">
                <div className="mrh-dtc-icon">
                  <Calendar size={15} />
                </div>
                <div className="mrh-dtc-labels">
                  <span className="mrh-dtc-title">Estipular novo prazo limite de entrega</span>
                  <span className="mrh-dtc-sub">
                    {hasNewDeadline
                      ? 'Defina nova data e horário limite para os editores'
                      : 'Manter o prazo limite original cadastrado na pauta'}
                  </span>
                </div>
              </div>
              <div className={`mrh-switch ${hasNewDeadline ? 'active' : ''}`}>
                <div className="mrh-switch-handle" />
              </div>
            </div>

            {hasNewDeadline && (
              <div className="mrh-deadline-fields-grid">
                <div className="mrh-field-col">
                  <label className="mrh-sublabel">
                    <Calendar size={13} className="text-muted" />
                    <span>Nova Data Limite:</span>
                  </label>
                  <input
                    type="date"
                    required={hasNewDeadline}
                    className="mrh-input"
                    value={newDeadlineDate}
                    onChange={(e) => setNewDeadlineDate(e.target.value)}
                  />
                </div>
                <div className="mrh-field-col">
                  <label className="mrh-sublabel">
                    <Clock size={13} className="text-muted" />
                    <span>Novo Horário Limite:</span>
                  </label>
                  <input
                    type="time"
                    required={hasNewDeadline}
                    className="mrh-input"
                    value={newDeadlineTime}
                    onChange={(e) => setNewDeadlineTime(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* RODAPÉ DO MODAL */}
          <div className="modern-reopen-footer">
            <button
              type="button"
              className="mrh-btn-cancel"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="mrh-btn-confirm"
              disabled={isSubmitting || !reason.trim()}
            >
              <RotateCcw size={15} className={isSubmitting ? 'animate-spin' : ''} />
              <span>{isSubmitting ? 'Processando Reabertura...' : 'Rejeitar e Reabrir Pauta'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
