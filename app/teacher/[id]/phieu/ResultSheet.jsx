"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { scoreColumns, aptisSkills } from "@/lib/sheetCols";
import { splitLabel, missingFields, cleanText } from "@/lib/sheetText";

// Result-sheet workspace for a whole class: class list (status of each
// student) | the fields, in the order of the paper sheet | live preview of
// the A5 sheet exactly as it prints (header with logo and centre address,
// the ASTRA watermark, the yellow / navy bars at the bottom). Saves by
// itself while typing.
//   short: 1 page — results + teacher's comment (mock tests, placement…)
//   full : page 1 results, then one comment table (per skill, class
//          attitude, study direction) over as many pages as it needs


function Page({ n, children, flow, short }) {
  return (
    <section className={`ps-page${flow ? " ps-flow" : ""}${short ? " ps-short" : ""}`}>
      <img className="ps-wm" src="/images/phieu/astra-watermark.jpg" alt="" />
      <header className="ps-head">
        <img className="ps-logo" src="/images/phieu/astra-header-logo.png" alt="ASTRA Language & IT Center" />
        <div className="ps-addr">
          <b>Trung tâm Ngoại ngữ và Tin học ASTRA</b>
          <span>📌 Lô BN2 - LK28, đường N1, KP Vinh Thạnh</span>
          <span className="ps-indent">P. Trấn Biên, thành phố Đồng Nai, Việt Nam</span>
          <span className="ps-contact"><span>☎ 0909.911.922</span><span>✉ <u>info@astra.edu.vn</u></span><span>🌐 <u>www.astra.edu.vn</u></span></span>
        </div>
      </header>
      <div className="ps-body">{children}</div>
      <footer className="ps-foot">
        <span>{n}</span>
        <img src="/images/phieu/astra-footer-bars.png" alt="" />
      </footer>
    </section>
  );
}

// Multi-line teacher text; a leading criterion label ("1. Fluency &
// coherence:", "Task 1:", "Điểm mạnh:") in bold, as in the Word templates.
function Prose({ text }) {
  const clean = cleanText(text);
  const lines = clean.split("\n");
  if (!clean.trim()) return <p className="ps-prose ps-empty">&nbsp;</p>;
  return (
    <div className="ps-prose">
      {lines.map((l, i) => {
        const { bold, rest } = splitLabel(l);
        return <p key={i}>{bold ? <><b>{bold}</b>{rest}</> : l || "\u00a0"}</p>;
      })}
    </div>
  );
}

