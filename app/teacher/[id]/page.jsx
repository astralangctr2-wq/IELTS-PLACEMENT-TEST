import { notFound } from "next/navigation";
import { formatVN } from "@/lib/formatDate";
import { requireTeacherOrRedirect } from "@/lib/auth";
import { getSubmissionFull } from "@/lib/classes";
import WritingGrader from "./WritingGrader";
import { aptisScaleFromRaw, aptisCefr } from "@/lib/grading";
import ExamTypeSwitch from "./ExamTypeSwitch";
import IntegrityCard from "./IntegrityCard";
import HighlightsCard from "./HighlightsCard";
import AnswerReview from "./AnswerReview";
import { reviewItems, ensureReviewSchema } from "@/lib/answerReview";
import DeleteButton from "../DeleteButton";

export const dynamic = "force-dynamic";

export default async function SubmissionDetail({ params }) {
  requireTeacherOrRedirect();
  await ensureReviewSchema();
  const s = await getSubmissionFull(params.id);
  if (!s) notFound();
  const snapshot = s.content_snapshot || null;
  const skills = Array.isArray(s.skills_included) ? s.skills_included : ["grammar", "reading", "listening", "writing"];
  const examType = { type: s.exam_kind, source: s.exam_type_source };
  const aptis = examType.type === "aptis";
  const aptisSkill = (skill, earned, total) => {
    const scale = aptisScaleFromRaw(earned, total);
    return <>{earned}/{total} câu — <b>{scale ?? "—"}/50</b> · CEFR <b>{scale !== null ? aptisCefr(skill, scale) : "—"}</b></>;
  };

  return (
    <div className="wrap-wide grade-page">
      <div className="topbar">
        <div>
          <p className="serif" style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{s.student_name}</p>
          <p className="mono muted" style={{ fontSize: 12, margin: 0 }}>
            {formatVN(s.created_at)}
            {s.target_band ? ` · Mục tiêu: ${s.target_band}` : ""}
            {` · ${s.bank_name || (s.content_bank_id ? "bộ đề đã xoá" : "không rõ bộ đề")}`}
            {` · Lớp: ${s.effective_class || "chưa phân lớp"}`}
            {s.student_class && s.student_class !== s.effective_class ? ` (HV nhập: ${s.student_class})` : ""}
          </p>
          <p className="mono" style={{ fontSize: 12, margin: "4px 0 0" }}>
            <ExamTypeSwitch submissionId={s.id} type={examType.type} source={examType.source} />
          </p>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <a href="/teacher"><button className="btn-ghost btn-sm">← Danh sách</button></a>
          <a href={`/teacher/${s.id}/phieu`} target="_blank" rel="noreferrer"><button className="btn-ghost btn-sm">Phiếu kết quả ↗</button></a>
          <DeleteButton id={s.id} studentName={s.student_name} redirectAfter="/teacher" />
        </div>
      </div>

      <IntegrityCard integrity={s.integrity} />

      {(skills.includes("reading") || skills.includes("listening")) && <HighlightsCard highlights={s.answers?.highlights} />}

      {aptis ? (
      <div className="card stack">
        <p className="mono muted" style={{ fontSize: 12 }}>ĐIỂM TỰ ĐỘNG — THANG APTIS (ƯỚC TÍNH)</p>
        {skills.includes("listening") && <p>Listening: {aptisSkill("listening", s.listening_score, s.listening_total)}</p>}
        {skills.includes("reading") && <p>Reading: {aptisSkill("reading", s.reading_score, s.reading_total)}</p>}
        <p className="muted" style={{ fontSize: 12 }}>Điểm 0–50 quy đổi theo tỷ lệ câu đúng; mốc CEFR theo Aptis General (British Council).</p>
      </div>
      ) : (
      <div className="card stack">
        <p className="mono muted" style={{ fontSize: 12 }}>{s.answer_review?.confirmedAt ? "ĐIỂM TRẮC NGHIỆM — GV ĐÃ XÁC NHẬN ✓" : "ĐIỂM TỰ ĐỘNG (máy chấm — GV xác nhận ở cuối trang)"}</p>
        {skills.includes("grammar") && <p>Ngữ pháp: <b>{s.grammar_score}/{s.grammar_total}</b></p>}
        {skills.includes("reading") && <p>Reading: <b>{s.reading_score}/{s.reading_total}</b></p>}
        {skills.includes("listening") && <p>Listening: <b>{s.listening_score}/{s.listening_total}</b></p>}
        <p>Band ước tính (chưa gồm Writing): <b>{s.objective_band !== null ? Number(s.objective_band).toFixed(1) : "— (HV không làm phần trắc nghiệm nào)"}</b></p>
      </div>
      )}

      {skills.includes("writing") && (
        <WritingGrader
          submissionId={s.id}
          type={aptis ? "aptis" : "ielts"}
          text={s.writing_text || ""}
          wordCount={s.writing_word_count}
          objectiveBand={s.objective_band !== null ? Number(s.objective_band) : null}
          initialGrading={s.grading || null}
          graded={s.graded}
        />
      )}
      {!skills.includes("writing") && (
        <div className="card"><p className="muted" style={{ fontSize: 13 }}>Bài này không có Writing. Máy đã chấm phần trắc nghiệm — GV xem lại từng câu bên dưới (bấm ✓ Đúng / ✗ Sai nếu cần) rồi bấm <b>Lưu &amp; xác nhận điểm</b>.</p></div>
      )}

      {snapshot && Array.isArray(snapshot.grammar) && Array.isArray(snapshot.reading) && Array.isArray(snapshot.listening) ? (
        <AnswerReview
          submissionId={s.id}
          sections={["grammar", "reading", "listening"].filter((k) => skills.includes(k) && snapshot[k].length).map((k) => ({ skill: k, items: reviewItems(snapshot[k], s.answers?.[k]) }))}
          initialMarks={s.answer_review?.marks || {}}
          confirmedAt={s.answer_review?.confirmedAt || null}
          autoScores={s.answer_review?.auto || null}
        />
      ) : (
        <div className="card">
          <p className="muted" style={{ fontSize: 13 }}>Không có dữ liệu chi tiết từng câu cho bài nộp này (có thể do nộp trước khi tính năng này được bật, hoặc dữ liệu bị thiếu). Chỉ hiện được điểm tổng ở trên.</p>
        </div>
      )}

    </div>
  );
}
