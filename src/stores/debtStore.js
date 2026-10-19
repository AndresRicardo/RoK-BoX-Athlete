import { create } from 'zustand';
import { supabase } from '../supabase/client';

export const useDebtStore = create((set, get) => ({
  debts: [],
  totalPending: 0,
  loading: false,
  error: null,
  channel: null,

  fetchMyDebts: async (userId) => {
    if (!userId) {
      set({ debts: [], totalPending: 0, loading: false });
      return [];
    }

    set({ loading: true, error: null });

    try {
      const { data, error } = await supabase
        .from('debts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const debtsList = data || [];
      const totalPending = debtsList
        .filter((d) => d.status === 'pending' || d.status === 'partial')
        .reduce((sum, d) => sum + Number(d.balance || 0), 0);

      set({ debts: debtsList, totalPending, loading: false });
      return debtsList;
    } catch (err) {
      console.error('Error fetching debts:', err);
      set({ error: err.message, loading: false });
      return [];
    }
  },

  fetchDebtPayments: async (debtId) => {
    if (!debtId) return [];

    try {
      const { data, error } = await supabase
        .from('debt_payments')
        .select('*')
        .eq('debt_id', debtId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching debt payments:', err);
      return [];
    }
  },

  subscribeDebts: (userId) => {
    if (!userId) return;

    const currentChannel = get().channel;
    if (currentChannel) {
      supabase.removeChannel(currentChannel);
    }

    const channel = supabase
      .channel(`debts_user_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'debts',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          get().fetchMyDebts(userId);
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
    set({ debts: [], totalPending: 0, loading: false, error: null, channel: null });
  },
}));

export default useDebtStore;
