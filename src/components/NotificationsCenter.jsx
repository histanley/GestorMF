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
  Package,
  Search,
  Film,
  AlertCircle,
} from 'lucide-react';

/**
 * Categorização inteligente de notificações para garantir que NENHUM item fique oculto
 * ou fora do seu filtro correspondente.
 */
export function getNotificationCategory(n) {
  if (!n) return 'messages';
  const type = String(n.type || '').toLowerCase();
  const title = String(n.title || '').toLowerCase();
  const desc = String(n.description || n.message || '').toLowerCase();

  // 1. Frota, Viaturas e Combustível
  if (
    type === 'fuel' ||
    type === 'vehicle' ||
    type === 'telemetry' ||
    type === 'maintenance' ||
    Boolean(n.vehicleId) ||
    title.includes('tanque') ||
    title.includes('combustível') ||
    title.includes('reserva') ||
    title.includes('viatura') ||
    desc.includes('abastecer') ||
    desc.includes('tanque')
  ) {
    return 'fuel';
  }

  // 2. Aluguéis, Devoluções e Equipamentos
  if (
    type === 'rental' ||
    type === 'rental_alert' ||
    type === 'equipment' ||
    Boolean(n.rentalId) ||
    title.includes('locação') ||
    title.includes('aluguel') ||
    title.includes('devolução') ||
    desc.includes('locação') ||
    desc.includes('devolução')
  ) {
    return 'rental';
  }

  // 3. Missões, Pautas, Pós-Produção, Edição de Vídeo e Horários
  if (
    type === 'mission' ||
    type === 'post_production' ||
    type === 'post_production_approval' ||
    type === 'edition' ||
    type === 'mission_message' ||
    Boolean(n.missionId) ||
    title.includes('missão') ||
    title.includes('pauta') ||
    title.includes('edição') ||
    title.includes('pós-produção') ||
    title.includes('reaberta') ||
    desc.includes('pauta') ||
    desc.includes('editor')
  ) {
    return 'mission';
  }

  // 4. Comunicados da Gestão, Mensagens da Equipe e Chat
  if (
    type === 'system_message' ||
    type === 'message' ||
    type === 'chat' ||
    type === 'announcement' ||
    Boolean(n.senderName) ||
    Boolean(n.recipientType)
  ) {
    return 'messages';
  }

  // 5. Demais itens (avisos gerais do sistema, alertas informativos)
  return 'messages';
}

/**
 * Identifica se a notificação exige ação pendente (bloqueada para exclusão, urgente ou problema em aberto)
 */
