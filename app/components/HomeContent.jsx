"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CENTER_NAME, LOGO_URL } from "@/lib/branding";

const FEATURES = [
  {
    icon: "🖥️",
    title: "Trải nghiệm như thi thật",
    desc: "Được trải nghiệm luyện tập / thi thử trên giao diện sát với đi thi thật.",
  },
  {
    icon: "🎯",
    title: "Chấm điểm tự động",
    desc: "Reading và Listening được chấm tức thì, và chính xác tuyệt đối ngay khi học viên nộp bài.",
  },
  {
    icon: "📚",
    title: "Ngân hàng đề đa dạng",
    desc: "Đầy đủ đề luyện tập, thi thử cho 2 kỳ thi IELTS và Aptis ESOL.",
  },
  {
    icon: "✨",
    title: "Giao diện thân thiện",
    desc: "Toàn bộ nền tảng được thiết kế nhằm đem lại một trải nghiệm thi thoải mái, chính xác, tin cậy.",
  },
];

const PROGRAMS = [
  {
    key: "ielts",
    icon: "⭐",
    tag: "Phổ biến",
    title: "IELTS",
    desc: "Academic & General — thang điểm 0–9, chuẩn quốc tế cho du học và làm việc toàn cầu.",
    org: "IDP / BC",
  },
  {
    key: "aptis",
    icon: "🇬🇧",
    title: "Aptis ESOL",
    desc: "British Council — đánh giá linh hoạt theo nhu cầu công việc, học tập.",
    org: "British Council",
  },
  {
    key: "placement",
    icon: "🎯",
    title: "Placement Test",
    desc: "Đánh giá năng lực đầu vào, giúp xếp đúng lớp học phù hợp với trình độ.",
    org: "Astra",
  },
];

const TEST_TYPES = [
  {
    key: "placement",
    icon: "🎯",
    title: "Placement Test",
    desc: "Đánh giá năng lực đầu vào của học viên mới, giúp xếp đúng lớp học phù hợp với trình độ.",
  },
  {
    key: "midterm",
    icon: "📊",
    title: "Mid-term Test",
    desc: "Kiểm tra giữa kỳ, theo dõi tiến độ học tập của học viên trong quá trình học.",
  },
  {
    key: "mock",
    icon: "🧪",
    title: "Mock Test",
    desc: "Luyện tập với giao diện làm bài gần giống thi thật — cơ hội để học viên làm quen và tự tin hơn trước kỳ thi chính thức.",
  },
  {
    key: "final",
    icon: "🏁",
    title: "Final Test",
    desc: "Kiểm tra cuối kỳ, đánh giá tổng kết năng lực học viên sau khi hoàn thành khoá học.",
  },
];

// Compact login form used inside the nav popover — same API call as the
// dedicated /teacher/login page, just styled to fit a small dropdown.
function LoginPopoverForm({ onSuccess }) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      onSuccess?.();
      router.push("/teacher");
      router.refresh();
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <form onSubmit={submit} className="stack" style={{ gap: 10 }}>
      <p className="mono muted" style={{ margin: 0, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Khu vực Giáo viên
      </p>
      <div>
        <p style={{ marginBottom: 6, fontSize: 14 }}>Mật khẩu:</p>
        <div style={{ position: "relative" }}>
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            style={{ paddingRight: 60 }}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="mono muted"
            style={{
              position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
              background: "transparent", border: "none", cursor: "pointer", fontSize: 12, padding: "6px 8px",
            }}
          >
            {showPassword ? "Ẩn" : "Hiện"}
          </button>
        </div>
      </div>
      {error && <p className="accent" style={{ fontSize: 13, margin: 0 }}>{error}</p>}
      <button className="btn" type="submit" disabled={loading || !password} style={{ width: "100%" }}>
        {loading ? "Đang kiểm tra…" : "Đăng nhập →"}
      </button>
    </form>
  );
}

