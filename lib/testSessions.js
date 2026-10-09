import { randomBytes } from "crypto";
import { sql, ensureSchema } from "./db";

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

export async function createSession({ name, skills, timeLimits, listeningPlays, contentBankId, mode, className }) {
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

  await sql`
    INSERT INTO test_sessions (id, name, skills, time_limits, active, content_bank_id, class_name)
    VALUES (
      ${id}, ${name || "Phiên thi"}, ${JSON.stringify(cleanSkills)}::jsonb,
      ${JSON.stringify({ ...cleanTimeLimits, listeningPlays: cleanListeningPlays, ...(cleanMode === "practice" ? { mode: "practice" } : {}) })}::jsonb,
      TRUE, ${contentBankId || null}, ${cleanClassName(className)}
    )
  `;
  return id;
}

export async function listSessions() {
  await ensureSchema();
  const { rows } = await sql`SELECT id, name, skills, time_limits, active, created_at, content_bank_id, class_name FROM test_sessions ORDER BY created_at DESC`;
  return rows;
}

export async function getSession(id) {
  await ensureSchema();
  const { rows } = await sql`SELECT id, name, skills, time_limits, active, content_bank_id FROM test_sessions WHERE id = ${id} LIMIT 1`;
  return rows[0] || null;
}

// Class ("lớp") a session link belongs to — teacher-side grouping only.
export function cleanClassName(v) {
  const c = (v ?? "").toString().trim().replace(/\s+/g, " ").slice(0, 60);
  return c || null;
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
  };
}
