import { sql } from "./db";
import { ensureStaffSchema } from "./staff";

// What the admin should know about — today: "a teacher handed sheets in".
// Shown under the bell in the teacher area, and sent as a push
// notification to every browser where the admin switched them on (the
// app installed from Chrome / Edge, or a phone).
//
// Push needs three environment variables on Vercel (see HUONG-DAN):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:…)
// Without them the bell still works; only the pop-up is missing.

export const pushConfigured = () => Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

export async function addEvent(kind, teacherId, data) {
  await ensureStaffSchema();
  const { rows } = await sql`
    INSERT INTO staff_events (kind, teacher_id, data) VALUES (${kind}, ${teacherId || null}, ${JSON.stringify(data || {})}::jsonb)
    RETURNING id, created_at`;
  return rows[0];
}

export async function listEvents(limit = 30) {
  await ensureStaffSchema();
  const { rows } = await sql`
    SELECT e.id, e.kind, e.data, e.created_at, e.seen_at, t.name AS teacher_name, t.email AS teacher_email
    FROM staff_events e LEFT JOIN teachers t ON t.id = e.teacher_id
    ORDER BY e.created_at DESC LIMIT ${limit}`;
  return rows.map((r) => ({
    id: String(r.id), kind: r.kind, data: r.data, createdAt: new Date(r.created_at).toISOString(),
    seen: Boolean(r.seen_at), teacher: r.teacher_name || r.teacher_email || "",
  }));
}

export async function unseenCount() {
  await ensureStaffSchema();
  const { rows } = await sql`SELECT count(*)::int AS n FROM staff_events WHERE seen_at IS NULL`;
  return rows[0].n;
}

export async function markSeen() {
  await ensureStaffSchema();
  await sql`UPDATE staff_events SET seen_at = now() WHERE seen_at IS NULL`;
}

// ------------------------------------------------------------ push
export async function saveSubscription(sub, role = "admin", teacherId = null) {
  await ensureStaffSchema();
  const endpoint = (sub?.endpoint || "").toString();
  if (!/^https:\/\//.test(endpoint) || !sub?.keys?.p256dh || !sub?.keys?.auth) throw new Error("Đăng ký thông báo không hợp lệ.");
  await sql`
    INSERT INTO push_subscriptions (endpoint, keys, role, teacher_id) VALUES (${endpoint.slice(0, 1000)}, ${JSON.stringify({ p256dh: String(sub.keys.p256dh).slice(0, 200), auth: String(sub.keys.auth).slice(0, 100) })}::jsonb, ${role}, ${teacherId})
    ON CONFLICT (endpoint) DO UPDATE SET keys = EXCLUDED.keys, role = EXCLUDED.role, teacher_id = EXCLUDED.teacher_id`;
}

export async function removeSubscription(endpoint) {
  await ensureStaffSchema();
  await sql`DELETE FROM push_subscriptions WHERE endpoint = ${(endpoint || "").toString()}`;
}

// { title, body, url } → every admin browser. Never throws: a failed push
// must not fail the teacher's hand-in.
export async function pushToAdmins(payload) {
  if (!pushConfigured()) return { sent: 0 };
  try {
    const webpush = require("web-push");
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
    await ensureStaffSchema();
    const { rows } = await sql`SELECT endpoint, keys FROM push_subscriptions WHERE role = 'admin'`;
    let sent = 0;
    await Promise.all(rows.map(async (r) => {
      try {
        await webpush.sendNotification({ endpoint: r.endpoint, keys: r.keys }, JSON.stringify(payload), { TTL: 60 * 60 * 24, timeout: 8000 });
        sent++;
      } catch (e) {
        // The browser unsubscribed / the app was removed: forget it.
        if (e?.statusCode === 404 || e?.statusCode === 410) await removeSubscription(r.endpoint);
      }
    }));
    return { sent };
  } catch {
    return { sent: 0 };
  }
}
