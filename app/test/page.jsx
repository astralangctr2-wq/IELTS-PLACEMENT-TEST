"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const STEPS = ["intro", "grammar", "reading", "listening", "writing", "done"];

export default function TestPage() {
  const [content, setContent] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [stage, setStage] = useState("intro");
  const SECTION_STEPS = ["grammar", "reading", "listening", "writing"];
  const [furthestIndex, setFurthestIndex] = useState(0);
  const goStage = (next) => {
    const idx = SECTION_STEPS.indexOf(next);
    if (idx >= 0) setFurthestIndex((f) => Math.max(f, idx));
    setStage(next);
  };
  const [name, setName] = useState("");
  const [gAns, setGAns] = useState({});
  const [rAns, setRAns] = useState({});
  const [lAns, setLAns] = useState({});
  const [writing, setWriting] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [playCount, setPlayCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    fetch("/api/content")
      .then((r) => r.json())
      .then(setContent)
      .catch(() => setLoadError("Không tải được đề thi. Vui lòng tải lại trang."));
  }, []);

  const stopSpeakingRef = useRef(null);
  const stopSpeaking = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.pause();
      window.speechSynthesis.cancel();
    } catch (e) {
      // ignore — some browsers throw if called in an unexpected state
    }
    setSpeaking(false);
    // Some browsers (notably Chrome) silently ignore cancel() while an
    // utterance is mid-flight. Retry a few times shortly after as a
    // safety net so the voice reliably stops.
    if (stopSpeakingRef.current) clearTimeout(stopSpeakingRef.current);
    let attempts = 0;
    const retry = () => {
      attempts += 1;
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
      if (attempts < 4) stopSpeakingRef.current = setTimeout(retry, 150);
    };
    stopSpeakingRef.current = setTimeout(retry, 150);
  };

  // Audio should only ever play during the Listening step — stop it the
  // moment the student navigates to any other stage (e.g. Writing).
  useEffect(() => {
    if (stage !== "listening") stopSpeaking();
  }, [stage]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  const playListening = () => {
    if (!content || !window.speechSynthesis || playCount >= 2) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(content.listening.script);
    utter.lang = "en-US";
    utter.rate = 0.95;
    utter.onstart = () => setSpeaking(true);
    utter.onend = () => setSpeaking(false);
    window.speechSynthesis.speak(utter);
    setPlayCount((c) => c + 1);
  };

  const wordCount = writing.trim().length === 0 ? 0 : writing.trim().split(/\s+/).length;

  const answeredCount = (answers, qs) => qs.filter((q) => answers[q.id] !== undefined).length;

  const submit = async () => {
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentName: name,
          grammarAnswers: gAns,
          readingAnswers: rAns,
          listeningAnswers: lAns,
          writingText: writing,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể nộp bài.");
      setResult(data);
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

  const MCQBlock = ({ questions, answers, setAnswers }) => (
    <div className="stack">
      {questions.map((q, i) => (
        <div key={q.id} className="card">
          <p className="mono muted" style={{ fontSize: 12, marginBottom: 8 }}>Câu {i + 1}</p>
          <p style={{ marginBottom: 12, lineHeight: 1.5 }}>{q.q}</p>
          <div className="stack" style={{ marginTop: 4 }}>
            {q.opts.map((opt, oi) => (
              <div
                key={oi}
                className={`option ${answers[q.id] === oi ? "selected" : ""}`}
                onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: oi }))}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setAnswers((prev) => ({ ...prev, [q.id]: oi })); }}
              >
                <span className={`bubble ${answers[q.id] === oi ? "selected" : ""}`}>{String.fromCharCode(65 + oi)}</span>
                <span>{opt}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="wrap">
      <div className="topbar">
        <div>
          <p className="serif" style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>IELTS Placement Test</p>
          <p className="mono muted" style={{ fontSize: 12, margin: 0 }}>
            {stage === "intro" ? "Bắt đầu" : stage === "done" ? "Hoàn tất" : `Bước ${STEPS.indexOf(stage)}/4`}
          </p>
        </div>
      </div>

      {SECTION_STEPS.includes(stage) && (
        <div className="row" style={{ gap: 8, marginBottom: 24, flexWrap: "wrap", justifyContent: "flex-start" }}>
          {SECTION_STEPS.map((s, i) => {
            const labels = ["Ngữ pháp", "Reading", "Listening", "Writing"];
            const enabled = i <= furthestIndex;
            const active = s === stage;
            return (
              <button
                key={s}
                disabled={!enabled}
                onClick={() => enabled && goStage(s)}
                className={active ? "btn btn-sm" : "btn-ghost btn-sm"}
                title={enabled ? "Xem lại phần này" : "Chưa mở tới phần này"}
              >
                {i + 1}. {labels[i]}
              </button>
            );
          })}
        </div>
      )}

      {stage === "intro" && (
        <div>
          <div className="card card-strong">
            <p className="mb-2" style={{ marginBottom: 8 }}>Nhập tên của bạn:</p>
            <input type="text" placeholder="Nguyễn Văn A" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="card">
            <p className="mono muted" style={{ fontSize: 12, marginBottom: 10 }}>CẤU TRÚC BÀI TEST</p>
            <ul style={{ paddingLeft: 18, margin: 0, lineHeight: 1.9 }}>
              <li>01 — Ngữ pháp & Từ vựng: {content.grammar.length} câu trắc nghiệm</li>
              <li>02 — Reading: 1 đoạn văn, {content.reading.questions.length} câu hỏi</li>
              <li>03 — Listening: nghe audio (tối đa 2 lần), {content.listening.questions.length} câu hỏi</li>
              <li>04 — Writing: bài luận, sẽ được giáo viên chấm điểm</li>
            </ul>
          </div>
          <button className="btn" disabled={!name.trim()} onClick={() => goStage("grammar")}>Bắt đầu làm bài →</button>
        </div>
      )}

      {stage === "grammar" && (
        <div>
          <p className="serif" style={{ fontSize: 22, marginBottom: 16 }}>Ngữ pháp & Từ vựng</p>
          <MCQBlock questions={content.grammar} answers={gAns} setAnswers={setGAns} />
          <div className="row" style={{ marginTop: 20 }}>
            <p className="mono muted" style={{ fontSize: 12 }}>{answeredCount(gAns, content.grammar)}/{content.grammar.length} đã trả lời</p>
            <button className="btn" onClick={() => goStage("reading")}>Tiếp theo →</button>
          </div>
        </div>
      )}

      {stage === "reading" && (
        <div>
          <p className="serif" style={{ fontSize: 22, marginBottom: 16 }}>Reading</p>
          <div className="card">
            <p className="serif" style={{ lineHeight: 1.7, whiteSpace: "pre-line" }}>{content.reading.passage}</p>
          </div>
          <MCQBlock questions={content.reading.questions} answers={rAns} setAnswers={setRAns} />
          <div className="row" style={{ marginTop: 20 }}>
            <p className="mono muted" style={{ fontSize: 12 }}>{answeredCount(rAns, content.reading.questions)}/{content.reading.questions.length} đã trả lời</p>
            <button className="btn" onClick={() => goStage("listening")}>Tiếp theo →</button>
          </div>
        </div>
      )}

      {stage === "listening" && (
        <div>
          <p className="serif" style={{ fontSize: 22, marginBottom: 16 }}>Listening</p>
          <div className="card row">
            <div className="row" style={{ gap: 10, justifyContent: "flex-start" }}>
              <button className="btn-ghost" disabled={playCount >= 2 || speaking} onClick={playListening}>
                {speaking ? "▶ Đang phát…" : "▶ Phát audio"}
              </button>
              <button className="btn-ghost" onClick={stopSpeaking}>⏹ Dừng phát</button>
            </div>
            <p className="mono muted" style={{ fontSize: 12 }}>Đã phát: {playCount}/2 lần</p>
          </div>
          <MCQBlock questions={content.listening.questions} answers={lAns} setAnswers={setLAns} />
          <div className="row" style={{ marginTop: 20 }}>
            <p className="mono muted" style={{ fontSize: 12 }}>{answeredCount(lAns, content.listening.questions)}/{content.listening.questions.length} đã trả lời</p>
            <button className="btn" onClick={() => { stopSpeaking(); goStage("writing"); }}>Tiếp theo →</button>
          </div>
        </div>
      )}

      {stage === "writing" && (
        <div>
          <p className="serif" style={{ fontSize: 22, marginBottom: 16 }}>Writing</p>
          <div className="card">
            <p style={{ lineHeight: 1.6, whiteSpace: "pre-line" }}>{content.writing.prompt}</p>
          </div>
          <textarea style={{ minHeight: 260 }} placeholder="Viết bài luận của bạn tại đây…" value={writing} onChange={(e) => setWriting(e.target.value)} />
          <div className="row" style={{ marginTop: 12 }}>
            <p className={`mono ${wordCount >= 200 ? "success" : "accent"}`} style={{ fontSize: 12 }}>{wordCount} từ {wordCount < 200 ? "(khuyến nghị tối thiểu 200 từ)" : "✓"}</p>
            <button className="btn" disabled={submitting} onClick={submit}>
              {submitting ? "Đang nộp bài…" : "Nộp bài →"}
            </button>
          </div>
          {submitError && <p className="accent" style={{ marginTop: 10 }}>⚠ {submitError}</p>}
        </div>
      )}

      {stage === "done" && result && (
        <div>
          <div className="card card-strong">
            <p className="mono muted" style={{ fontSize: 12 }}>ĐÃ NỘP BÀI THÀNH CÔNG</p>
            <p className="serif" style={{ fontSize: 20, margin: "8px 0" }}>Cảm ơn {name || "bạn"} đã hoàn thành bài test!</p>
            <p className="muted" style={{ fontSize: 14 }}>Phần Writing sẽ được giáo viên chấm điểm. Lưu lại đường link bên dưới để xem kết quả cuối cùng sau này.</p>
          </div>
          <div className="card stack">
            <p className="mono muted" style={{ fontSize: 12 }}>ĐIỂM TỰ ĐỘNG</p>
            <p>Ngữ pháp: <b>{result.gScore}/{result.gTotal}</b></p>
            <p>Reading: <b>{result.rScore}/{result.rTotal}</b></p>
            <p>Listening: <b>{result.lScore}/{result.lTotal}</b></p>
          </div>
          <div className="card">
            <p className="mono muted" style={{ fontSize: 12, marginBottom: 8 }}>LINK XEM KẾT QUẢ WRITING</p>
            <Link href={`/test/status/${result.id}`}><button className="btn-ghost">Xem trạng thái chấm bài →</button></Link>
          </div>
        </div>
      )}
    </div>
  );
}
