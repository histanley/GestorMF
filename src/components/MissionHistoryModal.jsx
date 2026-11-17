import React, { useState } from 'react';
import {
  History,
  X,
  Calendar,
  Clock,
  Car,
  Users,
  Film,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  MapPin,
  Flame,
  Award,
  ArrowRight,
  ShieldCheck,
  FileText,
  MessageSquare,
  Send,
  UserPlus,
  Folder,
} from 'lucide-react';
import { formatDateBR, getMissionTotalKm, getMissionCode, hasMissionPostProduction } from '../utils/geo';
import { getCurrentUser } from '../utils/auth';
import { alertDialog } from '../utils/dialog';

export default function MissionHistoryModal({
  isOpen,
  onClose,
  mission,
  missions = [],
  vehicles = [],
  members = [],
  currentUser = null,
  onSaveMission = null,
}) {
  if (!isOpen || !mission) return null;

  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);

  const missionCode = getMissionCode(mission, missions);
  const totalKm = getMissionTotalKm(mission);
  const activeUser = currentUser || getCurrentUser();
  const isAdminOrManager = activeUser?.role === 'ADMIN' || activeUser?.role === 'MANAGER' || activeUser?.role === 'admin' || activeUser?.role === 'manager';
  const hasPostProd = hasMissionPostProduction(mission);

  // Descobre o nome do criador da missão (ou fallback inteligente)
  const historyCreatedItem = Array.isArray(mission.editionHistory)
    ? mission.editionHistory.find((h) => h.type === 'CREATED')
    : null;
  const historyCreatedUser = historyCreatedItem?.user && historyCreatedItem.user !== 'Administrador / Gestor'
    ? historyCreatedItem.user
    : null;

  const displayCreatorName = mission.createdByName
    || mission.creatorName
    || historyCreatedUser
    || (mission.createdBy ? (members.find(m => String(m.id) === String(mission.createdBy))?.name) : null)
    || (activeUser?.name || 'Administrador');

  // Formata data ISO para DD/MM/AAAA às HH:MM
  const formatDateTime = (isoStr) => {
    if (!isoStr) return '--/--/---- --:--';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  // Monta histórico unificado caso a lista editionHistory esteja vazia
  const rawHistoryList = Array.isArray(mission.editionHistory) && mission.editionHistory.length > 0
    ? mission.editionHistory
    : [
        {
          id: 'h-created',
          type: 'CREATED',
          user: displayCreatorName,
          timestamp: mission.createdAt || mission.date || new Date().toISOString(),
          title: 'Missão Criada e Publicada na Escala',
          description: `Pauta "${mission.description}" agendada para ${formatDateBR(mission.date)} com saída prevista às ${mission.departureTime || '--:--'}.`,
        },
        ...(mission.editorName || mission.editorNamesDisplay
          ? [
              {
                id: 'h-assigned',
                type: 'ASSIGNED',
                user: 'Gestão de Produção',
                timestamp: mission.createdAt || mission.date,
                title: 'Editor Designado para Pós-Produção',
                description: `Responsável: ${mission.editorNamesDisplay || mission.editorName}. Prazo estipulado: ${formatDateBR(mission.deliveryDeadlineDate || mission.date)} às ${mission.deliveryDeadlineTime || '18:00'}.`,
              },
            ]
          : []),
        ...(mission.editionCompletedAt
          ? [
              {
                id: 'h-completed',
                type: 'COMPLETED',
                user: mission.editionCompletedBy || mission.editorNamesDisplay || 'Editor',
                timestamp: mission.editionCompletedAt,
                title: `Edição Concluída (${mission.editionDeliveryStatus || 'Dentro do Prazo'})`,
                description: `Material finalizado e entregue pela pós-produção. Status: ${mission.editionDeliveryStatus || 'Dentro do Prazo'}.`,
                isOverdue: mission.editionDeliveryStatus === 'Fora do Prazo',
              },
            ]
          : []),
        ...(mission.reopenReason
          ? [
              {
                id: 'h-reopened',
                type: 'REOPENED',
                user: 'Administrador',
                timestamp: mission.updatedAt || new Date().toISOString(),
                title: 'Serviço Reaberto para Ajustes (Missão em Atraso)',
                description: `Motivo da recusa / ajustes solicitados: "${mission.reopenReason}".`,
                isOverdue: true,
              },
            ]
          : []),
        ...(Array.isArray(mission.guests) && mission.guests.length > 0
          ? [
              {
                id: 'h-guests-init',
                type: 'GUEST_ADDED',
                user: 'Gestão de Produção',
                timestamp: mission.createdAt || mission.date,
                title: 'Convidado(s) / Freelancer(s) na Escala',
                description: `Participante(s) externo(s) adicionado(s): ${mission.guests.map((g) => typeof g === 'string' ? g : g.name).join(', ')}.`,
              },
            ]
          : []),
      ];

  // Normaliza o autor do evento CREATED para exibir o nome real do criador da missão
  const historyList = rawHistoryList.map((item) => {
    if (item.type === 'CREATED') {
      const isGeneric = !item.user || item.user === 'Administrador / Gestor' || item.user === 'Administrador' || item.user === 'Sistema';
      if (isGeneric && displayCreatorName) {
        return { ...item, user: displayCreatorName };
      }
    }
    return item;
  });

  const getActionBadge = (item) => {
    switch (item.type) {
      case 'CREATED':
        return { label: 'Criação', color: 'badge-blue', icon: Sparkles };
      case 'ASSIGNED':
        return { label: 'Designação', color: 'badge-purple', icon: Film };
      case 'COMPLETED':
        return item.isOverdue || item.status === 'Fora do Prazo'
          ? { label: 'Concluído Fora do Prazo', color: 'badge-warning', icon: AlertTriangle }
          : { label: 'Concluído no Prazo', color: 'badge-success', icon: CheckCircle2 };
      case 'REOPENED':
        return { label: 'Reaberto / Recusado', color: 'badge-danger', icon: RotateCcw };
      case 'APPROVED':
        return { label: 'Aprovado Final', color: 'badge-success', icon: Award };
      case 'MESSAGE':
        return { label: 'Mensagem', color: 'badge-purple', icon: MessageSquare };
      case 'GUEST_ADDED':
      case 'GUEST_UPDATED':
        return { label: 'Convidado / Freelancer', color: 'badge-purple', icon: UserPlus };
      default:
        return { label: 'Atualização', color: 'badge-neutral', icon: History };
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const text = messageText.trim();
    if (!text || isSending) return;

    setIsSending(true);
    try {
      const userRoleLabel = isAdminOrManager
        ? 'Gestão'
        : (hasPostProd ? 'Editor' : 'Equipe de Campo');

      const eventTitle = !hasPostProd
        ? (isAdminOrManager
            ? `Orientação para a Equipe de Campo (${activeUser?.name || 'Gestão'})`
            : `Mensagem da Equipe de Campo (${activeUser?.name || 'Colaborador'})`)
        : `Mensagem de ${activeUser?.name || userRoleLabel} (${userRoleLabel})`;

      const newEvent = {
        id: 'msg-' + Date.now(),
        type: 'MESSAGE',
        user: activeUser?.name || (isAdminOrManager ? 'Administrador' : (hasPostProd ? 'Editor' : 'Equipe de Campo')),
        timestamp: new Date().toISOString(),
        title: eventTitle,
        description: text,
      };

      const existingHistory = Array.isArray(mission.editionHistory) && mission.editionHistory.length > 0
        ? mission.editionHistory
        : historyList;

      const updatedHistory = [...existingHistory, newEvent];
      const mVer = (mission.version !== undefined && mission.version !== null) ? Number(mission.version) : 1;
      const updatedMission = {
        ...mission,
        editionHistory: updatedHistory,
        version: mVer,
      };

      if (onSaveMission) {
        const res = await onSaveMission(updatedMission);
        if (res && res.success === false) {
          await alertDialog({
            title: 'Erro ao Enviar Mensagem',
            message: res.error || 'Não foi possível registrar a mensagem.',
            variant: 'danger',
          });
          setIsSending(false);
          return;
        }
      }
      setMessageText('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="modal-overlay mission-history-overlay" onClick={onClose}>
      <div
        className="modal-box modal-box-large mission-history-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho do Modal */}
        <div className="mhm-header">
          <div className="mhm-header-title-box">
            <div className="mhm-icon-bubble">
              <History size={22} />
            </div>
            <div>
              <div className="mhm-code-row">
                <span className="mission-code-pill">#{missionCode}</span>
                <span className={`mhm-status-tag status-${(mission.missionStatus || 'agendada').toLowerCase()}`}>
                  {mission.missionStatus || 'Agendada'}
                </span>
                <span className="mhm-creator-pill" title={`Missão criada por ${displayCreatorName}`}>
                  👤 Criada por: <strong>{displayCreatorName}</strong>
                </span>
                {mission.isOverdue ? (
                  <span className="mhm-overdue-tag">⚠️ Missão em Atraso</span>
                ) : null}
              </div>
              <h2 className="mhm-title">{mission.description}</h2>
            </div>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            title="Fechar Histórico"
          >
            <X size={20} />
          </button>
        </div>

        {/* Resumo Operacional em Cards */}
        <div className="mhm-summary-grid">
          {/* Card 1: Cronograma e Duração */}
          <div className="mhm-summary-card">
            <div className="msc-title">
              <Clock size={15} />
              <span>Cronograma &amp; Duração</span>
            </div>
            <div className="msc-content">
              <div className="msc-stat-row">
                <span>Criada por:</span>
                <strong className="text-cyan">{displayCreatorName}</strong>
              </div>
              <div className="msc-stat-row">
                <span>Data da Execução:</span>
                <strong>{formatDateBR(mission.date)}</strong>
              </div>
              <div className="msc-stat-row">
                <span>Saída da Base:</span>
                <strong>{mission.departureTime || '--:--'}</strong>
              </div>
              <div className="msc-stat-row">
                <span>Retorno Estimado:</span>
                <strong>{mission.returnTimeEstimated || '--:--'}</strong>
              </div>
              <div className="msc-stat-row">
                <span>Tempo de Direção:</span>
                <strong>~{mission.roundTripDurationMinutes || (mission.drivingDurationMinutes ? mission.drivingDurationMinutes * 2 : 0)} min (Ida e Volta)</strong>
              </div>
            </div>
          </div>

          {/* Card 2: Equipe de Campo & Viatura */}
          <div className="mhm-summary-card">
            <div className="msc-title">
              <Users size={15} />
              <span>Equipe &amp; Deslocamento</span>
            </div>
            <div className="msc-content">
              <div className="msc-stat-row">
                <span>Viatura(s):</span>
                <strong>{mission.vehicleNameDisplay || 'Não alocada'}</strong>
              </div>
              <div className="msc-stat-row">
                <span>Condutor / Motorista:</span>
                <strong>{mission.driverName || 'Não designado'}</strong>
              </div>
              <div className="msc-stat-row">
                <span>Equipe de Campo:</span>
                <strong>{mission.teamNamesDisplay || 'Não definida'}</strong>
              </div>
              {Array.isArray(mission.guests) && mission.guests.length > 0 && (
                <div className="msc-stat-row">
                  <span>Convidados / Freelancers:</span>
                  <strong className="text-purple">
                    {mission.guests.map((g) => typeof g === 'string' ? g : g.name).join(', ')}
                  </strong>
                </div>
              )}
              <div className="msc-stat-row">
                <span>Percurso Total:</span>
                <strong>{totalKm} km • {mission.estimatedFuelLiters || 0} L</strong>
              </div>
            </div>
          </div>

          {/* Card 3: Pós-Produção & Prazos OU Execução Direta de Campo */}
          {hasPostProd ? (
            <div className="mhm-summary-card highlight-post-prod">
              <div className="msc-title">
                <Film size={15} />
                <span>Pós-Produção &amp; Entrega</span>
              </div>
              <div className="msc-content">
                <div className="msc-stat-row">
                  <span>Editor Designado:</span>
                  <strong className="text-cyan">
                    {mission.editorNamesDisplay || mission.editorName || 'Pendente de Atribuição'}
                  </strong>
                </div>
                <div className="msc-stat-row">
                  <span>Prazo Estipulado:</span>
                  <strong>
                    {mission.deliveryDeadlineDate ? formatDateBR(mission.deliveryDeadlineDate) : formatDateBR(mission.date)} às {mission.deliveryDeadlineTime || '18:00'}
                  </strong>
                </div>
                <div className="msc-stat-row">
                  <span>Status da Edição:</span>
                  <strong className={`edition-status-val status-${(mission.editionStatus || 'pendente').toLowerCase().replace(/\s+/g, '-')}`}>
                    {mission.editionStatus || 'Pendente'}
                  </strong>
                </div>
                <div className="msc-stat-row">
                  <span>Entrega:</span>
                  {mission.editionDeliveryStatus ? (
                    <strong className={mission.editionDeliveryStatus === 'Dentro do Prazo' ? 'text-green-bright' : 'text-danger-bright'}>
                      {mission.editionDeliveryStatus === 'Dentro do Prazo' ? '✅ No Prazo' : '⚠️ Fora do Prazo'}
                    </strong>
                  ) : (
                    <span className="text-muted">Aguardando Conclusão</span>
                  )}
                </div>
                {mission.serverFilePath && (
                  <div className="msc-stat-row" style={{ alignItems: 'flex-start', marginTop: '4px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                      <Folder size={12} className="text-amber" />
                      <span>Servidor:</span>
                    </span>
                    <strong
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '0.74rem',
                        color: '#38bdf8',
                        wordBreak: 'break-all',
                        cursor: 'pointer',
                        background: 'rgba(56, 189, 248, 0.08)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                      }}
                      title="Clique para copiar o caminho do servidor"
                      onClick={() => {
                        navigator.clipboard.writeText(mission.serverFilePath);
                        alertDialog({
                          title: 'Caminho Copiado',
                          message: 'Local do servidor copiado para a área de transferência!',
                          variant: 'info',
                        });
                      }}
                    >
                      {mission.serverFilePath} 📋
                    </strong>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="mhm-summary-card" style={{ borderColor: 'rgba(56, 189, 248, 0.25)', background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.6) 0%, rgba(30, 41, 59, 0.4) 100%)' }}>
              <div className="msc-title" style={{ color: '#38bdf8' }}>
                <Users size={15} />
                <span>Execução de Campo (Sem Pós)</span>
              </div>
              <div className="msc-content">
                <div className="msc-stat-row">
                  <span>Pós-Produção:</span>
                  <strong style={{ color: '#94a3b8' }}>Não se aplica</strong>
                </div>
                <div className="msc-stat-row">
                  <span>Fluxo Operacional:</span>
                  <strong style={{ color: '#34d399' }}>Finalização direta em campo</strong>
                </div>
                <div className="msc-stat-row">
                  <span>Status da Pós:</span>
                  <strong className="edition-status-val status-nao-se-aplica" style={{ background: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', border: '1px solid rgba(148, 163, 184, 0.25)' }}>
                    Não se aplica
                  </strong>
                </div>
                <div className="msc-stat-row">
                  <span>Equipe Escalada:</span>
                  <strong className="text-cyan">{mission.teamNamesDisplay || 'Equipe de Campo'}</strong>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Alerta de Retrabalho / Reabertura se existir */}
        {mission.reopenReason && (
          <div className="mhm-reopen-banner">
            <AlertTriangle size={18} className="icon-warn" />
            <div>
              <strong>Ajustes Solicitados pela Administração (Missão Reaberta / Em Atraso):</strong>
              <p>"{mission.reopenReason}"</p>
            </div>
          </div>
        )}

        {/* Linha do Tempo Visual de Auditoria */}
        <div className="mhm-timeline-section">
          <div className="mhm-timeline-header">
            <ShieldCheck size={16} />
            <span>Trilha de Auditoria &amp; Linha do Tempo Completa</span>
          </div>

          <div className="mhm-timeline-stream">
            {historyList.map((item, idx) => {
              const badge = getActionBadge(item);
              const IconComp = badge.icon;
              return (
                <div key={item.id || idx} className={`mhm-timeline-item ${item.isOverdue ? 'item-overdue' : ''}`}>
                  <div className="mhm-timeline-marker">
                    <div className={`mhm-marker-dot ${badge.color}`}>
                      <IconComp size={12} />
                    </div>
                    {idx < historyList.length - 1 && <div className="mhm-marker-line" />}
                  </div>

                  <div className="mhm-timeline-content">
                    <div className="mhm-tc-top">
                      <div className="mhm-tc-title-row">
                        <strong className="mhm-tc-title">{item.title}</strong>
                        <span className={`mhm-badge ${badge.color}`}>{badge.label}</span>
                      </div>
                      <span className="mhm-tc-date">
                        {formatDateTime(item.timestamp)}
                      </span>
                    </div>

                    <p className="mhm-tc-desc">{item.description}</p>

                    {(item.serverFilePath || (item.type === 'COMPLETED' && mission.serverFilePath)) && (
                      <div style={{ marginTop: '6px', fontSize: '0.8rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Folder size={13} />
                        <span>Local no Servidor: <code style={{ color: '#bae6fd' }}>{item.serverFilePath || mission.serverFilePath}</code></span>
                      </div>
                    )}

                    <div className="mhm-tc-author">
                      <span>Registrado por: <strong>{
                        item.type === 'CREATED' && (!item.user || item.user === 'Administrador / Gestor' || item.user === 'Administrador')
                          ? displayCreatorName
                          : (item.user || displayCreatorName || 'Sistema')
                      }</strong></span>
                      {item.deadline && (
                        <span> • Prazo limite: <strong>{item.deadline}</strong></span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Seção de Troca de Mensagens Direta */}
        {onSaveMission && (
          <div className="mhm-message-section">
            <div className="mhm-message-header">
              <MessageSquare size={16} className="text-cyan" />
              <span>
                Comunicação Direta • {hasPostProd
                  ? (isAdminOrManager ? 'Mensagem para o(s) Editor(es)' : 'Mensagem para a Gestão')
                  : (isAdminOrManager ? 'Mensagem para a Equipe de Campo' : 'Mensagem para a Gestão')}
              </span>
            </div>
            <form onSubmit={handleSendMessage} className="mhm-message-form">
              <textarea
                rows="2"
                className="mhm-message-input"
                placeholder={
                  hasPostProd
                    ? (isAdminOrManager
                        ? 'Escreva uma orientação, instrução de corte, áudio ou solicitação para o editor...'
                        : 'Escreva uma mensagem, dúvida ou observação para a administração...')
                    : (isAdminOrManager
                        ? 'Escreva uma orientação, instrução de rota, equipamentos ou aviso para a equipe de campo...'
                        : 'Escreva uma mensagem ou observação sobre a execução de campo...')
                }
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                disabled={isSending}
              />
              <div className="mhm-message-actions">
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '0.85rem' }}
                  disabled={!messageText.trim() || isSending}
                >
                  <Send size={13} />
                  <span>{isSending ? 'Enviando...' : 'Enviar Mensagem'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Rodapé com Fechamento */}
        <div className="mhm-footer">
          <button type="button" className="btn-primary" onClick={onClose}>
            Fechar Histórico
          </button>
        </div>
      </div>
    </div>
  );
}

