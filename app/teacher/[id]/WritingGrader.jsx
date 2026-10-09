"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AnnotationEditor from "./AnnotationEditor";
import {
  IELTS_CRITERIA, ieltsTaskCount, ieltsTaskBand, ieltsTaskWeights, ieltsWritingBandFromTasks, ieltsTasksOf, ieltsCriterionLabel,
  APTIS_WRITING_PARTS, aptisSuggestedWriting, aptisCefr,
} from "@/lib/grading";

// The test runners store multi-part Writing as "TASK n" (IELTS runner) or
// "PART n" (Aptis runner) headings + the student's text. Strip those
// headings (and "(chưa trả lời)" placeholders) to know what was really written.
function writtenText(text) {
  return (text || "")
    .replace(/^\s*(TASK|PART)\s+\d+\s*$/gim, "")
    .replace(/\(chưa trả lời\)/g, "")
    .trim();
}

const BANDS = Array.from({ length: 19 }, (_, i) => i / 2); // 0, 0.5 … 9
const roundHalf = (n) => Math.round(n * 2) / 2;

// One block of 4 criteria per Writing task. A grade saved for a different
// number of tasks (e.g. before Task 1 / Task 2 were split) only pre-fills
// the tasks it has.
function initIelts(g, taskCount) {
  const saved = ieltsTasksOf(g);
  const tasks = Array.from({ length: taskCount }, (_, ti) => {
    const criteria = {};
    for (const c of IELTS_CRITERIA) {
      const v = saved.length === taskCount ? saved[ti]?.criteria?.[c.key] : null;
      criteria[c.key] = { score: typeof v?.score === "number" ? v.score : null, feedback: v?.feedback || "" };
    }
    return { criteria };
  });
  return { tasks, note: g?.type === "ielts" ? g.note || "" : "" };
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
  const taskCount = ieltsTaskCount(text);
  const [ielts, setIelts] = useState(() => initIelts(initialGrading, taskCount));
  const [ap, setAp] = useState(() => initAptis(initialGrading));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(Boolean(graded && initialGrading));
  const [dirty, setDirty] = useState(false);

  const written = writtenText(text);
  const realWords = written ? written.split(/\s+/).length : 0;

  const touch = () => { setDirty(true); setSaved(false); };

  // ---- IELTS
  const band = ieltsWritingBandFromTasks(ielts.tasks);
  const weights = ieltsTaskWeights(taskCount);
  const setCrit = (ti, key, patch) => {
    touch();
    setIelts((s) => ({
      ...s,
      tasks: s.tasks.map((t, i) => (i !== ti ? t : { ...t, criteria: { ...t.criteria, [key]: { ...t.criteria[key], ...patch } } })),
    }));
  };

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
      : { action: "grade", tasks: ielts.tasks, note: ielts.note, annotations };
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
        <p className="mono muted" style={{ fontSize: 12, marginBottom: 10 }}>BÀI VIẾT ({realWords} từ) — CHÚ THÍCH TRỰC TIẾP</p>
        {written ? (
          <AnnotationEditor text={text} annotations={annotations} onChange={(a) => { touch(); setAnnotations(a); }} />
        ) : (
          <div className="empty-essay">
            <p style={{ margin: 0 }}><b>Học viên không viết bài</b>{text && text.trim() ? " — bài nộp chỉ có tiêu đề các phần, không có nội dung." : "."}</p>
            {aptis && (
              <button type="button" className="btn-ghost btn-sm" onClick={() => { touch(); setAp((s) => ({ ...s, parts: { p1: 0, p2: 0, p3: 0, p4: 0 }, scoreTouched: false })); }}>
                Chấm 0 cho cả 4 phần
              </button>
            )}
          </div>
        )}
      </div>

      <div className="card card-strong stack grade-card">
        <p className="mono muted" style={{ fontSize: 12 }}>{aptis ? "CHẤM WRITING — APTIS" : "CHẤM WRITING — IELTS"}</p>

        {!aptis && (
          <>
            {ielts.tasks.map((t, ti) => {
              const tb = ieltsTaskBand(t.criteria);
              return (
                <div key={ti} className="grade-task">
                  {taskCount > 1 && (
                    <div className="grade-task-head">
                      <b>Task {ti + 1}</b>
                      {taskCount === 2 && <span className="mono muted">{weights[ti] === 2 ? "tính hệ số 2" : "tính hệ số 1"}</span>}
                      <span className="grade-task-band">Band Task {ti + 1}: <b>{tb !== null ? tb.toFixed(1) : "—"}</b></span>
                    </div>
                  )}
                  <div className="grade-criteria">
                    {IELTS_CRITERIA.map((c) => {
                      const label = ieltsCriterionLabel(c, ti, taskCount);
                      const id = `crit-${ti}-${c.key}`;
                      return (
                        <div key={c.key} className="grade-criterion">
                          <div className="grade-criterion-head">
                            <label htmlFor={id}>{label}</label>
                            <select
                              id={id}
                              value={t.criteria[c.key].score ?? ""}
                              onChange={(e) => setCrit(ti, c.key, { score: e.target.value === "" ? null : Number(e.target.value) })}
                            >
                              <option value="">— chọn —</option>
                              {BANDS.map((b) => <option key={b} value={b}>{b.toFixed(1)}</option>)}
                            </select>
                          </div>
                          <textarea
                            value={t.criteria[c.key].feedback}
                            onChange={(e) => setCrit(ti, c.key, { feedback: e.target.value })}
                            placeholder={`Nhận xét về ${label}${taskCount > 1 ? ` (Task ${ti + 1})` : ""}…`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
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
                {taskCount === 2
                  ? "Band mỗi Task = trung bình 4 tiêu chí, làm tròn 0.5. Band Writing = (Task 1 + 2 × Task 2) / 3, làm tròn 0.5."
                  : "Band Writing = trung bình 4 tiêu chí, làm tròn 0.5."}{" "}
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
                  placeholder="—"
                  aria-label="Điểm Writing 0–50"
                />
              </div>
              <div>
                <span className="mono">CEFR</span>
                <strong>{Number.isInteger(apScore) ? aptisCefr("writing", apScore) : "—"}</strong>
              </div>
              <p className="mono">
                {suggested === null
                  ? <>Chọn điểm đủ 4 phần ở trên — web sẽ tự gợi ý điểm 0–50 và xếp CEFR (bạn vẫn sửa tay được).{" "}</>
                  : <>Gợi ý theo 4 phần: <b>{suggested}</b>/50 (ước tính — British Council không công bố công thức quy đổi).{" "}</>}
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
            {!ready ? (aptis ? "Chọn điểm đủ 4 phần để lưu." : taskCount > 1 ? `Chọn điểm đủ 4 tiêu chí của cả ${taskCount} Task để lưu.` : "Chọn điểm đủ 4 tiêu chí để lưu.") : dirty ? "Có thay đổi chưa lưu." : ""}
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
