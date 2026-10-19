import { sql } from "./db";
import { getSubmissionFull } from "./classes";
import { getReport, classDefaults, sheetOwnerOf } from "./report";
import { IELTS_CRITERIA, ieltsTasksOf, ieltsCriterionLabel } from "./grading";
import { bandFromScore, roundHalf } from "./scoring";
import { fmt } from "./sheetCols";

const TITLE_BY_CATEGORY = { midterm: "MID-TERM TEST", final: "FINAL TEST", placement: "PLACEMENT TEST" };
const SKILLS = ["grammar", "reading", "listening", "writing"];
const skillsOf = (row) => (Array.isArray(row.skills_included) ? row.skills_included : SKILLS);

// Writing comment pre-filled from the grade: band + feedback per criterion.
function writingComment(g) {
  if (!g) return "";
  if (g.type === "aptis") {
    return [g.strengths && `Điểm mạnh: ${g.strengths}`, g.improvements && `Cần cải thiện: ${g.improvements}`].filter(Boolean).join("\n");
  }
  const tasks = ieltsTasksOf(g);
  const parts = tasks.map((t, ti) => {
    const head = tasks.length > 1 ? `Task ${ti + 1}: ${fmt(t.band)}` : `Writing: ${fmt(g.writingBand)}`;
    const lines = IELTS_CRITERIA.map((c) => {
      const fb = (t.criteria?.[c.key]?.feedback || "").trim();
      return fb ? `- ${ieltsCriterionLabel(c, ti, tasks.length)}: ${fb}` : null;
    }).filter(Boolean);
    return [head, ...lines].join("\n");
  });
  if (g.note && g.note.trim()) parts.push(g.note.trim());
  return parts.join("\n\n");
}

// Other submissions of the same student (same name, same class) within 60
// days — candidates for one combined sheet when a test is split over
// several sittings / links.
async function siblingsOf(s) {
  const { rows } = await sql`
    SELECT s.id, s.created_at, s.skills_included, s.graded, s.content_bank_id, o.bank_name, o.session_name
    FROM submission_overview_v1 o JOIN submissions s ON s.id = o.id
    WHERE o.student_key = ${s.student_key}
      AND COALESCE(o.class_name, '') = COALESCE(${s.effective_class || null}, '')
      AND s.id <> ${s.id}
      AND s.created_at BETWEEN ${new Date(s.created_at).toISOString()}::timestamptz - interval '60 days'
                          AND ${new Date(s.created_at).toISOString()}::timestamptz + interval '60 days'
    ORDER BY s.created_at DESC LIMIT 20`;
  return rows;
}

// Default merge: same test (bank), newest submission for each skill this
// one does not have.
function autoMerge(s, sibs) {
  const have = new Set(skillsOf(s));
  const out = [];
  for (const x of sibs) {
    if (x.content_bank_id !== s.content_bank_id) continue;
    const adds = skillsOf(x).filter((k) => !have.has(k));
    if (!adds.length) continue;
    adds.forEach((k) => have.add(k));
    out.push(x.id);
  }
  return out;
}

const gradingOf = (row) => {
  const aptis = row.exam_kind === "aptis";
  return row.grading && row.grading.type === (aptis ? "aptis" : "ielts") ? row.grading : null;
};

// Teacher-written comments win; the Writing feedback from the grading page
// is used whenever the saved text is empty or is still exactly the
// auto-filled text from an earlier save (so grading Writing AFTER the sheet
// was first saved still reaches the sheet).
function freshAuto(savedVal, savedAuto, auto) {
  const v = (savedVal ?? "").toString();
  if (!v.trim()) return auto;
  if (savedAuto !== undefined && v.trim() === (savedAuto || "").trim()) return auto;
  return v;
}

