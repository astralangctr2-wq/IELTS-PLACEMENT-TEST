import { NextResponse } from "next/server";
import { getSubmissionFull } from "@/lib/classes";
import { canEditSheet } from "@/lib/sheetAuth";
import { ensureReviewSchema, saveAnswerReview } from "@/lib/answerReview";

export const dynamic = "force-dynamic";

// Teacher confirms / corrects the auto-marked Grammar, Reading and
// Listening answers: { marks: { "reading:<qid>:<part>": true|false }, confirm }.
export async function POST(req, { params }) {
  await ensureReviewSchema();
  const row = await getSubmissionFull(params.id);
  if (!row) return NextResponse.json({ error: "Không tìm thấy bài làm." }, { status: 404 });
  if (!(await canEditSheet(row))) return NextResponse.json({ error: "Bạn không có quyền với bài này." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const out = await saveAnswerReview(row, body.marks, Boolean(body.confirm));
  return NextResponse.json({ ok: true, ...out });
}
