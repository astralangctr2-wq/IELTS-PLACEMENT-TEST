import { randomBytes } from "crypto";
import { sql, ensureSchema } from "./db";

export const ALL_SKILLS = ["grammar", "reading", "listening", "writing"];

// The permanent, always-available /test link. Not stored in the DB —
// hardcoded so it keeps working even if something goes wrong with the
// test_sessions table. contentBankId: null means "use whichever bank
// is currently marked default" (see lib/contentBanks.js).
export const FULL_TEST_CONFIG = {
  name: "Đề đầy đủ (mặc định)",
  skills: ["grammar", "reading", "listening", "writing"],
  timeLimits: { grammar: 40, reading: 40, writing: 30 }, // minutes; listening has no clock
  listeningPlays: 1,
  contentBankId: null,
};

function genSlug() {
  return randomBytes(5).toString("base64url").replace(/[^a-zA-Z0-9]/g, "").slice(0, 7);
}

export async function createSession({ name, skills, timeLimits, listeningPlays, contentBankId }) {
  await ensureSchema();
  const cleanSkills = ALL_SKILLS.filter((s) => skills.includes(s));
  if (cleanSkills.length === 0) throw new Error("Cần chọn ít nhất 1 kỹ năng.");
  const cleanTimeLimits = {};
  for (const s of ["grammar", "reading", "writing"]) {
    if (cleanSkills.includes(s) && timeLimits && timeLimits[s]) {
      const n = Number(timeLimits[s]);
      if (Number.isFinite(n) && n > 0) cleanTimeLimits[s] = n;
    }
  }
  const cleanListeningPlays = cleanSkills.includes("listening")
    ? Math.max(1, Math.min(5, Number(listeningPlays) || 1))
    : undefined;

  let id;
  for (let i = 0; i < 5; i++) {
    id = genSlug();
    const { rows } = await sql`SELECT 1 FROM test_sessions WHERE id = ${id}`;
    if (rows.length === 0) break;
  }

  await sql`
    INSERT INTO test_sessions (id, name, skills, time_limits, active, content_bank_id)
    VALUES (
      ${id}, ${name || "Phiên thi"}, ${JSON.stringify(cleanSkills)}::jsonb,
      ${JSON.stringify({ ...cleanTimeLimits, listeningPlays: cleanListeningPlays })}::jsonb,
      TRUE, ${contentBankId || null}
    )
  `;
  return id;
}

export async function listSessions() {
  await ensureSchema();
  const { rows } = await sql`SELECT id, name, skills, time_limits, active, created_at, content_bank_id FROM test_sessions ORDER BY created_at DESC`;
  return rows;
}

export async function getSession(id) {
  await ensureSchema();
  const { rows } = await sql`SELECT id, name, skills, time_limits, active, content_bank_id FROM test_sessions WHERE id = ${id} LIMIT 1`;
  return rows[0] || null;
}

export async function setSessionActive(id, active) {
  await ensureSchema();
  await sql`UPDATE test_sessions SET active = ${active} WHERE id = ${id}`;
}

export async function deleteSession(id) {
  await ensureSchema();
  await sql`DELETE FROM test_sessions WHERE id = ${id}`;
}

// Normalizes either a DB session row or FULL_TEST_CONFIG into the shape
// the test runner expects: { name, skills: [...], timeLimits: {...}, listeningPlays, contentBankId }
export function toRunnerConfig(session) {
  const timeLimits = session.time_limits || session.timeLimits || {};
  return {
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
