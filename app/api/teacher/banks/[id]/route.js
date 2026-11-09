import { NextResponse } from "next/server";
import { adminSignedIn } from "@/lib/staff";
import { getContentBank, updateContentBank, deleteContentBank } from "@/lib/contentBanks";

// Admin only: teachers receive links and grade, they do not manage them.
const requireTeacher = adminSignedIn;

export async function GET(_req, { params }) {
  if (!(await requireTeacher())) return NextResponse.json({ error: "Chỉ admin được làm việc này (hoặc chưa đăng nhập)." }, { status: 401 });
  const bank = await getContentBank(params.id);
  if (!bank) return NextResponse.json({ error: "Không tìm thấy bộ đề." }, { status: 404 });
  return NextResponse.json(bank);
}

export async function PATCH(req, { params }) {
  if (!(await requireTeacher())) return NextResponse.json({ error: "Chỉ admin được làm việc này (hoặc chưa đăng nhập)." }, { status: 401 });
  try {
    const body = await req.json();
    if (body.content) {
      await updateContentBank(params.id, body.content, body.name, body.category, body.className);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Không có thay đổi hợp lệ." }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Không lưu được." }, { status: 400 });
  }
}

export async function DELETE(_req, { params }) {
  if (!(await requireTeacher())) return NextResponse.json({ error: "Chỉ admin được làm việc này (hoặc chưa đăng nhập)." }, { status: 401 });
  try {
    await deleteContentBank(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Không xoá được." }, { status: 400 });
  }
}
