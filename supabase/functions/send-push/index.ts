// Edge Function: send-push
// Llamada por el trigger `notifications_send_push` (migracion 0014)
// Despues de insertar una fila en `public.notifications`, este trigger
// hace POST a esta funcion con `{ notification_id }`.
//
// La funcion:
//   1) Lee la notification y las subscripciones push del destinatario.
//   2) Envia el push a cada subscripcion usando la lib `web-push`
//      firmada con la clave VAPID privada (env var VAPID_PRIVATE_KEY).
//   3) Si el push service responde 404/410 (subscripcion muerta), borra
//      la fila de push_subscriptions.
//
// Requisitos (configurar con `supabase secrets set ...`):
//   - SUPABASE_URL          (auto en Supabase)
//   - SUPABASE_SERVICE_ROLE_KEY (auto en Supabase)
//   - VAPID_SUBJECT         ej. https://rokbox-athlete.vercel.app
//   - VAPID_PUBLIC_KEY      (informativo, tambien en el cliente)
//   - VAPID_PRIVATE_KEY     (NUNCA commitear al repo)

import webpush from "web-push";

// @ts-ignore Deno runtime
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
// @ts-ignore Deno runtime
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
// @ts-ignore Deno runtime
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "https://rokbox-athlete.vercel.app";
// @ts-ignore Deno runtime
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
// @ts-ignore Deno runtime
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("send-push: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing");
}
if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.error("send-push: VAPID keys missing (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)");
}

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const PUSH_TTL_SECONDS = 60 * 60 * 24; // 1 dia
const FETCH_TIMEOUT_MS = 8000;

async function fetchWithTimeout(url, options = {}, timeout = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

function notificationText(n) {
  const p = n.event_payload || {};
  switch (n.type) {
    case "like":
      if (n.event_type === "pr")
        return `le dio \u2764\ufe0f a tu ${p.movement || "PR"}`;
      if (n.event_type === "benchmark")
        return `le dio \u2764\ufe0f a tu ${p.name || "WOD"}`;
      if (n.event_type === "achievement") return "le dio \u2764\ufe0f a tu logro";
      if (n.event_type === "skill") return `le dio \u2764\ufe0f a tu ${p.movement || "skill"}`;
      return "le dio \u2764\ufe0f a tu actividad";
    case "comment": {
      const eventPart =
        n.event_type === "pr" && p.movement
          ? `tu ${p.movement}`
          : n.event_type === "benchmark" && p.name
            ? `tu ${p.name}`
            : "tu actividad";
      const body = (n.comment_body || "").trim();
      const snippet = body.length > 80 ? body.slice(0, 80).trimEnd() + "\u2026" : body;
      return `coment\u00f3 en ${eventPart}: \u00ab${snippet}\u00bb`;
    }
    case "follow":
      return "te empez\u00f3 a seguir";
    case "new_post": {
      if (n.event_type === "pr")
        return `public\u00f3 un nuevo PR: ${p.movement || "PR"}`;
      if (n.event_type === "benchmark")
        return `public\u00f3 un nuevo WOD: ${p.name || "WOD"}`;
      if (n.event_type === "achievement")
        return `desbloque\u00f3 un nuevo logro`;
      if (n.event_type === "skill")
        return `desbloque\u00f3 una nueva skill: ${p.movement || "movimiento"}`;
      return "public\u00f3 algo nuevo";
    }
    default:
      return "";
  }
}

async function fetchNotification(notificationId) {
  const url =
    `${SUPABASE_URL}/rest/v1/notifications?id=eq.${notificationId}` +
    `&select=id,recipient_id,actor_id,type,event_type,event_payload,comment_body,event_id,created_at`;
  const res = await fetchWithTimeout(url, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) {
    console.error("send-push: fetchNotification failed", res.status, await res.text());
    return null;
  }
  const rows = await res.json();
  return rows?.[0] || null;
}

async function fetchActor(actorId) {
  const url = `${SUPABASE_URL}/rest/v1/athlete_directory?id=eq.${actorId}` +
    `&select=id,display_name,first_name,last_name,avatar_url`;
  const res = await fetchWithTimeout(url, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows?.[0] || null;
}

async function fetchSubscriptions(userId) {
  const url =
    `${SUPABASE_URL}/rest/v1/push_subscriptions?user_id=eq.${userId}` +
    `&select=id,endpoint,p256dh,auth`;
  const res = await fetchWithTimeout(url, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) {
    console.error("send-push: fetchSubscriptions failed", res.status, await res.text());
    return [];
  }
  return await res.json();
}

async function deleteSubscription(id) {
  const url = `${SUPABASE_URL}/rest/v1/push_subscriptions?id=eq.${id}`;
  await fetchWithTimeout(url, {
    method: "DELETE",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });
}

Deno.serve(async (req) => {
  // Solo POST
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Auth: el trigger envia la service role key en el header Authorization.
  // Validamos que coincida para que nadie externo pueda llamar a la funcion
  // y enviar pushes arbitrarios.
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ") || auth.slice(7) !== SERVICE_ROLE_KEY) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return new Response(
      JSON.stringify({ ok: false, error: "vapid keys not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const notificationId = body?.notification_id;
  if (!notificationId) {
    return new Response(
      JSON.stringify({ ok: false, error: "notification_id required" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const notification = await fetchNotification(notificationId);
  if (!notification) {
    return new Response(
      JSON.stringify({ ok: false, error: "notification not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }

  // TTL: no enviar si la notification es muy vieja (rate limit / stale).
  const ageMs = Date.now() - new Date(notification.created_at).getTime();
  if (ageMs > PUSH_TTL_SECONDS * 1000) {
    return new Response(
      JSON.stringify({ ok: true, sent: 0, skipped: "stale" }),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  const subs = await fetchSubscriptions(notification.recipient_id);
  if (subs.length === 0) {
    return new Response(
      JSON.stringify({ ok: true, sent: 0, reason: "no subscriptions" }),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  const actor = await fetchActor(notification.actor_id);
  const title = `R\u00f6K BoX Athlete`;
  const text = notificationText(notification);

  // URL a abrir al hacer click. follow -> perfil del actor;
  // like/comment/new_post -> feed (donde se ve el evento).
  const url = notification.type === "follow" && actor
    ? `/athletes/${actor.id}`
    : "/community";

  const payload = JSON.stringify({
    title,
    body: actor?.display_name ? `@${actor.display_name} ${text}` : text,
    icon: "/pwa-192x192.png",
    badge: "/pwa-192x192.png",
    tag: "rokbox-notif",
    renotify: true,
    data: { url, notification_id: notification.id },
  });

  let sent = 0;
  let removed = 0;
  await Promise.all(
    subs.map(async (sub) => {
      const pushSub = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      };
      try {
        await webpush.sendNotification(pushSub, payload, { TTL: PUSH_TTL_SECONDS });
        sent += 1;
      } catch (err) {
        const statusCode = err?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // Subscripcion muerta (desinstalo, cambio de device, etc.)
          await deleteSubscription(sub.id);
          removed += 1;
        } else {
          console.error("send-push: webpush error", statusCode, err?.message);
        }
      }
    }),
  );

  return new Response(
    JSON.stringify({ ok: true, sent, removed, total: subs.length }),
    { headers: { "Content-Type": "application/json" } },
  );
});
