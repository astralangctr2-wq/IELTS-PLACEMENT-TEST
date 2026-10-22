"use client";

import { useEffect, useRef, useState } from "react";

const SKILL = { reading: "Reading", listening: "Listening" };

// Teacher panel of a bank's answer-review link ("link chữa bài"): one link
// per bank, shared with every class that took this test. Upload the
// explanations (JSON), preview, then publish when all classes have taken it.
export default function ReviewPanel({ bankId }) {
  const [r, setR] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const fileRef = useRef(null);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const call = async (body) => {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/teacher/banks/${bankId}/review`, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Lỗi.");
      setR(j);
      return j;
    } catch (e) {
      setMsg(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => { call(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [bankId]);

  const upload = async (file) => {
    if (!file) return;
    let data;
    try { data = JSON.parse(await file.text()); } catch { setMsg("File không phải JSON hợp lệ."); return; }
    const j = await call({ data });
    if (j) setMsg("✓ Đã cập nhật nội dung chữa bài.");
  };

  if (!r) return <div className="rvp"><span className="muted">{msg || "Đang tải…"}</span></div>;
  const link = r.slug ? `${origin}/chua-bai/${r.slug}` : "";
  const cov = Object.entries(r.coverage || {});

  return (
    <div className="rvp">
      <p style={{ margin: 0, fontWeight: 700 }}>📖 Link chữa bài (dùng chung cho mọi lớp thi đề này)</p>
      <div className="rvp-row" style={{ fontSize: 13.5 }}>
        {cov.length ? cov.map(([k, c]) => (
          <span key={k}>{SKILL[k]}: <b>{c.explained}/{c.questions}</b> câu có giải thích{k === "listening" ? ` · transcript ${c.transcripts} phần` : ""}</span>
        )) : <span className="muted">Bộ đề không có Reading/Listening.</span>}
      </div>
      {link ? (
        <div className="rvp-row">
          <span className="rvp-link">{link}</span>
          <button className="btn-ghost btn-sm" onClick={async () => { try { await navigator.clipboard.writeText(link); } catch { window.prompt("Copy link:", link); } setCopied(true); setTimeout(() => setCopied(false), 2000); }}>{copied ? "Đã copy ✓" : "Copy link"}</button>
          <a href={`/chua-bai/${r.slug}?preview=1`} target="_blank" rel="noreferrer"><button className="btn-ghost btn-sm">Xem trước ↗</button></a>
        </div>
      ) : <p className="muted" style={{ margin: 0, fontSize: 13 }}>Chưa có link — tải file chữa bài lên hoặc bấm “Tạo link”.</p>}
      <div className="rvp-row">
        {r.slug ? (
          <button className={r.published ? "btn-ghost btn-sm" : "btn btn-sm"} disabled={busy} onClick={() => call({ published: !r.published })}>
            {r.published ? "Ẩn đáp án (huỷ công bố)" : "Công bố cho học viên"}
          </button>
        ) : (
          <button className="btn-ghost btn-sm" disabled={busy} onClick={() => call({ published: false })}>Tạo link</button>
        )}
        <span className={`state-chip ${r.published ? "done" : "off"}`}>{r.published ? "Đang công bố" : "Chưa công bố"}</span>
        <button className="btn-ghost btn-sm" disabled={busy} onClick={() => fileRef.current?.click()}>⬆ Tải file chữa bài (.json)</button>
        <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: "none" }} onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
      {msg && <p className={msg.startsWith("✓") ? "success" : "accent"} style={{ margin: 0, fontSize: 13 }}>{msg}</p>}
      <p className="muted" style={{ margin: 0, fontSize: 12 }}>Còn lớp chưa thi đề này thì đừng công bố. Học viên nhập đúng tên + lớp lúc thi sẽ thấy cả bài làm của mình, câu sai được đánh dấu.</p>
    </div>
  );
}
