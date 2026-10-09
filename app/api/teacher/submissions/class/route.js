import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isValidSessionValue } from "@/lib/auth";
import { setSubmissionsClass } from "@/lib/classes";

export const dynamic = "force-dynamic";

// Teacher only: file one or more submissions under a class.
export async function POST(req) {
  if (!isValidSessionValue(cookies().get("teacher_session")?.value)) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }
  const body = await req.json();
  const ids = Array.isArray(body.ids) ? body.ids.map(String).filter(Boolean).slice(0, 500) : [];
  if (ids.length === 0) return NextResponse.json({ error: "Chưa chọn bài nào." }, { status: 400 });
  const className = body.className === null ? null : (body.className ?? "").toString();
  await setSubmissionsClass(ids, className);
  return NextResponse.json({ ok: true });
}
