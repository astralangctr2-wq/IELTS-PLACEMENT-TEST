"use client";

// Grading in 3 steps, one screen each:
//   1. Trắc nghiệm   — check what the machine marked (Reading / Listening…)
//   2. Chữa Writing  — comment on each error, pick the bands
//   3. Nhận xét      — the result sheet (/teacher/[id]/phieu): written
//                      feedback, Speaking, then hand in to the admin.
// The step is kept in the address (?buoc=…) so a reload stays put.

import { useState } from "react";

export default function GradeFlow({ hasObjective, hasWriting, initialStep, sheetHref, objective, writing, objectiveConfirmed, writingGraded }) {
  const steps = [
    hasObjective && { key: "tracnghiem", label: "Trắc nghiệm", sub: "Reading · Listening", done: objectiveConfirmed },
    hasWriting && { key: "writing", label: "Chữa Writing", sub: "bình luận lỗi · chọn band", done: writingGraded },
    { key: "phieu", label: "Nhận xét & phiếu", sub: "feedback · gửi admin", href: sheetHref },
  ].filter(Boolean);
  const valid = steps.filter((s) => !s.href).map((s) => s.key);
  const [step, setStep] = useState(valid.includes(initialStep) ? initialStep : valid[0]);

  const go = (key) => {
    const s = steps.find((x) => x.key === key);
    if (s?.href) { window.location.href = s.href; return; }
    setStep(key);
    try {
      const u = new URL(window.location.href);
      u.searchParams.set("buoc", key);
      window.history.replaceState(null, "", u.toString());
    } catch {}
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const idx = steps.findIndex((s) => s.key === step);
  const next = steps[idx + 1];

  return (
    <div className="gf">
      <ol className="gf-steps">
        {steps.map((s, i) => (
          <li key={s.key}>
            <button type="button" className={`gf-step ${s.key === step ? "on" : ""} ${s.done ? "done" : ""}`} onClick={() => go(s.key)}>
              <span className="gf-num">{s.done && s.key !== step ? "✓" : i + 1}</span>
              <span className="gf-text"><b>{s.label}{s.href ? " →" : ""}</b><small>{s.sub}</small></span>
            </button>
          </li>
        ))}
      </ol>

      {step === "tracnghiem" && (
        <>
          {objective}
          {next && (
            <div className="gf-next">
              <span className="muted">{objectiveConfirmed ? "✓ Đã xác nhận điểm trắc nghiệm." : "Xem lại từng câu, sửa ✓/✗ nếu cần rồi bấm “Lưu & xác nhận điểm” ở cuối danh sách câu."}</span>
              <button type="button" className="btn btn-sm" onClick={() => go(next.key)}>Tiếp: {next.label} →</button>
            </div>
          )}
        </>
      )}

      {step === "writing" && writing}
    </div>
  );
}
