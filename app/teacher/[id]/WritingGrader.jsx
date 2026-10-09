"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AnnotationEditor from "./AnnotationEditor";
import {
  IELTS_CRITERIA, ieltsWritingBand, APTIS_WRITING_PARTS, aptisSuggestedWriting, aptisCefr,
} from "@/lib/grading";

const BANDS = Array.from({ length: 19 }, (_, i) => i / 2); // 0, 0.5 … 9
const roundHalf = (n) => Math.round(n * 2) / 2;

function initIelts(g) {
  const criteria = {};
  for (const c of IELTS_CRITERIA) {
    const v = g?.type === "ielts" ? g.criteria?.[c.key] : null;
    criteria[c.key] = { score: typeof v?.score === "number" ? v.score : null, feedback: v?.feedback || "" };
  }
  return { criteria, note: g?.type === "ielts" ? g.note || "" : "" };
}

function initAptis(g) {
  const parts = {};
  for (const p of APTIS_WRITING_PARTS) parts[p.key] = g?.type === "aptis" && typeof g.parts?.[p.key] === "number" ? g.parts[p.key] : null;
  return {
    parts,
    writingScore: g?.type === "aptis" ? g.writingScore : null,
    scoreTouched: g?.type === "aptis",
    strengths: g?.type === "aptis" ? g.strengths || "" : "",
    improvements: g?.type === "aptis" ? g.improvements || "" : "",
  };
}

