"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useFontSize } from "@/app/contexts/ThemeContext";
import { flattenSectionQuestions, renderMarkedText, parsePassageBlocks } from "@/lib/content";
import BrandBar from "../components/BrandBar";

const ALL_SKILLS = ["grammar", "reading", "listening", "writing"];
const SKILL_TITLES = { grammar: "Ngữ pháp", reading: "Reading", listening: "Listening", writing: "Writing" };
const BAND_OPTIONS = ["4.0", "4.5", "5.0", "5.5", "6.0", "6.5", "7.0", "7.5", "8.0", "8.5", "Chưa rõ mục tiêu"];
const FONT_SIZES = { small: 0.9, medium: 1, large: 1.15 };

function MarkedText({ text }) {
  const parts = renderMarkedText(text);
  return parts.map((part) =>
    typeof part === "string" ? part : <u key={part.key} className="vocab-underline">{part.text}</u>
  );
}

// ZoomableImage — a normal <img> that opens a full-screen lightbox on
// click. Used for reading passage diagrams and writing task charts,
// which are often too small to read comfortably at inline size.
// The lightbox lets the user pinch/scroll-zoom further via native
// browser image zoom since the image is rendered at its natural size
// (up to viewport bounds) rather than force-fit, so a higher-resolution
// source image will look sharper here than the inline thumbnail.
function ZoomableImage({ src, alt, className }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <div
        className={`zoomable-image-wrap ${className || ""}`}
        onClick={() => setOpen(true)}
        role="button"
        tabIndex={0}
        title="Bấm để phóng to"
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setOpen(true); }}
      >
        <img src={src} alt={alt || ""} className="passage-image" />
        <span className="zoom-hint">🔍 Bấm để phóng to</span>
      </div>
      {open && (
        <div className="image-lightbox-overlay" onClick={() => setOpen(false)}>
          <button
            type="button"
            className="image-lightbox-close"
            onClick={() => setOpen(false)}
            aria-label="Đóng"
          >
            ✕
          </button>
          <img
            src={src}
            alt={alt || ""}
            className="image-lightbox-img"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

// Memoized so it renders exactly once per passage and never again — the
// countdown timer ticks every second and would otherwise wipe out any
// highlights the student has manually added via text selection (React
// would reconcile the subtree from scratch on every tick).
const PassageBlocks = memo(function PassageBlocks({ text }) {
  const blocks = parsePassageBlocks(text);
  return blocks.map((b, i) => {
    if (b.type === "title") {
      return <p key={i} style={{ fontWeight: 700, fontSize: 18, marginTop: i > 0 ? 20 : 0, marginBottom: 10 }}>{b.text}</p>;
    }
    if (b.type === "heading") {
      return <p key={i} style={{ fontWeight: 700, fontSize: 15, marginTop: i > 0 ? 18 : 0, marginBottom: 4 }}>{b.text}</p>;
    }
    return (
      <p key={i} className="serif" style={{ lineHeight: 1.7, whiteSpace: "pre-line", marginBottom: 12 }}>
        <MarkedText text={b.text} />
      </p>
    );
  });
});

// Enables "drag to select → auto-highlight" over its children: dragging
// over text wraps the selection in a <mark>, clicking an existing
// highlight removes it. Implemented as direct DOM manipulation (not
// React state), so it only stays reliable over content that doesn't
// re-render on its own (see the memoized PassageBlocks/QuestionCard
// below) — a re-render of a specific piece of text will still reset
// any highlight sitting on exactly that text, which is an accepted
// trade-off for keeping this feature simple.
// HighlightZone — lets the student select passage text and choose to
// highlight or un-highlight it via a floating toolbar, instead of the
// previous behaviour (auto-highlight on every mouseup). The toolbar
// approach fixes three problems the old version had:
//   1. Double-clicking a word (a normal way to select-then-copy) used to
//      trigger an instant highlight; now nothing happens until the
//      student explicitly presses a button.
//   2. Selecting text that overlaps an existing highlight used to create
//      nested <mark> elements with jagged, doubled-up backgrounds. The
//      "Tô đậm" button now first un-wraps any marks the new selection
//      touches, then wraps the whole selection in one clean mark.
//   3. Ctrl+C right after selecting text now works reliably, because the
//      browser's native selection is left completely untouched until a
//      toolbar button is actually clicked — there's no DOM mutation (and
//      so no lost selection) in the common case of "select then copy".
function HighlightZone({ children }) {
  const ref = useRef(null);
  const [toolbarPos, setToolbarPos] = useState(null); // { x, y } in viewport coords
  const pendingRangeRef = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const hideToolbar = () => {
      setToolbarPos(null);
      pendingRangeRef.current = null;
    };

    const onMouseUp = (e) => {
      if (e.target.closest && e.target.closest(".highlight-toolbar")) return;

      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        hideToolbar();
        return;
      }
      const range = sel.getRangeAt(0);
      if (!el.contains(range.commonAncestorContainer) || range.collapsed) {
        hideToolbar();
        return;
      }
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        hideToolbar();
        return;
      }

      pendingRangeRef.current = range.cloneRange();
      // Open above the selection; if there's no room above (selection is
      // near the top of the screen) open below it instead. Keep it inside
      // the viewport horizontally so it never gets cut off at an edge.
      const below = rect.top < 72;
      const x = Math.min(Math.max(rect.left + rect.width / 2, 110), window.innerWidth - 110);
      setToolbarPos({ x, y: below ? rect.bottom : rect.top, below });
    };

    const onMouseDown = (e) => {
      if (e.target.closest && e.target.closest(".highlight-toolbar")) return;
      hideToolbar();
    };

    const onScroll = () => hideToolbar();

    el.addEventListener("mouseup", onMouseUp);
    document.addEventListener("mousedown", onMouseDown);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      el.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, []);

  // Un-wraps every existing highlight the given range touches, moving
  // its text nodes back up to the parent instead of deleting them —
  // this keeps the Range's node references valid so it can still be
  // used afterwards (e.g. to then apply a fresh, non-nested highlight).
  const unwrapIntersectingMarks = (range) => {
    const el = ref.current;
    if (!el) return;
    const marks = Array.from(el.querySelectorAll("mark.reading-highlight"));
    marks.forEach((mark) => {
      if (!range.intersectsNode(mark)) return;
      const parent = mark.parentNode;
      if (!parent) return;
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
      parent.removeChild(mark);
    });
  };

  const applyHighlight = () => {
    const range = pendingRangeRef.current;
    if (!range) return;

    // Flatten any highlights this selection overlaps first, so the new
    // mark we create below is the only one covering this text — this is
    // what prevents the jagged, doubled-up look from nested <mark>s.
    unwrapIntersectingMarks(range);

    const mark = document.createElement("mark");
    mark.className = "reading-highlight";
    try {
      range.surroundContents(mark);
    } catch (err) {
      try {
        const contents = range.extractContents();
        mark.appendChild(contents);
        range.insertNode(mark);
      } catch (err2) {
        // selection crossed something surroundContents/extractContents
        // can't handle — give up quietly rather than breaking the page
      }
    }
    ref.current && ref.current.normalize();

    // Re-select the newly highlighted text so a follow-up Ctrl+C still
    // copies exactly what the student just marked.
    try {
      const sel = window.getSelection();
      sel.removeAllRanges();
      const newRange = document.createRange();
      newRange.selectNodeContents(mark);
      sel.addRange(newRange);
    } catch (err) {}

    setToolbarPos(null);
    pendingRangeRef.current = null;
  };

  const removeHighlight = () => {
    const range = pendingRangeRef.current;
    if (!range) return;
    unwrapIntersectingMarks(range);
    ref.current && ref.current.normalize();
    window.getSelection().removeAllRanges();
    setToolbarPos(null);
    pendingRangeRef.current = null;
  };

  return (
    <div ref={ref} className="highlightable">
      {children}
      {/* Rendered through a portal into <body>: the reading view can be
          wrapped in a CSS zoom (for the text-size setting), and a
          position:fixed element inside a zoomed ancestor gets placed at
          the wrong spot. Outside that wrapper the coordinates are exact. */}
      {toolbarPos &&
        createPortal(
          <div
            className={`highlight-toolbar${toolbarPos.below ? " below" : ""}`}
            style={{ left: toolbarPos.x, top: toolbarPos.y }}
          >
            <button type="button" className="hl-apply" onClick={applyHighlight}>🖍 Tô đậm</button>
            <button type="button" className="hl-remove" onClick={removeHighlight}>✖ Bỏ tô đậm</button>
          </div>,
          document.body
        )}
    </div>
  );
}

