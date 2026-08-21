import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isValidSessionValue } from "@/lib/auth";
import { listContentBanks, createContentBank } from "@/lib/contentBanks";

function requireTeacher() {
  const value = cookies().get("teacher_session")?.value;
  return isValidSessionValue(value);
}

export async function GET() {
  if (!requireTeacher()) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  const banks = await listContentBanks();
  return NextResponse.json({ banks });
}

export async function POST(req) {
  if (!requireTeacher()) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  try {
    const body = await req.json();
    const id = await createContentBank(body.name, body.content);
    return NextResponse.json({ id });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Không tạo được bộ đề." }, { status: 400 });
  }
}
