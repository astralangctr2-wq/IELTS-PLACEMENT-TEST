import { requireTeacherOrRedirect } from "@/lib/auth";
import { listSessions } from "@/lib/testSessions";
import { listSubmissionsPage, classSummary, listClassNames, ALL_CLASSES, PAGE_SIZE } from "@/lib/classes";
import LogoutButton from "./LogoutButton";
import SubmissionsBoard from "./SubmissionsBoard";

export const dynamic = "force-dynamic";

// Loads only what is on screen: one page of the newest submissions (or all
// of one class), plus per-class counts for the filter / export / stats.
export default async function TeacherDashboard({ searchParams }) {
  requireTeacherOrRedirect();
  const cls = (searchParams?.class || ALL_CLASSES).toString();
  const q = (searchParams?.q || "").toString().slice(0, 80);
  const limit = Math.min(1000, Math.max(PAGE_SIZE, Number(searchParams?.n) || PAGE_SIZE));

  const [{ rows, total }, summary, sessions, classNames] = await Promise.all([
    listSubmissionsPage({ cls, q, limit }),
    classSummary(),
    listSessions(),
    listClassNames(),
  ]);
  const allSessions = sessions.map((s) => ({ id: s.id, name: s.name }));
  const totalAll = summary.reduce((a, r) => a + r.n, 0);
  const pendingAll = summary.reduce((a, r) => a + r.ungraded, 0);

  return (
    <div className="wrap-wide">
      <div className="topbar">
        <div>
          <p className="serif" style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Bảng điều khiển Giáo viên</p>
          <p className="mono muted" style={{ fontSize: 13, margin: "4px 0 0" }}>{totalAll} bài nộp — {pendingAll} chưa chấm Writing</p>
        </div>
        <div className="row" style={{ gap: 10, width: "auto", flexWrap: "wrap" }}>
          <a href="/teacher/stats"><button className="btn-ghost btn-sm">📊 Thống kê</button></a>
          <a href="/teacher/sessions"><button className="btn-ghost btn-sm">Tạo link phiên thi</button></a>
          <a href="/teacher/content"><button className="btn-ghost btn-sm">Quản lý đề thi</button></a>
          <LogoutButton />
        </div>
      </div>

      {totalAll === 0 ? (
        <div className="card"><p className="muted">Chưa có bài nộp nào.</p></div>
      ) : (
        <SubmissionsBoard
          rows={rows}
          total={total}
          cls={cls}
          q={q}
          limit={limit}
          summary={summary.map((r) => ({ ...r, class_name: r.class_name || null }))}
          allSessions={allSessions}
          classNames={classNames}
        />
      )}
    </div>
  );
}
