import { getSession, toRunnerConfig } from "@/lib/testSessions";
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
  return <TestRunner config={{ ...config, sessionId: session.id }} />;
}
