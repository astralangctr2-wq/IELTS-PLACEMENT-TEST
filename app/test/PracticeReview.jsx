"use client";

// Answer review shown after submitting in PRACTICE mode. Driven entirely by
// the `review` object the server returns for practice sessions (see
// lib/review.js), so it needs nothing from the runner except that object
// and the scores — the same component serves IELTS and Aptis.

import { useState } from "react";

const SKILLS = [
  ["grammar", "Ngữ pháp & Từ vựng"],
  ["listening", "Listening"],
  ["reading", "Reading"],
];

function sum(sections) {
  let earned = 0, total = 0;
  for (const s of sections) for (const it of s.items) { earned += it.earned; total += it.total; }
  return { earned, total };
}

// order: the skills in the order the student took them (IELTS: reading →
// listening; Aptis: listening → reading), so the review follows the test.
export default function PracticeReview({ review, studentName, hasWriting, order }) {
  const [onlyWrong, setOnlyWrong] = useState(false);
  const rank = (k) => { const i = (order || []).indexOf(k); return i === -1 ? 99 : i; };
  const skills = SKILLS.filter(([k]) => Array.isArray(review?.[k]) && review[k].length).sort((a, b) => rank(a[0]) - rank(b[0]));
  const all = skills.map(([k, label]) => ({ k, label, ...sum(review[k]) }));
  const grand = all.reduce((a, s) => ({ earned: a.earned + s.earned, total: a.total + s.total }), { earned: 0, total: 0 });

  return (
    <div className="practice-review">
      <div className="card card-strong practice-summary">
        <p className="mono muted" style={{ fontSize: 12, margin: 0, letterSpacing: ".06em" }}>KẾT QUẢ LUYỆN TẬP</p>
        <p className="serif" style={{ fontSize: 22, margin: "6px 0 2px" }}>
          {studentName ? `${studentName}: ` : ""}đúng {grand.earned}/{grand.total} câu
        </p>
        <div className="practice-score-row">
          {all.map((s) => {
            const pct = s.total ? Math.round((s.earned / s.total) * 100) : 0;
            return (
              <div key={s.k} className="practice-score">
                <div className="practice-score-head">
                  <span>{s.label}</span>
                  <strong>{s.earned}/{s.total}</strong>
                </div>
                <div className="practice-score-track"><div className="practice-score-fill" style={{ width: `${pct}%` }} /></div>
              </div>
            );
          })}
        </div>
        {hasWriting && <p className="muted" style={{ fontSize: 13, margin: "10px 0 0" }}>Phần Writing được giáo viên chấm riêng.</p>}
        <label className="practice-filter">
          <input type="checkbox" checked={onlyWrong} onChange={(e) => setOnlyWrong(e.target.checked)} />
          Chỉ hiện câu sai / chưa đủ điểm
        </label>
      </div>

      {all.map(({ k, label }) => {
        let running = 0;
        return (
          <section key={k} className="practice-skill">
            <h2 className="serif practice-skill-title">{label}</h2>
            {review[k].map((sec, si) => {
              const items = sec.items.map((it) => {
                const start = running + 1;
                running += Math.max(1, it.total);
                return { it, start, end: running };
              });
              const visible = items.filter(({ it }) => !onlyWrong || it.earned < it.total);
              if (!visible.length) return null;
              return (
                <div key={si} className="practice-section">
                  {sec.title && <p className="practice-section-title">{sec.title}</p>}
                  {visible.map(({ it, start, end }) => {
                    const full = it.earned === it.total;
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
                                <span className="practice-tag">Bạn trả lời</span>
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
                        {it.explain && (
                          <div className="practice-explain">
                            <p className="practice-explain-title">Giải thích</p>
                            {it.explain.split("\n").map((l, li) => <p key={li}>{l}</p>)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </section>
        );
      })}
      {onlyWrong && grand.earned === grand.total && (
        <p className="muted" style={{ textAlign: "center" }}>Không có câu sai nào. 🎉</p>
      )}
    </div>
  );
}
