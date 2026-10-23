// Edge Function: send-push (F5, D18)
//
// La llama la base (pg_net, trigger de public.notifications y cron de respaldo; ver
// 0023_push_dispatch.sql) con el encabezado x-dispatch-secret. Reclama lotes de avisos
// pendientes con claim_push_batch() y envía cada uno como Web Push a las suscripciones
// del destinatario. Las suscripciones vencidas (404/410) se borran.
//
// Secretos (supabase secrets set ...; nunca en git):
//   PUSH_DISPATCH_SECRET  mismo valor que el secreto push_dispatch_secret de Vault
//   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT
//   SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los pone Supabase.
//
// Desplegar sin verificación de JWT (la autenticación es el secreto compartido):
//   supabase functions deploy send-push --no-verify-jwt --use-api

import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const DISPATCH_SECRET = Deno.env.get('PUSH_DISPATCH_SECRET') ?? '';
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:soporte@rokbox.co';

const BATCH_SIZE = 100;
const MAX_BATCHES = 5;
const PUSH_TTL_SECONDS = 60 * 60 * 24;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Notification = {
  id: string;
  recipient_id: string;
  type: string;
  title: string | null;
  body: string | null;
  link: string | null;
  actor_id: string | null;
  actor_handle: string | null;
  event_type: string | null;
  event_payload: Record<string, string> | null;
  comment_body: string | null;
};

type Subscription = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string };

// Texto de los avisos sociales (0012), igual que en la campana de la app.
function socialText(n: Notification): string {
  const p = n.event_payload || {};
  switch (n.type) {
    case 'like':
      if (n.event_type === 'pr') return `le dio ❤️ a tu ${p.movement || 'PR'}`;
      if (n.event_type === 'benchmark') return `le dio ❤️ a tu ${p.name || 'WOD'}`;
      if (n.event_type === 'achievement') return 'le dio ❤️ a tu logro';
      if (n.event_type === 'skill') return `le dio ❤️ a tu ${p.movement || 'skill'}`;
      return 'le dio ❤️ a tu actividad';
    case 'comment': {
      const body = (n.comment_body || '').trim();
      const snippet = body.length > 80 ? `${body.slice(0, 80).trimEnd()}…` : body;
      return `comentó: «${snippet}»`;
    }
    case 'follow':
      return 'te empezó a seguir';
    default:
      return 'tienes un aviso nuevo';
  }
}

function payloadFor(n: Notification): string {
  const isSystem = Boolean(n.title);
  const who = n.actor_handle ? `@${n.actor_handle}` : 'Un atleta';
  const url = n.link
    || (n.type === 'follow' && n.actor_id ? `/athletes/${n.actor_id}` : '/community');
  return JSON.stringify({
    title: isSystem ? n.title : 'RöK BoX',
    body: isSystem ? (n.body || '') : `${who} ${socialText(n)}`,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: `rokbox-${n.type}`,
    data: { url, notification_id: n.id },
  });
}

async function processBatch(): Promise<{ claimed: number; sent: number; removed: number; failed: number }> {
  const { data, error } = await supabase.rpc('claim_push_batch', { p_limit: BATCH_SIZE });
  if (error) throw new Error(`claim_push_batch: ${error.message}`);
  const notifications = (data || []) as Notification[];
  if (notifications.length === 0) return { claimed: 0, sent: 0, removed: 0, failed: 0 };

  const recipients = [...new Set(notifications.map((n) => n.recipient_id))];
  const { data: subsData, error: subsError } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .in('user_id', recipients);
  if (subsError) throw new Error(`push_subscriptions: ${subsError.message}`);
  const subs = (subsData || []) as Subscription[];

  let sent = 0;
  let failed = 0;
  const dead = new Set<string>();
  const used = new Set<string>();

  await Promise.all(notifications.flatMap((n) => {
    const payload = payloadFor(n);
    return subs.filter((s) => s.user_id === n.recipient_id).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: PUSH_TTL_SECONDS, urgency: 'normal' },
        );
        sent += 1;
        used.add(s.id);
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          dead.add(s.id);
        } else {
          failed += 1;
          console.error('send-push: error', status, (err as Error).message);
        }
      }
    });
  }));

  if (dead.size > 0) {
    await supabase.from('push_subscriptions').delete().in('id', [...dead]);
  }
  if (used.size > 0) {
    await supabase.from('push_subscriptions').update({ last_used_at: new Date().toISOString() }).in('id', [...used]);
  }
  return { claimed: notifications.length, sent, removed: dead.size, failed };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  if (!DISPATCH_SECRET || req.headers.get('x-dispatch-secret') !== DISPATCH_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return Response.json({ ok: false, error: 'Faltan las claves VAPID' }, { status: 500 });
  }

  const totals = { claimed: 0, sent: 0, removed: 0, failed: 0 };
  try {
    for (let i = 0; i < MAX_BATCHES; i += 1) {
      const r = await processBatch();
      totals.claimed += r.claimed;
      totals.sent += r.sent;
      totals.removed += r.removed;
      totals.failed += r.failed;
      if (r.claimed < BATCH_SIZE) break;
    }
  } catch (err) {
    console.error('send-push:', (err as Error).message);
    return Response.json({ ok: false, error: (err as Error).message, ...totals }, { status: 500 });
  }
  return Response.json({ ok: true, ...totals });
});
