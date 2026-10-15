// Per-question answer review on the teacher grading page. Uses the same
// reviewQuestion() as the student practice review (lib/review.js), so every
// question type is shown — mc, gap, multi_select, matching, heading_match,
// text_completion (table / notes / form), reorder — with the student's
// answer next to the key, and the ✓/✗ marks always agree with the score.

import { reviewQuestion } from "@/lib/review";

export default function AnswerReview({ title, questions, answers }) {
  if (!questions || questions.length === 0) return null;

  // Group by section (the snapshot is a flat list tagged with sectionTitle).
  const groups = [];
  let running = 0;
  let earned = 0;
  let total = 0;
  for (const q of questions) {
    const it = reviewQuestion(q, answers ? answers[q.id] : undefined);
    if (!it) continue;
    const start = running + 1;
    running += Math.max(1, it.total);
    earned += it.earned;
    total += it.total;
    const sec = q.sectionTitle || "";
    if (!groups.length || groups[groups.length - 1].title !== sec) groups.push({ title: sec, items: [] });
    groups[groups.length - 1].items.push({ it, start, end: running });
  }

  return (
    <div className="card answer-review">
      <div className="ar-head">
        <p className="mono muted" style={{ fontSize: 12, margin: 0 }}>{title}</p>
        <span className="mono" style={{ fontSize: 12 }}>Đúng {earned}/{total}</span>
      </div>
      {groups.map((g, gi) => (
        <div key={gi} className="practice-section">
          {g.title && <p className="practice-section-title">{g.title}</p>}
          {g.items.map(({ it, start, end }) => {
            const full = it.total > 0 && it.earned === it.total;
            const status = full ? "ok" : it.earned > 0 ? "partial" : "bad";
            return (
              <div key={it.id} className={`practice-item ${status}`}>
                <div className="practice-item-head">
                  <span className="practice-num">{start === end ? `Câu ${start}` : `Câu ${start}–${end}`}</span>
                  <span className={`practice-badge ${status}`}>
                    {full ? "✓ Đúng" : it.earned > 0 ? `${it.earned}/${it.total} đúng` : "✗ Sai"}
                  </span>
                </div>
                {it.q && <p className="practice-q">{it.q}</p>}
                <div className="practice-parts">
                  {it.parts.map((p, pi) => (
                    <div key={pi} className={`practice-part ${p.ok ? "ok" : "bad"}`}>
                      {p.label && <p className="practice-part-label">{p.label}</p>}
                      <p className="practice-line">
                        <span className="practice-tag">HV trả lời</span>
                        <span className={p.ok ? "practice-ok" : "practice-bad"}>{p.ok ? "✓" : "✗"} {p.given}</span>
                      </p>
                      {!p.ok && (
                        <p className="practice-line">
                          <span className="practice-tag">Đáp án</span>
                          <span className="practice-ok">{p.correct}</span>
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
