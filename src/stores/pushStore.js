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
        const { error } = await supabase.from('push_subscriptions').upsert(
          { user_id: userId, ...subscriptionToRow(sub), last_seen_at: new Date().toISOString() },
          { onConflict: 'user_id,endpoint' },
        );
        if (error) throw error;
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
      const { error } = await supabase.from('push_subscriptions').upsert(
        { user_id: userId, ...subscriptionToRow(sub), last_seen_at: new Date().toISOString() },
        { onConflict: 'user_id,endpoint' },
      );
      if (error) throw error;
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
      // subscripcion del navegador sigue viva).
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
            .eq('user_id', userId)
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
