import { create } from 'zustand';
import { supabase } from '../supabase/client';
import { bogotaDayStart, bogotaDayEnd } from '../utils/dates';

// Caja y cuadres: solo socios (la RLS lo hace cumplir).

async function query(builder) {
  const { data, error } = await builder;
  if (error) throw new Error(error.message);
  return data || [];
}

async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}

const softDelete = (table, id) => query(
  supabase.from(table).update({ deleted_at: new Date().toISOString() }).eq('id', id).select(),
);

const upsert = (table, row) => {
  const { id, ...fields } = row;
  return query(
    id
      ? supabase.from(table).update(fields).eq('id', id).select()
      : supabase.from(table).insert(fields).select(),
  );
};

/**
 * Totales de caja de un socio, con la misma fórmula del cuadre (calculate_settlement):
 * esperado = ingresos − gastos BOX − gastos personales − entregado + recibido.
 * Los pagos de cuadres (settlement_id) no cuentan como movimiento de caja.
 */
export function cashTotals({ incomes, expenses, transfers }, partnerId) {
  const sum = (rows) => rows.reduce((acc, r) => acc + Number(r.amount || 0), 0);
  const income = sum(incomes.filter((i) => i.partner_id === partnerId));
  const box = sum(expenses.filter((e) => e.partner_id === partnerId && e.scope === 'BOX'));
  const personal = sum(expenses.filter((e) => e.partner_id === partnerId && e.scope === 'PERSONAL'));
  const cashTransfers = transfers.filter((t) => !t.settlement_id);
  const given = sum(cashTransfers.filter((t) => t.from_partner === partnerId));
  const received = sum(cashTransfers.filter((t) => t.to_partner === partnerId));
  return { income, box, personal, given, received, expected: income - box - personal - given + received };
}

const useFinanceStore = create(() => ({
  // Movimientos de todos los socios en el rango [start, end] (fechas de Bogotá).
  fetchMovements: async (start, end) => {
    const from = bogotaDayStart(start);
    const to = bogotaDayEnd(end);
    const [incomes, expenses, transfers] = await Promise.all([
      query(
        supabase.from('incomes').select('*').is('deleted_at', null)
          .gte('received_at', from).lt('received_at', to).order('received_at', { ascending: false }),
      ),
      query(
        supabase.from('expenses').select('*').is('deleted_at', null)
          .gte('spent_at', from).lt('spent_at', to).order('spent_at', { ascending: false }),
      ),
      query(
        supabase.from('partner_transfers').select('*').is('deleted_at', null)
          .gte('transferred_at', from).lt('transferred_at', to).order('transferred_at', { ascending: false }),
      ),
    ]);
    return { incomes, expenses, transfers };
  },

  saveExpense: (row) => upsert('expenses', row),
  deleteExpense: (id) => softDelete('expenses', id),
  saveIncome: (row) => upsert('incomes', row),
  deleteIncome: (id) => softDelete('incomes', id),
  saveTransfer: (row) => upsert('partner_transfers', row),
  deleteTransfer: (id) => softDelete('partner_transfers', id),

  // ---------------------------------------------------------------------
  // Cuadres
  // ---------------------------------------------------------------------
  fetchSettlements: () => query(
    supabase.from('settlement_list').select('*').is('deleted_at', null).order('period_end', { ascending: false }),
  ),

  calculateSettlement: ({ start, end, reserve, declaredCash }) => rpc('calculate_settlement', {
    p_start: start,
    p_end: end,
    p_reserve_fund: reserve || 0,
    p_declared_cash: declaredCash || {},
  }),

  saveSettlement: ({ title, start, end, reserve, declaredCash, notes }) => rpc('save_settlement', {
    p_title: title || null,
    p_start: start,
    p_end: end,
    p_reserve_fund: reserve || 0,
    p_declared_cash: declaredCash || {},
    p_notes: notes || null,
  }),

  // Cuadre manual (D42): manual = { [partnerId]: { income_collected, box_expenses_paid,
  // personal_expenses, transfers_given, transfers_received, declared_cash? } }.
  calculateManualSettlement: ({ start, end, reserve, manual }) => rpc('calculate_manual_settlement', {
    p_start: start,
    p_end: end,
    p_reserve_fund: reserve || 0,
    p_partners: manual || {},
  }),

  saveManualSettlement: ({ title, start, end, reserve, manual, notes }) => rpc('save_manual_settlement', {
    p_title: title || null,
    p_start: start,
    p_end: end,
    p_reserve_fund: reserve || 0,
    p_partners: manual || {},
    p_notes: notes || null,
  }),

  setTransferPaid: (settlementId, index, paid) => rpc('set_settlement_transfer_paid', {
    p_settlement_id: settlementId,
    p_index: index,
    p_paid: paid,
  }),

  deleteSettlement: (settlementId) => rpc('delete_settlement', { p_settlement_id: settlementId }),
}));

export default useFinanceStore;
