import { requireTeacherOrRedirect } from "@/lib/auth";
import { classSummary, listForClass, NO_CLASS } from "@/lib/classes";
import { computeStats, hardestQuestions } from "@/lib/stats";
import { INTEGRITY_LABEL, integrityText } from "@/lib/integrity";
import { vnInputToIso } from "@/lib/vnTime";

export const dynamic = "force-dynamic";

const dateVN = (v) => {
  const d = new Date(new Date(v).getTime() + 7 * 3600 * 1000);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

function Bars({ items, max, unit = "", fmt = (k) => k }) {
  const top = max || Math.max(1, ...items.map((i) => i.n));
  return (
    <div className="stat-bars">
      {items.map((i) => (
        <div key={i.key} className="stat-bar-row">
          <span className="stat-bar-label">{fmt(i.key)}</span>
          <span className="stat-bar-track"><span className="stat-bar-fill" style={{ width: `${(100 * i.n) / (i.max || top)}%` }} /></span>
          <span className="stat-bar-value">{i.text ?? `${i.n}${unit}`}</span>
        </div>
      ))}
    </div>
  );
}

function Range({ s }) {
  return <span className="mono muted" style={{ fontSize: 12 }}>thấp nhất {s.min}{s.unit === "%" ? "%" : ""} · cao nhất {s.max}{s.unit === "%" ? "%" : ""} · {s.n} bài</span>;
}

export default async function StatsPage({ searchParams }) {
  requireTeacherOrRedirect();
  const summary = await classSummary();
  const classes = [...new Set(summary.map((r) => r.class_name || NO_CLASS))].sort((a, b) => (a === NO_CLASS ? 1 : b === NO_CLASS ? -1 : a.localeCompare(b, "vi")));
  const cls = searchParams?.class && classes.includes(searchParams.class) ? searchParams.class : classes.find((c) => c !== NO_CLASS) || classes[0];
  const inClass = summary.filter((r) => (r.class_name || NO_CLASS) === cls);
  const nType = (t) => inClass.filter((r) => r.exam_type === t).reduce((a, r) => a + r.n, 0);
  const type = searchParams?.type === "aptis" || searchParams?.type === "ielts" ? searchParams.type : nType("ielts") || !nType("aptis") ? "ielts" : "aptis";
  const banks = inClass.filter((r) => r.exam_type === type && r.bank_id);
  const bank = banks.some((b) => b.bank_id === searchParams?.bank) ? searchParams.bank : "";
  const from = (searchParams?.from || "").slice(0, 10);
  const to = (searchParams?.to || "").slice(0, 10);

  let rows = cls ? await listForClass(cls, type, bank) : [];
  const fromT = from ? new Date(vnInputToIso(`${from}T00:00`)).getTime() : null;
  const toT = to ? new Date(vnInputToIso(`${to}T23:59`)).getTime() + 59999 : null;
  rows = rows.filter((r) => {
    const t = new Date(r.created_at).getTime();
    return (fromT === null || t >= fromT) && (toT === null || t <= toT);
  });

  const st = computeStats(rows, type);
  const banksInRows = new Set(rows.map((r) => r.content_bank_id).filter(Boolean));
  const singleTest = bank || banksInRows.size === 1;
  const hard = singleTest ? hardestQuestions(rows) : [];
  const aptis = type === "aptis";

  return (
    <div className="wrap-wide">
      <div className="topbar">
        <div>
          <p className="serif" style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Thống kê theo lớp</p>
          <p className="mono muted" style={{ fontSize: 13, margin: "4px 0 0" }}>
            {cls === NO_CLASS ? "Chưa phân lớp" : `Lớp ${cls}`} · {aptis ? "Aptis" : "IELTS"}{bank ? ` · ${banks.find((b) => b.bank_id === bank)?.bank_name}` : " · tất cả bài thi"}
          </p>
        </div>
        <a href={`/teacher${cls && cls !== NO_CLASS ? `?class=${encodeURIComponent(cls)}` : ""}`}><button className="btn-ghost btn-sm">← Bảng bài nộp</button></a>
      </div>

      <form className="card export-panel" method="get" style={{ marginBottom: 16 }}>
        <label>Lớp
          <select name="class" defaultValue={cls}>
            {classes.map((c) => <option key={c} value={c}>{c === NO_CLASS ? "Chưa phân lớp" : c}</option>)}
          </select>
        </label>
        <label>Loại bài
          <select name="type" defaultValue={type}>
            <option value="ielts">IELTS</option>
            <option value="aptis">Aptis</option>
          </select>
        </label>
        <label>Bài thi
          <select name="bank" defaultValue={bank}>
            <option value="">Tất cả bài thi</option>
            {banks.map((b) => <option key={b.bank_id} value={b.bank_id}>{b.bank_name || "(bộ đề đã xoá)"} ({b.n})</option>)}
          </select>
        </label>
        <label>Từ ngày<input type="date" name="from" defaultValue={from} className="date-input" /></label>
        <label>Đến ngày<input type="date" name="to" defaultValue={to} className="date-input" /></label>
        <button className="btn btn-sm" type="submit">Xem thống kê</button>
      </form>

      {rows.length === 0 ? (
        <div className="card"><p className="muted">Không có bài nộp nào phù hợp bộ lọc.</p></div>
      ) : (
        <>
          <div className="stat-tiles">
            <div className="stat-tile"><span>Bài nộp</span><b>{st.count}</b></div>
            <div className="stat-tile"><span>Học viên</span><b>{st.studentCount}</b></div>
            <div className="stat-tile"><span>Chưa chấm Writing</span><b className={st.ungraded ? "accent" : ""}>{st.ungraded}</b></div>
            <div className="stat-tile"><span>Cảnh báo giám sát</span><b className={st.integrity.high ? "danger" : ""}>{st.integrity.high + st.integrity.medium}</b></div>
          </div>

          <div className="stat-grid">
            <div className="card">
              <p className="mono muted stat-h">ĐIỂM THEO KỸ NĂNG{aptis ? " (THANG 0–50, ƯỚC TÍNH)" : ""}</p>
              {st.skills.length === 0 && (aptis || st.bands.length === 0) && <p className="muted" style={{ fontSize: 13 }}>Chưa có điểm nào (các bài chỉ có Writing và chưa được chấm).</p>}
              {st.skills.map((s) => (
                <div key={s.key} className="stat-skill">
                  <div className="row" style={{ gap: 8 }}>
                    <b>{s.label}</b>
                    <span className="stat-big">{s.avg}{s.unit === "%" ? "%" : <small>/50</small>}</span>
                  </div>
                  {s.raw && <p className="mono muted" style={{ fontSize: 12, margin: "2px 0" }}>trung bình {s.raw.avg}/{s.raw.total} câu</p>}
                  <Range s={s} />
                  {s.cefr && <Bars items={s.cefr} />}
                </div>
              ))}
              {!aptis && st.bands.map((b) => (
                <div key={b.label} className="stat-skill">
                  <div className="row" style={{ gap: 8 }}><b>{b.label}</b><span className="stat-big">{b.avg?.toFixed(1)}</span></div>
                  <Range s={b} />
                </div>
              ))}
            </div>

            <div className="card">
              {aptis ? (
                <>
                  <p className="mono muted stat-h">WRITING — ĐIỂM TRUNG BÌNH TỪNG PHẦN</p>
                  {st.writingParts.length ? (
                    <Bars items={st.writingParts.map((p) => ({ key: p.label, n: p.avg, max: p.max, text: `${p.avg}/${p.max}` }))} />
                  ) : <p className="muted" style={{ fontSize: 13 }}>Chưa có bài Writing nào được chấm.</p>}
                  {st.writingParts.length > 0 && <p className="mono muted" style={{ fontSize: 11.5 }}>Thang: P1 0–3 · P2, P3 0–5 · P4 0–6</p>}
                </>
              ) : (
                <>
                  <p className="mono muted stat-h">PHÂN BỐ BAND (band tổng nếu đã chấm, nếu chưa thì band trắc nghiệm)</p>
                  {st.bandDist.length ? <Bars items={st.bandDist} fmt={(k) => Number(k).toFixed(1)} /> : <p className="muted" style={{ fontSize: 13 }}>Chưa có band nào.</p>}
                  <p className="mono muted stat-h" style={{ marginTop: 18 }}>WRITING — TRUNG BÌNH 4 TIÊU CHÍ</p>
                  {st.criteriaByTask.length ? (
                    st.criteriaByTask.map((t) => (
                      <div key={t.title || "w"} style={{ marginBottom: 10 }}>
                        {t.title && <p style={{ margin: "6px 0 0", fontWeight: 700, fontSize: 13.5 }}>{t.title}</p>}
                        <Bars items={t.items.map((c) => ({ key: c.label, n: c.avg, max: 9, text: c.avg.toFixed(1) }))} />
                      </div>
                    ))
                  ) : <p className="muted" style={{ fontSize: 13 }}>Chưa có bài Writing nào được chấm theo 4 tiêu chí.</p>}
                </>
              )}
            </div>
          </div>

          <div className="card">
            <p className="mono muted stat-h">CÂU CẢ LỚP SAI NHIỀU NHẤT</p>
            {!singleTest ? (
              <p className="muted" style={{ fontSize: 13 }}>Chọn một bài thi cụ thể ở bộ lọc để xem câu sai nhiều nhất (các bài thi khác nhau có câu hỏi khác nhau).</p>
            ) : hard.length === 0 ? (
              <p className="muted" style={{ fontSize: 13 }}>Không có dữ liệu từng câu cho các bài này.</p>
            ) : (
              <table className="subs-table">
                <thead><tr><th>Kỹ năng</th><th>Câu</th><th>Nội dung</th><th>Tỷ lệ sai</th></tr></thead>
                <tbody>
                  {hard.map((h, i) => (
                    <tr key={i}>
                      <td>{h.skill}</td>
                      <td className="mono">{h.num}</td>
                      <td style={{ whiteSpace: "normal", minWidth: 260 }}>{h.text || <span className="muted">{h.section}</span>}</td>
                      <td style={{ minWidth: 160 }}>
                        <span className="stat-bar-track inline"><span className="stat-bar-fill bad" style={{ width: `${h.wrongPct}%` }} /></span>
                        <span className="mono" style={{ marginLeft: 8 }}>{h.wrongPct}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card">
            <p className="mono muted stat-h">TỪNG HỌC VIÊN QUA CÁC LẦN THI</p>
            <table className="subs-table">
              <thead><tr><th>Học viên</th><th>Số lần</th><th>Kết quả theo thời gian</th><th>Thay đổi</th></tr></thead>
              <tbody>
                {st.students.map((s) => (
                  <tr key={s.name}>
                    <td className="subs-name">{s.name}</td>
                    <td className="mono">{s.attempts.length}</td>
                    <td style={{ whiteSpace: "normal" }}>
                      {s.attempts.map((a, i) => (
                        <a key={a.id} href={`/teacher/${a.id}`} className="stat-attempt" title={a.bank}>
                          {i > 0 && <span className="muted"> → </span>}
                          <span className="mono muted" style={{ fontSize: 11 }}>{dateVN(a.date)}</span> <b>{a.label}</b>
                          {a.level && a.level !== "normal" && <span className={`integrity-pill ${a.level}`} style={{ marginLeft: 4 }}>⚠</span>}
                        </a>
                      ))}
                    </td>
                    <td className="mono">
                      {s.change === null ? "—" : <span className={s.change > 0 ? "success" : s.change < 0 ? "danger" : ""}>{s.change > 0 ? "+" : ""}{s.change}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mono muted" style={{ fontSize: 11.5, marginTop: 8 }}>
              {aptis ? "L/R/W: điểm thang 0–50 (L, R ước tính theo tỷ lệ câu đúng). Thay đổi = chênh lệch điểm trung bình giữa lần đầu và lần cuối." : "Band tổng nếu đã chấm Writing; * = chưa chấm Writing nên đang là band trắc nghiệm."}
            </p>
          </div>

          <div className="card">
            <p className="mono muted stat-h">GIÁM SÁT LÀM BÀI (CHẾ ĐỘ THI THỬ)</p>
            <p style={{ margin: "0 0 8px" }}>
              {st.integrity.monitored} bài có giám sát — <b className="success">{st.integrity.monitored - st.integrity.medium - st.integrity.high}</b> bình thường,{" "}
              <b style={{ color: "var(--gold)" }}>{st.integrity.medium}</b> cần lưu ý, <b className="danger">{st.integrity.high}</b> nghi vấn cao.
            </p>
            {st.integrity.flagged.length > 0 && (
              <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                {st.integrity.flagged.map((f) => (
                  <li key={f.id}><a href={`/teacher/${f.id}`}><b>{f.name}</b></a> <span className="muted">({dateVN(f.created_at)})</span>: {INTEGRITY_LABEL.high} — {integrityText(f.summary)}</li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
