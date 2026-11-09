import { create } from 'zustand';
import { supabase } from '../supabase/client';

// Comunicados del box (D49). Los socios y coaches los publican desde Gestión; todos los ven
// en Inicio y en /announcements mientras estén vigentes. Permisos y envío viven en la base
// (0030_announcements): RLS, save_announcement, delete_announcement y el cron.

export const ANNOUNCEMENT_KINDS = {
  notice: { label: 'Aviso', emoji: '📢' },
  event: { label: 'Evento', emoji: '🎉' },
  schedule: { label: 'Cambio de horario', emoji: '🗓️' },
};

export const ANNOUNCEMENT_AUDIENCES = {
  all: 'Todos los usuarios',
  active_members: 'Solo membresías al día',
};

async function check(builder) {
  const { data, error } = await builder;
  if (error) throw new Error(error.message);
  return data;
}

const seenThisSession = new Set();

const useAnnouncementStore = create((set, get) => ({
  active: [],
  activeLoaded: false,
  adminList: [],

  // Vigentes para el usuario (la RLS filtra la audiencia; a socios y coaches les devuelve
  // también programados, vencidos y borrados, por eso se filtra aquí).
  fetchActive: async () => {
    const rows = await check(
      supabase
        .from('announcements')
        .select('id, kind, title, body, event_at, visible_until, published_at')
        .is('deleted_at', null)
        .not('published_at', 'is', null)
        .gt('visible_until', new Date().toISOString())
        .order('published_at', { ascending: false }),
    );
    set({ active: rows || [], activeLoaded: true });
    return rows || [];
  },

  // Cuenta "visto por" una sola vez por sesión y comunicado.
  markSeen: async (ids) => {
    const fresh = (ids || []).filter((id) => !seenThisSession.has(id));
    if (fresh.length === 0) return;
    fresh.forEach((id) => seenThisSession.add(id));
    const { error } = await supabase.rpc('mark_announcements_seen', { p_ids: fresh });
    if (error) fresh.forEach((id) => seenThisSession.delete(id));
  },

  // Gestión: todos, con autor, estado y vistos.
  fetchAdminList: async () => {
    const rows = await check(
      supabase
        .from('announcement_list')
        .select('*')
        .neq('status', 'deleted')
        .order('created_at', { ascending: false })
        .limit(100),
    );
    set({ adminList: rows || [] });
    return rows || [];
  },

  save: async (form) => {
    const row = await check(supabase.rpc('save_announcement', {
      p_id: form.id || null,
      p_kind: form.kind,
      p_title: form.title,
      p_body: form.body,
      p_event_at: form.eventAt || null,
      p_visible_until: form.visibleUntil || null,
      p_audience: form.audience,
      p_publish_at: form.publishAt || null,
      p_notify: form.notify,
      p_remind: Boolean(form.eventAt) && form.remind,
    }));
    await Promise.all([get().fetchAdminList(), get().fetchActive()]);
    return row;
  },

  remove: async (id) => {
    await check(supabase.rpc('delete_announcement', { p_id: id }));
    await Promise.all([get().fetchAdminList(), get().fetchActive()]);
  },
}));

export default useAnnouncementStore;
