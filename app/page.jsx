import Link from "next/link";
import { isTeacherLoggedIn } from "@/lib/auth";
import { CATEGORY_LABELS } from "@/lib/contentBanks";
import BrandBar from "./components/BrandBar";

const TEST_TYPES = [
  {
    key: "placement",
    tag: CATEGORY_LABELS.placement,
    desc: "Đánh giá năng lực đầu vào của học viên mới, giúp xếp đúng lớp học phù hợp với trình độ.",
  },
  {
    key: "midterm",
    tag: CATEGORY_LABELS.midterm,
    desc: "Kiểm tra giữa kỳ, theo dõi tiến độ học tập của học viên trong quá trình học.",
  },
  {
    key: "mock",
    tag: CATEGORY_LABELS.mock,
    desc: "Luyện tập với giao diện làm bài gần giống thi thật — cơ hội để học viên làm quen và tự tin hơn trước kỳ thi chính thức.",
  },
  {
    key: "final",
    tag: CATEGORY_LABELS.final,
    desc: "Kiểm tra cuối kỳ, đánh giá tổng kết năng lực học viên sau khi hoàn thành khoá học.",
  },
];

export default function HomePage() {
  const loggedIn = isTeacherLoggedIn();

  const hrefFor = (category) => {
    const target = `/teacher/sessions?category=${category}`;
    return loggedIn ? target : `/teacher/login?redirect=${encodeURIComponent(target)}`;
  };

  return (
    <div className="wrap-wide">
      <div className="hero">
        <BrandBar size="hero" style={{ justifyContent: "center" }} />
        <p className="serif hero-title">Hệ thống kiểm tra & luyện thi</p>
        <p className="muted hero-sub">
          Mỗi bài test được gửi tới học viên qua một đường link riêng. Chọn loại bài test bên dưới để tạo link cho lớp của bạn.
        </p>
      </div>

      <div className="test-grid">
        {TEST_TYPES.map((t) => (
          <div key={t.key} className="test-card">
            <p className="tag" style={{ marginBottom: 12 }}>{t.tag}</p>
            <p className="test-card-desc">{t.desc}</p>
            <Link href={hrefFor(t.key)}>
              <button className="btn">Tạo link cho bài này →</button>
            </Link>
          </div>
        ))}
      </div>

      <div className="row" style={{ justifyContent: "center" }}>
        {loggedIn ? (
          <Link href="/teacher"><button className="btn-ghost btn-sm">Bảng điều khiển Giáo viên →</button></Link>
        ) : (
          <Link href="/teacher/login"><button className="btn-ghost btn-sm">Giáo viên đăng nhập →</button></Link>
        )}
      </div>
    </div>
  );
}
