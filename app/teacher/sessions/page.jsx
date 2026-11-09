import { requireStaffPage, listTeachers } from "@/lib/staff";
import { listSessions } from "@/lib/testSessions";
import { listContentBanks, CATEGORY_LABELS } from "@/lib/contentBanks";
import SessionManager from "./SessionManager";
import StaffNav from "../StaffNav";
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
    <div className="wrap-wide">
      <StaffNav title="Link thi" count={sessions.length}
        subtitle={category && CATEGORY_LABELS[category] ? `Đang tạo link cho: ${CATEGORY_LABELS[category]}` : "Tạo link: chọn đề → kỹ năng → giáo viên canh & chấm → Level. Ca sau cùng đề: “⧉ Nhân bản”."} />
      <SessionManager initialSessions={sessions} banks={bankSummaries} initialCategory={category} classNames={classNames} teachers={teachers} />
    </div>
  );
}
