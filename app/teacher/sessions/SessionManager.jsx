"use client";

import { useState } from "react";
import { vnInputToIso, isoToVnInput, formatVnShort, scheduleState } from "@/lib/vnTime";
import { normalizeClassName } from "@/lib/classNames";

const SKILL_LABELS = {
  grammar: "Ngữ pháp & Từ vựng",
  reading: "Reading",
  listening: "Listening",
  writing: "Writing",
};
const TIMED_SKILLS = ["grammar", "reading", "writing"];

const CATEGORY_LABELS = { placement: "Placement Test", midterm: "Mid-term Test", mock: "Mock Test", final: "Final Test", other: "Khác" };

export default function SessionManager({ initialSessions, banks, initialCategory, classNames = [] }) {
  const [sessions, setSessions] = useState(initialSessions);
  const [name, setName] = useState("");
  const [skills, setSkills] = useState({ grammar: true, reading: true, listening: true, writing: true });
  const [times, setTimes] = useState({ grammar: 40, reading: 40, writing: 30 });
  const [listeningPlays, setListeningPlays] = useState(1);
  const [mode, setMode] = useState("exam"); // "exam" | "practice"
  const [className, setClassName] = useState("");
  const [opensAt, setOpensAt] = useState(""); // VN wall clock, datetime-local
  const [closesAt, setClosesAt] = useState("");
  const [editing, setEditing] = useState(null); // { id, opensAt, closesAt }
  const filteredBanks = initialCategory ? banks.filter((b) => b.category === initialCategory) : banks;
  const bankChoices = filteredBanks.length > 0 ? filteredBanks : banks;
  const [contentBankId, setContentBankId] = useState(bankChoices[0] ? bankChoices[0].id : "");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [newLink, setNewLink] = useState("");

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const bankName = (id) => {
    if (!id) return "(chưa gán bộ đề)";
    const b = banks.find((bk) => bk.id === id);
    return b ? b.name : "(bộ đề đã xoá)";
  };

  const toggleSkill = (s) => setSkills((prev) => ({ ...prev, [s]: !prev[s] }));

  const create = async () => {
    setCreating(true);
    setError("");
    setNewLink("");
    const chosenSkills = Object.keys(skills).filter((s) => skills[s]);
    try {
      const res = await fetch("/api/teacher/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || "Phiên thi",
          skills: chosenSkills,
          timeLimits: times,
          listeningPlays,
          mode,
          className: className.trim() || null,
          opensAt: vnInputToIso(opensAt),
          closesAt: vnInputToIso(closesAt),
          contentBankId: contentBankId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không tạo được phiên thi.");
      const link = `${origin}/test/s/${data.id}`;
      setNewLink(link);
      const listRes = await fetch("/api/teacher/sessions");
      const listData = await listRes.json();
      setSessions(listData.sessions || []);
      setName("");
      setOpensAt("");
      setClosesAt("");
    } catch (err) {
      setError(err.message);
    }
    setCreating(false);
  };

  const knownClasses = [...new Set([...classNames, ...sessions.map((s) => s.class_name).filter(Boolean)])].sort();

  const editClass = async (s) => {
    const v = window.prompt(`Lớp của link "${s.name}" (để trống = không gán lớp).\nBài nộp qua link này sẽ tự vào lớp đó, trừ bài bạn đã tự chuyển lớp.`, s.class_name || "");
    if (v === null) return;
    await fetch(`/api/teacher/sessions/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ className: v }),
    });
    setSessions((prev) => prev.map((x) => (x.id === s.id ? { ...x, class_name: normalizeClassName(v) || null } : x)));
  };

  // Opening window: only limits who can OPEN the link. Students already
  // inside keep going until their own time limit forces the submission.
  const saveSchedule = async (id, opensIso, closesIso) => {
    await fetch(`/api/teacher/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ opensAt: opensIso, closesAt: closesIso }),
    });
    setSessions((prev) => prev.map((x) => (x.id === id ? { ...x, opens_at: opensIso, closes_at: closesIso } : x)));
    setEditing(null);
  };
  const extend = (s, minutes) => {
    const base = Math.max(Date.now(), s.closes_at ? new Date(s.closes_at).getTime() : Date.now());
    saveSchedule(s.id, s.opens_at || null, new Date(base + minutes * 60000).toISOString());
  };

  const toggleActive = async (id, active) => {
    await fetch(`/api/teacher/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, active } : s)));
  };

  const remove = async (id) => {
    if (!confirm("Xoá phiên thi này? Link sẽ ngừng hoạt động.")) return;
    await fetch(`/api/teacher/sessions/${id}`, { method: "DELETE" });
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  const copy = (text) => {
    navigator.clipboard?.writeText(text);
  };

  return (
    <div>
      <div className="card card-strong">
        <p className="mono muted" style={{ fontSize: 12, marginBottom: 12 }}>TẠO PHIÊN THI MỚI</p>
        <p style={{ marginBottom: 6 }}>Tên phiên thi (chỉ để bạn nhận biết, học viên không thấy):</p>
        <input type="text" placeholder="VD: Lớp A2 — chỉ Grammar + Reading" value={name} onChange={(e) => setName(e.target.value)} />

        <p style={{ margin: "16px 0 6px" }}>Lớp <span className="muted" style={{ fontSize: 13 }}>(bài nộp qua link này sẽ tự vào lớp — dùng để lọc và xuất Excel)</span>:</p>
        <input type="text" list="session-class-list" placeholder="VD: FL4" value={className} onChange={(e) => setClassName(e.target.value)} />
        <datalist id="session-class-list">{knownClasses.map((c) => <option key={c} value={c} />)}</datalist>

        <p style={{ margin: "16px 0 6px" }}>Thời gian cho phép vào làm bài <span className="muted" style={{ fontSize: 13 }}>(giờ Việt Nam — bỏ trống nếu không giới hạn)</span>:</p>
        <div className="row" style={{ gap: 16, justifyContent: "flex-start", flexWrap: "wrap" }}>
          <label className="sched-field">Mở lúc<input type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} /></label>
          <label className="sched-field">Đóng lúc<input type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} /></label>
        </div>
        <p className="muted" style={{ fontSize: 12, margin: "6px 0 0" }}>Sau giờ đóng, link không nhận người vào mới. Học viên đã vào trước đó vẫn làm tiếp đến hết thời gian làm bài.</p>

        <p style={{ margin: "16px 0 8px" }}>Bộ đề sử dụng:</p>
        {bankChoices.length === 0 ? (
          <p className="accent" style={{ fontSize: 13 }}>⚠ Chưa có bộ đề nào. Vào "Quản lý các bộ đề" để tạo trước.</p>
        ) : (
          <select value={contentBankId} onChange={(e) => setContentBankId(e.target.value)}>
            {bankChoices.map((b) => (
              <option key={b.id} value={b.id}>{b.className ? `[${b.className}] ` : ""}{b.name} — {CATEGORY_LABELS[b.category] || "Khác"}</option>
            ))}
          </select>
        )}
        {initialCategory && filteredBanks.length === 0 && (
          <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>Chưa có bộ đề nào gắn nhãn "{CATEGORY_LABELS[initialCategory]}" — đang hiện tất cả bộ đề thay thế.</p>
        )}

        <p style={{ margin: "16px 0 8px" }}>Kỹ năng đưa vào phiên thi:</p>
        <div className="stack">
          {Object.keys(SKILL_LABELS).map((s) => (
            <label key={s} className="option" style={{ cursor: "pointer" }}>
              <input type="checkbox" checked={skills[s]} onChange={() => toggleSkill(s)} style={{ marginRight: 10 }} />
              <span>{SKILL_LABELS[s]}</span>
            </label>
          ))}
        </div>

        <p style={{ margin: "16px 0 8px" }}>Chế độ:</p>
        <div className="mode-choice">
          <label className={`mode-option ${mode === "exam" ? "selected" : ""}`}>
            <input type="radio" name="session-mode" checked={mode === "exam"} onChange={() => setMode("exam")} />
            <span>
              <strong>Thi thử</strong>
              <span className="muted">Có đếm giờ, giới hạn lượt nghe, không dừng audio. Học viên chỉ thấy lời cảm ơn sau khi nộp.</span>
            </span>
          </label>
          <label className={`mode-option ${mode === "practice" ? "selected" : ""}`}>
            <input type="radio" name="session-mode" checked={mode === "practice"} onChange={() => setMode("practice")} />
            <span>
              <strong>Luyện tập</strong>
              <span className="muted">Không giới hạn thời gian, nghe tạm dừng/tua thoải mái. Nộp xong hiện số câu đúng, đáp án và giải thích từng câu.</span>
            </span>
          </label>
        </div>

        {mode === "exam" && <>
        <p style={{ margin: "16px 0 8px" }}>Thời gian giới hạn (phút):</p>
        <div className="row" style={{ gap: 16, justifyContent: "flex-start", flexWrap: "wrap" }}>
          {TIMED_SKILLS.map((s) => (
            <div key={s} style={{ opacity: skills[s] ? 1 : 0.4 }}>
              <p className="mono muted" style={{ fontSize: 11, marginBottom: 4 }}>{SKILL_LABELS[s]}</p>
              <input
                type="number"
                min={1}
                disabled={!skills[s]}
                value={times[s]}
                onChange={(e) => setTimes((prev) => ({ ...prev, [s]: e.target.value }))}
                style={{ width: 90 }}
              />
            </div>
          ))}
          <div style={{ opacity: skills.listening ? 1 : 0.4 }}>
            <p className="mono muted" style={{ fontSize: 11, marginBottom: 4 }}>Listening — số lần được nghe</p>
            <input
              type="number"
              min={1}
              max={5}
              disabled={!skills.listening}
              value={listeningPlays}
              onChange={(e) => setListeningPlays(e.target.value)}
              style={{ width: 90 }}
            />
          </div>
        </div>
        </>}

        <button className="btn" style={{ marginTop: 20 }} disabled={creating || bankChoices.length === 0} onClick={create}>
          {creating ? "Đang tạo…" : "Tạo phiên thi →"}
        </button>
        {error && <p className="accent" style={{ marginTop: 10 }}>⚠ {error}</p>}
        {newLink && (
          <div className="card" style={{ marginTop: 16, background: "rgba(47,111,99,0.08)" }}>
            <p className="mono success" style={{ fontSize: 12, marginBottom: 6 }}>ĐÃ TẠO XONG — GỬI LINK NÀY CHO HỌC VIÊN:</p>
            <div className="row" style={{ gap: 8 }}>
              <p className="mono" style={{ fontSize: 13, wordBreak: "break-all", margin: 0 }}>{newLink}</p>
              <button className="btn-ghost btn-sm" onClick={() => copy(newLink)}>Copy</button>
            </div>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <p className="mono muted" style={{ fontSize: 12, padding: "16px 16px 0" }}>CÁC PHIÊN THI ĐÃ TẠO</p>
        {sessions.length === 0 ? (
          <p className="muted" style={{ padding: 16 }}>Chưa có phiên thi nào.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Tên</th>
                <th>Lớp</th>
                <th>Lịch mở</th>
                <th>Bộ đề</th>
                <th>Kỹ năng</th>
                <th>Chế độ</th>
                <th>Link</th>
                <th>Trạng thái</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const link = `${origin}/test/s/${s.id}`;
                return (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>
                      <button className="btn-ghost btn-sm" onClick={() => editClass(s)} title="Đổi lớp">{normalizeClassName(s.class_name) || "—"} ✎</button>
                    </td>
                    <td style={{ minWidth: 200 }}>
                      {editing?.id === s.id ? (
                        <div className="stack" style={{ gap: 6 }}>
                          <label className="sched-field">Mở lúc<input type="datetime-local" value={editing.opensAt} onChange={(e) => setEditing((x) => ({ ...x, opensAt: e.target.value }))} /></label>
                          <label className="sched-field">Đóng lúc<input type="datetime-local" value={editing.closesAt} onChange={(e) => setEditing((x) => ({ ...x, closesAt: e.target.value }))} /></label>
                          <div className="row" style={{ gap: 6, justifyContent: "flex-start" }}>
                            <button className="btn btn-sm" onClick={() => saveSchedule(s.id, vnInputToIso(editing.opensAt), vnInputToIso(editing.closesAt))}>Lưu</button>
                            <button className="btn-ghost btn-sm" onClick={() => setEditing(null)}>Huỷ</button>
                          </div>
                        </div>
                      ) : (
                        <div className="sched-cell">
                          <span className={`sched-state ${scheduleState(s.opens_at, s.closes_at)}`}>
                            {{ open: "Đang cho vào", not_yet: "Chưa mở", closed: "Đã đóng" }[scheduleState(s.opens_at, s.closes_at)]}
                          </span>
                          <span className="mono muted" style={{ fontSize: 11.5 }}>
                            {s.opens_at ? `Mở ${formatVnShort(s.opens_at)}` : "Mở ngay"}<br />
                            {s.closes_at ? `Đóng ${formatVnShort(s.closes_at)}` : "Không tự đóng"}
                          </span>
                          <div className="row" style={{ gap: 4, justifyContent: "flex-start", flexWrap: "wrap" }}>
                            <button className="btn-ghost btn-xs" onClick={() => setEditing({ id: s.id, opensAt: isoToVnInput(s.opens_at), closesAt: isoToVnInput(s.closes_at) })}>Sửa lịch</button>
                            {s.closes_at && <>
                              <button className="btn-ghost btn-xs" onClick={() => extend(s, 15)} title="Gia hạn giờ đóng">+15p</button>
                              <button className="btn-ghost btn-xs" onClick={() => extend(s, 30)}>+30p</button>
                              <button className="btn-ghost btn-xs" onClick={() => extend(s, 60)}>+1h</button>
                            </>}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="mono muted" style={{ fontSize: 12 }}>{bankName(s.content_bank_id)}</td>
                    <td className="mono muted" style={{ fontSize: 12 }}>{(s.skills || []).map((sk) => SKILL_LABELS[sk] || sk).join(", ")}</td>
                    <td>{s.time_limits?.mode === "practice" ? <span className="mode-pill practice">Luyện tập</span> : <span className="mode-pill">Thi thử</span>}</td>
                    <td>
                      <button className="btn-ghost btn-sm" onClick={() => copy(link)}>Copy link</button>
                    </td>
                    <td>{s.active ? <span className="success">Đang mở</span> : <span className="muted">Đã tắt</span>}</td>
                    <td className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
                      <button className="btn-ghost btn-sm" onClick={() => toggleActive(s.id, !s.active)}>{s.active ? "Tắt" : "Bật lại"}</button>
                      <button className="btn-ghost btn-sm" onClick={() => remove(s.id)}>Xoá</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
