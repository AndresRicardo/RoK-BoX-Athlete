import { create } from 'zustand';
import { supabase } from '../supabase/client';

export const useMembershipStore = create((set, get) => ({
  membership: null,
  loading: false,
  error: null,
  channel: null,

  fetchMembership: async (userId, documentId) => {
    if (!userId && !documentId) {
      set({ membership: null, loading: false });
      return null;
    }

    set({ loading: true, error: null });

    try {
      let query = supabase
        .from('memberships')
        .select('*')
        .order('end_date', { ascending: false })
        .limit(1);

      if (userId) {
        query = query.eq('user_id', userId);
      } else if (documentId) {
        query = query.eq('document_id', documentId);
      }

      const { data, error } = await query.maybeSingle();

      if (error) throw error;

      // Calcular estado dinámico según fecha actual
      let dynamicMembership = null;
      if (data) {
        const now = new Date();
        const endDate = new Date(data.end_date);
        const diffMs = endDate.getTime() - now.getTime();
        const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        let dynamicStatus = data.status;
        if (daysRemaining < 0) {
          dynamicStatus = 'overdue';
        } else if (daysRemaining <= 3) {
          dynamicStatus = 'expiring_soon';
        } else {
          dynamicStatus = 'active';
        }

        dynamicMembership = {
          ...data,
          daysRemaining,
          isOverdue: daysRemaining < 0,
          isExpiringSoon: daysRemaining >= 0 && daysRemaining <= 3,
          dynamicStatus,
        };
      }

      set({ membership: dynamicMembership, loading: false });
      return dynamicMembership;
    } catch (err) {
      console.error('Error fetching membership:', err);
      set({ error: err.message, loading: false });
      return null;
    }
  },

  subscribeMembership: (userId) => {
    if (!userId) return;

    // Desuscribir canal previo si existe
    const currentChannel = get().channel;
    if (currentChannel) {
      supabase.removeChannel(currentChannel);
    }

    const channel = supabase
      .channel(`memberships_user_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'memberships',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          get().fetchMembership(userId);
        }
      )
      .subscribe();

    set({ channel });
  },

  reset: () => {
    const currentChannel = get().channel;
    if (currentChannel) {
      supabase.removeChannel(currentChannel);
    }
    set({ membership: null, loading: false, error: null, channel: null });
  },
}));

export default useMembershipStore;