// DiagramOverlay — renders an image with gap-fill inputs overlaid at
// precise positions declared in each question's `pin` field:
//   pin: { x: 42, y: 67, width: 18 }
// x/y are percentages of the image's rendered width/height (top-left
// corner of the input box). width is the input width as a % of the
// image width. All three are optional — if any is missing the input
// falls back to rendering below the image as a normal card.
//
// Questions that share the same `imageUrl` AND all have a `pin` field
// are grouped into one DiagramOverlay block by QuestionListBlock.
function DiagramOverlay({ questions, answers, onChange, locked, startIndex }) {
  const imgRef = useRef(null);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;
    const update = () => setImgSize({ w: el.offsetWidth, h: el.offsetHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const imageUrl = questions[0]?.imageUrl;

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ position: "relative", display: "inline-block", width: "100%" }}>
        <img
          ref={imgRef}
          src={imageUrl}
          alt="diagram"
          style={{ display: "block", width: "100%", height: "auto", borderRadius: 0 }}
          onLoad={() => {
            if (imgRef.current) setImgSize({ w: imgRef.current.offsetWidth, h: imgRef.current.offsetHeight });
          }}
        />
        {questions.map((q, i) => {
          const pin = q.pin || {};
          if (pin.x == null || pin.y == null) return null;
          const left = `${pin.x}%`;
          const top = `${pin.y}%`;
          const width = pin.width ? `${pin.width}%` : "14%";
          return (
            <div
              key={q.id}
              style={{ position: "absolute", left, top, width, transform: "translateY(-50%)" }}
              title={`Câu ${startIndex + i + 1}: ${q.q}`}
            >
              <div style={{
                display: "flex", alignItems: "center", gap: 3,
                background: "var(--primary)", borderRadius: 4,
                padding: "1px 4px", marginBottom: 2, width: "fit-content"
              }}>
                <span style={{ color: "#fff", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" }}>
                  {startIndex + i + 1}
                </span>
              </div>
              <input
                type="text"
                disabled={locked}
                placeholder="…"
                value={typeof answers[q.id] === "string" ? answers[q.id] : ""}
                onChange={(e) => onChange(q.id, e.target.value)}
                style={{
                  width: "100%", fontSize: 11, padding: "2px 5px",
                  borderRadius: 4, border: "2px solid var(--primary)",
                  background: "var(--card)", color: "var(--text)",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
                  opacity: locked ? 0.6 : 1,
                }}
              />
            </div>
          );
        })}
      </div>
      {/* Fallback: questions without pin still render as plain cards below */}
      {questions.some((q) => !q.pin || q.pin.x == null) && (
        <div style={{ padding: "12px 16px" }} className="stack">
          {questions.filter((q) => !q.pin || q.pin.x == null).map((q, i) => {
            const globalIdx = startIndex + questions.findIndex((qq) => qq.id === q.id);
            return (
              <div key={q.id}>
                <p className="mono muted" style={{ fontSize: 12, marginBottom: 4 }}>Câu {globalIdx + 1}</p>
                <p style={{ marginBottom: 8, lineHeight: 1.5, fontSize: 14 }}>{q.q}</p>
                <input
                  type="text"
                  disabled={locked}
                  placeholder="Nhập câu trả lời…"
                  value={typeof answers[q.id] === "string" ? answers[q.id] : ""}
                  onChange={(e) => onChange(q.id, e.target.value)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Memoized so a question card only re-renders when its OWN answer,
// lock state, or index actually changes — not on every tick of the
// countdown timer elsewhere on the page. This is what lets highlights
// on a question's text survive as long as the student isn't actively
// answering that specific question.
const QuestionCard = memo(function QuestionCard({ q, qId, index, answer, onChange, locked }) {
  const type = q.type || "mc";
  return (
    <div className="card">
      <p className="mono muted" style={{ fontSize: 12, marginBottom: 8 }}>Câu {index + 1}</p>
      {/* Per-question image (non-overlay): shown when imageUrl is set but no pin coords */}
      {q.imageUrl && (!q.pin || q.pin.x == null) && (
        <ZoomableImage src={q.imageUrl} alt="" className="mb-12" />
      )}
      <p style={{ marginBottom: 12, lineHeight: 1.5 }}>{q.q}</p>

      {type === "mc" && (
        <div className="stack" style={{ marginTop: 4 }}>
          {q.opts.map((opt, oi) => (
            <div
              key={oi}
              className={`option ${answer === oi ? "selected" : ""}`}
              onClick={() => !locked && onChange(qId, oi)}
              role="button"
              tabIndex={0}
              style={locked ? { opacity: 0.6, cursor: "not-allowed" } : {}}
              onKeyDown={(e) => { if (!locked && (e.key === "Enter" || e.key === " ")) onChange(qId, oi); }}
            >
              <span className={`bubble ${answer === oi ? "selected" : ""}`}>{String.fromCharCode(65 + oi)}</span>
              <span>{opt}</span>
            </div>
          ))}
        </div>
      )}

      {type === "gap" && (
        <input
          type="text"
          disabled={locked}
          placeholder="Nhập câu trả lời…"
          value={typeof answer === "string" ? answer : ""}
          onChange={(e) => onChange(qId, e.target.value)}
        />
      )}

      {type === "multi_select" && (
        <div>
          <p className="mono muted" style={{ fontSize: 11, marginBottom: 8 }}>Chọn đúng {q.selectCount} đáp án</p>
          <div className="stack" style={{ marginTop: 4 }}>
            {q.opts.map((opt, oi) => {
              const arr = Array.isArray(answer) ? answer : [];
              const selected = arr.includes(oi);
              const atLimit = arr.length >= q.selectCount && !selected;
              return (
                <div
                  key={oi}
                  className={`option ${selected ? "selected" : ""}`}
                  style={locked || atLimit ? { opacity: 0.4, cursor: "not-allowed" } : {}}
                  onClick={() => {
                    if (locked || atLimit) return;
                    const next = selected ? arr.filter((i) => i !== oi) : [...arr, oi];
                    onChange(qId, next);
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <span className={`bubble ${selected ? "selected" : ""}`}>{String.fromCharCode(65 + oi)}</span>
                  <span>{opt}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

// Renders one blank inside a line of text: splits on the "___" marker
// and inserts either a free-text input (default) or a <select> bound to
// wordBank (Summary Completion with a given word list). The numbered
// badge sits right before the blank, matching how IELTS prints the
// question number in-line with the sentence rather than above it.
function InlineBlank({ text, value, wordBank, disabled, onChange, badgeNumber }) {
  const idx = text.indexOf("___");
  const before = idx >= 0 ? text.slice(0, idx) : text;
  const after = idx >= 0 ? text.slice(idx + 3) : "";
  return (
    <span>
      {before}
      <span
        className="mono"
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          minWidth: 22, height: 22, borderRadius: 4, border: "1.5px solid var(--primary)",
          fontSize: 11, fontWeight: 700, margin: "0 6px", padding: "0 4px", verticalAlign: "middle",
        }}
      >
        {badgeNumber}
      </span>
      {wordBank ? (
        <select
          disabled={disabled}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="inline-blank-input"
          style={{ display: "inline-block", width: "auto", minWidth: 160, verticalAlign: "middle" }}
        >
          <option value="">— chọn —</option>
          {wordBank.map((w, wi) => (
            <option key={wi} value={w}>{w}</option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          disabled={disabled}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="inline-blank-input"
          style={{ display: "inline-block", width: 170, verticalAlign: "middle" }}
        />
      )}
      {after}
    </span>
  );
}

// MatchingQuestion — IELTS Matching Headings / Matching Information /
// Matching Features / Matching Sentence Endings. One question object
// carries several "items" (things to match) against a shared, fixed
// "options" bank. The answer is stored as ONE array under
// answers[q.id] (one options-index per item, same order as q.items) so
// it flows through the exact same generic answers[q.id] collection the
// rest of the runner already uses — no special-casing needed elsewhere.
// "display": "grid" draws a radio-button table (best for short option
// labels — letters, names, section codes); "bank" draws one dropdown
// per item against the full-text option bank (best for long options —
// headings, sentence endings).
const MatchingQuestion = memo(function MatchingQuestion({ q, startIndex, answers, onChange, locked }) {
  const selected = Array.isArray(answers[q.id]) ? answers[q.id] : [];

  const setItemAnswer = (itemIdx, optIdx) => {
    const next = [...selected];
    while (next.length < q.items.length) next.push(null);
    next[itemIdx] = optIdx;
    onChange(q.id, next);
  };

  if (q.display === "grid") {
    return (
      <div className="card" style={{ overflowX: "auto" }}>
        {q.q && <p style={{ marginBottom: 12, lineHeight: 1.5 }}>{q.q}</p>}
        <table>
          <thead>
            <tr>
              <th></th>
              {q.options.map((opt, oi) => (
                <th key={oi} style={{ textAlign: "center" }}>{opt}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {q.items.map((item, ii) => (
              <tr key={ii}>
                <td>
                  <span className="mono muted" style={{ fontSize: 12, marginRight: 8 }}>{startIndex + ii + 1}</span>
                  {item}
                </td>
                {q.options.map((opt, oi) => (
                  <td key={oi} style={{ textAlign: "center" }}>
                    <input
                      type="radio"
                      disabled={locked}
                      checked={selected[ii] === oi}
                      onChange={() => setItemAnswer(ii, oi)}
                      style={{ cursor: locked ? "not-allowed" : "pointer" }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="card stack">
      {q.q && <p style={{ marginBottom: 4, lineHeight: 1.5 }}>{q.q}</p>}
      {q.items.map((item, ii) => (
        <div key={ii}>
          <p className="mono muted" style={{ fontSize: 12, marginBottom: 4 }}>Câu {startIndex + ii + 1}</p>
          <p style={{ marginBottom: 8, lineHeight: 1.5 }}>{item}</p>
          <select
            disabled={locked}
            value={selected[ii] ?? ""}
            onChange={(e) => setItemAnswer(ii, e.target.value ? parseInt(e.target.value, 10) : null)}
          >
            <option value="">— Chọn đáp án —</option>
            {q.options.map((opt, oi) => (
              <option key={oi} value={oi}>{opt}</option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
});

// Splits `cell` on its single optional "___" and renders the part before,
// an InlineBlank-style input (or nothing if the cell has no blank), and
// the part after. Used by both the "table" format (per grid cell) and,
// via InlineBlank itself, non-table formats (per line).
function TableCell({ text, value, disabled, onChange, badgeNumber }) {
  if (!text.includes("___")) return <>{text}</>;
  return (
    <InlineBlank
      text={text}
      value={value}
      wordBank={undefined}
      disabled={disabled}
      onChange={onChange}
      badgeNumber={badgeNumber}
    />
  );
}

// TextCompletionQuestion — IELTS Sentence/Summary/Note/Table/Flow-chart/
// Form Completion, and diagram-label completion where captions sit in
// text beside a reference image (for blanks overlaid ON an image, see
// DiagramOverlay's "pin" instead — unchanged). One question object
// carries either "lines" (prose/notes/flow) or a "rows" grid (table),
// each with one or more "___" blanks; the answer is stored as ONE array
// under answers[q.id] (one string per blank, in reading order), same
// pattern as MatchingQuestion above.
//   - "flow": draws a ↓ arrow between steps.
//   - "notes": a line starting with "# " renders as a section heading
//     (no blank, no question number); a line starting with "- " (plus 2
//     extra leading spaces per nesting level, e.g. "  - " for one level
//     deeper) renders as an indented bullet — matching how IELTS prints
//     structured notes such as Section 4's headed, bulleted outlines.
//   - "table": a real HTML table from "columns" (optional header row)
//     and "rows" (a 2D grid of cell strings), each blank cell holding at
//     most one "___" — matching a booking form or a multi-column
//     comparison table exactly as printed, instead of flattened cards.
const TextCompletionQuestion = memo(function TextCompletionQuestion({ q, startIndex, answers, onChange, locked }) {
  const selected = Array.isArray(answers[q.id]) ? answers[q.id] : [];

  const setBlankAnswer = (blankIdx, val) => {
    const next = [...selected];
    while (next.length <= blankIdx) next.push("");
    next[blankIdx] = val;
    onChange(q.id, next);
  };

  if (q.format === "table") {
    let blankIdx = 0;
    return (
      <div className="card" style={{ overflowX: "auto" }}>
        {q.q && <p className="mono muted" style={{ fontSize: 12, marginBottom: 8 }}>{q.q}</p>}
        {q.imageUrl && <ZoomableImage src={q.imageUrl} alt="" className="mb-12" />}
        {q.title && <p style={{ fontWeight: 700, marginBottom: 12 }}>{q.title}</p>}
        <table className="text-completion-table">
          {q.columns && (
            <thead><tr>{q.columns.map((c, ci) => <th key={ci}>{c}</th>)}</tr></thead>
          )}
          <tbody>
            {q.rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => {
                  const hasBlank = cell.includes("___");
                  const thisBlankIdx = hasBlank ? blankIdx++ : null;
                  return (
                    <td key={ci}>
                      {hasBlank ? (
                        <TableCell
                          text={cell}
                          value={selected[thisBlankIdx]}
                          disabled={locked}
                          onChange={(val) => setBlankAnswer(thisBlankIdx, val)}
                          badgeNumber={startIndex + thisBlankIdx + 1}
                        />
                      ) : cell}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // prose / notes / flow — precompute which lines are headings (no blank,
  // no number) so numbering skips them cleanly.
  let blankIdx = 0;
  return (
    <div className="card">
      {q.q && <p className="mono muted" style={{ fontSize: 12, marginBottom: 8 }}>{q.q}</p>}
      {q.imageUrl && <ZoomableImage src={q.imageUrl} alt="" className="mb-12" />}
      {q.title && <p style={{ fontWeight: 700, marginBottom: 12 }}>{q.title}</p>}
      <div className={q.format === "notes" ? "notes-outline" : "stack"}>
        {q.lines.map((line, li) => {
          if (q.format === "notes" && line.text.startsWith("# ")) {
            return <p key={li} className="notes-outline-h1">{line.text.slice(2)}</p>;
          }
          const bulletMatch = q.format === "notes" ? line.text.match(/^(\s*)-\s?(.*)$/) : null;
          const lineText = bulletMatch ? bulletMatch[2] : line.text;
          const thisBlankIdx = blankIdx++;
          const inline = (
            <InlineBlank
              text={lineText}
              value={selected[thisBlankIdx]}
              wordBank={q.wordBank}
              disabled={locked}
              onChange={(val) => setBlankAnswer(thisBlankIdx, val)}
              badgeNumber={startIndex + thisBlankIdx + 1}
            />
          );
          if (bulletMatch) {
            const depth = Math.floor(bulletMatch[1].length / 2);
            return (
              <p key={li} className="notes-outline-bullet" style={{ marginLeft: depth * 22 }}>
                <span className="notes-outline-dot">{depth > 0 ? "–" : "•"}</span>
                <span style={{ lineHeight: 1.8 }}>{inline}</span>
              </p>
            );
          }
          return (
            <div key={li}>
              <p style={{ lineHeight: 1.8, margin: 0 }}>{inline}</p>
              {q.format === "flow" && li < q.lines.length - 1 && (
                <p className="muted" style={{ margin: "2px 0 2px 4px" }}>↓</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

// How many numbered slots a question occupies on screen / in "Câu N"
// numbering. Most types are exactly 1 slot; matching/text_completion
// bundle several IELTS-numbered blanks into one question object, so
// they must count as (items.length / lines.length) slots instead —
// otherwise every question after one of these would be numbered wrong.
function countTextCompletionBlanks(q) {
  if (q.format === "table") {
    return (q.rows || []).reduce((n, row) => n + row.reduce((rn, cell) => rn + (cell.match(/___/g) || []).length, 0), 0);
  }
  // "notes" headings ("# ...") take up a line but have no blank and no
  // question number — only lines with an actual "___" count.
  return (q.lines || []).filter((l) => !l.text.startsWith("# ")).length;
}

function questionWeight(q) {
  if (q.type === "matching") return Array.isArray(q.items) ? q.items.length : 1;
  if (q.type === "text_completion") return countTextCompletionBlanks(q) || 1;
  return 1;
}

// Groups consecutive gap questions that share the same imageUrl AND
// have pin coordinates into DiagramOverlay blocks. All other questions
// render as individual QuestionCards as before.
const QuestionListBlock = memo(function QuestionListBlock({ questions, answers, setAnswers, startIndex = 0, locked }) {
  const handleChange = useCallback((qId, val) => {
    setAnswers((prev) => ({ ...prev, [qId]: val }));
  }, [setAnswers]);

  // Build render groups: each group is a QuestionCard, a DiagramOverlay
  // (consecutive gap questions with same imageUrl+pin), a MatchingQuestion,
  // or a TextCompletionQuestion. "runningIndex" (not a plain +1 per loop
  // step) tracks the on-screen question number, since matching/
  // text_completion each occupy several numbered slots — see questionWeight.
  const groups = [];
  let i = 0;
  let runningIndex = startIndex;
  while (i < questions.length) {
    const q = questions[i];
    const hasDiagram = q.type === "gap" && q.imageUrl && q.pin && q.pin.x != null;
    if (hasDiagram) {
      // Collect all consecutive questions with the same imageUrl that have pins
      const imgUrl = q.imageUrl;
      let j = i;
      while (
        j < questions.length &&
        questions[j].type === "gap" &&
        questions[j].imageUrl === imgUrl
      ) j++;
      const count = j - i;
      groups.push({ type: "diagram", questions: questions.slice(i, j), startIndex: runningIndex });
      runningIndex += count;
      i = j;
    } else if (q.type === "note") {
      // A group heading/instruction — shown between questions, never
      // numbered and never answerable, so it does not advance runningIndex.
      groups.push({ type: "note", q });
      i++;
    } else if (q.type === "matching") {
      groups.push({ type: "matching", q, startIndex: runningIndex });
      runningIndex += questionWeight(q);
      i++;
    } else if (q.type === "text_completion") {
      groups.push({ type: "text_completion", q, startIndex: runningIndex });
      runningIndex += questionWeight(q);
      i++;
    } else {
      groups.push({ type: "card", q, index: runningIndex });
      runningIndex += 1;
      i++;
    }
  }

  return (
    <div className="stack">
      {groups.map((g, gi) => {
        if (g.type === "diagram") {
          return (
            <DiagramOverlay
              key={`diagram-${gi}`}
              questions={g.questions}
              answers={answers}
              onChange={handleChange}
              locked={locked}
              startIndex={g.startIndex}
            />
          );
        }
        if (g.type === "note") {
          return (
            <div key={g.q.id} className="section-note">
              {g.q.q.split("\n").map((line, li) => <p key={li}>{line}</p>)}
            </div>
          );
        }
        if (g.type === "matching") {
          return (
            <MatchingQuestion
              key={g.q.id}
              q={g.q}
              startIndex={g.startIndex}
              answers={answers}
              onChange={handleChange}
              locked={locked}
            />
          );
        }
        if (g.type === "text_completion") {
          return (
            <TextCompletionQuestion
              key={g.q.id}
              q={g.q}
              startIndex={g.startIndex}
              answers={answers}
              onChange={handleChange}
              locked={locked}
            />
          );
        }
        return (
          <QuestionCard
            key={g.q.id}
            q={g.q}
            qId={g.q.id}
            index={g.index}
            answer={answers[g.q.id]}
            locked={locked}
            onChange={handleChange}
          />
        );
      })}
    </div>
  );
});

function isAnswered(val) {
  if (val === undefined || val === null) return false;
  if (typeof val === "string") return val.trim().length > 0;
  if (Array.isArray(val)) return val.length > 0;
  return true;
}

function formatClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function TestRunner({ config }) {
  const SECTION_STEPS = ALL_SKILLS.filter((s) => config.skills.includes(s));
  const [content, setContent] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [stage, setStage] = useState("intro");
  const [furthestIndex, setFurthestIndex] = useState(0);
  const [name, setName] = useState("");
  const [targetBand, setTargetBand] = useState("");
  const [gAns, setGAns] = useState({});
  const [rAns, setRAns] = useState({});
  const [lAns, setLAns] = useState({});
  // Keyed by task index (0 = Task 1, 1 = Task 2, ...) since writing can
  // now hold more than one task, each with its own answer box.
  const [writingAnswers, setWritingAnswers] = useState({});
  const [playCounts, setPlayCounts] = useState({});
  const [speakingIdx, setSpeakingIdx] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submittedId, setSubmittedId] = useState("");

  // deadline timestamps (ms epoch) for timed stages, set the first time
  // the student enters that stage. null = not started / not timed.
  const [deadlines, setDeadlines] = useState({});
  const [expired, setExpired] = useState({}); // { grammar: true, ... } once time has run out
  const [now, setNow] = useState(Date.now());
  const autoActionDone = useRef({});

  // Text size preference — set via the control cluster in the top-right
  // corner and read from the shared ThemeProvider, so a change applies
  // to this test view instantly (no separate copy of the state to keep
  // in sync) and persists across pages.
  const { fontSize } = useFontSize();

  // Draggable divider ratio for the Reading split-screen (percentage
  // width of the passage column), shared across all sections on the page.
  const [splitRatio, setSplitRatio] = useState(50);
  const splitRef = useRef(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    const move = (clientX) => {
      if (!draggingRef.current || !splitRef.current) return;
      const rect = splitRef.current.getBoundingClientRect();
      const pct = ((clientX - rect.left) / rect.width) * 100;
      setSplitRatio(Math.min(75, Math.max(25, pct)));
    };
    const onMouseMove = (e) => move(e.clientX);
    const onTouchMove = (e) => { if (e.touches[0]) move(e.touches[0].clientX); };
    const onEnd = () => { draggingRef.current = false; document.body.style.cursor = ""; };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("touchmove", onTouchMove);
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchend", onEnd);
    };
  }, []);

  const startDrag = () => {
    draggingRef.current = true;
    document.body.style.cursor = "col-resize";
  };

  const goStage = (next) => {
    const idx = SECTION_STEPS.indexOf(next);
    if (idx >= 0) setFurthestIndex((f) => Math.max(f, idx));
    if (idx >= 0 && config.timeLimits[next] && !deadlines[next]) {
      setDeadlines((prev) => ({ ...prev, [next]: Date.now() + config.timeLimits[next] * 60 * 1000 }));
    }
    setStage(next);
  };

  useEffect(() => {
    const url = config.contentBankId ? `/api/content?bank=${encodeURIComponent(config.contentBankId)}` : "/api/content";
    fetch(url, { cache: "no-store" })
      .then((r) => r.json())
      .then(setContent)
      .catch(() => setLoadError("Không tải được đề thi. Vui lòng tải lại trang."));
  }, []);

  // ticking clock for countdown displays + auto-advance/auto-submit
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    for (const s of ["grammar", "reading", "writing"]) {
      const dl = deadlines[s];
      if (!dl || expired[s]) continue;
      if (now >= dl && !autoActionDone.current[s]) {
        autoActionDone.current[s] = true;
        setExpired((prev) => ({ ...prev, [s]: true }));
        if (s === "writing") {
          submit();
        } else if (stage === s) {
          const idx = SECTION_STEPS.indexOf(s);
          const nextStage = SECTION_STEPS[idx + 1] || "writing";
          goStage(nextStage);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  const audioRefs = useRef({});

  const stopSpeaking = () => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      try {
        window.speechSynthesis.pause();
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
    Object.values(audioRefs.current).forEach((a) => {
      try { a.pause(); } catch (e) {}
    });
    setSpeakingIdx(null);
    if (stopSpeakingRef.current) clearTimeout(stopSpeakingRef.current);
    let attempts = 0;
    const retry = () => {
      attempts += 1;
      try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {}
      if (attempts < 4) stopSpeakingRef.current = setTimeout(retry, 150);
    };
    stopSpeakingRef.current = setTimeout(retry, 150);
  };
  const stopSpeakingRef = useRef(null);

  useEffect(() => {
    if (stage !== "listening") stopSpeaking();
  }, [stage]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
      Object.values(audioRefs.current).forEach((a) => { try { a.pause(); } catch (e) {} });
    };
  }, []);

  // Plays a listening section's real audio file (sec.audioUrl) when
  // available, otherwise falls back to browser voice-synthesis reading
  // sec.script. Either way, playback is capped at config.listeningPlays
  // and no seek controls are exposed (custom buttons only), so students
  // can't rewind/scrub past what they've already heard.
  const playListening = (idx, sec) => {
    const count = playCounts[idx] || 0;
    if (count >= config.listeningPlays) return;
    stopSpeaking();

    if (sec.audioUrl) {
      let audio = audioRefs.current[idx];
      if (!audio) {
        audio = new Audio(sec.audioUrl);
        audio.preload = "auto";
        audioRefs.current[idx] = audio;
      }
      audio.onended = () => setSpeakingIdx(null);
      audio.onerror = () => setSpeakingIdx(null);
      audio.currentTime = 0;
      audio.play().then(() => setSpeakingIdx(idx)).catch(() => setSpeakingIdx(null));
    } else if (sec.script && typeof window !== "undefined" && window.speechSynthesis) {
      const utter = new SpeechSynthesisUtterance(sec.script);
      utter.lang = "en-US";
      utter.rate = 0.95;
      utter.onstart = () => setSpeakingIdx(idx);
      utter.onend = () => setSpeakingIdx(null);
      window.speechSynthesis.speak(utter);
    } else {
      return;
    }
    setPlayCounts((p) => ({ ...p, [idx]: count + 1 }));
  };

  const wordsOf = (text) => (text || "").trim().length === 0 ? 0 : text.trim().split(/\s+/).length;
  const writingTasks = content?.writing?.tasks || [];
  const writingWordCount = writingTasks.reduce((n, _, ti) => n + wordsOf(writingAnswers[ti]), 0);
  const answeredCount = (answers, qs) => qs.filter((q) => isAnswered(answers[q.id])).length;

  // Combine every task's answer into the single writing_text column the
  // backend stores. A lone task is sent as-is (matches older single-task
  // banks 1:1); 2+ tasks get a "TASK n" label so the teacher's review
  // screen still shows which paragraph belongs to which task.
  const combinedWritingText = () => {
    if (writingTasks.length <= 1) return writingAnswers[0] || "";
    return writingTasks.map((_, ti) => `TASK ${ti + 1}\n${writingAnswers[ti] || ""}`).join("\n\n\n");
  };

  const submit = async () => {
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentName: name,
          targetBand,
          sessionId: config.sessionId || null,
          contentBankId: config.contentBankId || null,
          skills: SECTION_STEPS,
          grammarAnswers: gAns,
          readingAnswers: rAns,
          listeningAnswers: lAns,
          writingText: combinedWritingText(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể nộp bài.");
      setSubmittedId(data.id);
      setStage("done");
    } catch (err) {
      setSubmitError(err.message);
    }
    setSubmitting(false);
  };

  if (loadError) {
    return <div className="wrap"><div className="card"><p className="accent">{loadError}</p></div></div>;
  }
  if (!content) {
    return <div className="wrap"><div className="card"><p className="muted">Đang tải đề thi…</p></div></div>;
  }

  // Only include stages the content bank actually has data for — a bank
  // can cover just one or two skills (e.g. a grammar-only practice quiz),
  // so this guards against a session accidentally requesting a skill
  // that skips silently instead of crashing.
  const activeSteps = SECTION_STEPS.filter((s) => content[s]);

  const readingFlat = flattenSectionQuestions(content.reading?.sections);
  const listeningFlat = flattenSectionQuestions(content.listening?.sections);

  const nextAfter = (s) => {
    const idx = activeSteps.indexOf(s);
    return activeSteps[idx + 1] || activeSteps[activeSteps.length - 1] || s;
  };

  return (
    <div className={["reading", "writing"].includes(stage) ? "wrap-reading" : "wrap"} style={{ zoom: FONT_SIZES[fontSize] }}>
      <div className="topbar">
        <div>
          <p className="serif" style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{config.name || "Bài kiểm tra IELTS"}</p>
          <p className="mono muted" style={{ fontSize: 12, margin: 0 }}>
            {stage === "intro" ? "Bắt đầu" : stage === "done" ? "Hoàn tất" : `Bước ${activeSteps.indexOf(stage) + 1}/${activeSteps.length}`}
          </p>
        </div>
        <BrandBar />
      </div>

      {SECTION_STEPS.includes(stage) && (
        <div className="row" style={{ gap: 8, marginBottom: 12, flexWrap: "wrap", justifyContent: "flex-start" }}>
          {activeSteps.map((s, i) => {
            const enabled = SECTION_STEPS.indexOf(s) <= furthestIndex;
            const active = s === stage;
            return (
              <button
                key={s}
                disabled={!enabled}
                onClick={() => enabled && setStage(s)}
                className={active ? "btn btn-sm" : "btn-ghost btn-sm"}
                title={enabled ? "Xem lại phần này" : "Chưa mở tới phần này"}
              >
                {i + 1}. {SKILL_TITLES[s]}
              </button>
            );
          })}
        </div>
      )}

      {["grammar", "reading", "writing"].includes(stage) && config.timeLimits[stage] && (
        <div className="timer-pin">
          <span className={`timer-badge ${deadlines[stage] && now >= deadlines[stage] - 60000 ? "low" : ""}`}>
            ⏱ {deadlines[stage] ? formatClock(deadlines[stage] - now) : `${config.timeLimits[stage]}:00`}
          </span>
        </div>
      )}

      {stage === "intro" && (
        <div>
          <div className="card card-strong">
            <p style={{ marginBottom: 8 }}>Nhập tên của bạn:</p>
            <input type="text" placeholder="Nguyễn Văn A" value={name} onChange={(e) => setName(e.target.value)} />
            {config.category === "placement" && (
              <>
                <p style={{ margin: "16px 0 8px" }}>Mục tiêu band điểm hiện tại của bạn:</p>
                <select value={targetBand} onChange={(e) => setTargetBand(e.target.value)}>
                  <option value="">— Chọn mục tiêu —</option>
                  {BAND_OPTIONS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </>
            )}
          </div>
          <div className="card">
            <p className="mono muted" style={{ fontSize: 12, marginBottom: 10 }}>CẤU TRÚC BÀI TEST</p>
            <ul style={{ paddingLeft: 18, margin: 0, lineHeight: 1.9 }}>
              {activeSteps.includes("grammar") && <li>Ngữ pháp & Từ vựng: {content.grammar.length} câu trắc nghiệm{config.timeLimits.grammar ? ` — ${config.timeLimits.grammar} phút` : ""}</li>}
              {activeSteps.includes("reading") && <li>Reading: {content.reading.sections.length} đoạn văn, {readingFlat.length} câu hỏi{config.timeLimits.reading ? ` — ${config.timeLimits.reading} phút` : ""}</li>}
              {activeSteps.includes("listening") && <li>Listening: nghe audio (tối đa {config.listeningPlays} lần/đoạn), {listeningFlat.length} câu hỏi</li>}
              {activeSteps.includes("writing") && <li>Writing: {content.writing.tasks.length > 1 ? `${content.writing.tasks.length} bài (Task 1, Task 2)` : "1 bài luận"}{config.timeLimits.writing ? ` — ${config.timeLimits.writing} phút` : ""}, sẽ được giáo viên chấm điểm</li>}
            </ul>
          </div>
          <button className="btn" disabled={!name.trim() || activeSteps.length === 0} onClick={() => goStage(activeSteps[0])}>Bắt đầu làm bài →</button>
        </div>
      )}

      {stage === "grammar" && content.grammar && (
        <div>
          <div className="row"><p className="serif" style={{ fontSize: 22, marginBottom: 16 }}>Ngữ pháp & Từ vựng</p><BrandBar size="small" /></div>
          {expired.grammar && <p className="accent" style={{ marginBottom: 12 }}>⚠ Đã hết giờ — phần này đã bị khoá.</p>}
          <QuestionListBlock questions={content.grammar} answers={gAns} setAnswers={setGAns} locked={expired.grammar} />
          <div className="row" style={{ marginTop: 20 }}>
            <p className="mono muted" style={{ fontSize: 12 }}>{answeredCount(gAns, content.grammar)}/{content.grammar.length} đã trả lời</p>
            <button className="btn" onClick={() => goStage(nextAfter("grammar"))}>Tiếp theo →</button>
          </div>
        </div>
      )}

      {stage === "reading" && content.reading && (
        <div>
          <div className="row"><p className="serif" style={{ fontSize: 22, marginBottom: 16 }}>Reading</p><BrandBar size="small" /></div>
          {expired.reading && <p className="accent" style={{ marginBottom: 12 }}>⚠ Đã hết giờ — phần này đã bị khoá.</p>}
          <div ref={splitRef}>
          {content.reading.sections.map((sec, si) => {
            const priorCount = content.reading.sections.slice(0, si).reduce((n, s) => n + s.questions.reduce((m, q) => m + questionWeight(q), 0), 0);
            return (
              <div key={si} style={{ marginTop: si > 0 ? 40 : 0 }}>
                {sec.title && <p className="mono muted" style={{ fontSize: 12, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{sec.title}</p>}
                {sec.instructions && <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>{sec.instructions}</p>}
                <div className="reading-split" style={{ gridTemplateColumns: `${splitRatio}% 14px ${100 - splitRatio}%` }}>
                  <div className="reading-passage-pane">
                    <div className="card">
                      {sec.imageUrl && (
                        <ZoomableImage src={sec.imageUrl} alt="" />
                      )}
                      <HighlightZone>
                        <PassageBlocks text={sec.passage} />
                      </HighlightZone>
                    </div>
                  </div>
                  <div
                    className="split-handle"
                    onMouseDown={startDrag}
                    onTouchStart={startDrag}
                    title="Kéo để đổi tỉ lệ 2 bên"
                  >
                    <span className="split-handle-line" />
                    <span className="split-handle-grip">⟷</span>
                  </div>
                  <div className="reading-questions-pane">
                    <HighlightZone>
                      <QuestionListBlock questions={sec.questions} answers={rAns} setAnswers={setRAns} startIndex={priorCount} locked={expired.reading} />
                    </HighlightZone>
                  </div>
                </div>
              </div>
            );
          })}
          </div>
          <div className="row" style={{ marginTop: 20 }}>
            <p className="mono muted" style={{ fontSize: 12 }}>{answeredCount(rAns, readingFlat)}/{readingFlat.length} đã trả lời</p>
            <button className="btn" onClick={() => goStage(nextAfter("reading"))}>Tiếp theo →</button>
          </div>
        </div>
      )}

      {stage === "listening" && content.listening && (
        <div>
          <div className="row"><p className="serif" style={{ fontSize: 22, marginBottom: 16 }}>Listening</p><BrandBar size="small" /></div>
          {content.listening.sections.map((sec, si) => {
            const priorCount = content.listening.sections.slice(0, si).reduce((n, s) => n + s.questions.reduce((m, q) => m + questionWeight(q), 0), 0);
            const count = playCounts[si] || 0;
            return (
              <div key={si}>
                {sec.title && <p className="mono muted" style={{ fontSize: 12, marginTop: si > 0 ? 28 : 0, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{sec.title}</p>}
                {sec.instructions && <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>{sec.instructions}</p>}
                <div className="card row">
                  <div className="row" style={{ gap: 10, justifyContent: "flex-start" }}>
                    <button className="btn-ghost" disabled={count >= config.listeningPlays || speakingIdx === si} onClick={() => playListening(si, sec)}>
                      {speakingIdx === si ? "▶ Đang phát…" : "▶ Phát audio"}
                    </button>
                    <button className="btn-ghost" onClick={stopSpeaking}>⏹ Dừng phát</button>
                  </div>
                  <p className="mono muted" style={{ fontSize: 12 }}>Đã phát: {count}/{config.listeningPlays} lần</p>
                </div>
                <HighlightZone>
                  <QuestionListBlock questions={sec.questions} answers={lAns} setAnswers={setLAns} startIndex={priorCount} />
                </HighlightZone>
              </div>
            );
          })}
          <div className="row" style={{ marginTop: 20 }}>
            <p className="mono muted" style={{ fontSize: 12 }}>{answeredCount(lAns, listeningFlat)}/{listeningFlat.length} đã trả lời</p>
            <button className="btn" onClick={() => { stopSpeaking(); goStage(nextAfter("listening")); }}>Tiếp theo →</button>
          </div>
        </div>
      )}

      {stage === "writing" && content.writing && (
        <div>
          <div className="row"><p className="serif" style={{ fontSize: 22, marginBottom: 16 }}>Writing</p><BrandBar size="small" /></div>
          {expired.writing && <p className="accent" style={{ marginBottom: 12 }}>⚠ Đã hết giờ — bài viết đã được tự động nộp.</p>}
          <div ref={splitRef}>
          {writingTasks.map((task, ti) => {
            const tWordCount = wordsOf(writingAnswers[ti]);
            return (
              <div key={ti} style={{ marginTop: ti > 0 ? 40 : 0 }}>
                {writingTasks.length > 1 && (
                  <p className="mono muted" style={{ fontSize: 12, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Task {ti + 1}</p>
                )}
                <div className="reading-split" style={{ gridTemplateColumns: `${splitRatio}% 14px ${100 - splitRatio}%` }}>
                  <div className="reading-passage-pane">
                    <div className="card">
                      {task.imageUrl && (
                        <ZoomableImage src={task.imageUrl} alt="" />
                      )}
                      <p className="serif" style={{ lineHeight: 1.7, whiteSpace: "pre-line" }}>{task.prompt}</p>
                    </div>
                  </div>
                  <div
                    className="split-handle"
                    onMouseDown={startDrag}
                    onTouchStart={startDrag}
                    title="Kéo để đổi tỉ lệ 2 bên"
                  >
                    <span className="split-handle-line" />
                    <span className="split-handle-grip">⟷</span>
                  </div>
                  <div className="reading-questions-pane">
                    <textarea
                      style={{ minHeight: 420, height: "100%" }}
                      placeholder="Viết bài làm của bạn tại đây…"
                      value={writingAnswers[ti] || ""}
                      onChange={(e) => setWritingAnswers((prev) => ({ ...prev, [ti]: e.target.value }))}
                      disabled={expired.writing}
                    />
                    <p className={`mono ${tWordCount >= 150 ? "success" : "accent"}`} style={{ fontSize: 12, marginTop: 8 }}>
                      {tWordCount} từ {tWordCount < 150 ? "" : "✓"}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
          </div>
          <div className="row" style={{ marginTop: 20 }}>
            <p className="mono muted" style={{ fontSize: 12 }}>{writingWordCount} từ tổng cộng</p>
            <button className="btn" disabled={submitting} onClick={submit}>
              {submitting ? "Đang nộp bài…" : "Nộp bài →"}
            </button>
          </div>
          {submitError && <p className="accent" style={{ marginTop: 10 }}>⚠ {submitError}</p>}
        </div>
      )}

      {stage === "done" && (
        <div className="card card-strong" style={{ textAlign: "center", padding: 40 }}>
          <BrandBar size="large" style={{ justifyContent: "center", marginBottom: 20 }} />
          <p className="serif" style={{ fontSize: 22, margin: "8px 0" }}>Cảm ơn {name || "bạn"} đã hoàn thành bài test!</p>
          <p className="muted" style={{ fontSize: 14 }}>Bài làm của bạn đã được ghi nhận.</p>
        </div>
      )}

      <div style={{ marginTop: 40, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
        <BrandBar size="small" style={{ justifyContent: "center" }} />
      </div>
    </div>
  );
}
