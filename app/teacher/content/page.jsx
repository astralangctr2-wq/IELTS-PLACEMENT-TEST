import { requireTeacherOrRedirect } from "@/lib/auth";
import ContentEditor from "./ContentEditor";

export default function TeacherContentPage() {
  requireTeacherOrRedirect();
  return (
    <div className="wrap">
      <div className="topbar">
        <p className="serif" style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Quản lý đề thi</p>
        <a href="/teacher"><button className="btn-ghost btn-sm">← Bảng điều khiển</button></a>
      </div>
      <ContentEditor />
    </div>
  );
}
