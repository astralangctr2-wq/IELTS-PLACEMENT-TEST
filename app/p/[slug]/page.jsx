import { redirect } from "next/navigation";
import { getTeacherByRoom, teacherLabel } from "@/lib/staff";
import { roomSessions } from "@/lib/testSessions";
import { formatVnShort } from "@/lib/vnTime";
import RoomRefresh from "./RoomRefresh";

export const dynamic = "force-dynamic";
export const metadata = { title: "Phòng thi — Astra", robots: { index: false } };

// A teacher's fixed room link (/p/lan): the lab computers keep it once.
// One exam open on it → straight in. Several → the student picks. None →
// waits and checks again by itself.
export default async function RoomPage({ params }) {
  const t = await getTeacherByRoom(params.slug);
  if (!t) {
    return (
      <div className="wrap"><div className="card card-strong">
        <p className="accent" style={{ fontSize: 16 }}>Không tìm thấy phòng thi này.</p>
        <p className="muted" style={{ fontSize: 14, marginTop: 8 }}>Kiểm tra lại đường link, hoặc vào trang chủ và nhập mã thi giáo viên đưa.</p>
        <p style={{ marginTop: 12 }}><a href="/">← Trang chủ</a></p>
      </div></div>
    );
  }
  const list = await roomSessions(t.id);
  if (list.length === 1) redirect(`/test/s/${list[0].id}`);
  return (
    <div className="wrap">
      <div className="card card-strong room-wait">
        <p className="mono muted" style={{ margin: 0, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>Phòng thi · {teacherLabel(t)}</p>
        {list.length === 0 ? (
          <>
            <p className="serif" style={{ fontSize: 22, margin: "10px 0 6px" }}>Chưa có bài thi nào đang mở</p>
            <p className="muted" style={{ margin: 0 }}>Vui lòng chờ giáo viên mở ca thi. Trang tự kiểm tra lại mỗi 15 giây.</p>
            <RoomRefresh seconds={15} />
          </>
        ) : (
          <>
            <p className="serif" style={{ fontSize: 22, margin: "10px 0 12px" }}>Chọn bài thi của bạn</p>
            <div className="stack">
              {list.map((s) => (
                <a key={s.id} href={`/test/s/${s.id}`} className="room-pick">
                  <b>{s.name}</b>
                  <span className="muted">{[s.class_name && `Lớp ${s.class_name}`, s.opens_at && `mở ${formatVnShort(s.opens_at)}`].filter(Boolean).join(" · ")}</span>
                </a>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
