// Writing grading schemes for the teacher side. Pure functions only (no
// database / server imports) so the same file runs in the grading form in
// the browser, in the API route that validates and stores a grade, in the
// printable result sheet and in the Excel export — they can never disagree.
//
// Nothing here is used while a student is taking or submitting a test.

// ---------------------------------------------------------------- IELTS
export const IELTS_CRITERIA = [
  { key: "ta", label: "Task Achievement / Response", short: "TA" },
  { key: "cc", label: "Coherence & Cohesion", short: "CC" },
  { key: "lr", label: "Lexical Resource", short: "LR" },
  { key: "gra", label: "Grammatical Range & Accuracy", short: "GRA" },
];

const roundHalf = (n) => Math.round(n * 2) / 2;

// Official IELTS rule: the Writing band is the mean of the four criteria,
// rounded to the nearest half band (.25 → .5, .75 → next whole band).
export function ieltsWritingBand(criteria) {
  const scores = IELTS_CRITERIA.map((c) => criteria?.[c.key]?.score);
  if (scores.some((s) => typeof s !== "number" || Number.isNaN(s))) return null;
  return roundHalf(scores.reduce((a, b) => a + b, 0) / 4);
}

// ---------------------------------------------------------------- APTIS
// Aptis General Writing: each part is rated by an examiner on its own
// scale (Technical Manual v2.2, §4.4.3.3).
export const APTIS_WRITING_PARTS = [
  { key: "p1", label: "Part 1 — Điền form (A1)", max: 3 },
  { key: "p2", label: "Part 2 — Viết câu ngắn (A2)", max: 5 },
  { key: "p3", label: "Part 3 — Trả lời chat (B1)", max: 5 },
  { key: "p4", label: "Part 4 — Viết email (B2)", max: 6 },
];
const APTIS_WRITING_RAW_MAX = APTIS_WRITING_PARTS.reduce((a, p) => a + p.max, 0); // 19

// Start of each CEFR level on the 0–50 scale (Aptis Scoring System v2.1,
// Aptis General, revised 2020). Below the A1 cut score = A0.
export const APTIS_CEFR_CUTS = {
  listening: { A1: 8, A2: 16, B1: 24, B2: 34, C: 42 },
  reading: { A1: 8, A2: 16, B1: 26, B2: 38, C: 46 },
  writing: { A1: 6, A2: 18, B1: 26, B2: 40, C: 48 },
};

export function aptisCefr(skill, score) {
  const cuts = APTIS_CEFR_CUTS[skill];
  if (!cuts || typeof score !== "number" || Number.isNaN(score)) return null;
  let level = "A0";
  for (const [lvl, min] of Object.entries(cuts)) if (score >= min) level = lvl;
  return level;
}

// British Council converts raw marks to the 0–50 scale with statistical
// equating that is not published, so the app can only ESTIMATE: Listening
// and Reading by the share of items correct, Writing by the share of the
// 19 raw rating points (Part 4 is worth twice Part 1, so the harder parts
// already weigh more). The teacher can override the Writing score.
export function aptisScaleFromRaw(earned, total) {
  if (!total) return null;
  return Math.round((Number(earned) / Number(total)) * 50);
}

export function aptisSuggestedWriting(parts) {
  const vals = APTIS_WRITING_PARTS.map((p) => parts?.[p.key]);
  if (vals.some((v) => typeof v !== "number" || Number.isNaN(v))) return null;
  const raw = vals.reduce((a, b) => a + b, 0);
  return Math.round((raw / APTIS_WRITING_RAW_MAX) * 50);
}

// ---------------------------------------------------------------- shared
export const ANNOTATION_TAGS = [
  { key: "grammar", label: "Ngữ pháp", color: "#e1596b" },
  { key: "vocab", label: "Từ vựng", color: "#e08a2c" },
  { key: "argument", label: "Lập luận", color: "#3a8f6b" },
  { key: "structure", label: "Cấu trúc", color: "#4a7bd0" },
  { key: "good", label: "Điểm tốt", color: "#2f9e57" },
];
export const TAG_BY_KEY = Object.fromEntries(ANNOTATION_TAGS.map((t) => [t.key, t]));

// Keeps only well-formed, non-overlapping highlights that fit in the text.
export function cleanAnnotations(list, textLength) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const a of list) {
    const start = Number(a?.start), end = Number(a?.end);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > textLength) continue;
    if (!TAG_BY_KEY[a.tag]) continue;
    if (out.some((b) => start < b.end && b.start < end)) continue;
    out.push({ start, end, tag: a.tag, note: String(a.note || "").slice(0, 1000) });
    if (out.length >= 300) break;
  }
  return out.sort((x, y) => x.start - y.start);
}

// Splits text into plain / highlighted segments for rendering.
export function segmentText(text, annotations) {
  const segs = [];
  let pos = 0;
  (annotations || []).forEach((a, i) => {
    if (a.start > pos) segs.push({ text: text.slice(pos, a.start) });
    segs.push({ text: text.slice(a.start, a.end), ann: a, index: i });
    pos = a.end;
  });
  if (pos < text.length) segs.push({ text: text.slice(pos) });
  return segs;
}

export const isAptisCategory = (category) => category === "aptis";
