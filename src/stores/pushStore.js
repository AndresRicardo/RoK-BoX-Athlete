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

// Inserta o actualiza una subscripcion. user_id lo rellena el trigger
// push_subscriptions_set_user_trigger desde auth.uid() (migracion 0018).
async function saveSubscription(sub) {
  const payload = { ...subscriptionToRow(sub), last_seen_at: new Date().toISOString() };
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

  const { error } = await supabase.from('push_subscriptions').insert(payload);
  if (error) throw error;
}

const usePushStore = create((set, get) => ({
  permission: 'default', // 'default' | 'granted' | 'denied' | 'unsupported'
  subscribed: false, // el navegador tiene una PushSubscription activa
  dbHasSubscription: false, // la DB tiene al menos una fila para este usuario
  loading: false,
  error: null,

  init: async (userId) => {
    if (!userId) {
      set({
        permission: 'default',
        subscribed: false,
        dbHasSubscription: false,
        error: null,
      });
      return;
    }
    if (!isPushSupported()) {
      set({ permission: 'unsupported', subscribed: false, dbHasSubscription: false });
      return;
    }
    const permission = getPermissionState();
    try {
      // 1. Preguntar a la DB si hay subscripcion registrada para este usuario
      const { data: dbSubs, error: dbErr } = await supabase
        .from('push_subscriptions')
        .select('id')
        .order('last_seen_at', { ascending: false })
        .limit(1);
      if (dbErr) throw dbErr;
      const dbHasSubscription = !!(dbSubs && dbSubs.length > 0);

      // 2. Preguntar al SW si tiene una subscripcion viva en este navegador
      const swSub = await getExistingSubscription();

      // Si la DB tiene la fila pero el SW la perdio (limpiar cache, cerrar
      // sesion largo tiempo, etc.), re-suscribimos con la clave VAPID.
      // Si el SW tiene la subscripcion pero la DB no, sincronizamos.
      let subscribed = !!swSub;
      if (swSub && !dbHasSubscription) {
        await saveSubscription(swSub);
      } else if (!swSub && dbHasSubscription) {
        const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
        try {
          await requestPermissionAndSubscribe(vapidKey);
          subscribed = true;
        } catch {
          // El usuario rechazo o el navegador fallo. Dejamos el estado
          // como dbHas=true y subscribed=false para que la UI muestre
          // "Reactivar" y el usuario lo intente manualmente.
        }
      }

      set({ permission, subscribed, dbHasSubscription, error: null });
    } catch (err) {
      set({
        permission,
        subscribed: false,
        dbHasSubscription: false,
        error: err.message,
      });
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
        dbHasSubscription: true,
        loading: false,
        error: null,
      });
    } catch (err) {
      const permission = getPermissionState();
      set({
        permission,
        subscribed: false,
        dbHasSubscription: get().dbHasSubscription,
        loading: false,
        error: err.message || 'No se pudo activar las notificaciones',
      });
    }
  },

  unsubscribe: async () => {
    set({ loading: true, error: null });
    try {
      // Borra la fila primero (para que el SW no se re-registre si la
      // subscripcion del navegador sigue viva). El filtro user_id lo
      // resuelve la RLS a partir del JWT; no hace falta mandarlo.
      const { data: rows } = await supabase
        .from('push_subscriptions')
        .select('endpoint');
      const endpoints = (rows || []).map((r) => r.endpoint);
      await unsubscribeBrowser();
      if (endpoints.length > 0) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .in('endpoint', endpoints);
      }
      set({
        subscribed: false,
        dbHasSubscription: false,
        loading: false,
        error: null,
      });
    } catch (err) {
      set({ loading: false, error: err.message || 'No se pudo desactivar' });
    }
  },

  reset: () => {
    set({
      permission: 'default',
      subscribed: false,
      dbHasSubscription: false,
      loading: false,
      error: null,
    });
  },
}));

export default usePushStore;
