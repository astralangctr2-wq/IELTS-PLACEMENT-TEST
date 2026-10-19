"use client";

import { useMemo, useState } from "react";
import { vnInputToIso, isoToVnInput, formatVnShort, scheduleState } from "@/lib/vnTime";
import { normalizeClassName } from "@/lib/classNames";

// The exam links already created — one card per link instead of a wide
// table, so nothing scrolls sideways. Search + status tabs on top; the
// everyday action (copy the link) is the first button of every card.

const SKILL_SHORT = { grammar: "Ngữ pháp", reading: "Reading", listening: "Listening", writing: "Writing" };

export function linkStatus(s) {
  if (!s.active) return "off";
  return scheduleState(s.opens_at, s.closes_at); // open | not_yet | closed
}
const STATUS_LABEL = { open: "Đang mở", not_yet: "Chưa đến giờ mở", closed: "Đã hết giờ", off: "Đã tắt" };
const TABS = [
  ["all", "Tất cả"],
  ["open", "Đang mở"],
  ["not_yet", "Chưa mở"],
  ["ended", "Đã đóng / tắt"],
];
const TIMED = ["grammar", "reading", "writing"];
// "Ngữ pháp 40′ · Reading 60′ · Listening nghe 2 lần · Writing 60′"
function timeSummary(s) {
  const t = s.time_limits || {};
  const parts = (s.skills || []).map((k) => {
    if (k === "listening") return `Listening nghe ${t.listeningPlays || 1} lần`;
    return t[k] ? `${SKILL_SHORT[k]} ${t[k]} phút` : `${SKILL_SHORT[k]} không giới hạn`;
  });
  return parts.join(" · ") || "—";
}
const inTab = (st, tab) => tab === "all" || (tab === "ended" ? st === "closed" || st === "off" : st === tab);

