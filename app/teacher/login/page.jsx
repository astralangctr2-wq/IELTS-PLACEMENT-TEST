"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CENTER_NAME, LOGO_URL } from "@/lib/branding";

const FEATURES = [
  {
    icon: "🎯",
    title: "Chấm điểm tự động",
    desc: "Reading & Listening được chấm tức thì, chính xác tuyệt đối ngay khi học viên nộp bài.",
  },
  {
    icon: "✍️",
    title: "Chấm Writing thủ công",
    desc: "Giáo viên xem trực tiếp bài viết của học viên và cho điểm, nhận xét chi tiết từng bài.",
  },
  {
    icon: "📚",
    title: "Ngân hàng đề đa dạng",
    desc: "IELTS, Aptis ESOL và nhiều bộ đề khác — dễ dàng thêm mới, phân loại theo lớp học.",
  },
  {
    icon: "📊",
    title: "Theo dõi bài nộp",
    desc: "Xem toàn bộ bài học viên đã nộp, band điểm, lịch sử làm bài theo từng buổi thi.",
  },
  {
    icon: "🗂️",
    title: "Quản lý theo lớp",
    desc: "Phân loại bộ đề theo tên lớp, tạo buổi thi riêng cho từng nhóm học viên.",
  },
  {
    icon: "🔊",
    title: "Nghe – Nói – Đọc – Viết",
    desc: "Đầy đủ 4 kỹ năng trong một nền tảng, giao diện tiếng Việt thân thiện.",
  },
];

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
    <div className="landing">
      {/* Nav */}
      <nav className="landing-nav">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {LOGO_URL && <img src={LOGO_URL} alt={CENTER_NAME} style={{ height: 30, width: "auto" }} />}
          <span className="serif" style={{ fontWeight: 700, fontSize: 17 }}>Astra Test Platform</span>
        </div>
        <a href="#login" className="btn-ghost btn-sm">Đăng nhập Giáo viên</a>
      </nav>

      {/* Hero */}
      <header className="landing-hero">
        <p className="mono muted" style={{ fontSize: 13, marginBottom: 14, letterSpacing: "0.04em" }}>
          🌟 Nền tảng luyện thi nội bộ dành cho học viên Astra
        </p>
        <h1 className="serif" style={{ fontSize: "clamp(28px, 5vw, 44px)", lineHeight: 1.2, margin: "0 0 18px", maxWidth: 760 }}>
          Luyện thi IELTS &amp; Aptis ESOL ngay trên nền tảng của trung tâm
        </h1>
        <p className="muted" style={{ fontSize: 16, maxWidth: 600, lineHeight: 1.7, marginBottom: 28 }}>
          Hệ thống kiểm tra trình độ và luyện đề dành riêng cho học viên Astra Language &amp; IT Center — chấm điểm tự động Reading &amp; Listening, giáo viên chấm Writing trực tiếp và theo dõi tiến trình từng lớp học.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <a href="#login" className="btn">Đăng nhập Giáo viên →</a>
          <a href="/test" className="btn-ghost">Vào làm bài thi</a>
        </div>
      </header>

      {/* Features */}
      <section className="landing-section">
        <h2 className="serif" style={{ fontSize: 24, marginBottom: 8 }}>Vì sao dùng nền tảng này?</h2>
        <p className="muted" style={{ marginBottom: 28 }}>Mọi công cụ giáo viên cần để tổ chức thi và chấm bài, trong một hệ thống duy nhất.</p>
        <div className="feature-grid">
          {FEATURES.map((f, i) => (
            <div key={i} className="feature-card">
              <div style={{ fontSize: 26, marginBottom: 10 }}>{f.icon}</div>
              <h3 style={{ fontSize: 16, margin: "0 0 6px" }}>{f.title}</h3>
              <p className="muted" style={{ fontSize: 13.5, margin: 0, lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Login */}
      <section id="login" className="landing-login">
        <div style={{ maxWidth: 420, width: "100%" }}>
          <Suspense fallback={<div className="card"><p className="muted">Đang tải…</p></div>}>
            <LoginForm />
          </Suspense>
        </div>
      </section>

      {/* Footer — Astra Language & IT Center info */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            {LOGO_URL && <img src={LOGO_URL} alt={CENTER_NAME} style={{ height: 26, width: "auto" }} />}
            <span className="serif" style={{ fontWeight: 700, fontSize: 15 }}>{CENTER_NAME}</span>
          </div>
          <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.7, maxWidth: 520, margin: "0 0 16px" }}>
            Trung tâm hướng đến môi trường đào tạo đa ngôn ngữ đầy hứng khởi và hiệu quả, giúp học viên tự tin bước đi trên hành trình khám phá thế giới và chinh phục ước mơ.
          </p>
          <div className="landing-footer-grid">
            <div>
              <p className="mono muted" style={{ fontSize: 11, textTransform: "uppercase", marginBottom: 6 }}>Địa chỉ</p>
              <p style={{ fontSize: 13.5, margin: 0, lineHeight: 1.6 }}>
                Lô BN2-LK28, đường N1, Khu phố Vinh Thạnh,<br />Phường Trấn Biên, Tỉnh Đồng Nai, Việt Nam
              </p>
            </div>
            <div>
              <p className="mono muted" style={{ fontSize: 11, textTransform: "uppercase", marginBottom: 6 }}>Liên hệ</p>
              <p style={{ fontSize: 13.5, margin: 0, lineHeight: 1.6 }}>
                <a href="tel:0909911922">+84 909 911 922</a><br />
                <a href="mailto:info@astra.edu.vn">info@astra.edu.vn</a>
              </p>
            </div>
            <div>
              <p className="mono muted" style={{ fontSize: 11, textTransform: "uppercase", marginBottom: 6 }}>Kết nối</p>
              <p style={{ fontSize: 13.5, margin: 0, lineHeight: 1.6 }}>
                <a href="https://astra.edu.vn" target="_blank" rel="noopener noreferrer">astra.edu.vn</a><br />
                <a href="https://www.facebook.com/astra.education.vn" target="_blank" rel="noopener noreferrer">Facebook</a>
                {" · "}
                <a href="https://zalo.me/0909911922" target="_blank" rel="noopener noreferrer">Zalo</a>
              </p>
            </div>
          </div>
          <div className="landing-footer-bottom">
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>
              Công ty TNHH Giáo dục Đào tạo GIANTS · MST: 3603857294
            </p>
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>
              © {new Date().getFullYear()} Astra Language &amp; IT Center. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
