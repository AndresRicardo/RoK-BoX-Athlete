import { create } from 'zustand';
import { supabase } from '../supabase/client';
import useProfileStore from './profileStore';
import useBenchmarkStore from './benchmarkStore';
import useAchievementStore from './achievementStore';

const usePRStore = create((set, get) => ({
  prs: [],
  loading: false,
  error: null,
  saving: false,

  fetchPRs: async (userId) => {
    if (!userId) {
      set({ prs: [], loading: false, error: null });
      return [];
    }

    const existing = get().prs;
    if (existing.length > 0) {
      return existing;
    }

    set({ loading: true, error: null });

    const { data, error } = await supabase
      .from('prs')
      .select('*')
      .eq('user_id', userId)
      .order('achieved_at', { ascending: false });

    if (error) {
      set({ loading: false, error: error.message });
      throw error;
    }

    set({ prs: data || [], loading: false });
    return data || [];
  },

  createPR: async (userId, prData) => {
    set({ saving: true, error: null });

    const payload = {
      user_id: userId,
      movement: prData.movement.trim(),
      type: prData.type,
      value_numeric: prData.value_numeric,
      achieved_at: prData.achieved_at,
      notes: prData.notes?.trim() || null,
    };

    const { data, error } = await supabase
      .from('prs')
      .insert(payload)
      .select()
      .single();

    if (error) {
      set({ saving: false, error: error.message });
      throw error;
    }

    set((state) => ({
      prs: [data, ...state.prs],
      saving: false,
    }));

    const { profile } = useProfileStore.getState();
    const { benchmarks } = useBenchmarkStore.getState();
    const prsNow = [data, ...get().prs];
    useAchievementStore
      .getState()
      .checkAndUnlock(userId, { prs: prsNow, benchmarks, profile })
      .catch(() => {});

    return data;
  },

  deletePR: async (id) => {
    set({ saving: true, error: null });

    const { error } = await supabase
      .from('prs')
      .delete()
      .eq('id', id);

    if (error) {
      set({ saving: false, error: error.message });
      throw error;
    }

    set((state) => ({
      prs: state.prs.filter((p) => p.id !== id),
      saving: false,
    }));
  },

  getBestByMovement: () => {
    const { prs } = get();
    const map = new Map();
    for (const pr of prs) {
      const key = `${pr.movement}|${pr.type}`;
      const current = map.get(key);
      if (!current || pr.value_numeric > current.value_numeric) {
        map.set(key, pr);
      }
    }
    return map;
  },

  reset: () => {
    set({ prs: [], loading: false, error: null, saving: false });
  },
}));

export default usePRStore;
