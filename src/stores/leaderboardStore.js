import { create } from 'zustand';
import { supabase } from '../supabase/client';

const INITIAL_LIMIT = 10;

const getErrorMessage = (error) => error?.message || 'No se pudo cargar el tablero.';

const prKey = (row) => `${row.movement}|${row.type}`;
const benchmarkKey = (row) =>
  `${row.name}|${row.type}|${row.scaling}|${row.result_unit}`;

const replaceGroup = (rows, keyFn, groupKey, nextRows) => [
  ...rows.filter((row) => keyFn(row) !== groupKey),
  ...(nextRows || []),
];

const useLeaderboardStore = create((set) => ({
  prs: [],
  benchmarks: [],
  scope: 'global',
  loading: false,
  loadingMore: false,
  error: null,

  fetchLeaderboards: async (scope = 'global') => {
    set({ scope, loading: true, error: null });

    const [prsResult, benchmarksResult] = await Promise.all([
      supabase.rpc('get_pr_leaderboard', {
        p_scope: scope,
        p_limit: INITIAL_LIMIT,
      }),
      supabase.rpc('get_benchmark_leaderboard', {
        p_scope: scope,
        p_limit: INITIAL_LIMIT,
      }),
    ]);

    const error = prsResult.error || benchmarksResult.error;
    if (error) {
      set({ loading: false, error: getErrorMessage(error) });
      throw error;
    }

    set({
      prs: prsResult.data || [],
      benchmarks: benchmarksResult.data || [],
      loading: false,
    });

    return {
      prs: prsResult.data || [],
      benchmarks: benchmarksResult.data || [],
    };
  },

  loadMorePr: async ({ scope, movement, type, limit }) => {
    set({ loadingMore: true, error: null });
    const { data, error } = await supabase.rpc('get_pr_leaderboard', {
      p_scope: scope,
      p_movement: movement,
      p_type: type,
      p_limit: limit,
    });

    if (error) {
      set({ loadingMore: false, error: getErrorMessage(error) });
      throw error;
    }

    const groupKey = `${movement}|${type}`;
    set((state) => ({
      prs: replaceGroup(state.prs, prKey, groupKey, data),
      loadingMore: false,
    }));
    return data || [];
  },

  loadMoreBenchmarks: async ({ scope, name, type, scaling, resultUnit, limit }) => {
    set({ loadingMore: true, error: null });
    const { data, error } = await supabase.rpc('get_benchmark_leaderboard', {
      p_scope: scope,
      p_name: name,
      p_type: type,
      p_scaling: scaling,
      p_result_unit: resultUnit,
      p_limit: limit,
    });

    if (error) {
      set({ loadingMore: false, error: getErrorMessage(error) });
      throw error;
    }

    const groupKey = `${name}|${type}|${scaling}|${resultUnit}`;
    set((state) => ({
      benchmarks: replaceGroup(state.benchmarks, benchmarkKey, groupKey, data),
      loadingMore: false,
    }));
    return data || [];
  },

  reset: () =>
    set({
      prs: [],
      benchmarks: [],
      scope: 'global',
      loading: false,
      loadingMore: false,
      error: null,
    }),
}));

export default useLeaderboardStore;
