import { useState, useEffect } from 'react';
import { Bell, Check, Heart, MessageSquare, UserPlus, Trophy, X } from 'lucide-react';
import useNotificationStore from '../stores/notificationStore';
import useAuthStore from '../stores/authStore';
import { timeAgo } from '../utils/time';

export default function NotificationsBell() {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuthStore();
  const {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    subscribe,
    unsubscribe,
  } = useNotificationStore();

  useEffect(() => {
    if (user?.id) {
      fetchNotifications(user.id);
      subscribe(user.id);
    }
    return () => {
      unsubscribe();
    };
  }, [user?.id]);

  const handleNotificationClick = async (notif) => {
    if (!notif.read) {
      await markAsRead(notif.id);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'like':
        return <Heart className="w-4 h-4 text-red-500 fill-red-500" />;
      case 'comment':
        return <MessageSquare className="w-4 h-4 text-[#FFC815] fill-[#FFC815]" />;
      case 'follow':
        return <UserPlus className="w-4 h-4 text-blue-400" />;
      case 'achievement':
        return <Trophy className="w-4 h-4 text-[#FFC815]" />;
      default:
        return <Bell className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="relative p-2 rounded-xl bg-[#1C1C1E] border border-white/5 text-white active:scale-95 transition-transform"
        aria-label="Notificaciones"
      >
        <Bell className="w-5 h-5 text-gray-300" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-[#FFC815] text-black font-extrabold text-[10px] rounded-full flex items-center justify-center shadow-lg animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Modal / Bottom Sheet para móvil */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
          <div
            className="w-full max-w-md bg-[#1C1C1E] rounded-t-3xl sm:rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-[#FFC815]" />
                <h3 className="text-base font-bold text-white">Notificaciones</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#FFC815]/20 text-[#FFC815]">
                    {unreadCount} nuevas
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => markAllAsRead(user?.id)}
                    className="p-1.5 rounded-lg text-xs font-semibold text-[#FFC815] hover:bg-white/5 active:scale-95"
                    title="Marcar todas como leídas"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-white/5 p-2">
              {loading && notifications.length === 0 ? (
                <div className="p-8 text-center text-sm text-[#A0A0A5]">Cargando...</div>
              ) : notifications.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-[#292929] flex items-center justify-center mb-3">
                    <Bell className="w-6 h-6 text-gray-500" />
                  </div>
                  <p className="text-sm font-semibold text-gray-300">No tienes notificaciones</p>
                  <p className="text-xs text-[#A0A0A5] mt-1">
                    Aquí verás cuando alguien interactúe con tus PRs o logros.
                  </p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-3.5 rounded-xl flex items-start gap-3 transition-colors cursor-pointer ${
                      notif.read ? 'bg-transparent hover:bg-white/5' : 'bg-[#292929]/50 hover:bg-[#292929]'
                    }`}
                  >
                    <div className="mt-0.5 p-2 rounded-xl bg-[#0A0A0C] border border-white/5 shrink-0">
                      {getIcon(notif.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-200 leading-snug">
                        <span className="font-bold text-white">
                          {notif.actor?.display_name ? `@${notif.actor.display_name}` : 'Un atleta'}
                        </span>{' '}
                        {notif.title || notif.message}
                      </p>
                      {notif.body && (
                        <p className="text-xs text-[#A0A0A5] mt-1 line-clamp-2 italic">
                          "{notif.body}"
                        </p>
                      )}
                      <span className="text-[10px] text-gray-500 mt-1 block">
                        {timeAgo(notif.created_at)}
                      </span>
                    </div>
                    {!notif.read && (
                      <span className="w-2 h-2 rounded-full bg-[#FFC815] shrink-0 mt-2" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
