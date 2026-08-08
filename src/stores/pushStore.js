import { create } from 'zustand';
import { supabase } from '../supabase/client';
import {
  isPushSupported,
  getPermissionState,
  getExistingSubscription,
  requestPermissionAndSubscribe,
  unsubscribeBrowser,
  subscriptionToRow,
} from '../utils/push';

// Inserta o actualiza una subscripcion sin disparar el path "upsert" de
// PostgREST, que confunde a RLS cuando la policy de UPDATE no estaba
// originalmente creada. Ahora que existe (migracion 0019) ya no seria
// necesario, pero el split explicito es mas robusto y legible.
async function saveSubscription(sub) {
  const payload = { ...subscriptionToRow(sub), last_seen_at: new Date().toISOString() };
  // Busca si ya existe una fila con este endpoint (RLS la limita al user).
  const { data: existing, error: selErr } = await supabase
    .from('push_subscriptions')
    .select('id')
    .eq('endpoint', payload.endpoint)
    .maybeSingle();
  if (selErr) throw selErr;

  if (existing) {
    const { error } = await supabase
      .from('push_subscriptions')
      .update({ last_seen_at: payload.last_seen_at })
      .eq('id', existing.id);
    if (error) throw error;
    return;
  }

  // user_id lo rellena el trigger push_subscriptions_set_user_trigger
  // desde auth.uid() (migracion 0018).
  const { error } = await supabase.from('push_subscriptions').insert(payload);
  if (error) throw error;
}

const usePushStore = create((set) => ({
  permission: 'default', // 'default' | 'granted' | 'denied' | 'unsupported'
  subscribed: false,
  loading: false,
  error: null,

  init: async (userId) => {
    if (!userId) {
      set({ permission: 'default', subscribed: false, error: null });
      return;
    }
    if (!isPushSupported()) {
      set({ permission: 'unsupported', subscribed: false });
      return;
    }
    const permission = getPermissionState();
    try {
      const sub = await getExistingSubscription();
      if (sub) {
        // Asegura que la fila exista en push_subscriptions (puede haberse
        // perdido si la app se desinstalo o se limpio el storage local).
        await saveSubscription(sub);
        set({ permission, subscribed: true, error: null });
      } else {
        set({ permission, subscribed: false, error: null });
      }
    } catch (err) {
      set({ permission, subscribed: false, error: err.message });
    }
  },

  subscribe: async (userId) => {
    if (!userId) return;
    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    set({ loading: true, error: null });
    try {
      const sub = await requestPermissionAndSubscribe(vapidKey);
      await saveSubscription(sub);
      set({
        permission: 'granted',
        subscribed: true,
        loading: false,
        error: null,
      });
    } catch (err) {
      const permission = getPermissionState();
      set({
        permission,
        subscribed: false,
        loading: false,
        error: err.message || 'No se pudo activar las notificaciones',
      });
    }
  },

  unsubscribe: async (userId) => {
    set({ loading: true, error: null });
    try {
      // Borra la fila primero (para que el SW no se re-registre si la
      // subscripcion del navegador sigue viva). El filtro user_id lo
      // resuelve la RLS a partir del JWT; no hace falta mandarlo.
      if (userId) {
        const { data: rows } = await supabase
          .from('push_subscriptions')
          .select('endpoint')
          .eq('user_id', userId);
        const endpoints = (rows || []).map((r) => r.endpoint);
        await unsubscribeBrowser();
        if (endpoints.length > 0) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .in('endpoint', endpoints);
        }
      } else {
        await unsubscribeBrowser();
      }
      set({ subscribed: false, loading: false, error: null });
    } catch (err) {
      set({ loading: false, error: err.message || 'No se pudo desactivar' });
    }
  },

  reset: () => {
    set({ permission: 'default', subscribed: false, loading: false, error: null });
  },
}));

export default usePushStore;
