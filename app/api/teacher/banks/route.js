import { NextResponse } from "next/server";
import { adminSignedIn } from "@/lib/staff";
import { listContentBanks, createContentBank, updateContentBank, findSameBank, bankUsage } from "@/lib/contentBanks";

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
    // onDuplicate: "ask" → a bank with the same name + class exists: answer
    // 409 so the admin chooses; "replace" → put the new content into that
    // bank (same id: submissions, links and the answer review stay
    // attached); anything else → a new bank.
    if (body.onDuplicate === "ask" || body.onDuplicate === "replace") {
      const dup = await findSameBank(body.name, body.className);
      if (dup && body.onDuplicate === "ask") {
        return NextResponse.json({ duplicate: { id: dup.id, name: dup.name, className: dup.class_name || "", usage: await bankUsage(dup.id) } }, { status: 409 });
      }
      if (dup) {
        await updateContentBank(dup.id, body.content, undefined, body.category && body.category !== "other" ? body.category : undefined);
        return NextResponse.json({ id: dup.id, replaced: true });
      }
    }
    const id = await createContentBank(body.name, body.content, body.category, body.className);
    return NextResponse.json({ id });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Không tạo được bộ đề." }, { status: 400 });
  }
}
