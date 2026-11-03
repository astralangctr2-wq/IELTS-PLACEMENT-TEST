import { NextResponse } from "next/server";
import { getSubmissionFull } from "@/lib/classes";
import { canEditSheet, visibleSheets } from "@/lib/sheetAuth";
import { mergeCandidates } from "@/lib/sheetData";

export const dynamic = "force-dynamic";

// Sittings to merge by hand into this sheet (the student typed another
// name): same class, or any class with ?q=<part of the name>.
export async function GET(req, { params }) {
  const row = await getSubmissionFull(params.id);
  if (!row) return NextResponse.json({ error: "Không tìm thấy bài làm." }, { status: 404 });
  if (!(await canEditSheet(row))) return NextResponse.json({ error: "Bạn không có quyền với bài này." }, { status: 403 });
  const q = new URL(req.url).searchParams.get("q") || "";
  const list = await visibleSheets(await mergeCandidates(row, q));
  return NextResponse.json({ items: list.map(({ session_id, effective_class, ...x }) => x) });
}
