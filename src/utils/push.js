// Helpers de Web Push (cliente).
// Toda la interaccion con el Service Worker y la API de Push vive aqui.

export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function getPermissionState() {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

export async function getExistingSubscription() {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export async function requestPermissionAndSubscribe(vapidPublicKey) {
  if (!isPushSupported()) {
    throw new Error('Push no soportado en este navegador');
  }
  if (!vapidPublicKey) {
    throw new Error('Falta VITE_VAPID_PUBLIC_KEY');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    const err = new Error(permission === 'denied' ? 'Permiso denegado' : 'Permiso no concedido');
    err.permission = permission;
    throw err;
  }

  const reg = await navigator.serviceWorker.ready;
  let subscription = await reg.pushManager.getSubscription();
  if (!subscription) {
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }
  return subscription;
}

export async function unsubscribeBrowser() {
  if (!isPushSupported()) return false;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return true;
  return sub.unsubscribe();
}

export function subscriptionToRow(subscription) {
  const json = subscription.toJSON ? subscription.toJSON() : subscription;
  return {
    endpoint: json.endpoint,
    p256dh: json.keys?.p256dh,
    auth: json.keys?.auth,
  };
}