export function isNotificationPending(n, isNotificationLocked) {
  if (!n) return false;
  if (isNotificationLocked) {
    try {
      const lock = isNotificationLocked(n);
      if (lock && lock.locked) return true;
    } catch (e) {}
  }
  if (n.isLocked) return true;
  if (n.priority === 'URGENT' || n.priority === 'HIGH') return true;
  if (n.variant === 'danger' || n.variant === 'warning') return true;
  if (n.isResolved === false) return true;

  const type = String(n.type || '').toLowerCase();
  const title = String(n.title || '').toLowerCase();
  if (
    type === 'warning' ||
    title.includes('pendente') ||
    title.includes('urgente') ||
    title.includes('reaberta') ||
    title.includes('reserva') ||
    title.includes('atraso') ||
    title.includes('avaliação')
  ) {
    return true;
  }
  return false;
}

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
  const [filter, setFilter] = useState('all'); // 'all' | 'unread' | 'pending' | 'mission' | 'messages' | 'fuel' | 'rental'
  const [searchTerm, setSearchTerm] = useState('');

  // Contadores calculados com base na classificação abrangente
  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const pendingCount = useMemo(
    () => notifications.filter((n) => isNotificationPending(n, isNotificationLocked)).length,
    [notifications, isNotificationLocked]
  );

  const missionsCount = useMemo(
    () => notifications.filter((n) => getNotificationCategory(n) === 'mission').length,
    [notifications]
  );

  const messagesCount = useMemo(
    () => notifications.filter((n) => getNotificationCategory(n) === 'messages').length,
    [notifications]
  );

  const fuelCount = useMemo(
    () => notifications.filter((n) => getNotificationCategory(n) === 'fuel').length,
    [notifications]
  );

  const rentalsCount = useMemo(
    () => notifications.filter((n) => getNotificationCategory(n) === 'rental').length,
    [notifications]
  );

  // Filtro inteligente e abrangente: nenhum item fica oculto
  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      // 1. Filtro da Categoria
      if (filter === 'unread') {
        if (n.read) return false;
      } else if (filter === 'pending') {
        if (!isNotificationPending(n, isNotificationLocked)) return false;
      } else if (filter === 'mission') {
        if (getNotificationCategory(n) !== 'mission') return false;
      } else if (filter === 'messages') {
        if (getNotificationCategory(n) !== 'messages') return false;
      } else if (filter === 'fuel') {
        if (getNotificationCategory(n) !== 'fuel') return false;
      } else if (filter === 'rental') {
        if (getNotificationCategory(n) !== 'rental') return false;
      }
      // 'all' passa todas as notificações

      // 2. Busca por texto livre (se houver pesquisa)
      if (searchTerm && searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const title = String(n.title || '').toLowerCase();
        const msg = String(n.message || n.description || '').toLowerCase();
        const details = String(n.details || '').toLowerCase();
        const sender = String(n.senderName || '').toLowerCase();
        const recipient = String(n.recipientName || '').toLowerCase();
        const matches =
          title.includes(term) ||
          msg.includes(term) ||
          details.includes(term) ||
          sender.includes(term) ||
          recipient.includes(term);
        if (!matches) return false;
      }

      return true;
    });
  }, [notifications, filter, searchTerm, isNotificationLocked]);

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
      case 'chat':
        return <Mail size={18} className="notif-type-icon message" />;
      case 'fuel':
      case 'vehicle':
      case 'telemetry':
        return <Fuel size={18} className="notif-type-icon fuel" />;
      case 'rental':
      case 'rental_alert':
      case 'equipment':
        return <Package size={18} className="notif-type-icon rental" />;
      case 'post_production':
      case 'post_production_approval':
      case 'edition':
        return <Film size={18} className="notif-type-icon mission" />;
      case 'mission':
      case 'mission_message':
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

      {/* Barra de Filtros Segmentada Moderna (Com rolagem suave e sem cortes) */}
      <div className="notif-segmented-bar-wrapper">
        <div className="notif-segmented-bar" role="tablist" aria-label="Filtrar Notificações">
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'all'}
            className={`notif-seg-tab ${filter === 'all' ? 'is-active' : ''}`}
            onClick={() => setFilter('all')}
          >
            <Sparkles size={12} className="tab-icon" />
            <span>Todas</span>
            <span className="notif-tab-badge">{notifications.length}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={filter === 'unread'}
            className={`notif-seg-tab ${filter === 'unread' ? 'is-active' : ''} ${unreadCount > 0 ? 'tab-has-unread' : ''}`}
            onClick={() => setFilter('unread')}
          >
            <Bell size={12} className="tab-icon" />
            <span>Não lidas</span>
            <span className="notif-tab-badge unread">{unreadCount}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={filter === 'pending'}
            className={`notif-seg-tab ${filter === 'pending' ? 'is-active' : ''} ${pendingCount > 0 ? 'tab-has-pending' : ''}`}
            onClick={() => setFilter('pending')}
            title="Itens com pendências ativas, veículos em reserva ou urgentes"
          >
            <AlertTriangle size={12} className="tab-icon" />
            <span>Pendências</span>
            <span className="notif-tab-badge pending">{pendingCount}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={filter === 'mission'}
            className={`notif-seg-tab ${filter === 'mission' ? 'is-active' : ''}`}
            onClick={() => setFilter('mission')}
            title="Missões de campo, pautas, pós-produção e edição"
          >
            <MapPin size={12} className="tab-icon" />
            <span>Missões</span>
            <span className="notif-tab-badge missions">{missionsCount}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={filter === 'messages'}
            className={`notif-seg-tab ${filter === 'messages' ? 'is-active' : ''}`}
            onClick={() => setFilter('messages')}
            title="Comunicados internos, avisos da gestão e mensagens"
          >
            <Mail size={12} className="tab-icon" />
            <span>Avisos</span>
            <span className="notif-tab-badge messages">{messagesCount}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={filter === 'fuel'}
            className={`notif-seg-tab ${filter === 'fuel' ? 'is-active' : ''}`}
            onClick={() => setFilter('fuel')}
            title="Alertas de combustível, viaturas e revisões da frota"
          >
            <Fuel size={12} className="tab-icon" />
            <span>Frota</span>
            <span className="notif-tab-badge fuel">{fuelCount}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={filter === 'rental'}
            className={`notif-seg-tab ${filter === 'rental' ? 'is-active' : ''}`}
            onClick={() => setFilter('rental')}
            title="Contratos, locações e devolução de equipamentos"
          >
            <Package size={12} className="tab-icon" />
            <span>Aluguéis</span>
            <span className="notif-tab-badge rental">{rentalsCount}</span>
          </button>
        </div>
      </div>

      {/* Barra de Busca Rápida em Tempo Real */}
      <div className="notif-search-bar-wrapper">
        <div className="notif-search-input-box">
          <Search size={14} className="notif-search-icon" />
          <input
            type="text"
            className="notif-search-input"
            placeholder="Pesquisar por pauta, viatura, colaborador, código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              type="button"
              className="notif-search-clear-btn"
              onClick={() => setSearchTerm('')}
              title="Limpar busca"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Lista de Notificações */}
      <div className="notif-list-container">
        {filteredNotifications.length === 0 ? (
          <div className="notif-empty-state">
            <div className="notif-empty-icon-wrap">
              {searchTerm ? <Search size={28} /> : <Sparkles size={28} />}
            </div>
            <strong>
              {searchTerm
                ? `Nenhum resultado para "${searchTerm}"`
                : filter === 'all'
                ? 'Nenhuma notificação por aqui'
                : 'Nenhuma notificação nesta categoria'}
            </strong>
            <p>
              {searchTerm
                ? 'Tente pesquisar por outro termo ou limpe a busca para ver todas.'
                : filter === 'all'
                ? 'Você está por dentro de todas as missões, viaturas e escalas da equipe.'
                : 'Não há notificações ativas com o filtro selecionado no momento.'}
            </p>
            {searchTerm ? (
              <button
                type="button"
                className="btn-secondary"
                style={{ marginTop: '10px', fontSize: '0.8rem', padding: '6px 14px' }}
                onClick={() => setSearchTerm('')}
              >
                Limpar Pesquisa
              </button>
            ) : filter !== 'all' ? (
              <button
                type="button"
                className="btn-secondary"
                style={{ marginTop: '10px', fontSize: '0.8rem', padding: '6px 14px' }}
                onClick={() => setFilter('all')}
              >
                Ver Todas as Notificações ({notifications.length})
              </button>
            ) : canSendMessage && onOpenSendMessage ? (
              <button
                type="button"
                className="btn-primary"
                style={{ marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}
                onClick={onOpenSendMessage}
              >
                <Send size={14} />
                <span>Enviar Comunicado para a Equipe</span>
              </button>
            ) : null}
          </div>
        ) : (
          filteredNotifications.map((notif) => {
            const isUnread = !notif.read;
            const lockInfo = isNotificationLocked ? isNotificationLocked(notif) : { locked: false, reason: '' };
            const isLocked = lockInfo.locked;
            const isSystemMessage = notif.type === 'system_message' || notif.type === 'message' || Boolean(notif.senderName);
            const category = getNotificationCategory(notif);

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

                        {/* Badges de Mensagem e Comunicados */}
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
                            ) : notif.recipientType ? (
                              <span className="notif-recipient-pill" style={{ fontSize: '0.7rem', padding: '1px 7px', borderRadius: '10px', background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', fontWeight: 600 }}>
                                👤 Individual {notif.recipientName ? `(${notif.recipientName})` : ''}
                              </span>
                            ) : null}
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
                      {notif.message || notif.description}
                    </p>

                    {notif.details && (
                      <div className={`notif-details-pill ${notif.isResolved ? 'is-resolved' : ''}`}>
                        {notif.details}
                      </div>
                    )}

                    {/* Tags de Ação Rápida com Redirecionamento */}
                    {notif.missionId && (
                      <div className="notif-action-tag">
                        <span>Ver no Mapa & Tabela</span>
                        <ExternalLink size={11} />
                      </div>
                    )}

                    {(notif.vehicleId || notif.type === 'fuel') && !notif.missionId && (
                      <div className="notif-action-tag" style={{ color: '#fbbf24', background: 'rgba(245, 158, 11, 0.12)', borderColor: 'rgba(245, 158, 11, 0.25)' }}>
                        <span>Ver Viaturas & Frota</span>
                        <ExternalLink size={11} />
                      </div>
                    )}

                    {(notif.rentalId || notif.type === 'rental') && !notif.missionId && (
                      <div className="notif-action-tag" style={{ color: '#c084fc', background: 'rgba(168, 85, 247, 0.12)', borderColor: 'rgba(168, 85, 247, 0.25)' }}>
                        <span>Ver Aluguéis & Devoluções</span>
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
