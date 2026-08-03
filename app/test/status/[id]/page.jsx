"use client";

import { useEffect, useState } from "react";

export default function StatusPage({ params }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/submissions/${params.id}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Không tìm thấy bài làm.");
        setData(d);
      })
      .catch((e) => setError(e.message));
  }, [params.id]);

  return (
    <div className="wrap">
      <div className="topbar">
        <p className="serif" style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Kết quả bài test</p>
      </div>

      {error && <div className="card"><p className="accent">{error}</p></div>}

      {data && (
        <div>
          <div className="card card-strong">
            <p className="mono muted" style={{ fontSize: 12 }}>{data.student_name}</p>
            {data.graded ? (
              <>
                <p className="serif" style={{ fontSize: 44, margin: "8px 0", fontWeight: 700 }}>{Number(data.final_band).toFixed(1)}</p>
                <p className="mono success" style={{ fontSize: 13 }}>Đã được giáo viên chấm điểm</p>
              </>
            ) : (
              <>
                <p className="serif" style={{ fontSize: 20, margin: "8px 0" }}>Đang chờ giáo viên chấm Writing…</p>
                <p className="muted" style={{ fontSize: 13 }}>Quay lại link này sau để xem kết quả cuối cùng.</p>
              </>
            )}
          </div>

          <div className="card stack">
            <p className="mono muted" style={{ fontSize: 12 }}>ĐIỂM TỰ ĐỘNG</p>
            <p>Ngữ pháp: <b>{data.grammar_score}/{data.grammar_total}</b></p>
            <p>Reading: <b>{data.reading_score}/{data.reading_total}</b></p>
            <p>Listening: <b>{data.listening_score}/{data.listening_total}</b></p>
          </div>

          {data.graded && (
            <div className="card stack">
              <p className="mono muted" style={{ fontSize: 12 }}>WRITING</p>
              <p>Band Writing: <b>{Number(data.writing_band).toFixed(1)}</b></p>
              {data.writing_feedback && <p style={{ lineHeight: 1.6 }}>{data.writing_feedback}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
