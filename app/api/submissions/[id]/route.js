import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sql, ensureSchema } from "@/lib/db";
import { isValidSessionValue } from "@/lib/auth";
import { roundHalf } from "@/lib/scoring";

export const dynamic = "force-dynamic";

function requireTeacher() {
  const value = cookies().get("teacher_session")?.value;
  return isValidSessionValue(value);
}

// Public: lets a student check whether their essay has been graded yet,
// using the private submission id/link they received after submitting.
export async function GET(req, { params }) {
  await ensureSchema();
  const { rows } = await sql`
    SELECT student_name, objective_band, grammar_score, grammar_total,
           reading_score, reading_total, listening_score, listening_total,
           writing_word_count, writing_band, writing_feedback, final_band, graded
    FROM submissions WHERE id = ${params.id} LIMIT 1
  `;
  if (rows.length === 0) return NextResponse.json({ error: "Không tìm thấy bài làm." }, { status: 404 });
  return NextResponse.json(rows[0]);
}

// Teacher-only: permanently delete a submission.
export async function DELETE(req, { params }) {
  if (!requireTeacher()) {
    return NextResponse.json({ error: "Bạn cần đăng nhập với vai trò giáo viên." }, { status: 401 });
  }
  await ensureSchema();
  const { rowCount } = await sql`DELETE FROM submissions WHERE id = ${params.id}`;
  if (rowCount === 0) return NextResponse.json({ error: "Không tìm thấy bài làm." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
export async function PATCH(req, { params }) {
  if (!requireTeacher()) {
    return NextResponse.json({ error: "Bạn cần đăng nhập với vai trò giáo viên." }, { status: 401 });
  }
  await ensureSchema();
  const body = await req.json();
  const writingBand = Number(body.writingBand);
  const writingFeedback = (body.writingFeedback || "").toString().slice(0, 4000);

  if (Number.isNaN(writingBand) || writingBand < 0 || writingBand > 9) {
    return NextResponse.json({ error: "Điểm Writing phải trong khoảng 0–9." }, { status: 400 });
  }

  const { rows } = await sql`SELECT objective_band FROM submissions WHERE id = ${params.id} LIMIT 1`;
  if (rows.length === 0) return NextResponse.json({ error: "Không tìm thấy bài làm." }, { status: 404 });

  const finalBand = roundHalf((Number(rows[0].objective_band) + writingBand) / 2);

  await sql`
    UPDATE submissions
    SET writing_band = ${writingBand},
        writing_feedback = ${writingFeedback},
        final_band = ${finalBand},
        graded = TRUE,
        graded_at = now()
    WHERE id = ${params.id}
  `;

  return NextResponse.json({ ok: true, finalBand });
}
