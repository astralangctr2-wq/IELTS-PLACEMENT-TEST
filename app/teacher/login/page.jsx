"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CENTER_NAME, LOGO_URL } from "@/lib/branding";

function LoginForm() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/teacher";

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/teacher/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Đăng nhập thất bại.");
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const gErr = { not_teacher: "Gmail này chưa được admin cấp quyền giáo viên (hoặc đã bị tắt). Liên hệ admin.", config: "Đăng nhập Google chưa được cài trên máy chủ — liên hệ admin.", state: "Phiên đăng nhập hết hạn, thử lại.", cancelled: "Bạn đã huỷ đăng nhập Google.", google: "Google không xác nhận được tài khoản, thử lại." }[searchParams.get("error") || ""];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    <div className="card card-strong stack" style={{ margin: 0 }}>
      <p className="mono muted" style={{ margin: 0, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Giáo viên
      </p>
      <a className="btn-google" href={`/api/auth/google/start?next=${encodeURIComponent(redirectTo)}`}>
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
        Đăng nhập bằng Google
      </a>
      <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>Dùng Gmail admin đã cấp quyền.</p>
      {gErr && <p className="accent" style={{ margin: 0 }}>{gErr}</p>}
    </div>
    <form onSubmit={submit} className="card card-strong stack" style={{ margin: 0 }}>
      <p className="mono muted" style={{ margin: 0, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Admin
      </p>
      <div>
        <p style={{ marginBottom: 8 }}>Mật khẩu:</p>
        <div style={{ position: "relative" }}>
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            style={{ paddingRight: 70 }}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="mono muted"
            style={{
              position: "absolute",
              right: 6,
              top: "50%",
              transform: "translateY(-50%)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              padding: "6px 8px",
            }}
          >
            {showPassword ? "Ẩn" : "Hiện"}
          </button>
        </div>
      </div>
      {error && <p className="accent">{error}</p>}
      <button className="btn" type="submit" disabled={loading || !password}>
        {loading ? "Đang kiểm tra…" : "Đăng nhập →"}
      </button>
    </form>
    </div>
  );
}

export default function TeacherLoginPage() {
  return (
    <div className="wrap" style={{ display: "flex", flexDirection: "column", minHeight: "70vh", justifyContent: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 28 }}>
        {LOGO_URL && <img src={LOGO_URL} alt={CENTER_NAME} style={{ height: 30, width: "auto" }} />}
        <span className="serif" style={{ fontWeight: 700, fontSize: 17 }}>{CENTER_NAME}</span>
      </div>
      <Suspense fallback={<div className="card"><p className="muted">Đang tải…</p></div>}>
        <LoginForm />
      </Suspense>
      <div style={{ textAlign: "center", marginTop: 20 }}>
        <Link href="/" className="mono muted" style={{ fontSize: 13 }}>← Về trang chủ</Link>
      </div>
    </div>
  );
}
