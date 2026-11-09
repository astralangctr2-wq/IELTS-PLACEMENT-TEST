import { randomBytes } from "crypto";
import { sql, ensureSchema } from "./db";
import { normalizeClassName } from "./classNames";

export const ALL_SKILLS = ["grammar", "reading", "listening", "writing"];

function genSlug() {
  return randomBytes(5).toString("base64url").replace(/[^a-zA-Z0-9]/g, "").slice(0, 7);
}

// mode: "exam" (default — timed, limited listening plays, no answers shown)
//    or "practice" (no time limits, unlimited listening with pause, detailed
//    answer review after submitting). Stored inside the existing time_limits
//    JSON column so no database migration is needed; sessions created before
//    this existed have no "mode" key and keep behaving exactly as "exam".
export const SESSION_MODES = ["exam", "practice"];

// Teacher accounts: the admin creates every link and picks the teacher who
// invigilates + grades it (teacherId), whether that teacher also gives the
// Speaking mark (withSpeaking) and the level printed on the result sheet.
// Each link also gets a 4-character code for the home page, and shows on
// the teacher's room link (/p/<room>) until room_until.
export async function createSession({ name, skills, timeLimits, listeningPlays, contentBankId, mode, className, opensAt, closesAt, survey, teacherId, level, withSpeaking }) {
  const cleanMode = mode === "practice" ? "practice" : "exam";
  await ensureSchema();
  const cleanSkills = ALL_SKILLS.filter((s) => skills.includes(s));
  if (cleanSkills.length === 0) throw new Error("Cần chọn ít nhất 1 kỹ năng.");
  const cleanTimeLimits = {};
  for (const s of ["grammar", "reading", "writing"]) {
    if (cleanMode === "exam" && cleanSkills.includes(s) && timeLimits && timeLimits[s]) {
      const n = Number(timeLimits[s]);
      if (Number.isFinite(n) && n > 0) cleanTimeLimits[s] = n;
    }
  }
  const cleanListeningPlays = cleanMode === "exam" && cleanSkills.includes("listening")
    ? Math.max(1, Math.min(5, Number(listeningPlays) || 1))
    : undefined;

  let id;
  for (let i = 0; i < 5; i++) {
    id = genSlug();
    const { rows } = await sql`SELECT 1 FROM test_sessions WHERE id = ${id}`;
    if (rows.length === 0) break;
  }

  const code = await freeCode();
  await sql`
    INSERT INTO test_sessions (id, name, skills, time_limits, active, content_bank_id, class_name, opens_at, closes_at, teacher_id, level, with_speaking, access_code, room_until)
    VALUES (
      ${id}, ${name || "Phiên thi"}, ${JSON.stringify(cleanSkills)}::jsonb,
      ${JSON.stringify({ ...cleanTimeLimits, listeningPlays: cleanListeningPlays, ...(cleanMode === "practice" ? { mode: "practice" } : {}), ...(survey ? { survey: true } : {}) })}::jsonb,
      TRUE, ${contentBankId || null}, ${cleanClassName(className)}, ${cleanTime(opensAt)}, ${cleanTime(closesAt)},
      ${teacherId || null}, ${cleanLevel(level)}, ${Boolean(withSpeaking)}, ${code}, ${defaultRoomUntil(opensAt, closesAt)}
    )
  `;
  return id;
}

const cleanLevel = (v) => (v || "").toString().trim().slice(0, 80) || null;

// Shown on the room link from now (or from its opening time) for 12 hours,
// or until its closing time.
function defaultRoomUntil(opensAt, closesAt) {
  const close = cleanTime(closesAt);
  if (close) return close;
  const start = cleanTime(opensAt) ? new Date(cleanTime(opensAt)).getTime() : Date.now();
  return new Date(Math.max(start, Date.now()) + 12 * 3600 * 1000).toISOString();
}