export default function WritingGrader({ submissionId, type, text, wordCount, objectiveBand, initialGrading, graded }) {
  const router = useRouter();
  const aptis = type === "aptis";
  const [annotations, setAnnotations] = useState(Array.isArray(initialGrading?.annotations) ? initialGrading.annotations : []);
  const [ielts, setIelts] = useState(() => initIelts(initialGrading));
  const [ap, setAp] = useState(() => initAptis(initialGrading));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(Boolean(graded && initialGrading));
  const [dirty, setDirty] = useState(false);

  const touch = () => { setDirty(true); setSaved(false); };

  // ---- IELTS
  const band = ieltsWritingBand(ielts.criteria);
  const setCrit = (key, patch) => { touch(); setIelts((s) => ({ ...s, criteria: { ...s.criteria, [key]: { ...s.criteria[key], ...patch } } })); };

  // ---- Aptis
  const suggested = aptisSuggestedWriting(ap.parts);
  const apScore = ap.scoreTouched ? ap.writingScore : suggested;
  const setPart = (key, v) => { touch(); setAp((s) => ({ ...s, parts: { ...s.parts, [key]: v } })); };

  const ready = aptis
    ? APTIS_WRITING_PARTS.every((p) => typeof ap.parts[p.key] === "number") && Number.isInteger(apScore) && apScore >= 0 && apScore <= 50
    : band !== null;

  const save = async () => {
    setSaving(true);
    setError("");
    const body = aptis
      ? { action: "grade", parts: ap.parts, writingScore: apScore, strengths: ap.strengths, improvements: ap.improvements, annotations }
      : { action: "grade", criteria: ielts.criteria, note: ielts.note, annotations };
    try {
      const res = await fetch(`/api/submissions/${submissionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể lưu điểm.");
      setSaved(true);
      setDirty(false);
      router.refresh();
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  };

  return (
    <>
      <div className="card">
        <p className="mono muted" style={{ fontSize: 12, marginBottom: 10 }}>BÀI VIẾT ({wordCount} từ) — CHÚ THÍCH TRỰC TIẾP</p>
        {text && text.trim() ? (
          <AnnotationEditor text={text} annotations={annotations} onChange={(a) => { touch(); setAnnotations(a); }} />
        ) : (
          <p className="muted">Học viên không viết bài.</p>
        )}
      </div>

      <div className="card card-strong stack grade-card">
        <p className="mono muted" style={{ fontSize: 12 }}>{aptis ? "CHẤM WRITING — APTIS" : "CHẤM WRITING — IELTS"}</p>

        {!aptis && (
          <>
            <div className="grade-criteria">
              {IELTS_CRITERIA.map((c) => (
                <div key={c.key} className="grade-criterion">
                  <div className="grade-criterion-head">
                    <label htmlFor={`crit-${c.key}`}>{c.label}</label>
                    <select
                      id={`crit-${c.key}`}
                      value={ielts.criteria[c.key].score ?? ""}
                      onChange={(e) => setCrit(c.key, { score: e.target.value === "" ? null : Number(e.target.value) })}
                    >
                      <option value="">— chọn —</option>
                      {BANDS.map((b) => <option key={b} value={b}>{b.toFixed(1)}</option>)}
                    </select>
                  </div>
                  <textarea
                    value={ielts.criteria[c.key].feedback}
                    onChange={(e) => setCrit(c.key, { feedback: e.target.value })}
                    placeholder={`Nhận xét về ${c.label}…`}
                  />
                </div>
              ))}
            </div>
            <div className="grade-total">
              <div>
                <span className="mono">Band Writing</span>
                <strong>{band !== null ? band.toFixed(1) : "—"}</strong>
              </div>
              <div>
                <span className="mono">Band cuối</span>
                <strong>{band === null ? "—" : objectiveBand !== null ? roundHalf((objectiveBand + band) / 2).toFixed(1) : band.toFixed(1)}</strong>
              </div>
              <p className="mono">
                Band Writing = trung bình 4 tiêu chí, làm tròn 0.5.{" "}
                {objectiveBand !== null ? `Band cuối = TB band trắc nghiệm (${objectiveBand.toFixed(1)}) và band Writing.` : "HV không làm phần trắc nghiệm."}
              </p>
            </div>
            <div>
              <p style={{ marginBottom: 6 }}>Ghi chú thêm <span className="muted">(không bắt buộc — học viên thấy ô này ở trang kết quả)</span></p>
              <textarea value={ielts.note} onChange={(e) => { touch(); setIelts((s) => ({ ...s, note: e.target.value })); }} placeholder="Ghi chú chung cho học viên…" />
            </div>
          </>
        )}

        {aptis && (
          <>
            <div className="grade-parts">
              {APTIS_WRITING_PARTS.map((p) => (
                <div key={p.key} className="grade-part">
                  <label htmlFor={`part-${p.key}`}>{p.label}</label>
                  <select
                    id={`part-${p.key}`}
                    value={ap.parts[p.key] ?? ""}
                    onChange={(e) => setPart(p.key, e.target.value === "" ? null : Number(e.target.value))}
                  >
                    <option value="">— chọn —</option>
                    {Array.from({ length: p.max + 1 }, (_, i) => <option key={i} value={i}>{i} / {p.max}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div className="grade-total">
              <div>
                <span className="mono">Writing (0–50)</span>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={apScore ?? ""}
                  onChange={(e) => { touch(); setAp((s) => ({ ...s, scoreTouched: true, writingScore: e.target.value === "" ? null : Math.round(Number(e.target.value)) })); }}
                  aria-label="Điểm Writing 0–50"
                />
              </div>
              <div>
                <span className="mono">CEFR</span>
                <strong>{Number.isInteger(apScore) ? aptisCefr("writing", apScore) : "—"}</strong>
              </div>
              <p className="mono">
                Gợi ý theo 4 phần: <b>{suggested ?? "—"}</b>/50 (ước tính — British Council không công bố công thức quy đổi).{" "}
                {ap.scoreTouched && suggested !== null && apScore !== suggested && (
                  <button type="button" className="linklike" onClick={() => setAp((s) => ({ ...s, scoreTouched: false }))}>Dùng lại điểm gợi ý</button>
                )}
              </p>
            </div>
            <div>
              <p style={{ marginBottom: 6 }}>Điểm mạnh</p>
              <textarea value={ap.strengths} onChange={(e) => { touch(); setAp((s) => ({ ...s, strengths: e.target.value })); }} placeholder="Những điểm học viên làm tốt…" />
            </div>
            <div>
              <p style={{ marginBottom: 6 }}>Điểm cần cải thiện</p>
              <textarea value={ap.improvements} onChange={(e) => { touch(); setAp((s) => ({ ...s, improvements: e.target.value })); }} placeholder="Những điểm cần khắc phục…" />
            </div>
          </>
        )}

        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <p className="mono muted" style={{ fontSize: 12, margin: 0 }}>
            {!ready ? (aptis ? "Chọn điểm đủ 4 phần để lưu." : "Chọn điểm đủ 4 tiêu chí để lưu.") : dirty ? "Có thay đổi chưa lưu." : ""}
          </p>
          <div className="row" style={{ gap: 8, width: "auto" }}>
            {saved && !dirty && <a href={`/teacher/${submissionId}/phieu`} target="_blank" rel="noreferrer"><button type="button" className="btn-ghost btn-sm">Phiếu kết quả ↗</button></a>}
            <button className="btn" onClick={save} disabled={saving || !ready}>{saving ? "Đang lưu…" : "Lưu điểm →"}</button>
          </div>
        </div>
        {error && <p className="accent">{error}</p>}
        {saved && !dirty && !error && <p className="success">✓ Đã lưu điểm.</p>}
      </div>
    </>
  );
}
