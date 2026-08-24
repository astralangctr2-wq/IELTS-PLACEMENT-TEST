"use client";

import { useState } from "react";

const SKILL_LABELS = {
  grammar: "Ngữ pháp & Từ vựng",
  reading: "Reading",
  listening: "Listening",
  writing: "Writing",
};
const TIMED_SKILLS = ["grammar", "reading", "writing"];

const CATEGORY_LABELS = { placement: "Placement Test", midterm: "Mid-term Test", mock: "Mock Test", final: "Final Test", other: "Khác" };

export default function SessionManager({ initialSessions, banks, initialCategory }) {
  const [sessions, setSessions] = useState(initialSessions);
  const [name, setName] = useState("");
  const [skills, setSkills] = useState({ grammar: true, reading: true, listening: true, writing: true });
  const [times, setTimes] = useState({ grammar: 40, reading: 40, writing: 30 });
  const [listeningPlays, setListeningPlays] = useState(1);
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
    } catch (err) {
      setError(err.message);
    }
    setCreating(false);
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

        <p style={{ margin: "16px 0 8px" }}>Bộ đề sử dụng:</p>
        {bankChoices.length === 0 ? (
          <p className="accent" style={{ fontSize: 13 }}>⚠ Chưa có bộ đề nào. Vào "Quản lý các bộ đề" để tạo trước.</p>
        ) : (
          <select value={contentBankId} onChange={(e) => setContentBankId(e.target.value)}>
            {bankChoices.map((b) => (
              <option key={b.id} value={b.id}>{b.name} — {CATEGORY_LABELS[b.category] || "Khác"}</option>
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
                <th>Bộ đề</th>
                <th>Kỹ năng</th>
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
                    <td className="mono muted" style={{ fontSize: 12 }}>{bankName(s.content_bank_id)}</td>
                    <td className="mono muted" style={{ fontSize: 12 }}>{(s.skills || []).map((sk) => SKILL_LABELS[sk] || sk).join(", ")}</td>
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
