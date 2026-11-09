import { requireStaffPage, scopeTeacher, listTeachers } from "@/lib/staff";
import { listSessions } from "@/lib/testSessions";
import { listSubmissionsPage, classSummary, listClassNames, inboxCount, ALL_CLASSES, PAGE_SIZE } from "@/lib/classes";
import StaffNav from "./StaffNav";
import SubmissionsBoard from "./SubmissionsBoard";

export const dynamic = "force-dynamic";

// Loads only what is on screen: one page of the newest submissions (or all
// of one class), plus per-class counts for the filter / export / stats.
// A teacher sees only the submissions of the links given to them.
export default async function TeacherDashboard({ searchParams }) {
  const staff = await requireStaffPage();
  const admin = staff.role === "admin";
  const tid = scopeTeacher(staff);
  const cls = (searchParams?.class || ALL_CLASSES).toString();
  const q = (searchParams?.q || "").toString().slice(0, 80);
  const limit = Math.min(1000, Math.max(PAGE_SIZE, Number(searchParams?.n) || PAGE_SIZE));

  const [{ rows, total }, summary, sessions, classNames, teachers, inbox] = await Promise.all([
    listSubmissionsPage({ cls: admin || cls !== "__inbox__" ? cls : ALL_CLASSES, q, limit, tid }),
    classSummary(tid),
    admin ? listSessions() : Promise.resolve([]),
    admin ? listClassNames() : Promise.resolve([]),
    admin ? listTeachers() : Promise.resolve([]),
    admin ? inboxCount() : Promise.resolve(0),
  ]);
  const allSessions = sessions.map((s) => ({ id: s.id, name: s.name }));
  const totalAll = summary.reduce((a, r) => a + r.n, 0);
  const pendingAll = summary.reduce((a, r) => a + r.ungraded, 0);

  return (
    <div className="wrap-wide">
      <StaffNav staff={staff} title={admin ? "Bảng điều khiển Admin" : "Bài chấm của tôi"}
        subtitle={`${totalAll} bài nộp — ${pendingAll} chưa chấm Writing${admin && inbox ? ` — ${inbox} bài chưa có GV` : ""}`} />

      {totalAll === 0 && !(admin && inbox) ? (
        <div className="card">
          <p className="muted">{admin ? "Chưa có bài nộp nào." : "Chưa có bài nào. Khi admin giao link cho bạn, bài làm của học viên sẽ hiện ở đây."}</p>
          {!admin && <p style={{ margin: "8px 0 0" }}><a href="/teacher/links">→ Xem link được giao</a></p>}
        </div>
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
          isAdmin={admin}
          teachers={teachers.map((t) => ({ id: t.id, name: t.name, email: t.email, active: t.active }))}
          inboxCount={inbox}
        />
      )}
    </div>
  );
}
