"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GradeForm({ submissionId, objectiveBand, initialBand, initialFeedback, graded, finalBand }) {
  const [band, setBand] = useState(initialBand);
  const [feedback, setFeedback] = useState(initialFeedback);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(graded);
  const router = useRouter();

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/submissions/${submissionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ writingBand: band, writingFeedback: feedback }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể lưu điểm.");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  };

  return (
    <div className="card card-strong stack">
      <p className="mono muted" style={{ fontSize: 12 }}>CHẤM ĐIỂM WRITING</p>

      <div>
        <p style={{ marginBottom: 8 }}>Band Writing (0–9, bước 0.5):</p>
        <div className="row" style={{ justifyContent: "flex-start", gap: 12 }}>
          <button className="btn-ghost btn-sm" onClick={() => setBand((b) => Math.max(0, Math.round((b - 0.5) * 2) / 2))}>−</button>
          <span className="serif" style={{ fontSize: 28, minWidth: 56, textAlign: "center" }}>{band.toFixed(1)}</span>
          <button className="btn-ghost btn-sm" onClick={() => setBand((b) => Math.min(9, Math.round((b + 0.5) * 2) / 2))}>+</button>
        </div>
      </div>

      <div>
        <p style={{ marginBottom: 8 }}>Nhận xét cho học viên:</p>
        <textarea style={{ minHeight: 120 }} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Nhận xét về bố cục, từ vựng, ngữ pháp…" />
      </div>

      <div className="row">
        <p className="mono muted" style={{ fontSize: 12 }}>
          {objectiveBand !== null
            ? <>Band cuối (TB Ngữ pháp/Reading/Listening + Writing): <b>{((objectiveBand + band) / 2).toFixed(1)}</b></>
            : <>Band cuối (chỉ Writing, HV không làm phần trắc nghiệm nào): <b>{band.toFixed(1)}</b></>}
        </p>
        <button className="btn" onClick={save} disabled={saving}>{saving ? "Đang lưu…" : "Lưu điểm →"}</button>
      </div>

      {error && <p className="accent">{error}</p>}
      {saved && !error && <p className="success">✓ Đã lưu điểm.</p>}
    </div>
  );
}
