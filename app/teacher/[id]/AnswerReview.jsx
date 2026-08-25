function OptionRow({ opt, index, chosen, correct }) {
  const isChosen = chosen === index;
  const isCorrect = correct === index;
  let bg = "transparent";
  let border = "var(--grid)";
  if (isCorrect) { bg = "rgba(47,111,99,0.12)"; border = "var(--success)"; }
  if (isChosen && !isCorrect) { bg = "rgba(225,89,107,0.14)"; border = "var(--danger)"; }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px", border: `1px solid ${border}`, background: bg, marginBottom: 4 }}>
      <span className="mono" style={{ fontSize: 11, width: 16 }}>{String.fromCharCode(65 + index)}</span>
      <span style={{ fontSize: 13 }}>{opt}</span>
      {isChosen && <span className="mono" style={{ fontSize: 11, marginLeft: "auto" }} title="Học viên chọn">HV chọn</span>}
      {isCorrect && <span className="mono success" style={{ fontSize: 11, marginLeft: isChosen ? 8 : "auto" }}>✓ Đáp án đúng</span>}
    </div>
  );
}

function MultiSelectReview({ opts, chosen, correct }) {
  const chosenArr = Array.isArray(chosen) ? chosen : [];
  return (
    <div>
      {opts.map((opt, oi) => {
        const isChosen = chosenArr.includes(oi);
        const isCorrect = correct.includes(oi);
        let bg = "transparent";
        let border = "var(--grid)";
        if (isCorrect) { bg = "rgba(47,111,99,0.12)"; border = "var(--success)"; }
        if (isChosen && !isCorrect) { bg = "rgba(225,89,107,0.14)"; border = "var(--danger)"; }
        return (
          <div key={oi} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px", border: `1px solid ${border}`, background: bg, marginBottom: 4 }}>
            <span className="mono" style={{ fontSize: 11, width: 16 }}>{String.fromCharCode(65 + oi)}</span>
            <span style={{ fontSize: 13 }}>{opt}</span>
            {isChosen && <span className="mono" style={{ fontSize: 11, marginLeft: "auto" }}>HV chọn</span>}
            {isCorrect && <span className="mono success" style={{ fontSize: 11, marginLeft: isChosen ? 8 : "auto" }}>✓ Đúng</span>}
          </div>
        );
      })}
    </div>
  );
}

function GapReview({ chosen, answers }) {
  return (
    <div style={{ fontSize: 13 }}>
      <p className="muted" style={{ margin: "2px 0" }}>HV trả lời: <b>{chosen && String(chosen).trim() ? chosen : "(để trống)"}</b></p>
      <p className="muted" style={{ margin: "2px 0" }}>Đáp án đúng: <b className="success">{Array.isArray(answers) ? answers.join(" / ") : ""}</b></p>
    </div>
  );
}

function isRightAnswer(type, chosen, q) {
  if (type === "mc") return chosen === q.a;
  if (type === "gap") {
    const norm = (s) => (s ?? "").toString().trim().toLowerCase();
    return Array.isArray(q.answers) && q.answers.some((acc) => norm(acc) === norm(chosen));
  }
  if (type === "multi_select") {
    const required = Array.isArray(q.a) ? q.a : [];
    const chosenArr = Array.isArray(chosen) ? chosen : [];
    const correctCount = chosenArr.filter((x) => required.includes(x)).length;
    return correctCount === required.length && chosenArr.length === required.length;
  }
  return false;
}

export default function AnswerReview({ title, questions, answers }) {
  if (!questions || questions.length === 0) return null;
  let lastSection = null;
  return (
    <div className="card">
      <p className="mono muted" style={{ fontSize: 12, marginBottom: 10 }}>{title}</p>
      <div className="stack">
        {questions.map((q, i) => {
          const type = q.type || "mc";
          const chosen = answers ? answers[q.id] : undefined;
          const isRight = isRightAnswer(type, chosen, q);
          const showSectionHeader = q.sectionTitle && q.sectionTitle !== lastSection;
          if (showSectionHeader) lastSection = q.sectionTitle;

          return (
            <div key={q.id ?? i}>
              {showSectionHeader && (
                <p className="mono" style={{ fontSize: 11, marginTop: i > 0 ? 16 : 0, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>{q.sectionTitle}</p>
              )}
              <p style={{ fontSize: 13, marginBottom: 6 }}>
                <span className="mono muted">Câu {i + 1}.</span> {q.q}{" "}
                {isRight ? <span className="success mono" style={{ fontSize: 11 }}>ĐÚNG</span> : <span className="danger mono" style={{ fontSize: 11 }}>SAI</span>}
              </p>
              {type === "mc" && q.opts.map((opt, oi) => (
                <OptionRow key={oi} opt={opt} index={oi} chosen={chosen} correct={q.a} />
              ))}
              {type === "multi_select" && <MultiSelectReview opts={q.opts} chosen={chosen} correct={q.a} />}
              {type === "gap" && <GapReview chosen={chosen} answers={q.answers} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
