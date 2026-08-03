function OptionRow({ opt, index, chosen, correct }) {
  const isChosen = chosen === index;
  const isCorrect = correct === index;
  let bg = "transparent";
  let border = "var(--grid)";
  if (isCorrect) { bg = "rgba(47,111,99,0.12)"; border = "var(--success)"; }
  if (isChosen && !isCorrect) { bg = "rgba(180,57,44,0.12)"; border = "var(--accent)"; }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px", border: `1px solid ${border}`, background: bg, marginBottom: 4 }}>
      <span className="mono" style={{ fontSize: 11, width: 16 }}>{String.fromCharCode(65 + index)}</span>
      <span style={{ fontSize: 13 }}>{opt}</span>
      {isChosen && <span className="mono" style={{ fontSize: 11, marginLeft: "auto" }} title="Học viên chọn">HV chọn</span>}
      {isCorrect && <span className="mono success" style={{ fontSize: 11, marginLeft: isChosen ? 8 : "auto" }}>✓ Đáp án đúng</span>}
    </div>
  );
}

export default function AnswerReview({ title, questions, answers }) {
  if (!questions || questions.length === 0) return null;
  return (
    <div className="card">
      <p className="mono muted" style={{ fontSize: 12, marginBottom: 10 }}>{title}</p>
      <div className="stack">
        {questions.map((q, i) => {
          const chosen = answers ? answers[q.id] : undefined;
          const isRight = chosen === q.a;
          return (
            <div key={q.id ?? i}>
              <p style={{ fontSize: 13, marginBottom: 6 }}>
                <span className="mono muted">Câu {i + 1}.</span> {q.q}{" "}
                {isRight ? <span className="success mono" style={{ fontSize: 11 }}>ĐÚNG</span> : <span className="accent mono" style={{ fontSize: 11 }}>SAI</span>}
              </p>
              {q.opts.map((opt, oi) => (
                <OptionRow key={oi} opt={opt} index={oi} chosen={chosen} correct={q.a} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
