import { NextResponse } from "next/server";
import { adminSignedIn } from "@/lib/staff";
import { listContentBanks, createContentBank } from "@/lib/contentBanks";

// Admin only: teachers receive links and grade, they do not manage them.
const requireTeacher = adminSignedIn;

export async function GET(req) {
  if (!(await requireTeacher())) return NextResponse.json({ error: "Chỉ admin được làm việc này (hoặc chưa đăng nhập)." }, { status: 401 });
  const category = new URL(req.url).searchParams.get("category") || undefined;
  const banks = await listContentBanks(category);
  return NextResponse.json({ banks });
}

export async function POST(req) {
  if (!(await requireTeacher())) return NextResponse.json({ error: "Chỉ admin được làm việc này (hoặc chưa đăng nhập)." }, { status: 401 });
  try {
    const body = await req.json();
    const id = await createContentBank(body.name, body.content, body.category, body.className);
    return NextResponse.json({ id });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Không tạo được bộ đề." }, { status: 400 });
  }
}
