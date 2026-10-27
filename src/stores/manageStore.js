import { create } from 'zustand';
import { supabase } from '../supabase/client';

// Datos de la pestaña Gestión (socios y coaches). Las reglas de permisos viven en
// la base (RLS y RPC); aquí solo se consulta y se llama a los RPC.

async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}

async function query(builder) {
  const { data, error } = await builder;
  if (error) throw new Error(error.message);
  return data || [];
}

// Agrupa filas hijas por una columna (ítems y abonos por deuda, etc.).
function groupBy(rows, key) {
  return rows.reduce((acc, row) => {
    (acc[row[key]] ||= []).push(row);
    return acc;
  }, {});
}

const useManageStore = create((set, get) => ({
  plans: [],
  partners: [],
  products: [],
  categories: [],
  myPartnerId: null,
  catalogsLoaded: false,

  members: [],
  membersLoaded: false,
  loadingMembers: false,

  // ---------------------------------------------------------------------
  // Catálogos
  // ---------------------------------------------------------------------
  loadCatalogs: async (force = false) => {
    if (get().catalogsLoaded && !force) return;
    const { data: { user } } = await supabase.auth.getUser();
    const [plans, partners, products, categories] = await Promise.all([
      query(supabase.from('membership_plans').select('*').order('sort_order').order('name')),
      // Mismo orden que el cuadre (calculate_settlement): fecha de creación y nombre.
      query(supabase.from('partners').select('*').order('created_at').order('name')),
      query(supabase.from('products').select('*').order('sort_order').order('name')),
      // Solo socios pueden leer categorías; a un coach le llega vacío.
      supabase.from('expense_categories').select('*').order('sort_order').order('name')
        .then(({ data }) => data || []),
    ]);
    set({
      plans,
      partners,
      products,
      categories,
      myPartnerId: partners.find((p) => p.user_id === user?.id)?.id || null,
      catalogsLoaded: true,
    });
  },

  // ---------------------------------------------------------------------
  // Miembros
  // ---------------------------------------------------------------------
  fetchMembers: async () => {
    set({ loadingMembers: true });
    try {
      const members = await query(
        supabase.from('membership_status').select('*').order('full_name'),
      );
      set({ members, membersLoaded: true });
      return members;
    } finally {
      set({ loadingMembers: false });
    }
  },

  fetchMemberDetail: async (memberId) => {
    const [statusRows, renewals, usages, debts, commands] = await Promise.all([
      query(supabase.from('membership_status').select('*').eq('member_id', memberId)),
      query(
        supabase.from('membership_renewals').select('*').eq('member_id', memberId)
          .order('created_at', { ascending: false }).limit(30),
      ),
      query(
        supabase.from('class_usages').select('*').eq('member_id', memberId)
          .order('used_at', { ascending: false }).limit(20),
      ),
      get().fetchDebts({ memberId }),
      query(
        supabase.from('access_commands').select('*').eq('member_id', memberId)
          .order('created_at', { ascending: false }).limit(5),
      ),
    ]);
    const member = await query(supabase.from('members').select('*').eq('id', memberId));
    return {
      status: statusRows[0] || null,
      member: member[0] || null,
      renewals,
      usages,
      debts,
      commands,
    };
  },

  saveMember: (fields) => rpc('upsert_member', {
    p_id: fields.id || null,
    p_full_name: fields.fullName,
    p_document_id: fields.documentId,
    p_phone: fields.phone,
    p_email: fields.email,
    p_notes: fields.notes,
  }),

  renewMembership: ({ memberId, planId, paymentMethod, partnerId, discount, discountReason, note }) =>
    rpc('renew_membership', {
      p_member_id: memberId,
      p_plan_id: planId,
      p_payment_method: paymentMethod,
      p_received_by_partner: partnerId || null,
      p_discount: discount || 0,
      p_discount_reason: discountReason || null,
      p_note: note || null,
    }),

  consumeClass: (memberId) => rpc('use_class', { p_member_id: memberId }),
  undoClassUsage: (usageId) => rpc('undo_class_usage', { p_usage_id: usageId }),
  setMemberAccess: (memberId, enabled) => rpc('set_member_access', { p_member_id: memberId, p_enabled: enabled }),
  setMembershipValidity: (memberId, validFrom, validUntil) => rpc('set_membership_validity', {
    p_member_id: memberId,
    p_valid_from: validFrom,
    p_valid_until: validUntil,
  }),
  voidRenewal: (renewalId, reason) => rpc('void_renewal', { p_renewal_id: renewalId, p_reason: reason }),
  completePendingRenewal: ({ renewalId, amount, paymentMethod, partnerId, planId, note }) =>
    rpc('complete_pending_renewal', {
      p_renewal_id: renewalId,
      p_amount: amount,
      p_payment_method: paymentMethod,
      p_received_by_partner: partnerId,
      p_plan_id: planId || null,
      p_note: note || null,
    }),

  // ---------------------------------------------------------------------
  // Deudas y ventas
  // ---------------------------------------------------------------------
  fetchDebts: async ({ memberId, statuses } = {}) => {
    let req = supabase.from('debt_summary').select('*').order('created_at', { ascending: false });
    if (memberId) req = req.eq('member_id', memberId);
    if (statuses?.length) req = req.in('status', statuses);
    const debts = await query(req.limit(300));
    const ids = debts.map((d) => d.id);
    if (ids.length === 0) return [];

    const [items, payments] = await Promise.all([
      query(supabase.from('debt_items').select('*').in('debt_id', ids).is('deleted_at', null).order('created_at')),
      query(supabase.from('debt_payments').select('*').in('debt_id', ids).is('deleted_at', null)
        .order('paid_at', { ascending: false })),
    ]);
    const itemsByDebt = groupBy(items, 'debt_id');
    const paymentsByDebt = groupBy(payments, 'debt_id');
    return debts.map((d) => ({
      ...d,
      items: itemsByDebt[d.id] || [],
      payments: paymentsByDebt[d.id] || [],
    }));
  },

  createDebt: ({ memberId, concept, items }) => rpc('create_debt', {
    p_member_id: memberId,
    p_concept: concept || null,
    p_items: items,
  }),

  addDebtPayment: async ({ debtId, amount, paymentMethod, partnerId, note }) => query(
    supabase.from('debt_payments').insert({
      debt_id: debtId,
      amount,
      payment_method: paymentMethod,
      received_by_partner: partnerId,
      note: note || null,
    }).select(),
  ),

  deleteDebtPayment: (paymentId) => query(
    supabase.from('debt_payments').update({ deleted_at: new Date().toISOString() }).eq('id', paymentId).select(),
  ),

  setItemDelivery: (itemId, deliveryStatus) => query(
    supabase.from('debt_items').update({ delivery_status: deliveryStatus }).eq('id', itemId).select(),
  ),

  voidDebt: (debtId, reason) => rpc('void_debt', { p_debt_id: debtId, p_reason: reason }),

  registerSale: ({ productId, quantity, paymentMethod, partnerId, unitPrice, note }) => rpc('register_sale', {
    p_product_id: productId,
    p_quantity: quantity,
    p_payment_method: paymentMethod,
    p_received_by_partner: partnerId,
    p_unit_price: unitPrice ?? null,
    p_note: note || null,
  }),

  // ---------------------------------------------------------------------
  // Recordatorios de deuda por WhatsApp (D41)
  // ---------------------------------------------------------------------
  // Miembros con saldo, con su último recordatorio y quién lo envió.
  fetchDebtors: async ({ memberId } = {}) => {
    let req = supabase.from('debtor_summary').select('*').order('balance', { ascending: false });
    if (memberId) req = req.eq('member_id', memberId);
    const rows = await query(req);
    const senderIds = [...new Set(rows.map((r) => r.last_reminder_by).filter(Boolean))];
    const senders = senderIds.length
      ? await query(supabase.from('athlete_directory').select('id, full_name, display_name').in('id', senderIds))
      : [];
    const senderById = Object.fromEntries(senders.map((s) => [s.id, s]));
    return rows.map((r) => ({ ...r, lastReminderByName: senderById[r.last_reminder_by]?.full_name || null }));
  },

  // Plantilla del box; null = usar la plantilla por defecto.
  fetchReminderTemplate: async () => {
    const rows = await query(
      supabase.from('app_settings').select('value').eq('key', 'debt_reminder_template'),
    );
    return rows[0]?.value || null;
  },

  saveReminderTemplate: (value) => (value
    ? query(supabase.from('app_settings').upsert({ key: 'debt_reminder_template', value }).select())
    : query(supabase.from('app_settings').delete().eq('key', 'debt_reminder_template').select())),

  logDebtReminder: (memberId) => rpc('log_debt_reminder', { p_member_id: memberId }),

  // ---------------------------------------------------------------------
  // Pendientes
  // ---------------------------------------------------------------------
  fetchPending: async ({ isPartner }) => {
    const [renewals, links, failed] = await Promise.all([
      isPartner
        ? query(
            supabase.from('membership_renewals').select('*, members(full_name, document_id)')
              .eq('payment_status', 'pending').is('voided_at', null).order('created_at', { ascending: false }),
          )
        : [],
      query(
        supabase.from('member_link_requests').select('*').eq('status', 'pending').order('created_at'),
      ),
      isPartner
        ? query(
            supabase.from('access_commands').select('*, members(full_name)')
              .eq('status', 'failed').order('created_at', { ascending: false }).limit(20),
          )
        : [],
    ]);

    // Nombre y cuenta de quien pide el vínculo, y si ya existe un miembro con esa cédula.
    const profileIds = [...new Set(links.map((l) => l.profile_id))];
    const docs = [...new Set(links.map((l) => l.document_id))];
    const [profiles, membersByDoc] = await Promise.all([
      profileIds.length
        ? query(supabase.from('athlete_directory').select('id, full_name, display_name, avatar_url').in('id', profileIds))
        : [],
      docs.length
        ? query(supabase.from('members').select('id, full_name, document_id, profile_id').in('document_id', docs))
        : [],
    ]);
    const profileById = Object.fromEntries(profiles.map((p) => [p.id, p]));
    const memberByDoc = Object.fromEntries(membersByDoc.map((m) => [m.document_id, m]));

    return {
      renewals,
      links: links.map((l) => ({ ...l, profile: profileById[l.profile_id], member: memberByDoc[l.document_id] })),
      failed,
    };
  },

  reviewLink: (requestId, approve, note) => rpc('review_member_link', {
    p_request_id: requestId,
    p_approve: approve,
    p_note: note || null,
  }),

  // Resumen del inicio de Gestión.
  fetchOverview: async ({ isPartner }) => {
    const [members, debts, pending, bridge] = await Promise.all([
      get().fetchMembers(),
      query(supabase.from('debt_summary').select('balance').in('status', ['pending', 'partial'])),
      get().fetchPending({ isPartner }),
      query(supabase.from('bridge_status').select('*').limit(1)),
    ]);
    const count = (status) => members.filter((m) => m.is_active && m.status === status).length;
    return {
      expiringSoon: count('expiring_soon'),
      overdue: count('overdue'),
      noClasses: count('no_classes'),
      debtTotal: debts.reduce((sum, d) => sum + Number(d.balance || 0), 0),
      debtorsCount: debts.length,
      pendingCount: pending.renewals.length + pending.links.length + pending.failed.length,
      bridge: bridge[0] || null,
    };
  },

  // ---------------------------------------------------------------------
  // Ajustes (solo socios; la RLS lo hace cumplir)
  // ---------------------------------------------------------------------
  saveRow: async (table, row) => {
    const { id, ...fields } = row;
    const req = id
      ? supabase.from(table).update(fields).eq('id', id).select()
      : supabase.from(table).insert(fields).select();
    const data = await query(req);
    await get().loadCatalogs(true);
    return data[0];
  },

  fetchRoles: async () => {
    const [roles, invites] = await Promise.all([
      query(supabase.from('user_roles').select('*').order('created_at')),
      query(supabase.from('role_invites').select('*').order('created_at', { ascending: false })),
    ]);
    const ids = [...new Set(roles.map((r) => r.user_id))];
    const profiles = ids.length
      ? await query(supabase.from('athlete_directory').select('id, full_name, display_name, avatar_url').in('id', ids))
      : [];
    const profileById = Object.fromEntries(profiles.map((p) => [p.id, p]));
    // Quien aún no crea su perfil se identifica por el email de la invitación que aceptó.
    const emailByUser = Object.fromEntries(invites.filter((i) => i.claimed_by).map((i) => [i.claimed_by, i.email]));
    const users = Object.entries(groupBy(roles, 'user_id')).map(([userId, rows]) => ({
      userId,
      profile: profileById[userId] || null,
      email: emailByUser[userId] || null,
      roles: rows.map((r) => r.role),
    }));
    return { users, invites };
  },

  setUserRole: (userId, role, grant) => rpc('set_user_role', { p_user_id: userId, p_role: role, p_grant: grant }),

  saveInvite: (invite) => query(
    supabase.from('role_invites').upsert({
      email: invite.email.trim().toLowerCase(),
      roles: invite.roles,
      partner_id: invite.partnerId || null,
    }).select(),
  ),

  deleteInvite: (email) => query(supabase.from('role_invites').delete().eq('email', email).select()),

  searchUsers: async (text) => {
    const q = text.replace(/[%_,()"]/g, ' ').trim();
    if (q.length < 2) return [];
    return query(
      supabase.from('athlete_directory').select('id, full_name, display_name, avatar_url')
        .or(`full_name.ilike.%${q}%,display_name.ilike.%${q}%`).limit(10),
    );
  },

  fetchBridge: async () => {
    const [status, commands] = await Promise.all([
      query(supabase.from('bridge_status').select('*').limit(1)),
      query(
        supabase.from('access_commands').select('*, members(full_name)')
          .order('created_at', { ascending: false }).limit(25),
      ),
    ]);
    return { status: status[0] || null, commands };
  },

  fetchAudit: async ({ table, limit = 60 } = {}) => {
    let req = supabase.from('audit_log').select('*').order('changed_at', { ascending: false }).limit(limit);
    if (table) req = req.eq('table_name', table);
    const rows = await query(req);
    const actorIds = [...new Set(rows.map((r) => r.actor).filter(Boolean))];
    const actors = actorIds.length
      ? await query(supabase.from('athlete_directory').select('id, full_name, display_name').in('id', actorIds))
      : [];
    const actorById = Object.fromEntries(actors.map((a) => [a.id, a]));
    return rows.map((r) => ({ ...r, actorProfile: actorById[r.actor] || null }));
  },

  reset: () => set({
    plans: [],
    partners: [],
    products: [],
    categories: [],
    myPartnerId: null,
    catalogsLoaded: false,
    members: [],
    membersLoaded: false,
  }),
}));

export default useManageStore;
