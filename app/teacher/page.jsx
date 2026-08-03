import Link from "next/link";
import { requireTeacherOrRedirect } from "@/lib/auth";
import { sql, ensureSchema } from "@/lib/db";
import LogoutButton from "./LogoutButton";
import DeleteButton from "./DeleteButton";

export const dynamic = "force-dynamic";

export default async function TeacherDashboard() {
  requireTeacherOrRedirect();
  await ensureSchema();

  const { rows } = await sql`
    SELECT id, student_name, created_at, objective_band, writing_word_count, final_band, graded
    FROM submissions
    ORDER BY created_at DESC
  `;

  const pendingCount = rows.filter((r) => !r.graded).length;

  return (
    <div className="wrap-wide">
      <div className="topbar">
        <div>
          <p className="serif" style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Bảng điều khiển Giáo viên</p>
          <p className="mono muted" style={{ fontSize: 12, margin: 0 }}>{rows.length} bài nộp — {pendingCount} chưa chấm Writing</p>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <Link href="/teacher/content"><button className="btn-ghost btn-sm">Quản lý đề thi</button></Link>
          <LogoutButton />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card"><p className="muted">Chưa có bài nộp nào.</p></div>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Học viên</th>
                <th>Thời gian</th>
                <th>Band tự động</th>
                <th>Số từ Writing</th>
                <th>Trạng thái</th>
                <th>Band cuối</th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.student_name}</td>
                  <td className="mono muted">{new Date(r.created_at).toLocaleString("vi-VN")}</td>
                  <td>{Number(r.objective_band).toFixed(1)}</td>
                  <td>{r.writing_word_count}</td>
                  <td>{r.graded ? <span className="success">Đã chấm</span> : <span className="accent">Chưa chấm</span>}</td>
                  <td>{r.graded ? Number(r.final_band).toFixed(1) : "—"}</td>
                  <td><Link href={`/teacher/${r.id}`}><button className="btn-ghost btn-sm">Xem & chấm →</button></Link></td>
                  <td><DeleteButton id={r.id} studentName={r.student_name} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
