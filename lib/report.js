import { sql, ensureSchema } from "./db";

// Extra information printed on the Astra result sheet ("phiếu điểm") that
// the test itself does not know: teacher, level, Speaking score, comments
// per skill, class attitude, study direction. One row per submission.

export const REPORT_FIELDS = {
  template: 10, testTitle: 80, className: 60, teacher: 120, level: 80, levelNote: 120,
  speaking: 10, total: 10, comment: 3000,
  cListening: 3000, cSpeaking: 3000, cReading: 3000, cWriting: 5000, classSituation: 3000, direction: 3000,
};

export function cleanReport(raw) {
  const out = {};
  const r = raw && typeof raw === "object" ? raw : {};
  for (const [k, max] of Object.entries(REPORT_FIELDS)) {
    if (r[k] === undefined || r[k] === null) continue;
    out[k] = r[k].toString().slice(0, max);
  }
  if (out.template && !["short", "full"].includes(out.template)) delete out.template;
  // Other submissions of the same student merged into this one sheet (e.g.
  // a mid-term taken in two sittings: Reading + Listening, then Writing).
  if (Array.isArray(r.mergeIds)) out.mergeIds = r.mergeIds.map((x) => String(x).slice(0, 60)).filter(Boolean).slice(0, 10);
  return out;
}

let ready = null;
export function ensureReportSchema() {
  if (!ready) {
    ready = (async () => {
      await ensureSchema();
      await sql`
        CREATE TABLE IF NOT EXISTS sheet_reports (
          submission_id TEXT PRIMARY KEY,
          class_name TEXT,
          data JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`;
      await sql`CREATE INDEX IF NOT EXISTS sheet_reports_class_idx ON sheet_reports (class_name, updated_at)`;
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

export async function getReport(submissionId) {
  await ensureReportSchema();
  const { rows } = await sql`SELECT data FROM sheet_reports WHERE submission_id = ${submissionId} LIMIT 1`;
  return rows[0]?.data || null;
}

// Teacher / level last used for this class — pre-fills a new sheet so a
// whole class does not have to be typed again.
export async function classDefaults(className) {
  if (!className) return {};
  await ensureReportSchema();
  const { rows } = await sql`
    SELECT data FROM sheet_reports WHERE class_name = ${className}
    ORDER BY updated_at DESC LIMIT 1`;
  const d = rows[0]?.data || {};
  return { teacher: d.teacher || "", level: d.level || "", levelNote: d.levelNote || "" };
}

export async function saveReport(submissionId, className, data) {
  await ensureReportSchema();
  const clean = cleanReport(data);
  await sql`
    INSERT INTO sheet_reports (submission_id, class_name, data, updated_at)
    VALUES (${submissionId}, ${className || null}, ${JSON.stringify(clean)}::jsonb, now())
    ON CONFLICT (submission_id) DO UPDATE SET class_name = EXCLUDED.class_name, data = EXCLUDED.data, updated_at = now()`;
  return clean;
}

// If another submission's sheet already includes this one, that sheet is
// the student's single result sheet.
export async function sheetOwnerOf(submissionId) {
  await ensureReportSchema();
  const { rows } = await sql`
    SELECT submission_id FROM sheet_reports
    WHERE data->'mergeIds' ? ${submissionId} AND submission_id <> ${submissionId}
    ORDER BY updated_at DESC LIMIT 1`;
  return rows[0]?.submission_id || null;
}
