"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AnnotationEditor from "./AnnotationEditor";
import {
  IELTS_CRITERIA, ieltsTaskCount, ieltsTaskBand, ieltsTaskWeights, ieltsWritingBandFromTasks, ieltsTasksOf, ieltsCriterionLabel,
  APTIS_WRITING_PARTS, aptisSuggestedWriting, aptisCefr, ANNOTATION_TAGS,
} from "@/lib/grading";

// Grading screen: for each Writing task the student's text sits on the
// left (with inline annotations) and the 4 criteria + feedback on the
// right, so the teacher reads and scores side by side. A bar at the
// bottom keeps the band and the Save button in view.

// The test runners store multi-part Writing as "TASK n" (IELTS runner) or
// "PART n" (Aptis runner) headings + the student's text. Strip those
// headings (and "(chưa trả lời)" placeholders) to know what was really written.
function writtenText(text) {
  return (text || "")
    .replace(/^\s*(TASK|PART)\s+\d+\s*$/gim, "")
    .replace(/\(chưa trả lời\)/g, "")
    .trim();
}
const words = (t) => (t.trim() ? t.trim().split(/\s+/).length : 0);

// Character ranges of each "TASK n" block in the stored essay (headings
// excluded, surrounding blank lines trimmed). One task = whole text.
function taskRanges(text, count) {
  const t = text || "";
  const heads = [...t.matchAll(/^TASK \d+\s*$/gm)];
  if (count <= 1 || heads.length < count) return [{ from: 0, to: t.length }];
  return heads.map((m, i) => {
    let from = m.index + m[0].length;
    let to = i + 1 < heads.length ? heads[i + 1].index : t.length;
    while (from < to && /\s/.test(t[from])) from++;
    while (to > from && /\s/.test(t[to - 1])) to--;
    return { from, to };
  });
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

function Legend() {
  return (
    <div className="annot-legend">
      {ANNOTATION_TAGS.map((t) => <span key={t.key} className="annot-chip" style={{ "--tag": t.color }}>{t.label}</span>)}
      <span className="mono muted annot-hint">Bôi đen chữ trong bài để chú thích</span>
    </div>
  );
}

export default function WritingGrader({ submissionId, type, text, wordCount, objectiveBand, initialGrading, graded }) {
  const router = useRouter();
  const aptis = type === "aptis";
  const [annotations, setAnnotations] = useState(Array.isArray(initialGrading?.annotations) ? initialGrading.annotations : []);
  const taskCount = ieltsTaskCount(text);
  const ranges = taskRanges(text, taskCount);
  const [ielts, setIelts] = useState(() => initIelts(initialGrading, taskCount));
  const [ap, setAp] = useState(() => initAptis(initialGrading));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(Boolean(graded && initialGrading));
  const [dirty, setDirty] = useState(false);

  const written = writtenText(text);
  const realWords = words(written);

  const touch = () => { setDirty(true); setSaved(false); };
  const onAnnot = (a) => { touch(); setAnnotations(a); };

  // ---- IELTS
  const band = ieltsWritingBandFromTasks(ielts.tasks);
  const weights = ieltsTaskWeights(taskCount);
  const finalBand = band === null ? null : objectiveBand !== null ? roundHalf((objectiveBand + band) / 2) : band;
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

  const essayLeft = (range, title, minWords) => {
    const part = (text || "").slice(range.from, range.to);
    const w = words(writtenText(part));
    return (
      <div className="gs-left">
        <div className="gs-left-head">
          <b>{title}</b>
          <span className={`mono ${minWords && w < minWords ? "accent" : "muted"}`}>{w} từ{minWords ? ` / ${minWords}` : ""}</span>
        </div>
        <div className="gs-essay">
          {writtenText(part) ? (
            <AnnotationEditor text={text} range={range} annotations={annotations} onChange={onAnnot} hideLegend />
          ) : (
            <p className="muted" style={{ margin: 0 }}><b>Học viên không viết phần này.</b></p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="gs">
      <div className="gs-top">
        <p className="mono muted" style={{ fontSize: 12, margin: 0 }}>{aptis ? "CHẤM WRITING — APTIS" : "CHẤM WRITING — IELTS"} · {realWords} từ</p>
        <Legend />
      </div>

      {!written && (
        <div className="empty-essay card">
          <p style={{ margin: 0 }}><b>Học viên không viết bài</b>{text && text.trim() ? " — bài nộp chỉ có tiêu đề các phần, không có nội dung." : "."}</p>
          {aptis && (
            <button type="button" className="btn-ghost btn-sm" onClick={() => { touch(); setAp((s) => ({ ...s, parts: { p1: 0, p2: 0, p3: 0, p4: 0 }, scoreTouched: false })); }}>
              Chấm 0 cho cả 4 phần
            </button>
          )}
        </div>
      )}

      {!aptis && ielts.tasks.map((t, ti) => {
        const tb = ieltsTaskBand(t.criteria);
        const title = taskCount > 1 ? `Task ${ti + 1}` : "Bài viết";
        const minWords = taskCount > 1 ? (ti === 1 ? 250 : 150) : null;
        return (
          <section key={ti} className="gs-split">
            {essayLeft(ranges[ti] || ranges[0], title, minWords)}
            <div className="gs-right">
              <div className="gs-right-head">
                <b>{taskCount > 1 ? `Chấm Task ${ti + 1}` : "Chấm bài viết"}</b>
                {taskCount === 2 && <span className="mono muted">hệ số {weights[ti]}</span>}
                <span className="gs-band">Band: <b>{tb !== null ? tb.toFixed(1) : "—"}</b></span>
              </div>
              {IELTS_CRITERIA.map((c) => {
                const label = ieltsCriterionLabel(c, ti, taskCount);
                const id = `crit-${ti}-${c.key}`;
                const v = t.criteria[c.key].score;
                return (
                  <div key={c.key} className="gs-crit">
                    <div className="gs-crit-head">
                      <label htmlFor={id}>{label}</label>
                      <select id={id} value={v ?? ""} onChange={(e) => setCrit(ti, c.key, { score: e.target.value === "" ? null : Number(e.target.value) })}>
                        <option value="">— band —</option>
                        {BANDS.map((b) => <option key={b} value={b}>{b.toFixed(1)}</option>)}
                      </select>
                    </div>
                    <textarea
                      value={t.criteria[c.key].feedback}
                      onChange={(e) => setCrit(ti, c.key, { feedback: e.target.value })}
                      placeholder={`Nhận xét ${label}…`}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {!aptis && (
        <div className="card stack">
          <p style={{ margin: 0 }}>Ghi chú thêm <span className="muted">(không bắt buộc — học viên thấy ô này ở trang kết quả)</span></p>
          <textarea value={ielts.note} onChange={(e) => { touch(); setIelts((s) => ({ ...s, note: e.target.value })); }} placeholder="Ghi chú chung cho học viên…" />
          <p className="mono muted" style={{ fontSize: 12, margin: 0 }}>
            {taskCount === 2
              ? "Band mỗi Task = trung bình 4 tiêu chí, làm tròn 0.5. Band Writing = (Task 1 + 2 × Task 2) / 3, làm tròn 0.5."
              : "Band Writing = trung bình 4 tiêu chí, làm tròn 0.5."}{" "}
            {objectiveBand !== null ? `Band cuối = TB band trắc nghiệm (${objectiveBand.toFixed(1)}) và band Writing.` : "HV không làm phần trắc nghiệm."}
          </p>
        </div>
      )}

      {aptis && (
        <section className="gs-split">
          {essayLeft({ from: 0, to: (text || "").length }, "Bài viết (4 phần)", null)}
          <div className="gs-right">
            <div className="gs-right-head"><b>Chấm Writing Aptis</b></div>
            {APTIS_WRITING_PARTS.map((p) => (
              <div key={p.key} className="gs-crit">
                <div className="gs-crit-head">
                  <label htmlFor={`part-${p.key}`}>{p.label}</label>
                  <select id={`part-${p.key}`} value={ap.parts[p.key] ?? ""} onChange={(e) => setPart(p.key, e.target.value === "" ? null : Number(e.target.value))}>
                    <option value="">— điểm —</option>
                    {Array.from({ length: p.max + 1 }, (_, i) => <option key={i} value={i}>{i} / {p.max}</option>)}
                  </select>
                </div>
              </div>
            ))}
            <div className="gs-crit">
              <div className="gs-crit-head">
                <label htmlFor="ap-total">Writing (0–50)</label>
                <input id="ap-total" type="number" min={0} max={50} value={apScore ?? ""} placeholder="—" style={{ width: 110 }}
                  onChange={(e) => { touch(); setAp((s) => ({ ...s, scoreTouched: true, writingScore: e.target.value === "" ? null : Math.round(Number(e.target.value)) })); }} />
              </div>
              <p className="mono muted" style={{ fontSize: 12, margin: 0 }}>
                {suggested === null ? "Chọn đủ 4 phần — web gợi ý điểm 0–50 và CEFR." : <>Gợi ý theo 4 phần: <b>{suggested}</b>/50 · CEFR {Number.isInteger(apScore) ? aptisCefr("writing", apScore) : "—"}. </>}
                {ap.scoreTouched && suggested !== null && apScore !== suggested && (
                  <button type="button" className="linklike" onClick={() => setAp((s) => ({ ...s, scoreTouched: false }))}>Dùng lại điểm gợi ý</button>
                )}
              </p>
            </div>
            <div className="gs-crit">
              <label>Điểm mạnh</label>
              <textarea value={ap.strengths} onChange={(e) => { touch(); setAp((s) => ({ ...s, strengths: e.target.value })); }} placeholder="Những điểm học viên làm tốt…" />
            </div>
            <div className="gs-crit">
              <label>Điểm cần cải thiện</label>
              <textarea value={ap.improvements} onChange={(e) => { touch(); setAp((s) => ({ ...s, improvements: e.target.value })); }} placeholder="Những điểm cần khắc phục…" />
            </div>
          </div>
        </section>
      )}

      <div className="gs-bar">
        {aptis ? (
          <div className="gs-bar-scores">
            <span>Writing <b>{apScore ?? "—"}</b>/50</span>
            <span>CEFR <b>{Number.isInteger(apScore) ? aptisCefr("writing", apScore) : "—"}</b></span>
          </div>
        ) : (
          <div className="gs-bar-scores">
            {taskCount > 1 && ielts.tasks.map((t, ti) => { const tb = ieltsTaskBand(t.criteria); return <span key={ti}>T{ti + 1} <b>{tb !== null ? tb.toFixed(1) : "—"}</b></span>; })}
            <span>Writing <b>{band !== null ? band.toFixed(1) : "—"}</b></span>
            <span>Band cuối <b>{finalBand !== null ? finalBand.toFixed(1) : "—"}</b></span>
          </div>
        )}
        <span className="gs-bar-msg mono">
          {error ? <span className="accent">{error}</span>
            : saved && !dirty ? <span className="success">✓ Đã lưu</span>
            : !ready ? (aptis ? "Chọn đủ 4 phần để lưu" : `Chọn đủ 4 tiêu chí${taskCount > 1 ? ` × ${taskCount} Task` : ""} để lưu`)
            : dirty ? "Có thay đổi chưa lưu" : ""}
        </span>
        <div className="row" style={{ gap: 8, width: "auto" }}>
          {saved && !dirty && <a href={`/teacher/${submissionId}/phieu`} target="_blank" rel="noreferrer"><button type="button" className="btn-ghost btn-sm">Phiếu kết quả ↗</button></a>}
          <button className="btn btn-sm" onClick={save} disabled={saving || !ready}>{saving ? "Đang lưu…" : "Lưu điểm →"}</button>
        </div>
      </div>
    </div>
  );
}
