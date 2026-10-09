// Class statistics (teacher only). Pure computations over the rows returned
// by listForClass() — one class, one test type, optionally one test.

import { scoreQuestions } from "./scoring";
import { IELTS_CRITERIA, APTIS_WRITING_PARTS, aptisScaleFromRaw, aptisCefr } from "./grading";

const SKILLS = ["grammar", "reading", "listening"];
export const SKILL_LABEL = { grammar: "Ngữ pháp & Từ vựng", reading: "Reading", listening: "Listening", writing: "Writing" };
export const CEFR_ORDER = ["A0", "A1", "A2", "B1", "B2", "C"];

const skillsOf = (r) => (Array.isArray(r.skills_included) ? r.skills_included : ["grammar", "reading", "listening", "writing"]);
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const summarize = (xs) => (xs.length ? { avg: avg(xs), min: Math.min(...xs), max: Math.max(...xs), n: xs.length } : null);
const round1 = (x) => (x === null ? null : Math.round(x * 10) / 10);

function countBy(values, order) {
  const m = new Map();
  for (const v of values) m.set(v, (m.get(v) || 0) + 1);
  const keys = order ? order.filter((k) => m.has(k)) : [...m.keys()].sort((a, b) => a - b);
  return keys.map((k) => ({ key: k, n: m.get(k) }));
}

// Result shown per attempt (and used for per-student progress).
export function attemptScore(r, type) {
  if (type === "aptis") {
    const parts = [];
    const sk = skillsOf(r);
    if (sk.includes("listening")) parts.push(["L", aptisScaleFromRaw(r.listening_score, r.listening_total)]);
    if (sk.includes("reading")) parts.push(["R", aptisScaleFromRaw(r.reading_score, r.reading_total)]);
    if (sk.includes("writing")) parts.push(["W", r.grading?.type === "aptis" ? r.grading.writingScore : null]);
    const known = parts.filter(([, v]) => v !== null);
    const label = parts.map(([k, v]) => `${k} ${v ?? "—"}`).join(" · ");
    const value = known.length === parts.length && parts.length ? known.reduce((a, [, v]) => a + v, 0) / parts.length : null;
    return { label, value, pending: parts.some(([, v]) => v === null) };
  }
  const graded = r.graded && r.final_band !== null;
  const band = graded ? Number(r.final_band) : r.objective_band !== null ? Number(r.objective_band) : null;
  const pending = skillsOf(r).includes("writing") && !r.graded;
  return { label: band === null ? "—" : `${band.toFixed(1)}${pending ? "*" : ""}`, value: band, pending };
}

