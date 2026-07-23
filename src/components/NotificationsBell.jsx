import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import useNotificationStore from '../stores/notificationStore';
import { timeAgo } from '../utils/time';
import './NotificationsBell.css';

const TYPE_ICONS = {
  like: '❤️',
  comment: '💬',
  follow: '👋',
};

function NotificationsBell() {
  const { user } = useAuthStore();
  const userId = user?.id;
  const navigate = useNavigate();

  const {
    items,
    unreadCount,
    panelOpen,
    loading,
    saving,
    fetchNotifications,
    markAllRead,
    markRead,
    togglePanel,
    closePanel,
  } = useNotificationStore();

  const panelRef = useRef(null);

  // Carga inicial al tener user
  useEffect(() => {
    if (userId) {
      fetchNotifications(userId).catch(() => {});
    }
  }, [userId, fetchNotifications]);

  // Cerrar al hacer click fuera
  useEffect(() => {
    if (!panelOpen) return;
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        // ignorar click sobre el boton de la campana (que esta fuera del panel)
        if (e.target.closest('.notifications-bell-btn')) return;
        closePanel();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [panelOpen, closePanel]);

  const handleToggle = () => {
    togglePanel();
    if (!panelOpen && unreadCount > 0) {
      // marca todas como leidas al abrir (UX esperada)
      markAllRead(userId).catch(() => {});
    }
  };

  const handleItemClick = (n) => {
    markRead(n.id, userId).catch(() => {});
    closePanel();
    if (n.type === 'follow') {
      navigate(`/athletes/${n.actor_id}`);
    } else {
      navigate('/community');
    }
  };

  return (
    <div className="notifications-bell" ref={panelRef}>
      <button
        type="button"
        className="notifications-bell-btn"
        onClick={handleToggle}
        aria-label="Notificaciones"
        aria-expanded={panelOpen}
      >
        <span aria-hidden="true">🔔</span>
        {unreadCount > 0 && (
          <span className="notifications-bell-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {panelOpen && (
        <div className="notifications-panel" role="dialog" aria-label="Notificaciones">
          <div className="notifications-panel-header">
            <h2>Notificaciones</h2>
            <button
              type="button"
              className="notifications-panel-close"
              onClick={closePanel}
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>

          <div className="notifications-panel-body">
            {loading && items.length === 0 ? (
              <p className="notifications-loading">Cargando...</p>
            ) : items.length === 0 ? (
              <p className="notifications-empty">Sin notificaciones por ahora</p>
            ) : (
              <ul className="notifications-list">
                {items.map((n) => {
                  const initials =
                    `${n.actor?.first_name?.[0] ?? ''}${n.actor?.last_name?.[0] ?? ''}`.toUpperCase() ||
                    '@';
                  return (
                    <li
                      key={n.id}
                      className={`notification-item ${n.read_at ? '' : 'notification-item-unread'}`}
                    >
                      <button
                        type="button"
                        className="notification-item-btn"
                        onClick={() => handleItemClick(n)}
                      >
                        <span className="notification-icon" aria-hidden="true">
                          {TYPE_ICONS[n.type] || '🔔'}
                        </span>
                        <span className="notification-avatar" aria-hidden="true">
                          {n.actor?.avatar_url ? (
                            <img src={n.actor.avatar_url} alt="" />
                          ) : (
                            initials
                          )}
                        </span>
                        <span className="notification-text">
                          <strong>@{n.actor?.display_name || 'atleta'}</strong>{' '}
                          {n.text}
                        </span>
                        <span className="notification-time">
                          {timeAgo(n.created_at)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {unreadCount === 0 && items.length > 0 && (
            <div className="notifications-panel-foot">
              <span className="notifications-foot-label">Estás al día ✨</span>
            </div>
          )}
          {saving && (
            <div className="notifications-panel-foot">
              <span className="notifications-foot-label">Actualizando...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default NotificationsBell;
