"use client";

// Step 2 of grading — "Chữa Writing", laid out like Google Docs in
// suggestion mode: the prompt (with the Task 1 chart) and the student's
// essay on the left, one comment card per highlighted error in the margin
// on the right, level with the text it refers to. Select text → pick a tag
// (Ngữ pháp / Từ vựng / Lập luận / Cấu trúc / Điểm tốt) → write the fix.
// Comments save by themselves as the teacher works. The band of each
// criterion is picked in the bar at the bottom; the written feedback is
// done afterwards on the result sheet (step 3).
//
// Highlights are character offsets into writing_text (the essay itself is
// never modified) — the same data the previous grading screen used.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ANNOTATION_TAGS, TAG_BY_KEY, segmentText,
  IELTS_CRITERIA, ieltsTaskCount, ieltsTaskBand, ieltsWritingBandFromTasks, ieltsTasksOf, ieltsCriterionLabel,
  APTIS_WRITING_PARTS, aptisSuggestedWriting, aptisCefr,
} from "@/lib/grading";

const BANDS = Array.from({ length: 19 }, (_, i) => i / 2);
const roundHalf = (n) => Math.round(n * 2) / 2;
const words = (t) => (t.trim() ? t.trim().split(/\s+/).length : 0);
const clean = (t) => (t || "").replace(/^\s*(TASK|PART)\s+\d+\s*$/gim, "").replace(/\(chưa trả lời\)/g, "").trim();

// Character ranges of each "TASK n" block (headings and blank edges excluded).
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

function offsetIn(container, node, offset) {
  const r = document.createRange();
  r.setStart(container, 0);
  r.setEnd(node, offset);
  return r.toString().length;
}

// Distance from el down to the wrapper, in the wrapper's own CSS pixels
// (offsetTop is not affected by the page's font-size zoom).
function topWithin(el, wrapper) {
  let y = 0, n = el;
  while (n && n !== wrapper) { y += n.offsetTop; n = n.offsetParent; }
  return n === wrapper ? y : null;
}

function initIelts(g, n) {
  const saved = ieltsTasksOf(g);
  return Array.from({ length: n }, (_, ti) => {
    const criteria = {};
    for (const c of IELTS_CRITERIA) {
      const v = saved.length === n ? saved[ti]?.criteria?.[c.key] : null;
      criteria[c.key] = { score: typeof v?.score === "number" ? v.score : null, feedback: v?.feedback || "" };
    }
    return { criteria };
  });
}

function initAptis(g) {
  const a = g?.type === "aptis" ? g : null;
  const parts = {};
  for (const p of APTIS_WRITING_PARTS) parts[p.key] = typeof a?.parts?.[p.key] === "number" ? a.parts[p.key] : null;
  return { parts, writingScore: a ? a.writingScore : null, scoreTouched: Boolean(a), strengths: a?.strengths || "", improvements: a?.improvements || "" };
}

function Prompt({ task, index, count, aptis }) {
  if (!task) return null;
  const label = aptis ? `Part ${index + 1}` : count > 1 ? `Task ${index + 1}` : "Đề bài";
  return (
    <div className="dg-prompt">
      <p className="dg-prompt-label mono">{label}</p>
      {task.imageUrl ? <a href={task.imageUrl} target="_blank" rel="noreferrer"><img src={task.imageUrl} alt="" className="dg-prompt-img" /></a> : null}
      {task.prompt ? <p className="dg-prompt-text">{task.prompt}</p> : null}
      {Array.isArray(task.questions) && task.questions.length > 0 && (
        <ol className="dg-prompt-qs">{task.questions.map((q, i) => <li key={i}>{q}</li>)}</ol>
      )}
    </div>
  );
}

