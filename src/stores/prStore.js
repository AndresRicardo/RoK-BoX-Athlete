import { create } from 'zustand';
import { supabase } from '../supabase/client';
import useProfileStore from './profileStore';
import useBenchmarkStore from './benchmarkStore';
import useMovementStore from './movementStore';
import useAchievementStore from './achievementStore';

function normalizePR(p) {
  if (!p) return p;
  const val = p.value_numeric ?? p.value;
  const dt = p.achieved_at || (p.date ? p.date.split('T')[0] : new Date().toISOString().split('T')[0]);
  return {
    ...p,
    value: val,
    value_numeric: val,
    date: dt,
    achieved_at: dt,
    type: p.type || 'strength',
    unit: p.unit || (p.type === 'reps' ? 'reps' : 'kg'),
  };
}

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

    const list = (data || []).map(normalizePR);
    set({ prs: list, loading: false });
    return list;
  },

  createPR: async (userId, prData) => {
    set({ saving: true, error: null });

    const val = prData.value_numeric ?? prData.value;
    const dt = prData.achieved_at || (prData.date ? prData.date.split('T')[0] : new Date().toISOString().split('T')[0]);

    const payload = {
      user_id: userId,
      movement: prData.movement.trim(),
      type: prData.type || 'strength',
      value_numeric: parseFloat(val),
      achieved_at: dt,
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

    const normalized = normalizePR(data);
    set((state) => ({
      prs: [normalized, ...state.prs],
      saving: false,
    }));

    const { profile } = useProfileStore.getState();
    const { benchmarks } = useBenchmarkStore.getState();
    const prsNow = [normalized, ...get().prs];
    useAchievementStore
      .getState()
      .checkAndUnlock(userId, { prs: prsNow, benchmarks, profile })
      .catch(() => {});

    return normalized;
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

  getPRById: async (id) => {
    const local = get().prs.find((p) => p.id === id);
    if (local) return local;

    set({ loading: true, error: null });
    const { data, error } = await supabase
      .from('prs')
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

  updatePR: async (id, arg2, arg3) => {
    set({ saving: true, error: null });

    const fields = arg3 || arg2;
    const userId = arg3 ? arg2 : undefined;

    const val = fields.value_numeric ?? fields.value;
    const dt = fields.achieved_at || (fields.date ? fields.date.split('T')[0] : new Date().toISOString().split('T')[0]);

    const payload = {
      movement: fields.movement.trim(),
      type: fields.type || 'strength',
      value_numeric: parseFloat(val),
      achieved_at: dt,
      notes: fields.notes?.trim() || null,
    };

    let query = supabase.from('prs').update(payload).eq('id', id);
    if (userId) query = query.eq('user_id', userId);

    const { data, error } = await query.select().single();

    if (error) {
      set({ saving: false, error: error.message });
      throw error;
    }

    const normalized = normalizePR(data);
    set((state) => ({
      prs: state.prs.map((p) => (p.id === id ? normalized : p)),
      saving: false,
    }));

    const targetUser = userId || normalized.user_id;
    if (targetUser) {
      const { profile } = useProfileStore.getState();
      const { benchmarks } = useBenchmarkStore.getState();
      const { movements } = useMovementStore.getState();
      const { prs: prsNow } = get();
      useAchievementStore
        .getState()
        .checkAndUnlock(targetUser, { prs: prsNow, benchmarks, profile, movements })
        .catch(() => {});
    }

    return normalized;
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

  resetError: () => set({ error: null }),
}));

export default usePRStore;
