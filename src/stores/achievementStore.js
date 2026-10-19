import { create } from 'zustand';
import { supabase } from '../supabase/client';
import { ACHIEVEMENTS, getAllAchievementsStatus } from '../data/achievements';

const useAchievementStore = create((set, get) => ({
  unlocked: [],
  loading: false,
  newUnlock: null,

  fetchAchievements: async (userId) => {
    if (!userId) {
      set({ unlocked: [], loading: false });
      return [];
    }

    const existing = get().unlocked;
    if (existing.length > 0) {
      return existing;
    }

    set({ loading: true });

    const { data, error } = await supabase
      .from('achievements')
      .select('*')
      .eq('user_id', userId)
      .order('unlocked_at', { ascending: false });

    if (error) {
      set({ loading: false });
      throw error;
    }

    set({ unlocked: data || [], loading: false });
    return data || [];
  },

  checkAndUnlock: async (userId, { prs, benchmarks, profile }) => {
    if (!userId) return [];

    const status = getAllAchievementsStatus({ prs, benchmarks, profile });
    const currentlyUnlocked = new Set(get().unlocked.map((u) => u.achievement_id));
    const newlyUnlocked = status.filter(
      (a) => a.unlocked && !currentlyUnlocked.has(a.id),
    );

    if (newlyUnlocked.length === 0) return [];

    const rows = newlyUnlocked.map((a) => ({
      user_id: userId,
      achievement_id: a.id,
    }));

    const { data, error } = await supabase
      .from('achievements')
      .upsert(rows, { onConflict: 'user_id,achievement_id' })
      .select();

    if (error) {
      throw error;
    }

    const inserted = data || [];

    set((state) => {
      const merged = [...state.unlocked];
      for (const row of inserted) {
        if (!merged.find((u) => u.achievement_id === row.achievement_id)) {
          merged.push(row);
        }
      }
      const next = {
        unlocked: merged,
        newUnlock: inserted[0]
          ? {
              ...ACHIEVEMENTS.find((a) => a.id === inserted[0].achievement_id),
              unlocked_at: inserted[0].unlocked_at,
            }
          : state.newUnlock,
      };
      return next;
    });

    return inserted;
  },

  dismissNewUnlock: () => {
    set({ newUnlock: null });
  },

  isUnlocked: (achievementId) => {
    return get().unlocked.some((u) => u.achievement_id === achievementId);
  },

  reset: () => {
    set({ unlocked: [], loading: false, newUnlock: null });
  },
}));

export default useAchievementStore;
