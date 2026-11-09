import { NextResponse } from "next/server";
import { adminSignedIn, listTeachers, addTeacher, updateTeacher } from "@/lib/staff";

export const dynamic = "force-dynamic";

// Admin only: grant / revoke teacher access for a Gmail account, rename,
// change the room link.
export async function GET() {
  if (!(await adminSignedIn())) return NextResponse.json({ error: "Chỉ admin." }, { status: 403 });
  return NextResponse.json({ teachers: await listTeachers() });
}

export async function POST(req) {
  if (!(await adminSignedIn())) return NextResponse.json({ error: "Chỉ admin." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  try {
    if (body.id) await updateTeacher(String(body.id), { name: body.name, active: body.active, roomSlug: body.roomSlug });
    else await addTeacher(body.email, body.name);
    return NextResponse.json({ teachers: await listTeachers() });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
