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
}) {
  const [filter, setFilter] = useState('all'); // 'all' | 'unread' | 'mission' | 'fuel'

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (filter === 'unread') return !n.read;
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
      {/* Cabeçalho da Central */}
      <div className="notif-header">
        <div className="notif-header-title">
          <div className="notif-bell-icon-badge">
            <Bell size={17} />
            {unreadCount > 0 && <span className="notif-unread-dot" />}
          </div>
          <div>
            <strong>Central de Notificações</strong>
            <span className="notif-subtitle">
              {unreadCount > 0 ? `${unreadCount} não lida${unreadCount > 1 ? 's' : ''}` : 'Tudo atualizado'}
            </span>
          </div>
        </div>

        <div className="notif-header-actions">
          {unreadCount > 0 && (
            <button
              type="button"
              className="notif-btn-action"
              onClick={onMarkAllAsRead}
              title="Marcar todas como lidas"
            >
              <CheckCheck size={15} />
              <span>Marcar lidas</span>
            </button>
          )}

          {notifications.length > 0 && (
            <button
              type="button"
              className="notif-btn-action notif-btn-danger"
              onClick={onClearAll}
              title="Limpar todas as notificações"
            >
              <Trash2 size={15} />
            </button>
          )}

          <button
            type="button"
            className="notif-btn-close"
            onClick={onClose}
            title="Fechar"
            aria-label="Fechar Central de Notificações"
          >
            <X size={16} />
          </button>
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
          className={`notif-filter-chip ${filter === 'mission' ? 'active' : ''}`}
          onClick={() => setFilter('mission')}
        >
          Missões
        </button>
        <button
          type="button"
          className={`notif-filter-chip ${filter === 'fuel' ? 'active' : ''}`}
          onClick={() => setFilter('fuel')}
        >
          Combustível
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
          </div>
        ) : (
          filteredNotifications.map((notif) => {
            const isUnread = !notif.read;
            const lockInfo = isNotificationLocked ? isNotificationLocked(notif) : { locked: false, reason: '' };
            const isLocked = lockInfo.locked;

            return (
              <div
                key={notif.id}
                className={`notif-card ${isUnread ? 'is-unread' : 'is-read'} type-${notif.type || 'info'} ${isLocked ? 'is-locked-card' : ''}`}
                onClick={() => {
                  if (onMarkAsRead) onMarkAsRead(notif.id);
                  if (onSelectNotification) onSelectNotification(notif);
                }}
              >
                <div className="notif-card-main">
                  <div className={`notif-icon-circle type-${notif.type || 'info'}`}>
                    {getIconForType(notif.type, notif.variant)}
                  </div>

                  <div className="notif-card-info">
                    <div className="notif-card-header-row">
                      <div className="notif-title-wrap">
                        <h4 className="notif-title">{notif.title}</h4>
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

                    <p className="notif-message">{notif.message}</p>

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

