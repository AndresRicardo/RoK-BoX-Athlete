import { create } from 'zustand';
import { supabase } from '../supabase/client';

export const useStaffStore = create((set, get) => ({
  athletes: [],
  searching: false,
  selectedAthlete: null,
  selectedAthleteDebts: [],
  selectedAthleteMembership: null,
  loadingDetails: false,
  overview: {
    totalPendingAmount: 0,
    debtorsCount: 0,
    overdueCount: 0,
    expiringSoonCount: 0,
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
        .from('athlete_directory')
        .select('*')
        .or(`display_name.ilike.%${cleanQuery}%,full_name.ilike.%${cleanQuery}%,document_id.ilike.%${cleanQuery}%`)
        .limit(20);

      if (error) throw error;
      set({ athletes: data || [], searching: false });
      return data || [];
    } catch (err) {
      console.error('Error searching athletes:', err);
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
          .select('*')
          .eq('user_id', athlete.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('memberships')
          .select('*')
          .or(`user_id.eq.${athlete.id},document_id.eq.${athlete.document_id || 'NONE'}`)
          .order('end_date', { ascending: false })
          .limit(1)
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

  addDebt: async ({ userId, concept, category, amount, notes, createdBy }) => {
    try {
      const numericAmount = Number(amount);
      const payload = {
        user_id: userId,
        concept,
        category: category || 'other',
        amount: numericAmount,
        balance: numericAmount,
        status: 'pending',
        notes: notes || null,
        created_by: createdBy,
      };

      const { data, error } = await supabase
        .from('debts')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      // Actualizar vista local si está seleccionado
      const currentSelected = get().selectedAthlete;
      if (currentSelected?.id === userId) {
        set((state) => ({
          selectedAthleteDebts: [data, ...state.selectedAthleteDebts],
        }));
      }

      return data;
    } catch (err) {
      console.error('Error adding debt:', err);
      throw err;
    }
  },

  addPayment: async ({ debtId, userId, amount, paymentMethod, notes, recordedBy }) => {
    try {
      const numericAmount = Number(amount);
      const payload = {
        debt_id: debtId,
        user_id: userId,
        amount: numericAmount,
        payment_method: paymentMethod || 'cash',
        notes: notes || null,
        recorded_by: recordedBy,
      };

      const { data, error } = await supabase
        .from('debt_payments')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      // Recargar detalles del atleta seleccionado para reflejar el balance actualizado
      const currentSelected = get().selectedAthlete;
      if (currentSelected?.id === userId) {
        await get().selectAthlete(currentSelected);
      }

      return data;
    } catch (err) {
      console.error('Error recording payment:', err);
      throw err;
    }
  },

  updateMembership: async ({ userId, documentId, planName, endDate, status, accessGranted }) => {
    try {
      const payload = {
        user_id: userId,
        document_id: documentId,
        plan_name: planName || 'Mensualidad Box',
        end_date: endDate,
        status: status || 'active',
        access_granted: accessGranted !== undefined ? accessGranted : true,
        last_synced_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('memberships')
        .upsert(payload)
        .select()
        .single();

      if (error) throw error;

      const currentSelected = get().selectedAthlete;
      if (currentSelected?.id === userId) {
        set({ selectedAthleteMembership: data });
      }

      return data;
    } catch (err) {
      console.error('Error updating membership:', err);
      throw err;
    }
  },

  fetchGymOverview: async () => {
    set({ loadingOverview: true });
    try {
      const [debtsRes, membershipsRes] = await Promise.all([
        supabase
          .from('debts')
          .select('balance, user_id, status')
          .in('status', ['pending', 'partial']),
        supabase
          .from('memberships')
          .select('status, end_date'),
      ]);

      const pendingDebts = debtsRes.data || [];
      const totalPendingAmount = pendingDebts.reduce((sum, d) => sum + Number(d.balance || 0), 0);
      const uniqueDebtors = new Set(pendingDebts.map((d) => d.user_id)).size;

      const now = new Date();
      let overdueCount = 0;
      let expiringSoonCount = 0;

      (membershipsRes.data || []).forEach((m) => {
        const end = new Date(m.end_date);
        const days = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (days < 0) overdueCount++;
        else if (days <= 3) expiringSoonCount++;
      });

      set({
        overview: {
          totalPendingAmount,
          debtorsCount: uniqueDebtors,
          overdueCount,
          expiringSoonCount,
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
    });
  },
}));

export default useStaffStore;
