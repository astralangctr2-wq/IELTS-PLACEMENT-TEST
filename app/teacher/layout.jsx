import { getStaff } from "@/lib/staff";
import { classSummary, inboxCount } from "@/lib/classes";
import StaffShell from "./StaffShell";

export const dynamic = "force-dynamic";

// Teacher area frame: sidebar grouped by the workflow, top bar, and the
// colour scheme of the role (admin light, teacher dark — Astra navy +
// yellow). Visitors (login page) get the page alone.
export default async function TeacherLayout({ children }) {
  const staff = await getStaff();
  if (!staff) return children;
  const admin = staff.role === "admin";
  let counts = { ungraded: 0, inbox: 0 };
  try {
    const sum = await classSummary(admin ? null : staff.teacherId);
    counts = { ungraded: sum.reduce((a, r) => a + r.ungraded, 0), inbox: admin ? await inboxCount() : 0 };
  } catch {}
  const me = admin
    ? { role: "admin", name: "Admin", sub: "Tài khoản mật khẩu" }
    : { role: "teacher", name: staff.name, sub: staff.email, room: staff.roomSlug || "" };
  return <StaffShell me={me} counts={counts}>{children}</StaffShell>;
}
