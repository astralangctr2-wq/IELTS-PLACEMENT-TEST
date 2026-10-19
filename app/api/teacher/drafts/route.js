import { NextResponse } from "next/server";
import { staffSignedIn } from "@/lib/sheetAuth";
import { listDrafts } from "@/lib/drafts";

export const dynamic = "force-dynamic";

// Tests started on a link but not submitted yet (autosave rows).
export async function GET(req) {
  if (!(await staffSignedIn())) return NextResponse.json({ error: "Bạn cần đăng nhập với vai trò giáo viên." }, { status: 401 });
  const session = new URL(req.url).searchParams.get("session") || "";
  const rows = await listDrafts(session ? `s:${session}` : "");
  return NextResponse.json({ rows });
}
