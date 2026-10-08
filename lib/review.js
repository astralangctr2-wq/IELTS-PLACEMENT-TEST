// Builds the per-question answer review shown to students in PRACTICE mode
// after they submit. Server-only: it reads the answer key, so it must only
// ever be sent to the browser for a session whose mode is "practice" (the
// submissions route checks that against the database, not the client).
//
// Points per question come from scoreQuestions() itself — the exact same
// function that produces the recorded score — so the review can never
// disagree with the score. The per-part ✓/✗ marks use the same matching
// rules as lib/scoring.js (case-insensitive, trimmed for typed answers).

import { scoreQuestions } from "./scoring";

const norm = (s) => (s ?? "").toString().trim().toLowerCase();
const BLANK = "(bỏ trống)";
const shown = (v) => (v === null || v === undefined || String(v).trim() === "" ? BLANK : String(v));
const pick = (list, idx) => (Number.isInteger(idx) && list && idx >= 0 && idx < list.length ? list[idx] : null);
const letter = (i) => String.fromCharCode(65 + i);
const optLabel = (opts, idx) => {
  const t = pick(opts, idx);
  return t === null ? null : `${letter(idx)}. ${t}`;
};
const blankText = (s) => (s || "").replace(/_{3,}/g, "____").replace(/^\s*-\s?/, "").replace(/^#\s+/, "").trim();

// Returns the blanks of a text_completion question in answer order, each
// with a short label so the student can tell which blank is which.
function completionBlanks(q) {
  if (q.format === "table") {
    const out = [];
    for (const row of q.rows || []) {
      for (const cell of row) {
        if (typeof cell === "string" && cell.includes("___")) {
          const head = typeof row[0] === "string" && row[0] !== cell ? `${row[0].trim()} ` : "";
          out.push(blankText(`${head}${cell}`));
        }
      }
    }
    return out;
  }
  return (q.lines || [])
    .map((l) => l.text || "")
    .filter((t) => !t.startsWith("# ") && t.replace(/^\s*-\s?/, "").includes("___"))
    .map(blankText);
}

function reviewQuestion(q, given) {
  const type = q.type || "mc";
  if (type === "note") return null;
  const { earned, total } = scoreQuestions({ [q.id]: given }, [q]);
  const base = { id: q.id, type, q: q.q || q.title || "", earned, total };
  if (q.explain) base.explain = q.explain;

  if (type === "mc") {
    return { ...base, parts: [{ given: shown(optLabel(q.opts, given)), correct: optLabel(q.opts, q.a), ok: earned === total }] };
  }
  if (type === "gap") {
    return { ...base, parts: [{ given: shown(given), correct: (q.answers || []).join(" / "), ok: earned === total }] };
  }
  if (type === "multi_select") {
    const chosen = Array.isArray(given) ? given : [];
    return {
      ...base,
      parts: [{
        given: chosen.length ? chosen.map((i) => optLabel(q.opts, i)).filter(Boolean).join("; ") : BLANK,
        correct: (q.a || []).map((i) => optLabel(q.opts, i)).join("; "),
        ok: earned === total,
      }],
    };
  }
  if (type === "matching") {
    const arr = Array.isArray(given) ? given : [];
    return {
      ...base,
      parts: (q.items || []).map((item, i) => ({
        label: item,
        given: shown(pick(q.options, arr[i])),
        correct: pick(q.options, q.answers[i]),
        ok: arr[i] === q.answers[i],
      })),
    };
  }
  if (type === "text_completion") {
    const arr = Array.isArray(given) ? given : [];
    const labels = completionBlanks(q);
    return {
      ...base,
      parts: (q.answers || []).map((accepted, i) => ({
        label: labels[i] || `Chỗ trống ${i + 1}`,
        given: shown(arr[i]),
        correct: (accepted || []).join(" / "),
        ok: (accepted || []).some((a) => norm(a) === norm(arr[i])),
      })),
    };
  }
  if (type === "reorder") {
    const arr = Array.isArray(given) ? given : [];
    return {
      ...base,
      parts: (q.correctOrder || []).map((idx, pos) => ({
        label: `Vị trí ${pos + 1}`,
        given: shown(pick(q.opts, arr[pos])),
        correct: pick(q.opts, idx),
        ok: arr[pos] === idx,
      })),
    };
  }
  if (type === "heading_match") {
    const arr = Array.isArray(given) ? given : [];
    return {
      ...base,
      parts: (q.answers || []).map((idx, i) => ({
        label: `Đoạn ${i + 1}`,
        given: shown(pick(q.headings, arr[i])),
        correct: pick(q.headings, idx),
        ok: arr[i] === idx,
      })),
    };
  }
  return { ...base, parts: [] };
}

function reviewList(questions, answers) {
  return (questions || []).map((q) => reviewQuestion(q, answers ? answers[q.id] : undefined)).filter(Boolean);
}

// content: id-tagged content WITH answers (getActiveContentWithAnswers).
// answers: { grammar, reading, listening } as submitted.
export function buildReview(content, answers, skillsIncluded) {
  const out = {};
  const has = (s) => skillsIncluded.includes(s);
  if (has("grammar") && content.grammar) {
    out.grammar = [{ title: "", items: reviewList(content.grammar, answers.grammar) }];
  }
  for (const skill of ["reading", "listening"]) {
    if (!has(skill) || !content[skill]?.sections) continue;
    out[skill] = content[skill].sections.map((sec) => ({
      title: sec.title || "",
      items: reviewList(sec.questions, answers[skill]),
    }));
  }
  return out;
}
