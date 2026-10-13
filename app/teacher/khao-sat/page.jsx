import { surveyScopeOrRedirect } from "@/lib/surveyAuth";
import { listSurveys, summarizeSurveys, SURVEY } from "@/lib/survey";
import { formatVN } from "@/lib/formatDate";

export const dynamic = "force-dynamic";

const NONE = "__none__";
const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);

function Bars({ counts, total }) {
  const max = Math.max(1, ...counts.map((c) => c.n));
  return (
    <div className="sv-bars">
      {counts.map((c) => (
        <div key={c.option} className="sv-bar-row">
          <span className="sv-bar-label">{c.option}</span>
          <span className="sv-bar-track"><span className="sv-bar-fill" style={{ width: `${(c.n / max) * 100}%` }} /></span>
          <span className="sv-bar-n mono">{c.n} <span className="muted">({pct(c.n, total)}%)</span></span>
        </div>
      ))}
    </div>
  );
}

export default async function SurveyResults({ searchParams }) {
  const scope = await surveyScopeOrRedirect();
  const cls = (searchParams?.class || "").toString();
  const sessionId = (searchParams?.link || "").toString();
  const all = await listSurveys({ scope });
  const rows = all.filter((r) => (!cls || (cls === NONE ? !r.class_name : r.class_name === cls)) && (!sessionId || r.session_id === sessionId));
  const sum = summarizeSurveys(rows);
  const classes = [...new Set(all.map((r) => r.class_name || NONE))].sort();
  const links = [...new Map(all.filter((r) => r.session_id).map((r) => [r.session_id, r.session_name || r.session_id])).entries()];
  const ratings = SURVEY.filter((q) => q.type === "rating");
  const issues = sum.questions.issues;
  const hadIssue = rows.filter((r) => (r.answers?.issues || []).some((x) => x !== "Không gặp sự cố")).length;
  const texts = rows.filter((r) => r.answers?.liked || r.answers?.improve || r.answers?.wishOther);
  const qs = new URLSearchParams({ ...(cls ? { class: cls } : {}), ...(sessionId ? { link: sessionId } : {}) }).toString();

  return (
    <div className="wrap-wide" style={{ maxWidth: 980 }}>
      <div className="topbar">
        <div>
          <p className="serif" style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>📝 Khảo sát góp ý của học viên</p>
          <p className="mono muted" style={{ fontSize: 12, margin: 0 }}>Bật khảo sát cho từng link ở trang "Tạo link phiên thi".</p>
        </div>
        <div className="row" style={{ gap: 8, width: "auto" }}>
          {rows.length > 0 && <a href={`/api/teacher/survey-export${qs ? `?${qs}` : ""}`}><button className="btn-ghost btn-sm">⬇ Xuất Excel</button></a>}
          <a href="/teacher"><button className="btn-ghost btn-sm">← Bảng điều khiển</button></a>
        </div>
      </div>

      <form className="sv-filter" method="get">
        <label>Lớp
          <select name="class" defaultValue={cls}>
            <option value="">Tất cả lớp</option>
            {classes.map((c) => <option key={c} value={c}>{c === NONE ? "Chưa phân lớp" : c}</option>)}
          </select>
        </label>
        <label>Link thi
          <select name="link" defaultValue={sessionId}>
            <option value="">Tất cả link</option>
            {links.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        <button className="btn btn-sm" type="submit">Xem</button>
      </form>

      {rows.length === 0 ? (
        <div className="card"><p className="muted" style={{ margin: 0 }}>Chưa có phản hồi nào{cls || sessionId ? " với bộ lọc này" : ""}. Khi tạo link thi, tick "Hiện khảo sát góp ý sau khi nộp bài".</p></div>
      ) : (
        <>
          <div className="sv-kpis">
            <div className="card"><span className="muted">Số phản hồi</span><b>{sum.n}</b></div>
            <div className="card"><span className="muted">Hài lòng chung</span><b>{sum.questions.overall.avg ? sum.questions.overall.avg.toFixed(1) : "—"}<small>/5</small></b></div>
            <div className="card"><span className="muted">Gặp sự cố</span><b>{pct(hadIssue, issues.answered)}<small>%</small></b><span className="muted" style={{ fontSize: 12 }}>{hadIssue}/{issues.answered} người trả lời</span></div>
          </div>

          <div className="card stack">
            <p className="sv-h">Nguyện vọng — chức năng học viên muốn có thêm</p>
            <Bars counts={sum.questions.wishes.counts} total={sum.questions.wishes.answered} />
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>% tính trên {sum.questions.wishes.answered} người có chọn. Mỗi người chọn tối đa 3.</p>
          </div>

          <div className="sv-grid">
            <div className="card stack">
              <p className="sv-h">Đánh giá (1–5 sao)</p>
              {ratings.map((q) => {
                const r = sum.questions[q.key];
                return (
                  <div key={q.key} className="sv-rate">
                    <div className="row" style={{ gap: 8 }}><span>{q.label}</span><b className="mono">{r.avg ? r.avg.toFixed(1) : "—"}</b></div>
                    <div className="sv-dist" title={r.dist.map((n, i) => `${i + 1}★: ${n}`).join(" · ")}>
                      {r.dist.map((n, i) => <span key={i} className={`d${i + 1}`} style={{ flexGrow: n || 0.0001 }} />)}
                    </div>
                    <span className="muted" style={{ fontSize: 12 }}>{r.answered} người · {r.dist.map((n, i) => `${i + 1}★ ${n}`).join(" · ")}</span>
                  </div>
                );
              })}
            </div>
            <div className="card stack">
              <p className="sv-h">Sự cố gặp phải</p>
              <Bars counts={issues.counts} total={issues.answered} />
            </div>
            {["time", "difficulty", "device"].map((k) => {
              const q = SURVEY.find((x) => x.key === k);
              return (
                <div key={k} className="card stack">
                  <p className="sv-h">{q.label}</p>
                  <Bars counts={sum.questions[k].counts} total={sum.questions[k].answered} />
                </div>
              );
            })}
          </div>

          <div className="card stack">
            <p className="sv-h">Góp ý bằng lời ({texts.length})</p>
            {texts.length === 0 && <p className="muted" style={{ margin: 0 }}>Chưa có góp ý bằng lời.</p>}
            {texts.map((r) => (
              <div key={r.id} className="sv-comment">
                <p className="mono muted" style={{ fontSize: 12, margin: 0 }}>
                  {r.anonymous ? "Ẩn danh" : r.student_name} · {r.class_name || "chưa phân lớp"} · {r.session_name || r.bank_name || ""} · {formatVN(r.created_at)}
                  {r.answers?.overall ? ` · ${"★".repeat(r.answers.overall)}` : ""}
                </p>
                {r.answers.liked && <p><b>Thích:</b> {r.answers.liked}</p>}
                {r.answers.improve && <p><b>Cần cải thiện:</b> {r.answers.improve}</p>}
                {r.answers.wishOther && <p><b>Muốn có thêm:</b> {r.answers.wishOther}</p>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
