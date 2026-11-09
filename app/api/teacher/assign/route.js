import { NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";
import { adminSignedIn, getTeacher } from "@/lib/staff";

export const dynamic = "force-dynamic";

// Admin: give single submissions to a teacher ({ ids, teacherId }), or
// let them follow the teacher of their link again (teacherId: null).
export async function POST(req) {
  if (!(await adminSignedIn())) return NextResponse.json({ error: "Chỉ admin được làm việc này." }, { status: 401 });
  await ensureSchema();
  const body = await req.json().catch(() => ({}));
  const ids = [...new Set((Array.isArray(body.ids) ? body.ids : []).map(String))].slice(0, 500);
  if (!ids.length) return NextResponse.json({ error: "Chưa chọn bài nào." }, { status: 400 });
  let tid = null;
  if (body.teacherId) {
    const t = await getTeacher(String(body.teacherId));
    if (!t || !t.active) return NextResponse.json({ error: "Không tìm thấy giáo viên." }, { status: 400 });
    tid = t.id;
  }
  const { rowCount } = await sql`UPDATE submissions SET teacher_id = ${tid} WHERE id = ANY(${ids}::text[])`;
  return NextResponse.json({ ok: true, count: rowCount });
}
