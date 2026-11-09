import { requireStaffPage, listTeachers, googleConfigured } from "@/lib/staff";
import StaffNav from "../StaffNav";
import TeacherAdmin from "./TeacherAdmin";

export const dynamic = "force-dynamic";

// Admin: teacher accounts (Gmail), each with a fixed room link.
export default async function TeacherAdminPage() {
  const staff = await requireStaffPage({ admin: true });
  const teachers = await listTeachers();
  return (
    <div className="wrap-wide" style={{ maxWidth: 960 }}>
      <StaffNav staff={staff} title="Tài khoản giáo viên" subtitle="GV đăng nhập bằng Gmail được cấp ở đây. Tài khoản mật khẩu hiện tại là Admin." />
      {!googleConfigured() && (
        <div className="card" style={{ borderColor: "var(--accent)" }}>
          <p style={{ margin: 0 }}>⚠ Máy chủ chưa cài <b>GOOGLE_CLIENT_ID</b> / <b>GOOGLE_CLIENT_SECRET</b> — GV chưa đăng nhập được. Làm theo phần “Đăng nhập Google” trong hướng dẫn cài đặt (khoảng 10 phút), rồi deploy lại.</p>
        </div>
      )}
      <TeacherAdmin initial={JSON.parse(JSON.stringify(teachers))} />
    </div>
  );
}
