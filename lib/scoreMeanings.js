// "Ý nghĩa điểm số" shown on the result sheet under the scores, like the
// "Your scores explained" box of an official score report.
//
// EMPTY FOR NOW — the centre will supply the texts. Fill in one paragraph
// per score and the sheet shows it automatically (nothing else to change):
//
//   ielts: { listening: { "7": "Test takers at Band 7 can…", "7.5": "…" },
//            reading: {…}, writing: {…}, overall: {…} }
//   aptis: { listening: { B1: "…", B2: "…" }, reading: {…}, writing: {…} }
//
// IELTS keys are bands written like "6", "6.5"; a half band falls back to
// the whole band below it if it has no text of its own. Aptis keys are
// CEFR levels: A0, A1, A2, B1, B2, C.
export const SCORE_MEANINGS = {
  ielts: { listening: {}, reading: {}, writing: {}, overall: {} },
  aptis: { listening: {}, reading: {}, writing: {} },
};

export function scoreMeaning(test, skill, key) {
  const table = SCORE_MEANINGS[test]?.[skill];
  if (!table || key === null || key === undefined) return "";
  if (test === "ielts") {
    const b = Number(key);
    if (!Number.isFinite(b)) return "";
    return table[String(b)] || table[b.toFixed(1)] || table[String(Math.floor(b))] || "";
  }
  return table[key] || "";
}
