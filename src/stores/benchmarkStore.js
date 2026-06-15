import { create } from 'zustand';
import { supabase } from '../supabase/client';
import useProfileStore from './profileStore';
import usePRStore from './prStore';
import useMovementStore from './movementStore';
import useAchievementStore from './achievementStore';

const useBenchmarkStore = create((set, get) => ({
  benchmarks: [],
  loading: false,
  error: null,
  saving: false,

  fetchBenchmarks: async (userId) => {
    if (!userId) {
      set({ benchmarks: [], loading: false, error: null });
      return [];
    }

    set({ loading: true, error: null });

    const { data, error } = await supabase
      .from('benchmarks')
      .select('*')
      .eq('user_id', userId)
      .order('performed_at', { ascending: false });

    if (error) {
      set({ loading: false, error: error.message });
      throw error;
    }

    set({ benchmarks: data || [], loading: false });
    return data || [];
  },

  createBenchmark: async (userId, benchmarkData) => {
    set({ saving: true, error: null });

    const payload = {
      user_id: userId,
      name: benchmarkData.name.trim(),
      type: benchmarkData.type,
      result_value: benchmarkData.result_value,
      result_unit: benchmarkData.result_unit,
      scaling: benchmarkData.scaling,
      performed_at: benchmarkData.performed_at,
      notes: benchmarkData.notes?.trim() || null,
    };

    const { data, error } = await supabase
      .from('benchmarks')
      .insert(payload)
      .select()
      .single();

    if (error) {
      set({ saving: false, error: error.message });
      throw error;
    }

    set((state) => ({
      benchmarks: [data, ...state.benchmarks],
      saving: false,
    }));

    const { profile } = useProfileStore.getState();
    const { prs } = usePRStore.getState();
    const benchmarksNow = [data, ...get().benchmarks];
    useAchievementStore
      .getState()
      .checkAndUnlock(userId, { prs, benchmarks: benchmarksNow, profile })
      .catch(() => {});

    return data;
  },

  deleteBenchmark: async (id) => {
    set({ saving: true, error: null });

    const { error } = await supabase
      .from('benchmarks')
      .delete()
      .eq('id', id);

    if (error) {
      set({ saving: false, error: error.message });
      throw error;
    }

    set((state) => ({
      benchmarks: state.benchmarks.filter((b) => b.id !== id),
      saving: false,
    }));
  },

  getBenchmarkById: async (id) => {
    const local = get().benchmarks.find((b) => b.id === id);
    if (local) return local;

    set({ loading: true, error: null });
    const { data, error } = await supabase
      .from('benchmarks')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      set({ loading: false, error: error.message });
      throw error;
    }
    set({ loading: false });
    return data;
  },

  updateBenchmark: async (id, userId, fields) => {
    set({ saving: true, error: null });

    const payload = {
      name: fields.name.trim(),
      type: fields.type,
      result_value: fields.result_value,
      result_unit: fields.result_unit,
      scaling: fields.scaling,
      performed_at: fields.performed_at,
      notes: fields.notes?.trim() || null,
    };

    const { error } = await supabase
      .from('benchmarks')
      .update(payload)
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      set({ saving: false, error: error.message });
      throw error;
    }

    await get().fetchBenchmarks(userId);

    const { profile } = useProfileStore.getState();
    const { prs } = usePRStore.getState();
    const { movements } = useMovementStore.getState();
    const { benchmarks: benchmarksNow } = get();
    useAchievementStore
      .getState()
      .checkAndUnlock(userId, { prs, benchmarks: benchmarksNow, profile, movements })
      .catch(() => {});

    set({ saving: false });
    return get().benchmarks.find((b) => b.id === id) || null;
  },

  isBetter: (candidate, current, type) => {
    if (type === 'for_time') return candidate < current;
    return candidate > current;
  },

  getBestByName: () => {
    const { benchmarks } = get();
    const map = new Map();
    for (const b of benchmarks) {
      const key = `${b.name}|${b.type}|${b.scaling}`;
      const current = map.get(key);
      if (
        !current ||
        get().isBetter(b.result_value, current.result_value, b.type)
      ) {
        map.set(key, b);
      }
    }
    return map;
  },

  reset: () => {
    set({ benchmarks: [], loading: false, error: null, saving: false });
  },

  resetError: () => set({ error: null }),
}));

export default useBenchmarkStore;
