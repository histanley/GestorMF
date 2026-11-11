import React, { useState, useMemo } from 'react';
import {
  Bell,
  CheckCheck,
  Trash2,
  X,
  MapPin,
  Fuel,
  AlertTriangle,
  Info,
  CheckCircle2,
  ExternalLink,
  Clock,
  Sparkles,
  Lock,
  Send,
  Mail,
  Users,
  User,
  Flame,
} from 'lucide-react';

export default function NotificationsCenter({
  notifications = [],
  onClose,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
  onDeleteNotification,
  isNotificationLocked,
  onSelectNotification,
  canSendMessage = false,
  onOpenSendMessage,
}) {
  const [filter, setFilter] = useState('all'); // 'all' | 'unread' | 'messages' | 'mission' | 'fuel'

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const messagesCount = useMemo(
    () => notifications.filter((n) => n.type === 'system_message' || n.type === 'message').length,
    [notifications]
  );

  const missionsCount = useMemo(
    () => notifications.filter((n) => n.type === 'mission').length,
    [notifications]
  );

  const fuelCount = useMemo(
    () => notifications.filter((n) => n.type === 'fuel').length,
    [notifications]
  );

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (filter === 'unread') return !n.read;
      if (filter === 'messages') return n.type === 'system_message' || n.type === 'message';
      if (filter === 'mission') return n.type === 'mission';
      if (filter === 'fuel') return n.type === 'fuel';
      return true;
    });
  }, [notifications, filter]);

  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return 'Recente';
    const now = Date.now();
    const diffMs = now - (typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime());
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMin < 1) return 'Agora há pouco';
    if (diffMin < 60) return `Há ${diffMin} min`;
    if (diffHours < 24) return `Há ${diffHours} h`;
    if (diffDays === 1) return 'Ontem';
    return `Há ${diffDays} dias`;
  };

  const getIconForType = (type, variant) => {
    switch (type) {
      case 'system_message':
      case 'message':
        return <Mail size={18} className="notif-type-icon message" />;
      case 'fuel':
        return <Fuel size={18} className="notif-type-icon fuel" />;
      case 'mission':
        return <MapPin size={18} className="notif-type-icon mission" />;
      case 'warning':
        return <AlertTriangle size={18} className="notif-type-icon warning" />;
      case 'success':
        return <CheckCircle2 size={18} className="notif-type-icon success" />;
      default:
        return <Info size={18} className="notif-type-icon info" />;
    }
  };

  return (
    <div className="notifications-dropdown-panel" onClick={(e) => e.stopPropagation()}>
      {/* Cabeçalho da Central: Design Centralizado & Elegante */}
      <div className="notif-header-centered">
        {/* Botão de Fechar discreto no canto superior direito */}
        <button
          type="button"
          className="notif-btn-close-corner"
          onClick={onClose}
          title="Fechar"
          aria-label="Fechar Central de Notificações"
        >
          <X size={15} />
        </button>

        {/* Topo Centralizado: Ícone + Título + Subtítulo */}
        <div className="notif-center-title-group">
          <div className="notif-bell-icon-badge">
            <Bell size={18} />
            {unreadCount > 0 && <span className="notif-unread-dot" />}
          </div>
          <h3 className="notif-center-title">Central de Notificações & Avisos</h3>
          <span className={`notif-center-status-pill ${unreadCount > 0 ? 'has-unread' : 'all-read'}`}>
            {unreadCount > 0 ? `${unreadCount} ${unreadCount === 1 ? 'não lida' : 'não lidas'}` : '✨ Tudo em dia'}
          </span>
        </div>

        {/* Barra de Ações Harmônica e Centralizada */}
        <div className="notif-actions-toolbar">
          {canSendMessage && onOpenSendMessage && (
            <button
              type="button"
              className="notif-toolbar-btn primary"
              onClick={onOpenSendMessage}
              title="Criar e enviar comunicado para a equipe ou colaborador"
            >
              <Send size={13} />
              <span>Nova Mensagem</span>
            </button>
          )}

          {unreadCount > 0 && (
            <button
              type="button"
              className="notif-toolbar-btn secondary"
              onClick={onMarkAllAsRead}
              title="Marcar todas as notificações como lidas"
            >
              <CheckCheck size={14} />
              <span>Marcar lidas</span>
            </button>
          )}

          {notifications.length > 0 && (
            <button
              type="button"
              className="notif-toolbar-btn danger"
              onClick={onClearAll}
              title="Limpar todas as notificações da central"
            >
              <Trash2 size={13} />
              <span>Limpar</span>
            </button>
          )}
        </div>
      </div>

      {/* Filtros rápidos */}
      <div className="notif-filters">
        <button
          type="button"
          className={`notif-filter-chip ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          Todas ({notifications.length})
        </button>
        <button
          type="button"
          className={`notif-filter-chip ${filter === 'unread' ? 'active' : ''}`}
          onClick={() => setFilter('unread')}
        >
          Não lidas ({unreadCount})
        </button>
        <button
          type="button"
          className={`notif-filter-chip ${filter === 'messages' ? 'active' : ''}`}
          onClick={() => setFilter('messages')}
          style={{ borderColor: filter === 'messages' ? '#38bdf8' : 'rgba(59, 130, 246, 0.3)', color: '#38bdf8' }}
        >
          ✉️ Mensagens ({messagesCount})
        </button>
        <button
          type="button"
          className={`notif-filter-chip ${filter === 'mission' ? 'active' : ''}`}
          onClick={() => setFilter('mission')}
        >
          Missões ({missionsCount})
        </button>
        <button
          type="button"
          className={`notif-filter-chip ${filter === 'fuel' ? 'active' : ''}`}
          onClick={() => setFilter('fuel')}
        >
          Combustível ({fuelCount})
        </button>
      </div>

      {/* Lista de Notificações */}
      <div className="notif-list-container">
        {filteredNotifications.length === 0 ? (
          <div className="notif-empty-state">
            <div className="notif-empty-icon-wrap">
              <Sparkles size={28} />
            </div>
            <strong>Nenhuma notificação por aqui</strong>
            <p>Você está por dentro de todas as missões, viaturas e escalas da equipe.</p>
            {canSendMessage && onOpenSendMessage && (
              <button
                type="button"
                className="btn-primary"
                style={{ marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}
                onClick={onOpenSendMessage}
              >
                <Send size={14} />
                <span>Enviar Comunicado para a Equipe</span>
              </button>
            )}
          </div>
        ) : (
          filteredNotifications.map((notif) => {
            const isUnread = !notif.read;
            const lockInfo = isNotificationLocked ? isNotificationLocked(notif) : { locked: false, reason: '' };
            const isLocked = lockInfo.locked;
            const isSystemMessage = notif.type === 'system_message' || notif.type === 'message';

            return (
              <div
                key={notif.id}
                className={`notif-card ${isUnread ? 'is-unread' : 'is-read'} type-${notif.type || 'info'} ${isLocked ? 'is-locked-card' : ''} ${isSystemMessage ? 'is-message-card' : ''}`}
                onClick={() => {
                  if (onMarkAsRead) onMarkAsRead(notif.id);
                  if (onSelectNotification) onSelectNotification(notif);
                }}
              >
                <div className="notif-card-main">
                  <div className={`notif-icon-circle type-${notif.type || 'info'} ${isSystemMessage ? 'icon-message-circle' : ''}`}>
                    {getIconForType(notif.type, notif.variant)}
                  </div>

                  <div className="notif-card-info">
                    <div className="notif-card-header-row">
                      <div className="notif-title-wrap">
                        <h4 className="notif-title">{notif.title}</h4>

                        {/* Badges de Mensagem */}
                        {isSystemMessage && (
                          <div className="notif-msg-badges-row" style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', marginTop: '2px' }}>
                            {notif.senderName && (
                              <span className="notif-sender-pill" style={{ fontSize: '0.7rem', padding: '1px 7px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', fontWeight: 600 }}>
                                De: {notif.senderName} ({notif.senderRole || 'Gestão'})
                              </span>
                            )}
                            {notif.recipientType === 'ALL' ? (
                              <span className="notif-recipient-pill" style={{ fontSize: '0.7rem', padding: '1px 7px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', fontWeight: 600 }}>
                                📢 Para Todos
                              </span>
                            ) : (
                              <span className="notif-recipient-pill" style={{ fontSize: '0.7rem', padding: '1px 7px', borderRadius: '10px', background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', fontWeight: 600 }}>
                                👤 Individual {notif.recipientName ? `(${notif.recipientName})` : ''}
                              </span>
                            )}
                            {notif.priority === 'URGENT' && (
                              <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', fontWeight: 700 }}>
                                🚨 Urgente
                              </span>
                            )}
                            {notif.priority === 'HIGH' && (
                              <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', fontWeight: 700 }}>
                                ⚠️ Alta Prioridade
                              </span>
                            )}
                          </div>
                        )}

                        {isLocked && (
                          <span className="notif-lock-badge" title={lockInfo.reason}>
                            <Lock size={10} />
                            <span>Pendente</span>
                          </span>
                        )}
                        {notif.isResolved && !isLocked && (
                          <span className="notif-resolved-badge" title="Problema solucionado. Liberada para exclusão.">
                            ✅ Resolvida
                          </span>
                        )}
                      </div>
                      <div className="notif-header-right-meta">
                        <span className="notif-time">
                          <Clock size={11} />
                          {formatRelativeTime(notif.timestamp)}
                        </span>
                        {onDeleteNotification && (
                          <button
                            type="button"
                            className={`notif-card-del-btn ${isLocked ? 'is-locked' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteNotification(notif.id);
                            }}
                            title={
                              isLocked
                                ? `🔒 Bloqueada: ${lockInfo.reason}`
                                : 'Excluir esta notificação'
                            }
                          >
                            {isLocked ? <Lock size={12} /> : <Trash2 size={12} />}
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="notif-message" style={{ whiteSpace: isSystemMessage ? 'pre-wrap' : 'normal' }}>
                      {notif.message}
                    </p>

                    {notif.details && (
                      <div className={`notif-details-pill ${notif.isResolved ? 'is-resolved' : ''}`}>
                        {notif.details}
                      </div>
                    )}

                    {notif.missionId && (
                      <div className="notif-action-tag">
                        <span>Ver no Mapa & Tabela</span>
                        <ExternalLink size={11} />
                      </div>
                    )}
                  </div>
                </div>

                {isUnread && <span className="notif-unread-indicator" title="Não lida" />}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
