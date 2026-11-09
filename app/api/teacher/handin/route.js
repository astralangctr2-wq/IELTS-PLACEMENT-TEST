import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getStaff } from "@/lib/staff";
import { resolveSheet } from "@/lib/sheetData";
import { addEvent, pushToAdmins } from "@/lib/notify";

export const dynamic = "force-dynamic";

// A teacher hands result sheets in ("Nộp"): { sheetIds: [...] }. Their own
// sittings of each sheet get the time; the admin gets ONE notification for
// the whole batch. Handing in again later (after a correction) is fine:
// the time is updated and the admin is told again.
export async function POST(req) {
  const staff = await getStaff();
  if (!staff) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  if (staff.role !== "teacher") return NextResponse.json({ error: "Chỉ giáo viên nộp phiếu (admin nhận phiếu)." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const ids = [...new Set((Array.isArray(body.sheetIds) ? body.sheetIds : []).map(String))].slice(0, 100);
  if (!ids.length) return NextResponse.json({ error: "Chưa chọn phiếu nào." }, { status: 400 });

  const done = [];
  const seen = new Set();
  let cls = null, bank = null, bankName = "";
  for (const id of ids) {
    const x = await resolveSheet(id);
    if (!x.s || seen.has(x.data.id)) continue;
    seen.add(x.data.id);
    const mine = x.data.parts.filter((p) => p.teacherId === staff.teacherId).map((p) => p.id);
    if (!mine.length) continue;
    await sql`UPDATE submissions SET teacher_done_at = now() WHERE id = ANY(${mine}::text[])`;
    done.push({ id: x.data.id, name: x.data.name });
    cls = cls || x.s.effective_class || null;
    bank = bank || x.s.content_bank_id || null;
    bankName = bankName || x.s.bank_name || x.s.session_name || "";
  }
  if (!done.length) return NextResponse.json({ error: "Không có phiếu nào thuộc link của bạn." }, { status: 403 });

  const at = new Date();
  await addEvent("handin", staff.teacherId, { count: done.length, sheets: done.slice(0, 50), cls, bank, bankName });
  const qs = new URLSearchParams({ ...(cls ? { class: cls } : {}), ...(bank ? { bank } : {}) }).toString();
  await pushToAdmins({
    title: `${staff.name} đã nộp ${done.length} phiếu`,
    body: [bankName, cls && `Lớp ${cls}`, at.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })].filter(Boolean).join(" · "),
    url: `/teacher/nhap-nhanh${qs ? `?${qs}` : ""}`,
  });
  return NextResponse.json({ ok: true, count: done.length, at: at.toISOString() });
}
