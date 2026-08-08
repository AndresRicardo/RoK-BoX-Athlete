import { create } from 'zustand';
import { supabase } from '../supabase/client';
import useFollowStore from './followStore';
import useAuthStore from './authStore';

const PAGE_SIZE = 20;

const useFeedStore = create((set, get) => ({
  events: [], // [{...feed_event, athlete}] ordenados reciente primero
  loading: false,
  loadingMore: false,
  hasMore: false,
  error: null,
  subscription: null,

  fetchFeed: async (userId) => {
    if (!userId) {
      set({ events: [], loading: false, hasMore: false, error: null });
      return [];
    }

    // Asegura los ids de seguidos (la red puede no estar cargada aun)
    let { following } = useFollowStore.getState();
    if (following.length === 0) {
      await useFollowStore.getState().fetchMyNetwork(userId);
      following = useFollowStore.getState().following;
    }

    if (following.length === 0) {
      set({ events: [], loading: false, hasMore: false });
      return [];
    }

    set({ loading: true, error: null });

    const { data, error } = await supabase
      .from('feed_events')
      .select('*')
      .in('user_id', following)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (error) {
      set({ loading: false, error: error.message });
      throw error;
    }

    const events = await get()._withAthletes(data || []);
    set({
      events,
      loading: false,
      hasMore: (data || []).length === PAGE_SIZE,
    });
    return events;
  },

  loadMore: async () => {
    const { events, loadingMore, hasMore } = get();
    if (loadingMore || !hasMore || events.length === 0) return [];

    const following = useFollowStore.getState().following;
    if (following.length === 0) return [];

    set({ loadingMore: true, error: null });

    const { data, error } = await supabase
      .from('feed_events')
      .select('*')
      .in('user_id', following)
      .order('created_at', { ascending: false })
      .range(events.length, events.length + PAGE_SIZE - 1);

    if (error) {
      set({ loadingMore: false, error: error.message });
      throw error;
    }

    const more = await get()._withAthletes(data || []);
    set((state) => ({
      events: [...state.events, ...more],
      loadingMore: false,
      hasMore: (data || []).length === PAGE_SIZE,
    }));
    return more;
  },

  // Adjunta el perfil publico (handle, nombre, iniciales) a cada evento.
  _withAthletes: async (rows) => {
    if (rows.length === 0) return [];

    const ids = [...new Set(rows.map((e) => e.user_id))];
    const { data: people, error } = await supabase
      .from('athlete_directory')
      .select('*')
      .in('id', ids);

    if (error) throw error;

    const byId = new Map((people || []).map((p) => [p.id, p]));
    return rows.map((e) => ({ ...e, athlete: byId.get(e.user_id) || null }));
  },

  // FASE 15: insercion en vivo (Realtime). Solo se preprende si la fila
  // corresponde al propio usuario o a alguien a quien ya sigo. Si la
  // red todavia no esta cargada (re-login rapido, primer arranque),
  // se intenta fetchMyNetwork antes de descartar.
  prependFromRealtime: async (row) => {
    if (!row || !row.id) return;

    const me = useAuthStore.getState().user;
    let following = useFollowStore.getState().following;

    if (row.user_id !== me?.id && !following.includes(row.user_id)) {
      // No lo reconozco. Intento cargar la red (puede estar vacia tras
      // un re-login) y vuelvo a comprobar.
      if (me?.id && following.length === 0) {
        try {
          await useFollowStore.getState().fetchMyNetwork(me.id);
        } catch {
          // ignore: la RLS del canal ya filtra, asi que es seguro descartar
        }
        following = useFollowStore.getState().following;
      }
      if (row.user_id !== me?.id && !following.includes(row.user_id)) return;
    }

    // Evita prepender un evento que llega tarde si la cabeza del feed es
    // mas reciente (consistente con orden desc por created_at).
    const head = get().events[0];
    if (head && row.created_at && head.created_at && row.created_at <= head.created_at) {
      return;
    }

    const [hydrated] = await get()._withAthletes([row]);
    if (!hydrated) return;

    set((state) => {
      if (state.events.some((e) => e.id === hydrated.id)) return state;
      return { events: [hydrated, ...state.events] };
    });
  },

  // FASE 15: borrado en vivo (Realtime). Cuando un atleta elimina un
  // PR/benchmark/logro/skill, el trigger borra su feed_event y este
  // cliente debe reflejarlo sin recargar.
  removeFromRealtime: (id) => {
    if (!id) return;
    set((state) => {
      if (!state.events.some((e) => e.id === id)) return state;
      return { events: state.events.filter((e) => e.id !== id) };
    });
  },

  // FASE 15: Supabase Realtime sobre feed_events.
  // No aplicamos filtro server-side por user_id porque la lista de
  // seguidos cambia; la RLS del cliente ya garantiza que solo llegan
  // filas propias o de seguidos (ver 0009_feed_events.sql).
  subscribeRealtime: () => {
    get().unsubscribe();

    const channel = supabase
      .channel('feed_events:all')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'feed_events',
        },
        (payload) => {
          get().prependFromRealtime(payload.new).catch(() => {});
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'feed_events',
        },
        (payload) => {
          const oldRow = payload.old || {};
          get().removeFromRealtime(oldRow.id);
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
      events: [],
      loading: false,
      loadingMore: false,
      hasMore: false,
      error: null,
    });
  },
}));

export default useFeedStore;