// Sittings the student took under another name ("Nguyen Van A" /
// "Nguyễn Văn A", a typo…): search the class and merge them in by hand.
function ManualMerge({ id, name, inSheet, busy, onAdd }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [items, setItems] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/teacher/report/${id}/candidates?q=${encodeURIComponent(q.trim())}`, { cache: "no-store" });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || "Lỗi.");
        setItems(j.items); setErr("");
      } catch (e) { setErr(e.message); }
    }, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [open, q, id]);
  if (!open) return <button type="button" className="btn-ghost btn-sm" style={{ justifySelf: "start" }} onClick={() => setOpen(true)}>＋ Gộp bài thi nhập tên khác…</button>;
  const list = (items || []).filter((x) => !inSheet.has(x.id));
  return (
    <div className="ps-manual">
      <p className="muted" style={{ fontSize: 12, margin: 0 }}>Bài của <b>{name}</b> nhưng lúc thi nhập tên khác (không dấu, sai chính tả…). Mặc định hiện các bài cùng lớp; gõ tên để tìm ở mọi lớp.</p>
      <div className="row" style={{ gap: 6, width: "auto" }}>
        <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tên…" autoFocus />
        <button type="button" className="btn-ghost btn-sm" onClick={() => { setOpen(false); setQ(""); }}>Đóng</button>
      </div>
      {err && <p className="accent" style={{ margin: 0, fontSize: 12.5 }}>{err}</p>}
      <div className="ps-manual-list">
        {items === null ? <span className="muted" style={{ fontSize: 12.5 }}>Đang tải…</span>
          : !list.length ? <span className="muted" style={{ fontSize: 12.5 }}>Không có bài nào{q ? " khớp" : " khác trong lớp"}.</span>
          : list.map((x) => (
            <div key={x.id} className="ps-manual-row">
              <span><b>{x.name}</b>{x.class_name ? ` · ${x.class_name}` : ""} · {x.skills.map((k) => SK[k]).join(", ")}{!x.sameTest && <span className="ps-mates-miss"> · đề khác</span>}<br /><span className="muted">{when(x.created_at)} · {x.session_name || x.bank_name}</span></span>
              <button type="button" className="btn btn-sm" disabled={busy} onClick={() => onAdd(x.id)}>Gộp</button>
            </div>
          ))}
      </div>
    </div>
  );
}

const SK = { grammar: "Ngữ pháp", reading: "Reading", listening: "Listening", writing: "Writing" };
const when = (iso) => new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const ST = { todo: "Chưa nhập", doing: "Đang nhập", done: "Đã xong" };
const initials = (n) => { const p = (n || "?").trim().split(/\s+/); return ((p[p.length - 1] || "?")[0] + (p.length > 1 ? p[0][0] : "")).toUpperCase(); };
const fold = (t) => (t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\u0111/g, "d").replace(/\u0110/g, "D").toLowerCase();

// Textarea that grows with its text (no inner scroll bar).
function AutoText({ value, onChange, ...rest }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return <textarea ref={ref} rows={3} value={value || ""} onChange={onChange} {...rest} />;
}

function Card({ id, title, en, right, active, onFocus, children }) {
  return (
    <article id={`card-${id}`} className={`sb-card${active ? " is-active" : ""}`} onFocusCapture={() => onFocus(id)}>
      <div className="sb-card-h"><h3>{title}</h3>{en && <span className="sb-en">{en}</span>}<div className="sb-right">{right}</div></div>
      <div className="sb-card-b">{children}</div>
    </article>
  );
}

const ALL_RIGHTS = { admin: true, mine: true, fields: [], ownIds: [] };
const SKILL_VI = { listening: "Nghe", reading: "Đọc", writing: "Viết", speaking: "Nói", grammar: "Ngữ pháp" };
const FIELD_SKILL = { cListening: "listening", cReading: "reading", cWriting: "writing", cSpeaking: "speaking", speaking: "speaking" };

export default function ResultSheet({ data, initial, classmates = [], rights = ALL_RIGHTS, me = { role: "admin" } }) {
  const router = useRouter();
  const [r, setR] = useState(initial);
  // Parts of the sheet this person may write (lib/sheetRights.js); the
  // server enforces the same rules.
  const can = (k) => rights.admin || rights.fields.includes(k);
  const whose = (k) => (FIELD_SKILL[k] ? (data.owners?.[FIELD_SKILL[k]] ? `Phần của ${data.owners[FIELD_SKILL[k]]}` : "Chỉ GV được phân phần này hoặc admin") : "Chỉ admin nhập");
  const isTeacher = me.role === "teacher";
  const myParts = (data.parts || []).filter((p) => isTeacher && p.teacherId === me.id);
  const [handedAt, setHandedAt] = useState(myParts.length && myParts.every((p) => p.doneAt) ? myParts.map((p) => p.doneAt).sort().pop() : null);
  const [handState, setHandState] = useState(""); // "" | confirm | sending | error text
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState(() => new Set());
  const [merging, setMerging] = useState(false);
  const [state, setState] = useState("saved"); // saved | dirty | saving | error
  const [active, setActive] = useState(null);
  const [view, setView] = useState("edit"); // narrow screens: edit | preview
  const [fit, setFit] = useState(true);
  const [scale, setScale] = useState(1);
  const [q, setQ] = useState("");
  const [onlyTodo, setOnlyTodo] = useState(false);
  const [menu, setMenu] = useState(false);

  // ---- saving: by itself 1 s after the last change, and before leaving
  const rRef = useRef(r); rRef.current = r;
  // The values this screen started from / last saved: the server only
  // takes the fields changed since (several people can have the sheet open).
  const baseRef = useRef(initial);
  const dirty = useRef(false);
  const timer = useRef(null);
  const chain = useRef(Promise.resolve(true));
  const save = useCallback(() => {
    clearTimeout(timer.current);
    chain.current = chain.current.then(async () => {
      if (!dirty.current) return true;
      dirty.current = false;
      setState("saving");
      try {
        const sent = rRef.current;
        const res = await fetch(`/api/teacher/report/${data.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...sent, base: baseRef.current }) });
        if (!res.ok) throw new Error();
        baseRef.current = sent;
        if (!dirty.current) setState("saved");
        return true;
      } catch {
        dirty.current = true;
        setState("error");
        return false;
      }
    });
    return chain.current;
  }, [data.id]);
  const edit = (patch) => {
    setR((p) => ({ ...p, ...patch }));
    dirty.current = true;
    setState("dirty");
    clearTimeout(timer.current);
    timer.current = setTimeout(save, 1000);
  };
  const set = (k) => (e) => edit({ [k]: e.target.value });
  useEffect(() => {
    const flush = () => {
      if (!dirty.current) return;
      fetch(`/api/teacher/report/${data.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...rRef.current, base: baseRef.current }), keepalive: true });
      dirty.current = false;
    };
    const warn = (e) => { if (dirty.current) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", warn);
    return () => { window.removeEventListener("pagehide", flush); window.removeEventListener("beforeunload", warn); };
  }, [data.id]);

  // After a reload (merge ticked, Writing graded meanwhile…) take over the
  // fresh server values for the auto-filled parts: the merge list and the
  // Writing feedback where the teacher has not written their own text;
  // fields still empty here but filled on the server (comments typed on a
  // sitting that was just merged in) too.
  useEffect(() => {
    setR((p) => {
      const keep = (k) => (p[k] || "").trim() && (p[k] || "").trim() !== (p.autoW || "").trim();
      const fill = {};
      for (const k of ["teacher", "level", "levelNote", "speaking", "total", "cListening", "cSpeaking", "cReading", "classSituation", "direction"]) {
        if (!(p[k] || "").toString().trim() && (initial[k] || "").toString().trim()) fill[k] = initial[k];
      }
      const took = {
        ...fill,
        autoW: initial.autoW, mergeIds: initial.mergeIds, mergeOff: initial.mergeOff,
        ...(keep("comment") ? {} : { comment: initial.comment }),
        ...(keep("cWriting") ? {} : { cWriting: initial.cWriting }),
      };
      baseRef.current = { ...baseRef.current, ...took };
      return { ...p, ...took };
    });
  }, [initial.autoW, initial.comment, initial.cWriting, initial.cSpeaking, initial.cListening, initial.cReading, initial.direction, initial.classSituation, (initial.mergeIds || []).join(",")]);

  // Include / leave out another submission of this student, then reload
  // so the scores are combined on the server.
  const toggleMerge = async (id, on) => {
    setMerging(true);
    const mergeIds = on ? [...new Set([...(r.mergeIds || []), id])] : (r.mergeIds || []).filter((x) => x !== id);
    const mergeOff = on ? (r.mergeOff || []).filter((x) => x !== id) : [...new Set([...(r.mergeOff || []), id])];
    edit({ mergeIds, mergeOff });
    rRef.current = { ...rRef.current, mergeIds, mergeOff };
    await save();
    router.refresh();
    setMerging(false);
  };

  const full = r.template === "full";
  const has = (k) => data.skills.includes(k);
  const cols = scoreColumns(data, r);
  const missing = missingFields(r, data.skills, { writingReady: false });

  // ---- class list, moving between students
  const idx = classmates.findIndex((c) => c.current);
  const go = async (c) => { if (!c || c.current) return; await save(); router.push(`/teacher/${c.id}/phieu`); };
  const nextMate = idx >= 0 ? classmates[idx + 1] : null;
  const prevMate = idx > 0 ? classmates[idx - 1] : null;
  const shown = classmates.filter((c) => (!onlyTodo || c.status !== "done" || c.current) && (!q.trim() || fold(c.name).includes(fold(q.trim()))));
  const done = classmates.filter((c) => (c.current ? !missing.length : c.status === "done")).length;
  const ungraded = classmates.filter((c) => c.needsGrading).length;
  const typed = ["speaking", "cListening", "cSpeaking", "cReading", "classSituation", "direction", "comment", "cWriting"]
    .some((k) => (r[k] || "").toString().trim() && !((k === "comment" || k === "cWriting") && r[k] === r.autoW));
  const statusOf = (c) => (c.current ? (!missing.length ? "done" : typed ? "doing" : "todo") : c.status);

  const downloadWord = async () => { setMenu(false); if (await save()) window.location.href = `/api/teacher/report/${data.id}/docx`; };
  const downloadClass = async () => { setMenu(false); if (await save()) window.location.href = `/api/teacher/report/${data.id}/docx?all=1`; };
  const printSheet = async () => { setMenu(false); await save(); setView("preview"); setTimeout(() => window.print(), 50); };

  // Export menu: closes on Esc or a click elsewhere.
  useEffect(() => {
    if (!menu) return;
    const close = (e) => { if (e.type === "keydown" ? e.key === "Escape" : !e.target.closest(".sb-export")) setMenu(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [menu]);

  // Alt+↑ / Alt+↓: previous / next student. Ctrl+Enter: next student.
  useEffect(() => {
    const onKey = (e) => {
      if (e.altKey && (e.key === "ArrowDown" || e.key === "ArrowUp")) { e.preventDefault(); go(e.key === "ArrowDown" ? nextMate : prevMate); }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); go(nextMate); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ---- preview: scaled to its column; clicking a part opens its field
  const pvRef = useRef(null);
  useEffect(() => {
    const el = pvRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(1.25, Math.max(0.3, (el.clientWidth - 36) / 560))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (!active) return;
    const t = document.querySelector(`.sb-preview [data-psec="${active}"]`);
    if (t && pvRef.current) t.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [active]);
  const jump = (key) => {
    setView("edit");
    setActive(key);
    setTimeout(() => {
      const card = document.getElementById(`card-${key}`) || document.getElementById("card-info");
      if (!card) return;
      if (key === "info") card.open = true;
      card.scrollIntoView({ block: "center", behavior: "smooth" });
      card.querySelector("textarea, input:not([type=checkbox])")?.focus({ preventScroll: true });
    }, 30);
  };
  const onPreviewClick = (e) => { const t = e.target.closest("[data-psec]"); if (t) jump(t.dataset.psec); };
  const ps = (key, cls = "") => ({ "data-psec": key, className: [cls, active === key && "hl"].filter(Boolean).join(" ") || undefined });

  const saveLabel = { saved: "Đã lưu", dirty: "Chưa lưu…", saving: "Đang lưu…", error: "Lưu lỗi — thử lại" }[state];
  const ta = (k, placeholder) => (can(k)
    ? <AutoText className="sb-ta" value={r[k]} onChange={set(k)} placeholder={placeholder} />
    : <AutoText className="sb-ta sb-ro" value={r[k]} readOnly placeholder={whose(k)} title={whose(k)} />);
  const ro = (k) => (can(k) ? {} : { readOnly: true, title: whose(k), className: "sb-inp sb-ro" });

  // ---- teacher: hand sheets in to the admin
  const FIELD_OF = { nghe: "cListening", doc: "cReading", viet: "cWriting", noi: "cSpeaking", scores: "speaking", lop: "classSituation", huong: "direction", mock: "comment" };
  const myMissing = missing.filter((m) => can(FIELD_OF[m.key]));
  const handIn = async (ids, force = false) => {
    if (!force && ids.length === 1 && ids[0] === data.id && myMissing.length && handState !== "confirm") { setHandState("confirm"); return; }
    setHandState("sending");
    if (!(await save())) { setHandState("Chưa lưu được phiếu — thử lại."); return; }
    try {
      const res = await fetch("/api/teacher/handin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sheetIds: ids }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Không nộp được.");
      if (ids.includes(data.id)) setHandedAt(j.at);
      setHandState(""); setPicking(false); setPicked(new Set());
      router.refresh();
    } catch (e) { setHandState(e.message); }
  };
  const toggleUp = (k) => {
    const up = new Set((r.cefrUp || "").split(",").filter(Boolean));
    if (up.has(k)) up.delete(k); else up.add(k);
    edit({ cefrUp: [...up].join(",") });
  };
  const apt = data.aptis ? aptisSkills(data, r) : null;
  const partLine = (data.parts || []).filter((p) => p.teacherId).map((p) => ({
    who: data.teacherNames?.[p.teacherId] || "GV",
    what: [...p.skills, ...(p.speaking ? ["speaking"] : [])].map((k) => SKILL_VI[k]).filter(Boolean).join(", "),
    doneAt: p.doneAt,
  }));
  const chip = (name) => { const c = cols.find((x) => x.name === name); return c && c.val !== "" && c.val !== null && c.val !== undefined ? <span className="sb-chip">{name} {c.val}{["Reading", "Listening", "Grammar"].includes(name) ? `/${c.max}` : ""}</span> : null; };

  const info = (
    <>
      <h1 className="ps-title">TEST RESULT</h1>
      <p className="ps-subtitle">{r.testTitle}</p>
      <p className="ps-h">Student’s information:</p>
      <table {...ps("info", "ps-table ps-info")}>
        <tbody>
          <tr><th>Name:</th><td className="ps-name">{(data.name || "").toLocaleUpperCase("vi")}</td></tr>
          <tr><th>Teacher:</th><td className="ps-teacher">{r.teacher || " "}</td></tr>
          <tr><th>Level:</th><td className="ps-level"><b>{r.level || " "}</b>{r.levelNote && <i>({r.levelNote})</i>}</td></tr>
          <tr><th>Class:</th><td className="ps-class">{r.className || " "}</td></tr>
        </tbody>
      </table>
      <p className="ps-h">Test results:</p>
      <table {...ps("scores", "ps-table ps-scores")}>
        <thead>
          <tr><th>Skills</th>{cols.map((c) => <th key={c.name}>{c.name}<br /><span>({c.max})</span></th>)}</tr>
        </thead>
        <tbody>
          <tr><th>{data.aptis ? "Score" : "Band score"}</th>{cols.map((c) => <td key={c.name}>{c.val === null || c.val === undefined || c.val === "" ? "" : c.val}</td>)}</tr>
          {data.aptis && <tr><th>CEFR</th>{cols.map((c) => <td key={c.name} className="ps-cefr">{c.sub}</td>)}</tr>}
        </tbody>
      </table>
    </>
  );

  return (
    <div className={`sb-shell view-${view}`}>
      <header className="sb-top">
        <a className="sb-back" href={`/teacher/${data.id}`} title="Về bài chấm">←</a>
        <div className="sb-brand"><b>Phiếu điểm</b><span className="sb-crumb">Lớp <span>{r.className || "—"}</span> · <span>{r.testTitle}</span></span></div>
        <div className="sb-grow" />
        <div className="sb-seg" role="group" aria-label="Mẫu phiếu">
          <button aria-pressed={full} disabled={!can("template")} onClick={() => edit({ template: "full" })}>Mid-term / Final</button>
          <button aria-pressed={!full} disabled={!can("template")} onClick={() => edit({ template: "short" })}>Mock test</button>
        </div>
        <div className="sb-seg sb-viewtabs" role="group" aria-label="Chế độ xem">
          <button aria-pressed={view === "edit"} onClick={() => setView("edit")}>Nhập</button>
          <button aria-pressed={view === "preview"} onClick={() => setView("preview")}>Xem phiếu</button>
        </div>
        <button type="button" className={`sb-save is-${state}`} onClick={() => state === "error" && save()} title={state === "error" ? "Bấm để lưu lại" : ""}><i />{saveLabel}</button>
        <div className="sb-export">
          <button type="button" className="sb-btn dark" aria-haspopup="true" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>⬇ Xuất phiếu</button>
          {menu && (
            <div className="sb-pop">
              <button onClick={downloadWord}><b>Word — phiếu của {data.name}</b><span>Đúng mẫu giấy của trung tâm</span></button>
              {classmates.length > 1 && <button onClick={downloadClass}><b>Word — cả lớp ({classmates.length})</b><span>1 file, mỗi học viên một phiếu{ungraded ? ` · ${ungraded} bài Writing chưa chấm` : ""}</span></button>}
              <hr />
              <button onClick={printSheet}><b>In / Lưu PDF</b><span>Khổ A5, bật “Đồ hoạ nền”, lề “Không”</span></button>
            </div>
          )}
        </div>
      </header>

      <main className="sb-app">
        {/* ---------- class list ---------- */}
        <aside className="sb-col sb-roster" aria-label="Danh sách học viên">
          <div className="sb-roster-head">
            <div className="sb-roster-title"><h2>Lớp {r.className || ""}</h2><span className="mono">{done}/{classmates.length || 1} xong</span></div>
            <div className="sb-prog"><i style={{ width: `${(done / Math.max(1, classmates.length)) * 100}%` }} /></div>
            <label className="sb-search"><span aria-hidden>⌕</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm học viên" aria-label="Tìm học viên" /></label>
            <div className="sb-filters">
              <button aria-pressed={!onlyTodo} onClick={() => setOnlyTodo(false)}>Tất cả</button>
              <button aria-pressed={onlyTodo} onClick={() => setOnlyTodo(true)}>Chưa xong</button>
            </div>
            {isTeacher && classmates.length > 1 && (
              <div className="sb-pick">
                {!picking ? <button type="button" className="sb-link" onClick={() => setPicking(true)}>☑ Nộp nhiều phiếu một lúc</button> : (
                  <>
                    <button type="button" className="sb-btn dark" disabled={!picked.size || handState === "sending"} onClick={() => handIn([...picked], true)}>Nộp {picked.size} phiếu</button>
                    <button type="button" className="sb-link" onClick={() => setPicked(new Set(classmates.map((c) => c.id)))}>Chọn cả lớp</button>
                    <button type="button" className="sb-link" onClick={() => { setPicking(false); setPicked(new Set()); }}>Huỷ</button>
                  </>
                )}
              </div>
            )}
          </div>
          <ul className="sb-list">
            {(classmates.length ? shown : [{ id: data.id, name: data.name, current: true }]).map((c) => {
              const st = statusOf(c);
              return (
                <li key={c.id} className={picking ? "sb-picking" : undefined}>
                  {picking && <input type="checkbox" className="sb-pick-box" aria-label={`Chọn ${c.name}`} checked={picked.has(c.id)} onChange={(e) => setPicked((p) => { const n = new Set(p); if (e.target.checked) n.add(c.id); else n.delete(c.id); return n; })} />}
                  <button className="sb-stu" aria-current={c.current ? "true" : undefined} onClick={() => (picking ? setPicked((p) => { const n = new Set(p); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; }) : go(c))}>
                    <span className="sb-ava">{initials(c.name)}</span>
                    <span className="sb-stu-t"><span className="sb-nm">{c.name}</span>
                      <span className="sb-sub">{ST[st]}{st === "doing" && (c.current ? missing.length : c.missing) ? ` · thiếu ${c.current ? missing.length : c.missing}` : ""}{c.needsGrading ? <span className="sb-warn"> · ✍ chưa chấm</span> : ""}{(c.current ? handedAt : c.handedIn) ? <span className="sb-handed"> · ✓ đã nộp</span> : ""}</span>
                    </span>
                    <i className={`sb-dot st-${st}`} aria-label={ST[st]} />
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="sb-legend">
            <span><i className="sb-dot st-todo" />Chưa nhập</span>
            <span><i className="sb-dot st-doing" />Đang nhập</span>
            <span><i className="sb-dot st-done" />Đã xong</span>
            <div className="sb-kbd"><kbd>Alt</kbd><kbd>↑</kbd><kbd>↓</kbd> đổi học viên</div>
            <div className="sb-kbd"><kbd>Ctrl</kbd><kbd>Enter</kbd> sang em tiếp</div>
          </div>
        </aside>

        {/* ---------- fields ---------- */}
        <section className="sb-col sb-editor" aria-label="Nhập nhận xét">
          <div className="sb-ed">
            <div className="sb-stu-head">
              <div>
                <div className="sb-eyebrow"><span className={`sb-badge b-${statusOf({ current: true })}`}>{ST[statusOf({ current: true })]}</span>{idx >= 0 && <span>{idx + 1} / {classmates.length}</span>}</div>
                <h1>{data.name}</h1>
              </div>
              {data.hasWriting && !data.graded && <a className="sb-warnlink" href={`/teacher/${data.writerId}`}>✍ Writing chưa chấm — chấm ngay →</a>}
            </div>
            {partLine.length > 0 && (
              <div className="sb-parts">
                {partLine.map((p, i) => (
                  <span key={i} className={p.doneAt ? "done" : ""}><b>{p.who}</b> · {p.what} — {p.doneAt ? `đã nộp ${when(p.doneAt)}` : "chưa nộp"}</span>
                ))}
              </div>
            )}

            <details className="sb-info" id="card-info" onFocusCapture={() => setActive("info")}>
              <summary><span>Thông tin phiếu</span><b>{r.testTitle || "—"}</b>·<span>{r.teacher || "chưa có GV"}</span>·<span>{r.level || "chưa có level"}</span>·<span>{r.className || "—"}</span><span className="sb-plus">+</span></summary>
              <div className="sb-grid2">
                <label className="sb-fld"><span>Tên bài thi (dòng dưới TEST RESULT)</span><input className="sb-inp" value={r.testTitle || ""} onChange={set("testTitle")} {...ro("testTitle")} /></label>
                <label className="sb-fld"><span>Giáo viên</span><input className="sb-inp" value={r.teacher || ""} onChange={set("teacher")} placeholder="Ms Ngọc Ngân & Ms Yến Nhi" {...ro("teacher")} /></label>
                <label className="sb-fld"><span>Level</span><input className="sb-inp" value={r.level || ""} onChange={set("level")} placeholder="FLY UP 6" {...ro("level")} /></label>
                <label className="sb-fld"><span>Ghi chú level</span><input className="sb-inp" value={r.levelNote || ""} onChange={set("levelNote")} placeholder="Lộ trình đạt 6.0+" {...ro("levelNote")} /></label>
                <label className="sb-fld"><span>Lớp</span><input className="sb-inp" value={r.className || ""} onChange={set("className")} {...ro("className")} /></label>
              </div>
            </details>

            <Card id="scores" title="Điểm" en="Test results" active={active === "scores"} onFocus={setActive}
              right={<span className="sb-en">Reading, Listening, Writing lấy từ bài làm & phần chấm</span>}>
              <div className="sb-scores" style={{ "--n": cols.filter((c) => !["Speaking", "TOTAL"].includes(c.name)).length + 1 + (full && !data.aptis ? 1 : 0) + (apt && apt.total !== null ? 1 : 0) }}>
                {cols.filter((c) => !["Speaking", "TOTAL"].includes(c.name)).map((c) => (
                  <div key={c.name} className="sb-sc ro">
                    <div className="k">{c.name}</div>
                    <div className="v">{c.val === "" || c.val === null || c.val === undefined ? "–" : c.val}<small>{c.name === "Writing" ? "" : `/${c.max}`}</small></div>
                    <div className="hint">{c.name === "Writing" ? (data.graded ? "từ phần chấm" : <a href={`/teacher/${data.writerId}`}>chưa chấm →</a>) : data.aptis ? c.sub || "" : "từ bài làm"}</div>
                    {apt && c.name !== "TOTAL" && (() => { const k = c.name.toLowerCase(); const a = apt[k]; if (!a) return null; return a.raised
                      ? <div className="sb-near up">↑ đã nâng lên {a.cefr}{can("cefrUp") && <> · <button type="button" className="sb-link" onClick={() => toggleUp(k)}>bỏ nâng</button></>}</div>
                      : a.near ? <div className="sb-near">Sát mốc {a.near}{can("cefrUp") && <> · <button type="button" className="sb-link" onClick={() => toggleUp(k)}>nâng lên {a.near}</button></>}</div> : null; })()}
                  </div>
                ))}
                <label className="sb-sc">
                  <div className="k">Speaking</div>
                  <input inputMode="decimal" value={r.speaking || ""} onChange={set("speaking")} placeholder="–" aria-label="Speaking" readOnly={!can("speaking")} title={can("speaking") ? "" : whose("speaking")} />
                  <div className="hint">{!can("speaking") ? whose("speaking") : data.aptis ? `thang 0–50${apt?.speaking.cefr ? ` · ${apt.speaking.cefr}` : ""}` : full ? "band, nhập tay" : "bỏ trống nếu không thi"}</div>
                  {apt?.speaking && (apt.speaking.raised ? <div className="sb-near up">↑ đã nâng lên {apt.speaking.cefr}{can("cefrUp") && <> · <button type="button" className="sb-link" onClick={() => toggleUp("speaking")}>bỏ nâng</button></>}</div>
                    : apt.speaking.near ? <div className="sb-near">Sát mốc {apt.speaking.near}{can("cefrUp") && <> · <button type="button" className="sb-link" onClick={() => toggleUp("speaking")}>nâng lên {apt.speaking.near}</button></>}</div> : null)}
                </label>
                {apt && apt.total !== null && (
                  <label className="sb-sc total">
                    <div className="k">TOTAL</div>
                    <input inputMode="numeric" value={r.total || ""} onChange={set("total")} placeholder={String(apt.total)} aria-label="TOTAL" readOnly={!can("total")} title={can("total") ? "" : whose("total")} />
                    <div className="hint">/200 · CEFR tổng <b>{apt.overall || "–"}</b>{(r.total || "").trim() && can("total") ? <> · <button type="button" className="sb-link" onClick={() => edit({ total: "" })}>↺ về tự tính</button></> : ""}</div>
                  </label>
                )}
                {full && !data.aptis && (() => { const t = cols.find((c) => c.name === "TOTAL"); const auto = (r.total || "").trim() ? "" : t?.val; return (
                  <label className="sb-sc total">
                    <div className="k">TOTAL</div>
                    <input inputMode="decimal" value={r.total || ""} onChange={set("total")} placeholder={auto || "–"} aria-label="TOTAL" readOnly={!can("total")} title={can("total") ? "" : whose("total")} />
                    <div className="hint">{!can("total") ? "admin nhập" : (r.total || "").trim() ? <button type="button" className="sb-link" onClick={() => edit({ total: "" })}>↺ về tự tính</button> : "tự tính"}</div>
                  </label>); })()}
              </div>
            </Card>

            <details className="sb-merge-box" open={data.siblings.some((x) => !x.included) || undefined}>
              <summary><span>Bài thi gộp vào phiếu này</span><b>{1 + (r.mergeIds || []).length} bài</b><span className="sb-plus">+</span></summary>
              <div className="ps-merge">
                <p className="muted" style={{ fontSize: 12, margin: 0 }}>Thi nhiều buổi (vd buổi 1 Reading + Listening, buổi 2 Writing)? Tick các bài của cùng học viên để ra 1 phiếu chung.</p>
                <label className="ps-merge-row on">
                  <input type="checkbox" checked disabled />
                  <span><b>Bài này</b> · {data.primary.skills.map((k) => SK[k]).join(", ")}<br /><span className="muted">{when(data.primary.created_at)} · {data.primary.bank_name}</span></span>
                </label>
                {data.siblings.map((x) => (
                  <label key={x.id} className={`ps-merge-row ${(r.mergeIds || []).includes(x.id) ? "on" : ""}`}>
                    <input type="checkbox" checked={(r.mergeIds || []).includes(x.id)} disabled={merging || !(rights.admin || rights.ownIds.includes(x.id))} title={rights.admin || rights.ownIds.includes(x.id) ? "" : "Bài của GV khác — chỉ admin gộp / bỏ"} onChange={(e) => toggleMerge(x.id, e.target.checked)} />
                    <span>
                      {x.manual && <><b className="ps-merge-name">“{x.name}”</b> · </>}
                      {x.skills.map((k) => SK[k]).join(", ")}{x.skills.includes("writing") ? (x.graded ? " · đã chấm" : " · chưa chấm") : ""}
                      <br /><span className="muted">{when(x.created_at)} · {x.session_name || x.bank_name}</span>
                    </span>
                  </label>
                ))}
                <ManualMerge id={data.id} name={data.name} inSheet={new Set([...(r.mergeIds || []), ...data.siblings.map((x) => x.id)])} busy={merging} onAdd={(id) => toggleMerge(id, true)} />
              </div>
            </details>

            {!full && (
              <Card id="mock" title="Teacher’s comment" en="Nhận xét chung" active={active === "mock"} onFocus={setActive}>
                {ta("comment", "Nhận xét chung cho bài thi")}
                {can("comment") && data.autoW && r.comment !== data.autoW && <button type="button" className="sb-link" onClick={() => edit({ comment: data.autoW })}>↻ Lấy lại nhận xét từ phần chấm Writing</button>}
              </Card>
            )}
            {full && (
              <>
                {has("listening") && <Card id="nghe" title="Nghe" en="Listening" right={chip("Listening")} active={active === "nghe"} onFocus={setActive}>{ta("cListening", `Nhận xét kỹ năng nghe của ${data.name}`)}</Card>}
                <Card id="noi" title="Nói" en="Speaking" right={chip("Speaking")} active={active === "noi"} onFocus={setActive}>{ta("cSpeaking", "1. Fluency & coherence: …\n2. Lexical resource + Grammatical range and accuracy: …\n3. Pronunciation: …")}</Card>
                {has("reading") && <Card id="doc" title="Đọc" en="Reading" right={chip("Reading")} active={active === "doc"} onFocus={setActive}>{ta("cReading", `Nhận xét kỹ năng đọc của ${data.name}`)}</Card>}
                {has("writing") && (
                  <Card id="viet" title="Viết" en="Writing" right={chip("Writing")} active={active === "viet"} onFocus={setActive}>
                    {ta("cWriting", data.graded ? "Lấy sẵn từ phần chấm Writing" : "Chấm Writing xong, nhận xét sẽ tự điền vào đây")}
                    {can("cWriting") && data.autoW && r.cWriting !== data.autoW && <button type="button" className="sb-link" onClick={() => edit({ cWriting: data.autoW })}>↻ Lấy lại nhận xét từ phần chấm Writing</button>}
                  </Card>
                )}
                <Card id="lop" title="Tình hình trên lớp" active={active === "lop"} onFocus={setActive}>{ta("classSituation", "Thái độ học tập, chuyên cần, tham gia trên lớp")}</Card>
                <Card id="huong" title="Phương hướng học tập" active={active === "huong"} onFocus={setActive}>{ta("direction", "Mỗi ý một dòng, bắt đầu bằng dấu +")}</Card>
              </>
            )}

            <div className="sb-dock">
              <div className="sb-miss">
                {missing.length ? <><span>Còn thiếu:</span>{missing.map((m) => <button key={m.key + m.label} onClick={() => jump(m.key)}>{m.label}</button>)}</> : <span className="sb-ok">✓ Đủ các mục</span>}
              </div>
              {isTeacher && (
                <div className="sb-handin">
                  {handState === "confirm" ? (
                    <><span className="sb-warn">Còn thiếu: {myMissing.map((m) => m.label).join(", ")}</span><button className="sb-btn" onClick={() => handIn([data.id], true)}>Vẫn nộp</button><button className="sb-link" onClick={() => setHandState("")}>Huỷ</button></>
                  ) : (
                    <><button className="sb-btn" disabled={handState === "sending"} onClick={() => handIn([data.id])}>{handState === "sending" ? "Đang nộp…" : handedAt ? "Nộp lại" : "Nộp phiếu cho admin"}</button>
                      {handedAt && <span className="sb-handed">✓ Đã nộp {when(handedAt)}</span>}
                      {handState && handState !== "sending" && <span className="accent">{handState}</span>}</>
                  )}
                </div>
              )}
              {nextMate ? <button className="sb-btn dark" onClick={() => go(nextMate)}>Sang em tiếp: {nextMate.name} →</button> : <button className="sb-btn" onClick={save}>Lưu phiếu</button>}
            </div>
          </div>
        </section>

        {/* ---------- live preview ---------- */}
        <section className="sb-col sb-preview" aria-label="Xem trước phiếu">
          <div className="sb-pv-head"><b>Xem trước phiếu</b><span className="sb-en">bấm vào một phần để sửa</span>
            <div className="sb-seg sb-zoom" role="group" aria-label="Thu phóng">
              <button aria-pressed={fit} onClick={() => setFit(true)}>Vừa khung</button>
              <button aria-pressed={!fit} onClick={() => setFit(false)}>100%</button>
            </div>
          </div>
          <div className="sb-pv-body" ref={pvRef} onClick={onPreviewClick}>
            <div className="ps-sheets" style={{ zoom: fit ? scale : 1 }}>
              <Page n={1} short={!full}>
                {info}
                {!full && (
                  <table {...ps("mock", "ps-table ps-comment")}>
                    <tbody><tr><th>Teacher’s comment</th><td><Prose text={r.comment} /></td></tr></tbody>
                  </table>
                )}
                {full && (
                  <div className="ps-letter">
                    <p>Trung tâm Ngoại ngữ và Tin học Astra xin thông báo điểm và nhận xét lớp học của Học viên.</p>
                    <p>Kính chúc Quý Phụ huynh và các em sức khỏe, hạnh phúc,</p>
                    <p>Trân trọng cảm ơn Quý Phụ huynh và Học viên.</p>
                  </div>
                )}
              </Page>
              {full && (
                // One table, as in the template: the heading is its header row,
                // so when the comments run onto more pages it repeats on each.
                <Page n={2} flow>
                  <table className="ps-table ps-comment ps-full">
                    <thead><tr><th colSpan={2} className="ps-full-h">Nhận xét của giáo viên:</th></tr></thead>
                    <tbody>
                      {has("listening") && <tr {...ps("nghe")}><th>Nghe</th><td><Prose text={r.cListening} /></td></tr>}
                      <tr {...ps("noi")}><th>Nói</th><td><Prose text={r.cSpeaking} /></td></tr>
                      {has("reading") && <tr {...ps("doc")}><th>Đọc</th><td><Prose text={r.cReading} /></td></tr>}
                      {has("writing") && <tr {...ps("viet")}><th>Viết</th><td><Prose text={r.cWriting} /></td></tr>}
                      <tr {...ps("lop", "ps-tall")}><th>Tình hình trên lớp</th><td><Prose text={r.classSituation} /></td></tr>
                      <tr {...ps("huong", "ps-tall")}><th>Phương hướng học tập</th><td><Prose text={r.direction} /></td></tr>
                    </tbody>
                  </table>
                </Page>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
