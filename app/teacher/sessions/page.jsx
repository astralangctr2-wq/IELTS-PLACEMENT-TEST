import { requireTeacherOrRedirect } from "@/lib/auth";
import { listSessions } from "@/lib/testSessions";
import SessionManager from "./SessionManager";

export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  requireTeacherOrRedirect();
  const sessions = await listSessions();
  return (
    <div className="wrap">
      <div className="topbar">
        <p className="serif" style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Tạo link phiên thi</p>
        <a href="/teacher"><button className="btn-ghost btn-sm">← Bảng điều khiển</button></a>
      </div>
      <SessionManager initialSessions={sessions} />
    </div>
  );
}