export default function SessionList({ sessions, setSessions, bankName, classOptions = [], teacherMode = false }) {
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(null);
  const [editing, setEditing] = useState(null); // { id, opensAt, closesAt }
  const [classEdit, setClassEdit] = useState(null); // { id, value }
  const [confirmDel, setConfirmDel] = useState(null);
  const [timeEdit, setTimeEdit] = useState(null); // { id, grammar, reading, writing, listeningPlays }
  const [drafts, setDrafts] = useState(null); // { id, rows | null (loading) | "error" }
  // Students who started this link and have not submitted yet (autosave).
  const showDrafts = async (id) => {
    if (drafts?.id === id) { setDrafts(null); return; }
    setDrafts({ id, rows: null });
    try {
      const res = await fetch(`/api/teacher/drafts?session=${encodeURIComponent(id)}`, { cache: "no-store" });
      const j = await res.json();
      setDrafts({ id, rows: res.ok ? j.rows || [] : "error" });
    } catch { setDrafts({ id, rows: "error" }); }
  };
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const withStatus = useMemo(() => sessions.map((s) => ({ ...s, _st: linkStatus(s) })), [sessions]);
  const needle = query.trim().toLowerCase();
  const shown = withStatus.filter((s) => inTab(s._st, tab) && (!needle
    || `${s.name} ${s.class_name || ""} ${bankName(s.content_bank_id)}`.toLowerCase().includes(needle)));
  const count = (t) => withStatus.filter((s) => inTab(s._st, t)).length;

  const patch = (id, body) => fetch(`/api/teacher/sessions/${id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const copy = async (s) => {
    const link = `${origin}/test/s/${s.id}`;
    try { await navigator.clipboard.writeText(link); } catch { window.prompt("Copy link này:", link); }
    setCopied(s.id);
    setTimeout(() => setCopied((c) => (c === s.id ? null : c)), 2000);
  };
  // Opening window: only limits who can OPEN the link. Students already
  // inside keep going until their own time limit forces the submission.
  const saveSchedule = async (id, opensIso, closesIso) => {
    await patch(id, { opensAt: opensIso, closesAt: closesIso });
    setSessions((prev) => prev.map((x) => (x.id === id ? { ...x, opens_at: opensIso, closes_at: closesIso } : x)));
    setEditing(null);
  };
  const extend = (s, minutes) => {
    const base = Math.max(Date.now(), s.closes_at ? new Date(s.closes_at).getTime() : Date.now());
    saveSchedule(s.id, s.opens_at || null, new Date(base + minutes * 60000).toISOString());
  };
  const saveClass = async (s, value) => {
    const res = await patch(s.id, { className: value });
    if (!res.ok) { alert((await res.json().catch(() => ({}))).error || "Không đổi được lớp."); return; }
    setSessions((prev) => prev.map((x) => (x.id === s.id ? { ...x, class_name: normalizeClassName(value) || null } : x)));
    setClassEdit(null);
  };
  const saveTimes = async (s) => {
    const { grammar, reading, writing, listeningPlays } = timeEdit;
    const res = await patch(s.id, { timeLimits: { grammar, reading, writing }, listeningPlays });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { alert(d.error || "Không lưu được."); return; }
    setSessions((prev) => prev.map((x) => (x.id === s.id ? { ...x, time_limits: d.timeLimits } : x)));
    setTimeEdit(null);
  };
  const toggleSurvey = async (s) => {
    const on = !(s.time_limits?.survey === true);
    await patch(s.id, { survey: on });
    setSessions((prev) => prev.map((x) => (x.id === s.id ? { ...x, time_limits: { ...(x.time_limits || {}), survey: on } } : x)));
  };
  const toggleActive = async (s) => {
    await patch(s.id, { active: !s.active });
    setSessions((prev) => prev.map((x) => (x.id === s.id ? { ...x, active: !s.active } : x)));
  };
  const remove = async (id) => {
    await fetch(`/api/teacher/sessions/${id}`, { method: "DELETE" });
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setConfirmDel(null);
  };

  return (
    <div className="sess-wrap">
      <div className="sess-toolbar">
        <p className="mono muted" style={{ fontSize: 12, margin: 0 }}>CÁC LINK THI ĐÃ TẠO ({sessions.length})</p>
        <input type="text" placeholder="Tìm theo tên, lớp, bộ đề…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Tìm link thi" />
      </div>
      <div className="seg-tabs" role="tablist" aria-label="Lọc link theo trạng thái">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
            {label} <span className="seg-n">{count(k)}</span>
          </button>
        ))}
      </div>

      {sessions.length === 0 && <div className="card"><p className="muted" style={{ margin: 0 }}>Chưa có link thi nào. Tạo link đầu tiên ở khung phía trên.</p></div>}
      {sessions.length > 0 && shown.length === 0 && <div className="card"><p className="muted" style={{ margin: 0 }}>Không có link nào khớp.</p></div>}

      <div className="sess-list">
        {shown.map((s) => {
          const cls = normalizeClassName(s.class_name);
          const legacyPractice = s.time_limits?.mode === "practice";
          return (
            <div key={s.id} className={`sess-card st-${s._st}`}>
              <div className="sess-head">
                <div className="sess-title">
                  <b>{s.name}</b>
                  <span className="mono muted sess-id">/test/s/{s.id}</span>
                </div>
                <span className={`state-chip ${s._st === "open" ? "done" : s._st === "not_yet" ? "wait" : "off"}`}>{STATUS_LABEL[s._st]}</span>
              </div>

              <div className="sess-meta">
                {classEdit?.id === s.id ? (
                  <span className="sess-inline">
                    {teacherMode ? (
                      <select value={classEdit.value} onChange={(e) => setClassEdit({ id: s.id, value: e.target.value })}>
                        {classOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    ) : (
                      <input type="text" list="sess-class-opts" value={classEdit.value} placeholder="VD: FL4 (trống = không gán)" onChange={(e) => setClassEdit({ id: s.id, value: e.target.value })} />
                    )}
                    <datalist id="sess-class-opts">{classOptions.map((c) => <option key={c} value={c} />)}</datalist>
                    <button className="btn btn-xs" onClick={() => saveClass(s, classEdit.value)}>Lưu</button>
                    <button className="btn-ghost btn-xs" onClick={() => setClassEdit(null)}>Huỷ</button>
                  </span>
                ) : (
                  <button className="meta-chip editable" title="Đổi lớp của link" onClick={() => setClassEdit({ id: s.id, value: cls || (teacherMode ? classOptions[0] || "" : "") })}>
                    Lớp <b>{cls || "chưa gán"}</b> ✎
                  </button>
                )}
                <span className="meta-chip">Đề <b>{bankName(s.content_bank_id)}</b></span>
                <span className="meta-chip">{(s.skills || []).map((sk) => SKILL_SHORT[sk] || sk).join(" · ")}</span>
                <button className={`meta-chip editable ${s.time_limits?.survey ? "on" : ""}`} title="Bật/tắt khảo sát góp ý hiện ra sau khi học viên nộp bài" onClick={() => toggleSurvey(s)}>
                  📝 Khảo sát <b>{s.time_limits?.survey ? "Bật" : "Tắt"}</b>
                </button>
                {legacyPractice && <span className="meta-chip">Luyện tập (cũ)</span>}
              </div>

              {!legacyPractice && (timeEdit?.id === s.id ? (
                <div className="sess-sched-edit">
                  {TIMED.filter((k) => (s.skills || []).includes(k)).map((k) => (
                    <label key={k} className="sched-field">{SKILL_SHORT[k]} (phút)
                      <input type="number" min={1} max={600} value={timeEdit[k] ?? ""} placeholder="không giới hạn" onChange={(e) => setTimeEdit((t) => ({ ...t, [k]: e.target.value }))} style={{ width: 120 }} />
                    </label>
                  ))}
                  {(s.skills || []).includes("listening") && (
                    <label className="sched-field">Listening — số lần nghe
                      <input type="number" min={1} max={5} value={timeEdit.listeningPlays ?? 1} onChange={(e) => setTimeEdit((t) => ({ ...t, listeningPlays: e.target.value }))} style={{ width: 120 }} />
                    </label>
                  )}
                  <div className="row" style={{ gap: 6, width: "auto" }}>
                    <button className="btn btn-sm" onClick={() => saveTimes(s)}>Lưu thời gian</button>
                    <button className="btn-ghost btn-sm" onClick={() => setTimeEdit(null)}>Huỷ</button>
                  </div>
                  <p className="muted" style={{ fontSize: 12, margin: 0, flexBasis: "100%" }}>Áp dụng cho học viên mở link từ bây giờ và cho học viên mở lại bài làm dở (vd máy bị tắt) — dùng để bù giờ. Ai đang làm bình thường giữ thời gian lúc bắt đầu. Để trống = không giới hạn.</p>
                </div>
              ) : (
                <div className="sess-sched">
                  <span>⏱ {timeSummary(s)}</span>
                  <button className="btn-ghost btn-xs" onClick={() => setTimeEdit({ id: s.id, grammar: s.time_limits?.grammar ?? "", reading: s.time_limits?.reading ?? "", writing: s.time_limits?.writing ?? "", listeningPlays: s.time_limits?.listeningPlays ?? 1 })}>Sửa thời gian</button>
                </div>
              ))}

              {editing?.id === s.id ? (
                <div className="sess-sched-edit">
                  <label className="sched-field">Mở lúc<input type="datetime-local" value={editing.opensAt} onChange={(e) => setEditing((x) => ({ ...x, opensAt: e.target.value }))} /></label>
                  <label className="sched-field">Đóng lúc<input type="datetime-local" value={editing.closesAt} onChange={(e) => setEditing((x) => ({ ...x, closesAt: e.target.value }))} /></label>
                  <div className="row" style={{ gap: 6, width: "auto" }}>
                    <button className="btn btn-sm" onClick={() => saveSchedule(s.id, vnInputToIso(editing.opensAt), vnInputToIso(editing.closesAt))}>Lưu lịch</button>
                    <button className="btn-ghost btn-sm" onClick={() => setEditing(null)}>Huỷ</button>
                  </div>
                </div>
              ) : (
                <div className="sess-sched">
                  <span>🕒 {s.opens_at ? `Mở ${formatVnShort(s.opens_at)}` : "Mở ngay"} → {s.closes_at ? `đóng ${formatVnShort(s.closes_at)}` : "không tự đóng"}</span>
                  <button className="btn-ghost btn-xs" onClick={() => setEditing({ id: s.id, opensAt: isoToVnInput(s.opens_at), closesAt: isoToVnInput(s.closes_at) })}>Sửa lịch</button>
                  {s.closes_at && <>
                    <button className="btn-ghost btn-xs" onClick={() => extend(s, 15)} title="Gia hạn giờ đóng">+15 phút</button>
                    <button className="btn-ghost btn-xs" onClick={() => extend(s, 30)}>+30 phút</button>
                    <button className="btn-ghost btn-xs" onClick={() => extend(s, 60)}>+1 giờ</button>
                  </>}
                </div>
              )}

              {drafts?.id === s.id && (
                <div className="sess-drafts">
                  {drafts.rows === null ? <span className="muted">Đang tải…</span>
                    : drafts.rows === "error" ? <span className="accent">Không tải được.</span>
                    : drafts.rows.length === 0 ? <span className="muted">Không có ai đang làm dở (bài đã nộp không hiện ở đây).</span>
                    : (
                      <>
                        <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>{drafts.rows.length} học viên đã bắt đầu nhưng chưa nộp — bài được lưu tự động, mở lại link là làm tiếp được.</p>
                        {drafts.rows.map((d, i) => (
                          <div key={i} className="sess-draft-row">
                            <b>{d.student_name}</b>
                            <span className="muted">{d.class_key || "—"}</span>
                            <span>{SKILL_SHORT[d.stage] || (d.stage === "test" ? "đang làm" : d.stage || "")}</span>
                            <span className="mono muted">lưu lúc {new Date(d.updated_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} · {new Date(d.updated_at).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}</span>
                          </div>
                        ))}
                      </>
                    )}
                </div>
              )}

              <div className="sess-actions">
                <button className="btn btn-sm" onClick={() => copy(s)}>{copied === s.id ? "Đã copy ✓" : "Copy link"}</button>
                <a href={`/test/s/${s.id}`} target="_blank" rel="noreferrer"><button className="btn-ghost btn-sm">Mở thử ↗</button></a>
                <button className={`btn-ghost btn-sm ${drafts?.id === s.id ? "on" : ""}`} onClick={() => showDrafts(s.id)} title="Học viên đã bắt đầu nhưng chưa nộp (bài được lưu tự động)">👀 Đang làm</button>
                <span className="sess-spacer" />
                <button className="btn-ghost btn-sm" onClick={() => toggleActive(s)}>{s.active ? "Tắt link" : "Bật lại"}</button>
                {confirmDel === s.id ? (
                  <span className="sess-inline">
                    <span className="accent" style={{ fontSize: 13 }}>Xoá hẳn link này?</span>
                    <button className="btn-ghost btn-sm danger" onClick={() => remove(s.id)}>Xoá</button>
                    <button className="btn-ghost btn-sm" onClick={() => setConfirmDel(null)}>Không</button>
                  </span>
                ) : (
                  <button className="btn-ghost btn-sm danger" onClick={() => setConfirmDel(s.id)}>Xoá</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
