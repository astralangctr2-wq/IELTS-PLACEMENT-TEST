import { requireTeacherOrRedirect } from "@/lib/auth";
import { listSessions } from "@/lib/testSessions";
import { listContentBanks, CATEGORY_LABELS } from "@/lib/contentBanks";
import SessionManager from "./SessionManager";

export const dynamic = "force-dynamic";

export default async function SessionsPage({ searchParams }) {
  requireTeacherOrRedirect();
  const category = searchParams?.category || "";
  const sessions = await listSessions();
  const banks = await listContentBanks();
  const bankSummaries = banks.map((b) => ({ id: b.id, name: b.name, category: b.category }));
  return (
    <div className="wrap">
      <div className="topbar">
        <div>
          <p className="serif" style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Tạo link phiên thi</p>
          {category && CATEGORY_LABELS[category] && (
            <p className="mono muted" style={{ fontSize: 12, margin: 0 }}>Đang tạo link cho: {CATEGORY_LABELS[category]}</p>
          )}
        </div>
        <a href="/teacher"><button className="btn-ghost btn-sm">← Bảng điều khiển</button></a>
      </div>
      <SessionManager initialSessions={sessions} banks={bankSummaries} initialCategory={category} />
    </div>
  );
}