// 4 characters without look-alikes (no 0/O, 1/I/L).
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const cleanCode = (v) => (v || "").toString().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
async function freeCode() {
  for (let i = 0; i < 20; i++) {
    const b = randomBytes(4);
    const code = [...b].map((x) => CODE_CHARS[x % CODE_CHARS.length]).join("");
    const { rows } = await sql`SELECT 1 FROM test_sessions WHERE access_code = ${code}`;
    if (!rows.length) return code;
  }
  return null;
}

// Links created before codes existed get one the first time they are listed.
async function fillCodes(rows) {
  for (const r of rows) {
    if (r.access_code) continue;
    const code = await freeCode();
    if (!code) continue;
    const { rowCount } = await sql`UPDATE test_sessions SET access_code = ${code} WHERE id = ${r.id} AND access_code IS NULL`;
    if (rowCount) r.access_code = code;
  }
  return rows;
}

export async function getSessionByCode(code) {
  await ensureSchema();
  const c = cleanCode(code);
  if (!c) return null;
  const { rows } = await sql`SELECT id FROM test_sessions WHERE access_code = ${c} LIMIT 1`;
  return rows[0] || null;
}

// How long before its opening time a link appears on the room link.
export const ROOM_LEAD_MINUTES = 30;

// Links of one teacher that students may open from the room link now:
// switched on, not closed, within their room time, and already open or
// opening within the next 30 minutes (an afternoon sitting does not show
// in the morning, so the morning class goes straight into its test).
export async function roomSessions(teacherId) {
  await ensureSchema();
  const { rows } = await sql`
    SELECT id, name, skills, opens_at, closes_at, class_name, room_until FROM test_sessions
    WHERE teacher_id = ${teacherId} AND active AND room_until > now() AND (closes_at IS NULL OR closes_at > now())
      AND (opens_at IS NULL OR opens_at <= now() + make_interval(mins => ${ROOM_LEAD_MINUTES}))
    ORDER BY COALESCE(opens_at, created_at) ASC LIMIT 20`;
  return rows;
}

// Change the teacher of a link. Submissions that already came in stay
// with the teacher they were given to (agreed rule); new ones go to the
// new teacher.
export async function setSessionTeacher(id, teacherId) {
  await ensureSchema();
  const { rows } = await sql`SELECT teacher_id FROM test_sessions WHERE id = ${id} LIMIT 1`;
  if (!rows[0]) throw new Error("Không tìm thấy link.");
  const old = rows[0].teacher_id;
  if (old && old !== teacherId) {
    await sql`UPDATE submissions SET teacher_id = ${old} WHERE session_id = ${id} AND teacher_id IS NULL`;
  }
  await sql`UPDATE test_sessions SET teacher_id = ${teacherId || null} WHERE id = ${id}`;
}

export async function setSessionLevel(id, level) {
  await ensureSchema();
  await sql`UPDATE test_sessions SET level = ${cleanLevel(level)} WHERE id = ${id}`;
}

export async function setSessionSpeaking(id, on) {
  await ensureSchema();
  await sql`UPDATE test_sessions SET with_speaking = ${Boolean(on)} WHERE id = ${id}`;
}

// Show the link on the teacher's room link for the next `hours` (0 = hide).
export async function setRoomFor(id, hours) {
  await ensureSchema();
  const h = Math.max(0, Math.min(72, Number(hours) || 0));
  await sql`UPDATE test_sessions SET room_until = ${h ? new Date(Date.now() + h * 3600 * 1000).toISOString() : new Date(0).toISOString()} WHERE id = ${id}`;
}

// tid: only the links of this teacher (null = all, for the admin).
export async function listSessions(tid = null) {
  await ensureSchema();
  const { rows } = await sql`
    SELECT id, name, skills, time_limits, active, created_at, content_bank_id, class_name, opens_at, closes_at,
           teacher_id, level, with_speaking, access_code, room_until
    FROM test_sessions WHERE ${tid}::text IS NULL OR teacher_id = ${tid} ORDER BY created_at DESC`;
  return fillCodes(rows);
}

export async function getSession(id) {
  await ensureSchema();
  const { rows } = await sql`SELECT id, name, skills, time_limits, active, content_bank_id, class_name, opens_at, closes_at, teacher_id, level, with_speaking, access_code, room_until FROM test_sessions WHERE id = ${id} LIMIT 1`;
  return rows[0] || null;
}

