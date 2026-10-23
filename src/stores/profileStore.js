import { create } from 'zustand';
import { supabase } from '../supabase/client';

const useProfileStore = create((set) => ({
  profile: null,
  roles: [],
  isStaff: false,
  isPartner: false,
  loading: false,
  error: null,
  saving: false,

  fetchProfile: async (userId) => {
    if (!userId) {
      set({ profile: null, roles: [], isStaff: false, isPartner: false, loading: false, error: null });
      return null;
    }

    const existing = useProfileStore.getState().profile;
    if (existing?.id === userId && existing?.roles) {
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

    // Aplicar invitaciones pendientes para este email (socio/coach) antes de leer los roles
    try {
      await supabase.rpc('claim_role_invites');
    } catch (iErr) {
      console.warn('Could not claim role invites:', iErr);
    }

    // Cargar roles desde la tabla central user_roles
    let roles = [];
    try {
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);
      roles = rolesData ? rolesData.map((r) => r.role) : [];
    } catch (rErr) {
      console.warn('Could not load user_roles:', rErr);
    }

    const isStaff = roles.includes('coach') || roles.includes('partner');
    const isPartner = roles.includes('partner');

    const combined = data
      ? {
          ...data,
          roles,
          isStaff,
          isPartner,
          role: isPartner ? 'admin' : (isStaff ? 'coach' : 'athlete'),
        }
      : null;

    set({ profile: combined, roles, isStaff, isPartner, loading: false });
    return combined;
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

    const existing = useProfileStore.getState().profile;
    const combined = {
      ...data,
      roles: existing?.roles || [],
      isStaff: existing?.isStaff || false,
      isPartner: existing?.isPartner || false,
      role: existing?.role || 'athlete',
    };

    set({ profile: combined, saving: false });
    return combined;
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

    set({ profile: null, roles: [], isStaff: false, isPartner: false, saving: false });
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
    set({ profile: null, roles: [], isStaff: false, isPartner: false, loading: false, error: null, saving: false });
  },
}));

export default useProfileStore;
