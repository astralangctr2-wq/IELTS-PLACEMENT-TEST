// Phrases the student highlighted while doing the test (Reading passage,
// Reading / Listening questions), shown with a few words around each.
export default function HighlightsCard({ highlights }) {
  const zones = Array.isArray(highlights) ? highlights.filter((h) => h.items?.length) : [];
  const n = zones.reduce((a, h) => a + h.items.length, 0);
  return (
    <details className="card hl-card" open={n > 0 && n <= 30}>
      <summary>
        <span className="mono muted" style={{ fontSize: 12 }}>HỌC VIÊN ĐÃ TÔ ĐẬM KHI LÀM BÀI</span>
        <b style={{ marginLeft: 8 }}>{n ? `${n} chỗ` : "không có"}</b>
      </summary>
      {n === 0 ? (
        <p className="muted" style={{ fontSize: 13, margin: "8px 0 0" }}>Học viên không tô đậm chỗ nào (hoặc bài nộp trước khi có tính năng này).</p>
      ) : (
        <div className="hl-zones">
          {zones.map((z, zi) => (
            <div key={zi}>
              <p className="hl-zone">{z.label}</p>
              <ol className="hl-list">
                {z.items.map((x, i) => (
                  <li key={i}>
                    <span className="muted">{x.b ? `…${x.b}` : ""}</span>
                    <mark className="hl-mark">{x.t}</mark>
                    <span className="muted">{x.a ? `${x.a}…` : ""}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </details>
  );
}
