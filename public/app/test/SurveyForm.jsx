"use client";

import { useState } from "react";
import { SURVEY } from "@/lib/surveyQuestions";

// Feedback survey shown under the thank-you message when the teacher
// switched it on for this exam link. Every question is optional; the
// student may skip the whole thing.

function Stars({ value, onChange, label }) {
  return (
    <div className="sv-stars" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} sao`}
          className={`sv-star ${value >= n ? "on" : ""}`} onClick={() => onChange(value === n ? undefined : n)}>★</button>
      ))}
      <span className="sv-star-note">{value ? ["", "Rất tệ", "Chưa tốt", "Bình thường", "Tốt", "Rất tốt"][value] : ""}</span>
    </div>
  );
}

export default function SurveyForm({ submissionId, skills = [] }) {
  const [a, setA] = useState({});
  const [anonymous, setAnonymous] = useState(false);
  const [state, setState] = useState("open"); // open | sending | sent | skipped
  const [error, setError] = useState("");
  const set = (k, v) => setA((p) => ({ ...p, [k]: v }));
  const questions = SURVEY.filter((q) => !q.onlyIf || skills.includes(q.onlyIf));

  if (state === "skipped") return null;
  if (state === "sent") {
    return (
      <div className="card card-strong sv-card" style={{ textAlign: "center" }}>
        <p className="serif" style={{ fontSize: 20, margin: 0 }}>Cảm ơn góp ý của bạn! 💙</p>
        <p className="muted" style={{ fontSize: 14, margin: "6px 0 0" }}>Trung tâm sẽ dùng ý kiến này để làm bài thi tốt hơn.</p>
      </div>
    );
  }

  const send = async () => {
    setState("sending"); setError("");
    try {
      const res = await fetch("/api/survey", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ submissionId, answers: a, anonymous }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Không gửi được.");
      setState("sent");
    } catch (e) { setError(e.message); setState("open"); }
  };

  let lastSection = null;
  return (
    <div className="card card-strong sv-card">
      <p className="mono muted" style={{ fontSize: 12, margin: 0, letterSpacing: ".06em" }}>KHẢO SÁT GÓP Ý · KHOẢNG 2 PHÚT</p>
      <p className="serif" style={{ fontSize: 20, margin: "4px 0 2px" }}>Bạn thấy bài thi hôm nay thế nào?</p>
      <p className="muted" style={{ fontSize: 13.5, margin: 0 }}>Không bắt buộc trả lời hết. Ý kiến của bạn giúp trung tâm cải thiện web thi.</p>
      {questions.map((q) => {
        const head = q.section !== lastSection ? q.section : null;
        lastSection = q.section;
        const v = a[q.key];
        return (
          <div key={q.key} className="sv-q">
            {head && <p className="sv-section">{head}</p>}
            <p className="sv-label">{q.label}</p>
            {q.type === "rating" && <Stars value={v} onChange={(x) => set(q.key, x)} label={q.label} />}
            {q.type === "choice" && (
              <div className="sv-opts">
                {q.options.map((o) => (
                  <button key={o} type="button" className={`sv-opt ${v === o ? "on" : ""}`} aria-pressed={v === o} onClick={() => set(q.key, v === o ? undefined : o)}>{o}</button>
                ))}
              </div>
            )}
            {q.type === "multi" && (
              <div className="sv-opts">
                {q.options.map((o) => {
                  const arr = v || [];
                  const on = arr.includes(o);
                  const full = q.max && arr.length >= q.max && !on;
                  return (
                    <button key={o} type="button" disabled={full} className={`sv-opt ${on ? "on" : ""}`} aria-pressed={on}
                      onClick={() => {
                        let next = on ? arr.filter((x) => x !== o) : [...arr, o];
                        if (q.key === "issues") next = o === "Không gặp sự cố" && !on ? [o] : next.filter((x) => x !== "Không gặp sự cố" || o === "Không gặp sự cố");
                        set(q.key, next.length ? next : undefined);
                      }}>
                      {on ? "✓ " : ""}{o}
                    </button>
                  );
                })}
                {q.max && <span className="muted" style={{ fontSize: 12, alignSelf: "center" }}>Đã chọn {(v || []).length}/{q.max}</span>}
              </div>
            )}
            {q.type === "text" && (
              <textarea className="sv-text" rows={2} maxLength={1000} value={v || ""} onChange={(e) => set(q.key, e.target.value || undefined)} placeholder="Viết ngắn gọn…" />
            )}
          </div>
        );
      })}
      <label className="sv-anon">
        <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
        Gửi ẩn danh (giáo viên chỉ thấy lớp, không thấy tên bạn)
      </label>
      <div className="row" style={{ gap: 10, justifyContent: "flex-start", width: "auto" }}>
        <button className="btn" disabled={state === "sending" || Object.keys(a).length === 0} onClick={send}>{state === "sending" ? "Đang gửi…" : "Gửi góp ý →"}</button>
        <button className="btn-ghost" onClick={() => setState("skipped")}>Bỏ qua</button>
      </div>
      {error && <p className="accent" style={{ margin: 0 }}>{error}</p>}
    </div>
  );
}
