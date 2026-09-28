"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { normalizeContent, withIds } from "@/lib/content";
import { useFontSize } from "@/app/contexts/ThemeContext";

// Word limit for each writing part
const WRITING_LIMITS = {
  1: 10,  // Part 1: per answer (1-5 words recommended, 10 max)
  2: 45,  // Part 2: total
  3: 60,  // Part 3: per answer
  4: { informal: 75, formal: 225 },  // Part 4: per email
};

function ReorderQuestion({ q, qId, answers, onChange, locked }) {
  const [dragging, setDragging] = useState(null);
  
  // answers[qId] = array of sentence indices in correct order
  const currentOrder = Array.isArray(answers[qId]) ? answers[qId] : [];
  const sentences = q.opts || [];
  
  const handleDragStart = (e, idx) => {
    if (locked) return;
    setDragging(idx);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e, targetIdx) => {
    if (locked) return;
    e.preventDefault();
    if (dragging === null) return;

    const newOrder = [...currentOrder];
    const draggedIdx = newOrder.indexOf(dragging);
    const targetPosition = newOrder.indexOf(targetIdx);

    if (draggedIdx === -1) {
      newOrder.push(dragging);
    } else {
      newOrder.splice(draggedIdx, 1);
    }
    if (targetPosition !== -1) {
      newOrder.splice(targetPosition, 0, dragging);
    } else {
      newOrder.push(dragging);
    }
    
    onChange(qId, newOrder);
    setDragging(null);
  };

  const handleDragEnd = () => setDragging(null);

  // Render current order + available sentences
  const usedSentences = new Set(currentOrder);
  const availableSentences = sentences.filter((_, i) => !usedSentences.has(i));

  return (
    <div className="card stack">
      <p className="mono muted" style={{ fontSize: 12, marginBottom: 8 }}>Sắp xếp các câu dưới đây theo đúng thứ tự:</p>
      
      {/* Ordered area */}
      <div style={{ minHeight: 100, padding: 8, background: "var(--subtle)", borderRadius: 4, border: "2px dashed var(--primary)" }}>
        {currentOrder.length === 0 ? (
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>Kéo câu vào đây…</p>
        ) : (
          <div className="stack" style={{ gap: 6 }}>
            {currentOrder.map((idx) => (
              <div
                key={idx}
                draggable
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                style={{
                  padding: "8px 12px",
                  background: dragging === idx ? "var(--primary)" : "var(--card)",
                  color: dragging === idx ? "#fff" : "inherit",
                  borderRadius: 4,
                  cursor: locked ? "not-allowed" : "move",
                  opacity: locked ? 0.6 : 1,
                  border: "1px solid var(--primary)",
                }}
              >
                <span className="mono" style={{ fontSize: 11, marginRight: 6 }}>{String.fromCharCode(65 + idx)}</span>
                {sentences[idx]}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Available sentences */}
      {availableSentences.length > 0 && (
        <>
          <p className="mono muted" style={{ fontSize: 11, margin: "8px 0 4px" }}>Câu có sẵn:</p>
          <div className="stack" style={{ gap: 4 }}>
            {availableSentences.map((sent, i) => {
              const actualIdx = sentences.indexOf(sent);
              return (
                <div
                  key={actualIdx}
                  draggable
                  onDragStart={(e) => handleDragStart(e, actualIdx)}
                  onDragEnd={handleDragEnd}
                  style={{
                    padding: "6px 10px",
                    background: "var(--subtle)",
                    borderRadius: 4,
                    cursor: locked ? "not-allowed" : "grab",
                    opacity: locked ? 0.6 : 1,
                    fontSize: 13,
                  }}
                >
                  <span className="mono" style={{ fontSize: 11, marginRight: 4 }}>{String.fromCharCode(65 + actualIdx)}</span>
                  {sent}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function HeadingMatchQuestion({ section, sectionIdx, answers, onChange, locked }) {
  const headings = section.headings || [];
  const paragraphs = section.paragraphs || [];

  return (
    <div className="card stack">
      <p className="mono muted" style={{ fontSize: 12, marginBottom: 12 }}>
        Ghép tiêu đề phù hợp với mỗi đoạn văn. Có thể dùng 1 tiêu đề cho nhiều đoạn hoặc 1 tiêu đề không dùng.
      </p>

      {paragraphs.map((para, pIdx) => {
        const answerId = `reading_${sectionIdx}_para_${pIdx}`;
        const selectedIdx = answers[answerId];

        return (
          <div key={pIdx} style={{ marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid var(--subtle)" }}>
            <p style={{ marginBottom: 8, lineHeight: 1.6, fontSize: 14 }}>{para}</p>
            
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="mono muted" style={{ fontSize: 11, minWidth: 60 }}>Tiêu đề:</span>
              <select
                disabled={locked}
                value={selectedIdx ?? ""}
                onChange={(e) => onChange(answerId, e.target.value ? parseInt(e.target.value) : null)}
                style={{
                  flex: 1,
                  padding: "6px 8px",
                  borderRadius: 4,
                  border: "1px solid var(--primary)",
                  background: "var(--card)",
                  color: "var(--text)",
                  opacity: locked ? 0.6 : 1,
                  cursor: locked ? "not-allowed" : "pointer",
                }}
              >
                <option value="">— Chọn tiêu đề —</option>
                {headings.map((heading, hIdx) => (
                  <option key={hIdx} value={hIdx}>
                    {heading}
                  </option>
                ))}
              </select>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WritingPart({ partNumber, prompt, imageUrl, questions, answers, setAnswers, locked }) {
  const handleChange = useCallback((qId, value) => {
    setAnswers((prev) => ({ ...prev, [qId]: value }));
  }, [setAnswers]);

  const defaultLimitForPart = () => {
    if (partNumber === 1) return WRITING_LIMITS[1];
    if (partNumber === 2) return WRITING_LIMITS[2];
    if (partNumber === 3) return WRITING_LIMITS[3];
    return null;  // Part 4 has dual limits, handled per-question below
  };

  const fallbackLimit = defaultLimitForPart();

  // Shared instructions block shown once at the top of every part —
  // this was previously missing entirely, so students had no idea what
  // each part was asking them to do beyond the bare sub-question text.
  const PartHeader = () => (
    <div className="card" style={{ marginBottom: 12 }}>
      <p className="mono muted" style={{ fontSize: 11, marginBottom: 8, textTransform: "uppercase" }}>
        PART {partNumber}
      </p>
      {prompt && <p style={{ margin: 0, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{prompt}</p>}
      {imageUrl && <img src={imageUrl} alt="" style={{ maxWidth: "100%", marginTop: 12, borderRadius: 4 }} />}
    </div>
  );

  if (partNumber === 4) {
    // Part 4: 2 emails — informal (first question) then formal (second)
    return (
      <div className="stack">
        <PartHeader />
        {questions.map((q, i) => {
          const isInformal = i === 0;
          const emailLimit = q.wordLimit || (isInformal ? WRITING_LIMITS[4].informal : WRITING_LIMITS[4].formal);
          const wordCount = (answers[q.id] || "").trim().split(/\s+/).filter((w) => w).length;
          const isOver = wordCount > emailLimit;

          return (
            <div key={q.id} className="card">
              <p className="mono muted" style={{ fontSize: 12, marginBottom: 8 }}>
                {isInformal ? "Email 1 (Informal)" : "Email 2 (Formal)"}
              </p>
              <p style={{ marginBottom: 8, lineHeight: 1.5 }}>{q.q}</p>
              <textarea
                disabled={locked}
                placeholder={`${isInformal ? "40-50" : "120-150"} từ (tối đa ${emailLimit})`}
                value={typeof answers[q.id] === "string" ? answers[q.id] : ""}
                onChange={(e) => handleChange(q.id, e.target.value)}
                style={{
                  width: "100%",
                  minHeight: isInformal ? 90 : 180,
                  padding: 10,
                  borderRadius: 4,
                  border: `2px solid ${isOver ? "var(--accent)" : "var(--primary)"}`,
                  background: "var(--card)",
                  color: "var(--text)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  opacity: locked ? 0.6 : 1,
                  marginBottom: 6,
                }}
              />
              <p className="mono muted" style={{ fontSize: 11, margin: 0, color: isOver ? "var(--accent)" : "inherit" }}>
                {wordCount} / {emailLimit} từ {isOver ? "⚠ Vượt quá giới hạn" : ""}
              </p>
            </div>
          );
        })}
      </div>
    );
  }

  // Part 1, 2, 3 — each sub-question gets its own answer box
  return (
    <div className="stack">
      <PartHeader />
      {questions.map((q, i) => {
        const limit = q.wordLimit || fallbackLimit;
        const wordCount = (answers[q.id] || "").trim().split(/\s+/).filter((w) => w).length;
        const isOver = limit ? wordCount > limit : false;

        return (
          <div key={q.id} className="card">
            <p className="mono muted" style={{ fontSize: 12, marginBottom: 8 }}>
              Câu {i + 1}
            </p>
            <p style={{ marginBottom: 8, lineHeight: 1.5 }}>{q.q}</p>
            <textarea
              disabled={locked}
              placeholder={limit ? `Tối đa ${limit} từ` : "Nhập câu trả lời…"}
              value={typeof answers[q.id] === "string" ? answers[q.id] : ""}
              onChange={(e) => handleChange(q.id, e.target.value)}
              style={{
                width: "100%",
                minHeight: partNumber === 1 ? 44 : 90,
                padding: 10,
                borderRadius: 4,
                border: `2px solid ${isOver ? "var(--accent)" : "var(--primary)"}`,
                background: "var(--card)",
                color: "var(--text)",
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                opacity: locked ? 0.6 : 1,
              }}
            />
            {limit && (
              <p className="mono muted" style={{ fontSize: 11, margin: "6px 0 0 0", color: isOver ? "var(--accent)" : "inherit" }}>
                {wordCount} / {limit} từ {isOver ? "⚠" : ""}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

const FONT_ZOOM = { small: 0.9, medium: 1, large: 1.15 };

export default function AptisRunner({ config }) {
  const { fontSize } = useFontSize();
  const zoom = FONT_ZOOM[fontSize] || 1;
  const [content, setContent] = useState(null);
  const [answers, setAnswers] = useState({});
  const [locked, setLocked] = useState(false);
  const [stage, setStage] = useState("intro"); // "intro" | "test" | "done"
  const [studentName, setStudentName] = useState("");
  const [targetBand, setTargetBand] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitResult, setSubmitResult] = useState(null);
  const timerRef = useRef(null);
  const [timeLeft, setTimeLeft] = useState(0);

  // Load & normalize content
  useEffect(() => {
    if (!config.content) return;
    try {
      const normalized = normalizeContent(config.content);
      const withIdsContent = withIds(normalized);
      setContent(withIdsContent);

      // Initialize answers object
      const init = {};
      withIdsContent.reading?.sections?.forEach((sec) => {
        sec.questions?.forEach((q) => {
          if (q.type === "gap") init[q.id] = "";
          if (q.type === "mc") init[q.id] = null;
          if (q.type === "multi_select") init[q.id] = [];
          if (q.type === "reorder") init[q.id] = [];
        });
      });
      withIdsContent.listening?.sections?.forEach((sec) => {
        sec.questions?.forEach((q) => {
          if (q.type === "gap") init[q.id] = "";
          if (q.type === "mc") init[q.id] = null;
        });
      });
      withIdsContent.writing?.tasks?.forEach((task, ti) => {
        if (Array.isArray(task.questions)) {
          task.questions.forEach((q) => { init[q.id] = ""; });
        } else {
          init[`w_${ti}_free`] = "";
        }
      });
      setAnswers(init);

      // Overall timer: sum of teacher-configured reading + writing minutes
      // (listening has no separate limit — it's paced by the audio itself).
      // Falls back to 45 minutes when the session has no configured limits.
      const tl = config.timeLimits || {};
      const totalMinutes = (Number(tl.reading) || 0) + (Number(tl.writing) || 0);
      setTimeLeft(totalMinutes > 0 ? totalMinutes * 60 : 2700);
    } catch (err) {
      console.error("Content error:", err.message);
      setSubmitError(err.message);
    }
  }, [config.content, config.timeLimits]);

  // Timer — only runs once the student has actually started the test
  useEffect(() => {
    if (stage !== "test" || locked || !timeLeft) return;
    timerRef.current = setTimeout(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => clearTimeout(timerRef.current);
  }, [timeLeft, locked, stage]);

  // Builds one readable text blob covering every Writing part & sub-question,
  // labelled so the teacher's grading screen shows exactly which answer
  // belongs to which prompt. This is stored as a single "writing_text"
  // value server-side, same column IELTS submissions use — no DB schema
  // change needed to support Aptis's multi-part Writing.
  const combinedWritingText = () => {
    const writingTasks = content?.writing?.tasks || [];
    return writingTasks
      .map((task, ti) => {
        const label = `PART ${ti + 1}`;
        if (Array.isArray(task.questions)) {
          const body = task.questions
            .map((q, qi) => `${qi + 1}. ${q.q}\n${answers[q.id] || "(chưa trả lời)"}`)
            .join("\n\n");
          return `${label}\n${body}`;
        }
        return `${label}\n${answers[`w_${ti}_free`] || "(chưa trả lời)"}`;
      })
      .join("\n\n\n");
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError("");
    try {
      // Reading/listening answers keyed by question id, exactly like
      // TestRunner sends them — the server re-fetches the answer key and
      // scores from these maps, so nothing sensitive needs to be computed
      // on the client.
      const readingAnswers = {};
      (content.reading?.sections || []).forEach((sec) =>
        sec.questions?.forEach((q) => { readingAnswers[q.id] = answers[q.id]; })
      );
      const listeningAnswers = {};
      (content.listening?.sections || []).forEach((sec) =>
        sec.questions?.forEach((q) => { listeningAnswers[q.id] = answers[q.id]; })
      );

      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentName,
          targetBand,
          sessionId: config.sessionId || null,
          contentBankId: config.contentBankId || null,
          skills: ["reading", "listening", "writing"],
          readingAnswers,
          listeningAnswers,
          writingText: combinedWritingText(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể nộp bài.");
      setSubmitResult(data);
      setLocked(true);
      setStage("done");
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!content) return <p>Đang tải đề thi…</p>;

  const readingSections = content.reading?.sections || [];
  const listeningPages = content.listening?.sections || [];
  const writingTasks = content.writing?.tasks || [];

  // Intro screen — collects the student's name before starting, same as
  // TestRunner's flow. Needed so submissions are attributable to someone
  // instead of landing anonymously (or not landing at all, as before).
  if (stage === "intro") {
    return (
      <div className="container" style={{ zoom }}>
        <h1>Aptis ESOL</h1>
        <div className="card stack" style={{ maxWidth: 420 }}>
          <div>
            <label className="mono muted" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Họ và tên *</label>
            <input
              type="text"
              placeholder="Nhập họ tên của bạn…"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
            />
          </div>
          <div>
            <label className="mono muted" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Mục tiêu (tuỳ chọn)</label>
            <input
              type="text"
              placeholder="Vd: B1, B2…"
              value={targetBand}
              onChange={(e) => setTargetBand(e.target.value)}
            />
          </div>
          <button
            className="btn"
            disabled={!studentName.trim()}
            onClick={() => setStage("test")}
          >
            Bắt đầu làm bài
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ zoom }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Aptis ESOL</h1>
        <div style={{ fontSize: 14, fontWeight: 600 }}>
          {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
        </div>
      </div>

      {stage === "test" ? (
        <>
          {/* READING */}
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ marginBottom: 16 }}>READING</h2>
            <div className="stack">
              {readingSections.map((sec, si) => {
                if (sec.questions?.some((q) => q.type === "heading_match")) {
                  // Part 4: Heading match
                  return (
                    <HeadingMatchQuestion
                      key={si}
                      section={sec}
                      sectionIdx={si}
                      answers={answers}
                      onChange={(id, val) => setAnswers((prev) => ({ ...prev, [id]: val }))}
                      locked={locked}
                    />
                  );
                }

                // Regular question list
                return (
                  <div key={si}>
                    <p className="mono muted" style={{ fontSize: 12, marginBottom: 12 }}>{sec.title || `Section ${si + 1}`}</p>
                    {sec.passage && (
                      <div style={{ padding: 12, marginBottom: 12, background: "var(--subtle)", borderRadius: 4, lineHeight: 1.7 }}>
                        {sec.passage}
                      </div>
                    )}
                    {sec.imageUrl && (
                      <img src={sec.imageUrl} alt="passage" style={{ maxWidth: "100%", marginBottom: 12, borderRadius: 4 }} />
                    )}
                    <div className="stack">
                      {sec.questions?.map((q, qi) => {
                        if (q.type === "reorder") {
                          return <ReorderQuestion key={q.id} q={q} qId={q.id} answers={answers} onChange={(id, val) => setAnswers((prev) => ({ ...prev, [id]: val }))} locked={locked} />;
                        }

                        if (q.type === "mc") {
                          return (
                            <div key={q.id} className="card">
                              <p className="mono muted" style={{ fontSize: 12, marginBottom: 8 }}>Câu {qi + 1}</p>
                              <p style={{ marginBottom: 12 }}>{q.q}</p>
                              <div className="stack">
                                {q.opts?.map((opt, oi) => (
                                  <div
                                    key={oi}
                                    className={`option ${answers[q.id] === oi ? "selected" : ""}`}
                                    onClick={() => !locked && setAnswers((prev) => ({ ...prev, [q.id]: oi }))}
                                    role="button"
                                    tabIndex={0}
                                    style={{ cursor: locked ? "not-allowed" : "pointer", opacity: locked ? 0.6 : 1 }}
                                  >
                                    <span className={`bubble ${answers[q.id] === oi ? "selected" : ""}`}>{String.fromCharCode(65 + oi)}</span>
                                    <span>{opt}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        }

                        if (q.type === "gap") {
                          return (
                            <div key={q.id} className="card">
                              <p className="mono muted" style={{ fontSize: 12, marginBottom: 8 }}>Câu {qi + 1}</p>
                              <p style={{ marginBottom: 12 }}>{q.q}</p>
                              <input
                                type="text"
                                disabled={locked}
                                placeholder="Nhập câu trả lời…"
                                value={typeof answers[q.id] === "string" ? answers[q.id] : ""}
                                onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                              />
                            </div>
                          );
                        }

                        return null;
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* LISTENING */}
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ marginBottom: 16 }}>LISTENING</h2>
            <div className="stack">
              {listeningPages.map((sec, si) => (
                <div key={si}>
                  <p className="mono muted" style={{ fontSize: 12, marginBottom: 12 }}>{sec.title || `Section ${si + 1}`}</p>
                  {sec.audioUrl && (
                    <audio controls style={{ width: "100%", marginBottom: 12 }}>
                      <source src={sec.audioUrl} type="audio/mpeg" />
                    </audio>
                  )}
                  {sec.instructions && <p style={{ marginBottom: 12, fontSize: 13 }}>{sec.instructions}</p>}
                  <div className="stack">
                    {sec.questions?.map((q, qi) => {
                      if (q.type === "mc") {
                        return (
                          <div key={q.id} className="card">
                            <p className="mono muted" style={{ fontSize: 12, marginBottom: 8 }}>Câu {qi + 1}</p>
                            <p style={{ marginBottom: 12 }}>{q.q}</p>
                            <div className="stack">
                              {q.opts?.map((opt, oi) => (
                                <div
                                  key={oi}
                                  className={`option ${answers[q.id] === oi ? "selected" : ""}`}
                                  onClick={() => !locked && setAnswers((prev) => ({ ...prev, [q.id]: oi }))}
                                  role="button"
                                  tabIndex={0}
                                  style={{ cursor: locked ? "not-allowed" : "pointer", opacity: locked ? 0.6 : 1 }}
                                >
                                  <span className={`bubble ${answers[q.id] === oi ? "selected" : ""}`}>{String.fromCharCode(65 + oi)}</span>
                                  <span>{opt}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }

                      if (q.type === "gap") {
                        return (
                          <div key={q.id} className="card">
                            <p className="mono muted" style={{ fontSize: 12, marginBottom: 8 }}>Câu {qi + 1}</p>
                            <p style={{ marginBottom: 12 }}>{q.q}</p>
                            <input
                              type="text"
                              disabled={locked}
                              placeholder="Nhập câu trả lời…"
                              value={typeof answers[q.id] === "string" ? answers[q.id] : ""}
                              onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                            />
                          </div>
                        );
                      }

                      return null;
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* WRITING */}
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ marginBottom: 16 }}>WRITING</h2>
            <div className="stack">
              {writingTasks.map((task, ti) => {
                const partNumber = ti + 1;
                if (!Array.isArray(task.questions) || task.questions.length === 0) {
                  // Fallback for a task with no sub-questions declared (legacy
                  // IELTS-style single essay) — render one big textarea.
                  return (
                    <div key={ti} className="card">
                      <p className="mono muted" style={{ fontSize: 11, marginBottom: 8, textTransform: "uppercase" }}>PART {partNumber}</p>
                      <p style={{ marginBottom: 12, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{task.prompt}</p>
                      {task.imageUrl && <img src={task.imageUrl} alt="" style={{ maxWidth: "100%", marginBottom: 12, borderRadius: 4 }} />}
                      <textarea
                        disabled={locked}
                        placeholder="Nhập bài viết…"
                        value={typeof answers[`w_${ti}_free`] === "string" ? answers[`w_${ti}_free`] : ""}
                        onChange={(e) => setAnswers((prev) => ({ ...prev, [`w_${ti}_free`]: e.target.value }))}
                        style={{
                          width: "100%", minHeight: 160, padding: 10, borderRadius: 4,
                          border: "2px solid var(--primary)", background: "var(--card)",
                          color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 13,
                          opacity: locked ? 0.6 : 1,
                        }}
                      />
                    </div>
                  );
                }
                return (
                  <WritingPart
                    key={ti}
                    partNumber={partNumber}
                    prompt={task.prompt}
                    imageUrl={task.imageUrl}
                    questions={task.questions}
                    answers={answers}
                    setAnswers={setAnswers}
                    locked={locked}
                  />
                );
              })}
            </div>
          </div>

          {/* Submit */}
          {submitError && (
            <p style={{ color: "var(--accent)", marginBottom: 12 }}>{submitError}</p>
          )}
          <button className="btn" onClick={handleSubmit} disabled={submitting} style={{ marginBottom: 24 }}>
            {submitting ? "Đang nộp bài…" : "Nộp bài thi"}
          </button>
        </>
      ) : (
        <div className="card stack" style={{ maxWidth: 480 }}>
          <h2 style={{ margin: 0 }}>Đã nộp bài thành công</h2>
          <p>Cảm ơn {studentName || "bạn"} đã hoàn thành bài thi Aptis ESOL.</p>
          {submitResult && (submitResult.rTotal > 0 || submitResult.lTotal > 0) && (
            <p className="mono muted" style={{ fontSize: 13 }}>
              Reading: {submitResult.rScore}/{submitResult.rTotal} · Listening: {submitResult.lScore}/{submitResult.lTotal}
            </p>
          )}
          <p className="muted" style={{ fontSize: 13 }}>
            Phần Writing sẽ được giáo viên chấm điểm và phản hồi riêng.
          </p>
        </div>
      )}
    </div>
  );
}
