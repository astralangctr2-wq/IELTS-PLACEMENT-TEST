import { NextResponse } from "next/server";
import { adminSignedIn } from "@/lib/staff";
import { createSession, listSessions } from "@/lib/testSessions";
import { getTeacher } from "@/lib/staff";

// Admin only: teachers receive links and grade, they do not manage them.
const requireTeacher = adminSignedIn;

export async function GET() {
  if (!(await requireTeacher())) return NextResponse.json({ error: "Chỉ admin được làm việc này (hoặc chưa đăng nhập)." }, { status: 401 });
  const sessions = await listSessions();
  return NextResponse.json({ sessions });
}

export async function POST(req) {
  if (!(await requireTeacher())) return NextResponse.json({ error: "Chỉ admin được làm việc này (hoặc chưa đăng nhập)." }, { status: 401 });
  try {
    const body = await req.json();
    if (body.teacherId) {
      const t = await getTeacher(String(body.teacherId));
      if (!t || !t.active) throw new Error("Không tìm thấy giáo viên đã chọn.");
    }
    const id = await createSession(body);
    return NextResponse.json({ id });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Không tạo được phiên thi." }, { status: 400 });
  }
}
