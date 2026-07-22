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

    const existing = useProfileStore.getState().profile;
    if (existing?.id === userId) {
      return existing;
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

  // Sincroniza la foto de Google (user_metadata) a profiles.avatar_url
  // para que otros atletas la vean. No-op si no hay perfil o no cambio.
  syncAvatar: async (userId, avatarUrl) => {
    if (!userId || !avatarUrl) return;

    const { data } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', userId)
      .maybeSingle();

    if (!data || data.avatar_url === avatarUrl) return;

    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: avatarUrl })
      .eq('id', userId);

    if (!error) {
      const current = useProfileStore.getState().profile;
      if (current?.id === userId) {
        set({ profile: { ...current, avatar_url: avatarUrl } });
      }
    }
  },

  reset: () => {
    set({ profile: null, loading: false, error: null, saving: false });
  },
}));

export default useProfileStore;
