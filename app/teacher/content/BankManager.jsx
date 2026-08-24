"use client";

import { useRef, useState } from "react";

const CATEGORY_LABELS = { placement: "Placement Test", midterm: "Mid-term Test", mock: "Mock Test", final: "Final Test", other: "Khác" };
const CATEGORY_ORDER = ["placement", "midterm", "mock", "final", "other"];

function stripQuestion(q) {
  const type = q.type || "mc";
  if (type === "mc") return { type: "mc", q: q.q, opts: q.opts, a: 0 };
  if (type === "multi_select") return { type: "multi_select", q: q.q, opts: q.opts, a: q.opts.slice(0, q.selectCount || 2).map((_, i) => i) };
  if (type === "gap") return { type: "gap", q: q.q, answers: [""] };
  return { q: q.q };
}

function downloadJSON(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function CategorySelect({ value, onChange, disabled }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} style={{ width: "auto" }}>
      {CATEGORY_ORDER.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
    </select>
  );
}

function BankRow({ bank, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [name, setName] = useState(bank.name);
  const [category, setCategory] = useState(bank.category || "other");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const fileRef = useRef(null);

  const openEditor = async () => {
    setEditing(true);
    setError("");
    setSuccess("");
    if (text) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/teacher/banks/${bank.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không tải được nội dung.");
      setText(JSON.stringify(data.content, null, 2));
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const save = async () => {
    setError("");
    setSuccess("");
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      setError("Không đọc được JSON. Kiểm tra lại định dạng.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/teacher/banks/${bank.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: parsed, name, category }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không lưu được.");
      setSuccess("✓ Đã lưu.");
      onChanged();
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setText(String(ev.target.result));
    reader.readAsText(file);
    e.target.value = "";
  };

  const remove = async () => {
    if (!confirm(`Xoá bộ đề "${bank.name}"? Không thể hoàn tác.`)) return;
    const res = await fetch(`/api/teacher/banks/${bank.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Không xoá được.");
      return;
    }
    onChanged();
  };

  return (
    <div className="card">
      <div className="row" style={{ alignItems: "flex-start" }}>
        <div>
          <p style={{ fontWeight: 700, marginBottom: 4 }}>{bank.name}</p>
          <p className="mono muted" style={{ fontSize: 12 }}>
            Ngữ pháp: {bank.grammarCount ?? "—"} câu · Reading: {bank.readingCount ?? "—"} câu · Listening: {bank.listeningCount ?? "—"} câu · Writing: {bank.hasWriting ? "có" : "—"}
          </p>
        </div>
        <div className="row" style={{ gap: 6, justifyContent: "flex-end", width: "auto" }}>
          {!editing && <button className="btn-ghost btn-sm" onClick={openEditor}>Sửa nội dung</button>}
          <button className="btn-ghost btn-sm" onClick={remove}>Xoá</button>
        </div>
      </div>

      {editing && (
        <div style={{ marginTop: 14 }}>
          <p style={{ marginBottom: 6 }}>Tên bộ đề:</p>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={{ marginBottom: 12 }} />
          <p style={{ marginBottom: 6 }}>Loại bài test:</p>
          <div style={{ marginBottom: 12 }}><CategorySelect value={category} onChange={setCategory} /></div>
          <div className="row" style={{ justifyContent: "flex-start", gap: 10, marginBottom: 10 }}>
            <button className="btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>⬆ Tải file JSON lên</button>
            <input ref={fileRef} type="file" accept=".json,application/json" onChange={handleFile} style={{ display: "none" }} />
          </div>
          {loading && !text ? (
            <p className="muted">Đang tải…</p>
          ) : (
            <textarea style={{ minHeight: 220, fontFamily: "var(--font-mono)", fontSize: 12 }} value={text} onChange={(e) => setText(e.target.value)} />
          )}
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn-ghost btn-sm" onClick={() => setEditing(false)}>Đóng</button>
            <button className="btn" disabled={loading} onClick={save}>{loading ? "Đang lưu…" : "Lưu thay đổi →"}</button>
          </div>
          {error && <p className="accent" style={{ marginTop: 8 }}>⚠ {error}</p>}
          {success && <p className="success" style={{ marginTop: 8 }}>{success}</p>}
        </div>
      )}
    </div>
  );
}

export default function BankManager({ initialBanks }) {
  const [banks, setBanks] = useState(initialBanks);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("other");
  const [newText, setNewText] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const fileRef = useRef(null);

  const refresh = async () => {
    const res = await fetch("/api/teacher/banks");
    const data = await res.json();
    if (res.ok) {
      setBanks(
        data.banks.map((b) => ({
          id: b.id,
          name: b.name,
          category: b.category,
          created_at: b.created_at,
          grammarCount: b.content.grammar?.length ?? null,
          readingCount: b.content.reading ? b.content.reading.sections.reduce((n, s) => n + s.questions.length, 0) : null,
          listeningCount: b.content.listening ? b.content.listening.sections.reduce((n, s) => n + s.questions.length, 0) : null,
          hasWriting: Boolean(b.content.writing),
        }))
      );
    }
  };

  const downloadTemplate = async () => {
    const first = banks[0];
    const url = first ? `/api/content?bank=${first.id}` : null;
    if (!url) {
      alert("Chưa có bộ đề nào để làm mẫu — dán JSON theo cấu trúc trong hướng dẫn bên dưới.");
      return;
    }
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    const stripReading = (sections) =>
      sections.map((sec) => ({ title: sec.title || "", instructions: sec.instructions || "", passage: sec.passage, questions: sec.questions.map(stripQuestion) }));
    const stripListening = (sections) =>
      sections.map((sec) => ({ title: sec.title || "", instructions: sec.instructions || "", script: sec.script || "", audioUrl: sec.audioUrl || "", questions: sec.questions.map(stripQuestion) }));
    const template = {
      grammar: data.grammar ? data.grammar.map(stripQuestion) : undefined,
      reading: data.reading ? { sections: stripReading(data.reading.sections) } : undefined,
      listening: data.listening ? { sections: stripListening(data.listening.sections) } : undefined,
      writing: data.writing ? { prompt: data.writing.prompt } : undefined,
    };
    downloadJSON(template, "mau-bo-de-ielts.json");
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setNewText(String(ev.target.result));
    reader.readAsText(file);
    e.target.value = "";
  };

  const createBank = async () => {
    setCreateError("");
    setCreateSuccess("");
    let parsed;
    try {
      parsed = JSON.parse(newText);
    } catch {
      setCreateError("Không đọc được JSON. Kiểm tra lại định dạng.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/teacher/banks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() || "Bộ đề mới", content: parsed, category: newCategory }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không tạo được bộ đề.");
      setCreateSuccess("✓ Đã tạo bộ đề mới. Vào Tạo link phiên thi để gửi link cho học viên.");
      setNewName("");
      setNewText("");
      await refresh();
    } catch (err) {
      setCreateError(err.message);
    }
    setCreating(false);
  };

  const grouped = CATEGORY_ORDER.map((cat) => ({ cat, items: banks.filter((b) => (b.category || "other") === cat) })).filter((g) => g.items.length > 0);

  return (
    <div>
      {grouped.length === 0 ? (
        <div className="card"><p className="muted">Chưa có bộ đề nào — tạo bộ đề đầu tiên ở form bên dưới.</p></div>
      ) : (
        grouped.map(({ cat, items }) => (
          <div key={cat} style={{ marginBottom: 24 }}>
            <p className="mono muted" style={{ fontSize: 12, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>{CATEGORY_LABELS[cat]}</p>
            <div className="stack">
              {items.map((b) => <BankRow key={b.id} bank={b} onChanged={refresh} />)}
            </div>
          </div>
        ))
      )}

      <div className="card stack">
        <p className="mono muted" style={{ fontSize: 12 }}>TẠO BỘ ĐỀ MỚI</p>
        <p className="muted" style={{ fontSize: 14 }}>Tải mẫu JSON, chỉnh nội dung theo đúng cấu trúc, rồi tải lên hoặc dán vào đây để lưu thành 1 bộ đề riêng — không ảnh hưởng tới các bộ đề đang có.</p>
        <p className="muted" style={{ fontSize: 12 }}>Mẹo: gạch chân 1 từ trong bài đọc bằng cách bọc quanh nó hai dấu gạch dưới, vd <code>__nurture__</code>. Dòng bắt đầu bằng <code># </code> là tiêu đề đậm, <code>## </code> là nhãn tiểu mục đậm. Với Listening, dán link chia sẻ Google Drive vào <code>audioUrl</code> — hệ thống tự chuyển thành link phát được (khuyến nghị dùng file mp3 đặt trong <code>public/</code> để tránh lỗi CORS của Drive).</p>
        <div className="row" style={{ gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <p style={{ marginBottom: 6 }}>Tên bộ đề:</p>
            <input type="text" placeholder="Vd: Practice Test 1" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
          <div>
            <p style={{ marginBottom: 6 }}>Loại bài test:</p>
            <CategorySelect value={newCategory} onChange={setNewCategory} />
          </div>
        </div>
        <div className="row" style={{ justifyContent: "flex-start", gap: 10 }}>
          <button className="btn-ghost btn-sm" onClick={downloadTemplate}>⬇ Tải mẫu JSON</button>
          <button className="btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>⬆ Tải file JSON lên</button>
          <input ref={fileRef} type="file" accept=".json,application/json" onChange={handleFile} style={{ display: "none" }} />
        </div>
        <textarea style={{ minHeight: 160, fontFamily: "var(--font-mono)", fontSize: 12 }} placeholder='{"grammar": [...], "reading": {...}, "listening": {...}, "writing": {...}}' value={newText} onChange={(e) => setNewText(e.target.value)} />
        <button className="btn" disabled={!newText.trim() || creating} onClick={createBank}>{creating ? "Đang tạo…" : "Tạo bộ đề →"}</button>
        {createError && <p className="accent">⚠ {createError}</p>}
        {createSuccess && <p className="success">{createSuccess}</p>}
      </div>
    </div>
  );
}
