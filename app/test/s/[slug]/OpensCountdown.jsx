"use client";

// Shown when a student opens a link before its opening time: counts down
// and reloads the page by itself when the test opens.
import { useEffect, useState } from "react";

export default function OpensCountdown({ opensAt, label }) {
  const target = new Date(opensAt).getTime();
  const [left, setLeft] = useState(null);

  useEffect(() => {
    const tick = () => {
      const ms = target - Date.now();
      if (ms <= 0) { window.location.reload(); return; }
      setLeft(ms);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [target]);

  const total = Math.max(0, Math.ceil((left ?? 0) / 1000));
  const d = Math.floor(total / 86400), h = Math.floor((total % 86400) / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  const p = (n) => String(n).padStart(2, "0");

  return (
    <div className="wrap">
      <div className="card card-strong" style={{ textAlign: "center", padding: 36 }}>
        <p className="mono muted" style={{ fontSize: 12, margin: 0 }}>BÀI THI CHƯA MỞ</p>
        <p className="serif" style={{ fontSize: 22, margin: "10px 0 4px" }}>Bài thi mở lúc {label}</p>
        <p className="mono" style={{ fontSize: 34, margin: "14px 0 6px", fontWeight: 700 }} suppressHydrationWarning>
          {left === null ? "…" : `${d > 0 ? `${d} ngày ` : ""}${p(h)}:${p(m)}:${p(s)}`}
        </p>
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>Giữ nguyên trang này — đến giờ trang sẽ tự mở bài thi.</p>
      </div>
    </div>
  );
}
