import { requireTeacherOrRedirect } from "@/lib/auth";
import { sql, ensureSchema } from "@/lib/db";
import { listSessions } from "@/lib/testSessions";
import LogoutButton from "./LogoutButton";
import SubmissionsBoard from "./SubmissionsBoard";

export const dynamic = "force-dynamic";

export default async function TeacherDashboard() {
  requireTeacherOrRedirect();
  await ensureSchema();

  const { rows } = await sql`
    SELECT s.id, s.student_name, s.created_at, s.objective_band, s.writing_word_count,
           s.final_band, s.graded, s.target_band, s.skills_included, s.session_id,
           ts.name AS session_name
    FROM submissions s
    LEFT JOIN test_sessions ts ON ts.id = s.session_id
    ORDER BY s.created_at DESC
  `;

  const sessions = await listSessions();
  const allSessions = sessions.map((s) => ({ id: s.id, name: s.name }));

  // Group by session — submissions whose session was deleted (or that
  // never had one) fall into "Chưa phân loại".
  const groupsMap = new Map();
  for (const r of rows) {
    const key = r.session_id && r.session_name ? r.session_id : "__unassigned__";
    const label = r.session_id && r.session_name ? r.session_name : "Chưa phân loại";
    if (!groupsMap.has(key)) groupsMap.set(key, { sessionId: r.session_id && r.session_name ? r.session_id : null, name: label, rows: [] });
    groupsMap.get(key).rows.push(r);
  }
  // Sort groups by most recent submission in each, unassigned last.
  const groups = [...groupsMap.values()].sort((a, b) => {
    if (a.sessionId === null) return 1;
    if (b.sessionId === null) return -1;
    return new Date(b.rows[0].created_at) - new Date(a.rows[0].created_at);
  });

  const pendingCount = rows.filter((r) => !r.graded).length;

  return (
    <div className="wrap-wide">
      <div className="topbar">
        <div>
          <p className="serif" style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Bảng điều khiển Giáo viên</p>
          <p className="mono muted" style={{ fontSize: 13, margin: "4px 0 0" }}>{rows.length} bài nộp — {pendingCount} chưa chấm Writing</p>
        </div>
        <div className="row" style={{ gap: 10, width: "auto" }}>
          <a href="/teacher/sessions"><button className="btn-ghost btn-sm">Tạo link phiên thi</button></a>
          <a href="/teacher/content"><button className="btn-ghost btn-sm">Quản lý đề thi</button></a>
          <LogoutButton />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card"><p className="muted">Chưa có bài nộp nào.</p></div>
      ) : (
        <SubmissionsBoard initialGroups={groups} allSessions={allSessions} />
      )}
    </div>
  );
}
