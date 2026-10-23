import { supabase } from '../supabase/client';

// Web Push desde la PWA (F5). El envío lo hace la Edge Function send-push.

// Clave pública VAPID (no es secreta). La privada vive solo en los secretos de la función.
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY
  || 'BHbsQN1dMOrI9IV2AoGpDwKfcY9aE4VO2kS09fOk9qNOJmJyEDpc7sXoIrGeLY-Icwnce_X9WEiovtmgqoC3nYM';

export function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
}

/**
 * 'supported' | 'ios-install' (iPhone fuera de la app instalada) | 'unsupported'.
 * En iPhone el push solo existe con iOS 16.4+ y la app agregada a la pantalla de inicio.
 */
export function pushSupport() {
  const hasApis = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (hasApis) return 'supported';
  return isIos() && !isStandalone() ? 'ios-install' : 'unsupported';
}

export function pushPermission() {
  return 'Notification' in window ? Notification.permission : 'denied';
}

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

// El service worker solo existe en el build (no en `npm run dev`): no esperar para siempre.
async function getRegistration(timeoutMs = 4000) {
  if (!('serviceWorker' in navigator)) return null;
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
}

export async function getCurrentSubscription() {
  const reg = await getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

async function saveSubscription(subscription) {
  const json = subscription.toJSON();
  const { error } = await supabase.rpc('register_push_subscription', {
    p_endpoint: json.endpoint,
    p_p256dh: json.keys?.p256dh,
    p_auth: json.keys?.auth,
    p_user_agent: navigator.userAgent,
  });
  if (error) throw new Error(error.message);
}

/** Pide permiso, suscribe este dispositivo y lo registra para el usuario actual. */
export async function enablePush() {
  if (pushSupport() !== 'supported') throw new Error('Este navegador no permite notificaciones push.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(permission === 'denied'
      ? 'Las notificaciones están bloqueadas para esta app. Actívalas en los ajustes del teléfono o del navegador.'
      : 'No se dio permiso para las notificaciones.');
  }
  const reg = await getRegistration();
  if (!reg) throw new Error('La app aún no terminó de instalarse. Recarga la página e intenta de nuevo.');
  const subscription = await reg.pushManager.getSubscription()
    || await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  await saveSubscription(subscription);
  return subscription;
}

/** Deja de recibir push en este dispositivo. */
export async function disablePush() {
  const subscription = await getCurrentSubscription();
  if (!subscription) return;
  await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
  await subscription.unsubscribe();
}

/**
 * Al abrir la app: si el dispositivo ya tiene permiso y suscripción, la vuelve a registrar
 * a nombre del usuario actual (por si cambió de cuenta en el mismo teléfono).
 */
export async function syncPushSubscription() {
  try {
    if (pushSupport() !== 'supported' || pushPermission() !== 'granted') return;
    const subscription = await getCurrentSubscription();
    if (subscription) await saveSubscription(subscription);
  } catch (err) {
    console.warn('No se pudo sincronizar la suscripción push:', err);
  }
}

/** Al cerrar sesión: el dispositivo deja de recibir los avisos de esa cuenta. */
export async function forgetPushSubscription() {
  try {
    const subscription = await getCurrentSubscription();
    if (subscription) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
    }
  } catch (err) {
    console.warn('No se pudo quitar la suscripción push:', err);
  }
}

// ---------------------------------------------------------------------
// Preferencias por tipo de aviso (notification_preferences.disabled_types)
// ---------------------------------------------------------------------
export async function fetchDisabledTypes(userId) {
  const { data, error } = await supabase
    .from('notification_preferences').select('disabled_types').eq('user_id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.disabled_types || [];
}

export async function saveDisabledTypes(userId, disabledTypes) {
  const { error } = await supabase.from('notification_preferences').upsert({
    user_id: userId,
    disabled_types: disabledTypes,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}
