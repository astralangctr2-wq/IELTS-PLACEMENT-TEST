"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
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
function HighlightZone({ children }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onMouseUp = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (!el.contains(range.commonAncestorContainer) || range.collapsed) return;
      const mark = document.createElement("mark");
      mark.className = "reading-highlight";
      try {
        range.surroundContents(mark);
      } catch (err) {
        // selection crosses element boundaries (e.g. an underlined word,
        // or spans two <p> tags) — surroundContents can't handle that,
        // so extract + rewrap instead.
        try {
          const contents = range.extractContents();
          mark.appendChild(contents);
          range.insertNode(mark);
        } catch (err2) {
          // give up quietly rather than breaking the page
        }
      }
      sel.removeAllRanges();
    };

    const onClick = (e) => {
      const mark = e.target.closest && e.target.closest("mark.reading-highlight");
      if (!mark || !el.contains(mark)) return;
      const parent = mark.parentNode;
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
      parent.removeChild(mark);
      parent.normalize();
    };

    el.addEventListener("mouseup", onMouseUp);
    el.addEventListener("click", onClick);
    return () => {
      el.removeEventListener("mouseup", onMouseUp);
      el.removeEventListener("click", onClick);
    };
  }, []);

  return (
    <div ref={ref} className="highlightable">
      {children}
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

const QuestionListBlock = memo(function QuestionListBlock({ questions, answers, setAnswers, startIndex = 0, locked }) {
  const handleChange = useCallback((qId, val) => {
    setAnswers((prev) => ({ ...prev, [qId]: val }));
  }, [setAnswers]);

  return (
    <div className="stack">
      {questions.map((q, i) => (
        <QuestionCard
          key={q.id}
          q={q}
          qId={q.id}
          index={startIndex + i}
          answer={answers[q.id]}
          locked={locked}
          onChange={handleChange}
        />
      ))}
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
  const [writing, setWriting] = useState("");
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

  // Text size preference — set via the same control cluster as the
  // light/dark toggle (top-right corner), shared across the whole app
  // via localStorage but only visually applied within this test view.
  const [fontSize, setFontSize] = useState("medium");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("fontSize");
      if (saved && FONT_SIZES[saved]) setFontSize(saved);
    } catch (e) {}
    const onStorage = (e) => {
      if (e.key === "fontSize" && FONT_SIZES[e.newValue]) setFontSize(e.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

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

  const wordCount = writing.trim().length === 0 ? 0 : writing.trim().split(/\s+/).length;
  const answeredCount = (answers, qs) => qs.filter((q) => isAnswered(answers[q.id])).length;

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
          writingText: writing,
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
    <div className={stage === "reading" ? "wrap-reading" : "wrap"} style={{ zoom: FONT_SIZES[fontSize] }}>
      <div className="topbar">
        <div>
          <p className="serif" style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>IELTS Placement Test</p>
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
            <p style={{ margin: "16px 0 8px" }}>Mục tiêu band điểm hiện tại của bạn:</p>
            <select value={targetBand} onChange={(e) => setTargetBand(e.target.value)}>
              <option value="">— Chọn mục tiêu —</option>
              {BAND_OPTIONS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div className="card">
            <p className="mono muted" style={{ fontSize: 12, marginBottom: 10 }}>CẤU TRÚC BÀI TEST</p>
            <ul style={{ paddingLeft: 18, margin: 0, lineHeight: 1.9 }}>
              {activeSteps.includes("grammar") && <li>Ngữ pháp & Từ vựng: {content.grammar.length} câu trắc nghiệm{config.timeLimits.grammar ? ` — ${config.timeLimits.grammar} phút` : ""}</li>}
              {activeSteps.includes("reading") && <li>Reading: {content.reading.sections.length} đoạn văn, {readingFlat.length} câu hỏi{config.timeLimits.reading ? ` — ${config.timeLimits.reading} phút` : ""}</li>}
              {activeSteps.includes("listening") && <li>Listening: nghe audio (tối đa {config.listeningPlays} lần/đoạn), {listeningFlat.length} câu hỏi</li>}
              {activeSteps.includes("writing") && <li>Writing: bài luận{config.timeLimits.writing ? ` — ${config.timeLimits.writing} phút` : ""}, sẽ được giáo viên chấm điểm</li>}
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
            const priorCount = content.reading.sections.slice(0, si).reduce((n, s) => n + s.questions.length, 0);
            return (
              <div key={si} style={{ marginTop: si > 0 ? 40 : 0 }}>
                {sec.title && <p className="mono muted" style={{ fontSize: 12, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{sec.title}</p>}
                {sec.instructions && <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>{sec.instructions}</p>}
                <div className="reading-split" style={{ gridTemplateColumns: `${splitRatio}% 14px ${100 - splitRatio}%` }}>
                  <div className="reading-passage-pane">
                    <div className="card">
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
            const priorCount = content.listening.sections.slice(0, si).reduce((n, s) => n + s.questions.length, 0);
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
          <div className="card">
            <p style={{ lineHeight: 1.6, whiteSpace: "pre-line" }}>{content.writing.prompt}</p>
          </div>
          <textarea style={{ minHeight: 260 }} placeholder="Viết bài luận của bạn tại đây…" value={writing} onChange={(e) => setWriting(e.target.value)} disabled={expired.writing} />
          <div className="row" style={{ marginTop: 12 }}>
            <p className={`mono ${wordCount >= 200 ? "success" : "accent"}`} style={{ fontSize: 12 }}>{wordCount} từ {wordCount < 200 ? "(khuyến nghị tối thiểu 200 từ)" : "✓"}</p>
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
