import { NextResponse } from "next/server";
import { getStaff } from "@/lib/staff";
import { getSession, setRoomFor } from "@/lib/testSessions";

export const dynamic = "force-dynamic";

// Teacher, own link only: show it on / hide it from their room link
// (e.g. a re-sit the next day). Everything else about a link is the admin's.
export async function PATCH(req, { params }) {
  const staff = await getStaff();
  if (!staff) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  const s = await getSession(params.id);
  if (!s) return NextResponse.json({ error: "Không tìm thấy link." }, { status: 404 });
  if (staff.role !== "admin" && s.teacher_id !== staff.teacherId) return NextResponse.json({ error: "Link này không giao cho bạn." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (!("roomHours" in body)) return NextResponse.json({ error: "Không có thay đổi." }, { status: 400 });
  await setRoomFor(params.id, body.roomHours);
  return NextResponse.json({ ok: true });
}
