import { requireStaffPage } from "@/lib/staff";
import { listSessions } from "@/lib/testSessions";
import { listContentBanks } from "@/lib/contentBanks";
import StaffNav from "../StaffNav";
import LinkCards from "./LinkCards";

export const dynamic = "force-dynamic";

// Teacher: the links the admin gave them — to send to students / open in
// the room, watch who is taking the test, and know which skills to grade.
export default async function MyLinksPage() {
  const staff = await requireStaffPage();
  if (staff.role === "admin") {
    const { redirect } = require("next/navigation");
    redirect("/teacher/sessions");
  }
  const [sessions, banks] = await Promise.all([listSessions(staff.teacherId), listContentBanks()]);
  const bankNames = Object.fromEntries(banks.map((b) => [b.id, b.name]));
  const list = sessions.map((s) => ({
    id: s.id, name: s.name, skills: s.skills, class_name: s.class_name, active: s.active, opens_at: s.opens_at, closes_at: s.closes_at,
    level: s.level, with_speaking: s.with_speaking, access_code: s.access_code, room_until: s.room_until, time_limits: s.time_limits,
    bank: bankNames[s.content_bank_id] || "",
  }));
  return (
    <div className="wrap-wide" style={{ maxWidth: 960 }}>
      <StaffNav staff={staff} title="Link được giao" subtitle={`${list.length} link · link phòng thi của bạn: /p/${staff.roomSlug || "—"}`} />
      <LinkCards sessions={JSON.parse(JSON.stringify(list))} roomSlug={staff.roomSlug} />
    </div>
  );
}
