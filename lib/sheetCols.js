import { aptisScaleFromRaw, aptisCefr } from "./grading";

const roundHalf = (n) => Math.round(n * 2) / 2;

// Columns of the "Test results" table on the Astra sheet — shared by the
// on-screen sheet and the Word export so both always show the same numbers.
export const fmt = (v) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? "" : Number(v).toFixed(1));

export function scoreColumns(data, r) {
  const full = r.template === "full";
  const has = (k) => data.skills.includes(k);
  if (data.aptis) {
    const sc = (k) => (has(k) ? aptisScaleFromRaw(data[k][0], data[k][1]) : null);
    return [
      has("listening") && { name: "Listening", max: 50, val: sc("listening"), sub: sc("listening") !== null ? aptisCefr("listening", sc("listening")) : "" },
      has("reading") && { name: "Reading", max: 50, val: sc("reading"), sub: sc("reading") !== null ? aptisCefr("reading", sc("reading")) : "" },
      has("writing") && { name: "Writing", max: 50, val: data.writingBand, sub: Number.isInteger(data.writingBand) ? aptisCefr("writing", data.writingBand) : "" },
      (r.speaking !== "" || full) && { name: "Speaking", max: 50, val: r.speaking, sub: "" },
    ].filter(Boolean);
  }
  // TOTAL suggestion: band cuối (trắc nghiệm + Writing). Once Speaking is
  // entered: average of the skills, Reading and Listening each counted.
  let autoTotal = data.graded ? data.finalBand : !has("writing") ? data.objectiveBand : null;
  const sp = r.speaking !== "" && Number.isFinite(Number(r.speaking)) ? Number(r.speaking) : null;
  if (sp !== null && data.graded) {
    const nObj = (has("reading") ? 1 : 0) + (has("listening") ? 1 : 0);
    const parts = [...(data.objectiveBand !== null ? Array(Math.max(1, nObj)).fill(data.objectiveBand) : []), ...(has("writing") && data.writingBand !== null ? [data.writingBand] : []), sp];
    autoTotal = roundHalf(parts.reduce((a, b) => a + b, 0) / parts.length);
  }
  return [
    has("grammar") && { name: "Grammar", max: data.grammar[1], val: data.grammar[0] },
    has("reading") && { name: "Reading", max: data.reading[1], val: data.reading[0] },
    has("listening") && { name: "Listening", max: data.listening[1], val: data.listening[0] },
    has("writing") && { name: "Writing", max: 9, val: fmt(data.writingBand) },
    (full || r.speaking !== "") && { name: "Speaking", max: 9, val: fmt(r.speaking) },
    full && { name: "TOTAL", max: 9, val: r.total !== "" ? fmt(r.total) : fmt(autoTotal) },
  ].filter(Boolean);
}

export const show = (v) => (v === null || v === undefined ? "" : String(v));
