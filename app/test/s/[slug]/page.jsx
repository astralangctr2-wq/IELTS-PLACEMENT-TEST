import { getSession, toRunnerConfig } from "@/lib/testSessions";
import { getContentBank, getDefaultContentBank } from "@/lib/contentBanks";
import TestRunner from "../../TestRunner";

export const dynamic = "force-dynamic";

export default async function SessionTestPage({ params }) {
  const session = await getSession(params.slug);

  if (!session) {
    return (
      <div className="wrap">
        <div className="card card-strong">
          <p className="accent" style={{ fontSize: 16 }}>Không tìm thấy phiên thi này.</p>
          <p className="muted" style={{ fontSize: 14, marginTop: 8 }}>Đường link có thể đã bị sai hoặc phiên thi đã bị xoá. Vui lòng liên hệ giáo viên để lấy lại link.</p>
        </div>
      </div>
    );
  }

  if (!session.active) {
    return (
      <div className="wrap">
        <div className="card card-strong">
          <p className="accent" style={{ fontSize: 16 }}>Phiên thi này hiện đã đóng.</p>
          <p className="muted" style={{ fontSize: 14, marginTop: 8 }}>Vui lòng liên hệ giáo viên nếu bạn cần làm bài.</p>
        </div>
      </div>
    );
  }

  const config = toRunnerConfig(session);

  // The category (placement / midterm / mock / final / other) lives on
  // the content bank, not on the session — fetched here so the runner
  // can title itself correctly and only ask "target band" for Placement
  // tests. Falls back to the currently-default bank for older sessions
  // created before content banks existed (contentBankId === null), and
  // to "placement" if even that can't be resolved.
  const bank = config.contentBankId
    ? await getContentBank(config.contentBankId)
    : await getDefaultContentBank();
  const category = bank?.category || "placement";

  return <TestRunner config={{ ...config, sessionId: session.id, category }} />;
}
