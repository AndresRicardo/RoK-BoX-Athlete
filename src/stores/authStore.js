import { create } from 'zustand';
import { supabase } from '../supabase/client';
import useProfileStore from './profileStore';
import usePRStore from './prStore';
import useBenchmarkStore from './benchmarkStore';

const useAuthStore = create((set, get) => ({
  user: null,
  session: null,
  loading: true,
  initialized: false,

  initialize: async () => {
    const { data: { session } } = await supabase.auth.getSession();

    set({
      session: session,
      user: session?.user
        ? { id: session.user.id, email: session.user.email }
        : null,
      loading: false,
      initialized: true,
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      set({
        session: session,
        user: session?.user
          ? { id: session.user.id, email: session.user.email }
          : null,
      });
    });
  },

  signInWithGoogle: async () => {
    set({ loading: true });

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      set({ loading: false });
      throw error;
    }

    set({ loading: false });
    return data;
  },

  signOut: async () => {
    set({ loading: true });

    const { error } = await supabase.auth.signOut();

    if (error) {
      set({ loading: false });
      throw error;
    }

    useProfileStore.getState().reset();
    usePRStore.getState().reset();
    useBenchmarkStore.getState().reset();

    set({
      user: null,
      session: null,
      loading: false,
    });
  },

  isAuthenticated: () => {
    return !!get().session;
  },
}));

export default useAuthStore;
