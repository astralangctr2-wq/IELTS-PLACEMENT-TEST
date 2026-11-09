import { requireStaffPage } from "@/lib/staff";
import { listContentBanks } from "@/lib/contentBanks";
import { scoredCount, sectionsCount } from "@/lib/scoring";
import BankManager from "./BankManager";

export const dynamic = "force-dynamic";

export default async function TeacherContentPage() {
  const staff = await requireStaffPage({ admin: true });
  const banks = await listContentBanks();
  // don't ship full question content to the client on initial load —
  // BankManager fetches a bank's full content only when the teacher
  // opens it for editing.
  const summaries = banks.map((b) => ({
    id: b.id,
    name: b.name,
    category: b.category,
    className: b.class_name || "",
    created_at: b.created_at,
    grammarCount: Array.isArray(b.content.grammar) ? scoredCount(b.content.grammar) : null,
    readingCount: sectionsCount(b.content.reading),
    listeningCount: sectionsCount(b.content.listening),
    hasWriting: Boolean(b.content.writing),
  }));
  return (
    <div className="wrap">
      <div className="topbar">
        <p className="serif" style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Quản lý các bộ đề</p>
        <a href="/teacher"><button className="btn-ghost btn-sm">← Bảng điều khiển</button></a>
      </div>
      <BankManager initialBanks={summaries} />
    </div>
  );
}
