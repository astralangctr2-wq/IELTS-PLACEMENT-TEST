"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatVN } from "@/lib/formatDate";
import { aptisScaleFromRaw, aptisCefr } from "@/lib/grading";
import { INTEGRITY_LABEL } from "@/lib/integrity";

// Filtering, search and "load more" happen on the server (URL params
// class / q / n) — the board only ever holds what is on screen.
//   - "Tất cả lớp": newest submissions, 50 at a time.
//   - one class: every submission of that class, grouped by student.
// Each submission is one row that wraps on narrow screens — no sideways
// scrolling. Rare actions (result sheet, move link, delete) live in "⋯".

const SKILL_LABEL = { grammar: "NP", reading: "R", listening: "L", writing: "W" };
const ALL = "__all__";
const NONE = "__none__";

function autoScore(r) {
  if (!r.aptis) return r.objective_band !== null ? r.objective_band.toFixed(1) : "—";
  const skills = r.skills_included || [];
  const parts = [];
  if (skills.includes("listening")) parts.push(`L ${aptisScaleFromRaw(r.listening[0], r.listening[1]) ?? "—"}`);
  if (skills.includes("reading")) parts.push(`R ${aptisScaleFromRaw(r.reading[0], r.reading[1]) ?? "—"}`);
  return parts.join(" · ") || "—";
}

// Writing still to be graded by the teacher (Reading / Listening alone are
// marked by the machine and only confirmed by the teacher).
const hasWriting = (r) => (Array.isArray(r.skills_included) ? r.skills_included : ["writing"]).includes("writing");
const needsGrading = (r) => hasWriting(r) && !r.graded;

function finalScore(r) {
  if (!hasWriting(r)) return r.aptis ? autoScore(r) : r.objective_band !== null ? r.objective_band.toFixed(1) : "—";
  if (!r.graded) return "—";
  if (r.aptis) return r.aptis_writing !== null ? `W ${r.aptis_writing} · ${aptisCefr("writing", r.aptis_writing)}` : "—";
  return r.final_band !== null ? r.final_band.toFixed(1) : "—";
}