export default function DocGrader({ submissionId, type, text, objectiveBand, initialGrading, graded, prompts, sheetHref }) {
  const router = useRouter();
  const aptis = type === "aptis";
  const full = text || "";
  const taskCount = aptis ? 1 : ieltsTaskCount(full);
  const ranges = aptis ? [{ from: 0, to: full.length }] : taskRanges(full, taskCount);
  const tabs = ranges.length;
  const [ti, setTi] = useState(0);
  const range = ranges[ti] || ranges[0];
  const local = full.slice(range.from, range.to);

  // ---------------- annotations (global offsets) + autosave
  const [annotations, setAnnotations] = useState(Array.isArray(initialGrading?.annotations) ? initialGrading.annotations : []);
  const [annState, setAnnState] = useState(""); // "" | saving | saved | error
  const saveTimer = useRef(null);
  const latest = useRef(annotations);
  const flushAnnotations = useCallback(async () => {
    clearTimeout(saveTimer.current);
    saveTimer.current = null;
    setAnnState("saving");
    try {
      const res = await fetch(`/api/submissions/${submissionId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "annotate", annotations: latest.current }),
      });
      if (!res.ok) throw new Error();
      setAnnState("saved");
    } catch { setAnnState("error"); }
  }, [submissionId]);
  const setAll = (next) => {
    latest.current = next;
    setAnnotations(next);
    setAnnState("pending");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flushAnnotations, 900);
  };
  useEffect(() => {
    const warn = (e) => { if (saveTimer.current) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  // This task's annotations, with local offsets and their global index.
  const mine = useMemo(() => annotations
    .map((a, gi) => ({ ...a, gi }))
    .filter((a) => a.start >= range.from && a.end <= range.to)
    .map((a) => ({ ...a, start: a.start - range.from, end: a.end - range.from })), [annotations, range.from, range.to]);

  // ---------------- selection → draft comment
  const wrapRef = useRef(null);
  const essayRef = useRef(null);
  const [draft, setDraft] = useState(null); // { start, end, tag, note, gi?, top }
  const [activeGi, setActiveGi] = useState(null);
  const [hoverGi, setHoverGi] = useState(null);
  const [msg, setMsg] = useState("");

  const readSelection = () => {
    const sel = window.getSelection();
    const box = essayRef.current, wrap = wrapRef.current;
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed || !box || !wrap) return;
    const r = sel.getRangeAt(0);
    if (!box.contains(r.startContainer) || !box.contains(r.endContainer)) return;
    let start = offsetIn(box, r.startContainer, r.startOffset);
    let end = offsetIn(box, r.endContainer, r.endOffset);
    while (start < end && /\s/.test(local[start])) start++;
    while (end > start && /\s/.test(local[end - 1])) end--;
    if (end <= start) return;
    if (mine.some((a) => start < a.end && a.start < end)) {
      setMsg("Đoạn chọn trùng với một chú thích đã có — bấm vào chú thích đó để sửa.");
      return;
    }
    const wr = wrap.getBoundingClientRect();
    const zoom = wrap.offsetHeight ? wr.height / wrap.offsetHeight : 1;
    const top = (r.getBoundingClientRect().top - wr.top) / (zoom || 1);
    setMsg("");
    setActiveGi(null);
    setDraft({ start, end, tag: "grammar", note: "", top });
  };

  const saveDraft = () => {
    if (!draft) return;
    const item = { start: draft.start + range.from, end: draft.end + range.from, tag: draft.tag, note: draft.note.trim() };
    const next = draft.gi !== undefined
      ? annotations.map((a, i) => (i === draft.gi ? item : a))
      : [...annotations, item].sort((a, b) => a.start - b.start);
    setAll(next);
    setDraft(null);
    window.getSelection()?.removeAllRanges();
  };
  const removeAt = (gi) => { setAll(annotations.filter((_, i) => i !== gi)); setDraft(null); setActiveGi(null); };
  const openEdit = (gi) => {
    const a = annotations[gi];
    setMsg("");
    setActiveGi(gi);
    setDraft({ start: a.start - range.from, end: a.end - range.from, tag: a.tag, note: a.note || "", gi });
  };
  const switchTask = (i) => { setTi(i); setDraft(null); setActiveGi(null); setMsg(""); };

  // ---------------- margin layout: each card level with its highlight
  const cardRefs = useRef({});
  const [tops, setTops] = useState({});
  const [narrow, setNarrow] = useState(false);
  const layout = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const isNarrow = window.matchMedia("(max-width: 900px)").matches;
    setNarrow(isNarrow);
    if (isNarrow) { setTops((prev) => (Object.keys(prev).length ? {} : prev)); return; }
    const want = [];
    for (const a of mine) {
      const el = wrap.querySelector(`[data-gi="${a.gi}"]`);
      const y = el ? topWithin(el, wrap) : null;
      if (y !== null) want.push({ key: `a${a.gi}`, y });
    }
    if (draft && draft.gi === undefined && typeof draft.top === "number") want.push({ key: "draft", y: draft.top });
    want.sort((p, q) => p.y - q.y || Number(p.key === "draft") - Number(q.key === "draft"));
    // The open card keeps its place; the others make room around it.
    const focus = draft ? (draft.gi !== undefined ? `a${draft.gi}` : "draft") : activeGi !== null ? `a${activeGi}` : null;
    const h = (k) => (cardRefs.current[k]?.offsetHeight || 60) + 8;
    const out = {};
    const fi = want.findIndex((w) => w.key === focus);
    if (fi >= 0) {
      out[want[fi].key] = want[fi].y;
      let y = want[fi].y + h(want[fi].key);
      for (let i = fi + 1; i < want.length; i++) { out[want[i].key] = Math.max(want[i].y, y); y = out[want[i].key] + h(want[i].key); }
      y = want[fi].y;
      for (let i = fi - 1; i >= 0; i--) { out[want[i].key] = Math.min(want[i].y, y - h(want[i].key)); y = out[want[i].key]; }
      const shift = Math.min(0, ...Object.values(out));
      if (shift < 0) for (const k of Object.keys(out)) out[k] -= shift;
    } else {
      let y = 0;
      for (const w of want) { out[w.key] = Math.max(w.y, y); y = out[w.key] + h(w.key); }
    }
    setTops((prev) => (JSON.stringify(prev) === JSON.stringify(out) ? prev : out));
  }, [mine, draft, activeGi]);
  useLayoutEffect(() => { layout(); });
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => layout());
    ro.observe(wrap);
    window.addEventListener("resize", layout);
    return () => { ro.disconnect(); window.removeEventListener("resize", layout); };
  }, [layout]);
  const marginHeight = Math.max(0, ...Object.entries(tops).map(([k, y]) => y + (cardRefs.current[k]?.offsetHeight || 60)));

  // ---------------- bands (bottom bar)
  const [tasks, setTasks] = useState(() => initIelts(initialGrading, taskCount));
  const [ap, setAp] = useState(() => initAptis(initialGrading));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedGrade, setSavedGrade] = useState(Boolean(graded && initialGrading && initialGrading.type !== "draft"));
  const setCrit = (t, key, score) => { setSavedGrade(false); setTasks((s) => s.map((x, i) => (i !== t ? x : { ...x, criteria: { ...x.criteria, [key]: { ...x.criteria[key], score } } }))); };
  const band = ieltsWritingBandFromTasks(tasks);
  const finalBand = band === null ? null : objectiveBand !== null ? roundHalf((objectiveBand + band) / 2) : band;
  const suggested = aptisSuggestedWriting(ap.parts);
  const apScore = ap.scoreTouched ? ap.writingScore : suggested;
  const ready = aptis
    ? APTIS_WRITING_PARTS.every((p) => typeof ap.parts[p.key] === "number") && Number.isInteger(apScore) && apScore >= 0 && apScore <= 50
    : band !== null;
  const missing = aptis
    ? APTIS_WRITING_PARTS.filter((p) => typeof ap.parts[p.key] !== "number").length
    : tasks.reduce((a, t) => a + IELTS_CRITERIA.filter((c) => typeof t.criteria[c.key].score !== "number").length, 0);

  const saveGrade = async (thenSheet) => {
    setSaving(true);
    setError("");
    clearTimeout(saveTimer.current);
    saveTimer.current = null;
    // Comments written on the sheet / earlier are kept as they are.
    const g = initialGrading && initialGrading.type !== "draft" ? initialGrading : {};
    const body = aptis
      ? { action: "grade", parts: ap.parts, writingScore: apScore, strengths: ap.strengths, improvements: ap.improvements, annotations: latest.current }
      : { action: "grade", tasks, note: g.note || "", annotations: latest.current };
    try {
      const res = await fetch(`/api/submissions/${submissionId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể lưu điểm.");
      setSavedGrade(true);
      setAnnState("saved");
      if (thenSheet) { window.location.href = sheetHref; return; }
      router.refresh();
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  };

  const segs = segmentText(local, mine);
  const promptOf = (i) => (Array.isArray(prompts) ? prompts[i] : null);
  const essayWords = words(clean(local));
  const minWords = !aptis && taskCount > 1 ? (ti === 1 ? 250 : 150) : null;
  const countAll = (k) => annotations.filter((a) => a.tag === k).length;

  const card = (key, a, isDraft) => {
    const tag = TAG_BY_KEY[(isDraft ? draft.tag : a.tag)] || ANNOTATION_TAGS[0];
    const editing = draft && (isDraft ? draft.gi === undefined : draft.gi === a.gi);
    const quote = isDraft ? local.slice(draft.start, draft.end) : local.slice(a.start, a.end);
    const style = narrow ? undefined : { top: tops[key] ?? 0 };
    return (
      <div
        key={key}
        ref={(el) => { if (el) cardRefs.current[key] = el; else delete cardRefs.current[key]; }}
        className={`dg-card ${editing ? "editing" : ""} ${!isDraft && (activeGi === a.gi || hoverGi === a.gi) ? "on" : ""}`}
        style={{ ...style, "--tag": tag.color }}
        onMouseEnter={() => !isDraft && setHoverGi(a.gi)}
        onMouseLeave={() => setHoverGi(null)}
        onClick={() => { if (!isDraft && !editing) openEdit(a.gi); }}
      >
        <div className="dg-card-head">
          <span className="dg-card-tag">{tag.label}</span>
          {!isDraft && <span className="dg-card-n mono">#{mine.findIndex((m) => m.gi === a.gi) + 1}</span>}
        </div>
        <p className="dg-card-quote">“{quote.length > 90 ? quote.slice(0, 87) + "…" : quote}”</p>
        {editing ? (
          <div className="dg-card-edit" onClick={(e) => e.stopPropagation()}>
            <div className="dg-tags">
              {ANNOTATION_TAGS.map((t) => (
                <button key={t.key} type="button" className={`annot-chip annot-pick ${draft.tag === t.key ? "on" : ""}`} style={{ "--tag": t.color }}
                  onClick={() => setDraft((d) => ({ ...d, tag: t.key }))}>{t.label}</button>
              ))}
            </div>
            <textarea
              autoFocus
              value={draft.note}
              onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) saveDraft(); if (e.key === "Escape") { setDraft(null); setActiveGi(null); } }}
              placeholder={draft.tag === "good" ? "Khen điểm tốt (không bắt buộc)…" : "Sửa thành… / giải thích lỗi (không bắt buộc)"}
            />
            <div className="dg-card-actions">
              {!isDraft && <button type="button" className="btn-ghost btn-sm dg-del" onClick={() => removeAt(a.gi)}>Xoá</button>}
              <button type="button" className="btn-ghost btn-sm" onClick={() => { setDraft(null); setActiveGi(null); window.getSelection()?.removeAllRanges(); }}>Huỷ</button>
              <button type="button" className="btn btn-sm" onClick={saveDraft}>{isDraft ? "Bình luận" : "Lưu"}</button>
            </div>
          </div>
        ) : (
          a.note ? <p className="dg-card-note">{a.note}</p> : <p className="dg-card-note muted">(không ghi chú)</p>
        )}
      </div>
    );
  };

  const written = clean(full);

  return (
    <div className="dg">
      <div className="dg-toolbar">
        {tabs > 1 && (
          <div className="dg-tabs" role="tablist">
            {ranges.map((_, i) => {
              const n = annotations.filter((a) => a.start >= ranges[i].from && a.end <= ranges[i].to).length;
              return <button key={i} type="button" role="tab" aria-selected={ti === i} className={ti === i ? "on" : ""} onClick={() => switchTask(i)}>Task {i + 1}{n ? <span className="dg-tab-n">{n}</span> : null}</button>;
            })}
          </div>
        )}
        <div className="dg-legend">
          {ANNOTATION_TAGS.map((t) => <span key={t.key} className="annot-chip" style={{ "--tag": t.color }}>{t.label}{countAll(t.key) ? ` · ${countAll(t.key)}` : ""}</span>)}
        </div>
        <span className="dg-autosave mono">
          {annState === "saving" || annState === "pending" ? "Đang lưu chú thích…" : annState === "saved" ? "✓ Đã lưu chú thích" : annState === "error" ? <span className="accent">Chưa lưu được — thử lại</span> : "Bôi đen chữ trong bài để bình luận"}
        </span>
      </div>

      {!written ? (
        <div className="card"><p style={{ margin: 0 }}><b>Học viên không viết bài.</b> Vẫn chọn điểm ở thanh dưới (thường là 0) để lưu.</p></div>
      ) : (
        <div className={`dg-doc ${narrow ? "narrow" : ""}`} ref={wrapRef}>
          <div className="dg-page">
            {aptis
              ? (Array.isArray(prompts) && prompts.length ? <details className="dg-prompts" open><summary>Đề bài ({prompts.length} phần)</summary>{prompts.map((p, i) => <Prompt key={i} task={p} index={i} count={prompts.length} aptis />)}</details> : null)
              : <Prompt task={promptOf(ti)} index={ti} count={taskCount} />}
            {!promptOf(ti) && !aptis && <p className="dg-noprompt muted">Không tìm thấy đề bài (bộ đề có thể đã bị xoá).</p>}
            <div className="dg-essay-head">
              <b>Bài làm{tabs > 1 ? ` — Task ${ti + 1}` : ""}</b>
              <span className={`mono ${minWords && essayWords < minWords ? "accent" : "muted"}`}>{essayWords} từ{minWords ? ` / ${minWords}` : ""}</span>
            </div>
            {clean(local) ? (
              <div ref={essayRef} className="dg-essay serif" onMouseUp={readSelection} onKeyUp={readSelection} onTouchEnd={() => setTimeout(readSelection, 50)}>
                {segs.map((s, i) => s.ann ? (
                  <mark key={i} data-gi={s.ann.gi}
                    className={`annot-mark dg-mark ${activeGi === s.ann.gi || hoverGi === s.ann.gi ? "active" : ""}`}
                    style={{ "--tag": TAG_BY_KEY[s.ann.tag]?.color }}
                    data-n={s.index + 1}
                    onMouseEnter={() => setHoverGi(s.ann.gi)} onMouseLeave={() => setHoverGi(null)}
                    onClick={(e) => { e.stopPropagation(); if (window.getSelection()?.isCollapsed !== false) openEdit(s.ann.gi); }}
                  >{s.text}</mark>
                ) : <span key={i}>{s.text}</span>)}
              </div>
            ) : <p className="muted"><b>Học viên không viết phần này.</b></p>}
            {msg && <p className="accent" style={{ fontSize: 13, margin: "8px 0 0" }}>{msg}</p>}
          </div>
          <div className="dg-margin" style={narrow ? undefined : { minHeight: marginHeight }}>
            {mine.length === 0 && !draft && (
              <div className="dg-empty muted">
                <p style={{ margin: 0 }}><b>Chưa có bình luận.</b></p>
                <p style={{ margin: "6px 0 0" }}>Bôi đen một chữ / câu trong bài → chọn loại lỗi → ghi cách sửa. Bình luận hiện ở đây, ngang với chỗ lỗi.</p>
              </div>
            )}
            {mine.map((a) => card(`a${a.gi}`, a, false))}
            {draft && draft.gi === undefined && card("draft", null, true)}
          </div>
        </div>
      )}

      <div className="gs-bar dg-bar">
        {aptis ? (
          <div className="dg-bands">
            {APTIS_WRITING_PARTS.map((p) => (
              <label key={p.key} className="dg-band" title={p.label}>
                <span>{p.label.split(" — ")[0]}</span>
                <select value={ap.parts[p.key] ?? ""} onChange={(e) => { setSavedGrade(false); setAp((s) => ({ ...s, parts: { ...s.parts, [p.key]: e.target.value === "" ? null : Number(e.target.value) } })); }}>
                  <option value="">—</option>
                  {Array.from({ length: p.max + 1 }, (_, i) => <option key={i} value={i}>{i}/{p.max}</option>)}
                </select>
              </label>
            ))}
            <label className="dg-band" title="Điểm Writing thang 0–50 (gợi ý từ 4 phần, sửa được)">
              <span>Writing /50</span>
              <input type="number" min={0} max={50} value={apScore ?? ""} placeholder="—"
                onChange={(e) => { setSavedGrade(false); setAp((s) => ({ ...s, scoreTouched: true, writingScore: e.target.value === "" ? null : Math.round(Number(e.target.value)) })); }} />
            </label>
            <span className="dg-total">CEFR <b>{Number.isInteger(apScore) ? aptisCefr("writing", apScore) : "—"}</b></span>
          </div>
        ) : (
          <div className="dg-bands">
            <span className="dg-bands-title">{taskCount > 1 ? `Band Task ${ti + 1}` : "Band"}</span>
            {IELTS_CRITERIA.map((c) => (
              <label key={c.key} className="dg-band" title={ieltsCriterionLabel(c, ti, taskCount)}>
                <span>{c.short}</span>
                <select value={tasks[ti]?.criteria[c.key].score ?? ""} onChange={(e) => setCrit(ti, c.key, e.target.value === "" ? null : Number(e.target.value))}>
                  <option value="">—</option>
                  {BANDS.map((b) => <option key={b} value={b}>{b.toFixed(1)}</option>)}
                </select>
              </label>
            ))}
            <span className="dg-total">
              {taskCount > 1 && tasks.map((t, i) => { const tb = ieltsTaskBand(t.criteria); return <span key={i} className={i === ti ? "cur" : ""}>T{i + 1} <b>{tb !== null ? tb.toFixed(1) : "—"}</b></span>; })}
              <span>Writing <b>{band !== null ? band.toFixed(1) : "—"}</b></span>
              <span>Band cuối <b>{finalBand !== null ? finalBand.toFixed(1) : "—"}</b></span>
            </span>
          </div>
        )}
        <span className="gs-bar-msg mono">
          {error ? <span className="accent">{error}</span>
            : !ready ? `Còn ${missing} ô điểm${!aptis && taskCount > 1 ? " (xem cả 2 Task)" : ""}`
            : savedGrade ? <span className="success">✓ Đã lưu điểm</span> : "Điểm chưa lưu"}
        </span>
        <div className="row" style={{ gap: 8, width: "auto" }}>
          {!aptis && taskCount > 1 && ti < tabs - 1 && <button type="button" className="btn-ghost btn-sm" onClick={() => switchTask(ti + 1)}>Task {ti + 2} →</button>}
          <button type="button" className="btn-ghost btn-sm" onClick={() => saveGrade(false)} disabled={saving || !ready}>{saving ? "Đang lưu…" : "Lưu điểm"}</button>
          <button type="button" className="btn btn-sm" onClick={() => saveGrade(true)} disabled={saving || !ready} title={ready ? "" : "Chọn đủ điểm các tiêu chí trước"}>Lưu &amp; viết nhận xét →</button>
        </div>
      </div>
    </div>
  );
}
