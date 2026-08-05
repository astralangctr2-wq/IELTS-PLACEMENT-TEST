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

// Scores a flat list of questions (any mix of mc / gap / multi_select)
// against a { [questionId]: answer } map. Returns integer earned/total
// points — multi_select questions are worth as many points as they have
// correct options, other types are worth 1 point each.
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
    }
  }
  return { earned, total };
}
