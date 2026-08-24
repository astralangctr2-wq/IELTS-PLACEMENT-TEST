import Link from "next/link";
import BrandBar from "../components/BrandBar";

// There is no more fixed/public test link — every test (including
// Placement) is now accessed only through a link a teacher generates
// at /teacher/sessions (which lands on /test/s/[slug]). This page just
// explains that to anyone who lands on the bare /test URL.
export default function TestPage() {
  return (
    <div className="wrap">
      <div className="topbar">
        <BrandBar size="large" />
      </div>
      <div className="card card-strong" style={{ textAlign: "center", padding: 40 }}>
        <p className="serif" style={{ fontSize: 20, marginBottom: 10 }}>Cần link riêng để làm bài</p>
        <p className="muted" style={{ fontSize: 14, lineHeight: 1.6 }}>
          Trang này không dùng để làm bài trực tiếp. Giáo viên sẽ gửi cho bạn một đường link riêng
          (dạng .../test/s/xxxxxxx) — hãy dùng đúng link đó để bắt đầu.
        </p>
      </div>
      <div className="row" style={{ justifyContent: "center" }}>
        <Link href="/"><button className="btn-ghost btn-sm">← Về trang chủ</button></Link>
      </div>
    </div>
  );
}
