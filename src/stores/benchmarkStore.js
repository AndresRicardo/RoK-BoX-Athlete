import { create } from 'zustand';
import { supabase } from '../supabase/client';

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

    const existing = get().benchmarks;
    if (existing.length > 0) {
      return existing;
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
}));

export default useBenchmarkStore;
