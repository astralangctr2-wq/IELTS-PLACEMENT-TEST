import { NextResponse } from "next/server";
import { createSessionCookieValue, SESSION_COOKIE } from "@/lib/auth";

export async function POST(req) {
  const { password } = await req.json();

  if (!process.env.TEACHER_PASSWORD) {
    return NextResponse.json(
      { error: "Server chưa cấu hình biến môi trường TEACHER_PASSWORD." },
      { status: 500 }
    );
  }

  if (password !== process.env.TEACHER_PASSWORD) {
    return NextResponse.json({ error: "Sai mật khẩu." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE.name, createSessionCookieValue(), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_COOKIE.maxAge,
  });
  return res;
}
