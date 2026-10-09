import { notFound } from "next/navigation";
import { requireTeacherOrRedirect } from "@/lib/auth";
import { getSubmissionFull } from "@/lib/classes";
import { scoreMeaning } from "@/lib/scoreMeanings";
import { CENTER_NAME, LOGO_URL } from "@/lib/branding";
import {
  IELTS_CRITERIA, APTIS_WRITING_PARTS, aptisScaleFromRaw, aptisCefr,
} from "@/lib/grading";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";

const dateVN = (v) => new Date(v).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" });
const fmtBand = (v) => (v === null || v === undefined ? "—" : Number(v).toFixed(1));

function Paragraphs({ text }) {
  if (!text || !text.trim()) return <p className="sheet-empty">—</p>;
  return <p className="sheet-prose">{text}</p>;
}

// "Ý nghĩa điểm số" — texts live in lib/scoreMeanings.js (empty until the
// centre provides them); the box only appears for scores that have a text.
function Meanings({ items }) {
  const shown = items.filter((m) => m.text);
  if (!shown.length) return null;
  return (
    <section>
      <h2>Ý nghĩa điểm số</h2>
      {shown.map((m) => (
        <div key={m.label} className="sheet-meaning">
          <div className="sheet-meaning-head"><span>{m.label}</span><b>{m.score}</b></div>
          <p>{m.text}</p>
        </div>
      ))}
    </section>
  );
}

