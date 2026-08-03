import Link from "next/link";

export default function Home() {
  return (
    <div className="wrap">
      <div className="topbar">
        <div>
          <p className="serif" style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>IELTS Placement Test</p>
          <p className="mono muted" style={{ fontSize: 12, margin: 0 }}>Bài kiểm tra xếp lớp</p>
        </div>
      </div>

      <div className="card card-strong stack">
        <div>
          <span className="tag">Học viên</span>
          <p className="serif" style={{ fontSize: 18, margin: "8px 0" }}>Làm bài kiểm tra đầu vào</p>
          <p className="muted" style={{ fontSize: 14, margin: "0 0 12px" }}>Ngữ pháp, Reading, Listening được chấm tự động. Writing sẽ được giáo viên chấm sau.</p>
          <Link href="/test"><button className="btn">Bắt đầu làm bài →</button></Link>
        </div>
      </div>

      <div className="card stack">
        <div>
          <span className="tag">Giáo viên</span>
          <p className="serif" style={{ fontSize: 18, margin: "8px 0" }}>Xem & chấm bài học viên</p>
          <p className="muted" style={{ fontSize: 14, margin: "0 0 12px" }}>Đăng nhập để xem danh sách bài nộp và chấm điểm Writing.</p>
          <Link href="/teacher/login"><button className="btn-ghost">Đăng nhập giáo viên →</button></Link>
        </div>
      </div>
    </div>
  );
}
