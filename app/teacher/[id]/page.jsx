import { notFound } from "next/navigation";
import { requireTeacherOrRedirect } from "@/lib/auth";
import { sql, ensureSchema } from "@/lib/db";
import GradeForm from "./GradeForm";
import AnswerReview from "./AnswerReview";
import DeleteButton from "../DeleteButton";

export const dynamic = "force-dynamic";

export default async function SubmissionDetail({ params }) {
  requireTeacherOrRedirect();
  await ensureSchema();

  const { rows } = await sql`SELECT * FROM submissions WHERE id = ${params.id} LIMIT 1`;
  if (rows.length === 0) notFound();
  const s = rows[0];
  const snapshot = s.content_snapshot || null;
  const skills = Array.isArray(s.skills_included) ? s.skills_included : ["grammar", "reading", "listening", "writing"];

  return (
    <div className="wrap">
      <div className="topbar">
        <div>
          <p className="serif" style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{s.student_name}</p>
          <p className="mono muted" style={{ fontSize: 12, margin: 0 }}>
            {new Date(s.created_at).toLocaleString("vi-VN")}
            {s.target_band ? ` · Mục tiêu: ${s.target_band}` : ""}
          </p>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <a href="/teacher"><button className="btn-ghost btn-sm">← Danh sách</button></a>
          <DeleteButton id={s.id} studentName={s.student_name} redirectAfter="/teacher" />
        </div>
      </div>

      <div className="card stack">
        <p className="mono muted" style={{ fontSize: 12 }}>ĐIỂM TỰ ĐỘNG</p>
        {skills.includes("grammar") && <p>Ngữ pháp: <b>{s.grammar_score}/{s.grammar_total}</b></p>}
        {skills.includes("reading") && <p>Reading: <b>{s.reading_score}/{s.reading_total}</b></p>}
        {skills.includes("listening") && <p>Listening: <b>{s.listening_score}/{s.listening_total}</b></p>}
        <p>Band ước tính (chưa gồm Writing): <b>{s.objective_band !== null ? Number(s.objective_band).toFixed(1) : "— (HV không làm phần trắc nghiệm nào)"}</b></p>
      </div>

      {snapshot && Array.isArray(snapshot.grammar) && Array.isArray(snapshot.reading) && Array.isArray(snapshot.listening) ? (
        <>
          {skills.includes("grammar") && <AnswerReview title="CHI TIẾT — NGỮ PHÁP" questions={snapshot.grammar} answers={s.answers?.grammar} />}
          {skills.includes("reading") && <AnswerReview title="CHI TIẾT — READING" questions={snapshot.reading} answers={s.answers?.reading} />}
          {skills.includes("listening") && <AnswerReview title="CHI TIẾT — LISTENING" questions={snapshot.listening} answers={s.answers?.listening} />}
        </>
      ) : (
        <div className="card">
          <p className="muted" style={{ fontSize: 13 }}>Không có dữ liệu chi tiết từng câu cho bài nộp này (có thể do nộp trước khi tính năng này được bật, hoặc dữ liệu bị thiếu). Chỉ hiện được điểm tổng ở trên.</p>
        </div>
      )}

      <div className="card">
        <p className="mono muted" style={{ fontSize: 12, marginBottom: 10 }}>BÀI VIẾT ({s.writing_word_count} từ)</p>
        <p className="serif" style={{ lineHeight: 1.7, whiteSpace: "pre-line" }}>{s.writing_text}</p>
      </div>

      <GradeForm
        submissionId={s.id}
        objectiveBand={s.objective_band !== null ? Number(s.objective_band) : null}
        initialBand={s.writing_band !== null ? Number(s.writing_band) : 6}
        initialFeedback={s.writing_feedback || ""}
        graded={s.graded}
        finalBand={s.final_band !== null ? Number(s.final_band) : null}
      />
    </div>
  );
}
