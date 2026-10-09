"use client";

// Shows which grading form (IELTS / Aptis) this submission uses and lets
// the teacher switch it when the automatic detection got it wrong.
import { useState } from "react";
import { useRouter } from "next/navigation";

const SOURCE = { manual: "giáo viên chọn", bank: "theo bộ đề", content: "tự nhận diện từ bài làm" };

export default function ExamTypeSwitch({ submissionId, type, source }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const other = type === "aptis" ? "ielts" : "aptis";

  const set = async (examType) => {
    setBusy(true);
    await fetch(`/api/submissions/${submissionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "setExamType", examType }),
    });
    router.refresh();
    setBusy(false);
  };

  return (
    <span className="exam-switch">
      Loại bài: <span className={`type-pill ${type === "aptis" ? "aptis" : ""}`}>{type === "aptis" ? "APTIS" : "IELTS"}</span>
      <span className="muted"> ({SOURCE[source]})</span>
      <button type="button" className="linklike" disabled={busy} onClick={() => set(other)}>
        đổi sang {other === "aptis" ? "Aptis" : "IELTS"}
      </button>
      {source === "manual" && (
        <button type="button" className="linklike" disabled={busy} onClick={() => set(null)}>tự động</button>
      )}
    </span>
  );
}
