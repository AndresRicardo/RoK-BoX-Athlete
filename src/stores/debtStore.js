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
      // 1. Consultar vista resumen de deudas v2 (RLS filtra automáticamente a las deudas del member propio)
      const { data: debtsData, error: debtsErr } = await supabase
        .from('debt_summary')
        .select('*')
        .order('created_at', { ascending: false });

      if (debtsErr) throw debtsErr;

      const debtList = debtsData || [];
      const debtIds = debtList.map((d) => d.id);

      // 2. Consultar ítems y abonos de estas deudas
      const itemsByDebt = {};
      const paymentsByDebt = {};

      if (debtIds.length > 0) {
        const [itemsRes, paymentsRes] = await Promise.all([
          supabase
            .from('debt_items')
            .select('*')
            .in('debt_id', debtIds)
            .is('deleted_at', null)
            .order('created_at', { ascending: true }),
          supabase
            .from('debt_payments')
            .select('*')
            .in('debt_id', debtIds)
            .is('deleted_at', null)
            .order('paid_at', { ascending: false }),
        ]);

        if (itemsRes.data) {
          itemsRes.data.forEach((item) => {
            if (!itemsByDebt[item.debt_id]) itemsByDebt[item.debt_id] = [];
            itemsByDebt[item.debt_id].push(item);
          });
        }

        if (paymentsRes.data) {
          paymentsRes.data.forEach((pmt) => {
            if (!paymentsByDebt[pmt.debt_id]) paymentsByDebt[pmt.debt_id] = [];
            paymentsByDebt[pmt.debt_id].push(pmt);
          });
        }
      }

      // 3. Ensamblar deudas con sus ítems y pagos
      const enrichedDebts = debtList.map((d) => {
        const items = itemsByDebt[d.id] || [];
        const payments = paymentsByDebt[d.id] || [];
        const summary = items
          .map((it) => `${it.name}${it.quantity > 1 ? ` (x${it.quantity})` : ''}`)
          .join(', ');

        return {
          ...d,
          amount: Number(d.total_amount || 0),
          balance: Number(d.balance || 0),
          paid_amount: Number(d.paid_amount || 0),
          items,
          payments,
          concept: d.concept || 'Consumo',
          summary,
        };
      });

      const totalPending = enrichedDebts
        .filter((d) => d.status === 'pending' || d.status === 'partial')
        .reduce((sum, d) => sum + Number(d.balance || 0), 0);

      set({ debts: enrichedDebts, totalPending, loading: false });
      return enrichedDebts;
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
        .is('deleted_at', null)
        .order('paid_at', { ascending: false });

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
      .channel(`debts_realtime_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'debts',
        },
        () => {
          get().fetchMyDebts(userId);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'debt_items',
        },
        () => {
          get().fetchMyDebts(userId);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'debt_payments',
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
