import crypto from "crypto";
import { sql, ensureSchema } from "./db";
import { isValidSessionValue } from "./auth";

// Who is using the teacher area:
//   admin   — the existing password login (cookie "teacher_session"). Sees
//             and edits everything, creates the exam links, grants teacher
//             access to Gmail accounts.
//   teacher — signed in with a Gmail account the admin granted. Sees only
//             the links the admin gave them and the submissions of those
//             links; grades them and hands the result sheets in.
// Students never sign in: they type their name + class as before.

export const STAFF_COOKIE = "astra_staff";
const STAFF_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const secret = () => process.env.SESSION_SECRET || "dev-only-insecure-secret";
const hmac = (s) => crypto.createHmac("sha256", secret()).update(s).digest("base64url");

export function signToken(data, maxAgeSec) {
  const payload = Buffer.from(JSON.stringify({ ...data, exp: Date.now() + maxAgeSec * 1000 })).toString("base64url");
  return `${payload}.${hmac(payload)}`;
}

export function readToken(value) {
  if (!value || typeof value !== "string") return null;
  const [payload, sig] = value.split(".");
  if (!payload || !sig) return null;
  const expected = hmac(payload);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof data.exp === "number" && data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}

export const teacherCookie = (id) => ({
  name: STAFF_COOKIE,
  value: signToken({ role: "teacher", id }, STAFF_MAX_AGE),
  options: { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: STAFF_MAX_AGE },
});

