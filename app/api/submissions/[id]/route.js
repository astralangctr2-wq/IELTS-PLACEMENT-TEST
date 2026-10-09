import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sql, ensureSchema } from "@/lib/db";
import { isValidSessionValue } from "@/lib/auth";
import { roundHalf } from "@/lib/scoring";
import {
  IELTS_CRITERIA, ieltsWritingBand, APTIS_WRITING_PARTS, aptisCefr, cleanAnnotations,
} from "@/lib/grading";

const txt = (v, max = 4000) => (v ?? "").toString().slice(0, max);

// Detailed Writing grade (teacher only). The test type comes from the
// submission's content bank in the database — never from the browser.
// IELTS: 4 criteria (0–9, with a comment each) + optional note.
// Aptis: 4 part scores + Writing score on the 0–50 scale + strengths /
// improvements. Both may carry highlights on the essay.
// The legacy columns the student's result page reads (writing_band,
// writing_feedback, final_band, graded) are filled too, so that page keeps
// working unchanged.
async function saveDetailedGrade(id, body) {
  const { rows } = await sql`
    SELECT s.objective_band, s.writing_text, cb.category
    FROM submissions s LEFT JOIN content_banks cb ON cb.id = s.content_bank_id
    WHERE s.id = ${id} LIMIT 1`;
  if (rows.length === 0) return NextResponse.json({ error: "Không tìm thấy bài làm." }, { status: 404 });
  const row = rows[0];
  const annotations = cleanAnnotations(body.annotations, (row.writing_text || "").length);
  let grading, writingBand, writingFeedback, finalBand;

  if (row.category === "aptis") {
    const parts = {};
    for (const p of APTIS_WRITING_PARTS) {
      const v = Number(body.parts?.[p.key]);
      if (body.parts?.[p.key] === null || body.parts?.[p.key] === "" || !Number.isInteger(v) || v < 0 || v > p.max) {
        return NextResponse.json({ error: `Chưa chấm ${p.label} (0–${p.max}).` }, { status: 400 });
      }
      parts[p.key] = v;
    }
    const score = Number(body.writingScore);
    if (!Number.isInteger(score) || score < 0 || score > 50) {
      return NextResponse.json({ error: "Điểm Writing Aptis phải là số nguyên 0–50." }, { status: 400 });
    }
    const strengths = txt(body.strengths), improvements = txt(body.improvements);
    grading = { type: "aptis", parts, writingScore: score, cefr: aptisCefr("writing", score), strengths, improvements, annotations };
    writingBand = score;
    finalBand = score;
    writingFeedback = [strengths && `Điểm mạnh: ${strengths}`, improvements && `Cần cải thiện: ${improvements}`].filter(Boolean).join("\n\n");
  } else {
    const criteria = {};
    for (const c of IELTS_CRITERIA) {
      const v = Number(body.criteria?.[c.key]?.score);
      if (body.criteria?.[c.key]?.score === null || body.criteria?.[c.key]?.score === "" || Number.isNaN(v) || v < 0 || v > 9 || roundHalf(v) !== v) {
        return NextResponse.json({ error: `Chưa chấm tiêu chí ${c.label} (0–9).` }, { status: 400 });
      }
      criteria[c.key] = { score: v, feedback: txt(body.criteria[c.key].feedback) };
    }
    const note = txt(body.note);
    writingBand = ieltsWritingBand(criteria);
    grading = { type: "ielts", criteria, writingBand, note, annotations };
    writingFeedback = note;
    const objBand = row.objective_band;
    finalBand = objBand !== null ? roundHalf((Number(objBand) + writingBand) / 2) : writingBand;
  }

  grading.gradedAt = new Date().toISOString();
  await sql`
    UPDATE submissions
    SET grading = ${JSON.stringify(grading)}::jsonb,
        writing_band = ${writingBand},
        writing_feedback = ${writingFeedback},
        final_band = ${finalBand},
        graded = TRUE,
        graded_at = now()
    WHERE id = ${id}
  `;
  return NextResponse.json({ ok: true, writingBand, finalBand });
}

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

  // Moving a submission into a different session/folder — a separate
  // concern from grading, kept in the same route since both act on a
  // single submission by id.
  if (body.action === "moveSession") {
    const sessionId = body.sessionId ? String(body.sessionId).slice(0, 20) : null;
    const { rowCount } = await sql`UPDATE submissions SET session_id = ${sessionId} WHERE id = ${params.id}`;
    if (rowCount === 0) return NextResponse.json({ error: "Không tìm thấy bài làm." }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "grade") return saveDetailedGrade(params.id, body);

  const writingBand = Number(body.writingBand);
  const writingFeedback = (body.writingFeedback || "").toString().slice(0, 4000);

  if (Number.isNaN(writingBand) || writingBand < 0 || writingBand > 9) {
    return NextResponse.json({ error: "Điểm Writing phải trong khoảng 0–9." }, { status: 400 });
  }

  const { rows } = await sql`SELECT objective_band FROM submissions WHERE id = ${params.id} LIMIT 1`;
  if (rows.length === 0) return NextResponse.json({ error: "Không tìm thấy bài làm." }, { status: 404 });

  const objBand = rows[0].objective_band;
  const finalBand = objBand !== null ? roundHalf((Number(objBand) + writingBand) / 2) : roundHalf(writingBand);

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
