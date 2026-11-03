"use client";

// Grammar / Reading / Listening answers of one submission, as marked by the
// machine — and confirmed by the teacher. Every answer has a ✓ Đúng / ✗ Sai
// switch: the machine's mark is only a first pass, the teacher decides
// (e.g. accepts "2100" for "2,100"). "Lưu & xác nhận điểm" recomputes the
// scores and bands on the server (lib/answerReview.js).

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const LABEL = { grammar: "NGỮ PHÁP", reading: "READING", listening: "LISTENING" };
const markKey = (skill, qid, part) => `${skill}:${qid}:${part}`;

// Same rule as effectivePoints() in lib/answerReview.js.
function points(it, skill, marks) {
  const keys = it.parts.map((_, pi) => markKey(skill, it.id, pi));
  if (!keys.some((k) => k in marks)) return it.earned;
  if (it.parts.length === 1) return marks[keys[0]] ? it.total : 0;
  return it.parts.reduce((a, p, pi) => a + ((keys[pi] in marks ? marks[keys[pi]] : p.ok) ? 1 : 0), 0);
}
const partOk = (it, p, pi, skill, marks) => {
  const k = markKey(skill, it.id, pi);
  if (k in marks) return marks[k];
  return it.parts.length === 1 ? it.earned === it.total : p.ok;
};

export default function AnswerReview({ submissionId, sections, initialMarks, confirmedAt, autoScores }) {
  const router = useRouter();
  const [marks, setMarks] = useState(initialMarks || {});
  const [onlyWrong, setOnlyWrong] = useState(false);
  const [state, setState] = useState(confirmedAt ? "confirmed" : "");
  const dirty = state === "dirty";

  const flip = (skill, it, pi, value) => {
    const k = markKey(skill, it.id, pi);
    const auto = it.parts.length === 1 ? (it.earned === it.total ? true : it.earned === 0 ? false : null) : it.parts[pi].ok;
    setMarks((m) => {
      const next = { ...m };
      if (value === auto) delete next[k];
      else next[k] = value;
      return next;
    });
    setState("dirty");
  };

  const totals = useMemo(() => sections.map((sec) => ({
    skill: sec.skill,
    auto: autoScores?.[sec.skill] || [sec.items.reduce((a, it) => a + it.earned, 0), sec.items.reduce((a, it) => a + it.total, 0)],
    now: [sec.items.reduce((a, it) => a + points(it, sec.skill, marks), 0), sec.items.reduce((a, it) => a + it.total, 0)],
  })), [sections, marks, autoScores]);
  const changed = Object.keys(marks).length;

  const save = async () => {
    setState("saving");
    const res = await fetch(`/api/teacher/review/${submissionId}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ marks, confirm: true }),
    });
    if (res.ok) { setState("confirmed"); router.refresh(); } else setState("error");
  };

  if (!sections.length) return null;
  return (
    <div className="stack obj-review">
      {sections.map((sec) => {
        const t = totals.find((x) => x.skill === sec.skill);
        let running = 0;
        let lastTitle = null;
        return (
          <div key={sec.skill} className="card answer-review">
            <div className="ar-head">
              <p className="mono muted" style={{ fontSize: 12, margin: 0 }}>CHI TIẾT — {LABEL[sec.skill]}</p>
              <span className="mono" style={{ fontSize: 12 }}>
                Máy chấm {t.auto[0]}/{t.auto[1]}{t.now[0] !== t.auto[0] ? <b className="ar-changed"> → GV: {t.now[0]}/{t.now[1]}</b> : ""}
              </span>
            </div>
            {sec.items.map((it) => {
              const start = running + 1;
              running += Math.max(1, it.total);
              const end = running;
              const pts = points(it, sec.skill, marks);
              const wrongByMachine = it.earned < it.total;
              const overridden = it.parts.some((_, pi) => markKey(sec.skill, it.id, pi) in marks);
              if (onlyWrong && !wrongByMachine && !overridden) return null;
              const full = it.total > 0 && pts === it.total;
              const status = full ? "ok" : pts > 0 ? "partial" : "bad";
              const header = it.sectionTitle && it.sectionTitle !== lastTitle ? it.sectionTitle : null;
              if (header) lastTitle = it.sectionTitle;
              return (
                <div key={it.id}>
                  {header && <p className="practice-section-title">{header}</p>}
                  <div className={`practice-item ${status}`}>
                    <div className="practice-item-head">
                      <span className="practice-num">{start === end ? `Câu ${start}` : `Câu ${start}–${end}`}</span>
                      <span className={`practice-badge ${status}`}>
                        {full ? "✓ Đúng" : pts > 0 ? `${pts}/${it.total} đúng` : "✗ Sai"}{overridden ? " · GV sửa" : ""}
                      </span>
                    </div>
                    {it.q && <p className="practice-q">{it.q}</p>}
                    <div className="practice-parts">
                      {it.parts.map((p, pi) => {
                        const ok = partOk(it, p, pi, sec.skill, marks);
                        const isOver = markKey(sec.skill, it.id, pi) in marks;
                        return (
                          <div key={pi} className={`practice-part ar-part ${ok ? "ok" : "bad"}`}>
                            <div className="ar-part-text">
                              {p.label && <p className="practice-part-label">{p.label}</p>}
                              <p className="practice-line">
                                <span className="practice-tag">HV trả lời</span>
                                <span className={ok ? "practice-ok" : "practice-bad"}>{p.given}</span>
                              </p>
                              {(!p.ok || isOver) && (
                                <p className="practice-line">
                                  <span className="practice-tag">Đáp án</span>
                                  <span className="practice-ok">{p.correct}</span>
                                </p>
                              )}
                            </div>
                            <div className="ar-switch" role="group" aria-label="Giáo viên xác nhận">
                              <button type="button" className={ok ? "on ok" : ""} onClick={() => flip(sec.skill, it, pi, true)}>✓ Đúng</button>
                              <button type="button" className={!ok ? "on bad" : ""} onClick={() => flip(sec.skill, it, pi, false)}>✗ Sai</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      <div className="ar-bar">
        <label className="ar-filter">
          <input type="checkbox" checked={onlyWrong} onChange={(e) => setOnlyWrong(e.target.checked)} />
          Chỉ hiện câu máy chấm sai
        </label>
        <span className="ar-sum mono">
          {totals.map((t) => `${LABEL[t.skill][0]}${LABEL[t.skill].slice(1).toLowerCase()} ${t.now[0]}/${t.now[1]}`).join(" · ")}
          {changed ? ` · GV sửa ${changed} ý` : ""}
        </span>
        <span className="ar-state mono">
          {state === "saving" ? "Đang lưu…" : state === "error" ? <span className="accent">Không lưu được</span> : state === "confirmed" ? <span className="success">✓ GV đã xác nhận</span> : dirty ? "Chưa lưu" : ""}
        </span>
        <button type="button" className="btn btn-sm" onClick={save} disabled={state === "saving"}>
          {state === "confirmed" && !dirty ? "Lưu lại" : "Lưu & xác nhận điểm"}
        </button>
      </div>
    </div>
  );
}
