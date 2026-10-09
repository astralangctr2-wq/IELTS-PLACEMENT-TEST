"use client";

// Inline annotations on the student's essay: select text → pick a tag
// (Ngữ pháp / Từ vựng / Lập luận / Cấu trúc / Điểm tốt) → optional note.
// Highlights are stored as character offsets into writing_text, so the
// essay itself is never modified. Click a highlight to edit or remove it.

import { useRef, useState } from "react";
import { ANNOTATION_TAGS, TAG_BY_KEY, segmentText } from "@/lib/grading";

function offsetIn(container, node, offset) {
  const r = document.createRange();
  r.setStart(container, 0);
  r.setEnd(node, offset);
  return r.toString().length;
}

export default function AnnotationEditor({ text, annotations, onChange }) {
  const boxRef = useRef(null);
  const [draft, setDraft] = useState(null); // { start, end, tag, note, index? }
  const [msg, setMsg] = useState("");

  const readSelection = () => {
    const sel = window.getSelection();
    const box = boxRef.current;
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed || !box) return;
    const range = sel.getRangeAt(0);
    if (!box.contains(range.startContainer) || !box.contains(range.endContainer)) return;
    let start = offsetIn(box, range.startContainer, range.startOffset);
    let end = offsetIn(box, range.endContainer, range.endOffset);
    while (start < end && /\s/.test(text[start])) start++;
    while (end > start && /\s/.test(text[end - 1])) end--;
    if (end <= start) return;
    if (annotations.some((a) => start < a.end && a.start < end)) {
      setMsg("Đoạn chọn trùng với chú thích đã có — bấm vào chú thích đó để sửa, hoặc chọn đoạn khác.");
      return;
    }
    setMsg("");
    setDraft({ start, end, tag: "grammar", note: "" });
  };

  const save = () => {
    if (!draft) return;
    const item = { start: draft.start, end: draft.end, tag: draft.tag, note: draft.note.trim() };
    const next = draft.index !== undefined
      ? annotations.map((a, i) => (i === draft.index ? item : a))
      : [...annotations, item].sort((a, b) => a.start - b.start);
    onChange(next);
    setDraft(null);
    setMsg("");
    window.getSelection()?.removeAllRanges();
  };

  const remove = (index) => {
    onChange(annotations.filter((_, i) => i !== index));
    setDraft(null);
  };

  const edit = (index) => {
    const a = annotations[index];
    setMsg("");
    setDraft({ ...a, index });
  };

  const segs = segmentText(text, annotations);

  return (
    <div className="annot">
      <div className="annot-legend">
        {ANNOTATION_TAGS.map((t) => (
          <span key={t.key} className="annot-chip" style={{ "--tag": t.color }}>{t.label}</span>
        ))}
        <span className="mono muted annot-hint">Bôi đen chữ trong bài để chú thích</span>
      </div>

      <div
        ref={boxRef}
        className="annot-text serif"
        onMouseUp={readSelection}
        onKeyUp={readSelection}
        onTouchEnd={() => setTimeout(readSelection, 50)}
      >
        {segs.map((s, i) =>
          s.ann ? (
            <mark
              key={i}
              className={`annot-mark ${draft?.index === s.index ? "active" : ""}`}
              style={{ "--tag": TAG_BY_KEY[s.ann.tag].color }}
              data-n={s.index + 1}
              title={`${TAG_BY_KEY[s.ann.tag].label}${s.ann.note ? ": " + s.ann.note : ""}`}
              onClick={(e) => { e.stopPropagation(); if (window.getSelection()?.isCollapsed !== false) edit(s.index); }}
            >{s.text}</mark>
          ) : (
            <span key={i}>{s.text}</span>
          )
        )}
      </div>

      {msg && <p className="accent" style={{ fontSize: 13, margin: "8px 0 0" }}>{msg}</p>}

      {draft && (
        <div className="annot-panel">
          <p className="annot-quote">“{text.slice(draft.start, draft.end)}”</p>
          <div className="annot-tags">
            {ANNOTATION_TAGS.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`annot-chip annot-pick ${draft.tag === t.key ? "on" : ""}`}
                style={{ "--tag": t.color }}
                onClick={() => setDraft((d) => ({ ...d, tag: t.key }))}
              >{t.label}</button>
            ))}
          </div>
          <textarea
            value={draft.note}
            onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
            placeholder="Ghi chú cho đoạn này (không bắt buộc) — vd: sửa thành …"
            style={{ minHeight: 60 }}
          />
          <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
            {draft.index !== undefined && <button type="button" className="btn-ghost btn-sm" onClick={() => remove(draft.index)}>Xoá chú thích</button>}
            <button type="button" className="btn-ghost btn-sm" onClick={() => setDraft(null)}>Huỷ</button>
            <button type="button" className="btn btn-sm" onClick={save}>{draft.index !== undefined ? "Lưu thay đổi" : "Thêm chú thích"}</button>
          </div>
        </div>
      )}

      {annotations.length > 0 && (
        <ol className="annot-list">
          {annotations.map((a, i) => (
            <li key={i} onClick={() => edit(i)}>
              <span className="annot-chip" style={{ "--tag": TAG_BY_KEY[a.tag].color }}>{TAG_BY_KEY[a.tag].label}</span>
              <span className="annot-list-quote">“{text.slice(a.start, a.end)}”</span>
              {a.note && <span className="annot-list-note">→ {a.note}</span>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
