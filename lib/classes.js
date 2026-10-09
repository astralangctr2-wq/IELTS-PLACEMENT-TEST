import { sql, ensureSchema } from "./db";

// Teacher-side grouping of submissions into classes ("lớp").
//
// A submission's class is:
//   - its own class_name when the teacher filed it by hand ("" = explicitly
//     no class), otherwise
//   - the class of the session link it was submitted through.
// Nothing here runs while a student takes or submits a test.

export const NO_CLASS = "__none__";

export async function listSubmissionsWithClass() {
  await ensureSchema();
  const { rows } = await sql`
    SELECT s.id, s.student_name, s.created_at, s.objective_band, s.writing_word_count,
           s.final_band, s.writing_band, s.writing_feedback, s.graded, s.target_band, s.skills_included, s.session_id,
           s.grammar_score, s.grammar_total, s.reading_score, s.reading_total,
           s.listening_score, s.listening_total, s.content_bank_id, s.grading,
           ts.name AS session_name,
           CASE WHEN s.class_name IS NULL THEN ts.class_name ELSE NULLIF(s.class_name, '') END AS class_name,
           cb.name AS bank_name, cb.category AS bank_category
    FROM submissions s
    LEFT JOIN test_sessions ts ON ts.id = s.session_id
    LEFT JOIN content_banks cb ON cb.id = s.content_bank_id
    ORDER BY s.created_at DESC
  `;
  return rows;
}

// All class names known to the app (from session links, hand-filed
// submissions and bank file names), for suggestions in the UI.
export async function listClassNames() {
  await ensureSchema();
  const { rows } = await sql`
    SELECT DISTINCT c FROM (
      SELECT class_name AS c FROM test_sessions
      UNION SELECT class_name FROM submissions
      UNION SELECT class_name FROM content_banks
    ) t WHERE c IS NOT NULL AND c <> '' ORDER BY c
  `;
  return rows.map((r) => r.c);
}

// className: a name → file under that class; "" → "Chưa phân lớp";
// null → follow the session link's class again.
export async function setSubmissionsClass(ids, className) {
  await ensureSchema();
  const clean = className === null ? null : (className ?? "").toString().trim().replace(/\s+/g, " ").slice(0, 60);
  for (const id of ids) {
    await sql`UPDATE submissions SET class_name = ${clean} WHERE id = ${id}`;
  }
}
