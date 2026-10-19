import { create } from 'zustand';
import { supabase } from '../supabase/client';

// Quita caracteres que rompen la sintaxis .or() de PostgREST o los
// comodines de ilike inyectados por el usuario.
const sanitizeQuery = (q) => q.replace(/[%_,()"]/g, ' ').trim();

const useFollowStore = create((set, get) => ({
  following: [], // ids que yo sigo
  followers: [], // ids que me siguen
  searchResults: [],
  suggestions: [],
  explore: [],
  loading: false,
  saving: false,
  error: null,

  // Carga mi red (ids). Sirve para botones follow y contadores propios.
  fetchMyNetwork: async (userId) => {
    if (!userId) {
      set({ following: [], followers: [] });
      return;
    }

    const [{ data: fwing, error: e1 }, { data: fwers, error: e2 }] =
      await Promise.all([
        supabase.from('follows').select('followed_id').eq('follower_id', userId),
        supabase.from('follows').select('follower_id').eq('followed_id', userId),
      ]);

    if (e1 || e2) {
      set({ error: (e1 || e2).message });
      throw e1 || e2;
    }

    set({
      following: (fwing || []).map((r) => r.followed_id),
      followers: (fwers || []).map((r) => r.follower_id),
    });
  },

  follow: async (userId, targetId) => {
    if (!userId || !targetId || userId === targetId) return;
    set({ saving: true, error: null });

    const { error } = await supabase
      .from('follows')
      .insert({ follower_id: userId, followed_id: targetId });

    if (error) {
      set({ saving: false, error: error.message });
      throw error;
    }

    set((state) => ({
      following: state.following.includes(targetId)
        ? state.following
        : [...state.following, targetId],
      saving: false,
    }));
  },

  unfollow: async (userId, targetId) => {
    if (!userId || !targetId) return;
    set({ saving: true, error: null });

    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', userId)
      .eq('followed_id', targetId);

    if (error) {
      set({ saving: false, error: error.message });
      throw error;
    }

    set((state) => ({
      following: state.following.filter((id) => id !== targetId),
      saving: false,
    }));
  },

  isFollowing: (targetId) => get().following.includes(targetId),

  searchAthletes: async (query, excludeId) => {
    const q = sanitizeQuery(query);
    if (!q) {
      set({ searchResults: [] });
      return [];
    }

    set({ loading: true, error: null });

    const { data, error } = await supabase
      .from('athlete_directory')
      .select('*')
      .or(`full_name.ilike.%${q}%,display_name.ilike.%${q}%`)
      .neq('id', excludeId)
      .order('display_name', { ascending: true })
      .limit(20);

    if (error) {
      set({ loading: false, error: error.message });
      throw error;
    }

    set({ searchResults: data || [], loading: false });
    return data || [];
  },

  clearSearch: () => set({ searchResults: [] }),

  // Atletas con el mismo box (match exacto case-insensitive).
  fetchSuggestions: async (boxName, excludeId) => {
    const box = boxName?.trim();
    if (!box) {
      set({ suggestions: [] });
      return [];
    }

    const { data, error } = await supabase
      .from('athlete_directory')
      .select('*')
      .ilike('box_name', box)
      .neq('id', excludeId)
      .order('display_name', { ascending: true })
      .limit(10);

    if (error) {
      set({ error: error.message });
      throw error;
    }

    set({ suggestions: data || [] });
    return data || [];
  },

  // Ultimos atletas en unirse.
  fetchExplore: async (excludeId) => {
    const { data, error } = await supabase
      .from('athlete_directory')
      .select('*')
      .neq('id', excludeId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      set({ error: error.message });
      throw error;
    }

    set({ explore: data || [] });
    return data || [];
  },

  // Lista de seguidos de CUALQUIER usuario (grafo publico) con perfiles.
  fetchFollowingList: async (userId) => {
    const { data: rows, error } = await supabase
      .from('follows')
      .select('followed_id')
      .eq('follower_id', userId);

    if (error) throw error;
    return get()._hydrateProfiles(rows?.map((r) => r.followed_id) || []);
  },

  // Lista de seguidores de CUALQUIER usuario (grafo publico) con perfiles.
  fetchFollowersList: async (userId) => {
    const { data: rows, error } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('followed_id', userId);

    if (error) throw error;
    return get()._hydrateProfiles(rows?.map((r) => r.follower_id) || []);
  },

  _hydrateProfiles: async (ids) => {
    if (ids.length === 0) return [];

    const { data, error } = await supabase
      .from('athlete_directory')
      .select('*')
      .in('id', ids);

    if (error) throw error;

    const byId = new Map((data || []).map((p) => [p.id, p]));
    return ids.map((id) => byId.get(id)).filter(Boolean);
  },

  reset: () => {
    set({
      following: [],
      followers: [],
      searchResults: [],
      suggestions: [],
      explore: [],
      loading: false,
      saving: false,
      error: null,
    });
  },
}));

export default useFollowStore;
