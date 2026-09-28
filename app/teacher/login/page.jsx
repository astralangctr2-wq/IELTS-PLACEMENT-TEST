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

  return (
    <form onSubmit={submit} className="card card-strong stack" style={{ margin: 0 }}>
      <p className="mono muted" style={{ margin: 0, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Khu vực Giáo viên
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
