import { sql } from "./db";
import { ensureTeacherSchema } from "./overview";
import { normalizeClassName } from "./classNames";

// Teacher-side queries over submission_overview_v1 (see lib/overview.js).
// Nothing here runs while a student takes or submits a test.

export const NO_CLASS = "__none__";
export const ALL_CLASSES = "__all__";
export const PAGE_SIZE = 50;

// One page of the submissions board. A specific class loads all of that
// class (so it can be grouped by student); "all classes" is paged.
export async function listSubmissionsPage({ cls = ALL_CLASSES, q = "", offset = 0, limit = PAGE_SIZE } = {}) {
  await ensureTeacherSchema();
  const search = `%${(q || "").toString().trim().toLowerCase().replace(/[%_]/g, "")}%`;
  const off = Math.max(0, Number(offset) || 0);
  const lim = cls === ALL_CLASSES ? Math.min(1000, Math.max(1, Number(limit) || PAGE_SIZE)) : 2000;
  let rows, total;
  if (cls === ALL_CLASSES) {
    ({ rows } = await sql`SELECT * FROM submission_overview_v1 WHERE student_key LIKE ${search} ORDER BY created_at DESC OFFSET ${off} LIMIT ${lim}`);
    ({ rows: [{ n: total }] } = await sql`SELECT count(*)::int AS n FROM submission_overview_v1 WHERE student_key LIKE ${search}`);
  } else {
    const c = cls === NO_CLASS ? null : normalizeClassName(cls);
    ({ rows } = await sql`
      SELECT * FROM submission_overview_v1
      WHERE (class_name IS NOT DISTINCT FROM ${c}) AND student_key LIKE ${search}
      ORDER BY created_at DESC LIMIT ${lim}`);
    total = rows.length;
  }
  return { rows: rows.map(liteRow), total };
}

export function liteRow(r) {
  return {
    id: r.id,
    student_name: r.student_name,
    student_key: r.student_key,
    created_at: new Date(r.created_at).toISOString(),
    objective_band: r.objective_band !== null ? Number(r.objective_band) : null,
    writing_word_count: r.writing_word_count,
    final_band: r.final_band !== null ? Number(r.final_band) : null,
    graded: r.graded,
    target_band: r.target_band,
    skills_included: r.skills_included,
    session_id: r.session_id,
    session_name: r.session_name,
    class_name: r.class_name || null,
    bank_id: r.content_bank_id,
    bank_name: r.bank_name,
    aptis: r.exam_type === "aptis",
    reading: [r.reading_score, r.reading_total],
    listening: [r.listening_score, r.listening_total],
    aptis_writing: r.grading_type === "aptis" ? r.aptis_writing : null,
    integrity: r.integrity_summary || null,
  };
}

// Counts per class / test type / bank — drives the class filter, the
// Excel export panel and the stats page without loading every row.
export async function classSummary() {
  await ensureTeacherSchema();
  const { rows } = await sql`
    SELECT class_name, exam_type, content_bank_id AS bank_id, max(bank_name) AS bank_name,
           count(*)::int AS n, count(*) FILTER (WHERE NOT graded)::int AS ungraded
    FROM submission_overview_v1
    GROUP BY class_name, exam_type, content_bank_id
  `;
  return rows;
}

// All class names known to the app, for typing suggestions.
export async function listClassNames() {
  await ensureTeacherSchema();
  const { rows } = await sql`
    SELECT DISTINCT c FROM (
      SELECT class_name AS c FROM submission_overview_v1
      UNION SELECT upper(regexp_replace(class_name, '[[:space:]_.-]+', '', 'g')) FROM test_sessions
      UNION SELECT upper(regexp_replace(class_name, '[[:space:]_.-]+', '', 'g')) FROM content_banks
    ) t WHERE c IS NOT NULL AND c <> '' ORDER BY c
  `;
  return rows.map((r) => r.c);
}

// Full rows (with the grading detail) for the Excel export / stats.
export async function listForClass(cls, type, bank) {
  await ensureTeacherSchema();
  const c = cls === NO_CLASS ? null : normalizeClassName(cls);
  const { rows } = await sql`
    SELECT o.*, s.grading, s.integrity, s.answers, s.content_snapshot, s.writing_text
    FROM submission_overview_v1 o JOIN submissions s ON s.id = o.id
    WHERE (o.class_name IS NOT DISTINCT FROM ${c}) AND o.exam_type = ${type}
      AND (${bank || null}::text IS NULL OR o.content_bank_id = ${bank || null})
    ORDER BY o.student_key, o.created_at
  `;
  return rows;
}

// One submission with everything the grading page / result sheet needs:
// all stored columns plus the resolved class, test type and names.
export async function getSubmissionFull(id) {
  await ensureTeacherSchema();
  const { rows } = await sql`
    SELECT s.*, o.class_name AS effective_class, o.exam_type AS exam_kind, o.exam_type_source,
           o.bank_name, o.session_name, o.student_key
    FROM submissions s JOIN submission_overview_v1 o ON o.id = s.id
    WHERE s.id = ${id} LIMIT 1`;
  return rows[0] || null;
}

// className: a name → file under that class; "" → "Chưa phân lớp";
// null → follow the student's / session link's class again.
export async function setSubmissionsClass(ids, className) {
  await ensureTeacherSchema();
  const clean = className === null ? null : normalizeClassName(className);
  for (const id of ids) {
    await sql`UPDATE submissions SET class_name = ${clean} WHERE id = ${id}`;
  }
}
