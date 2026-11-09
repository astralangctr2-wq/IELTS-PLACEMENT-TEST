import { NextResponse } from "next/server";
import { getStaff } from "@/lib/staff";
import { getSession } from "@/lib/testSessions";
import { listDrafts } from "@/lib/drafts";

export const dynamic = "force-dynamic";

// Tests started on a link but not submitted yet (autosave rows). A teacher
// only for the links given to them.
export async function GET(req) {
  const staff = await getStaff();
  if (!staff) return NextResponse.json({ error: "Bạn cần đăng nhập với vai trò giáo viên." }, { status: 401 });
  const session = new URL(req.url).searchParams.get("session") || "";
  if (staff.role !== "admin") {
    const s = session ? await getSession(session) : null;
    if (!s || s.teacher_id !== staff.teacherId) return NextResponse.json({ error: "Link này không giao cho bạn." }, { status: 403 });
  }
  const rows = await listDrafts(session ? `s:${session}` : "");
  return NextResponse.json({ rows });
}
