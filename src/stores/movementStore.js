import { create } from 'zustand';
import { supabase } from '../supabase/client';
import useProfileStore from './profileStore';
import usePRStore from './prStore';
import useBenchmarkStore from './benchmarkStore';
import useAchievementStore from './achievementStore';
import { MOVEMENT_CATALOG } from '../data/movements';

function findMovementCategory(name) {
  const m = MOVEMENT_CATALOG.find(
    (x) => x.name.toLowerCase() === name.toLowerCase(),
  );
  return m ? m.category : 'accessory';
}

const useMovementStore = create((set, get) => ({
  unlocked: [],
  loading: false,
  error: null,
  saving: false,

  fetchMovements: async (userId) => {
    if (!userId) {
      set({ unlocked: [], loading: false, error: null });
      return [];
    }

    const existing = get().unlocked;
    if (existing.length > 0) {
      return existing;
    }

    set({ loading: true, error: null });

    const { data, error } = await supabase
      .from('unlocked_movements')
      .select('*')
      .eq('user_id', userId)
      .order('unlocked_at', { ascending: false });

    if (error) {
      set({ loading: false, error: error.message });
      throw error;
    }

    set({ unlocked: data || [], loading: false });
    return data || [];
  },

  unlockMovement: async (userId, movement) => {
    set({ saving: true, error: null });

    const payload = {
      user_id: userId,
      movement: movement.trim(),
      category: findMovementCategory(movement),
    };

    const { data, error } = await supabase
      .from('unlocked_movements')
      .upsert(payload, { onConflict: 'user_id,movement' })
      .select()
      .single();

    if (error) {
      set({ saving: false, error: error.message });
      throw error;
    }

    set((state) => {
      const filtered = state.unlocked.filter(
        (u) => u.movement.toLowerCase() !== data.movement.toLowerCase(),
      );
      return {
        unlocked: [data, ...filtered],
        saving: false,
      };
    });

    const { profile } = useProfileStore.getState();
    const { prs } = usePRStore.getState();
    const { benchmarks } = useBenchmarkStore.getState();
    const movementsNow = get().unlocked;
    useAchievementStore
      .getState()
      .checkAndUnlock(userId, {
        prs,
        benchmarks,
        profile,
        movements: movementsNow,
      })
      .catch(() => {});

    return data;
  },

  lockMovement: async (userId, movement) => {
    set({ saving: true, error: null });

    const { error } = await supabase
      .from('unlocked_movements')
      .delete()
      .eq('user_id', userId)
      .eq('movement', movement);

    if (error) {
      set({ saving: false, error: error.message });
      throw error;
    }

    set((state) => ({
      unlocked: state.unlocked.filter(
        (u) => u.movement.toLowerCase() !== movement.toLowerCase(),
      ),
      saving: false,
    }));
  },

  isUnlocked: (movement) => {
    return get().unlocked.some(
      (u) => u.movement.toLowerCase() === movement.toLowerCase(),
    );
  },

  reset: () => {
    set({ unlocked: [], loading: false, error: null, saving: false });
  },
}));

export default useMovementStore;
