// ==============================================================================
// GestorMF - Modal Moderno de Conclusão de Pós-Produção
// Suporte a entregas individuais de múltiplos editores na mesma pauta.
// ==============================================================================

import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Folder,
  MessageSquare,
  Clock,
  User,
  Users,
  X,
  Send,
  HardDrive,
} from 'lucide-react';
import { getMissionCode, formatDateBR } from '../utils/geo';
import {
  resolveMissionEditors,
  getMissionEditionDeliverySummary,
  canUserDeliverForEditor,
} from '../utils/postProduction';

export default function ConcludePostProductionModal({
  isOpen,
  onClose,
  mission,
  missions = [],
  members = [],
  currentUser = null,
  onConfirmConclude = null,
}) {
  const [selectedEditorId, setSelectedEditorId] = useState('');
  const [serverFilePath, setServerFilePath] = useState('');
  const [editorMessage, setEditorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const assignedEditors = resolveMissionEditors(mission, members);
  const deliverySummary = getMissionEditionDeliverySummary(mission, members);
  const hasMultipleEditors = assignedEditors.length > 1;

  useEffect(() => {
    if (mission && isOpen) {
      // Pré-seleciona o editor com base no usuário logado
      let initialEditor = null;
      if (currentUser) {
        initialEditor = assignedEditors.find((e) =>
          canUserDeliverForEditor(e.id, currentUser, members)
        );
      }
      if (!initialEditor) {
        // Se o admin estiver entregando, pega o primeiro que estiver pendente
        initialEditor = deliverySummary.pendingEditors[0] || assignedEditors[0] || null;
      }

      const edId = initialEditor ? String(initialEditor.id) : '';
      setSelectedEditorId(edId);

      // Preenche caminhos anteriores se já existirem
      const prevDeliv = deliverySummary.deliveryMap[edId];
      setServerFilePath(prevDeliv?.serverFilePath || mission.serverFilePath || '');
      setEditorMessage(prevDeliv?.notes || '');
      setIsSubmitting(false);
    }
  }, [mission, isOpen]);

  // Se trocar o editor selecionado, atualiza os campos com os dados dele
  const handleSelectEditor = (edId) => {
    setSelectedEditorId(edId);
    const prevDeliv = deliverySummary.deliveryMap[edId];
    if (prevDeliv) {
      setServerFilePath(prevDeliv.serverFilePath || '');
      setEditorMessage(prevDeliv.notes || '');
    } else {
      setServerFilePath(mission?.serverFilePath || '');
      setEditorMessage('');
    }
  };

  if (!isOpen || !mission) return null;

  const mCode = getMissionCode(mission, missions);

  // Validação de pontualidade
  const now = new Date();
  let isLate = false;
  let deadlineStr = '';
  if (mission.deliveryDeadlineDate) {
    const deadlineDateStr = `${mission.deliveryDeadlineDate}T${mission.deliveryDeadlineTime || '18:00'}:00`;
    const deadlineObj = new Date(deadlineDateStr);
    if (!isNaN(deadlineObj.getTime())) {
      isLate = now.getTime() > deadlineObj.getTime();
      deadlineStr = `${formatDateBR(mission.deliveryDeadlineDate)} às ${mission.deliveryDeadlineTime || '18:00'}`;
    }
  }

  // Verifica se esta entrega fechará a última pendência dos editores
  const selectedDeliv = deliverySummary.deliveryMap[selectedEditorId];
  const isAlreadyDelivered = selectedDeliv && selectedDeliv.status === 'delivered';
  const isMissionFinalized = mission.missionStatus === 'Finalizada' || mission.missionStatus === 'Finalizado' || mission.missionStatus === 'Concluída';
  const otherPending = deliverySummary.pendingEditors.filter((e) => String(e.id) !== String(selectedEditorId));
  const willCompleteEntireMission = otherPending.length === 0;

  const currentEditorObj = assignedEditors.find((e) => String(e.id) === String(selectedEditorId));
  const editorName = currentEditorObj?.name || currentUser?.name || 'Editor';

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (isMissionFinalized) return;
    setIsSubmitting(true);
    try {
      if (onConfirmConclude) {
        await onConfirmConclude({
          mission,
          editorId: selectedEditorId,
          editorName,
          serverFilePath: serverFilePath.trim(),
          editorMessage: editorMessage.trim(),
          isLate,
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
        {/* CABEÇALHO */}
        <div className="modern-reopen-header">
          <div className="mrh-left">
            <div
              className="mrh-icon-badge"
              style={{
                background: isLate ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                borderColor: isLate ? 'rgba(245, 158, 11, 0.35)' : 'rgba(16, 185, 129, 0.35)',
                color: isLate ? '#fbbf24' : '#34d399',
                boxShadow: isLate ? '0 0 16px rgba(245, 158, 11, 0.2)' : '0 0 16px rgba(16, 185, 129, 0.2)',
              }}
            >
              {isLate ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
            </div>
            <div className="mrh-title-box">
              <div className="mrh-title-row">
                <h3 className="mrh-title">
                  {hasMultipleEditors ? 'Entregar Minha Parte na Edição' : 'Concluir Pós-Produção'}
                </h3>
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

        {/* CORPO */}
        <form onSubmit={handleSubmit} className="modern-reopen-body">
          {/* Card de Pontualidade */}
          {isLate ? (
            <div
              className="mrh-warning-card"
              style={{
                background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.15) 0%, rgba(239, 68, 68, 0.08) 100%)',
                borderColor: 'rgba(245, 158, 11, 0.35)',
                borderLeftColor: '#f59e0b',
              }}
            >
              <div className="mrh-wc-icon" style={{ color: '#fbbf24' }}>
                <AlertTriangle size={18} />
              </div>
              <div className="mrh-wc-text" style={{ color: '#fef3c7' }}>
                <span>
                  Atenção: O prazo estipulado ({deadlineStr || 'combinado'}) expirou. A entrega será registrada como{' '}
                  <strong style={{ color: '#f59e0b' }}>FORA DO PRAZO</strong> no histórico da missão.
                </span>
              </div>
            </div>
          ) : (
            <div
              className="mrh-warning-card"
              style={{
                background: 'linear-gradient(90deg, rgba(16, 185, 129, 0.14) 0%, rgba(6, 182, 212, 0.06) 100%)',
                borderColor: 'rgba(16, 185, 129, 0.35)',
                borderLeftColor: '#10b981',
              }}
            >
              <div className="mrh-wc-icon" style={{ color: '#34d399' }}>
                <CheckCircle2 size={18} />
              </div>
              <div className="mrh-wc-text" style={{ color: '#d1fae5' }}>
                <span>
                  Parabéns pela pontualidade! Prazo limite:{' '}
                  <strong>{deadlineStr || 'Hoje'}</strong>. Sua entrega está{' '}
                  <strong style={{ color: '#10b981' }}>DENTRO DO PRAZO</strong>.
                </span>
              </div>
            </div>
          )}

          {/* SELETOR DE EDITOR RESPONSÁVEL CASO TENHA MÚLTIPLOS EDITORES */}
          {hasMultipleEditors && (
            <div className="mrh-section-box">
              <label className="mrh-section-label">
                <Users size={14} className="text-cyan-bright" />
                <span>Registrar entrega em nome de:</span>
              </label>
              <div className="mrh-target-pills">
                {assignedEditors.map((ed) => {
                  const edDeliv = deliverySummary.deliveryMap[String(ed.id)];
                  const isDone = edDeliv && edDeliv.status === 'delivered';
                  const isSelected = selectedEditorId === String(ed.id);
                  return (
                    <button
                      key={ed.id}
                      type="button"
                      className={`mrh-target-pill ${isSelected ? 'active' : ''}`}
                      onClick={() => handleSelectEditor(String(ed.id))}
                    >
                      <User size={13} />
                      <span>{ed.name}</span>
                      {isDone ? (
                        <span className="mrh-pill-tag done">✅ Já Entregue</span>
                      ) : (
                        <span className="mrh-pill-tag pending">⏳ Pendente</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Status do outro editor */}
              <div style={{ marginTop: '4px', fontSize: '0.76rem', color: '#94a3b8' }}>
                {willCompleteEntireMission ? (
                  <span style={{ color: '#34d399', fontWeight: 600 }}>
                    ✨ Ao concluir esta parte, todos os {assignedEditors.length} editores terão entregue e a missão será enviada para aprovação do Administrador.
                  </span>
                ) : (
                  <span>
                    ℹ️ Esta pauta é dividida entre editores. Sua entrega será salva individualmente e a pauta permanecerá em edição até que{' '}
                    <strong style={{ color: '#fbbf24' }}>
                      {otherPending.map((e) => e.name).join(', ')}
                    </strong>{' '}
                    também conclua{otherPending.length > 1 ? 'm' : ''}.
                  </span>
                )}
              </div>
            </div>
          )}

          {/* LOCAL DO ARQUIVO NO SERVIDOR */}
          <div className="mrh-form-field">
            <div className="mrh-field-header">
              <label htmlFor="conclude-server-path-input" className="mrh-field-label">
                <HardDrive size={14} className="text-amber" />
                <span>Local do Arquivo / Pasta no Servidor:</span>
              </label>
            </div>
            <div className="mrh-textarea-wrapper">
              <input
                id="conclude-server-path-input"
                type="text"
                className="mrh-input"
                style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}
                placeholder="Ex: S:\MEGA FILMES\ANIVERSARIO\PASTA DO EDITOR"
                value={serverFilePath}
                onChange={(e) => setServerFilePath(e.target.value)}
                autoFocus
              />
            </div>
            <small className="mrh-hint">
              Informe o caminho no servidor local ou rede onde o material editado por você foi salvo.
            </small>
          </div>

          {/* MENSAGEM / OBSERVAÇÕES PARA A GESTÃO */}
          <div className="mrh-form-field">
            <div className="mrh-field-header">
              <label htmlFor="conclude-editor-msg-input" className="mrh-field-label">
                <MessageSquare size={14} className="text-cyan-bright" />
                <span>Mensagem / Observações para a Gestão:</span>
              </label>
              <span className="mrh-char-count">{editorMessage.length} caracteres</span>
            </div>
            <div className="mrh-textarea-wrapper">
              <textarea
                id="conclude-editor-msg-input"
                rows="2"
                className="mrh-textarea"
                placeholder="Ex: Minha pasta está pronta com cor e cortes finalizados..."
                value={editorMessage}
                onChange={(e) => setEditorMessage(e.target.value)}
              />
            </div>
            <small className="mrh-hint">
              Esta observação ficará visível para o Administrador na Central de Gestão e no histórico da pauta.
            </small>
          </div>

          {/* RODAPÉ */}
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
              style={{
                background: isMissionFinalized
                  ? 'rgba(100, 116, 139, 0.4)'
                  : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                borderColor: isMissionFinalized ? 'rgba(100, 116, 139, 0.3)' : 'rgba(16, 185, 129, 0.6)',
                boxShadow: isMissionFinalized ? 'none' : '0 4px 16px rgba(16, 185, 129, 0.35)',
                cursor: isMissionFinalized ? 'not-allowed' : 'pointer',
              }}
              disabled={isSubmitting || isMissionFinalized}
            >
              <Send size={14} />
              <span>
                {isMissionFinalized
                  ? 'Missão Já Finalizada'
                  : isSubmitting
                  ? 'Salvando Entrega...'
                  : hasMultipleEditors
                  ? `Entregar Parte de ${editorName.split(' ')[0]}`
                  : 'Concluir e Enviar Pós-Produção'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
