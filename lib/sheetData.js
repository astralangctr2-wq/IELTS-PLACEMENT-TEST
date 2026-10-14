import { sql } from "./db";
import { getSubmissionFull } from "./classes";
import { getReport, classDefaults } from "./report";
import { IELTS_CRITERIA, ieltsTasksOf, ieltsCriterionLabel } from "./grading";
import { fmt } from "./sheetCols";

const TITLE_BY_CATEGORY = { midterm: "MID-TERM TEST", final: "FINAL TEST", placement: "PLACEMENT TEST" };

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

// Everything the result sheet needs: the submission's scores (data) and the
// teacher-filled fields (initial = saved values, else class defaults, else
// values derived from the test and the grade).
export async function loadSheet(id) {
  const s = await getSubmissionFull(id);
  if (!s) return { s: null };
  const { rows } = s.content_bank_id ? await sql`SELECT category FROM content_banks WHERE id = ${s.content_bank_id} LIMIT 1` : { rows: [] };
  const category = rows[0]?.category || "other";
  const aptis = s.exam_kind === "aptis";
  const g = s.grading && s.grading.type === (aptis ? "aptis" : "ielts") ? s.grading : null;
  const saved = await getReport(s.id);
  const defaults = saved ? {} : await classDefaults(s.effective_class);

  const initial = {
    template: ["midterm", "final"].includes(category) ? "full" : "short",
    testTitle: TITLE_BY_CATEGORY[category] || (s.bank_name || (aptis ? "APTIS ESOL" : "TEST")).toLocaleUpperCase("vi"),
    className: s.effective_class || "",
    teacher: "", level: "", levelNote: "",
    speaking: "", total: "",
    comment: aptis ? writingComment(g) : g?.note || "",
    cListening: "", cSpeaking: "", cReading: "", cWriting: writingComment(g),
    classSituation: "", direction: "",
    ...defaults,
    ...(saved || {}),
  };

  const data = {
    id: s.id,
    name: s.student_name,
    aptis,
    skills: Array.isArray(s.skills_included) ? s.skills_included : ["grammar", "reading", "listening", "writing"],
    grammar: [s.grammar_score, s.grammar_total],
    reading: [s.reading_score, s.reading_total],
    listening: [s.listening_score, s.listening_total],
    objectiveBand: s.objective_band !== null ? Number(s.objective_band) : null,
    graded: Boolean(s.graded),
    finalBand: s.final_band !== null ? Number(s.final_band) : null,
    writingBand: g ? (aptis ? g.writingScore : g.writingBand) : null,
    createdAt: new Date(s.created_at).toISOString(),
  };
  return { s, data, initial };
}
