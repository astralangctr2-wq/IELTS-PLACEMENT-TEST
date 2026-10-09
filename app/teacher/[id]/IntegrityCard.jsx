import { INTEGRITY_LABEL, integrityText } from "@/lib/integrity";

const TYPE = {
  fullscreen_exit: "Thoát toàn màn hình",
  tab_leave: "Rời trang (chuyển tab / ứng dụng)",
  tab_return: "Quay lại trang",
  paste_blocked: "Thử dán vào Writing (đã chặn)",
};
const SKILL = { grammar: "Ngữ pháp", reading: "Reading", listening: "Listening", writing: "Writing" };

const mmss = (ms) => {
  const t = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

// Teacher-only view of the exam-mode integrity log of one submission.
export default function IntegrityCard({ integrity }) {
  if (!integrity?.summary) {
    return (
      <div className="card">
        <p className="mono muted" style={{ fontSize: 12, marginBottom: 6 }}>GIÁM SÁT LÀM BÀI</p>
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>Không có dữ liệu giám sát — bài làm ở chế độ luyện tập, hoặc nộp trước khi tính năng này được bật.</p>
      </div>
    );
  }
  const s = integrity.summary;
  const start = integrity.startedAt || integrity.events?.[0]?.t || 0;
  return (
    <div className={`card integrity-card ${s.level}`}>
      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        <p className="mono muted" style={{ fontSize: 12, margin: 0 }}>GIÁM SÁT LÀM BÀI</p>
        <span className={`integrity-pill ${s.level}`}>{INTEGRITY_LABEL[s.level]}</span>
      </div>
      <p style={{ margin: "10px 0 0" }}>{s.incidents === 0 && !s.pasteBlocked ? "Không ghi nhận lần nào rời bài hay thử dán." : integrityText(s) + "."}</p>
      {!s.fullscreenSupported && <p className="muted" style={{ fontSize: 12, margin: "6px 0 0" }}>Thiết bị không hỗ trợ toàn màn hình (thường là iPhone) — chỉ ghi được việc rời trang.</p>}
      {integrity.events?.length > 0 && (
        <details style={{ marginTop: 10 }}>
          <summary className="mono" style={{ fontSize: 12, cursor: "pointer" }}>Dòng thời gian ({integrity.events.length} sự kiện)</summary>
          <table style={{ marginTop: 8, fontSize: 13 }}>
            <thead><tr><th>Phút</th><th>Phần</th><th>Sự kiện</th></tr></thead>
            <tbody>
              {integrity.events.map((e, i) => (
                <tr key={i}>
                  <td className="mono">{mmss(e.t - start)}</td>
                  <td>{SKILL[e.skill] || e.skill || "—"}</td>
                  <td>
                    {TYPE[e.type] || e.type}
                    {e.ms ? ` — vắng ${mmss(e.ms)}` : ""}
                    {e.chars ? ` — ${e.chars} ký tự` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}
