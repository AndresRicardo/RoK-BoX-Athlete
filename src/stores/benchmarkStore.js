import { create } from 'zustand';
import { supabase } from '../supabase/client';
import useProfileStore from './profileStore';
import usePRStore from './prStore';
import useMovementStore from './movementStore';
import useAchievementStore from './achievementStore';
import { formatBenchmarkResult } from '../utils/format';

function normalizeBenchmark(b) {
  if (!b) return b;
  const scaling = b.scaling || b.discipline || 'rx';
  const performed_at = b.performed_at || (b.date ? b.date.split('T')[0] : new Date().toISOString().split('T')[0]);
  let result = b.result;
  if (!result && b.result_value !== undefined) {
    result = formatBenchmarkResult(b);
  }
  return {
    ...b,
    scaling,
    discipline: scaling,
    performed_at,
    date: b.date || performed_at,
    result: result || `${b.result_value ?? ''}`,
    result_value: b.result_value,
    result_unit: b.result_unit || (b.type === 'for_time' ? 'time_seconds' : 'reps'),
  };
}

function parseBenchmarkPayload(benchmarkData) {
  let resultValue = benchmarkData.result_value;
  let resultUnit = benchmarkData.result_unit;

  if (resultValue === undefined && benchmarkData.result) {
    const resStr = String(benchmarkData.result).trim();
    if (resStr.includes(':')) {
      const [m, s] = resStr.split(':').map(Number);
      resultValue = (m || 0) * 60 + (s || 0);
      resultUnit = 'time_seconds';
    } else {
      resultValue = parseFloat(resStr) || 0;
      resultUnit = benchmarkData.type === 'for_time' ? 'time_seconds' : 'reps';
    }
  }

  const performedAt = benchmarkData.performed_at || (benchmarkData.date ? benchmarkData.date.split('T')[0] : new Date().toISOString().split('T')[0]);
  const scaling = benchmarkData.scaling || benchmarkData.discipline || 'rx';

  return {
    name: benchmarkData.name.trim(),
    type: benchmarkData.type || 'for_time',
    result_value: resultValue ?? 0,
    result_unit: resultUnit || 'reps',
    scaling,
    performed_at: performedAt,
    notes: benchmarkData.notes?.trim() || null,
  };
}

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

    const list = (data || []).map(normalizeBenchmark);
    set({ benchmarks: list, loading: false });
    return list;
  },

  createBenchmark: async (userId, benchmarkData) => {
    set({ saving: true, error: null });

    const payload = {
      user_id: userId,
      ...parseBenchmarkPayload(benchmarkData),
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

    const normalized = normalizeBenchmark(data);
    set((state) => ({
      benchmarks: [normalized, ...state.benchmarks],
      saving: false,
    }));

    const { profile } = useProfileStore.getState();
    const { prs } = usePRStore.getState();
    const { unlocked } = useMovementStore.getState();
    const benchmarksNow = [normalized, ...get().benchmarks];
    useAchievementStore
      .getState()
      .checkAndUnlock(userId, { prs, benchmarks: benchmarksNow, profile, movements: unlocked })
      .catch(() => {});

    return normalized;
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

  updateBenchmark: async (id, arg2, arg3) => {
    set({ saving: true, error: null });

    const fields = arg3 || arg2;
    const userId = arg3 ? arg2 : undefined;
    const payload = parseBenchmarkPayload(fields);

    let query = supabase.from('benchmarks').update(payload).eq('id', id);
    if (userId) query = query.eq('user_id', userId);

    const { data, error } = await query.select().single();

    if (error) {
      set({ saving: false, error: error.message });
      throw error;
    }

    const normalized = normalizeBenchmark(data);
    set((state) => ({
      benchmarks: state.benchmarks.map((b) => (b.id === id ? normalized : b)),
      saving: false,
    }));

    const targetUser = userId || normalized.user_id;
    if (targetUser) {
      const { profile } = useProfileStore.getState();
      const { prs } = usePRStore.getState();
      const { unlocked } = useMovementStore.getState();
      const { benchmarks: benchmarksNow } = get();
      useAchievementStore
        .getState()
        .checkAndUnlock(targetUser, { prs, benchmarks: benchmarksNow, profile, movements: unlocked })
        .catch(() => {});
    }

    return normalized;
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
