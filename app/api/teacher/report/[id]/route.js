import { NextResponse } from "next/server";
import { getSubmissionFull } from "@/lib/classes";
import { canEditSheet } from "@/lib/sheetAuth";
import { saveReport } from "@/lib/report";
import { normalizeClassName } from "@/lib/classNames";

export const dynamic = "force-dynamic";

// Saves the extra information printed on the result sheet.
export async function POST(req, { params }) {
  const row = await getSubmissionFull(params.id);
  if (!row) return NextResponse.json({ error: "Không tìm thấy bài làm." }, { status: 404 });
  if (!(await canEditSheet(row))) return NextResponse.json({ error: "Bạn không có quyền với bài này." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const data = await saveReport(params.id, normalizeClassName(body.className || row.effective_class) || null, body);
  return NextResponse.json({ ok: true, data });
}
