import { cookies } from "next/headers";
import { getStaff } from "@/lib/staff";
import { classSummary, inboxCount } from "@/lib/classes";
import StaffShell from "./StaffShell";

const THEME_COOKIE = "astra_gv_theme";

export const dynamic = "force-dynamic";

// Teacher area frame: sidebar grouped by the workflow, top bar, and the
// colours (Astra navy + yellow). Admin: light. Teacher: light by default,
// dark when they switch it on (kept in a cookie, so the page is drawn in
// the right colours from the server — no flash). Visitors (login page) get
// the page alone.
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
  const theme = !admin && cookies().get(THEME_COOKIE)?.value === "dark" ? "dark" : "light";
  return <StaffShell me={me} counts={counts} theme={theme}>{children}</StaffShell>;
}
