import { sql, ensureSchema } from "./db";

// Teacher-side read model. One database view resolves, for every
// submission:
//   - its class   : teacher's manual filing > class typed by the student >
//                   class of the session link — all compared ignoring case,
//                   spaces, dashes, dots and underscores ("fl-1" = "FL1");
//   - its type    : IELTS or Aptis (teacher override > bank category >
//                   Aptis-only content in the submission);
//   - a student key (name ignoring case / extra spaces) to group attempts.
// Only teacher pages call ensureTeacherSchema(); the student test and
// submit flow never touches the view or the indexes.

// Single-flight: a teacher page runs several queries in parallel, and all
// of them must wait for the same view creation (running CREATE VIEW
// concurrently fails with a duplicate-key error).
let readyPromise = null;

export function ensureTeacherSchema() {
  if (!readyPromise) {
    readyPromise = createTeacherSchema().catch((err) => {
      readyPromise = null;
      throw err;
    });
  }
  return readyPromise;
}

async function createTeacherSchema() {
  await ensureSchema();
  try {
    await sql`CREATE INDEX IF NOT EXISTS submissions_created_idx ON submissions (created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS submissions_session_idx ON submissions (session_id)`;
    await sql`CREATE INDEX IF NOT EXISTS submissions_bank_idx ON submissions (content_bank_id)`;
    await sql`
      CREATE OR REPLACE VIEW submission_overview_v1 AS
      SELECT
        s.id, s.student_name,
        lower(regexp_replace(btrim(s.student_name), '[[:space:]]+', ' ', 'g')) AS student_key,
        s.created_at, s.objective_band, s.writing_word_count, s.final_band, s.writing_band,
        s.writing_feedback, s.graded, s.target_band, s.skills_included, s.session_id,
        s.grammar_score, s.grammar_total, s.reading_score, s.reading_total,
        s.listening_score, s.listening_total, s.content_bank_id,
        s.grading->>'type' AS grading_type,
        (s.grading->>'writingScore')::int AS aptis_writing,
        s.integrity->'summary' AS integrity_summary,
        ts.name AS session_name,
        cb.name AS bank_name,
        CASE
          WHEN s.class_name IS NOT NULL THEN NULLIF(upper(regexp_replace(s.class_name, '[[:space:]_.-]+', '', 'g')), '')
          ELSE COALESCE(
            NULLIF(upper(regexp_replace(COALESCE(s.student_class, ''), '[[:space:]_.-]+', '', 'g')), ''),
            NULLIF(upper(regexp_replace(COALESCE(ts.class_name, ''), '[[:space:]_.-]+', '', 'g')), '')
          )
        END AS class_name,
        CASE
          WHEN s.exam_type IN ('aptis', 'ielts') THEN s.exam_type
          WHEN cb.category = 'aptis' OR cb2.category = 'aptis' THEN 'aptis'
          WHEN jsonb_path_exists(COALESCE(s.content_snapshot, '{}'::jsonb), '$.reading[*] ? (@.type == "reorder" || @.type == "heading_match")')
               OR left(s.writing_text, 7) = 'PART 1' || chr(10) THEN 'aptis'
          ELSE 'ielts'
        END AS exam_type,
        CASE
          WHEN s.exam_type IN ('aptis', 'ielts') THEN 'manual'
          WHEN cb.category = 'aptis' OR cb2.category = 'aptis' THEN 'bank'
          WHEN jsonb_path_exists(COALESCE(s.content_snapshot, '{}'::jsonb), '$.reading[*] ? (@.type == "reorder" || @.type == "heading_match")')
               OR left(s.writing_text, 7) = 'PART 1' || chr(10) THEN 'content'
          WHEN cb.category IS NOT NULL OR cb2.category IS NOT NULL THEN 'bank'
          ELSE 'content'
        END AS exam_type_source
      FROM submissions s
      LEFT JOIN test_sessions ts ON ts.id = s.session_id
      LEFT JOIN content_banks cb ON cb.id = s.content_bank_id
      LEFT JOIN content_banks cb2 ON cb2.id = ts.content_bank_id
    `;
  } catch (err) {
    // Another server instance may have been creating the view at the same
    // moment — fine as long as it exists now.
    const { rows } = await sql`SELECT to_regclass('submission_overview_v1') AS v`;
    if (!rows[0]?.v) throw err;
  }
}