// Everything the result sheet needs: the scores (data — combined over the
// merged submissions) and the teacher-filled fields (initial = saved
// values, else class defaults, else values derived from the test).
// { redirectTo } when another submission's sheet already contains this one.
export async function loadSheet(id) {
  const s = await getSubmissionFull(id);
  if (!s) return { s: null };
  const [saved, owner, cat, sibs] = await Promise.all([
    getReport(s.id),
    sheetOwnerOf(s.id),
    s.content_bank_id ? sql`SELECT category FROM content_banks WHERE id = ${s.content_bank_id} LIMIT 1` : Promise.resolve({ rows: [] }),
    siblingsOf(s),
  ]);
  // Two sheets that include each other: the older id keeps the sheet.
  if (owner && (!(saved?.mergeIds || []).includes(owner) || owner < s.id)) return { s, redirectTo: owner };

  const category = cat.rows[0]?.category || "other";
  const aptis = s.exam_kind === "aptis";
  const sibIds = new Set(sibs.map((x) => x.id));
  // Saved choice + sittings that arrived later (e.g. the Writing sitting of a
  // split mid-term), except those the teacher unticked.
  const off = new Set(Array.isArray(saved?.mergeOff) ? saved.mergeOff : []);
  const chosen = Array.isArray(saved?.mergeIds) ? saved.mergeIds.filter((x) => sibIds.has(x)) : [];
  const base = { ...s, skills_included: [...new Set([...skillsOf(s), ...sibs.filter((x) => chosen.includes(x.id)).flatMap(skillsOf)])] };
  const mergeIds = [...chosen, ...autoMerge(base, sibs.filter((x) => !off.has(x.id) && !chosen.includes(x.id)))];
  const merged = (await Promise.all(mergeIds.map((x) => getSubmissionFull(x)))).filter(Boolean);

  // Newest submission providing each skill.
  const members = [s, ...merged].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const providerOf = (k) => members.find((m) => skillsOf(m).includes(k)) || null;
  const pick = (k) => { const m = providerOf(k); return m ? [m[`${k}_score`], m[`${k}_total`]] : [0, 0]; };
  const skills = SKILLS.filter((k) => providerOf(k));
  const writer = members.filter((m) => skillsOf(m).includes("writing")).sort((a, b) => Number(Boolean(gradingOf(b))) - Number(Boolean(gradingOf(a))))[0] || null;
  const g = writer ? gradingOf(writer) : null;

  const raw = ["grammar", "reading", "listening"].filter((k) => skills.includes(k)).map(pick);
  const earned = raw.reduce((a, x) => a + x[0], 0), total = raw.reduce((a, x) => a + x[1], 0);
  const objectiveBand = total > 0 ? bandFromScore(earned, total) : null;
  const writingBand = g ? (aptis ? g.writingScore : g.writingBand) : null;
  const graded = writer ? Boolean(g) : true;
  const finalBand = !writer ? objectiveBand : g && !aptis ? (objectiveBand !== null ? roundHalf((objectiveBand + writingBand) / 2) : writingBand) : null;

  const autoW = writingComment(g);
  const defaults = saved ? {} : await classDefaults(s.effective_class);
  const initial = {
    template: ["midterm", "final"].includes(category) ? "full" : "short",
    testTitle: TITLE_BY_CATEGORY[category] || (s.bank_name || (aptis ? "APTIS ESOL" : "TEST")).toLocaleUpperCase("vi"),
    className: s.effective_class || "",
    teacher: "", level: "", levelNote: "",
    speaking: "", total: "",
    cListening: "", cSpeaking: "", cReading: "",
    classSituation: "", direction: "",
    ...defaults,
    ...(saved || {}),
    comment: freshAuto(saved?.comment, saved?.autoW, autoW),
    cWriting: freshAuto(saved?.cWriting, saved?.autoW, autoW),
    autoW,
    mergeIds,
    mergeOff: [...off],
  };

  const data = {
    id: s.id,
    name: s.student_name,
    aptis,
    skills,
    grammar: pick("grammar"),
    reading: pick("reading"),
    listening: pick("listening"),
    objectiveBand,
    graded,
    hasWriting: Boolean(writer),
    writerId: writer?.id || null,
    finalBand,
    writingBand,
    autoW,
    createdAt: new Date(s.created_at).toISOString(),
    primary: { id: s.id, created_at: new Date(s.created_at).toISOString(), skills: skillsOf(s), bank_name: s.bank_name || "" },
    siblings: sibs.map((x) => ({
      id: x.id, created_at: new Date(x.created_at).toISOString(), skills: skillsOf(x), bank_name: x.bank_name || "",
      session_name: x.session_name || "", graded: Boolean(x.graded), included: mergeIds.includes(x.id),
    })),
  };
  return { s, data, initial };
}

// The other students of the same class who took the same test (±60 days):
// one entry per student, for the "next student" list and the whole-class
// Word file. The sheet of each is resolved by loadSheet (merges / owners).
export async function classmatesOf(s) {
  if (!s?.effective_class) return [];
  const at = new Date(s.created_at).toISOString();
  const { rows } = await sql`
    SELECT (array_agg(o.id ORDER BY o.created_at))[1] AS id,
           (array_agg(o.student_name ORDER BY o.created_at DESC))[1] AS student_name,
           (array_agg(o.session_id ORDER BY o.created_at))[1] AS session_id,
           ${s.effective_class}::text AS effective_class,
           array_agg(o.id) AS ids,
           bool_or(COALESCE(o.skills_included, '["writing"]'::jsonb) ? 'writing' AND NOT COALESCE(o.graded, false)) AS needs_grading
    FROM submission_overview_v1 o
    WHERE o.class_name = ${s.effective_class}
      AND COALESCE(o.content_bank_id, '') = COALESCE(${s.content_bank_id || null}, '')
      AND o.created_at BETWEEN ${at}::timestamptz - interval '60 days' AND ${at}::timestamptz + interval '60 days'
    GROUP BY o.student_key
    LIMIT 200`;
  return rows.sort((a, b) => a.student_name.localeCompare(b.student_name, "vi"));
}
