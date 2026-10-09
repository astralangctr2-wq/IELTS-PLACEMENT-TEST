"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DeleteButton from "./DeleteButton";
import { formatVN } from "@/lib/formatDate";
import { aptisScaleFromRaw, aptisCefr } from "@/lib/grading";

const SKILL_LABEL = { grammar: "NP", reading: "R", listening: "L", writing: "W" };
const ALL = "__all__";
const NONE = "__none__";
const classKey = (r) => r.class_name || NONE;

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
    } catch (e) {
      alert("Không chuyển được — thử lại.");
    }
    setMoving(false);
  };

  return (
    <div style={{ position: "relative" }}>
      <button className="btn-ghost btn-sm" disabled={moving} onClick={() => setOpen((v) => !v)} title="Chuyển sang thư mục link thi khác">
        {moving ? "…" : "Chuyển"}
      </button>
      {open && (
        <div className="card" style={{ position: "absolute", right: 0, top: "110%", zIndex: 20, minWidth: 220, padding: 8, margin: 0 }}>
          <button className="btn-ghost btn-sm" style={{ width: "100%", textAlign: "left", marginBottom: 4 }} onClick={() => move(null)}>Chưa phân loại</button>
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
  const parts = [];
  const skills = r.skills_included || [];
  if (skills.includes("listening")) parts.push(`L ${aptisScaleFromRaw(r.listening[0], r.listening[1]) ?? "—"}`);
  if (skills.includes("reading")) parts.push(`R ${aptisScaleFromRaw(r.reading[0], r.reading[1]) ?? "—"}`);
  return parts.join(" · ") || "—";
}

function finalScore(r) {
  if (!r.graded) return "—";
  if (r.aptis) return r.aptis_writing !== null ? `W ${r.aptis_writing}/50 · ${aptisCefr("writing", r.aptis_writing)}` : "—";
  return r.final_band !== null ? r.final_band.toFixed(1) : "—";
}

function SubmissionRow({ row, allSessions, onMoved, checked, onCheck }) {
  const skills = Array.isArray(row.skills_included) ? row.skills_included : ["grammar", "reading", "listening", "writing"];
  return (
    <tr className={checked ? "row-checked" : ""}>
      <td><input type="checkbox" checked={checked} onChange={(e) => onCheck(row.id, e.target.checked)} aria-label={`Chọn ${row.student_name}`} /></td>
      <td className="subs-name">{row.student_name}</td>
      <td>{row.class_name ? <span className="class-pill">{row.class_name}</span> : <span className="muted">—</span>}</td>
      <td><span className={`type-pill ${row.aptis ? "aptis" : ""}`}>{row.aptis ? "APTIS" : "IELTS"}</span></td>
      <td className="mono muted">{skills.map((s) => SKILL_LABEL[s] || s).join(", ")}</td>
      <td className="mono muted">{formatVN(row.created_at)}</td>
      <td className="mono">{autoScore(row)}</td>
      <td>{row.writing_word_count}</td>
      <td>{row.graded ? <span className="success">Đã chấm</span> : <span className="accent">Chưa chấm</span>}</td>
      <td className="mono">{finalScore(row)}</td>
      <td><Link href={`/teacher/${row.id}`}><button className="btn-ghost btn-sm">Chấm →</button></Link></td>
      <td><a href={`/teacher/${row.id}/phieu`} target="_blank" rel="noreferrer"><button className="btn-ghost btn-sm" title="Phiếu kết quả (in / PDF)">Phiếu</button></a></td>
      <td><MoveMenu row={row} allSessions={allSessions} onMoved={onMoved} /></td>
      <td><DeleteButton id={row.id} studentName={row.student_name} /></td>
    </tr>
  );
}

function FolderGroup({ group, allSessions, expanded, onToggle, onMoved, selected, onCheck, onCheckMany }) {
  const pending = group.rows.filter((r) => !r.graded).length;
  const allChecked = group.rows.every((r) => selected.has(r.id));
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="folder-header" onClick={onToggle}>
        <div className="row" style={{ gap: 10, width: "auto" }}>
          <span className="folder-icon">{expanded ? "▾" : "▸"} 📁</span>
          <p style={{ margin: 0, fontWeight: 700 }}>{group.name}</p>
          {group.className && <span className="class-pill">Lớp {group.className}</span>}
        </div>
        <p className="mono muted" style={{ fontSize: 13, margin: 0 }}>
          {group.rows.length} bài — {pending > 0 ? <span className="accent">{pending} chưa chấm</span> : "đã chấm hết"}
        </p>
      </div>
      {expanded && (
        <div className="card" style={{ padding: 0, overflowX: "auto", marginTop: 8 }}>
          <table className="subs-table">
            <thead>
              <tr>
                <th><input type="checkbox" checked={allChecked} onChange={(e) => onCheckMany(group.rows.map((r) => r.id), e.target.checked)} aria-label="Chọn cả thư mục" /></th>
                <th>Học viên</th>
                <th>Lớp</th>
                <th>Loại</th>
                <th>Kỹ năng</th>
                <th>Thời gian</th>
                <th>Điểm tự động</th>
                <th>Số từ</th>
                <th>Trạng thái</th>
                <th>Kết quả</th>
                <th></th><th></th><th></th><th></th>
              </tr>
            </thead>
            <tbody>
              {group.rows.map((r) => (
                <SubmissionRow key={r.id} row={r} allSessions={allSessions} onMoved={onMoved} checked={selected.has(r.id)} onCheck={onCheck} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ExportPanel({ rows, classNames, defaultClass, onClose }) {
  const [cls, setCls] = useState(defaultClass !== ALL ? defaultClass : classNames[0] || NONE);
  const inClass = rows.filter((r) => classKey(r) === cls);
  const hasIelts = inClass.some((r) => !r.aptis), hasAptis = inClass.some((r) => r.aptis);
  const [type, setType] = useState(hasIelts || !hasAptis ? "ielts" : "aptis");
  const ofType = inClass.filter((r) => (type === "aptis") === r.aptis);
  const banks = [...new Map(ofType.filter((r) => r.bank_id).map((r) => [r.bank_id, r.bank_name || "(bộ đề đã xoá)"])).entries()];
  const [bank, setBank] = useState("");
  const count = bank ? ofType.filter((r) => r.bank_id === bank).length : ofType.length;

  useEffect(() => { setBank(""); }, [cls, type]);
  useEffect(() => {
    if (type === "ielts" && !hasIelts && hasAptis) setType("aptis");
    if (type === "aptis" && !hasAptis && hasIelts) setType("ielts");
  }, [cls]); // eslint-disable-line react-hooks/exhaustive-deps

  const href = `/api/teacher/export?class=${encodeURIComponent(cls)}&type=${type}${bank ? `&bank=${encodeURIComponent(bank)}` : ""}`;

  return (
    <div className="card stack" style={{ marginBottom: 16 }}>
      <p className="mono muted" style={{ fontSize: 12, margin: 0 }}>XUẤT EXCEL KẾT QUẢ CẢ LỚP</p>
      <div className="export-panel">
        <label>Lớp
          <select value={cls} onChange={(e) => setCls(e.target.value)}>
            {classNames.map((c) => <option key={c} value={c}>{c}</option>)}
            <option value={NONE}>Chưa phân lớp</option>
          </select>
        </label>
        <label>Loại bài
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="ielts">IELTS ({inClass.filter((r) => !r.aptis).length} bài)</option>
            <option value="aptis">Aptis ({inClass.filter((r) => r.aptis).length} bài)</option>
          </select>
        </label>
        <label>Bài thi
          <select value={bank} onChange={(e) => setBank(e.target.value)}>
            <option value="">Tất cả bài thi (mỗi bài 1 sheet)</option>
            {banks.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
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

export default function SubmissionsBoard({ rows, allSessions, classNames }) {
  const router = useRouter();
  const [filter, setFilter] = useState(ALL);
  const [selected, setSelected] = useState(() => new Set());
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [showExport, setShowExport] = useState(false);

  // Drop selections that no longer exist after a refresh.
  useEffect(() => {
    setSelected((prev) => new Set([...prev].filter((id) => rows.some((r) => r.id === id))));
  }, [rows]);

  const counts = useMemo(() => {
    const m = new Map();
    for (const r of rows) m.set(classKey(r), (m.get(classKey(r)) || 0) + 1);
    return m;
  }, [rows]);
  // Filter / export list: only classes that actually have submissions.
  // The typing suggestions also offer classes known from links and banks.
  const classOptions = [...new Set(rows.map((r) => r.class_name).filter(Boolean))].sort((a, b) => a.localeCompare(b, "vi"));
  const classSuggestions = [...new Set([...classNames, ...classOptions])].sort((a, b) => a.localeCompare(b, "vi"));

  const visible = filter === ALL ? rows : rows.filter((r) => classKey(r) === filter);

  const groups = useMemo(() => {
    const map = new Map();
    for (const r of visible) {
      const key = r.session_id && r.session_name ? r.session_id : "__unassigned__";
      if (!map.has(key)) {
        const sess = allSessions.find((s) => s.id === r.session_id);
        map.set(key, { key, name: key === "__unassigned__" ? "Chưa phân loại" : r.session_name, className: sess?.className || null, rows: [] });
      }
      map.get(key).rows.push(r);
    }
    return [...map.values()].sort((a, b) => {
      if (a.key === "__unassigned__") return 1;
      if (b.key === "__unassigned__") return -1;
      return new Date(b.rows[0].created_at) - new Date(a.rows[0].created_at);
    });
  }, [visible, allSessions]);

  const [expanded, setExpanded] = useState(() => new Set(groups.slice(0, 1).map((g) => g.key)));
  useEffect(() => {
    setExpanded(new Set(filter === ALL ? groups.slice(0, 1).map((g) => g.key) : groups.map((g) => g.key)));
  }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (key) => setExpanded((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const onCheck = (id, on) => setSelected((prev) => { const n = new Set(prev); on ? n.add(id) : n.delete(id); return n; });
  const onCheckMany = (ids, on) => setSelected((prev) => { const n = new Set(prev); ids.forEach((id) => (on ? n.add(id) : n.delete(id))); return n; });

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

  return (
    <div>
      <div className="class-toolbar">
        <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Lọc theo lớp">
          <option value={ALL}>Tất cả lớp ({rows.length})</option>
          {classOptions.map((c) => <option key={c} value={c}>Lớp {c} ({counts.get(c) || 0})</option>)}
          <option value={NONE}>Chưa phân lớp ({counts.get(NONE) || 0})</option>
        </select>
        <button className="btn-ghost btn-sm" onClick={() => setShowExport((v) => !v)}>⬇ Xuất Excel</button>
        <span className="mono muted" style={{ fontSize: 12 }}>Tick chọn bài để gom vào lớp. Bài nộp qua link có gán lớp sẽ tự vào lớp đó.</span>
      </div>

      {showExport && <ExportPanel rows={rows} classNames={classOptions} defaultClass={filter} onClose={() => setShowExport(false)} />}

      {selected.size > 0 && (
        <div className="bulk-bar">
          <b>Đã chọn {selected.size} bài</b>
          <input type="text" list="class-suggestions" placeholder="Tên lớp, vd FL4" value={target} onChange={(e) => setTarget(e.target.value)} />
          <datalist id="class-suggestions">{classSuggestions.map((c) => <option key={c} value={c} />)}</datalist>
          <button className="btn btn-sm" disabled={busy || !target.trim()} onClick={() => fileClass(target.trim())}>Chuyển vào lớp</button>
          <button className="btn-ghost btn-sm" disabled={busy} onClick={() => fileClass("")}>Bỏ khỏi lớp</button>
          <button className="btn-ghost btn-sm" disabled={busy} onClick={() => fileClass(null)} title="Lấy lại lớp của link thi">Theo lớp của link</button>
          <button className="btn-ghost btn-sm" onClick={() => setSelected(new Set())}>Bỏ chọn</button>
        </div>
      )}

      {groups.length === 0 && <div className="card"><p className="muted">Không có bài nộp nào trong lớp này.</p></div>}
      {groups.map((g) => (
        <FolderGroup
          key={g.key}
          group={g}
          allSessions={allSessions}
          expanded={expanded.has(g.key)}
          onToggle={() => toggle(g.key)}
          onMoved={() => router.refresh()}
          selected={selected}
          onCheck={onCheck}
          onCheckMany={onCheckMany}
        />
      ))}
    </div>
  );
}
