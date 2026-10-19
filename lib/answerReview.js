import { sql, ensureSchema } from "./db";
import { reviewQuestion } from "./review";
import { bandFromScore, roundHalf } from "./scoring";

// Teacher confirmation of the auto-marked Grammar / Reading / Listening
// answers. The machine marks every answer (lib/scoring.js); the teacher can
// flip any single answer to right / wrong, and the scores, the objective
// band and the final band are recomputed from that.
//
// Stored in submissions.answer_review:
//   { marks: { "reading:<questionId>:<part>": true | false, … },
//     confirmedAt, auto: { reading: [earned, total], … } }
// A question with several blanks / items has one part per point; a
// multi-select question has one part worth all its points.

export const OBJ_SKILLS = ["grammar", "reading", "listening"];

let ready = null;
export function ensureReviewSchema() {
  if (!ready) {
    ready = (async () => {
      await ensureSchema();
      await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS answer_review JSONB`;
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

export const markKey = (skill, qid, part) => `${skill}:${qid}:${part}`;

// Points of one reviewed question once the teacher's marks are applied.
export function effectivePoints(it, skill, marks) {
  const m = marks || {};
  const keys = it.parts.map((_, pi) => markKey(skill, it.id, pi));
  if (!keys.some((k) => k in m)) return it.earned;
  if (it.parts.length === 1) {
    const v = m[keys[0]];
    return v === undefined ? it.earned : v ? it.total : 0;
  }
  return it.parts.reduce((a, p, pi) => a + ((keys[pi] in m ? m[keys[pi]] : p.ok) ? 1 : 0), 0);
}

// Reviewed items of one skill (from the snapshot taken at submit time).
export function reviewItems(questions, answers) {
  return (questions || []).map((q) => {
    const it = reviewQuestion(q, answers ? answers[q.id] : undefined);
    return it ? { ...it, sectionTitle: q.sectionTitle || "" } : null;
  }).filter(Boolean);
}

// Scores of every objective skill with the marks applied.
export function scoresWithMarks(snapshot, answers, skills, marks) {
  const out = {};
  for (const k of OBJ_SKILLS) {
    if (!skills.includes(k) || !Array.isArray(snapshot?.[k])) continue;
    const items = reviewItems(snapshot[k], answers?.[k]);
    out[k] = [
      items.reduce((a, it) => a + effectivePoints(it, k, marks), 0),
      items.reduce((a, it) => a + it.total, 0),
    ];
  }
  return out;
}

// Only keys that exist in this submission, values true / false.
function cleanMarks(raw, snapshot, answers, skills) {
  const valid = new Set();
  for (const k of OBJ_SKILLS) {
    if (!skills.includes(k)) continue;
    for (const it of reviewItems(snapshot?.[k], answers?.[k])) it.parts.forEach((_, pi) => valid.add(markKey(k, it.id, pi)));
  }
  const out = {};
  for (const [key, v] of Object.entries(raw && typeof raw === "object" ? raw : {})) {
    if (valid.has(key) && typeof v === "boolean") out[key] = v;
  }
  return out;
}

// row: getSubmissionFull(). confirm: the teacher has checked the marking.
export async function saveAnswerReview(row, rawMarks, confirm) {
  await ensureReviewSchema();
  const skills = Array.isArray(row.skills_included) ? row.skills_included : ["grammar", "reading", "listening", "writing"];
  const snapshot = row.content_snapshot || {};
  const answers = row.answers || {};
  const marks = cleanMarks(rawMarks, snapshot, answers, skills);
  const prev = row.answer_review || {};
  // Machine scores before any teacher change (kept from the first review).
  const auto = prev.auto || Object.fromEntries(OBJ_SKILLS.filter((k) => skills.includes(k)).map((k) => [k, [row[`${k}_score`], row[`${k}_total`]]]));
  const sc = scoresWithMarks(snapshot, answers, skills, marks);
  const get = (k) => sc[k] || [row[`${k}_score`], row[`${k}_total`]];
  const [g, r, l] = OBJ_SKILLS.map(get);
  const objTotal = g[1] + r[1] + l[1];
  const objectiveBand = objTotal > 0 ? bandFromScore(g[0] + r[0] + l[0], objTotal) : null;

  const hasWriting = skills.includes("writing");
  const aptis = row.exam_kind === "aptis";
  let finalBand = row.final_band;
  let graded = row.graded;
  if (!hasWriting) {
    finalBand = objectiveBand;
    if (confirm) graded = true;
  } else if (row.graded && !aptis && row.writing_band !== null) {
    const wb = Number(row.writing_band);
    finalBand = objectiveBand !== null ? roundHalf((objectiveBand + wb) / 2) : wb;
  }
  const review = {
    marks,
    auto,
    confirmedAt: confirm ? new Date().toISOString() : prev.confirmedAt || null,
    updatedAt: new Date().toISOString(),
  };
  await sql`
    UPDATE submissions SET
      answer_review = ${JSON.stringify(review)}::jsonb,
      grammar_score = ${g[0]}, reading_score = ${r[0]}, listening_score = ${l[0]},
      objective_band = ${objectiveBand},
      final_band = ${finalBand},
      graded = ${graded},
      graded_at = CASE WHEN ${graded} AND NOT graded THEN now() ELSE graded_at END
    WHERE id = ${row.id}`;
  return { review, scores: { grammar: g, reading: r, listening: l }, objectiveBand, finalBand, graded };
}
