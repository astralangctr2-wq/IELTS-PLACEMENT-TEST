"use client";

import { useRef, useState } from "react";

// One row per student: scores from the test / the teachers, TOTAL
// suggested, Level from the link. Typing saves by itself; Enter goes down
// a row; pasting a column from Excel fills the rows below.

const when = (iso) => (iso ? new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }) : "");
const HEAD = { listening: "Nghe", reading: "Đọc", writing: "Viết", speaking: "Nói" };

function statusOf(r) {
  if ((r.level || "").trim() && (r.total || "").trim()) return "done";
  if (r.handIn === "all" || r.handIn === "none") return "wait";
  return "teacher";
}
const ST = { wait: "Chờ admin", teacher: "GV chưa nộp", done: "Đã xong" };

export default function QuickTable({ rows: initialRows, cls }) {
  const [rows, setRows] = useState(initialRows);
  const [saved, setSaved] = useState(() => Object.fromEntries(initialRows.map((r) => [r.id, { level: r.level, total: r.total }])));
  const [state, setState] = useState({}); // id → saving | saved | error
  const [tab, setTab] = useState("all");
  const timers = useRef({});
  const refs = useRef({});

  const save = async (id, patch) => {
    const base = saved[id] || {};
    setState((s) => ({ ...s, [id]: "saving" }));
    try {
      const res = await fetch(`/api/teacher/report/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...patch, base }) });
      if (!res.ok) throw new Error();
      setSaved((s) => ({ ...s, [id]: { ...s[id], ...patch } }));
      setState((s) => ({ ...s, [id]: "saved" }));
    } catch {
      setState((s) => ({ ...s, [id]: "error" }));
    }
  };
  const set = (id, k, v) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [k]: v } : r)));
    clearTimeout(timers.current[id + k]);
    timers.current[id + k] = setTimeout(() => save(id, { [k]: v }), 700);
  };
  const shown = rows.filter((r) => tab === "all" || statusOf(r) === tab);
  const move = (i, k) => refs.current[`${shown[i]?.id}|${k}`]?.focus();
  const onKey = (i, k) => (e) => {
    if (e.key === "Enter" || e.key === "ArrowDown") { e.preventDefault(); move(i + 1, k); }
    if (e.key === "ArrowUp") { e.preventDefault(); move(i - 1, k); }
  };
  // A column pasted from Excel / Sheets: one value per row from here down.
  const onPaste = (i, k) => (e) => {
    const lines = e.clipboardData.getData("text").replace(/\r/g, "").split("\n").filter((l, j, a) => l !== "" || j < a.length - 1);
    if (lines.length < 2) return;
    e.preventDefault();
    lines.forEach((v, j) => { const r = shown[i + j]; if (r) set(r.id, k, v.split("\t")[0].trim()); });
  };
  const fillSuggest = () => rows.forEach((r) => { if (!(r.total || "").trim() && r.suggest) set(r.id, "total", r.suggest); });
  const count = (t) => rows.filter((r) => t === "all" || statusOf(r) === t).length;
  const first = rows[0];

  if (!rows.length) return <div className="card"><p className="muted" style={{ margin: 0 }}>Không có bài nào của lớp {cls} cho bài thi này.</p></div>;

  return (
    <div className="stack">
      <div className="quick-bar">
        <div className="seg-tabs" role="tablist">
          {[["all", "Tất cả"], ["wait", "Chờ admin"], ["teacher", "GV chưa nộp"], ["done", "Đã xong"]].map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l} <span className="seg-n">{count(k)}</span></button>
          ))}
        </div>
        <span className="sess-spacer" />
        <button className="btn-ghost btn-sm" onClick={fillSuggest} title="Chỉ điền vào ô TOTAL còn trống">Điền TOTAL gợi ý cho ô trống</button>
        {first && <a href={`/api/teacher/report/${first.id}/docx?all=1`}><button className="btn btn-sm">⬇ Word cả lớp</button></a>}
      </div>
      <div className="quick-wrap">
        <table className="quick-table">
          <thead>
            <tr>
              <th>Học viên</th>
              {["listening", "reading", "writing", "speaking"].map((k) => <th key={k}>{HEAD[k]}{first?.aptis ? " /50" : ""}</th>)}
              <th>TOTAL{first?.aptis ? " /200" : ""}</th>
              <th>Level</th>
              <th>GV nộp</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => {
              const st = statusOf(r);
              return (
                <tr key={r.id} className={`q-${st}`}>
                  <td><b>{r.name}</b>{r.teachers && <div className="muted q-sub">{r.teachers}</div>}</td>
                  {r.skills.map((s) => (
                    <td key={s.k} className="q-num">
                      {s.v === null || s.v === undefined || s.v === "" ? <span className="muted">–</span> : s.v}
                      {s.sub && <div className="q-sub">{s.sub}{s.near ? <span className="q-near" title="Sát mốc — admin có thể nâng trên phiếu"> ↑{s.near}?</span> : ""}</div>}
                    </td>
                  ))}
                  <td>
                    <input ref={(el) => (refs.current[`${r.id}|total`] = el)} className="q-inp" value={r.total} placeholder={r.suggest || "–"} onChange={(e) => set(r.id, "total", e.target.value)} onKeyDown={onKey(i, "total")} onPaste={onPaste(i, "total")} aria-label={`TOTAL ${r.name}`} />
                    {r.overall && <div className="q-sub">CEFR {r.overall}</div>}
                  </td>
                  <td><input ref={(el) => (refs.current[`${r.id}|level`] = el)} className="q-inp wide" value={r.level} placeholder="Level" onChange={(e) => set(r.id, "level", e.target.value)} onKeyDown={onKey(i, "level")} onPaste={onPaste(i, "level")} aria-label={`Level ${r.name}`} /></td>
                  <td className="q-hand">
                    <span className={`q-chip ${st}`}>{ST[st]}</span>
                    <div className="q-sub">{r.handIn === "none" ? "chưa có GV" : r.handIn === "all" ? `nộp ${when(r.lastDone)}` : r.handIn === "some" ? `${r.doneParts}/${r.parts} GV đã nộp` : "chưa nộp"}</div>
                  </td>
                  <td>
                    <div className="q-act">
                      <span className={`q-save ${state[r.id] || ""}`}>{state[r.id] === "saving" ? "Đang lưu…" : state[r.id] === "saved" ? "✓" : state[r.id] === "error" ? "Lỗi — gõ lại" : ""}</span>
                      <a href={`/teacher/${r.id}/phieu`} target="_blank" rel="noreferrer">Phiếu ↗</a>
                      <a href={`/api/teacher/report/${r.id}/docx`}>Word</a>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>Enter / ↓ xuống dòng · dán cả cột từ Excel vào ô đầu tiên · ô TOTAL trống thì phiếu dùng số gợi ý (IELTS: trung bình các kỹ năng, làm tròn 0.5; Aptis: tổng 4 kỹ năng).</p>
    </div>
  );
}
