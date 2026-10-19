import { create } from 'zustand';
import { supabase } from '../supabase/client';
import { formatPrValue, formatBenchmarkResult } from '../utils/format';

// Devuelve el texto corto de la notificacion segun tipo + payload.
function notificationText(n) {
  const p = n.event_payload || {};
  switch (n.type) {
    case 'like':
      if (n.event_type === 'pr')
        return `le dio ❤️ a tu ${p.movement || 'PR'}: ${formatPrValue(p)}`;
      if (n.event_type === 'benchmark')
        return `le dio ❤️ a tu ${p.name || 'WOD'}: ${formatBenchmarkResult(p)}`;
      if (n.event_type === 'achievement') return `le dio ❤️ a tu logro`;
      if (n.event_type === 'skill') return `le dio ❤️ a tu ${p.movement || 'skill'}`;
      return 'le dio ❤️ a tu actividad';
    case 'comment': {
      const eventPart =
        n.event_type === 'pr' && p.movement
          ? `tu ${p.movement}`
          : n.event_type === 'benchmark' && p.name
            ? `tu ${p.name}`
            : 'tu actividad';
      const body = (n.comment_body || '').trim();
      const snippet = body.length > 80 ? body.slice(0, 80).trimEnd() + '…' : body;
      return `comentó en ${eventPart}: «${snippet}»`;
    }
    case 'follow':
      return 'te empezó a seguir';
    default:
      return '';
  }
}

const useNotificationStore = create((set, get) => ({
  items: [],
  unreadCount: 0,
  panelOpen: false,
  loading: false,
  saving: false,
  error: null,
  subscription: null,

  fetchNotifications: async (userId) => {
    if (!userId) {
      set({ items: [], unreadCount: 0 });
      return [];
    }
    set({ loading: true, error: null });

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      set({ loading: false, error: error.message });
      throw error;
    }

    // Hidrata los actores desde el directorio
    const withActors = await get()._withActors(data || []);
    set({ items: withActors, loading: false });
    get()._recomputeUnread();
    return withActors;
  },

  fetchUnreadCount: async (userId) => {
    if (!userId) return;
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', userId)
      .is('read_at', null);

    if (error) {
      set({ error: error.message });
      throw error;
    }
    set({ unreadCount: count ?? 0 });
  },

  markAllRead: async (userId) => {
    if (!userId) return;
    set({ saving: true, error: null });

    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_id', userId)
      .is('read_at', null);

    if (error) {
      set({ saving: false, error: error.message });
      throw error;
    }

    set((state) => ({
      items: state.items.map((n) =>
        n.read_at ? n : { ...n, read_at: new Date().toISOString() },
      ),
      unreadCount: 0,
      saving: false,
    }));
  },

  markRead: async (notificationId, userId) => {
    const n = get().items.find((x) => x.id === notificationId);
    if (!n || n.read_at) return;

    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('recipient_id', userId);

    if (error) {
      set({ error: error.message });
      throw error;
    }

    set((state) => ({
      items: state.items.map((x) =>
        x.id === notificationId
          ? { ...x, read_at: new Date().toISOString() }
          : x,
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }));
  },

  // Insercion en vivo (realtime). Prepend + recargar unread.
  prependFromRealtime: async (row) => {
    const [hydrated] = await get()._withActors([row]);
    if (!hydrated) return;
    set((state) => {
      // dedup por id (por si llega la misma fila via poll + realtime)
      if (state.items.some((n) => n.id === hydrated.id)) return state;
      return { items: [hydrated, ...state.items] };
    });
    get()._recomputeUnread();
  },

  // Cambio de read_at en una fila existente (si otro cliente la marca)
  applyReadUpdate: (notificationId, readAt) => {
    set((state) => ({
      items: state.items.map((n) =>
        n.id === notificationId ? { ...n, read_at: readAt } : n,
      ),
    }));
    get()._recomputeUnread();
  },

  _recomputeUnread: () => {
    set((state) => ({
      unreadCount: state.items.filter((n) => !n.read_at).length,
    }));
  },

  _withActors: async (rows) => {
    if (rows.length === 0) return [];
    const ids = [...new Set(rows.map((n) => n.actor_id))];
    const { data: people, error } = await supabase
      .from('athlete_directory')
      .select('*')
      .in('id', ids);
    if (error) throw error;
    const byId = new Map((people || []).map((p) => [p.id, p]));
    return rows.map((n) => ({
      ...n,
      actor: byId.get(n.actor_id) || null,
      text: notificationText(n),
    }));
  },

  togglePanel: () => set((state) => ({ panelOpen: !state.panelOpen })),
  closePanel: () => set({ panelOpen: false }),

  // Supabase Realtime: INSERT/UPDATE sobre mi recipient_id
  subscribeRealtime: (userId) => {
    if (!userId) return;
    get().unsubscribe();

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          get().prependFromRealtime(payload.new).catch(() => {});
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          get()
            .applyReadUpdate(payload.new.id, payload.new.read_at)
            .catch(() => {});
        },
      )
      .subscribe();

    set({ subscription: channel });
  },

  unsubscribe: () => {
    const { subscription } = get();
    if (subscription) {
      supabase.removeChannel(subscription);
      set({ subscription: null });
    }
  },

  reset: () => {
    get().unsubscribe();
    set({
      items: [],
      unreadCount: 0,
      panelOpen: false,
      loading: false,
      saving: false,
      error: null,
    });
  },
}));

export default useNotificationStore;
