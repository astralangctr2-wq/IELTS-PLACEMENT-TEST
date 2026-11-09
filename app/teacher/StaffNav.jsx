import LogoutButton from "./LogoutButton";
import Bell from "./Bell";
import SwRegister from "./SwRegister";

// Top bar of the teacher area. Admin: everything. Teacher: their
// submissions, the links given to them, stats of their own students.
export default function StaffNav({ staff, title, subtitle }) {
  const admin = staff?.role === "admin";
  return (
    <div className="topbar">
      <SwRegister />
      <div>
        <p className="serif" style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{title}</p>
        {subtitle && <p className="mono muted" style={{ fontSize: 13, margin: "4px 0 0" }}>{subtitle}</p>}
      </div>
      <div className="staff-nav">
        <a href="/teacher"><button className="btn-ghost btn-sm">🗂 Bài nộp</button></a>
        {admin ? (
          <>
            <a href="/teacher/nhap-nhanh"><button className="btn-ghost btn-sm">📋 Nhập nhanh</button></a>
            <a href="/teacher/sessions"><button className="btn-ghost btn-sm">🔗 Link thi</button></a>
            <a href="/teacher/content"><button className="btn-ghost btn-sm">📚 Đề thi</button></a>
            <a href="/teacher/admin"><button className="btn-ghost btn-sm">👥 Giáo viên</button></a>
            <a href="/teacher/stats"><button className="btn-ghost btn-sm">📊 Thống kê</button></a>
            <a href="/teacher/khao-sat"><button className="btn-ghost btn-sm">📝 Khảo sát</button></a>
            <Bell />
          </>
        ) : (
          <>
            <a href="/teacher/links"><button className="btn-ghost btn-sm">🔗 Link được giao</button></a>
            <a href="/teacher/stats"><button className="btn-ghost btn-sm">📊 Thống kê</button></a>
            <span className="mono muted" style={{ fontSize: 13 }}>{staff?.name}</span>
          </>
        )}
        <LogoutButton />
      </div>
    </div>
  );
}
