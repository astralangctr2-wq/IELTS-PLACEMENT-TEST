"use client";

import { useEffect, useState } from "react";
import { formatVnShort, scheduleState } from "@/lib/vnTime";

const SK = { grammar: "Ngữ pháp", reading: "Reading", listening: "Listening", writing: "Writing" };
const STATUS = { open: "Đang mở", not_yet: "Chưa đến giờ", closed: "Đã hết giờ", off: "Đã tắt" };
const statusOf = (s) => (!s.active ? "off" : scheduleState(s.opens_at, s.closes_at));

// Teacher's view of their links: read-only settings (the admin manages
// them), the ways in for students (room link, code, link), who is taking
// the test now, and "show on my room link again" for a re-sit.
export default function LinkCards({ sessions, roomSlug }) {
  const [list, setList] = useState(sessions);
  const [copied, setCopied] = useState("");
  const [drafts, setDrafts] = useState(null);
  // Set after mounting: the server does not know the address (avoids a
  // hydration mismatch).
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const room = roomSlug ? `${origin}/p/${roomSlug}` : "";

  const copy = async (key, text) => {
    try { await navigator.clipboard.writeText(text); } catch { window.prompt("Copy:", text); }
    setCopied(key); setTimeout(() => setCopied((c) => (c === key ? "" : c)), 2000);
  };
  const showDrafts = async (id) => {
    if (drafts?.id === id) { setDrafts(null); return; }
    setDrafts({ id, rows: null });
    try {
      const res = await fetch(`/api/teacher/drafts?session=${encodeURIComponent(id)}`, { cache: "no-store" });
      const j = await res.json();
      setDrafts({ id, rows: res.ok ? j.rows || [] : "error" });
    } catch { setDrafts({ id, rows: "error" }); }
  };
  const setRoom = async (s, hours) => {
    const res = await fetch(`/api/teacher/links/${s.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roomHours: hours }) });
    if (!res.ok) { alert((await res.json().catch(() => ({}))).error || "Không đổi được."); return; }
    setList((prev) => prev.map((x) => (x.id === s.id ? { ...x, room_until: hours ? new Date(Date.now() + hours * 3600000).toISOString() : new Date(0).toISOString() } : x)));
  };

  return (
    <div className="stack">
      {room && (
        <div className="card room-card">
          <p style={{ margin: 0 }}><b>Link phòng thi của bạn</b> — máy phòng lab chỉ cần lưu 1 lần. Học viên mở link này sẽ vào đúng ca thi đang mở của bạn.</p>
          <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <span className="mono code-big">{room}</span>
            <button className="btn btn-sm" onClick={() => copy("room", room)}>{copied === "room" ? "Đã copy ✓" : "Copy"}</button>
            <a href={`/p/${roomSlug}`} target="_blank" rel="noreferrer"><button className="btn-ghost btn-sm">Mở thử ↗</button></a>
          </div>
        </div>
      )}
      {!list.length && <div className="card"><p className="muted" style={{ margin: 0 }}>Admin chưa giao link nào cho bạn.</p></div>}
      {list.map((s) => {
        const st = statusOf(s);
        const inRoom = new Date(s.room_until || 0).getTime() > Date.now();
        const link = `${origin}/test/s/${s.id}`;
        return (
          <div key={s.id} className={`sess-card st-${st}`}>
            <div className="sess-head">
              <div className="sess-title"><b>{s.name}</b><span className="mono muted sess-id">{s.bank}</span></div>
              <span className={`state-chip ${st === "open" ? "done" : st === "not_yet" ? "wait" : "off"}`}>{STATUS[st]}</span>
            </div>
            <div className="sess-meta">
              <span className="meta-chip">Lớp <b>{s.class_name || "—"}</b></span>
              <span className="meta-chip">Chấm: <b>{[...s.skills.map((k) => SK[k]), ...(s.with_speaking ? ["Nói"] : [])].join(" · ")}</b></span>
              {s.level && <span className="meta-chip">Level <b>{s.level}</b></span>}
              {s.access_code && <span className="meta-chip">Mã thi <b className="mono">{s.access_code}</b></span>}
              <span className={`meta-chip ${inRoom ? "on" : ""}`}>🚪 {inRoom ? `Trên phòng thi đến ${formatVnShort(s.room_until)}` : "Không hiện trên phòng thi"}</span>
            </div>
            <div className="sess-sched"><span>🕒 {s.opens_at ? `Mở ${formatVnShort(s.opens_at)}` : "Mở ngay"} → {s.closes_at ? `đóng ${formatVnShort(s.closes_at)}` : "không tự đóng"}</span></div>
            {drafts?.id === s.id && (
              <div className="sess-drafts">
                {drafts.rows === null ? <span className="muted">Đang tải…</span>
                  : drafts.rows === "error" ? <span className="accent">Không tải được.</span>
                  : !drafts.rows.length ? <span className="muted">Không có ai đang làm dở.</span>
                  : drafts.rows.map((d, i) => (
                    <div key={i} className="sess-draft-row"><b>{d.student_name}</b><span className="muted">{d.class_key || "—"}</span><span className="mono muted">lưu lúc {new Date(d.updated_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span></div>
                  ))}
              </div>
            )}
            <div className="sess-actions">
              <button className="btn btn-sm" onClick={() => copy(s.id, link)}>{copied === s.id ? "Đã copy ✓" : "Copy link"}</button>
              <a href={`/test/s/${s.id}`} target="_blank" rel="noreferrer"><button className="btn-ghost btn-sm">Mở thử ↗</button></a>
              <button className={`btn-ghost btn-sm ${drafts?.id === s.id ? "on" : ""}`} onClick={() => showDrafts(s.id)}>👀 Đang làm</button>
              <a href={s.class_name ? `/teacher?class=${encodeURIComponent(s.class_name)}` : "/teacher"}><button className="btn-ghost btn-sm">Bài đã nộp →</button></a>
              <span className="sess-spacer" />
              {s.active && st !== "closed" && (inRoom
                ? <button className="btn-ghost btn-sm" onClick={() => setRoom(s, 0)}>Ẩn khỏi phòng thi</button>
                : <button className="btn-ghost btn-sm" onClick={() => setRoom(s, 12)}>Hiện trên phòng thi 12 giờ</button>)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
