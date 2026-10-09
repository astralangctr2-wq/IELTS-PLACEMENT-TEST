import { notFound } from "next/navigation";
import { requireTeacherOrRedirect } from "@/lib/auth";
import { sql, ensureSchema } from "@/lib/db";
import { CENTER_NAME, LOGO_URL } from "@/lib/branding";
import {
  IELTS_CRITERIA, APTIS_WRITING_PARTS, TAG_BY_KEY, aptisScaleFromRaw, aptisCefr, segmentText, cleanAnnotations, detectExamType,
} from "@/lib/grading";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";

const dateVN = (v) => new Date(v).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" });
const fmtBand = (v) => (v === null || v === undefined ? "—" : Number(v).toFixed(1));

function Paragraphs({ text }) {
  if (!text || !text.trim()) return <p className="sheet-empty">—</p>;
  return <p className="sheet-prose">{text}</p>;
}

function Essay({ text, annotations }) {
  if (!text || !text.trim()) return <p className="sheet-empty">Học viên không viết bài.</p>;
  const anns = cleanAnnotations(annotations, text.length);
  return (
    <>
      <div className="sheet-essay">
        {segmentText(text, anns).map((s, i) =>
          s.ann ? (
            <mark key={i} className="sheet-mark" style={{ "--tag": TAG_BY_KEY[s.ann.tag].color }} data-n={s.index + 1}>{s.text}</mark>
          ) : (
            <span key={i}>{s.text}</span>
          )
        )}
      </div>
      {anns.length > 0 && (
        <table className="sheet-table sheet-annots">
          <thead><tr><th style={{ width: 30 }}>#</th><th style={{ width: 90 }}>Loại</th><th>Đoạn trong bài</th><th>Ghi chú của giáo viên</th></tr></thead>
          <tbody>
            {anns.map((a, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td><span className="sheet-tag" style={{ "--tag": TAG_BY_KEY[a.tag].color }}>{TAG_BY_KEY[a.tag].label}</span></td>
                <td><i>“{text.slice(a.start, a.end)}”</i></td>
                <td>{a.note || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

export default async function ResultSheet({ params }) {
  requireTeacherOrRedirect();
  await ensureSchema();
  const { rows } = await sql`
    SELECT s.*, cb.name AS bank_name,
           s.exam_type, cb.category AS bank_category, cb2.category AS session_bank_category,
           left(s.writing_text, 20) AS writing_head,
           jsonb_path_exists(COALESCE(s.content_snapshot, '{}'::jsonb), '$.reading[*] ? (@.type == "reorder" || @.type == "heading_match")') AS has_aptis_types,
           CASE WHEN s.class_name IS NULL THEN ts.class_name ELSE NULLIF(s.class_name, '') END AS effective_class
    FROM submissions s
    LEFT JOIN content_banks cb ON cb.id = s.content_bank_id
    LEFT JOIN test_sessions ts ON ts.id = s.session_id
    LEFT JOIN content_banks cb2 ON cb2.id = ts.content_bank_id
    WHERE s.id = ${params.id} LIMIT 1`;
  if (rows.length === 0) notFound();
  const s = rows[0];
  const skills = Array.isArray(s.skills_included) ? s.skills_included : ["grammar", "reading", "listening", "writing"];
  const examType = detectExamType(s);
  const aptis = examType.type === "aptis";
  const g = s.grading && s.grading.type === (aptis ? "aptis" : "ielts") ? s.grading : null;
  const hasWriting = skills.includes("writing");

  // Aptis scale rows (L / R estimated from items correct, W from the grade).
  const apRows = [];
  if (aptis) {
    for (const [key, label, e, t] of [["listening", "Listening", s.listening_score, s.listening_total], ["reading", "Reading", s.reading_score, s.reading_total]]) {
      if (!skills.includes(key)) continue;
      const scale = aptisScaleFromRaw(e, t);
      apRows.push({ label, detail: `${e}/${t} câu đúng`, scale, cefr: scale !== null ? aptisCefr(key, scale) : "—" });
    }
    if (hasWriting) {
      apRows.push({
        label: "Writing",
        detail: g ? APTIS_WRITING_PARTS.map((p, i) => `P${i + 1}: ${g.parts[p.key]}/${p.max}`).join(" · ") : "Chưa chấm",
        scale: g ? g.writingScore : null,
        cefr: g ? aptisCefr("writing", g.writingScore) : "—",
      });
    }
  }
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

            <h3>Bài viết của học viên{g?.annotations?.length ? " (có chú thích)" : ""}</h3>
            <Essay text={s.writing_text} annotations={g?.annotations} />
          </section>
        )}

        <footer className="sheet-foot">
          <div>Ngày lập phiếu: {dateVN(new Date())}</div>
          <div className="sheet-sign">Giáo viên<br /><br /><br />………………………………</div>
        </footer>
      </article>
    </div>
  );
}