// ------------------------------------------------------------ schema
let ready = null;
export function ensureStaffSchema() {
  if (!ready) ready = create().catch((e) => { ready = null; throw e; });
  return ready;
}
async function create() {
  await ensureSchema();
  await sql`
    CREATE TABLE IF NOT EXISTS teachers (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL DEFAULT '',
      active BOOLEAN NOT NULL DEFAULT TRUE,
      room_slug TEXT UNIQUE,
      google_sub TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_login_at TIMESTAMPTZ
    )`;
  // Things the admin should know about (a teacher handed sheets in): the
  // bell in the teacher area + push notifications.
  await sql`
    CREATE TABLE IF NOT EXISTS staff_events (
      id BIGSERIAL PRIMARY KEY,
      kind TEXT NOT NULL,
      teacher_id TEXT,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      seen_at TIMESTAMPTZ
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      endpoint TEXT PRIMARY KEY,
      keys JSONB NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      teacher_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
}

const id8 = () => crypto.randomBytes(6).toString("base64url").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);

// ------------------------------------------------------------ teachers
export async function listTeachers() {
  await ensureStaffSchema();
  const { rows } = await sql`
    SELECT t.*, (SELECT count(*)::int FROM test_sessions s WHERE s.teacher_id = t.id) AS link_count
    FROM teachers t ORDER BY t.active DESC, t.name, t.email`;
  return rows;
}

export async function getTeacher(id) {
  if (!id) return null;
  await ensureStaffSchema();
  const { rows } = await sql`SELECT * FROM teachers WHERE id = ${id} LIMIT 1`;
  return rows[0] || null;
}

export async function getTeacherByEmail(email) {
  await ensureStaffSchema();
  const { rows } = await sql`SELECT * FROM teachers WHERE email = ${(email || "").toString().trim().toLowerCase()} LIMIT 1`;
  return rows[0] || null;
}

export async function getTeacherByRoom(slug) {
  await ensureStaffSchema();
  const { rows } = await sql`SELECT * FROM teachers WHERE room_slug = ${cleanSlug(slug)} AND active LIMIT 1`;
  return rows[0] || null;
}

// "Nguyễn Thị Lan" / "lan.nguyen@gmail.com" → "lan", "lan2", …
export function cleanSlug(v) {
  return (v || "").toString().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);
}
async function freeSlug(base, exceptId = null) {
  const root = cleanSlug(base) || "gv";
  for (let i = 0; i < 50; i++) {
    const slug = i ? `${root}${i + 1}` : root;
    const { rows } = await sql`SELECT id FROM teachers WHERE room_slug = ${slug} LIMIT 1`;
    if (!rows[0] || rows[0].id === exceptId) return slug;
  }
  return `${root}-${id8().toLowerCase()}`;
}
const defaultSlug = (name, email) => {
  const words = cleanSlug(name).split("-").filter(Boolean);
  return words.length ? words[words.length - 1] : (email || "").split("@")[0];
};

export async function addTeacher(email, name) {
  await ensureStaffSchema();
  const e = (email || "").toString().trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new Error("Email không hợp lệ.");
  const n = (name || "").toString().trim().slice(0, 80);
  const { rows } = await sql`SELECT id FROM teachers WHERE email = ${e}`;
  if (rows[0]) {
    await sql`UPDATE teachers SET active = TRUE, name = COALESCE(NULLIF(${n}, ''), name) WHERE id = ${rows[0].id}`;
    return rows[0].id;
  }
  const id = id8();
  const slug = await freeSlug(defaultSlug(n, e));
  await sql`INSERT INTO teachers (id, email, name, room_slug) VALUES (${id}, ${e}, ${n}, ${slug})`;
  return id;
}

export async function updateTeacher(id, { name, active, roomSlug }) {
  await ensureStaffSchema();
  if (name !== undefined) await sql`UPDATE teachers SET name = ${(name || "").toString().trim().slice(0, 80)} WHERE id = ${id}`;
  if (active !== undefined) await sql`UPDATE teachers SET active = ${Boolean(active)} WHERE id = ${id}`;
  if (roomSlug !== undefined) {
    const want = cleanSlug(roomSlug);
    if (!want) throw new Error("Tên phòng thi chỉ gồm chữ không dấu, số và dấu gạch.");
    const slug = await freeSlug(want, id);
    if (slug !== want) throw new Error(`"${want}" đã có GV khác dùng.`);
    await sql`UPDATE teachers SET room_slug = ${slug} WHERE id = ${id}`;
  }
}

export async function touchTeacherLogin(id, sub, googleName) {
  await sql`UPDATE teachers SET last_login_at = now(), google_sub = COALESCE(google_sub, ${sub || null}),
    name = CASE WHEN name = '' THEN ${(googleName || "").slice(0, 80)} ELSE name END WHERE id = ${id}`;
}

export const teacherLabel = (t) => (t ? t.name || t.email : "");

// ------------------------------------------------------------ who is signed in
function cookieStore() {
  const { cookies } = require("next/headers");
  return cookies();
}

// { role: "admin" } | { role: "teacher", teacherId, email, name } | null
export async function getStaff() {
  const jar = cookieStore();
  if (isValidSessionValue(jar.get("teacher_session")?.value)) return { role: "admin" };
  const tok = readToken(jar.get(STAFF_COOKIE)?.value);
  if (tok?.role !== "teacher") return null;
  const t = await getTeacher(tok.id);
  if (!t || !t.active) return null;
  return { role: "teacher", teacherId: t.id, email: t.email, name: teacherLabel(t), roomSlug: t.room_slug };
}

export const isAdmin = (staff) => staff?.role === "admin";
// null = everything (admin); otherwise the teacher's id.
export const scopeTeacher = (staff) => (staff?.role === "teacher" ? staff.teacherId : null);

// Server component pages: login screen for visitors, teacher home for a
// teacher opening an admin-only page.
export async function requireStaffPage({ admin = false } = {}) {
  const { redirect } = require("next/navigation");
  const staff = await getStaff();
  if (!staff) redirect("/teacher/login");
  if (admin && staff.role !== "admin") redirect("/teacher");
  return staff;
}

// API routes: { staff } or { error: NextResponse }.
export async function apiStaff({ admin = false } = {}) {
  const { NextResponse } = require("next/server");
  const staff = await getStaff();
  if (!staff) return { error: NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 }) };
  if (admin && staff.role !== "admin") return { error: NextResponse.json({ error: "Chỉ admin được làm việc này." }, { status: 403 }) };
  return { staff };
}

// May this staff member open / grade this submission? `row` comes from
// getSubmissionFull (eff_teacher_id = the teacher of the submission: set
// on it by the admin, else the teacher of its link).
export function staffOwns(staff, row) {
  if (!staff || !row) return false;
  if (staff.role === "admin") return true;
  return Boolean(row.eff_teacher_id) && row.eff_teacher_id === staff.teacherId;
}

// Of these submission ids, the ones this teacher has (admin: all).
export async function ownedIds(staff, ids) {
  const list = [...new Set((ids || []).filter(Boolean))];
  if (!staff) return new Set();
  if (staff.role === "admin") return new Set(list);
  if (!list.length) return new Set();
  const { rows } = await sql`
    SELECT s.id FROM submissions s LEFT JOIN test_sessions ts ON ts.id = s.session_id
    WHERE s.id = ANY(${list}::text[]) AND COALESCE(s.teacher_id, ts.teacher_id) = ${staff.teacherId}`;
  return new Set(rows.map((r) => r.id));
}

// ------------------------------------------------------------ Google sign-in
// Plain OAuth 2.0 / OpenID Connect authorization-code flow (no extra
// library). The endpoints can be overridden only for automated tests.
export const GOOGLE_AUTH_URL = process.env.GOOGLE_AUTH_URL || "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = process.env.GOOGLE_TOKEN_URL || "https://oauth2.googleapis.com/token";
export const googleConfigured = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export function appOrigin(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = req.headers;
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// Admin password session (true / false) — for admin-only API routes.
export async function adminSignedIn() {
  return (await getStaff())?.role === "admin";
}
