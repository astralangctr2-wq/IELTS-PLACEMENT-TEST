"use client";

import { useEffect, useRef, useState } from "react";
import { flattenSectionQuestions, renderMarkedText } from "@/lib/content";
import BrandBar from "../components/BrandBar";

const ALL_SKILLS = ["grammar", "reading", "listening", "writing"];
const SKILL_TITLES = { grammar: "Ngữ pháp", reading: "Reading", listening: "Listening", writing: "Writing" };
const BAND_OPTIONS = ["4.0", "4.5", "5.0", "5.5", "6.0", "6.5", "7.0", "7.5", "8.0", "8.5", "Chưa rõ mục tiêu"];

function MarkedText({ text }) {
  const parts = renderMarkedText(text);
  return parts.map((part) =>
    typeof part === "string" ? part : <u key={part.key} className="vocab-underline">{part.text}</u>
  );
}

function QuestionCard({ q, index, answer, onChange, locked }) {
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
              onClick={() => !locked && onChange(oi)}
              role="button"
              tabIndex={0}
              style={locked ? { opacity: 0.6, cursor: "not-allowed" } : {}}
              onKeyDown={(e) => { if (!locked && (e.key === "Enter" || e.key === " ")) onChange(oi); }}
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
          onChange={(e) => onChange(e.target.value)}
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
                    onChange(next);
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
}

function QuestionListBlock({ questions, answers, setAnswers, startIndex = 0, locked }) {
  return (
    <div className="stack">
      {questions.map((q, i) => (
        <QuestionCard
          key={q.id}
          q={q}
          index={startIndex + i}
          answer={answers[q.id]}
          locked={locked}
          onChange={(val) => setAnswers((prev) => ({ ...prev, [q.id]: val }))}
        />
      ))}
    </div>
  );
}

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

  const goStage = (next) => {
    const idx = SECTION_STEPS.indexOf(next);
    if (idx >= 0) setFurthestIndex((f) => Math.max(f, idx));
    if (idx >= 0 && config.timeLimits[next] && !deadlines[next]) {
      setDeadlines((prev) => ({ ...prev, [next]: Date.now() + config.timeLimits[next] * 60 * 1000 }));
    }
    setStage(next);
  };

  useEffect(() => {
    fetch("/api/content", { cache: "no-store" })
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

  const readingFlat = flattenSectionQuestions(content.reading.sections);
  const listeningFlat = flattenSectionQuestions(content.listening.sections);

  const nextAfter = (s) => {
    const idx = SECTION_STEPS.indexOf(s);
    return SECTION_STEPS[idx + 1] || "writing";
  };

  return (
    <div className={stage === "reading" ? "wrap-reading" : "wrap"}>
      <div className="topbar">
        <div>
          <p className="serif" style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>IELTS Placement Test</p>
          <p className="mono muted" style={{ fontSize: 12, margin: 0 }}>
            {stage === "intro" ? "Bắt đầu" : stage === "done" ? "Hoàn tất" : `Bước ${SECTION_STEPS.indexOf(stage) + 1}/${SECTION_STEPS.length}`}
          </p>
        </div>
        <BrandBar />
      </div>

      {SECTION_STEPS.includes(stage) && (
        <div className="row" style={{ gap: 8, marginBottom: 12, flexWrap: "wrap", justifyContent: "flex-start" }}>
          {SECTION_STEPS.map((s, i) => {
            const enabled = i <= furthestIndex;
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
        <div className="row" style={{ marginBottom: 20 }}>
          <p className={`mono ${deadlines[stage] && now >= deadlines[stage] - 60000 ? "accent" : "muted"}`} style={{ fontSize: 13 }}>
            ⏱ Thời gian còn lại: {deadlines[stage] ? formatClock(deadlines[stage] - now) : `${config.timeLimits[stage]}:00`}
          </p>
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
              {SECTION_STEPS.includes("grammar") && <li>Ngữ pháp & Từ vựng: {content.grammar.length} câu trắc nghiệm{config.timeLimits.grammar ? ` — ${config.timeLimits.grammar} phút` : ""}</li>}
              {SECTION_STEPS.includes("reading") && <li>Reading: {content.reading.sections.length} đoạn văn, {readingFlat.length} câu hỏi{config.timeLimits.reading ? ` — ${config.timeLimits.reading} phút` : ""}</li>}
              {SECTION_STEPS.includes("listening") && <li>Listening: nghe audio (tối đa {config.listeningPlays} lần/đoạn), {listeningFlat.length} câu hỏi</li>}
              {SECTION_STEPS.includes("writing") && <li>Writing: bài luận{config.timeLimits.writing ? ` — ${config.timeLimits.writing} phút` : ""}, sẽ được giáo viên chấm điểm</li>}
            </ul>
          </div>
          <button className="btn" disabled={!name.trim()} onClick={() => goStage(SECTION_STEPS[0])}>Bắt đầu làm bài →</button>
        </div>
      )}

      {stage === "grammar" && (
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

      {stage === "reading" && (
        <div>
          <div className="row"><p className="serif" style={{ fontSize: 22, marginBottom: 16 }}>Reading</p><BrandBar size="small" /></div>
          {expired.reading && <p className="accent" style={{ marginBottom: 12 }}>⚠ Đã hết giờ — phần này đã bị khoá.</p>}
          {content.reading.sections.map((sec, si) => {
            const priorCount = content.reading.sections.slice(0, si).reduce((n, s) => n + s.questions.length, 0);
            return (
              <div key={si} style={{ marginTop: si > 0 ? 40 : 0 }}>
                {sec.title && <p className="mono muted" style={{ fontSize: 12, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{sec.title}</p>}
                {sec.instructions && <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>{sec.instructions}</p>}
                <div className="reading-split">
                  <div className="reading-passage-pane">
                    <div className="card">
                      <p className="serif" style={{ lineHeight: 1.7, whiteSpace: "pre-line" }}><MarkedText text={sec.passage} /></p>
                    </div>
                  </div>
                  <div className="reading-questions-pane">
                    <QuestionListBlock questions={sec.questions} answers={rAns} setAnswers={setRAns} startIndex={priorCount} locked={expired.reading} />
                  </div>
                </div>
              </div>
            );
          })}
          <div className="row" style={{ marginTop: 20 }}>
            <p className="mono muted" style={{ fontSize: 12 }}>{answeredCount(rAns, readingFlat)}/{readingFlat.length} đã trả lời</p>
            <button className="btn" onClick={() => goStage(nextAfter("reading"))}>Tiếp theo →</button>
          </div>
        </div>
      )}

      {stage === "listening" && (
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
                <QuestionListBlock questions={sec.questions} answers={lAns} setAnswers={setLAns} startIndex={priorCount} />
              </div>
            );
          })}
          <div className="row" style={{ marginTop: 20 }}>
            <p className="mono muted" style={{ fontSize: 12 }}>{answeredCount(lAns, listeningFlat)}/{listeningFlat.length} đã trả lời</p>
            <button className="btn" onClick={() => { stopSpeaking(); goStage(nextAfter("listening")); }}>Tiếp theo →</button>
          </div>
        </div>
      )}

      {stage === "writing" && (
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

      <div style={{ marginTop: 40, paddingTop: 16, borderTop: "1px solid var(--grid)" }}>
        <BrandBar size="small" style={{ justifyContent: "center" }} />
      </div>
    </div>
  );
}
