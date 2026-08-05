"use client";

import { useEffect, useRef, useState } from "react";

export default function ContentEditor() {
  const [text, setText] = useState("");
  const [current, setCurrent] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    fetch("/api/content").then((r) => r.json()).then(setCurrent).catch(() => {});
  }, []);

  const downloadTemplate = async () => {
    const res = await fetch("/api/content");
    const data = await res.json();
    // strip ids and correct-answer values for a clean editable template,
    // while keeping each question's type and structure intact
    const strip = (q) => {
      const type = q.type || "mc";
      if (type === "mc") return { type: "mc", q: q.q, opts: q.opts, a: 0 };
      if (type === "multi_select") return { type: "multi_select", q: q.q, opts: q.opts, a: q.opts.slice(0, q.selectCount || 2).map((_, i) => i) };
      if (type === "gap") return { type: "gap", q: q.q, answers: [""] };
      return { q: q.q };
    };
    const stripSections = (sections, textKey) =>
      sections.map((sec) => ({
        title: sec.title || "",
        instructions: sec.instructions || "",
        [textKey]: sec[textKey],
        questions: sec.questions.map(strip),
      }));
    const template = {
      grammar: data.grammar.map(strip),
      reading: { sections: stripSections(data.reading.sections, "passage") },
      listening: { sections: stripSections(data.listening.sections, "script") },
      writing: { prompt: data.writing.prompt },
    };
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mau-bo-de-ielts.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const applyText = async (raw) => {
    setError("");
    setSuccess("");
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      setError("Không đọc được JSON. Kiểm tra lại định dạng.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/teacher/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không lưu được đề thi.");
      setSuccess("✓ Đã cập nhật đề thi. Học viên vào /test từ giờ sẽ làm bộ đề mới này.");
      const refreshed = await fetch("/api/content").then((r) => r.json());
      setCurrent(refreshed);
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => applyText(String(ev.target.result));
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div>
      {current && (
        <div className="card">
          <p className="mono muted" style={{ fontSize: 12, marginBottom: 8 }}>ĐỀ THI ĐANG DÙNG</p>
          <p>
            Ngữ pháp: {current.grammar.length} câu · Reading: {current.reading.sections.length} đoạn / {current.reading.sections.reduce((n, s) => n + s.questions.length, 0)} câu · Listening: {current.listening.sections.length} đoạn / {current.listening.sections.reduce((n, s) => n + s.questions.length, 0)} câu
          </p>
        </div>
      )}

      <div className="card stack">
        <p className="mono muted" style={{ fontSize: 12 }}>NẠP BỘ ĐỀ MỚI</p>
        <p className="muted" style={{ fontSize: 14 }}>Tải mẫu JSON, chỉnh nội dung theo đúng cấu trúc, rồi tải lên hoặc dán lại vào đây.</p>
        <div className="row" style={{ justifyContent: "flex-start", gap: 10 }}>
          <button className="btn-ghost btn-sm" onClick={downloadTemplate}>⬇ Tải mẫu JSON</button>
          <button className="btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>⬆ Tải file JSON lên</button>
          <input ref={fileRef} type="file" accept=".json,application/json" onChange={handleFile} style={{ display: "none" }} />
        </div>
        <textarea style={{ minHeight: 160, fontFamily: "var(--font-mono)", fontSize: 12 }} placeholder='{"grammar": [...], "reading": {...}, "listening": {...}, "writing": {...}}' value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn" disabled={!text.trim() || saving} onClick={() => applyText(text)}>{saving ? "Đang lưu…" : "Dùng bộ đề này →"}</button>
        {error && <p className="accent">⚠ {error}</p>}
        {success && <p className="success">{success}</p>}
      </div>
    </div>
  );
}
