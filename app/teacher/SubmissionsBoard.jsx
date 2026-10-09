"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DeleteButton from "./DeleteButton";
import { formatVN } from "@/lib/formatDate";
import { aptisScaleFromRaw, aptisCefr } from "@/lib/grading";
import { INTEGRITY_LABEL } from "@/lib/integrity";

// Filtering, search and "load more" happen on the server (URL params
// class / q / n) — the board only ever holds what is on screen.
//   - "Tất cả lớp": newest submissions, 50 at a time.
//   - one class: every submission of that class, grouped by student.

const SKILL_LABEL = { grammar: "NP", reading: "R", listening: "L", writing: "W" };
const ALL = "__all__";
const NONE = "__none__";

function MoveMenu({ row, allSessions, onMoved }) {
  const [open, setOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const move = async (sessionId) => {
    setMoving(true);
    setOpen(false);
    try {
      await fetch(`/api/submissions/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "moveSession", sessionId: sessionId || null }),
      });
      onMoved();
    } catch {
      alert("Không chuyển được — thử lại.");
    }
    setMoving(false);
  };
  return (
    <div style={{ position: "relative" }}>
      <button className="btn-ghost btn-sm" disabled={moving} onClick={() => setOpen((v) => !v)} title="Gắn bài vào link thi khác">
        {moving ? "…" : "Link"}
      </button>
      {open && (
        <div className="card" style={{ position: "absolute", right: 0, top: "110%", zIndex: 20, minWidth: 220, padding: 8, margin: 0 }}>
          <button className="btn-ghost btn-sm" style={{ width: "100%", textAlign: "left", marginBottom: 4 }} onClick={() => move(null)}>Không thuộc link nào</button>
          {allSessions.map((s) => (
            <button key={s.id} className="btn-ghost btn-sm" style={{ width: "100%", textAlign: "left", marginBottom: 4 }} onClick={() => move(s.id)}>{s.name}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function autoScore(r) {
  if (!r.aptis) return r.objective_band !== null ? r.objective_band.toFixed(1) : "—";
  const skills = r.skills_included || [];
  const parts = [];
  if (skills.includes("listening")) parts.push(`L ${aptisScaleFromRaw(r.listening[0], r.listening[1]) ?? "—"}`);
  if (skills.includes("reading")) parts.push(`R ${aptisScaleFromRaw(r.reading[0], r.reading[1]) ?? "—"}`);
  return parts.join(" · ") || "—";
}

function finalScore(r) {
  if (!r.graded) return "—";
  if (r.aptis) return r.aptis_writing !== null ? `W ${r.aptis_writing}/50 · ${aptisCefr("writing", r.aptis_writing)}` : "—";
  return r.final_band !== null ? r.final_band.toFixed(1) : "—";
}

function IntegrityFlag({ summary }) {
  if (!summary || summary.level === "normal") return null;
  return <span className={`integrity-pill ${summary.level}`} title={`Giám sát: ${INTEGRITY_LABEL[summary.level]}`}>⚠</span>;
}

function Row({ row, allSessions, onMoved, checked, onCheck, showName }) {
  const skills = Array.isArray(row.skills_included) ? row.skills_included : ["grammar", "reading", "listening", "writing"];
  return (
    <tr className={checked ? "row-checked" : ""}>
      <td><input type="checkbox" checked={checked} onChange={(e) => onCheck(row.id, e.target.checked)} aria-label={`Chọn ${row.student_name}`} /></td>
      {showName && <td className="subs-name">{row.student_name}</td>}
      <td>{row.class_name ? <span className="class-pill">{row.class_name}</span> : <span className="muted">—</span>}</td>
      <td><span className={`type-pill ${row.aptis ? "aptis" : ""}`}>{row.aptis ? "APTIS" : "IELTS"}</span></td>
      <td className="muted" style={{ fontSize: 13 }}>{row.bank_name || "—"}</td>
      <td className="mono muted">{skills.map((s) => SKILL_LABEL[s] || s).join(", ")}</td>
      <td className="mono muted">{formatVN(row.created_at)}</td>
      <td className="mono">{autoScore(row)}</td>
      <td>{row.graded ? <span className="success">Đã chấm</span> : <span className="accent">Chưa chấm</span>}</td>
      <td className="mono">{finalScore(row)}</td>
      <td><IntegrityFlag summary={row.integrity} /></td>
      <td><Link href={`/teacher/${row.id}`}><button className="btn-ghost btn-sm">Chấm →</button></Link></td>
      <td><a href={`/teacher/${row.id}/phieu`} target="_blank" rel="noreferrer"><button className="btn-ghost btn-sm" title="Phiếu kết quả (in / PDF)">Phiếu</button></a></td>
      <td><MoveMenu row={row} allSessions={allSessions} onMoved={onMoved} /></td>
      <td><DeleteButton id={row.id} studentName={row.student_name} /></td>
    </tr>
  );
}

function Table({ rows, showName, selected, onCheck, onCheckMany, allSessions, onMoved }) {
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  return (
    <div className="card" style={{ padding: 0, overflowX: "auto", marginTop: 8 }}>
      <table className="subs-table">
        <thead>
          <tr>
            <th><input type="checkbox" checked={allChecked} onChange={(e) => onCheckMany(rows.map((r) => r.id), e.target.checked)} aria-label="Chọn tất cả" /></th>
            {showName && <th>Học viên</th>}
            <th>Lớp</th><th>Loại</th><th>Bài thi</th><th>Kỹ năng</th><th>Thời gian</th>
            <th>Điểm tự động</th><th>Trạng thái</th><th>Kết quả</th><th title="Giám sát làm bài">GS</th>
            <th></th><th></th><th></th><th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <Row key={r.id} row={r} showName={showName} allSessions={allSessions} onMoved={onMoved} checked={selected.has(r.id)} onCheck={onCheck} />
          ))}
        </tbody>
      </table>
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

export default function SubmissionsBoard({ rows, total, cls, q, limit, summary, allSessions, classNames }) {
  const router = useRouter();
  const [search, setSearch] = useState(q);
  const [selected, setSelected] = useState(() => new Set());
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [open, setOpen] = useState(() => new Set());

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

  // One class → group by student (same name ignoring case / extra spaces).
  const students = useMemo(() => {
    if (cls === ALL) return [];
    const m = new Map();
    for (const r of rows) {
      if (!m.has(r.student_key)) m.set(r.student_key, { key: r.student_key, name: r.student_name, rows: [] });
      const g = m.get(r.student_key);
      g.rows.push(r);
      // Show the best-written spelling ("Nguyễn Văn An" over "nguyễn văn an").
      const caps = (x) => (x.match(/\p{Lu}/gu) || []).length;
      if (caps(r.student_name.trim()) > caps(g.name.trim())) g.name = r.student_name.trim();
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }, [rows, cls]);

  const onCheck = (id, on) => setSelected((prev) => { const n = new Set(prev); on ? n.add(id) : n.delete(id); return n; });
  const onCheckMany = (ids, on) => setSelected((prev) => { const n = new Set(prev); ids.forEach((id) => (on ? n.add(id) : n.delete(id))); return n; });
  const toggle = (key) => setOpen((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

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

  const tableProps = { selected, onCheck, onCheckMany, allSessions, onMoved: () => router.refresh() };

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

      {cls === ALL && rows.length > 0 && (
        <>
          <p className="mono muted" style={{ fontSize: 12, margin: "0 0 4px" }}>Mới nhất — đang hiện {rows.length}/{total} bài{q ? ` khớp "${q}"` : ""}. Chọn một lớp ở trên để xem theo từng học viên.</p>
          <Table rows={rows} showName {...tableProps} />
          {rows.length < total && (
            <div style={{ textAlign: "center", margin: "14px 0" }}>
              <button className="btn-ghost" onClick={() => go({ n: limit + 50 })}>Xem thêm 50 bài</button>
            </div>
          )}
        </>
      )}

      {cls !== ALL && students.map((st) => {
        const pending = st.rows.filter((r) => !r.graded).length;
        const flagged = st.rows.some((r) => r.integrity && r.integrity.level !== "normal");
        const isOpen = open.has(st.key) || students.length <= 3;
        return (
          <div key={st.key} style={{ marginBottom: 12 }}>
            <div className="folder-header" onClick={() => toggle(st.key)}>
              <div className="row" style={{ gap: 10, width: "auto" }}>
                <span className="folder-icon">{isOpen ? "▾" : "▸"} 👤</span>
                <p style={{ margin: 0, fontWeight: 700 }}>{st.name}</p>
                {flagged && <span className="integrity-pill medium" title="Có bài cần lưu ý về giám sát">⚠</span>}
              </div>
              <p className="mono muted" style={{ fontSize: 13, margin: 0 }}>
                {st.rows.length} bài — {pending > 0 ? <span className="accent">{pending} chưa chấm</span> : "đã chấm hết"}
              </p>
            </div>
            {isOpen && <Table rows={st.rows} showName={false} {...tableProps} />}
          </div>
        );
      })}
    </div>
  );
}
