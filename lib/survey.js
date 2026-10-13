import { randomUUID } from "crypto";
import { sql, ensureSchema } from "./db";

// Post-test feedback survey. A teacher switches it on per exam link
// (stored as time_limits.survey on the session, like "mode"); after
// submitting, the student sees the survey under the thank-you message.
// One response per submission — sending again overwrites it.

import { SURVEY, cleanAnswers } from "./surveyQuestions";
export { SURVEY, cleanAnswers };

let ready = null;
export function ensureSurveySchema() {
  if (!ready) {
    ready = (async () => {
      await ensureSchema();
      await sql`
        CREATE TABLE IF NOT EXISTS survey_responses (
          id TEXT PRIMARY KEY,
          submission_id TEXT NOT NULL UNIQUE,
          session_id TEXT,
          class_name TEXT,
          student_name TEXT,
          anonymous BOOLEAN NOT NULL DEFAULT FALSE,
          content_bank_id TEXT,
          answers JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`;
      await sql`CREATE INDEX IF NOT EXISTS survey_session_idx ON survey_responses (session_id)`;
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

// Saves (or replaces) the survey of one submission. Only for submissions
// made through a link with the survey switched on, within 12 hours.
export async function saveSurvey({ submissionId, answers, anonymous }) {
  await ensureSurveySchema();
  const { rows } = await sql`
    SELECT s.id, s.student_name, s.session_id, s.content_bank_id, s.created_at,
           COALESCE(NULLIF(s.class_name, ''), s.student_class, t.class_name) AS class_name,
           t.time_limits
    FROM submissions s LEFT JOIN test_sessions t ON t.id = s.session_id
    WHERE s.id = ${submissionId} LIMIT 1`;
  const sub = rows[0];
  if (!sub) throw new Error("Không tìm thấy bài làm.");
  if (!sub.time_limits || sub.time_limits.survey !== true) throw new Error("Link thi này không có khảo sát.");
  if (Date.now() - new Date(sub.created_at).getTime() > 12 * 3600 * 1000) throw new Error("Đã hết thời gian gửi khảo sát cho bài này.");
  const clean = cleanAnswers(answers);
  if (!Object.keys(clean).length) throw new Error("Bạn chưa trả lời câu nào.");
  const anon = Boolean(anonymous);
  await sql`
    INSERT INTO survey_responses (id, submission_id, session_id, class_name, student_name, anonymous, content_bank_id, answers)
    VALUES (${randomUUID()}, ${sub.id}, ${sub.session_id}, ${sub.class_name || null}, ${anon ? null : sub.student_name}, ${anon},
            ${sub.content_bank_id}, ${JSON.stringify(clean)}::jsonb)
    ON CONFLICT (submission_id) DO UPDATE SET answers = EXCLUDED.answers, anonymous = EXCLUDED.anonymous,
      student_name = EXCLUDED.student_name, created_at = now()`;
}

// scope: { all: true } or { all: false, keys: ["FL4", …], tid: "teacherId" }
export async function listSurveys({ scope = { all: true }, cls = "", sessionId = "" } = {}) {
  await ensureSurveySchema();
  // Scoped query only for teachers (test_sessions.created_by exists only
  // once teacher accounts are in use).
  const { rows } = scope.all
    ? await sql`
        SELECT r.*, t.name AS session_name, cb.name AS bank_name
        FROM survey_responses r
        LEFT JOIN test_sessions t ON t.id = r.session_id
        LEFT JOIN content_banks cb ON cb.id = r.content_bank_id
        ORDER BY r.created_at DESC LIMIT 2000`
    : await sql`
        SELECT r.*, t.name AS session_name, cb.name AS bank_name
        FROM survey_responses r
        LEFT JOIN test_sessions t ON t.id = r.session_id
        LEFT JOIN content_banks cb ON cb.id = r.content_bank_id
        WHERE r.class_name IN (SELECT jsonb_array_elements_text(${JSON.stringify(scope.keys || [])}::jsonb))
           OR t.created_by = ${scope.tid || ""}
        ORDER BY r.created_at DESC LIMIT 2000`;
  return rows.filter((r) => (!cls || (cls === "__none__" ? !r.class_name : r.class_name === cls)) && (!sessionId || r.session_id === sessionId));
}

// Numbers for the teacher page: averages, option counts, ranked wishes.
export function summarizeSurveys(rows) {
  const out = { n: rows.length, questions: {} };
  for (const q of SURVEY) {
    if (q.type === "text") continue;
    const vals = rows.map((r) => r.answers?.[q.key]).filter((v) => v !== undefined);
    if (q.type === "rating") {
      const dist = [1, 2, 3, 4, 5].map((k) => vals.filter((v) => v === k).length);
      out.questions[q.key] = { answered: vals.length, avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null, dist };
    } else {
      const counts = q.options.map((o) => ({ option: o, n: vals.filter((v) => (Array.isArray(v) ? v.includes(o) : v === o)).length }));
      if (q.type === "multi") counts.sort((a, b) => b.n - a.n);
      out.questions[q.key] = { answered: vals.length, counts };
    }
  }
  return out;
}
