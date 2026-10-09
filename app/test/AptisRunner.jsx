"use client";

// AptisRunner — the Aptis ESOL test experience, kept completely separate
// from the IELTS TestRunner (page.jsx picks one or the other by the bank's
// category). Only the data pipeline is shared: the exam is loaded from
// /api/content (answer keys already stripped) and submitted to
// /api/submissions, which scores Reading/Listening server-side exactly like
// IELTS, so Aptis results land on the same teacher dashboard.
//
// Layout follows the real computer-based Aptis test:
//   - one part per screen (Listening Part 1 = one question per screen),
//     with Back / Next and a page strip to jump within the current skill;
//   - skills run in order (Listening → Reading → Writing); once a skill is
//     finished you cannot go back to it;
//   - each recording has a limited number of plays and cannot be scrubbed;
//   - dropdowns sit inside the sentence (Reading Part 1) or above each
//     paragraph (Reading Part 4); sentence ordering (Reading Part 2) is
//     drag-and-drop, with tap-to-place as a fallback for touch screens.

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useFontSize } from "@/app/contexts/ThemeContext";
import PracticeAudioPlayer from "./PracticeAudioPlayer";
import PracticeReview from "./PracticeReview";
import { useExamIntegrity } from "./ExamIntegrity";
import { normalizeClassName } from "@/lib/classNames";

const FONT_ZOOM = { small: 0.9, medium: 1, large: 1.15 };
const SKILL_ORDER = ["listening", "reading", "writing"];
const SKILL_LABEL = { listening: "Listening", reading: "Reading", writing: "Writing" };
// Aptis Writing hard word limits (recommended range is shown as a hint).
const WRITING_LIMIT = { 1: 10, 2: 45, 3: 60 };
const WRITING_PART4 = [{ limit: 75, hint: "khoảng 50 từ" }, { limit: 225, hint: "120–150 từ" }];

const isFilled = (v) => v !== null && v !== undefined && String(v).trim() !== "";
const countWords = (s) => (typeof s === "string" ? s.trim().split(/\s+/).filter(Boolean).length : 0);
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

// How many scored answers a question contains (a 4-speaker matching task
// is 4 answers, a 5-sentence ordering task is 5, an instruction note is 0).
function slotCount(q) {
  switch (q.type) {
    case "note": return 0;
    case "matching": return q.items?.length || 1;
    case "heading_match": return q.paragraphs?.length || 1;
    case "reorder": return q.opts?.length || 1;
    case "multi_select": return q.selectCount || 1;
    default: return 1;
  }
}
function answeredSlots(q, v) {
  switch (q.type) {
    case "note": return 0;
    case "matching":
    case "heading_match":
    case "reorder":
      return Array.isArray(v) ? v.filter(isFilled).length : 0;
    case "multi_select": return Array.isArray(v) ? Math.min(v.length, q.selectCount || 1) : 0;
    default: return isFilled(v) ? 1 : 0;
  }
}

