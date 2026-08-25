"use client";

import { useState } from "react";
import Link from "next/link";
import DeleteButton from "./DeleteButton";

const SKILL_LABEL = { grammar: "NP", reading: "R", listening: "L", writing: "W" };

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
      onMoved(row.id, sessionId || null);
    } catch (e) {
      alert("Không chuyển được — thử lại.");
    }
    setMoving(false);
  };

  return (
    <div style={{ position: "relative" }}>
      <button className="btn-ghost btn-sm" disabled={moving} onClick={() => setOpen((v) => !v)}>
        {moving ? "…" : "Chuyển"}
      </button>
      {open && (
        <div
          className="card"
          style={{ position: "absolute", right: 0, top: "110%", zIndex: 20, minWidth: 220, padding: 8, margin: 0 }}
        >
          <button
            className="btn-ghost btn-sm"
            style={{ width: "100%", textAlign: "left", marginBottom: 4 }}
            onClick={() => move(null)}
          >
            Chưa phân loại
          </button>
          {allSessions.map((s) => (
            <button
              key={s.id}
              className="btn-ghost btn-sm"
              style={{ width: "100%", textAlign: "left", marginBottom: 4 }}
              onClick={() => move(s.id)}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SubmissionRow({ row, allSessions, onMoved }) {
  const skills = Array.isArray(row.skills_included) ? row.skills_included : ["grammar", "reading", "listening", "writing"];
  return (
    <tr>
      <td>{row.student_name}</td>
      <td className="mono muted">{row.target_band || "—"}</td>
      <td className="mono muted">{skills.map((s) => SKILL_LABEL[s] || s).join(", ")}</td>
      <td className="mono muted">{new Date(row.created_at).toLocaleString("vi-VN")}</td>
      <td>{row.objective_band !== null ? Number(row.objective_band).toFixed(1) : "—"}</td>
      <td>{row.writing_word_count}</td>
      <td>{row.graded ? <span className="success">Đã chấm</span> : <span className="accent">Chưa chấm</span>}</td>
      <td>{row.graded ? Number(row.final_band).toFixed(1) : "—"}</td>
      <td><Link href={`/teacher/${row.id}`}><button className="btn-ghost btn-sm">Xem & chấm →</button></Link></td>
      <td><MoveMenu row={row} allSessions={allSessions} onMoved={onMoved} /></td>
      <td><DeleteButton id={row.id} studentName={row.student_name} /></td>
    </tr>
  );
}

function FolderGroup({ group, allSessions, expanded, onToggle, onMoved }) {
  const pending = group.rows.filter((r) => !r.graded).length;
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="folder-header" onClick={onToggle}>
        <div className="row" style={{ gap: 10, width: "auto" }}>
          <span className="folder-icon">{expanded ? "▾" : "▸"} 📁</span>
          <p style={{ margin: 0, fontWeight: 700 }}>{group.name}</p>
        </div>
        <p className="mono muted" style={{ fontSize: 13, margin: 0 }}>
          {group.rows.length} bài — {pending > 0 ? <span className="accent">{pending} chưa chấm</span> : "đã chấm hết"}
        </p>
      </div>
      {expanded && (
        <div className="card" style={{ padding: 0, overflowX: "auto", marginTop: 8 }}>
          <table>
            <thead>
              <tr>
                <th>Học viên</th>
                <th>Mục tiêu</th>
                <th>Kỹ năng làm</th>
                <th>Thời gian</th>
                <th>Band tự động</th>
                <th>Số từ Writing</th>
                <th>Trạng thái</th>
                <th>Band cuối</th>
                <th></th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {group.rows.map((r) => (
                <SubmissionRow key={r.id} row={r} allSessions={allSessions} onMoved={onMoved} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function SubmissionsBoard({ initialGroups, allSessions }) {
  const [groups, setGroups] = useState(initialGroups);
  const [expandedKeys, setExpandedKeys] = useState(() => new Set(initialGroups.slice(0, 1).map((g) => g.sessionId || "__unassigned__")));

  const toggle = (key) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleMoved = (submissionId, newSessionId) => {
    setGroups((prev) => {
      let movedRow = null;
      const withoutRow = prev.map((g) => {
        const idx = g.rows.findIndex((r) => r.id === submissionId);
        if (idx === -1) return g;
        movedRow = { ...g.rows[idx] };
        return { ...g, rows: g.rows.filter((r) => r.id !== submissionId) };
      }).filter((g) => g.rows.length > 0);

      if (!movedRow) return prev;

      const targetSession = allSessions.find((s) => s.id === newSessionId);
      movedRow.session_id = newSessionId;
      movedRow.session_name = targetSession ? targetSession.name : null;

      const targetKey = newSessionId && targetSession ? newSessionId : "__unassigned__";
      const existing = withoutRow.find((g) => (g.sessionId || "__unassigned__") === targetKey);
      if (existing) {
        existing.rows = [movedRow, ...existing.rows];
        return [...withoutRow];
      }
      const newGroup = { sessionId: newSessionId && targetSession ? newSessionId : null, name: targetSession ? targetSession.name : "Chưa phân loại", rows: [movedRow] };
      return [...withoutRow, newGroup];
    });
  };

  return (
    <div>
      {groups.map((g) => (
        <FolderGroup
          key={g.sessionId || "__unassigned__"}
          group={g}
          allSessions={allSessions}
          expanded={expandedKeys.has(g.sessionId || "__unassigned__")}
          onToggle={() => toggle(g.sessionId || "__unassigned__")}
          onMoved={handleMoved}
        />
      ))}
    </div>
  );
}
