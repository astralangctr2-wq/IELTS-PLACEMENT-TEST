import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isValidSessionValue } from "@/lib/auth";
import { normalizeContent } from "@/lib/content";
import { setActiveContent } from "@/lib/activeContent";

function requireTeacher() {
  const value = cookies().get("teacher_session")?.value;
  return isValidSessionValue(value);
}

export async function POST(req) {
  if (!requireTeacher()) {
    return NextResponse.json({ error: "Bạn cần đăng nhập với vai trò giáo viên." }, { status: 401 });
  }
  try {
    const body = await req.json();
    const normalized = normalizeContent(body);
    await setActiveContent(normalized);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message || "JSON không hợp lệ." }, { status: 400 });
  }
}
