import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isValidSessionValue } from "@/lib/auth";
import { createSession, listSessions } from "@/lib/testSessions";

function requireTeacher() {
  const value = cookies().get("teacher_session")?.value;
  return isValidSessionValue(value);
}

export async function GET() {
  if (!requireTeacher()) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  const sessions = await listSessions();
  return NextResponse.json({ sessions });
}

export async function POST(req) {
  if (!requireTeacher()) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  try {
    const body = await req.json();
    const id = await createSession(body);
    return NextResponse.json({ id });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Không tạo được phiên thi." }, { status: 400 });
  }
}
