import { requireTeacherOrRedirect } from "@/lib/auth";
import { listSessions } from "@/lib/testSessions";
import { listSubmissionsWithClass, listClassNames } from "@/lib/classes";
import LogoutButton from "./LogoutButton";
import SubmissionsBoard from "./SubmissionsBoard";

export const dynamic = "force-dynamic";

export default async function TeacherDashboard() {
  requireTeacherOrRedirect();

  const rows = await listSubmissionsWithClass();
  const sessions = await listSessions();
  const allSessions = sessions.map((s) => ({ id: s.id, name: s.name, className: s.class_name || null }));
  const classNames = await listClassNames();

  // Only what the board needs (grading JSON can be large — keep the
  // summary fields for the Aptis result column).
  const lite = rows.map((r) => ({
    id: r.id,
    student_name: r.student_name,
    created_at: new Date(r.created_at).toISOString(),
    objective_band: r.objective_band !== null ? Number(r.objective_band) : null,
    writing_word_count: r.writing_word_count,
    final_band: r.final_band !== null ? Number(r.final_band) : null,
    graded: r.graded,
    target_band: r.target_band,
    skills_included: r.skills_included,
    session_id: r.session_id,
    session_name: r.session_name,
    class_name: r.class_name || null,
    bank_id: r.content_bank_id,
    bank_name: r.bank_name,
    aptis: r.bank_category === "aptis",
    reading: [r.reading_score, r.reading_total],
    listening: [r.listening_score, r.listening_total],
    aptis_writing: r.grading?.type === "aptis" ? r.grading.writingScore : null,
  }));

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
        <SubmissionsBoard rows={lite} allSessions={allSessions} classNames={classNames} />
      )}
    </div>
  );
}
