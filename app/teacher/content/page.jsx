import { requireTeacherOrRedirect } from "@/lib/auth";
import { listContentBanks } from "@/lib/contentBanks";
import BankManager from "./BankManager";

export const dynamic = "force-dynamic";

export default async function TeacherContentPage() {
  requireTeacherOrRedirect();
  const banks = await listContentBanks();
  // don't ship full question content to the client on initial load —
  // BankManager fetches a bank's full content only when the teacher
  // opens it for editing.
  const summaries = banks.map((b) => ({
    id: b.id,
    name: b.name,
    category: b.category,
    created_at: b.created_at,
    grammarCount: b.content.grammar?.length ?? null,
    readingCount: b.content.reading ? b.content.reading.sections.reduce((n, s) => n + s.questions.length, 0) : null,
    listeningCount: b.content.listening ? b.content.listening.sections.reduce((n, s) => n + s.questions.length, 0) : null,
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