// ---------- passage (very small markdown: "# title", "## label", paragraphs) ----------
function passageTitle(text) {
  const m = (text || "").match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : "";
}
function Passage({ text }) {
  const blocks = (text || "").split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className="aptis-passage">
      {blocks.map((b, i) => {
        if (b.startsWith("# ")) return <h3 key={i}>{b.slice(2)}</h3>;
        if (b.startsWith("## ")) return <p key={i} className="aptis-passage-label">{b.slice(3)}</p>;
        return (
          <p key={i}>
            {b.split("\n").map((line, j) => (
              <span key={j}>{j > 0 && <br />}{line.replace(/__([^_]+)__/g, "$1")}</span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

// ---------- audio: limited plays, no seeking, stops when the page changes ----------
function AudioPlayer({ src, script, maxPlays, plays, onPlayed }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
  }, []);
  const left = Math.max(0, maxPlays - plays);

  const play = () => {
    if (playing || left <= 0) return;
    setError(false);
    if (src) {
      const a = new Audio(src);
      audioRef.current = a;
      a.onended = () => setPlaying(false);
      a.onerror = () => { setPlaying(false); setError(true); };
      a.play().then(() => { setPlaying(true); onPlayed(); }).catch(() => { setPlaying(false); setError(true); });
    } else if (script && typeof window !== "undefined" && window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(script);
      u.lang = "en-GB";
      u.onend = () => setPlaying(false);
      window.speechSynthesis.speak(u);
      setPlaying(true);
      onPlayed();
    }
  };

  return (
    <div className="aptis-audio">
      <button type="button" className="btn" onClick={play} disabled={playing || left <= 0}>
        {playing ? "🔊 Đang phát…" : left > 0 ? "▶ Nghe" : "Đã hết lượt nghe"}
      </button>
      <span className="mono muted" style={{ fontSize: 13 }}>Còn {left}/{maxPlays} lượt nghe</span>
      {error && <span className="accent" style={{ fontSize: 13 }}>Không phát được audio — báo giáo viên.</span>}
    </div>
  );
}

// ---------- question types ----------
function McQuestion({ q, name, value, onChange }) {
  // A gap in the sentence ("___") becomes a dropdown inside the sentence,
  // like Aptis Reading Part 1; otherwise a normal A/B/C option list.
  if (typeof q.q === "string" && q.q.includes("___")) {
    const k = q.q.indexOf("___");
    return (
      <div className="aptis-q">
        <p className="aptis-inline-sentence">
          {q.q.slice(0, k)}
          <select
            className="aptis-select aptis-inline-select"
            value={isFilled(value) ? value : ""}
            onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
            aria-label="Chọn từ điền vào chỗ trống"
          >
            <option value="">— chọn —</option>
            {q.opts.map((o, i) => <option key={i} value={i}>{o}</option>)}
          </select>
          {q.q.slice(k + 3)}
        </p>
      </div>
    );
  }
  return (
    <div className="aptis-q">
      <p className="aptis-q-text">{q.q}</p>
      <div className="aptis-options">
        {q.opts.map((o, i) => (
          <label key={i} className={`aptis-option ${value === i ? "selected" : ""}`}>
            <input type="radio" name={name} checked={value === i} onChange={() => onChange(i)} />
            <span className="aptis-option-letter">{String.fromCharCode(65 + i)}</span>
            <span>{o}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function MultiSelectQuestion({ q, value, onChange }) {
  const arr = Array.isArray(value) ? value : [];
  const max = q.selectCount || 1;
  const toggle = (i) => {
    if (arr.includes(i)) onChange(arr.filter((x) => x !== i));
    else if (arr.length < max) onChange([...arr, i]);
  };
  return (
    <div className="aptis-q">
      <p className="aptis-q-text">{q.q}</p>
      <p className="mono muted" style={{ fontSize: 12, margin: "0 0 8px" }}>Chọn {max} đáp án</p>
      <div className="aptis-options">
        {q.opts.map((o, i) => (
          <label key={i} className={`aptis-option ${arr.includes(i) ? "selected" : ""}`}>
            <input type="checkbox" checked={arr.includes(i)} onChange={() => toggle(i)} />
            <span className="aptis-option-letter">{String.fromCharCode(65 + i)}</span>
            <span>{o}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function GapQuestion({ q, value, onChange }) {
  return (
    <div className="aptis-q">
      <p className="aptis-q-text">{q.q}</p>
      <input type="text" value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="Nhập câu trả lời…" />
    </div>
  );
}

// Listening Part 2/3, Reading Part 3: one dropdown per item.
function MatchingQuestion({ q, value, onChange }) {
  const n = q.items.length;
  const arr = Array.isArray(value) ? value : Array(n).fill(null);
  const set = (i, v) => {
    const next = [...arr];
    while (next.length < n) next.push(null);
    next[i] = v;
    onChange(next);
  };
  return (
    <div className="aptis-q">
      {q.q && <p className="aptis-q-text">{q.q}</p>}
      <div className="aptis-match-list">
        {q.items.map((item, i) => (
          <div key={i} className="aptis-match-row">
            <span className="aptis-match-item">{item}</span>
            <select
              className="aptis-select"
              value={isFilled(arr[i]) ? arr[i] : ""}
              onChange={(e) => set(i, e.target.value === "" ? null : Number(e.target.value))}
              aria-label={`Chọn đáp án cho: ${item}`}
            >
              <option value="">— chọn —</option>
              {q.options.map((o, oi) => <option key={oi} value={oi}>{o}</option>)}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

// Reading Part 4: a heading dropdown placed right above each paragraph.
function HeadingMatchQuestion({ q, value, onChange }) {
  const n = q.paragraphs.length;
  const arr = Array.isArray(value) ? value : Array(n).fill(null);
  const set = (i, v) => {
    const next = [...arr];
    while (next.length < n) next.push(null);
    next[i] = v;
    onChange(next);
  };
  return (
    <div className="aptis-q">
      {q.q && <p className="aptis-q-text">{q.q}</p>}
      {q.paragraphs.map((para, i) => (
        <div key={i} className="aptis-para">
          <div className="aptis-para-head">
            <span className="aptis-para-num">{i + 1}</span>
            <select
              className="aptis-select"
              value={isFilled(arr[i]) ? arr[i] : ""}
              onChange={(e) => set(i, e.target.value === "" ? null : Number(e.target.value))}
              aria-label={`Chọn tiêu đề cho đoạn ${i + 1}`}
            >
              <option value="">— chọn tiêu đề —</option>
              {q.headings.map((h, hi) => <option key={hi} value={hi}>{h}</option>)}
            </select>
          </div>
          <p className="aptis-para-text">{para}</p>
        </div>
      ))}
    </div>
  );
}

// Reading Part 2: drag the sentences into numbered slots. The answer is an
// array with one entry per slot (the index into q.opts, or null when empty)
// — the same shape lib/scoring.js compares against correctOrder.
//   mouse: drag a sentence onto a slot (onto a filled slot = swap / bump
//          the old one back), or drag a placed sentence back to the list;
//   touch / keyboard: tap a sentence to pick it up, then tap a slot.
function ReorderQuestion({ q, value, onChange }) {
  const n = q.opts.length;
  const slots = Array.isArray(value) && value.length === n ? value : Array(n).fill(null);
  const placed = new Set(slots.filter(isFilled));
  const pool = q.opts.map((_, i) => i).filter((i) => !placed.has(i));
  const [picked, setPicked] = useState(null);
  const [over, setOver] = useState(null); // slot index or "pool"

  const place = (opt, slot) => {
    const next = [...slots];
    const from = next.indexOf(opt);
    const occupant = next[slot];
    if (from !== -1) next[from] = isFilled(occupant) ? occupant : null; // slot → slot: swap
    next[slot] = opt;                                                  // pool → slot: occupant returns to the list
    onChange(next);
    setPicked(null);
  };
  const unplace = (opt) => {
    onChange(slots.map((v) => (v === opt ? null : v)));
    setPicked(null);
  };
  const dragProps = (opt) => ({
    draggable: true,
    onDragStart: (e) => { e.dataTransfer.setData("text/plain", String(opt)); e.dataTransfer.effectAllowed = "move"; setPicked(null); },
    onDragEnd: () => setOver(null),
  });
  const dropProps = (target) => ({
    onDragOver: (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (over !== target) setOver(target); },
    onDragLeave: () => setOver(null),
    onDrop: (e) => {
      e.preventDefault();
      setOver(null);
      const opt = Number(e.dataTransfer.getData("text/plain"));
      if (!Number.isInteger(opt) || opt < 0 || opt >= n) return;
      if (target === "pool") unplace(opt);
      else place(opt, target);
    },
  });

  return (
    <div className="aptis-q">
      {q.q && <p className="aptis-q-text">{q.q}</p>}
      <p className="mono muted" style={{ fontSize: 12, margin: "0 0 10px" }}>
        Kéo từng câu vào ô theo đúng thứ tự (hoặc chạm vào câu rồi chạm vào ô).
      </p>
      <div className="aptis-reorder">
        <div
          className={`aptis-pool ${over === "pool" ? "over" : ""}`}
          {...dropProps("pool")}
          onClick={() => { if (isFilled(picked) && placed.has(picked)) unplace(picked); }}
        >
          <p className="aptis-reorder-label">Các câu</p>
          {pool.length === 0 && <p className="muted" style={{ fontSize: 13, margin: 0 }}>Đã xếp hết. Kéo câu về đây nếu muốn bỏ ra.</p>}
          {pool.map((opt) => (
            <button
              type="button"
              key={opt}
              className={`aptis-card ${picked === opt ? "picked" : ""}`}
              {...dragProps(opt)}
              onClick={(e) => { e.stopPropagation(); setPicked(picked === opt ? null : opt); }}
            >
              {q.opts[opt]}
            </button>
          ))}
        </div>
        <ol className="aptis-slots">
          {slots.map((opt, s) => (
            <li
              key={s}
              className={`aptis-slot ${isFilled(opt) ? "filled" : ""} ${over === s ? "over" : ""} ${isFilled(picked) ? "awaiting" : ""}`}
              {...dropProps(s)}
              onClick={() => {
                if (isFilled(picked)) place(picked, s);
                else if (isFilled(opt)) setPicked(opt);
              }}
            >
              <span className="aptis-slot-num">{s + 1}</span>
              {isFilled(opt) ? (
                <span className={`aptis-card in-slot ${picked === opt ? "picked" : ""}`} {...dragProps(opt)}>{q.opts[opt]}</span>
              ) : (
                <span className="aptis-slot-empty">{isFilled(picked) ? "Chạm để đặt câu vào đây" : "Thả câu vào đây"}</span>
              )}
            </li>
          ))}
        </ol>
      </div>
      {placed.size > 0 && (
        <button type="button" className="btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={() => { onChange(Array(n).fill(null)); setPicked(null); }}>
          ↺ Xếp lại từ đầu
        </button>
      )}
    </div>
  );
}

function QuestionView({ q, skill, value, onChange }) {
  switch (q.type) {
    case "note":
      return <div className="section-note">{(q.q || "").split("\n").map((l, i) => <p key={i}>{l}</p>)}</div>;
    case "matching": return <MatchingQuestion q={q} value={value} onChange={onChange} />;
    case "heading_match": return <HeadingMatchQuestion q={q} value={value} onChange={onChange} />;
    case "reorder": return <ReorderQuestion q={q} value={value} onChange={onChange} />;
    case "multi_select": return <MultiSelectQuestion q={q} value={value} onChange={onChange} />;
    case "gap": return <GapQuestion q={q} value={value} onChange={onChange} />;
    default: return <McQuestion q={q} name={`${skill}-${q.id}`} value={value} onChange={onChange} />;
  }
}

// ---------- writing (one part per screen, one box per prompt) ----------
function WritingPage({ task, ti, answers, setAnswer, onPaste }) {
  const part = ti + 1;
  const qs = Array.isArray(task.questions) && task.questions.length ? task.questions : null;
  const box = (id, limit, hint, minHeight) => {
    const words = countWords(answers[id]);
    const over = limit ? words > limit : false;
    return (
      <>
        <textarea
          value={answers[id] || ""}
          onChange={(e) => setAnswer(id, e.target.value)}
          onPaste={onPaste}
          onDrop={onPaste}
          placeholder={hint || (limit ? `Tối đa ${limit} từ` : "Viết câu trả lời…")}
          className={`aptis-textarea ${over ? "over" : ""}`}
          style={{ minHeight }}
        />
        <p className={`mono ${over ? "aptis-over" : "muted"}`} style={{ fontSize: 12, margin: "6px 0 0" }}>
          {words}{limit ? ` / ${limit}` : ""} từ{over ? " — vượt giới hạn" : ""}
        </p>
      </>
    );
  };
  return (
    <div className="aptis-q">
      {task.prompt && <div className="aptis-writing-prompt">{task.prompt.split("\n").map((l, i) => <p key={i}>{l || " "}</p>)}</div>}
      {task.imageUrl && <img src={task.imageUrl} alt="" style={{ maxWidth: "100%", borderRadius: 8, margin: "8px 0 12px" }} />}
      {qs ? (
        qs.map((q, i) => {
          const p4 = part === 4 ? WRITING_PART4[i] : null;
          const limit = q.wordLimit || (p4 ? p4.limit : WRITING_LIMIT[part]);
          const hint = p4 ? `${p4.hint} (tối đa ${limit})` : null;
          return (
            <div key={q.id} className="aptis-writing-item">
              <p className="aptis-q-text"><span className="aptis-writing-num">{i + 1}</span>{q.q}</p>
              {box(q.id, limit, hint, part === 1 ? 46 : part === 4 && i === 1 ? 220 : 120)}
            </div>
          );
        })
      ) : (
        box(`w_${ti}_free`, null, null, 220)
      )}
    </div>
  );
}

// ======================================================================
export default function AptisRunner({ config }) {
  const { fontSize } = useFontSize();
  const zoom = FONT_ZOOM[fontSize] || 1;

  const [content, setContent] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [stage, setStage] = useState("intro"); // intro | test | done
  const [studentName, setStudentName] = useState("");
  const [targetBand, setTargetBand] = useState("");
  // Answers are kept per skill: Reading and Listening question ids both
  // start at 0, so a single shared object would let one overwrite the other.
  const [answers, setAnswers] = useState({ listening: {}, reading: {}, writing: {} });
  const [plays, setPlays] = useState({});
  const [pageIdx, setPageIdx] = useState(0);
  const [deadlines, setDeadlines] = useState({});
  const [now, setNow] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [result, setResult] = useState(null);
  const submittedRef = useRef(false);
  // Practice mode (set per session by the teacher): no timers (the session
  // config carries no time limits), listening with pause/seek and unlimited
  // replays, and an answer review after submitting. Exam mode is unchanged.
  const practice = config.mode === "practice";

  useEffect(() => {
    let cancelled = false;
    const url = config.contentBankId ? `/api/content?bank=${encodeURIComponent(config.contentBankId)}` : "/api/content";
    fetch(url, { cache: "no-store" })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (cancelled) return;
        if (!ok || d.error) throw new Error(d.error || "Không tải được đề thi.");
        setContent(d);
      })
      .catch((err) => { if (!cancelled) setLoadError(err.message || "Không tải được đề thi."); });
    return () => { cancelled = true; };
  }, [config.contentBankId]);

  const activeSkills = useMemo(() => {
    if (!content) return [];
    const wanted = Array.isArray(config.skills) && config.skills.length ? config.skills : SKILL_ORDER;
    return SKILL_ORDER.filter((s) =>
      wanted.includes(s) && (s === "writing" ? content.writing?.tasks?.length : content[s]?.sections?.length)
    );
  }, [content, config.skills]);

  const pages = useMemo(() => {
    if (!content) return [];
    const out = [];
    for (const skill of activeSkills) {
      if (skill === "writing") {
        content.writing.tasks.forEach((task, ti) => out.push({ skill, kind: "writing", task, ti, key: `writing-${ti}`, title: `Part ${ti + 1}` }));
      } else {
        content[skill].sections.forEach((sec, si) => out.push({ skill, kind: "section", sec, si, key: `${skill}-${si}`, title: sec.title || `Part ${si + 1}` }));
      }
    }
    return out;
  }, [content, activeSkills]);

  const page = pages[pageIdx];
  const skill = page?.skill;
  // Exam mode only: fullscreen + leave/paste log (see ExamIntegrity.jsx).
  const integrity = useExamIntegrity({ enabled: !practice, active: stage === "test", section: skill });
  // Class: fixed by the link when the teacher set one, else typed.
  const [studentClass, setStudentClass] = useState(config.className || "");
  const classKey = normalizeClassName(config.className || studentClass);
  const [confirmBox, setConfirmBox] = useState(null);
  const skillPages = useMemo(() => pages.map((p, i) => ({ p, i })).filter((x) => x.p.skill === skill), [pages, skill]);
  const firstOfSkill = skillPages.length ? skillPages[0].i : 0;
  const lastOfSkill = skillPages.length ? skillPages[skillPages.length - 1].i : 0;
  const nextSkill = pages[lastOfSkill + 1]?.skill;
  const maxPlays = Math.max(1, Number(config.listeningPlays) || 2);

  const setAnswer = useCallback((sk, id, v) => {
    setAnswers((prev) => ({ ...prev, [sk]: { ...prev[sk], [id]: v } }));
  }, []);

  const pageStats = useCallback((p) => {
    if (p.kind === "writing") {
      const ids = p.task.questions?.length ? p.task.questions.map((q) => q.id) : [`w_${p.ti}_free`];
      return { total: ids.length, done: ids.filter((id) => isFilled(answers.writing[id])).length };
    }
    let total = 0, done = 0;
    for (const q of p.sec.questions) {
      const t = slotCount(q);
      total += t;
      done += Math.min(t, answeredSlots(q, answers[p.skill][q.id]));
    }
    return { total, done };
  }, [answers]);

  // Start a skill's countdown the first time the student reaches it
  // (only skills the teacher gave a time limit for).
  useEffect(() => {
    if (stage !== "test" || !skill) return;
    const mins = Number(config.timeLimits?.[skill]) || 0;
    if (mins > 0 && !deadlines[skill]) setDeadlines((d) => ({ ...d, [skill]: Date.now() + mins * 60000 }));
  }, [stage, skill, config.timeLimits, deadlines]);

  useEffect(() => {
    if (stage !== "test") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [stage]);

  const timeLeft = skill && deadlines[skill]
    ? Math.min((Number(config.timeLimits?.[skill]) || 0) * 60, Math.max(0, Math.round((deadlines[skill] - now) / 1000)))
    : null;

  const combinedWritingText = () =>
    (content?.writing?.tasks || [])
      .map((task, ti) => {
        const label = `PART ${ti + 1}`;
        if (Array.isArray(task.questions) && task.questions.length) {
          const body = task.questions.map((q, qi) => `${qi + 1}. ${q.q}\n${answers.writing[q.id] || "(chưa trả lời)"}`).join("\n\n");
          return `${label}\n${body}`;
        }
        return `${label}\n${answers.writing[`w_${ti}_free`] || "(chưa trả lời)"}`;
      })
      .join("\n\n\n");

  const submit = async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentName,
          studentClass: classKey,
          integrity: integrity.report(),
          targetBand,
          sessionId: config.sessionId || null,
          contentBankId: config.contentBankId || null,
          skills: activeSkills,
          readingAnswers: answers.reading,
          listeningAnswers: answers.listening,
          writingText: activeSkills.includes("writing") ? combinedWritingText() : "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể nộp bài.");
      setResult(data);
      setStage("done");
    } catch (err) {
      submittedRef.current = false;
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const unansweredInSkill = () =>
    skillPages.reduce((n, { p }) => { const s = pageStats(p); return n + (s.total - s.done); }, 0);

  // In-page confirmation instead of window.confirm(): a browser dialog
  // drops fullscreen, which exam monitoring would count against the student.
  const finishSkill = (auto = false, confirmed = false) => {
    if (!auto) {
      const left = unansweredInSkill();
      const isLast = lastOfSkill >= pages.length - 1;
      const msg = (left > 0 ? `Bạn còn ${left} câu chưa trả lời trong phần ${SKILL_LABEL[skill]}.\n` : "") +
        (isLast ? "Nộp bài ngay bây giờ?" : `Sang phần ${SKILL_LABEL[nextSkill]}? Bạn sẽ không quay lại phần ${SKILL_LABEL[skill]} được nữa.`);
      if (!confirmed) { setConfirmBox(msg); return; }
    }
    setConfirmBox(null);
    if (lastOfSkill >= pages.length - 1) submit();
    else setPageIdx(lastOfSkill + 1);
  };

  // Time up for the current skill: move on (or submit if it was the last).
  useEffect(() => {
    if (stage === "test" && timeLeft === 0) finishSkill(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, stage]);

  // ---------------- screens ----------------
  if (loadError) {
    return (
      <div className="wrap">
        <div className="card card-strong">
          <p className="accent" style={{ fontSize: 16 }}>{loadError}</p>
          <p className="muted" style={{ fontSize: 14, marginTop: 8 }}>Vui lòng tải lại trang, hoặc liên hệ giáo viên nếu lỗi vẫn còn.</p>
        </div>
      </div>
    );
  }
  if (!content) return <div className="wrap"><p className="muted">Đang tải đề thi…</p></div>;

  if (stage === "intro") {
    const count = (sk) => (content[sk]?.sections || []).reduce((n, s) => n + s.questions.reduce((m, q) => m + slotCount(q), 0), 0);
    return (
      <div className="wrap" style={{ zoom }}>
        <h1 className="serif" style={{ marginBottom: 6 }}>Aptis ESOL</h1>
        <p className="muted" style={{ marginBottom: 18 }}>{config.name || "Bài thi thử"}</p>
        <div className="card stack" style={{ maxWidth: 560 }}>
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
            {activeSkills.includes("listening") && <li>Listening: {count("listening")} câu — {practice ? "nghe không giới hạn, có thể tạm dừng." : `mỗi đoạn ghi âm nghe tối đa ${maxPlays} lần.`}</li>}
            {activeSkills.includes("reading") && <li>Reading: {count("reading")} câu{config.timeLimits?.reading ? ` — ${config.timeLimits.reading} phút` : ""}.</li>}
            {activeSkills.includes("writing") && <li>Writing: {content.writing.tasks.length} phần{config.timeLimits?.writing ? ` — ${config.timeLimits.writing} phút` : ""}.</li>}
          </ul>
          <p className="muted" style={{ fontSize: 13, margin: 0 }}>
            Mỗi màn hình là một phần của đề. Bạn có thể quay lại các câu trong cùng một kỹ năng, nhưng khi đã chuyển sang kỹ năng tiếp theo thì không quay lại được.
          </p>
          <div>
            <label className="mono muted" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Họ và tên *</label>
            <input type="text" placeholder="Nhập họ tên của bạn…" value={studentName} onChange={(e) => setStudentName(e.target.value)} />
          </div>
          <div>
            <label className="mono muted" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Lớp đang học *</label>
            {config.className ? (
              <input type="text" value={config.className} disabled title="Lớp do giáo viên gán cho link thi này" />
            ) : (
              <>
                <input type="text" placeholder="VD: FL1" value={studentClass} onChange={(e) => setStudentClass(e.target.value)} />
                {studentClass.trim() && classKey !== studentClass.trim() && (
                  <p className="mono muted" style={{ fontSize: 12, margin: "6px 0 0" }}>Sẽ ghi nhận là lớp: <b>{classKey}</b></p>
                )}
              </>
            )}
          </div>
          <div>
            <label className="mono muted" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Mục tiêu (tuỳ chọn)</label>
            <input type="text" placeholder="Vd: B1, B2…" value={targetBand} onChange={(e) => setTargetBand(e.target.value)} />
          </div>
          {!practice && (
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>
              Bài thi sẽ chuyển sang chế độ toàn màn hình. Việc thoát toàn màn hình hoặc chuyển sang trang/ứng dụng khác trong lúc làm bài sẽ được ghi lại cho giáo viên.
            </p>
          )}
          <button className="btn" disabled={!studentName.trim() || !classKey || pages.length === 0} onClick={() => { integrity.start(); setPageIdx(0); setStage("test"); }}>
            Bắt đầu làm bài
          </button>
        </div>
      </div>
    );
  }

  if (stage === "done" && practice && result?.review) {
    return (
      <div className="wrap" style={{ zoom, maxWidth: 980 }}>
        <PracticeReview review={result.review} studentName={studentName} hasWriting={activeSkills.includes("writing")} order={activeSkills} />
      </div>
    );
  }

  if (stage === "done") {
    return (
      <div className="wrap" style={{ zoom }}>
        <div className="card stack" style={{ maxWidth: 520 }}>
          <h2 style={{ margin: 0 }}>Đã nộp bài thành công</h2>
          <p>Cảm ơn {studentName || "bạn"} đã hoàn thành bài thi Aptis ESOL.</p>
          {result && activeSkills.includes("listening") && <p className="mono" style={{ margin: 0 }}>Listening: {result.lScore}/{result.lTotal}</p>}
          {result && activeSkills.includes("reading") && <p className="mono" style={{ margin: 0 }}>Reading: {result.rScore}/{result.rTotal}</p>}
          {activeSkills.includes("writing") && <p className="muted" style={{ fontSize: 13 }}>Phần Writing sẽ được giáo viên chấm và phản hồi riêng.</p>}
        </div>
      </div>
    );
  }

  // ---------------- test ----------------
  const sec = page.kind === "section" ? page.sec : null;
  const qs = sec ? sec.questions : [];
  const layoutOnly = qs.length > 0 && qs.every((q) => ["reorder", "heading_match", "note"].includes(q.type));
  const passage = page.skill === "reading" && sec ? sec.passage || "" : "";
  const showPassagePanel = passage && !layoutOnly && passage.replace(/^#.*$/m, "").trim().length > 0;
  // Topic heading from the passage ("# FILMS") — skipped when the part
  // title already says it, so it isn't printed twice.
  const rawTopic = passage ? passageTitle(passage) : "";
  const topic = rawTopic && !page.title.toUpperCase().includes(rawTopic.toUpperCase()) ? rawTopic : "";
  const twoCol = showPassagePanel && passage.length > 350;
  const isLastPage = pageIdx >= pages.length - 1;

  return (
    <div className="aptis-shell" style={{ zoom }}>
      {integrity.overlay}
      {confirmBox && (
        <div className="integrity-modal" role="dialog" aria-modal="true">
          <div className="integrity-modal-card neutral">
            {confirmBox.split("\n").map((l, i) => <p key={i}>{l}</p>)}
            <div className="row" style={{ gap: 10, justifyContent: "flex-end" }}>
              <button type="button" className="btn-ghost" onClick={() => setConfirmBox(null)}>Huỷ</button>
              <button type="button" className="btn" onClick={() => finishSkill(false, true)}>Đồng ý</button>
            </div>
          </div>
        </div>
      )}
      <header className="aptis-topbar">
        <div className="aptis-topbar-left">
          <strong>Aptis ESOL</strong>
          <span className="aptis-skill-pill">{SKILL_LABEL[skill]}</span>
        </div>
        <div className="aptis-skill-steps">
          {activeSkills.map((s) => {
            const idx = activeSkills.indexOf(s), cur = activeSkills.indexOf(skill);
            return <span key={s} className={`aptis-step ${s === skill ? "current" : idx < cur ? "done" : ""}`}>{SKILL_LABEL[s]}</span>;
          })}
        </div>
        <div className={`aptis-timer ${timeLeft !== null && timeLeft < 300 ? "warn" : ""}`}>
          {timeLeft !== null ? `⏱ ${fmtTime(timeLeft)}` : ""}
        </div>
      </header>

      <main className="aptis-page" key={page.key}>
        <div className="aptis-page-head">
          <h2 className="aptis-part-title">{page.title}</h2>
          <span className="mono muted" style={{ fontSize: 12 }}>Trang {pageIdx - firstOfSkill + 1}/{skillPages.length}</span>
        </div>
        {sec?.instructions && <p className="aptis-instructions">{sec.instructions}</p>}
        {page.skill === "listening" && sec && (sec.audioUrl || sec.script) && practice && (
          <PracticeAudioPlayer key={page.key} src={sec.audioUrl} script={sec.script} />
        )}
        {page.skill === "listening" && sec && (sec.audioUrl || sec.script) && !practice && (
          <AudioPlayer
            key={page.key}
            src={sec.audioUrl}
            script={sec.script}
            maxPlays={maxPlays}
            plays={plays[page.key] || 0}
            onPlayed={() => setPlays((p) => ({ ...p, [page.key]: (p[page.key] || 0) + 1 }))}
          />
        )}

        {page.kind === "writing" ? (
          <WritingPage task={page.task} ti={page.ti} answers={answers.writing} setAnswer={(id, v) => setAnswer("writing", id, v)} onPaste={practice ? undefined : integrity.blockPaste} />
        ) : (
          <div className={twoCol ? "aptis-two-col" : ""}>
            {showPassagePanel ? (
              <div className="aptis-passage-panel"><Passage text={passage} /></div>
            ) : (
              topic && <h3 className="aptis-topic">{topic}</h3>
            )}
            <div className="aptis-questions">
              {qs.map((q) => (
                <QuestionView
                  key={q.id}
                  q={q}
                  skill={page.skill}
                  value={answers[page.skill][q.id]}
                  onChange={(v) => setAnswer(page.skill, q.id, v)}
                />
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="aptis-footer">
        <div className="aptis-nav" aria-label="Chuyển trang">
          {skillPages.map(({ p, i }) => {
            const s = pageStats(p);
            return (
              <button
                type="button"
                key={p.key}
                className={`aptis-nav-dot ${i === pageIdx ? "current" : ""} ${s.total > 0 && s.done === s.total ? "done" : s.done > 0 ? "partial" : ""}`}
                onClick={() => setPageIdx(i)}
                title={`${p.title} — ${s.done}/${s.total}`}
              >
                {i - firstOfSkill + 1}
              </button>
            );
          })}
        </div>
        {submitError && <p className="accent" style={{ margin: 0, fontSize: 13 }}>{submitError}</p>}
        <div className="aptis-footer-btns">
          <button type="button" className="btn-ghost" disabled={pageIdx <= firstOfSkill} onClick={() => setPageIdx(pageIdx - 1)}>← Quay lại</button>
          {pageIdx < lastOfSkill ? (
            <button type="button" className="btn" onClick={() => setPageIdx(pageIdx + 1)}>Tiếp →</button>
          ) : (
            <button type="button" className="btn" disabled={submitting} onClick={() => finishSkill(false)}>
              {isLastPage ? (submitting ? "Đang nộp bài…" : "Nộp bài") : `Sang phần ${SKILL_LABEL[nextSkill]} →`}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