export function computeStats(rows, type) {
  const out = { count: rows.length, studentCount: new Set(rows.map((r) => r.student_key)).size, ungraded: rows.filter((r) => skillsOf(r).includes("writing") && !r.graded).length };

  if (type === "aptis") {
    out.skills = [];
    for (const sk of ["listening", "reading"]) {
      const vals = rows.filter((r) => skillsOf(r).includes(sk) && r[`${sk}_total`]).map((r) => aptisScaleFromRaw(r[`${sk}_score`], r[`${sk}_total`]));
      const s = summarize(vals);
      if (s) out.skills.push({ key: sk, label: SKILL_LABEL[sk], ...s, avg: round1(s.avg), unit: "/50", cefr: countBy(vals.map((v) => aptisCefr(sk, v)), CEFR_ORDER) });
    }
    const w = rows.filter((r) => r.grading?.type === "aptis");
    const wv = w.map((r) => r.grading.writingScore);
    const ws = summarize(wv);
    if (ws) out.skills.push({ key: "writing", label: "Writing", ...ws, avg: round1(ws.avg), unit: "/50", cefr: countBy(wv.map((v) => aptisCefr("writing", v)), CEFR_ORDER) });
    out.writingParts = w.length
      ? APTIS_WRITING_PARTS.map((p) => ({ label: p.label, max: p.max, avg: round1(avg(w.map((r) => r.grading.parts?.[p.key] ?? 0))) }))
      : [];
  } else {
    out.skills = [];
    for (const sk of SKILLS) {
      const rs = rows.filter((r) => skillsOf(r).includes(sk) && r[`${sk}_total`]);
      if (!rs.length) continue;
      const pct = rs.map((r) => (100 * r[`${sk}_score`]) / r[`${sk}_total`]);
      const s = summarize(pct);
      const totals = new Set(rs.map((r) => r[`${sk}_total`]));
      out.skills.push({
        key: sk, label: SKILL_LABEL[sk], ...s, avg: Math.round(s.avg), min: Math.round(s.min), max: Math.round(s.max), unit: "%",
        raw: totals.size === 1 ? { avg: round1(avg(rs.map((r) => r[`${sk}_score`]))), total: [...totals][0] } : null,
      });
    }
    const obj = summarize(rows.filter((r) => r.objective_band !== null).map((r) => Number(r.objective_band)));
    const wr = rows.filter((r) => r.grading?.type === "ielts");
    const wb = summarize(wr.map((r) => r.grading.writingBand));
    const fin = summarize(rows.filter((r) => r.graded && r.final_band !== null).map((r) => Number(r.final_band)));
    out.bands = [
      obj && { label: "Band trắc nghiệm", ...obj, avg: round1(obj.avg) },
      wb && { label: "Band Writing", ...wb, avg: round1(wb.avg) },
      fin && { label: "Band tổng (đã chấm)", ...fin, avg: round1(fin.avg) },
    ].filter(Boolean);
    out.bandDist = countBy(rows.map((r) => attemptScore(r, "ielts").value).filter((v) => v !== null));
    out.criteria = wr.length ? IELTS_CRITERIA.map((c) => ({ label: c.label, avg: round1(avg(wr.map((r) => r.grading.criteria?.[c.key]?.score ?? 0))) })) : [];
  }

  // Integrity (exam mode only)
  const levels = rows.map((r) => r.integrity?.summary?.level).filter(Boolean);
  out.integrity = {
    monitored: levels.length,
    medium: levels.filter((l) => l === "medium").length,
    high: levels.filter((l) => l === "high").length,
    flagged: rows.filter((r) => r.integrity?.summary?.level === "high").map((r) => ({ id: r.id, name: r.student_name, summary: r.integrity.summary, created_at: r.created_at })),
  };

  // Per student, attempts in date order.
  const byStudent = new Map();
  for (const r of rows) {
    if (!byStudent.has(r.student_key)) byStudent.set(r.student_key, { name: r.student_name.trim(), attempts: [] });
    const g = byStudent.get(r.student_key);
    g.attempts.push(r);
    const caps = (x) => (x.match(/\p{Lu}/gu) || []).length;
    if (caps(r.student_name) > caps(g.name)) g.name = r.student_name.trim();
  }
  out.students = [...byStudent.values()]
    .map((s) => {
      const attempts = s.attempts.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).map((r) => ({ id: r.id, date: r.created_at, bank: r.bank_name || "—", ...attemptScore(r, type), level: r.integrity?.summary?.level || null }));
      const vals = attempts.map((a) => a.value).filter((v) => v !== null);
      return { name: s.name, attempts, change: vals.length >= 2 ? round1(vals[vals.length - 1] - vals[0]) : null };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "vi"));

  return out;
}

// Questions the class got wrong most, for ONE test (all rows share the same
// questions). Each question group counts its blanks / items.
export function hardestQuestions(rows, limit = 12) {
  const ref = rows.find((r) => r.content_snapshot);
  if (!ref) return [];
  const out = [];
  for (const sk of SKILLS) {
    const qs = Array.isArray(ref.content_snapshot[sk]) ? ref.content_snapshot[sk] : [];
    const takers = rows.filter((r) => skillsOf(r).includes(sk) && r.answers);
    if (!qs.length || !takers.length) continue;
    let num = 0;
    for (const q of qs) {
      const w = scoreQuestions({}, [q]).total;
      if (!w) continue;
      const from = num + 1;
      num += w;
      let earned = 0, total = 0;
      for (const r of takers) {
        const s = scoreQuestions(r.answers[sk] || {}, [q]);
        earned += s.earned;
        total += s.total;
      }
      if (!total) continue;
      out.push({
        skill: SKILL_LABEL[sk],
        num: w > 1 ? `${from}–${num}` : `${from}`,
        text: (q.q || q.sectionTitle || "").toString().replace(/\s+/g, " ").slice(0, 140),
        section: q.sectionTitle || "",
        wrongPct: Math.round(100 * (1 - earned / total)),
        takers: takers.length,
      });
    }
  }
  return out.sort((a, b) => b.wrongPct - a.wrongPct).slice(0, limit);
}