// "⋯" menu: result sheet, move to another exam link, delete.
function RowMenu({ row, allSessions, onChanged }) {
  const [open, setOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setMoveOpen(false); } };
    const esc = (e) => { if (e.key === "Escape") { setOpen(false); setMoveOpen(false); } };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  const move = async (sessionId) => {
    setBusy(true);
    try {
      await fetch(`/api/submissions/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "moveSession", sessionId: sessionId || null }),
      });
      setOpen(false); setMoveOpen(false);
      onChanged();
    } catch {
      alert("Không chuyển được — thử lại.");
    }
    setBusy(false);
  };
  const remove = async () => {
    if (!confirm(`Xoá bài làm của "${row.student_name}"? Không thể hoàn tác.`)) return;
    setBusy(true);
    const res = await fetch(`/api/submissions/${row.id}`, { method: "DELETE" });
    if (!res.ok) alert((await res.json().catch(() => ({}))).error || "Không xoá được.");
    setBusy(false); setOpen(false);
    onChanged();
  };

  return (
    <div className="row-menu" ref={ref}>
      <button className="btn-ghost btn-sm row-menu-btn" disabled={busy} onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} title="Thêm thao tác">⋯</button>
      {open && (
        <div className="row-menu-pop" role="menu">
          <a role="menuitem" href={`/teacher/${row.id}/phieu`} target="_blank" rel="noreferrer">🧾 Phiếu kết quả</a>
          <button role="menuitem" onClick={() => setMoveOpen((v) => !v)}>🔗 Chuyển sang link thi khác {moveOpen ? "▴" : "▾"}</button>
          {moveOpen && (
            <div className="row-menu-sub">
              <button onClick={() => move(null)}>Không thuộc link nào</button>
              {allSessions.map((s) => <button key={s.id} onClick={() => move(s.id)}>{s.name}</button>)}
            </div>
          )}
          <button role="menuitem" className="danger" onClick={remove}>🗑 Xoá bài làm</button>
        </div>
      )}
    </div>
  );
}

function SubRow({ row, showName, checked, onCheck, allSessions, onChanged }) {
  const skills = Array.isArray(row.skills_included) ? row.skills_included : ["grammar", "reading", "listening", "writing"];
  const flag = row.integrity && row.integrity.level !== "normal" ? row.integrity.level : null;
  return (
    <div className={`sub-row ${checked ? "checked" : ""}`}>
      <input type="checkbox" className="sub-check" checked={checked} onChange={(e) => onCheck(row.id, e.target.checked)} aria-label={`Chọn ${row.student_name}`} />
      <div className="sub-main">
        <div className="sub-title">
          <Link href={`/teacher/${row.id}`}>{showName ? row.student_name : row.bank_name || "Bài thi"}</Link>
          {flag && <span className={`integrity-pill ${flag}`} title="Giám sát làm bài">⚠ {INTEGRITY_LABEL[flag]}</span>}
        </div>
        <div className="sub-meta">
          {row.class_name ? <span className="class-pill">{row.class_name}</span> : <span className="class-pill none">Chưa phân lớp</span>}
          <span className={`type-pill ${row.aptis ? "aptis" : ""}`}>{row.aptis ? "APTIS" : "IELTS"}</span>
          {showName && row.bank_name && <span>{row.bank_name}</span>}
          <span className="mono">{skills.map((s) => SKILL_LABEL[s] || s).join(" ")}</span>
          <span className="mono">{formatVN(row.created_at)}</span>
        </div>
      </div>
      <div className="sub-score s-auto"><span>Tự động</span><b className="mono">{autoScore(row)}</b></div>
      <div className="sub-score s-final"><span>Kết quả</span><b className="mono">{finalScore(row)}</b></div>
      <div className="sub-status">
        {needsGrading(row) ? <span className="state-chip todo">Chưa chấm</span>
          : hasWriting(row) ? <span className="state-chip done">Đã chấm</span>
          : row.graded ? <span className="state-chip done" title="Giáo viên đã xem lại và xác nhận điểm trắc nghiệm">GV đã duyệt</span>
          : <span className="state-chip auto" title="Không có Writing — máy đã chấm theo đáp án">Máy đã chấm</span>}
      </div>
      <div className="sub-actions">
        <Link href={`/teacher/${row.id}`}>
          <button className={needsGrading(row) ? "btn btn-sm" : "btn-ghost btn-sm"}>{needsGrading(row) ? "Chấm →" : "Xem"}</button>
        </Link>
        <RowMenu row={row} allSessions={allSessions} onChanged={onChanged} />
      </div>
    </div>
  );
}

function SubList({ rows, showName, selected, onCheck, onCheckMany, allSessions, onChanged }) {
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  return (
    <div className="sub-list">
      <div className="sub-head">
        <input type="checkbox" className="sub-check" checked={allChecked} onChange={(e) => onCheckMany(rows.map((r) => r.id), e.target.checked)} aria-label="Chọn tất cả" />
        <span>{showName ? "Học viên" : "Bài thi"}</span>
        <span>Tự động</span>
        <span>Kết quả</span>
        <span>Trạng thái</span>
        <span />
      </div>
      {rows.map((r) => (
        <SubRow key={r.id} row={r} showName={showName} checked={selected.has(r.id)} onCheck={onCheck} allSessions={allSessions} onChanged={onChanged} />
      ))}
    </div>
  );
}

function ExportPanel({ summary, defaultClass, onClose }) {
  const classes = [...new Set(summary.map((r) => r.class_name || NONE))].sort((a, b) => (a === NONE ? 1 : b === NONE ? -1 : a.localeCompare(b, "vi")));
  const [cls, setCls] = useState(defaultClass !== ALL && classes.includes(defaultClass) ? defaultClass : classes[0] || NONE);
  const inClass = summary.filter((r) => (r.class_name || NONE) === cls);
  const countOf = (t) => inClass.filter((r) => r.exam_type === t).reduce((a, r) => a + r.n, 0);
  const [type, setType] = useState(countOf("ielts") || !countOf("aptis") ? "ielts" : "aptis");
  const banks = inClass.filter((r) => r.exam_type === type && r.bank_id);
  const [bank, setBank] = useState("");
  useEffect(() => { setBank(""); }, [cls, type]);
  useEffect(() => {
    if (!countOf(type)) setType(type === "ielts" ? "aptis" : "ielts");
  }, [cls]); // eslint-disable-line react-hooks/exhaustive-deps
  const count = bank ? banks.filter((b) => b.bank_id === bank).reduce((a, r) => a + r.n, 0) : countOf(type);
  const href = `/api/teacher/export?class=${encodeURIComponent(cls)}&type=${type}${bank ? `&bank=${encodeURIComponent(bank)}` : ""}`;

  return (
    <div className="card stack" style={{ marginBottom: 16 }}>
      <p className="mono muted" style={{ fontSize: 12, margin: 0 }}>XUẤT EXCEL KẾT QUẢ CẢ LỚP</p>
      <div className="export-panel">
        <label>Lớp
          <select value={cls} onChange={(e) => setCls(e.target.value)}>
            {classes.map((c) => <option key={c} value={c}>{c === NONE ? "Chưa phân lớp" : c}</option>)}
          </select>
        </label>
        <label>Loại bài
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="ielts">IELTS ({countOf("ielts")} bài)</option>
            <option value="aptis">Aptis ({countOf("aptis")} bài)</option>
          </select>
        </label>
        <label>Bài thi
          <select value={bank} onChange={(e) => setBank(e.target.value)}>
            <option value="">Tất cả bài thi (mỗi bài 1 sheet)</option>
            {banks.map((b) => <option key={b.bank_id} value={b.bank_id}>{b.bank_name || "(bộ đề đã xoá)"} ({b.n})</option>)}
          </select>
        </label>
        {count > 0 ? (
          <a href={href}><button className="btn btn-sm">⬇ Tải Excel ({count} bài)</button></a>
        ) : (
          <button className="btn btn-sm" disabled>Không có bài nào</button>
        )}
        <button className="btn-ghost btn-sm" onClick={onClose}>Đóng</button>
      </div>
    </div>
  );
}

const STATUS_TABS = [
  ["all", "Tất cả"],
  ["todo", "Chưa chấm"],
  ["done", "Đã chấm"],
  ["flag", "⚠ Giám sát"],
];
const matchStatus = (r, st) =>
  st === "all" ? true : st === "todo" ? needsGrading(r) : st === "done" ? !needsGrading(r) : Boolean(r.integrity && r.integrity.level !== "normal");

export default function SubmissionsBoard({ rows, total, cls, q, limit, summary, allSessions, classNames }) {
  const router = useRouter();
  const [search, setSearch] = useState(q);
  const [selected, setSelected] = useState(() => new Set());
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [open, setOpen] = useState(() => new Set());
  const [status, setStatus] = useState("all");

  useEffect(() => { setSearch(q); }, [q]);
  useEffect(() => {
    setSelected((prev) => new Set([...prev].filter((id) => rows.some((r) => r.id === id))));
  }, [rows]);

  const go = (params) => {
    const u = new URLSearchParams();
    const next = { class: cls, q, ...params };
    if (next.class && next.class !== ALL) u.set("class", next.class);
    if (next.q) u.set("q", next.q);
    if (next.n) u.set("n", String(next.n));
    router.push(`/teacher${u.toString() ? `?${u}` : ""}`);
  };

  const classCounts = useMemo(() => {
    const m = new Map();
    for (const r of summary) {
      const k = r.class_name || NONE;
      const v = m.get(k) || { n: 0, ungraded: 0 };
      v.n += r.n; v.ungraded += r.ungraded;
      m.set(k, v);
    }
    return m;
  }, [summary]);
  const classList = [...classCounts.keys()].filter((k) => k !== NONE).sort((a, b) => a.localeCompare(b, "vi"));
  const suggestions = [...new Set([...classNames, ...classList])].sort((a, b) => a.localeCompare(b, "vi"));

  const shown = useMemo(() => rows.filter((r) => matchStatus(r, status)), [rows, status]);
  const tabCount = (st) => rows.filter((r) => matchStatus(r, st)).length;

  // One class → group by student (same name ignoring case / extra spaces).
  const students = useMemo(() => {
    if (cls === ALL) return [];
    const m = new Map();
    for (const r of shown) {
      if (!m.has(r.student_key)) m.set(r.student_key, { key: r.student_key, name: r.student_name, rows: [] });
      const g = m.get(r.student_key);
      g.rows.push(r);
      // Show the best-written spelling ("Nguyễn Văn An" over "nguyễn văn an").
      const caps = (x) => (x.match(/\p{Lu}/gu) || []).length;
      if (caps(r.student_name.trim()) > caps(g.name.trim())) g.name = r.student_name.trim();
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }, [shown, cls]);

  const onCheck = (id, on) => setSelected((prev) => { const n = new Set(prev); on ? n.add(id) : n.delete(id); return n; });
  const onCheckMany = (ids, on) => setSelected((prev) => { const n = new Set(prev); ids.forEach((id) => (on ? n.add(id) : n.delete(id))); return n; });
  const toggle = (key) => setOpen((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const allOpen = students.length > 0 && students.every((s) => open.has(s.key));

  const fileClass = async (className) => {
    setBusy(true);
    try {
      const res = await fetch("/api/teacher/submissions/class", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selected], className }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Không chuyển được.");
      setSelected(new Set());
      setTarget("");
      router.refresh();
    } catch (e) {
      alert(e.message);
    }
    setBusy(false);
  };

  const listProps = { selected, onCheck, onCheckMany, allSessions, onChanged: () => router.refresh() };

  return (
    <div>
      <div className="class-toolbar">
        <select value={cls} onChange={(e) => go({ class: e.target.value, n: undefined })} aria-label="Lọc theo lớp">
          <option value={ALL}>Tất cả lớp ({[...classCounts.values()].reduce((a, v) => a + v.n, 0)})</option>
          {classList.map((c) => <option key={c} value={c}>Lớp {c} ({classCounts.get(c).n})</option>)}
          <option value={NONE}>Chưa phân lớp ({classCounts.get(NONE)?.n || 0})</option>
        </select>
        <form onSubmit={(e) => { e.preventDefault(); go({ q: search.trim(), n: undefined }); }} className="row" style={{ gap: 6, width: "auto" }}>
          <input type="text" placeholder="Tìm tên học viên…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 200 }} />
          <button className="btn-ghost btn-sm" type="submit">Tìm</button>
          {q && <button className="btn-ghost btn-sm" type="button" onClick={() => go({ q: "", n: undefined })}>✕</button>}
        </form>
        <button className="btn-ghost btn-sm" onClick={() => setShowExport((v) => !v)}>⬇ Xuất Excel</button>
        {cls !== ALL && <a href={`/teacher/stats?class=${encodeURIComponent(cls)}`}><button className="btn-ghost btn-sm">📊 Thống kê lớp này</button></a>}
      </div>

      {showExport && <ExportPanel summary={summary} defaultClass={cls} onClose={() => setShowExport(false)} />}

      {rows.length > 0 && (
        <div className="seg-tabs" role="tablist" aria-label="Lọc theo trạng thái">
          {STATUS_TABS.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={status === k} className={status === k ? "on" : ""} onClick={() => setStatus(k)}>
              {label} <span className="seg-n">{tabCount(k)}</span>
            </button>
          ))}
          {cls !== ALL && students.length > 0 && (
            <button className="seg-extra" onClick={() => setOpen(allOpen ? new Set() : new Set(students.map((s) => s.key)))}>
              {allOpen ? "Thu gọn tất cả" : "Mở tất cả"}
            </button>
          )}
        </div>
      )}

      {selected.size > 0 && (
        <div className="bulk-bar">
          <b>Đã chọn {selected.size} bài</b>
          <input type="text" list="class-suggestions" placeholder="Tên lớp, vd FL4" value={target} onChange={(e) => setTarget(e.target.value)} />
          <datalist id="class-suggestions">{suggestions.map((c) => <option key={c} value={c} />)}</datalist>
          <button className="btn btn-sm" disabled={busy || !target.trim()} onClick={() => fileClass(target.trim())}>Chuyển vào lớp</button>
          <button className="btn-ghost btn-sm" disabled={busy} onClick={() => fileClass("")}>Bỏ khỏi lớp</button>
          <button className="btn-ghost btn-sm" disabled={busy} onClick={() => fileClass(null)} title="Lấy lại lớp học viên đã nhập / lớp của link">Theo lớp tự động</button>
          <button className="btn-ghost btn-sm" onClick={() => setSelected(new Set())}>Bỏ chọn</button>
        </div>
      )}

      {rows.length === 0 && <div className="card"><p className="muted">Không có bài nộp nào{q ? ` khớp "${q}"` : ""}.</p></div>}
      {rows.length > 0 && shown.length === 0 && <div className="card"><p className="muted">Không có bài nào ở mục này.</p></div>}

      {cls === ALL && shown.length > 0 && (
        <>
          <p className="mono muted" style={{ fontSize: 12, margin: "0 0 6px" }}>Mới nhất — đang hiện {rows.length}/{total} bài{q ? ` khớp "${q}"` : ""}. Chọn một lớp ở trên để xem theo từng học viên.</p>
          <SubList rows={shown} showName {...listProps} />
        </>
      )}
      {cls === ALL && rows.length > 0 && rows.length < total && (
        <div style={{ textAlign: "center", margin: "14px 0" }}>
          <button className="btn-ghost" onClick={() => go({ n: limit + 50 })}>Xem thêm 50 bài</button>
        </div>
      )}

      {cls !== ALL && students.map((st) => {
        const pending = st.rows.filter(needsGrading).length;
        const flagged = st.rows.some((r) => r.integrity && r.integrity.level !== "normal");
        const isOpen = open.has(st.key) || students.length <= 3;
        return (
          <div key={st.key} style={{ marginBottom: 10 }}>
            <button type="button" className="folder-header student-head" onClick={() => toggle(st.key)} aria-expanded={isOpen}>
              <span className="row" style={{ gap: 10, width: "auto" }}>
                <span className="folder-icon">{isOpen ? "▾" : "▸"}</span>
                <b>{st.name}</b>
                {flagged && <span className="integrity-pill medium" title="Có bài cần lưu ý về giám sát">⚠</span>}
              </span>
              <span className="row" style={{ gap: 8, width: "auto" }}>
                <span className="mono muted" style={{ fontSize: 13 }}>{st.rows.length} bài</span>
                {pending > 0 ? <span className="state-chip todo">{pending} chưa chấm</span> : <span className="state-chip done">Đã chấm hết</span>}
              </span>
            </button>
            {isOpen && <SubList rows={st.rows} showName={false} {...listProps} />}
          </div>
        );
      })}
    </div>
  );
}
