import { requireStaffPage, listTeachers } from "@/lib/staff";
import { listSessions } from "@/lib/testSessions";
import { listContentBanks, CATEGORY_LABELS } from "@/lib/contentBanks";
import SessionManager from "./SessionManager";
import { listClassNames } from "@/lib/classes";

export const dynamic = "force-dynamic";

export default async function SessionsPage({ searchParams }) {
  const staff = await requireStaffPage({ admin: true });
  const category = searchParams?.category || "";
  const sessions = await listSessions();
  const banks = await listContentBanks();
  const classNames = await listClassNames();
  const teachers = (await listTeachers()).map((t) => ({ id: t.id, name: t.name, email: t.email, active: t.active, room_slug: t.room_slug }));
  const bankSummaries = banks.map((b) => ({ id: b.id, name: b.name, category: b.category, className: b.class_name || "" }));
  return (
    <div className="wrap-wide" style={{ maxWidth: 900 }}>
      <div className="topbar">
        <div>
          <p className="serif" style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Link thi</p>
          {category && CATEGORY_LABELS[category] && (
            <p className="mono muted" style={{ fontSize: 12, margin: 0 }}>Đang tạo link cho: {CATEGORY_LABELS[category]}</p>
          )}
        </div>
        <a href="/teacher"><button className="btn-ghost btn-sm">← Bảng điều khiển</button></a>
      </div>
      <SessionManager initialSessions={sessions} banks={bankSummaries} initialCategory={category} classNames={classNames} teachers={teachers} />
    </div>
  );
}
