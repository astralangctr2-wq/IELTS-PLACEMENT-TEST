import { aptisScaleFromRaw, aptisCefr, aptisNearCut, aptisLevelUp, aptisOverallCefr } from "./grading";

const roundHalf = (n) => Math.round(n * 2) / 2;

// Columns of the "Test results" table on the Astra sheet — shared by the
// on-screen sheet and the Word export so both always show the same numbers.
export const fmt = (v) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? "" : Number(v).toFixed(1));

// Aptis: each skill on the 0–50 scale with its CEFR level (a level the
// admin raised from the grey area — r.cefrUp "listening,reading" — counts
// one up). With all four skills: TOTAL = sum out of 200 + overall CEFR.
export function aptisSkills(data, r) {
  const has = (k) => data.skills.includes(k);
  const up = new Set((r?.cefrUp || "").toString().split(",").filter(Boolean));
  const sp = (r?.speaking ?? "").toString().trim();
  const spN = sp !== "" && Number.isFinite(Number(sp)) ? Number(sp) : null;
  const score = {
    listening: has("listening") ? aptisScaleFromRaw(data.listening[0], data.listening[1]) : null,
    reading: has("reading") ? aptisScaleFromRaw(data.reading[0], data.reading[1]) : null,
    writing: has("writing") && Number.isInteger(data.writingBand) ? data.writingBand : null,
    speaking: spN !== null && spN >= 0 && spN <= 50 ? spN : null,
  };
  const out = {};
  for (const k of ["listening", "reading", "writing", "speaking"]) {
    const v = score[k];
    const base = v === null ? null : aptisCefr(k, v);
    out[k] = { score: v, cefr: base && up.has(k) ? aptisLevelUp(base) : base, raised: Boolean(base && up.has(k)), near: v === null || up.has(k) ? null : aptisNearCut(k, v) };
  }
  const four = ["listening", "reading", "writing", "speaking"].every((k) => out[k].score !== null);
  out.total = four ? ["listening", "reading", "writing", "speaking"].reduce((a, k) => a + out[k].score, 0) : null;
  out.overall = four ? aptisOverallCefr(["listening", "reading", "writing", "speaking"].map((k) => out[k].cefr)) : null;
  return out;
}

export function scoreColumns(data, r) {
  const full = r.template === "full";
  const has = (k) => data.skills.includes(k);
  if (data.aptis) {
    const a = aptisSkills(data, r);
    const sc = (k) => a[k].score;
    const four = a.total !== null;
    return [
      has("listening") && { name: "Listening", max: 50, val: sc("listening"), sub: a.listening.cefr || "" },
      has("reading") && { name: "Reading", max: 50, val: sc("reading"), sub: a.reading.cefr || "" },
      has("writing") && { name: "Writing", max: 50, val: data.writingBand, sub: Number.isInteger(data.writingBand) ? a.writing.cefr || "" : "" },
      (r.speaking !== "" || full) && { name: "Speaking", max: 50, val: r.speaking, sub: a.speaking.cefr || "" },
      four && { name: "TOTAL", max: 200, val: (r.total || "").toString().trim() || a.total, sub: a.overall || "" },
    ].filter(Boolean);
  }
  const autoTotal = ieltsAutoTotal(data, r);
  return [
    has("grammar") && { name: "Grammar", max: data.grammar[1], val: data.grammar[0] },
    has("reading") && { name: "Reading", max: data.reading[1], val: data.reading[0] },
    has("listening") && { name: "Listening", max: data.listening[1], val: data.listening[0] },
    has("writing") && { name: "Writing", max: 9, val: fmt(data.writingBand) },
    (full || r.speaking !== "") && { name: "Speaking", max: 9, val: fmt(r.speaking) },
    full && { name: "TOTAL", max: 9, val: r.total !== "" ? fmt(r.total) : fmt(autoTotal) },
  ].filter(Boolean);
}

// IELTS TOTAL suggestion: band cuối (trắc nghiệm + Writing). Once Speaking
// is entered: average of the skills, Reading and Listening each counted.
export function ieltsAutoTotal(data, r) {
  const has = (k) => data.skills.includes(k);
  let autoTotal = data.graded ? data.finalBand : !has("writing") ? data.objectiveBand : null;
  const sp = r.speaking !== "" && Number.isFinite(Number(r.speaking)) ? Number(r.speaking) : null;
  if (sp !== null && data.graded) {
    const nObj = (has("reading") ? 1 : 0) + (has("listening") ? 1 : 0);
    const parts = [...(data.objectiveBand !== null ? Array(Math.max(1, nObj)).fill(data.objectiveBand) : []), ...(has("writing") && data.writingBand !== null ? [data.writingBand] : []), sp];
    autoTotal = roundHalf(parts.reduce((a, b) => a + b, 0) / parts.length);
  }
  return autoTotal;
}

export const show = (v) => (v === null || v === undefined ? "" : String(v));
