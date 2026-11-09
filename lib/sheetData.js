import { sql } from "./db";
import { getSubmissionFull } from "./classes";
import { getReport, classDefaults, sheetOwnerOf, ensureReportSchema, TEACHER_FIELDS } from "./report";
import { IELTS_CRITERIA, ieltsTasksOf, ieltsCriterionLabel } from "./grading";
import { bandFromScore, roundHalf } from "./scoring";
import { fmt } from "./sheetCols";
import { missingFields } from "./sheetText";
import { skillOwners } from "./sheetRights";

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
    SELECT s.id, s.student_name, s.created_at, s.skills_included, s.graded, s.content_bank_id, o.bank_name, o.session_name
    FROM submission_overview_v1 o JOIN submissions s ON s.id = o.id
    WHERE o.student_key = ${s.student_key}
      AND COALESCE(o.class_name, '') = COALESCE(${s.effective_class || null}, '')
      AND s.id <> ${s.id}
      AND s.created_at BETWEEN ${new Date(s.created_at).toISOString()}::timestamptz - interval '60 days'
                          AND ${new Date(s.created_at).toISOString()}::timestamptz + interval '60 days'
    ORDER BY s.created_at DESC LIMIT 20`;
  return rows;
}

// One submission in the same shape (for sittings merged by hand: the
// student typed another name, so they are not found as siblings).
async function sittingRow(id) {
  const { rows } = await sql`
    SELECT s.id, s.student_name, s.created_at, s.skills_included, s.graded, s.content_bank_id, o.bank_name, o.session_name
    FROM submission_overview_v1 o JOIN submissions s ON s.id = o.id
    WHERE s.id = ${id} LIMIT 1`;
  return rows[0] || null;
}

// How much the teacher wrote on a saved sheet (auto-filled Writing text
// does not count).
const isAuto = (rep, k) => (k === "comment" || k === "cWriting") && (rep[k] || "").toString().trim() === (rep.autoW || "").toString().trim();
export function teacherContent(rep) {
  if (!rep) return 0;
  return TEACHER_FIELDS.reduce((n, k) => {
    const v = (rep[k] || "").toString().trim();
    return v && !isAuto(rep, k) ? n + v.length : n;
  }, 0);
}

// A student's sittings can end up with more than one saved sheet (e.g. the
// teacher typed comments on the Reading sitting, later saved the Writing
// sitting's sheet, which took the others in). Nothing typed is lost: every
// hand-written field still empty on the sheet shown is filled from the
// sheets merged into it.
function fillFrom(saved, others) {
  const out = { ...(saved || {}) };
  for (const o of others) {
    if (!o) continue;
    for (const k of TEACHER_FIELDS) {
      const theirs = (o[k] || "").toString();
      if (!theirs.trim() || isAuto(o, k)) continue;
      const mine = (out[k] || "").toString();
      if (!mine.trim() || isAuto(out, k)) out[k] = theirs;
    }
  }
  return out;
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
export async function loadSheet(id, { noRedirect = false, depth = 0 } = {}) {
  const s = await getSubmissionFull(id);
  if (!s) return { s: null };
  const [saved, owner, cat, sibs] = await Promise.all([
    getReport(s.id),
    sheetOwnerOf(s.id),
    s.content_bank_id ? sql`SELECT category FROM content_banks WHERE id = ${s.content_bank_id} LIMIT 1` : Promise.resolve({ rows: [] }),
    siblingsOf(s),
  ]);
  // Another sheet already contains this submission: that is the student's
  // sheet. Two sheets that include each other: the one with more
  // hand-written text keeps it (same amount: the smaller id).
  if (owner && !noRedirect) {
    if (!saved || !(saved.mergeIds || []).includes(owner)) return { s, redirectTo: owner };
    const a = teacherContent(saved), b = teacherContent(await getReport(owner));
    if (b > a || (b === a && owner < s.id)) return { s, redirectTo: owner };
  }

  const category = cat.rows[0]?.category || "other";
  const aptis = s.exam_kind === "aptis";
  const sibIds = new Set(sibs.map((x) => x.id));
  // Saved choice (including sittings merged by hand under another name) +
  // sittings that arrived later (e.g. the Writing sitting of a split
  // mid-term), except those the teacher unticked.
  const off = new Set(Array.isArray(saved?.mergeOff) ? saved.mergeOff : []);
  const reports = new Map();
  const reportOf = async (x) => { if (!reports.has(x)) reports.set(x, await getReport(x)); return reports.get(x); };
  const extras = new Map();
  let chosen = [];
  const want = Array.isArray(saved?.mergeIds) ? [...saved.mergeIds] : [];
  // A sheet merged in by hand may itself hold other sittings: take those too.
  for (let i = 0; i < want.length && chosen.length < 20; i++) {
    const x = want[i];
    if (x === s.id || chosen.includes(x)) continue;
    if (!sibIds.has(x)) {
      const row = await sittingRow(x);
      if (!row) continue;
      extras.set(x, { ...row, manual: true });
    }
    chosen.push(x);
    for (const y of (await reportOf(x))?.mergeIds || []) if (!want.includes(y)) want.push(y);
  }
  const allSibs = [...sibs, ...extras.values()];
  const base = { ...s, skills_included: [...new Set([...skillsOf(s), ...allSibs.filter((x) => chosen.includes(x.id)).flatMap(skillsOf)])] };
  const mergeIds = [...chosen, ...autoMerge(base, sibs.filter((x) => !off.has(x.id) && !chosen.includes(x.id)))];

  // This sheet was never saved but a sitting it would take in already has
  // a saved sheet that takes this one in too: open that one instead.
  if (!saved && !noRedirect && depth < 3) {
    for (const x of mergeIds) {
      if (!(await reportOf(x))) continue;
      const other = await loadSheet(x, { noRedirect: true, depth: depth + 1 });
      if (other.initial?.mergeIds?.includes(s.id)) return { s, redirectTo: x };
    }
  }
  const merged = (await Promise.all(mergeIds.map((x) => getSubmissionFull(x)))).filter(Boolean);
  const kept = fillFrom(saved, await Promise.all(mergeIds.map(reportOf)));
  const hasSaved = Boolean(saved) || teacherContent(kept) > 0;

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
  const defaults = hasSaved ? {} : await classDefaults(s.effective_class);

  // Teacher accounts: the teacher of each sitting (from its link, or set
  // on it by the admin) and the level of the link. On a sheet not saved
  // yet they fill the "Teacher" / "Level" lines; sheets of links without a
  // teacher (all older links) stay exactly as before.
  const sittings = [s, ...merged];
  const tids = [...new Set(sittings.map((m) => m.eff_teacher_id).filter(Boolean))];
  const names = {};
  if (tids.length) {
    const { rows: ts } = await sql`SELECT id, name, email FROM teachers WHERE id = ANY(${tids}::text[])`;
    for (const t of ts) names[t.id] = t.name || t.email;
  }
  const parts = sittings.map((m) => ({
    id: m.id, skills: skillsOf(m), teacherId: m.eff_teacher_id || null, speaking: Boolean(m.with_speaking),
    doneAt: m.teacher_done_at ? new Date(m.teacher_done_at).toISOString() : null,
  }));
  const assigned = {};
  const tnames = tids.map((x) => names[x]).filter(Boolean);
  if (tnames.length) assigned.teacher = tnames.join(" & ");
  const lvl = sittings.map((m) => (m.session_level || "").trim()).find(Boolean);
  if (lvl) assigned.level = lvl;
  const initial = {
    template: ["midterm", "final"].includes(category) ? "full" : "short",
    testTitle: TITLE_BY_CATEGORY[category] || (s.bank_name || (aptis ? "APTIS ESOL" : "TEST")).toLocaleUpperCase("vi"),
    className: s.effective_class || "",
    teacher: "", level: "", levelNote: "",
    speaking: "", total: "",
    cListening: "", cSpeaking: "", cReading: "",
    classSituation: "", direction: "",
    ...defaults,
    ...assigned,
    ...kept,
    comment: freshAuto(kept.comment, kept.autoW, autoW),
    cWriting: freshAuto(kept.cWriting, kept.autoW, autoW),
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
    parts,
    teacherNames: names,
    owners: skillOwners(parts, names),
    createdAt: new Date(s.created_at).toISOString(),
    primary: { id: s.id, created_at: new Date(s.created_at).toISOString(), skills: skillsOf(s), bank_name: s.bank_name || "" },
    siblings: allSibs.map((x) => ({
      id: x.id, created_at: new Date(x.created_at).toISOString(), skills: skillsOf(x), bank_name: x.bank_name || "",
      session_name: x.session_name || "", graded: Boolean(x.graded), included: mergeIds.includes(x.id),
      name: x.student_name || "", manual: Boolean(x.manual),
    })),
  };
  return { s, data, initial };
}

// The sheet a submission belongs to, following "this sitting is merged
// into that sheet" links: { s, data, initial } of the sheet shown.
export async function resolveSheet(id) {
  const seen = new Set();
  let x = await loadSheet(id);
  while (x.redirectTo && !seen.has(x.redirectTo) && seen.size < 5) {
    seen.add(x.redirectTo);
    const next = await loadSheet(x.redirectTo);
    if (!next.s) break;
    x = next;
  }
  if (x.redirectTo) x = await loadSheet(x.s.id, { noRedirect: true });
  return x;
}

// Sittings that could belong to this student but were typed under another
// name: same class (or, with a search text, any class) within 60 days.
export async function mergeCandidates(s, q = "") {
  const at = new Date(s.created_at).toISOString();
  const key = q.toString().normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase().slice(0, 60);
  const { rows } = await sql`
    SELECT s.id, s.student_name, s.created_at, s.skills_included, s.graded, s.content_bank_id, s.session_id,
           o.bank_name, o.session_name, o.class_name, o.class_name AS effective_class
    FROM submission_overview_v1 o JOIN submissions s ON s.id = o.id
    WHERE s.id <> ${s.id}
      AND o.student_key <> ${s.student_key}
      AND s.created_at BETWEEN ${at}::timestamptz - interval '60 days' AND ${at}::timestamptz + interval '60 days'
      AND (CASE WHEN ${key} = '' THEN COALESCE(o.class_name, '') = COALESCE(${s.effective_class || null}, '')
                ELSE o.student_key LIKE '%' || ${key} || '%' END)
    ORDER BY (COALESCE(s.content_bank_id, '') = COALESCE(${s.content_bank_id || null}, '')) DESC, o.student_key, s.created_at DESC
    LIMIT 80`;
  return rows.map((x) => ({
    id: x.id, name: x.student_name, created_at: new Date(x.created_at).toISOString(), skills: skillsOf(x),
    graded: Boolean(x.graded), bank_name: x.bank_name || "", session_name: x.session_name || "", class_name: x.class_name || "",
    sameTest: (x.content_bank_id || "") === (s.content_bank_id || ""), session_id: x.session_id, effective_class: x.effective_class,
  }));
}

// Classmates whose every sitting is already merged into another student's
// sheet (typed under another name) are not listed on their own.
async function withoutMerged(list) {
  const ids = list.flatMap((c) => c.ids || [c.id]);
  if (!ids.length) return list;
  await ensureReportSchema();
  const { rows } = await sql`SELECT submission_id, data->'mergeIds' AS m FROM sheet_reports WHERE data->'mergeIds' ?| ${ids}::text[]`;
  const ownerOf = new Map();
  for (const r of rows) for (const x of Array.isArray(r.m) ? r.m : []) if (x !== r.submission_id) ownerOf.set(x, r.submission_id);
  return list.filter((c) => {
    const mine = c.ids || [c.id];
    return !mine.every((x) => ownerOf.has(x) && !mine.includes(ownerOf.get(x)) && !mine.includes(ownerOf.get(ownerOf.get(x))));
  });
}

// The other students of the same class who took the same test (±60 days):
// one entry per student, for the "next student" list and the whole-class
// Word file. The sheet of each is resolved by loadSheet (merges / owners).
export async function classmatesOf(s, tid = null) {
  if (!s?.effective_class) return [];
  const at = new Date(s.created_at).toISOString();
  const { rows } = await sql`
    SELECT (array_agg(o.id ORDER BY o.created_at))[1] AS id,
           (array_agg(o.student_name ORDER BY o.created_at DESC))[1] AS student_name,
           (array_agg(o.session_id ORDER BY o.created_at))[1] AS session_id,
           ${s.effective_class}::text AS effective_class,
           array_agg(o.id) AS ids,
           bool_or(COALESCE(o.skills_included, '["writing"]'::jsonb) ? 'writing' AND NOT COALESCE(o.graded, false)) AS needs_grading,
           bool_or(o.skills_included IS NULL OR o.skills_included ? 'reading') AS has_reading,
           bool_or(o.skills_included IS NULL OR o.skills_included ? 'listening') AS has_listening,
           bool_or(o.skills_included IS NULL OR o.skills_included ? 'writing') AS has_writing,
           bool_or(o.skills_included ? 'grammar') AS has_grammar,
           COALESCE(bool_and(o.teacher_done_at IS NOT NULL) FILTER (WHERE o.teacher_id IS NOT NULL AND (${tid}::text IS NULL OR o.teacher_id = ${tid})), false) AS handed_in
    FROM submission_overview_v1 o
    WHERE o.class_name = ${s.effective_class}
      AND COALESCE(o.content_bank_id, '') = COALESCE(${s.content_bank_id || null}, '')
      AND o.created_at BETWEEN ${at}::timestamptz - interval '60 days' AND ${at}::timestamptz + interval '60 days'
    GROUP BY o.student_key
    LIMIT 200`;
  return (await withoutMerged(rows)).sort((a, b) => a.student_name.localeCompare(b.student_name, "vi"));
}

// The class list beside the sheet editor: per student, how far the sheet
// is filled in — "todo" (nothing written yet), "doing" (some fields still
// empty: missing = how many), "done".
export async function withSheetStatus(list, template) {
  const ids = list.flatMap((c) => c.ids || [c.id]);
  const byId = new Map();
  if (ids.length) {
    await ensureReportSchema();
    const { rows } = await sql`SELECT submission_id, data FROM sheet_reports WHERE submission_id = ANY(${ids}::text[])`;
    for (const r of rows) byId.set(r.submission_id, r.data);
  }
  return list.map((c) => {
    const reps = (c.ids || [c.id]).map((x) => byId.get(x)).filter(Boolean);
    const rep = reps.sort((a, b) => teacherContent(b) - teacherContent(a))[0] || null;
    const skills = ["grammar", "reading", "listening", "writing"].filter((k) => c[`has_${k}`]);
    const missing = missingFields({ template, ...(rep || {}) }, skills, { writingReady: !c.needs_grading }).length;
    const status = !rep || !teacherContent(rep) ? "todo" : missing ? "doing" : "done";
    return { ...c, status, missing };
  });
}

// Admin "Bảng nhập nhanh": one resolved sheet per student of a class for
// one test (all dates), in name order.
export async function sheetsForClass(cls, bankId) {
  if (!cls) return [];
  const { rows } = await sql`
    SELECT (array_agg(o.id ORDER BY o.created_at))[1] AS id
    FROM submission_overview_v1 o
    WHERE o.class_name = ${cls} AND COALESCE(o.content_bank_id, '') = COALESCE(${bankId || null}, '')
    GROUP BY o.student_key
    LIMIT 300`;
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    const x = await resolveSheet(r.id);
    if (!x.s || !x.data || seen.has(x.data.id)) continue;
    seen.add(x.data.id);
    for (const p of x.data.parts) seen.add(p.id);
    out.push(x);
  }
  return out.sort((a, b) => a.data.name.localeCompare(b.data.name, "vi"));
}
