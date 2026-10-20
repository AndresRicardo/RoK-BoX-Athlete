import { create } from 'zustand';
import { supabase } from '../supabase/client';
import useFollowStore from './followStore';
import useAuthStore from './authStore';
import useProfileStore from './profileStore';

const PAGE_SIZE = 20;

const useFeedStore = create((set, get) => ({
  events: [], // [{...feed_event, athlete, actor}] ordenados reciente primero
  loading: false,
  loadingMore: false,
  hasMore: false,
  error: null,
  subscription: null,

  subscribeFeed: () => get().subscribeRealtime(),
  unsubscribeFeed: () => get().unsubscribe(),
  subscribe: () => get().subscribeRealtime(),

  fetchFeed: async (userId) => {
    if (!userId) {
      set({ events: [], loading: false, hasMore: false, error: null });
      return [];
    }

    // Asegura los ids de seguidos (la red puede no estar cargada aun)
    let { following } = useFollowStore.getState();
    if (!following || following.length === 0) {
      await useFollowStore.getState().fetchMyNetwork(userId);
      following = useFollowStore.getState().following;
    }

    // Incluir mis propios eventos + los eventos de los atletas a quienes sigo
    const targetIds = [...new Set([userId, ...(following || [])])].filter(Boolean);

    set({ loading: true, error: null });

    const { data, error } = await supabase
      .from('feed_events')
      .select('*')
      .in('user_id', targetIds)
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

    const me = useAuthStore.getState().user;
    const following = useFollowStore.getState().following;
    const targetIds = [...new Set([me?.id, ...(following || [])])].filter(Boolean);
    if (targetIds.length === 0) return [];

    set({ loadingMore: true, error: null });

    const { data, error } = await supabase
      .from('feed_events')
      .select('*')
      .in('user_id', targetIds)
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

  // Adjunta el perfil público (handle, nombre, iniciales, avatar) a cada evento.
  _withAthletes: async (rows) => {
    if (rows.length === 0) return [];

    const ids = [...new Set(rows.map((e) => e.user_id))];
    const { data: people, error } = await supabase
      .from('athlete_directory')
      .select('*')
      .in('id', ids);

    if (error) {
      console.warn('Error fetching athlete_directory for feed:', error);
    }

    const byId = new Map((people || []).map((p) => [p.id, p]));
    const me = useAuthStore.getState().user;
    const { profile } = useProfileStore.getState();

    return rows.map((e) => {
      let athlete = byId.get(e.user_id) || null;
      if (!athlete && e.user_id === me?.id && profile) {
        athlete = profile;
      }
      return {
        ...e,
        athlete,
        actor: athlete, // Compatible con actor y athlete
      };
    });
  },

  // Inserción en vivo (Realtime).
  prependFromRealtime: async (row) => {
    if (!row || !row.id) return;

    const me = useAuthStore.getState().user;
    const following = useFollowStore.getState().following;
    if (row.user_id !== me?.id && !following.includes(row.user_id)) return;

    const [withAthlete] = await get()._withAthletes([row]);
    set((state) => ({
      events: [withAthlete, ...state.events.filter((e) => e.id !== row.id)],
    }));
  },

  removeFromRealtime: (refId) => {
    if (!refId) return;
    set((state) => ({
      events: state.events.filter((e) => e.ref_id !== refId),
    }));
  },

  subscribeRealtime: () => {
    const current = get().subscription;
    if (current) return current;

    const channel = supabase
      .channel('feed:events')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'feed_events' },
        (payload) => {
          get().prependFromRealtime(payload.new);
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'feed_events' },
        (payload) => {
          if (payload.old?.ref_id) {
            get().removeFromRealtime(payload.old.ref_id);
          }
        },
      )
      .subscribe();

    set({ subscription: channel });
    return channel;
  },

  unsubscribe: () => {
    const sub = get().subscription;
    if (sub) {
      supabase.removeChannel(sub);
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
      subscription: null,
    });
  },
}));

export default useFeedStore;
