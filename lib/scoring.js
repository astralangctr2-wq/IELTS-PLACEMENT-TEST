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
