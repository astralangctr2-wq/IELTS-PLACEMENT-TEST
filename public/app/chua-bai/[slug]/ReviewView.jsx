"use client";

// Public answer review of a test ("link chữa bài"). Reading: the passage on
// the left, every question on the right with the key, where the answer is
// (click → the sentence is highlighted in the passage), paraphrase,
// explanation and trap. Listening: the audio + transcript; "▶ Nghe lại"
// plays from the moment the answer is said. Optionally the student types
// the name and class used in the test to see their own answers marked.

import { useEffect, useMemo, useRef, useState } from "react";
import { parsePassageBlocks } from "@/lib/content";

const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// *italic* inside explanations.
function Inline({ text }) {
  const parts = String(text || "").split(/(\*[^*]+\*)/g);
  return parts.map((p, i) => (p.startsWith("*") && p.endsWith("*") && p.length > 2 ? <i key={i}>{p.slice(1, -1)}</i> : <span key={i}>{p}</span>));
}

// Regex that finds a quoted fragment in the passage, tolerant of curly /
// straight quotes, dashes and spacing. The longest piece between "…" is used.
function quoteRegex(quote) {
  const pieces = String(quote || "").replace(/\*/g, "").split(/…|\.\.\.|\s\/\s/).map((x) => x.replace(/^[\s“”"'‘’—–-]+|[\s“”"'‘’—–-]+$/g, "")).filter(Boolean);
  if (!pieces.length) return null;
  const longest = pieces.sort((a, b) => b.length - a.length)[0];
  if (longest.length < 6) return null;
  const esc = longest.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/['’‘"“”]/g, "['’‘\"“”]").replace(/[—–-]/g, "[—–-]").replace(/\s+/g, "\\s+");
  try { return new RegExp(esc, "i"); } catch { return null; }
}

function Passage({ text, highlight }) {
  const re = useMemo(() => quoteRegex(highlight), [highlight]);
  const blocks = useMemo(() => parsePassageBlocks(text), [text]);
  let marked = false;
  return blocks.map((b, i) => {
    if (b.type === "title") return <p key={i} className="rv-p-title">{b.text}</p>;
    if (b.type === "heading") return <p key={i} className="rv-p-head">{b.text}</p>;
    const plain = b.text.replace(/__([^_]+)__/g, "$1");
    const m = !marked && re ? re.exec(plain) : null;
    if (m) {
      marked = true;
      return (
        <p key={i} className="serif rv-p">
          {plain.slice(0, m.index)}<mark className="rv-mark" data-rv-mark>{m[0]}</mark>{plain.slice(m.index + m[0].length)}
        </p>
      );
    }
    return <p key={i} className="serif rv-p">{plain}</p>;
  });
}

function PartBody({ p, mine, onLocate, onListen, skill }) {
  return (
    <div className={`rv-part ${mine ? (mine.ok ? "ok" : "bad") : ""}`}>
      {(p.num || p.label) && (
        <p className="rv-part-label">{p.num ? <b>Câu {p.num}. </b> : null}{p.label}</p>
      )}
      <p className="rv-line"><span className="rv-tag">Đáp án</span><b className="rv-key">{p.correct || "—"}</b></p>
      {mine && (
        <p className="rv-line"><span className="rv-tag">Bạn trả lời</span><span className={mine.ok ? "rv-ok" : "rv-bad"}>{mine.ok ? "✓" : "✗"} {mine.given}</span></p>
      )}
      {(p.where || p.quote) && (
        <p className="rv-line">
          <span className="rv-tag">{skill === "listening" ? "Nghe" : "Vị trí"}</span>
          <span>
            {p.where && <b>{p.where} </b>}
            {p.quote && <span className="rv-quote"><Inline text={p.quote} /></span>}
            {skill === "reading" && p.quote && <button type="button" className="rv-link" onClick={() => onLocate(p.quote)}>📍 Xem trong bài</button>}
            {skill === "listening" && Number.isFinite(p.time) && <button type="button" className="rv-link" onClick={() => onListen(p.time)}>▶ Nghe lại từ {fmtTime(p.time)}</button>}
          </span>
        </p>
      )}
      {p.para && <p className="rv-line"><span className="rv-tag">Paraphrase</span><span><Inline text={p.para} /></span></p>}
      {p.explain && <p className="rv-line"><span className="rv-tag">Giải thích</span><span><Inline text={p.explain} /></span></p>}
      {p.trap && <p className="rv-line"><span className="rv-tag rv-tag-trap">Bẫy</span><span><Inline text={p.trap} /></span></p>}
    </div>
  );
}

function Entries({ entries, skill, mine, onlyWrong, onLocate, onListen }) {
  return entries.map((e) => {
    if (e.kind === "note") {
      const [head, ...rest] = String(e.text || "").split("\n");
      return (
        <div key={`n${e.id}`} className="rv-note">
          <p className="rv-note-head">{head}</p>
          {rest.length > 0 && <p className="rv-note-body">{rest.join("\n")}</p>}
          {e.tip && <p className="rv-tip"><b>Mẹo: </b><Inline text={e.tip} /></p>}
        </div>
      );
    }
    const my = mine?.items?.[e.id];
    const allOk = my ? my.every((x) => x.ok) : null;
    if (onlyWrong && my && allOk) return null;
    const done = my ? my.filter((x) => x.ok).length : 0;
    return (
      <div key={`q${e.id}`} className={`rv-item ${my ? (allOk ? "ok" : done ? "partial" : "bad") : ""}`} id={`rv-${skill}-${e.id}`}>
        <div className="rv-item-head">
          <span className="rv-num">{e.start === e.end ? `Câu ${e.start}` : `Câu ${e.start}–${e.end}`}</span>
          {my && <span className={`rv-badge ${allOk ? "ok" : done ? "partial" : "bad"}`}>{allOk ? "✓ Đúng" : my.length > 1 ? `${done}/${my.length} đúng` : "✗ Sai"}</span>}
        </div>
        {e.q && <p className="rv-q">{e.q}</p>}
        {e.parts.map((p, pi) => (
          <PartBody key={pi} p={p} skill={skill} mine={my ? my[pi] : null} onLocate={onLocate} onListen={onListen} />
        ))}
      </div>
    );
  });
}

function ReadingSection({ sec, mine, onlyWrong }) {
  const [hl, setHl] = useState("");
  const paneRef = useRef(null);
  useEffect(() => {
    if (!hl) return;
    const el = paneRef.current?.querySelector("[data-rv-mark]");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [hl]);
  return (
    <section className="rv-section">
      <h2 className="rv-sec-title">{sec.title}</h2>
      {sec.intro && <p className="rv-intro"><Inline text={sec.intro} /></p>}
      <div className="rv-split">
        <div className="rv-passage" ref={paneRef}>
          {sec.imageUrl && <img src={sec.imageUrl} alt="" className="passage-image" />}
          <Passage text={sec.passage} highlight={hl} />
        </div>
        <div className="rv-questions">
          <Entries entries={sec.entries} skill="reading" mine={mine} onlyWrong={onlyWrong} onLocate={setHl} onListen={() => {}} />
        </div>
      </div>
    </section>
  );
}

function ListeningSection({ sec, mine, onlyWrong }) {
  const audioRef = useRef(null);
  const listRef = useRef(null);
  const [now, setNow] = useState(-1);
  const lines = sec.transcript || [];
  const current = useMemo(() => {
    let idx = -1;
    if (now < 0) return idx;
    for (let i = 0; i < lines.length; i++) if (lines[i].t <= now + 1) idx = i;
    return idx;
  }, [now, lines]);
  useEffect(() => {
    const el = listRef.current?.querySelector(".rv-tline.on");
    if (el && listRef.current) listRef.current.scrollTo({ top: el.offsetTop - listRef.current.offsetTop - 60, behavior: "smooth" });
  }, [current]);
  const listen = (t) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Math.max(0, t - 0.5);
    a.play().catch(() => {});
    a.closest(".rv-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <section className="rv-section">
      <h2 className="rv-sec-title">{sec.title}</h2>
      {sec.intro && <p className="rv-intro"><Inline text={sec.intro} /></p>}
      <div className="rv-split">
        <div className="rv-passage rv-audio-col">
          {sec.audioUrl ? (
            <audio ref={audioRef} src={sec.audioUrl} controls preload="metadata" className="rv-audio" onTimeUpdate={(e) => setNow(e.currentTarget.currentTime)} />
          ) : <p className="muted">Phần này không có file audio.</p>}
          {lines.length > 0 ? (
            <div className="rv-transcript" ref={listRef}>
              {lines.map((l, i) => (
                <p key={i} className={`rv-tline ${i === current ? "on" : ""}`} onClick={() => listen(l.t)}>
                  <span className="rv-ttime">{fmtTime(l.t)}</span>
                  {l.sp && <span className="rv-tsp">{l.sp}</span>}
                  <span>{l.text}</span>
                </p>
              ))}
            </div>
          ) : <p className="muted" style={{ fontSize: 13 }}>Chưa có transcript cho phần này.</p>}
        </div>
        <div className="rv-questions">
          <Entries entries={sec.entries} skill="listening" mine={mine} onlyWrong={onlyWrong} onLocate={() => {}} onListen={listen} />
        </div>
      </div>
    </section>
  );
}

export default function ReviewView({ slug, title, skills, preview }) {
  const [tab, setTab] = useState(skills[0]?.skill || "reading");
  const [name, setName] = useState("");
  const [cls, setCls] = useState("");
  const [mine, setMine] = useState(null);
  const [state, setState] = useState("");
  const [onlyWrong, setOnlyWrong] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("astra-review-me") || "null");
      if (saved?.name) { setName(saved.name); setCls(saved.cls || ""); }
    } catch {}
  }, []);

  const lookup = async (e) => {
    e?.preventDefault();
    if (!name.trim() || !cls.trim()) return;
    setState("loading");
    try {
      const res = await fetch(`/api/review/${slug}?name=${encodeURIComponent(name)}&cls=${encodeURIComponent(cls)}`, { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) { setState(j.error || "Không tìm thấy bài làm."); setMine(null); return; }
      setMine(j);
      setState("");
      try { localStorage.setItem("astra-review-me", JSON.stringify({ name, cls })); } catch {}
    } catch {
      setState("Không kết nối được. Thử lại sau.");
    }
  };

  const active = skills.find((s) => s.skill === tab) || skills[0];
  const mySkill = mine?.skills?.[active?.skill];

  return (
    <div className="rv-wrap">
      {preview && <p className="rv-preview">Xem trước — học viên chưa thấy trang này cho tới khi GV bấm “Công bố”.</p>}
      <header className="rv-header">
        <p className="mono muted" style={{ margin: 0, fontSize: 12, letterSpacing: ".06em" }}>ĐÁP ÁN &amp; CHỮA CHI TIẾT</p>
        <h1 className="serif rv-title">{title}</h1>
      </header>

      <form className="rv-me card" onSubmit={lookup}>
        <p className="rv-me-title">Xem bài làm của bạn <span className="muted">(không bắt buộc)</span></p>
        <div className="rv-me-row">
          <input type="text" placeholder="Họ tên — giống lúc vào thi" value={name} onChange={(e) => setName(e.target.value)} />
          <input type="text" placeholder="Lớp, vd FL4" value={cls} onChange={(e) => setCls(e.target.value)} style={{ maxWidth: 160 }} />
          <button className="btn btn-sm" disabled={!name.trim() || !cls.trim() || state === "loading"}>{state === "loading" ? "Đang tìm…" : "Xem"}</button>
        </div>
        {state && state !== "loading" && <p className="accent" style={{ margin: 0, fontSize: 13 }}>{state}</p>}
        {mine && (
          <div className="rv-me-result">
            <span><b>{mine.name}</b></span>
            {skills.map((s) => mine.skills[s.skill] && <span key={s.skill} className="rv-score">{s.label}: <b>{mine.skills[s.skill].score[0]}/{mine.skills[s.skill].score[1]}</b></span>)}
            <label className="rv-filter"><input type="checkbox" checked={onlyWrong} onChange={(e) => setOnlyWrong(e.target.checked)} /> Chỉ hiện câu sai</label>
          </div>
        )}
      </form>

      {skills.length > 1 && (
        <div className="rv-tabs" role="tablist">
          {skills.map((s) => (
            <button key={s.skill} role="tab" className={s.skill === active.skill ? "btn btn-sm" : "btn-ghost btn-sm"} onClick={() => setTab(s.skill)}>{s.label}</button>
          ))}
        </div>
      )}

      {active && active.sections.map((sec) => (
        active.skill === "reading"
          ? <ReadingSection key={`r${sec.index}`} sec={sec} mine={mySkill} onlyWrong={onlyWrong} />
          : <ListeningSection key={`l${sec.index}`} sec={sec} mine={mySkill} onlyWrong={onlyWrong} />
      ))}
    </div>
  );
}
