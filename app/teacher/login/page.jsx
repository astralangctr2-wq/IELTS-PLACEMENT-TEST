"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TeacherLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

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
      router.push("/teacher");
      router.refresh();
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="wrap">
      <div className="topbar">
        <p className="serif" style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Đăng nhập Giáo viên</p>
      </div>
      <form onSubmit={submit} className="card card-strong stack">
        <div>
          <p style={{ marginBottom: 8 }}>Mật khẩu:</p>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        </div>
        {error && <p className="accent">{error}</p>}
        <button className="btn" type="submit" disabled={loading || !password}>
          {loading ? "Đang kiểm tra…" : "Đăng nhập →"}
        </button>
      </form>
    </div>
  );
}
