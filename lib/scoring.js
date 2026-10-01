export function bandFromScore(correct, total) {
  const pct = total > 0 ? correct / total : 0;
  if (pct >= 0.9) return 8.0;
  if (pct >= 0.75) return 7.0;
  if (pct >= 0.6) return 6.0;
  if (pct >= 0.45) return 5.0;
  if (pct >= 0.25) return 4.0;
  return 3.0;
}

export function levelLabel(band) {
  if (band >= 7.5) return "Advanced (C1+)";
  if (band >= 6.5) return "Upper-Intermediate (B2)";
  if (band >= 5.5) return "Intermediate (B1+)";
  if (band >= 4.5) return "Pre-Intermediate (B1)";
  if (band >= 3.5) return "Elementary (A2)";
  return "Beginner (A1–A2)";
}

export function roundHalf(n) {
  return Math.round(n * 2) / 2;
}

function normalizeGapAnswer(s) {
  return (s ?? "").toString().trim().toLowerCase();
}

// Scores a flat list of questions (any mix of mc / gap / multi_select /
// reorder / heading_match / matching / text_completion) against a
// { [questionId]: answer } map. Returns integer earned/total points —
// multi_select, heading_match, matching and text_completion are worth as
// many points as they have correct sub-answers (options / paragraphs /
// items / lines respectively), other types are worth 1 point each.
export function scoreQuestions(answers, questions) {
  let earned = 0;
  let total = 0;
  for (const q of questions) {
    const type = q.type || "mc";
    const given = answers ? answers[q.id] : undefined;

    if (type === "mc") {
      total += 1;
      if (given === q.a) earned += 1;
    } else if (type === "gap") {
      total += 1;
      const ok = Array.isArray(q.answers) && q.answers.some((acc) => normalizeGapAnswer(acc) === normalizeGapAnswer(given));
      if (ok) earned += 1;
    } else if (type === "multi_select") {
      const required = Array.isArray(q.a) ? q.a : [];
      total += required.length;
      const chosen = Array.isArray(given) ? given : [];
      const correctChosen = chosen.filter((i) => required.includes(i)).length;
      earned += Math.min(correctChosen, required.length);
    } else if (type === "reorder") {
      // given: array of opts-indices in the order the student placed them.
      // 1 point per sentence placed in its correct position (partial credit),
      // same spirit as multi_select/heading_match below.
      const correct = Array.isArray(q.correctOrder) ? q.correctOrder : [];
      total += correct.length;
      const chosen = Array.isArray(given) ? given : [];
      earned += correct.filter((idx, pos) => chosen[pos] === idx).length;
    } else if (type === "heading_match") {
      // given: array of headings-indices, one per paragraph, same order
      // as q.paragraphs/q.answers. 1 point per paragraph matched correctly.
      const correct = Array.isArray(q.answers) ? q.answers : [];
      total += correct.length;
      const chosen = Array.isArray(given) ? given : [];
      earned += correct.filter((idx, pos) => chosen[pos] === idx).length;
    } else if (type === "matching") {
      // given: array of options-indices, one per item, same order as
      // q.items/q.answers (IELTS Matching Headings/Information/Features/
      // Sentence Endings). 1 point per item matched correctly.
      const correct = Array.isArray(q.answers) ? q.answers : [];
      total += correct.length;
      const chosen = Array.isArray(given) ? given : [];
      earned += correct.filter((idx, pos) => chosen[pos] === idx).length;
    } else if (type === "text_completion") {
      // given: array of strings, one per line, same order as
      // q.lines/q.answers (IELTS Summary/Notes/Table/Flow-chart/Form
      // Completion). 1 point per blank, same accepted-answers matching
      // as "gap" (case-insensitive, trimmed, any accepted string).
      const acceptedPerLine = Array.isArray(q.answers) ? q.answers : [];
      total += acceptedPerLine.length;
      const chosen = Array.isArray(given) ? given : [];
      earned += acceptedPerLine.filter(
        (accepted, pos) => Array.isArray(accepted) && accepted.some((acc) => normalizeGapAnswer(acc) === normalizeGapAnswer(chosen[pos]))
      ).length;
    }
  }
  return { earned, total };
}