// Class ("lớp") a session link belongs to — teacher-side grouping only.
// Stored normalized ("fl-1" → "FL1") so it matches what students type.
export function cleanClassName(v) {
  return normalizeClassName(v) || null;
}

function cleanTime(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// Optional window in which NEW students may open the link. Students who
// opened it before closing time keep going until their own timer ends.
export async function setSessionSchedule(id, opensAt, closesAt) {
  await ensureSchema();
  await sql`UPDATE test_sessions SET opens_at = ${cleanTime(opensAt)}, closes_at = ${cleanTime(closesAt)} WHERE id = ${id}`;
}

export async function setSessionClass(id, className) {
  await ensureSchema();
  await sql`UPDATE test_sessions SET class_name = ${cleanClassName(className)} WHERE id = ${id}`;
}

export async function setSessionActive(id, active) {
  await ensureSchema();
  await sql`UPDATE test_sessions SET active = ${active} WHERE id = ${id}`;
}

export async function deleteSession(id) {
  await ensureSchema();
  await sql`DELETE FROM test_sessions WHERE id = ${id}`;
}

// Normalizes a DB session row into the shape the test runner expects:
// { name, skills: [...], timeLimits: {...}, listeningPlays, contentBankId }
export function sessionMode(session) {
  const timeLimits = (session && (session.time_limits || session.timeLimits)) || {};
  return timeLimits.mode === "practice" ? "practice" : "exam";
}

export function toRunnerConfig(session) {
  const timeLimits = session.time_limits || session.timeLimits || {};
  if (sessionMode(session) === "practice") {
    // Practice: no countdown anywhere, unlimited listening.
    return {
      name: session.name,
      skills: session.skills,
      mode: "practice",
      timeLimits: {},
      listeningPlays: 999, // effectively unlimited (Infinity does not serialize to the client)
      contentBankId: session.content_bank_id || session.contentBankId || null,
      className: normalizeClassName(session.class_name) || null,
      survey: timeLimits.survey === true,
    };
  }
  return {
    mode: "exam",
    name: session.name,
    skills: session.skills,
    timeLimits: {
      grammar: timeLimits.grammar,
      reading: timeLimits.reading,
      writing: timeLimits.writing,
    },
    listeningPlays: timeLimits.listeningPlays || 1,
    contentBankId: session.content_bank_id || session.contentBankId || null,
    className: normalizeClassName(session.class_name) || null,
    survey: timeLimits.survey === true,
  };
}

// Feedback survey after submitting (switched per link). Kept inside the
// time_limits JSON like "mode", so no new column is needed.
export async function setSessionSurvey(id, on) {
  await ensureSchema();
  await sql`UPDATE test_sessions SET time_limits = COALESCE(time_limits, '{}'::jsonb) || jsonb_build_object('survey', ${Boolean(on)}::boolean) WHERE id = ${id}`;
}

// Change the time limits (minutes) / listening plays of an existing link.
// Other settings kept in the same JSON (mode, survey) are left as they are.
// Students who already opened the test keep the times they started with.
export async function setSessionTimes(id, timeLimits, listeningPlays) {
  const session = await getSession(id);
  if (!session) throw new Error("Không tìm thấy link.");
  const next = { ...(session.time_limits || {}) };
  for (const k of ["grammar", "reading", "writing"]) {
    if (!(session.skills || []).includes(k) || !timeLimits || !(k in timeLimits)) continue;
    const n = Number(timeLimits[k]);
    if (Number.isFinite(n) && n > 0 && n <= 600) next[k] = Math.round(n);
    else delete next[k];
  }
  if (listeningPlays !== undefined && (session.skills || []).includes("listening")) {
    next.listeningPlays = Math.max(1, Math.min(5, Math.round(Number(listeningPlays)) || 1));
  }
  await sql`UPDATE test_sessions SET time_limits = ${JSON.stringify(next)}::jsonb WHERE id = ${id}`;
  return next;
}
