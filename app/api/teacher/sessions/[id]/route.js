import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isValidSessionValue } from "@/lib/auth";
import { setSessionActive, deleteSession } from "@/lib/testSessions";

function requireTeacher() {
  const value = cookies().get("teacher_session")?.value;
  return isValidSessionValue(value);
}

export async function PATCH(req, { params }) {
  if (!requireTeacher()) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  const body = await req.json();
  await setSessionActive(params.id, Boolean(body.active));
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req, { params }) {
  if (!requireTeacher()) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  await deleteSession(params.id);
  return NextResponse.json({ ok: true });
}