export default async function ResultSheet({ params }) {
  requireTeacherOrRedirect();
  const s = await getSubmissionFull(params.id);
  if (!s) notFound();
  const skills = Array.isArray(s.skills_included) ? s.skills_included : ["grammar", "reading", "listening", "writing"];
  const examType = { type: s.exam_kind };
  const aptis = examType.type === "aptis";
  const g = s.grading && s.grading.type === (aptis ? "aptis" : "ielts") ? s.grading : null;
  const hasWriting = skills.includes("writing");

  // Aptis scale rows (L / R estimated from items correct, W from the grade).
  const apRows = [];
  if (aptis) {
    for (const [key, label, e, t] of [["listening", "Listening", s.listening_score, s.listening_total], ["reading", "Reading", s.reading_score, s.reading_total]]) {
      if (!skills.includes(key)) continue;
      const scale = aptisScaleFromRaw(e, t);
      apRows.push({ key, label, detail: `${e}/${t} câu đúng`, scale, cefr: scale !== null ? aptisCefr(key, scale) : "—" });
    }
    if (hasWriting) {
      apRows.push({
        key: "writing",
        label: "Writing",
        detail: g ? APTIS_WRITING_PARTS.map((p, i) => `P${i + 1}: ${g.parts[p.key]}/${p.max}`).join(" · ") : "Chưa chấm",
        scale: g ? g.writingScore : null,
        cefr: g ? aptisCefr("writing", g.writingScore) : "—",
      });
    }
  }
  const meanings = aptis
    ? apRows.map((r) => ({ label: r.label, score: r.scale === null ? "—" : `${r.scale}/50 · ${r.cefr}`, text: r.scale === null ? "" : scoreMeaning("aptis", r.key, r.cefr) }))
    : [
        ...(hasWriting && g ? [{ label: "Writing", score: fmtBand(g.writingBand), text: scoreMeaning("ielts", "writing", g.writingBand) }] : []),
        ...(s.graded || !hasWriting ? [{ label: "Band tổng", score: fmtBand(s.graded ? s.final_band : s.objective_band), text: scoreMeaning("ielts", "overall", s.graded ? s.final_band : s.objective_band) }] : []),
      ];
  const apTotal = apRows.every((r) => r.scale !== null) ? apRows.reduce((a, r) => a + r.scale, 0) : null;

  return (
    <div className="sheet-page">
      <div className="sheet-actions">
        <a href={`/teacher/${s.id}`}><button className="btn-ghost btn-sm">← Quay lại bài chấm</button></a>
        <PrintButton />
        <span className="mono muted" style={{ fontSize: 12 }}>Khi in, chọn “Lưu dưới dạng PDF” để xuất file PDF.</span>
      </div>

      <article className="sheet">
        <header className="sheet-head">
          <div className="sheet-brand">
            {LOGO_URL && <img src={LOGO_URL} alt="" />}
            <span>{CENTER_NAME}</span>
          </div>
          <div className="sheet-title">
            <h1>PHIẾU KẾT QUẢ</h1>
            <p>{aptis ? "APTIS ESOL — General" : "IELTS"}</p>
          </div>
        </header>

        <section className="sheet-info">
          <div><span>Học viên</span><b>{s.student_name}</b></div>
          <div><span>Lớp</span><b>{s.effective_class || "—"}</b></div>
          <div><span>Bài thi</span><b>{s.bank_name || "—"}</b></div>
          <div><span>Ngày làm bài</span><b>{dateVN(s.created_at)}</b></div>
          {!aptis && s.target_band && <div><span>Mục tiêu</span><b>{s.target_band}</b></div>}
        </section>

        {aptis ? (
          <section>
            <h2>Kết quả</h2>
            <table className="sheet-table">
              <thead><tr><th>Kỹ năng</th><th>Chi tiết</th><th style={{ width: 110 }}>Điểm (0–50)</th><th style={{ width: 80 }}>CEFR</th></tr></thead>
              <tbody>
                {apRows.map((r) => (
                  <tr key={r.label}><td><b>{r.label}</b></td><td>{r.detail}</td><td className="num">{r.scale ?? "—"}</td><td className="num"><b>{r.cefr}</b></td></tr>
                ))}
              </tbody>
              {apRows.length > 1 && (
                <tfoot><tr><td colSpan={2}>Tổng điểm</td><td className="num">{apTotal !== null ? `${apTotal}/${apRows.length * 50}` : "—"}</td><td></td></tr></tfoot>
              )}
            </table>
            <p className="sheet-footnote">Điểm 0–50 là điểm ước tính để luyện thi: Listening/Reading quy đổi theo tỷ lệ câu đúng; Writing do giáo viên chấm theo thang từng phần của Aptis. Mốc CEFR theo Aptis General (British Council). CEFR tổng chỉ cấp khi thi đủ 4 kỹ năng.</p>
          </section>
        ) : (
          <section>
            <h2>Kết quả</h2>
            <div className="sheet-scores">
              {skills.includes("grammar") && <div><span>Ngữ pháp & Từ vựng</span><b>{s.grammar_score}/{s.grammar_total}</b></div>}
              {skills.includes("reading") && <div><span>Reading</span><b>{s.reading_score}/{s.reading_total}</b></div>}
              {skills.includes("listening") && <div><span>Listening</span><b>{s.listening_score}/{s.listening_total}</b></div>}
              {s.objective_band !== null && <div><span>Band trắc nghiệm</span><b>{fmtBand(s.objective_band)}</b></div>}
              {hasWriting && <div><span>Band Writing</span><b>{g ? fmtBand(g.writingBand) : "Chưa chấm"}</b></div>}
              <div className="sheet-final"><span>Band tổng</span><b>{s.graded ? fmtBand(s.final_band) : hasWriting ? "—" : fmtBand(s.objective_band)}</b></div>
            </div>
          </section>
        )}

        {hasWriting && (
          <section>
            <h2>Writing — Nhận xét của giáo viên</h2>
            {!g ? (
              <p className="sheet-empty">Bài viết chưa được chấm.</p>
            ) : aptis ? (
              <>
                <table className="sheet-table">
                  <thead><tr><th>Phần</th><th style={{ width: 90 }}>Điểm</th></tr></thead>
                  <tbody>
                    {APTIS_WRITING_PARTS.map((p) => <tr key={p.key}><td>{p.label}</td><td className="num">{g.parts[p.key]}/{p.max}</td></tr>)}
                  </tbody>
                  <tfoot><tr><td>Writing (0–50) · CEFR {aptisCefr("writing", g.writingScore)}</td><td className="num">{g.writingScore}/50</td></tr></tfoot>
                </table>
                <div className="sheet-two">
                  <div><h3>Điểm mạnh</h3><Paragraphs text={g.strengths} /></div>
                  <div><h3>Điểm cần cải thiện</h3><Paragraphs text={g.improvements} /></div>
                </div>
              </>
            ) : (
              <>
                <table className="sheet-table">
                  <thead><tr><th style={{ width: 190 }}>Tiêu chí</th><th style={{ width: 60 }}>Band</th><th>Nhận xét</th></tr></thead>
                  <tbody>
                    {IELTS_CRITERIA.map((c) => (
                      <tr key={c.key}><td><b>{c.label}</b></td><td className="num"><b>{fmtBand(g.criteria[c.key]?.score)}</b></td><td className="sheet-prose">{g.criteria[c.key]?.feedback || "—"}</td></tr>
                    ))}
                  </tbody>
                  <tfoot><tr><td>Band Writing</td><td className="num">{fmtBand(g.writingBand)}</td><td></td></tr></tfoot>
                </table>
                {g.note && g.note.trim() && <><h3>Ghi chú thêm</h3><Paragraphs text={g.note} /></>}
              </>
            )}

          </section>
        )}

        <Meanings items={meanings} />

        <footer className="sheet-foot">
          <div>Ngày lập phiếu: {dateVN(new Date())}</div>
          <div className="sheet-sign">Giáo viên<br /><br /><br />………………………………</div>
        </footer>
      </article>
    </div>
  );
}
