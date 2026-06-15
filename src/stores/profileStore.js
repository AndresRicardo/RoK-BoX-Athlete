import { create } from 'zustand';
import { supabase } from '../supabase/client';

const useProfileStore = create((set) => ({
  profile: null,
  loading: false,
  error: null,
  saving: false,

  fetchProfile: async (userId) => {
    if (!userId) {
      set({ profile: null, loading: false, error: null });
      return null;
    }

    set({ loading: true, error: null });

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      set({ loading: false, error: error.message });
      throw error;
    }

    set({ profile: data, loading: false });
    return data;
  },

  upsertProfile: async (userId, profileData) => {
    set({ saving: true, error: null });

    const payload = { id: userId, ...profileData };

    const { data, error } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      set({ saving: false, error: error.message });
      throw error;
    }

    set({ profile: data, saving: false });
    return data;
  },

  deleteProfile: async (userId) => {
    set({ saving: true, error: null });

    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (error) {
      set({ saving: false, error: error.message });
      throw error;
    }

    set({ profile: null, saving: false });
  },

  reset: () => {
    set({ profile: null, loading: false, error: null, saving: false });
  },
}));

export default useProfileStore;
