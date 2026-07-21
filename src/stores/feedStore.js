import { create } from 'zustand';
import { supabase } from '../supabase/client';
import useFollowStore from './followStore';

const PAGE_SIZE = 20;

const useFeedStore = create((set, get) => ({
  events: [], // [{...feed_event, athlete}] ordenados reciente primero
  loading: false,
  loadingMore: false,
  hasMore: false,
  error: null,

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

  reset: () => {
    set({ events: [], loading: false, loadingMore: false, hasMore: false, error: null });
  },
}));

export default useFeedStore;
