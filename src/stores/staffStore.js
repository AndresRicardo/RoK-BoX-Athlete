import { create } from 'zustand';
import { supabase } from '../supabase/client';

export const useStaffStore = create((set, get) => ({
  athletes: [],
  searching: false,
  selectedAthlete: null,
  selectedAthleteDebts: [],
  selectedAthleteMembership: null,
  loadingDetails: false,
  pendingLinkRequests: [],
  loadingRequests: false,
  overview: {
    totalPendingAmount: 0,
    debtorsCount: 0,
    overdueCount: 0,
    expiringSoonCount: 0,
    pendingRequestsCount: 0,
  },
  loadingOverview: false,

  searchAthletes: async (queryText) => {
    if (!queryText || queryText.trim().length === 0) {
      set({ athletes: [] });
      return [];
    }

    set({ searching: true });
    const cleanQuery = queryText.trim().toLowerCase();

    try {
      const { data, error } = await supabase
        .from('members')
        .select(`
          id,
          full_name,
          document_id,
          phone,
          is_active,
          profile_id,
          profiles:profile_id (
            display_name,
            avatar_url
          )
        `)
        .or(`full_name.ilike.%${cleanQuery}%,document_id.ilike.%${cleanQuery}%`)
        .limit(20);

      if (error) throw error;
      set({ athletes: data || [], searching: false });
      return data || [];
    } catch (err) {
      console.error('Error searching athletes/members:', err);
      set({ searching: false });
      return [];
    }
  },

  selectAthlete: async (athlete) => {
    if (!athlete) {
      set({
        selectedAthlete: null,
        selectedAthleteDebts: [],
        selectedAthleteMembership: null,
      });
      return;
    }

    set({ selectedAthlete: athlete, loadingDetails: true });

    try {
      const [debtsRes, membershipRes] = await Promise.all([
        supabase
          .from('debts')
          .select(`
            *,
            debt_items (*),
            debt_payments (*)
          `)
          .eq('member_id', athlete.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
        supabase
          .from('membership_status')
          .select('*')
          .eq('member_id', athlete.id)
          .maybeSingle(),
      ]);

      set({
        selectedAthleteDebts: debtsRes.data || [],
        selectedAthleteMembership: membershipRes.data || null,
        loadingDetails: false,
      });
    } catch (err) {
      console.error('Error loading athlete details:', err);
      set({ loadingDetails: false });
    }
  },

  addDebt: async ({ memberId, concept, amount, notes, createdBy }) => {
    try {
      const numericAmount = Math.round(Number(amount));

      // 1. Insertar cabecera de deuda v2
      const { data: debt, error: debtErr } = await supabase
        .from('debts')
        .insert({
          member_id: memberId,
          notes: notes || concept,
          delivery_status: 'ENTREGADO',
          created_by: createdBy,
        })
        .select()
        .single();

      if (debtErr) throw debtErr;

      // 2. Insertar ítem de deuda
      const { error: itemErr } = await supabase
        .from('debt_items')
        .insert({
          debt_id: debt.id,
          item_name: concept,
          quantity: 1,
          unit_price: numericAmount,
          delivered_by: 'Coach',
        });

      if (itemErr) throw itemErr;

      // Recargar detalles del miembro
      const currentSelected = get().selectedAthlete;
      if (currentSelected?.id === memberId) {
        await get().selectAthlete(currentSelected);
      }

      return debt;
    } catch (err) {
      console.error('Error adding debt:', err);
      throw err;
    }
  },

  addPayment: async ({ debtId, memberId, amount, paymentMethod, notes, recordedBy }) => {
    try {
      const numericAmount = Math.round(Number(amount));

      const { data, error } = await supabase
        .from('debt_payments')
        .insert({
          debt_id: debtId,
          amount: numericAmount,
          payment_method: paymentMethod || 'cash',
          note: notes || null,
          recorded_by: recordedBy,
        })
        .select()
        .single();

      if (error) throw error;

      // Recargar detalles para reflejar recálculo automático de saldos
      const currentSelected = get().selectedAthlete;
      if (currentSelected?.id === memberId) {
        await get().selectAthlete(currentSelected);
      }

      return data;
    } catch (err) {
      console.error('Error recording payment:', err);
      throw err;
    }
  },

  renewMembership: async ({ memberId, planName, periodStart, periodEnd, amount, paymentMethod }) => {
    try {
      const { data, error } = await supabase.rpc('renew_membership', {
        p_member_id: memberId,
        p_plan_name: planName || 'Mensualidad Box',
        p_period_start: periodStart || new Date().toISOString(),
        p_period_end: periodEnd,
        p_amount: Math.round(Number(amount || 0)),
        p_payment_method: paymentMethod || 'cash',
      });

      if (error) throw error;

      const currentSelected = get().selectedAthlete;
      if (currentSelected?.id === memberId) {
        await get().selectAthlete(currentSelected);
      }

      await get().fetchGymOverview();
      return data;
    } catch (err) {
      console.error('Error renewing membership:', err);
      throw err;
    }
  },

  fetchPendingLinkRequests: async () => {
    set({ loadingRequests: true });
    try {
      const { data, error } = await supabase
        .from('member_link_requests')
        .select(`
          id,
          profile_id,
          document_id,
          status,
          created_at,
          profiles:profile_id (
            display_name,
            first_name,
            last_name,
            avatar_url
          )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      set({ pendingLinkRequests: data || [], loadingRequests: false });
      return data || [];
    } catch (err) {
      console.error('Error fetching pending link requests:', err);
      set({ loadingRequests: false });
      return [];
    }
  },

  reviewLinkRequest: async (requestId, approve) => {
    try {
      const { data, error } = await supabase.rpc('review_member_link', {
        p_request_id: requestId,
        p_approve: approve,
      });

      if (error) throw error;

      await Promise.all([
        get().fetchPendingLinkRequests(),
        get().fetchGymOverview(),
      ]);

      return data;
    } catch (err) {
      console.error('Error reviewing link request:', err);
      throw err;
    }
  },

  fetchGymOverview: async () => {
    set({ loadingOverview: true });
    try {
      const [debtsRes, membershipsRes, requestsRes] = await Promise.all([
        supabase
          .from('debts')
          .select('balance, member_id')
          .is('deleted_at', null)
          .gt('balance', 0),
        supabase
          .from('membership_status')
          .select('status, days_left'),
        supabase
          .from('member_link_requests')
          .select('id')
          .eq('status', 'pending'),
      ]);

      const pendingDebts = debtsRes.data || [];
      const totalPendingAmount = pendingDebts.reduce((sum, d) => sum + Number(d.balance || 0), 0);
      const uniqueDebtors = new Set(pendingDebts.map((d) => d.member_id)).size;

      let overdueCount = 0;
      let expiringSoonCount = 0;

      (membershipsRes.data || []).forEach((m) => {
        if (m.status === 'overdue') overdueCount++;
        else if (m.status === 'expiring_soon') expiringSoonCount++;
      });

      set({
        overview: {
          totalPendingAmount,
          debtorsCount: uniqueDebtors,
          overdueCount,
          expiringSoonCount,
          pendingRequestsCount: requestsRes.data?.length || 0,
        },
        loadingOverview: false,
      });
    } catch (err) {
      console.error('Error fetching gym overview:', err);
      set({ loadingOverview: false });
    }
  },

  reset: () => {
    set({
      athletes: [],
      searching: false,
      selectedAthlete: null,
      selectedAthleteDebts: [],
      selectedAthleteMembership: null,
      loadingDetails: false,
      loadingOverview: false,
      pendingLinkRequests: [],
      loadingRequests: false,
    });
  },
}));

export default useStaffStore;
