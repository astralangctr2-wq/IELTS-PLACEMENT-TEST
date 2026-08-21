import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isValidSessionValue } from "@/lib/auth";
import { getContentBank, updateContentBank, setDefaultContentBank, deleteContentBank } from "@/lib/contentBanks";

function requireTeacher() {
  const value = cookies().get("teacher_session")?.value;
  return isValidSessionValue(value);
}

export async function GET(_req, { params }) {
  if (!requireTeacher()) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  const bank = await getContentBank(params.id);
  if (!bank) return NextResponse.json({ error: "Không tìm thấy bộ đề." }, { status: 404 });
  return NextResponse.json(bank);
}

export async function PATCH(req, { params }) {
  if (!requireTeacher()) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  try {
    const body = await req.json();
    if (body.action === "setDefault") {
      await setDefaultContentBank(params.id);
      return NextResponse.json({ ok: true });
    }
    if (body.content) {
      await updateContentBank(params.id, body.content, body.name);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Không có thay đổi hợp lệ." }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Không lưu được." }, { status: 400 });
  }
}

export async function DELETE(_req, { params }) {
  if (!requireTeacher()) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  try {
    await deleteContentBank(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Không xoá được." }, { status: 400 });
  }
}
