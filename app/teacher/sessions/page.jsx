import { requireTeacherOrRedirect } from "@/lib/auth";
import { listSessions } from "@/lib/testSessions";
import { listContentBanks } from "@/lib/contentBanks";
import SessionManager from "./SessionManager";

export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  requireTeacherOrRedirect();
  const sessions = await listSessions();
  const banks = await listContentBanks();
  const bankSummaries = banks.map((b) => ({ id: b.id, name: b.name, is_default: b.is_default }));
  return (
    <div className="wrap">
      <div className="topbar">
        <p className="serif" style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Tạo link phiên thi</p>
        <a href="/teacher"><button className="btn-ghost btn-sm">← Bảng điều khiển</button></a>
      </div>
      <SessionManager initialSessions={sessions} banks={bankSummaries} />
    </div>
  );
}