// Nav-corner login control: a button that opens a small popover card
// directly beneath it, instead of the login form living in its own
// section further down the page. When already logged in, this becomes
// a direct link to the dashboard instead.
function TeacherNavControl({ loggedIn }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClickOutside);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (loggedIn) {
    return (
      <Link href="/teacher"><button className="btn-ghost btn-sm">Bảng điều khiển Giáo viên →</button></Link>
    );
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen((v) => !v)}>
        Đăng nhập Giáo viên →
      </button>
      {open && (
        <div className="nav-login-popover card card-strong">
          <LoginPopoverForm onSuccess={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

export default function HomeContent({ loggedIn }) {
  const heroLoginRef = useRef(null);

  const hrefFor = (category) => {
    const target = `/teacher/sessions?category=${category}`;
    return loggedIn ? target : `/teacher/login?redirect=${encodeURIComponent(target)}`;
  };

  return (
    <div className="landing">
      {/* Nav */}
      <nav className="landing-nav">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {LOGO_URL && <img src={LOGO_URL} alt={CENTER_NAME} style={{ height: 30, width: "auto" }} />}
          <span className="serif" style={{ fontWeight: 700, fontSize: 17 }}>{CENTER_NAME}</span>
        </div>
        <TeacherNavControl loggedIn={loggedIn} />
      </nav>

      {/* Hero */}
      <header className="landing-hero">
        <p className="mono muted" style={{ fontSize: 13, marginBottom: 14, letterSpacing: "0.04em" }}>
          🌟 Hệ thống kiểm tra &amp; luyện thi nội bộ dành cho học viên Astra
        </p>
        <h1 className="serif" style={{ fontSize: "clamp(28px, 5vw, 44px)", lineHeight: 1.2, margin: "0 0 18px", maxWidth: 760 }}>
          Luyện thi IELTS &amp; Aptis ESOL ngay trên nền tảng của trung tâm
        </h1>
        <p className="muted" style={{ fontSize: 16, maxWidth: 600, lineHeight: 1.7 }}>
          Nền tảng đánh giá năng lực tiếng Anh chuẩn quốc tế — từ kiểm tra đầu vào đến luyện thi thực chiến, chấm điểm tự động Reading &amp; Listening, giáo viên chấm Writing trực tiếp.
        </p>
      </header>

      {/* Test type cards */}
      <section className="landing-section" style={{ borderTop: "none", paddingTop: 0 }}>
        <div className="test-grid">
          {TEST_TYPES.map((t) => (
            <div key={t.key} className="test-card">
              <div style={{ fontSize: 26, marginBottom: 10 }}>{t.icon}</div>
              <p className="test-card-title">{t.title}</p>
              <p className="test-card-desc">{t.desc}</p>
              <Link href={hrefFor(t.key)}>
                <button className="btn">Tạo link cho bài này →</button>
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Programs — chương trình luyện thi */}
      <section className="landing-section">
        <h2 className="serif" style={{ fontSize: 24, marginBottom: 8 }}>Chọn chương trình luyện thi</h2>
        <p className="muted" style={{ marginBottom: 28 }}>Mỗi chương trình gồm đủ 4 kỹ năng: Nghe, Nói, Đọc, Viết</p>
        <div className="program-grid">
          {PROGRAMS.map((p) => (
            <div key={p.key} className="program-card">
              <div className="program-icon">{p.icon}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <p style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{p.title}</p>
                {p.tag && <span className="tag" style={{ fontSize: 11, padding: "2px 10px" }}>{p.tag}</span>}
              </div>
              <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.6, margin: "0 0 14px" }}>{p.desc}</p>
              <p className="mono muted" style={{ fontSize: 11.5, margin: 0 }}>📘 4 kỹ năng &nbsp; 🎓 {p.org}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="landing-section">
        <h2 className="serif" style={{ fontSize: 24, marginBottom: 8 }}>Vì sao dùng nền tảng này?</h2>
        <p className="muted" style={{ marginBottom: 28 }}>Trải nghiệm luyện thi hiện đại, chính xác và đáng tin cậy.</p>
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
