import { NextResponse } from "next/server";
import { canOpenSheet, visibleSheets } from "@/lib/sheetAuth";
import { mergeCandidates, loadSheet } from "@/lib/sheetData";

export const dynamic = "force-dynamic";

// Sittings to merge by hand into this sheet (the student typed another
// name): same class, or any class with ?q=<part of the name>. A teacher
// only sees sittings of their own links.
export async function GET(req, { params }) {
  const x = await loadSheet(params.id, { noRedirect: true });
  const row = x.s;
  if (!row) return NextResponse.json({ error: "Không tìm thấy bài làm." }, { status: 404 });
  if (!(await canOpenSheet(row, x.data.parts.map((p) => p.id)))) return NextResponse.json({ error: "Bạn không có quyền với bài này." }, { status: 403 });
  const q = new URL(req.url).searchParams.get("q") || "";
  const list = await visibleSheets(await mergeCandidates(row, q));
  return NextResponse.json({ items: list.map(({ session_id, effective_class, ...it }) => it) });
}
